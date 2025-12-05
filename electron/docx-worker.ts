/**
 * DOCX Export Worker
 * Runs in a separate thread to prevent blocking the main process
 */

import { parentPort, workerData } from 'worker_threads';
import { Document, Packer, Paragraph, BorderStyle, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';

// Types
interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TextStyleAttrs {
  fontSize?: string;
  fontFamily?: string;
  color?: string;
}

interface ProgressMessage {
  type: 'progress';
  current: number;
  total: number;
  phase: string;
}

interface CompleteMessage {
  type: 'complete';
  buffer: Buffer;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type WorkerMessage = ProgressMessage | CompleteMessage | ErrorMessage;
export type { WorkerMessage }; // Export to avoid unused warning

// Send progress update to main thread
function sendProgress(current: number, total: number, phase: string) {
  parentPort?.postMessage({ type: 'progress', current, total, phase } as ProgressMessage);
}

// Font fallback map for Word compatibility
const FONT_FALLBACK_MAP: Record<string, string> = {
  'Inter': 'Arial',
  'Roboto': 'Arial',
  'Open Sans': 'Arial',
  'Lato': 'Arial',
  'Merriweather': 'Georgia',
  'Crimson Text': 'Georgia',
  'Lora': 'Georgia',
  'Playfair Display': 'Georgia',
  'JetBrains Mono': 'Courier New',
  'Fira Code': 'Courier New',
};

// Convert px to half-points (1:1 mapping for intuitive sizing)
function pxToHalfPoints(px: string): number {
  const numericValue = parseFloat(px);
  if (isNaN(numericValue)) return 28; // Default 14pt
  const halfPoints = Math.round(numericValue * 2);
  if (halfPoints < 2) return 2;
  if (halfPoints > 400) return 400;
  return halfPoints;
}

// Extract font name and map to Word-compatible fallback
function extractFontName(fontFamily: string | undefined): string {
  if (!fontFamily) return 'Georgia';
  const primaryFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
  return FONT_FALLBACK_MAP[primaryFont] || primaryFont;
}

// Map Tiptap alignment to DOCX AlignmentType
function tiptapAlignToDocx(align: string | undefined): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
  switch (align) {
    case 'left': return AlignmentType.LEFT;
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

// Normalize color to hex format
function normalizeColorToHex(color: string | undefined): string | undefined {
  if (!color || color === '') return undefined;
  if (color.startsWith('#')) return color.replace('#', '');

  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return undefined;
}

// Extract text style from marks
function extractTextStyle(marks: TiptapMark[]): TextStyleAttrs {
  const textStyleMark = marks.find(m => m.type === 'textStyle');
  return textStyleMark?.attrs || {};
}

// Create a TextRun from a text node
function createTextRun(node: TiptapNode, options?: { color?: string; defaultSize?: number }): TextRun {
  const marks = node.marks || [];

  const isBold = marks.some(m => m.type === 'bold');
  const isItalic = marks.some(m => m.type === 'italic');
  const isStrike = marks.some(m => m.type === 'strike');
  const isCode = marks.some(m => m.type === 'code');
  const isUnderline = marks.some(m => m.type === 'underline');

  const textStyle = extractTextStyle(marks);
  const highlightMark = marks.find(m => m.type === 'highlight');

  let fontSize = options?.defaultSize;
  if (textStyle.fontSize) {
    fontSize = pxToHalfPoints(textStyle.fontSize);
  }

  const fontFamily = isCode ? 'Courier New' : extractFontName(textStyle.fontFamily);

  let textColor = options?.color;
  if (!textColor && textStyle.color) {
    textColor = normalizeColorToHex(textStyle.color);
  }

  const highlightColor = highlightMark?.attrs?.color;
  const normalizedHighlight = normalizeColorToHex(highlightColor);

  return new TextRun({
    text: node.text || '',
    bold: isBold,
    italics: isItalic,
    strike: isStrike,
    font: fontFamily,
    size: fontSize,
    color: textColor,
    underline: isUnderline ? {} : undefined,
    shading: normalizedHighlight ? { fill: normalizedHighlight } : undefined,
  });
}

// Process text nodes into TextRuns
function processTextNodes(nodes: TiptapNode[], options?: { color?: string; defaultSize?: number }): TextRun[] {
  return nodes
    .filter(node => node.type === 'text')
    .map(node => createTextRun(node, options));
}

// Create a paragraph
function createParagraph(node: TiptapNode): Paragraph {
  return new Paragraph({
    alignment: tiptapAlignToDocx(node.attrs?.textAlign),
    children: processTextNodes(node.content || []),
  });
}

// Create a heading
function createHeading(node: TiptapNode): Paragraph {
  const level = node.attrs?.level || 1;
  let defaultSize = 64; // H1 = 32pt
  if (level === 2) defaultSize = 48;
  if (level === 3) defaultSize = 40;

  const headingLevel = level === 1 ? HeadingLevel.HEADING_1
    : level === 2 ? HeadingLevel.HEADING_2
    : HeadingLevel.HEADING_3;

  return new Paragraph({
    heading: headingLevel,
    alignment: tiptapAlignToDocx(node.attrs?.textAlign),
    children: processTextNodes(node.content || [], { color: '000000', defaultSize }),
  });
}

// Process list item
function processListItem(listItem: TiptapNode, context: { type: 'bullet' | 'ordered'; level: number; numberingReference?: string }): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const content of listItem.content || []) {
    if (content.type === 'paragraph') {
      if (context.type === 'bullet') {
        paragraphs.push(new Paragraph({
          bullet: { level: context.level },
          alignment: tiptapAlignToDocx(content.attrs?.textAlign),
          children: processTextNodes(content.content || []),
        }));
      } else {
        paragraphs.push(new Paragraph({
          numbering: { reference: context.numberingReference!, level: context.level },
          alignment: tiptapAlignToDocx(content.attrs?.textAlign),
          children: processTextNodes(content.content || []),
        }));
      }
    } else if (content.type === 'bulletList') {
      paragraphs.push(...processBulletList(content, context.level + 1));
    } else if (content.type === 'orderedList') {
      paragraphs.push(...processOrderedList(content, context.level + 1, context.numberingReference || 'default-numbering'));
    }
  }

  return paragraphs;
}

// Process bullet list
function processBulletList(node: TiptapNode, level: number = 0): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const listItem of node.content || []) {
    if (listItem.type === 'listItem') {
      paragraphs.push(...processListItem(listItem, { type: 'bullet', level }));
    }
  }
  return paragraphs;
}

// Process ordered list
function processOrderedList(node: TiptapNode, level: number = 0, numberingReference: string = 'default-numbering'): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const listItem of node.content || []) {
    if (listItem.type === 'listItem') {
      paragraphs.push(...processListItem(listItem, { type: 'ordered', level, numberingReference }));
    }
  }
  return paragraphs;
}

// Convert base64 to buffer
function base64ToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

// Create image paragraph
function createImageParagraph(node: TiptapNode): Paragraph {
  const { src, width, height, align } = node.attrs || {};

  if (!src || !src.startsWith('data:')) {
    return new Paragraph({ text: '' });
  }

  try {
    const imageBuffer = base64ToBuffer(src);
    const imgWidth = Math.min(Math.max(parseInt(width) || 400, 1), 2000);
    const imgHeight = Math.min(Math.max(parseInt(height) || 300, 1), 2000);

    // Detect image type
    let imageType: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
    if (src.includes('image/jpeg') || src.includes('image/jpg')) imageType = 'jpg';
    else if (src.includes('image/gif')) imageType = 'gif';
    else if (src.includes('image/bmp')) imageType = 'bmp';

    const imageRun = new ImageRun({
      data: imageBuffer,
      transformation: { width: imgWidth, height: imgHeight },
      type: imageType,
    });

    return new Paragraph({
      alignment: tiptapAlignToDocx(align),
      children: [imageRun],
    });
  } catch (error) {
    console.error('Error creating image:', error);
    return new Paragraph({ text: '' });
  }
}

// Main export function
async function generateDocx(content: any): Promise<Buffer> {
  const nodes = content.content || [];
  const total = nodes.length;
  const children: Paragraph[] = [];

  sendProgress(0, total, 'Processing document');

  // Process nodes in batches for better progress reporting
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    try {
      switch (node.type) {
        case 'paragraph':
          children.push(createParagraph(node));
          break;
        case 'heading':
          children.push(createHeading(node));
          break;
        case 'bulletList':
          children.push(...processBulletList(node));
          break;
        case 'orderedList':
          children.push(...processOrderedList(node, 0, 'default-numbering'));
          break;
        case 'image':
          children.push(createImageParagraph(node));
          break;
        case 'horizontalRule':
          children.push(new Paragraph({
            border: {
              bottom: { color: '999999', space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
            spacing: { before: 200, after: 200 },
          }));
          break;
      }
    } catch (error) {
      console.error(`Error processing node ${node.type}:`, error);
      children.push(new Paragraph({ text: '' }));
    }

    // Report progress every 10 nodes or at the end
    if (i % 10 === 0 || i === nodes.length - 1) {
      sendProgress(i + 1, total, 'Processing document');
    }
  }

  sendProgress(total, total, 'Building document');

  const doc = new Document({
    sections: [{ properties: {}, children }],
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [
          { level: 0, format: 'decimal', text: '%1.', alignment: 'start', style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: 'lowerLetter', text: '%2.', alignment: 'start', style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          { level: 2, format: 'lowerRoman', text: '%3.', alignment: 'start', style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          { level: 3, format: 'decimal', text: '%4.', alignment: 'start', style: { paragraph: { indent: { left: 2880, hanging: 360 } } } },
          { level: 4, format: 'lowerLetter', text: '%5.', alignment: 'start', style: { paragraph: { indent: { left: 3600, hanging: 360 } } } },
          { level: 5, format: 'lowerRoman', text: '%6.', alignment: 'start', style: { paragraph: { indent: { left: 4320, hanging: 360 } } } },
          { level: 6, format: 'decimal', text: '%7.', alignment: 'start', style: { paragraph: { indent: { left: 5040, hanging: 360 } } } },
          { level: 7, format: 'lowerLetter', text: '%8.', alignment: 'start', style: { paragraph: { indent: { left: 5760, hanging: 360 } } } },
          { level: 8, format: 'lowerRoman', text: '%9.', alignment: 'start', style: { paragraph: { indent: { left: 6480, hanging: 360 } } } },
        ],
      }],
    },
  });

  sendProgress(total, total, 'Generating file');

  const buffer = await Packer.toBuffer(doc);

  return buffer;
}

// Worker entry point
async function main() {
  try {
    const content = workerData;
    const buffer = await generateDocx(content);
    parentPort?.postMessage({ type: 'complete', buffer } as CompleteMessage);
  } catch (error) {
    parentPort?.postMessage({ type: 'error', error: String(error) } as ErrorMessage);
  }
}

main();
