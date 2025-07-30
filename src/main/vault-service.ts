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
   * Write a secret to Vault using KV v2 format with merge support
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

      const dataPath = this.convertToDataPath(path)
      console.log(`📝 [VaultService] Writing to KV v2 path: "${dataPath}"`)

      // 🆕 READ existing data first to merge
      let existingData = {}
      try {
        const existingResult = await client.read(dataPath)
        existingData = existingResult.data?.data || {}
        console.log(`📖 [VaultService] Found existing data:`, Object.keys(existingData))
      } catch (readError) {
        console.log(`📝 [VaultService] No existing data found, creating new secret`)
      }

      // 🆕 MERGE with existing data instead of overwriting
      const mergedData = {
        ...existingData,
        [key]: value
      }

      const payload = { data: mergedData }
      console.log(`📦 [VaultService] Merged payload structure:`, JSON.stringify(payload, null, 2))

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
      console.error(`   - Response data: ${error.response?.data || 'N/A'}`)
      console.error(`   - Full error:`, error)
      throw error
    }
  }

  /**
     * Read a secret and return both value and metadata if present
     * @param environment - Target environment
     * @param path - Vault path
     * @param key - Secret key
     * @returns Object with value and optional metadata, or just the string value
     */
  async readSecret(environment: Environment, path: string, key: string): Promise<string | null> {
    try {
      console.log(`🔍 [VaultService] Starting readSecret for ${environment}`);
      console.log(`   - Path: "${path}"`);
      console.log(`   - Key: "${key}"`);

      const client = await this.getVaultClient(environment);
      const dataPath = this.convertToDataPath(path);
      console.log(`📖 [VaultService] Reading from KV v2 path: "${dataPath}"`);

      const result = await client.read(dataPath);
      console.log(`📄 [VaultService] Read result:`, result);

      const secretData = result.data?.data?.[key];
      if (!secretData) {
        console.log(`🔑 [VaultService] Key "${key}" not found`);
        return null;
      }

      // Handle structured data (with metadata) vs simple string
      if (typeof secretData === 'object' && secretData.value !== undefined) {
        console.log(`🔑 [VaultService] Found structured secret with metadata`);
        return secretData.value;
      } else {
        console.log(`🔑 [VaultService] Found simple string secret`);
        return secretData;
      }
    } catch (error: any) {
      console.error(`❌ [VaultService] Read error for ${environment}:`);
      console.error(`   - Error type: ${error.constructor.name}`);
      console.error(`   - Error message: ${error.message}`);
      console.error(`   - Status code: ${error.response?.status || 'N/A'}`);

      if (error.response?.status === 404) {
        console.log(`ℹ️ [VaultService] Secret not found (404) - returning null`);
        return null;
      }
      throw error;
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

  /**
   * Read all data from a Vault path (for retrieving certificate with metadata)
   */
  async readAllData(environment: Environment, path: string): Promise<Record<string, any> | null> {
    try {
      console.log(`🔍 [VaultService] Reading all data for ${environment} from path: "${path}"`);

      const client = await this.getVaultClient(environment);
      const dataPath = this.convertToDataPath(path);

      const result = await client.read(dataPath);
      console.log(`📄 [VaultService] Read all data result:`, result);

      // Return all data from KV v2 format
      return result.data?.data || null;
    } catch (error: any) {
      console.error(`❌ [VaultService] Read all data error:`, error);
      return null;
    }
  }

  /**
   * Write a secret with optional certificate metadata embedded in structured format
   * @param environment - Target environment
   * @param path - Vault path
   * @param key - Secret key
   * @param value - Secret value (certificate content)
   * @param metadata - Optional certificate metadata to embed
   */
  async writeSecretWithMetadata(
    environment: Environment,
    path: string,
    key: string,
    value: string,
    metadata?: any
  ): Promise<boolean> {
    try {
      const client = await this.getVaultClient(environment);

      if (!this.isValidPathForEnvironment(path, environment)) {
        throw new Error(`Invalid path format for ${environment}: ${path}`);
      }

      // 1. Store secret data via /data/ endpoint
      const dataPath = this.convertToDataPath(path);
      let existingData = {};
      try {
        const existing = await client.read(dataPath);
        existingData = existing.data?.data || {};
      } catch (error) {
        console.log('No existing data found, creating new entry');
      }

      const mergedData = {
        ...existingData,
        [key]: value
      };

      await client.write(dataPath, { data: mergedData });
      console.log(`✅ Secret data written to ${dataPath}`);

      // 2. Store metadata via /metadata/ endpoint with proper serialization
      if (metadata) {
        const metadataPath = dataPath.replace('/data/', '/metadata/');

        // ✅ Convert all values to non-empty strings for Vault compatibility
        const sanitizedMetadata: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
          let stringValue: string;
          
          if (value === null || value === undefined) {
            // Skip null/undefined values entirely
            continue;
          } else if (Array.isArray(value)) {
            if (value.length === 0) {
              // Skip empty arrays
              continue;
            }
            stringValue = JSON.stringify(value);
          } else if (typeof value === 'object') {
            stringValue = JSON.stringify(value);
          } else if (typeof value === 'boolean') {
            // Convert boolean to string explicitly
            stringValue = value.toString(); // "true" or "false"
          } else {
            stringValue = String(value);
          }
          
          // Only add non-empty strings to avoid Vault validation errors
          if (stringValue && stringValue.length > 0) {
            sanitizedMetadata[key] = stringValue;
          }
        }

        // Only write metadata if we have valid fields
        if (Object.keys(sanitizedMetadata).length > 0) {
          await client.write(metadataPath, {
            custom_metadata: sanitizedMetadata
          });
          console.log(`✅ Metadata written to ${metadataPath}`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to write secret with metadata:', error);
      throw error;
    }
  }

  /**
   * Read a secret with its metadata if present
   * @param environment - Target environment
   * @param path - Vault path
   * @param key - Secret key
   * @returns Object with value and optional metadata
   */
  async readSecretWithMetadata(environment: Environment, path: string, key: string): Promise<{ value: string | null; metadata?: any }> {
    try {
      const client = await this.getVaultClient(environment);
      const dataPath = this.convertToDataPath(path);

      // Read secret data
      const result = await client.read(dataPath);
      const secretValue = result.data?.data?.[key];

      if (!secretValue) {
        return { value: null };
      }

      // ✅ Extract custom_metadata from the response
      const customMetadata = result.data?.metadata?.custom_metadata;

      return {
        value: secretValue,
        metadata: customMetadata || null
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { value: null };
      }
      throw error;
    }
  }
}