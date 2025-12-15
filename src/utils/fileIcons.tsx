import type { RemixiconComponentType } from '@remixicon/react';
import {
  RiFileLine,
  RiFileTextLine,
  RiImageLine,
} from '@remixicon/react';
import { FileCategory } from '../shared/types';

// Get the appropriate icon component for a file category
export function getFileIcon(category: FileCategory | undefined): RemixiconComponentType {
  switch (category) {
    case 'native':
      // Native Midlight files get a special icon with sparkle indicator
      return RiFileTextLine;
    case 'compatible':
      // Compatible markdown files
      return RiFileTextLine;
    case 'importable':
      // Files that can be imported (docx, etc.)
      return RiFileTextLine;
    case 'viewable':
      // Images and PDFs
      return RiImageLine;
    case 'unsupported':
    default:
      return RiFileLine;
  }
}

// Get icon color/styling class based on category
export function getFileIconClass(category: FileCategory | undefined, isActive: boolean): string {
  if (isActive) {
    return 'text-accent-foreground/80';
  }

  switch (category) {
    case 'native':
      // Native files get accent color to stand out
      return 'text-primary';
    case 'compatible':
      return 'text-foreground/70';
    case 'importable':
      return 'text-amber-500/70';
    case 'viewable':
      return 'text-foreground/70';
    case 'unsupported':
    default:
      return 'text-foreground/40';
  }
}

// Get opacity class for file items based on category
export function getFileOpacityClass(category: FileCategory | undefined): string {
  if (category === 'unsupported') {
    return 'opacity-50';
  }
  return '';
}

// Check if file type is actionable (can be opened/imported)
export function isFileActionable(category: FileCategory | undefined): boolean {
  return category === 'native' || category === 'compatible' || category === 'importable';
}

// Get tooltip text for file category
export function getFileCategoryTooltip(category: FileCategory | undefined): string | null {
  switch (category) {
    case 'native':
      return null; // No tooltip needed for native files
    case 'compatible':
      return 'Markdown file (no Midlight formatting)';
    case 'importable':
      return 'Click to import';
    case 'viewable':
      return 'Preview only';
    case 'unsupported':
      return 'File type not supported';
    default:
      return null;
  }
}
