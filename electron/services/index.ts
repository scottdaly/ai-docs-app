/**
 * Storage Services - Central exports
 *
 * This module provides all the storage and versioning services for Midlight.
 */

// Core services
export { ObjectStore } from './objectStore';
export { CheckpointManager } from './checkpointManager';
export { ImageManager } from './imageManager';
export type { ImageStoreResult } from './imageManager';
export { RecoveryManager } from './recoveryManager';
export { FileWatcher } from './fileWatcher';
export type { FileChangeEvent, FileWatcherConfig } from './fileWatcher';
// Document serialization
export { DocumentSerializer } from './documentSerializer';
export type { SerializedDocument } from './documentSerializer';
export { DocumentDeserializer } from './documentDeserializer';

// Workspace management
export {
  WorkspaceManager,
  getWorkspaceManager,
  clearWorkspaceManagers,
} from './workspaceManager';
export type { LoadedDocument, SaveResult } from './workspaceManager';

// Types
export type {
  // Checkpoint types
  Checkpoint,
  CheckpointHistory,
  CheckpointContent,

  // Sidecar document types
  SidecarDocument,
  DocumentMeta,
  DocumentSettings,
  BlockFormatting,
  SpanFormatting,
  SpanMark,
  ImageInfo,

  // Configuration types
  WorkspaceConfig,
  VersioningConfig,
  TierConfig,
  RecoveryFile,
} from './types';

// Tier presets and defaults (values, not types)
export {
  FREE_TIER,
  PRO_TIER,
  DEFAULT_VERSIONING_CONFIG,
  DEFAULT_WORKSPACE_CONFIG,
  createEmptySidecar,
} from './types';

// Import service
export {
  detectSourceType,
  analyzeObsidianVault,
  importObsidianVault,
  convertWikiLinks,
  convertCallouts,
  removeDataview,
  parseFrontMatter,
  buildFileMap,
  // Security utilities
  sanitizeRelativePath,
  isPathSafe,
  validatePath,
  // Notion import
  analyzeNotionExport,
  importNotionExport,
  stripNotionUUID,
  hasNotionUUID,
  buildNotionFilenameMap,
  csvToMarkdownTable,
  rebuildNotionLinks,
} from './importService';

export type {
  ImportSourceType,
  ImportAnalysis,
  ImportFileInfo,
  ImportOptions,
  ImportProgress,
  ImportError,
  ImportWarning,
  ImportResult,
  // Notion types
  NotionAnalysis,
  NotionImportOptions,
} from './importService';

// Agent executor
export {
  AgentExecutor,
  AGENT_TOOLS,
  DESTRUCTIVE_TOOLS,
  READ_ONLY_TOOLS,
  isDestructiveTool,
  isReadOnlyTool,
} from './agentExecutor';

export type { ToolCall, ToolResult, DocumentChange } from './agentExecutor';
