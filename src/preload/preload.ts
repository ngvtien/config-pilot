import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  unmaximize: () => ipcRenderer.send("window:unmaximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  // App info
  getAppVersion: () => ipcRenderer.invoke("app:version"),

  // File operations
  openFile: (options?: any) => ipcRenderer.invoke("dialog:openFile", options),
  saveFile: (data: string) => ipcRenderer.invoke("dialog:saveFile", data),
  readFile: (filePath: string) => ipcRenderer.invoke("file:read", filePath),
  writeFile: (filePath: string, data: string) => ipcRenderer.invoke("file:write", { filePath, data }),
  fileExists: (path: string) => ipcRenderer.invoke("file:exists", { path }),
  getFileInfo: (path: string) => ipcRenderer.invoke("file:info", { path }),

  // Directory operations
  selectDirectory: (options?: any) => ipcRenderer.invoke("dialog:selectDirectory", options),
  createDirectory: (path: string) => ipcRenderer.invoke("directory:create", { path }),
  directoryExists: (path: string) => ipcRenderer.invoke("directory:exists", { path }),
  getDirectoryInfo: (path: string) => ipcRenderer.invoke("directory:info", { path }),
})
