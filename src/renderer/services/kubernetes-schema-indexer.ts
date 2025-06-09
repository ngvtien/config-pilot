interface KubernetesResourceSchema {
  key: string // The definition key (e.g., "io.k8s.api.apps.v1.Deployment")
  group: string
  version: string
  kind: string
  schema: any // The actual JSON schema
  displayName: string // User-friendly name
  description?: string
}

interface SchemaIndex {
  byKind: Map<string, KubernetesResourceSchema[]>
  byGroupVersionKind: Map<string, KubernetesResourceSchema>
  byKey: Map<string, any>
  definitions: any // Full definitions object for $ref resolution
}

class KubernetesSchemaIndexer {
  private schemaIndex: SchemaIndex | null = null

  /**
   * Get the current schema index (for accessing definitions)
   */
  getSchemaIndex(): SchemaIndex | null {
    return this.schemaIndex
  }

  /**
   * Load and index the schema definitions
   */
  async loadSchemaDefinitions(definitionsPath: string): Promise<SchemaIndex> {
    try {
      // Load the definitions file
      const definitionsContent = await window.electronAPI.readFile(definitionsPath)
      const definitions = JSON.parse(definitionsContent)

      return this.indexDefinitions(definitions)
    } catch (error) {
      console.error('Failed to load schema definitions:', error)
      throw error
    }
  }

  /**
   * Index the definitions by finding all schemas with x-kubernetes-group-version-kind
   */
  private indexDefinitions(definitions: any): SchemaIndex {
    const byKind = new Map<string, KubernetesResourceSchema[]>()
    const byGroupVersionKind = new Map<string, KubernetesResourceSchema>()
    const byKey = new Map<string, any>()

    // Store all definitions for $ref resolution
    Object.entries(definitions.definitions).forEach(([key, schema]) => {
      byKey.set(key, schema)
    })

    // Find all schemas with x-kubernetes-group-version-kind
    Object.entries(definitions.definitions).forEach(([key, schema]: [string, any]) => {
      if (schema['x-kubernetes-group-version-kind']) {
        const gvkList = schema['x-kubernetes-group-version-kind']

        gvkList.forEach((gvk: any) => {
          const resourceSchema: KubernetesResourceSchema = {
            key,
            group: gvk.group || 'core',
            version: gvk.version,
            kind: gvk.kind,
            schema,
            displayName: this.createDisplayName(gvk),
            description: schema.description
          }

          // Index by kind
          if (!byKind.has(gvk.kind)) {
            byKind.set(gvk.kind, [])
          }
          byKind.get(gvk.kind)!.push(resourceSchema)

          // Index by group/version/kind combination
          const gvkKey = `${gvk.group || 'core'}/${gvk.version}/${gvk.kind}`
          byGroupVersionKind.set(gvkKey, resourceSchema)
        })
      }
    })

    this.schemaIndex = {
      byKind,
      byGroupVersionKind,
      byKey,
      definitions: definitions.definitions
    }

    return this.schemaIndex
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
    if (!this.schemaIndex) return []
    return Array.from(this.schemaIndex.byKind.keys()).sort()
  }

  /**
   * Get all versions of a specific kind
   */
  getKindVersions(kind: string): KubernetesResourceSchema[] {
    if (!this.schemaIndex) return []
    return this.schemaIndex.byKind.get(kind) || []
  }

  /**
   * Get schema by group/version/kind
   */
  getSchemaByGVK(group: string, version: string, kind: string): KubernetesResourceSchema | null {
    if (!this.schemaIndex) return null
    const key = `${group}/${version}/${kind}`
    return this.schemaIndex.byGroupVersionKind.get(key) || null
  }

  /**
   * Resolve $ref references in a schema
   */
  resolveSchema(schema: any, maxDepth: number = 10): any {
    if (!this.schemaIndex || maxDepth <= 0) return schema

    if (typeof schema !== 'object' || schema === null) {
      return schema
    }

    if (Array.isArray(schema)) {
      return schema.map(item => this.resolveSchema(item, maxDepth - 1))
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
        const referencedSchema = this.schemaIndex.byKey.get(definitionKey)
        if (referencedSchema) {
          // Merge the referenced schema, but don't resolve recursively to avoid infinite loops
          const { '$ref': _, ...rest } = resolved

          // Also remove description from the referenced schema before merging
          const { description: __, ...cleanReferencedSchema } = referencedSchema

          return { ...cleanReferencedSchema, ...rest }
        } else {
          // If we can't resolve the reference, remove the $ref and provide a fallback
          console.warn(`Could not resolve schema reference: ${refPath}`)
          const { '$ref': _, ...rest } = resolved
          return {
            ...rest,
            type: 'object',
            //description: `Reference to ${definitionKey} (unresolved)`,
            additionalProperties: true
          }
        }
      }
    }

    // Recursively resolve nested objects
    Object.keys(resolved).forEach(key => {
      if (key !== '$ref') {
        resolved[key] = this.resolveSchema(resolved[key], maxDepth - 1)
      }
    })

    return resolved
  }

  /**
   * Get a fully resolved schema for form generation
   */
  getResolvedSchema(group: string, version: string, kind: string): any | null {
    const resourceSchema = this.getSchemaByGVK(group, version, kind)
    if (!resourceSchema) return null

    return this.resolveSchema(resourceSchema.schema)
  }

  /**
   * Search for resources by name or description
   */
  searchResources(query: string): KubernetesResourceSchema[] {
    if (!this.schemaIndex || !query.trim()) return []

    const searchTerm = query.toLowerCase()
    const results: KubernetesResourceSchema[] = []

    this.schemaIndex.byGroupVersionKind.forEach(resource => {
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
   * Get schema properties for form generation
   */
  getSchemaProperties(group: string, version: string, kind: string): any | null {
    const resolvedSchema = this.getResolvedSchema(group, version, kind)
    if (!resolvedSchema) return null

    return {
      properties: resolvedSchema.properties || {},
      required: resolvedSchema.required || [],
      type: resolvedSchema.type || 'object',
      //description: resolvedSchema.description,
      // Include any additional metadata that might be useful for form generation
      additionalProperties: resolvedSchema.additionalProperties,
      patternProperties: resolvedSchema.patternProperties
    }
  }

  /**
   * Get flattened properties for complex nested schemas
   */
  getFlattenedProperties(group: string, version: string, kind: string, maxDepth: number = 3): any {
    const schemaProperties = this.getSchemaProperties(group, version, kind)
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
}

export const kubernetesSchemaIndexer = new KubernetesSchemaIndexer()
