import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileNode, FileCategory } from '../shared/types';

// Tiptap document type
interface TiptapDocument {
  type: 'doc';
  content: any[];
}

// External change event type
interface ExternalChange {
  type: 'change' | 'add' | 'unlink';
  fileKey: string;
  timestamp: string;
}

interface FileSystemState {
  rootDir: string | null;
  files: FileNode[];
  openFiles: FileNode[];
  activeFilePath: string | null;

  // Changed from string to Tiptap JSON
  editorContent: TiptapDocument | null;
  isDirty: boolean;

  // Recovery state
  hasRecovery: boolean;
  recoveryTime: Date | null;

  // External change state
  externalChange: ExternalChange | null;

  // Pending rename state (for new file creation flow)
  pendingRenamePath: string | null;

  // Actions
  setRootDir: (path: string) => void;
  setFiles: (files: FileNode[]) => void;
  setEditorContent: (content: TiptapDocument | null) => void;
  setIsDirty: (dirty: boolean) => void;

  loadDir: (path: string) => Promise<void>;
  loadSubDirectory: (path: string) => Promise<void>;

  openFile: (file: FileNode) => Promise<void>;
  closeFile: (path: string) => void;
  selectFile: (path: string) => Promise<void>;
  saveFile: (json: TiptapDocument) => Promise<void>;
  createFile: (filename: string, json: TiptapDocument, folderPath?: string, triggerRename?: boolean) => Promise<string | null>;
  renameFile: (oldPath: string, newName: string) => Promise<string | null>;
  reopenFileAs: (path: string, category: FileCategory) => Promise<void>;

  // Recovery actions
  loadFromRecovery: (filePath: string) => Promise<void>;
  discardRecovery: (filePath: string) => Promise<void>;

  // External change actions
  setExternalChange: (change: ExternalChange | null) => void;
  reloadFromDisk: () => Promise<void>;
  keepCurrentVersion: () => void;

  // Pending rename actions
  setPendingRenamePath: (path: string | null) => void;
  clearPendingRenamePath: () => void;

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

// Helper to preserve children from old file tree when refreshing
const preserveChildren = (newNodes: FileNode[], oldNodes: FileNode[]): FileNode[] => {
  // Create a map of old nodes by path for quick lookup (flattened)
  const oldNodeMap = new Map<string, FileNode>();
  const buildMap = (nodes: FileNode[]) => {
    for (const node of nodes) {
      oldNodeMap.set(node.path, node);
      if (node.children) {
        buildMap(node.children);
      }
    }
  };
  buildMap(oldNodes);

  // Recursively merge children from old nodes into new nodes
  const merge = (nodes: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      const oldNode = oldNodeMap.get(node.path);
      if (node.type === 'directory' && oldNode?.children) {
        // Preserve old children and recursively process them
        return {
          ...node,
          children: merge(oldNode.children)
        };
      }
      return node;
    });
  };

  return merge(newNodes);
};

// Create empty document
const createEmptyDocument = (): TiptapDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
});

export const useFileSystem = create<FileSystemState>()(
  persist(
    (set, get) => ({
      rootDir: null,
      files: [],
      openFiles: [],
      activeFilePath: null,
      editorContent: null,
      isDirty: false,
      hasRecovery: false,
      recoveryTime: null,
      externalChange: null,
      pendingRenamePath: null,

      setRootDir: (path) => set({ rootDir: path }),
      setFiles: (files) => set({ files }),
      setEditorContent: (content) => set({ editorContent: content }),
      setIsDirty: (dirty) => set({ isDirty: dirty }),

      loadDir: async (path) => {
        const previousRootDir = get().rootDir;
        const previousFiles = get().files;
        const isRefresh = previousRootDir === path;

        // If changing workspace, stop old watcher and clear tabs
        if (previousRootDir && previousRootDir !== path) {
          // Stop the file watcher for the old workspace
          try {
            await window.electronAPI.workspaceStopWatcher(previousRootDir);
          } catch (error) {
            console.error('Failed to stop watcher for previous workspace:', error);
          }

          set({
            openFiles: [],
            activeFilePath: null,
            editorContent: null,
            hasRecovery: false,
            recoveryTime: null,
            externalChange: null, // Clear any pending external change notifications
          });
        }

        const files = await window.electronAPI.readDir(path);
        // Sort: Directories first, then files
        const sortedFiles = files.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });

        // If refreshing the same workspace, preserve loaded children
        const finalFiles = isRefresh && previousFiles.length > 0
          ? preserveChildren(sortedFiles, previousFiles)
          : sortedFiles;

        set({ rootDir: path, files: finalFiles });

        // Initialize workspace (creates .midlight folder if needed)
        try {
          await window.electronAPI.workspaceInit(path);
        } catch (error) {
          console.error('Failed to initialize workspace:', error);
        }
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
        const { openFiles, activeFilePath, rootDir } = get();
        const alreadyOpen = openFiles.find(f => f.path === file.path);

        // If already active, do nothing
        if (activeFilePath === file.path) return;

        // Don't open unsupported files
        if (file.category === 'unsupported') return;

        // Handle viewable files (images) - no content loading needed
        if (file.category === 'viewable') {
          if (alreadyOpen) {
            set({ activeFilePath: file.path, editorContent: null, isDirty: false, hasRecovery: false });
          } else {
            set({
              openFiles: [...openFiles, file],
              activeFilePath: file.path,
              editorContent: null,
              isDirty: false,
              hasRecovery: false,
            });
          }
          return;
        }

        // Only handle .md files with workspace API
        if (!file.path.endsWith('.md') || !rootDir) {
          // Fall back to raw file read for non-markdown files
          try {
            const content = await window.electronAPI.readFile(file.path);
            // For non-md files, create a simple text document
            const doc: TiptapDocument = {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
            };

            if (alreadyOpen) {
              set({ activeFilePath: file.path, editorContent: doc, isDirty: false, hasRecovery: false });
            } else {
              set({
                openFiles: [...openFiles, file],
                activeFilePath: file.path,
                editorContent: doc,
                isDirty: false,
                hasRecovery: false,
              });
            }
          } catch (error) {
            console.error("Failed to load file", error);
          }
          return;
        }

        try {
          // Use workspace API to load document
          const result = await window.electronAPI.workspaceLoadDocument(rootDir, file.path);

          if (result.success && result.json) {
            const newState: Partial<FileSystemState> = {
              activeFilePath: file.path,
              editorContent: result.json,
              isDirty: false,
              hasRecovery: result.hasRecovery || false,
              recoveryTime: result.recoveryTime ? new Date(result.recoveryTime) : null,
            };

            if (alreadyOpen) {
              set(newState);
            } else {
              set({
                ...newState,
                openFiles: [...openFiles, file],
              });
            }
          } else {
            console.error('Failed to load document:', result.error);
            // Create empty document on failure
            if (alreadyOpen) {
              set({ activeFilePath: file.path, editorContent: createEmptyDocument(), isDirty: false });
            } else {
              set({
                openFiles: [...openFiles, file],
                activeFilePath: file.path,
                editorContent: createEmptyDocument(),
                isDirty: false
              });
            }
          }
        } catch (error) {
          console.error("Failed to load file", error);
        }
      },

      selectFile: async (path) => {
        const { activeFilePath, rootDir, openFiles } = get();
        if (activeFilePath === path) return;

        // Find the file in openFiles to check its category
        const file = openFiles.find(f => f.path === path);

        // Handle viewable files (images) - no content loading needed
        if (file?.category === 'viewable') {
          set({ activeFilePath: path, editorContent: null, isDirty: false, hasRecovery: false });
          return;
        }

        // Only handle .md files with workspace API
        if (!path.endsWith('.md') || !rootDir) {
          try {
            const content = await window.electronAPI.readFile(path);
            const doc: TiptapDocument = {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
            };
            set({ activeFilePath: path, editorContent: doc, isDirty: false, hasRecovery: false });
          } catch (error) {
            console.error("Failed to select file", error);
          }
          return;
        }

        try {
          const result = await window.electronAPI.workspaceLoadDocument(rootDir, path);

          if (result.success && result.json) {
            set({
              activeFilePath: path,
              editorContent: result.json,
              isDirty: false,
              hasRecovery: result.hasRecovery || false,
              recoveryTime: result.recoveryTime ? new Date(result.recoveryTime) : null,
            });
          } else {
            set({ activeFilePath: path, editorContent: createEmptyDocument(), isDirty: false });
          }
        } catch (error) {
          console.error("Failed to select file", error);
        }
      },

      closeFile: (path) => {
        const { openFiles, activeFilePath, rootDir } = get();
        const newOpenFiles = openFiles.filter(f => f.path !== path);

        if (path === activeFilePath) {
          // Determine new active file (last one, or null)
          const newActive = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;

          if (newActive && rootDir) {
            set({ openFiles: newOpenFiles, activeFilePath: newActive.path });

            // Handle viewable files (images) - no content loading needed
            if (newActive.category === 'viewable') {
              set({ editorContent: null, isDirty: false, hasRecovery: false });
            } else if (newActive.path.endsWith('.md')) {
              // Load the new active file
              window.electronAPI.workspaceLoadDocument(rootDir, newActive.path).then(result => {
                if (result.success && result.json) {
                  set({
                    editorContent: result.json,
                    isDirty: false,
                    hasRecovery: result.hasRecovery || false,
                    recoveryTime: result.recoveryTime ? new Date(result.recoveryTime) : null,
                  });
                }
              });
            } else {
              window.electronAPI.readFile(newActive.path).then(content => {
                const doc: TiptapDocument = {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
                };
                set({ editorContent: doc, isDirty: false, hasRecovery: false });
              });
            }
          } else {
            set({ openFiles: newOpenFiles, activeFilePath: null, editorContent: null, hasRecovery: false });
          }
        } else {
          set({ openFiles: newOpenFiles });
        }
      },

      saveFile: async (json) => {
        const { activeFilePath, rootDir } = get();
        if (!activeFilePath || !rootDir) return;

        try {
          // Use workspace API to save document
          const result = await window.electronAPI.workspaceSaveDocument(
            rootDir,
            activeFilePath,
            json,
            'manual'
          );

          if (result.success) {
            set({ editorContent: json, isDirty: false, hasRecovery: false });
          } else {
            console.error('Failed to save document:', result.error);
          }
        } catch (error) {
          console.error("Failed to save file", error);
        }
      },

      createFile: async (filename, json, folderPath?, triggerRename = false) => {
        const { rootDir, openFiles } = get();
        if (!rootDir) {
          console.error("No workspace open");
          return null;
        }

        // Ensure filename ends with .md
        const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

        // Build the full path (in specified folder or root directory)
        const separator = rootDir.includes('\\') ? '\\' : '/';
        const targetDir = folderPath || rootDir;
        let filePath = `${targetDir}${separator}${finalFilename}`;

        // Check if file already exists and generate unique name if needed
        try {
          let counter = 1;
          let baseName = finalFilename.replace('.md', '');
          while (await window.electronAPI.fileExists(filePath)) {
            // File exists, try next number
            filePath = `${targetDir}${separator}${baseName} ${counter}.md`;
            counter++;
          }

          // Save the file using workspace API
          const result = await window.electronAPI.workspaceSaveDocument(
            rootDir,
            filePath,
            json,
            'manual'
          );

          if (!result.success) {
            console.error('Failed to create file:', result.error);
            return null;
          }

          // Create the file node
          const newFile: FileNode = {
            name: filePath.split(separator).pop() || finalFilename,
            path: filePath,
            type: 'file',
            category: 'native', // New files are native Midlight files
          };

          // Add to open files and set as active
          set({
            openFiles: [...openFiles, newFile],
            activeFilePath: filePath,
            editorContent: json,
            isDirty: false,
            hasRecovery: false,
            pendingRenamePath: triggerRename ? filePath : null,
          });

          // Refresh the file list
          await get().loadDir(rootDir);

          return filePath;
        } catch (error) {
          console.error("Failed to create file", error);
          return null;
        }
      },

      renameFile: async (oldPath, newName) => {
        const { rootDir, openFiles, activeFilePath } = get();
        if (!rootDir) {
          console.error("No workspace open");
          return null;
        }

        try {
          // Ensure newName ends with .md
          const finalName = newName.endsWith('.md') ? newName : `${newName}.md`;

          // Build new path in the same directory as the old file
          const separator = oldPath.includes('\\') ? '\\' : '/';
          const dirPath = oldPath.substring(0, oldPath.lastIndexOf(separator));
          const newPath = `${dirPath}${separator}${finalName}`;

          // Don't rename if paths are the same
          if (oldPath === newPath) {
            return oldPath;
          }

          // Rename the file
          await window.electronAPI.renameFile(oldPath, newPath);

          // Update open files list
          const updatedOpenFiles = openFiles.map(f =>
            f.path === oldPath ? { ...f, name: finalName, path: newPath } : f
          );

          // Update state
          set({
            openFiles: updatedOpenFiles,
            activeFilePath: activeFilePath === oldPath ? newPath : activeFilePath,
          });

          // Refresh the file list
          await get().loadDir(rootDir);

          return newPath;
        } catch (error) {
          console.error("Failed to rename file", error);
          return null;
        }
      },

      reopenFileAs: async (path, category: FileCategory) => {
        const { openFiles } = get();
        const existingFile = openFiles.find(f => f.path === path);

        if (!existingFile) {
          // File not open, nothing to reopen
          return;
        }

        // Update the file's category in openFiles
        const updatedOpenFiles: FileNode[] = openFiles.map(f =>
          f.path === path ? { ...f, category } : f
        );

        // Load content as text (for 'compatible' category)
        if (category === 'compatible') {
          try {
            const content = await window.electronAPI.readFile(path);
            const doc: TiptapDocument = {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
            };

            set({
              openFiles: updatedOpenFiles,
              activeFilePath: path,
              editorContent: doc,
              isDirty: false,
              hasRecovery: false,
            });
          } catch (error) {
            console.error("Failed to reopen file as code", error);
          }
        } else if (category === 'viewable') {
          // Reopen as image
          set({
            openFiles: updatedOpenFiles,
            activeFilePath: path,
            editorContent: null,
            isDirty: false,
            hasRecovery: false,
          });
        }
      },

      loadFromRecovery: async (filePath) => {
        const { rootDir } = get();
        if (!rootDir) return;

        try {
          const result = await window.electronAPI.workspaceLoadFromRecovery(rootDir, filePath);

          if (result.success && result.json) {
            set({
              editorContent: result.json,
              isDirty: true, // Mark as dirty since it's recovered content
              hasRecovery: false, // Clear recovery flag after loading
              recoveryTime: null,
            });
          } else {
            console.error('Failed to load from recovery:', result.error);
          }
        } catch (error) {
          console.error('Failed to load from recovery:', error);
        }
      },

      discardRecovery: async (filePath) => {
        const { rootDir } = get();
        if (!rootDir) return;

        try {
          await window.electronAPI.workspaceDiscardRecovery(rootDir, filePath);
          set({ hasRecovery: false, recoveryTime: null });
        } catch (error) {
          console.error('Failed to discard recovery:', error);
        }
      },

      setExternalChange: (change) => set({ externalChange: change }),

      reloadFromDisk: async () => {
        const { activeFilePath, rootDir } = get();
        if (!activeFilePath || !rootDir) return;

        try {
          const result = await window.electronAPI.workspaceLoadDocument(rootDir, activeFilePath);

          if (result.success && result.json) {
            set({
              editorContent: result.json,
              isDirty: false,
              externalChange: null,
              hasRecovery: result.hasRecovery || false,
              recoveryTime: result.recoveryTime ? new Date(result.recoveryTime) : null,
            });
          } else {
            console.error('Failed to reload from disk:', result.error);
            set({ externalChange: null });
          }
        } catch (error) {
          console.error('Failed to reload from disk:', error);
          set({ externalChange: null });
        }
      },

      keepCurrentVersion: () => {
        // Simply dismiss the external change notification
        // The user's current content is kept as-is
        set({ externalChange: null });
      },

      setPendingRenamePath: (path) => set({ pendingRenamePath: path }),
      clearPendingRenamePath: () => set({ pendingRenamePath: null }),

      restoreSession: async () => {
        const { rootDir, activeFilePath, openFiles } = get();

        if (rootDir) {
          try {
            await get().loadDir(rootDir);
          } catch (e) {
            console.error("Failed to restore root dir", e);
            set({ rootDir: null, files: [] });
          }
        }

        if (activeFilePath && rootDir) {
          try {
            // Find the file in openFiles to check its category
            const file = openFiles.find(f => f.path === activeFilePath);

            // Handle viewable files (images) - no content loading needed
            if (file?.category === 'viewable') {
              set({ editorContent: null });
            } else if (activeFilePath.endsWith('.md')) {
              const result = await window.electronAPI.workspaceLoadDocument(rootDir, activeFilePath);
              if (result.success && result.json) {
                set({
                  editorContent: result.json,
                  hasRecovery: result.hasRecovery || false,
                  recoveryTime: result.recoveryTime ? new Date(result.recoveryTime) : null,
                });
              }
            } else {
              const content = await window.electronAPI.readFile(activeFilePath);
              const doc: TiptapDocument = {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
              };
              set({ editorContent: doc });
            }
          } catch (e) {
            console.error("Failed to restore active file", e);
            set({ activeFilePath: null, editorContent: null });
          }
        }
      }
    }),
    {
      name: 'midlight-storage',
      partialize: (state) => ({
        rootDir: state.rootDir,
        openFiles: state.openFiles,
        activeFilePath: state.activeFilePath,
      }),
    }
  )
);
