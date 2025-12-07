import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ObjectStore } from './objectStore';

describe('ObjectStore', () => {
  let testDir: string;
  let objectStore: ObjectStore;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'objectstore-test-'));
    objectStore = new ObjectStore(testDir);
    await objectStore.init();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should create the objects directory', async () => {
      const objectsDir = path.join(testDir, '.midlight', 'objects');
      const stats = await fs.stat(objectsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('hash', () => {
    it('should return consistent SHA-256 hash for same content', () => {
      const content = 'Hello, World!';
      const hash1 = objectStore.hash(content);
      const hash2 = objectStore.hash(content);
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different content', () => {
      const hash1 = objectStore.hash('Hello');
      const hash2 = objectStore.hash('World');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64 character hex string', () => {
      const hash = objectStore.hash('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('write', () => {
    it('should store content and return hash', async () => {
      const content = 'Test content for storage';
      const hash = await objectStore.write(content);

      expect(hash).toBe(objectStore.hash(content));
    });

    it('should deduplicate identical content', async () => {
      const content = 'Duplicate content test';

      const hash1 = await objectStore.write(content);
      const hash2 = await objectStore.write(content);

      expect(hash1).toBe(hash2);

      // Should only have one file
      const count = await objectStore.getObjectCount();
      expect(count).toBe(1);
    });

    it('should store different content separately', async () => {
      await objectStore.write('Content A');
      await objectStore.write('Content B');

      const count = await objectStore.getObjectCount();
      expect(count).toBe(2);
    });

    it('should compress content (gzip)', async () => {
      // Large repetitive content compresses well
      const content = 'A'.repeat(10000);
      const hash = await objectStore.write(content);

      // The stored file should be smaller than the original
      const objectPath = path.join(testDir, '.midlight', 'objects', hash.slice(0, 2), hash.slice(2));
      const stats = await fs.stat(objectPath);

      expect(stats.size).toBeLessThan(content.length);
    });
  });

  describe('read', () => {
    it('should retrieve stored content correctly', async () => {
      const content = 'Content to retrieve';
      const hash = await objectStore.write(content);

      const retrieved = await objectStore.read(hash);
      expect(retrieved).toBe(content);
    });

    it('should handle unicode content', async () => {
      const content = 'Unicode test: 你好世界 🌍 émojis café';
      const hash = await objectStore.write(content);

      const retrieved = await objectStore.read(hash);
      expect(retrieved).toBe(content);
    });

    it('should handle multiline content', async () => {
      const content = 'Line 1\nLine 2\nLine 3\n\nLine 5';
      const hash = await objectStore.write(content);

      const retrieved = await objectStore.read(hash);
      expect(retrieved).toBe(content);
    });

    it('should throw error for non-existent hash', async () => {
      const fakeHash = 'a'.repeat(64);

      await expect(objectStore.read(fakeHash)).rejects.toThrow('Object not found');
    });
  });

  describe('exists', () => {
    it('should return true for existing content', async () => {
      const content = 'Existing content';
      const hash = await objectStore.write(content);

      const exists = await objectStore.exists(hash);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing content', async () => {
      const fakeHash = 'b'.repeat(64);

      const exists = await objectStore.exists(fakeHash);
      expect(exists).toBe(false);
    });
  });

  describe('getStorageSize', () => {
    it('should return 0 for empty store', async () => {
      const size = await objectStore.getStorageSize();
      expect(size).toBe(0);
    });

    it('should return correct size after writes', async () => {
      await objectStore.write('Content 1');
      await objectStore.write('Content 2');

      const size = await objectStore.getStorageSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('getObjectCount', () => {
    it('should return 0 for empty store', async () => {
      const count = await objectStore.getObjectCount();
      expect(count).toBe(0);
    });

    it('should count objects correctly', async () => {
      await objectStore.write('Object 1');
      await objectStore.write('Object 2');
      await objectStore.write('Object 3');

      const count = await objectStore.getObjectCount();
      expect(count).toBe(3);
    });
  });

  describe('gc (garbage collection)', () => {
    it('should remove unreferenced objects', async () => {
      const hash1 = await objectStore.write('Keep this');
      const hash2 = await objectStore.write('Delete this');

      // Only keep hash1
      const referencedHashes = new Set([hash1]);
      const freedBytes = await objectStore.gc(referencedHashes);

      expect(freedBytes).toBeGreaterThan(0);
      expect(await objectStore.exists(hash1)).toBe(true);
      expect(await objectStore.exists(hash2)).toBe(false);
    });

    it('should return 0 when all objects are referenced', async () => {
      const hash1 = await objectStore.write('Keep 1');
      const hash2 = await objectStore.write('Keep 2');

      const referencedHashes = new Set([hash1, hash2]);
      const freedBytes = await objectStore.gc(referencedHashes);

      expect(freedBytes).toBe(0);
      expect(await objectStore.getObjectCount()).toBe(2);
    });

    it('should handle empty store gracefully', async () => {
      const freedBytes = await objectStore.gc(new Set());
      expect(freedBytes).toBe(0);
    });
  });

  describe('getAllHashes', () => {
    it('should return empty array for empty store', async () => {
      const hashes = await objectStore.getAllHashes();
      expect(hashes).toEqual([]);
    });

    it('should return all stored hashes', async () => {
      const hash1 = await objectStore.write('Content 1');
      const hash2 = await objectStore.write('Content 2');

      const hashes = await objectStore.getAllHashes();
      expect(hashes).toContain(hash1);
      expect(hashes).toContain(hash2);
      expect(hashes).toHaveLength(2);
    });
  });

  describe('file structure', () => {
    it('should use first 2 chars of hash as subdirectory', async () => {
      const content = 'Test content';
      const hash = await objectStore.write(content);

      const expectedDir = path.join(testDir, '.midlight', 'objects', hash.slice(0, 2));
      const expectedFile = path.join(expectedDir, hash.slice(2));

      const dirStats = await fs.stat(expectedDir);
      expect(dirStats.isDirectory()).toBe(true);

      const fileStats = await fs.stat(expectedFile);
      expect(fileStats.isFile()).toBe(true);
    });
  });
});
