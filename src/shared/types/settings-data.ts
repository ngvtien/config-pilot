import type { GitRepository } from "./git-repository"

export interface SettingsData {
  // General settings
  autoSave: boolean
  darkMode: boolean
  lineNumbers: boolean
  wordWrap: boolean
  autoRefreshContexts: boolean

  // Paths and directories
  defaultNamespace: string
  baseDirectory: string
  kubeConfigPath: string

  // Git repositories
  gitRepositories: GitRepository[]

  // Editor preferences
  editorSettings?: EditorSettings

  // Kubernetes settings
  kubernetesSettings?: KubernetesSettings

  // Security settings
  securitySettings?: SecuritySettings

  // UI preferences
  uiSettings?: UISettings

  // Backup and sync
  backupSettings?: BackupSettings
}

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  tabSize: number
  insertSpaces: boolean
  wordWrap: "on" | "off" | "wordWrapColumn"
  wordWrapColumn: number
  minimap: boolean
  lineNumbers: "on" | "off" | "relative"
  folding: boolean
  autoIndent: "none" | "keep" | "brackets" | "advanced" | "full"
  formatOnSave: boolean
  formatOnPaste: boolean
  trimTrailingWhitespace: boolean
  insertFinalNewline: boolean
  theme: "light" | "dark" | "high-contrast"
  bracketPairColorization: boolean
  showWhitespace: "none" | "boundary" | "selection" | "trailing" | "all"
}

export interface KubernetesSettings {
  defaultContext: string
  defaultNamespace: string
  autoSwitchContext: boolean
  validateResources: boolean
  dryRunByDefault: boolean
  showSystemNamespaces: boolean
  refreshInterval: number // in seconds
  timeoutDuration: number // in seconds
  maxLogLines: number
  followLogs: boolean
  contexts: KubernetesContext[]
}

export interface KubernetesContext {
  name: string
  cluster: string
  user: string
  namespace?: string
  isActive?: boolean
  lastUsed?: string
}

export interface SecuritySettings {
  enableSecureStorage: boolean
  encryptLocalData: boolean
  sessionTimeout: number // in minutes
  requireAuthForSensitiveOps: boolean
  auditLogging: boolean
  allowRemoteConnections: boolean
  trustedHosts: string[]
  sslVerification: boolean
}

export interface UISettings {
  theme: "light" | "dark" | "system"
  accentColor: string
  compactMode: boolean
  showTooltips: boolean
  animationsEnabled: boolean
  sidebarWidth: number
  panelLayout: "horizontal" | "vertical" | "auto"
  showLineNumbers: boolean
  showMinimap: boolean
  fontSize: "small" | "medium" | "large"
  density: "comfortable" | "compact" | "spacious"
}

export interface BackupSettings {
  enableAutoBackup: boolean
  backupInterval: number // in hours
  maxBackups: number
  backupLocation: string
  includeSecrets: boolean
  compressBackups: boolean
  cloudSync: {
    enabled: boolean
    provider?: "github" | "gitlab" | "s3" | "dropbox"
    credentials?: Record<string, string>
    syncInterval?: number
  }
}

export interface NotificationSettings {
  enableNotifications: boolean
  showSuccessMessages: boolean
  showWarningMessages: boolean
  showErrorMessages: boolean
  soundEnabled: boolean
  desktopNotifications: boolean
  emailNotifications: {
    enabled: boolean
    email?: string
    events: NotificationEvent[]
  }
}

export type NotificationEvent =
  | "deployment_success"
  | "deployment_failure"
  | "auth_failure"
  | "sync_complete"
  | "backup_complete"
  | "security_alert"

export interface AdvancedSettings {
  debugMode: boolean
  verboseLogging: boolean
  experimentalFeatures: boolean
  telemetryEnabled: boolean
  crashReporting: boolean
  performanceMonitoring: boolean
  memoryLimit: number // in MB
  maxConcurrentOperations: number
  requestTimeout: number // in seconds
  retryAttempts: number
  customEnvironmentVariables: Record<string, string>
}

// Settings validation
export interface SettingsValidation {
  isValid: boolean
  errors: SettingsValidationError[]
  warnings: SettingsValidationWarning[]
}

export interface SettingsValidationError {
  field: keyof SettingsData
  message: string
  code: string
}

export interface SettingsValidationWarning {
  field: keyof SettingsData
  message: string
  suggestion?: string
}

// Settings export/import
export interface SettingsExport {
  version: string
  timestamp: string
  settings: SettingsData
  metadata: {
    exportedBy: string
    platform: string
    appVersion: string
  }
}

export interface SettingsImportResult {
  success: boolean
  imported: Partial<SettingsData>
  skipped: string[]
  errors: string[]
  warnings: string[]
}

// Settings change tracking
export interface SettingsChangeEvent {
  field: keyof SettingsData
  oldValue: any
  newValue: any
  timestamp: string
  source: "user" | "system" | "import"
}

// Default settings factory
export const createDefaultSettings = (): SettingsData => ({
  autoSave: true,
  darkMode: false,
  lineNumbers: true,
  wordWrap: false,
  autoRefreshContexts: true,
  defaultNamespace: "default",
  baseDirectory: "",
  kubeConfigPath: "",
  gitRepositories: [],
  editorSettings: {
    fontSize: 14,
    fontFamily: "Monaco, 'Courier New', monospace",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "off",
    wordWrapColumn: 80,
    minimap: true,
    lineNumbers: "on",
    folding: true,
    autoIndent: "advanced",
    formatOnSave: true,
    formatOnPaste: false,
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    theme: "dark",
    bracketPairColorization: true,
    showWhitespace: "none",
  },
  kubernetesSettings: {
    defaultContext: "",
    defaultNamespace: "default",
    autoSwitchContext: false,
    validateResources: true,
    dryRunByDefault: false,
    showSystemNamespaces: false,
    refreshInterval: 30,
    timeoutDuration: 30,
    maxLogLines: 1000,
    followLogs: true,
    contexts: [],
  },
  securitySettings: {
    enableSecureStorage: true,
    encryptLocalData: false,
    sessionTimeout: 60,
    requireAuthForSensitiveOps: true,
    auditLogging: false,
    allowRemoteConnections: false,
    trustedHosts: [],
    sslVerification: true,
  },
  uiSettings: {
    theme: "system",
    accentColor: "#f59e0b",
    compactMode: false,
    showTooltips: true,
    animationsEnabled: true,
    sidebarWidth: 256,
    panelLayout: "auto",
    showLineNumbers: true,
    showMinimap: true,
    fontSize: "medium",
    density: "comfortable",
  },
  backupSettings: {
    enableAutoBackup: false,
    backupInterval: 24,
    maxBackups: 10,
    backupLocation: "",
    includeSecrets: false,
    compressBackups: true,
    cloudSync: {
      enabled: false,
    },
  },
})
