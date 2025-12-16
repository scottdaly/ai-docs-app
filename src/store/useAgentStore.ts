import { create } from 'zustand';

// Types for agent tool execution
export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentDocumentChange {
  type: 'create' | 'edit' | 'move' | 'delete' | 'create_folder';
  path: string;
  newPath?: string;
  contentBefore?: string;
  contentAfter?: string;
  /** Checkpoint ID created before the change, used for undo */
  preChangeCheckpointId?: string;
}

export interface AgentToolResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  change?: AgentDocumentChange;
}

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'pending_review'
  | 'error';

export interface PendingChange {
  toolCallId: string;
  change: AgentDocumentChange;
  timestamp: number;
}

interface AgentState {
  // Execution state
  status: AgentStatus;
  currentTool: string | null;
  error: string | null;

  // Pending changes waiting for user review
  pendingChanges: PendingChange[];

  // Checkpoint created before agent changes (for undo)
  preChangeCheckpointId: string | null;
  preChangeFilePath: string | null;

  // Track which changes have been accepted
  acceptedChanges: Set<string>;

  // Current workspace context
  workspaceRoot: string | null;

  // Actions
  setWorkspace: (workspaceRoot: string) => void;
  startExecution: () => void;
  setCurrentTool: (toolName: string | null) => void;
  setThinking: () => void;
  addPendingChange: (toolCallId: string, change: AgentDocumentChange) => void;
  setPreChangeCheckpoint: (checkpointId: string, filePath: string) => void;
  finishExecution: () => void;
  setError: (error: string) => void;

  // Review actions
  acceptChange: (toolCallId: string) => void;
  acceptAllChanges: () => void;
  undoAllChanges: () => Promise<boolean>;
  undoChange: (toolCallId: string) => Promise<boolean>;
  dismissChanges: () => void;

  // Reset
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  status: 'idle',
  currentTool: null,
  error: null,
  pendingChanges: [],
  preChangeCheckpointId: null,
  preChangeFilePath: null,
  acceptedChanges: new Set(),
  workspaceRoot: null,

  // Set workspace context
  setWorkspace: (workspaceRoot: string) => {
    set({ workspaceRoot });
  },

  // Start agent execution
  startExecution: () => {
    set({
      status: 'executing',
      currentTool: null,
      error: null,
      pendingChanges: [],
      acceptedChanges: new Set(),
    });
  },

  // Set current tool being executed
  setCurrentTool: (toolName: string | null) => {
    set({ currentTool: toolName });
  },

  // Set thinking state (agent is processing)
  setThinking: () => {
    set({ status: 'thinking', currentTool: null });
  },

  // Add a pending change for review
  addPendingChange: (toolCallId: string, change: AgentDocumentChange) => {
    set((state) => ({
      pendingChanges: [
        ...state.pendingChanges,
        { toolCallId, change, timestamp: Date.now() },
      ],
      status: 'pending_review',
    }));
  },

  // Store checkpoint for undo capability
  setPreChangeCheckpoint: (checkpointId: string, filePath: string) => {
    set({
      preChangeCheckpointId: checkpointId,
      preChangeFilePath: filePath,
    });
  },

  // Finish execution (move to review state if there are changes)
  finishExecution: () => {
    const { pendingChanges } = get();
    set({
      status: pendingChanges.length > 0 ? 'pending_review' : 'idle',
      currentTool: null,
    });
  },

  // Set error state (clears pending changes since they may be incomplete)
  setError: (error: string) => {
    set({
      status: 'error',
      error,
      currentTool: null,
      pendingChanges: [], // Clear pending changes on error
    });
  },

  // Accept a single change
  acceptChange: (toolCallId: string) => {
    set((state) => {
      const newAccepted = new Set(state.acceptedChanges);
      newAccepted.add(toolCallId);

      // If all changes are accepted, clear the pending state
      const allAccepted = state.pendingChanges.every((pc) =>
        newAccepted.has(pc.toolCallId)
      );

      return {
        acceptedChanges: newAccepted,
        status: allAccepted ? 'idle' : state.status,
        pendingChanges: allAccepted ? [] : state.pendingChanges,
        preChangeCheckpointId: allAccepted ? null : state.preChangeCheckpointId,
        preChangeFilePath: allAccepted ? null : state.preChangeFilePath,
      };
    });
  },

  // Accept all pending changes
  acceptAllChanges: () => {
    set({
      status: 'idle',
      pendingChanges: [],
      acceptedChanges: new Set(),
      preChangeCheckpointId: null,
      preChangeFilePath: null,
    });
  },

  // Undo all changes by restoring the pre-change checkpoint
  undoAllChanges: async () => {
    const { preChangeCheckpointId, preChangeFilePath, workspaceRoot } = get();

    if (!preChangeCheckpointId || !preChangeFilePath || !workspaceRoot) {
      console.warn('[AgentStore] Cannot undo: no checkpoint available');
      return false;
    }

    try {
      const result = await window.electronAPI.workspaceRestoreCheckpoint(
        workspaceRoot,
        preChangeFilePath,
        preChangeCheckpointId
      );

      if (result.success) {
        set({
          status: 'idle',
          pendingChanges: [],
          acceptedChanges: new Set(),
          preChangeCheckpointId: null,
          preChangeFilePath: null,
          error: null,
        });
        return true;
      } else {
        set({ error: result.error || 'Failed to undo changes' });
        return false;
      }
    } catch (error) {
      console.error('[AgentStore] Failed to undo changes:', error);
      set({ error: String(error) });
      return false;
    }
  },

  // Undo a specific change by restoring from its checkpoint
  undoChange: async (toolCallId: string) => {
    const { workspaceRoot, pendingChanges } = get();

    // Find the change to undo
    const changeToUndo = pendingChanges.find((pc) => pc.toolCallId === toolCallId);

    if (!changeToUndo) {
      console.warn('[AgentStore] Change not found:', toolCallId);
      return false;
    }

    // If the change has a checkpoint, restore from it
    if (changeToUndo.change.preChangeCheckpointId && workspaceRoot) {
      try {
        // Get the absolute file path
        const filePath = changeToUndo.change.path;

        const result = await window.electronAPI.workspaceRestoreCheckpoint(
          workspaceRoot,
          filePath,
          changeToUndo.change.preChangeCheckpointId
        );

        if (!result.success) {
          console.error('[AgentStore] Failed to restore checkpoint:', result.error);
          set({ error: result.error || 'Failed to undo change' });
          return false;
        }
      } catch (error) {
        console.error('[AgentStore] Failed to undo change:', error);
        set({ error: String(error) });
        return false;
      }
    }

    // Remove the change from pending
    set((state) => ({
      pendingChanges: state.pendingChanges.filter(
        (pc) => pc.toolCallId !== toolCallId
      ),
    }));

    // If no more pending changes, reset to idle
    const { pendingChanges: remaining } = get();
    if (remaining.length === 0) {
      set({
        status: 'idle',
        preChangeCheckpointId: null,
        preChangeFilePath: null,
      });
    }

    return true;
  },

  // Dismiss changes without undo (user acknowledges but doesn't want to revert)
  dismissChanges: () => {
    set({
      status: 'idle',
      pendingChanges: [],
      acceptedChanges: new Set(),
      preChangeCheckpointId: null,
      preChangeFilePath: null,
    });
  },

  // Reset all state
  reset: () => {
    set({
      status: 'idle',
      currentTool: null,
      error: null,
      pendingChanges: [],
      preChangeCheckpointId: null,
      preChangeFilePath: null,
      acceptedChanges: new Set(),
    });
  },
}));

// Selector hooks for common patterns
export const useAgentStatus = () => useAgentStore((state) => state.status);
export const useAgentPendingChanges = () =>
  useAgentStore((state) => state.pendingChanges);
export const useAgentError = () => useAgentStore((state) => state.error);
export const useAgentCurrentTool = () =>
  useAgentStore((state) => state.currentTool);
