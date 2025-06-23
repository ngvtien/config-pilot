// Base interface without computed properties
interface KubernetesResourceSchemaBase {
  key: string           // The definition key (e.g., "io.k8s.api.apps.v1.Deployment")
  group: string
  version: string
  kind: string
  schema: any           // The actual JSON schema
  displayName: string   // User-friendly name
  description?: string
  source?: string       // source field to identify CRDs vs vanilla k8s resources
}

// Extended interface with computed apiVersion
interface KubernetesResourceSchema extends KubernetesResourceSchemaBase {
  readonly apiVersion: string    // Computed from group and version
}

/**
 * Factory function to create KubernetesResourceSchema with computed apiVersion
 * This ensures apiVersion is always correctly calculated from group and version
 */
function createKubernetesResourceSchema(base: KubernetesResourceSchemaBase): KubernetesResourceSchema {
  const apiVersion = base.group === 'core' ? base.version : `${base.group}/${base.version}`

  return {
    ...base,
    apiVersion  // Direct assignment instead of getter
  }
}

// New lightweight metadata interface for lazy loading
interface KubernetesResourceMetadata {
  key: string
  group: string
  version: string
  kind: string
  displayName: string
  description?: string
  source?: string
  definitionKey: string  // Key in _definitions.json for lazy loading
}

interface LazySchemaIndex {
  byKind: Map<string, KubernetesResourceMetadata[]>  // Only metadata
  byGroupVersionKind: Map<string, KubernetesResourceMetadata>
  schemaCache: Map<string, any>  // Resolved schemas cache
  rawDefinitions: any | null  // Raw definitions for $ref resolution
}

class KubernetesSchemaIndexer {
  private lazyIndex: LazySchemaIndex | null = null
  private isLazyMode: boolean = true  // Toggle for lazy vs eager loading

  /**
   * Get the current schema index (for accessing definitions)
   */
  getSchemaIndex(): LazySchemaIndex | null {
    return this.lazyIndex
  }

  /**
   * Load and index the schema definitions with lazy loading
   */
  async loadSchemaDefinitions(definitionsPath: string): Promise<LazySchemaIndex> {
    try {
      // Load the definitions file
      const definitionsContent = await window.electronAPI.readFile(definitionsPath)
      const definitions = JSON.parse(definitionsContent)

      if (this.isLazyMode) {
        return this.indexMetadataLazy(definitions, 'kubernetes')
      } else {
        // Fallback to original eager loading
        return this.indexDefinitionsEager(definitions, 'kubernetes')
      }
    } catch (error) {
      console.error('Failed to load schema definitions:', error)
      throw error
    }
  }

  /**
   * Index only metadata for lazy loading (fast initialization)
   */
  private indexMetadataLazy(definitions: any, sourceId: string): LazySchemaIndex {
    const byKind = new Map<string, KubernetesResourceMetadata[]>()
    const byGroupVersionKind = new Map<string, KubernetesResourceMetadata>()
    const schemaCache = new Map<string, any>()

    // Only extract metadata, don't process full schemas
    Object.entries(definitions.definitions).forEach(([definitionKey, schema]: [string, any]) => {
      if (schema['x-kubernetes-group-version-kind']) {
        const gvkList = schema['x-kubernetes-group-version-kind']

        gvkList.forEach((gvk: any) => {
          const metadata: KubernetesResourceMetadata = {
            key: `${gvk.group}/${gvk.version}/${gvk.kind}`,
            group: gvk.group || 'core',
            version: gvk.version,
            kind: gvk.kind,
            displayName: this.createDisplayName(gvk),
            description: schema.description,
            source: sourceId,
            definitionKey  // Store reference to definition for lazy loading
          }

          // Index metadata by kind
          if (!byKind.has(gvk.kind)) {
            byKind.set(gvk.kind, [])
          }
          byKind.get(gvk.kind)!.push(metadata)

          // Index by group/version/kind combination
          const gvkKey = `${gvk.group || 'core'}/${gvk.version}/${gvk.kind}`
          byGroupVersionKind.set(gvkKey, metadata)
        })
      }
    })

    this.lazyIndex = {
      byKind,
      byGroupVersionKind,
      schemaCache,
      rawDefinitions: definitions.definitions  // Keep for $ref resolution
    }

    console.log(`Lazy schema indexer initialized with ${byKind.size} kinds (metadata only)`)
    return this.lazyIndex
  }

  /**
   * Fallback to original eager loading approach
   */
  private indexDefinitionsEager(definitions: any, sourceId: string): LazySchemaIndex {
    const byKind = new Map<string, KubernetesResourceMetadata[]>()
    const byGroupVersionKind = new Map<string, KubernetesResourceMetadata>()
    const schemaCache = new Map<string, any>()

    // Process all schemas eagerly (original approach)
    Object.entries(definitions.definitions).forEach(([definitionKey, schema]: [string, any]) => {
      if (schema['x-kubernetes-group-version-kind']) {
        const gvkList = schema['x-kubernetes-group-version-kind']

        gvkList.forEach((gvk: any) => {
          const resolvedSchema = this.resolveSchemaEager(schema, definitions.definitions)

          const metadata: KubernetesResourceMetadata = {
            key: `${gvk.group}/${gvk.version}/${gvk.kind}`,
            group: gvk.group || 'core',
            version: gvk.version,
            kind: gvk.kind,
            displayName: this.createDisplayName(gvk),
            description: schema.description,
            source: sourceId,
            definitionKey
          }

          // Pre-cache the resolved schema
          schemaCache.set(definitionKey, resolvedSchema)

          // Index metadata by kind
          if (!byKind.has(gvk.kind)) {
            byKind.set(gvk.kind, [])
          }
          byKind.get(gvk.kind)!.push(metadata)

          // Index by group/version/kind combination
          const gvkKey = `${gvk.group || 'core'}/${gvk.version}/${gvk.kind}`
          byGroupVersionKind.set(gvkKey, metadata)
        })
      }
    })

    this.lazyIndex = {
      byKind,
      byGroupVersionKind,
      schemaCache,
      rawDefinitions: definitions.definitions
    }

    console.log(`Eager schema indexer initialized with ${byKind.size} kinds (all schemas loaded)`)
    return this.lazyIndex
  }

  /**
   * Load and resolve schema on-demand (lazy loading)
   */
  private async loadSchemaOnDemand(definitionKey: string): Promise<any> {
    if (!this.lazyIndex) throw new Error('Schema indexer not initialized')

    // Check cache first
    if (this.lazyIndex.schemaCache.has(definitionKey)) {
      return this.lazyIndex.schemaCache.get(definitionKey)
    }

    // Load from raw definitions
    const rawSchema = this.lazyIndex.rawDefinitions[definitionKey]
    if (!rawSchema) {
      console.warn(`Schema not found for definition key: ${definitionKey}`)
      return null
    }

    // Resolve $ref references
    const resolvedSchema = this.resolveSchemaLazy(rawSchema)

    // Cache the resolved schema
    this.lazyIndex.schemaCache.set(definitionKey, resolvedSchema)

    //console.log(`Lazy loaded schema for: ${definitionKey}`)
    return resolvedSchema
  }

  /**
   * Lazy $ref resolution with circular reference protection
   */
  private resolveSchemaLazy(schema: any, maxDepth: number = 10, visited: Set<string> = new Set()): any {
    if (!this.lazyIndex || maxDepth <= 0) return schema

    if (typeof schema !== 'object' || schema === null) {
      return schema
    }

    if (Array.isArray(schema)) {
      return schema.map(item => this.resolveSchemaLazy(item, maxDepth - 1, visited))
    }

    const resolved = { ...schema }

    // Remove description to prevent it from appearing in forms
    if (resolved.description) {
      delete resolved.description
    }

    // Handle $ref with circular reference protection
    if (resolved['$ref']) {
      const refPath = resolved['$ref']
      if (refPath.startsWith('#/definitions/')) {
        const definitionKey = refPath.replace('#/definitions/', '')

        // Prevent circular references
        if (visited.has(definitionKey)) {
          console.warn(`Circular reference detected: ${definitionKey}`)
          const { '$ref': _, ...rest } = resolved
          return {
            ...rest,
            type: 'object',
            additionalProperties: true
          }
        }

        const referencedSchema = this.lazyIndex.rawDefinitions[definitionKey]
        if (referencedSchema) {
          visited.add(definitionKey)
          const { '$ref': _, ...rest } = resolved
          const { description: __, ...cleanReferencedSchema } = referencedSchema

          // Recursively resolve the referenced schema
          const resolvedRef = this.resolveSchemaLazy(cleanReferencedSchema, maxDepth - 1, new Set(visited))
          visited.delete(definitionKey)

          return { ...resolvedRef, ...rest }
        } else {
          console.warn(`Could not resolve schema reference: ${refPath}`)
          const { '$ref': _, ...rest } = resolved
          return {
            ...rest,
            type: 'object',
            additionalProperties: true
          }
        }
      }
    }

    // Recursively resolve nested objects
    Object.keys(resolved).forEach(key => {
      if (key !== '$ref') {
        resolved[key] = this.resolveSchemaLazy(resolved[key], maxDepth - 1, visited)
      }
    })

    return resolved
  }

  /**
   * Eager $ref resolution (fallback for non-lazy mode)
   */
  private resolveSchemaEager(schema: any, definitions: any, maxDepth: number = 10): any {
    if (maxDepth <= 0) return schema

    if (typeof schema !== 'object' || schema === null) {
      return schema
    }

    if (Array.isArray(schema)) {
      return schema.map(item => this.resolveSchemaEager(item, definitions, maxDepth - 1))
    }

    const resolved = { ...schema }

    // Remove description to prevent it from appearing in forms
    if (resolved.description) {
      delete resolved.description
    }

    // Handle $ref
    if (resolved['$ref']) {
      const refPath = resolved['$ref']
      if (refPath.startsWith('#/definitions/')) {
        const definitionKey = refPath.replace('#/definitions/', '')
        const referencedSchema = definitions[definitionKey]
        if (referencedSchema) {
          const { '$ref': _, ...rest } = resolved
          const { description: __, ...cleanReferencedSchema } = referencedSchema
          return { ...cleanReferencedSchema, ...rest }
        } else {
          console.warn(`Could not resolve schema reference: ${refPath}`)
          const { '$ref': _, ...rest } = resolved
          return {
            ...rest,
            type: 'object',
            additionalProperties: true
          }
        }
      }
    }

    // Recursively resolve nested objects
    Object.keys(resolved).forEach(key => {
      if (key !== '$ref') {
        resolved[key] = this.resolveSchemaEager(resolved[key], definitions, maxDepth - 1)
      }
    })

    return resolved
  }

  /**
   * Create a user-friendly display name
   */
  private createDisplayName(gvk: any): string {
    const group = gvk.group || 'core'
    const groupDisplay = group === 'core' ? '' : ` (${group})`
    return `${gvk.kind} ${gvk.version}${groupDisplay}`
  }

  /**
   * Get all available resource kinds
   */
  getAvailableKinds(): string[] {
    if (!this.lazyIndex) return []
    return Array.from(this.lazyIndex.byKind.keys()).sort()
  }

  /**
   * Get all versions of a specific kind (with lazy loading)
   */
  async getKindVersions(kind: string): Promise<KubernetesResourceSchema[]> {
    if (!this.lazyIndex) return []

    const metadataList = this.lazyIndex.byKind.get(kind) || []

    // Load schemas on-demand
    const schemas = await Promise.all(
      metadataList.map(async (metadata) => {
        const schema = await this.loadSchemaOnDemand(metadata.definitionKey)

        console.log('🔍 Metadata for apiVersion calculation:', {
          group: metadata.group,
          version: metadata.version,
          kind: metadata.kind
        })

        // Direct apiVersion computation - simple and reliable
        const apiVersion = metadata.group === 'core' ? metadata.version : `${metadata.group}/${metadata.version}`

        console.log('✅ Computed apiVersion:', apiVersion)

        const result = {
          ...metadata,
          schema,
          apiVersion  // Directly assign the computed value
        }

        // console.log('📦 Final result object:', {
        //   kind: result.kind,
        //   group: result.group,
        //   version: result.version,
        //   apiVersion: result.apiVersion
        // })

        return result;
      })
    )

    // console.log('🎯 Final schemas array length:', schemas.length)
    // console.log('🎯 First schema apiVersion:', schemas[0]?.apiVersion)

    return schemas
  }


  /**
   * Get schema by group/version/kind (with lazy loading)
   */
  async getSchemaByGVK(group: string, version: string, kind: string): Promise<KubernetesResourceSchema | null> {
    if (!this.lazyIndex) return null

    const key = `${group}/${version}/${kind}`
    const metadata = this.lazyIndex.byGroupVersionKind.get(key)

    if (!metadata) return null

    const schema = await this.loadSchemaOnDemand(metadata.definitionKey)

    console.log('🔍 getSchemaByGVK metadata:', {
      group: metadata.group,
      version: metadata.version,
      kind: metadata.kind
    })

    // Direct apiVersion computation - simple and reliable
    const apiVersion = metadata.group === 'core' ? metadata.version : `${metadata.group}/${metadata.version}`

    console.log('✅ getSchemaByGVK computed apiVersion:', apiVersion)

    const result = {
      ...metadata,
      schema,
      apiVersion  // Directly assign the computed value
    }

    console.log('📦 getSchemaByGVK final result:', {
      kind: result.kind,
      group: result.group,
      version: result.version,
      apiVersion: result.apiVersion
    })

    return result
  }

  /**
   * Resolve $ref references in a schema (backward compatibility)
   */
  resolveSchema(schema: any, maxDepth: number = 10): any {
    if (this.isLazyMode) {
      return this.resolveSchemaLazy(schema, maxDepth)
    } else {
      return this.resolveSchemaEager(schema, this.lazyIndex?.rawDefinitions, maxDepth)
    }
  }

  /**
   * Get a fully resolved schema for form generation (with lazy loading)
   */
  async getResolvedSchema(group: string, version: string, kind: string): Promise<any | null> {
    const resourceSchema = await this.getSchemaByGVK(group, version, kind)
    if (!resourceSchema) return null

    return resourceSchema.schema  // Already resolved in loadSchemaOnDemand
  }

  /**
   * Search for resources by name or description
   */
  searchResources(query: string): KubernetesResourceMetadata[] {
    if (!this.lazyIndex || !query.trim()) return []

    const searchTerm = query.toLowerCase()
    const results: KubernetesResourceMetadata[] = []

    this.lazyIndex.byGroupVersionKind.forEach(resource => {
      if (
        resource.kind.toLowerCase().includes(searchTerm) ||
        resource.displayName.toLowerCase().includes(searchTerm) ||
        (resource.description && resource.description.toLowerCase().includes(searchTerm))
      ) {
        results.push(resource)
      }
    })

    return results.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  /**
   * Get schema properties for form generation (with lazy loading)
   */
  async getSchemaProperties(group: string, version: string, kind: string): Promise<any | null> {
    const resolvedSchema = await this.getResolvedSchema(group, version, kind)
    if (!resolvedSchema) return null

    return {
      properties: resolvedSchema.properties || {},
      required: resolvedSchema.required || [],
      type: resolvedSchema.type || 'object',
      additionalProperties: resolvedSchema.additionalProperties,
      patternProperties: resolvedSchema.patternProperties
    }
  }

  /**
   * Get flattened properties for complex nested schemas (with lazy loading)
   */
  async getFlattenedProperties(group: string, version: string, kind: string, maxDepth: number = 3): Promise<any> {
    const schemaProperties = await this.getSchemaProperties(group, version, kind)
    if (!schemaProperties) return null

    const flattenProperties = (props: any, path: string = '', depth: number = 0): any => {
      if (depth >= maxDepth) return {}

      const flattened: any = {}

      Object.entries(props).forEach(([key, value]: [string, any]) => {
        const currentPath = path ? `${path}.${key}` : key

        if (value.type === 'object' && value.properties) {
          // Recursively flatten nested objects
          Object.assign(flattened, flattenProperties(value.properties, currentPath, depth + 1))
        } else {
          flattened[currentPath] = value
        }
      })

      return flattened
    }

    return {
      properties: flattenProperties(schemaProperties.properties),
      required: schemaProperties.required,
      originalSchema: schemaProperties
    }
  }

  // ... existing code ...
  // Keep the existing CRD methods unchanged
  async searchResourcesWithCRDs(query: string): Promise<KubernetesResourceSchema[]> {
    try {
      // Try enhanced search with CRDs
      const results = await window.electronAPI.invoke('schema:searchAllSourcesWithCRDs', query);

      // Convert FlattenedResource[] to KubernetesResourceSchema[] format
      const converted = await Promise.all(results.map(async resource => {
        // Parse apiVersion to extract group and version
        const [group, version] = resource.apiVersion?.includes('/')
          ? resource.apiVersion.split('/')
          : ['core', resource.apiVersion || 'v1'];

        let schema: any = {};

        // For CRD resources, fetch the actual JSONSchema7 from the backend
        if (resource.source === 'cluster-crds') {
          try {
            // Get the raw JSONSchema7 from the backend cache
            const cacheKey = `crd-${group}-${version}-${resource.kind}`;
            const rawSchema = await window.electronAPI.invoke('schema:getRawCRDSchema', cacheKey);
            if (rawSchema && rawSchema.definitions && rawSchema.definitions[resource.kind]) {
              schema = rawSchema.definitions[resource.kind];
            }
          } catch (error) {
            console.warn(`Failed to fetch CRD schema for ${resource.kind}:`, error);
          }
        } else {
          // For regular Kubernetes resources, use the existing schema
          schema = resource.schema || {};
        }

        // Use the factory function to ensure apiVersion is correctly computed
        return createKubernetesResourceSchema({
          key: resource.key,
          group: group,
          version: version,
          kind: resource.kind,
          schema: schema, // This will be a proper JSONSchema7 object
          displayName: this.createDisplayName({
            group: group,
            version: version,
            kind: resource.kind
          }),
          description: resource.description,
          source: resource.source
        });
      }));

      return converted;
    } catch (error) {
      console.warn('Enhanced CRD search not available, falling back to standard search:', error);
      return this.searchResources(query);
    }
  }

  /**
   * Get all available kinds including CRDs when available
   * Falls back to standard kinds if CRDs not available
   */
  async getAvailableKindsWithCRDs(): Promise<string[]> {
    try {
      // Try to get enhanced resource list with CRDs
      const allResources = await window.electronAPI.invoke('schema:getAllResourcesWithCRDs');
      const kinds = [...new Set(allResources.map(r => r.kind))].sort();
      return kinds;
    } catch (error) {
      console.warn('Enhanced CRD kinds not available, falling back to standard kinds:', error);
      // Fallback to existing functionality
      return this.getAvailableKinds();
    }
  }

  /**
   * Toggle between lazy and eager loading modes (for testing/debugging)
   */
  setLazyMode(enabled: boolean): void {
    this.isLazyMode = enabled
    console.log(`Schema indexer mode: ${enabled ? 'lazy' : 'eager'} loading`)
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { totalKinds: number, cachedSchemas: number, cacheHitRatio: number } {
    if (!this.lazyIndex) {
      return { totalKinds: 0, cachedSchemas: 0, cacheHitRatio: 0 }
    }

    const totalKinds = this.lazyIndex.byKind.size
    const cachedSchemas = this.lazyIndex.schemaCache.size
    const cacheHitRatio = totalKinds > 0 ? cachedSchemas / totalKinds : 0

    return { totalKinds, cachedSchemas, cacheHitRatio }
  }
}

export const kubernetesSchemaIndexer = new KubernetesSchemaIndexer()