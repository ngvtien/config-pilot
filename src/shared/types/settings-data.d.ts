import { Environment } from "./context-data.js";
import type { GitRepository } from "./git-repository.js";
export interface SettingsData {
    autoSave: boolean;
    darkMode: boolean;
    lineNumbers: boolean;
    wordWrap: boolean;
    autoRefreshContexts: boolean;
    defaultNamespace: string;
    baseDirectory: string;
    kubeConfigPath: string;
    kubernetesVersion: string;
    gitRepositories: GitRepository[];
    editorSettings?: EditorSettings;
    kubernetesSettings?: KubernetesSettings;
    securitySettings?: SecuritySettings;
    uiSettings?: UISettings;
    backupSettings?: BackupSettings;
    schemaSettings?: SchemaSettings;
    vaultConfigurations?: {
        [key in Environment]?: {
            url: string;
            namespace?: string;
            authMethod: 'token' | 'userpass' | 'ldap';
        };
    };
}
export interface SchemaSettings {
    schemaStorageDir: string;
    defaultK8sVersion: string;
    availableVersions: string[];
    autoDownloadSchemas: boolean;
    schemaCacheDuration: number;
    schemaSource: {
        baseUrl: string;
        fallbackUrls: string[];
    };
}
export interface EditorSettings {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: "on" | "off" | "wordWrapColumn";
    wordWrapColumn: number;
    minimap: boolean;
    lineNumbers: "on" | "off" | "relative";
    folding: boolean;
    autoIndent: "none" | "keep" | "brackets" | "advanced" | "full";
    formatOnSave: boolean;
    formatOnPaste: boolean;
    trimTrailingWhitespace: boolean;
    insertFinalNewline: boolean;
    theme: "light" | "dark" | "high-contrast";
    bracketPairColorization: boolean;
    showWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
}
export interface KubernetesSettings {
    defaultContext: string;
    defaultNamespace: string;
    autoSwitchContext: boolean;
    validateResources: boolean;
    dryRunByDefault: boolean;
    showSystemNamespaces: boolean;
    refreshInterval: number;
    timeoutDuration: number;
    maxLogLines: number;
    followLogs: boolean;
    contexts: KubernetesContext[];
}
export interface KubernetesContext {
    name: string;
    cluster: string;
    user: string;
    namespace?: string;
    isActive?: boolean;
    lastUsed?: string;
}
export interface SecuritySettings {
    enableSecureStorage: boolean;
    encryptLocalData: boolean;
    sessionTimeout: number;
    requireAuthForSensitiveOps: boolean;
    auditLogging: boolean;
    allowRemoteConnections: boolean;
    trustedHosts: string[];
    sslVerification: boolean;
}
export interface UISettings {
    theme: "light" | "dark" | "system";
    accentColor: string;
    compactMode: boolean;
    showTooltips: boolean;
    animationsEnabled: boolean;
    sidebarWidth: number;
    panelLayout: "horizontal" | "vertical" | "auto";
    showLineNumbers: boolean;
    showMinimap: boolean;
    fontSize: "small" | "medium" | "large";
    density: "comfortable" | "compact" | "spacious";
}
export interface BackupSettings {
    enableAutoBackup: boolean;
    backupInterval: number;
    maxBackups: number;
    backupLocation: string;
    includeSecrets: boolean;
    compressBackups: boolean;
    cloudSync: {
        enabled: boolean;
        provider?: "github" | "gitlab" | "s3" | "dropbox";
        credentials?: Record<string, string>;
        syncInterval?: number;
    };
}
export interface NotificationSettings {
    enableNotifications: boolean;
    showSuccessMessages: boolean;
    showWarningMessages: boolean;
    showErrorMessages: boolean;
    soundEnabled: boolean;
    desktopNotifications: boolean;
    emailNotifications: {
        enabled: boolean;
        email?: string;
        events: NotificationEvent[];
    };
}
export type NotificationEvent = "deployment_success" | "deployment_failure" | "auth_failure" | "sync_complete" | "backup_complete" | "security_alert";
export interface AdvancedSettings {
    debugMode: boolean;
    verboseLogging: boolean;
    experimentalFeatures: boolean;
    telemetryEnabled: boolean;
    crashReporting: boolean;
    performanceMonitoring: boolean;
    memoryLimit: number;
    maxConcurrentOperations: number;
    requestTimeout: number;
    retryAttempts: number;
    customEnvironmentVariables: Record<string, string>;
}
export interface SettingsValidation {
    isValid: boolean;
    errors: SettingsValidationError[];
    warnings: SettingsValidationWarning[];
}
export interface SettingsValidationError {
    field: keyof SettingsData;
    message: string;
    code: string;
}
export interface SettingsValidationWarning {
    field: keyof SettingsData;
    message: string;
    suggestion?: string;
}
export interface SettingsExport {
    version: string;
    timestamp: string;
    settings: SettingsData;
    metadata: {
        exportedBy: string;
        platform: string;
        appVersion: string;
    };
}
export interface SettingsImportResult {
    success: boolean;
    imported: Partial<SettingsData>;
    skipped: string[];
    errors: string[];
    warnings: string[];
}
export interface SettingsChangeEvent {
    field: keyof SettingsData;
    oldValue: any;
    newValue: any;
    timestamp: string;
    source: "user" | "system" | "import";
}
export declare const createDefaultSettings: () => SettingsData;
