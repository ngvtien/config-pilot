import { safeStorage } from 'electron'
import { Environment } from '../shared/types/context-data'

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
    
    // Use the IPC handler we just created
    const { ipcMain } = await import('electron')
    const store = (await import('electron-store')).default
    const { safeStorage } = await import('electron')
    
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials))
    const credentialStore = new store({ name: 'secure-credentials' }) as any
    credentialStore.set(key, encrypted.toString('base64'))
  }

  static async getCredentials(environment: Environment): Promise<VaultCredentials | null> {
    const key = this.getCredentialKey(environment)
    
    try {
      const store = (await import('electron-store')).default
      const { safeStorage } = await import('electron')
      
      if (!safeStorage.isEncryptionAvailable()) {
        return null
      }
      
      const credentialStore = new store({ name: 'secure-credentials' }) as any
      const encryptedData = credentialStore.get(key) as string
      
      if (!encryptedData) {
        return null
      }
      
      const buffer = Buffer.from(encryptedData, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      
      return JSON.parse(decrypted) as VaultCredentials
    } catch (error) {
      console.error(`Failed to retrieve Vault credentials for ${environment}:`, error)
      return null
    }
  }

  static async deleteCredentials(environment: Environment): Promise<void> {
    const key = this.getCredentialKey(environment)
    
    const store = (await import('electron-store')).default
    const credentialStore = new store({ name: 'secure-credentials' }) as any
    credentialStore.delete(key)
  }
}