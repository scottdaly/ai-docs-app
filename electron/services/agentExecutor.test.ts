/**
 * Tests for AgentExecutor security features
 *
 * Tests cover:
 * - Path traversal prevention
 * - Hidden file/folder blocking
 * - .midlight directory protection
 * - Input validation for tool arguments
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AgentExecutor, ToolCall } from './agentExecutor';

describe('AgentExecutor Security', () => {
  let testDir: string;
  let executor: AgentExecutor;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-'));
    executor = new AgentExecutor(testDir);

    // Create some test files
    await fs.writeFile(path.join(testDir, 'test.md'), '# Test Document\n\nContent here.');
    await fs.mkdir(path.join(testDir, 'subfolder'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'subfolder', 'nested.md'), '# Nested Doc');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Path Traversal Prevention', () => {
    it('should block path traversal with ../', async () => {
      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'read_document',
        arguments: { path: '../../../etc/passwd' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Path traversal not allowed');
    });

    it('should block path traversal with encoded sequences', async () => {
      const toolCall: ToolCall = {
        id: 'test-2',
        name: 'read_document',
        arguments: { path: '..%2F..%2Fetc%2Fpasswd' },
      };

      const result = await executor.executeToolCall(toolCall);
      // Should either fail with path traversal or file not found (not a security breach)
      expect(result.success).toBe(false);
    });

    it('should block absolute paths outside workspace', async () => {
      // Note: path.resolve normalizes /etc/passwd relative to workspace
      // So we test with a clearly outside path using ../
      const toolCall: ToolCall = {
        id: 'test-3',
        name: 'read_document',
        arguments: { path: '../../../../../../etc/passwd' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Path traversal not allowed');
    });

    it('should allow valid paths within workspace', async () => {
      const toolCall: ToolCall = {
        id: 'test-4',
        name: 'read_document',
        arguments: { path: 'test.md' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should allow nested paths within workspace', async () => {
      const toolCall: ToolCall = {
        id: 'test-5',
        name: 'read_document',
        arguments: { path: 'subfolder/nested.md' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(true);
    });
  });

  describe('Hidden File/Folder Protection', () => {
    it('should block access to .git directory', async () => {
      const toolCall: ToolCall = {
        id: 'test-6',
        name: 'read_document',
        arguments: { path: '.git/config' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('hidden');
    });

    it('should block access to .env file', async () => {
      const toolCall: ToolCall = {
        id: 'test-7',
        name: 'read_document',
        arguments: { path: '.env' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('hidden');
    });

    it('should block creating files in hidden folders', async () => {
      const toolCall: ToolCall = {
        id: 'test-8',
        name: 'create_document',
        arguments: { name: 'secret', folder: '.hidden', content: 'secret content' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('hidden');
    });

    it('should block access to hidden files in subdirectories', async () => {
      const toolCall: ToolCall = {
        id: 'test-9',
        name: 'read_document',
        arguments: { path: 'subfolder/.hidden' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('hidden');
    });
  });

  describe('.midlight Directory Protection', () => {
    it('should block direct access to .midlight', async () => {
      const toolCall: ToolCall = {
        id: 'test-10',
        name: 'read_document',
        arguments: { path: '.midlight/config' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      // Should be blocked by .midlight check or hidden file check
      expect(result.error).toMatch(/hidden|\.midlight/);
    });

    it('should block access via path traversal to .midlight', async () => {
      const toolCall: ToolCall = {
        id: 'test-11',
        name: 'read_document',
        arguments: { path: 'subfolder/../.midlight/objects' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
    });

    it('should block creating files in .midlight', async () => {
      const toolCall: ToolCall = {
        id: 'test-12',
        name: 'create_document',
        arguments: { name: 'test', folder: '.midlight', content: 'hack' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject read_document without path', async () => {
      const toolCall: ToolCall = {
        id: 'test-13',
        name: 'read_document',
        arguments: {},
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
      expect(result.error).toContain('required');
    });

    it('should reject create_document without name', async () => {
      const toolCall: ToolCall = {
        id: 'test-14',
        name: 'create_document',
        arguments: { content: 'some content' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('name');
      expect(result.error).toContain('required');
    });

    it('should reject edit_document without path', async () => {
      const toolCall: ToolCall = {
        id: 'test-15',
        name: 'edit_document',
        arguments: { operation: 'replace', content: 'new content' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
    });

    it('should reject edit_document with invalid operation', async () => {
      const toolCall: ToolCall = {
        id: 'test-16',
        name: 'edit_document',
        arguments: { path: 'test.md', operation: 'invalid', content: 'new content' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('operation');
    });

    it('should reject move_document without from_path', async () => {
      const toolCall: ToolCall = {
        id: 'test-17',
        name: 'move_document',
        arguments: { to_path: 'newname.md' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('from_path');
    });

    it('should reject move_document without to_path', async () => {
      const toolCall: ToolCall = {
        id: 'test-18',
        name: 'move_document',
        arguments: { from_path: 'test.md' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('to_path');
    });

    it('should reject delete_document without path', async () => {
      const toolCall: ToolCall = {
        id: 'test-19',
        name: 'delete_document',
        arguments: {},
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
    });

    it('should reject search_documents without query', async () => {
      const toolCall: ToolCall = {
        id: 'test-20',
        name: 'search_documents',
        arguments: {},
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('query');
    });

    it('should accept valid edit_document operations', async () => {
      // Valid operations: replace, append, prepend
      for (const operation of ['replace', 'append', 'prepend']) {
        const toolCall: ToolCall = {
          id: `test-op-${operation}`,
          name: 'edit_document',
          arguments: { path: 'test.md', operation, content: 'new content' },
        };

        const result = await executor.executeToolCall(toolCall);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Workspace Validation', () => {
    it('should reject invalid workspace root (empty string)', () => {
      expect(() => new AgentExecutor('')).toThrow('Invalid workspace root');
    });

    it('should reject invalid workspace root (relative path)', () => {
      expect(() => new AgentExecutor('./relative/path')).toThrow('absolute path');
    });

    it('should accept valid absolute workspace path', () => {
      expect(() => new AgentExecutor('/tmp/valid-workspace')).not.toThrow();
    });
  });

  describe('Change Tracking', () => {
    it('should return change object for create_document', async () => {
      const toolCall: ToolCall = {
        id: 'test-create',
        name: 'create_document',
        arguments: { name: 'newdoc', content: 'hello world' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(true);
      expect(result.change).toBeDefined();
      expect(result.change?.type).toBe('create');
      expect(result.change?.path).toBe('newdoc.md');
    });

    it('should return change object with content for edit_document', async () => {
      const toolCall: ToolCall = {
        id: 'test-edit',
        name: 'edit_document',
        arguments: { path: 'test.md', operation: 'replace', content: 'updated content' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(true);
      expect(result.change).toBeDefined();
      expect(result.change?.type).toBe('edit');
      expect(result.change?.contentBefore).toBeDefined();
      expect(result.change?.contentAfter).toBe('updated content');
    });

    it('should return change object for delete_document', async () => {
      const toolCall: ToolCall = {
        id: 'test-delete',
        name: 'delete_document',
        arguments: { path: 'test.md' },
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(true);
      expect(result.change).toBeDefined();
      expect(result.change?.type).toBe('delete');
    });

    it('should not return change object for read-only tools', async () => {
      const toolCall: ToolCall = {
        id: 'test-list',
        name: 'list_documents',
        arguments: {},
      };

      const result = await executor.executeToolCall(toolCall);
      expect(result.success).toBe(true);
      expect(result.change).toBeUndefined();
    });
  });
});
