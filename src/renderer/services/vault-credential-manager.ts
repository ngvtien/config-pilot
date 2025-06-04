import type { Environment  } from '../../shared/context-data'

interface VaultCredentials {
    url: string
    token: string
    authMethod: 'token' | 'kubernetes' | 'approle'
    namespace?: string
  }

export class VaultCredentialManager {
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
}