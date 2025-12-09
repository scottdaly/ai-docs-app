import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info for renderer
  platform: process.platform as 'darwin' | 'win32' | 'linux',

  // Update Windows titlebar overlay colors (for theme changes)
  updateTitleBarOverlay: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.invoke('update-titlebar-overlay', colors),

  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  readDir: (path: string) => ipcRenderer.invoke('read-dir', path),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  fileExists: (path: string) => ipcRenderer.invoke('file-exists', path),
  readImageAsDataUrl: (path: string) => ipcRenderer.invoke('read-image-as-data-url', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  createFolder: (path: string) => ipcRenderer.invoke('create-folder', path),
  deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),

  // --- File Browser Context Menu Operations ---
  fileDuplicate: (path: string) => ipcRenderer.invoke('file:duplicate', path),
  fileTrash: (path: string) => ipcRenderer.invoke('file:trash', path),
  fileRevealInFinder: (path: string) => ipcRenderer.invoke('file:revealInFinder', path),
  fileCopyPath: (path: string) => ipcRenderer.invoke('file:copyPath', path),
  folderCreate: (parentPath: string, name: string) => ipcRenderer.invoke('folder:create', parentPath, name),
  fileCopyTo: (sourcePaths: string[], destDir: string) => ipcRenderer.invoke('file:copyTo', sourcePaths, destDir),
  fileMoveTo: (sourcePaths: string[], destDir: string) => ipcRenderer.invoke('file:moveTo', sourcePaths, destDir),

  importDocx: () => ipcRenderer.invoke('import-docx'),
  importDocxFromPath: (filePath: string) => ipcRenderer.invoke('import-docx-from-path', filePath),
  exportPdf: () => ipcRenderer.invoke('export-pdf'),
  exportDocx: (content: any) => ipcRenderer.invoke('export-docx', content),

  // --- Workspace & Versioning APIs ---

  // Initialize workspace (.midlight folder)
  workspaceInit: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:init', workspaceRoot),

  // Load document (returns Tiptap JSON + recovery info)
  workspaceLoadDocument: (workspaceRoot: string, filePath: string) =>
    ipcRenderer.invoke('workspace:loadDocument', workspaceRoot, filePath),

  // Load from recovery
  workspaceLoadFromRecovery: (workspaceRoot: string, filePath: string) =>
    ipcRenderer.invoke('workspace:loadFromRecovery', workspaceRoot, filePath),

  // Discard recovery and load from saved file
  workspaceDiscardRecovery: (workspaceRoot: string, filePath: string) =>
    ipcRenderer.invoke('workspace:discardRecovery', workspaceRoot, filePath),

  // Save document (Tiptap JSON -> Markdown + Sidecar)
  workspaceSaveDocument: (workspaceRoot: string, filePath: string, json: any, trigger?: string) =>
    ipcRenderer.invoke('workspace:saveDocument', workspaceRoot, filePath, json, trigger),

  // Get checkpoint history for a file
  workspaceGetCheckpoints: (workspaceRoot: string, filePath: string) =>
    ipcRenderer.invoke('workspace:getCheckpoints', workspaceRoot, filePath),

  // Get content of a specific checkpoint
  workspaceGetCheckpointContent: (workspaceRoot: string, filePath: string, checkpointId: string) =>
    ipcRenderer.invoke('workspace:getCheckpointContent', workspaceRoot, filePath, checkpointId),

  // Restore a checkpoint
  workspaceRestoreCheckpoint: (workspaceRoot: string, filePath: string, checkpointId: string) =>
    ipcRenderer.invoke('workspace:restoreCheckpoint', workspaceRoot, filePath, checkpointId),

  // Create a bookmark (named checkpoint)
  workspaceCreateBookmark: (workspaceRoot: string, filePath: string, json: any, label: string) =>
    ipcRenderer.invoke('workspace:createBookmark', workspaceRoot, filePath, json, label),

  // Label an existing checkpoint
  workspaceLabelCheckpoint: (workspaceRoot: string, filePath: string, checkpointId: string, label: string) =>
    ipcRenderer.invoke('workspace:labelCheckpoint', workspaceRoot, filePath, checkpointId, label),

  // Compare two checkpoints (for diff view)
  workspaceCompareCheckpoints: (workspaceRoot: string, filePath: string, checkpointIdA: string, checkpointIdB: string) =>
    ipcRenderer.invoke('workspace:compareCheckpoints', workspaceRoot, filePath, checkpointIdA, checkpointIdB),

  // Get image data URL from reference
  workspaceGetImageDataUrl: (workspaceRoot: string, imageRef: string) =>
    ipcRenderer.invoke('workspace:getImageDataUrl', workspaceRoot, imageRef),

  // Check for recovery files on startup
  workspaceCheckForRecovery: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:checkForRecovery', workspaceRoot),

  // Get storage statistics
  workspaceGetStorageStats: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:getStorageStats', workspaceRoot),

  // Run garbage collection
  workspaceRunGC: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:runGC', workspaceRoot),

  // Get workspace configuration
  workspaceGetConfig: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:getConfig', workspaceRoot),

  // Update workspace configuration
  workspaceUpdateConfig: (workspaceRoot: string, updates: any) =>
    ipcRenderer.invoke('workspace:updateConfig', workspaceRoot, updates),

  // Stop file watcher for a workspace
  workspaceStopWatcher: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:stopWatcher', workspaceRoot),

  // Check if a file has external changes
  workspaceHasExternalChange: (workspaceRoot: string, filePath: string) =>
    ipcRenderer.invoke('workspace:hasExternalChange', workspaceRoot, filePath),

  // --- Draft APIs ---

  // Create a new draft from current document state
  workspaceCreateDraft: (workspaceRoot: string, filePath: string, name: string, json: any) =>
    ipcRenderer.invoke('workspace:createDraft', workspaceRoot, filePath, name, json),

  // Create a new draft from a checkpoint
  workspaceCreateDraftFromCheckpoint: (workspaceRoot: string, filePath: string, name: string, checkpointId: string) =>
    ipcRenderer.invoke('workspace:createDraftFromCheckpoint', workspaceRoot, filePath, name, checkpointId),

  // Get all drafts for a file
  workspaceGetDrafts: (workspaceRoot: string, filePath: string) =>
    ipcRenderer.invoke('workspace:getDrafts', workspaceRoot, filePath),

  // Get all active drafts across all files
  workspaceGetAllActiveDrafts: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:getAllActiveDrafts', workspaceRoot),

  // Get a specific draft
  workspaceGetDraft: (workspaceRoot: string, filePath: string, draftId: string) =>
    ipcRenderer.invoke('workspace:getDraft', workspaceRoot, filePath, draftId),

  // Get draft content as Tiptap JSON
  workspaceGetDraftContent: (workspaceRoot: string, filePath: string, draftId: string) =>
    ipcRenderer.invoke('workspace:getDraftContent', workspaceRoot, filePath, draftId),

  // Save draft content
  workspaceSaveDraftContent: (workspaceRoot: string, filePath: string, draftId: string, json: any, trigger?: string) =>
    ipcRenderer.invoke('workspace:saveDraftContent', workspaceRoot, filePath, draftId, json, trigger),

  // Rename a draft
  workspaceRenameDraft: (workspaceRoot: string, filePath: string, draftId: string, newName: string) =>
    ipcRenderer.invoke('workspace:renameDraft', workspaceRoot, filePath, draftId, newName),

  // Apply (merge) a draft to the main document
  workspaceApplyDraft: (workspaceRoot: string, filePath: string, draftId: string) =>
    ipcRenderer.invoke('workspace:applyDraft', workspaceRoot, filePath, draftId),

  // Discard a draft (archive without applying)
  workspaceDiscardDraft: (workspaceRoot: string, filePath: string, draftId: string) =>
    ipcRenderer.invoke('workspace:discardDraft', workspaceRoot, filePath, draftId),

  // Delete a draft permanently
  workspaceDeleteDraft: (workspaceRoot: string, filePath: string, draftId: string) =>
    ipcRenderer.invoke('workspace:deleteDraft', workspaceRoot, filePath, draftId),

  // Count active drafts (for tier enforcement)
  workspaceCountActiveDrafts: (workspaceRoot: string) =>
    ipcRenderer.invoke('workspace:countActiveDrafts', workspaceRoot),

  // --- Import APIs ---

  // Select folder for import
  importSelectFolder: () =>
    ipcRenderer.invoke('import:selectFolder'),

  // Detect source type (Obsidian, Notion, or generic)
  importDetectSourceType: (folderPath: string) =>
    ipcRenderer.invoke('import:detectSourceType', folderPath),

  // Analyze Obsidian vault
  importAnalyzeObsidian: (vaultPath: string) =>
    ipcRenderer.invoke('import:analyzeObsidian', vaultPath),

  // Import from Obsidian vault
  importObsidian: (analysisJson: string, destPath: string, optionsJson: string) =>
    ipcRenderer.invoke('import:obsidian', analysisJson, destPath, optionsJson),

  // Analyze Notion export
  importAnalyzeNotion: (exportPath: string) =>
    ipcRenderer.invoke('import:analyzeNotion', exportPath),

  // Import from Notion export
  importNotion: (analysisJson: string, destPath: string, optionsJson: string) =>
    ipcRenderer.invoke('import:notion', analysisJson, destPath, optionsJson),

  // Listen for import progress updates
  onImportProgress: (callback: (progress: any) => void) => {
    const subscription = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('import-progress', subscription);
    return () => ipcRenderer.off('import-progress', subscription);
  },

  // Listeners
  onMenuAction: (callback: (action: string) => void) => {
      const subscription = (_: any, action: string) => callback(action);
      ipcRenderer.on('menu-action', subscription);
      return () => ipcRenderer.off('menu-action', subscription);
  },
  onUpdateTheme: (callback: (theme: string) => void) => {
      const subscription = (_: any, theme: string) => callback(theme);
      ipcRenderer.on('update-theme', subscription);
      return () => ipcRenderer.off('update-theme', subscription);
  },
  onDocxExportProgress: (callback: (progress: { current?: number; total?: number; phase?: string; complete?: boolean; error?: string }) => void) => {
      const subscription = (_: any, progress: any) => callback(progress);
      ipcRenderer.on('docx-export-progress', subscription);
      return () => ipcRenderer.off('docx-export-progress', subscription);
  },

  // Listen for external file changes
  onFileChangedExternally: (callback: (event: { type: 'change' | 'add' | 'unlink'; fileKey: string; absolutePath: string; timestamp: string }) => void) => {
      const subscription = (_: any, event: { type: 'change' | 'add' | 'unlink'; fileKey: string; absolutePath: string; timestamp: string }) => callback(event);
      ipcRenderer.on('file-changed-externally', subscription);
      return () => ipcRenderer.off('file-changed-externally', subscription);
  },

  // --- Auto-Update APIs ---

  // Check for updates manually
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Download the available update
  downloadUpdate: () => ipcRenderer.invoke('download-update'),

  // Quit and install the downloaded update
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),

  // Get current app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Listen for update available
  onUpdateAvailable: (callback: (data: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => {
      const subscription = (_: any, data: { version: string; releaseDate?: string; releaseNotes?: string }) => callback(data);
      ipcRenderer.on('update-available', subscription);
      return () => ipcRenderer.off('update-available', subscription);
  },

  // Listen for update not available
  onUpdateNotAvailable: (callback: (data: { version: string }) => void) => {
      const subscription = (_: any, data: { version: string }) => callback(data);
      ipcRenderer.on('update-not-available', subscription);
      return () => ipcRenderer.off('update-not-available', subscription);
  },

  // Listen for download progress
  onUpdateDownloadProgress: (callback: (data: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => {
      const subscription = (_: any, data: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => callback(data);
      ipcRenderer.on('update-download-progress', subscription);
      return () => ipcRenderer.off('update-download-progress', subscription);
  },

  // Listen for update downloaded
  onUpdateDownloaded: (callback: (data: { version: string; releaseNotes?: string }) => void) => {
      const subscription = (_: any, data: { version: string; releaseNotes?: string }) => callback(data);
      ipcRenderer.on('update-downloaded', subscription);
      return () => ipcRenderer.off('update-downloaded', subscription);
  },

  // Listen for update error
  onUpdateError: (callback: (data: { message: string }) => void) => {
      const subscription = (_: any, data: { message: string }) => callback(data);
      ipcRenderer.on('update-error', subscription);
      return () => ipcRenderer.off('update-error', subscription);
  }
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
