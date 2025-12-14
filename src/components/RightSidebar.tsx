import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, MessageSquare, Sparkles, History, Save, Loader2, MoreHorizontal, RotateCcw, GitCompare, Pencil, Trash2, LogIn } from 'lucide-react';
import { ChatInput } from './chat/ChatInput';
import { useVersionStore, Version } from '../store/useVersionStore';
import { useFileSystem } from '../store/useFileSystem';
import { useAIStore, Message } from '../store/useAIStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';
import { CompareModal } from './CompareModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type RightSidebarMode = 'ai' | 'history' | null;

interface RightSidebarProps {
  mode: RightSidebarMode;
  onClose: () => void;
  onRestoreContent?: (content: any) => void;
  onOpenAuth?: () => void;
}

export function RightSidebar({
  mode,
  onClose,
  onRestoreContent,
  onOpenAuth,
}: RightSidebarProps) {
  if (!mode) return null;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full overflow-hidden border-l border-border">
      <div className="flex flex-col h-full bg-background overflow-hidden">
        {mode === 'ai' && <AIChatPanel onClose={onClose} onOpenAuth={onOpenAuth} />}
        {mode === 'history' && onRestoreContent && (
          <VersionsPanel onClose={onClose} onRestoreContent={onRestoreContent} />
        )}
      </div>
    </div>
  );
}

// Helper to extract plain text from Tiptap JSON
function extractTextFromTiptapJson(doc: any): string {
  if (!doc || !doc.content) return '';

  const extractFromNode = (node: any): string => {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractFromNode).join('');
    }
    return '';
  };

  return doc.content
    .map((node: any) => extractFromNode(node))
    .join('\n\n');
}

// AI Chat Panel
function AIChatPanel({ onClose, onOpenAuth }: { onClose: () => void; onOpenAuth?: () => void }) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { editorContent, activeFilePath } = useFileSystem();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const {
    chatHistory,
    isStreaming,
    sendChatMessage,
    clearChatHistory,
    cleanupStream,
    fetchAvailableModels,
  } = useAIStore();

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  // Check auth and fetch models on mount
  useEffect(() => {
    checkAuth();
    fetchAvailableModels();
  }, [checkAuth, fetchAvailableModels]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Get document context for AI (with size limit to save tokens)
  const MAX_CONTEXT_CHARS = 4000;

  const getDocumentContext = useCallback(() => {
    if (!editorContent) return undefined;

    let text = extractTextFromTiptapJson(editorContent);
    if (!text.trim()) return undefined;

    // Truncate if too long (keep the end for more recent/relevant context)
    if (text.length > MAX_CONTEXT_CHARS) {
      text = '...[document truncated]...\n' + text.slice(-MAX_CONTEXT_CHARS);
    }

    const filename = activeFilePath?.split('/').pop() || 'Untitled';
    return `File: ${filename}\n\n${text}`;
  }, [editorContent, activeFilePath]);

  const handleSubmit = useCallback(async (message: string) => {
    try {
      const documentContext = getDocumentContext();
      await sendChatMessage(message, documentContext);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    }
  }, [getDocumentContext, sendChatMessage]);

  const handleClearHistory = () => {
    if (chatHistory.length > 0) {
      clearChatHistory();
      toast.success('Chat history cleared');
    }
  };

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
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

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <LogIn size={24} className="text-primary" />
          </div>
          <h3 className="font-medium text-sm mb-2">Sign in to use AI</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Create an account or sign in to access AI writing assistance.
          </p>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h2 className="font-semibold text-sm">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          {chatHistory.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Clear chat history"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare size={40} className="mb-3 opacity-50" />
            <p className="text-sm font-medium">Start a conversation</p>
            <p className="text-xs mt-1">Ask me to help with your writing</p>
            {activeFilePath && (
              <p className="text-xs mt-3 px-4 py-2 bg-muted/50 rounded-lg">
                I can see your current document and help with editing, brainstorming, and more.
              </p>
            )}
          </div>
        ) : (
          chatHistory.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      <ChatInput
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        placeholder={activeFilePath ? "Ask about your document..." : "Ask anything..."}
      />
    </>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming && !message.content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isStreaming ? (
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-current opacity-50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-current opacity-50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-current opacity-50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
    </div>
  );
}

// Versions Panel - simplified from the old History Panel
function VersionsPanel({
  onClose,
  onRestoreContent,
}: {
  onClose: () => void;
  onRestoreContent: (content: any) => void;
}) {
  const { rootDir, activeFilePath } = useFileSystem();
  const {
    versions,
    isLoading,
    error,
    selectedVersionId,
    isCompareMode,
    compareVersionId,
    compareContent,
    isLoadingCompare,
    loadVersions,
    selectVersion,
    restoreVersion,
    startCompare,
    cancelCompare,
    loadCompare,
    renameVersion,
  } = useVersionStore();

  useEffect(() => {
    if (rootDir && activeFilePath) {
      loadVersions(rootDir, activeFilePath);
    }
  }, [rootDir, activeFilePath, loadVersions]);

  useEffect(() => {
    if (isCompareMode && selectedVersionId && compareVersionId && rootDir && activeFilePath) {
      loadCompare(rootDir, activeFilePath, compareVersionId, selectedVersionId);
    }
  }, [isCompareMode, selectedVersionId, compareVersionId, rootDir, activeFilePath, loadCompare]);

  // Show toast for version errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleRestore = async (versionId: string) => {
    if (!rootDir || !activeFilePath) return;
    const confirmed = window.confirm('Restore this version? Any unsaved changes will be lost.');
    if (!confirmed) return;
    const content = await restoreVersion(rootDir, activeFilePath, versionId);
    if (content) {
      onRestoreContent(content);
      loadVersions(rootDir, activeFilePath);
    }
  };

  const handleCompare = (versionId: string) => {
    startCompare(versionId);
  };

  const handleRename = async (versionId: string, newName: string) => {
    if (!rootDir || !activeFilePath) return;
    await renameVersion(rootDir, activeFilePath, versionId, newName);
  };

  const compareSourceVersion = useMemo(() => {
    return versions.find(v => v.id === compareVersionId);
  }, [versions, compareVersionId]);

  const compareTargetVersion = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId);
  }, [versions, selectedVersionId]);

  const showCompareModal = isCompareMode && compareContent && compareSourceVersion && compareTargetVersion;

  const handleRestoreFromCompare = async (versionId: string) => {
    if (!rootDir || !activeFilePath) return;
    const confirmed = window.confirm('Restore this version? Any unsaved changes will be lost.');
    if (!confirmed) return;
    try {
      const content = await restoreVersion(rootDir, activeFilePath, versionId);
      if (content) {
        onRestoreContent(content);
        loadVersions(rootDir, activeFilePath);
      }
    } finally {
      cancelCompare();
    }
  };

  return (
    <>
      {showCompareModal && (
        <CompareModal
          versionA={{
            id: compareSourceVersion.id,
            name: compareSourceVersion.name,
            timestamp: compareSourceVersion.timestamp,
          }}
          versionB={{
            id: compareTargetVersion.id,
            name: compareTargetVersion.name,
            timestamp: compareTargetVersion.timestamp,
          }}
          contentA={compareContent.contentA.markdown || ''}
          contentB={compareContent.contentB.markdown || ''}
          onClose={cancelCompare}
          onRestoreA={() => handleRestoreFromCompare(compareSourceVersion.id)}
          onRestoreB={() => handleRestoreFromCompare(compareTargetVersion.id)}
        />
      )}

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <History size={18} className="text-muted-foreground" />
          <h2 className="font-semibold text-sm">Versions</h2>
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

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-destructive">{error}</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Save size={32} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">No versions saved yet</p>
            <p className="text-xs mt-1 px-4">
              Save a version when you reach a milestone—like completing a draft or before making big changes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map(version => (
              <VersionItem
                key={version.id}
                version={version}
                isSelected={selectedVersionId === version.id}
                isCompareMode={isCompareMode}
                isCompareSource={compareVersionId === version.id}
                onSelect={() => selectVersion(version.id)}
                onRestore={() => handleRestore(version.id)}
                onCompare={() => handleCompare(version.id)}
                onRename={(name) => handleRename(version.id, name)}
              />
            ))}
          </div>
        )}
      </div>

      {!isLoading && versions.length > 0 && (
        <div className="flex-shrink-0 p-3 border-t text-center text-xs text-muted-foreground">
          {versions.length} version{versions.length !== 1 ? 's' : ''} saved
        </div>
      )}
    </>
  );
}

// Version Item Component
function VersionItem({
  version,
  isSelected,
  isCompareMode,
  isCompareSource,
  onSelect,
  onRestore,
  onCompare,
  onRename,
}: {
  version: Version;
  isSelected: boolean;
  isCompareMode: boolean;
  isCompareSource: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onCompare: () => void;
  onRename: (name: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(version.name || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today at ${time}`;
    if (isYesterday) return `Yesterday at ${time}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${time}`;
  };

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== version.name) {
      onRename(newName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setNewName(version.name || '');
      setIsRenaming(false);
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
        isCompareSource
          ? 'border-blue-500 bg-blue-500/10'
          : isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      }`}
      onClick={() => {
        if (isCompareMode && !isCompareSource) {
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 text-sm font-medium bg-background border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="font-medium text-sm truncate">
              {version.name || 'Untitled version'}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {formatTimestamp(version.timestamp)}
          </div>
          {version.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {version.description}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">
            {version.stats.wordCount.toLocaleString()} words
          </div>
        </div>

        {!isCompareMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded hover:bg-muted transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw size={14} className="mr-2" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCompare}>
                <GitCompare size={14} className="mr-2" />
                Compare
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewName(version.name || '');
                setIsRenaming(true);
              }}>
                <Pencil size={14} className="mr-2" />
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
