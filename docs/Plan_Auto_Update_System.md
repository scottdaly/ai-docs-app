# Auto-Update System Implementation Plan

## Overview

Implement automatic software updates for Midlight using `electron-updater` with GitHub Releases as the distribution server. This enables users to receive updates automatically or be notified when new versions are available.

---

## Current State

- **Build System**: electron-builder v24.9.1 (already installed)
- **CI/CD**: GitHub Actions workflow creates releases on tag push
- **Distribution**: GitHub Releases with `.dmg`, `.zip` (macOS) and `.exe`, `.msi` (Windows)
- **Version**: Currently at v0.0.1
- **Missing**: `electron-updater` package and all update infrastructure

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Releases                          │
│  (Hosts release artifacts + latest.yml / latest-mac.yml)        │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                      Electron Main Process                       │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  autoUpdater    │───▶│  Update Lifecycle Management      │   │
│  │  (electron-     │    │  - Check for updates              │   │
│  │   updater)      │    │  - Download in background         │   │
│  └─────────────────┘    │  - Notify renderer via IPC        │   │
│                         │  - Install on quit                │   │
│                         └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process (UI)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Update Notification Component                              │ │
│  │  - "Update available" banner/toast                         │ │
│  │  - Download progress indicator                              │ │
│  │  - "Restart to Update" button                              │ │
│  │  - Release notes display                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Install electron-updater

```bash
npm install electron-updater
npm install --save-dev @types/electron-updater  # If needed for types
```

**Note**: `electron-updater` is the standard auto-update solution for Electron apps distributed outside the Mac App Store. It works seamlessly with electron-builder.

---

### Step 2: Configure electron-builder for Publishing

Update `package.json` build configuration to include publish settings:

```json
{
  "build": {
    "appId": "com.midlight.app",
    "productName": "Midlight",
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME_OR_ORG",
      "repo": "ai-doc-app"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns",
      "category": "public.app-category.productivity",
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    }
  }
}
```

**Important**: The `zip` target for macOS is required for auto-updates (DMG alone won't work).

---

### Step 3: Create Update Service in Main Process

Create a new file `electron/services/autoUpdateService.ts`:

```typescript
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto-download so user can choose when to download
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Check for updates on startup (with delay to not block app launch)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Failed to check for updates:', err);
    });
  }, 10000); // 10 second delay

  // Set up periodic update checks (every 4 hours)
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Failed to check for updates:', err);
    });
  }, 4 * 60 * 60 * 1000);

  // Event: Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available:', info.version);
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('No updates available. Current version:', info.version);
    mainWindow.webContents.send('update-not-available', {
      version: info.version,
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    mainWindow.webContents.send('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('Update downloaded:', info.version);
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
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
```

---

### Step 4: Integrate Update Service in Main Process

Update `electron/main.ts` to initialize the auto-updater:

```typescript
import { initAutoUpdater } from './services/autoUpdateService';

// After creating the main window:
app.whenReady().then(() => {
  createWindow();

  // Initialize auto-updater after window is created
  if (mainWindow && !isDev) {
    initAutoUpdater(mainWindow);
  }
});
```

**Note**: Only enable auto-updates in production builds (not during development).

---

### Step 5: Update Preload Script

Add update-related IPC channels to `electron/preload.ts`:

```typescript
// Add to contextBridge.exposeInMainWorld('electronAPI', { ... })

// Auto-update methods
checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
downloadUpdate: () => ipcRenderer.invoke('download-update'),
quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
getAppVersion: () => ipcRenderer.invoke('get-app-version'),

// Auto-update event listeners
onUpdateAvailable: (callback: (data: UpdateAvailableData) => void) => {
  ipcRenderer.on('update-available', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('update-available');
},
onUpdateNotAvailable: (callback: (data: { version: string }) => void) => {
  ipcRenderer.on('update-not-available', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('update-not-available');
},
onUpdateDownloadProgress: (callback: (data: DownloadProgress) => void) => {
  ipcRenderer.on('update-download-progress', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('update-download-progress');
},
onUpdateDownloaded: (callback: (data: UpdateDownloadedData) => void) => {
  ipcRenderer.on('update-downloaded', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('update-downloaded');
},
onUpdateError: (callback: (data: { message: string }) => void) => {
  ipcRenderer.on('update-error', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('update-error');
},
```

---

### Step 6: Create Update UI Components

Create `src/components/UpdateNotification.tsx`:

```typescript
import { useState, useEffect } from 'react';

interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  progress?: number;
  releaseNotes?: string;
  error?: string;
}

export function UpdateNotification() {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const cleanups = [
      api.onUpdateAvailable((data) => {
        setUpdateState({
          status: 'available',
          version: data.version,
          releaseNotes: data.releaseNotes,
        });
        setDismissed(false);
      }),
      api.onUpdateDownloadProgress((data) => {
        setUpdateState((prev) => ({
          ...prev,
          status: 'downloading',
          progress: data.percent,
        }));
      }),
      api.onUpdateDownloaded((data) => {
        setUpdateState({
          status: 'ready',
          version: data.version,
          releaseNotes: data.releaseNotes,
        });
      }),
      api.onUpdateError((data) => {
        setUpdateState({
          status: 'error',
          error: data.message,
        });
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);

  const handleDownload = async () => {
    setUpdateState((prev) => ({ ...prev, status: 'downloading', progress: 0 }));
    await window.electronAPI?.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI?.quitAndInstall();
  };

  if (dismissed || updateState.status === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-background border rounded-lg shadow-lg p-4">
        {updateState.status === 'available' && (
          <>
            <h3 className="font-semibold">Update Available</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Version {updateState.version} is ready to download.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
              >
                Download
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Later
              </button>
            </div>
          </>
        )}

        {updateState.status === 'downloading' && (
          <>
            <h3 className="font-semibold">Downloading Update</h3>
            <div className="mt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${updateState.progress || 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(updateState.progress || 0).toFixed(0)}% complete
              </p>
            </div>
          </>
        )}

        {updateState.status === 'ready' && (
          <>
            <h3 className="font-semibold">Ready to Install</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Version {updateState.version} has been downloaded.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
              >
                Restart & Update
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Later
              </button>
            </div>
          </>
        )}

        {updateState.status === 'error' && (
          <>
            <h3 className="font-semibold text-destructive">Update Error</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {updateState.error}
            </p>
            <button
              onClick={() => setDismissed(true)}
              className="mt-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

---

### Step 7: Add Update Check to Settings/Help Menu

Add a "Check for Updates" option to the Help menu in `electron/main.ts`:

```typescript
{
  label: 'Help',
  submenu: [
    {
      label: 'Check for Updates...',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('menu-check-for-updates');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'About Midlight',
      click: () => {
        // Show about dialog
      },
    },
  ],
}
```

---

### Step 8: Update GitHub Actions Workflow

Update `.github/workflows/build.yml` to publish releases properly:

```yaml
- name: Build Electron app
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # Code signing secrets (when ready)
    # CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
    # CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
  run: npm run build
```

**Important**: The `GH_TOKEN` is required for electron-updater to access GitHub releases for update checks.

---

### Step 9: Code Signing (Required for Production)

For auto-updates to work reliably, especially on macOS, code signing is essential:

**macOS:**
1. Obtain an Apple Developer ID certificate
2. Add secrets to GitHub:
   - `MAC_CERTIFICATE`: Base64-encoded .p12 certificate
   - `MAC_CERTIFICATE_PASSWORD`: Certificate password
   - `APPLE_ID`: Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password from Apple ID settings
   - `APPLE_TEAM_ID`: Your Apple Developer Team ID

**Windows:**
1. Obtain a code signing certificate (DigiCert, Sectigo, etc.)
2. Add secrets to GitHub:
   - `WIN_CSC_LINK`: Base64-encoded certificate
   - `WIN_CSC_KEY_PASSWORD`: Certificate password

---

## Update Flow Summary

1. **App Launch**: After 10 seconds, app checks GitHub Releases for newer version
2. **Update Available**: User sees notification with version number
3. **User Choice**: Click "Download" or dismiss
4. **Download**: Progress shown in notification UI
5. **Ready**: User prompted to "Restart & Update"
6. **Install**: On restart, update is applied automatically

---

## Testing the Update System

### Local Development Testing

1. Build a release version:
   ```bash
   npm run build
   ```

2. Install the built app from `release/` folder

3. Modify `package.json` version to a higher number (e.g., `0.0.2`)

4. Create a GitHub release with the new version:
   ```bash
   git tag v0.0.2
   git push origin v0.0.2
   ```

5. Wait for GitHub Actions to build and publish

6. Open the installed app - it should detect the update

### Debug Mode

Add to `autoUpdateService.ts` for debugging:

```typescript
// Enable detailed logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'debug';

// For testing without code signing (NOT for production)
// autoUpdater.forceDevUpdateConfig = true;
```

---

## Security Considerations

1. **Code Signing**: Required for production to prevent tampering
2. **HTTPS Only**: electron-updater only downloads over HTTPS
3. **Signature Verification**: Updates are verified against the build signature
4. **No Downgrade**: By default, electron-updater prevents downgrading

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add electron-updater dep + publish config |
| `electron/services/autoUpdateService.ts` | Create | Update service with event handlers |
| `electron/main.ts` | Modify | Initialize auto-updater |
| `electron/preload.ts` | Modify | Expose update IPC channels |
| `src/components/UpdateNotification.tsx` | Create | UI for update notifications |
| `src/App.tsx` | Modify | Add UpdateNotification component |
| `.github/workflows/build.yml` | Modify | Ensure GH_TOKEN is passed |

---

## Rollback Strategy

If an update causes issues:

1. Users can download the previous version from GitHub Releases manually
2. Consider implementing a "rollback" feature that keeps previous version cached
3. Use staged rollouts (publish as draft, test, then release)

---

## Future Enhancements

- **Delta Updates**: Use `electron-differential-updater` for smaller downloads
- **Staged Rollouts**: Release to subset of users first
- **Update Channels**: Beta/Stable channels for testing
- **Silent Updates**: Option for fully automatic updates
- **In-App Release Notes**: Show changelog before/after update
