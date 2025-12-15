import { useEffect, useState } from 'react';
import { RiFileTextLine, RiCheckboxCircleLine, RiCloseCircleLine, RiLoader4Line } from '@remixicon/react';

interface ExportProgressProps {
  isVisible: boolean;
  onClose: () => void;
}

interface ProgressState {
  current: number;
  total: number;
  phase: string;
  complete: boolean;
  error: string | null;
}

export function ExportProgress({ isVisible, onClose }: ExportProgressProps) {
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
    phase: 'Starting...',
    complete: false,
    error: null,
  });

  useEffect(() => {
    if (!isVisible) return;

    const cleanup = window.electronAPI.onDocxExportProgress((data) => {
      if (data.complete) {
        setProgress(prev => ({ ...prev, complete: true, phase: 'Export complete!' }));
        // Auto-close after success
        setTimeout(() => {
          onClose();
          setProgress({ current: 0, total: 0, phase: 'Starting...', complete: false, error: null });
        }, 1500);
      } else if (data.error) {
        setProgress(prev => ({ ...prev, error: data.error || 'Unknown error' }));
      } else if (data.current !== undefined && data.total !== undefined) {
        setProgress(prev => ({
          ...prev,
          current: data.current!,
          total: data.total!,
          phase: data.phase || prev.phase,
        }));
      }
    });

    return cleanup;
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-xl p-6 w-80">
        <div className="flex items-center gap-3 mb-4">
          {progress.error ? (
            <RiCloseCircleLine className="w-6 h-6 text-destructive" />
          ) : progress.complete ? (
            <RiCheckboxCircleLine className="w-6 h-6 text-green-500" />
          ) : (
            <RiLoader4Line className="w-6 h-6 text-primary animate-spin" />
          )}
          <h3 className="font-semibold text-foreground">
            {progress.error ? 'Export Failed' : progress.complete ? 'Export Complete' : 'Exporting to DOCX'}
          </h3>
        </div>

        {progress.error ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{progress.error}</p>
            <button
              onClick={() => {
                onClose();
                setProgress({ current: 0, total: 0, phase: 'Starting...', complete: false, error: null });
              }}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RiFileTextLine className="w-4 h-4" />
              <span>{progress.phase}</span>
            </div>

            {!progress.complete && progress.total > 0 && (
              <>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.current} / {progress.total} elements</span>
                  <span>{percentage}%</span>
                </div>
              </>
            )}

            {progress.complete && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Your document has been exported successfully.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
