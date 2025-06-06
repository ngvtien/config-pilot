import type { ProjectConfig, ProjectMetadata } from '../shared/types/project'

export interface OpenDialogOptions {
    title?: string
    defaultPath?: string
    buttonLabel?: string
    filters?: Array<{ name: string; extensions: string[] }>
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>
}

export interface LoggerAPI {
    debug: (message: string, data?: Record<string, unknown>) => void
    info: (message: string, data?: Record<string, unknown>) => void
    warn: (message: string, data?: Record<string, unknown>) => void
    error: (message: string, data?: Record<string, unknown>) => void
    getLogs: () => Promise<string[]>
    clearLogs: () => Promise<void>
    setLogLevel: (level: string) => Promise<void>
    exportLogs: (format: string) => Promise<void>
    onNewLog: (callback: (logEntry: any) => void) => () => void
}

export interface ElectronAPI {
    // Basic file operations
    saveYaml: (content: string, env: string) => void
    commitYamlToGit: (content: string, env: string) => void
    openFile: (options?: OpenDialogOptions) => Promise<string | undefined>
    saveFile: (options: { content: string; filePath?: string }) => Promise<boolean>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    deleteFile: (path: string) => Promise<void>
    fileExists: (path: string) => Promise<boolean>
    ensureDirectory: (path: string) => Promise<void>
    listDirectories: (path: string) => Promise<string[]>

    // App operations
    getAppVersion: () => Promise<string>
    getUserDataPath: () => Promise<string>

    // Logging
    log: (message: any) => void
    error: (message: any) => void
    warn: (message: any) => void
    logger: LoggerAPI

    // Directory operations
    selectDirectory: (options?: OpenDialogOptions) => Promise<string | null>
    createDirectory: (path: string) => Promise<{ success: boolean; path: string }>
    directoryExists: (path: string) => Promise<{ exists: boolean; isDirectory: boolean }>
    getDirectoryInfo: (path: string) => Promise<{
        exists: boolean
        isDirectory: boolean
        size: number
        created: Date
        modified: Date
    }>

    // Kubernetes operations
    getKubeConfigPath: () => Promise<string>
    loadKubeConfig: () => Promise<string>
    setKubeContext: (contextName: string) => Promise<boolean>
    setKubeConfigPath: (path: string) => Promise<{ success: boolean }>
    invoke: (channel: string, ...args: any[]) => Promise<any>

    // Authentication and credentials
    testGitCredentials?: (params: { url: string; credentials: any }) => Promise<boolean>
    selectFile?: (options: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{
        canceled: boolean
        filePaths: string[]
    }>
    checkGitAuth?: (url: string) => Promise<"success" | "failed">
    storeSecureCredentials?: (params: any) => Promise<void>
    getSecureCredentials?: (params: any) => Promise<any>
    removeSecureCredentials?: (params: any) => Promise<void>
    deleteSecureCredentials?: (key: string) => Promise<void>
    listSecureCredentials?: (service: string) => Promise<string[]>
    updateCredentialUsage?: (params: any) => Promise<void>

    // Helm operations
    chartGetDetails?: (chartPath: string) => Promise<any>
    chartSaveValues?: (chartPath: string, values: any) => Promise<void>
    helmTemplate?: (params: any) => Promise<string>

    // Dialog operations
    dialogSelectDirectory?: () => Promise<{ canceled: boolean; filePaths: string[] }>

    // Path utilities
    joinPath: (...parts: string[]) => string

    // Window controls
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<void>
    setTitle?: (title: string) => Promise<void>

    // Project Management
    project: {
        create: (name: string, description?: string) => Promise<ProjectConfig>
        open: (filePath?: string) => Promise<ProjectConfig | null>
        save: () => Promise<string>
        saveAs: () => Promise<string>
        close: () => Promise<void>
        getCurrent: () => Promise<ProjectConfig | null>
        getRecent: () => Promise<ProjectMetadata[]>
        delete: (filePath: string) => Promise<void>
        showOpenDialog: () => Promise<string | null>
        showSaveDialog: (defaultName?: string) => Promise<string | null>
        enableAutoSave: (intervalSeconds: number) => Promise<void>
        disableAutoSave: () => Promise<void>
        export: (exportPath?: string) => Promise<string>
    }

    // Vault operations
    vault: {
        testConnection: (environment: string, url: string, token: string, namespace?: string) => Promise<{
            success: boolean
            connected: boolean
            error?: string
        }>
        storeCredentials: (environment: string, credentials: {
            url: string
            token: string
            authMethod: 'token' | 'kubernetes' | 'approle'
            namespace?: string
        }) => Promise<{ success: boolean }>
        getCredentials: (environment: string) => Promise<{
            url: string
            token: string
            authMethod: 'token' | 'kubernetes' | 'approle'
            namespace?: string
        } | null>
        writeSecret: (environment: string, path: string, key: string, value: string) => Promise<{
            success: boolean
        }>
        readSecret: (environment: string, path: string, key: string) => Promise<{
            success: boolean
            value: string | null
        }>
    }

    // ArgoCD operations
    argocd: {
        testConnection: (environment: string, url: string, token: string, insecureSkipTLSVerify?: boolean) => Promise<boolean>
        storeCredentials: (environment: string, credentials: any) => Promise<{ success: boolean }>
        getCredentials: (environment: string) => Promise<any>
        getApplications: (environment: string) => Promise<any[]>
        getApplication: (environment: string, name: string) => Promise<any>
        syncApplication: (environment: string, name: string) => Promise<boolean>
        createApplication: (environment: string, application: any) => Promise<any>
        updateApplication: (environment: string, name: string, application: any) => Promise<any>
        deleteApplication: (environment: string, name: string) => Promise<boolean>
    }

    // Helm OCI operations
    helmOCI: {
        testConnection(environment: string, registryUrl: string, authMethod: string, username?: string, password?: string, token?: string, insecureSkipTLSVerify?: boolean): Promise<boolean>
        storeCredentials(environment: string, credentials: any): Promise<void>
        getCredentials(environment: string): Promise<any>
        getRepositories(environment: string): Promise<any[]>
        searchCharts(environment: string, query?: string): Promise<any[]>
        getChartVersions(environment: string, chartName: string): Promise<any[]>
        pullChart(environment: string, chartName: string, version: string, destination?: string): Promise<string>
        inspectChart(environment: string, chartName: string, version?: string): Promise<any>
        addRepository(environment: string, name: string, url: string): Promise<boolean>
        removeRepository(environment: string, name: string): Promise<boolean>
    }

    // Configuration management
    getAvailableConfigs?: () => Promise<any>
    getActiveConfigPath?: () => Promise<string>
    setUserConfigPath?: (path: string) => Promise<boolean>
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI
    }
}

export { }