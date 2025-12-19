import { useState, useMemo } from 'react';
import { RiCheckLine, RiCloseLine, RiArrowDownSLine, RiArrowUpSLine, RiSparklingLine } from '@remixicon/react';
import { diffWords } from 'diff';

interface DocumentDiffBarProps {
  originalContent: string;
  modifiedContent: string;
  onAccept: () => void;
  onReject: () => void;
}

export function DocumentDiffBar({
  originalContent,
  modifiedContent,
  onAccept,
  onReject,
}: DocumentDiffBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate diff
  const diffParts = useMemo(() => {
    return diffWords(originalContent, modifiedContent);
  }, [originalContent, modifiedContent]);

  // Count changes
  const changeStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffParts.forEach((part) => {
      if (part.added) added += part.value.split(/\s+/).filter(w => w).length;
      if (part.removed) removed += part.value.split(/\s+/).filter(w => w).length;
    });
    return { added, removed };
  }, [diffParts]);

  return (
    <div className="border-b border-border bg-amber-50 dark:bg-amber-950/30">
      {/* Header bar - always visible */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <RiSparklingLine size={16} />
            <span>AI made changes to this document</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">
              +{changeStats.added} words
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{changeStats.removed} words
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <>
                <RiArrowUpSLine size={14} />
                Hide diff
              </>
            ) : (
              <>
                <RiArrowDownSLine size={14} />
                Show diff
              </>
            )}
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <RiCheckLine size={14} />
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <RiCloseLine size={14} />
            Reject
          </button>
        </div>
      </div>

      {/* Expandable diff view */}
      {isExpanded && (
        <div className="px-4 pb-3">
          <div className="max-h-[200px] overflow-y-auto p-3 bg-background border rounded-lg text-sm leading-relaxed">
            {diffParts.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded px-0.5"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through rounded px-0.5"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to accept or <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> to reject
          </div>
        </div>
      )}
    </div>
  );
}
