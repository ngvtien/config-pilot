/**
 * IndexedDB-based caching service for Kubernetes schemas
 * Provides persistent storage for large schema files to improve performance
 */

interface CachedSchema {
  id: string
  schemaKey: string
  k8sVersion: string
  content: any
  timestamp: number
  size: number
  hash?: string
}

interface CacheMetrics {
  totalEntries: number
  totalSize: number
  oldestEntry: number
  newestEntry: number
}

export class SchemaCacheService {
  private dbName = 'ConfigPilotSchemaCache'
  private dbVersion = 1
  private storeName = 'schemas'
  private db: IDBDatabase | null = null
  private maxCacheSize = 50 * 1024 * 1024 // 50MB limit
  private maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(new Error('Failed to initialize schema cache'))
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('Schema cache initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create schemas store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          
          // Create indexes for efficient querying
          store.createIndex('schemaKey', 'schemaKey', { unique: false })
          store.createIndex('k8sVersion', 'k8sVersion', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          
          console.log('Created schema cache object store with indexes')
        }
      }
    })
  }

  /**
   * Generate a cache key for a schema
   */
  private generateCacheKey(schemaKey: string, k8sVersion: string): string {
    return `${k8sVersion}:${schemaKey}`
  }

  /**
   * Generate a simple hash for content verification
   */
  private async generateHash(content: any): Promise<string> {
    const text = JSON.stringify(content)
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Get cached schema if available and not expired
   */
  async get(schemaKey: string, k8sVersion: string): Promise<any | null> {
    if (!this.db) {
      await this.init()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const cacheKey = this.generateCacheKey(schemaKey, k8sVersion)
      const request = store.get(cacheKey)

      request.onerror = () => {
        console.error('Failed to get cached schema:', request.error)
        resolve(null)
      }

      request.onsuccess = () => {
        const result = request.result as CachedSchema | undefined
        
        if (!result) {
          console.log(`Cache miss for schema: ${cacheKey}`)
          resolve(null)
          return
        }

        // Check if cache entry is expired
        const now = Date.now()
        if (now - result.timestamp > this.maxAge) {
          console.log(`Cache entry expired for schema: ${cacheKey}`)
          // Remove expired entry
          this.delete(schemaKey, k8sVersion)
          resolve(null)
          return
        }

        console.log(`Cache hit for schema: ${cacheKey}, size: ${result.size} bytes`)
        resolve(result.content)
      }
    })
  }

  /**
   * Store schema in cache
   */
  async set(schemaKey: string, k8sVersion: string, content: any): Promise<void> {
    if (!this.db) {
      await this.init()
    }

    const cacheKey = this.generateCacheKey(schemaKey, k8sVersion)
    const contentStr = JSON.stringify(content)
    const size = new Blob([contentStr]).size
    const hash = await this.generateHash(content)

    // Check if adding this would exceed cache size limit
    const metrics = await this.getMetrics()
    if (metrics.totalSize + size > this.maxCacheSize) {
      console.log('Cache size limit would be exceeded, cleaning up old entries')
      await this.cleanup()
    }

    const cachedSchema: CachedSchema = {
      id: cacheKey,
      schemaKey,
      k8sVersion,
      content,
      timestamp: Date.now(),
      size,
      hash
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(cachedSchema)

      request.onerror = () => {
        console.error('Failed to cache schema:', request.error)
        reject(new Error('Failed to cache schema'))
      }

      request.onsuccess = () => {
        console.log(`Cached schema: ${cacheKey}, size: ${size} bytes`)
        resolve()
      }
    })
  }

  /**
   * Delete a specific cached schema
   */
  async delete(schemaKey: string, k8sVersion: string): Promise<void> {
    if (!this.db) return

    const cacheKey = this.generateCacheKey(schemaKey, k8sVersion)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(cacheKey)

      request.onerror = () => {
        console.error('Failed to delete cached schema:', request.error)
        reject(new Error('Failed to delete cached schema'))
      }

      request.onsuccess = () => {
        console.log(`Deleted cached schema: ${cacheKey}`)
        resolve()
      }
    })
  }

  /**
   * Clear all cached schemas
   */
  async clear(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onerror = () => {
        console.error('Failed to clear schema cache:', request.error)
        reject(new Error('Failed to clear schema cache'))
      }

      request.onsuccess = () => {
        console.log('Schema cache cleared successfully')
        resolve()
      }
    })
  }

  /**
   * Get cache metrics for monitoring
   */
  async getMetrics(): Promise<CacheMetrics> {
    if (!this.db) {
      await this.init()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onerror = () => {
        console.error('Failed to get cache metrics:', request.error)
        reject(new Error('Failed to get cache metrics'))
      }

      request.onsuccess = () => {
        const entries = request.result as CachedSchema[]
        
        const metrics: CacheMetrics = {
          totalEntries: entries.length,
          totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
          oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
          newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0
        }

        resolve(metrics)
      }
    })
  }

  /**
   * Clean up old cache entries to free space
   */
  async cleanup(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('timestamp')
      const request = index.openCursor()
      
      const now = Date.now()
      let deletedCount = 0

      request.onerror = () => {
        console.error('Failed to cleanup cache:', request.error)
        reject(new Error('Failed to cleanup cache'))
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor) {
          const entry = cursor.value as CachedSchema
          
          // Delete entries older than maxAge
          if (now - entry.timestamp > this.maxAge) {
            cursor.delete()
            deletedCount++
          }
          
          cursor.continue()
        } else {
          console.log(`Cache cleanup completed, deleted ${deletedCount} expired entries`)
          resolve()
        }
      }
    })
  }

  /**
   * Get all cached schema keys for a specific Kubernetes version
   */
  async getSchemaKeys(k8sVersion: string): Promise<string[]> {
    if (!this.db) {
      await this.init()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('k8sVersion')
      const request = index.getAll(k8sVersion)

      request.onerror = () => {
        console.error('Failed to get schema keys:', request.error)
        reject(new Error('Failed to get schema keys'))
      }

      request.onsuccess = () => {
        const entries = request.result as CachedSchema[]
        const schemaKeys = entries.map(entry => entry.schemaKey)
        resolve(schemaKeys)
      }
    })
  }
}

// Export singleton instance
export const schemaCacheService = new SchemaCacheService()