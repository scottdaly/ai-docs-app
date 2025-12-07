import { useEffect } from 'react';
import { X, GitBranch, Plus, Loader2 } from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';
import { useFileSystem } from '../store/useFileSystem';
import { DraftItem } from './DraftItem';
import { CreateDraftModal } from './CreateDraftModal';

interface DraftPanelProps {
  onSwitchToDraft: (content: any) => void;
  onSwitchToMain: () => void;
  getCurrentContent: () => any;
}

export function DraftPanel({ onSwitchToDraft, onSwitchToMain, getCurrentContent }: DraftPanelProps) {
  const { rootDir, activeFilePath } = useFileSystem();
  const {
    isOpen,
    closePanel,
    drafts,
    isLoading,
    error,
    activeDraftId,
    activeDraft,
    isCreateModalOpen,
    loadDrafts,
    clearDrafts,
    openDraft,
    closeDraft,
    renameDraft,
    applyDraft,
    discardDraft,
    deleteDraft,
    openCreateModal,
    closeCreateModal,
    createDraft,
    createDraftFromCheckpoint,
    createFromCheckpointId,
  } = useDraftStore();

  // Load drafts when panel opens or file changes
  useEffect(() => {
    if (isOpen && rootDir && activeFilePath) {
      loadDrafts(rootDir, activeFilePath);
    } else if (!isOpen) {
      clearDrafts();
    }
  }, [isOpen, rootDir, activeFilePath, loadDrafts, clearDrafts]);

  if (!isOpen) {
    return null;
  }

  const handleOpenDraft = async (draftId: string) => {
    if (!rootDir || !activeFilePath) return;

    const content = await openDraft(rootDir, activeFilePath, draftId);
    if (content) {
      onSwitchToDraft(content);
    }
  };

  const handleCloseDraft = () => {
    closeDraft();
    onSwitchToMain();
  };

  const handleRenameDraft = async (draftId: string, newName: string) => {
    if (!rootDir || !activeFilePath) return;
    await renameDraft(rootDir, activeFilePath, draftId, newName);
  };

  const handleApplyDraft = async (draftId: string) => {
    if (!rootDir || !activeFilePath) return;

    const confirmed = window.confirm(
      'Apply this draft to the main document? This will replace your current content.'
    );
    if (!confirmed) return;

    const content = await applyDraft(rootDir, activeFilePath, draftId);
    if (content) {
      onSwitchToMain();
      // The editor will need to load the new content - handled by parent
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    if (!rootDir || !activeFilePath) return;

    const confirmed = window.confirm(
      'Discard this draft? It will be archived and no longer appear in your drafts list.'
    );
    if (!confirmed) return;

    const success = await discardDraft(rootDir, activeFilePath, draftId);
    if (success && activeDraftId === draftId) {
      onSwitchToMain();
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!rootDir || !activeFilePath) return;

    const confirmed = window.confirm(
      'Permanently delete this draft? This cannot be undone.'
    );
    if (!confirmed) return;

    const success = await deleteDraft(rootDir, activeFilePath, draftId);
    if (success && activeDraftId === draftId) {
      onSwitchToMain();
    }
  };

  const handleCreateDraft = async (name: string) => {
    if (!rootDir || !activeFilePath) return;

    let draft;
    if (createFromCheckpointId) {
      draft = await createDraftFromCheckpoint(rootDir, activeFilePath, name, createFromCheckpointId);
    } else {
      const currentContent = getCurrentContent();
      draft = await createDraft(rootDir, activeFilePath, name, currentContent);
    }

    if (draft) {
      closeCreateModal();
      // Optionally open the new draft immediately
      const content = await openDraft(rootDir, activeFilePath, draft.id);
      if (content) {
        onSwitchToDraft(content);
      }
    }
  };

  const activeDrafts = drafts.filter(d => d.status === 'active');

  return (
    <>
      {/* Create Draft Modal */}
      {isCreateModalOpen && (
        <CreateDraftModal
          onClose={closeCreateModal}
          onCreate={handleCreateDraft}
          isFromCheckpoint={!!createFromCheckpointId}
        />
      )}

      <div className="w-72 border-l bg-muted/10 flex flex-col h-full">
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-muted-foreground" />
            <span className="font-medium text-sm">Drafts</span>
          </div>
          <button
            onClick={closePanel}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Active draft indicator */}
        {activeDraft && (
          <div className="p-2 bg-purple-500/10 border-b border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch size={12} className="text-purple-600" />
                <span className="text-xs text-purple-600 font-medium truncate">
                  Editing: {activeDraft.name}
                </span>
              </div>
              <button
                onClick={handleCloseDraft}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                Exit draft
              </button>
            </div>
          </div>
        )}

        {/* Create button */}
        <div className="p-3 border-b">
          <button
            onClick={() => openCreateModal()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            New Draft
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-sm text-destructive">
              {error}
            </div>
          ) : activeDrafts.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No drafts yet.
              <br />
              <span className="text-xs">
                Create a draft to experiment with changes without affecting your main document.
              </span>
            </div>
          ) : (
            activeDrafts.map(draft => (
              <DraftItem
                key={draft.id}
                draft={draft}
                isActive={activeDraftId === draft.id}
                onOpen={() => handleOpenDraft(draft.id)}
                onRename={(newName) => handleRenameDraft(draft.id, newName)}
                onApply={() => handleApplyDraft(draft.id)}
                onDiscard={() => handleDiscardDraft(draft.id)}
                onDelete={() => handleDeleteDraft(draft.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {!isLoading && activeDrafts.length > 0 && (
          <div className="p-3 border-t text-center text-xs text-muted-foreground">
            {activeDrafts.length} draft{activeDrafts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </>
  );
}
