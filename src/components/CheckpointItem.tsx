import { Bookmark, Clock, RotateCcw, GitCompare, Tag } from 'lucide-react';
import { useState } from 'react';

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

interface CheckpointItemProps {
  checkpoint: Checkpoint;
  isSelected: boolean;
  isCompareMode: boolean;
  isCompareSource: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onCompare: () => void;
  onLabel: (label: string) => void;
}

export function CheckpointItem({
  checkpoint,
  isSelected,
  isCompareMode,
  isCompareSource,
  onSelect,
  onRestore,
  onCompare,
  onLabel,
}: CheckpointItemProps) {
  const [isLabeling, setIsLabeling] = useState(false);
  const [labelInput, setLabelInput] = useState(checkpoint.label || '');

  const timeAgo = formatTimeAgo(new Date(checkpoint.timestamp));
  const isBookmark = checkpoint.type === 'bookmark';

  const handleLabelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (labelInput.trim()) {
      onLabel(labelInput.trim());
      setIsLabeling(false);
    }
  };

  const handleLabelCancel = () => {
    setLabelInput(checkpoint.label || '');
    setIsLabeling(false);
  };

  return (
    <div
      className={`
        border rounded-lg p-3 cursor-pointer transition-all
        ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
        ${isCompareSource ? 'border-blue-500 bg-blue-500/10' : ''}
        ${isCompareMode && !isCompareSource ? 'hover:border-green-500 hover:bg-green-500/10' : ''}
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isBookmark ? (
            <Bookmark size={14} className="text-yellow-500 shrink-0 fill-yellow-500" />
          ) : (
            <Clock size={14} className="text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            {isLabeling ? (
              <form onSubmit={handleLabelSubmit} className="flex gap-1">
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value.slice(0, 50))}
                  placeholder="Enter label..."
                  className="text-sm px-1.5 py-0.5 border rounded bg-background w-32"
                  maxLength={50}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleLabelCancel();
                  }}
                />
                <button
                  type="submit"
                  className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  Save
                </button>
              </form>
            ) : (
              <span className="text-sm font-medium truncate block">
                {checkpoint.label || (isBookmark ? 'Bookmark' : 'Auto-save')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {isSelected && !isCompareMode && !isLabeling && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLabeling(true);
              }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Add label"
            >
              <Tag size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCompare();
              }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Compare with..."
            >
              <GitCompare size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Restore this version"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{timeAgo}</span>
        <span>{checkpoint.stats.wordCount.toLocaleString()} words</span>
        {checkpoint.stats.changeSize > 0 && (
          <span className="text-green-600">+{checkpoint.stats.changeSize}</span>
        )}
        {checkpoint.stats.changeSize < 0 && (
          <span className="text-red-600">{checkpoint.stats.changeSize}</span>
        )}
      </div>

      {/* Compare mode hint */}
      {isCompareMode && isCompareSource && (
        <div className="mt-2 text-xs text-blue-600 font-medium">
          Comparing from this version...
        </div>
      )}
      {isCompareMode && !isCompareSource && (
        <div className="mt-2 text-xs text-green-600">
          Click to compare
        </div>
      )}
    </div>
  );
}

/**
 * Format a date as a relative time string.
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
