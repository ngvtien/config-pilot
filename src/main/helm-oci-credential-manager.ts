import { safeStorage } from 'electron'
import Store from 'electron-store'
import { Environment } from '../shared/types/context-data'

interface HelmOCICredentials {
  registryUrl: string
  authMethod: 'token' | 'username' | 'anonymous' | 'aws' | 'gcp' | 'azure'
  username?: string
  password?: string
  token?: string
  insecureSkipTLSVerify?: boolean
  // Cloud provider specific
  awsRegion?: string
  gcpProject?: string
  azureSubscription?: string
}

export class HelmOCICredentialManager {
  private static getCredentialKey(environment: Environment): string {
    return `helm_oci_credentials_${environment}`
  }

  static async storeCredentials(environment: Environment, credentials: HelmOCICredentials): Promise<void> {
    const key = this.getCredentialKey(environment)
    
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials))
    const credentialStore = new Store({ name: 'secure-credentials' }) as any
    credentialStore.set(key, encrypted.toString('base64'))
  }

  static async getCredentials(environment: Environment): Promise<HelmOCICredentials | null> {
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
      return JSON.parse(decrypted) as HelmOCICredentials
    } catch (error) {
      console.error(`Failed to get Helm OCI credentials for ${environment}:`, error)
      return null
    }
  }

  static async hasStoredCredentials(environment: Environment): Promise<boolean> {
    const credentials = await this.getCredentials(environment)
    return credentials !== null
  }

  static async removeCredentials(environment: Environment): Promise<void> {
    const key = this.getCredentialKey(environment)
    const credentialStore = new Store({ name: 'secure-credentials' }) as any
    credentialStore.delete(key)
  }
}