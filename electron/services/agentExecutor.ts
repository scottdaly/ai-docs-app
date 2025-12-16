/**
 * AgentExecutor - Executes AI agent tool calls
 *
 * Handles document operations requested by the AI agent:
 * - list_documents, read_document, search_documents (read-only)
 * - create_document, edit_document, move_document, delete_document (write)
 * - create_folder (write)
 *
 * Integrates with WorkspaceManager for all file operations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getWorkspaceManager } from './workspaceManager';
import { DocumentSerializer } from './documentSerializer';
import { DocumentDeserializer } from './documentDeserializer';

// Tool call interface
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// Tool result interface
export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: any;
  error?: string;
  change?: DocumentChange;
}

// Document change tracking for diff/undo
// Type values aligned with frontend (useAgentStore.ts, vite-env.d.ts)
export interface DocumentChange {
  type: 'create' | 'edit' | 'move' | 'delete' | 'create_folder';
  path: string;
  newPath?: string;
  contentBefore?: string;
  contentAfter?: string;
  /** Checkpoint ID created before the change, used for undo */
  preChangeCheckpointId?: string;
}

// Tool definitions for LLM
export const AGENT_TOOLS = [
  {
    name: 'list_documents',
    description:
      'List all documents in a folder. Use this to explore the workspace structure or find documents.',
    parameters: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description:
            'Folder path relative to workspace root. Use "/" or empty string for root. Optional - defaults to root.',
        },
        recursive: {
          type: 'boolean',
          description: 'Include documents in subdirectories. Defaults to false.',
        },
      },
    },
  },
  {
    name: 'read_document',
    description:
      'Read the content of a document. Use this to get context about existing documents before editing.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Document path relative to workspace root (e.g., "notes/meeting.md")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_document',
    description: 'Create a new document in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Document name (without .md extension, will be added automatically)',
        },
        folder: {
          type: 'string',
          description: 'Folder path to create the document in. Optional - defaults to root.',
        },
        content: {
          type: 'string',
          description: 'Initial markdown content for the document. Optional.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'edit_document',
    description: 'Edit an existing document. Can replace, append, or prepend content.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Document path relative to workspace root',
        },
        operation: {
          type: 'string',
          enum: ['replace', 'append', 'prepend'],
          description:
            'Edit operation: "replace" replaces all content, "append" adds to end, "prepend" adds to beginning',
        },
        content: {
          type: 'string',
          description: 'The markdown content to add or replace with',
        },
      },
      required: ['path', 'operation', 'content'],
    },
  },
  {
    name: 'move_document',
    description: 'Move or rename a document.',
    parameters: {
      type: 'object',
      properties: {
        from_path: {
          type: 'string',
          description: 'Current path of the document',
        },
        to_path: {
          type: 'string',
          description: 'New path for the document (including new name if renaming)',
        },
      },
      required: ['from_path', 'to_path'],
    },
  },
  {
    name: 'delete_document',
    description:
      'Delete a document from the workspace. The document will be moved to trash and can be recovered.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path of the document to delete',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_folder',
    description: 'Create a new folder in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path for the new folder relative to workspace root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_documents',
    description: 'Search for documents by name or content.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
        search_content: {
          type: 'boolean',
          description: 'Whether to search document content (not just names). Defaults to true.',
        },
        folder: {
          type: 'string',
          description: 'Limit search to a specific folder. Optional.',
        },
      },
      required: ['query'],
    },
  },
];

// Tools that require pre-approval (destructive)
export const DESTRUCTIVE_TOOLS = ['delete_document'];

// Tools that are read-only (no diff needed)
export const READ_ONLY_TOOLS = ['list_documents', 'read_document', 'search_documents'];

/**
 * Agent Executor class - handles tool execution
 */
export class AgentExecutor {
  private workspaceRoot: string;
  private serializer: DocumentSerializer;
  private deserializer: DocumentDeserializer;
  private workspaceValidated: boolean = false;

  constructor(workspaceRoot: string) {
    // Validate workspace root parameter
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      throw new Error('Invalid workspace root: must be a non-empty string');
    }

    if (!path.isAbsolute(workspaceRoot)) {
      throw new Error('Invalid workspace root: must be an absolute path');
    }

    this.workspaceRoot = workspaceRoot;
    // Create serializer/deserializer without image manager (we'll use workspace manager for that)
    this.serializer = new DocumentSerializer(null);
    this.deserializer = new DocumentDeserializer(null);
  }

  /**
   * Ensure workspace exists and is a directory
   */
  private async ensureWorkspaceValid(): Promise<void> {
    if (this.workspaceValidated) return;

    try {
      const stats = await fs.stat(this.workspaceRoot);
      if (!stats.isDirectory()) {
        throw new Error('Workspace root is not a directory');
      }
      this.workspaceValidated = true;
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        throw new Error('Workspace does not exist');
      }
      throw e;
    }
  }

  /**
   * Validate that a path is within the workspace and safe
   */
  private validatePath(relativePath: string): string {
    // Normalize the path and strip leading slashes
    const normalized = path.normalize(relativePath).replace(/^[/\\]+/, '');

    // Resolve to absolute path
    const resolved = path.resolve(this.workspaceRoot, normalized);

    // Security: prevent path traversal - must be within workspace
    // Use path.sep to avoid matching partial directory names (e.g., workspace-extra)
    if (!resolved.startsWith(this.workspaceRoot + path.sep) && resolved !== this.workspaceRoot) {
      throw new Error('Path traversal not allowed: path must be within workspace');
    }

    // Security: prevent access to .midlight internal directory
    // Check all variations: exact match, prefix, or anywhere in path
    const normalizedLower = normalized.toLowerCase();
    if (
      normalizedLower === '.midlight' ||
      normalizedLower.startsWith('.midlight' + path.sep) ||
      normalizedLower.includes(path.sep + '.midlight' + path.sep) ||
      normalizedLower.endsWith(path.sep + '.midlight')
    ) {
      throw new Error('Cannot access internal .midlight directory');
    }

    // Security: prevent access to hidden files/folders (any path component starting with .)
    const parts = normalized.split(path.sep);
    for (const part of parts) {
      if (part.startsWith('.')) {
        throw new Error('Cannot access hidden files or folders');
      }
    }

    return resolved;
  }

  /**
   * Get relative path from absolute path
   */
  private getRelativePath(absolutePath: string): string {
    return path.relative(this.workspaceRoot, absolutePath);
  }

  /**
   * Validate tool arguments before execution
   */
  private validateToolArgs(name: string, args: Record<string, any>): void {
    const requireString = (field: string) => {
      if (!args[field] || typeof args[field] !== 'string') {
        throw new Error(`${name}: ${field} is required and must be a string`);
      }
    };

    switch (name) {
      case 'list_documents':
        // All fields are optional
        if (args.folder !== undefined && typeof args.folder !== 'string') {
          throw new Error('list_documents: folder must be a string');
        }
        break;

      case 'read_document':
        requireString('path');
        break;

      case 'create_document':
        requireString('name');
        if (args.content !== undefined && typeof args.content !== 'string') {
          throw new Error('create_document: content must be a string');
        }
        if (args.folder !== undefined && typeof args.folder !== 'string') {
          throw new Error('create_document: folder must be a string');
        }
        break;

      case 'edit_document':
        requireString('path');
        requireString('content');
        if (!args.operation || !['replace', 'append', 'prepend'].includes(args.operation)) {
          throw new Error('edit_document: operation must be replace, append, or prepend');
        }
        break;

      case 'move_document':
        requireString('from_path');
        requireString('to_path');
        break;

      case 'delete_document':
        requireString('path');
        break;

      case 'create_folder':
        requireString('path');
        break;

      case 'search_documents':
        requireString('query');
        break;
    }
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    try {
      const result = await this.executeTool(toolCall.name, toolCall.arguments);

      // Build change object for UI based on tool type
      const change = this.buildDocumentChange(toolCall.name, toolCall.arguments, result);

      return {
        toolCallId: toolCall.id,
        success: true,
        result,
        change,
      };
    } catch (error: any) {
      console.error(`[AgentExecutor] Tool ${toolCall.name} failed:`, error);
      return {
        toolCallId: toolCall.id,
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Build DocumentChange for UI based on tool execution
   */
  private buildDocumentChange(
    toolName: string,
    args: Record<string, any>,
    result: any
  ): DocumentChange | undefined {
    switch (toolName) {
      case 'create_document':
        return {
          type: 'create',
          path: result.path,
          contentAfter: args.content || '',
        };
      case 'edit_document':
        return {
          type: 'edit',
          path: result.path,
          contentBefore: result.beforeContent,
          contentAfter: result.afterContent,
          preChangeCheckpointId: result.preChangeCheckpointId,
        };
      case 'move_document':
        return {
          type: 'move',
          path: result.from,
          newPath: result.to,
        };
      case 'delete_document':
        return {
          type: 'delete',
          path: result.path,
          contentBefore: result.contentBefore,
          preChangeCheckpointId: result.preChangeCheckpointId,
        };
      case 'create_folder':
        return {
          type: 'create_folder',
          path: result.path,
        };
      default:
        // Read-only tools don't need change tracking
        return undefined;
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall);
      results.push(result);
    }

    return results;
  }

  /**
   * Route tool call to appropriate handler
   */
  private async executeTool(name: string, args: Record<string, any>): Promise<any> {
    // Ensure workspace exists before any operation
    await this.ensureWorkspaceValid();

    // Validate arguments before execution
    this.validateToolArgs(name, args);

    switch (name) {
      case 'list_documents':
        return this.listDocuments(args.folder || '', args.recursive || false);

      case 'read_document':
        return this.readDocument(args.path);

      case 'create_document':
        return this.createDocument(args.name, args.folder, args.content);

      case 'edit_document':
        return this.editDocument(args.path, args.operation, args.content);

      case 'move_document':
        return this.moveDocument(args.from_path, args.to_path);

      case 'delete_document':
        return this.deleteDocument(args.path);

      case 'create_folder':
        return this.createFolder(args.path);

      case 'search_documents':
        return this.searchDocuments(args.query, args.search_content ?? true, args.folder);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * List documents in a folder
   */
  private async listDocuments(
    folder: string,
    recursive: boolean
  ): Promise<{ documents: Array<{ name: string; path: string; type: 'file' | 'folder' }>; count: number }> {
    const folderPath = folder ? this.validatePath(folder) : this.workspaceRoot;

    const results: Array<{ name: string; path: string; type: 'file' | 'folder' }> = [];

    const scanDir = async (dir: string, relativeBase: string) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new Error(`Folder not found: ${folder || '/'}`);
        }
        throw e;
      }

      for (const entry of entries) {
        // Skip hidden files and .midlight
        if (entry.name.startsWith('.')) continue;

        const entryRelativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;

        if (entry.isDirectory()) {
          results.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'folder',
          });

          if (recursive) {
            await scanDir(path.join(dir, entry.name), entryRelativePath);
          }
        } else if (entry.name.endsWith('.md') && !entry.name.endsWith('.sidecar.json')) {
          results.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
          });
        }
      }
    };

    await scanDir(folderPath, folder ? folder.replace(/^[/\\]+/, '') : '');

    return {
      documents: results,
      count: results.length,
    };
  }

  /**
   * Read a document's content
   */
  private async readDocument(docPath: string): Promise<{ path: string; content: string; wordCount: number }> {
    const fullPath = this.validatePath(docPath);

    // Ensure .md extension
    const mdPath = fullPath.endsWith('.md') ? fullPath : `${fullPath}.md`;

    try {
      // Try to load via workspace manager for proper deserialization
      const wm = getWorkspaceManager(this.workspaceRoot);
      await wm.init();

      const loaded = await wm.loadDocument(mdPath);
      const { markdown } = await this.serializer.serialize(loaded.json);

      const wordCount = markdown.split(/\s+/).filter((w) => w.length > 0).length;

      return {
        path: this.getRelativePath(mdPath),
        content: markdown,
        wordCount,
      };
    } catch (e: any) {
      // Fallback to raw file read if workspace manager fails
      if (e.code === 'ENOENT') {
        throw new Error(`Document not found: ${docPath}`);
      }

      // Try raw read
      const content = await fs.readFile(mdPath, 'utf-8');
      const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;

      return {
        path: this.getRelativePath(mdPath),
        content,
        wordCount,
      };
    }
  }

  /**
   * Create a new document
   */
  private async createDocument(
    name: string,
    folder?: string,
    content?: string
  ): Promise<{ path: string; created: boolean }> {
    // Sanitize name - remove .md if included
    const cleanName = name.replace(/\.md$/i, '');
    const fileName = `${cleanName}.md`;

    // Determine folder path
    const folderPath = folder ? this.validatePath(folder) : this.workspaceRoot;
    const fullPath = path.join(folderPath, fileName);

    // Check if file already exists
    try {
      await fs.access(fullPath);
      throw new Error(`Document already exists: ${fileName}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });

    // Create the file
    const initialContent = content || '';
    await fs.writeFile(fullPath, initialContent, 'utf-8');

    return {
      path: this.getRelativePath(fullPath),
      created: true,
    };
  }

  /**
   * Edit an existing document
   */
  private async editDocument(
    docPath: string,
    operation: 'replace' | 'append' | 'prepend',
    content: string
  ): Promise<{
    path: string;
    operation: string;
    beforeLength: number;
    afterLength: number;
    beforeContent: string;
    afterContent: string;
    preChangeCheckpointId?: string;
  }> {
    const fullPath = this.validatePath(docPath);
    const mdPath = fullPath.endsWith('.md') ? fullPath : `${fullPath}.md`;

    // Load current content and create pre-change checkpoint
    let currentContent: string;
    let preChangeCheckpointId: string | undefined;

    try {
      const wm = getWorkspaceManager(this.workspaceRoot);
      await wm.init();

      // Load the document via workspace manager
      const loaded = await wm.loadDocument(mdPath);
      const { markdown } = await this.serializer.serialize(loaded.json);
      currentContent = markdown;

      // Create a checkpoint before making changes (for undo)
      const checkpoint = await wm.createBookmark(
        mdPath,
        loaded.json,
        'Pre-agent change',
        `Before ${operation} operation by AI agent`
      );
      if (checkpoint) {
        preChangeCheckpointId = checkpoint.id;
      }
    } catch (e: any) {
      // Fallback to raw file read if workspace manager fails
      if (e.code === 'ENOENT') {
        throw new Error(`Document not found: ${docPath}`);
      }
      // Try raw read as fallback
      try {
        currentContent = await fs.readFile(mdPath, 'utf-8');
      } catch (readErr: any) {
        if (readErr.code === 'ENOENT') {
          throw new Error(`Document not found: ${docPath}`);
        }
        throw readErr;
      }
    }

    // Apply operation
    let newContent: string;
    switch (operation) {
      case 'replace':
        newContent = content;
        break;
      case 'append':
        newContent = currentContent + '\n\n' + content;
        break;
      case 'prepend':
        newContent = content + '\n\n' + currentContent;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Save the file
    await fs.writeFile(mdPath, newContent, 'utf-8');

    // Try to save via workspace manager to create post-change checkpoint
    try {
      const wm = getWorkspaceManager(this.workspaceRoot);
      await wm.init();

      // Deserialize to Tiptap JSON
      const json = await this.deserializer.deserialize(newContent);
      await wm.saveDocument(mdPath, json, 'auto');
    } catch (e) {
      // Non-fatal - file is already saved
      console.warn('[AgentExecutor] Could not save via workspace manager:', e);
    }

    return {
      path: this.getRelativePath(mdPath),
      operation,
      beforeLength: currentContent.length,
      afterLength: newContent.length,
      beforeContent: currentContent,
      afterContent: newContent,
      preChangeCheckpointId,
    };
  }

  /**
   * Move or rename a document
   */
  private async moveDocument(
    fromPath: string,
    toPath: string
  ): Promise<{ from: string; to: string; moved: boolean }> {
    const fullFromPath = this.validatePath(fromPath);
    const fullToPath = this.validatePath(toPath);

    // Add .md extension if needed
    const mdFromPath = fullFromPath.endsWith('.md') ? fullFromPath : `${fullFromPath}.md`;
    const mdToPath = fullToPath.endsWith('.md') ? fullToPath : `${fullToPath}.md`;

    // Check source exists
    try {
      await fs.access(mdFromPath);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        throw new Error(`Source document not found: ${fromPath}`);
      }
      throw e;
    }

    // Check destination doesn't exist
    try {
      await fs.access(mdToPath);
      throw new Error(`Destination already exists: ${toPath}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(mdToPath), { recursive: true });

    // Move the file
    await fs.rename(mdFromPath, mdToPath);

    // Also move sidecar if exists
    const sidecarFrom = mdFromPath.replace(/\.md$/, '.sidecar.json');
    const sidecarTo = mdToPath.replace(/\.md$/, '.sidecar.json');
    try {
      await fs.rename(sidecarFrom, sidecarTo);
    } catch (e) {
      // Sidecar may not exist - that's ok
    }

    return {
      from: this.getRelativePath(mdFromPath),
      to: this.getRelativePath(mdToPath),
      moved: true,
    };
  }

  /**
   * Delete a document (moves to trash)
   */
  private async deleteDocument(docPath: string): Promise<{
    path: string;
    deleted: boolean;
    recoverable: boolean;
    preChangeCheckpointId?: string;
    contentBefore?: string;
  }> {
    const fullPath = this.validatePath(docPath);
    const mdPath = fullPath.endsWith('.md') ? fullPath : `${fullPath}.md`;

    // Create checkpoint before delete (for undo) and get content
    let preChangeCheckpointId: string | undefined;
    let contentBefore: string | undefined;

    try {
      const wm = getWorkspaceManager(this.workspaceRoot);
      await wm.init();

      // Load and create checkpoint
      const loaded = await wm.loadDocument(mdPath);
      const { markdown } = await this.serializer.serialize(loaded.json);
      contentBefore = markdown;

      const checkpoint = await wm.createBookmark(
        mdPath,
        loaded.json,
        'Pre-agent delete',
        'Before delete operation by AI agent'
      );
      if (checkpoint) {
        preChangeCheckpointId = checkpoint.id;
      }
    } catch (e: any) {
      // Check if file exists
      if (e.code === 'ENOENT') {
        throw new Error(`Document not found: ${docPath}`);
      }
      // Try to at least read the content for the diff
      try {
        contentBefore = await fs.readFile(mdPath, 'utf-8');
      } catch {
        // Can't read content, continue anyway
      }
    }

    // Move to trash instead of permanent delete
    const trashDir = path.join(this.workspaceRoot, '.midlight', 'trash');
    await fs.mkdir(trashDir, { recursive: true });

    const timestamp = Date.now();
    const trashName = `${timestamp}_${path.basename(mdPath)}`;
    const trashPath = path.join(trashDir, trashName);

    await fs.rename(mdPath, trashPath);

    // Also move sidecar to trash if exists
    const sidecarPath = mdPath.replace(/\.md$/, '.sidecar.json');
    try {
      const sidecarTrashPath = path.join(trashDir, `${timestamp}_${path.basename(sidecarPath)}`);
      await fs.rename(sidecarPath, sidecarTrashPath);
    } catch (e) {
      // Sidecar may not exist
    }

    return {
      path: this.getRelativePath(mdPath),
      deleted: true,
      recoverable: true,
      preChangeCheckpointId,
      contentBefore,
    };
  }

  /**
   * Create a new folder
   */
  private async createFolder(folderPath: string): Promise<{ path: string; created: boolean }> {
    const fullPath = this.validatePath(folderPath);

    await fs.mkdir(fullPath, { recursive: true });

    return {
      path: this.getRelativePath(fullPath),
      created: true,
    };
  }

  /**
   * Search for documents
   */
  private async searchDocuments(
    query: string,
    searchContent: boolean,
    folder?: string
  ): Promise<{
    query: string;
    results: Array<{ path: string; name: string; matches?: string[] }>;
    count: number;
  }> {
    const results: Array<{ path: string; name: string; matches?: string[] }> = [];
    const queryLower = query.toLowerCase();

    const searchDir = folder ? this.validatePath(folder) : this.workspaceRoot;

    const scanDir = async (dir: string) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (e) {
        return; // Skip inaccessible directories
      }

      for (const entry of entries) {
        // Skip hidden files and .midlight
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = this.getRelativePath(fullPath);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith('.md') && !entry.name.endsWith('.sidecar.json')) {
          // Check filename match
          if (entry.name.toLowerCase().includes(queryLower)) {
            results.push({
              path: relativePath,
              name: entry.name,
            });
            continue;
          }

          // Check content match
          if (searchContent) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              if (content.toLowerCase().includes(queryLower)) {
                // Extract matching snippets
                const lines = content.split('\n');
                const matches = lines
                  .filter((l) => l.toLowerCase().includes(queryLower))
                  .slice(0, 3)
                  .map((l) => l.trim().substring(0, 100));

                results.push({
                  path: relativePath,
                  name: entry.name,
                  matches,
                });
              }
            } catch (e) {
              // Skip unreadable files
            }
          }
        }
      }
    };

    await scanDir(searchDir);

    return {
      query,
      results,
      count: results.length,
    };
  }
}

/**
 * Check if a tool is destructive (requires confirmation)
 */
export function isDestructiveTool(toolName: string): boolean {
  return DESTRUCTIVE_TOOLS.includes(toolName);
}

/**
 * Check if a tool is read-only (no changes to files)
 */
export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.includes(toolName);
}
