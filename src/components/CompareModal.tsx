import { X, RotateCcw } from 'lucide-react';
import { diffWords } from 'diff';
import { useMemo } from 'react';

interface CompareModalProps {
  /** Source checkpoint (older) */
  checkpointA: {
    id: string;
    label?: string;
    timestamp: string;
  };

  /** Target checkpoint (newer) */
  checkpointB: {
    id: string;
    label?: string;
    timestamp: string;
  };

  /** Content of checkpoint A */
  contentA: string;

  /** Content of checkpoint B */
  contentB: string;

  /** Called to close the modal */
  onClose: () => void;

  /** Called to restore checkpoint A */
  onRestoreA: () => void;

  /** Called to restore checkpoint B */
  onRestoreB: () => void;
}

export function CompareModal({
  checkpointA,
  checkpointB,
  contentA,
  contentB,
  onClose,
  onRestoreA,
  onRestoreB,
}: CompareModalProps) {
  // Calculate word-level diff
  const diff = useMemo(() => {
    return diffWords(contentA || '', contentB || '');
  }, [contentA, contentB]);

  // Calculate stats
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;

    diff.forEach(part => {
      if (part.added) {
        added += part.value.length;
      } else if (part.removed) {
        removed += part.value.length;
      }
    });

    return { added, removed };
  }, [diff]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-lg">Compare Versions</h2>
            <p className="text-sm text-muted-foreground">
              {checkpointA.label || 'Version'} → {checkpointB.label || 'Version'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b text-sm">
          <span className="text-muted-foreground">Changes:</span>
          <span className="text-green-600">+{stats.added} chars</span>
          <span className="text-red-600">-{stats.removed} chars</span>
        </div>

        {/* Version headers */}
        <div className="flex border-b">
          <div className="flex-1 p-3 border-r bg-red-50/30 dark:bg-red-950/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {checkpointA.label || 'Older Version'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(checkpointA.timestamp)}
                </div>
              </div>
              <button
                onClick={onRestoreA}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
              >
                <RotateCcw size={12} />
                Restore
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 bg-green-50/30 dark:bg-green-950/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {checkpointB.label || 'Newer Version'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(checkpointB.timestamp)}
                </div>
              </div>
              <button
                onClick={onRestoreB}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
              >
                <RotateCcw size={12} />
                Restore
              </button>
            </div>
          </div>
        </div>

        {/* Diff view */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {diff.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 line-through"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
