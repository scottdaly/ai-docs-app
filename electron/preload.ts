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
  workspaceCreateBookmark: (workspaceRoot: string, filePath: string, json: any, label: string, description?: string) =>
    ipcRenderer.invoke('workspace:createBookmark', workspaceRoot, filePath, json, label, description),

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

  // Cancel active import operation
  importCancel: () =>
    ipcRenderer.invoke('import:cancel'),

  // Error reporting preference
  setErrorReportingEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('set-error-reporting-enabled', enabled),

  // Report renderer errors (for React error boundaries and global handlers)
  reportRendererError: (errorData: {
    type: string;
    message: string;
    stack?: string;
    componentStack?: string;
  }) => ipcRenderer.invoke('report-renderer-error', errorData),

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
  onShowLoginPrompt: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on('show-login-prompt', subscription);
      return () => ipcRenderer.off('show-login-prompt', subscription);
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
  },

  // --- Authentication APIs ---

  auth: {
    // Email/password authentication
    signup: (email: string, password: string, displayName?: string) =>
      ipcRenderer.invoke('auth:signup', email, password, displayName),

    login: (email: string, password: string) =>
      ipcRenderer.invoke('auth:login', email, password),

    logout: () =>
      ipcRenderer.invoke('auth:logout'),

    // OAuth authentication
    loginWithGoogle: () =>
      ipcRenderer.invoke('auth:loginWithGoogle'),

    // User info
    getUser: () =>
      ipcRenderer.invoke('auth:getUser'),

    getSubscription: () =>
      ipcRenderer.invoke('auth:getSubscription'),

    getUsage: () =>
      ipcRenderer.invoke('auth:getUsage'),

    isAuthenticated: () =>
      ipcRenderer.invoke('auth:isAuthenticated'),

    // Get current auth state
    getState: () =>
      ipcRenderer.invoke('auth:getState'),

    // Listen for auth state changes (initializing, authenticated, unauthenticated)
    onAuthStateChange: (callback: (state: string) => void) => {
      const subscription = (_: any, state: string) => callback(state);
      ipcRenderer.on('auth:stateChanged', subscription);
      return () => ipcRenderer.off('auth:stateChanged', subscription);
    },

    // Listen for session expiration events (for re-auth UX)
    onSessionExpired: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on('auth:sessionExpired', subscription);
      return () => ipcRenderer.off('auth:sessionExpired', subscription);
    },
  },

  // --- LLM APIs ---

  llm: {
    // Non-streaming chat
    chat: (options: {
      provider: 'openai' | 'anthropic';
      model: string;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      temperature?: number;
      maxTokens?: number;
      requestType?: 'chat' | 'inline_edit' | 'agent';
    }) => ipcRenderer.invoke('llm:chat', options),

    // Streaming chat
    chatStream: (
      options: {
        provider: 'openai' | 'anthropic';
        model: string;
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
        temperature?: number;
        maxTokens?: number;
        requestType?: 'chat' | 'inline_edit' | 'agent';
      },
      channelId: string
    ) => {
      ipcRenderer.send('llm:chatStream', options, channelId);
    },

    // Streaming event listeners
    onStreamChunk: (channelId: string, callback: (data: { content: string }) => void) => {
      const subscription = (_: any, data: { content: string }) => callback(data);
      ipcRenderer.on(`llm:stream:${channelId}:chunk`, subscription);
      return () => ipcRenderer.off(`llm:stream:${channelId}:chunk`, subscription);
    },

    onStreamDone: (channelId: string, callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on(`llm:stream:${channelId}:done`, subscription);
      return () => ipcRenderer.off(`llm:stream:${channelId}:done`, subscription);
    },

    onStreamUsage: (channelId: string, callback: (data: { usage: any }) => void) => {
      const subscription = (_: any, data: { usage: any }) => callback(data);
      ipcRenderer.on(`llm:stream:${channelId}:usage`, subscription);
      return () => ipcRenderer.off(`llm:stream:${channelId}:usage`, subscription);
    },

    onStreamError: (channelId: string, callback: (data: { error: string }) => void) => {
      const subscription = (_: any, data: { error: string }) => callback(data);
      ipcRenderer.on(`llm:stream:${channelId}:error`, subscription);
      return () => ipcRenderer.off(`llm:stream:${channelId}:error`, subscription);
    },

    // Remove all stream listeners for a channel
    offStream: (channelId: string) => {
      ipcRenderer.removeAllListeners(`llm:stream:${channelId}:chunk`);
      ipcRenderer.removeAllListeners(`llm:stream:${channelId}:done`);
      ipcRenderer.removeAllListeners(`llm:stream:${channelId}:usage`);
      ipcRenderer.removeAllListeners(`llm:stream:${channelId}:error`);
    },

    // Chat with tools/function calling
    chatWithTools: (options: {
      provider: 'openai' | 'anthropic';
      model: string;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      tools: Array<{ name: string; description: string; parameters: any }>;
      temperature?: number;
      maxTokens?: number;
    }) => ipcRenderer.invoke('llm:chatWithTools', options),

    // Get available models
    getModels: () =>
      ipcRenderer.invoke('llm:getModels'),

    // Get quota info
    getQuota: () =>
      ipcRenderer.invoke('llm:getQuota'),

    // Get LLM service status
    getStatus: () =>
      ipcRenderer.invoke('llm:getStatus'),
  },

  // --- Agent APIs ---

  agent: {
    // Get available tools for the agent
    getTools: () =>
      ipcRenderer.invoke('agent:getTools'),

    // Execute tool calls from the agent
    executeTools: (workspaceRoot: string, toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>) =>
      ipcRenderer.invoke('agent:executeTools', workspaceRoot, toolCalls),

    // Check if a tool is destructive (requires confirmation)
    isDestructive: (toolName: string) =>
      ipcRenderer.invoke('agent:isDestructive', toolName),

    // Check if a tool is read-only (safe to execute without confirmation)
    isReadOnly: (toolName: string) =>
      ipcRenderer.invoke('agent:isReadOnly', toolName),
  },

  // --- Subscription APIs ---

  subscription: {
    // Get subscription status
    getStatus: () =>
      ipcRenderer.invoke('subscription:getStatus'),

    // Create checkout session for upgrading
    createCheckout: (priceType: 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly', successUrl: string, cancelUrl: string) =>
      ipcRenderer.invoke('subscription:createCheckout', priceType, successUrl, cancelUrl),

    // Create portal session for managing subscription
    createPortal: (returnUrl: string) =>
      ipcRenderer.invoke('subscription:createPortal', returnUrl),

    // Get available prices
    getPrices: () =>
      ipcRenderer.invoke('subscription:getPrices'),
  },

  // Open external URL in default browser
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),
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
