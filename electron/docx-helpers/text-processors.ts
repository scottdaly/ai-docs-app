/**
 * Text processing utilities for creating DOCX TextRuns from Tiptap nodes
 * This module fixes the critical bug where only the first text node was processed
 */

import { TextRun } from 'docx';
import { TiptapNode, TiptapMark, TextStyleAttrs } from './types';
import { pxToHalfPoints, extractFontName } from './converters';

/**
 * Extracts textStyle mark attributes (fontSize, fontFamily) from marks array
 *
 * @param marks - Array of marks from Tiptap text node
 * @returns TextStyle attributes or empty object
 *
 * @example
 * const marks = [
 *   { type: 'bold' },
 *   { type: 'textStyle', attrs: { fontSize: '16px', fontFamily: 'Inter' }}
 * ];
 * extractTextStyle(marks) // returns { fontSize: '16px', fontFamily: 'Inter' }
 */
export function extractTextStyle(marks?: TiptapMark[]): TextStyleAttrs {
  if (!marks) {
    return {};
  }

  const textStyleMark = marks.find(m => m.type === 'textStyle');
  if (!textStyleMark || !textStyleMark.attrs) {
    return {};
  }

  return {
    fontSize: textStyleMark.attrs.fontSize,
    fontFamily: textStyleMark.attrs.fontFamily,
    color: textStyleMark.attrs.color,
  };
}

/**
 * Creates a DOCX TextRun with full formatting from a Tiptap text node
 * Handles: bold, italic, strike, code, fontSize, fontFamily, color
 * Maps web fonts to Word-compatible fallbacks and defaults to Georgia when no font is specified
 *
 * @param node - Tiptap text node with marks and text content
 * @param options - Optional overrides (color, defaultSize)
 * @returns DOCX TextRun with all formatting applied
 *
 * @example
 * const node = {
 *   type: 'text',
 *   text: 'Hello',
 *   marks: [
 *     { type: 'bold' },
 *     { type: 'textStyle', attrs: { fontSize: '18px', fontFamily: 'Inter, sans-serif' }}
 *   ]
 * };
 * createTextRun(node) // Returns TextRun with bold, size 36 (18pt), font 'Arial' (Inter fallback)
 * // Node with no fontFamily → defaults to Georgia (Word-compatible serif)
 * createTextRun(node, { color: '000000', defaultSize: 28 }) // Black color with 14pt default
 */
export function createTextRun(node: TiptapNode, options?: { color?: string; defaultSize?: number }): TextRun {
  const marks = node.marks || [];

  // Extract boolean marks
  const isBold = marks.some(m => m.type === 'bold');
  const isItalic = marks.some(m => m.type === 'italic');
  const isStrike = marks.some(m => m.type === 'strike');
  const isCode = marks.some(m => m.type === 'code');
  const isUnderline = marks.some(m => m.type === 'underline');

  // Extract textStyle and highlight
  const textStyle = extractTextStyle(marks);
  const highlightMark = marks.find(m => m.type === 'highlight');

  // Convert fontSize from px to half-points, use provided default or 14pt (28 half-points)
  // Note: Default is now 14pt to match app's 14px default
  const fontSize = textStyle.fontSize
    ? pxToHalfPoints(textStyle.fontSize)
    : (options?.defaultSize || 28);

  // Extract clean font name, default to Georgia (Word-compatible fallback for Merriweather)
  const fontFamily = textStyle.fontFamily ? extractFontName(textStyle.fontFamily) : 'Georgia';

  // Code blocks use Courier New, otherwise use extracted font (or default Georgia)
  const font = isCode ? 'Courier New' : fontFamily;

  // Handle colors
  // Priority: options.color (for headings) > textStyle.color (user-selected)
  let textColor = options?.color;
  if (!textColor && textStyle.color) {
    // Remove # prefix for Word
    textColor = textStyle.color.replace('#', '');
  }

  // Handle highlight color
  const highlightColor = highlightMark?.attrs?.color;
  const docxHighlight = highlightColor ? hexToDocxHighlight(highlightColor) : undefined;

  return new TextRun({
    text: node.text || '',
    bold: isBold,
    italics: isItalic,
    strike: isStrike,
    underline: isUnderline ? { type: 'single' } : undefined,
    font: font,
    size: fontSize,
    color: textColor,
    highlight: docxHighlight,
  });
}

/**
 * Maps hex colors to DOCX highlight enum
 * DOCX only supports limited highlight colors, so we find the closest match
 */
function hexToDocxHighlight(hex: string): string {
  const colorMap: Record<string, string> = {
    '#ffff00': 'yellow',
    '#00ff00': 'green',
    '#00ffff': 'cyan',
    '#ff00ff': 'magenta',
    '#0000ff': 'blue',
    '#ff0000': 'red',
    '#ffa500': 'darkYellow',
    '#808080': 'darkGray',
  };

  const normalized = hex.toLowerCase();

  // Exact match
  if (colorMap[normalized]) {
    return colorMap[normalized];
  }

  // Find closest color using RGB distance
  const hexToRgb = (h: string) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return [r, g, b];
  };

  let closestColor = 'yellow';
  let minDistance = Infinity;

  const [targetR, targetG, targetB] = hexToRgb(normalized);

  for (const [mapHex, docxColor] of Object.entries(colorMap)) {
    const [r, g, b] = hexToRgb(mapHex);
    const distance = Math.sqrt(
      Math.pow(r - targetR, 2) +
      Math.pow(g - targetG, 2) +
      Math.pow(b - targetB, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = docxColor;
    }
  }

  return closestColor;
}

/**
 * Processes ALL text nodes in a paragraph content array
 * **CRITICAL FIX**: This iterates through ALL nodes, not just the first one
 *
 * The old implementation only read node.content?.[0]?.text, which lost all
 * formatting and text after the first text run.
 *
 * @param nodes - Array of Tiptap nodes (usually from paragraph.content)
 * @param options - Optional overrides (color, defaultSize)
 * @returns Array of DOCX TextRuns with full formatting
 *
 * @example
 * const content = [
 *   { type: 'text', text: 'Hello ', marks: [{ type: 'bold' }] },
 *   { type: 'text', text: 'world', marks: [{ type: 'italic' }] }
 * ];
 * processTextNodes(content) // Returns [TextRun('Hello ', bold), TextRun('world', italic)]
 * processTextNodes(content, { color: '000000', defaultSize: 48 }) // Black, 24pt default
 * // OLD BUG: Would only return 'Hello ' and lose 'world'
 */
export function processTextNodes(nodes: TiptapNode[], options?: { color?: string; defaultSize?: number }): TextRun[] {
  if (!nodes || nodes.length === 0) {
    return [new TextRun({ text: '', size: options?.defaultSize || 28 })];
  }

  // Filter for text nodes and map to TextRuns
  const textRuns = nodes
    .filter(node => node.type === 'text' || node.text !== undefined)
    .map(node => createTextRun(node, options));

  // Return at least one empty TextRun if no text nodes found
  return textRuns.length > 0 ? textRuns : [new TextRun({ text: '', size: options?.defaultSize || 28 })];
}
