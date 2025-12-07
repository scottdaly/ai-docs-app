/**
 * ExternalChangeDialog - Notifies user when a file is modified externally
 *
 * Shows a dialog when the currently open file has been modified outside of
 * Midlight (e.g., by another editor, Git, or sync tools).
 */

import { AlertTriangle, RefreshCw, X, FileX } from 'lucide-react';

interface ExternalChangeDialogProps {
  /** Relative file path that was changed */
  fileKey: string;

  /** Type of change: 'change', 'add', or 'unlink' (deleted) */
  changeType: 'change' | 'add' | 'unlink';

  /** Timestamp of the change */
  timestamp: string;

  /** Called when user wants to reload the file from disk */
  onReload: () => void;

  /** Called when user wants to keep their current version */
  onKeep: () => void;

  /** Called to dismiss the dialog */
  onDismiss: () => void;
}

export function ExternalChangeDialog({
  fileKey,
  changeType,
  timestamp,
  onReload,
  onKeep,
  onDismiss,
}: ExternalChangeDialogProps) {
  const fileName = fileKey.split('/').pop() || fileKey;
  const timeAgo = formatTimeAgo(new Date(timestamp));

  // Different messaging based on change type
  const isDeleted = changeType === 'unlink';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b">
          {isDeleted ? (
            <FileX className="w-6 h-6 text-destructive shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              {isDeleted ? 'File Deleted' : 'File Changed Externally'}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {fileName}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {isDeleted ? (
            <p className="text-sm text-muted-foreground">
              This file was deleted outside of Midlight {timeAgo}.
              You can keep editing and save to recreate it, or close the file.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This file was modified outside of Midlight {timeAgo}.
              You can reload the external changes (your unsaved changes will be lost),
              or keep your current version.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t bg-muted/30">
          {isDeleted ? (
            <>
              <button
                onClick={onKeep}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={onDismiss}
                className="flex-1 px-4 py-2 border rounded hover:bg-muted transition-colors"
              >
                Close File
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload
              </button>
              <button
                onClick={onKeep}
                className="flex-1 px-4 py-2 border rounded hover:bg-muted transition-colors"
              >
                Keep Mine
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format a date as a relative time string (e.g., "2 minutes ago").
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
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
}
