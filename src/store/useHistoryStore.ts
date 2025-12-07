import { create } from 'zustand';

interface Checkpoint {
  id: string;
  contentHash: string;
  sidecarHash: string;
  timestamp: string;
  parentId: string | null;
  type: 'auto' | 'bookmark';
  label?: string;
  stats: {
    wordCount: number;
    charCount: number;
    changeSize: number;
  };
  trigger: string;
}

interface HistoryState {
  // Panel state
  isOpen: boolean;

  // Checkpoints for current file
  checkpoints: Checkpoint[];
  isLoading: boolean;
  error: string | null;

  // Selected checkpoint for preview/compare
  selectedCheckpointId: string | null;
  compareCheckpointId: string | null;

  // Preview content
  previewContent: any | null;
  isLoadingPreview: boolean;

  // Compare mode
  isCompareMode: boolean;
  isLoadingCompare: boolean;
  compareContent: { contentA: any; contentB: any } | null;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  loadCheckpoints: (workspaceRoot: string, filePath: string) => Promise<void>;
  clearCheckpoints: () => void;

  selectCheckpoint: (id: string | null) => void;
  loadPreview: (workspaceRoot: string, filePath: string, checkpointId: string) => Promise<void>;
  clearPreview: () => void;

  restoreCheckpoint: (workspaceRoot: string, filePath: string, checkpointId: string) => Promise<any | null>;

  // Compare
  startCompare: (checkpointId: string) => void;
  cancelCompare: () => void;
  loadCompare: (workspaceRoot: string, filePath: string, idA: string, idB: string) => Promise<void>;

  // Bookmarks
  createBookmark: (workspaceRoot: string, filePath: string, json: any, label: string) => Promise<boolean>;
  labelCheckpoint: (workspaceRoot: string, filePath: string, checkpointId: string, label: string) => Promise<boolean>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  // Initial state
  isOpen: false,
  checkpoints: [],
  isLoading: false,
  error: null,
  selectedCheckpointId: null,
  compareCheckpointId: null,
  previewContent: null,
  isLoadingPreview: false,
  isCompareMode: false,
  isLoadingCompare: false,
  compareContent: null,

  // Panel actions
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({
    isOpen: false,
    selectedCheckpointId: null,
    previewContent: null,
    isCompareMode: false,
    isLoadingCompare: false,
    compareCheckpointId: null,
    compareContent: null,
  }),
  togglePanel: () => {
    const { isOpen, closePanel, openPanel } = get();
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  },

  // Load checkpoints for current file
  loadCheckpoints: async (workspaceRoot: string, filePath: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.workspaceGetCheckpoints(workspaceRoot, filePath);

      if (result.success && result.checkpoints) {
        // Sort by timestamp descending (newest first)
        const sorted = [...result.checkpoints].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        set({ checkpoints: sorted, isLoading: false });
      } else {
        set({
          checkpoints: [],
          isLoading: false,
          error: result.error || 'Failed to load checkpoints'
        });
      }
    } catch (error) {
      set({
        checkpoints: [],
        isLoading: false,
        error: String(error)
      });
    }
  },

  clearCheckpoints: () => set({
    checkpoints: [],
    selectedCheckpointId: null,
    previewContent: null,
    isCompareMode: false,
    isLoadingCompare: false,
    compareCheckpointId: null,
    compareContent: null,
  }),

  // Selection
  selectCheckpoint: (id: string | null) => {
    const { isCompareMode, compareCheckpointId } = get();

    if (isCompareMode && id && compareCheckpointId) {
      // In compare mode, clicking selects the second checkpoint
      set({ selectedCheckpointId: id });
    } else {
      set({
        selectedCheckpointId: id,
        previewContent: null,
        isCompareMode: false,
        compareCheckpointId: null,
        compareContent: null,
      });
    }
  },

  // Preview
  loadPreview: async (workspaceRoot: string, filePath: string, checkpointId: string) => {
    set({ isLoadingPreview: true });

    try {
      const result = await window.electronAPI.workspaceGetCheckpointContent(
        workspaceRoot,
        filePath,
        checkpointId
      );

      if (result.success && result.content) {
        set({ previewContent: result.content, isLoadingPreview: false });
      } else {
        set({ previewContent: null, isLoadingPreview: false });
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      set({ previewContent: null, isLoadingPreview: false });
    }
  },

  clearPreview: () => set({ previewContent: null, selectedCheckpointId: null }),

  // Restore
  restoreCheckpoint: async (workspaceRoot: string, filePath: string, checkpointId: string) => {
    try {
      const result = await window.electronAPI.workspaceRestoreCheckpoint(
        workspaceRoot,
        filePath,
        checkpointId
      );

      if (result.success && result.content) {
        // Clear selection after restore
        set({ selectedCheckpointId: null, previewContent: null });
        return result.content;
      }
      return null;
    } catch (error) {
      console.error('Failed to restore checkpoint:', error);
      return null;
    }
  },

  // Compare
  startCompare: (checkpointId: string) => {
    set({
      isCompareMode: true,
      compareCheckpointId: checkpointId,
      selectedCheckpointId: null,
      compareContent: null,
    });
  },

  cancelCompare: () => {
    set({
      isCompareMode: false,
      isLoadingCompare: false,
      compareCheckpointId: null,
      selectedCheckpointId: null,
      compareContent: null,
    });
  },

  loadCompare: async (workspaceRoot: string, filePath: string, idA: string, idB: string) => {
    set({ isLoadingCompare: true });
    try {
      const result = await window.electronAPI.workspaceCompareCheckpoints(
        workspaceRoot,
        filePath,
        idA,
        idB
      );

      if (result.success && result.contentA && result.contentB) {
        set({
          compareContent: {
            contentA: result.contentA,
            contentB: result.contentB
          },
          isLoadingCompare: false,
        });
      } else {
        set({ isLoadingCompare: false });
      }
    } catch (error) {
      console.error('Failed to load compare:', error);
      set({ isLoadingCompare: false });
    }
  },

  // Bookmarks
  createBookmark: async (workspaceRoot: string, filePath: string, json: any, label: string) => {
    try {
      const result = await window.electronAPI.workspaceCreateBookmark(
        workspaceRoot,
        filePath,
        json,
        label
      );

      if (result.success) {
        // Reload checkpoints to show new bookmark
        await get().loadCheckpoints(workspaceRoot, filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create bookmark:', error);
      return false;
    }
  },

  labelCheckpoint: async (workspaceRoot: string, filePath: string, checkpointId: string, label: string) => {
    try {
      const result = await window.electronAPI.workspaceLabelCheckpoint(
        workspaceRoot,
        filePath,
        checkpointId,
        label
      );

      if (result.success) {
        // Reload checkpoints to show updated label
        await get().loadCheckpoints(workspaceRoot, filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to label checkpoint:', error);
      return false;
    }
  },
}));
