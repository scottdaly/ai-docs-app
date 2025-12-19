import { diffWords } from 'diff';

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string }>;
  attrs?: Record<string, any>;
}

interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
}

/**
 * Strip internal Midlight markers from markdown content
 * These are HTML comments like <!-- @mid:p-xxxxx --> used for paragraph tracking
 */
function stripMidlightMarkers(text: string): string {
  // Remove <!-- @mid:xxx --> markers (paragraph, heading, list IDs, etc.)
  return text.replace(/<!--\s*@mid:[^>]+-->\s*/g, '');
}

/**
 * Create TipTap JSON content that shows an inline diff
 * Deleted text is shown with strikethrough and red background
 * Added text is shown with green background
 */
export function createInlineDiffJson(
  originalText: string,
  modifiedText: string
): TiptapDocument {
  // Strip internal markers before computing diff
  const cleanOriginal = stripMidlightMarkers(originalText);
  const cleanModified = stripMidlightMarkers(modifiedText);

  // Compute word-level diff
  const diffParts = diffWords(cleanOriginal, cleanModified);

  // Convert diff parts to TipTap text nodes with marks
  const textNodes: TiptapNode[] = [];

  for (const part of diffParts) {
    if (!part.value) continue;

    // Split by newlines to handle paragraphs
    const lines = part.value.split(/\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line) {
        const node: TiptapNode = {
          type: 'text',
          text: line,
        };

        if (part.added) {
          node.marks = [{ type: 'diffAdded' }];
        } else if (part.removed) {
          node.marks = [{ type: 'diffRemoved' }];
        }

        textNodes.push(node);
      }

      // Add a hard break for newlines within the same diff part
      // (except for the last element which represents the end of the part)
      if (i < lines.length - 1) {
        textNodes.push({ type: 'hardBreak' });
      }
    }
  }

  // Group text nodes into paragraphs
  // For simplicity, we'll put all content in paragraphs separated by double newlines
  const paragraphs: TiptapNode[] = [];
  let currentParagraphContent: TiptapNode[] = [];

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];

    // Check for double hard breaks (paragraph separator)
    if (
      node.type === 'hardBreak' &&
      i + 1 < textNodes.length &&
      textNodes[i + 1].type === 'hardBreak'
    ) {
      // End current paragraph and start a new one
      if (currentParagraphContent.length > 0) {
        paragraphs.push({
          type: 'paragraph',
          content: currentParagraphContent,
        });
        currentParagraphContent = [];
      }
      i++; // Skip the next hardBreak
      continue;
    }

    currentParagraphContent.push(node);
  }

  // Add remaining content as a paragraph
  if (currentParagraphContent.length > 0) {
    paragraphs.push({
      type: 'paragraph',
      content: currentParagraphContent,
    });
  }

  // Ensure at least one paragraph
  if (paragraphs.length === 0) {
    paragraphs.push({
      type: 'paragraph',
      content: [],
    });
  }

  return {
    type: 'doc',
    content: paragraphs,
  };
}

/**
 * Extract plain text from TipTap JSON
 */
export function extractTextFromTiptapJson(doc: TiptapDocument): string {
  if (!doc || !doc.content) return '';

  const extractFromNode = (node: TiptapNode): string => {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.type === 'hardBreak') {
      return '\n';
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractFromNode).join('');
    }
    return '';
  };

  return doc.content
    .map((node) => extractFromNode(node))
    .join('\n\n');
}
