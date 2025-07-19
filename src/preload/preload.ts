import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      // Kubernetes channels
      'k8s:getContexts',
      'k8s:getCurrentContext',
      'k8s:switchContext',
      'k8s:connect',
      'k8s:getConnectionStatus',
      'k8s:getNamespaces',
      'k8s:getPods',
      'k8s:getDeployments',
      'k8s:getServices',
      'k8s:getNodes',
      'k8s:setConfigPath',
      'k8s:setUserConfigPath',
      'k8s:getActiveConfigPath',
      'k8s:getAvailableConfigs',
      'window:isMaximized',
      'app:version',
      'dialog:openFile',
      'dialog:saveFile',
      'dialog:showOpenDialog',
      'dialog:showSaveDialog',
      'dialog:selectDirectory',
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

      // Helm OCI channels
      'helm-oci:testConnection',
      'helm-oci:storeCredentials',
      'helm-oci:getCredentials',
      'helm-oci:getRepositories',
      'helm-oci:searchCharts',
      'helm-oci:getChartVersions',
      'helm-oci:pullChart',
      'helm-oci:inspectChart',
      'helm-oci:addRepository',
      'helm-oci:removeRepository',

      // Project Management
      'project:create',
      'project:open',
      'project:save',
      'project:save-as',
      'project:close',
      'project:get-current',
      'project:get-recent',
      'project:delete',
      'project:show-open-dialog',
      'project:show-save-dialog',
      'project:enable-auto-save',
      'project:disable-auto-save',
      'project:export',

      'schema:initialize',
      'schema:searchInSource',
      'schema:getResourcesFromSource',
      'schema:getAvailableSources',
      'schema:getSourceStats',
      'schema:isReady',
      'schema:dereferenceResource',
      'schema:getResourceSchemaTree',
      'schema:getRawResourceSchema',
      'schema:getAllResourcesWithCRDs',
      'schema:searchAllSourcesWithCRDs',
      'schema:getCRDSchemaTree',
      'schema:getRawCRDSchema',

      // Templates management
      'template:create',
      'template:load',
      'template:getAll',
      'template:search',
      'template:validate',
      'template:generate',
      'template:export',
      'template:import',
      'template:delete',
      'template:getCompatibleForProject',
      'template:generateForProject',
      'template:validateForProject',
      'template:getUsageStats',
      'template:save',
      'template:update',
      'template:duplicate',
      'template:getPreview',

      // Customer management
      'customer:initialize',
      'customer:getAllCustomers',
      'customer:getCustomerById',
      'customer:createCustomer',
      'customer:updateCustomer',
      'customer:deleteCustomer',
      'customer:exportCustomers',
      'customer:importCustomers',
      'customer:showSaveDialog',
      'customer:showOpenDialog',

      // Produc management      
      'product:initialize',
      'product:getAllProducts',
      'product:getProductById',
      'product:createProduct',
      'product:updateProduct',
      'product:deleteProduct',
      'product:exportProducts',
      'product:importProducts',
      'product:showSaveDialog',
      'product:showOpenDialog',

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
  setTitle: (title: string) => ipcRenderer.send("window:setTitle", title),

  // App info
  getAppVersion: () => ipcRenderer.invoke("app:version"),

  // File operations
  openFile: (options?: any) => ipcRenderer.invoke("dialog:openFile", options),
  saveFile: (data: string) => ipcRenderer.invoke("dialog:saveFile", data),
  readFile: (filePath: string) => ipcRenderer.invoke("file:read", filePath),
  showOpenDialog: (options?: any) => ipcRenderer.invoke("dialog:showOpenDialog", options),
  showSaveDialog: (options?: any) => ipcRenderer.invoke("dialog:showSaveDialog", options),
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

  helmOCI: {
    testConnection: (environment: string, registryUrl: string, authMethod: string, username?: string, password?: string, token?: string, insecureSkipTLSVerify?: boolean) =>
      ipcRenderer.invoke('helm-oci:testConnection', environment, registryUrl, authMethod, username, password, token, insecureSkipTLSVerify),
    storeCredentials: (environment: string, credentials: any) =>
      ipcRenderer.invoke('helm-oci:storeCredentials', environment, credentials),
    getCredentials: (environment: string) =>
      ipcRenderer.invoke('helm-oci:getCredentials', environment),
    getRepositories: (environment: string) =>
      ipcRenderer.invoke('helm-oci:getRepositories', environment),
    searchCharts: (environment: string, query?: string) =>
      ipcRenderer.invoke('helm-oci:searchCharts', environment, query),
    getChartVersions: (environment: string, chartName: string) =>
      ipcRenderer.invoke('helm-oci:getChartVersions', environment, chartName),
    pullChart: (environment: string, chartName: string, version: string, destination?: string) =>
      ipcRenderer.invoke('helm-oci:pullChart', environment, chartName, version, destination),
    inspectChart: (environment: string, chartName: string, version?: string) =>
      ipcRenderer.invoke('helm-oci:inspectChart', environment, chartName, version),
    addRepository: (environment: string, name: string, url: string) =>
      ipcRenderer.invoke('helm-oci:addRepository', environment, name, url),
    removeRepository: (environment: string, name: string) =>
      ipcRenderer.invoke('helm-oci:removeRepository', environment, name)
  },

  // Project Management
  project: {
    create: (name: string, description?: string) =>
      ipcRenderer.invoke('project:create', name, description),
    open: (filePath?: string) =>
      ipcRenderer.invoke('project:open', filePath),
    save: () =>
      ipcRenderer.invoke('project:save'),
    saveAs: () =>
      ipcRenderer.invoke('project:save-as'),
    close: () =>
      ipcRenderer.invoke('project:close'),
    getCurrent: () =>
      ipcRenderer.invoke('project:get-current'),
    getRecent: () =>
      ipcRenderer.invoke('project:get-recent'),
    delete: (filePath: string) =>
      ipcRenderer.invoke('project:delete', filePath),
    showOpenDialog: () =>
      ipcRenderer.invoke('project:show-open-dialog'),
    showSaveDialog: (defaultName?: string) =>
      ipcRenderer.invoke('project:show-save-dialog', defaultName),
    enableAutoSave: (intervalSeconds: number) =>
      ipcRenderer.invoke('project:enable-auto-save', intervalSeconds),
    disableAutoSave: () =>
      ipcRenderer.invoke('project:disable-auto-save'),
    export: (exportPath: string) =>
      ipcRenderer.invoke('project:export', exportPath)
  },

  platform: {
    detect: () => ipcRenderer.invoke('platform:detect'),
    updateKubeConfig: (kubeConfigPath: string) => ipcRenderer.invoke('platform:update-kubeconfig', kubeConfigPath),
    clearCache: () => ipcRenderer.invoke('platform:clear-cache')
  },

  // CRD Management operations
  crd: {
    import: (request: any) => ipcRenderer.invoke('crd:import', request),
    list: () => ipcRenderer.invoke('crd:list'),
    listByGroup: () => ipcRenderer.invoke('crd:listByGroup'),
    delete: (id: string) => ipcRenderer.invoke('crd:delete', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('crd:update', id, updates),
    discover: () => ipcRenderer.invoke('crd:discover'),
    validate: (crdDefinition: any) => ipcRenderer.invoke('crd:validate', crdDefinition)
  },

  // Secure credential operations
  storeSecureCredentials: (key: string, data: string) =>
    ipcRenderer.invoke('credentials:store', key, data),
  getSecureCredentials: (key: string) =>
    ipcRenderer.invoke('credentials:get', key),
  deleteSecureCredentials: (key: string) =>
    ipcRenderer.invoke('credentials:delete', key),

  // Template Management
  template: {
    create: (templateData: any) =>
      ipcRenderer.invoke('template:create', templateData),
    load: (templateId: string) =>
      ipcRenderer.invoke('template:load', templateId),
    save: (template: any) =>
      ipcRenderer.invoke('template:save', template),
    getAll: () =>
      ipcRenderer.invoke('template:getAll'),
    search: (query: string) =>
      ipcRenderer.invoke('template:search', query),
    validate: (template: any) =>
      ipcRenderer.invoke('template:validate', template),
    generate: (params: { templateId: string; context: any; outputPath: string; format?: string }) =>
      ipcRenderer.invoke('template:generate', params),
    export: (params: { templateId: string; exportPath: string }) =>
      ipcRenderer.invoke('template:export', params),
    import: (importPath: string) =>
      ipcRenderer.invoke('template:import', importPath),
    delete: (templateId: string) =>
      ipcRenderer.invoke('template:delete', templateId),
    getCompatibleForProject: (project: any) =>
      ipcRenderer.invoke('template:getCompatibleForProject', project),
    generateForProject: (params: { templateId: string; project: any; context: any; format?: string }) =>
      ipcRenderer.invoke('template:generateForProject', params),
    validateForProject: (params: { templateId: string; project: any; context: any }) =>
      ipcRenderer.invoke('template:validateForProject', params),
    getUsageStats: (project: any) =>
      ipcRenderer.invoke('template:getUsageStats', project)
  },

  customer: {
    initialize: () => ipcRenderer.invoke('customer:initialize'),
    getAllCustomers: () => ipcRenderer.invoke('customer:getAllCustomers'),
    getCustomerById: (id: string) => ipcRenderer.invoke('customer:getCustomerById', id),
    createCustomer: (customer: any) => ipcRenderer.invoke('customer:createCustomer', customer),
    updateCustomer: (id: string, updates: any) => ipcRenderer.invoke('customer:updateCustomer', id, updates),
    deleteCustomer: (id: string) => ipcRenderer.invoke('customer:deleteCustomer', id),
    exportCustomers: (filePath: string) => ipcRenderer.invoke('customer:exportCustomers', filePath),
    importCustomers: (filePath: string, mergeMode: 'replace' | 'merge') => ipcRenderer.invoke('customer:importCustomers', filePath, mergeMode),
    showSaveDialog: () => ipcRenderer.invoke('customer:showSaveDialog'),
    showOpenDialog: () => ipcRenderer.invoke('customer:showOpenDialog')
  },

  product: {
    initialize: () => ipcRenderer.invoke('product:initialize'),
    getAllProducts: () => ipcRenderer.invoke('product:getAllProducts'),
    getProductById: (id: string) => ipcRenderer.invoke('product:getProductById', id),
    createProduct: (product: any) => ipcRenderer.invoke('product:createProduct', product),
    updateProduct: (id: string, updates: any) => ipcRenderer.invoke('product:updateProduct', id, updates),
    deleteProduct: (id: string) => ipcRenderer.invoke('product:deleteProduct', id),
    exportProducts: (filePath: string) => ipcRenderer.invoke('product:exportProducts', filePath),
    importProducts: (filePath: string, mergeMode: 'replace' | 'merge') => ipcRenderer.invoke('product:importProducts', filePath, mergeMode),
    showSaveDialog: () => ipcRenderer.invoke('product:showSaveDialog'),
    showOpenDialog: () => ipcRenderer.invoke('product:showOpenDialog')
  },
})
