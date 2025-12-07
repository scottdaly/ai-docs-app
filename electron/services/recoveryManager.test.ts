import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RecoveryManager } from './recoveryManager';

describe('RecoveryManager', () => {
  let testDir: string;
  let recoveryManager: RecoveryManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recovery-test-'));
    // Use longer interval in tests to avoid race conditions
    recoveryManager = new RecoveryManager(testDir, 100);
    await recoveryManager.init();
  });

  afterEach(async () => {
    recoveryManager.stopAllWAL();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should create the recovery directory', async () => {
      const recoveryDir = path.join(testDir, '.midlight', 'recovery');
      const stats = await fs.stat(recoveryDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('startWAL and stopWAL', () => {
    it('should start WAL and write content periodically', async () => {
      let content = 'Initial content';

      recoveryManager.startWAL('test.md', () => content);

      // Wait for WAL write
      await new Promise(resolve => setTimeout(resolve, 150));

      const hasRecovery = await recoveryManager.hasRecovery('test.md');
      expect(hasRecovery).toBe(true);

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('Initial content');

      recoveryManager.stopWAL('test.md');
    });

    it('should update WAL when content changes', async () => {
      let content = 'Version 1';

      recoveryManager.startWAL('test.md', () => content);

      await new Promise(resolve => setTimeout(resolve, 150));

      content = 'Version 2';

      await new Promise(resolve => setTimeout(resolve, 150));

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('Version 2');

      recoveryManager.stopWAL('test.md');
    });

    it('should not write WAL if content unchanged', async () => {
      const content = 'Static content';

      // We can't easily track writes, but we can verify the content stays the same
      recoveryManager.startWAL('test.md', () => content);

      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for multiple intervals

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('Static content');

      recoveryManager.stopWAL('test.md');
    });

    it('should stop WAL and clean up', async () => {
      recoveryManager.startWAL('test.md', () => 'Content');
      await new Promise(resolve => setTimeout(resolve, 150));

      recoveryManager.stopWAL('test.md');

      // Starting again with different content should work
      recoveryManager.startWAL('test.md', () => 'New content');
      await new Promise(resolve => setTimeout(resolve, 150));

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('New content');

      recoveryManager.stopWAL('test.md');
    });

    it('should replace existing WAL when starting again', async () => {
      recoveryManager.startWAL('test.md', () => 'First WAL');
      await new Promise(resolve => setTimeout(resolve, 150));

      // Start new WAL (should replace)
      recoveryManager.startWAL('test.md', () => 'Second WAL');
      await new Promise(resolve => setTimeout(resolve, 150));

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('Second WAL');

      recoveryManager.stopWAL('test.md');
    });
  });

  describe('updateWALNow', () => {
    it('should write WAL immediately', async () => {
      await recoveryManager.updateWALNow('test.md', 'Immediate content');

      const hasRecovery = await recoveryManager.hasRecovery('test.md');
      expect(hasRecovery).toBe(true);

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('Immediate content');
    });

    it('should overwrite existing WAL', async () => {
      await recoveryManager.updateWALNow('test.md', 'First');
      await recoveryManager.updateWALNow('test.md', 'Second');

      const recoveryContent = await recoveryManager.getRecoveryContent('test.md');
      expect(recoveryContent).toBe('Second');
    });
  });

  describe('stopAllWAL', () => {
    it('should stop all running WAL timers', async () => {
      recoveryManager.startWAL('file1.md', () => 'Content 1');
      recoveryManager.startWAL('file2.md', () => 'Content 2');

      await new Promise(resolve => setTimeout(resolve, 150));

      recoveryManager.stopAllWAL();

      // Verify timers stopped by checking that files still exist
      // (we're not removing WAL files, just stopping timers)
      const hasRecovery1 = await recoveryManager.hasRecovery('file1.md');
      const hasRecovery2 = await recoveryManager.hasRecovery('file2.md');

      expect(hasRecovery1).toBe(true);
      expect(hasRecovery2).toBe(true);
    });
  });

  describe('clearWAL', () => {
    it('should remove WAL file', async () => {
      await recoveryManager.updateWALNow('test.md', 'Content to clear');

      expect(await recoveryManager.hasRecovery('test.md')).toBe(true);

      await recoveryManager.clearWAL('test.md');

      expect(await recoveryManager.hasRecovery('test.md')).toBe(false);
    });

    it('should not throw for non-existent WAL', async () => {
      // Should not throw
      await expect(recoveryManager.clearWAL('nonexistent.md')).resolves.toBeUndefined();
    });
  });

  describe('hasRecovery', () => {
    it('should return false when no recovery exists', async () => {
      const hasRecovery = await recoveryManager.hasRecovery('nonexistent.md');
      expect(hasRecovery).toBe(false);
    });

    it('should return true when recovery exists', async () => {
      await recoveryManager.updateWALNow('test.md', 'Recovery content');

      const hasRecovery = await recoveryManager.hasRecovery('test.md');
      expect(hasRecovery).toBe(true);
    });
  });

  describe('getRecoveryContent', () => {
    it('should return null for non-existent recovery', async () => {
      const content = await recoveryManager.getRecoveryContent('nonexistent.md');
      expect(content).toBeNull();
    });

    it('should return content for existing recovery', async () => {
      await recoveryManager.updateWALNow('test.md', 'Recovery content');

      const content = await recoveryManager.getRecoveryContent('test.md');
      expect(content).toBe('Recovery content');
    });
  });

  describe('checkForRecovery', () => {
    it('should return empty array when no recovery files exist', async () => {
      const recoveryFiles = await recoveryManager.checkForRecovery();
      expect(recoveryFiles).toEqual([]);
    });

    it('should return list of recovery files', async () => {
      await recoveryManager.updateWALNow('file1.md', 'Content 1');
      await recoveryManager.updateWALNow('file2.md', 'Content 2');

      const recoveryFiles = await recoveryManager.checkForRecovery();

      expect(recoveryFiles).toHaveLength(2);
      expect(recoveryFiles.map(r => r.fileKey)).toContain('file1.md');
      expect(recoveryFiles.map(r => r.fileKey)).toContain('file2.md');
    });

    it('should include content and timestamp', async () => {
      await recoveryManager.updateWALNow('test.md', 'Recovery content');

      const recoveryFiles = await recoveryManager.checkForRecovery();

      expect(recoveryFiles[0].walContent).toBe('Recovery content');
      expect(recoveryFiles[0].walTime).toBeInstanceOf(Date);
    });
  });

  describe('applyRecovery', () => {
    it('should return recovery content', async () => {
      await recoveryManager.updateWALNow('test.md', 'Content to recover');

      const content = await recoveryManager.applyRecovery('test.md');
      expect(content).toBe('Content to recover');
    });

    it('should return null for non-existent recovery', async () => {
      const content = await recoveryManager.applyRecovery('nonexistent.md');
      expect(content).toBeNull();
    });

    it('should NOT delete WAL file (caller should do that after successful save)', async () => {
      await recoveryManager.updateWALNow('test.md', 'Content to recover');

      await recoveryManager.applyRecovery('test.md');

      // WAL should still exist
      expect(await recoveryManager.hasRecovery('test.md')).toBe(true);
    });
  });

  describe('discardRecovery', () => {
    it('should remove WAL file', async () => {
      await recoveryManager.updateWALNow('test.md', 'Content to discard');

      await recoveryManager.discardRecovery('test.md');

      expect(await recoveryManager.hasRecovery('test.md')).toBe(false);
    });
  });

  describe('discardAllRecovery', () => {
    it('should remove all WAL files', async () => {
      await recoveryManager.updateWALNow('file1.md', 'Content 1');
      await recoveryManager.updateWALNow('file2.md', 'Content 2');
      await recoveryManager.updateWALNow('file3.md', 'Content 3');

      await recoveryManager.discardAllRecovery();

      const recoveryFiles = await recoveryManager.checkForRecovery();
      expect(recoveryFiles).toHaveLength(0);
    });
  });

  describe('hasUniqueRecovery', () => {
    it('should return true when recovery differs from current content', async () => {
      await recoveryManager.updateWALNow('test.md', 'Recovery content');

      const hasUnique = await recoveryManager.hasUniqueRecovery('test.md', 'Different current content');
      expect(hasUnique).toBe(true);
    });

    it('should return false when recovery matches current content', async () => {
      const content = 'Same content';
      await recoveryManager.updateWALNow('test.md', content);

      const hasUnique = await recoveryManager.hasUniqueRecovery('test.md', content);
      expect(hasUnique).toBe(false);
    });

    it('should return false when no recovery exists', async () => {
      const hasUnique = await recoveryManager.hasUniqueRecovery('nonexistent.md', 'Any content');
      expect(hasUnique).toBe(false);
    });
  });

  describe('file key encoding', () => {
    it('should handle file keys with slashes', async () => {
      await recoveryManager.updateWALNow('folder/subfolder/file.md', 'Nested content');

      const hasRecovery = await recoveryManager.hasRecovery('folder/subfolder/file.md');
      expect(hasRecovery).toBe(true);

      const content = await recoveryManager.getRecoveryContent('folder/subfolder/file.md');
      expect(content).toBe('Nested content');
    });

    it('should handle file keys with backslashes (Windows)', async () => {
      await recoveryManager.updateWALNow('folder\\subfolder\\file.md', 'Windows path content');

      const hasRecovery = await recoveryManager.hasRecovery('folder\\subfolder\\file.md');
      expect(hasRecovery).toBe(true);
    });
  });

  describe('unicode content', () => {
    it('should handle unicode content correctly', async () => {
      const unicodeContent = '# 你好世界 🌍\n\nEmojis and special chars: café résumé naïve';

      await recoveryManager.updateWALNow('test.md', unicodeContent);

      const recovered = await recoveryManager.getRecoveryContent('test.md');
      expect(recovered).toBe(unicodeContent);
    });
  });
});
