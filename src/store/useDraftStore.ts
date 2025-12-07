import { create } from 'zustand';

interface DraftState {
  // Panel state
  isOpen: boolean;

  // Drafts for current file
  drafts: DraftListItem[];
  isLoading: boolean;
  error: string | null;

  // Currently active draft (if editing a draft instead of main doc)
  activeDraftId: string | null;
  activeDraft: Draft | null;

  // Create draft modal state
  isCreateModalOpen: boolean;
  createFromCheckpointId: string | null;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  loadDrafts: (workspaceRoot: string, filePath: string) => Promise<void>;
  clearDrafts: () => void;

  createDraft: (workspaceRoot: string, filePath: string, name: string, json: any) => Promise<Draft | null>;
  createDraftFromCheckpoint: (workspaceRoot: string, filePath: string, name: string, checkpointId: string) => Promise<Draft | null>;

  openDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<any | null>;
  closeDraft: () => void;

  saveDraftContent: (workspaceRoot: string, filePath: string, json: any) => Promise<void>;

  renameDraft: (workspaceRoot: string, filePath: string, draftId: string, newName: string) => Promise<boolean>;
  applyDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<any | null>;
  discardDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<boolean>;
  deleteDraft: (workspaceRoot: string, filePath: string, draftId: string) => Promise<boolean>;

  // Create modal actions
  openCreateModal: (checkpointId?: string) => void;
  closeCreateModal: () => void;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  // Initial state
  isOpen: false,
  drafts: [],
  isLoading: false,
  error: null,
  activeDraftId: null,
  activeDraft: null,
  isCreateModalOpen: false,
  createFromCheckpointId: null,

  // Panel actions
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  // Load drafts for current file
  loadDrafts: async (workspaceRoot: string, filePath: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.workspaceGetDrafts(workspaceRoot, filePath);

      if (result.success && result.drafts) {
        set({ drafts: result.drafts, isLoading: false });
      } else {
        set({
          drafts: [],
          isLoading: false,
          error: result.error || 'Failed to load drafts'
        });
      }
    } catch (error) {
      set({
        drafts: [],
        isLoading: false,
        error: String(error)
      });
    }
  },

  clearDrafts: () => set({
    drafts: [],
    activeDraftId: null,
    activeDraft: null,
  }),

  // Create draft from current content
  createDraft: async (workspaceRoot: string, filePath: string, name: string, json: any) => {
    try {
      const result = await window.electronAPI.workspaceCreateDraft(
        workspaceRoot,
        filePath,
        name,
        json
      );

      if (result.success && result.draft) {
        // Reload drafts to show new one
        await get().loadDrafts(workspaceRoot, filePath);
        return result.draft;
      }
      return null;
    } catch (error) {
      console.error('Failed to create draft:', error);
      return null;
    }
  },

  // Create draft from checkpoint
  createDraftFromCheckpoint: async (workspaceRoot: string, filePath: string, name: string, checkpointId: string) => {
    try {
      const result = await window.electronAPI.workspaceCreateDraftFromCheckpoint(
        workspaceRoot,
        filePath,
        name,
        checkpointId
      );

      if (result.success && result.draft) {
        // Reload drafts to show new one
        await get().loadDrafts(workspaceRoot, filePath);
        return result.draft;
      }
      return null;
    } catch (error) {
      console.error('Failed to create draft from checkpoint:', error);
      return null;
    }
  },

  // Open a draft for editing
  openDraft: async (workspaceRoot: string, filePath: string, draftId: string) => {
    try {
      // Get draft metadata
      const draftResult = await window.electronAPI.workspaceGetDraft(
        workspaceRoot,
        filePath,
        draftId
      );

      if (!draftResult.success || !draftResult.draft) {
        return null;
      }

      // Get draft content
      const contentResult = await window.electronAPI.workspaceGetDraftContent(
        workspaceRoot,
        filePath,
        draftId
      );

      if (!contentResult.success || !contentResult.content) {
        return null;
      }

      set({
        activeDraftId: draftId,
        activeDraft: draftResult.draft,
      });

      return contentResult.content;
    } catch (error) {
      console.error('Failed to open draft:', error);
      return null;
    }
  },

  // Close draft and return to main document
  closeDraft: () => {
    set({
      activeDraftId: null,
      activeDraft: null,
    });
  },

  // Save content to active draft
  saveDraftContent: async (workspaceRoot: string, filePath: string, json: any) => {
    const { activeDraftId } = get();
    if (!activeDraftId) return;

    try {
      await window.electronAPI.workspaceSaveDraftContent(
        workspaceRoot,
        filePath,
        activeDraftId,
        json,
        'auto'
      );
    } catch (error) {
      console.error('Failed to save draft content:', error);
    }
  },

  // Rename a draft
  renameDraft: async (workspaceRoot: string, filePath: string, draftId: string, newName: string) => {
    try {
      const result = await window.electronAPI.workspaceRenameDraft(
        workspaceRoot,
        filePath,
        draftId,
        newName
      );

      if (result.success) {
        // Reload drafts to show updated name
        await get().loadDrafts(workspaceRoot, filePath);

        // Update active draft if it's the one being renamed
        if (get().activeDraftId === draftId && get().activeDraft) {
          set({
            activeDraft: { ...get().activeDraft!, name: newName }
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to rename draft:', error);
      return false;
    }
  },

  // Apply draft to main document
  applyDraft: async (workspaceRoot: string, filePath: string, draftId: string) => {
    try {
      const result = await window.electronAPI.workspaceApplyDraft(
        workspaceRoot,
        filePath,
        draftId
      );

      if (result.success && result.content) {
        // Clear draft state since it's now merged
        set({
          activeDraftId: null,
          activeDraft: null,
        });

        // Reload drafts
        await get().loadDrafts(workspaceRoot, filePath);

        return result.content;
      }
      return null;
    } catch (error) {
      console.error('Failed to apply draft:', error);
      return null;
    }
  },

  // Discard draft (archive without applying)
  discardDraft: async (workspaceRoot: string, filePath: string, draftId: string) => {
    try {
      const result = await window.electronAPI.workspaceDiscardDraft(
        workspaceRoot,
        filePath,
        draftId
      );

      if (result.success) {
        // If discarding active draft, close it
        if (get().activeDraftId === draftId) {
          set({
            activeDraftId: null,
            activeDraft: null,
          });
        }

        // Reload drafts
        await get().loadDrafts(workspaceRoot, filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to discard draft:', error);
      return false;
    }
  },

  // Delete draft permanently
  deleteDraft: async (workspaceRoot: string, filePath: string, draftId: string) => {
    try {
      const result = await window.electronAPI.workspaceDeleteDraft(
        workspaceRoot,
        filePath,
        draftId
      );

      if (result.success) {
        // If deleting active draft, close it
        if (get().activeDraftId === draftId) {
          set({
            activeDraftId: null,
            activeDraft: null,
          });
        }

        // Reload drafts
        await get().loadDrafts(workspaceRoot, filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete draft:', error);
      return false;
    }
  },

  // Create modal actions
  openCreateModal: (checkpointId?: string) => set({
    isCreateModalOpen: true,
    createFromCheckpointId: checkpointId || null,
  }),

  closeCreateModal: () => set({
    isCreateModalOpen: false,
    createFromCheckpointId: null,
  }),
}));
