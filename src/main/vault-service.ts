import vault from 'node-vault'
import { VaultCredentialManager } from './vault-credential-manager.js' // Same process import
import { Environment } from '../shared/types/context-data.js'

export class VaultService {
  private clients = new Map<string, vault.client>()

  /**
   * Get or create a Vault client for the specified environment
   */
  private async getVaultClient(environment: Environment): Promise<vault.client> {
    const existingClient = this.clients.get(environment.toString())
    if (existingClient) {
      return existingClient
    }

    const credentials = await VaultCredentialManager.getCredentials(environment)
    if (!credentials) {
      throw new Error(`No Vault credentials found for environment: ${environment}`)
    }

    // 🔍 DEBUG: Log all credential details
    console.log(`🔍 [VaultService] Creating client for ${environment}:`)
    console.log(`   - Raw URL: "${credentials.url}"`)
    console.log(`   - Token: ${credentials.token ? 'Present' : 'Missing'}`)
    console.log(`   - Namespace: "${credentials.namespace || 'None'}"`)
    
    // Normalize the URL to ensure correct format
    const normalizedUrl = this.normalizeVaultUrl(credentials.url)
    console.log(`   - Normalized URL: "${normalizedUrl}"`)

    const client = vault({
      apiVersion: 'v1',
      endpoint: normalizedUrl,
      token: credentials.token,
      namespace: credentials.namespace
    })

    this.clients.set(environment, client)
    return client
  }

  /**
   * Normalize Vault URL to ensure correct format for node-vault client
   */
  private normalizeVaultUrl(url: string): string {
    console.log(`🔧 [VaultService] Normalizing URL: "${url}"`)
    
    // Remove trailing slashes
    let normalized = url.replace(/\/+$/, '')
    console.log(`   - After removing trailing slashes: "${normalized}"`)
    
    // Remove /v1 suffix if present (node-vault adds this automatically)
    if (normalized.endsWith('/v1')) {
      normalized = normalized.slice(0, -3)
      console.log(`   - After removing /v1 suffix: "${normalized}"`)
    }
    
    // Ensure we have the correct base URL format
    if (!normalized.match(/^https?:\/\//)) {
      throw new Error(`Invalid Vault URL format: ${url}. Must start with http:// or https://`)
    }
    
    console.log(`✅ [VaultService] Final normalized URL: "${normalized}"`)
    return normalized
  }

  /**
   * Write a secret to Vault using KV v2 format
   */
  async writeSecret(environment: Environment, path: string, key: string, value: string): Promise<boolean> {
    try {
      console.log(`🚀 [VaultService] Starting writeSecret for ${environment}`)
      console.log(`   - Path: "${path}"`)
      console.log(`   - Key: "${key}"`)
      console.log(`   - Value length: ${value.length} characters`)
      
      const client = await this.getVaultClient(environment)

      // Validate path for environment
      if (!this.isValidPathForEnvironment(path, environment)) {
        throw new Error(`Invalid vault path for environment ${environment}`);
      }

      // Force KV v2 format since dev mode uses KV v2 by default
      const dataPath = this.convertToDataPath(path)
      console.log(`📝 [VaultService] Writing to KV v2 path: "${dataPath}"`)
      
      const payload = { data: { [key]: value } }
      console.log(`📦 [VaultService] Payload structure:`, JSON.stringify(payload, null, 2))
      
      const result = await client.write(dataPath, payload)
      console.log(`✅ [VaultService] Write successful:`, result)
      
      return true
    } catch (error: any) {
      console.error(`❌ [VaultService] Write error for ${environment}:`)
      console.error(`   - Error type: ${error.constructor.name}`)
      console.error(`   - Error message: ${error.message}`)
      console.error(`   - Status code: ${error.response?.status || 'N/A'}`)
      console.error(`   - Status text: ${error.response?.statusText || 'N/A'}`)
      console.error(`   - Response headers:`, error.response?.headers || 'N/A')
      console.error(`   - Response data:`, error.response?.data || 'N/A')
      console.error(`   - Full error:`, error)
      throw error
    }
  }

  /**
   * Read a secret from Vault using KV v2 format
   */
  async readSecret(environment: Environment, path: string, key: string): Promise<string | null> {
    try {
      console.log(`🔍 [VaultService] Starting readSecret for ${environment}`)
      console.log(`   - Path: "${path}"`)
      console.log(`   - Key: "${key}"`)
      
      const client = await this.getVaultClient(environment)
      
      // Force KV v2 format since dev mode uses KV v2 by default
      const dataPath = this.convertToDataPath(path)
      console.log(`📖 [VaultService] Reading from KV v2 path: "${dataPath}"`)
      
      const result = await client.read(dataPath)
      console.log(`📄 [VaultService] Read result:`, result)
      
      // KV v2 wraps data in a "data" object
      const secretValue = result.data?.data?.[key] || null
      console.log(`🔑 [VaultService] Extracted value for key "${key}": ${secretValue ? 'Found' : 'Not found'}`)
      
      return secretValue
    } catch (error: any) {
      console.error(`❌ [VaultService] Read error for ${environment}:`)
      console.error(`   - Error type: ${error.constructor.name}`)
      console.error(`   - Error message: ${error.message}`)
      console.error(`   - Status code: ${error.response?.status || 'N/A'}`)
      
      if (error.response?.status === 404) {
        console.log(`ℹ️ [VaultService] Secret not found (404) - returning null`)
        return null
      }
      throw error
    }
  }

  /**
   * Convert KV v1 path to KV v2 data path
   * Example: "kv/customer/env/instance/product" -> "kv/data/customer/env/instance/product"
   */
  private convertToDataPath(path: string): string {
    const segments = path.split('/')
    if (segments.length > 1) {
      return `${segments[0]}/data/${segments.slice(1).join('/')}`
    }
    return `${path}/data`
  }

  /**
   * Validate that the path is safe and follows expected format
   */
  private isValidPathForEnvironment(path: string, environment: Environment): boolean {
    // Relaxed validation - just ensure basic security and format

    // Must start with 'kv/' or 'secret/' for security (both are valid KV v2 mount points)
    if (!path.startsWith('kv/') && !path.startsWith('secret/')) {
      return false
    }

    // Prevent path traversal attacks
    if (path.includes('..') || path.includes('//')) {
      return false
    }

    // Must have at least 3 segments: kv/something/something or secret/something/something
    const segments = path.split('/').filter(s => s.length > 0)
    if (segments.length < 3) {
      return false
    }

    // Allow any valid vault path format
    return true
  }

  /**
   * Clear cached clients (useful for credential updates)
   */
  clearClients(): void {
    this.clients.clear()
  }
}