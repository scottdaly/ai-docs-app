import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CheckpointManager } from './checkpointManager';
import { ObjectStore } from './objectStore';
import { createEmptySidecar, SidecarDocument } from './types';

describe('CheckpointManager', () => {
  let testDir: string;
  let objectStore: ObjectStore;
  let checkpointManager: CheckpointManager;

  const createTestSidecar = (): SidecarDocument => ({
    ...createEmptySidecar(),
    meta: {
      ...createEmptySidecar().meta,
      title: 'Test Document',
    },
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'checkpoint-test-'));
    objectStore = new ObjectStore(testDir);
    await objectStore.init();
    checkpointManager = new CheckpointManager(testDir, objectStore, {
      enabled: true,
      checkpointIntervalMs: 0, // No delay for tests
      minChangeChars: 0, // No minimum for tests
      maxCheckpointsPerFile: 100,
      retentionDays: 365,
    });
    await checkpointManager.init();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should create the checkpoints directory', async () => {
      const checkpointsDir = path.join(testDir, '.midlight', 'checkpoints');
      const stats = await fs.stat(checkpointsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('maybeCreateCheckpoint', () => {
    it('should create a checkpoint and return it', async () => {
      const markdown = '# Hello World\n\nThis is a test document.';
      const sidecar = createTestSidecar();

      const checkpoint = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        markdown,
        sidecar,
        'interval'
      );

      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.id).toMatch(/^cp-[a-z0-9]{6}$/);
      expect(checkpoint?.type).toBe('auto');
      expect(checkpoint?.stats.wordCount).toBeGreaterThan(0);
      expect(checkpoint?.stats.charCount).toBe(markdown.length);
    });

    it('should not create checkpoint if content unchanged', async () => {
      const markdown = '# Same content';
      const sidecar = createTestSidecar();

      // First checkpoint
      const cp1 = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        markdown,
        sidecar,
        'interval'
      );
      expect(cp1).not.toBeNull();

      // Second attempt with same content
      const cp2 = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        markdown,
        sidecar,
        'interval'
      );
      expect(cp2).toBeNull();
    });

    it('should create checkpoint for different content', async () => {
      const sidecar = createTestSidecar();

      const cp1 = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        'Content version 1',
        sidecar,
        'interval'
      );

      const cp2 = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        'Content version 2 with changes',
        sidecar,
        'interval'
      );

      expect(cp1).not.toBeNull();
      expect(cp2).not.toBeNull();
      expect(cp1?.id).not.toBe(cp2?.id);
    });

    it('should create bookmark checkpoint with label', async () => {
      const markdown = '# Bookmark test';
      const sidecar = createTestSidecar();

      const checkpoint = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        markdown,
        sidecar,
        'bookmark',
        'Important milestone'
      );

      expect(checkpoint?.type).toBe('bookmark');
      expect(checkpoint?.label).toBe('Important milestone');
    });

    it('should return null when versioning is disabled', async () => {
      const disabledManager = new CheckpointManager(testDir, objectStore, {
        enabled: false,
        checkpointIntervalMs: 0,
        minChangeChars: 0,
        maxCheckpointsPerFile: 100,
        retentionDays: 365,
      });
      await disabledManager.init();

      const checkpoint = await disabledManager.maybeCreateCheckpoint(
        'test.md',
        '# Test',
        createTestSidecar(),
        'interval'
      );

      expect(checkpoint).toBeNull();
    });

    it('should still create bookmarks when versioning is disabled', async () => {
      const disabledManager = new CheckpointManager(testDir, objectStore, {
        enabled: false,
        checkpointIntervalMs: 0,
        minChangeChars: 0,
        maxCheckpointsPerFile: 100,
        retentionDays: 365,
      });
      await disabledManager.init();

      const checkpoint = await disabledManager.maybeCreateCheckpoint(
        'test.md',
        '# Test',
        createTestSidecar(),
        'bookmark',
        'My bookmark'
      );

      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.type).toBe('bookmark');
    });
  });

  describe('getCheckpoints', () => {
    it('should return empty array for file with no checkpoints', async () => {
      const checkpoints = await checkpointManager.getCheckpoints('nonexistent.md');
      expect(checkpoints).toEqual([]);
    });

    it('should return checkpoints sorted by timestamp (newest first)', async () => {
      const sidecar = createTestSidecar();

      await checkpointManager.maybeCreateCheckpoint('test.md', 'Version 1', sidecar, 'interval');
      await checkpointManager.maybeCreateCheckpoint('test.md', 'Version 2', sidecar, 'interval');
      await checkpointManager.maybeCreateCheckpoint('test.md', 'Version 3', sidecar, 'interval');

      const checkpoints = await checkpointManager.getCheckpoints('test.md');

      expect(checkpoints).toHaveLength(3);
      // Newest first
      expect(new Date(checkpoints[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(checkpoints[1].timestamp).getTime()
      );
    });
  });

  describe('getCheckpointContent', () => {
    it('should retrieve checkpoint content', async () => {
      const markdown = '# Test content for retrieval';
      const sidecar = createTestSidecar();

      const checkpoint = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        markdown,
        sidecar,
        'interval'
      );

      const content = await checkpointManager.getCheckpointContent('test.md', checkpoint!.id);

      expect(content).not.toBeNull();
      expect(content?.markdown).toBe(markdown);
      expect(content?.sidecar.meta.title).toBe('Test Document');
    });

    it('should return null for non-existent checkpoint', async () => {
      const content = await checkpointManager.getCheckpointContent('test.md', 'cp-fake12');
      expect(content).toBeNull();
    });
  });

  describe('restoreCheckpoint', () => {
    it('should restore checkpoint and create restore marker', async () => {
      const sidecar = createTestSidecar();

      // Create two checkpoints
      const cp1 = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        'Original content',
        sidecar,
        'interval'
      );

      await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        'Modified content',
        sidecar,
        'interval'
      );

      // Restore to first checkpoint
      const restored = await checkpointManager.restoreCheckpoint('test.md', cp1!.id);

      expect(restored).not.toBeNull();
      expect(restored?.markdown).toBe('Original content');

      // Should have created a new checkpoint for the restore
      const checkpoints = await checkpointManager.getCheckpoints('test.md');
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].trigger).toBe('restore');
      expect(checkpoints[0].label).toContain('Restored from');
    });

    it('should return null for non-existent checkpoint', async () => {
      const restored = await checkpointManager.restoreCheckpoint('test.md', 'cp-fake12');
      expect(restored).toBeNull();
    });
  });

  describe('labelCheckpoint', () => {
    it('should add label to existing checkpoint', async () => {
      const checkpoint = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        '# Test',
        createTestSidecar(),
        'interval'
      );

      const success = await checkpointManager.labelCheckpoint(
        'test.md',
        checkpoint!.id,
        'Important version'
      );

      expect(success).toBe(true);

      const checkpoints = await checkpointManager.getCheckpoints('test.md');
      expect(checkpoints[0].type).toBe('bookmark');
      expect(checkpoints[0].label).toBe('Important version');
    });

    it('should return false for non-existent checkpoint', async () => {
      const success = await checkpointManager.labelCheckpoint('test.md', 'cp-fake12', 'Label');
      expect(success).toBe(false);
    });
  });

  describe('unlabelCheckpoint', () => {
    it('should remove label from checkpoint', async () => {
      const checkpoint = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        '# Test',
        createTestSidecar(),
        'bookmark',
        'My Label'
      );

      expect(checkpoint?.label).toBe('My Label');

      const success = await checkpointManager.unlabelCheckpoint('test.md', checkpoint!.id);
      expect(success).toBe(true);

      const checkpoints = await checkpointManager.getCheckpoints('test.md');
      expect(checkpoints[0].type).toBe('auto');
      expect(checkpoints[0].label).toBeUndefined();
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete a checkpoint', async () => {
      const sidecar = createTestSidecar();

      await checkpointManager.maybeCreateCheckpoint('test.md', 'Keep', sidecar, 'interval');
      const toDelete = await checkpointManager.maybeCreateCheckpoint('test.md', 'Delete', sidecar, 'interval');

      let checkpoints = await checkpointManager.getCheckpoints('test.md');
      expect(checkpoints).toHaveLength(2);

      const success = await checkpointManager.deleteCheckpoint('test.md', toDelete!.id);
      expect(success).toBe(true);

      checkpoints = await checkpointManager.getCheckpoints('test.md');
      expect(checkpoints).toHaveLength(1);
    });

    it('should update parent references when deleting', async () => {
      const sidecar = createTestSidecar();

      const cp1 = await checkpointManager.maybeCreateCheckpoint('test.md', 'First', sidecar, 'interval');
      const cp2 = await checkpointManager.maybeCreateCheckpoint('test.md', 'Second', sidecar, 'interval');
      const cp3 = await checkpointManager.maybeCreateCheckpoint('test.md', 'Third', sidecar, 'interval');

      // Delete middle checkpoint
      await checkpointManager.deleteCheckpoint('test.md', cp2!.id);

      const checkpoints = await checkpointManager.getCheckpoints('test.md');
      const cp3Updated = checkpoints.find(c => c.id === cp3!.id);

      // cp3 should now point to cp1
      expect(cp3Updated?.parentId).toBe(cp1!.id);
    });
  });

  describe('compareCheckpoints', () => {
    it('should return content of both checkpoints', async () => {
      const sidecar = createTestSidecar();

      const cp1 = await checkpointManager.maybeCreateCheckpoint('test.md', 'Content A', sidecar, 'interval');
      const cp2 = await checkpointManager.maybeCreateCheckpoint('test.md', 'Content B', sidecar, 'interval');

      const comparison = await checkpointManager.compareCheckpoints('test.md', cp1!.id, cp2!.id);

      expect(comparison).not.toBeNull();
      expect(comparison?.contentA).toBe('Content A');
      expect(comparison?.contentB).toBe('Content B');
    });

    it('should return null if either checkpoint not found', async () => {
      const checkpoint = await checkpointManager.maybeCreateCheckpoint(
        'test.md',
        'Content',
        createTestSidecar(),
        'interval'
      );

      const comparison = await checkpointManager.compareCheckpoints('test.md', checkpoint!.id, 'cp-fake12');
      expect(comparison).toBeNull();
    });
  });

  describe('getAllReferencedHashes', () => {
    it('should return all hashes used by checkpoints', async () => {
      const sidecar = createTestSidecar();

      await checkpointManager.maybeCreateCheckpoint('file1.md', 'Content 1', sidecar, 'interval');
      await checkpointManager.maybeCreateCheckpoint('file2.md', 'Content 2', sidecar, 'interval');

      const hashes = await checkpointManager.getAllReferencedHashes();

      // Each checkpoint has content hash and sidecar hash
      // But sidecars may be deduplicated if they're identical
      expect(hashes.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('retention limits', () => {
    it('should enforce maxCheckpointsPerFile', async () => {
      const manager = new CheckpointManager(testDir, objectStore, {
        enabled: true,
        checkpointIntervalMs: 0,
        minChangeChars: 0,
        maxCheckpointsPerFile: 3,
        retentionDays: 365,
      });
      await manager.init();

      const sidecar = createTestSidecar();

      for (let i = 0; i < 5; i++) {
        await manager.maybeCreateCheckpoint('test.md', `Content ${i}`, sidecar, 'interval');
      }

      const checkpoints = await manager.getCheckpoints('test.md');

      // Should only have 3 auto checkpoints (max)
      expect(checkpoints.length).toBeLessThanOrEqual(3);
    });

    it('should preserve bookmarks when enforcing limits', async () => {
      const manager = new CheckpointManager(testDir, objectStore, {
        enabled: true,
        checkpointIntervalMs: 0,
        minChangeChars: 0,
        maxCheckpointsPerFile: 2,
        retentionDays: 365,
      });
      await manager.init();

      const sidecar = createTestSidecar();

      // Create a bookmark
      await manager.maybeCreateCheckpoint('test.md', 'Bookmark content', sidecar, 'bookmark', 'Important');

      // Create many auto checkpoints
      for (let i = 0; i < 5; i++) {
        await manager.maybeCreateCheckpoint('test.md', `Auto content ${i}`, sidecar, 'interval');
      }

      const checkpoints = await manager.getCheckpoints('test.md');
      const bookmarks = checkpoints.filter(c => c.type === 'bookmark');

      // Bookmark should be preserved
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].label).toBe('Important');
    });
  });

  describe('getHeadId', () => {
    it('should return null for file with no checkpoints', async () => {
      const headId = await checkpointManager.getHeadId('nonexistent.md');
      expect(headId).toBeNull();
    });

    it('should return latest checkpoint id', async () => {
      const sidecar = createTestSidecar();

      await checkpointManager.maybeCreateCheckpoint('test.md', 'First', sidecar, 'interval');
      const second = await checkpointManager.maybeCreateCheckpoint('test.md', 'Second', sidecar, 'interval');

      const headId = await checkpointManager.getHeadId('test.md');
      expect(headId).toBe(second!.id);
    });
  });

  describe('clearTracking', () => {
    it('should allow creating checkpoint for previously seen content after clearing', async () => {
      const markdown = 'Same content';
      const sidecar = createTestSidecar();

      await checkpointManager.maybeCreateCheckpoint('test.md', markdown, sidecar, 'interval');

      // Should skip (same content)
      const skipped = await checkpointManager.maybeCreateCheckpoint('test.md', markdown, sidecar, 'interval');
      expect(skipped).toBeNull();

      // Clear tracking
      checkpointManager.clearTracking();

      // Should now create (tracking cleared)
      const created = await checkpointManager.maybeCreateCheckpoint('test.md', markdown, sidecar, 'interval');
      expect(created).not.toBeNull();
    });
  });
});
