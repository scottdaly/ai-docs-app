import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readDir: (path: string) => ipcRenderer.invoke('read-dir', path),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  createFolder: (path: string) => ipcRenderer.invoke('create-folder', path),
  deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
  importDocx: () => ipcRenderer.invoke('import-docx'),
  exportPdf: () => ipcRenderer.invoke('export-pdf'),
  exportDocx: (content: any) => ipcRenderer.invoke('export-docx', content),
  
  // Listeners
  onMenuAction: (callback: (action: string) => void) => {
      const subscription = (_: any, action: string) => callback(action);
      ipcRenderer.on('menu-action', subscription);
      return () => ipcRenderer.off('menu-action', subscription);
  },
  onUpdateTheme: (callback: (theme: string) => void) => {
      const subscription = (_: any, theme: string) => callback(theme);
      ipcRenderer.on('update-theme', subscription);
      return () => ipcRenderer.off('update-theme', subscription);
  },
  onDocxExportProgress: (callback: (progress: { current?: number; total?: number; phase?: string; complete?: boolean; error?: string }) => void) => {
      const subscription = (_: any, progress: any) => callback(progress);
      ipcRenderer.on('docx-export-progress', subscription);
      return () => ipcRenderer.off('docx-export-progress', subscription);
  }
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
