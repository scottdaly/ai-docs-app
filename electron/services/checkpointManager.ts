/**
 * CheckpointManager - Version History Management
 *
 * Automatically saves document snapshots (checkpoints) that users can:
 * - Browse in a history panel
 * - Compare with diff view
 * - Restore to previous versions
 * - Bookmark important versions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ObjectStore } from './objectStore';
import {
  Checkpoint,
  CheckpointHistory,
  CheckpointContent,
  SidecarDocument,
  VersioningConfig,
  DEFAULT_VERSIONING_CONFIG,
} from './types';

export class CheckpointManager {
  private objectStore: ObjectStore;
  private checkpointsDir: string;
  private config: VersioningConfig;
  private lastCheckpoint: Map<string, { time: number; contentHash: string }> = new Map();

  constructor(
    workspaceRoot: string,
    objectStore: ObjectStore,
    config: Partial<VersioningConfig> = {}
  ) {
    this.objectStore = objectStore;
    this.checkpointsDir = path.join(workspaceRoot, '.midlight', 'checkpoints');
    this.config = { ...DEFAULT_VERSIONING_CONFIG, ...config };
  }

  /**
   * Initialize the checkpoints directory.
   */
  async init(): Promise<void> {
    await fs.mkdir(this.checkpointsDir, { recursive: true });
  }

  /**
   * Update configuration (e.g., when tier changes).
   */
  updateConfig(config: Partial<VersioningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Attempt to create a checkpoint.
   * Returns null if skipped (too soon, no changes, etc.)
   */
  async maybeCreateCheckpoint(
    fileKey: string,
    markdown: string,
    sidecar: SidecarDocument,
    trigger: 'interval' | 'significant_change' | 'file_close' | 'file_open' | 'bookmark',
    label?: string
  ): Promise<Checkpoint | null> {
    if (!this.config.enabled && trigger !== 'bookmark') {
      return null;
    }

    const now = Date.now();
    const last = this.lastCheckpoint.get(fileKey);

    // Calculate hashes
    const contentHash = this.objectStore.hash(markdown);
    const sidecarJson = JSON.stringify(sidecar);
    const sidecarHash = this.objectStore.hash(sidecarJson);

    // Skip if content unchanged (unless it's a bookmark with a new label)
    if (last && last.contentHash === contentHash && trigger !== 'bookmark') {
      return null;
    }

    // Check interval (bookmarks always allowed)
    if (trigger !== 'bookmark' && trigger !== 'file_open' && last) {
      if (now - last.time < this.config.checkpointIntervalMs) {
        return null;
      }
    }

    // Check minimum changes (bookmarks and file_open always allowed)
    if (trigger !== 'bookmark' && trigger !== 'file_open' && last) {
      try {
        const lastContent = await this.objectStore.read(last.contentHash);
        const changeSize = Math.abs(markdown.length - lastContent.length);
        if (changeSize < this.config.minChangeChars) {
          return null;
        }
      } catch {
        // If we can't read the last content, allow the checkpoint
      }
    }

    // Store content in object store
    await this.objectStore.write(markdown);
    await this.objectStore.write(sidecarJson);

    // Load existing history
    const history = await this.loadHistory(fileKey);

    // Calculate stats
    const wordCount = markdown.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = markdown.length;
    let changeSize = charCount;

    if (history.headId) {
      const parentCheckpoint = history.checkpoints.find(c => c.id === history.headId);
      if (parentCheckpoint) {
        changeSize = Math.abs(charCount - parentCheckpoint.stats.charCount);
      }
    }

    // Create checkpoint
    const checkpoint: Checkpoint = {
      id: this.generateId(),
      contentHash,
      sidecarHash,
      timestamp: new Date().toISOString(),
      parentId: history.headId || null,
      type: trigger === 'bookmark' ? 'bookmark' : 'auto',
      label,
      stats: { wordCount, charCount, changeSize },
      trigger,
    };

    // Add to history
    history.checkpoints.push(checkpoint);
    history.headId = checkpoint.id;

    // Enforce retention limits
    this.enforceRetention(history);

    // Save history
    await this.saveHistory(fileKey, history);

    // Update tracking
    this.lastCheckpoint.set(fileKey, { time: now, contentHash });

    return checkpoint;
  }

  /**
   * Force create a checkpoint (used for bookmarks, restores, etc.)
   */
  async createCheckpoint(
    fileKey: string,
    markdown: string,
    sidecar: SidecarDocument,
    trigger: string,
    label?: string
  ): Promise<Checkpoint> {
    const contentHash = this.objectStore.hash(markdown);
    const sidecarJson = JSON.stringify(sidecar);
    const sidecarHash = this.objectStore.hash(sidecarJson);

    // Store content
    await this.objectStore.write(markdown);
    await this.objectStore.write(sidecarJson);

    // Load history
    const history = await this.loadHistory(fileKey);

    // Calculate stats
    const wordCount = markdown.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = markdown.length;
    let changeSize = charCount;

    if (history.headId) {
      const parent = history.checkpoints.find(c => c.id === history.headId);
      if (parent) {
        changeSize = Math.abs(charCount - parent.stats.charCount);
      }
    }

    // Create checkpoint
    const checkpoint: Checkpoint = {
      id: this.generateId(),
      contentHash,
      sidecarHash,
      timestamp: new Date().toISOString(),
      parentId: history.headId || null,
      type: label ? 'bookmark' : 'auto',
      label,
      stats: { wordCount, charCount, changeSize },
      trigger,
    };

    // Add to history
    history.checkpoints.push(checkpoint);
    history.headId = checkpoint.id;

    // Enforce retention
    this.enforceRetention(history);

    // Save
    await this.saveHistory(fileKey, history);

    // Update tracking
    this.lastCheckpoint.set(fileKey, { time: Date.now(), contentHash });

    return checkpoint;
  }

  /**
   * Get list of checkpoints for a file (newest first).
   */
  async getCheckpoints(fileKey: string): Promise<Checkpoint[]> {
    const history = await this.loadHistory(fileKey);
    return history.checkpoints.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get the current head checkpoint ID for a file.
   */
  async getHeadId(fileKey: string): Promise<string | null> {
    const history = await this.loadHistory(fileKey);
    return history.headId || null;
  }

  /**
   * Get content of a specific checkpoint.
   */
  async getCheckpointContent(
    fileKey: string,
    checkpointId: string
  ): Promise<CheckpointContent | null> {
    const history = await this.loadHistory(fileKey);
    const checkpoint = history.checkpoints.find(c => c.id === checkpointId);

    if (!checkpoint) return null;

    try {
      const markdown = await this.objectStore.read(checkpoint.contentHash);
      const sidecarJson = await this.objectStore.read(checkpoint.sidecarHash);
      const sidecar = JSON.parse(sidecarJson) as SidecarDocument;

      return { markdown, sidecar };
    } catch (error) {
      console.error(`Failed to read checkpoint content: ${checkpointId}`, error);
      return null;
    }
  }

  /**
   * Restore a checkpoint.
   * Creates a new checkpoint marking the restore, then returns the content.
   */
  async restoreCheckpoint(
    fileKey: string,
    checkpointId: string
  ): Promise<CheckpointContent | null> {
    const content = await this.getCheckpointContent(fileKey, checkpointId);
    if (!content) return null;

    // Find the checkpoint being restored for the label
    const history = await this.loadHistory(fileKey);
    const sourceCheckpoint = history.checkpoints.find(c => c.id === checkpointId);
    const sourceLabel = sourceCheckpoint?.label || this.formatTimestamp(sourceCheckpoint?.timestamp);

    // Create a new checkpoint marking the restore
    await this.createCheckpoint(
      fileKey,
      content.markdown,
      content.sidecar,
      'restore',
      `Restored from: ${sourceLabel}`
    );

    return content;
  }

  /**
   * Label a checkpoint (convert to bookmark).
   */
  async labelCheckpoint(
    fileKey: string,
    checkpointId: string,
    label: string
  ): Promise<boolean> {
    const history = await this.loadHistory(fileKey);
    const checkpoint = history.checkpoints.find(c => c.id === checkpointId);

    if (!checkpoint) return false;

    checkpoint.type = 'bookmark';
    checkpoint.label = label;

    await this.saveHistory(fileKey, history);
    return true;
  }

  /**
   * Remove label from a checkpoint (convert back to auto).
   */
  async unlabelCheckpoint(fileKey: string, checkpointId: string): Promise<boolean> {
    const history = await this.loadHistory(fileKey);
    const checkpoint = history.checkpoints.find(c => c.id === checkpointId);

    if (!checkpoint) return false;

    checkpoint.type = 'auto';
    delete checkpoint.label;

    await this.saveHistory(fileKey, history);
    return true;
  }

  /**
   * Delete a specific checkpoint.
   * Note: The content in object store is not deleted (gc handles orphans).
   */
  async deleteCheckpoint(fileKey: string, checkpointId: string): Promise<boolean> {
    const history = await this.loadHistory(fileKey);
    const index = history.checkpoints.findIndex(c => c.id === checkpointId);

    if (index === -1) return false;

    // Update parent references
    const deletedCheckpoint = history.checkpoints[index];
    const childCheckpoint = history.checkpoints.find(c => c.parentId === checkpointId);
    if (childCheckpoint) {
      childCheckpoint.parentId = deletedCheckpoint.parentId;
    }

    // Remove from array
    history.checkpoints.splice(index, 1);

    // Update head if needed
    if (history.headId === checkpointId) {
      const latest = history.checkpoints.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      history.headId = latest?.id || '';
    }

    await this.saveHistory(fileKey, history);
    return true;
  }

  /**
   * Compare two checkpoints (for diff view).
   */
  async compareCheckpoints(
    fileKey: string,
    checkpointIdA: string,
    checkpointIdB: string
  ): Promise<{ contentA: string; contentB: string; sidecarA: SidecarDocument; sidecarB: SidecarDocument } | null> {
    const [a, b] = await Promise.all([
      this.getCheckpointContent(fileKey, checkpointIdA),
      this.getCheckpointContent(fileKey, checkpointIdB),
    ]);

    if (!a || !b) return null;

    return {
      contentA: a.markdown,
      contentB: b.markdown,
      sidecarA: a.sidecar,
      sidecarB: b.sidecar,
    };
  }

  /**
   * Get all referenced hashes across all checkpoint histories.
   * Used for garbage collection.
   */
  async getAllReferencedHashes(): Promise<Set<string>> {
    const hashes = new Set<string>();

    try {
      const files = await fs.readdir(this.checkpointsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const data = await fs.readFile(path.join(this.checkpointsDir, file), 'utf8');
          const history: CheckpointHistory = JSON.parse(data);

          for (const checkpoint of history.checkpoints) {
            hashes.add(checkpoint.contentHash);
            hashes.add(checkpoint.sidecarHash);
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Checkpoints directory might not exist
    }

    return hashes;
  }

  /**
   * Clear tracking state (used when switching workspaces).
   */
  clearTracking(): void {
    this.lastCheckpoint.clear();
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private generateId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'cp-';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  private getHistoryPath(fileKey: string): string {
    // Replace path separators with underscores for safe filename
    const safeName = fileKey.replace(/[\\/]/g, '_');
    return path.join(this.checkpointsDir, `${safeName}.json`);
  }

  private async loadHistory(fileKey: string): Promise<CheckpointHistory> {
    const historyPath = this.getHistoryPath(fileKey);

    try {
      const data = await fs.readFile(historyPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        fileKey,
        headId: '',
        checkpoints: [],
      };
    }
  }

  private async saveHistory(fileKey: string, history: CheckpointHistory): Promise<void> {
    const historyPath = this.getHistoryPath(fileKey);
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
  }

  private enforceRetention(history: CheckpointHistory): void {
    const now = Date.now();
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;

    // Remove old auto checkpoints (keep bookmarks)
    history.checkpoints = history.checkpoints.filter(cp => {
      if (cp.type === 'bookmark') return true;
      const age = now - new Date(cp.timestamp).getTime();
      return age < maxAge;
    });

    // Enforce max count (keep bookmarks, remove oldest auto)
    const autoCheckpoints = history.checkpoints
      .filter(cp => cp.type === 'auto')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (autoCheckpoints.length > this.config.maxCheckpointsPerFile) {
      const toRemove = new Set(
        autoCheckpoints.slice(this.config.maxCheckpointsPerFile).map(cp => cp.id)
      );
      history.checkpoints = history.checkpoints.filter(cp => !toRemove.has(cp.id));
    }

    // Update head if it was removed
    if (history.headId && !history.checkpoints.find(cp => cp.id === history.headId)) {
      const latest = history.checkpoints.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      history.headId = latest?.id || '';
    }
  }

  private formatTimestamp(timestamp?: string): string {
    if (!timestamp) return 'unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
}
