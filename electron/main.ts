import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import mammoth from 'mammoth'
import { Worker } from 'worker_threads'
import {
  getWorkspaceManager,
  clearWorkspaceManagers,
  FileWatcher,
  FileChangeEvent,
  detectSourceType,
  analyzeObsidianVault,
  importObsidianVault,
  analyzeNotionExport,
  importNotionExport,
  ImportOptions,
  ImportProgress,
  NotionImportOptions,
  validatePath,
} from './services'

// Active file watchers by workspace root
const fileWatchers: Map<string, FileWatcher> = new Map();

// The built directory structure
//
// ├─┬─ dist
// │ ├─ index.html
// │ ├─── assets
// │ └─── index.<hash>.js
// ├─┬─ dist-electron
// │ ├─── main.js
// │ └─── preload.js
//
// When packaged, both dist and dist-electron are in the asar
// In development, dist folder is at ../dist relative to dist-electron
const DIST_PATH = app.isPackaged
  ? path.join(app.getAppPath(), 'dist')
  : path.join(__dirname, '../dist')

process.env.DIST = DIST_PATH
process.env.VITE_PUBLIC = app.isPackaged ? DIST_PATH : path.join(__dirname, '../public')

// Set app name for menu bar
app.setName('Midlight')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hidden', // MacOS style
    trafficLightPosition: { x: 15, y: 15 }, // Adjust for MacOS
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
  
  createMenu(win);
}

function createMenu(window: BrowserWindow) {
    const isMac = process.platform === 'darwin';

    const template: MenuItemConstructorOptions[] = [
        // { role: 'appMenu' }
        ...(isMac
          ? [{
              label: 'Midlight',
              submenu: [
                { role: 'about', label: 'About Midlight' },
                { type: 'separator' },
                { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: () => window.webContents.send('menu-action', 'open-settings') },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
              ]
            }] as MenuItemConstructorOptions[]
          : []),
        // { role: 'fileMenu' }
        {
          label: 'File',
          submenu: [
            { label: 'Open Workspace...', accelerator: 'CmdOrCtrl+O', click: () => {
                // Trigger the existing select-directory logic via IPC?
                // Or send a message to renderer to trigger it.
                // Since our logic is currently renderer-driven (store calls invoke),
                // let's send a message to renderer to start the flow.
                window.webContents.send('menu-action', 'open-workspace');
            }},
            { type: 'separator' },
            {
              label: 'Import',
              submenu: [
                { label: 'From Obsidian Vault...', click: () => window.webContents.send('menu-action', 'import-obsidian') },
                { label: 'From Notion Export...', click: () => window.webContents.send('menu-action', 'import-notion') },
                { type: 'separator' },
                { label: 'From DOCX File...', click: () => window.webContents.send('menu-action', 'import-docx') },
              ]
            },
            {
              label: 'Export',
              submenu: [
                { label: 'To PDF...', click: () => window.webContents.send('menu-action', 'export-pdf') },
                { label: 'To DOCX...', click: () => window.webContents.send('menu-action', 'export-docx') },
              ]
            },
            { type: 'separator' },
            ...(isMac ? [] : [{ label: 'Settings', accelerator: 'Ctrl+,', click: () => window.webContents.send('menu-action', 'open-settings') }]),
            (isMac ? { role: 'close' } : { role: 'quit' }) as MenuItemConstructorOptions
          ]
        },
        // { role: 'editMenu' }
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac
              ? [
                  { role: 'pasteAndMatchStyle' },
                  { role: 'delete' },
                  { role: 'selectAll' },
                  { type: 'separator' },
                  {
                    label: 'Speech',
                    submenu: [
                      { role: 'startSpeaking' },
                      { role: 'stopSpeaking' }
                    ]
                  }
                ]
              : [
                  { role: 'delete' },
                  { type: 'separator' },
                  { role: 'selectAll' }
                ]) as MenuItemConstructorOptions[]
          ]
        },
        // { role: 'viewMenu' }
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
            { type: 'separator' },
            {
                label: 'Theme',
                submenu: [
                    { label: 'Light', type: 'radio', click: () => window.webContents.send('update-theme', 'light') },
                    { label: 'Dark', type: 'radio', click: () => window.webContents.send('update-theme', 'dark') },
                    { label: 'Midnight', type: 'radio', click: () => window.webContents.send('update-theme', 'midnight') },
                    { label: 'Sepia', type: 'radio', click: () => window.webContents.send('update-theme', 'sepia') },
                    { label: 'Forest', type: 'radio', click: () => window.webContents.send('update-theme', 'forest') },
                    { label: 'Cyberpunk', type: 'radio', click: () => window.webContents.send('update-theme', 'cyberpunk') },
                    { label: 'Coffee', type: 'radio', click: () => window.webContents.send('update-theme', 'coffee') },
                    { label: 'System', type: 'radio', click: () => window.webContents.send('update-theme', 'system') },
                ]
            }
          ]
        },
        // { role: 'windowMenu' }
        {
          label: 'Window',
          submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            ...(isMac
              ? [
                  { type: 'separator' },
                  { role: 'front' },
                  { type: 'separator' },
                  { role: 'window' }
                ]
              : [
                  { role: 'close' }
                ]) as MenuItemConstructorOptions[]
          ]
        },
        {
          role: 'help',
          submenu: [
            {
              label: 'Learn More',
              click: async () => {
                await shell.openExternal('https://electronjs.org')
              }
            }
          ]
        }
      ]
    
      const menu = Menu.buildFromTemplate(template)
      Menu.setApplicationMenu(menu)
}

// --- IPC Handlers ---

ipcMain.handle('select-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
  })
  if (canceled) return null
  return filePaths[0]
})

ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (canceled) return null
  return filePaths[0]
})

// File categorization helpers
// NOTE: These utilities are duplicated in src/shared/fileUtils.ts for use in the renderer process.
// Electron main and renderer processes cannot share code directly, so keep them in sync manually.
const IMPORTABLE_EXTENSIONS = new Set(['.docx', '.rtf', '.html', '.odt']);
const VIEWABLE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.pdf'
]);
const HIDDEN_FOLDERS = new Set([
  '.midlight', '.git', '.svn', '.hg', 'node_modules', '.vscode', '.idea'
]);
const HIDDEN_FILES = new Set(['.DS_Store', 'Thumbs.db', '.gitignore', '.gitattributes']);

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.slice(lastDot).toLowerCase();
}

function isMidlightMetadataFile(filename: string): boolean {
  return filename.endsWith('.md.midlight');
}

function shouldHideFolder(folderName: string): boolean {
  return HIDDEN_FOLDERS.has(folderName) || folderName.startsWith('.');
}

function shouldHideFile(filename: string): boolean {
  if (isMidlightMetadataFile(filename)) return true;
  if (HIDDEN_FILES.has(filename)) return true;
  return false;
}

type FileCategory = 'native' | 'compatible' | 'importable' | 'viewable' | 'unsupported';

function categorizeFile(filename: string, hasSidecar: boolean): FileCategory {
  const ext = getExtension(filename);

  if (ext === '.md') {
    // Check if this file has a sidecar in .midlight/sidecars/
    if (hasSidecar) {
      return 'native';
    }
    return 'compatible';
  }

  if (IMPORTABLE_EXTENSIONS.has(ext)) return 'importable';
  if (VIEWABLE_EXTENSIONS.has(ext)) return 'viewable';
  return 'unsupported';
}

// Get sidecar filename for a given file path relative to workspace
function getSidecarFilename(fileKey: string): string {
  const safeName = fileKey.replace(/[\\/]/g, '_').replace('.md', '');
  return `${safeName}.json`;
}

function getDisplayName(filename: string, category: FileCategory): string {
  if (category === 'native') {
    return filename.replace(/\.md$/i, '');
  }
  return filename;
}

// Find workspace root by looking for .midlight folder (walk up directories)
async function findWorkspaceRoot(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const midlightPath = path.join(currentDir, '.midlight');
    try {
      const stat = await fs.stat(midlightPath);
      if (stat.isDirectory()) {
        return currentDir;
      }
    } catch {
      // .midlight doesn't exist here, keep looking
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

// Get set of existing sidecar filenames in a workspace
async function getExistingSidecars(workspaceRoot: string): Promise<Set<string>> {
  const sidecarsDir = path.join(workspaceRoot, '.midlight', 'sidecars');
  const sidecars = new Set<string>();

  try {
    const files = await fs.readdir(sidecarsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        sidecars.add(file);
      }
    }
  } catch {
    // sidecars directory doesn't exist yet
  }

  return sidecars;
}

ipcMain.handle('read-dir', async (_, dirPath: string) => {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });

    // Find workspace root to check for sidecars
    const workspaceRoot = await findWorkspaceRoot(dirPath);
    let existingSidecars = new Set<string>();

    if (workspaceRoot) {
      existingSidecars = await getExistingSidecars(workspaceRoot);
    }

    // Filter and categorize files
    const files = dirents
      .filter(dirent => {
        if (dirent.isDirectory()) {
          return !shouldHideFolder(dirent.name);
        }
        return !shouldHideFile(dirent.name);
      })
      .map(dirent => {
        const isDir = dirent.isDirectory();
        const filePath = path.join(dirPath, dirent.name);

        // Check if this file has a sidecar
        let hasSidecar = false;
        if (!isDir && workspaceRoot && getExtension(dirent.name) === '.md') {
          const fileKey = path.relative(workspaceRoot, filePath);
          const sidecarFilename = getSidecarFilename(fileKey);
          hasSidecar = existingSidecars.has(sidecarFilename);
        }

        const category = isDir ? undefined : categorizeFile(dirent.name, hasSidecar);
        const displayName = isDir ? dirent.name : getDisplayName(dirent.name, category!);

        return {
          name: dirent.name,
          path: filePath,
          type: isDir ? 'directory' : 'file',
          category,
          displayName,
        };
      });

    return files;
  } catch (error) {
    console.error('Failed to read directory:', error);
    throw error;
  }
})

ipcMain.handle('read-file', async (_, filePath: string) => {
  return fs.readFile(filePath, 'utf-8')
})

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  return fs.writeFile(filePath, content, 'utf-8')
})

ipcMain.handle('create-folder', async (_, folderPath: string) => {
  return fs.mkdir(folderPath, { recursive: true })
})

ipcMain.handle('delete-file', async (_, filePath: string) => {
    // Basic implementation: using rm for both files and directories for now (careful!)
    // In a real app, we'd probably move to trash.
    return fs.rm(filePath, { recursive: true, force: true })
})

ipcMain.handle('rename-file', async (_, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
    return newPath
})

// --- File Browser Context Menu Operations ---

ipcMain.handle('file:duplicate', async (_, filePath: string) => {
    try {
        const dir = path.dirname(filePath)
        const ext = path.extname(filePath)
        const baseName = path.basename(filePath, ext)

        // Find a unique name
        let newPath = path.join(dir, `${baseName} (copy)${ext}`)
        let counter = 1
        while (true) {
            try {
                await fs.access(newPath)
                // File exists, try next name
                newPath = path.join(dir, `${baseName} (copy ${counter})${ext}`)
                counter++
            } catch {
                // File doesn't exist, use this name
                break
            }
        }

        await fs.copyFile(filePath, newPath)
        return { success: true, newPath }
    } catch (error) {
        console.error('Failed to duplicate file:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('file:trash', async (_, filePath: string) => {
    try {
        // Use shell.trashItem for proper trash behavior on all platforms
        await shell.trashItem(filePath)
        return { success: true }
    } catch (error) {
        console.error('Failed to trash file:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('file:revealInFinder', async (_, filePath: string) => {
    try {
        shell.showItemInFolder(filePath)
        return { success: true }
    } catch (error) {
        console.error('Failed to reveal in finder:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('file:copyPath', async (_, filePath: string) => {
    try {
        const { clipboard } = await import('electron')
        clipboard.writeText(filePath)
        return { success: true }
    } catch (error) {
        console.error('Failed to copy path:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('folder:create', async (_, parentPath: string, name: string) => {
    try {
        const folderPath = path.join(parentPath, name)
        await fs.mkdir(folderPath, { recursive: true })
        return { success: true, path: folderPath }
    } catch (error) {
        console.error('Failed to create folder:', error)
        return { success: false, error: String(error) }
    }
})

// Helper function to copy a directory recursively
async function copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath)
        } else {
            await fs.copyFile(srcPath, destPath)
        }
    }
}

// Helper function to get a unique destination path
async function getUniqueDestPath(destDir: string, baseName: string, ext: string): Promise<string> {
    let destPath = path.join(destDir, `${baseName}${ext}`)
    let counter = 1

    while (true) {
        try {
            await fs.access(destPath)
            // File exists, try next name
            destPath = path.join(destDir, `${baseName} (${counter})${ext}`)
            counter++
        } catch {
            // File doesn't exist, use this name
            break
        }
    }

    return destPath
}

ipcMain.handle('file:copyTo', async (_, sourcePaths: string[], destDir: string) => {
    try {
        const results: { source: string; dest: string; success: boolean }[] = []

        for (const sourcePath of sourcePaths) {
            const ext = path.extname(sourcePath)
            const baseName = path.basename(sourcePath, ext)
            const destPath = await getUniqueDestPath(destDir, baseName, ext)

            const stat = await fs.stat(sourcePath)
            if (stat.isDirectory()) {
                await copyDirectory(sourcePath, destPath)
            } else {
                await fs.copyFile(sourcePath, destPath)
            }

            results.push({ source: sourcePath, dest: destPath, success: true })
        }

        return { success: true, results }
    } catch (error) {
        console.error('Failed to copy files:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('file:moveTo', async (_, sourcePaths: string[], destDir: string) => {
    try {
        const results: { source: string; dest: string; success: boolean }[] = []

        for (const sourcePath of sourcePaths) {
            const ext = path.extname(sourcePath)
            const baseName = path.basename(sourcePath, ext)
            const destPath = await getUniqueDestPath(destDir, baseName, ext)

            // Use rename for moving (works across same filesystem)
            // Falls back to copy + delete for cross-filesystem moves
            try {
                await fs.rename(sourcePath, destPath)
            } catch (renameError: any) {
                // If rename fails (cross-device), copy then delete
                if (renameError.code === 'EXDEV') {
                    const stat = await fs.stat(sourcePath)
                    if (stat.isDirectory()) {
                        await copyDirectory(sourcePath, destPath)
                        await fs.rm(sourcePath, { recursive: true })
                    } else {
                        await fs.copyFile(sourcePath, destPath)
                        await fs.unlink(sourcePath)
                    }
                } else {
                    throw renameError
                }
            }

            results.push({ source: sourcePath, dest: destPath, success: true })
        }

        return { success: true, results }
    } catch (error) {
        console.error('Failed to move files:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('import-docx', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });
    if (canceled) return null;

    try {
        const buffer = await fs.readFile(filePaths[0]);

        // Configure mammoth to convert images to base64 data URLs
        const options = {
            convertImage: mammoth.images.imgElement(function(image: any) {
                return image.read("base64").then(function(imageBuffer: string) {
                    return {
                        src: "data:" + image.contentType + ";base64," + imageBuffer
                    };
                });
            })
        };

        const result = await mammoth.convertToHtml({ buffer }, options);

        // Log any conversion messages (warnings about unsupported features)
        if (result.messages.length > 0) {
            console.log('DOCX import messages:', result.messages);
        }

        // Extract filename without extension from the original path
        const originalFilename = path.basename(filePaths[0], '.docx');

        return {
            html: result.value,
            filename: originalFilename
        };
    } catch (error) {
        console.error('Failed to import DOCX:', error);
        throw error;
    }
});

// Import DOCX from a specific file path (for sidebar clicks)
ipcMain.handle('import-docx-from-path', async (_, filePath: string) => {
    try {
        const buffer = await fs.readFile(filePath);

        // Configure mammoth to convert images to base64 data URLs
        const options = {
            convertImage: mammoth.images.imgElement(function(image: any) {
                return image.read("base64").then(function(imageBuffer: string) {
                    return {
                        src: "data:" + image.contentType + ";base64," + imageBuffer
                    };
                });
            })
        };

        const result = await mammoth.convertToHtml({ buffer }, options);

        // Log any conversion messages (warnings about unsupported features)
        if (result.messages.length > 0) {
            console.log('DOCX import messages:', result.messages);
        }

        // Extract filename without extension from the original path
        const originalFilename = path.basename(filePath, '.docx');

        return {
            success: true,
            html: result.value,
            filename: originalFilename
        };
    } catch (error) {
        console.error('Failed to import DOCX from path:', error);
        return {
            success: false,
            error: String(error)
        };
    }
});

ipcMain.handle('export-pdf', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return;

    try {
        const data = await win!.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
                top: 1, // inches approx
                bottom: 1,
                left: 1,
                right: 1
            }
        });
        await fs.writeFile(filePath, data);
        return true;
    } catch (error) {
        console.error('Failed to export PDF:', error);
        throw error;
    }
});

ipcMain.handle('export-docx', async (_, content: any) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });
    if (canceled || !filePath) return { success: false, canceled: true };

    return new Promise((resolve, reject) => {
        // Create worker for DOCX generation
        const workerPath = path.join(__dirname, 'docx-worker.js');
        const worker = new Worker(workerPath, { workerData: content });

        worker.on('message', async (message: any) => {
            if (message.type === 'progress') {
                // Send progress to renderer
                win?.webContents.send('docx-export-progress', {
                    current: message.current,
                    total: message.total,
                    phase: message.phase,
                });
            } else if (message.type === 'complete') {
                try {
                    await fs.writeFile(filePath, Buffer.from(message.buffer));
                    win?.webContents.send('docx-export-progress', { complete: true });
                    resolve({ success: true, filePath });
                } catch (error) {
                    console.error('Failed to write DOCX file:', error);
                    win?.webContents.send('docx-export-progress', { error: String(error) });
                    reject(error);
                } finally {
                    worker.terminate();
                }
            } else if (message.type === 'error') {
                console.error('DOCX worker error:', message.error);
                win?.webContents.send('docx-export-progress', { error: message.error });
                worker.terminate();
                reject(new Error(message.error));
            }
        });

        worker.on('error', (error) => {
            console.error('Worker error:', error);
            win?.webContents.send('docx-export-progress', { error: String(error) });
            reject(error);
        });
    });
});

// --- Storage & Versioning IPC Handlers ---

// Initialize workspace (creates .midlight folder and all services)
ipcMain.handle('workspace:init', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        await manager.init();

        // Start file watcher for this workspace
        if (!fileWatchers.has(workspaceRoot)) {
            const watcher = new FileWatcher(workspaceRoot);

            watcher.on('change', (event: FileChangeEvent) => {
                // Forward file change events to renderer
                win?.webContents.send('file-changed-externally', {
                    type: event.type,
                    fileKey: event.fileKey,
                    absolutePath: event.absolutePath,
                    timestamp: event.timestamp.toISOString(),
                });
            });

            watcher.on('error', (error: Error) => {
                console.error('FileWatcher error:', error);
            });

            await watcher.start();
            fileWatchers.set(workspaceRoot, watcher);
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to initialize workspace:', error);
        return { success: false, error: String(error) };
    }
});

// Load document (Markdown + Sidecar -> Tiptap JSON)
ipcMain.handle('workspace:loadDocument', async (_, workspaceRoot: string, filePath: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const result = await manager.loadDocument(filePath);

        // Convert filePath to relative path (fileKey) for watcher matching
        const fileKey = filePath.startsWith(workspaceRoot)
            ? filePath.slice(workspaceRoot.length + 1)
            : filePath;

        // Update file watcher mtime after loading
        const watcher = fileWatchers.get(workspaceRoot);
        if (watcher) {
            await watcher.updateMtime(fileKey);
        }

        return { success: true, ...result };
    } catch (error) {
        console.error('Failed to load document:', error);
        return { success: false, error: String(error) };
    }
});

// Load from recovery
ipcMain.handle('workspace:loadFromRecovery', async (_, workspaceRoot: string, filePath: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const result = await manager.loadFromRecovery(filePath);
        if (!result) {
            return { success: false, error: 'No recovery found' };
        }
        return { success: true, ...result };
    } catch (error) {
        console.error('Failed to load from recovery:', error);
        return { success: false, error: String(error) };
    }
});

// Discard recovery
ipcMain.handle('workspace:discardRecovery', async (_, workspaceRoot: string, filePath: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const result = await manager.discardRecovery(filePath);
        return { success: true, ...result };
    } catch (error) {
        console.error('Failed to discard recovery:', error);
        return { success: false, error: String(error) };
    }
});

// Save document (Tiptap JSON -> Markdown + Sidecar)
ipcMain.handle('workspace:saveDocument', async (_, workspaceRoot: string, filePath: string, json: any, trigger?: string) => {
    const watcher = fileWatchers.get(workspaceRoot);

    // Convert filePath to relative path (fileKey) for watcher matching
    const fileKey = filePath.startsWith(workspaceRoot)
        ? filePath.slice(workspaceRoot.length + 1)
        : filePath;

    try {
        // Mark file as saving to ignore our own change events
        if (watcher) {
            watcher.markSaving(fileKey);
        }

        const manager = getWorkspaceManager(workspaceRoot);
        const result = await manager.saveDocument(filePath, json, trigger as any);

        // Clear saving mark and update mtime
        if (watcher) {
            watcher.clearSaving(fileKey);
        }

        return result;
    } catch (error) {
        // Clear saving mark on error too
        if (watcher) {
            watcher.clearSaving(fileKey);
        }
        console.error('Failed to save document:', error);
        return { success: false, error: String(error) };
    }
});

// Get checkpoints for a file
ipcMain.handle('workspace:getCheckpoints', async (_, workspaceRoot: string, filePath: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const checkpoints = await manager.getCheckpoints(filePath);
        return { success: true, checkpoints };
    } catch (error) {
        console.error('Failed to get checkpoints:', error);
        return { success: false, error: String(error) };
    }
});

// Get checkpoint content
ipcMain.handle('workspace:getCheckpointContent', async (_, workspaceRoot: string, filePath: string, checkpointId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const content = await manager.getCheckpointContent(filePath, checkpointId);
        if (!content) {
            return { success: false, error: 'Checkpoint not found' };
        }
        return { success: true, content };
    } catch (error) {
        console.error('Failed to get checkpoint content:', error);
        return { success: false, error: String(error) };
    }
});

// Restore checkpoint
ipcMain.handle('workspace:restoreCheckpoint', async (_, workspaceRoot: string, filePath: string, checkpointId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const content = await manager.restoreCheckpoint(filePath, checkpointId);
        if (!content) {
            return { success: false, error: 'Checkpoint not found' };
        }
        return { success: true, content };
    } catch (error) {
        console.error('Failed to restore checkpoint:', error);
        return { success: false, error: String(error) };
    }
});

// Create bookmark
ipcMain.handle('workspace:createBookmark', async (_, workspaceRoot: string, filePath: string, json: any, label: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const checkpoint = await manager.createBookmark(filePath, json, label);
        if (!checkpoint) {
            return { success: false, error: 'Failed to create bookmark' };
        }
        return { success: true, checkpoint };
    } catch (error) {
        console.error('Failed to create bookmark:', error);
        return { success: false, error: String(error) };
    }
});

// Label existing checkpoint
ipcMain.handle('workspace:labelCheckpoint', async (_, workspaceRoot: string, filePath: string, checkpointId: string, label: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const success = await manager.labelCheckpoint(filePath, checkpointId, label);
        return { success };
    } catch (error) {
        console.error('Failed to label checkpoint:', error);
        return { success: false, error: String(error) };
    }
});

// Compare checkpoints
ipcMain.handle('workspace:compareCheckpoints', async (_, workspaceRoot: string, filePath: string, checkpointIdA: string, checkpointIdB: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const result = await manager.compareCheckpoints(filePath, checkpointIdA, checkpointIdB);
        if (!result) {
            return { success: false, error: 'Failed to compare checkpoints' };
        }
        return { success: true, ...result };
    } catch (error) {
        console.error('Failed to compare checkpoints:', error);
        return { success: false, error: String(error) };
    }
});

// Get image data URL from reference
ipcMain.handle('workspace:getImageDataUrl', async (_, workspaceRoot: string, imageRef: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const dataUrl = await manager.getImageDataUrl(imageRef);
        return { success: true, dataUrl };
    } catch (error) {
        console.error('Failed to get image data URL:', error);
        return { success: false, error: String(error) };
    }
});

// Check for recovery on startup
ipcMain.handle('workspace:checkForRecovery', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const recoveryFiles = await manager.checkForRecovery();
        return { success: true, recoveryFiles };
    } catch (error) {
        console.error('Failed to check for recovery:', error);
        return { success: false, error: String(error) };
    }
});

// Get storage stats
ipcMain.handle('workspace:getStorageStats', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const stats = await manager.getStorageStats();
        return { success: true, stats };
    } catch (error) {
        console.error('Failed to get storage stats:', error);
        return { success: false, error: String(error) };
    }
});

// Run garbage collection
ipcMain.handle('workspace:runGC', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const result = await manager.runGC();
        return { success: true, ...result };
    } catch (error) {
        console.error('Failed to run GC:', error);
        return { success: false, error: String(error) };
    }
});

// Get workspace config
ipcMain.handle('workspace:getConfig', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const config = manager.getConfig();
        return { success: true, config };
    } catch (error) {
        console.error('Failed to get config:', error);
        return { success: false, error: String(error) };
    }
});

// Update workspace config
ipcMain.handle('workspace:updateConfig', async (_, workspaceRoot: string, updates: any) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        await manager.updateConfig(updates);
        return { success: true };
    } catch (error) {
        console.error('Failed to update config:', error);
        return { success: false, error: String(error) };
    }
});

// Stop file watcher for a workspace (when switching workspaces)
ipcMain.handle('workspace:stopWatcher', async (_, workspaceRoot: string) => {
    try {
        const watcher = fileWatchers.get(workspaceRoot);
        if (watcher) {
            await watcher.stop();
            fileWatchers.delete(workspaceRoot);
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to stop file watcher:', error);
        return { success: false, error: String(error) };
    }
});

// Check if a file has external changes
ipcMain.handle('workspace:hasExternalChange', async (_, workspaceRoot: string, filePath: string) => {
    try {
        const watcher = fileWatchers.get(workspaceRoot);
        if (!watcher) {
            return { success: true, hasChange: false };
        }
        const hasChange = await watcher.hasExternalChange(filePath);
        return { success: true, hasChange };
    } catch (error) {
        console.error('Failed to check external change:', error);
        return { success: false, error: String(error) };
    }
});

// --- Draft IPC Handlers ---

// Create a new draft from current document state
ipcMain.handle('workspace:createDraft', async (_, workspaceRoot: string, filePath: string, name: string, json: any) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const draft = await manager.createDraftFromCurrent(filePath, name, json);
        if (!draft) {
            return { success: false, error: 'Failed to create draft' };
        }
        return { success: true, draft };
    } catch (error) {
        console.error('Failed to create draft:', error);
        return { success: false, error: String(error) };
    }
});

// Create a new draft from a checkpoint
ipcMain.handle('workspace:createDraftFromCheckpoint', async (_, workspaceRoot: string, filePath: string, name: string, checkpointId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const draft = await manager.createDraft(filePath, name, checkpointId);
        if (!draft) {
            return { success: false, error: 'Checkpoint not found' };
        }
        return { success: true, draft };
    } catch (error) {
        console.error('Failed to create draft from checkpoint:', error);
        return { success: false, error: String(error) };
    }
});

// Get all drafts for a file
ipcMain.handle('workspace:getDrafts', async (_, workspaceRoot: string, filePath: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const drafts = await manager.getDrafts(filePath);
        return { success: true, drafts };
    } catch (error) {
        console.error('Failed to get drafts:', error);
        return { success: false, error: String(error) };
    }
});

// Get all active drafts across all files
ipcMain.handle('workspace:getAllActiveDrafts', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const drafts = await manager.getAllActiveDrafts();
        return { success: true, drafts };
    } catch (error) {
        console.error('Failed to get all active drafts:', error);
        return { success: false, error: String(error) };
    }
});

// Get a specific draft
ipcMain.handle('workspace:getDraft', async (_, workspaceRoot: string, filePath: string, draftId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const draft = await manager.getDraft(filePath, draftId);
        if (!draft) {
            return { success: false, error: 'Draft not found' };
        }
        return { success: true, draft };
    } catch (error) {
        console.error('Failed to get draft:', error);
        return { success: false, error: String(error) };
    }
});

// Get draft content as Tiptap JSON
ipcMain.handle('workspace:getDraftContent', async (_, workspaceRoot: string, filePath: string, draftId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const content = await manager.getDraftContent(filePath, draftId);
        if (!content) {
            return { success: false, error: 'Draft not found' };
        }
        return { success: true, content };
    } catch (error) {
        console.error('Failed to get draft content:', error);
        return { success: false, error: String(error) };
    }
});

// Save draft content
ipcMain.handle('workspace:saveDraftContent', async (_, workspaceRoot: string, filePath: string, draftId: string, json: any, trigger?: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const checkpoint = await manager.saveDraftContent(filePath, draftId, json, trigger || 'auto');
        return { success: true, checkpointCreated: checkpoint };
    } catch (error) {
        console.error('Failed to save draft content:', error);
        return { success: false, error: String(error) };
    }
});

// Rename a draft
ipcMain.handle('workspace:renameDraft', async (_, workspaceRoot: string, filePath: string, draftId: string, newName: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const success = await manager.renameDraft(filePath, draftId, newName);
        return { success };
    } catch (error) {
        console.error('Failed to rename draft:', error);
        return { success: false, error: String(error) };
    }
});

// Apply (merge) a draft to the main document
ipcMain.handle('workspace:applyDraft', async (_, workspaceRoot: string, filePath: string, draftId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const content = await manager.applyDraft(filePath, draftId);
        if (!content) {
            return { success: false, error: 'Draft not found or could not be applied' };
        }
        return { success: true, content };
    } catch (error) {
        console.error('Failed to apply draft:', error);
        return { success: false, error: String(error) };
    }
});

// Discard a draft (archive it without applying)
ipcMain.handle('workspace:discardDraft', async (_, workspaceRoot: string, filePath: string, draftId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const success = await manager.discardDraft(filePath, draftId);
        return { success };
    } catch (error) {
        console.error('Failed to discard draft:', error);
        return { success: false, error: String(error) };
    }
});

// Delete a draft permanently
ipcMain.handle('workspace:deleteDraft', async (_, workspaceRoot: string, filePath: string, draftId: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const success = await manager.deleteDraft(filePath, draftId);
        return { success };
    } catch (error) {
        console.error('Failed to delete draft:', error);
        return { success: false, error: String(error) };
    }
});

// Count active drafts (for tier enforcement)
ipcMain.handle('workspace:countActiveDrafts', async (_, workspaceRoot: string) => {
    try {
        const manager = getWorkspaceManager(workspaceRoot);
        const count = await manager.countActiveDrafts();
        return { success: true, count };
    } catch (error) {
        console.error('Failed to count active drafts:', error);
        return { success: false, error: String(error) };
    }
});

// --- Import IPC Handlers ---

// Select folder for import
ipcMain.handle('import:selectFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Select folder to import',
    });
    if (canceled) return null;
    return filePaths[0];
});

// Detect source type (Obsidian, Notion, or generic)
ipcMain.handle('import:detectSourceType', async (_, folderPath: string) => {
    // Validate input path
    const pathValidation = validatePath(folderPath);
    if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
    }

    try {
        const sourceType = await detectSourceType(folderPath);
        return { success: true, sourceType };
    } catch (error) {
        console.error('Failed to detect source type:', error);
        return { success: false, error: String(error) };
    }
});

// Analyze Obsidian vault
ipcMain.handle('import:analyzeObsidian', async (_, vaultPath: string) => {
    // Validate input path
    const pathValidation = validatePath(vaultPath);
    if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
    }

    try {
        const analysis = await analyzeObsidianVault(vaultPath);
        return { success: true, analysis };
    } catch (error) {
        console.error('Failed to analyze Obsidian vault:', error);
        return { success: false, error: String(error) };
    }
});

// Import from Obsidian vault
ipcMain.handle('import:obsidian', async (_, analysisJson: string, destPath: string, optionsJson: string) => {
    // Validate destination path
    const destValidation = validatePath(destPath);
    if (!destValidation.valid) {
        return { success: false, error: destValidation.error };
    }

    // Validate JSON inputs
    if (!analysisJson || typeof analysisJson !== 'string') {
        return { success: false, error: 'Invalid analysis data' };
    }
    if (!optionsJson || typeof optionsJson !== 'string') {
        return { success: false, error: 'Invalid options data' };
    }

    try {
        const analysis = JSON.parse(analysisJson);
        const options: ImportOptions = JSON.parse(optionsJson);

        // Validate analysis has source path and it exists
        if (analysis.sourcePath) {
            const sourceValidation = validatePath(analysis.sourcePath);
            if (!sourceValidation.valid) {
                return { success: false, error: 'Invalid source path in analysis' };
            }
        }

        const result = await importObsidianVault(
            analysis,
            destPath,
            options,
            (progress: ImportProgress) => {
                // Send progress updates to renderer
                win?.webContents.send('import-progress', progress);
            }
        );

        return { success: true, result };
    } catch (error) {
        console.error('Failed to import Obsidian vault:', error);
        return { success: false, error: String(error) };
    }
});

// Analyze Notion export
ipcMain.handle('import:analyzeNotion', async (_, exportPath: string) => {
    // Validate input path
    const pathValidation = validatePath(exportPath);
    if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
    }

    try {
        const analysis = await analyzeNotionExport(exportPath);
        return { success: true, analysis };
    } catch (error) {
        console.error('Failed to analyze Notion export:', error);
        return { success: false, error: String(error) };
    }
});

// Import from Notion export
ipcMain.handle('import:notion', async (_, analysisJson: string, destPath: string, optionsJson: string) => {
    // Validate destination path
    const destValidation = validatePath(destPath);
    if (!destValidation.valid) {
        return { success: false, error: destValidation.error };
    }

    // Validate JSON inputs
    if (!analysisJson || typeof analysisJson !== 'string') {
        return { success: false, error: 'Invalid analysis data' };
    }
    if (!optionsJson || typeof optionsJson !== 'string') {
        return { success: false, error: 'Invalid options data' };
    }

    try {
        const analysis = JSON.parse(analysisJson);
        const options: NotionImportOptions = JSON.parse(optionsJson);

        // Validate analysis has source path
        if (analysis.sourcePath) {
            const sourceValidation = validatePath(analysis.sourcePath);
            if (!sourceValidation.valid) {
                return { success: false, error: 'Invalid source path in analysis' };
            }
        }

        const result = await importNotionExport(
            analysis,
            destPath,
            options,
            (progress: ImportProgress) => {
                // Send progress updates to renderer
                win?.webContents.send('import-progress', progress);
            }
        );

        return { success: true, result };
    } catch (error) {
        console.error('Failed to import Notion export:', error);
        return { success: false, error: String(error) };
    }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up workspace managers and file watchers on quit
app.on('before-quit', async () => {
  // Stop all file watchers
  for (const watcher of fileWatchers.values()) {
    await watcher.stop();
  }
  fileWatchers.clear();

  clearWorkspaceManagers();
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
