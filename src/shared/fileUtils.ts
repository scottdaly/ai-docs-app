import { FileCategory } from './types';

// Extensions that can be imported/converted to Midlight format
const IMPORTABLE_EXTENSIONS = new Set(['.docx', '.rtf', '.odt', '.pdf']);

// Extensions that can be previewed (images only)
const VIEWABLE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'
]);

// Hidden folders that should not appear in the file browser
const HIDDEN_FOLDERS = new Set([
  '.midlight',
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.vscode',
  '.idea',
]);

// Hidden files that should not appear in the file browser
const HIDDEN_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.gitignore',
  '.gitattributes',
]);

/**
 * Get the file extension (lowercase, including the dot)
 */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if a file is a .md.midlight metadata file
 */
export function isMidlightMetadataFile(filename: string): boolean {
  return filename.endsWith('.md.midlight');
}

/**
 * Determine the category of a file based on its extension and siblings
 * @param filename The file name
 * @param siblingNames Array of sibling file names in the same directory
 * @returns The file category
 */
export function categorizeFile(
  filename: string,
  siblingNames: string[]
): FileCategory {
  const ext = getExtension(filename);

  // Check for native Midlight files (.md with .md.midlight sibling)
  if (ext === '.md') {
    const midlightFile = filename + '.midlight';
    if (siblingNames.includes(midlightFile)) {
      return 'native';
    }
    return 'compatible';
  }

  // Check for importable formats
  if (IMPORTABLE_EXTENSIONS.has(ext)) {
    return 'importable';
  }

  // Check for viewable formats (images, PDFs)
  if (VIEWABLE_EXTENSIONS.has(ext)) {
    return 'viewable';
  }

  return 'unsupported';
}

/**
 * Get the display name for a file (hides extension for native files)
 * @param filename The file name
 * @param category The file category
 * @returns The display name
 */
export function getDisplayName(filename: string, category?: FileCategory): string {
  // Only hide extension for native Midlight files
  if (category === 'native') {
    return filename.replace(/\.md$/i, '');
  }
  return filename;
}

/**
 * Check if a folder should be hidden from the file browser
 */
export function shouldHideFolder(folderName: string): boolean {
  return HIDDEN_FOLDERS.has(folderName) || folderName.startsWith('.');
}

/**
 * Check if a file should be hidden from the file browser
 */
export function shouldHideFile(filename: string): boolean {
  // Hide .md.midlight metadata files
  if (isMidlightMetadataFile(filename)) {
    return true;
  }

  // Hide known system files
  if (HIDDEN_FILES.has(filename)) {
    return true;
  }

  return false;
}

/**
 * Check if a file is editable in Midlight
 */
export function isEditable(category: FileCategory): boolean {
  return category === 'native' || category === 'compatible';
}

/**
 * Check if a file can be imported to Midlight format
 */
export function isImportable(category: FileCategory): boolean {
  return category === 'importable';
}

/**
 * Check if a file can be previewed
 */
export function isViewable(category: FileCategory): boolean {
  return category === 'viewable';
}
