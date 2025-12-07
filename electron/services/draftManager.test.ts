import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DraftManager } from './draftManager';
import { ObjectStore } from './objectStore';
import { createEmptySidecar, SidecarDocument, CheckpointContent } from './types';

describe('DraftManager', () => {
  let testDir: string;
  let objectStore: ObjectStore;
  let draftManager: DraftManager;

  const createTestSidecar = (): SidecarDocument => ({
    ...createEmptySidecar(),
    meta: {
      ...createEmptySidecar().meta,
      title: 'Test Document',
    },
  });

  const createTestContent = (markdown: string): CheckpointContent => ({
    markdown,
    sidecar: createTestSidecar(),
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'draft-test-'));
    objectStore = new ObjectStore(testDir);
    await objectStore.init();
    draftManager = new DraftManager(testDir, objectStore);
    await draftManager.init();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should create the drafts directory', async () => {
      const draftsDir = path.join(testDir, '.midlight', 'drafts');
      const stats = await fs.stat(draftsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('createDraft', () => {
    it('should create a draft and return it', async () => {
      const content = createTestContent('# Hello World\n\nThis is a draft.');

      const draft = await draftManager.createDraft(
        'test.md',
        'My Draft',
        'cp-abc123',
        content
      );

      expect(draft).not.toBeNull();
      expect(draft.id).toMatch(/^draft-[a-z0-9]{8}$/);
      expect(draft.name).toBe('My Draft');
      expect(draft.fileKey).toBe('test.md');
      expect(draft.sourceCheckpointId).toBe('cp-abc123');
      expect(draft.status).toBe('active');
      expect(draft.checkpoints).toHaveLength(1);
      expect(draft.checkpoints[0].label).toBe('Draft created');
    });

    it('should store content in object store', async () => {
      const markdown = '# Draft content';
      const content = createTestContent(markdown);

      const draft = await draftManager.createDraft(
        'test.md',
        'My Draft',
        'cp-abc123',
        content
      );

      const retrievedContent = await draftManager.getDraftContent('test.md', draft.id);
      expect(retrievedContent).not.toBeNull();
      expect(retrievedContent?.markdown).toBe(markdown);
    });

    it('should calculate word count correctly', async () => {
      const content = createTestContent('One two three four five');

      const draft = await draftManager.createDraft(
        'test.md',
        'Word Count Test',
        'cp-abc123',
        content
      );

      expect(draft.checkpoints[0].stats.wordCount).toBe(5);
    });
  });

  describe('getDrafts', () => {
    it('should return empty array for file with no drafts', async () => {
      const drafts = await draftManager.getDrafts('nonexistent.md');
      expect(drafts).toEqual([]);
    });

    it('should return all drafts for a file', async () => {
      const content = createTestContent('# Test');

      await draftManager.createDraft('test.md', 'Draft 1', 'cp-1', content);
      await draftManager.createDraft('test.md', 'Draft 2', 'cp-2', content);
      await draftManager.createDraft('other.md', 'Other Draft', 'cp-3', content);

      const drafts = await draftManager.getDrafts('test.md');

      expect(drafts).toHaveLength(2);
      expect(drafts.map(d => d.name)).toContain('Draft 1');
      expect(drafts.map(d => d.name)).toContain('Draft 2');
    });

    it('should return drafts sorted by modified date (newest first)', async () => {
      const content = createTestContent('# Test');

      const draft1 = await draftManager.createDraft('test.md', 'First', 'cp-1', content);
      await draftManager.createDraft('test.md', 'Second', 'cp-2', content);

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Modify first draft to make it newest
      await draftManager.renameDraft('test.md', draft1.id, 'First (Modified)');

      const drafts = await draftManager.getDrafts('test.md');

      expect(drafts[0].name).toBe('First (Modified)');
    });
  });

  describe('getDraft', () => {
    it('should return null for non-existent draft', async () => {
      const draft = await draftManager.getDraft('test.md', 'draft-nonexistent');
      expect(draft).toBeNull();
    });

    it('should return the draft with all properties', async () => {
      const content = createTestContent('# Test');

      const created = await draftManager.createDraft(
        'test.md',
        'My Draft',
        'cp-abc123',
        content
      );

      const retrieved = await draftManager.getDraft('test.md', created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('My Draft');
      expect(retrieved?.checkpoints).toHaveLength(1);
    });
  });

  describe('getDraftContent', () => {
    it('should return null for non-existent draft', async () => {
      const content = await draftManager.getDraftContent('test.md', 'draft-nonexistent');
      expect(content).toBeNull();
    });

    it('should return the current content', async () => {
      const markdown = '# Draft content here';
      const content = createTestContent(markdown);

      const draft = await draftManager.createDraft('test.md', 'Test', 'cp-1', content);

      const retrieved = await draftManager.getDraftContent('test.md', draft.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.markdown).toBe(markdown);
      expect(retrieved?.sidecar.meta.title).toBe('Test Document');
    });
  });

  describe('saveDraftContent', () => {
    it('should create a new checkpoint when content changes', async () => {
      const content1 = createTestContent('Version 1');
      const content2 = createTestContent('Version 2');

      const draft = await draftManager.createDraft('test.md', 'Test', 'cp-1', content1);

      expect(draft.checkpoints).toHaveLength(1);

      const checkpoint = await draftManager.saveDraftContent(
        'test.md',
        draft.id,
        content2
      );

      expect(checkpoint).not.toBeNull();

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.checkpoints).toHaveLength(2);
    });

    it('should return null when content is unchanged', async () => {
      const content = createTestContent('Same content');

      const draft = await draftManager.createDraft('test.md', 'Test', 'cp-1', content);

      const checkpoint = await draftManager.saveDraftContent(
        'test.md',
        draft.id,
        content
      );

      expect(checkpoint).toBeNull();
    });

    it('should not save to inactive draft', async () => {
      const content = createTestContent('Content');

      const draft = await draftManager.createDraft('test.md', 'Test', 'cp-1', content);
      await draftManager.discardDraft('test.md', draft.id);

      const checkpoint = await draftManager.saveDraftContent(
        'test.md',
        draft.id,
        createTestContent('New content')
      );

      expect(checkpoint).toBeNull();
    });

    it('should update head to newest checkpoint', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('V1')
      );

      await draftManager.saveDraftContent('test.md', draft.id, createTestContent('V2'));

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.headId).toBe(updated?.checkpoints[updated.checkpoints.length - 1].id);
    });

    it('should enforce checkpoint limit (20)', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('Initial')
      );

      // Create 25 more checkpoints
      for (let i = 0; i < 25; i++) {
        await draftManager.saveDraftContent(
          'test.md',
          draft.id,
          createTestContent(`Version ${i}`)
        );
      }

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.checkpoints.length).toBeLessThanOrEqual(20);
    });
  });

  describe('renameDraft', () => {
    it('should rename the draft', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Original Name',
        'cp-1',
        createTestContent('Content')
      );

      const success = await draftManager.renameDraft('test.md', draft.id, 'New Name');

      expect(success).toBe(true);

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.name).toBe('New Name');
    });

    it('should return false for non-existent draft', async () => {
      const success = await draftManager.renameDraft('test.md', 'draft-fake', 'Name');
      expect(success).toBe(false);
    });

    it('should update modified timestamp', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Original',
        'cp-1',
        createTestContent('Content')
      );

      const originalModified = draft.modified;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await draftManager.renameDraft('test.md', draft.id, 'Renamed');

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(new Date(updated!.modified).getTime()).toBeGreaterThan(
        new Date(originalModified).getTime()
      );
    });
  });

  describe('applyDraft', () => {
    it('should return content and mark draft as merged', async () => {
      const markdown = '# Apply this content';
      const draft = await draftManager.createDraft(
        'test.md',
        'To Apply',
        'cp-1',
        createTestContent(markdown)
      );

      const content = await draftManager.applyDraft('test.md', draft.id);

      expect(content).not.toBeNull();
      expect(content?.markdown).toBe(markdown);

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.status).toBe('merged');
    });

    it('should return null for non-existent draft', async () => {
      const content = await draftManager.applyDraft('test.md', 'draft-fake');
      expect(content).toBeNull();
    });

    it('should return null for already merged draft', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('Content')
      );

      await draftManager.applyDraft('test.md', draft.id);
      const secondApply = await draftManager.applyDraft('test.md', draft.id);

      expect(secondApply).toBeNull();
    });
  });

  describe('discardDraft', () => {
    it('should mark draft as archived', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'To Discard',
        'cp-1',
        createTestContent('Content')
      );

      const success = await draftManager.discardDraft('test.md', draft.id);

      expect(success).toBe(true);

      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.status).toBe('archived');
    });

    it('should return false for non-existent draft', async () => {
      const success = await draftManager.discardDraft('test.md', 'draft-fake');
      expect(success).toBe(false);
    });
  });

  describe('deleteDraft', () => {
    it('should permanently delete the draft', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'To Delete',
        'cp-1',
        createTestContent('Content')
      );

      const success = await draftManager.deleteDraft('test.md', draft.id);
      expect(success).toBe(true);

      const deleted = await draftManager.getDraft('test.md', draft.id);
      expect(deleted).toBeNull();
    });

    it('should return false for non-existent draft', async () => {
      const success = await draftManager.deleteDraft('test.md', 'draft-fake');
      expect(success).toBe(false);
    });
  });

  describe('getDraftCheckpoints', () => {
    it('should return empty array for non-existent draft', async () => {
      const checkpoints = await draftManager.getDraftCheckpoints('test.md', 'draft-fake');
      expect(checkpoints).toEqual([]);
    });

    it('should return checkpoints sorted newest first', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('V1')
      );

      await draftManager.saveDraftContent('test.md', draft.id, createTestContent('V2'));
      await draftManager.saveDraftContent('test.md', draft.id, createTestContent('V3'));

      const checkpoints = await draftManager.getDraftCheckpoints('test.md', draft.id);

      expect(checkpoints).toHaveLength(3);
      // Newest first
      expect(new Date(checkpoints[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(checkpoints[1].timestamp).getTime()
      );
    });
  });

  describe('restoreDraftCheckpoint', () => {
    it('should restore to a previous checkpoint', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('Original content')
      );

      const originalCheckpointId = draft.checkpoints[0].id;

      await draftManager.saveDraftContent(
        'test.md',
        draft.id,
        createTestContent('Modified content')
      );

      const restored = await draftManager.restoreDraftCheckpoint(
        'test.md',
        draft.id,
        originalCheckpointId
      );

      expect(restored).not.toBeNull();
      expect(restored?.markdown).toBe('Original content');

      // Should have created a new checkpoint
      const updated = await draftManager.getDraft('test.md', draft.id);
      expect(updated?.checkpoints).toHaveLength(3);
      expect(updated?.checkpoints[updated.checkpoints.length - 1].trigger).toBe('restore');
    });

    it('should return null for non-existent checkpoint', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('Content')
      );

      const restored = await draftManager.restoreDraftCheckpoint(
        'test.md',
        draft.id,
        'dcp-fake'
      );

      expect(restored).toBeNull();
    });

    it('should not restore inactive draft', async () => {
      const draft = await draftManager.createDraft(
        'test.md',
        'Test',
        'cp-1',
        createTestContent('Content')
      );

      await draftManager.discardDraft('test.md', draft.id);

      const restored = await draftManager.restoreDraftCheckpoint(
        'test.md',
        draft.id,
        draft.checkpoints[0].id
      );

      expect(restored).toBeNull();
    });
  });

  describe('getAllActiveDrafts', () => {
    it('should return all active drafts across files', async () => {
      const content = createTestContent('Content');

      await draftManager.createDraft('file1.md', 'Draft A', 'cp-1', content);
      await draftManager.createDraft('file2.md', 'Draft B', 'cp-2', content);
      const discarded = await draftManager.createDraft('file3.md', 'Draft C', 'cp-3', content);
      await draftManager.discardDraft('file3.md', discarded.id);

      const allActive = await draftManager.getAllActiveDrafts();

      expect(allActive).toHaveLength(2);
      expect(allActive.map(d => d.name)).toContain('Draft A');
      expect(allActive.map(d => d.name)).toContain('Draft B');
      expect(allActive.map(d => d.name)).not.toContain('Draft C');
    });
  });

  describe('countActiveDrafts', () => {
    it('should return count of active drafts', async () => {
      const content = createTestContent('Content');

      await draftManager.createDraft('file1.md', 'Draft 1', 'cp-1', content);
      await draftManager.createDraft('file2.md', 'Draft 2', 'cp-2', content);
      const merged = await draftManager.createDraft('file3.md', 'Draft 3', 'cp-3', content);
      await draftManager.applyDraft('file3.md', merged.id);

      const count = await draftManager.countActiveDrafts();

      expect(count).toBe(2);
    });
  });

  describe('getAllReferencedHashes', () => {
    it('should return all hashes used by drafts', async () => {
      const content1 = createTestContent('Content 1');
      const content2 = createTestContent('Content 2');

      await draftManager.createDraft('file1.md', 'Draft 1', 'cp-1', content1);
      await draftManager.createDraft('file2.md', 'Draft 2', 'cp-2', content2);

      const hashes = await draftManager.getAllReferencedHashes();

      // Each draft has content hash and sidecar hash
      expect(hashes.size).toBeGreaterThanOrEqual(2);
    });

    it('should return empty set when no drafts exist', async () => {
      const hashes = await draftManager.getAllReferencedHashes();
      expect(hashes.size).toBe(0);
    });
  });

  describe('file path handling', () => {
    it('should handle nested file paths', async () => {
      const content = createTestContent('Nested file');

      const draft = await draftManager.createDraft(
        'docs/nested/file.md',
        'Nested Draft',
        'cp-1',
        content
      );

      const retrieved = await draftManager.getDraft('docs/nested/file.md', draft.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Nested Draft');
    });

    it('should keep drafts separate for different files', async () => {
      const content = createTestContent('Content');

      await draftManager.createDraft('file1.md', 'File 1 Draft', 'cp-1', content);
      await draftManager.createDraft('file2.md', 'File 2 Draft', 'cp-2', content);

      const file1Drafts = await draftManager.getDrafts('file1.md');
      const file2Drafts = await draftManager.getDrafts('file2.md');

      expect(file1Drafts).toHaveLength(1);
      expect(file2Drafts).toHaveLength(1);
      expect(file1Drafts[0].name).toBe('File 1 Draft');
      expect(file2Drafts[0].name).toBe('File 2 Draft');
    });
  });
});
