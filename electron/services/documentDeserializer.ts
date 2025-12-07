/**
 * DocumentDeserializer - Markdown + Sidecar to Tiptap JSON
 *
 * Converts stored documents back to Tiptap's JSON editor format:
 * 1. Parse Markdown to extract structure and block IDs
 * 2. Apply formatting from Sidecar JSON
 * 3. Resolve image references to base64 data URLs
 *
 * This is the inverse of DocumentSerializer.
 */

import { ImageManager } from './imageManager';
import {
  SidecarDocument,
  SpanMark,
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

// Block ID pattern: <!-- @mid:prefix-random -->
const BLOCK_ID_PATTERN = /<!-- @mid:(\w+-\w+) -->\n?/;
const BLOCK_ID_GLOBAL = /<!-- @mid:(\w+-\w+) -->\n?/g;

export class DocumentDeserializer {
  private imageManager: ImageManager | null;

  constructor(imageManager: ImageManager | null = null) {
    this.imageManager = imageManager;
  }

  /**
   * Deserialize Markdown + Sidecar to Tiptap JSON.
   */
  async deserialize(markdown: string, sidecar?: SidecarDocument): Promise<TiptapDocument> {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [],
    };

    const effectiveSidecar = sidecar || createEmptySidecar();

    // Split markdown into blocks by double newlines (paragraph separator)
    // But we need to be smarter about preserving code blocks, lists, etc.
    const blocks = this.splitIntoBlocks(markdown);

    for (const block of blocks) {
      const node = await this.parseBlock(block, effectiveSidecar);
      if (node) {
        doc.content.push(node);
      }
    }

    // Ensure we have at least one paragraph
    if (doc.content.length === 0) {
      doc.content.push({ type: 'paragraph', content: [] });
    }

    return doc;
  }

  /**
   * Split markdown into logical blocks.
   */
  private splitIntoBlocks(markdown: string): string[] {
    const blocks: string[] = [];
    const lines = markdown.split('\n');
    let currentBlock: string[] = [];
    let inCodeBlock = false;
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Track code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          currentBlock.push(line);
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
          inCodeBlock = false;
          continue;
        } else {
          if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
          }
          inCodeBlock = true;
          currentBlock.push(line);
          continue;
        }
      }

      if (inCodeBlock) {
        currentBlock.push(line);
        continue;
      }

      // Check if next non-comment line is a list item (to handle block ID before list)
      const isListItem = /^(\s*)(-|\d+\.)\s/.test(line);
      const isBlockIdComment = BLOCK_ID_PATTERN.test(trimmedLine);

      // If we're in a list, keep going until we hit an empty line or non-list content
      if (inList) {
        if (trimmedLine === '') {
          // End of list
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
          inList = false;
          continue;
        }
        // Check if it's a list item or indented content (continuation)
        if (isListItem || line.startsWith('  ') || isBlockIdComment) {
          currentBlock.push(line);
          continue;
        }
        // Non-list content - end the list
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inList = false;
        // Fall through to process this line
      }

      // Starting a new list
      if (isListItem) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        inList = true;
        currentBlock.push(line);
        continue;
      }

      // Block ID comment - check if it precedes a list
      if (isBlockIdComment) {
        // Look ahead to see if next non-empty line is a list item
        let nextContentLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() !== '' && !BLOCK_ID_PATTERN.test(lines[j].trim())) {
            nextContentLine = lines[j];
            break;
          }
        }

        const nextIsListItem = /^(\s*)(-|\d+\.)\s/.test(nextContentLine);

        if (nextIsListItem) {
          // This block ID belongs to a list - add to current block if starting fresh
          if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
          }
          currentBlock.push(line);
          continue;
        }

        // Regular block ID - start new block
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        currentBlock.push(line);
        continue;
      }

      // Empty line - potential block separator
      if (trimmedLine === '') {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        continue;
      }

      // Regular content
      currentBlock.push(line);
    }

    // Don't forget the last block
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    return blocks.filter(b => b.trim().length > 0);
  }

  /**
   * Parse a markdown block into a Tiptap node.
   */
  private async parseBlock(block: string, sidecar: SidecarDocument): Promise<TiptapNode | null> {
    // Extract block ID if present
    const idMatch = block.match(BLOCK_ID_PATTERN);
    const blockId = idMatch ? idMatch[1] : null;
    const content = block.replace(BLOCK_ID_GLOBAL, '').trim();

    if (!content) {
      return null;
    }

    // Check block type by content
    if (content.startsWith('```')) {
      return this.parseCodeBlock(content, blockId, sidecar);
    }

    if (content.startsWith('#')) {
      return this.parseHeading(content, blockId, sidecar);
    }

    if (content.startsWith('>')) {
      return await this.parseBlockquote(content, blockId, sidecar);
    }

    if (content === '---' || content === '***' || content === '___') {
      return { type: 'horizontalRule' };
    }

    if (/^(-|\d+\.)\s/.test(content)) {
      return this.parseList(content, blockId, sidecar);
    }

    if (content.startsWith('![')) {
      return await this.parseImage(content, blockId, sidecar);
    }

    // Default: paragraph
    return this.parseParagraph(content, blockId, sidecar);
  }

  /**
   * Parse a paragraph.
   */
  private parseParagraph(content: string, blockId: string | null, sidecar: SidecarDocument): TiptapNode {
    const node: TiptapNode = {
      type: 'paragraph',
      content: this.parseInlineContent(content, blockId, sidecar),
    };

    // Apply block formatting from sidecar
    if (blockId) {
      const blockFormatting = sidecar.blocks[blockId];
      if (blockFormatting?.align) {
        node.attrs = { ...node.attrs, textAlign: blockFormatting.align };
      }
    }

    return node;
  }

  /**
   * Parse a heading.
   */
  private parseHeading(content: string, blockId: string | null, sidecar: SidecarDocument): TiptapNode {
    const match = content.match(/^(#{1,6})\s+(.*)$/);
    if (!match) {
      return this.parseParagraph(content, blockId, sidecar);
    }

    const level = match[1].length;
    const text = match[2];

    const node: TiptapNode = {
      type: 'heading',
      attrs: { level },
      content: this.parseInlineContent(text, blockId, sidecar),
    };

    // Apply block formatting
    if (blockId) {
      const blockFormatting = sidecar.blocks[blockId];
      if (blockFormatting?.align) {
        node.attrs = { ...node.attrs, textAlign: blockFormatting.align };
      }
    }

    return node;
  }

  /**
   * Parse a code block.
   */
  private parseCodeBlock(content: string, blockId: string | null, sidecar: SidecarDocument): TiptapNode {
    const match = content.match(/^```(\w*)\n([\s\S]*?)\n?```$/);
    if (!match) {
      return this.parseParagraph(content, blockId, sidecar);
    }

    const language = match[1] || '';
    const code = match[2];

    return {
      type: 'codeBlock',
      attrs: { language },
      content: [{ type: 'text', text: code }],
    };
  }

  /**
   * Parse a blockquote.
   */
  private async parseBlockquote(
    content: string,
    _blockId: string | null,
    sidecar: SidecarDocument
  ): Promise<TiptapNode> {
    // Remove > prefix from each line
    const innerContent = content
      .split('\n')
      .map(line => line.replace(/^>\s?/, ''))
      .join('\n');

    const innerDoc = await this.deserialize(innerContent, sidecar);

    return {
      type: 'blockquote',
      content: innerDoc.content,
    };
  }

  /**
   * Parse a list.
   */
  private parseList(content: string, _blockId: string | null, sidecar: SidecarDocument): TiptapNode {
    const lines = content.split('\n');
    const isOrdered = /^\d+\./.test(lines[0].trim());
    const items: TiptapNode[] = [];

    let currentItem: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const isItemStart = isOrdered
        ? /^\d+\.\s/.test(trimmed)
        : /^-\s/.test(trimmed);

      if (isItemStart) {
        // Start new item
        if (currentItem.length > 0) {
          items.push(this.parseListItem(currentItem.join('\n'), sidecar));
        }
        // Remove bullet/number prefix
        const itemText = trimmed.replace(/^(-|\d+\.)\s/, '');
        currentItem = [itemText];
      } else if (line.startsWith('  ')) {
        // Continuation or nested content
        currentItem.push(line.slice(2));
      } else {
        currentItem.push(line);
      }
    }

    // Don't forget last item
    if (currentItem.length > 0) {
      items.push(this.parseListItem(currentItem.join('\n'), sidecar));
    }

    return {
      type: isOrdered ? 'orderedList' : 'bulletList',
      content: items,
    };
  }

  /**
   * Parse a list item.
   */
  private parseListItem(content: string, sidecar: SidecarDocument): TiptapNode {
    // For simplicity, treat list item content as a paragraph
    return {
      type: 'listItem',
      content: [
        {
          type: 'paragraph',
          content: this.parseInlineContent(content.trim(), null, sidecar),
        },
      ],
    };
  }

  /**
   * Parse an image.
   */
  private async parseImage(
    content: string,
    blockId: string | null,
    sidecar: SidecarDocument
  ): Promise<TiptapNode> {
    const match = content.match(/^!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)$/);
    if (!match) {
      return this.parseParagraph(content, blockId, sidecar);
    }

    const alt = match[1] || '';
    let src = match[2];
    const title = match[3] || '';

    // Resolve image reference to data URL
    if (src.startsWith('@img:') && this.imageManager) {
      const dataUrl = await this.imageManager.getImageDataUrl(src);
      if (dataUrl) {
        src = dataUrl;
      }
    }

    const node: TiptapNode = {
      type: 'image',
      attrs: {
        src,
        alt,
        title: title || undefined,
      },
    };

    // Apply image attributes from sidecar
    if (blockId) {
      const blockFormatting = sidecar.blocks[blockId] as any;
      if (blockFormatting) {
        if (blockFormatting.width) {
          node.attrs!.width = blockFormatting.width;
        }
        if (blockFormatting.height) {
          node.attrs!.height = blockFormatting.height;
        }
        if (blockFormatting.align) {
          node.attrs!.alignment = blockFormatting.align;
        }
        if (blockFormatting.float) {
          node.attrs!.float = blockFormatting.float;
        }
      }
    }

    return node;
  }

  /**
   * Parse inline content (text with formatting).
   */
  private parseInlineContent(
    text: string,
    blockId: string | null,
    sidecar: SidecarDocument
  ): TiptapNode[] {
    const nodes: TiptapNode[] = [];

    // First, parse markdown-native formatting (bold, italic, code)
    const segments = this.parseMarkdownInline(text);

    // Now apply sidecar span formatting
    const spanFormattings = blockId ? sidecar.spans[blockId] || [] : [];

    // Build text nodes with combined marks
    for (const segment of segments) {
      if (segment.text.length === 0) continue;

      const node: TiptapNode = {
        type: 'text',
        text: segment.text,
      };

      // Combine markdown marks with sidecar marks
      const marks: TiptapMark[] = [...segment.marks];

      // Find applicable sidecar spans (this is approximate without offset tracking)
      // For accurate round-tripping, we'd need to track character offsets
      for (const span of spanFormattings) {
        for (const spanMark of span.marks) {
          const tiptapMark = this.convertSpanMark(spanMark);
          if (tiptapMark && !marks.some(m => m.type === tiptapMark.type)) {
            marks.push(tiptapMark);
          }
        }
      }

      if (marks.length > 0) {
        node.marks = marks;
      }

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Extract content from balanced span tags, handling nested spans.
   * Returns the inner content (not including the closing </span>), or null if no valid match.
   */
  private extractBalancedSpanContent(text: string): string | null {
    let depth = 1;
    let i = 0;

    while (i < text.length && depth > 0) {
      // Check for opening span tag
      if (text.slice(i).match(/^<span[\s>]/)) {
        const endOfTag = text.indexOf('>', i);
        if (endOfTag === -1) break;
        depth++;
        i = endOfTag + 1;
        continue;
      }

      // Check for closing span tag
      if (text.slice(i, i + 7) === '</span>') {
        depth--;
        if (depth === 0) {
          return text.slice(0, i);
        }
        i += 7;
        continue;
      }

      i++;
    }

    return null;
  }

  /**
   * Parse markdown inline formatting (bold, italic, code, and HTML spans for colors).
   */
  private parseMarkdownInline(text: string): Array<{ text: string; marks: TiptapMark[] }> {
    const segments: Array<{ text: string; marks: TiptapMark[] }> = [];

    // Simple regex-based parsing (handles basic cases)
    // For production, a proper parser would be better

    let remaining = text;

    while (remaining.length > 0) {
      // Try to match formatting patterns

      // HTML span with style (color, background, etc.) - handles legacy format
      const spanStartMatch = remaining.match(/^<span\s+style="([^"]*)">/);
      if (spanStartMatch) {
        const style = spanStartMatch[1];
        // Find the matching closing tag (handles nested spans)
        const afterOpenTag = remaining.slice(spanStartMatch[0].length);
        const innerText = this.extractBalancedSpanContent(afterOpenTag);
        if (innerText !== null) {
          const fullMatchLength = spanStartMatch[0].length + innerText.length + '</span>'.length;
          const marks: TiptapMark[] = [];

          // Parse color from style - uses textStyle mark with color attribute
          const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
          if (colorMatch) {
            marks.push({ type: 'textStyle', attrs: { color: colorMatch[1].trim() } });
          }

          // Parse background-color from style - uses highlight mark
          const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
          if (bgMatch) {
            marks.push({ type: 'highlight', attrs: { color: bgMatch[1].trim() } });
          }

          // Parse font-family from style
          const fontMatch = style.match(/font-family:\s*([^;]+)/i);
          if (fontMatch) {
            marks.push({ type: 'textStyle', attrs: { fontFamily: fontMatch[1].trim() } });
          }

          // Parse font-size from style
          const sizeMatch = style.match(/font-size:\s*([^;]+)/i);
          if (sizeMatch) {
            marks.push({ type: 'fontSize', attrs: { fontSize: sizeMatch[1].trim() } });
          }

          // Recursively parse inner content for nested formatting
          const innerSegments = this.parseMarkdownInline(innerText);
          for (const seg of innerSegments) {
            segments.push({
              text: seg.text,
              marks: [...marks, ...seg.marks],
            });
          }
          remaining = remaining.slice(fullMatchLength);
          continue;
        }
      }

      // Bold+Italic: ***text***
      const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/);
      if (boldItalicMatch) {
        segments.push({
          text: boldItalicMatch[1],
          marks: [{ type: 'bold' }, { type: 'italic' }],
        });
        remaining = remaining.slice(boldItalicMatch[0].length);
        continue;
      }

      // Bold: **text**
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        segments.push({
          text: boldMatch[1],
          marks: [{ type: 'bold' }],
        });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic: *text*
      const italicMatch = remaining.match(/^\*(.+?)\*/);
      if (italicMatch) {
        segments.push({
          text: italicMatch[1],
          marks: [{ type: 'italic' }],
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Code: `text`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        segments.push({
          text: codeMatch[1],
          marks: [{ type: 'code' }],
        });
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Link: [text](url)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        segments.push({
          text: linkMatch[1],
          marks: [{ type: 'link', attrs: { href: linkMatch[2] } }],
        });
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // Plain text (up to next special character, HTML tag, or end)
      const plainMatch = remaining.match(/^[^*`[\]<]+/);
      if (plainMatch) {
        segments.push({
          text: plainMatch[0],
          marks: [],
        });
        remaining = remaining.slice(plainMatch[0].length);
        continue;
      }

      // Unmatched < (not a recognized tag) - treat as literal
      if (remaining.startsWith('<')) {
        // Check if it's an unrecognized HTML tag and skip it
        const unknownTagMatch = remaining.match(/^<[^>]+>/);
        if (unknownTagMatch) {
          // Skip unknown HTML tags
          remaining = remaining.slice(unknownTagMatch[0].length);
          continue;
        }
      }

      // Single special character (not part of formatting)
      segments.push({
        text: remaining[0],
        marks: [],
      });
      remaining = remaining.slice(1);
    }

    return segments;
  }

  /**
   * Convert a SpanMark to a Tiptap mark.
   */
  private convertSpanMark(spanMark: SpanMark): TiptapMark | null {
    switch (spanMark.type) {
      case 'bold':
        return { type: 'bold' };

      case 'italic':
        return { type: 'italic' };

      case 'underline':
        return { type: 'underline' };

      case 'strike':
        return { type: 'strike' };

      case 'code':
        return { type: 'code' };

      case 'color':
        return { type: 'textStyle', attrs: { color: spanMark.value } };

      case 'highlight':
        return { type: 'highlight', attrs: { color: spanMark.value } };

      case 'fontSize':
        return { type: 'fontSize', attrs: { fontSize: spanMark.value } };

      case 'fontFamily':
        return { type: 'textStyle', attrs: { fontFamily: spanMark.value } };

      case 'link':
        return { type: 'link', attrs: { href: spanMark.href, title: spanMark.title } };

      case 'superscript':
        return { type: 'superscript' };

      case 'subscript':
        return { type: 'subscript' };

      default:
        return null;
    }
  }
}
