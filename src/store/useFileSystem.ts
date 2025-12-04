import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileNode } from '../shared/types';

interface FileSystemState {
  rootDir: string | null;
  files: FileNode[];
  openFiles: FileNode[];
  activeFilePath: string | null;
  fileContent: string;
  isDirty: boolean;
  
  setRootDir: (path: string) => void;
  setFiles: (files: FileNode[]) => void;
  setFileContent: (content: string) => void;
  setIsDirty: (dirty: boolean) => void;
  
  loadDir: (path: string) => Promise<void>;
  loadSubDirectory: (path: string) => Promise<void>;
  
  openFile: (file: FileNode) => Promise<void>;
  closeFile: (path: string) => void;
  selectFile: (path: string) => Promise<void>;
  saveFile: (content: string) => Promise<void>;
  
  restoreSession: () => Promise<void>;
}

// Helper to recursively find and update a node
const updateNodeChildren = (nodes: FileNode[], targetPath: string, children: FileNode[]): FileNode[] => {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: updateNodeChildren(node.children, targetPath, children) };
    }
    return node;
  });
};

export const useFileSystem = create<FileSystemState>()(
  persist(
    (set, get) => ({
      rootDir: null,
      files: [],
      openFiles: [],
      activeFilePath: null,
      fileContent: '',
      isDirty: false,

      setRootDir: (path) => set({ rootDir: path }),
      setFiles: (files) => set({ files }),
      setFileContent: (content) => set({ fileContent: content }),
      setIsDirty: (dirty) => set({ isDirty: dirty }),

      loadDir: async (path) => {
        // If changing workspace, clear tabs
        if (get().rootDir !== path) {
             set({ openFiles: [], activeFilePath: null, fileContent: '' });
        }
        
        const files = await window.electronAPI.readDir(path);
        // Sort: Directories first, then files
        const sortedFiles = files.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });
        set({ rootDir: path, files: sortedFiles });
      },

      loadSubDirectory: async (path) => {
        const children = await window.electronAPI.readDir(path);
        const sortedChildren = children.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });
        
        set((state) => ({
          files: updateNodeChildren(state.files, path, sortedChildren)
        }));
      },

      openFile: async (file) => {
          const { openFiles, activeFilePath } = get();
          const alreadyOpen = openFiles.find(f => f.path === file.path);
          
          // If already active, do nothing
          if (activeFilePath === file.path) return;

          try {
              const content = await window.electronAPI.readFile(file.path);
              
              if (alreadyOpen) {
                  set({ activeFilePath: file.path, fileContent: content, isDirty: false });
              } else {
                  set({ 
                      openFiles: [...openFiles, file], 
                      activeFilePath: file.path, 
                      fileContent: content, 
                      isDirty: false 
                  });
              }
          } catch (error) {
              console.error("Failed to load file", error);
          }
      },

      selectFile: async (path) => {
          const { activeFilePath } = get();
          if (activeFilePath === path) return;

          try {
              const content = await window.electronAPI.readFile(path);
              set({ activeFilePath: path, fileContent: content, isDirty: false });
          } catch (error) {
              console.error("Failed to select file", error);
          }
      },

      closeFile: (path) => {
          const { openFiles, activeFilePath } = get();
          const newOpenFiles = openFiles.filter(f => f.path !== path);
          
          if (path === activeFilePath) {
              // Determine new active file (last one, or null)
              const newActive = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
              
              if (newActive) {
                  set({ openFiles: newOpenFiles, activeFilePath: newActive.path });
                  window.electronAPI.readFile(newActive.path).then(content => {
                       set({ fileContent: content, isDirty: false });
                  });
              } else {
                  set({ openFiles: newOpenFiles, activeFilePath: null, fileContent: '' });
              }
          } else {
              set({ openFiles: newOpenFiles });
          }
      },

      saveFile: async (content) => {
          const { activeFilePath } = get();
          if (!activeFilePath) return;
          
          try {
              await window.electronAPI.writeFile(activeFilePath, content);
              set({ fileContent: content, isDirty: false });
          } catch (error) {
              console.error("Failed to save file", error);
          }
      },
      
      restoreSession: async () => {
          const { rootDir, activeFilePath } = get();
          
          if (rootDir) {
              try {
                await get().loadDir(rootDir);
              } catch (e) {
                  console.error("Failed to restore root dir", e);
                  set({ rootDir: null, files: [] }); // Reset if invalid
              }
          }
          
          if (activeFilePath) {
              try {
                  const content = await window.electronAPI.readFile(activeFilePath);
                  set({ fileContent: content });
              } catch (e) {
                  console.error("Failed to restore active file", e);
                  set({ activeFilePath: null, fileContent: '' });
              }
          }
      }
    }),
    {
      name: 'project-muse-storage',
      partialize: (state) => ({
        rootDir: state.rootDir,
        openFiles: state.openFiles,
        activeFilePath: state.activeFilePath,
      }),
    }
  )
);
