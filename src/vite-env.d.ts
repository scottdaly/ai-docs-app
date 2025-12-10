/// <reference types="vite/client" />

interface DocxExportProgress {
  current?: number;
  total?: number;
  phase?: string;
  complete?: boolean;
  error?: string;
}

// --- Workspace & Versioning Types ---

interface Checkpoint {
  id: string;
  contentHash: string;
  sidecarHash: string;
  timestamp: string;
  parentId: string | null;
  type: 'auto' | 'bookmark';
  label?: string;
  stats: {
    wordCount: number;
    charCount: number;
    changeSize: number;
  };
  trigger: string;
}

interface RecoveryFile {
  fileKey: string;
  walContent: string;
  walTime: Date;
}

interface StorageStats {
  objectStoreSize: number;
  objectCount: number;
  imageStoreSize: number;
  imageCount: number;
}

interface EditorConfig {
  spellcheck: boolean;
  showWordCount: boolean;
  showCharCount: boolean;
  autoSaveIntervalMs: number;
}

interface WorkspaceConfig {
  version: 1;
  workspace: {
    name?: string;
    created: string;
  };
  defaults: {
    font?: string;
    fontSize?: string;
    lineHeight?: number;
    theme?: string;
  };
  editor: EditorConfig;
  versioning: {
    enabled: boolean;
    checkpointIntervalMs: number;
    minChangeChars: number;
    maxCheckpointsPerFile: number;
    retentionDays: number;
  };
  recovery: {
    enabled: boolean;
    walIntervalMs: number;
  };
  sync: {
    enabled: boolean;
    lastSync: string | null;
  };
}

interface SidecarDocument {
  version: 1;
  meta: {
    created: string;
    modified: string;
    title?: string;
    author?: string;
    tags?: string[];
    wordCount?: number;
    readingTime?: number;
    migratedFrom?: string;
  };
  document: Record<string, any>;
  blocks: Record<string, any>;
  spans: Record<string, any[]>;
  images: Record<string, any>;
}

// API Response types
interface WorkspaceResult {
  success: boolean;
  error?: string;
}

interface LoadDocumentResult extends WorkspaceResult {
  json?: any;
  sidecar?: SidecarDocument;
  hasRecovery?: boolean;
  recoveryTime?: Date;
}

interface SaveResult extends WorkspaceResult {
  checkpointCreated?: Checkpoint;
}

interface CheckpointsResult extends WorkspaceResult {
  checkpoints?: Checkpoint[];
}

interface CheckpointContentResult extends WorkspaceResult {
  content?: any;
}

interface CompareResult extends WorkspaceResult {
  contentA?: any;
  contentB?: any;
}

interface ImageResult extends WorkspaceResult {
  dataUrl?: string | null;
}

interface RecoveryCheckResult extends WorkspaceResult {
  recoveryFiles?: RecoveryFile[];
}

interface StorageStatsResult extends WorkspaceResult {
  stats?: StorageStats;
}

interface GCResult extends WorkspaceResult {
  objectsFreed?: number;
  imagesFreed?: number;
}

interface ConfigResult extends WorkspaceResult {
  config?: WorkspaceConfig;
}

interface ExternalChangeResult extends WorkspaceResult {
  hasChange?: boolean;
}

interface ExternalChangeEvent {
  type: 'change' | 'add' | 'unlink';
  fileKey: string;
  absolutePath: string;
  timestamp: string;
}

// --- Draft Types ---

interface Draft {
  id: string;
  name: string;
  fileKey: string;
  sourceCheckpointId: string;
  headId: string;
  checkpoints: Checkpoint[];
  created: string;
  modified: string;
  status: 'active' | 'merged' | 'archived';
}

interface DraftListItem {
  id: string;
  name: string;
  fileKey: string;
  created: string;
  modified: string;
  status: 'active' | 'merged' | 'archived';
  wordCount: number;
}

interface DraftsResult extends WorkspaceResult {
  drafts?: DraftListItem[];
}

interface DraftResult extends WorkspaceResult {
  draft?: Draft;
}

interface DraftContentResult extends WorkspaceResult {
  content?: any;
}

interface DraftCountResult extends WorkspaceResult {
  count?: number;
}

// --- Import Types ---

type ImportSourceType = 'obsidian' | 'notion' | 'generic';

interface ImportFileInfo {
  sourcePath: string;
  relativePath: string;
  name: string;
  type: 'markdown' | 'attachment' | 'other';
  size: number;
  hasWikiLinks: boolean;
  hasFrontMatter: boolean;
  hasCallouts: boolean;
  hasDataview: boolean;
}

interface ImportAnalysis {
  sourceType: ImportSourceType;
  sourcePath: string;
  totalFiles: number;
  markdownFiles: number;
  attachments: number;
  folders: number;
  wikiLinks: number;
  filesWithWikiLinks: number;
  frontMatter: number;
  callouts: number;
  dataviewBlocks: number;
  untitledPages: string[];
  emptyPages: string[];
  filesToImport: ImportFileInfo[];
}

interface NotionAnalysis extends ImportAnalysis {
  csvDatabases: number;
  filesWithUUIDs: number;
}

interface ImportOptions {
  convertWikiLinks: boolean;
  importFrontMatter: boolean;
  convertCallouts: boolean;
  copyAttachments: boolean;
  preserveFolderStructure: boolean;
  skipEmptyPages: boolean;
  createMidlightFiles: boolean;
}

interface NotionImportOptions extends ImportOptions {
  removeUUIDs: boolean;
  convertCSVToTables: boolean;
  untitledHandling: 'number' | 'keep' | 'prompt';
}

interface ImportProgress {
  phase: 'analyzing' | 'converting' | 'copying' | 'finalizing' | 'complete';
  current: number;
  total: number;
  currentFile: string;
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface ImportError {
  file: string;
  message: string;
}

interface ImportWarning {
  file: string;
  message: string;
  type: 'broken_link' | 'dataview_removed' | 'unsupported_feature';
}

interface ImportResult {
  success: boolean;
  filesImported: number;
  linksConverted: number;
  attachmentsCopied: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface SourceTypeResult extends WorkspaceResult {
  sourceType?: ImportSourceType;
}

interface AnalysisResult extends WorkspaceResult {
  analysis?: ImportAnalysis;
}

interface NotionAnalysisResult extends WorkspaceResult {
  analysis?: NotionAnalysis;
}

interface ImportResultResponse extends WorkspaceResult {
  result?: ImportResult;
}

interface IElectronAPI {
  // Platform info
  platform: 'darwin' | 'win32' | 'linux';

  // Update Windows titlebar overlay colors (for theme changes)
  updateTitleBarOverlay: (colors: { color: string; symbolColor: string }) => Promise<void>;

  selectDirectory: () => Promise<string | null>;
  selectFile: () => Promise<string | null>;
  readDir: (path: string) => Promise<{ name: string; path: string; type: 'file' | 'directory' }[]>;
  readFile: (path: string) => Promise<string>;
  fileExists: (path: string) => Promise<boolean>;
  readImageAsDataUrl: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<string>;

  // --- File Browser Context Menu Operations ---
  fileDuplicate: (path: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  fileTrash: (path: string) => Promise<{ success: boolean; error?: string }>;
  fileRevealInFinder: (path: string) => Promise<{ success: boolean; error?: string }>;
  fileCopyPath: (path: string) => Promise<{ success: boolean; error?: string }>;
  folderCreate: (parentPath: string, name: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  fileCopyTo: (sourcePaths: string[], destDir: string) => Promise<{ success: boolean; results?: { source: string; dest: string; success: boolean }[]; error?: string }>;
  fileMoveTo: (sourcePaths: string[], destDir: string) => Promise<{ success: boolean; results?: { source: string; dest: string; success: boolean }[]; error?: string }>;

  importDocx: () => Promise<{ html: string; filename: string } | null>;
  importDocxFromPath: (filePath: string) => Promise<{ success: boolean; html?: string; filename?: string; error?: string }>;
  exportPdf: () => Promise<boolean | undefined>;
  exportDocx: (content: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;

  // --- Workspace & Versioning APIs ---

  // Initialize workspace (.midlight folder)
  workspaceInit: (workspaceRoot: string) => Promise<WorkspaceResult>;

  // Load document (returns Tiptap JSON + recovery info)
  workspaceLoadDocument: (workspaceRoot: string, filePath: string) => Promise<LoadDocumentResult>;

  // Load from recovery
  workspaceLoadFromRecovery: (workspaceRoot: string, filePath: string) => Promise<LoadDocumentResult>;

  // Discard recovery and load from saved file
  workspaceDiscardRecovery: (workspaceRoot: string, filePath: string) => Promise<LoadDocumentResult>;

  // Save document (Tiptap JSON -> Markdown + Sidecar)
  workspaceSaveDocument: (workspaceRoot: string, filePath: string, json: any, trigger?: string) => Promise<SaveResult>;

  // Get checkpoint history for a file
  workspaceGetCheckpoints: (workspaceRoot: string, filePath: string) => Promise<CheckpointsResult>;

  // Get content of a specific checkpoint
  workspaceGetCheckpointContent: (workspaceRoot: string, filePath: string, checkpointId: string) => Promise<CheckpointContentResult>;

  // Restore a checkpoint
  workspaceRestoreCheckpoint: (workspaceRoot: string, filePath: string, checkpointId: string) => Promise<CheckpointContentResult>;

  // Create a bookmark (named checkpoint)
  workspaceCreateBookmark: (workspaceRoot: string, filePath: string, json: any, label: string) => Promise<SaveResult>;

  // Label an existing checkpoint
  workspaceLabelCheckpoint: (workspaceRoot: string, filePath: string, checkpointId: string, label: string) => Promise<WorkspaceResult>;

  // Compare two checkpoints (for diff view)
  workspaceCompareCheckpoints: (workspaceRoot: string, filePath: string, checkpointIdA: string, checkpointIdB: string) => Promise<CompareResult>;

  // Get image data URL from reference
  workspaceGetImageDataUrl: (workspaceRoot: string, imageRef: string) => Promise<ImageResult>;

  // Check for recovery files on startup
  workspaceCheckForRecovery: (workspaceRoot: string) => Promise<RecoveryCheckResult>;

  // Get storage statistics
  workspaceGetStorageStats: (workspaceRoot: string) => Promise<StorageStatsResult>;

  // Run garbage collection
  workspaceRunGC: (workspaceRoot: string) => Promise<GCResult>;

  // Get workspace configuration
  workspaceGetConfig: (workspaceRoot: string) => Promise<ConfigResult>;

  // Update workspace configuration
  workspaceUpdateConfig: (workspaceRoot: string, updates: Partial<WorkspaceConfig>) => Promise<WorkspaceResult>;

  // Stop file watcher for a workspace
  workspaceStopWatcher: (workspaceRoot: string) => Promise<WorkspaceResult>;

  // Check if a file has external changes
  workspaceHasExternalChange: (workspaceRoot: string, filePath: string) => Promise<ExternalChangeResult>;

  // --- Draft APIs ---

  // Create a new draft from current document state
  workspaceCreateDraft: (workspaceRoot: string, filePath: string, name: string, json: any) => Promise<DraftResult>;

  // Create a new draft from a checkpoint
  workspaceCreateDraftFromCheckpoint: (workspaceRoot: string, filePath: string, name: string, checkpointId: string) => Promise<DraftResult>;

  // Get all drafts for a file
  workspaceGetDrafts: (workspaceRoot: string, filePath: string) => Promise<DraftsResult>;

  // Get all active drafts across all files
  workspaceGetAllActiveDrafts: (workspaceRoot: string) => Promise<DraftsResult>;

  // Get a specific draft
  workspaceGetDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<DraftResult>;

  // Get draft content as Tiptap JSON
  workspaceGetDraftContent: (workspaceRoot: string, filePath: string, draftId: string) => Promise<DraftContentResult>;

  // Save draft content
  workspaceSaveDraftContent: (workspaceRoot: string, filePath: string, draftId: string, json: any, trigger?: string) => Promise<SaveResult>;

  // Rename a draft
  workspaceRenameDraft: (workspaceRoot: string, filePath: string, draftId: string, newName: string) => Promise<WorkspaceResult>;

  // Apply (merge) a draft to the main document
  workspaceApplyDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<DraftContentResult>;

  // Discard a draft (archive without applying)
  workspaceDiscardDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<WorkspaceResult>;

  // Delete a draft permanently
  workspaceDeleteDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<WorkspaceResult>;

  // Count active drafts (for tier enforcement)
  workspaceCountActiveDrafts: (workspaceRoot: string) => Promise<DraftCountResult>;

  // --- Import APIs ---

  // Select folder for import
  importSelectFolder: () => Promise<string | null>;

  // Detect source type (Obsidian, Notion, or generic)
  importDetectSourceType: (folderPath: string) => Promise<SourceTypeResult>;

  // Analyze Obsidian vault
  importAnalyzeObsidian: (vaultPath: string) => Promise<AnalysisResult>;

  // Import from Obsidian vault
  importObsidian: (analysisJson: string, destPath: string, optionsJson: string) => Promise<ImportResultResponse>;

  // Analyze Notion export
  importAnalyzeNotion: (exportPath: string) => Promise<NotionAnalysisResult>;

  // Import from Notion export
  importNotion: (analysisJson: string, destPath: string, optionsJson: string) => Promise<ImportResultResponse>;

  // Cancel active import
  importCancel: () => Promise<{ success: boolean; error?: string }>;

  // --- Auto-Update APIs ---

  // Check for updates manually
  checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>;

  // Download the available update
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;

  // Quit and install the downloaded update
  quitAndInstall: () => void;

  // Get current app version
  getAppVersion: () => Promise<string>;

  // Listeners
  onMenuAction: (callback: (action: string) => void) => () => void;
  onUpdateTheme: (callback: (theme: string) => void) => () => void;
  onDocxExportProgress: (callback: (progress: DocxExportProgress) => void) => () => void;
  onFileChangedExternally: (callback: (event: ExternalChangeEvent) => void) => () => void;
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;

  // Auto-update listeners
  onUpdateAvailable: (callback: (data: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => () => void;
  onUpdateNotAvailable: (callback: (data: { version: string }) => void) => () => void;
  onUpdateDownloadProgress: (callback: (data: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (data: { version: string; releaseNotes?: string }) => void) => () => void;
  onUpdateError: (callback: (data: { message: string }) => void) => () => void;
}

interface Window {
  electronAPI: IElectronAPI;
}
