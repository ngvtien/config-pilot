# ConfigPilot Cache Implementation Strategy

## Overview

This document outlines the comprehensive caching architecture for ConfigPilot, designed to handle large schema files (2MB+), improve performance, and enable offline capabilities.

## Architecture: Hybrid Multi-Tier Caching

### Tier 1: Memory Cache (Fastest)
- **Purpose**: Hot data, frequently accessed items
- **Technology**: JavaScript Map/WeakMap
- **Capacity**: Limited by available RAM
- **Persistence**: Session-only
- **Use Cases**: Active schemas, current UI state, search results

### Tier 2: IndexedDB (Persistent)
- **Purpose**: Large data storage, cross-session persistence
- **Technology**: Browser IndexedDB API
- **Capacity**: GBs of data (no practical limits)
- **Persistence**: Survives app restarts
- **Use Cases**: Schema definitions, templates, configurations

### Tier 3: File System/Network (Fallback)
- **Purpose**: Source of truth, backup data source
- **Technology**: Electron IPC + Node.js fs, HTTP requests
- **Capacity**: Unlimited
- **Persistence**: Permanent
- **Use Cases**: Initial data loading, cache misses

## Cache Implementation by Use Case

### 1. Multi-CRD Schema Loading

**Scenario**: Loading schemas for K8s, OpenShift, ArgoCD, Istio, etc.

```typescript
// Cache structure for extended schemas
interface ExtendedSchemaCache {
  'k8s-vanilla-1.28': SchemaData;     // 2MB base schemas
  'openshift-4.13': SchemaData;       // 3MB+ OpenShift CRDs
  'argocd-2.8': SchemaData;          // 1MB ArgoCD CRDs
  'istio-1.19': SchemaData;          // 2MB+ Istio CRDs
  'prometheus-operator': SchemaData;  // 1.5MB monitoring CRDs
}

// Implementation strategy
class SchemaCache {
  // Tier 1: Memory cache for active CRD set
  private activeSchemas = new Map<string, SchemaData>();
  
  // Tier 2: IndexedDB for all downloaded schemas
  private persistentCache: IndexedDBCache;
  
  // Tier 3: Network fetch with progressive loading
  private networkLoader: NetworkSchemaLoader;
}
```

Benefits :

- ✅ Instant switching between CRD sets
- ✅ Offline capability for previously used schemas
- ✅ Bandwidth savings (no re-downloading)
- ✅ Version management (cache multiple versions)

### 2. Helm Template & Values Schema
Scenario : Caching Helm charts, templates, and values schemas

```typescript
// Helm-specific caching
interface HelmCache {
  templates: {
    [chartName: string]: {
      version: string;
      templates: Record<string, string>;  // template files
      valuesSchema: JSONSchema;           // values.schema.json
      defaultValues: any;                 // default values.yaml
      metadata: ChartMetadata;
    };
  };
  
  renderedTemplates: {
    [templateId: string]: {
      values: any;                        // input values
      rendered: string[];                 // rendered YAML
      timestamp: number;
    };
  };
}
```

Benefits :

- ✅ Fast template rendering (cached schemas)
- ✅ Values validation without re-parsing
- ✅ Template preview without re-computation
- ✅ Dependency resolution caching

---

### 3. Environment-Specific Values
Scenario : Managing values for dev, sit, uat, prod environments

```typescript
// Multi-environment value sets
interface EnvironmentCache {
  [templateId: string]: {
    dev: { values: any; lastApplied: number; };
    sit: { values: any; lastApplied: number; };
    uat: { values: any; lastApplied: number; };
    prod: { values: any; lastApplied: number; };
    
    // Computed diffs
    diffs: {
      'dev-vs-sit': DiffResult;
      'sit-vs-uat': DiffResult;
      'uat-vs-prod': DiffResult;
    };
  };
}
```
Benefits :

- ✅ Quick environment switching
- ✅ Diff computation caching
- ✅ Rollback capability
- ✅ Change tracking

----

### 4. Git Diff & Resource Comparison
Scenario : Comparing resources between cluster, git, and local state

```typescript
// Resource state caching
interface ResourceStateCache {
  clusters: {
    [clusterId: string]: {
      resources: Record<string, K8sResource>;
      lastSync: number;
      syncHash: string;
    };
  };
  
  git: {
    [repoId: string]: {
      resources: Record<string, K8sResource>;
      commitHash: string;
      lastPull: number;
    };
  };
  
  local: {
    resources: Record<string, K8sResource>;
    lastModified: number;
  };
  
  // Pre-computed diffs
  diffs: {
    'cluster-vs-git': DiffCache;
    'git-vs-local': DiffCache;
    'cluster-vs-local': DiffCache;
  };
}
```
Benefits :

- ✅ Instant diff visualization
- ✅ Reduced cluster API calls
- ✅ Git operation caching
- ✅ Three-way merge support

----

### 5. Template Import/Export
Scenario : Caching template packages for import/export operations

```typescript
// Template package caching
interface TemplatePackageCache {
  packages: {
    [packageId: string]: {
      metadata: PackageMetadata;
      templates: TemplateDefinition[];
      dependencies: string[];
      exportFormat: 'zip' | 'tar' | 'git';
      size: number;
      checksum: string;
    };
  };
  
  // Import history
  imports: {
    [importId: string]: {
      source: string;
      timestamp: number;
      templates: string[];
      conflicts: ConflictResolution[];
    };
  };
}
```

Benefits :

- ✅ Duplicate detection
- ✅ Conflict resolution caching
- ✅ Package integrity verification
- ✅ Import/export history

---

### 6. System Settings Configuration
Scenario : Caching user preferences and system configurations

```typescript
// Settings with smart caching
interface SettingsCache {
  user: {
    preferences: UserPreferences;
    recentProjects: string[];
    favoriteTemplates: string[];
    customSchemas: CustomSchemaDefinition[];
  };
  
  system: {
    clusterConfigs: ClusterConfig[];
    registryConfigs: RegistryConfig[];
    authTokens: Record<string, TokenInfo>;
    featureFlags: Record<string, boolean>;
  };
  
  // Computed settings
  computed: {
    effectivePermissions: Permission[];
    availableNamespaces: string[];
    accessibleClusters: string[];
  };
}
```
Benefits :

- ✅ Instant app startup
- ✅ Settings synchronization
- ✅ Permission caching
- ✅ Configuration validation

---
## Implementation Roadmap
### Phase 1: Foundation (Current Priority)

```typescript
// Start with schema caching
- K8s schema definitions (2MB+ files)
- Basic IndexedDB setup
- Cache invalidation strategies
- Error handling and fallbacks
```

### Phase 2: Template System
```typescript
// Expand to template-related caching
- Helm chart schemas
- Template rendering cache
- Values validation cache
- Dependency resolution
```

### Phase 3: Environment Management
```typescript
// Multi-environment support
- Environment-specific values
- Diff computation cache
- State synchronization
- Change tracking
```

### Phase 4: Advanced Features
```typescript
// Full application caching
- Git integration cache
- Resource comparison
- Import/export optimization
- Settings management
```

---
## Core Cache Service Implementation
### Schema Cache Service
```typescript
/**
 * Schema caching service using IndexedDB for persistent storage
 * Handles caching of large schema definition files (up to 2MB)
 */

interface CacheEntry {
  id: string;
  data: any;
  timestamp: number;
  version: string;
  size: number;
}

class SchemaCacheService {
  private dbName = 'schema-cache';
  private storeName = 'schemas';
  private version = 1;
  private db: IDBDatabase | null = null;
  private cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('version', 'version', { unique: false });
        }
      };
    });
  }

  /**
   * Get cached schema data
   */
  async get(k8sVersion: string): Promise<any | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(k8sVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CacheEntry | undefined;
        
        if (!result) {
          resolve(null);
          return;
        }
        
        // Check if cache is expired
        const isExpired = Date.now() - result.timestamp > this.cacheExpiryMs;
        if (isExpired) {
          // Clean up expired entry
          this.delete(k8sVersion).catch(console.error);
          resolve(null);
          return;
        }
        
        console.log(`Schema cache hit for k8s ${k8sVersion} (${(result.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(result.data);
      };
    });
  }

  /**
   * Store schema data in cache
   */
  async set(k8sVersion: string, data: any): Promise<void> {
    if (!this.db) await this.init();
    
    const serializedData = JSON.stringify(data);
    const entry: CacheEntry = {
      id: k8sVersion,
      data,
      timestamp: Date.now(),
      version: k8sVersion,
      size: new Blob([serializedData]).size
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log(`Schema cached for k8s ${k8sVersion} (${(entry.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve();
      };
    });
  }

  /**
   * Delete cached schema
   */
  async delete(k8sVersion: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(k8sVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Clear all cached schemas
   */
  async clear(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('Schema cache cleared');
        resolve();
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; totalSize: number }> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        resolve({ count: entries.length, totalSize });
      };
    });
  }
}

// Export singleton instance
export const schemaCacheService = new SchemaCacheService();
```

### Application Cache Manager
```typescript
/**
 * Multi-tier caching strategy for ConfigPilot
 * Coordinates between memory, IndexedDB, and file system caches
 */
class AppCacheManager {
  // Tier 1: In-memory cache (fastest)
  private memoryCache = new Map<string, any>();
  private memoryCacheSize = 0;
  private maxMemorySize = 100 * 1024 * 1024; // 100MB limit
  
  // Tier 2: IndexedDB (persistent)
  private persistentCache: IndexedDBCache;
  
  // Tier 3: File system (via Electron IPC)
  private fileCache: ElectronFileCache;
  
  /**
   * Get data with multi-tier fallback
   */
  async get(key: string, options?: CacheOptions): Promise<any> {
    // 1. Check memory first
    if (this.memoryCache.has(key)) {
      console.log(`Memory cache hit: ${key}`);
      return this.memoryCache.get(key);
    }
    
    // 2. Check IndexedDB
    const cached = await this.persistentCache.get(key);
    if (cached && !this.isExpired(cached)) {
      console.log(`IndexedDB cache hit: ${key}`);
      this.promoteToMemory(key, cached.data); // Promote to memory
      return cached.data;
    }
    
    // 3. Fallback to file system or network
    console.log(`Cache miss: ${key}, loading from source`);
    return this.loadFromSource(key, options);
  }
  
  /**
   * Store data in appropriate cache tier
   */
  async set(key: string, data: any, options?: CacheOptions): Promise<void> {
    // Always store in IndexedDB for persistence
    await this.persistentCache.set(key, data, options);
    
    // Store in memory if size allows
    this.promoteToMemory(key, data);
  }
  
  /**
   * Promote data to memory cache with size management
   */
  private promoteToMemory(key: string, data: any): void {
    const dataSize = this.estimateSize(data);
    
    // Check if we need to evict items
    while (this.memoryCacheSize + dataSize > this.maxMemorySize && this.memoryCache.size > 0) {
      this.evictLRU();
    }
    
    if (dataSize <= this.maxMemorySize) {
      this.memoryCache.set(key, data);
      this.memoryCacheSize += dataSize;
    }
  }
  
  /**
   * Evict least recently used item from memory
   */
  private evictLRU(): void {
    const firstKey = this.memoryCache.keys().next().value;
    if (firstKey) {
      const data = this.memoryCache.get(firstKey);
      this.memoryCacheSize -= this.estimateSize(data);
      this.memoryCache.delete(firstKey);
      console.log(`Evicted from memory cache: ${firstKey}`);
    }
  }
  
  /**
   * Estimate data size in bytes
   */
  private estimateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }
  
  /**
   * Check if cached data is expired
   */
  private isExpired(cached: CacheEntry): boolean {
    const expiryTime = cached.timestamp + (cached.ttl || 24 * 60 * 60 * 1000);
    return Date.now() > expiryTime;
  }
  
  /**
   * Load data from original source
   */
  private async loadFromSource(key: string, options?: CacheOptions): Promise<any> {
    // Implementation depends on data type
    // Could be file system, network, or computed data
    throw new Error('loadFromSource must be implemented by subclass');
  }
}
```

## Cache Management UI
### Cache Settings Component
```typescript
import React from 'react';
import { Button } from '../ui/button';
import { schemaCacheService } from '../../services/schema-cache';

/**
 * Cache management component for schema definitions
 */
export function CacheSettings() {
  const [stats, setStats] = React.useState<{ count: number; totalSize: number } | null>(null);
  const [isClearing, setIsClearing] = React.useState(false);

  /**
   * Load cache statistics
   */
  const loadStats = React.useCallback(async () => {
    try {
      const cacheStats = await schemaCacheService.getStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  }, []);

  /**
   * Clear schema cache
   */
  const clearCache = async () => {
    setIsClearing(true);
    try {
      await schemaCacheService.clear();
      await loadStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Schema Cache</h3>
      
      {stats && (
        <div className="text-sm text-gray-600">
          <p>Cached schemas: {stats.count}</p>
          <p>Total size: {(stats.totalSize / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
      
      <Button 
        onClick={clearCache} 
        disabled={isClearing}
        variant="outline"
      >
        {isClearing ? 'Clearing...' : 'Clear Cache'}
      </Button>
    </div>
  );
}
```

## Cache Analytics & Monitoring
### Cache Performance Metrics
```typescript
// Future: Cache analytics & management
interface CacheStats {
  totalSize: number;
  hitRate: number;
  missRate: number;
  storageBreakdown: {
    schemas: number;
    templates: number;
    environments: number;
    diffs: number;
    settings: number;
  };
  
  recommendations: {
    cleanup: string[];
    preload: string[];
    optimize: string[];
  };
}

class CacheAnalytics {
  private metrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    cacheEfficiency: 0
  };
  
  /**
   * Record cache hit
   */
  recordHit(key: string, responseTime: number): void {
    this.metrics.hits++;
    this.metrics.totalRequests++;
    this.updateAverageResponseTime(responseTime);
    this.calculateEfficiency();
  }
  
  /**
   * Record cache miss
   */
  recordMiss(key: string, responseTime: number): void {
    this.metrics.misses++;
    this.metrics.totalRequests++;
    this.updateAverageResponseTime(responseTime);
    this.calculateEfficiency();
  }
  
  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations = [];
    
    if (this.metrics.hitRate < 0.7) {
      recommendations.push('Consider preloading frequently accessed schemas');
    }
    
    if (this.metrics.averageResponseTime > 1000) {
      recommendations.push('Cache response times are high, consider memory tier optimization');
    }
    
    return recommendations;
  }
}
```

## Alternative Technologies Considered
### SQLite (via Electron)
```typescript
// For complex relational queries
const db = new Database('configpilot.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS resource_cache (
    id TEXT PRIMARY KEY,
    type TEXT,
    data TEXT,
    created_at INTEGER
  )
`);
```

Pros : SQL queries, ACID transactions, mature ecosystem Cons : Additional dependency, overkill for key-value storage

### LevelDB/RocksDB
```typescript
// For high-performance key-value storage
import level from 'level';
const db = level('./cache-db');
```
Pros : Very fast, optimized for key-value operations Cons : Additional dependency, Node.js only

### Redis (External)
```typescript
// For distributed caching across instances
const redis = new Redis({
  host: 'localhost',
  port: 6379
});
```
Pros : Distributed caching, advanced features Cons : External dependency, complexity

## Conclusion
IndexedDB is the optimal choice for ConfigPilot because:

1. ✅ Perfect for large schema files (2MB+)
2. ✅ No additional dependencies (built into Electron)
3. ✅ Handles structured data well (templates, configs)
4. ✅ Persistent across sessions
5. ✅ Good performance characteristics
6. ✅ Browser-native with excellent support
This hybrid architecture will transform ConfigPilot into a highly responsive application where users can:

- Switch between complex CRD sets instantly
- Compare environments without delays
- Work offline with cached data
- Import/export templates efficiently
- Experience near-instant startup times