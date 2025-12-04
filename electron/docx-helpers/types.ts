/**
 * TypeScript interfaces for Tiptap JSON structure
 * Used for type-safe DOCX transformation
 */

/**
 * Represents a Tiptap node (paragraph, heading, text, etc.)
 */
export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
  attrs?: Record<string, any>;
}

/**
 * Represents a Tiptap mark (bold, italic, textStyle, etc.)
 */
export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

/**
 * Attributes from the textStyle mark
 */
export interface TextStyleAttrs {
  fontSize?: string;      // e.g., "16px"
  fontFamily?: string;    // e.g., "Inter, sans-serif"
  color?: string;         // e.g., "#ff0000" (hex color)
}

/**
 * Attributes for paragraph-level formatting
 */
export interface ParagraphAttrs {
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}
