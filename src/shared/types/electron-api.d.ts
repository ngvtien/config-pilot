import type { OpenDialogOptions } from "electron"

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
  saveYaml: (content: string, env: string) => void
  commitYamlToGit: (content: string, env: string) => void
  openFile: (options?: OpenDialogOptions) => Promise<string | undefined>
  saveFile: (content: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  log: (message: any) => void
  error: (message: any) => void
  warn: (message: any) => void

  getKubeConfigPath: () => Promise<string>
  loadKubeConfig: () => Promise<string>
  setKubeContext: (contextName: string) => Promise<boolean>

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

  // K8s related operations
  setKubeConfigPath: (path: string) => Promise<{ success: boolean }>
}
