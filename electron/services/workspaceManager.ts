/**
 * WorkspaceManager - Central coordinator for storage services
 *
 * Manages the .midlight folder structure and coordinates:
 * - ObjectStore (content-addressable storage)
 * - CheckpointManager (version history)
 * - ImageManager (image extraction/deduplication)
 * - RecoveryManager (crash recovery via WAL)
 * - Document serialization/deserialization
 *
 * This is the main entry point for file operations from the Electron main process.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ObjectStore } from './objectStore';
import { CheckpointManager } from './checkpointManager';
import { ImageManager } from './imageManager';
import { RecoveryManager } from './recoveryManager';
import { DraftManager, DraftListItem } from './draftManager';
import { DocumentSerializer } from './documentSerializer';
import { DocumentDeserializer } from './documentDeserializer';
import {
  SidecarDocument,
  WorkspaceConfig,
  DEFAULT_WORKSPACE_CONFIG,
  RecoveryFile,
  Checkpoint,
  Draft,
  createEmptySidecar,
} from './types';

// Tiptap JSON types (for interface)
interface TiptapDocument {
  type: 'doc';
  content: any[];
}

export interface LoadedDocument {
  json: TiptapDocument;
  sidecar: SidecarDocument;
  hasRecovery: boolean;
  recoveryTime?: Date;
}

export interface SaveResult {
  success: boolean;
  checkpointCreated?: Checkpoint;
  error?: string;
}

export class WorkspaceManager {
  private workspaceRoot: string;
  private midlightDir: string;

  // Services
  private objectStore: ObjectStore;
  private checkpointManager: CheckpointManager;
  private imageManager: ImageManager;
  private recoveryManager: RecoveryManager;
  private draftManager: DraftManager;
  private serializer: DocumentSerializer;
  private deserializer: DocumentDeserializer;

  // State
  private config: WorkspaceConfig = DEFAULT_WORKSPACE_CONFIG;
  private initialized: boolean = false;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.midlightDir = path.join(workspaceRoot, '.midlight');

    // Initialize services
    this.objectStore = new ObjectStore(workspaceRoot);
    this.checkpointManager = new CheckpointManager(workspaceRoot, this.objectStore);
    this.imageManager = new ImageManager(workspaceRoot);
    this.recoveryManager = new RecoveryManager(workspaceRoot);
    this.draftManager = new DraftManager(workspaceRoot, this.objectStore);
    this.serializer = new DocumentSerializer(this.imageManager);
    this.deserializer = new DocumentDeserializer(this.imageManager);
  }

  /**
   * Initialize the workspace (.midlight folder and all services).
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Create .midlight directory structure
    await fs.mkdir(this.midlightDir, { recursive: true });

    // Initialize all services
    await Promise.all([
      this.objectStore.init(),
      this.checkpointManager.init(),
      this.imageManager.init(),
      this.recoveryManager.init(),
      this.draftManager.init(),
    ]);

    // Load or create workspace config
    await this.loadConfig();

    this.initialized = true;
  }

  /**
   * Check if workspace has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get workspace root path.
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  // ============================================================================
  // Document Operations
  // ============================================================================

  /**
   * Load a document from the file system.
   * Returns Tiptap JSON for the editor, with recovery option if available.
   */
  async loadDocument(filePath: string): Promise<LoadedDocument> {
    await this.ensureInitialized();

    const fileKey = this.getFileKey(filePath);

    // Check for recovery
    const hasRecovery = await this.recoveryManager.hasRecovery(fileKey);
    let recoveryTime: Date | undefined;

    if (hasRecovery) {
      const recoveryFiles = await this.recoveryManager.checkForRecovery();
      const recoveryFile = recoveryFiles.find(r => r.fileKey === fileKey);
      recoveryTime = recoveryFile?.walTime;
    }

    // Load markdown file
    let markdown = '';
    try {
      markdown = await fs.readFile(filePath, 'utf8');
    } catch {
      // New file - empty content
    }

    // Load sidecar if exists
    const sidecar = await this.loadSidecar(filePath);

    // Deserialize to Tiptap JSON
    const json = await this.deserializer.deserialize(markdown, sidecar);

    return {
      json,
      sidecar,
      hasRecovery,
      recoveryTime,
    };
  }

  /**
   * Load document from recovery (user chose to recover).
   */
  async loadFromRecovery(filePath: string): Promise<LoadedDocument | null> {
    await this.ensureInitialized();

    const fileKey = this.getFileKey(filePath);
    const recoveryContent = await this.recoveryManager.applyRecovery(fileKey);

    if (!recoveryContent) {
      return null;
    }

    // Recovery content is the serialized markdown
    const sidecar = await this.loadSidecar(filePath);
    const json = await this.deserializer.deserialize(recoveryContent, sidecar);

    return {
      json,
      sidecar,
      hasRecovery: true,
    };
  }

  /**
   * Discard recovery and load from saved file.
   */
  async discardRecovery(filePath: string): Promise<LoadedDocument> {
    await this.ensureInitialized();

    const fileKey = this.getFileKey(filePath);
    await this.recoveryManager.discardRecovery(fileKey);

    return this.loadDocument(filePath);
  }

  /**
   * Save a document (Tiptap JSON -> Markdown + Sidecar).
   * Creates checkpoints based on configuration.
   */
  async saveDocument(
    filePath: string,
    json: TiptapDocument,
    trigger: 'auto' | 'manual' | 'close' = 'auto'
  ): Promise<SaveResult> {
    await this.ensureInitialized();

    const fileKey = this.getFileKey(filePath);

    try {
      // Load existing sidecar to preserve metadata
      const existingSidecar = await this.loadSidecar(filePath);

      // Serialize to Markdown + Sidecar
      const { markdown, sidecar } = await this.serializer.serialize(json, existingSidecar);

      // Write markdown file
      await fs.writeFile(filePath, markdown, 'utf8');

      // Write sidecar file
      await this.saveSidecar(filePath, sidecar);

      // Clear WAL after successful save
      await this.recoveryManager.clearWAL(fileKey);

      // Maybe create checkpoint
      let checkpointCreated: Checkpoint | null = null;
      const checkpointTrigger = trigger === 'close' ? 'file_close' : 'interval';

      checkpointCreated = await this.checkpointManager.maybeCreateCheckpoint(
        fileKey,
        markdown,
        sidecar,
        checkpointTrigger
      );

      return {
        success: true,
        checkpointCreated: checkpointCreated || undefined,
      };
    } catch (error) {
      console.error(`Failed to save document: ${filePath}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Start WAL (Write-Ahead Log) for crash recovery.
   * Should be called when a file is opened for editing.
   */
  startRecovery(filePath: string, getContent: () => string): void {
    const fileKey = this.getFileKey(filePath);
    this.recoveryManager.startWAL(fileKey, getContent);
  }

  /**
   * Stop WAL for a file.
   * Should be called when a file is closed.
   */
  stopRecovery(filePath: string): void {
    const fileKey = this.getFileKey(filePath);
    this.recoveryManager.stopWAL(fileKey);
  }

  /**
   * Stop all WAL timers (call on app quit).
   */
  stopAllRecovery(): void {
    this.recoveryManager.stopAllWAL();
  }

  // ============================================================================
  // Checkpoint Operations
  // ============================================================================

  /**
   * Get checkpoint history for a file.
   */
  async getCheckpoints(filePath: string): Promise<Checkpoint[]> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.checkpointManager.getCheckpoints(fileKey);
  }

  /**
   * Get content of a specific checkpoint.
   */
  async getCheckpointContent(
    filePath: string,
    checkpointId: string
  ): Promise<TiptapDocument | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    const content = await this.checkpointManager.getCheckpointContent(fileKey, checkpointId);

    if (!content) return null;

    // Deserialize checkpoint content to Tiptap JSON
    return this.deserializer.deserialize(content.markdown, content.sidecar);
  }

  /**
   * Restore a checkpoint (makes it the current version).
   */
  async restoreCheckpoint(filePath: string, checkpointId: string): Promise<TiptapDocument | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    const content = await this.checkpointManager.restoreCheckpoint(fileKey, checkpointId);

    if (!content) return null;

    // Write restored content to file
    await fs.writeFile(filePath, content.markdown, 'utf8');
    await this.saveSidecar(filePath, content.sidecar);

    // Deserialize for editor
    return this.deserializer.deserialize(content.markdown, content.sidecar);
  }

  /**
   * Create a bookmark (named checkpoint).
   */
  async createBookmark(
    filePath: string,
    json: TiptapDocument,
    label: string
  ): Promise<Checkpoint | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);

    const existingSidecar = await this.loadSidecar(filePath);
    const { markdown, sidecar } = await this.serializer.serialize(json, existingSidecar);

    return this.checkpointManager.maybeCreateCheckpoint(
      fileKey,
      markdown,
      sidecar,
      'bookmark',
      label
    );
  }

  /**
   * Label an existing checkpoint as a bookmark.
   */
  async labelCheckpoint(filePath: string, checkpointId: string, label: string): Promise<boolean> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.checkpointManager.labelCheckpoint(fileKey, checkpointId, label);
  }

  /**
   * Compare two checkpoints (for diff view).
   */
  async compareCheckpoints(
    filePath: string,
    checkpointIdA: string,
    checkpointIdB: string
  ): Promise<{ contentA: TiptapDocument; contentB: TiptapDocument } | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    const comparison = await this.checkpointManager.compareCheckpoints(
      fileKey,
      checkpointIdA,
      checkpointIdB
    );

    if (!comparison) return null;

    const [contentA, contentB] = await Promise.all([
      this.deserializer.deserialize(comparison.contentA, comparison.sidecarA),
      this.deserializer.deserialize(comparison.contentB, comparison.sidecarB),
    ]);

    return { contentA, contentB };
  }

  // ============================================================================
  // Draft Operations
  // ============================================================================

  /**
   * Create a new draft from a checkpoint.
   */
  async createDraft(
    filePath: string,
    name: string,
    sourceCheckpointId: string
  ): Promise<Draft | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);

    // Get checkpoint content
    const content = await this.checkpointManager.getCheckpointContent(fileKey, sourceCheckpointId);
    if (!content) return null;

    return this.draftManager.createDraft(fileKey, name, sourceCheckpointId, content);
  }

  /**
   * Create a new draft from current document state.
   */
  async createDraftFromCurrent(
    filePath: string,
    name: string,
    json: TiptapDocument
  ): Promise<Draft | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);

    // Get current head checkpoint ID
    const headId = await this.checkpointManager.getHeadId(fileKey);

    // Serialize current state
    const existingSidecar = await this.loadSidecar(filePath);
    const { markdown, sidecar } = await this.serializer.serialize(json, existingSidecar);

    // Create draft
    return this.draftManager.createDraft(
      fileKey,
      name,
      headId || 'current',
      { markdown, sidecar }
    );
  }

  /**
   * Get all drafts for a file.
   */
  async getDrafts(filePath: string): Promise<DraftListItem[]> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.draftManager.getDrafts(fileKey);
  }

  /**
   * Get all active drafts across all files.
   */
  async getAllActiveDrafts(): Promise<DraftListItem[]> {
    await this.ensureInitialized();
    return this.draftManager.getAllActiveDrafts();
  }

  /**
   * Get a specific draft.
   */
  async getDraft(filePath: string, draftId: string): Promise<Draft | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.draftManager.getDraft(fileKey, draftId);
  }

  /**
   * Get current content of a draft as Tiptap JSON.
   */
  async getDraftContent(filePath: string, draftId: string): Promise<TiptapDocument | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    const content = await this.draftManager.getDraftContent(fileKey, draftId);

    if (!content) return null;

    return this.deserializer.deserialize(content.markdown, content.sidecar);
  }

  /**
   * Save content to a draft.
   */
  async saveDraftContent(
    filePath: string,
    draftId: string,
    json: TiptapDocument,
    trigger: string = 'auto'
  ): Promise<Checkpoint | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);

    // Serialize to markdown + sidecar
    const existingSidecar = await this.loadSidecar(filePath);
    const { markdown, sidecar } = await this.serializer.serialize(json, existingSidecar);

    return this.draftManager.saveDraftContent(fileKey, draftId, { markdown, sidecar }, trigger);
  }

  /**
   * Rename a draft.
   */
  async renameDraft(filePath: string, draftId: string, newName: string): Promise<boolean> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.draftManager.renameDraft(fileKey, draftId, newName);
  }

  /**
   * Apply (merge) a draft to the main document.
   * Returns the Tiptap JSON content to be applied.
   */
  async applyDraft(filePath: string, draftId: string): Promise<TiptapDocument | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);

    const content = await this.draftManager.applyDraft(fileKey, draftId);
    if (!content) return null;

    // Write to main file
    await fs.writeFile(filePath, content.markdown, 'utf8');
    await this.saveSidecar(filePath, content.sidecar);

    // Create a checkpoint marking the merge
    await this.checkpointManager.createCheckpoint(
      fileKey,
      content.markdown,
      content.sidecar,
      'draft_apply',
      `Applied draft`
    );

    return this.deserializer.deserialize(content.markdown, content.sidecar);
  }

  /**
   * Discard a draft without applying it.
   */
  async discardDraft(filePath: string, draftId: string): Promise<boolean> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.draftManager.discardDraft(fileKey, draftId);
  }

  /**
   * Permanently delete a draft.
   */
  async deleteDraft(filePath: string, draftId: string): Promise<boolean> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.draftManager.deleteDraft(fileKey, draftId);
  }

  /**
   * Get checkpoints for a draft.
   */
  async getDraftCheckpoints(filePath: string, draftId: string): Promise<Checkpoint[]> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);
    return this.draftManager.getDraftCheckpoints(fileKey, draftId);
  }

  /**
   * Restore draft to a specific checkpoint.
   */
  async restoreDraftCheckpoint(
    filePath: string,
    draftId: string,
    checkpointId: string
  ): Promise<TiptapDocument | null> {
    await this.ensureInitialized();
    const fileKey = this.getFileKey(filePath);

    const content = await this.draftManager.restoreDraftCheckpoint(fileKey, draftId, checkpointId);
    if (!content) return null;

    return this.deserializer.deserialize(content.markdown, content.sidecar);
  }

  /**
   * Count active drafts (for tier enforcement).
   */
  async countActiveDrafts(): Promise<number> {
    await this.ensureInitialized();
    return this.draftManager.countActiveDrafts();
  }

  // ============================================================================
  // Image Operations
  // ============================================================================

  /**
   * Store a base64 image and return its reference.
   */
  async storeImage(base64DataUrl: string, originalName?: string): Promise<string> {
    await this.ensureInitialized();
    const result = await this.imageManager.storeImage(base64DataUrl, originalName);
    return result.ref;
  }

  /**
   * Get image as base64 data URL from reference.
   */
  async getImageDataUrl(ref: string): Promise<string | null> {
    await this.ensureInitialized();
    return this.imageManager.getImageDataUrl(ref);
  }

  /**
   * Get image buffer (for DOCX export).
   */
  async getImageBuffer(ref: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    await this.ensureInitialized();
    return this.imageManager.getImageBuffer(ref);
  }

  // ============================================================================
  // Maintenance Operations
  // ============================================================================

  /**
   * Run garbage collection on object store and images.
   * Removes unreferenced content to free storage.
   */
  async runGC(): Promise<{ objectsFreed: number; imagesFreed: number }> {
    await this.ensureInitialized();

    // Get all referenced hashes from checkpoints and drafts
    const [checkpointHashes, draftHashes] = await Promise.all([
      this.checkpointManager.getAllReferencedHashes(),
      this.draftManager.getAllReferencedHashes(),
    ]);

    // Merge hash sets
    const referencedHashes = new Set([...checkpointHashes, ...draftHashes]);

    // Get all image references from sidecars
    const referencedImages = await this.getAllImageRefs();

    // Run GC
    const [objectsFreed, imagesFreed] = await Promise.all([
      this.objectStore.gc(referencedHashes),
      this.imageManager.gc(referencedImages),
    ]);

    return { objectsFreed, imagesFreed };
  }

  /**
   * Get storage statistics.
   */
  async getStorageStats(): Promise<{
    objectStoreSize: number;
    objectCount: number;
    imageStoreSize: number;
    imageCount: number;
  }> {
    await this.ensureInitialized();

    const [objectStoreSize, objectCount, imageStoreSize, imageCount] = await Promise.all([
      this.objectStore.getStorageSize(),
      this.objectStore.getObjectCount(),
      this.imageManager.getStorageSize(),
      this.imageManager.getImageCount(),
    ]);

    return { objectStoreSize, objectCount, imageStoreSize, imageCount };
  }

  /**
   * Check for any files that need recovery on startup.
   */
  async checkForRecovery(): Promise<RecoveryFile[]> {
    await this.ensureInitialized();
    return this.recoveryManager.checkForRecovery();
  }

  // ============================================================================
  // Config Operations
  // ============================================================================

  /**
   * Get workspace configuration.
   */
  getConfig(): WorkspaceConfig {
    return { ...this.config };
  }

  /**
   * Update workspace configuration.
   */
  async updateConfig(updates: Partial<WorkspaceConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();

    // Update checkpoint manager with new versioning config
    if (updates.versioning) {
      this.checkpointManager.updateConfig(updates.versioning);
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Get file key (relative path from workspace root).
   */
  private getFileKey(filePath: string): string {
    return path.relative(this.workspaceRoot, filePath);
  }

  /**
   * Get sidecar file path for a document.
   */
  private getSidecarPath(filePath: string): string {
    const fileKey = this.getFileKey(filePath);
    const safeName = fileKey.replace(/[\\/]/g, '_').replace('.md', '');
    return path.join(this.midlightDir, 'sidecars', `${safeName}.json`);
  }

  /**
   * Load sidecar for a document.
   */
  private async loadSidecar(filePath: string): Promise<SidecarDocument> {
    const sidecarPath = this.getSidecarPath(filePath);

    try {
      const data = await fs.readFile(sidecarPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return createEmptySidecar();
    }
  }

  /**
   * Save sidecar for a document.
   */
  private async saveSidecar(filePath: string, sidecar: SidecarDocument): Promise<void> {
    const sidecarPath = this.getSidecarPath(filePath);
    const sidecarDir = path.dirname(sidecarPath);

    await fs.mkdir(sidecarDir, { recursive: true });
    await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2));
  }

  /**
   * Load workspace configuration.
   */
  private async loadConfig(): Promise<void> {
    const configPath = path.join(this.midlightDir, 'config.json');

    try {
      const data = await fs.readFile(configPath, 'utf8');
      this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...JSON.parse(data) };
    } catch {
      // Use defaults and save
      this.config = { ...DEFAULT_WORKSPACE_CONFIG };
      await this.saveConfig();
    }
  }

  /**
   * Save workspace configuration.
   */
  private async saveConfig(): Promise<void> {
    const configPath = path.join(this.midlightDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get all image references from all sidecars.
   */
  private async getAllImageRefs(): Promise<Set<string>> {
    const refs = new Set<string>();
    const sidecarsDir = path.join(this.midlightDir, 'sidecars');

    try {
      const files = await fs.readdir(sidecarsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const data = await fs.readFile(path.join(sidecarsDir, file), 'utf8');
          const sidecar: SidecarDocument = JSON.parse(data);

          for (const ref of Object.keys(sidecar.images || {})) {
            refs.add(ref);
          }
        } catch {
          // Skip invalid sidecars
        }
      }
    } catch {
      // Sidecars directory might not exist
    }

    return refs;
  }
}

// Singleton instance per workspace
const workspaceManagers = new Map<string, WorkspaceManager>();

/**
 * Get or create a WorkspaceManager for a given workspace root.
 */
export function getWorkspaceManager(workspaceRoot: string): WorkspaceManager {
  let manager = workspaceManagers.get(workspaceRoot);

  if (!manager) {
    manager = new WorkspaceManager(workspaceRoot);
    workspaceManagers.set(workspaceRoot, manager);
  }

  return manager;
}

/**
 * Clear all workspace managers (for testing or cleanup).
 */
export function clearWorkspaceManagers(): void {
  for (const manager of workspaceManagers.values()) {
    manager.stopAllRecovery();
  }
  workspaceManagers.clear();
}
