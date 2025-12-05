/// <reference types="vite/client" />

interface DocxExportProgress {
  current?: number;
  total?: number;
  phase?: string;
  complete?: boolean;
  error?: string;
}

interface IElectronAPI {
  selectDirectory: () => Promise<string | null>;
  readDir: (path: string) => Promise<{ name: string; path: string; type: 'file' | 'directory' }[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  importDocx: () => Promise<{ html: string; filename: string } | null>;
  exportPdf: () => Promise<boolean | undefined>;
  exportDocx: (content: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onUpdateTheme: (callback: (theme: string) => void) => () => void;
  onDocxExportProgress: (callback: (progress: DocxExportProgress) => void) => () => void;
}

interface Window {
  electronAPI: IElectronAPI;
}
