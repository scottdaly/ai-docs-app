/**
 * Import Transaction Manager
 *
 * Provides atomic import operations with rollback capability.
 * Uses a staging directory pattern to ensure imports are all-or-nothing.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IMPORT_CONFIG, isPathSafe, sanitizeRelativePath } from './importSecurity';

// ============================================
// TYPES
// ============================================

export interface TransactionFile {
  relativePath: string;
  stagingPath: string;
  finalPath: string;
  size: number;
}

export interface TransactionStats {
  filesStaged: number;
  totalBytes: number;
  isCommitted: boolean;
  isRolledBack: boolean;
}

// ============================================
// IMPORT TRANSACTION CLASS
// ============================================

/**
 * Manages atomic file imports using a staging directory.
 *
 * Usage:
 * ```typescript
 * const transaction = new ImportTransaction(destPath);
 * await transaction.initialize();
 *
 * try {
 *   await transaction.stageFile('notes/file.md', content);
 *   await transaction.stageFile('attachments/image.png', buffer);
 *   await transaction.commit();
 * } catch (error) {
 *   await transaction.rollback();
 *   throw error;
 * }
 * ```
 */
export class ImportTransaction {
  private tempDir: string;
  private destPath: string;
  private stagedFiles: TransactionFile[] = [];
  private isInitialized = false;
  private isCommitted = false;
  private isRolledBack = false;

  constructor(destPath: string) {
    this.destPath = destPath;
    // Create a unique temp directory name
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    this.tempDir = path.join(destPath, `.import-staging-${timestamp}-${random}`);
  }

  /**
   * Initialize the transaction (creates staging directory)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Transaction already initialized');
    }

    await fs.mkdir(this.tempDir, { recursive: true });
    this.isInitialized = true;
  }

  /**
   * Get the staging directory path
   */
  getStagingDir(): string {
    return this.tempDir;
  }

  /**
   * Get the destination path
   */
  getDestPath(): string {
    return this.destPath;
  }

  /**
   * Stage a file (write to temp directory)
   *
   * @param relativePath - Relative path within the destination (e.g., 'notes/file.md')
   * @param content - File content (string for text, Buffer for binary)
   * @returns The staging path where the file was written
   */
  async stageFile(relativePath: string, content: string | Buffer): Promise<string> {
    this.ensureActive();

    // Sanitize the relative path
    const sanitizedPath = sanitizeRelativePath(relativePath);
    if (!sanitizedPath) {
      throw new Error(`Invalid file path: ${relativePath}`);
    }

    // Calculate paths
    const stagingPath = path.join(this.tempDir, sanitizedPath);
    const finalPath = path.join(this.destPath, sanitizedPath);

    // Validate path safety
    if (!isPathSafe(stagingPath, this.tempDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    if (!isPathSafe(finalPath, this.destPath)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }

    // Create directory structure in staging
    const stagingDir = path.dirname(stagingPath);
    await fs.mkdir(stagingDir, { recursive: true });

    // Write file to staging
    await fs.writeFile(stagingPath, content);

    // Track the staged file
    const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf-8');
    this.stagedFiles.push({
      relativePath: sanitizedPath,
      stagingPath,
      finalPath,
      size,
    });

    return stagingPath;
  }

  /**
   * Stage a file copy (copy from source to staging)
   *
   * @param sourcePath - Absolute path to source file
   * @param relativePath - Relative path within the destination
   * @returns The staging path where the file was copied
   */
  async stageCopy(sourcePath: string, relativePath: string): Promise<string> {
    this.ensureActive();

    // Sanitize the relative path
    const sanitizedPath = sanitizeRelativePath(relativePath);
    if (!sanitizedPath) {
      throw new Error(`Invalid file path: ${relativePath}`);
    }

    // Calculate paths
    const stagingPath = path.join(this.tempDir, sanitizedPath);
    const finalPath = path.join(this.destPath, sanitizedPath);

    // Validate path safety
    if (!isPathSafe(stagingPath, this.tempDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    if (!isPathSafe(finalPath, this.destPath)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }

    // Create directory structure in staging
    const stagingDir = path.dirname(stagingPath);
    await fs.mkdir(stagingDir, { recursive: true });

    // Copy file to staging
    await fs.copyFile(sourcePath, stagingPath);

    // Get file size
    const stat = await fs.stat(stagingPath);

    // Track the staged file
    this.stagedFiles.push({
      relativePath: sanitizedPath,
      stagingPath,
      finalPath,
      size: stat.size,
    });

    return stagingPath;
  }

  /**
   * Verify a large file copy using checksums
   *
   * @param sourcePath - Original source file
   * @param stagedPath - Staged copy to verify
   * @returns true if checksums match
   */
  async verifyCopy(sourcePath: string, stagedPath: string): Promise<boolean> {
    const [sourceHash, stagedHash] = await Promise.all([
      this.hashFile(sourcePath),
      this.hashFile(stagedPath),
    ]);
    return sourceHash === stagedHash;
  }

  /**
   * Commit all staged files to their final locations
   */
  async commit(): Promise<void> {
    this.ensureActive();

    if (this.stagedFiles.length === 0) {
      // Nothing to commit, just clean up
      await this.cleanup();
      this.isCommitted = true;
      return;
    }

    // Move files from staging to final destination
    for (const file of this.stagedFiles) {
      // Ensure destination directory exists
      const destDir = path.dirname(file.finalPath);
      await fs.mkdir(destDir, { recursive: true });

      // Move file (rename is atomic on most systems if on same filesystem)
      try {
        await fs.rename(file.stagingPath, file.finalPath);
      } catch (error) {
        // If rename fails (e.g., cross-device), fall back to copy + delete
        if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
          await fs.copyFile(file.stagingPath, file.finalPath);
          await fs.unlink(file.stagingPath);
        } else {
          throw error;
        }
      }
    }

    // Clean up staging directory
    await this.cleanup();
    this.isCommitted = true;
  }

  /**
   * Rollback the transaction (delete staging directory)
   */
  async rollback(): Promise<void> {
    if (this.isCommitted) {
      throw new Error('Cannot rollback committed transaction');
    }

    if (this.isRolledBack) {
      return; // Already rolled back
    }

    await this.cleanup();
    this.isRolledBack = true;
  }

  /**
   * Get transaction statistics
   */
  getStats(): TransactionStats {
    return {
      filesStaged: this.stagedFiles.length,
      totalBytes: this.stagedFiles.reduce((sum, f) => sum + f.size, 0),
      isCommitted: this.isCommitted,
      isRolledBack: this.isRolledBack,
    };
  }

  /**
   * Get list of staged files
   */
  getStagedFiles(): readonly TransactionFile[] {
    return this.stagedFiles;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private ensureActive(): void {
    if (!this.isInitialized) {
      throw new Error('Transaction not initialized. Call initialize() first.');
    }
    if (this.isCommitted) {
      throw new Error('Transaction already committed');
    }
    if (this.isRolledBack) {
      throw new Error('Transaction already rolled back');
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Log but don't throw - cleanup failure shouldn't break the operation
      console.error('Failed to clean up staging directory:', this.tempDir, error);
    }
  }

  private async hashFile(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
  }
}

// ============================================
// DISK SPACE VALIDATION
// ============================================

/**
 * Check if there's enough disk space for the import
 *
 * @param destPath - Destination directory
 * @param requiredBytes - Bytes needed for the import
 * @returns Validation result
 */
export async function validateDiskSpace(
  destPath: string,
  requiredBytes: number
): Promise<{ valid: boolean; error?: string; availableBytes?: number }> {
  try {
    // Use statfs to get disk space info (Node 18.15+)
    const stats = await fs.statfs(destPath);
    const availableBytes = stats.bavail * stats.bsize;

    // Require some buffer space (default 10% extra)
    const requiredWithBuffer = requiredBytes * IMPORT_CONFIG.DISK_SPACE_BUFFER_PERCENT;

    if (availableBytes < requiredWithBuffer) {
      const availableMB = Math.round(availableBytes / 1024 / 1024);
      const requiredMB = Math.round(requiredWithBuffer / 1024 / 1024);
      return {
        valid: false,
        error: `Insufficient disk space. Need ${requiredMB}MB, have ${availableMB}MB available.`,
        availableBytes,
      };
    }

    return { valid: true, availableBytes };
  } catch (error) {
    // statfs might not be available on all systems
    // In that case, proceed without space check but log warning
    console.warn('Could not check disk space:', error);
    return { valid: true };
  }
}
