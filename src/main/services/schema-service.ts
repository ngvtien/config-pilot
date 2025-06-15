import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import { JSONSchema7 } from 'json-schema';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FlattenedResource, SchemaSource, SchemaTreeNode } from '../../shared/types/schema';

// Update the RawSchemaCache interface to include the source path
interface RawSchemaCache {
  schema: JSONSchema7;
  dereferencedPaths: Set<string>;
  lastAccessed: number;
  filePath: string; // Add the source file path for $RefParser context
  source: string; // Add source property
}

class SchemaService {
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
   * Build a hierarchical tree of schema properties by following $ref inline
   * This replaces the complex dereferencing approach with a simpler recursive method
   */
  buildSchemaTree(
    schema: JSONSchema7,
    definitions: Record<string, JSONSchema7>,
    name: string = ""
  ): SchemaTreeNode[] {
    // Handle $ref by resolving inline
    if (schema.$ref) {
      const refKey = schema.$ref.replace("#/definitions/", "");
      const resolved = definitions[refKey];
      if (!resolved) {
        console.warn(`Unresolved reference: ${schema.$ref}`);
        return [{ name, type: "unresolved:$ref" }];
      }
      return this.buildSchemaTree(resolved, definitions, name);
    }

    // Handle object types with properties
    if (schema.type === "object" && schema.properties) {
      const children: SchemaTreeNode[] = [];
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const subTree = this.buildSchemaTree(propSchema as JSONSchema7, definitions, key);
        children.push(...subTree);
      }
      return [{ name, type: "object", children }];
    }

    // Handle array types
    if (schema.type === "array" && schema.items) {
      const items = this.buildSchemaTree(schema.items as JSONSchema7, definitions, "[]");
      return [{ name, type: "array", children: items }];
    }

    // Handle additionalProperties for dynamic object keys
    if (schema.type === "object" && schema.additionalProperties && typeof schema.additionalProperties === "object") {
      const additionalTree = this.buildSchemaTree(schema.additionalProperties as JSONSchema7, definitions, "*");
      return [{ name, type: "object", children: additionalTree }];
    }

    // Handle primitive types
    return [{ name, type: Array.isArray(schema.type) ? schema.type[0] : (schema.type || "unknown") }];
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

      return {
        kind,
        apiVersion: apiVersion ?? undefined,
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
}

export const schemaService = new SchemaService();