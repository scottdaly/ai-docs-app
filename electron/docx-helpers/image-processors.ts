/**
 * Image processing utilities for embedding images in DOCX from Tiptap nodes
 * Handles base64 data URLs, image dimensions, and alignment
 */

import { ImageRun, Paragraph } from 'docx';
import { TiptapNode } from './types';
import { tiptapAlignToDocx } from './converters';

/**
 * Converts a data URL to a Buffer
 * Extracts the base64 data from "data:image/png;base64,..." format
 *
 * @param dataUrl - Data URL string from image src attribute
 * @returns Buffer containing the image data
 *
 * @example
 * base64ToBuffer("data:image/png;base64,iVBORw0KGg...") // Returns Buffer
 */
export function base64ToBuffer(dataUrl: string): Buffer {
  // Extract base64 data after the comma
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL format');
  }

  const base64Data = matches[2];
  return Buffer.from(base64Data, 'base64');
}

/**
 * Extracts the image MIME type from a data URL
 *
 * @param dataUrl - Data URL string
 * @returns MIME type (e.g., 'image/png', 'image/jpeg')
 *
 * @example
 * extractImageType("data:image/png;base64,...") // Returns "image/png"
 */
export function extractImageType(dataUrl: string): string {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,/);

  if (!matches || matches.length !== 2) {
    return 'image/png'; // Default fallback
  }

  return matches[1];
}

/**
 * Parses a dimension string to pixels
 * Converts "400px" to 400, "100%" uses fallback
 *
 * @param dim - Dimension string like "400px" or "100%"
 * @param fallback - Fallback value if parsing fails or percentage is used
 * @returns Number of pixels
 *
 * @example
 * parseDimension("400px", 600) // Returns 400
 * parseDimension("100%", 600) // Returns 600 (fallback)
 * parseDimension("auto", 600) // Returns 600 (fallback)
 */
export function parseDimension(dim: string, fallback: number): number {
  // Handle percentage or auto - use fallback
  if (!dim || dim.includes('%') || dim === 'auto') {
    return fallback;
  }

  // Extract numeric value from "400px"
  const numericValue = parseFloat(dim);

  if (isNaN(numericValue) || numericValue <= 0) {
    return fallback;
  }

  // Clamp to reasonable range (1px - 2000px)
  if (numericValue < 1) return 1;
  if (numericValue > 2000) return 2000;

  return numericValue;
}

/**
 * Creates an ImageRun or Paragraph with image from a Tiptap image node
 * Handles base64 conversion, sizing, and alignment
 *
 * @param node - Tiptap image node with src, width, height, align attributes
 * @returns Paragraph containing the image with appropriate formatting
 *
 * @example
 * const node = {
 *   type: 'image',
 *   attrs: {
 *     src: 'data:image/png;base64,...',
 *     width: '400px',
 *     height: 'auto',
 *     align: 'center-break'
 *   }
 * };
 * createImageParagraph(node) // Returns Paragraph with centered image
 */
export function createImageParagraph(node: TiptapNode): Paragraph {
  try {
    const src = node.attrs?.src;
    const width = node.attrs?.width || '400px';
    const height = node.attrs?.height || 'auto';
    const align = node.attrs?.align || 'center-break';

    // Validate src exists and is base64
    if (!src || !src.startsWith('data:image/')) {
      console.warn('Image node missing valid base64 src attribute');
      return new Paragraph({ text: '[Image]' });
    }

    // Convert base64 data URL to Buffer
    const imageBuffer = base64ToBuffer(src);

    // Extract image type for proper embedding
    const imageType = extractImageType(src);

    // Parse dimensions (default to reasonable size if auto/percentage)
    const widthPx = parseDimension(width, 400);
    const heightPx = height === 'auto' ? undefined : parseDimension(height, 300);

    // Extract alignment type for paragraph
    // Tiptap has: left-wrap, right-wrap, center-break, left-break, right-break
    // For DOCX, we use paragraph alignment (wrap modes are complex)
    let paragraphAlign = tiptapAlignToDocx('center'); // Default to center

    if (align.startsWith('left')) {
      paragraphAlign = tiptapAlignToDocx('left');
    } else if (align.startsWith('right')) {
      paragraphAlign = tiptapAlignToDocx('right');
    } else if (align.startsWith('center')) {
      paragraphAlign = tiptapAlignToDocx('center');
    }

    // Validate dimensions
    if (widthPx <= 0 || widthPx > 2000) {
      console.warn(`Invalid image width: ${widthPx}. Using default 400px.`);
      return new Paragraph({ text: '[Image - Invalid dimensions]' });
    }

    // Determine file extension from MIME type
    let fileExtension: "png" | "jpg" | "gif" | "bmp" = 'png'; // Default
    if (imageType === 'image/jpeg' || imageType === 'image/jpg') {
      fileExtension = 'jpg';
    } else if (imageType === 'image/png') {
      fileExtension = 'png';
    } else if (imageType === 'image/gif') {
      fileExtension = 'gif';
    } else if (imageType === 'image/bmp') {
      fileExtension = 'bmp';
    }

    // Create ImageRun with proper dimensions and type
    // Note: DOCX uses EMUs (English Metric Units) but the library handles conversion
    const imageRun = new ImageRun({
      data: imageBuffer,
      type: fileExtension,
      transformation: {
        width: widthPx,
        height: heightPx || widthPx, // Maintain aspect ratio if height not specified
      },
    });

    // Return Paragraph with image and alignment
    return new Paragraph({
      children: [imageRun],
      alignment: paragraphAlign,
    });

  } catch (error) {
    console.error('Error processing image:', error);
    // Return placeholder text if image processing fails
    return new Paragraph({ text: '[Image - Error loading]' });
  }
}
