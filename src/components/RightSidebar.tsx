import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { RiArrowRightSLine, RiChat3Line, RiHistoryLine, RiSave3Line, RiLoader4Line, RiMoreLine, RiRefreshLine, RiGitBranchLine, RiPencilLine, RiLoginBoxLine, RiCloseLine, RiFileAddLine, RiFileEditLine, RiDeleteBinLine, RiFolderAddLine, RiFileSearchLine, RiFileList2Line, RiDragMoveLine } from '@remixicon/react';
import { ChatInput } from './chat/ChatInput';
import { ConversationTabs } from './chat/ConversationTabs';
import { useVersionStore, Version } from '../store/useVersionStore';
import { useFileSystem } from '../store/useFileSystem';
import { useAIStore, Message, ToolAction } from '../store/useAIStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNetworkStore } from '../store/useNetworkStore';
import { toast } from '../store/useToastStore';
import { CompareModal } from './CompareModal';
import { createInlineDiffJson } from '../utils/inlineDiff';
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

  const { editorContent, activeFilePath, rootDir, loadDir, reloadFromDisk, setPendingDiff, setEditorContent } = useFileSystem();
  const { isAuthenticated, isInitializing, checkAuth } = useAuthStore();
  const { isOnline } = useNetworkStore();
  const {
    isStreaming,
    sendChatMessage,
    cleanupStream,
    fetchAvailableModels,
    getActiveConversation,
  } = useAIStore();

  // Get messages from active conversation
  const activeConversation = getActiveConversation();
  const chatHistory = activeConversation?.messages || [];

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch models when authenticated
  useEffect(() => {
    console.log('[RightSidebar] isAuthenticated changed:', isAuthenticated);
    if (isAuthenticated) {
      console.log('[RightSidebar] Fetching available models...');
      fetchAvailableModels();
    }
  }, [isAuthenticated, fetchAvailableModels]);

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
    if (!isOnline) {
      toast.error('Cannot send messages while offline');
      return;
    }
    try {
      const documentContext = getDocumentContext();
      const result = await sendChatMessage(message, documentContext, rootDir || undefined);

      // Refresh file tree if documents were changed
      if (result?.madeChanges && rootDir) {
        await loadDir(rootDir);

        // Get relative path from absolute activeFilePath by removing rootDir prefix
        let activeRelativePath = activeFilePath || '';
        if (activeFilePath && activeFilePath.startsWith(rootDir)) {
          activeRelativePath = activeFilePath.slice(rootDir.length).replace(/^[/\\]+/, '');
        }

        console.log('[RightSidebar] Processing changes:', {
          activeFilePath,
          rootDir,
          activeRelativePath,
          changedPaths: result.changedPaths,
          changes: result.changes?.map(c => ({ type: c.type, path: c.path, hasContentBefore: !!c.contentBefore, hasContentAfter: !!c.contentAfter })),
        });

        // Process ALL edit changes and set pending diffs for each
        const editChanges = result.changes?.filter(c => c.type === 'edit') || [];

        for (const change of editChanges) {
          const beforeContent = change.contentBefore || '';
          const afterContent = change.contentAfter || '';

          if (beforeContent && afterContent) {
            // Build the absolute path for this file
            const absolutePath = rootDir + '/' + change.path.replace(/^[/\\]+/, '');

            // For files other than the current one, we need to load their original JSON
            // For now, we'll just store the text content - they'll get the diff shown when switched to
            const isCurrentFile = activeFilePath &&
              (activeRelativePath === change.path.replace(/^[/\\]+/, '') ||
               activeRelativePath === change.path.replace(/^[/\\]+/, '') + '.md' ||
               activeRelativePath + '.md' === change.path.replace(/^[/\\]+/, ''));

            if (isCurrentFile && activeFilePath) {
              // For current file, also update the editor to show inline diff
              const originalJson = editorContent;
              const inlineDiffJson = createInlineDiffJson(beforeContent, afterContent);
              setEditorContent(inlineDiffJson as any);

              setPendingDiff(activeFilePath, {
                originalContent: beforeContent,
                modifiedContent: afterContent,
                checkpointId: change.preChangeCheckpointId,
                originalJson: originalJson || undefined,
              });
              console.log('[RightSidebar] Set pending diff for current file:', activeFilePath);
            } else {
              // For other files, just store the diff info - they'll get inline diff when switched to
              setPendingDiff(absolutePath, {
                originalContent: beforeContent,
                modifiedContent: afterContent,
                checkpointId: change.preChangeCheckpointId,
              });
              console.log('[RightSidebar] Set pending diff for other file:', absolutePath);
            }
          }
        }

        // Handle non-edit changes to current file (create, move, etc.)
        if (activeFilePath && editChanges.length === 0) {
          const wasCurrentFileChanged = result.changedPaths?.some(changedPath => {
            const normalizedChanged = changedPath.replace(/^[/\\]+/, '');
            return activeRelativePath === normalizedChanged ||
                   activeRelativePath === normalizedChanged + '.md' ||
                   activeRelativePath + '.md' === normalizedChanged;
          });

          if (wasCurrentFileChanged) {
            console.log('[RightSidebar] Non-edit change to current file, reloading');
            await reloadFromDisk();
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    }
  }, [isOnline, editorContent, getDocumentContext, sendChatMessage, rootDir, loadDir, activeFilePath, reloadFromDisk, setPendingDiff, setEditorContent]);

  // Show loading state while checking auth
  if (isInitializing) {
    return (
      <>
        <div className="flex items-center justify-end px-2 py-2">
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <RiCloseLine size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6">
          <RiLoader4Line size={24} className="animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <>
        {/* Simple header with close button */}
        <div className="flex items-center justify-end px-2 py-2">
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <RiCloseLine size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <RiLoginBoxLine size={24} className="text-primary" />
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
      {/* Conversation tabs with close button */}
      <ConversationTabs onClose={onClose} />

      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-2 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <RiChat3Line size={40} className="mb-3 opacity-50" />
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
        isLoading={isStreaming}
        placeholder={activeFilePath ? "Ask about your document..." : "Ask anything..."}
      />
    </>
  );
}

// Tool Action Card Component
function ToolActionCard({ action }: { action: ToolAction }) {
  const getIcon = () => {
    switch (action.type) {
      case 'create': return <RiFileAddLine size={18} />;
      case 'edit': return <RiFileEditLine size={18} />;
      case 'delete': return <RiDeleteBinLine size={18} />;
      case 'move': return <RiDragMoveLine size={18} />;
      case 'create_folder': return <RiFolderAddLine size={18} />;
      case 'search': return <RiFileSearchLine size={18} />;
      case 'list': return <RiFileList2Line size={18} />;
      case 'read': return <RiFileList2Line size={18} />;
      default: return <RiFileEditLine size={18} />;
    }
  };

  const getColors = () => {
    switch (action.type) {
      case 'create': return {
        bg: 'bg-green-500/10 border-green-500/20',
        icon: 'text-green-600 dark:text-green-400',
        text: 'text-green-700 dark:text-green-300',
      };
      case 'edit': return {
        bg: 'bg-blue-500/10 border-blue-500/20',
        icon: 'text-blue-600 dark:text-blue-400',
        text: 'text-blue-700 dark:text-blue-300',
      };
      case 'delete': return {
        bg: 'bg-red-500/10 border-red-500/20',
        icon: 'text-red-600 dark:text-red-400',
        text: 'text-red-700 dark:text-red-300',
      };
      case 'move': return {
        bg: 'bg-orange-500/10 border-orange-500/20',
        icon: 'text-orange-600 dark:text-orange-400',
        text: 'text-orange-700 dark:text-orange-300',
      };
      case 'create_folder': return {
        bg: 'bg-purple-500/10 border-purple-500/20',
        icon: 'text-purple-600 dark:text-purple-400',
        text: 'text-purple-700 dark:text-purple-300',
      };
      default: return {
        bg: 'bg-muted border-border',
        icon: 'text-muted-foreground',
        text: 'text-foreground',
      };
    }
  };

  const colors = getColors();

  // Build the stats line
  const stats: string[] = [];
  if (action.wordsAdded && action.wordsAdded > 0) {
    stats.push(`+${action.wordsAdded} words`);
  }
  if (action.wordsRemoved && action.wordsRemoved > 0) {
    stats.push(`-${action.wordsRemoved} words`);
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${colors.bg}`}>
      <div className={colors.icon}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.text}`}>
          {action.label}
        </div>
        {stats.length > 0 && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {stats.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  // Check for status messages (thinking, using tools)
  const content = message.content || '';
  const isThinking = isStreaming && (content === '' || content.includes('_Thinking..._'));
  const toolMatch = content.match(/_Using tools: ([^_]+)\.\.\._/);
  const isUsingTools = isStreaming && toolMatch;

  // Extract any real content (before the status message)
  const realContent = content
    .replace(/_Thinking\.\.\._/g, '')
    .replace(/_Using tools: [^_]+\.\.\._/g, '')
    .trim();

  // Get tool actions
  const toolActions = message.toolActions || [];

  // Assistant message - no background, sits directly on page
  return (
    <div className="text-sm space-y-2">
      {/* Show tool action cards first */}
      {toolActions.length > 0 && (
        <div className="flex flex-col gap-2">
          {toolActions.map((action, idx) => (
            <ToolActionCard key={idx} action={action} />
          ))}
        </div>
      )}

      {/* Show any real content */}
      {realContent && (
        <div className="whitespace-pre-wrap">{realContent}</div>
      )}

      {/* Show status indicator */}
      {isThinking && !isUsingTools && (
        <span className="text-muted-foreground italic animate-pulse">Thinking...</span>
      )}

      {isUsingTools && (
        <span className="text-muted-foreground italic animate-pulse">Using {toolMatch[1]}...</span>
      )}

      {/* Show thinking if streaming with no content at all */}
      {isStreaming && !content && !isThinking && !toolActions.length && (
        <span className="text-muted-foreground italic animate-pulse">Thinking...</span>
      )}

      {/* Show final content when done */}
      {!isStreaming && !realContent && content && (
        <div className="whitespace-pre-wrap">{content}</div>
      )}
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
          <RiHistoryLine size={18} className="text-muted-foreground" />
          <h2 className="font-semibold text-sm">Versions</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RiArrowRightSLine size={18} />
        </button>
      </div>

      {isCompareMode && (
        <div className="flex-shrink-0 p-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 font-medium flex items-center gap-2">
              {isLoadingCompare ? (
                <>
                  <RiLoader4Line size={12} className="animate-spin" />
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
            <RiLoader4Line size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-destructive">{error}</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <RiSave3Line size={32} className="mx-auto mb-3 opacity-50" />
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
                <RiMoreLine size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onRestore}>
                <RiRefreshLine size={14} className="mr-2" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCompare}>
                <RiGitBranchLine size={14} className="mr-2" />
                Compare
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewName(version.name || '');
                setIsRenaming(true);
              }}>
                <RiPencilLine size={14} className="mr-2" />
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
