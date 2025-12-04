/**
 * Conversion utilities for transforming Tiptap values to DOCX format
 */

import { AlignmentType } from 'docx';

/**
 * Converts CSS pixel values to Word half-points
 * Formula: px × 2 = half-points (treating px as if they were pt for number parity)
 * This creates visual and numerical consistency: 12px in editor → 12pt in Word
 *
 * @param px - CSS size like "16px" or "14px"
 * @returns Half-points (e.g., "16px" -> 32, which is 16pt in Word)
 *
 * @example
 * pxToHalfPoints("12px") // returns 24 (12pt)
 * pxToHalfPoints("16px") // returns 32 (16pt)
 * pxToHalfPoints("24px") // returns 48 (24pt)
 */
export function pxToHalfPoints(px: string): number {
  // Extract numeric value from string like "16px"
  const numericValue = parseFloat(px);

  if (isNaN(numericValue) || numericValue <= 0) {
    console.warn(`Invalid fontSize format: "${px}". Using default.`);
    return 24; // Default to 12pt
  }

  // Word has a maximum font size of 1638 pt (3276 half-points)
  // Clamp to reasonable range: 1pt (2 half-points) to 200pt (400 half-points)
  const halfPoints = Math.round(numericValue * 2);

  if (halfPoints < 2) return 2;   // Minimum 1pt
  if (halfPoints > 400) return 400; // Maximum 200pt

  return halfPoints;
}

/**
 * Maps Tiptap alignment values to DOCX AlignmentType enum
 *
 * @param align - Tiptap alignment: 'left' | 'center' | 'right' | 'justify'
 * @returns DOCX AlignmentType
 *
 * @example
 * tiptapAlignToDocx('center') // returns AlignmentType.CENTER
 * tiptapAlignToDocx(undefined) // returns AlignmentType.LEFT (default)
 */
export function tiptapAlignToDocx(align?: string): AlignmentType {
  switch (align) {
    case 'left':
      return AlignmentType.LEFT;
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT; // Word default
  }
}

/**
 * Maps web fonts to Word-compatible system fonts
 * This ensures fonts render correctly even if the exact font isn't installed
 */
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

/**
 * Extracts the first font name from a CSS font-family string and maps to Word-compatible font
 * Removes quotes and returns a system font that matches the style (sans-serif → Arial, serif → Georgia, etc.)
 *
 * @param fontFamily - CSS font-family like "Inter, Arial, sans-serif"
 * @returns Word-compatible font name like "Arial" (for Inter)
 *
 * @example
 * extractFontName("Inter, sans-serif") // returns "Arial" (sans-serif fallback)
 * extractFontName("Merriweather, serif") // returns "Georgia" (serif fallback)
 * extractFontName('"JetBrains Mono", monospace') // returns "Courier New" (monospace fallback)
 * extractFontName("sans-serif") // returns undefined (generic family)
 */
export function extractFontName(fontFamily: string): string | undefined {
  if (!fontFamily) {
    return undefined;
  }

  // Split by comma and take first font
  const firstFont = fontFamily.split(',')[0].trim();

  // Remove quotes
  const cleanFont = firstFont.replace(/['"]/g, '');

  // Don't return generic font families (let Word use its default)
  const genericFamilies = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
  if (genericFamilies.includes(cleanFont.toLowerCase())) {
    return undefined;
  }

  // Map to Word-compatible fallback font
  return FONT_FALLBACK_MAP[cleanFont] || cleanFont;
}
