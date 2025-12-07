export type FileType = 'file' | 'directory';

// File categories for visual differentiation and behavior
export type FileCategory =
  | 'native'      // .md file with .md.midlight sibling - full Midlight support
  | 'compatible'  // .md file without .md.midlight - can edit, no rich formatting
  | 'importable'  // .docx, .rtf, .html - can import/convert
  | 'viewable'    // images, PDFs - can preview
  | 'unsupported'; // everything else

export interface FileNode {
  name: string;
  path: string;
  type: FileType;
  children?: FileNode[]; // Only for directories

  // File categorization (only for files, not directories)
  category?: FileCategory;
  displayName?: string; // Name without extension for native files
}

// Note: IElectronAPI is declared in vite-env.d.ts
// This file only contains shared types for the application
