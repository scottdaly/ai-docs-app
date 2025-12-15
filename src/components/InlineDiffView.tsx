import { useState, useRef, useEffect, useMemo } from 'react';
import { RiCloseLine, RiCheckLine, RiRefreshLine, RiFileCopyLine, RiSparklingLine } from '@remixicon/react';
import { diffWords } from 'diff';

interface InlineDiffViewProps {
  position: { top: number; left: number };
  originalText: string;
  modifiedText: string;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
}

export function InlineDiffView({
  position,
  originalText,
  modifiedText,
  onAccept,
  onReject,
  onRetry,
}: InlineDiffViewProps) {
  const [viewMode, setViewMode] = useState<'diff' | 'result'>('diff');
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onReject();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onAccept();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onAccept, onReject]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onReject();
      }
    };

    // Delay adding listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onReject]);

  // Calculate diff
  const diffParts = useMemo(() => {
    return diffWords(originalText, modifiedText);
  }, [originalText, modifiedText]);

  // Calculate position to keep popup in viewport
  const getAdjustedPosition = () => {
    const padding = 16;
    const popupWidth = 500;
    const popupHeight = 300;

    let { top, left } = position;

    // Adjust horizontal position
    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    // Adjust vertical position
    if (top + popupHeight > window.innerHeight - padding) {
      top = position.top - popupHeight - 10;
    }

    return { top, left };
  };

  const adjustedPosition = getAdjustedPosition();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(modifiedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Count changes
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
    <div
      ref={containerRef}
      className="fixed z-50 w-[500px] bg-background border rounded-xl shadow-xl overflow-hidden"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RiSparklingLine size={14} className="text-primary" />
          <span>AI Edit Result</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('diff')}
              className={`px-2 py-1 transition-colors ${
                viewMode === 'diff'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              Diff
            </button>
            <button
              onClick={() => setViewMode('result')}
              className={`px-2 py-1 transition-colors ${
                viewMode === 'result'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              Result
            </button>
          </div>
          <button
            onClick={onReject}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RiCloseLine size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[250px] overflow-y-auto p-4">
        {viewMode === 'diff' ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {diffParts.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-green-500/20 text-green-700 dark:text-green-300 rounded px-0.5"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-red-500/20 text-red-700 dark:text-red-300 line-through rounded px-0.5"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {modifiedText}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center gap-4">
        <span className="text-green-600 dark:text-green-400">
          +{changeStats.added} chars
        </span>
        <span className="text-red-600 dark:text-red-400">
          -{changeStats.removed} chars
        </span>
        <span className="ml-auto">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Cmd+Enter</kbd> to accept
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-3 border-t bg-muted/30">
        <button
          onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <RiCheckLine size={16} />
          Accept
        </button>
        <button
          onClick={onReject}
          className="flex items-center justify-center gap-2 px-3 py-2 border rounded-lg hover:bg-muted transition-colors text-sm"
        >
          <RiCloseLine size={16} />
          Reject
        </button>
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 px-3 py-2 border rounded-lg hover:bg-muted transition-colors text-sm"
          title="Try again with different prompt"
        >
          <RiRefreshLine size={16} />
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 px-3 py-2 border rounded-lg hover:bg-muted transition-colors text-sm"
          title="Copy result"
        >
          {copied ? <RiCheckLine size={16} className="text-green-500" /> : <RiFileCopyLine size={16} />}
        </button>
      </div>
    </div>
  );
}
