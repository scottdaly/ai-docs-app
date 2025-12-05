/**
 * List processing utilities for DOCX export
 * Handles recursive nested list structures from Tiptap JSON
 */

import { Paragraph } from 'docx';
import { TiptapNode } from './types';
import { tiptapAlignToDocx } from './converters';
import { processTextNodes } from './text-processors';

interface ListContext {
  type: 'bullet' | 'ordered';
  level: number;
  numberingReference?: string;
}

/**
 * Recursively processes a list item, handling nested lists
 *
 * A listItem can contain:
 * - paragraph (the item text)
 * - bulletList (nested bullets)
 * - orderedList (nested numbers)
 *
 * @param listItem - Tiptap listItem node
 * @param context - Current list context (type, level, numbering ref)
 * @returns Array of DOCX Paragraphs
 */
export function processListItem(
  listItem: TiptapNode,
  context: ListContext
): Paragraph[] {
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

/**
 * Processes a bullet list at the specified nesting level
 *
 * @param node - Tiptap bulletList node
 * @param level - Nesting level (0 = top level, 1 = first indent, etc.)
 * @returns Array of DOCX Paragraphs with bullet formatting
 *
 * @example
 * // Top-level bullet list
 * processBulletList(bulletListNode) // level 0
 *
 * // Nested bullet list (called recursively from processListItem)
 * processBulletList(nestedBulletNode, 1) // level 1
 */
export function processBulletList(node: TiptapNode, level: number = 0): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const listItem of node.content || []) {
    if (listItem.type === 'listItem') {
      paragraphs.push(...processListItem(listItem, { type: 'bullet', level }));
    }
  }

  return paragraphs;
}

/**
 * Processes an ordered list at the specified nesting level
 *
 * @param node - Tiptap orderedList node
 * @param level - Nesting level (0 = top level, 1 = first indent, etc.)
 * @param numberingReference - Reference to numbering config (default: 'default-numbering')
 * @returns Array of DOCX Paragraphs with numbering formatting
 *
 * @example
 * // Top-level ordered list
 * processOrderedList(orderedListNode) // level 0, uses "1. 2. 3."
 *
 * // Nested ordered list
 * processOrderedList(nestedOrderedNode, 1) // level 1, uses "a. b. c."
 */
export function processOrderedList(
  node: TiptapNode,
  level: number = 0,
  numberingReference: string = 'default-numbering'
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const listItem of node.content || []) {
    if (listItem.type === 'listItem') {
      paragraphs.push(...processListItem(listItem, {
        type: 'ordered',
        level,
        numberingReference
      }));
    }
  }

  return paragraphs;
}
