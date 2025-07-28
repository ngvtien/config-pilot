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

/**
 * Enhanced certificate metadata interface
 */
export interface CertificateMetadata {
  type: 'PEM' | 'DER' | 'PKCS12' | 'JKS' | 'UNKNOWN'
  format: 'X.509' | 'PKCS#1' | 'PKCS#8' | 'UNKNOWN'
  fileName?: string
  fileSize?: number
  uploadedAt: string
  expiresAt?: string
  issuer?: string
  subject?: string
  serialNumber?: string
  fingerprint?: string
  keyUsage?: string[]
  hasPrivateKey: boolean
  isCA: boolean
  keySize?: number
  signatureAlgorithm?: string
  requiresPassword: boolean
  aliases?: string[]
  relatedSecrets?: {
    privateKeyPath?: string
    passwordPath?: string
    bundlePath?: string
  }
}


/**
 * Enhanced secret item with certificate metadata
 */
export interface EnhancedSecretItem extends SecretItem {
  secretType: 'text' | 'certificate' | 'private-key' | 'password' | 'binary'
  certificateMetadata?: CertificateMetadata
  createdAt?: string
  updatedAt?: string
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

/**
 * Certificate analysis result
 */
export interface CertificateAnalysisResult {
  isValid: boolean
  metadata?: CertificateMetadata
  errors?: string[]
  warnings?: string[]
}

export interface SortConfig {
  key: string
  direction: "ascending" | "descending"
}
