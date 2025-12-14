import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { reportUpdateError, setErrorReportingEnabled } from './errorReportingService';

// Configure auto-updater settings
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Interval ID for periodic checks
let updateCheckInterval: NodeJS.Timeout | null = null;

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Check for updates on startup (with delay to not block app launch)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Failed to check for updates:', err);
    });
  }, 10000); // 10 second delay

  // Set up periodic update checks (every 4 hours)
  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Failed to check for updates:', err);
    });
  }, 4 * 60 * 60 * 1000);

  // Event: Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('Update available:', info.version);
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('No updates available. Current version:', info.version);
    mainWindow.webContents.send('update-not-available', {
      version: info.version,
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download progress: ${progress.percent.toFixed(1)}%`);
    mainWindow.webContents.send('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('Update downloaded:', info.version);
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);

    // Categorize the error for reporting
    let errorType: 'checksum' | 'network' | 'download' | 'install' | 'unknown' = 'unknown';
    if (error.message?.includes('sha512 checksum mismatch')) {
      errorType = 'checksum';
    } else if (
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('net::')
    ) {
      errorType = 'network';
    } else if (error.message?.includes('download')) {
      errorType = 'download';
    } else if (error.message?.includes('install') || error.message?.includes('EPERM')) {
      errorType = 'install';
    }

    // Report the error (if user has opted in)
    reportUpdateError(errorType, error.message, {
      currentVersion: autoUpdater.currentVersion?.version,
    });

    mainWindow.webContents.send('update-error', {
      message: error.message,
    });
  });

  // IPC: Manual check for updates
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // IPC: Start download
  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // IPC: Quit and install
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // IPC: Get current version
  ipcMain.handle('get-app-version', () => {
    return autoUpdater.currentVersion.version;
  });
}

export function stopAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

/**
 * Initialize error reporting IPC handlers.
 * This should be called regardless of dev/prod mode.
 */
export function initErrorReportingHandlers(): void {
  // IPC: Set error reporting enabled/disabled
  ipcMain.handle('set-error-reporting-enabled', (_event, enabled: boolean) => {
    setErrorReportingEnabled(enabled);
    return { success: true };
  });
}
