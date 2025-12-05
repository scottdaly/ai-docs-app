/**
 * Paragraph processing utilities for creating DOCX Paragraphs from Tiptap nodes
 * Handles paragraphs, headings, and their alignment
 */

import { Paragraph, HeadingLevel } from 'docx';
import { TiptapNode } from './types';
import { tiptapAlignToDocx } from './converters';
import { processTextNodes } from './text-processors';

/**
 * Creates a DOCX Paragraph from a Tiptap paragraph node
 * Preserves text alignment and all text formatting
 *
 * @param node - Tiptap paragraph node
 * @returns DOCX Paragraph with alignment and formatted text runs
 *
 * @example
 * const node = {
 *   type: 'paragraph',
 *   attrs: { textAlign: 'center' },
 *   content: [
 *     { type: 'text', text: 'Centered text', marks: [{ type: 'bold' }] }
 *   ]
 * };
 * createParagraph(node) // Returns Paragraph with center alignment and bold text
 */
export function createParagraph(node: TiptapNode): Paragraph {
  // Extract alignment from node attributes
  const alignment = tiptapAlignToDocx(node.attrs?.textAlign);

  // Process all text nodes (fixes the critical bug!)
  const children = processTextNodes(node.content || []);

  return new Paragraph({
    alignment,
    children,
  });
}

/**
 * Creates a DOCX Paragraph with heading style from a Tiptap heading node
 * Preserves both heading level AND text alignment
 *
 * @param node - Tiptap heading node with level attribute
 * @returns DOCX Paragraph with heading style, alignment, and formatted text
 *
 * @example
 * const node = {
 *   type: 'heading',
 *   attrs: { level: 1, textAlign: 'center' },
 *   content: [
 *     { type: 'text', text: 'My Title', marks: [{ type: 'bold' }] }
 *   ]
 * };
 * createHeading(node) // Returns Paragraph with HEADING_1 style, center alignment
 */
export function createHeading(node: TiptapNode): Paragraph {
  // Extract heading level
  const level = node.attrs?.level;

  // Map Tiptap level (1, 2, 3) to DOCX HeadingLevel and default sizes
  // These match the editor's default heading sizes from BlockTypeDropdown.tsx
  let headingLevel: typeof HeadingLevel[keyof typeof HeadingLevel];
  let defaultSize: number; // in half-points

  switch (level) {
    case 1:
      headingLevel = HeadingLevel.HEADING_1;
      defaultSize = 64; // 32px (editor) = 32pt (Word) - Number parity!
      break;
    case 2:
      headingLevel = HeadingLevel.HEADING_2;
      defaultSize = 48; // 24px (editor) = 24pt (Word) - Number parity!
      break;
    case 3:
      headingLevel = HeadingLevel.HEADING_3;
      defaultSize = 40; // 20px (editor) = 20pt (Word) - Number parity!
      break;
    default:
      headingLevel = HeadingLevel.HEADING_1;
      defaultSize = 64;
      console.warn(`Unexpected heading level: ${level}. Using HEADING_1.`);
  }

  // Extract alignment (headings can be aligned too!)
  const alignment = tiptapAlignToDocx(node.attrs?.textAlign);

  // Process all text nodes with formatting
  // Override color to black and set appropriate default size for heading level
  const children = processTextNodes(node.content || [], {
    color: '000000',
    defaultSize: defaultSize,
  });

  return new Paragraph({
    heading: headingLevel,
    alignment,
    children,
  });
}
