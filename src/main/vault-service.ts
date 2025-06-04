import vault from 'node-vault'
import { VaultCredentialManager } from './vault-credential-manager.js' // Same process import
import { Environment } from '../shared/types/context-data.js'

export class VaultService {
  private clients = new Map<string, vault.client>()

  private async getVaultClient(environment: Environment): Promise<vault.client> {
    const existingClient = this.clients.get(environment.toString())
    if (existingClient) {
      return existingClient
    }

    const credentials = await VaultCredentialManager.getCredentials(environment)
    if (!credentials) {
      throw new Error(`No Vault credentials found for environment: ${environment}`)
    }

    const client = vault({
      apiVersion: 'v1',
      endpoint: credentials.url,
      token: credentials.token,
      namespace: credentials.namespace
    })

    this.clients.set(environment, client)
    return client
  }

  async writeSecret(environment: Environment, path: string, key: string, value: string): Promise<boolean> {
    try {
      const client = await this.getVaultClient(environment)
      
      // Validate path for environment
      if (!this.isValidPathForEnvironment(path, environment)) {
        throw new Error(`Invalid vault path for environment ${environment}`);
      }
      
      await client.write(path, { [key]: value })
      return true
    } catch (error) {
      console.error(`Vault write error for ${environment}:`, error)
      throw error
    }
  }

  async readSecret(environment: Environment, path: string, key: string): Promise<string | null> {
    try {
      const client = await this.getVaultClient(environment)
      const result = await client.read(path)
      return result.data?.[key] || null
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }

  private isValidPathForEnvironment(path: string, environment: Environment): boolean {
    // Implement environment-specific path validation
    // e.g., dev paths should start with 'kv/dev/', prod with 'kv/prod/', etc.
    const envPrefix = `kv/${environment}/`
    return path.startsWith(envPrefix) || path.startsWith('kv/shared/')
  }

  // Clear cached clients (useful for credential updates)
  clearClients(): void {
    this.clients.clear()
  }
}