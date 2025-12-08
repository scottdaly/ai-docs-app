import { useState, useEffect } from 'react';
import { X, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'not-available' | 'error';
  version?: string;
  progress?: number;
  releaseNotes?: string;
  error?: string;
}

interface UpdateNotificationProps {
  onCheckForUpdates?: () => void;
}

export function UpdateNotification({ onCheckForUpdates }: UpdateNotificationProps) {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [showManualCheckResult, setShowManualCheckResult] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const cleanups = [
      api.onUpdateAvailable?.((data) => {
        setUpdateState({
          status: 'available',
          version: data.version,
          releaseNotes: typeof data.releaseNotes === 'string' ? data.releaseNotes : undefined,
        });
        setDismissed(false);
      }),
      api.onUpdateNotAvailable?.((data) => {
        setUpdateState({
          status: 'not-available',
          version: data.version,
        });
        // Show "up to date" message briefly when manually checking
        if (showManualCheckResult) {
          setTimeout(() => {
            setUpdateState({ status: 'idle' });
            setShowManualCheckResult(false);
          }, 3000);
        }
      }),
      api.onUpdateDownloadProgress?.((data) => {
        setUpdateState((prev) => ({
          ...prev,
          status: 'downloading',
          progress: data.percent,
        }));
      }),
      api.onUpdateDownloaded?.((data) => {
        setUpdateState({
          status: 'ready',
          version: data.version,
          releaseNotes: typeof data.releaseNotes === 'string' ? data.releaseNotes : undefined,
        });
      }),
      api.onUpdateError?.((data) => {
        setUpdateState({
          status: 'error',
          error: data.message,
        });
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [showManualCheckResult]);

  // Handle manual check for updates from menu
  useEffect(() => {
    const handleMenuAction = async (action: string) => {
      if (action === 'check-for-updates') {
        setShowManualCheckResult(true);
        setUpdateState({ status: 'checking' });
        setDismissed(false);
        await window.electronAPI?.checkForUpdates();
      }
    };

    // Listen for menu action
    const cleanup = window.electronAPI?.onMenuAction?.(handleMenuAction);
    return () => cleanup?.();
  }, []);

  // Also expose the check function for external use
  useEffect(() => {
    if (onCheckForUpdates) {
      // This is a way to trigger the check from parent
    }
  }, [onCheckForUpdates]);

  const handleDownload = async () => {
    setUpdateState((prev) => ({ ...prev, status: 'downloading', progress: 0 }));
    await window.electronAPI?.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI?.quitAndInstall();
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (updateState.status === 'not-available' || updateState.status === 'error') {
      setUpdateState({ status: 'idle' });
    }
  };

  // Don't show anything if idle and not manually checking
  if (updateState.status === 'idle') {
    return null;
  }

  // Don't show if dismissed (except for ready status which is important)
  if (dismissed && updateState.status !== 'ready') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2 duration-200">
      <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {updateState.status === 'checking' && (
              <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
            )}
            {updateState.status === 'available' && (
              <Download className="w-4 h-4 text-primary" />
            )}
            {updateState.status === 'downloading' && (
              <Download className="w-4 h-4 text-primary animate-pulse" />
            )}
            {updateState.status === 'ready' && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            {updateState.status === 'not-available' && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            {updateState.status === 'error' && (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )}
            <span className="font-medium text-sm">
              {updateState.status === 'checking' && 'Checking for Updates'}
              {updateState.status === 'available' && 'Update Available'}
              {updateState.status === 'downloading' && 'Downloading Update'}
              {updateState.status === 'ready' && 'Ready to Install'}
              {updateState.status === 'not-available' && 'Up to Date'}
              {updateState.status === 'error' && 'Update Error'}
            </span>
          </div>
          {updateState.status !== 'downloading' && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {updateState.status === 'checking' && (
            <p className="text-sm text-muted-foreground">
              Looking for new versions...
            </p>
          )}

          {updateState.status === 'available' && (
            <>
              <p className="text-sm text-muted-foreground">
                Version <span className="font-medium text-foreground">{updateState.version}</span> is available.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  Later
                </button>
              </div>
            </>
          )}

          {updateState.status === 'downloading' && (
            <>
              <div className="mt-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${updateState.progress || 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {(updateState.progress || 0).toFixed(0)}% complete
                </p>
              </div>
            </>
          )}

          {updateState.status === 'ready' && (
            <>
              <p className="text-sm text-muted-foreground">
                Version <span className="font-medium text-foreground">{updateState.version}</span> is ready to install.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The app will restart to complete the update.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Restart & Update
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  Later
                </button>
              </div>
            </>
          )}

          {updateState.status === 'not-available' && (
            <p className="text-sm text-muted-foreground">
              You're running the latest version{updateState.version ? ` (${updateState.version})` : ''}.
            </p>
          )}

          {updateState.status === 'error' && (
            <>
              <p className="text-sm text-destructive">
                {updateState.error || 'Failed to check for updates.'}
              </p>
              <button
                onClick={handleDismiss}
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
