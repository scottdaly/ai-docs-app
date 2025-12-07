/**
 * ImageManager - Image Storage and Deduplication
 *
 * Extracts images from documents and stores them separately for:
 * - Efficient storage (not base64 bloat in documents)
 * - Deduplication (same image used twice = stored once)
 * - Faster document loading/saving
 * - Better version control (only text changes in diffs)
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ImageInfo } from './types';

export interface ImageStoreResult {
  /** Reference to use in markdown: @img:{hash} */
  ref: string;

  /** Full image info for sidecar */
  info: ImageInfo;
}

export class ImageManager {
  private imagesDir: string;

  constructor(workspaceRoot: string) {
    this.imagesDir = path.join(workspaceRoot, '.midlight', 'images');
  }

  /**
   * Initialize the images directory.
   */
  async init(): Promise<void> {
    await fs.mkdir(this.imagesDir, { recursive: true });
  }

  /**
   * Store a base64 image and return its reference.
   * If the same image already exists, returns existing reference (deduplication).
   */
  async storeImage(
    base64DataUrl: string,
    originalName?: string
  ): Promise<ImageStoreResult> {
    // Parse data URL: data:image/png;base64,iVBORw0KGgo...
    const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid base64 image data URL');
    }

    const [, format, data] = match;
    const buffer = Buffer.from(data, 'base64');

    // Calculate hash (first 16 chars of SHA-256)
    const fullHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const hash = fullHash.slice(0, 16);

    // Determine file extension
    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `${hash}.${ext}`;
    const filePath = path.join(this.imagesDir, filename);

    // Check if already exists (deduplication)
    try {
      await fs.access(filePath);
      // Already exists, just return reference
    } catch {
      // Doesn't exist, save it
      await fs.writeFile(filePath, buffer);
    }

    const info: ImageInfo = {
      file: filename,
      originalName,
      size: buffer.length,
      mimeType: `image/${format}`,
    };

    return {
      ref: `@img:${hash}`,
      info,
    };
  }

  /**
   * Store an image from a file buffer (used for DOCX import).
   */
  async storeImageBuffer(
    buffer: Buffer,
    mimeType: string,
    originalName?: string
  ): Promise<ImageStoreResult> {
    // Calculate hash
    const fullHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const hash = fullHash.slice(0, 16);

    // Determine extension from mime type
    let ext = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      ext = 'jpg';
    } else if (mimeType.includes('gif')) {
      ext = 'gif';
    } else if (mimeType.includes('webp')) {
      ext = 'webp';
    } else if (mimeType.includes('svg')) {
      ext = 'svg';
    }

    const filename = `${hash}.${ext}`;
    const filePath = path.join(this.imagesDir, filename);

    // Check if already exists
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, buffer);
    }

    const info: ImageInfo = {
      file: filename,
      originalName,
      size: buffer.length,
      mimeType,
    };

    return {
      ref: `@img:${hash}`,
      info,
    };
  }

  /**
   * Get image as base64 data URL from reference.
   * Used when loading documents into the editor.
   */
  async getImageDataUrl(ref: string): Promise<string | null> {
    const hash = ref.replace('@img:', '');

    // Find file with this hash
    try {
      const files = await fs.readdir(this.imagesDir);
      const file = files.find(f => f.startsWith(hash));

      if (!file) return null;

      const buffer = await fs.readFile(path.join(this.imagesDir, file));
      const ext = path.extname(file).slice(1);

      // Map extension to mime type
      let mimeType = 'png';
      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'jpeg';
      } else if (ext === 'gif') {
        mimeType = 'gif';
      } else if (ext === 'webp') {
        mimeType = 'webp';
      } else if (ext === 'svg') {
        mimeType = 'svg+xml';
      }

      return `data:image/${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Get image as buffer (for DOCX export).
   */
  async getImageBuffer(ref: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const hash = ref.replace('@img:', '');

    try {
      const files = await fs.readdir(this.imagesDir);
      const file = files.find(f => f.startsWith(hash));

      if (!file) return null;

      const buffer = await fs.readFile(path.join(this.imagesDir, file));
      const ext = path.extname(file).slice(1);

      let mimeType = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === 'gif') {
        mimeType = 'image/gif';
      } else if (ext === 'webp') {
        mimeType = 'image/webp';
      }

      return { buffer, mimeType };
    } catch {
      return null;
    }
  }

  /**
   * Check if an image reference exists.
   */
  async exists(ref: string): Promise<boolean> {
    const hash = ref.replace('@img:', '');

    try {
      const files = await fs.readdir(this.imagesDir);
      return files.some(f => f.startsWith(hash));
    } catch {
      return false;
    }
  }

  /**
   * Get image info from reference.
   */
  async getImageInfo(ref: string): Promise<ImageInfo | null> {
    const hash = ref.replace('@img:', '');

    try {
      const files = await fs.readdir(this.imagesDir);
      const file = files.find(f => f.startsWith(hash));

      if (!file) return null;

      const filePath = path.join(this.imagesDir, file);
      const stats = await fs.stat(filePath);
      const ext = path.extname(file).slice(1);

      let mimeType = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === 'gif') {
        mimeType = 'image/gif';
      } else if (ext === 'webp') {
        mimeType = 'image/webp';
      }

      return {
        file,
        size: stats.size,
        mimeType,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all image references in the store.
   */
  async getAllRefs(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.imagesDir);
      return files.map(file => {
        const hash = file.split('.')[0];
        return `@img:${hash}`;
      });
    } catch {
      return [];
    }
  }

  /**
   * Garbage collect unreferenced images.
   * @param referencedRefs Set of refs that are still in use
   * @returns Number of bytes freed
   */
  async gc(referencedRefs: Set<string>): Promise<number> {
    const referencedHashes = new Set(
      Array.from(referencedRefs).map(ref => ref.replace('@img:', ''))
    );

    let freedBytes = 0;

    try {
      const files = await fs.readdir(this.imagesDir);

      for (const file of files) {
        const hash = file.split('.')[0];

        if (!referencedHashes.has(hash)) {
          const filePath = path.join(this.imagesDir, file);
          const stats = await fs.stat(filePath);
          freedBytes += stats.size;
          await fs.unlink(filePath);
        }
      }
    } catch {
      // Images directory might not exist
    }

    return freedBytes;
  }

  /**
   * Get total storage size of images directory.
   */
  async getStorageSize(): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.imagesDir);

      for (const file of files) {
        const stats = await fs.stat(path.join(this.imagesDir, file));
        totalSize += stats.size;
      }
    } catch {
      // Images directory might not exist
    }

    return totalSize;
  }

  /**
   * Get count of images in store.
   */
  async getImageCount(): Promise<number> {
    try {
      const files = await fs.readdir(this.imagesDir);
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Copy an image to a destination path (for export).
   */
  async copyImageTo(ref: string, destPath: string): Promise<boolean> {
    const hash = ref.replace('@img:', '');

    try {
      const files = await fs.readdir(this.imagesDir);
      const file = files.find(f => f.startsWith(hash));

      if (!file) return false;

      await fs.copyFile(
        path.join(this.imagesDir, file),
        destPath
      );

      return true;
    } catch {
      return false;
    }
  }
}
