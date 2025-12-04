export type FileType = 'file' | 'directory';

export interface FileNode {
  name: string;
  path: string;
  type: FileType;
  children?: FileNode[]; // Only for directories
}

export interface IElectronAPI {
  readDir: (path: string) => Promise<FileNode[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  importDocx: () => Promise<string | null>;
  exportPdf: () => Promise<boolean>;
  exportDocx: (content: any) => Promise<boolean>;
  
  onMenuAction: (callback: (action: string) => void) => () => void;
  onUpdateTheme: (callback: (theme: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
