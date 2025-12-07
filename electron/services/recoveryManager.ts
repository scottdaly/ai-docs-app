/**
 * RecoveryManager - Crash Recovery via Write-Ahead Log (WAL)
 *
 * Maintains a frequently-updated recovery file for each open document.
 * If the app crashes, unsaved work can be recovered on next startup.
 *
 * How it works:
 * 1. When editing, WAL file is updated every ~500ms
 * 2. On successful save, WAL file is deleted
 * 3. On startup, check for orphaned WAL files
 * 4. If found, offer to recover unsaved changes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { RecoveryFile } from './types';

export class RecoveryManager {
  private recoveryDir: string;
  private walInterval: number;
  private walTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private pendingWrites: Map<string, string> = new Map();

  constructor(workspaceRoot: string, walInterval: number = 500) {
    this.recoveryDir = path.join(workspaceRoot, '.midlight', 'recovery');
    this.walInterval = walInterval;
  }

  /**
   * Initialize the recovery directory.
   */
  async init(): Promise<void> {
    await fs.mkdir(this.recoveryDir, { recursive: true });
  }

  /**
   * Start Write-Ahead Log for a file.
   * The getContent callback is called periodically to get current content.
   */
  startWAL(fileKey: string, getContent: () => string): void {
    // Stop existing WAL if any
    this.stopWAL(fileKey);

    const walPath = this.getWALPath(fileKey);

    const timer = setInterval(async () => {
      try {
        const content = getContent();

        // Only write if content has changed
        const lastContent = this.pendingWrites.get(fileKey);
        if (content === lastContent) {
          return;
        }

        this.pendingWrites.set(fileKey, content);
        await fs.writeFile(walPath, content, 'utf8');
      } catch (error) {
        console.error(`WAL write failed for ${fileKey}:`, error);
      }
    }, this.walInterval);

    this.walTimers.set(fileKey, timer);
  }

  /**
   * Update WAL immediately (call on significant changes).
   */
  async updateWALNow(fileKey: string, content: string): Promise<void> {
    const walPath = this.getWALPath(fileKey);
    this.pendingWrites.set(fileKey, content);

    try {
      await fs.writeFile(walPath, content, 'utf8');
    } catch (error) {
      console.error(`Immediate WAL write failed for ${fileKey}:`, error);
    }
  }

  /**
   * Stop WAL for a file.
   */
  stopWAL(fileKey: string): void {
    const timer = this.walTimers.get(fileKey);
    if (timer) {
      clearInterval(timer);
      this.walTimers.delete(fileKey);
    }
    this.pendingWrites.delete(fileKey);
  }

  /**
   * Stop all WAL timers (call on app quit).
   */
  stopAllWAL(): void {
    for (const [_fileKey, timer] of this.walTimers) {
      clearInterval(timer);
    }
    this.walTimers.clear();
    this.pendingWrites.clear();
  }

  /**
   * Clear WAL file after successful save.
   */
  async clearWAL(fileKey: string): Promise<void> {
    const walPath = this.getWALPath(fileKey);
    this.pendingWrites.delete(fileKey);

    try {
      await fs.unlink(walPath);
    } catch {
      // Ignore if doesn't exist
    }
  }

  /**
   * Check for recovery files on startup.
   * Returns list of files that have unsaved changes.
   */
  async checkForRecovery(): Promise<RecoveryFile[]> {
    const recoverable: RecoveryFile[] = [];

    try {
      const files = await fs.readdir(this.recoveryDir);

      for (const file of files) {
        if (!file.endsWith('.wal')) continue;

        const walPath = path.join(this.recoveryDir, file);

        try {
          const stats = await fs.stat(walPath);
          const content = await fs.readFile(walPath, 'utf8');

          // Extract fileKey from WAL filename
          const fileKey = this.walFileToFileKey(file);

          recoverable.push({
            fileKey,
            walContent: content,
            walTime: stats.mtime,
          });
        } catch {
          // Skip invalid WAL files
        }
      }
    } catch {
      // Recovery directory might not exist
    }

    return recoverable;
  }

  /**
   * Check if a specific file has a recovery available.
   */
  async hasRecovery(fileKey: string): Promise<boolean> {
    const walPath = this.getWALPath(fileKey);

    try {
      await fs.access(walPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recovery content for a file.
   */
  async getRecoveryContent(fileKey: string): Promise<string | null> {
    const walPath = this.getWALPath(fileKey);

    try {
      return await fs.readFile(walPath, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Apply recovery - returns the recovered content.
   * Does NOT delete the WAL (call clearWAL after successful save).
   */
  async applyRecovery(fileKey: string): Promise<string | null> {
    return this.getRecoveryContent(fileKey);
  }

  /**
   * Discard recovery (user chose not to recover).
   */
  async discardRecovery(fileKey: string): Promise<void> {
    await this.clearWAL(fileKey);
  }

  /**
   * Discard all recovery files.
   */
  async discardAllRecovery(): Promise<void> {
    try {
      const files = await fs.readdir(this.recoveryDir);

      for (const file of files) {
        if (file.endsWith('.wal')) {
          await fs.unlink(path.join(this.recoveryDir, file));
        }
      }
    } catch {
      // Recovery directory might not exist
    }
  }

  /**
   * Compare recovery content with current file content.
   * Returns true if they differ (recovery has unique changes).
   */
  async hasUniqueRecovery(fileKey: string, currentContent: string): Promise<boolean> {
    const recoveryContent = await this.getRecoveryContent(fileKey);

    if (!recoveryContent) return false;

    return recoveryContent !== currentContent;
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private getWALPath(fileKey: string): string {
    const safeName = this.fileKeyToWalFile(fileKey);
    return path.join(this.recoveryDir, safeName);
  }

  private fileKeyToWalFile(fileKey: string): string {
    // Replace path separators and add .wal extension
    return fileKey.replace(/[\\/]/g, '__') + '.wal';
  }

  private walFileToFileKey(walFile: string): string {
    // Remove .wal extension and restore path separators
    return walFile.replace('.wal', '').replace(/__/g, '/');
  }
}
