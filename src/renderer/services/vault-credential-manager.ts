import type { Environment  } from '../../shared/context-data'

interface VaultCredentials {
    url: string
    token: string
    authMethod: 'token' | 'kubernetes' | 'approle'
    namespace?: string
}

export class VaultCredentialManager {
  private static instance: VaultCredentialManager
  
  static getInstance(): VaultCredentialManager {
    if (!this.instance) {
      this.instance = new VaultCredentialManager()
    }
    return this.instance
  }

  private static getCredentialKey(environment: Environment): string {
    return `vault_credentials_${environment}`
  }

  static async storeCredentials(environment: Environment, credentials: VaultCredentials): Promise<void> {
    const key = this.getCredentialKey(environment)
    await window.electronAPI.storeSecureCredentials(key, JSON.stringify(credentials))
  }

  static async getCredentials(environment: Environment): Promise<VaultCredentials | null> {
    const key = this.getCredentialKey(environment)
    const stored = await window.electronAPI.getSecureCredentials(key)
    return stored ? JSON.parse(stored) : null
  }

  static async deleteCredentials(environment: Environment): Promise<void> {
    const key = this.getCredentialKey(environment)
    await window.electronAPI.deleteSecureCredentials(key)
  }

  // Instance methods for compatibility
  async storeVaultCredentials(environment: Environment, credentials: VaultCredentials): Promise<void> {
    return VaultCredentialManager.storeCredentials(environment, credentials)
  }

  async getVaultCredentials(environment: Environment): Promise<VaultCredentials | null> {
    return VaultCredentialManager.getCredentials(environment)
  }

  async deleteVaultCredentials(environment: Environment): Promise<void> {
    return VaultCredentialManager.deleteCredentials(environment)
  }

  // Test Vault connection
  async testConnection(environment: Environment, url: string, token: string, namespace?: string): Promise<{
    success: boolean
    connected: boolean
    error?: string
  }> {
    return window.electronAPI.vault.testConnection(environment, url, token, namespace)
  }
}