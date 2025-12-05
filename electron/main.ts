import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import mammoth from 'mammoth'
import { Worker } from 'worker_threads'

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
            { label: 'Import DOCX...', click: () => window.webContents.send('menu-action', 'import-docx') },
            { label: 'Export to PDF...', click: () => window.webContents.send('menu-action', 'export-pdf') },
            { label: 'Export to DOCX...', click: () => window.webContents.send('menu-action', 'export-docx') },
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

ipcMain.handle('read-dir', async (_, dirPath: string) => {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    return dirents.map(dirent => ({
      name: dirent.name,
      path: path.join(dirPath, dirent.name),
      type: dirent.isDirectory() ? 'directory' : 'file',
    }));
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


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
