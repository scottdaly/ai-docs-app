import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, Send, MessageSquare, Sparkles, History, GitBranch, Bookmark, Plus, Loader2 } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useDraftStore } from '../store/useDraftStore';
import { useFileSystem } from '../store/useFileSystem';
import { CheckpointItem } from './CheckpointItem';
import { CompareModal } from './CompareModal';
import { DraftItem } from './DraftItem';
import { CreateDraftModal } from './CreateDraftModal';

export type RightSidebarMode = 'ai' | 'history' | 'drafts' | null;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RightSidebarProps {
  mode: RightSidebarMode;
  onClose: () => void;
  onRestoreContent?: (content: any) => void;
  onSwitchToDraft?: (content: any) => void;
  onSwitchToMain?: () => void;
  getCurrentContent?: () => any;
}

export function RightSidebar({
  mode,
  onClose,
  onRestoreContent,
  onSwitchToDraft,
  onSwitchToMain,
  getCurrentContent,
}: RightSidebarProps) {
  if (!mode) return null;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full overflow-hidden border-l border-border">
      <div className="flex flex-col h-full bg-background overflow-hidden">
        {mode === 'ai' && <AIChatPanel onClose={onClose} />}
        {mode === 'history' && onRestoreContent && (
          <HistoryPanelContent onClose={onClose} onRestoreContent={onRestoreContent} />
        )}
        {mode === 'drafts' && onSwitchToDraft && onSwitchToMain && getCurrentContent && (
          <DraftPanelContent
            onClose={onClose}
            onSwitchToDraft={onSwitchToDraft}
            onSwitchToMain={onSwitchToMain}
            getCurrentContent={getCurrentContent}
          />
        )}
      </div>
    </div>
  );
}

// AI Chat Panel
function AIChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm your AI writing assistant. This feature is coming soon! I'll be able to help you with editing, brainstorming, and improving your documents.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h2 className="font-semibold text-sm">AI Assistant</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare size={40} className="mb-3 opacity-50" />
            <p className="text-sm font-medium">Start a conversation</p>
            <p className="text-xs mt-1">Ask me to help with your writing</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-3 border-t border-border bg-muted/20">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                       min-h-[40px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
}

// History Panel Content
function HistoryPanelContent({
  onClose,
  onRestoreContent,
}: {
  onClose: () => void;
  onRestoreContent: (content: any) => void;
}) {
  const { rootDir, activeFilePath } = useFileSystem();
  const {
    checkpoints,
    isLoading,
    error,
    selectedCheckpointId,
    isCompareMode,
    compareCheckpointId,
    compareContent,
    isLoadingCompare,
    loadCheckpoints,
    selectCheckpoint,
    restoreCheckpoint,
    startCompare,
    cancelCompare,
    loadCompare,
    labelCheckpoint,
  } = useHistoryStore();

  useEffect(() => {
    if (rootDir && activeFilePath) {
      loadCheckpoints(rootDir, activeFilePath);
    }
  }, [rootDir, activeFilePath, loadCheckpoints]);

  useEffect(() => {
    if (isCompareMode && selectedCheckpointId && compareCheckpointId && rootDir && activeFilePath) {
      loadCompare(rootDir, activeFilePath, compareCheckpointId, selectedCheckpointId);
    }
  }, [isCompareMode, selectedCheckpointId, compareCheckpointId, rootDir, activeFilePath, loadCompare]);

  const handleRestore = async (checkpointId: string) => {
    if (!rootDir || !activeFilePath) return;
    const confirmed = window.confirm('Restore this version? Your current changes will be replaced.');
    if (!confirmed) return;
    const content = await restoreCheckpoint(rootDir, activeFilePath, checkpointId);
    if (content) {
      onRestoreContent(content);
      loadCheckpoints(rootDir, activeFilePath);
    }
  };

  const handleCompare = (checkpointId: string) => {
    startCompare(checkpointId);
  };

  const handleLabel = async (checkpointId: string, label: string) => {
    if (!rootDir || !activeFilePath) return;
    await labelCheckpoint(rootDir, activeFilePath, checkpointId, label);
  };

  const bookmarks = checkpoints.filter(cp => cp.type === 'bookmark');
  const autoSaves = checkpoints.filter(cp => cp.type === 'auto');

  const compareSourceCheckpoint = useMemo(() => {
    return checkpoints.find(cp => cp.id === compareCheckpointId);
  }, [checkpoints, compareCheckpointId]);

  const compareTargetCheckpoint = useMemo(() => {
    return checkpoints.find(cp => cp.id === selectedCheckpointId);
  }, [checkpoints, selectedCheckpointId]);

  const showCompareModal = isCompareMode && compareContent && compareSourceCheckpoint && compareTargetCheckpoint;

  const handleRestoreFromCompare = async (checkpointId: string) => {
    if (!rootDir || !activeFilePath) return;
    try {
      const content = await restoreCheckpoint(rootDir, activeFilePath, checkpointId);
      if (content) {
        onRestoreContent(content);
        loadCheckpoints(rootDir, activeFilePath);
      }
    } finally {
      cancelCompare();
    }
  };

  return (
    <>
      {showCompareModal && (
        <CompareModal
          checkpointA={{
            id: compareSourceCheckpoint.id,
            label: compareSourceCheckpoint.label,
            timestamp: compareSourceCheckpoint.timestamp,
          }}
          checkpointB={{
            id: compareTargetCheckpoint.id,
            label: compareTargetCheckpoint.label,
            timestamp: compareTargetCheckpoint.timestamp,
          }}
          contentA={compareContent.contentA.markdown || ''}
          contentB={compareContent.contentB.markdown || ''}
          onClose={cancelCompare}
          onRestoreA={() => handleRestoreFromCompare(compareSourceCheckpoint.id)}
          onRestoreB={() => handleRestoreFromCompare(compareTargetCheckpoint.id)}
        />
      )}

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <History size={18} className="text-muted-foreground" />
          <h2 className="font-semibold text-sm">Version History</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {isCompareMode && (
        <div className="flex-shrink-0 p-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 font-medium flex items-center gap-2">
              {isLoadingCompare ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Loading comparison...
                </>
              ) : (
                'Select version to compare'
              )}
            </span>
            <button onClick={cancelCompare} className="text-xs text-blue-600 hover:text-blue-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-destructive">{error}</div>
        ) : checkpoints.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No version history yet.
            <br />
            <span className="text-xs">Versions are created automatically as you write.</span>
          </div>
        ) : (
          <>
            {bookmarks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bookmark size={12} className="text-yellow-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bookmarks</span>
                </div>
                <div className="space-y-2">
                  {bookmarks.map(checkpoint => (
                    <CheckpointItem
                      key={checkpoint.id}
                      checkpoint={checkpoint}
                      isSelected={selectedCheckpointId === checkpoint.id}
                      isCompareMode={isCompareMode}
                      isCompareSource={compareCheckpointId === checkpoint.id}
                      onSelect={() => selectCheckpoint(checkpoint.id)}
                      onRestore={() => handleRestore(checkpoint.id)}
                      onCompare={() => handleCompare(checkpoint.id)}
                      onLabel={(label) => handleLabel(checkpoint.id, label)}
                    />
                  ))}
                </div>
              </div>
            )}

            {autoSaves.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History size={12} className="text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auto-saves</span>
                </div>
                <div className="space-y-2">
                  {autoSaves.map(checkpoint => (
                    <CheckpointItem
                      key={checkpoint.id}
                      checkpoint={checkpoint}
                      isSelected={selectedCheckpointId === checkpoint.id}
                      isCompareMode={isCompareMode}
                      isCompareSource={compareCheckpointId === checkpoint.id}
                      onSelect={() => selectCheckpoint(checkpoint.id)}
                      onRestore={() => handleRestore(checkpoint.id)}
                      onCompare={() => handleCompare(checkpoint.id)}
                      onLabel={(label) => handleLabel(checkpoint.id, label)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!isLoading && checkpoints.length > 0 && (
        <div className="flex-shrink-0 p-3 border-t text-center text-xs text-muted-foreground">
          {checkpoints.length} version{checkpoints.length !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}

// Draft Panel Content
function DraftPanelContent({
  onClose,
  onSwitchToDraft,
  onSwitchToMain,
  getCurrentContent,
}: {
  onClose: () => void;
  onSwitchToDraft: (content: any) => void;
  onSwitchToMain: () => void;
  getCurrentContent: () => any;
}) {
  const { rootDir, activeFilePath } = useFileSystem();
  const {
    drafts,
    isLoading,
    error,
    activeDraftId,
    activeDraft,
    isCreateModalOpen,
    loadDrafts,
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

  useEffect(() => {
    if (rootDir && activeFilePath) {
      loadDrafts(rootDir, activeFilePath);
    }
  }, [rootDir, activeFilePath, loadDrafts]);

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
    const confirmed = window.confirm('Apply this draft to the main document? This will replace your current content.');
    if (!confirmed) return;
    const content = await applyDraft(rootDir, activeFilePath, draftId);
    if (content) {
      onSwitchToMain();
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    if (!rootDir || !activeFilePath) return;
    const confirmed = window.confirm('Discard this draft? It will be archived and no longer appear in your drafts list.');
    if (!confirmed) return;
    const success = await discardDraft(rootDir, activeFilePath, draftId);
    if (success && activeDraftId === draftId) {
      onSwitchToMain();
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!rootDir || !activeFilePath) return;
    const confirmed = window.confirm('Permanently delete this draft? This cannot be undone.');
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
      const content = await openDraft(rootDir, activeFilePath, draft.id);
      if (content) {
        onSwitchToDraft(content);
      }
    }
  };

  const activeDrafts = drafts.filter(d => d.status === 'active');

  return (
    <>
      {isCreateModalOpen && (
        <CreateDraftModal
          onClose={closeCreateModal}
          onCreate={handleCreateDraft}
          isFromCheckpoint={!!createFromCheckpointId}
        />
      )}

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-muted-foreground" />
          <h2 className="font-semibold text-sm">Drafts</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {activeDraft && (
        <div className="flex-shrink-0 p-2 bg-purple-500/10 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch size={12} className="text-purple-600" />
              <span className="text-xs text-purple-600 font-medium truncate">Editing: {activeDraft.name}</span>
            </div>
            <button onClick={handleCloseDraft} className="text-xs text-purple-600 hover:text-purple-800">
              Exit draft
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 p-3 border-b">
        <button
          onClick={() => openCreateModal()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          New Draft
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-destructive">{error}</div>
        ) : activeDrafts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No drafts yet.
            <br />
            <span className="text-xs">Create a draft to experiment with changes without affecting your main document.</span>
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

      {!isLoading && activeDrafts.length > 0 && (
        <div className="flex-shrink-0 p-3 border-t text-center text-xs text-muted-foreground">
          {activeDrafts.length} draft{activeDrafts.length !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}
