import { create } from 'zustand';

// Checkpoint is the backend type (uses 'label' field)
interface Checkpoint {
  id: string;
  contentHash: string;
  sidecarHash: string;
  timestamp: string;
  parentId: string | null;
  type: 'auto' | 'bookmark';
  label?: string; // Backend uses 'label'
  description?: string;
  stats: {
    wordCount: number;
    charCount: number;
    changeSize: number;
  };
  trigger: string;
}

// Version is the frontend type (uses 'name' field for clarity)
// Represents a user-saved snapshot (what was previously called a "bookmark")
// Auto-checkpoints still exist in the backend but are hidden from the UI
export interface Version {
  id: string;
  contentHash: string;
  sidecarHash: string;
  timestamp: string;
  parentId: string | null;
  type: 'auto' | 'bookmark'; // 'bookmark' type = user-created version
  name?: string; // User-provided name (was 'label')
  description?: string; // Optional description
  stats: {
    wordCount: number;
    charCount: number;
    changeSize: number;
  };
  trigger: string;
}

interface VersionState {
  // Panel state
  isOpen: boolean;

  // Versions for current file (only user-created, not auto-saves)
  versions: Version[];
  isLoading: boolean;
  error: string | null;

  // Selected version for preview/compare
  selectedVersionId: string | null;
  compareVersionId: string | null;

  // Preview content
  previewContent: any | null;
  isLoadingPreview: boolean;

  // Compare mode
  isCompareMode: boolean;
  isLoadingCompare: boolean;
  compareContent: { contentA: any; contentB: any } | null;
  compareRequestId: number; // Track request ID to ignore stale responses

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  loadVersions: (workspaceRoot: string, filePath: string) => Promise<void>;
  clearVersions: () => void;

  selectVersion: (id: string | null) => void;
  loadPreview: (workspaceRoot: string, filePath: string, versionId: string) => Promise<void>;
  clearPreview: () => void;

  restoreVersion: (workspaceRoot: string, filePath: string, versionId: string) => Promise<any | null>;

  // Compare
  startCompare: (versionId: string) => void;
  cancelCompare: () => void;
  loadCompare: (workspaceRoot: string, filePath: string, idA: string, idB: string) => Promise<void>;

  // Version management
  saveVersion: (workspaceRoot: string, filePath: string, json: any, name: string, description?: string) => Promise<boolean>;
  renameVersion: (workspaceRoot: string, filePath: string, versionId: string, name: string) => Promise<boolean>;
}

export const useVersionStore = create<VersionState>((set, get) => ({
  // Initial state
  isOpen: false,
  versions: [],
  isLoading: false,
  error: null,
  selectedVersionId: null,
  compareVersionId: null,
  previewContent: null,
  isLoadingPreview: false,
  isCompareMode: false,
  isLoadingCompare: false,
  compareContent: null,
  compareRequestId: 0,

  // Panel actions
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({
    isOpen: false,
    selectedVersionId: null,
    previewContent: null,
    isCompareMode: false,
    isLoadingCompare: false,
    compareVersionId: null,
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

  // Load versions for current file (only user-created versions, not auto-saves)
  loadVersions: async (workspaceRoot: string, filePath: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.workspaceGetCheckpoints(workspaceRoot, filePath);

      if (result.success && result.checkpoints) {
        // Filter to only show user-created versions (bookmarks), not auto-saves
        // Map backend 'label' field to frontend 'name' field
        const userVersions = result.checkpoints
          .filter((cp: Checkpoint) => cp.type === 'bookmark')
          .map((cp: Checkpoint): Version => ({
            ...cp,
            name: cp.label, // Map backend 'label' to frontend 'name'
          }));
        // Sort by timestamp descending (newest first)
        const sorted = [...userVersions].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        set({ versions: sorted, isLoading: false });
      } else {
        set({
          versions: [],
          isLoading: false,
          error: result.error || 'Failed to load versions'
        });
      }
    } catch (error) {
      set({
        versions: [],
        isLoading: false,
        error: String(error)
      });
    }
  },

  clearVersions: () => set({
    versions: [],
    selectedVersionId: null,
    previewContent: null,
    isCompareMode: false,
    isLoadingCompare: false,
    compareVersionId: null,
    compareContent: null,
  }),

  // Selection
  selectVersion: (id: string | null) => {
    const { isCompareMode, compareVersionId } = get();

    if (isCompareMode && id && compareVersionId) {
      // In compare mode, clicking selects the second version
      set({ selectedVersionId: id });
    } else {
      set({
        selectedVersionId: id,
        previewContent: null,
        isCompareMode: false,
        compareVersionId: null,
        compareContent: null,
      });
    }
  },

  // Preview
  loadPreview: async (workspaceRoot: string, filePath: string, versionId: string) => {
    set({ isLoadingPreview: true });

    try {
      const result = await window.electronAPI.workspaceGetCheckpointContent(
        workspaceRoot,
        filePath,
        versionId
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

  clearPreview: () => set({ previewContent: null, selectedVersionId: null }),

  // Restore
  restoreVersion: async (workspaceRoot: string, filePath: string, versionId: string) => {
    try {
      const result = await window.electronAPI.workspaceRestoreCheckpoint(
        workspaceRoot,
        filePath,
        versionId
      );

      if (result.success && result.content) {
        // Clear selection after restore
        set({ selectedVersionId: null, previewContent: null });
        return result.content;
      }
      return null;
    } catch (error) {
      console.error('Failed to restore version:', error);
      return null;
    }
  },

  // Compare
  startCompare: (versionId: string) => {
    set({
      isCompareMode: true,
      compareVersionId: versionId,
      selectedVersionId: null,
      compareContent: null,
    });
  },

  cancelCompare: () => {
    // Increment requestId to invalidate any in-flight requests
    set((state) => ({
      isCompareMode: false,
      isLoadingCompare: false,
      compareVersionId: null,
      selectedVersionId: null,
      compareContent: null,
      compareRequestId: state.compareRequestId + 1,
    }));
  },

  loadCompare: async (workspaceRoot: string, filePath: string, idA: string, idB: string) => {
    // Increment request ID and capture it for this request
    const requestId = get().compareRequestId + 1;
    set({ isLoadingCompare: true, compareRequestId: requestId });

    try {
      const result = await window.electronAPI.workspaceCompareCheckpoints(
        workspaceRoot,
        filePath,
        idA,
        idB
      );

      // Check if this request is still current (not cancelled or superseded)
      if (get().compareRequestId !== requestId) {
        return; // Stale request, ignore response
      }

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
      // Only update state if request is still current
      if (get().compareRequestId === requestId) {
        console.error('Failed to load compare:', error);
        set({ isLoadingCompare: false });
      }
    }
  },

  // Save a new version (was createBookmark)
  saveVersion: async (workspaceRoot: string, filePath: string, json: any, name: string, description?: string) => {
    set({ error: null });
    try {
      const result = await window.electronAPI.workspaceCreateBookmark(
        workspaceRoot,
        filePath,
        json,
        name,
        description
      );

      if (result.success) {
        // Reload versions to show new one
        await get().loadVersions(workspaceRoot, filePath);
        return true;
      }
      set({ error: result.error || 'Failed to save version' });
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save version';
      console.error('Failed to save version:', error);
      set({ error: errorMsg });
      return false;
    }
  },

  // Rename an existing version (was labelCheckpoint)
  renameVersion: async (workspaceRoot: string, filePath: string, versionId: string, name: string) => {
    set({ error: null });
    try {
      const result = await window.electronAPI.workspaceLabelCheckpoint(
        workspaceRoot,
        filePath,
        versionId,
        name
      );

      if (result.success) {
        // Reload versions to show updated name
        await get().loadVersions(workspaceRoot, filePath);
        return true;
      }
      set({ error: result.error || 'Failed to rename version' });
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to rename version';
      console.error('Failed to rename version:', error);
      set({ error: errorMsg });
      return false;
    }
  },
}));
