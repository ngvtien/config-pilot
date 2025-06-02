import type { KubernetesSchema } from '@/shared/types/kubernetes'
import type { SchemaSettings } from '@/shared/types/settings-data'

export interface SchemaDownloadOptions {
  k8sVersion: string
  force?: boolean // Force re-download even if exists
  userDataDir: string
}

export interface SchemaMetadata {
  version: string
  downloadedAt: string
  size: number
  checksum?: string
}

export class KubernetesSchemaService {
  private schemaCache = new Map<string, KubernetesSchema>()
  private readonly DEFAULT_SCHEMA_BASE_URL = 'https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master'
  private schemaMetadata = new Map<string, SchemaMetadata>()

  constructor(private settings?: SchemaSettings) { }

  /**
   * Cross-platform path joining utility
   */
  private joinPath(...parts: string[]): string {
    const cleanParts = parts
      .filter(part => part && part.length > 0)
      .map(part => part.replace(/[\/\\]+$/, '')) // Remove trailing slashes/backslashes

    // Use the appropriate path separator for the platform
    // In Electron renderer, we can detect Windows by checking the userAgent or use a more reliable method
    const isWindows = navigator.platform.toLowerCase().includes('win') ||
      navigator.userAgent.toLowerCase().includes('windows')

    const separator = isWindows ? '\\' : '/'

    return cleanParts.join(separator)
  }

  /**
   * Fetch available Kubernetes versions from GitHub API
   */
  async fetchAvailableVersions(): Promise<string[]> {
    try {
      const response = await fetch('https://api.github.com/repos/yannh/kubernetes-json-schema/contents/')

      if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Extract unique base versions (without suffixes like -standalone, -local, -strict)
      const uniqueVersions = new Set<string>()

      data
        .filter((item: any) => item.type === 'dir' && /^v\d/.test(item.name))
        .forEach((item: any) => {
          const versionName = item.name
          // Extract base version by removing suffixes
          const baseVersion = versionName.split('-')[0] // This gets 'v1.31.0' from 'v1.31.0-standalone'
          if (/^v\d+\.\d+\.\d+$/.test(baseVersion)) { // Ensure it's a valid version format
            uniqueVersions.add(baseVersion)
          }
        })

      // Convert Set to Array and sort
      const versions = Array.from(uniqueVersions).sort((a: string, b: string) => {
        const aVersion = a.replace('v', '').split('.').map(Number)
        const bVersion = b.replace('v', '').split('.').map(Number)

        for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
          const aPart = aVersion[i] || 0
          const bPart = bVersion[i] || 0
          if (aPart !== bPart) {
            return bPart - aPart
          }
        }
        return 0
      })

      return versions
    } catch (error) {
      console.error('Failed to fetch available versions:', error)
      // Enhanced fallback with many more versions
      return [
        // Latest stable versions
        'v1.29.0', 'v1.28.0', 'v1.27.0', 'v1.26.0', 'v1.25.0',
        // Previous stable versions
        'v1.24.0', 'v1.23.0', 'v1.22.0', 'v1.21.0', 'v1.20.0',
        // Older but still used versions
        'v1.19.0', 'v1.18.0', 'v1.17.0', 'v1.16.0', 'v1.15.0',
        'v1.14.0', 'v1.13.0', 'v1.12.0', 'v1.11.0', 'v1.10.0',
        // Legacy versions
        'v1.9.0', 'v1.8.0', 'v1.7.0', 'v1.6.0', 'v1.5.0'
      ]
    }
  }
  /**
   * Sort versions in descending order (newest first)
   */
  private sortVersions(versions: string[]): string[] {
    return versions.sort((a: string, b: string) => {
      const aVersion = a.replace('v', '').split('.').map(Number)
      const bVersion = b.replace('v', '').split('.').map(Number)

      for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
        const aPart = aVersion[i] || 0
        const bPart = bVersion[i] || 0
        if (aPart !== bPart) {
          return bPart - aPart
        }
      }
      return 0
    })
  }

  /**
   * Extended fallback versions covering more Kubernetes releases
   */
  private getExtendedFallbackVersions(): string[] {
    return [
      // Latest versions
      'v1.29.0', 'v1.28.0', 'v1.27.0', 'v1.26.0', 'v1.25.0',
      // Older but still supported versions
      'v1.24.0', 'v1.23.0', 'v1.22.0', 'v1.21.0', 'v1.20.0',
      // Legacy versions that might still be in use
      'v1.19.0', 'v1.18.0', 'v1.17.0', 'v1.16.0', 'v1.15.0',
      'v1.14.0', 'v1.13.0', 'v1.12.0', 'v1.11.0', 'v1.10.0'
    ]
  }

  /**
   * Download schema for a specific version with progress callback
   */
  async downloadSchemaWithProgress(
    k8sVersion: string,
    userDataDir: string,
    onProgress?: (progress: { downloaded: number; total: number; resource?: string }) => void
  ): Promise<void> {
    // Only download the main _definitions.json file since it contains all schemas
    onProgress?.({ downloaded: 0, total: 1, resource: '_definitions.json' })
    await this.downloadSchema(k8sVersion, userDataDir)
    onProgress?.({ downloaded: 1, total: 1 })
  }

  async downloadSchema(k8sVersion: string, userDataDir: string, force = false): Promise<void> {
    if (!this.isElectronAPIAvailable()) {
      throw new Error('ElectronAPI not available, cannot download schemas')
    }
    
    // Ensure version always has 'v' prefix
    let version = k8sVersion
    if (!version.startsWith('v')) {
      version = `v${version}`
    }
    
    const schemaDir = this.joinPath(userDataDir, 'schemas', version)
    const definitionsPath = this.joinPath(schemaDir, '_definitions.json')
  
    // Check if schema already exists
    if (!force && await this.schemaExists(definitionsPath)) {
      console.log(`Schema for ${version} already exists, skipping download`)
      return
    }
  
    try {
      // Ensure directory exists
      await window.electronAPI.ensureDirectory(schemaDir)
  
      // Use version directly since it already has 'v' prefix
      const schemaUrl = `${this.getSchemaBaseUrl()}/${version}-standalone-strict/_definitions.json`
      console.log('Downloading schema from:', schemaUrl)
  
      const response = await fetch(schemaUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
  
      // Get the schema content and save it
      const schemaContent = await response.text()
      await window.electronAPI.writeFile(definitionsPath, schemaContent)
      
      // Save metadata
      const metadata: SchemaMetadata = {
        version: version,
        downloadedAt: new Date().toISOString(),
        size: schemaContent.length,
        checksum: await this.calculateChecksum(schemaContent)
      }
      
      // Store metadata in the service's metadata map
      this.schemaMetadata.set(version, metadata)
      
      await this.saveSchemaMetadata(version, userDataDir)
      
      console.log(`Successfully downloaded schema for ${version} to ${definitionsPath}`)
      
    } catch (error) {
      console.error(`Failed to download schema for ${version}:`, error)
      throw error
    }
  }
  
  // Helper method for checksum calculation
  private async calculateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }  
  /**
   * Get schema from local storage first, fallback to remote
   */
  async getSchema(kind: string, apiVersion: string, k8sVersion?: string, userDataDir?: string): Promise<KubernetesSchema | null> {
    // Ensure version always has 'v' prefix
    let version = k8sVersion || this.settings?.defaultK8sVersion || 'v1.27.0'
    if (!version.startsWith('v')) {
      version = `v${version}`
    }

    const cacheKey = `${kind}-${apiVersion}-${version}`
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!
    }

    // Try local schema first
    const localSchema = await this.getLocalSchemaFromDefinitions(kind, apiVersion, version, userDataDir)
    if (localSchema) {
      this.schemaCache.set(cacheKey, localSchema)
      return localSchema
    }

    // Only fallback to remote if local schema doesn't exist and we don't have userDataDir
    // If userDataDir is provided, the schema should have been downloaded already
    if (!userDataDir) {
      console.log(`Local schema not found for ${kind}, attempting remote fallback...`)
      const remoteSchema = await this.getRemoteSchemaFromDefinitions(kind, apiVersion, version)
      if (remoteSchema) {
        this.schemaCache.set(cacheKey, remoteSchema)
        return remoteSchema
      }
    } else {
      console.warn(`Local schema not found for ${kind} in ${userDataDir}/schemas/${version}. Please ensure the schema is downloaded.`)
    }

    return null
  }
  private async getLocalSchemaFromDefinitions(kind: string, apiVersion: string, version: string, userDataDir?: string): Promise<KubernetesSchema | null> {
    try {
      // Use userDataDir if provided, otherwise fall back to relative path
      const definitionsPath = userDataDir
        ? this.joinPath(userDataDir, 'schemas', version, '_definitions.json')
        : this.joinPath('schemas', version, '_definitions.json')

      const definitionsContent = await window.electronAPI.readFile(definitionsPath)
      const definitions = JSON.parse(definitionsContent)

      // Build the schema key based on Kubernetes naming convention
      const schemaKey = this.buildSchemaKey(kind, apiVersion)

      if (definitions.definitions && definitions.definitions[schemaKey]) {
        return {
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'object',
          ...definitions.definitions[schemaKey]
        }
      }

      return null
    } catch (error) {
      console.warn(`Failed to get local schema for ${kind}:`, error)
      return null
    }
  }

  private async getRemoteSchemaFromDefinitions(kind: string, apiVersion: string, version: string): Promise<KubernetesSchema | null> {
    try {
      let versionWithPrefix = version
      if (!version.startsWith('v')) {
        versionWithPrefix = `v${version}`
      }

      const schemaUrl = `${this.getSchemaBaseUrl()}/${versionWithPrefix}-standalone-strict/_definitions.json`
      const response = await fetch(schemaUrl)

      if (!response.ok) {
        console.warn(`Failed to fetch remote definitions for ${kind}:`, response.statusText)
        return null
      }

      const definitions = await response.json()
      const schemaKey = this.buildSchemaKey(kind, apiVersion)

      if (definitions.definitions && definitions.definitions[schemaKey]) {
        return {
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'object',
          ...definitions.definitions[schemaKey]
        }
      }

      return null
    } catch (error) {
      console.error(`Error fetching remote definitions for ${kind}:`, error)
      return null
    }
  }

  /**
   * Build the schema key based on Kubernetes naming convention
   * Examples:
   * - Deployment + apps/v1 -> io.k8s.api.apps.v1.Deployment
   * - Service + v1 -> io.k8s.api.core.v1.Service
   * - Pod + v1 -> io.k8s.api.core.v1.Pod
   */
  private buildSchemaKey(kind: string, apiVersion: string): string {
    // Handle core API (v1) vs other APIs (apps/v1, etc.)
    if (apiVersion === 'v1') {
      return `io.k8s.api.core.v1.${kind}`
    } else {
      // For APIs like apps/v1, networking.k8s.io/v1, etc.
      const [group, version] = apiVersion.includes('/')
        ? apiVersion.split('/')
        : ['core', apiVersion]

      if (group === 'core') {
        return `io.k8s.api.core.${version}.${kind}`
      } else {
        return `io.k8s.api.${group}.${version}.${kind}`
      }
    }
  }

  /**
   * Check if electronAPI is available
   */
  private isElectronAPIAvailable(): boolean {
    return typeof window !== 'undefined' && window.electronAPI !== undefined
  }

/**
 * Get available Kubernetes versions from local schemas directory
 */
async getAvailableVersions(userDataDir: string): Promise<string[]> {
  try {
    if (!this.isElectronAPIAvailable()) {
      console.warn('ElectronAPI not available, cannot list local schema versions')
      return []
    }
    
    const schemasDir = this.joinPath(userDataDir, 'schemas')
    const directories = await window.electronAPI.listDirectories(schemasDir)
    
    // Filter to only include valid version directories (starting with 'v')
    return directories.filter(dir => /^v\d+\.\d+\.\d+/.test(dir))
  } catch (error) {
    console.error('Failed to get available schema versions:', error)
    return []
  }
}

  /**
   * Download multiple schemas for common Kubernetes resources
   */
  async downloadCommonSchemas(k8sVersion: string, userDataDir: string): Promise<void> {
    const commonResources = [
      'deployment', 'service', 'configmap', 'secret', 'ingress',
      'pod', 'namespace', 'persistentvolume', 'persistentvolumeclaim',
      'serviceaccount', 'role', 'rolebinding', 'clusterrole', 'clusterrolebinding'
    ]

    console.log(`Downloading common schemas for v${k8sVersion}...`)

    for (const resource of commonResources) {
      try {
        await this.downloadResourceSchema(resource, k8sVersion, userDataDir)
      } catch (error) {
        console.warn(`Failed to download schema for ${resource}:`, error)
      }
    }
  }

  private async getLocalSchema(kind: string, apiVersion: string, version: string): Promise<KubernetesSchema | null> {
    try {
      const schemaPath = this.buildLocalSchemaPath(kind, apiVersion, version)
      const schemaContent = await window.electronAPI.readFile(schemaPath)
      return JSON.parse(schemaContent)
    } catch (error) {
      return null
    }
  }

  private async getRemoteSchema(kind: string, apiVersion: string, version: string): Promise<KubernetesSchema | null> {
    try {
      const schemaUrl = this.buildSchemaUrl(kind, apiVersion, version)
      const response = await fetch(schemaUrl)

      if (!response.ok) {
        console.warn(`Failed to fetch remote schema for ${kind}:`, response.statusText)
        return null
      }

      const schema: KubernetesSchema = await response.json()
      return schema
    } catch (error) {
      console.error(`Error fetching remote schema for ${kind}:`, error)
      return null
    }
  }

  private async downloadResourceSchema(resource: string, k8sVersion: string, userDataDir: string): Promise<void> {
    const schemaDir = this.joinPath(userDataDir, 'schemas', k8sVersion)
    const schemaPath = this.joinPath(schemaDir, `${resource}-v1.json`)

    // Use standalone-strict variant for individual resource schemas
    const schemaUrl = `${this.getSchemaBaseUrl()}/v${k8sVersion}-standalone-strict/${resource}-v1.json`

    try {
      const response = await fetch(schemaUrl)
      if (response.ok) {
        const schemaContent = await response.text()
        await window.electronAPI.writeFile(schemaPath, schemaContent)
      }
    } catch (error) {
      console.warn(`Failed to download ${resource} schema:`, error)
    }
  }

  private buildLocalSchemaPath(kind: string, apiVersion: string, version: string): string {
    const kindLower = kind.toLowerCase()
    const versionPart = apiVersion.includes('/')
      ? apiVersion.split('/').join('-')
      : apiVersion

    return this.joinPath('schemas', version, `${kindLower}-${versionPart}.json`)
  }

  private buildSchemaUrl(kind: string, apiVersion: string, version: string): string {
    const kindLower = kind.toLowerCase()
    const versionPart = apiVersion.includes('/')
      ? apiVersion.split('/').join('-')
      : apiVersion

    // Use standalone-strict variant for remote schema URLs
    return `${this.getSchemaBaseUrl()}/v${version}-standalone-strict/${kindLower}-${versionPart}.json`
  }

  private getSchemaBaseUrl(): string {
    return this.settings?.schemaSource?.baseUrl || this.DEFAULT_SCHEMA_BASE_URL
  }

  private async schemaExists(filePath: string): Promise<boolean> {
    try {
      if (!this.isElectronAPIAvailable()) {
        return false
      }
      const result = await window.electronAPI.fileExists(filePath)
      return result.exists
    } catch (error) {
      return false
    }
  }

  private async saveSchemaMetadata(userDataDir: string): Promise<void> {
    const metadataPath = this.joinPath(userDataDir, 'schemas', 'metadata.json')
    const metadata = Object.fromEntries(this.schemaMetadata)
    await window.electronAPI.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
  }
}

export const kubernetesSchemaService = new KubernetesSchemaService()
