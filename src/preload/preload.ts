import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'k8s:getContexts',
      'k8s:getCurrentContext',
      'k8s:setUserConfigPath',
      'k8s:getActiveConfigPath',
      'k8s:getAvailableConfigs',
      'k8s:switchContext',
      'window:isMaximized',
      'app:version',
      'dialog:openFile',
      'dialog:saveFile',
      'file:read',
      //'file:write',
      'fs:writeFile',
      'file:exists',
      'file:info',
      'app:getUserDataPath',
      'dialog:selectDirectory',
      'directory:create',
      'directory:exists',
      'directory:info',
      'fs:listDirectories',
      'fs:ensureDirectory',
      'k8s:setConfigPath',
      // Vault channels
      'vault:testConnection',
      'vault:storeCredentials',
      'vault:getCredentials',
      'vault:writeSecret',
      'vault:readSecret',
      // Secure credential channels
      'credentials:store',
      'credentials:get',
      'credentials:delete',

      // ArgoCD channels
      'argocd:testConnection',
      'argocd:storeCredentials',
      'argocd:getCredentials',
      'argocd:getApplications',
      'argocd:getApplication',
      'argocd:syncApplication',
      'argocd:createApplication',
      'argocd:updateApplication',
      'argocd:deleteApplication',    
    ]
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    throw new Error(`Invalid IPC channel: ${channel}`)
  },

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
  //writeFile: (filePath: string, data: string) => ipcRenderer.invoke("file:write", { filePath, data }),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  fileExists: (path: string) => ipcRenderer.invoke("file:exists", { path }),
  getFileInfo: (path: string) => ipcRenderer.invoke("file:info", { path }),

  // Directory operations
  selectDirectory: (options?: any) => ipcRenderer.invoke("dialog:selectDirectory", options),
  createDirectory: (path: string) => ipcRenderer.invoke("directory:create", { path }),
  directoryExists: (path: string) => ipcRenderer.invoke("directory:exists", { path }),
  getDirectoryInfo: (path: string) => ipcRenderer.invoke("directory:info", { path }),
  ensureDirectory: (dirPath: string) => ipcRenderer.invoke('fs:ensureDirectory', dirPath),
  listDirectories: (dirPath: string) => ipcRenderer.invoke('fs:listDirectories', dirPath),

  // k8s related operations
  setKubeConfigPath: (path: string) => ipcRenderer.invoke('k8s:setConfigPath', path),
  getAvailableConfigs: () => ipcRenderer.invoke('k8s:getAvailableConfigs'),
  getActiveConfigPath: () => ipcRenderer.invoke('k8s:getActiveConfigPath'),
  setUserConfigPath: (path: string) => ipcRenderer.invoke('k8s:setUserConfigPath', path),
  switchContext: (contextName: string) => ipcRenderer.invoke('k8s:switchContext', contextName),

  // Add to electronAPI object
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

 // Vault operations
 vault: {
    testConnection: (environment: string, url: string, token: string, namespace?: string) =>
      ipcRenderer.invoke('vault:testConnection', environment, url, token, namespace),
    storeCredentials: (environment: string, credentials: any) =>
      ipcRenderer.invoke('vault:storeCredentials', environment, credentials),
    getCredentials: (environment: string) =>
      ipcRenderer.invoke('vault:getCredentials', environment),
    writeSecret: (environment: string, path: string, key: string, value: string) =>
      ipcRenderer.invoke('vault:writeSecret', environment, path, key, value),
    readSecret: (environment: string, path: string, key: string) =>
      ipcRenderer.invoke('vault:readSecret', environment, path, key)
  },

  argocd: {
    testConnection: (environment: string, url: string, token: string, insecureSkipTLSVerify?: boolean) =>
      ipcRenderer.invoke('argocd:testConnection', environment, url, token, insecureSkipTLSVerify),
    storeCredentials: (environment: string, credentials: any) =>
      ipcRenderer.invoke('argocd:storeCredentials', environment, credentials),
    getCredentials: (environment: string) =>
      ipcRenderer.invoke('argocd:getCredentials', environment),
    getApplications: (environment: string) =>
      ipcRenderer.invoke('argocd:getApplications', environment),
    getApplication: (environment: string, name: string) =>
      ipcRenderer.invoke('argocd:getApplication', environment, name),
    syncApplication: (environment: string, name: string) =>
      ipcRenderer.invoke('argocd:syncApplication', environment, name),
    createApplication: (environment: string, application: any) =>
      ipcRenderer.invoke('argocd:createApplication', environment, application),
    updateApplication: (environment: string, name: string, application: any) =>
      ipcRenderer.invoke('argocd:updateApplication', environment, name, application),
    deleteApplication: (environment: string, name: string) =>
      ipcRenderer.invoke('argocd:deleteApplication', environment, name)
  },
    
  // Secure credential operations
  storeSecureCredentials: (key: string, data: string) =>
    ipcRenderer.invoke('credentials:store', key, data),
  getSecureCredentials: (key: string) =>
    ipcRenderer.invoke('credentials:get', key),
  deleteSecureCredentials: (key: string) =>
    ipcRenderer.invoke('credentials:delete', key)
})
