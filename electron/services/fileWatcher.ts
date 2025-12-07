/**
 * FileWatcher - Monitors workspace files for external changes
 *
 * Uses chokidar to watch for file modifications made outside of Midlight.
 * When an external change is detected, it emits events that the main process
 * can forward to the renderer for user action.
 */

import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

export interface FileChangeEvent {
  /** Type of change */
  type: 'change' | 'add' | 'unlink';

  /** Relative path from workspace root (file key) */
  fileKey: string;

  /** Absolute path to the file */
  absolutePath: string;

  /** Timestamp of the change */
  timestamp: Date;
}

export interface FileWatcherConfig {
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;

  /** File patterns to watch (default: markdown files) */
  patterns?: string[];

  /** Patterns to ignore */
  ignored?: string[];
}

const DEFAULT_CONFIG: Required<FileWatcherConfig> = {
  debounceMs: 500,
  patterns: ['**/*.md'],
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.midlight/**',
    '**/.*', // Hidden files
  ],
};

export class FileWatcher extends EventEmitter {
  private workspaceRoot: string;
  private config: Required<FileWatcherConfig>;
  private watcher: chokidar.FSWatcher | null = null;

  /**
   * Set of files currently being saved by Midlight.
   * Changes to these files are ignored (not external).
   */
  private savingFiles: Set<string> = new Set();

  /**
   * Debounce timers for file changes.
   * We debounce because editors often trigger multiple change events.
   */
  private changeTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Track file mtimes to detect actual content changes.
   * Key: fileKey, Value: last known mtime
   */
  private fileMtimes: Map<string, number> = new Map();

  constructor(workspaceRoot: string, config: FileWatcherConfig = {}) {
    super();
    this.workspaceRoot = workspaceRoot;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start watching the workspace for file changes.
   */
  async start(): Promise<void> {
    if (this.watcher) {
      return; // Already watching
    }

    // Build watch paths from patterns
    const watchPaths = this.config.patterns.map((pattern) =>
      path.join(this.workspaceRoot, pattern)
    );

    this.watcher = chokidar.watch(watchPaths, {
      ignored: this.config.ignored,
      persistent: true,
      ignoreInitial: true, // Don't emit events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      // Use polling for more reliable detection (especially in tests/CI)
      usePolling: true,
      interval: 100,
      // Ignore permission errors
      ignorePermissionErrors: true,
    });

    this.watcher.on('change', (filePath) => this.handleChange('change', filePath));
    this.watcher.on('add', (filePath) => this.handleChange('add', filePath));
    this.watcher.on('unlink', (filePath) => this.handleChange('unlink', filePath));
    this.watcher.on('error', (error) => this.emit('error', error));

    // Wait for watcher to be ready
    await new Promise<void>((resolve) => {
      this.watcher!.on('ready', () => resolve());
    });
  }

  /**
   * Stop watching and clean up.
   */
  async stop(): Promise<void> {
    // Clear all pending timers
    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }
    this.changeTimers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.savingFiles.clear();
    this.fileMtimes.clear();
  }

  /**
   * Mark a file as being saved by Midlight.
   * Changes during this period will be ignored.
   *
   * @param fileKey - Relative path from workspace root
   */
  markSaving(fileKey: string): void {
    this.savingFiles.add(fileKey);
  }

  /**
   * Clear the saving mark for a file.
   * Should be called after save is complete.
   *
   * @param fileKey - Relative path from workspace root
   */
  clearSaving(fileKey: string): void {
    this.savingFiles.delete(fileKey);
    // Update mtime after our save
    this.updateMtime(fileKey);
  }

  /**
   * Update the known mtime for a file.
   * Called after we load or save a file.
   */
  async updateMtime(fileKey: string): Promise<void> {
    const absolutePath = path.join(this.workspaceRoot, fileKey);
    try {
      const stats = await fs.stat(absolutePath);
      this.fileMtimes.set(fileKey, stats.mtimeMs);
    } catch {
      // File may not exist yet
      this.fileMtimes.delete(fileKey);
    }
  }

  /**
   * Check if a file has been modified externally.
   *
   * @param fileKey - Relative path from workspace root
   * @returns true if file was modified since we last tracked it
   */
  async hasExternalChange(fileKey: string): Promise<boolean> {
    const absolutePath = path.join(this.workspaceRoot, fileKey);
    const lastKnownMtime = this.fileMtimes.get(fileKey);

    if (lastKnownMtime === undefined) {
      return false; // We haven't tracked this file
    }

    try {
      const stats = await fs.stat(absolutePath);
      return stats.mtimeMs > lastKnownMtime;
    } catch {
      return false; // File doesn't exist
    }
  }

  /**
   * Get list of currently watched files.
   */
  getWatchedFiles(): string[] {
    if (!this.watcher) {
      return [];
    }

    const watched = this.watcher.getWatched();
    const files: string[] = [];

    for (const [dir, fileNames] of Object.entries(watched)) {
      for (const fileName of fileNames) {
        const absolutePath = path.join(dir, fileName);
        const fileKey = path.relative(this.workspaceRoot, absolutePath);
        files.push(fileKey);
      }
    }

    return files;
  }

  /**
   * Handle a file change event from chokidar.
   */
  private handleChange(type: 'change' | 'add' | 'unlink', absolutePath: string): void {
    const fileKey = path.relative(this.workspaceRoot, absolutePath);

    // Ignore if we're currently saving this file
    if (this.savingFiles.has(fileKey)) {
      return;
    }

    // Clear any existing timer for this file
    const existingTimer = this.changeTimers.get(fileKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce the change event
    const timer = setTimeout(async () => {
      this.changeTimers.delete(fileKey);

      // For change events, verify the mtime actually changed
      if (type === 'change') {
        const lastKnownMtime = this.fileMtimes.get(fileKey);
        if (lastKnownMtime !== undefined) {
          try {
            const stats = await fs.stat(absolutePath);
            if (stats.mtimeMs <= lastKnownMtime) {
              return; // No actual change
            }
          } catch {
            return; // File doesn't exist
          }
        }
      }

      const event: FileChangeEvent = {
        type,
        fileKey,
        absolutePath,
        timestamp: new Date(),
      };

      this.emit('change', event);
    }, this.config.debounceMs);

    this.changeTimers.set(fileKey, timer);
  }
}
