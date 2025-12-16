import { useMemo, useState } from 'react';
import {
  RiCheckLine,
  RiCloseLine,
  RiArrowGoBackLine,
  RiExpandUpDownLine,
  RiContractUpDownLine,
  RiFileAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiFolderAddLine,
  RiArrowRightLine,
  RiSparklingLine,
} from '@remixicon/react';
import { diffWords } from 'diff';
import { useAgentStore, PendingChange } from '../store/useAgentStore';

interface AgentChangeBannerProps {
  onFileOpen?: (path: string) => void;
}

export function AgentChangeBanner({ onFileOpen: _onFileOpen }: AgentChangeBannerProps) {
  const { status, pendingChanges, acceptAllChanges, undoAllChanges, dismissChanges } =
    useAgentStore();

  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [isUndoing, setIsUndoing] = useState(false);

  // Only show when there are pending changes
  if (status !== 'pending_review' || pendingChanges.length === 0) {
    return null;
  }

  const toggleExpanded = (toolCallId: string) => {
    setExpandedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  };

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await undoAllChanges();
    } finally {
      setIsUndoing(false);
    }
  };

  const getChangeIcon = (type: PendingChange['change']['type']) => {
    switch (type) {
      case 'create':
        return <RiFileAddLine size={14} className="text-green-500" />;
      case 'edit':
        return <RiEditLine size={14} className="text-blue-500" />;
      case 'delete':
        return <RiDeleteBinLine size={14} className="text-red-500" />;
      case 'move':
        return <RiArrowRightLine size={14} className="text-yellow-500" />;
      case 'create_folder':
        return <RiFolderAddLine size={14} className="text-green-500" />;
      default:
        return <RiEditLine size={14} />;
    }
  };

  const getChangeLabel = (change: PendingChange['change']) => {
    switch (change.type) {
      case 'create':
        return `Created ${change.path}`;
      case 'edit':
        return `Edited ${change.path}`;
      case 'delete':
        return `Deleted ${change.path}`;
      case 'move':
        return `Moved ${change.path} → ${change.newPath}`;
      case 'create_folder':
        return `Created folder ${change.path}`;
      default:
        return change.path;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] bg-background border rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b">
        <div className="flex items-center gap-2">
          <RiSparklingLine size={16} className="text-primary" />
          <span className="font-medium text-sm">
            AI made {pendingChanges.length} change{pendingChanges.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={dismissChanges}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Dismiss"
        >
          <RiCloseLine size={16} />
        </button>
      </div>

      {/* Changes list */}
      <div className="max-h-[300px] overflow-y-auto">
        {pendingChanges.map((pending) => {
          const isExpanded = expandedChanges.has(pending.toolCallId);
          const hasContent =
            pending.change.contentBefore || pending.change.contentAfter;

          return (
            <div key={pending.toolCallId} className="border-b last:border-b-0">
              {/* Change header */}
              <button
                onClick={() => hasContent && toggleExpanded(pending.toolCallId)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                  hasContent ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                {getChangeIcon(pending.change.type)}
                <span className="flex-1 text-sm truncate">
                  {getChangeLabel(pending.change)}
                </span>
                {hasContent && (
                  <span className="text-muted-foreground">
                    {isExpanded ? (
                      <RiContractUpDownLine size={14} />
                    ) : (
                      <RiExpandUpDownLine size={14} />
                    )}
                  </span>
                )}
              </button>

              {/* Expanded diff view */}
              {isExpanded && hasContent && (
                <div className="px-4 pb-3">
                  <DiffView
                    before={pending.change.contentBefore || ''}
                    after={pending.change.contentAfter || ''}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-3 border-t bg-muted/30">
        <button
          onClick={acceptAllChanges}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <RiCheckLine size={16} />
          Keep Changes
        </button>
        <button
          onClick={handleUndo}
          disabled={isUndoing}
          className="flex items-center justify-center gap-2 px-3 py-2 border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 transition-colors text-sm disabled:opacity-50"
        >
          <RiArrowGoBackLine size={16} />
          {isUndoing ? 'Undoing...' : 'Undo All'}
        </button>
      </div>
    </div>
  );
}

// Diff view component for showing before/after
function DiffView({ before, after }: { before: string; after: string }) {
  const diffParts = useMemo(() => {
    return diffWords(before, after);
  }, [before, after]);

  // Truncate for display
  const maxLength = 500;
  const isTruncated =
    before.length > maxLength || after.length > maxLength;

  // Calculate change stats
  const changeStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffParts.forEach((part) => {
      if (part.added) added += part.value.length;
      if (part.removed) removed += part.value.length;
    });
    return { added, removed };
  }, [diffParts]);

  return (
    <div className="bg-muted/50 rounded-lg overflow-hidden">
      {/* Diff content */}
      <div className="p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">
        {diffParts.slice(0, 50).map((part, index) => {
          if (part.added) {
            return (
              <span
                key={index}
                className="bg-green-500/20 text-green-700 dark:text-green-300 rounded px-0.5"
              >
                {part.value.slice(0, maxLength)}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span
                key={index}
                className="bg-red-500/20 text-red-700 dark:text-red-300 line-through rounded px-0.5"
              >
                {part.value.slice(0, maxLength)}
              </span>
            );
          }
          return (
            <span key={index}>{part.value.slice(0, maxLength)}</span>
          );
        })}
        {isTruncated && (
          <span className="text-muted-foreground">... (truncated)</span>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground flex items-center gap-3">
        <span className="text-green-600 dark:text-green-400">
          +{changeStats.added} chars
        </span>
        <span className="text-red-600 dark:text-red-400">
          -{changeStats.removed} chars
        </span>
      </div>
    </div>
  );
}
