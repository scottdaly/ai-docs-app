"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  selectDirectory: () => electron.ipcRenderer.invoke("select-directory"),
  readDir: (path) => electron.ipcRenderer.invoke("read-dir", path),
  readFile: (path) => electron.ipcRenderer.invoke("read-file", path),
  writeFile: (path, content) => electron.ipcRenderer.invoke("write-file", path, content),
  createFolder: (path) => electron.ipcRenderer.invoke("create-folder", path),
  deleteFile: (path) => electron.ipcRenderer.invoke("delete-file", path),
  importDocx: () => electron.ipcRenderer.invoke("import-docx"),
  exportPdf: () => electron.ipcRenderer.invoke("export-pdf"),
  exportDocx: (content) => electron.ipcRenderer.invoke("export-docx", content),
  // Listeners
  onMenuAction: (callback) => {
    const subscription = (_, action) => callback(action);
    electron.ipcRenderer.on("menu-action", subscription);
    return () => electron.ipcRenderer.off("menu-action", subscription);
  },
  onUpdateTheme: (callback) => {
    const subscription = (_, theme) => callback(theme);
    electron.ipcRenderer.on("update-theme", subscription);
    return () => electron.ipcRenderer.off("update-theme", subscription);
  }
});
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
