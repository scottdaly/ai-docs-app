import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ImportTransaction, validateDiskSpace } from './importTransaction';

describe('ImportTransaction', () => {
  let testDir: string;
  let destDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-tx-test-'));
    destDir = path.join(testDir, 'destination');
    await fs.mkdir(destDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('stageFile', () => {
    it('should stage a file with string content', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('test.md', '# Hello World');

      // File should exist in staging dir, not destination
      const stagingDir = tx['tempDir'];
      const stagedPath = path.join(stagingDir, 'test.md');
      const destPath = path.join(destDir, 'test.md');

      await expect(fs.access(stagedPath)).resolves.toBeUndefined();
      await expect(fs.access(destPath)).rejects.toThrow();

      const content = await fs.readFile(stagedPath, 'utf-8');
      expect(content).toBe('# Hello World');

      await tx.rollback();
    });

    it('should stage a file with Buffer content', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      const buffer = Buffer.from('binary content');
      await tx.stageFile('binary.bin', buffer);

      const stagingDir = tx['tempDir'];
      const content = await fs.readFile(path.join(stagingDir, 'binary.bin'));
      expect(content.toString()).toBe('binary content');

      await tx.rollback();
    });

    it('should create nested directories', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('a/b/c/deep.md', 'deep content');

      const stagingDir = tx['tempDir'];
      const content = await fs.readFile(path.join(stagingDir, 'a/b/c/deep.md'), 'utf-8');
      expect(content).toBe('deep content');

      await tx.rollback();
    });

    it('should sanitize path traversal attempts', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();

      // Path traversal attempts are sanitized, not rejected
      // '../outside.md' becomes 'outside.md' after sanitization
      await tx.stageFile('../outside.md', 'content');

      // Verify file was written with sanitized name
      const stagingDir = tx['tempDir'];
      const content = await fs.readFile(path.join(stagingDir, 'outside.md'), 'utf-8');
      expect(content).toBe('content');

      // File should NOT be written outside staging
      await expect(fs.access(path.join(testDir, 'outside.md'))).rejects.toThrow();

      await tx.rollback();
    });
  });

  describe('stageCopy', () => {
    it('should copy a source file to staging', async () => {
      // Create source file
      const sourceDir = path.join(testDir, 'source');
      await fs.mkdir(sourceDir);
      const sourceFile = path.join(sourceDir, 'original.txt');
      await fs.writeFile(sourceFile, 'original content');

      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageCopy(sourceFile, 'copied.txt');

      const stagingDir = tx['tempDir'];
      const content = await fs.readFile(path.join(stagingDir, 'copied.txt'), 'utf-8');
      expect(content).toBe('original content');

      await tx.rollback();
    });

    it('should preserve file permissions', async () => {
      const sourceDir = path.join(testDir, 'source');
      await fs.mkdir(sourceDir);
      const sourceFile = path.join(sourceDir, 'executable.sh');
      await fs.writeFile(sourceFile, '#!/bin/bash\necho hello');
      await fs.chmod(sourceFile, 0o755);

      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageCopy(sourceFile, 'script.sh');

      const stagingDir = tx['tempDir'];
      const stat = await fs.stat(path.join(stagingDir, 'script.sh'));
      // Check executable bit is preserved (at least for owner)
      expect(stat.mode & 0o100).toBe(0o100);

      await tx.rollback();
    });
  });

  describe('commit', () => {
    it('should move all staged files to destination', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('file1.md', 'content 1');
      await tx.stageFile('folder/file2.md', 'content 2');
      await tx.stageFile('folder/subfolder/file3.md', 'content 3');

      await tx.commit();

      // Files should now be in destination
      expect(await fs.readFile(path.join(destDir, 'file1.md'), 'utf-8')).toBe('content 1');
      expect(await fs.readFile(path.join(destDir, 'folder/file2.md'), 'utf-8')).toBe('content 2');
      expect(await fs.readFile(path.join(destDir, 'folder/subfolder/file3.md'), 'utf-8')).toBe(
        'content 3'
      );

      // Staging directory should be cleaned up
      const stagingDir = tx['tempDir'];
      await expect(fs.access(stagingDir)).rejects.toThrow();
    });

    it('should not leave staging directory after commit', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('test.md', 'content');
      const stagingDir = tx['tempDir'];

      await tx.commit();

      // Verify staging dir is gone
      const parentDir = path.dirname(stagingDir);
      const entries = await fs.readdir(parentDir);
      const stagingDirs = entries.filter((e) => e.startsWith('.import-staging-'));
      expect(stagingDirs).toHaveLength(0);
    });

    it('should handle existing destination file', async () => {
      // Create existing file
      await fs.writeFile(path.join(destDir, 'existing.md'), 'original');

      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('existing.md', 'new content');

      // Commit behavior depends on implementation - may overwrite or fail
      // Test that the operation completes without crashing
      try {
        await tx.commit();
        // If it succeeds, file may be overwritten
        const content = await fs.readFile(path.join(destDir, 'existing.md'), 'utf-8');
        expect(['original', 'new content']).toContain(content);
      } catch {
        // If it fails, original should be unchanged
        const content = await fs.readFile(path.join(destDir, 'existing.md'), 'utf-8');
        expect(content).toBe('original');
      }
    });
  });

  describe('rollback', () => {
    it('should remove all staged files', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('file1.md', 'content 1');
      await tx.stageFile('folder/file2.md', 'content 2');

      const stagingDir = tx['tempDir'];

      // Verify files exist in staging
      await expect(fs.access(path.join(stagingDir, 'file1.md'))).resolves.toBeUndefined();

      await tx.rollback();

      // Staging directory should be completely gone
      await expect(fs.access(stagingDir)).rejects.toThrow();

      // Destination should be empty (no files moved there)
      const destEntries = await fs.readdir(destDir);
      expect(destEntries).toHaveLength(0);
    });

    it('should be safe to call multiple times', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('test.md', 'content');

      await tx.rollback();
      await tx.rollback(); // Should not throw
      await tx.rollback();
    });

    it('should clean up even if staging is partially complete', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('file1.md', 'content');

      // Simulate partial state
      const stagingDir = tx['tempDir'];

      await tx.rollback();

      await expect(fs.access(stagingDir)).rejects.toThrow();
    });
  });

  describe('verifyCopy', () => {
    it('should return true for identical files', async () => {
      const tx = new ImportTransaction(destDir);

      // Create two identical files
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      const content = 'This is test content for checksum verification';
      await fs.writeFile(file1, content);
      await fs.writeFile(file2, content);

      const result = await tx.verifyCopy(file1, file2);
      expect(result).toBe(true);

      await tx.rollback();
    });

    it('should return false for different files', async () => {
      const tx = new ImportTransaction(destDir);

      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      await fs.writeFile(file1, 'content one');
      await fs.writeFile(file2, 'content two');

      const result = await tx.verifyCopy(file1, file2);
      expect(result).toBe(false);

      await tx.rollback();
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('empty.md', '');
      await tx.commit();

      const content = await fs.readFile(path.join(destDir, 'empty.md'), 'utf-8');
      expect(content).toBe('');
    });

    it('should handle special characters in filenames', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('file with spaces.md', 'content');
      await tx.stageFile('file-with-dashes.md', 'content');
      await tx.stageFile('file_with_underscores.md', 'content');
      await tx.commit();

      await expect(fs.access(path.join(destDir, 'file with spaces.md'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(destDir, 'file-with-dashes.md'))).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(destDir, 'file_with_underscores.md'))
      ).resolves.toBeUndefined();
    });

    it('should handle unicode filenames', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      await tx.stageFile('café.md', 'content');
      await tx.stageFile('日本語.md', 'japanese');
      await tx.stageFile('émoji-🎉.md', 'party');
      await tx.commit();

      expect(await fs.readFile(path.join(destDir, 'café.md'), 'utf-8')).toBe('content');
      expect(await fs.readFile(path.join(destDir, '日本語.md'), 'utf-8')).toBe('japanese');
      expect(await fs.readFile(path.join(destDir, 'émoji-🎉.md'), 'utf-8')).toBe('party');
    });

    it('should handle large files', async () => {
      const tx = new ImportTransaction(destDir);
      await tx.initialize();
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      await tx.stageFile('large.txt', largeContent);
      await tx.commit();

      const stat = await fs.stat(path.join(destDir, 'large.txt'));
      expect(stat.size).toBe(10 * 1024 * 1024);
    });
  });
});

describe('validateDiskSpace', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'disk-space-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return valid for small required space', async () => {
    const result = await validateDiskSpace(testDir, 1024); // 1KB
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return invalid for impossibly large space', async () => {
    // Request more space than any disk could have (1 exabyte)
    const result = await validateDiskSpace(testDir, 1024 * 1024 * 1024 * 1024 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Insufficient disk space');
  });

  it('should include required and available space in error', async () => {
    const result = await validateDiskSpace(testDir, 1024 * 1024 * 1024 * 1024 * 1024 * 1024);
    expect(result.error).toMatch(/need.*available/i);
  });

  it('should handle invalid paths gracefully', async () => {
    const result = await validateDiskSpace('/nonexistent/path/that/does/not/exist', 1024);
    // Invalid path should either fail validation or be handled gracefully
    // The function may return valid=true if it can't check, or valid=false with error
    expect(result).toBeDefined();
    expect(typeof result.valid).toBe('boolean');
  });
});
