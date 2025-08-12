import { ContextData } from '@/shared/types/context-data';
import { SettingsData } from '@/shared/types/settings';
import * as yaml from 'js-yaml';

export interface ResourceFile {
  kind: string;
  apiVersion: string;
  name: string;
  yamlContent: string;
  filePath: string;
}

/**
 * Manages resource files and folder structure for product-components
 */
export class ResourceFileManager {
  constructor(
    private settings: SettingsData,
    private context: ContextData
  ) {}

  /**
   * Get the base directory for a product-component
   */
  private getComponentResourceDir(productName: string, componentName: string): string {
    return window.electronAPI.path.join(
      this.settings.baseDirectory,
      'products',
      productName,
      'components',
      componentName,
      'resources'
    );
  }

  /**
   * Save a resource file to the appropriate directory
   */
  async saveResource(
    productName: string,
    componentName: string,
    resource: ResourceFile
  ): Promise<string> {
    const resourceDir = this.getComponentResourceDir(productName, componentName);
    
    // Create directory structure
    await window.electronAPI.fs.ensureDir(resourceDir);
    
    // Generate filename
    const filename = `${resource.name}.yaml`;
    const filePath = window.electronAPI.path.join(resourceDir, filename);
    
    // Write YAML content
    await window.electronAPI.fs.writeFile(filePath, resource.yamlContent, 'utf8');
    
    return filePath;
  }

  /**
   * Generate values.yaml for the component
   */
  async generateValuesYaml(
    productName: string,
    componentName: string,
    resources: ResourceFile[]
  ): Promise<string> {
    const valuesData: any = {
      global: {
        product: productName,
        component: componentName,
        environment: this.context.environment
      }
    };

    // Extract configurable values from resources
    resources.forEach(resource => {
      const resourceKey = resource.kind.toLowerCase();
      valuesData[resourceKey] = {
        enabled: true,
        name: resource.name,
        // Extract common configurable fields
        replicas: 1,
        image: {
          repository: 'nginx',
          tag: 'latest',
          pullPolicy: 'IfNotPresent'
        }
      };
    });

    const valuesYaml = yaml.dump(valuesData, { indent: 2 });
    const valuesPath = window.electronAPI.path.join(
      this.getComponentResourceDir(productName, componentName),
      'values.yaml'
    );
    
    await window.electronAPI.fs.writeFile(valuesPath, valuesYaml, 'utf8');
    return valuesPath;
  }

  /**
   * Generate values.schema.json for validation
   */
  async generateValuesSchema(
    productName: string,
    componentName: string,
    resources: ResourceFile[]
  ): Promise<string> {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: `${componentName} Configuration Schema`,
      properties: {
        global: {
          type: 'object',
          properties: {
            product: { type: 'string', default: productName },
            component: { type: 'string', default: componentName },
            environment: { type: 'string', default: this.context.environment }
          }
        }
      }
    };

    // Add schema for each resource type
    resources.forEach(resource => {
      const resourceKey = resource.kind.toLowerCase();
      schema.properties[resourceKey] = {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          name: { type: 'string', default: resource.name },
          replicas: { type: 'integer', minimum: 1, default: 1 },
          image: {
            type: 'object',
            properties: {
              repository: { type: 'string', default: 'nginx' },
              tag: { type: 'string', default: 'latest' },
              pullPolicy: { type: 'string', enum: ['Always', 'IfNotPresent', 'Never'], default: 'IfNotPresent' }
            }
          }
        }
      };
    });

    const schemaPath = window.electronAPI.path.join(
      this.getComponentResourceDir(productName, componentName),
      'values.schema.json'
    );
    
    await window.electronAPI.fs.writeFile(
      schemaPath, 
      JSON.stringify(schema, null, 2), 
      'utf8'
    );
    return schemaPath;
  }

  /**
   * Load existing resources for a component
   */
  async loadComponentResources(
    productName: string,
    componentName: string
  ): Promise<ResourceFile[]> {
    const resourceDir = this.getComponentResourceDir(productName, componentName);
    
    try {
      const files = await window.electronAPI.fs.readdir(resourceDir);
      const yamlFiles = files.filter(file => file.endsWith('.yaml') && file !== 'values.yaml');
      
      const resources: ResourceFile[] = [];
      
      for (const file of yamlFiles) {
        const filePath = window.electronAPI.path.join(resourceDir, file);
        const content = await window.electronAPI.fs.readFile(filePath, 'utf8');
        
        try {
          const parsed = yaml.load(content) as any;
          resources.push({
            kind: parsed.kind,
            apiVersion: parsed.apiVersion,
            name: parsed.metadata?.name || file.replace('.yaml', ''),
            yamlContent: content,
            filePath
          });
        } catch (parseError) {
          console.warn(`Failed to parse YAML file ${file}:`, parseError);
        }
      }
      
      return resources;
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }
  }
}