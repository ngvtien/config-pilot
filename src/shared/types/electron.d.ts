import { join } from "path"

export interface ElectronAPI {
  testGitCredentials?: (params: { url: string; credentials: any }) => Promise<boolean>
  selectFile?: (options: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{
    canceled: boolean
    filePaths: string[]
  }>
  selectDirectory?: () => Promise<{ canceled: boolean; filePaths: string[] }>
  checkGitAuth?: (url: string) => Promise<"success" | "failed">
  readFile?: (path: string) => Promise<string>
  setKubeContext?: (contextName: string) => Promise<void>
  getKubeConfigPath?: () => string
  storeSecureCredentials?: (params: any) => Promise<void>
  getSecureCredentials?: (params: any) => Promise<any>
  removeSecureCredentials?: (params: any) => Promise<void>
  listSecureCredentials?: (service: string) => Promise<string[]>
  updateCredentialUsage?: (params: any) => Promise<void>
  chartGetDetails?: (chartPath: string) => Promise<any>
  chartSaveValues?: (chartPath: string, values: any) => Promise<void>
  helmTemplate?: (params: any) => Promise<string>
  dialogSelectDirectory?: () => Promise<{ canceled: boolean; filePaths: string[] }>

  joinPath: (...parts: string[]) => string //join(...parts)

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

  // App operations
  getUserDataPath: () => Promise<string>

}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}