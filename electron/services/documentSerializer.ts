/**
 * DocumentSerializer - Tiptap JSON to Markdown + Sidecar
 *
 * Converts Tiptap's rich JSON editor state into:
 * 1. Clean Markdown with block ID anchors (for version control friendliness)
 * 2. Sidecar JSON containing all formatting, metadata, and image references
 *
 * This separation keeps markdown files readable and diffable while preserving
 * all rich text formatting in the sidecar.
 */

import { ImageManager, ImageStoreResult } from './imageManager';
import {
  SidecarDocument,
  BlockFormatting,
  SpanFormatting,
  SpanMark,
  ImageInfo,
  createEmptySidecar,
} from './types';

// Tiptap JSON types
interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
}

export interface SerializedDocument {
  markdown: string;
  sidecar: SidecarDocument;
}

export class DocumentSerializer {
  private imageManager: ImageManager | null;
  private blockCounter: number = 0;

  constructor(imageManager: ImageManager | null = null) {
    this.imageManager = imageManager;
  }

  /**
   * Serialize Tiptap JSON to Markdown + Sidecar.
   */
  async serialize(json: TiptapDocument, existingSidecar?: SidecarDocument): Promise<SerializedDocument> {
    this.blockCounter = 0;

    const sidecar: SidecarDocument = existingSidecar
      ? { ...existingSidecar, meta: { ...existingSidecar.meta, modified: new Date().toISOString() } }
      : createEmptySidecar();

    // Update modified timestamp
    sidecar.meta.modified = new Date().toISOString();

    // Clear previous formatting (we'll rebuild it)
    sidecar.blocks = {};
    sidecar.spans = {};
    // Keep existing images, add new ones

    const markdownLines: string[] = [];
    let wordCount = 0;

    for (const node of json.content || []) {
      const result = await this.serializeNode(node, sidecar);
      if (result.markdown) {
        markdownLines.push(result.markdown);
        wordCount += this.countWords(result.markdown);
      }
    }

    // Update metadata
    sidecar.meta.wordCount = wordCount;
    sidecar.meta.readingTime = Math.ceil(wordCount / 200); // ~200 words per minute

    // Extract title from first heading if available
    const firstHeading = json.content?.find(n => n.type === 'heading');
    if (firstHeading) {
      sidecar.meta.title = this.extractText(firstHeading);
    }

    return {
      markdown: markdownLines.join('\n\n'),
      sidecar,
    };
  }

  /**
   * Serialize a single node to markdown and update sidecar.
   */
  private async serializeNode(
    node: TiptapNode,
    sidecar: SidecarDocument
  ): Promise<{ markdown: string; blockId?: string }> {
    switch (node.type) {
      case 'paragraph':
        return this.serializeParagraph(node, sidecar);

      case 'heading':
        return this.serializeHeading(node, sidecar);

      case 'bulletList':
        return this.serializeList(node, sidecar, 'bullet');

      case 'orderedList':
        return this.serializeList(node, sidecar, 'ordered');

      case 'blockquote':
        return this.serializeBlockquote(node, sidecar);

      case 'codeBlock':
        return this.serializeCodeBlock(node, sidecar);

      case 'horizontalRule':
        return { markdown: '---' };

      case 'image':
        return this.serializeImage(node, sidecar);

      default:
        // Unknown node type - try to extract text
        return { markdown: this.extractText(node) };
    }
  }

  /**
   * Serialize a paragraph node.
   */
  private async serializeParagraph(
    node: TiptapNode,
    sidecar: SidecarDocument
  ): Promise<{ markdown: string; blockId: string }> {
    const blockId = this.generateBlockId('p');
    const { text, spans } = this.serializeInlineContent(node.content || []);

    // Store block formatting if present
    const blockFormatting = this.extractBlockFormatting(node);
    if (Object.keys(blockFormatting).length > 0) {
      sidecar.blocks[blockId] = blockFormatting;
    }

    // Store span formatting
    if (spans.length > 0) {
      sidecar.spans[blockId] = spans;
    }

    // Add block ID anchor as HTML comment
    const markdown = text ? `<!-- @mid:${blockId} -->\n${text}` : '';

    return { markdown, blockId };
  }

  /**
   * Serialize a heading node.
   */
  private async serializeHeading(
    node: TiptapNode,
    sidecar: SidecarDocument
  ): Promise<{ markdown: string; blockId: string }> {
    const blockId = this.generateBlockId('h');
    const level = node.attrs?.level || 1;
    const { text, spans } = this.serializeInlineContent(node.content || []);

    // Store block formatting
    const blockFormatting = this.extractBlockFormatting(node);
    if (Object.keys(blockFormatting).length > 0) {
      sidecar.blocks[blockId] = blockFormatting;
    }

    // Store span formatting
    if (spans.length > 0) {
      sidecar.spans[blockId] = spans;
    }

    const prefix = '#'.repeat(level);
    const markdown = `<!-- @mid:${blockId} -->\n${prefix} ${text}`;

    return { markdown, blockId };
  }

  /**
   * Serialize a list (bullet or ordered).
   */
  private async serializeList(
    node: TiptapNode,
    sidecar: SidecarDocument,
    type: 'bullet' | 'ordered'
  ): Promise<{ markdown: string; blockId: string }> {
    const blockId = this.generateBlockId('list');
    const lines: string[] = [];

    let index = 1;
    for (const item of node.content || []) {
      if (item.type === 'listItem') {
        const itemContent = await this.serializeListItem(item, sidecar, type, index);
        lines.push(itemContent);
        index++;
      }
    }

    const markdown = `<!-- @mid:${blockId} -->\n${lines.join('\n')}`;

    return { markdown, blockId };
  }

  /**
   * Serialize a list item.
   */
  private async serializeListItem(
    node: TiptapNode,
    sidecar: SidecarDocument,
    listType: 'bullet' | 'ordered',
    index: number
  ): Promise<string> {
    const prefix = listType === 'bullet' ? '-' : `${index}.`;
    const lines: string[] = [];

    for (const child of node.content || []) {
      if (child.type === 'paragraph') {
        const { text } = this.serializeInlineContent(child.content || []);
        lines.push(`${prefix} ${text}`);
      } else {
        // Nested content
        const result = await this.serializeNode(child, sidecar);
        if (result.markdown) {
          // Indent nested content
          const indented = result.markdown
            .split('\n')
            .map(line => '  ' + line)
            .join('\n');
          lines.push(indented);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Serialize a blockquote.
   */
  private async serializeBlockquote(
    node: TiptapNode,
    sidecar: SidecarDocument
  ): Promise<{ markdown: string; blockId: string }> {
    const blockId = this.generateBlockId('bq');
    const lines: string[] = [];

    for (const child of node.content || []) {
      const result = await this.serializeNode(child, sidecar);
      if (result.markdown) {
        // Remove the block ID comment from nested content and add > prefix
        const content = result.markdown.replace(/<!-- @mid:\w+-\w+ -->\n?/g, '');
        const quoted = content
          .split('\n')
          .map(line => `> ${line}`)
          .join('\n');
        lines.push(quoted);
      }
    }

    const markdown = `<!-- @mid:${blockId} -->\n${lines.join('\n')}`;

    return { markdown, blockId };
  }

  /**
   * Serialize a code block.
   */
  private async serializeCodeBlock(
    node: TiptapNode,
    _sidecar: SidecarDocument
  ): Promise<{ markdown: string; blockId: string }> {
    const blockId = this.generateBlockId('code');
    const language = node.attrs?.language || '';
    const text = this.extractText(node);

    const markdown = `<!-- @mid:${blockId} -->\n\`\`\`${language}\n${text}\n\`\`\``;

    return { markdown, blockId };
  }

  /**
   * Serialize an image node.
   */
  private async serializeImage(
    node: TiptapNode,
    sidecar: SidecarDocument
  ): Promise<{ markdown: string; blockId: string }> {
    const blockId = this.generateBlockId('img');
    const src = node.attrs?.src || '';
    const alt = node.attrs?.alt || '';
    const title = node.attrs?.title || '';

    let imageRef = src;
    let imageInfo: ImageInfo | null = null;

    // If it's a base64 image and we have an image manager, extract it
    if (src.startsWith('data:image/') && this.imageManager) {
      try {
        const result: ImageStoreResult = await this.imageManager.storeImage(src, alt || undefined);
        imageRef = result.ref;
        imageInfo = result.info;

        // Store in sidecar images
        sidecar.images[imageRef] = imageInfo;
      } catch (error) {
        console.error('Failed to extract image:', error);
        // Fall back to keeping the base64 in markdown (not ideal but works)
      }
    }

    // Store image attributes in block formatting
    const blockFormatting: BlockFormatting = {};
    if (node.attrs?.width) {
      (blockFormatting as any).width = node.attrs.width;
    }
    if (node.attrs?.height) {
      (blockFormatting as any).height = node.attrs.height;
    }
    if (node.attrs?.alignment) {
      blockFormatting.align = node.attrs.alignment;
    }
    if (node.attrs?.float) {
      (blockFormatting as any).float = node.attrs.float;
    }

    if (Object.keys(blockFormatting).length > 0) {
      sidecar.blocks[blockId] = blockFormatting;
    }

    // Generate markdown image syntax
    const titlePart = title ? ` "${title}"` : '';
    const markdown = `<!-- @mid:${blockId} -->\n![${alt}](${imageRef}${titlePart})`;

    return { markdown, blockId };
  }

  /**
   * Serialize inline content (text with marks).
   * Returns plain text for markdown and span formatting for sidecar.
   */
  private serializeInlineContent(
    nodes: TiptapNode[]
  ): { text: string; spans: SpanFormatting[] } {
    let text = '';
    const spans: SpanFormatting[] = [];
    let offset = 0;

    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        const nodeText = node.text;
        const start = offset;
        const end = offset + nodeText.length;

        // Process marks
        if (node.marks && node.marks.length > 0) {
          const spanMarks: SpanMark[] = [];

          for (const mark of node.marks) {
            const spanMark = this.convertMark(mark);
            if (spanMark) {
              spanMarks.push(spanMark);
            }
          }

          if (spanMarks.length > 0) {
            spans.push({ start, end, marks: spanMarks });
          }
        }

        // Apply markdown-native formatting
        let formattedText = nodeText;
        if (node.marks) {
          // Bold and italic can be in markdown directly
          const hasBold = node.marks.some(m => m.type === 'bold');
          const hasItalic = node.marks.some(m => m.type === 'italic');
          const hasCode = node.marks.some(m => m.type === 'code' || m.type === 'customCode');

          if (hasCode) {
            formattedText = `\`${formattedText}\``;
          }
          if (hasBold && hasItalic) {
            formattedText = `***${formattedText}***`;
          } else if (hasBold) {
            formattedText = `**${formattedText}**`;
          } else if (hasItalic) {
            formattedText = `*${formattedText}*`;
          }
        }

        text += formattedText;
        offset = end;
      } else if (node.type === 'hardBreak') {
        text += '\n';
        offset += 1;
      }
    }

    return { text, spans };
  }

  /**
   * Convert a Tiptap mark to a SpanMark.
   * Returns null for marks that are represented in markdown (bold, italic, code).
   */
  private convertMark(mark: TiptapMark): SpanMark | null {
    switch (mark.type) {
      case 'bold':
        // Represented in markdown, but store for round-trip accuracy
        return { type: 'bold' };

      case 'italic':
        return { type: 'italic' };

      case 'underline':
        return { type: 'underline' };

      case 'strike':
        return { type: 'strike' };

      case 'code':
      case 'customCode':
        return { type: 'code' };

      case 'highlight':
        if (mark.attrs?.color) {
          return { type: 'highlight', value: mark.attrs.color };
        }
        return null;

      case 'fontSize':
        if (mark.attrs?.fontSize) {
          return { type: 'fontSize', value: mark.attrs.fontSize };
        }
        return null;

      case 'textStyle':
        // textStyle can contain color and/or fontFamily
        // Color takes precedence if both are present
        if (mark.attrs?.color) {
          return { type: 'color', value: mark.attrs.color };
        }
        if (mark.attrs?.fontFamily) {
          return { type: 'fontFamily', value: mark.attrs.fontFamily };
        }
        return null;

      case 'link':
        return {
          type: 'link',
          href: mark.attrs?.href || '',
          title: mark.attrs?.title,
        };

      case 'superscript':
        return { type: 'superscript' };

      case 'subscript':
        return { type: 'subscript' };

      default:
        return null;
    }
  }

  /**
   * Extract block-level formatting from node attributes.
   */
  private extractBlockFormatting(node: TiptapNode): BlockFormatting {
    const formatting: BlockFormatting = {};

    if (node.attrs?.textAlign && node.attrs.textAlign !== 'left') {
      formatting.align = node.attrs.textAlign;
    }

    // Note: firstLineIndent, spacing, fontSize, fontFamily would come from
    // document-level or inherited styles. We'll handle those separately.

    return formatting;
  }

  /**
   * Extract plain text from a node (recursively).
   */
  private extractText(node: TiptapNode): string {
    if (node.text) {
      return node.text;
    }

    if (node.content) {
      return node.content.map(child => this.extractText(child)).join('');
    }

    return '';
  }

  /**
   * Count words in text.
   */
  private countWords(text: string): number {
    return text
      .replace(/<!-- @mid:\w+-\w+ -->/g, '') // Remove block IDs
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  /**
   * Generate a unique block ID.
   */
  private generateBlockId(prefix: string): string {
    this.blockCounter++;
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${random}`;
  }
}
