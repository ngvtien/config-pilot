import { safeStorage } from 'electron'
import Store from 'electron-store'
import { Environment } from '../shared/types/context-data'

interface ArgoCDCredentials {
  url: string
  token: string
  username?: string
  password?: string
  authMethod: 'token' | 'username' | 'sso'
  insecureSkipTLSVerify?: boolean
}

export class ArgoCDCredentialManager {
  private static getCredentialKey(environment: Environment): string {
    return `argocd_credentials_${environment}`
  }

  static async storeCredentials(environment: Environment, credentials: ArgoCDCredentials): Promise<void> {
    const key = this.getCredentialKey(environment)
    
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials))
    const credentialStore = new Store({ name: 'secure-credentials' }) as any
    credentialStore.set(key, encrypted.toString('base64'))
  }

  static async getCredentials(environment: Environment): Promise<ArgoCDCredentials | null> {
    const key = this.getCredentialKey(environment)
    
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return null
      }
      
      const credentialStore = new Store({ name: 'secure-credentials' }) as any
      const encryptedData = credentialStore.get(key) as string
      
      if (!encryptedData) {
        return null
      }
      
      const buffer = Buffer.from(encryptedData, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      return JSON.parse(decrypted) as ArgoCDCredentials
    } catch (error) {
      console.error(`Failed to get ArgoCD credentials for ${environment}:`, error)
      return null
    }
  }

  static async deleteCredentials(environment: Environment): Promise<void> {
    const key = this.getCredentialKey(environment)
    const credentialStore = new Store({ name: 'secure-credentials' }) as any
    credentialStore.delete(key)
  }

  static async hasCredentials(environment: Environment): Promise<boolean> {
    const credentials = await this.getCredentials(environment)
    return credentials !== null
  }
}