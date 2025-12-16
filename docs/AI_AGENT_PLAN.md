# AI Agent Implementation Plan

## Overview

Transform Midlight's AI chat from a document-focused assistant into a robust agent capable of creating, editing, moving, and managing documents autonomously within the workspace.

**Approach:** Tool Calling with Optimistic Execution
**Pattern:** LLM proposes → App executes immediately → User sees diff → Approve or Undo

---

## Goals

1. **Autonomous document management** - Create, edit, delete, move, rename documents
2. **Multi-document operations** - Handle tasks spanning multiple files in one interaction
3. **User control** - Preview and approve actions before execution
4. **Safety** - Prevent accidental data loss with confirmations and undo support
5. **Extensibility** - Architecture that allows adding new capabilities over time

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           RENDERER (React)                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐    │
│  │  Chat UI    │───▶│ Action       │───▶│ Execute via IPC     │    │
│  │  + Input    │    │ Preview Modal│    │ (on user approval)  │    │
│  └─────────────┘    └──────────────┘    └─────────────────────┘    │
└────────────────────────────┬────────────────────────┬───────────────┘
                             │                        │
                         IPC │                    IPC │
                             ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS (Electron)                      │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐    │
│  │  LLM Service    │    │  Agent Executor                     │    │
│  │  (tool calling) │    │  - Validates actions                │    │
│  └────────┬────────┘    │  - Executes via workspaceManager    │    │
│           │             │  - Returns results                   │    │
│           ▼             └─────────────────────────────────────┘    │
│  ┌─────────────────┐                                               │
│  │  Backend API    │                                               │
│  │  /api/llm/chat  │                                               │
│  │  -with-tools    │                                               │
│  └─────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Chat UI** | User input, message display, trigger agent requests |
| **Action Preview** | Display proposed actions, allow approve/reject/edit |
| **LLM Service** | Send requests to backend with tool definitions |
| **Agent Executor** | Validate and execute approved actions safely |
| **Workspace Manager** | Actual file/document operations (existing) |

---

## Tool Definitions

### Core Tools

#### 1. `create_document`
Create a new document in the workspace.

```typescript
{
  name: "create_document",
  description: "Create a new document in the workspace. Use this when the user wants to create a new file, note, or document.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The name of the document (without extension)"
      },
      folder: {
        type: "string",
        description: "The folder path to create the document in. Use '/' for root. Optional - defaults to current folder or root."
      },
      content: {
        type: "string",
        description: "Initial content for the document in markdown format. Optional."
      },
      template: {
        type: "string",
        enum: ["blank", "meeting-notes", "todo-list", "journal"],
        description: "Template to use for the document. Optional, defaults to 'blank'."
      }
    },
    required: ["name"]
  }
}
```

#### 2. `edit_document`
Edit an existing document's content.

```typescript
{
  name: "edit_document",
  description: "Edit the content of an existing document. Can replace entire content or make targeted edits.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the document to edit"
      },
      operation: {
        type: "string",
        enum: ["replace", "append", "prepend", "insert"],
        description: "The type of edit operation"
      },
      content: {
        type: "string",
        description: "The content to add or replace with (markdown format)"
      },
      position: {
        type: "object",
        description: "For 'insert' operation - where to insert content",
        properties: {
          after_heading: { type: "string" },
          line_number: { type: "integer" }
        }
      }
    },
    required: ["path", "operation", "content"]
  }
}
```

#### 3. `read_document`
Read a document's content (for context in multi-step operations).

```typescript
{
  name: "read_document",
  description: "Read the content of a document. Use this to get context about existing documents before editing or to answer questions about document content.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the document to read"
      }
    },
    required: ["path"]
  }
}
```

#### 4. `delete_document`
Delete a document (moves to trash/creates backup).

```typescript
{
  name: "delete_document",
  description: "Delete a document from the workspace. The document will be moved to trash and can be recovered.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the document to delete"
      }
    },
    required: ["path"]
  }
}
```

#### 5. `move_document`
Move or rename a document.

```typescript
{
  name: "move_document",
  description: "Move a document to a different folder or rename it.",
  parameters: {
    type: "object",
    properties: {
      from_path: {
        type: "string",
        description: "Current path of the document"
      },
      to_path: {
        type: "string",
        description: "New path for the document (including new name if renaming)"
      }
    },
    required: ["from_path", "to_path"]
  }
}
```

#### 6. `list_documents`
List documents in a folder.

```typescript
{
  name: "list_documents",
  description: "List all documents in a folder. Use this to explore the workspace structure or find documents.",
  parameters: {
    type: "object",
    properties: {
      folder: {
        type: "string",
        description: "The folder path to list. Use '/' for root. Optional - defaults to root."
      },
      recursive: {
        type: "boolean",
        description: "Whether to list documents in subfolders. Defaults to false."
      }
    }
  }
}
```

#### 7. `search_documents`
Search for documents by content or name.

```typescript
{
  name: "search_documents",
  description: "Search for documents by name or content.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      },
      search_content: {
        type: "boolean",
        description: "Whether to search document content (not just names). Defaults to true."
      },
      folder: {
        type: "string",
        description: "Limit search to a specific folder. Optional."
      }
    },
    required: ["query"]
  }
}
```

#### 8. `create_folder`
Create a new folder.

```typescript
{
  name: "create_folder",
  description: "Create a new folder in the workspace.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path for the new folder"
      }
    },
    required: ["path"]
  }
}
```

### Tool Categories by Risk Level

| Risk Level | Tools | Execution Mode |
|------------|-------|----------------|
| **Read-only** | `read_document`, `list_documents`, `search_documents` | Silent execute (no diff needed) |
| **Creative** | `create_document`, `create_folder` | Execute → Show diff → Undo available |
| **Modifying** | `edit_document`, `move_document` | Execute → Show diff → Undo available |
| **Destructive** | `delete_document` | **Require approval before execution** |

### Execution Philosophy

**Optimistic execution** - Most actions are applied immediately:
- User sees results instantly (fast, fluid UX)
- Diff view shows exactly what changed
- One-click undo reverts all changes
- Builds on existing checkpoint system for safe rollback

**Pre-approval only for destructive actions:**
- Deleting documents
- Any action that cannot be easily undone
- Bulk operations affecting >10 files (configurable)

---

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)

**Goal:** Basic tool calling with single-action execution

#### 1.1 Create Agent Executor Service

**File:** `electron/services/agentExecutor.ts`

```typescript
import { getWorkspaceManager } from './workspaceManager';
import path from 'path';
import fs from 'fs/promises';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface AgentContext {
  workspaceRoot: string;
  currentFilePath?: string;
}

// Tool definitions for LLM
export const AGENT_TOOLS = [
  {
    name: 'list_documents',
    description: 'List all documents in a folder. Use this to explore the workspace structure.',
    parameters: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description: 'Folder path relative to workspace root. Use "/" for root.'
        },
        recursive: {
          type: 'boolean',
          description: 'Include subdirectories. Defaults to false.'
        }
      }
    }
  },
  {
    name: 'read_document',
    description: 'Read the content of a document.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Document path relative to workspace' }
      },
      required: ['path']
    }
  },
  {
    name: 'create_document',
    description: 'Create a new document.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Document name (without .md extension)' },
        folder: { type: 'string', description: 'Folder path. Defaults to root.' },
        content: { type: 'string', description: 'Initial markdown content' }
      },
      required: ['name']
    }
  },
  {
    name: 'edit_document',
    description: 'Edit an existing document.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Document path' },
        operation: {
          type: 'string',
          enum: ['replace', 'append', 'prepend'],
          description: 'Edit operation type'
        },
        content: { type: 'string', description: 'Content to add/replace' }
      },
      required: ['path', 'operation', 'content']
    }
  },
  {
    name: 'move_document',
    description: 'Move or rename a document.',
    parameters: {
      type: 'object',
      properties: {
        from_path: { type: 'string', description: 'Current path' },
        to_path: { type: 'string', description: 'New path' }
      },
      required: ['from_path', 'to_path']
    }
  },
  {
    name: 'delete_document',
    description: 'Delete a document. Requires user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Document path to delete' }
      },
      required: ['path']
    }
  },
  {
    name: 'create_folder',
    description: 'Create a new folder.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Folder path to create' }
      },
      required: ['path']
    }
  },
  {
    name: 'search_documents',
    description: 'Search for documents by name or content.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        search_content: { type: 'boolean', description: 'Search file content. Defaults to true.' }
      },
      required: ['query']
    }
  }
];

// Tools that require pre-approval (destructive)
export const DESTRUCTIVE_TOOLS = ['delete_document'];

// Tools that are read-only (no diff needed)
export const READ_ONLY_TOOLS = ['list_documents', 'read_document', 'search_documents'];

export class AgentExecutor {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  // Validate path is within workspace (security)
  private validatePath(relativePath: string): string {
    const resolved = path.resolve(this.workspaceRoot, relativePath);
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal not allowed');
    }
    if (relativePath.includes('.midlight')) {
      throw new Error('Cannot access internal .midlight directory');
    }
    return resolved;
  }

  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    try {
      const result = await this.executeTool(toolCall.name, toolCall.arguments);
      return { toolCallId: toolCall.id, success: true, result };
    } catch (error: any) {
      return { toolCallId: toolCall.id, success: false, error: error.message };
    }
  }

  private async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const wm = getWorkspaceManager(this.workspaceRoot);

    switch (name) {
      case 'list_documents':
        return this.listDocuments(args.folder || '/', args.recursive || false);

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
        return this.searchDocuments(args.query, args.search_content ?? true);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Tool implementations...
  private async listDocuments(folder: string, recursive: boolean) {
    const folderPath = this.validatePath(folder);
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    const results: Array<{ name: string; path: string; type: 'file' | 'folder' }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden

      const entryPath = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        results.push({ name: entry.name, path: entryPath, type: 'folder' });
        if (recursive) {
          const subResults = await this.listDocuments(entryPath, true);
          results.push(...subResults.documents);
        }
      } else if (entry.name.endsWith('.md')) {
        results.push({ name: entry.name, path: entryPath, type: 'file' });
      }
    }

    return { documents: results, count: results.length };
  }

  private async readDocument(docPath: string) {
    const wm = getWorkspaceManager(this.workspaceRoot);
    const fullPath = this.validatePath(docPath);

    const loaded = await wm.loadDocument(fullPath);
    // Return markdown content (serialized from Tiptap JSON)
    const { serialize } = await import('./documentSerializer');
    const { markdown } = await serialize(loaded.json, loaded.sidecar || {});

    return { path: docPath, content: markdown };
  }

  private async createDocument(name: string, folder?: string, content?: string) {
    const folderPath = folder ? this.validatePath(folder) : this.workspaceRoot;
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const fullPath = path.join(folderPath, fileName);

    // Check if exists
    try {
      await fs.access(fullPath);
      throw new Error(`Document already exists: ${fileName}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    // Create with content
    const initialContent = content || '';
    await fs.writeFile(fullPath, initialContent, 'utf-8');

    return {
      path: path.relative(this.workspaceRoot, fullPath),
      created: true
    };
  }

  private async editDocument(docPath: string, operation: string, content: string) {
    const fullPath = this.validatePath(docPath);
    const wm = getWorkspaceManager(this.workspaceRoot);

    // Load current content
    const loaded = await wm.loadDocument(fullPath);
    const { serialize } = await import('./documentSerializer');
    const { markdown: currentContent } = await serialize(loaded.json, loaded.sidecar || {});

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

    // Convert back to Tiptap JSON and save
    const { deserialize } = await import('./documentDeserializer');
    const newJson = await deserialize(newContent, loaded.sidecar || {});
    await wm.saveDocument(fullPath, newJson, 'significant_change');

    return {
      path: docPath,
      operation,
      beforeLength: currentContent.length,
      afterLength: newContent.length
    };
  }

  private async moveDocument(fromPath: string, toPath: string) {
    const fullFromPath = this.validatePath(fromPath);
    const fullToPath = this.validatePath(toPath);

    await fs.rename(fullFromPath, fullToPath);

    // Also move sidecar if exists
    const sidecarFrom = fullFromPath.replace('.md', '.sidecar.json');
    const sidecarTo = fullToPath.replace('.md', '.sidecar.json');
    try {
      await fs.rename(sidecarFrom, sidecarTo);
    } catch (e) {
      // Sidecar may not exist
    }

    return { from: fromPath, to: toPath, moved: true };
  }

  private async deleteDocument(docPath: string) {
    const fullPath = this.validatePath(docPath);

    // Move to trash instead of hard delete
    const trashDir = path.join(this.workspaceRoot, '.midlight', 'trash');
    await fs.mkdir(trashDir, { recursive: true });

    const trashPath = path.join(trashDir, `${Date.now()}_${path.basename(docPath)}`);
    await fs.rename(fullPath, trashPath);

    return { path: docPath, deleted: true, recoverable: true };
  }

  private async createFolder(folderPath: string) {
    const fullPath = this.validatePath(folderPath);
    await fs.mkdir(fullPath, { recursive: true });
    return { path: folderPath, created: true };
  }

  private async searchDocuments(query: string, searchContent: boolean) {
    const results: Array<{ path: string; name: string; matches?: string[] }> = [];
    const queryLower = query.toLowerCase();

    const searchDir = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.workspaceRoot, fullPath);

        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          // Check name
          if (entry.name.toLowerCase().includes(queryLower)) {
            results.push({ path: relativePath, name: entry.name });
            continue;
          }

          // Check content
          if (searchContent) {
            const content = await fs.readFile(fullPath, 'utf-8');
            if (content.toLowerCase().includes(queryLower)) {
              // Extract matching snippets
              const lines = content.split('\n');
              const matches = lines
                .filter(l => l.toLowerCase().includes(queryLower))
                .slice(0, 3)
                .map(l => l.trim().substring(0, 100));

              results.push({ path: relativePath, name: entry.name, matches });
            }
          }
        }
      }
    };

    await searchDir(this.workspaceRoot);
    return { query, results, count: results.length };
  }
}
```

#### 1.2 Add IPC Handlers

**Add to:** `electron/main.ts`

```typescript
// Agent handlers
ipcMain.handle('agent:getTools', () => {
  return AGENT_TOOLS;
});

ipcMain.handle('agent:executeTools', async (_, workspaceRoot: string, toolCalls: ToolCall[]) => {
  const executor = new AgentExecutor(workspaceRoot);
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executor.executeToolCall(toolCall);
    results.push(result);
  }

  return results;
});

ipcMain.handle('agent:isDestructive', (_, toolName: string) => {
  return DESTRUCTIVE_TOOLS.includes(toolName);
});

ipcMain.handle('agent:isReadOnly', (_, toolName: string) => {
  return READ_ONLY_TOOLS.includes(toolName);
});
```

#### 1.3 Update Preload Bridge

**Add to:** `electron/preload.ts`

```typescript
agent: {
  getTools: () => ipcRenderer.invoke('agent:getTools'),
  executeTools: (workspaceRoot: string, toolCalls: ToolCall[]) =>
    ipcRenderer.invoke('agent:executeTools', workspaceRoot, toolCalls),
  isDestructive: (toolName: string) => ipcRenderer.invoke('agent:isDestructive', toolName),
  isReadOnly: (toolName: string) => ipcRenderer.invoke('agent:isReadOnly', toolName),
}
```

**Deliverables:**
- Agent executor service with all tool implementations
- IPC handlers for tool execution
- Security validation for paths

---

### Phase 2: Diff View & Undo System

**Goal:** Show changes inline with diff highlighting, enable easy undo

#### 2.1 Create Agent Store

**File:** `src/store/useAgentStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DocumentChange {
  path: string;
  type: 'created' | 'modified' | 'moved' | 'deleted';
  beforeContent?: string;
  afterContent?: string;
  fromPath?: string;  // For moves
  toPath?: string;
}

export interface AgentAction {
  id: string;
  tool: string;
  arguments: Record<string, any>;
  result: 'success' | 'error' | 'pending';
  error?: string;
  timestamp: number;
}

export interface AgentChangeRecord {
  id: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  checkpointId?: string;  // For rollback via checkpointManager

  actions: AgentAction[];
  changes: DocumentChange[];

  status: 'pending' | 'accepted' | 'undone';
}

export interface PendingConfirmation {
  id: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  onConfirm: () => void;
  onCancel: () => void;
}

interface AgentState {
  // Agent execution state
  isAgentRunning: boolean;
  currentAgentTask: string | null;
  agentProgress: { step: number; total: number; description: string } | null;

  // Change tracking
  pendingChanges: AgentChangeRecord | null;
  changeHistory: AgentChangeRecord[];

  // Confirmations (for destructive actions)
  pendingConfirmation: PendingConfirmation | null;

  // UI state
  showDiffForPath: string | null;  // Which doc to show diff for
  diffViewMode: 'inline' | 'side-by-side';

  // Actions
  startAgentTask: (task: string) => void;
  updateAgentProgress: (step: number, total: number, description: string) => void;
  endAgentTask: () => void;

  setPendingChanges: (changes: AgentChangeRecord | null) => void;
  acceptChanges: (changeId: string) => void;
  undoChanges: (changeId: string) => Promise<void>;

  requestConfirmation: (confirmation: PendingConfirmation) => void;
  clearConfirmation: () => void;

  setShowDiffForPath: (path: string | null) => void;
  setDiffViewMode: (mode: 'inline' | 'side-by-side') => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAgentRunning: false,
      currentAgentTask: null,
      agentProgress: null,
      pendingChanges: null,
      changeHistory: [],
      pendingConfirmation: null,
      showDiffForPath: null,
      diffViewMode: 'inline',

      // Agent lifecycle
      startAgentTask: (task) => set({
        isAgentRunning: true,
        currentAgentTask: task,
        agentProgress: null,
      }),

      updateAgentProgress: (step, total, description) => set({
        agentProgress: { step, total, description },
      }),

      endAgentTask: () => set({
        isAgentRunning: false,
        currentAgentTask: null,
        agentProgress: null,
      }),

      // Change management
      setPendingChanges: (changes) => set({ pendingChanges: changes }),

      acceptChanges: (changeId) => {
        const { pendingChanges, changeHistory } = get();
        if (pendingChanges?.id === changeId) {
          set({
            pendingChanges: null,
            changeHistory: [
              ...changeHistory,
              { ...pendingChanges, status: 'accepted' }
            ].slice(-50), // Keep last 50
            showDiffForPath: null,
          });
        }
      },

      undoChanges: async (changeId) => {
        const { pendingChanges, changeHistory } = get();
        const change = pendingChanges?.id === changeId
          ? pendingChanges
          : changeHistory.find(c => c.id === changeId);

        if (!change || !change.checkpointId) return;

        // Restore checkpoint via IPC
        for (const docChange of change.changes) {
          if (docChange.type === 'modified' && docChange.path) {
            const rootDir = window.electronAPI?.getRootDir?.();
            if (rootDir) {
              await window.electronAPI.workspaceRestoreCheckpoint(
                rootDir,
                docChange.path,
                change.checkpointId
              );
            }
          }
          // Handle other change types (created -> delete, moved -> move back, etc.)
        }

        // Update state
        if (pendingChanges?.id === changeId) {
          set({ pendingChanges: null, showDiffForPath: null });
        } else {
          set({
            changeHistory: changeHistory.map(c =>
              c.id === changeId ? { ...c, status: 'undone' } : c
            ),
          });
        }
      },

      // Confirmations
      requestConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),
      clearConfirmation: () => set({ pendingConfirmation: null }),

      // UI
      setShowDiffForPath: (path) => set({ showDiffForPath: path }),
      setDiffViewMode: (mode) => set({ diffViewMode: mode }),
    }),
    {
      name: 'midlight-agent',
      partialize: (state) => ({
        changeHistory: state.changeHistory.slice(-20),
        diffViewMode: state.diffViewMode,
      }),
    }
  )
);
```

#### 2.2 Create Diff Utilities

**File:** `src/utils/diffUtils.ts`

```typescript
export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber: { before?: number; after?: number };
}

export interface DiffResult {
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

/**
 * Simple line-by-line diff algorithm
 * For production, consider using 'diff' npm package
 */
export function computeDiff(before: string, after: string): DiffResult {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  const lines: DiffLine[] = [];
  let stats = { added: 0, removed: 0, unchanged: 0 };

  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(beforeLines, afterLines);

  let bi = 0, ai = 0, li = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    if (li < lcs.length && bi < beforeLines.length && beforeLines[bi] === lcs[li]) {
      // Check if after also matches
      if (ai < afterLines.length && afterLines[ai] === lcs[li]) {
        lines.push({
          type: 'unchanged',
          content: beforeLines[bi],
          lineNumber: { before: bi + 1, after: ai + 1 }
        });
        stats.unchanged++;
        bi++; ai++; li++;
      } else {
        // Added line in after
        lines.push({
          type: 'added',
          content: afterLines[ai],
          lineNumber: { after: ai + 1 }
        });
        stats.added++;
        ai++;
      }
    } else if (bi < beforeLines.length) {
      // Removed line from before
      lines.push({
        type: 'removed',
        content: beforeLines[bi],
        lineNumber: { before: bi + 1 }
      });
      stats.removed++;
      bi++;
    } else if (ai < afterLines.length) {
      // Added line in after
      lines.push({
        type: 'added',
        content: afterLines[ai],
        lineNumber: { after: ai + 1 }
      });
      stats.added++;
      ai++;
    }
  }

  return { lines, stats };
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Group consecutive changes for cleaner display
 */
export function groupDiffChanges(diff: DiffResult): Array<{
  type: 'unchanged' | 'changed';
  lines: DiffLine[];
}> {
  const groups: Array<{ type: 'unchanged' | 'changed'; lines: DiffLine[] }> = [];
  let currentGroup: { type: 'unchanged' | 'changed'; lines: DiffLine[] } | null = null;

  for (const line of diff.lines) {
    const groupType = line.type === 'unchanged' ? 'unchanged' : 'changed';

    if (!currentGroup || currentGroup.type !== groupType) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { type: groupType, lines: [] };
    }

    currentGroup.lines.push(line);
  }

  if (currentGroup) groups.push(currentGroup);

  return groups;
}
```

#### 2.3 Create AgentChangeBanner Component

**File:** `src/components/chat/AgentChangeBanner.tsx`

```typescript
import { useAgentStore } from '../../store/useAgentStore';
import { useFileSystem } from '../../store/useFileSystem';
import { RiCheckLine, RiArrowGoBackLine, RiEyeLine } from '@remixicon/react';

export function AgentChangeBanner() {
  const { pendingChanges, acceptChanges, undoChanges, setShowDiffForPath } = useAgentStore();
  const { openFile, files } = useFileSystem();

  if (!pendingChanges || pendingChanges.status !== 'pending') {
    return null;
  }

  const handleViewDiff = (path: string) => {
    // Open the file and show diff
    const file = files.find(f => f.path.endsWith(path));
    if (file) {
      openFile(file);
      setShowDiffForPath(path);
    }
  };

  const handleAccept = () => {
    acceptChanges(pendingChanges.id);
  };

  const handleUndo = async () => {
    await undoChanges(pendingChanges.id);
  };

  const changeCount = pendingChanges.changes.length;
  const actionCount = pendingChanges.actions.filter(a => a.result === 'success').length;

  return (
    <div className="mx-4 my-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
            <span className="text-base">✨</span>
            Changes Applied
          </div>

          <div className="mt-2 space-y-1">
            {pendingChanges.changes.slice(0, 5).map((change, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-16 text-emerald-400/70">
                  {change.type === 'created' && 'Created'}
                  {change.type === 'modified' && 'Edited'}
                  {change.type === 'moved' && 'Moved'}
                  {change.type === 'deleted' && 'Deleted'}
                </span>
                <button
                  onClick={() => handleViewDiff(change.path)}
                  className="hover:text-foreground hover:underline truncate"
                >
                  {change.path}
                </button>
              </div>
            ))}
            {changeCount > 5 && (
              <div className="text-xs text-muted-foreground">
                ...and {changeCount - 5} more
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDiff(pendingChanges.changes[0]?.path)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground
                       hover:text-foreground hover:bg-muted rounded transition-colors"
          >
            <RiEyeLine size={14} />
            View Diff
          </button>

          <button
            onClick={handleUndo}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground
                       hover:text-foreground hover:bg-muted rounded transition-colors"
          >
            <RiArrowGoBackLine size={14} />
            Undo
          </button>

          <button
            onClick={handleAccept}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-600
                       hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <RiCheckLine size={14} />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 2.4 Create DiffHighlight Tiptap Extension

**File:** `src/components/extensions/DiffHighlight.ts`

```typescript
import { Mark } from '@tiptap/core';

export interface DiffHighlightOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diffHighlight: {
      setDiffAdded: () => ReturnType;
      setDiffRemoved: () => ReturnType;
      unsetDiff: () => ReturnType;
    };
  }
}

export const DiffHighlight = Mark.create<DiffHighlightOptions>({
  name: 'diffHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'added',
        parseHTML: element => element.getAttribute('data-diff-type'),
        renderHTML: attributes => ({
          'data-diff-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-diff-type]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-diff-type'];
    const className = type === 'added'
      ? 'bg-emerald-500/20 text-emerald-300'
      : 'bg-red-500/20 text-red-300 line-through';

    return ['span', { ...HTMLAttributes, class: className }, 0];
  },

  addCommands() {
    return {
      setDiffAdded: () => ({ commands }) => {
        return commands.setMark(this.name, { type: 'added' });
      },
      setDiffRemoved: () => ({ commands }) => {
        return commands.setMark(this.name, { type: 'removed' });
      },
      unsetDiff: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});
```

#### 2.5 Integrate with Checkpoint System

**Add to Agent Executor:** Auto-create bookmarks before write operations

```typescript
// In agentExecutor.ts - wrap write operations

async executeToolCallWithCheckpoint(
  toolCall: ToolCall,
  affectedPaths: string[]
): Promise<{ result: ToolResult; checkpointId?: string }> {
  const wm = getWorkspaceManager(this.workspaceRoot);

  // Create checkpoint before modifying
  let checkpointId: string | undefined;

  if (!READ_ONLY_TOOLS.includes(toolCall.name)) {
    for (const docPath of affectedPaths) {
      try {
        const loaded = await wm.loadDocument(docPath);
        const checkpoint = await wm.createBookmark(
          docPath,
          loaded.json,
          `Before AI: ${toolCall.name}`,
          `Auto-checkpoint before agent action`
        );
        checkpointId = checkpoint?.id;
      } catch (e) {
        // File may not exist yet (create_document)
      }
    }
  }

  const result = await this.executeToolCall(toolCall);

  return { result, checkpointId };
}
```

**Deliverables:**
- Agent store with change tracking
- Diff computation utilities
- Change banner component in chat
- Tiptap extension for diff highlighting
- Checkpoint integration for undo

---

### Phase 3: Multi-Step Agent Loop

**Goal:** Handle complex tasks requiring observation and adaptation

#### 3.1 Agent Runner Service

**File:** `src/services/agentRunner.ts`

```typescript
import { useAgentStore } from '../store/useAgentStore';
import { useAIStore } from '../store/useAIStore';

export interface AgentConfig {
  maxIterations: number;
  maxTokensPerIteration: number;
  confirmDestructive: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 10,
  maxTokensPerIteration: 4000,
  confirmDestructive: true,
};

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: any }>;
  toolResults?: Array<{ toolCallId: string; result: any }>;
}

export class AgentRunner {
  private config: AgentConfig;
  private messages: AgentMessage[] = [];
  private cancelled = false;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, config: Partial<AgentConfig> = {}) {
    this.workspaceRoot = workspaceRoot;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  cancel() {
    this.cancelled = true;
  }

  async run(userPrompt: string, documentContext?: string): Promise<void> {
    const agentStore = useAgentStore.getState();
    const aiStore = useAIStore.getState();

    this.cancelled = false;
    agentStore.startAgentTask(userPrompt);

    try {
      // Build initial messages
      this.messages = [
        {
          role: 'user',
          content: this.buildUserPrompt(userPrompt, documentContext),
        },
      ];

      let iteration = 0;
      const allChanges: DocumentChange[] = [];
      const allActions: AgentAction[] = [];
      let checkpointId: string | undefined;

      while (iteration < this.config.maxIterations && !this.cancelled) {
        iteration++;
        agentStore.updateAgentProgress(iteration, this.config.maxIterations, 'Thinking...');

        // Call LLM with tools
        const response = await window.electronAPI.llm.chatWithTools({
          provider: aiStore.selectedProvider,
          model: aiStore.selectedModel,
          messages: this.buildApiMessages(),
          tools: await window.electronAPI.agent.getTools(),
          temperature: 0.7,
          requestType: 'agent',
        });

        // Check if LLM returned tool calls
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Agent is done - final response
          this.messages.push({
            role: 'assistant',
            content: response.content,
          });
          break;
        }

        // Process tool calls
        agentStore.updateAgentProgress(iteration, this.config.maxIterations, 'Executing actions...');

        // Check for destructive actions requiring confirmation
        const destructiveTools = response.toolCalls.filter(
          tc => DESTRUCTIVE_TOOLS.includes(tc.name)
        );

        if (destructiveTools.length > 0 && this.config.confirmDestructive) {
          // Wait for user confirmation
          const confirmed = await this.requestConfirmation(destructiveTools);
          if (!confirmed) {
            // User cancelled - stop agent
            this.messages.push({
              role: 'assistant',
              content: 'Action cancelled by user.',
            });
            break;
          }
        }

        // Execute tool calls
        const results = await window.electronAPI.agent.executeTools(
          this.workspaceRoot,
          response.toolCalls
        );

        // Track changes
        for (let i = 0; i < response.toolCalls.length; i++) {
          const toolCall = response.toolCalls[i];
          const result = results[i];

          allActions.push({
            id: toolCall.id,
            tool: toolCall.name,
            arguments: toolCall.arguments,
            result: result.success ? 'success' : 'error',
            error: result.error,
            timestamp: Date.now(),
          });

          // Build change record
          if (result.success && !READ_ONLY_TOOLS.includes(toolCall.name)) {
            const change = this.buildDocumentChange(toolCall, result);
            if (change) allChanges.push(change);
          }
        }

        // Add tool results to messages
        this.messages.push({
          role: 'assistant',
          content: response.content || '',
          toolCalls: response.toolCalls,
        });

        this.messages.push({
          role: 'tool_result',
          content: '',
          toolResults: results.map((r, i) => ({
            toolCallId: response.toolCalls[i].id,
            result: r.success ? r.result : { error: r.error },
          })),
        });
      }

      // Create change record for UI
      if (allChanges.length > 0) {
        const changeRecord: AgentChangeRecord = {
          id: `change-${Date.now()}`,
          conversationId: aiStore.activeConversationId || '',
          messageId: '', // Set by caller
          timestamp: Date.now(),
          checkpointId,
          actions: allActions,
          changes: allChanges,
          status: 'pending',
        };

        agentStore.setPendingChanges(changeRecord);
      }

    } finally {
      agentStore.endAgentTask();
    }
  }

  private buildUserPrompt(prompt: string, documentContext?: string): string {
    let fullPrompt = prompt;

    if (documentContext) {
      fullPrompt = `Current document context:\n<document>\n${documentContext}\n</document>\n\nUser request: ${prompt}`;
    }

    return fullPrompt;
  }

  private buildApiMessages(): Array<{ role: string; content: string }> {
    const apiMessages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: `You are an AI assistant helping manage documents in a workspace.
You have access to tools for reading, creating, editing, and organizing documents.

Guidelines:
- Use read_document or list_documents first to understand context
- Make changes incrementally
- For complex tasks, break them into steps
- Always confirm understanding before destructive actions
- Respond conversationally when done executing actions`,
      },
    ];

    for (const msg of this.messages) {
      if (msg.role === 'user') {
        apiMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        apiMessages.push({ role: 'assistant', content: msg.content });
      } else if (msg.role === 'tool_result' && msg.toolResults) {
        // Format tool results for the LLM
        const resultsText = msg.toolResults
          .map(r => `Tool ${r.toolCallId}: ${JSON.stringify(r.result)}`)
          .join('\n');
        apiMessages.push({ role: 'user', content: `Tool results:\n${resultsText}` });
      }
    }

    return apiMessages;
  }

  private async requestConfirmation(toolCalls: any[]): Promise<boolean> {
    return new Promise((resolve) => {
      const agentStore = useAgentStore.getState();

      agentStore.requestConfirmation({
        id: `confirm-${Date.now()}`,
        toolCalls,
        onConfirm: () => {
          agentStore.clearConfirmation();
          resolve(true);
        },
        onCancel: () => {
          agentStore.clearConfirmation();
          resolve(false);
        },
      });
    });
  }

  private buildDocumentChange(toolCall: any, result: any): DocumentChange | null {
    const args = toolCall.arguments;

    switch (toolCall.name) {
      case 'create_document':
        return {
          path: result.result?.path || args.name,
          type: 'created',
          afterContent: args.content,
        };

      case 'edit_document':
        return {
          path: args.path,
          type: 'modified',
          beforeContent: '', // Filled by executor
          afterContent: '', // Filled by executor
        };

      case 'move_document':
        return {
          path: args.to_path,
          type: 'moved',
          fromPath: args.from_path,
          toPath: args.to_path,
        };

      case 'delete_document':
        return {
          path: args.path,
          type: 'deleted',
        };

      default:
        return null;
    }
  }
}

// Constants imported from agentExecutor
const DESTRUCTIVE_TOOLS = ['delete_document'];
const READ_ONLY_TOOLS = ['list_documents', 'read_document', 'search_documents'];
```

#### 3.2 Agent Progress UI Component

**File:** `src/components/chat/AgentProgress.tsx`

```typescript
import { useAgentStore } from '../../store/useAgentStore';
import { RiLoader4Line, RiStopCircleLine } from '@remixicon/react';

interface AgentProgressProps {
  onCancel?: () => void;
}

export function AgentProgress({ onCancel }: AgentProgressProps) {
  const { isAgentRunning, currentAgentTask, agentProgress } = useAgentStore();

  if (!isAgentRunning) return null;

  const progressPercent = agentProgress
    ? Math.round((agentProgress.step / agentProgress.total) * 100)
    : 0;

  return (
    <div className="mx-4 my-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RiLoader4Line className="w-4 h-4 text-blue-400 animate-spin" />
          <div>
            <div className="text-sm text-blue-400 font-medium">
              Agent working...
            </div>
            {agentProgress && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Step {agentProgress.step} of {agentProgress.total}: {agentProgress.description}
              </div>
            )}
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground
                       hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <RiStopCircleLine size={14} />
            Cancel
          </button>
        )}
      </div>

      {agentProgress && (
        <div className="mt-2 h-1 bg-blue-500/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

#### 3.3 Confirmation Dialog Component

**File:** `src/components/chat/AgentConfirmation.tsx`

```typescript
import { useAgentStore } from '../../store/useAgentStore';
import { RiAlertLine, RiDeleteBinLine } from '@remixicon/react';

export function AgentConfirmation() {
  const { pendingConfirmation, clearConfirmation } = useAgentStore();

  if (!pendingConfirmation) return null;

  const { toolCalls, onConfirm, onCancel } = pendingConfirmation;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 text-amber-400">
            <RiAlertLine size={20} />
            <span className="font-medium">Confirm Action</span>
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            The AI wants to perform the following action(s) that cannot be easily undone:
          </p>

          <div className="space-y-2">
            {toolCalls.map((tc, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded"
              >
                <RiDeleteBinLine className="text-red-400" size={16} />
                <div className="flex-1 text-sm">
                  <span className="font-medium text-red-400">
                    {tc.name.replace('_', ' ')}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {tc.arguments.path || tc.arguments.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground
                       hover:bg-muted rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded
                       transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 3.4 Integrate with Chat UI

**Modify:** `src/components/chat/ChatPanel.tsx`

```typescript
// Add imports
import { AgentRunner } from '../../services/agentRunner';
import { AgentProgress } from './AgentProgress';
import { AgentChangeBanner } from './AgentChangeBanner';
import { AgentConfirmation } from './AgentConfirmation';

// In the component:
const [agentRunner, setAgentRunner] = useState<AgentRunner | null>(null);

const handleSendMessage = async (content: string) => {
  const { rootDir } = useFileSystem.getState();
  const { editorContent } = useFileSystem.getState();

  // Check if this looks like an agent request
  const isAgentRequest = detectAgentIntent(content);

  if (isAgentRequest && rootDir) {
    // Run as agent
    const runner = new AgentRunner(rootDir);
    setAgentRunner(runner);

    // Serialize current doc for context
    let docContext: string | undefined;
    if (editorContent) {
      // Convert Tiptap JSON to markdown for context
      docContext = await serializeForContext(editorContent);
    }

    await runner.run(content, docContext);
    setAgentRunner(null);
  } else {
    // Regular chat
    await sendChatMessage(content);
  }
};

const handleCancelAgent = () => {
  agentRunner?.cancel();
};

// Detect if message is asking agent to do something
function detectAgentIntent(message: string): boolean {
  const agentKeywords = [
    'create', 'make', 'new document', 'new file',
    'edit', 'modify', 'change', 'update',
    'delete', 'remove',
    'move', 'rename',
    'organize', 'sort',
    'find', 'search',
    'list', 'show me',
  ];

  const lower = message.toLowerCase();
  return agentKeywords.some(kw => lower.includes(kw));
}

// In render:
return (
  <div className="flex flex-col h-full">
    {/* Messages */}
    <div className="flex-1 overflow-auto">
      {/* ... existing message rendering ... */}
    </div>

    {/* Agent UI */}
    <AgentProgress onCancel={handleCancelAgent} />
    <AgentChangeBanner />
    <AgentConfirmation />

    {/* Input */}
    <ChatInput onSend={handleSendMessage} disabled={isAgentRunning} />
  </div>
);
```

**Deliverables:**
- Agent runner with iteration loop
- Progress indicator component
- Confirmation dialog for destructive actions
- Integration with existing chat UI

---

### Phase 4: Advanced Features

**Goal:** Polish and power-user features

**Tasks:**
1. Undo/Redo for agent actions
   - Leverage existing checkpoint system
   - "Undo last AI action" command
   - Batch undo for multi-action operations

2. Action templates and macros
   - Save common action sequences
   - Quick actions (e.g., "Create daily note")

3. Agent memory
   - Remember user preferences
   - Learn from corrections
   - Workspace-specific context

4. Keyboard shortcuts
   - Quick approve (Cmd+Enter)
   - Quick reject (Escape)
   - Undo last (Cmd+Z in chat)

**Deliverables:**
- Full undo support for AI actions
- Power-user shortcuts and templates
- Improved agent accuracy over time

---

## UI/UX Design

### Diff View (Inline in Editor)

When the agent edits a document, changes are shown inline with diff highlighting:

```
┌─────────────────────────────────────────────────────────────┐
│ Meeting Notes - Dec 15.md                      [AI Changed] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  # Meeting Notes                                            │
│                                                             │
│  ## Attendees                                               │
│  - John, Sarah, Mike                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ + ## Agenda                                    [added]  │ │
│ │ +                                                       │ │
│ │ + 1. Q4 Review                                          │ │
│ │ + 2. 2024 Planning                                      │ │
│ │ + 3. Budget Discussion                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ## Notes                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ - Meeting started at 2pm                     [removed]  │ │
│ │ + Meeting started at 2:30pm                   [added]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  AI made 2 changes              [Undo All]  [✓ Accept]      │
└─────────────────────────────────────────────────────────────┘
```

### Action Summary Banner

For multi-file operations, show a summary banner:

```
┌─────────────────────────────────────────────────────────────┐
│ ✨ AI completed 3 actions                                   │
│                                                             │
│  • Created Meeting Notes - Dec 15.md                       │
│  • Edited Project Roadmap.md (added 3 sections)            │
│  • Moved old-notes.md → /archive                           │
│                                                             │
│  [View Changes]                    [Undo All]  [✓ Accept]   │
└─────────────────────────────────────────────────────────────┘
```

### Chat Integration

```
┌─────────────────────────────────────────────────────────────┐
│ You: Create a meeting notes doc for today and add the      │
│      agenda items we discussed                              │
├─────────────────────────────────────────────────────────────┤
│ AI: Done! I created a meeting notes document and added     │
│     your agenda items.                                      │
│                                                             │
│     ┌─────────────────────────────────────────────────┐    │
│     │ ✨ Changes Applied                               │    │
│     │                                                  │    │
│     │ Created: Meeting Notes - Dec 15.md              │    │
│     │ Added: 5 agenda items                           │    │
│     │                                                  │    │
│     │ [View Diff]             [Undo]  [✓ Looks Good]  │    │
│     └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│ You: perfect, thanks!                                       │
├─────────────────────────────────────────────────────────────┤
│ AI: You're welcome! The changes have been saved.           │
└─────────────────────────────────────────────────────────────┘
```

### Destructive Action Confirmation (Pre-Approval)

Only shown for destructive actions like delete:

```
┌─────────────────────────────────────────────────────────────┐
│ You: Delete all the old meeting notes from 2023            │
├─────────────────────────────────────────────────────────────┤
│ AI: I found 8 meeting notes from 2023. This action cannot  │
│     be easily undone.                                       │
│                                                             │
│     ┌─────────────────────────────────────────────────┐    │
│     │ ⚠️  Confirm Deletion                            │    │
│     │                                                  │    │
│     │ Delete 8 documents:                             │    │
│     │ • Meeting Notes - Jan 15, 2023.md              │    │
│     │ • Meeting Notes - Feb 3, 2023.md               │    │
│     │ • ... and 6 more                               │    │
│     │                                                  │    │
│     │ [Show All Files]       [Cancel]  [🗑 Delete]    │    │
│     └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Agent Progress Indicator

```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent working...                              [Cancel]   │
│                                                             │
│ Step 3 of ~5                                               │
│ ████████████░░░░░░░░                                       │
│                                                             │
│ Current: Organizing files by date                          │
│ Done: Listed 24 files, created 3 folders                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Diff System Architecture

### Change Tracking Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT ACTION FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User Request                                                    │
│     │                                                               │
│     ▼                                                               │
│  2. LLM returns tool calls                                          │
│     │                                                               │
│     ▼                                                               │
│  3. BEFORE EXECUTION:                                               │
│     ├── Create checkpoint (via existing checkpointManager)          │
│     ├── Capture document state (content, metadata)                  │
│     └── Store in pendingChanges                                     │
│     │                                                               │
│     ▼                                                               │
│  4. EXECUTE ACTION                                                  │
│     ├── create_document → workspaceManager.createFile()             │
│     ├── edit_document → workspaceManager.saveFile()                 │
│     └── move_document → workspaceManager.moveFile()                 │
│     │                                                               │
│     ▼                                                               │
│  5. AFTER EXECUTION:                                                │
│     ├── Capture new document state                                  │
│     ├── Generate diff (before vs after)                             │
│     └── Store changeRecord with undo capability                     │
│     │                                                               │
│     ▼                                                               │
│  6. UPDATE UI                                                       │
│     ├── Show diff highlighting in editor                            │
│     ├── Display action summary in chat                              │
│     └── Enable Undo/Accept buttons                                  │
│     │                                                               │
│     ▼                                                               │
│  7. USER RESPONSE                                                   │
│     ├── [Accept] → Clear pending state, keep changes                │
│     └── [Undo] → Restore checkpoint, revert all changes             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Change Record Structure

```typescript
interface AgentChangeRecord {
  id: string;
  timestamp: number;
  checkpointId: string;           // For rollback

  actions: AgentAction[];         // What was executed

  changes: DocumentChange[];      // Per-document changes

  status: 'pending' | 'accepted' | 'undone';
}

interface AgentAction {
  tool: string;                   // e.g., 'create_document'
  parameters: Record<string, any>;
  result: 'success' | 'error';
  error?: string;
}

interface DocumentChange {
  path: string;
  type: 'created' | 'modified' | 'deleted' | 'moved';

  // For diff display
  beforeContent?: string;
  afterContent?: string;
  diff?: DiffLine[];

  // For moved files
  fromPath?: string;
  toPath?: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber: {
    before?: number;
    after?: number;
  };
}
```

### Diff Display Modes

**1. Inline Diff (Default)**
Show additions/deletions inline within the document:
- Green background for added lines
- Red background with strikethrough for removed lines
- Subtle highlighting, doesn't disrupt reading flow

**2. Side-by-Side Diff**
For complex changes, show before/after in split view:
- Left panel: original content
- Right panel: new content
- Connected highlighting for changed sections

**3. Summary View**
For multi-file operations:
- List of affected files
- Change type icon (created/modified/moved/deleted)
- Click to expand individual file diffs

### Integration with Existing Systems

**Checkpoint System:**
- Leverage `checkpointManager.ts` for state snapshots
- Auto-create checkpoint before agent actions
- Use `restoreCheckpoint()` for undo

**Document Serialization:**
- Use existing `documentSerializer.ts` for content capture
- Preserve Tiptap JSON structure for accurate diffs
- Handle sidecar files for rich formatting

**Editor State:**
- Extend Tiptap with diff decoration marks
- Custom extension for highlighting agent changes
- Sync diff state with `useFileSystem` store

---

## Security Considerations

### Path Validation

All document paths must be validated to prevent:
- Path traversal attacks (`../../../etc/passwd`)
- Access outside workspace root
- Access to hidden/system files

```typescript
function validatePath(path: string, workspaceRoot: string): boolean {
  const resolved = path.resolve(workspaceRoot, path);
  return resolved.startsWith(workspaceRoot) &&
         !path.includes('..') &&
         !basename(path).startsWith('.');
}
```

### Action Limits

Prevent runaway agents:
- Maximum actions per request: 20
- Maximum agent loop iterations: 10
- Rate limiting on destructive operations
- Automatic timeout for long-running operations

### Sensitive Files

Block operations on:
- `.midlight/` directory (internal state)
- Files matching `.env*`, `*credentials*`, `*secret*`
- System files (`.DS_Store`, `thumbs.db`)

### Audit Log

Log all agent actions for debugging and accountability:
```typescript
interface AgentAuditLog {
  timestamp: number;
  action: string;
  parameters: object;
  result: 'success' | 'error' | 'rejected';
  userId?: string;
}
```

---

## Error Handling

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| **Validation** | Invalid path, missing params | Return error, don't execute |
| **Permission** | Read-only file | Return error, suggest alternative |
| **Conflict** | File already exists | Ask user (overwrite/rename/cancel) |
| **System** | Disk full, I/O error | Return error, log details |
| **Agent** | Loop limit reached | Stop agent, summarize progress |

### Recovery Strategies

1. **Automatic retry** - For transient errors (file locked briefly)
2. **Partial completion** - Complete what's possible, report failures
3. **Rollback** - On critical failure, undo completed actions
4. **User intervention** - For conflicts requiring decision

### Error Response Format

```typescript
interface ActionResult {
  success: boolean;
  action: string;
  path?: string;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestions?: string[];
  };
  result?: {
    // Action-specific result data
  };
}
```

---

## Testing Strategy

### Unit Tests
- Tool parameter validation
- Path security checks
- Action execution logic

### Integration Tests
- Full flow: chat → tool call → preview → execute
- Multi-action batches
- Error handling paths

### E2E Tests
- User approves/rejects actions
- Agent completes multi-step task
- Undo/redo of agent actions

### Stress Tests
- Large batches of actions
- Concurrent agent requests
- Long-running agent loops

---

## Future Extensions

### Potential Additional Tools

- `get_document_history` - View version history
- `restore_version` - Restore from checkpoint
- `export_document` - Export to PDF/DOCX
- `import_document` - Import from external file
- `create_link` - Create internal links between docs
- `generate_summary` - AI-summarize a document
- `translate_document` - Translate content

### Potential Integrations

- **Calendar** - Create docs from calendar events
- **Web clipper** - Save web content as documents
- **Templates** - User-defined document templates
- **Plugins** - Third-party tool extensions

### Agent Modes

- **Autonomous** - Full auto-execution for trusted users
- **Supervised** - Current preview/approve flow
- **Restricted** - Read-only, no modifications
- **Custom** - User-defined permission sets

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Action success rate | > 95% |
| User approval rate | > 80% (indicates good suggestions) |
| Actions per conversation | Track increase over time |
| Time from request to completion | < 5s for simple, < 30s for complex |
| Undo usage rate | < 10% (indicates good previews) |

---

## Open Questions

1. **Offline support?** - Can agent work offline with local models?
2. **Collaboration** - How do agent actions work with real-time collab?
3. **Mobile** - Will agent features work on mobile apps?
4. **Pricing** - Separate quota for agent actions vs chat?

---

## Appendix: Sample Agent Conversations

### Example 1: Organizing Files (Optimistic Execution)

```
User: I have a bunch of loose notes in my root folder. Can you organize
      them into folders by topic?

AI: I'll analyze your documents and organize them by topic. Let me first
    see what's in your root folder.

    [Reading workspace...]

    Found 15 documents. I've identified these categories and organized
    them for you:

    ┌─────────────────────────────────────────────────┐
    │ ✨ Changes Applied                              │
    │                                                 │
    │ Created 3 folders:                             │
    │ • /work                                         │
    │ • /personal                                     │
    │ • /research                                     │
    │                                                 │
    │ Moved 15 documents:                             │
    │ • meeting-notes-dec.md → /work                  │
    │ • project-roadmap.md → /work                    │
    │ • journal-dec-14.md → /personal                 │
    │ • ... and 12 more                               │
    │                                                 │
    │ [View All]                [Undo All]  [✓ Done]  │
    └─────────────────────────────────────────────────┘

User: Actually, move the journal entries to a "journal" folder instead

AI: Done! I moved the 4 journal entries to a new /journal folder.

    ┌─────────────────────────────────────────────────┐
    │ ✨ Changes Applied                              │
    │                                                 │
    │ • Created /journal                              │
    │ • Moved 4 documents from /personal → /journal   │
    │                                                 │
    │ [View Changes]            [Undo]  [✓ Done]      │
    └─────────────────────────────────────────────────┘

User: Perfect!
```

### Example 2: Editing a Document (Diff View)

```
User: Add a "Next Steps" section to my project roadmap with action items
      for Q1

AI: Done! I added a "Next Steps" section to Project Roadmap.md.

    [Editor shows the document with diff highlighting:]

    ┌─────────────────────────────────────────────────┐
    │ Project Roadmap.md                 [AI Changed] │
    ├─────────────────────────────────────────────────┤
    │                                                 │
    │ ## Timeline                                     │
    │ ...existing content...                          │
    │                                                 │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ + ## Next Steps                    [added]  │ │
    │ │ +                                           │ │
    │ │ + ### Q1 Action Items                       │ │
    │ │ + - [ ] Finalize feature spec              │ │
    │ │ + - [ ] Complete design review             │ │
    │ │ + - [ ] Begin implementation               │ │
    │ │ + - [ ] Set up testing framework           │ │
    │ └─────────────────────────────────────────────┘ │
    │                                                 │
    ├─────────────────────────────────────────────────┤
    │  +8 lines added          [Undo]  [✓ Accept]     │
    └─────────────────────────────────────────────────┘
```

### Example 3: Destructive Action (Pre-Approval Required)

```
User: Delete all the meeting notes from 2023, I don't need them anymore

AI: I found 12 meeting notes from 2023. Since this will permanently
    delete files, I need your confirmation first.

    ┌─────────────────────────────────────────────────┐
    │ ⚠️  Confirm Deletion                           │
    │                                                 │
    │ This will delete 12 documents:                 │
    │                                                 │
    │ • Meeting Notes - Jan 15, 2023.md              │
    │ • Meeting Notes - Feb 3, 2023.md               │
    │ • Meeting Notes - Mar 22, 2023.md              │
    │ • Meeting Notes - Apr 10, 2023.md              │
    │ • ... and 8 more                               │
    │                                                 │
    │ [Show All]          [Cancel]  [🗑 Delete All]   │
    └─────────────────────────────────────────────────┘

User: [Clicks Delete All]

AI: Done! Deleted 12 meeting notes from 2023.
```
