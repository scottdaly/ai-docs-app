export type FileType = 'file' | 'directory';

export interface FileNode {
  name: string;
  path: string;
  type: FileType;
  children?: FileNode[]; // Only for directories
}

// Note: IElectronAPI is declared in vite-env.d.ts
// This file only contains shared types for the application
