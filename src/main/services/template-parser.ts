import { TemplateMetadata } from '../../shared/types/template-metadata';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple template parser that reads and validates metadata.json files
 */
export class TemplateParser {
  /**
   * Load and parse a template metadata file
   * @param templatePath - Path to the template directory containing metadata.json
   * @returns Parsed template metadata
   */
  async loadTemplate(templatePath: string): Promise<TemplateMetadata> {
    const metadataPath = path.join(templatePath, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Template metadata not found: ${metadataPath}`);
    }

    try {
      const content = fs.readFileSync(metadataPath, 'utf-8');
      const metadata = JSON.parse(content) as TemplateMetadata;
      
      // Basic validation
      this.validateTemplate(metadata);
      
      return metadata;
    } catch (error) {
      throw new Error(`Failed to parse template metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Basic template validation
   * @param template - Template metadata to validate
   */
  private validateTemplate(template: TemplateMetadata): void {
    if (!template.metadata?.name) {
      throw new Error('Template metadata.name is required');
    }
    
    if (!template.metadata?.version) {
      throw new Error('Template metadata.version is required');
    }
    
    if (!template.resources || Object.keys(template.resources).length === 0) {
      throw new Error('Template must have at least one resource');
    }
  }
}