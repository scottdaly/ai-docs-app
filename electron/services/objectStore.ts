/**
 * ObjectStore - Content-Addressable Storage
 *
 * Stores document content by SHA-256 hash for:
 * - Deduplication: Identical content stored once
 * - Integrity: Hash verifies content not corrupted
 * - Efficiency: Only new content requires storage
 * - Versioning: Easy to track what changed
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class ObjectStore {
  private objectsDir: string;

  constructor(workspaceRoot: string) {
    this.objectsDir = path.join(workspaceRoot, '.midlight', 'objects');
  }

  /**
   * Initialize the object store directory.
   */
  async init(): Promise<void> {
    await fs.mkdir(this.objectsDir, { recursive: true });
  }

  /**
   * Store content and return its hash.
   * If content already exists, just returns the hash (deduplication).
   */
  async write(content: string): Promise<string> {
    const hash = this.hash(content);
    const objectPath = this.getObjectPath(hash);

    // Check if already exists (deduplication)
    try {
      await fs.access(objectPath);
      return hash; // Already stored
    } catch {
      // Doesn't exist, store it
    }

    // Compress and write
    const compressed = await gzip(Buffer.from(content, 'utf8'));
    const dir = path.dirname(objectPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(objectPath, compressed);

    return hash;
  }

  /**
   * Retrieve content by hash.
   * @throws Error if hash not found
   */
  async read(hash: string): Promise<string> {
    const objectPath = this.getObjectPath(hash);

    try {
      const compressed = await fs.readFile(objectPath);
      const decompressed = await gunzip(compressed);
      return decompressed.toString('utf8');
    } catch (error) {
      throw new Error(`Object not found: ${hash}`);
    }
  }

  /**
   * Check if content exists by hash.
   */
  async exists(hash: string): Promise<boolean> {
    try {
      await fs.access(this.getObjectPath(hash));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate SHA-256 hash of content.
   */
  hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get filesystem path for a hash.
   * Uses first 2 chars as directory (like Git) for filesystem efficiency.
   * This prevents having thousands of files in a single directory.
   */
  private getObjectPath(hash: string): string {
    return path.join(this.objectsDir, hash.slice(0, 2), hash.slice(2));
  }

  /**
   * Get total size of object store in bytes.
   */
  async getStorageSize(): Promise<number> {
    let totalSize = 0;

    try {
      const dirs = await fs.readdir(this.objectsDir);

      for (const dir of dirs) {
        const dirPath = path.join(this.objectsDir, dir);

        try {
          const stats = await fs.stat(dirPath);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(dirPath);
          for (const file of files) {
            const fileStats = await fs.stat(path.join(dirPath, file));
            totalSize += fileStats.size;
          }
        } catch {
          // Skip if can't read directory
        }
      }
    } catch {
      // Objects directory might not exist yet
    }

    return totalSize;
  }

  /**
   * Get count of objects in store.
   */
  async getObjectCount(): Promise<number> {
    let count = 0;

    try {
      const dirs = await fs.readdir(this.objectsDir);

      for (const dir of dirs) {
        const dirPath = path.join(this.objectsDir, dir);

        try {
          const stats = await fs.stat(dirPath);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(dirPath);
          count += files.length;
        } catch {
          // Skip if can't read directory
        }
      }
    } catch {
      // Objects directory might not exist yet
    }

    return count;
  }

  /**
   * Garbage collection: remove objects not referenced by any checkpoint.
   * @param referencedHashes Set of hashes that are still in use
   * @returns Number of bytes freed
   */
  async gc(referencedHashes: Set<string>): Promise<number> {
    let freedBytes = 0;

    try {
      const dirs = await fs.readdir(this.objectsDir);

      for (const dir of dirs) {
        const dirPath = path.join(this.objectsDir, dir);

        try {
          const stats = await fs.stat(dirPath);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(dirPath);

          for (const file of files) {
            const hash = dir + file;

            if (!referencedHashes.has(hash)) {
              const filePath = path.join(dirPath, file);
              const fileStats = await fs.stat(filePath);
              freedBytes += fileStats.size;
              await fs.unlink(filePath);
            }
          }

          // Remove empty directories
          const remainingFiles = await fs.readdir(dirPath);
          if (remainingFiles.length === 0) {
            await fs.rmdir(dirPath);
          }
        } catch {
          // Skip if can't process directory
        }
      }
    } catch {
      // Objects directory might not exist
    }

    return freedBytes;
  }

  /**
   * Get all hashes currently in the store.
   * Useful for debugging and garbage collection.
   */
  async getAllHashes(): Promise<string[]> {
    const hashes: string[] = [];

    try {
      const dirs = await fs.readdir(this.objectsDir);

      for (const dir of dirs) {
        const dirPath = path.join(this.objectsDir, dir);

        try {
          const stats = await fs.stat(dirPath);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(dirPath);
          for (const file of files) {
            hashes.push(dir + file);
          }
        } catch {
          // Skip if can't read directory
        }
      }
    } catch {
      // Objects directory might not exist yet
    }

    return hashes;
  }
}
