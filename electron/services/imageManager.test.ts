import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ImageManager } from './imageManager';

describe('ImageManager', () => {
  let testDir: string;
  let imageManager: ImageManager;

  // 1x1 red PNG as base64
  const RED_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  // 1x1 blue PNG as base64 (different from red)
  const BLUE_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

  // Small JPEG base64
  const JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQACEQBRAD8AlgAB/9k=';

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imagemanager-test-'));
    imageManager = new ImageManager(testDir);
    await imageManager.init();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should create the images directory', async () => {
      const imagesDir = path.join(testDir, '.midlight', 'images');
      const stats = await fs.stat(imagesDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('storeImage', () => {
    it('should store a PNG image and return reference', async () => {
      const result = await imageManager.storeImage(RED_PNG_BASE64);

      expect(result.ref).toMatch(/^@img:[a-f0-9]{16}$/);
      expect(result.info.mimeType).toBe('image/png');
      expect(result.info.file).toMatch(/\.png$/);
      expect(result.info.size).toBeGreaterThan(0);
    });

    it('should store a JPEG image and return reference', async () => {
      const result = await imageManager.storeImage(JPEG_BASE64);

      expect(result.ref).toMatch(/^@img:[a-f0-9]{16}$/);
      expect(result.info.mimeType).toBe('image/jpeg');
      expect(result.info.file).toMatch(/\.jpg$/);
    });

    it('should deduplicate identical images', async () => {
      const result1 = await imageManager.storeImage(RED_PNG_BASE64);
      const result2 = await imageManager.storeImage(RED_PNG_BASE64);

      expect(result1.ref).toBe(result2.ref);

      const count = await imageManager.getImageCount();
      expect(count).toBe(1);
    });

    it('should store different images separately', async () => {
      const result1 = await imageManager.storeImage(RED_PNG_BASE64);
      const result2 = await imageManager.storeImage(BLUE_PNG_BASE64);

      expect(result1.ref).not.toBe(result2.ref);

      const count = await imageManager.getImageCount();
      expect(count).toBe(2);
    });

    it('should preserve original name if provided', async () => {
      const result = await imageManager.storeImage(RED_PNG_BASE64, 'my-photo.png');

      expect(result.info.originalName).toBe('my-photo.png');
    });

    it('should throw error for invalid data URL', async () => {
      await expect(imageManager.storeImage('not-a-data-url')).rejects.toThrow('Invalid base64 image data URL');
    });
  });

  describe('storeImageBuffer', () => {
    it('should store image from buffer', async () => {
      // Create a simple buffer (1x1 red pixel PNG, simplified)
      const buffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        // Minimal IHDR, IDAT, IEND chunks
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE,
      ]);

      const result = await imageManager.storeImageBuffer(buffer, 'image/png', 'test.png');

      expect(result.ref).toMatch(/^@img:[a-f0-9]{16}$/);
      expect(result.info.mimeType).toBe('image/png');
      expect(result.info.originalName).toBe('test.png');
    });

    it('should determine correct extension for different mime types', async () => {
      const buffer = Buffer.from('fake image data');

      const png = await imageManager.storeImageBuffer(buffer, 'image/png');
      expect(png.info.file).toMatch(/\.png$/);

      const jpg = await imageManager.storeImageBuffer(Buffer.from('jpg data'), 'image/jpeg');
      expect(jpg.info.file).toMatch(/\.jpg$/);

      const gif = await imageManager.storeImageBuffer(Buffer.from('gif data'), 'image/gif');
      expect(gif.info.file).toMatch(/\.gif$/);

      const webp = await imageManager.storeImageBuffer(Buffer.from('webp data'), 'image/webp');
      expect(webp.info.file).toMatch(/\.webp$/);
    });
  });

  describe('getImageDataUrl', () => {
    it('should retrieve stored image as data URL', async () => {
      const stored = await imageManager.storeImage(RED_PNG_BASE64);
      const retrieved = await imageManager.getImageDataUrl(stored.ref);

      expect(retrieved).not.toBeNull();
      expect(retrieved).toMatch(/^data:image\/png;base64,/);
    });

    it('should return null for non-existent reference', async () => {
      const result = await imageManager.getImageDataUrl('@img:nonexistent12345');
      expect(result).toBeNull();
    });
  });

  describe('getImageBuffer', () => {
    it('should retrieve stored image as buffer', async () => {
      const stored = await imageManager.storeImage(RED_PNG_BASE64);
      const retrieved = await imageManager.getImageBuffer(stored.ref);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.buffer).toBeInstanceOf(Buffer);
      expect(retrieved?.mimeType).toBe('image/png');
    });

    it('should return correct mime type for JPEG', async () => {
      const stored = await imageManager.storeImage(JPEG_BASE64);
      const retrieved = await imageManager.getImageBuffer(stored.ref);

      expect(retrieved?.mimeType).toBe('image/jpeg');
    });

    it('should return null for non-existent reference', async () => {
      const result = await imageManager.getImageBuffer('@img:nonexistent12345');
      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing image', async () => {
      const stored = await imageManager.storeImage(RED_PNG_BASE64);
      const exists = await imageManager.exists(stored.ref);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing image', async () => {
      const exists = await imageManager.exists('@img:nonexistent12345');
      expect(exists).toBe(false);
    });
  });

  describe('getImageInfo', () => {
    it('should return info for existing image', async () => {
      const stored = await imageManager.storeImage(RED_PNG_BASE64, 'test.png');
      const info = await imageManager.getImageInfo(stored.ref);

      expect(info).not.toBeNull();
      expect(info?.mimeType).toBe('image/png');
      expect(info?.size).toBeGreaterThan(0);
    });

    it('should return null for non-existing image', async () => {
      const info = await imageManager.getImageInfo('@img:nonexistent12345');
      expect(info).toBeNull();
    });
  });

  describe('getAllRefs', () => {
    it('should return empty array when no images', async () => {
      const refs = await imageManager.getAllRefs();
      expect(refs).toEqual([]);
    });

    it('should return all image references', async () => {
      const ref1 = (await imageManager.storeImage(RED_PNG_BASE64)).ref;
      const ref2 = (await imageManager.storeImage(BLUE_PNG_BASE64)).ref;

      const refs = await imageManager.getAllRefs();

      expect(refs).toContain(ref1);
      expect(refs).toContain(ref2);
      expect(refs).toHaveLength(2);
    });
  });

  describe('gc (garbage collection)', () => {
    it('should remove unreferenced images', async () => {
      const keep = await imageManager.storeImage(RED_PNG_BASE64);
      const remove = await imageManager.storeImage(BLUE_PNG_BASE64);

      const referencedRefs = new Set([keep.ref]);
      const freedBytes = await imageManager.gc(referencedRefs);

      expect(freedBytes).toBeGreaterThan(0);
      expect(await imageManager.exists(keep.ref)).toBe(true);
      expect(await imageManager.exists(remove.ref)).toBe(false);
    });

    it('should return 0 when all images are referenced', async () => {
      const img1 = await imageManager.storeImage(RED_PNG_BASE64);
      const img2 = await imageManager.storeImage(BLUE_PNG_BASE64);

      const referencedRefs = new Set([img1.ref, img2.ref]);
      const freedBytes = await imageManager.gc(referencedRefs);

      expect(freedBytes).toBe(0);
      expect(await imageManager.getImageCount()).toBe(2);
    });
  });

  describe('getStorageSize', () => {
    it('should return 0 for empty store', async () => {
      const size = await imageManager.getStorageSize();
      expect(size).toBe(0);
    });

    it('should return correct size after storing images', async () => {
      await imageManager.storeImage(RED_PNG_BASE64);
      await imageManager.storeImage(BLUE_PNG_BASE64);

      const size = await imageManager.getStorageSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('getImageCount', () => {
    it('should return 0 for empty store', async () => {
      const count = await imageManager.getImageCount();
      expect(count).toBe(0);
    });

    it('should count images correctly', async () => {
      await imageManager.storeImage(RED_PNG_BASE64);
      await imageManager.storeImage(BLUE_PNG_BASE64);
      await imageManager.storeImage(JPEG_BASE64);

      const count = await imageManager.getImageCount();
      expect(count).toBe(3);
    });
  });

  describe('copyImageTo', () => {
    it('should copy image to destination path', async () => {
      const stored = await imageManager.storeImage(RED_PNG_BASE64);
      const destPath = path.join(testDir, 'copied-image.png');

      const success = await imageManager.copyImageTo(stored.ref, destPath);

      expect(success).toBe(true);

      const stats = await fs.stat(destPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should return false for non-existent image', async () => {
      const destPath = path.join(testDir, 'should-not-exist.png');

      const success = await imageManager.copyImageTo('@img:nonexistent12345', destPath);

      expect(success).toBe(false);
    });
  });

  describe('hash consistency', () => {
    it('should generate same hash for same image content', async () => {
      // Store same image twice with different original names
      const result1 = await imageManager.storeImage(RED_PNG_BASE64, 'photo1.png');
      const result2 = await imageManager.storeImage(RED_PNG_BASE64, 'photo2.png');

      // Hash should be based on content, not name
      expect(result1.ref).toBe(result2.ref);
    });
  });
});
