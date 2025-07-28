import { ContextData } from "../../../shared/types/context-data"

/**
 * Core type definitions for secrets management
 */
export interface SecretItem {
  name: string
  vaultRef: {
    path: string
    key: string
  }
  value?: string
}

export interface SecretEditorProps {
  initialValue?: string
  onChange?: (value: string) => void
  environment?: string
  context?: ContextData
  baseDirectory?: string
}

export type TabType = "secrets" | "external-secrets"

export type VaultConnectionStatus = 'unknown' | 'success' | 'error' | 'checking'
export type SecretVaultStatus = 'checking' | 'synced' | 'out-of-sync' | 'error'
export type FileType = 'text' | 'certificate' | 'binary'

export interface SortConfig {
  key: string
  direction: "ascending" | "descending"
}
