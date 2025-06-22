import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import { JSONSchema7 } from 'json-schema';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FlattenedResource, SchemaSource, SchemaTreeNode } from '../../shared/types/schema';
import { CRDManagementService } from './crd-management-service';
import { CRDSchema } from "../../shared/types/kubernetes"

// Update the RawSchemaCache interface to include the source path
interface RawSchemaCache {
  schema: JSONSchema7;
  dereferencedPaths: Set<string>;
  lastAccessed: number;
  filePath: string; // Add the source file path for $RefParser context
  source: string; // Add source property
}

class SchemaService {
  private crdService?: CRDManagementService;
  private resourcesBySource: Map<string, Map<string, FlattenedResource>> = new Map();
  private schemaSources: Map<string, SchemaSource> = new Map();
  // New: Cache for raw schemas with $ref intact
  private rawSchemaCache: Map<string, RawSchemaCache> = new Map();
  // New: Cache for dereferenced schema portions
  private dereferencedCache: Map<string, JSONSchema7> = new Map();
  private isInitialized = false;

  /**
   * Register a schema source for loading
   */
  registerSchemaSource(source: SchemaSource): void {
    this.schemaSources.set(source.id, source);
    this.resourcesBySource.set(source.id, new Map());
  }


  /**
   * Initialize all registered and enabled schema sources
   * Now loads raw schemas without dereferencing
   */
  async initialize(): Promise<void> {
    try {
      console.log('=== INITIALIZING SCHEMA SERVICE ===');
      console.log(`Found ${this.schemaSources.size} schema sources`);

      for (const source of this.schemaSources.values()) {
        console.log(`Source: ${source.id}, enabled: ${source.enabled}, path: ${source.path}`);
        if (source.enabled) {
          await this.loadRawSchemaSource(source);
        } else {
          console.log(`Skipping disabled source: ${source.id}`);
        }
      }

      this.isInitialized = true;
      console.log(`=== SCHEMA SERVICE INITIALIZED ===`);
      console.log(`Final cache size: ${this.rawSchemaCache.size}`);
      console.log(`Final cache keys:`, Array.from(this.rawSchemaCache.keys()));

      const totalResources = Array.from(this.resourcesBySource.values())
        .reduce((sum, sourceMap) => sum + sourceMap.size, 0);

      console.log(`Schema service initialized. Found ${totalResources} resources from ${this.schemaSources.size} sources.`);
    } catch (error) {
      console.error('Failed to initialize schema service:', error);
      throw error;
    }
  }

  /**
   * Initialize CRD discovery after vanilla schemas are loaded
   */
  async initializeCRDs(kubeConfigPath?: string): Promise<void> {
    try {
      console.log('=== INITIALIZING CRD DISCOVERY ===');

      // Initialize CRD service
      this.crdService = new CRDManagementService(kubeConfigPath);

      // Discover CRDs from connected cluster
      const clusterCRDs = await this.crdService.discoverClusterCRDs();
      console.log(`Discovered ${clusterCRDs.length} CRDs from cluster`);

      // Convert CRDs to schema format and add to cache
      for (const crd of clusterCRDs) {
        await this.addCRDToSchemaCache(crd);
      }

      console.log('=== CRD DISCOVERY COMPLETED ===');
    } catch (error) {
      console.warn('CRD discovery failed (cluster may not be accessible):', error);
      // Don't throw - vanilla k8s schemas should still work
    }
  }

  /**
   * Convert CRD schema to our internal format and add to cache
   * CRITICAL: Key generation must be consistent for resource lookup
   */
  private async addCRDToSchemaCache(crd: CRDSchema): Promise<void> {
    // Validate CRD data before processing
    if (!crd.group || !crd.version || !crd.kind) {
      console.error('❌ Invalid CRD data - missing required fields:', {
        group: crd.group,
        version: crd.version,
        kind: crd.kind,
        id: crd.id
      });
      return;
    }

    console.log('🔍 Processing CRD with validated data:', {
      kind: crd.kind,
      group: crd.group,
      version: crd.version,
      expectedApiVersion: `${crd.group}/${crd.version}`
    });

    const sourceId = 'cluster-crds';
    //const cacheKey = `crd-${crd.group}-${crd.version}`;
    const cacheKey = `crd-${crd.group}-${crd.version}-${crd.kind}`;

    // Ensure we have a source map for CRDs
    if (!this.resourcesBySource.has(sourceId)) {
      this.resourcesBySource.set(sourceId, new Map());
      this.schemaSources.set(sourceId, {
        id: sourceId,
        name: 'Cluster CRDs',
        path: 'cluster',
        enabled: true
      });
    }

    // Convert CRD OpenAPI v3 schema to JSON Schema v7 format
    const apiVersion = `${crd.group}/${crd.version}`;
    const jsonSchema: JSONSchema7 = {
      type: 'object',
      definitions: {
        [crd.kind]: {
          type: 'object',
          properties: {
            apiVersion: {
              type: 'string',
              enum: [apiVersion]
            },
            kind: {
              type: 'string',
              enum: [crd.kind]
            },
            metadata: {
              $ref: '#/definitions/ObjectMeta'
            },
            spec: crd.schema || {},
            status: {
              type: 'object',
              additionalProperties: true
            }
          },
          required: ['apiVersion', 'kind']
        }
      }
    };

    this.rawSchemaCache.set(cacheKey, {
      schema: jsonSchema,
      dereferencedPaths: new Set(),
      lastAccessed: Date.now(),
      filePath: 'cluster-crd',
      source: 'cluster'
    });

    // CRITICAL: Resource key must match frontend expectations
    const resourceKey = `${apiVersion}/${crd.kind}`; // e.g., "argoproj.io/v1alpha1/ApplicationSet"

    // Parse group from apiVersion
    const [group, version] = apiVersion.includes('/') 
        ? apiVersion.split('/')
        : ['core', apiVersion];

    // Create FlattenedResource with EXACT key format for lookup
    const flattenedResource: FlattenedResource = {
      key: resourceKey,
      kind: crd.kind,
      apiVersion: apiVersion, // This MUST be {group}/{version}
      group: group,
      properties: {},
      required: ['apiVersion', 'kind'],
      description: crd.description || `Custom Resource Definition: ${crd.kind}`,
      source: sourceId,
      originalKey: crd.kind
    };


    const sourceMap = this.resourcesBySource.get(sourceId)!;
    sourceMap.set(resourceKey, flattenedResource);

    console.log(`✅ Added CRD to search index with key: ${resourceKey}`);
    console.log(`   - apiVersion: ${flattenedResource.apiVersion}`);
    console.log(`   - kind: ${flattenedResource.kind}`);
  }
  /**
   * Build a hierarchical tree structure from JSON schema with full field information
   */
  buildSchemaTree(
    schema: JSONSchema7,
    definitions: Record<string, JSONSchema7>,
    name: string = "",
    path: string = "",
    requiredFields: string[] = []
  ): SchemaTreeNode[] {
    // Filter out unwanted nodes
    if (name === 'selfLink' || name === '*') {
      return [];
    }

    // Handle $ref by resolving inline
    if (schema.$ref) {
      const refKey = schema.$ref.replace("#/definitions/", "");
      const resolved = definitions[refKey];
      if (!resolved) {
        console.warn(`Unresolved reference: ${schema.$ref}`);
        return [{
          name,
          type: "unresolved:$ref",
          path: path || name,
          description: `Unresolved reference: ${schema.$ref}`
        }];
      }
      return this.buildSchemaTree(resolved, definitions, name, path, requiredFields);
    }

    // Handle object types with properties
    if (schema.type === "object" && schema.properties) {
      const children: SchemaTreeNode[] = [];
      const currentPath = path ? `${path}.${name}` : name;
      const objectRequired = schema.required || [];

      for (const [key, propSchema] of Object.entries(schema.properties)) {
        // Filter out selfLink properties
        if (key === 'selfLink') {
          continue;
        }

        const childPath = currentPath ? `${currentPath}.${key}` : key;
        const subTree = this.buildSchemaTree(
          propSchema as JSONSchema7,
          definitions,
          key,
          childPath,
          objectRequired
        );
        children.push(...subTree);
      }

      return [{
        name,
        type: "object",
        path: currentPath || name,
        description: schema.description,
        required: requiredFields.includes(name),
        children
      }];
    }

    // Handle array types
    if (schema.type === "array" && schema.items) {
      const currentPath = path ? `${path}.${name}` : name;
      const items = this.buildSchemaTree(
        schema.items as JSONSchema7,
        definitions,
        "[]",
        `${currentPath}[]`,
        []
      );
      return [{
        name,
        type: "array",
        path: currentPath,
        description: schema.description,
        required: requiredFields.includes(name),
        children: items
      }];
    }

    // Handle additionalProperties for dynamic object keys
    if (schema.type === "object" && schema.additionalProperties && typeof schema.additionalProperties === "object") {
      const currentPath = path ? `${path}.${name}` : name;
      const additionalTree = this.buildSchemaTree(
        schema.additionalProperties as JSONSchema7,
        definitions,
        "*",
        `${currentPath}.*`,
        []
      );
      return [{
        name,
        type: "object",
        path: currentPath,
        description: schema.description,
        required: requiredFields.includes(name),
        children: additionalTree
      }];
    }

    // Handle primitive types
    const currentPath = path ? `${path}.${name}` : name;
    return [{
      name,
      type: Array.isArray(schema.type) ? schema.type[0] : (schema.type || "unknown"),
      path: currentPath,
      description: schema.description,
      required: requiredFields.includes(name)
    }];
  }

  /**
   * Get schema tree for a specific resource (replaces dereferenceResource)
   * This is the main method that UI components should call
   */
  async getResourceSchemaTree(sourceId: string, resourceKey: string): Promise<SchemaTreeNode[] | null> {
    // DEBUG: Log all cache keys
    console.log('=== CACHE DEBUG ===');
    console.log('Looking for sourceId:', sourceId);
    console.log('Looking for resourceKey:', resourceKey);
    console.log('All cache keys:', Array.from(this.rawSchemaCache.keys()));
    console.log('Cache size:', this.rawSchemaCache.size);


    // First try to get cache with just sourceId (for legacy single-file schemas)
    let rawCache = this.rawSchemaCache.get(sourceId);

    // If not found, try to find a version-specific cache for this source
    if (!rawCache) {
      const versionedCacheKey = Array.from(this.rawSchemaCache.keys())
        .find(key => key.startsWith(`${sourceId}-`));

      if (versionedCacheKey) {
        rawCache = this.rawSchemaCache.get(versionedCacheKey);
      }
    }

    if (!rawCache) {
      console.warn(`No raw schema cache found for source: ${sourceId}`);
      return null;
    }

    const definitions = rawCache.schema.definitions || {};
    const resourceSchema = definitions[resourceKey];

    if (!resourceSchema) {
      console.warn(`Resource schema not found: ${resourceKey} in source: ${sourceId}`);
      return null;
    }

    // Add type guard for boolean schemas
    if (typeof resourceSchema === 'boolean') {
      console.warn(`Resource schema is boolean for: ${resourceKey}`);
      return null;
    }

    try {
      console.log(`Building schema tree for ${resourceKey}`);

      // Filter definitions to only include JSONSchema7 objects (not booleans)
      const filteredDefinitions: Record<string, JSONSchema7> = {};
      for (const [key, def] of Object.entries(definitions)) {
        if (typeof def === 'object' && def !== null) {
          filteredDefinitions[key] = def;
        }
      }

      const tree = this.buildSchemaTree(resourceSchema as JSONSchema7, filteredDefinitions, resourceKey);

      // Update cache access time
      rawCache.lastAccessed = Date.now();

      return tree;
    } catch (error) {
      console.error(`Error building schema tree for ${resourceKey}:`, error);
      return null;
    }
  }

  /**
 * Get all available resource keys for a schema source
 * Useful for UI components to list available resources
 */
  getAvailableResources(sourceId: string): string[] {
    const rawCache = this.rawSchemaCache.get(sourceId);
    if (!rawCache || !rawCache.schema.definitions) {
      return [];
    }

    return Object.keys(rawCache.schema.definitions).filter(key =>
      this.isKubernetesResourceBasic(rawCache.schema.definitions![key])
    );
  }


  /**
   * Load raw schema without dereferencing (new method)
   */
  // private async loadRawSchemaSource(source: SchemaSource): Promise<void> {
  //   try {
  //     console.log(`Loading raw schema source: ${source.name}`);

  //     if (!fs.existsSync(source.path)) {
  //       console.warn(`Schema file not found: ${source.path}`);
  //       return;
  //     }

  //     const schemaContent = fs.readFileSync(source.path, 'utf8');
  //     const rawSchema = JSON.parse(schemaContent) as JSONSchema7;

  //     // Store raw schema in cache with file path
  //     this.rawSchemaCache.set(source.id, {
  //       schema: rawSchema,
  //       dereferencedPaths: new Set(),
  //       lastAccessed: Date.now(),
  //       filePath: source.path // Store the source file path
  //     });

  //     // Extract basic resource info without dereferencing
  //     this.extractBasicResourceInfo(rawSchema, source);

  //     const sourceResources = this.resourcesBySource.get(source.id);
  //     console.log(`Loaded ${source.name}: ${sourceResources?.size || 0} resources (lazy mode)`);
  //   } catch (error) {
  //     console.error(`Failed to load raw schema source ${source.name}:`, error);
  //   }
  // }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }


  /**
   * Get all resources from all sources (optional CRD enhancement)
   * Falls back to empty array if CRDs not available
   */
  getAllResourcesWithCRDs(): FlattenedResource[] {
    if (!this.isInitialized) return [];

    const allResources: FlattenedResource[] = [];

    try {
      // Get resources from all sources including CRDs
      for (const sourceId of this.resourcesBySource.keys()) {
        const sourceResources = this.getResourcesFromSource(sourceId);
        allResources.push(...sourceResources);
      }

      // Remove duplicates and sort
      const uniqueResources = allResources.filter((resource, index, self) =>
        index === self.findIndex(r => r.kind === resource.kind && r.apiVersion === resource.apiVersion)
      );

      return uniqueResources.sort((a, b) => a.kind.localeCompare(b.kind));
    } catch (error) {
      console.warn('CRD resources not available, falling back to standard resources:', error);
      // Fallback to just kubernetes source if CRDs fail
      return this.getResourcesFromSource('kubernetes') || [];
    }
  }

  /**
   * Search across all sources with CRD support (optional enhancement)
   * Falls back to kubernetes source only if CRDs not available
   */
  searchAllSourcesWithCRDs(query: string): FlattenedResource[] {
    if (!this.isInitialized) return [];

    try {
      const allResults: FlattenedResource[] = [];

      // Search in all available sources
      for (const sourceId of this.resourcesBySource.keys()) {
        const sourceResults = this.searchInSource(sourceId, query);
        allResults.push(...sourceResults);
      }

      // Remove duplicates and sort
      const uniqueResults = allResults.filter((resource, index, self) =>
        index === self.findIndex(r => r.kind === resource.kind && r.apiVersion === resource.apiVersion)
      );

      return uniqueResults.sort((a, b) => a.kind.localeCompare(b.kind));
    } catch (error) {
      console.warn('CRD search not available, falling back to kubernetes source:', error);
      // Fallback to just kubernetes source if CRDs fail
      return this.searchInSource('kubernetes', query);
    }
  }

  /**
   * List directories in a given path
   */
  private async listDirectories(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      console.warn(`Failed to list directories in ${dirPath}:`, error);
      return [];
    }
  }

  // Update the loadRawSchemaSource method to handle the new directory structure
  private async loadRawSchemaSource(source: SchemaSource): Promise<void> {
    try {
      console.log(`=== LOADING SCHEMA SOURCE: ${source.id} from ${source.path} ===`);

      // Check if path exists
      const pathExists = await this.fileExists(source.path);
      console.log(`Path exists: ${pathExists}`);

      if (!pathExists) {
        console.error(`❌ Schema source path does not exist: ${source.path}`);
        return;
      }

      // For the new structure, we need to look for version directories
      if (source.id === 'kubernetes' || source.id === 'openshift' || source.id === 'argocd') {
        console.log(`Processing versioned schema source: ${source.id}`);

        // List version directories
        const versionDirs = await this.listDirectories(source.path);
        console.log(`Found version directories:`, versionDirs);

        if (versionDirs.length === 0) {
          console.warn(`❌ No version directories found in ${source.path}`);
          return;
        }

        for (const versionDir of versionDirs) {
          const definitionsPath = path.join(source.path, versionDir, '_definitions.json');
          console.log(`Checking definitions file: ${definitionsPath}`);

          if (await this.fileExists(definitionsPath)) {
            console.log(`✅ Found definitions file: ${definitionsPath}`);

            try {
              const schemaContent = await fs.readFile(definitionsPath, 'utf-8');
              console.log(`File size: ${schemaContent.length} characters`);

              const schema = JSON.parse(schemaContent) as JSONSchema7;
              const definitionCount = Object.keys(schema.definitions || {}).length;
              console.log(`Parsed schema with ${definitionCount} definitions`);

              // Store with version-specific key
              const cacheKey = `${source.id}-${versionDir}`;
              this.rawSchemaCache.set(cacheKey, {
                schema,
                dereferencedPaths: new Set(),
                lastAccessed: Date.now(),
                filePath: definitionsPath,
                source: source.id
              });

              console.log(`✅ Stored in cache with key: ${cacheKey}`);
              console.log(`Cache size after storing: ${this.rawSchemaCache.size}`);

              this.extractBasicResourceInfo(schema, source);

            } catch (parseError) {
              console.error(`❌ Failed to parse JSON from ${definitionsPath}:`, parseError);
            }
          } else {
            console.log(`❌ No definitions file found: ${definitionsPath}`);
          }
        }
      } else {
        // Handle legacy single-file schemas
        console.log(`Processing legacy schema source: ${source.id}`);
        const definitionsPath = path.join(source.path, '_definitions.json');

        if (await this.fileExists(definitionsPath)) {
          const schemaContent = await fs.readFile(definitionsPath, 'utf-8');
          const schema = JSON.parse(schemaContent) as JSONSchema7;

          this.rawSchemaCache.set(source.id, {
            schema,
            dereferencedPaths: new Set(),
            lastAccessed: Date.now(),
            filePath: definitionsPath,
            source: source.id
          });

          console.log(`✅ Loaded legacy schema for ${source.id}`);
        } else {
          console.log(`❌ No legacy definitions file found: ${definitionsPath}`);
        }
      }

    } catch (error: any) {
      console.error(`❌ Error loading schema source ${source.id}:`, error);
    }
  }

  /**
   * Extract basic resource information without dereferencing
   */
  private extractBasicResourceInfo(schema: JSONSchema7, source: SchemaSource): void {
    if (!schema.definitions) return;

    const sourceMap = this.resourcesBySource.get(source.id);
    if (!sourceMap) return;

    for (const [key, definition] of Object.entries(schema.definitions)) {
      if (this.isKubernetesResourceBasic(definition)) {
        const resource = this.createBasicResource(key, definition as JSONSchema7, source);
        if (resource) {
          const resourceKey = resource.apiVersion ?
            `${resource.apiVersion}/${resource.kind}` :
            resource.kind;
          sourceMap.set(resourceKey, resource);
        }
      }
    }
  }


  /**
   * Check if a definition represents a Kubernetes resource (basic check)
   */
  private isKubernetesResourceBasic(definition: any): boolean {
    if (typeof definition !== 'object') return false;

    // Check for $ref or direct properties
    if (definition.$ref) {
      // For now, assume $ref definitions might be K8s resources
      // We'll validate this during dereferencing
      return true;
    }

    if (!definition.properties) return false;

    const props = definition.properties;
    return props.kind && props.apiVersion && props.metadata;
  }

  /**
   * Create basic resource info without full dereferencing
   */
  private createBasicResource(key: string, definition: JSONSchema7, source: SchemaSource): FlattenedResource | null {
    try {
      const kind = this.extractKindFromKey(key);
      const apiVersion = this.extractApiVersionFromKey(key);

      if (!kind) return null;

      // Parse group from apiVersion (same logic as CRD processing)
      const group = apiVersion && apiVersion.includes('/') 
        ? apiVersion.split('/')[0]
        : 'core';

      return {
        key,
        kind,
        apiVersion: apiVersion ?? undefined,
        group: group,
        properties: {},
        required: definition.required as string[],
        description: definition.description,
        source: source.id,
        originalKey: key // Store the original schema definition key
      };
    } catch (error) {
      console.warn(`Failed to create basic resource ${key}:`, error);
      return null;
    }
  }

  /**
 * Flatten a JSON schema definition into a structured format
 * Returns both flattened properties and required fields
 */
  private flattenSchema(definition: JSONSchema7): { properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Handle the schema properties
    if (definition.properties) {
      this.processSchemaProperties(definition.properties, properties, '', required);
    }

    // Add top-level required fields
    if (definition.required && Array.isArray(definition.required)) {
      required.push(...definition.required);
    }

    return {
      properties,
      required: [...new Set(required)] // Remove duplicates
    };
  }

  /**
   * Recursively process schema properties to build flattened structure
   */
  private processSchemaProperties(
    properties: Record<string, any>,
    result: Record<string, any>,
    prefix: string = '',
    required: string[] = []
  ): void {
    for (const [key, value] of Object.entries(properties)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object') {
        // Store the property with its metadata
        result[fullKey] = {
          type: value.type || 'object',
          description: value.description,
          format: value.format,
          enum: value.enum,
          items: value.items,
          properties: value.properties, // Preserve nested properties for modal
          required: value.required,
          hasChildren: !!(value.properties || (value.items && value.items.properties))
        };

        // If this property has nested properties, process them recursively
        if (value.properties) {
          this.processSchemaProperties(value.properties, result, fullKey, required);
        }

        // Handle array items with properties
        if (value.items && value.items.properties) {
          this.processSchemaProperties(value.items.properties, result, `${fullKey}.items`, required);
        }

        // Add required fields from this level
        if (value.required && Array.isArray(value.required)) {
          value.required.forEach((req: string) => {
            required.push(prefix ? `${prefix}.${req}` : req);
          });
        }
      }
    }
  }

  /**
   * Dereference a specific resource definition with full schema context
   */
  async dereferenceResource(sourceId: string, resourceKey: string): Promise<FlattenedResource | null> {
    const cacheKey = `${sourceId}:${resourceKey}`;

    // Check if already dereferenced
    if (this.dereferencedCache.has(cacheKey)) {
      const cached = this.dereferencedCache.get(cacheKey);
      if (cached) {
        return this.createDereferencedResource(resourceKey, cached, sourceId);
      }
    }

    const rawCache = this.rawSchemaCache.get(sourceId);
    if (!rawCache) return null;

    try {
      // Find the specific definition
      const definition = rawCache.schema.definitions?.[resourceKey];
      if (!definition) return null;

      // Create a wrapper schema with all definitions and a root reference
      const wrappedSchema = {
        definitions: {
          ...rawCache.schema.definitions,
          Root: definition // Wrap the target definition under a known name
        },
        $ref: "#/definitions/Root" // Reference the wrapped definition
      };

      const derefRoot = {
        $ref: `#/definitions/${resourceKey}`,
        definitions: rawCache.schema.definitions
      };

      if (!rawCache.schema.definitions?.["io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta"]) {
        console.error("FATAL: ObjectMeta missing from schema");
      }

      // Dereference with file path context for proper reference resolution
      const dereferencedWrapper = await $RefParser.dereference(derefRoot, {
        resolve: { file: true },
        path: rawCache.filePath
      }) as JSONSchema7;

      console.log("resourceKey", resourceKey);
      console.log("ref path", `#/definitions/${resourceKey}`);
      console.log("has definitions", "definitions" in rawCache.schema); // should be true
      console.log("raw definition keys", Object.keys(rawCache.schema.definitions || {}));

      // The resolved definition is now at the root level
      const dereferencedDef = dereferencedWrapper;

      // Cache the dereferenced definition
      this.dereferencedCache.set(cacheKey, dereferencedDef);
      rawCache.dereferencedPaths.add(resourceKey);
      rawCache.lastAccessed = Date.now();

      return this.createDereferencedResource(resourceKey, dereferencedDef, sourceId);
    } catch (error) {
      console.error(`Failed to dereference resource ${resourceKey}:`, error);
      return null;
    }
  }

  /**
   * Create fully dereferenced resource with flattened properties
   */
  private createDereferencedResource(key: string, definition: JSONSchema7, sourceId: string): FlattenedResource | null {
    try {
      const kind = this.extractKindFromKey(key);
      const apiVersion = this.extractApiVersionFromKey(key);

      if (!kind) return null;

      const flattened = this.flattenSchema(definition);

      return {
        key,
        kind,
        apiVersion: apiVersion ?? undefined,
        properties: flattened.properties,
        required: flattened.required,
        description: definition.description,
        source: sourceId,
        originalKey: key // Store the original schema definition key
      };
    } catch (error) {
      console.warn(`Failed to create dereferenced resource ${key}:`, error);
      return null;
    }
  }

  /**
   * NEW: Get raw schema for a resource (with $ref intact)
   */
  getRawResourceSchema(sourceId: string, resourceKey: string): JSONSchema7 | null {
    const rawCache = this.rawSchemaCache.get(sourceId);
    if (!rawCache) return null;

    const definition = rawCache.schema.definitions?.[resourceKey];
    return definition as JSONSchema7 || null;
  }


  /**
   * Load and process a specific schema source
   */
  private async loadSchemaSource(source: SchemaSource): Promise<void> {
    try {
      console.log(`Loading schema source: ${source.name}`);

      if (!this.fileExists(source.path)) {
        console.warn(`Schema file not found: ${source.path}`);
        return;
      }

      const schemaContent = await fs.readFile(source.path, 'utf8');
      const schema = JSON.parse(schemaContent) as JSONSchema7;

      // Dereference all $ref pointers
      const dereferencedSchema = await $RefParser.dereference(schema) as JSONSchema7;

      // Extract and store resources for this source
      this.extractResourcesForSource(dereferencedSchema, source);

      const sourceResources = this.resourcesBySource.get(source.id);
      console.log(`Loaded ${source.name}: ${sourceResources?.size || 0} resources`);
    } catch (error) {
      console.error(`Failed to load schema source ${source.name}:`, error);
    }
  }

  /**
   * Extract resources for a specific source
   */
  private extractResourcesForSource(schema: JSONSchema7, source: SchemaSource): void {
    if (!schema.definitions) return;

    const sourceMap = this.resourcesBySource.get(source.id);
    if (!sourceMap) return;

    for (const [key, definition] of Object.entries(schema.definitions)) {
      if (this.isKubernetesResource(definition)) {
        const resource = this.flattenResource(key, definition as JSONSchema7, source);
        if (resource) {
          const resourceKey = resource.apiVersion ?
            `${resource.apiVersion}/${resource.kind}` :
            resource.kind;
          sourceMap.set(resourceKey, resource);
        }
      }
    }
  }

  /**
   * Check if a definition represents a Kubernetes resource
   */
  private isKubernetesResource(definition: any): boolean {
    if (typeof definition !== 'object' || !definition.properties) return false;

    const props = definition.properties;
    return props.kind && props.apiVersion && props.metadata;
  }

  /**
   * Flatten a resource definition into a searchable format
   */
  private flattenResource(key: string, definition: JSONSchema7, source: SchemaSource): FlattenedResource | null {
    try {
      const props = definition.properties as Record<string, any>;

      const kind = this.extractKindFromKey(key);
      const apiVersion = this.extractApiVersionFromKey(key) as any;

      if (!kind) return null;

      return {
        key,
        kind,
        apiVersion,
        properties: this.flattenProperties(props),
        required: definition.required as string[],
        description: definition.description,
        source: source.id
      };
    } catch (error) {
      console.warn(`Failed to flatten resource ${key}:`, error);
      return null;
    }
  }

  /**
   * Recursively flatten properties for easier searching
   */
  private flattenProperties(properties: Record<string, any>, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object') {
        if (value.properties) {
          Object.assign(flattened, this.flattenProperties(value.properties, fullKey));
        }

        flattened[fullKey] = {
          type: value.type,
          description: value.description,
          format: value.format,
          enum: value.enum,
          items: value.items,
          properties: value.properties // Preserve properties for modal
        };
      }
    }

    return flattened;
  }

  /**
   * Extract kind from schema key
   */
  private extractKindFromKey(key: string): string | null {
    const parts = key.split('.');
    return parts[parts.length - 1] || null;
  }

  /**
   * Extract API version from schema key
   */
  private extractApiVersionFromKey(key: string): string | undefined {
    const match = key.match(/\.([^.]+)\.([^.]+)$/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return 'v1';
  }

  /**
   * Search resources within a specific schema source
   */
  searchInSource(sourceId: string, query: string): FlattenedResource[] {
    if (!this.isInitialized) return [];

    const sourceMap = this.resourcesBySource.get(sourceId);
    if (!sourceMap) return [];

    const lowerQuery = query.toLowerCase();
    const results: FlattenedResource[] = [];

    for (const resource of sourceMap.values()) {
      if (
        resource.kind.toLowerCase().includes(lowerQuery) ||
        (resource.apiVersion && resource.apiVersion.toLowerCase().includes(lowerQuery)) ||
        (resource.description && resource.description.toLowerCase().includes(lowerQuery))
      ) {
        results.push(resource);
      }
    }

    return results.sort((a, b) => a.kind.localeCompare(b.kind));
  }

  /**
   * Get all resources from a specific source
   */
  getResourcesFromSource(sourceId: string): FlattenedResource[] {
    if (!this.isInitialized) return [];

    const sourceMap = this.resourcesBySource.get(sourceId);
    if (!sourceMap) return [];

    return Array.from(sourceMap.values())
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }

  /**
   * Get all available schema sources
   */
  getAvailableSources(): SchemaSource[] {
    return Array.from(this.schemaSources.values());
  }

  /**
   * Get source statistics
   */
  getSourceStats(sourceId: string): { resourceCount: number; enabled: boolean } | null {
    const source = this.schemaSources.get(sourceId);
    const sourceMap = this.resourcesBySource.get(sourceId);

    if (!source) return null;

    return {
      resourceCount: sourceMap?.size || 0,
      enabled: source.enabled
    };
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Retrieves the schema tree for a specific CRD resource
   * @param group - The API group of the CRD
   * @param version - The API version of the CRD
   * @param kind - The kind of the CRD resource
   * @returns Promise resolving to schema tree nodes or null if not found
   */
  async getCRDSchemaTree(group: string, version: string, kind: string): Promise<SchemaTreeNode[] | null> {
    const cacheKey = `crd-${group}-${version}-${kind}`;

    console.log('Getting CRD schema tree:', { cacheKey, group, version, kind });

    const rawCache = this.rawSchemaCache.get(cacheKey);
    if (!rawCache) {
      console.warn(`No CRD cache found for: ${cacheKey}`);
      return null;
    }

    const rawDefinitions = rawCache.schema.definitions || {};
    const resourceSchema = rawDefinitions[kind];

    if (!resourceSchema || typeof resourceSchema === 'boolean') {
      console.warn(`CRD schema not found for: ${kind}`);
      return null;
    }

    // Filter out boolean definitions and create a proper Record<string, JSONSchema7>
    const definitions: Record<string, JSONSchema7> = {};
    Object.entries(rawDefinitions).forEach(([key, value]) => {
      if (typeof value !== 'boolean') {
        definitions[key] = value;
      }
    });

    return this.buildSchemaTree(resourceSchema, definitions, kind, '', []);
  }
}

export const schemaService = new SchemaService();