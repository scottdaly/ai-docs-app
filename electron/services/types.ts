/**
 * Shared types for the versioning and storage system
 */

// ============================================================================
// Checkpoint Types
// ============================================================================

export interface Checkpoint {
  /** Unique checkpoint ID (e.g., "cp-a1b2c3") */
  id: string;

  /** Hash of markdown content in object store */
  contentHash: string;

  /** Hash of sidecar JSON in object store */
  sidecarHash: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Previous checkpoint ID (null for first checkpoint) */
  parentId: string | null;

  /** How this checkpoint was created */
  type: 'auto' | 'bookmark';

  /** User-provided name (for bookmarks) */
  label?: string;

  /** User-provided description (for bookmarks) */
  description?: string;

  /** Document statistics at this checkpoint */
  stats: {
    wordCount: number;
    charCount: number;
    /** Characters changed from parent */
    changeSize: number;
  };

  /** What triggered this checkpoint */
  trigger: string;
}

export interface CheckpointHistory {
  /** Relative path from workspace root (e.g., "My Essay.md") */
  fileKey: string;

  /** ID of current/latest checkpoint */
  headId: string;

  /** All checkpoints for this file */
  checkpoints: Checkpoint[];
}

export interface CheckpointContent {
  markdown: string;
  sidecar: SidecarDocument;
}

// ============================================================================
// Sidecar Document Types
// ============================================================================

export interface SidecarDocument {
  /** Schema version */
  version: 1;

  /** Document metadata */
  meta: DocumentMeta;

  /** Document-level settings */
  document: DocumentSettings;

  /** Block-level formatting (keyed by block ID) */
  blocks: Record<string, BlockFormatting>;

  /** Inline span formatting (keyed by block ID) */
  spans: Record<string, SpanFormatting[]>;

  /** Image references (keyed by image ID) */
  images: Record<string, ImageInfo>;
}

export interface DocumentMeta {
  /** ISO 8601 creation timestamp */
  created: string;

  /** ISO 8601 last modified timestamp */
  modified: string;

  /** Document title (from first heading or filename) */
  title?: string;

  /** Document author */
  author?: string;

  /** Tags/categories */
  tags?: string[];

  /** Word count */
  wordCount?: number;

  /** Estimated reading time in minutes */
  readingTime?: number;

  /** Migration info if migrated from old format */
  migratedFrom?: string;
}

export interface DocumentSettings {
  /** Default font family */
  defaultFont?: string;

  /** Default font size (e.g., "16px") */
  defaultFontSize?: string;

  /** Default text color (e.g., "#1a1a1a") */
  defaultColor?: string;

  /** Line height multiplier (e.g., 1.6) */
  lineHeight?: number;

  /** Paragraph spacing (e.g., "1em") */
  paragraphSpacing?: string;

  /** Page size for export */
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'Custom';

  /** Page margins for export */
  pageMargins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
}

export interface BlockFormatting {
  /** Text alignment */
  align?: 'left' | 'center' | 'right' | 'justify';

  /** First line indent (e.g., "1em") */
  firstLineIndent?: string;

  /** Spacing before/after */
  spacing?: {
    before?: string;
    after?: string;
  };

  /** For headings: override font size */
  fontSize?: string;

  /** For headings: override font family */
  fontFamily?: string;
}

export interface SpanFormatting {
  /** Start character offset within block */
  start: number;

  /** End character offset within block */
  end: number;

  /** Formatting marks to apply */
  marks: SpanMark[];
}

export type SpanMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'color'; value: string }
  | { type: 'highlight'; value: string }
  | { type: 'fontSize'; value: string }
  | { type: 'fontFamily'; value: string }
  | { type: 'link'; href: string; title?: string }
  | { type: 'superscript' }
  | { type: 'subscript' };

export interface ImageInfo {
  /** Filename in .midlight/images/ */
  file: string;

  /** Original filename when imported */
  originalName?: string;

  /** Image width in pixels */
  width?: number;

  /** Image height in pixels */
  height?: number;

  /** File size in bytes */
  size: number;

  /** MIME type */
  mimeType: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface EditorConfig {
  /** Enable browser spellcheck */
  spellcheck: boolean;

  /** Show word count in status bar */
  showWordCount: boolean;

  /** Show character count in status bar */
  showCharCount: boolean;

  /** Auto-save debounce interval in ms */
  autoSaveIntervalMs: number;
}

export interface WorkspaceConfig {
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

  versioning: VersioningConfig;

  recovery: {
    enabled: boolean;
    walIntervalMs: number;
  };

  sync: {
    enabled: boolean;
    lastSync: string | null;
  };
}

export interface VersioningConfig {
  enabled: boolean;

  /** Minimum time between auto checkpoints (ms) */
  checkpointIntervalMs: number;

  /** Minimum character changes to trigger checkpoint */
  minChangeChars: number;

  /** Maximum auto checkpoints per file */
  maxCheckpointsPerFile: number;

  /** Days to retain auto checkpoints */
  retentionDays: number;
}

export interface TierConfig {
  versioning: {
    maxCheckpointsPerFile: number;
    retentionDays: number;
    maxVersions: number;
  };

  sync: {
    enabled: boolean;
  };

  ai: {
    versionFeaturesEnabled: boolean;
  };
}

// ============================================================================
// Recovery Types
// ============================================================================

export interface RecoveryFile {
  fileKey: string;
  walContent: string;
  walTime: Date;
}

// ============================================================================
// Tier Presets
// ============================================================================

export const FREE_TIER: TierConfig = {
  versioning: {
    maxCheckpointsPerFile: 50,
    retentionDays: 7,
    maxVersions: 10,
  },
  sync: {
    enabled: false,
  },
  ai: {
    versionFeaturesEnabled: false,
  },
};

export const PRO_TIER: TierConfig = {
  versioning: {
    maxCheckpointsPerFile: Infinity,
    retentionDays: 365,
    maxVersions: Infinity,
  },
  sync: {
    enabled: true,
  },
  ai: {
    versionFeaturesEnabled: true,
  },
};

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_VERSIONING_CONFIG: VersioningConfig = {
  enabled: true,
  checkpointIntervalMs: 5 * 60 * 1000, // 5 minutes
  minChangeChars: 50,
  maxCheckpointsPerFile: 50,
  retentionDays: 7,
};

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  spellcheck: true,
  showWordCount: true,
  showCharCount: false,
  autoSaveIntervalMs: 1000,
};

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  version: 1,
  workspace: {
    created: new Date().toISOString(),
  },
  defaults: {
    font: 'Merriweather',
    fontSize: '16px',
    lineHeight: 1.6,
  },
  editor: DEFAULT_EDITOR_CONFIG,
  versioning: DEFAULT_VERSIONING_CONFIG,
  recovery: {
    enabled: true,
    walIntervalMs: 500,
  },
  sync: {
    enabled: false,
    lastSync: null,
  },
};

export function createEmptySidecar(): SidecarDocument {
  return {
    version: 1,
    meta: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    },
    document: {},
    blocks: {},
    spans: {},
    images: {},
  };
}
