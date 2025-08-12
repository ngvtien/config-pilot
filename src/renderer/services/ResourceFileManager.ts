//import { ipcRenderer } from 'electron';

/**
 * Manages Kubernetes resource files in a structured format for Git integration
 */
export class ResourceFileManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Get the resource directory path for a product-component
   */
  getResourcePath(productName: string, componentName: string): string {
    return `${this.basePath}/products/${productName}/components/${componentName}/resources`;
  }

  /**
   * Save a Kubernetes resource YAML file
   */
  async saveResource(
    productName: string,
    componentName: string,
    resourceKind: string,
    yamlContent: string,
    resourceName?: string
  ): Promise<string> {
    const resourceDir = this.getResourcePath(productName, componentName);
    const fileName = resourceName 
      ? `${resourceName}.yaml` 
      : `${resourceKind.toLowerCase()}.yaml`;
    const filePath = `${resourceDir}/${fileName}`;

    // Ensure directory exists - use window.electronAPI
    await window.electronAPI.ensureDirectory(resourceDir);
    
    // Save the YAML file - use window.electronAPI
    await window.electronAPI.writeFile(filePath, yamlContent);
    
    // Update the resource index
    await this.updateResourceIndex(productName, componentName);
    
    return filePath;
  }

  /**
   * Load a resource YAML file
   */
  async loadResource(
    productName: string,
    componentName: string,
    fileName: string
  ): Promise<string> {
    const resourceDir = this.getResourcePath(productName, componentName);
    const filePath = `${resourceDir}/${fileName}`;
    
    // Use correct IPC channel
    return await ipcRenderer.invoke('file:read', filePath);
  }

  /**
   * List all resources for a component
   */
  async listResources(
    productName: string,
    componentName: string
  ): Promise<Array<{ name: string; kind: string; path: string }>> {
    const resourceDir = this.getResourcePath(productName, componentName);
    
    try {
      const files = await ipcRenderer.invoke('file:listFiles', resourceDir, '*.yaml');
      const resources = [];
      
      for (const file of files) {
        const content = await this.loadResource(productName, componentName, file);
        const parsed = yaml.load(content) as any;
        resources.push({
          name: file,
          kind: parsed.kind || 'Unknown',
          path: `${resourceDir}/${file}`
        });
      }
      
      return resources;
    } catch (error) {
      return [];
    }
  }

  /**
   * Update the resource index file for tracking
   */
  private async updateResourceIndex(
    productName: string,
    componentName: string
  ): Promise<void> {
    const resources = await this.listResources(productName, componentName);
    const indexPath = `${this.getResourcePath(productName, componentName)}/index.json`;
    
    const index = {
      productName,
      componentName,
      resources: resources.map(r => ({
        name: r.name,
        kind: r.kind,
        lastModified: new Date().toISOString()
      })),
      lastUpdated: new Date().toISOString()
    };
    
    // Use correct IPC channel
    await ipcRenderer.invoke('fs:writeFile', indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Delete a resource file
   */
  async deleteResource(
    productName: string,
    componentName: string,
    fileName: string
  ): Promise<void> {
    const resourceDir = this.getResourcePath(productName, componentName);
    const filePath = `${resourceDir}/${fileName}`;
    
    // Use the file delete handler we need to add
    await ipcRenderer.invoke('fs:deleteFile', filePath);
    await this.updateResourceIndex(productName, componentName);
  }
}