import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceManager, getWorkspaceManager, clearWorkspaceManagers } from './workspaceManager';

describe('WorkspaceManager', () => {
  let testDir: string;
  let manager: WorkspaceManager;

  // Sample Tiptap document
  const sampleDoc = {
    type: 'doc' as const,
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Test Document' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'This is a ' },
          { type: 'text', text: 'test', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' document.' },
        ],
      },
    ],
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    manager = new WorkspaceManager(testDir);
    await manager.init();
  });

  afterEach(async () => {
    manager.stopAllRecovery();
    clearWorkspaceManagers();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should create .midlight directory structure', async () => {
      const midlightDir = path.join(testDir, '.midlight');
      const stats = await fs.stat(midlightDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create config.json', async () => {
      const configPath = path.join(testDir, '.midlight', 'config.json');
      const stats = await fs.stat(configPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should be idempotent', async () => {
      // Should not throw when called multiple times
      await manager.init();
      await manager.init();
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('saveDocument and loadDocument', () => {
    it('should save and load a document correctly', async () => {
      const filePath = path.join(testDir, 'test.md');

      // Save
      const saveResult = await manager.saveDocument(filePath, sampleDoc, 'manual');
      expect(saveResult.success).toBe(true);

      // Verify file was created
      const fileStats = await fs.stat(filePath);
      expect(fileStats.isFile()).toBe(true);

      // Load
      const loaded = await manager.loadDocument(filePath);
      expect(loaded.json).toBeDefined();
      expect(loaded.json.type).toBe('doc');
      expect(loaded.json.content.length).toBeGreaterThan(0);
    });

    it('should create checkpoint on save', async () => {
      const filePath = path.join(testDir, 'test.md');

      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const checkpoints = await manager.getCheckpoints(filePath);
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should preserve markdown readability', async () => {
      const filePath = path.join(testDir, 'test.md');

      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const markdown = await fs.readFile(filePath, 'utf8');

      // Should contain readable markdown
      expect(markdown).toContain('# Test Document');
      expect(markdown).toContain('**test**');
    });

    it('should create sidecar file', async () => {
      const filePath = path.join(testDir, 'test.md');

      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const sidecarDir = path.join(testDir, '.midlight', 'sidecars');
      const sidecars = await fs.readdir(sidecarDir);

      expect(sidecars.length).toBe(1);
      expect(sidecars[0]).toMatch(/\.json$/);
    });
  });

  describe('checkpoints', () => {
    it('should get checkpoint history', async () => {
      const filePath = path.join(testDir, 'test.md');

      // Create first version
      await manager.saveDocument(filePath, sampleDoc, 'manual');

      // Create significantly different version
      const modifiedDoc = {
        type: 'doc' as const,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Completely different document with lots of new content that is totally different from the original.' }] },
        ],
      };
      await manager.saveDocument(filePath, modifiedDoc, 'manual');

      const checkpoints = await manager.getCheckpoints(filePath);

      // At least one checkpoint should exist
      expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should get checkpoint content', async () => {
      const filePath = path.join(testDir, 'test.md');

      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const checkpoints = await manager.getCheckpoints(filePath);
      const content = await manager.getCheckpointContent(filePath, checkpoints[0].id);

      expect(content).toBeDefined();
      expect(content?.type).toBe('doc');
    });

    it('should restore checkpoint', async () => {
      const filePath = path.join(testDir, 'test.md');

      // Save original
      await manager.saveDocument(filePath, sampleDoc, 'manual');
      const checkpoints1 = await manager.getCheckpoints(filePath);
      const originalCheckpointId = checkpoints1[0].id;

      // Save modified
      const modifiedDoc = {
        type: 'doc' as const,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Completely different content' }] },
        ],
      };
      await manager.saveDocument(filePath, modifiedDoc, 'manual');

      // Restore original
      const restored = await manager.restoreCheckpoint(filePath, originalCheckpointId);

      expect(restored).toBeDefined();

      // Verify file was restored
      const markdown = await fs.readFile(filePath, 'utf8');
      expect(markdown).toContain('Test Document');
    });

    it('should create bookmarks', async () => {
      const filePath = path.join(testDir, 'test.md');

      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const bookmark = await manager.createBookmark(filePath, sampleDoc, 'Important version');

      expect(bookmark).toBeDefined();
      expect(bookmark?.type).toBe('bookmark');
      expect(bookmark?.label).toBe('Important version');
    });

    it('should label existing checkpoints', async () => {
      const filePath = path.join(testDir, 'test.md');

      await manager.saveDocument(filePath, sampleDoc, 'manual');
      const checkpoints = await manager.getCheckpoints(filePath);

      const success = await manager.labelCheckpoint(filePath, checkpoints[0].id, 'Labeled version');

      expect(success).toBe(true);

      const updatedCheckpoints = await manager.getCheckpoints(filePath);
      expect(updatedCheckpoints[0].label).toBe('Labeled version');
      expect(updatedCheckpoints[0].type).toBe('bookmark');
    });

    it('should compare checkpoints', async () => {
      const filePath = path.join(testDir, 'test.md');

      // Use createBookmark to force checkpoint creation
      const bookmark1 = await manager.createBookmark(filePath, sampleDoc, 'Version 1');

      const modifiedDoc = {
        type: 'doc' as const,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Completely different content for comparison test' }] },
        ],
      };
      const bookmark2 = await manager.createBookmark(filePath, modifiedDoc, 'Version 2');

      expect(bookmark1).toBeDefined();
      expect(bookmark2).toBeDefined();

      const comparison = await manager.compareCheckpoints(
        filePath,
        bookmark1!.id,
        bookmark2!.id
      );

      expect(comparison).toBeDefined();
      expect(comparison?.contentA).toBeDefined();
      expect(comparison?.contentB).toBeDefined();
    });
  });

  describe('recovery', () => {
    it('should report hasRecovery correctly', async () => {
      const filePath = path.join(testDir, 'test.md');

      // Save a file first
      await manager.saveDocument(filePath, sampleDoc, 'manual');

      // Load without recovery
      const loaded = await manager.loadDocument(filePath);
      expect(loaded.hasRecovery).toBe(false);
    });
  });

  describe('storage stats and GC', () => {
    it('should report storage statistics', async () => {
      const filePath = path.join(testDir, 'test.md');
      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const stats = await manager.getStorageStats();

      expect(stats.objectStoreSize).toBeGreaterThan(0);
      expect(stats.objectCount).toBeGreaterThan(0);
    });

    it('should run garbage collection', async () => {
      const filePath = path.join(testDir, 'test.md');
      await manager.saveDocument(filePath, sampleDoc, 'manual');

      const result = await manager.runGC();

      expect(result.objectsFreed).toBeDefined();
      expect(result.imagesFreed).toBeDefined();
    });
  });

  describe('config', () => {
    it('should get config', () => {
      const config = manager.getConfig();

      expect(config.version).toBe(1);
      expect(config.versioning).toBeDefined();
      expect(config.recovery).toBeDefined();
    });

    it('should update config', async () => {
      await manager.updateConfig({
        versioning: {
          enabled: false,
          checkpointIntervalMs: 10000,
          minChangeChars: 100,
          maxCheckpointsPerFile: 25,
          retentionDays: 14,
        },
      });

      const config = manager.getConfig();
      expect(config.versioning.enabled).toBe(false);
      expect(config.versioning.maxCheckpointsPerFile).toBe(25);
    });
  });

  describe('getWorkspaceManager singleton', () => {
    it('should return same instance for same path', () => {
      const manager1 = getWorkspaceManager(testDir);
      const manager2 = getWorkspaceManager(testDir);

      expect(manager1).toBe(manager2);
    });

    it('should return different instances for different paths', async () => {
      const testDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test2-'));

      try {
        const manager1 = getWorkspaceManager(testDir);
        const manager2 = getWorkspaceManager(testDir2);

        expect(manager1).not.toBe(manager2);
      } finally {
        await fs.rm(testDir2, { recursive: true, force: true });
      }
    });

    it('should clear all managers', () => {
      getWorkspaceManager(testDir);
      clearWorkspaceManagers();

      // Getting again should create new instance
      const newManager = getWorkspaceManager(testDir);
      expect(newManager).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle saving to non-existent nested directory', async () => {
      const filePath = path.join(testDir, 'nested', 'folder', 'test.md');

      // Should fail because parent directory doesn't exist
      const result = await manager.saveDocument(filePath, sampleDoc, 'manual');

      // The save should fail gracefully
      expect(result.success).toBe(false);
    });

    it('should handle loading non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.md');

      const loaded = await manager.loadDocument(filePath);

      // Should return empty document
      expect(loaded.json.type).toBe('doc');
      expect(loaded.json.content.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle getCheckpoints for non-existent file', async () => {
      const checkpoints = await manager.getCheckpoints(path.join(testDir, 'nonexistent.md'));
      expect(checkpoints).toEqual([]);
    });
  });

  describe('file with special characters', () => {
    it('should handle file names with spaces', async () => {
      const filePath = path.join(testDir, 'my document.md');

      const saveResult = await manager.saveDocument(filePath, sampleDoc, 'manual');
      expect(saveResult.success).toBe(true);

      const loaded = await manager.loadDocument(filePath);
      expect(loaded.json.type).toBe('doc');
    });

    it('should handle file names with unicode', async () => {
      const filePath = path.join(testDir, '文档.md');

      const saveResult = await manager.saveDocument(filePath, sampleDoc, 'manual');
      expect(saveResult.success).toBe(true);

      const loaded = await manager.loadDocument(filePath);
      expect(loaded.json.type).toBe('doc');
    });
  });
});
