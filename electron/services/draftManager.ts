/**
 * DraftManager - Branch-like Draft Management
 *
 * Allows users to create experimental drafts of their documents without
 * affecting the main version. Drafts can be:
 * - Created from any checkpoint
 * - Edited independently with their own checkpoint history
 * - Applied (merged) back to the main document
 * - Discarded if the experiment doesn't work out
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ObjectStore } from './objectStore';
import {
  Draft,
  Checkpoint,
  CheckpointContent,
  SidecarDocument,
} from './types';

export interface DraftFile {
  version: 1;
  draft: Draft;
}

export interface DraftListItem {
  id: string;
  name: string;
  fileKey: string;
  created: string;
  modified: string;
  status: 'active' | 'merged' | 'archived';
  wordCount: number;
}

export class DraftManager {
  private objectStore: ObjectStore;
  private draftsDir: string;

  constructor(workspaceRoot: string, objectStore: ObjectStore) {
    this.objectStore = objectStore;
    this.draftsDir = path.join(workspaceRoot, '.midlight', 'drafts');
  }

  /**
   * Initialize the drafts directory.
   */
  async init(): Promise<void> {
    await fs.mkdir(this.draftsDir, { recursive: true });
  }

  /**
   * Create a new draft from a checkpoint.
   */
  async createDraft(
    fileKey: string,
    name: string,
    sourceCheckpointId: string,
    content: CheckpointContent
  ): Promise<Draft> {
    // Store content in object store
    const contentHash = this.objectStore.hash(content.markdown);
    const sidecarJson = JSON.stringify(content.sidecar);
    const sidecarHash = this.objectStore.hash(sidecarJson);

    await this.objectStore.write(content.markdown);
    await this.objectStore.write(sidecarJson);

    // Calculate stats
    const wordCount = content.markdown.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = content.markdown.length;

    // Create initial checkpoint for draft
    const initialCheckpoint: Checkpoint = {
      id: this.generateCheckpointId(),
      contentHash,
      sidecarHash,
      timestamp: new Date().toISOString(),
      parentId: null,
      type: 'auto',
      label: 'Draft created',
      stats: { wordCount, charCount, changeSize: 0 },
      trigger: 'draft_create',
    };

    const now = new Date().toISOString();
    const draft: Draft = {
      id: this.generateDraftId(),
      name,
      fileKey,
      sourceCheckpointId,
      headId: initialCheckpoint.id,
      checkpoints: [initialCheckpoint],
      created: now,
      modified: now,
      status: 'active',
    };

    // Save draft file
    await this.saveDraft(draft);

    return draft;
  }

  /**
   * Get all drafts for a file.
   */
  async getDrafts(fileKey: string): Promise<DraftListItem[]> {
    const fileDir = this.getDraftDir(fileKey);
    const drafts: DraftListItem[] = [];

    try {
      const files = await fs.readdir(fileDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const data = await fs.readFile(path.join(fileDir, file), 'utf8');
          const draftFile: DraftFile = JSON.parse(data);
          const draft = draftFile.draft;

          // Get latest checkpoint for word count
          const latestCheckpoint = draft.checkpoints.find(c => c.id === draft.headId);

          drafts.push({
            id: draft.id,
            name: draft.name,
            fileKey: draft.fileKey,
            created: draft.created,
            modified: draft.modified,
            status: draft.status,
            wordCount: latestCheckpoint?.stats.wordCount || 0,
          });
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Directory might not exist yet
    }

    // Sort by modified date (newest first)
    return drafts.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );
  }

  /**
   * Get all active drafts across all files.
   */
  async getAllActiveDrafts(): Promise<DraftListItem[]> {
    const allDrafts: DraftListItem[] = [];

    try {
      const fileDirs = await fs.readdir(this.draftsDir);

      for (const fileDir of fileDirs) {
        const fileDirPath = path.join(this.draftsDir, fileDir);
        const stat = await fs.stat(fileDirPath);

        if (!stat.isDirectory()) continue;

        try {
          const files = await fs.readdir(fileDirPath);

          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            try {
              const data = await fs.readFile(path.join(fileDirPath, file), 'utf8');
              const draftFile: DraftFile = JSON.parse(data);
              const draft = draftFile.draft;

              if (draft.status !== 'active') continue;

              const latestCheckpoint = draft.checkpoints.find(c => c.id === draft.headId);

              allDrafts.push({
                id: draft.id,
                name: draft.name,
                fileKey: draft.fileKey,
                created: draft.created,
                modified: draft.modified,
                status: draft.status,
                wordCount: latestCheckpoint?.stats.wordCount || 0,
              });
            } catch {
              // Skip invalid files
            }
          }
        } catch {
          // Skip invalid directories
        }
      }
    } catch {
      // Drafts directory might not exist
    }

    return allDrafts.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );
  }

  /**
   * Get a specific draft.
   */
  async getDraft(fileKey: string, draftId: string): Promise<Draft | null> {
    try {
      const draftPath = this.getDraftPath(fileKey, draftId);
      const data = await fs.readFile(draftPath, 'utf8');
      const draftFile: DraftFile = JSON.parse(data);
      return draftFile.draft;
    } catch {
      return null;
    }
  }

  /**
   * Get the current content of a draft.
   */
  async getDraftContent(fileKey: string, draftId: string): Promise<CheckpointContent | null> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft) return null;

    const checkpoint = draft.checkpoints.find(c => c.id === draft.headId);
    if (!checkpoint) return null;

    try {
      const markdown = await this.objectStore.read(checkpoint.contentHash);
      const sidecarJson = await this.objectStore.read(checkpoint.sidecarHash);
      const sidecar = JSON.parse(sidecarJson) as SidecarDocument;

      return { markdown, sidecar };
    } catch (error) {
      console.error('Failed to read draft content:', error);
      return null;
    }
  }

  /**
   * Save content to a draft (creates a checkpoint).
   */
  async saveDraftContent(
    fileKey: string,
    draftId: string,
    content: CheckpointContent,
    trigger: string = 'auto'
  ): Promise<Checkpoint | null> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft || draft.status !== 'active') return null;

    // Store content
    const contentHash = this.objectStore.hash(content.markdown);
    const sidecarJson = JSON.stringify(content.sidecar);
    const sidecarHash = this.objectStore.hash(sidecarJson);

    // Check if content changed
    const currentCheckpoint = draft.checkpoints.find(c => c.id === draft.headId);
    if (currentCheckpoint && currentCheckpoint.contentHash === contentHash) {
      return null; // No change
    }

    await this.objectStore.write(content.markdown);
    await this.objectStore.write(sidecarJson);

    // Calculate stats
    const wordCount = content.markdown.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = content.markdown.length;
    const changeSize = currentCheckpoint
      ? Math.abs(charCount - currentCheckpoint.stats.charCount)
      : charCount;

    // Create checkpoint
    const checkpoint: Checkpoint = {
      id: this.generateCheckpointId(),
      contentHash,
      sidecarHash,
      timestamp: new Date().toISOString(),
      parentId: draft.headId,
      type: 'auto',
      stats: { wordCount, charCount, changeSize },
      trigger,
    };

    // Update draft
    draft.checkpoints.push(checkpoint);
    draft.headId = checkpoint.id;
    draft.modified = new Date().toISOString();

    // Enforce checkpoint limit (keep last 20 for drafts)
    if (draft.checkpoints.length > 20) {
      draft.checkpoints = draft.checkpoints.slice(-20);
    }

    await this.saveDraft(draft);

    return checkpoint;
  }

  /**
   * Rename a draft.
   */
  async renameDraft(fileKey: string, draftId: string, newName: string): Promise<boolean> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft) return false;

    draft.name = newName;
    draft.modified = new Date().toISOString();

    await this.saveDraft(draft);
    return true;
  }

  /**
   * Apply (merge) a draft back to the main document.
   * Returns the content to be applied.
   */
  async applyDraft(fileKey: string, draftId: string): Promise<CheckpointContent | null> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft || draft.status !== 'active') return null;

    const content = await this.getDraftContent(fileKey, draftId);
    if (!content) return null;

    // Mark draft as merged
    draft.status = 'merged';
    draft.modified = new Date().toISOString();

    await this.saveDraft(draft);

    return content;
  }

  /**
   * Discard (archive) a draft without applying it.
   */
  async discardDraft(fileKey: string, draftId: string): Promise<boolean> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft) return false;

    draft.status = 'archived';
    draft.modified = new Date().toISOString();

    await this.saveDraft(draft);
    return true;
  }

  /**
   * Permanently delete a draft.
   */
  async deleteDraft(fileKey: string, draftId: string): Promise<boolean> {
    try {
      const draftPath = this.getDraftPath(fileKey, draftId);
      await fs.unlink(draftPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get checkpoints for a draft (for history view).
   */
  async getDraftCheckpoints(fileKey: string, draftId: string): Promise<Checkpoint[]> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft) return [];

    return draft.checkpoints.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Restore draft to a specific checkpoint.
   */
  async restoreDraftCheckpoint(
    fileKey: string,
    draftId: string,
    checkpointId: string
  ): Promise<CheckpointContent | null> {
    const draft = await this.getDraft(fileKey, draftId);
    if (!draft || draft.status !== 'active') return null;

    const checkpoint = draft.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) return null;

    try {
      const markdown = await this.objectStore.read(checkpoint.contentHash);
      const sidecarJson = await this.objectStore.read(checkpoint.sidecarHash);
      const sidecar = JSON.parse(sidecarJson) as SidecarDocument;

      // Create a new checkpoint for the restore
      const newCheckpoint: Checkpoint = {
        id: this.generateCheckpointId(),
        contentHash: checkpoint.contentHash,
        sidecarHash: checkpoint.sidecarHash,
        timestamp: new Date().toISOString(),
        parentId: draft.headId,
        type: 'auto',
        label: `Restored from ${checkpoint.label || formatTimeAgo(new Date(checkpoint.timestamp))}`,
        stats: { ...checkpoint.stats, changeSize: 0 },
        trigger: 'restore',
      };

      draft.checkpoints.push(newCheckpoint);
      draft.headId = newCheckpoint.id;
      draft.modified = new Date().toISOString();

      await this.saveDraft(draft);

      return { markdown, sidecar };
    } catch (error) {
      console.error('Failed to restore draft checkpoint:', error);
      return null;
    }
  }

  /**
   * Get all referenced hashes from all drafts (for garbage collection).
   */
  async getAllReferencedHashes(): Promise<Set<string>> {
    const hashes = new Set<string>();

    try {
      const fileDirs = await fs.readdir(this.draftsDir);

      for (const fileDir of fileDirs) {
        const fileDirPath = path.join(this.draftsDir, fileDir);

        try {
          const stat = await fs.stat(fileDirPath);
          if (!stat.isDirectory()) continue;

          const files = await fs.readdir(fileDirPath);

          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            try {
              const data = await fs.readFile(path.join(fileDirPath, file), 'utf8');
              const draftFile: DraftFile = JSON.parse(data);

              for (const checkpoint of draftFile.draft.checkpoints) {
                hashes.add(checkpoint.contentHash);
                hashes.add(checkpoint.sidecarHash);
              }
            } catch {
              // Skip invalid files
            }
          }
        } catch {
          // Skip invalid directories
        }
      }
    } catch {
      // Drafts directory might not exist
    }

    return hashes;
  }

  /**
   * Count active drafts (for tier enforcement).
   */
  async countActiveDrafts(): Promise<number> {
    const allDrafts = await this.getAllActiveDrafts();
    return allDrafts.length;
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private generateDraftId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'draft-';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  private generateCheckpointId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'dcp-';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  private getDraftDir(fileKey: string): string {
    // Replace path separators with underscores for safe directory name
    const safeName = fileKey.replace(/[\\/]/g, '_');
    return path.join(this.draftsDir, safeName);
  }

  private getDraftPath(fileKey: string, draftId: string): string {
    return path.join(this.getDraftDir(fileKey), `${draftId}.json`);
  }

  private async saveDraft(draft: Draft): Promise<void> {
    const draftDir = this.getDraftDir(draft.fileKey);
    await fs.mkdir(draftDir, { recursive: true });

    const draftPath = this.getDraftPath(draft.fileKey, draft.id);
    const draftFile: DraftFile = {
      version: 1,
      draft,
    };

    await fs.writeFile(draftPath, JSON.stringify(draftFile, null, 2));
  }
}

/**
 * Format a date as a relative time string.
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
