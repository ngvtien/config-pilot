import { TemplateParser } from './template-parser';
import { TemplateEngine } from './template-engine';
import { YamlGenerator } from './yaml-generator';
import { TemplateService } from './template-service';
import { FileService } from '../file-service';
import type { EnhancedTemplate } from '../../shared/types/enhanced-template';
import type { ContextData } from '../../shared/types/context-data';
import * as path from 'path';
import { promises as fs } from 'fs';

/**
 * Result of template generation process
 */
export interface TemplateGenerationResult {
  success: boolean;
  outputPath: string;
  generatedFiles: string[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Template generation options (project concerns removed)
 */
export interface TemplateGenerationOptions {
  format: 'yaml' | 'helm' | 'kustomize';
  outputPath: string;
  fileName?: string;
}

/**
 * Template import/export data structure
 */
export interface TemplateExportData {
  template: EnhancedTemplate;
  metadata: {
    exportedAt: string;
    exportedBy: string;
    version: string;
  };
  dependencies?: string[]; // Other template IDs this depends on
}

/**
 * Orchestrates template operations only - no project management
 * Focuses on template parsing, generation, import/export
 */
export class TemplateOrchestrator {
  private templateParser: TemplateParser;
  private templateEngine: TemplateEngine;
  private yamlGenerator: YamlGenerator;
  private fileService: FileService;

  constructor(
    private templateService: TemplateService
  ) {
    this.templateParser = new TemplateParser();
    this.templateEngine = new TemplateEngine();
    this.yamlGenerator = new YamlGenerator();
    this.fileService = new FileService();
  }

  /**
   * Generate Kubernetes resources or Helm charts from a template
   * Pure template operation - no project association
   */
  async generateFromTemplate(
    templateIdOrData: string | EnhancedTemplate,
    userParameters: Record<string, any>,
    options: TemplateGenerationOptions
  ): Promise<TemplateGenerationResult> {
    try {
      // 1. Load or use template
      const template = typeof templateIdOrData === 'string' 
        ? await this.templateService.loadTemplate(templateIdOrData)
        : templateIdOrData;

      if (!template) {
        return {
          success: false,
          outputPath: '',
          generatedFiles: [],
          errors: ['Template not found or invalid']
        };
      }

      // 2. Parse template metadata
      const parsedTemplate = this.convertToTemplateMetadata(template);
      
      // 3. Validate user parameters against template schema
      const validationResult = this.validateParameters(parsedTemplate, userParameters);
      if (!validationResult.valid) {
        return {
          success: false,
          outputPath: '',
          generatedFiles: [],
          errors: validationResult.errors
        };
      }

      // 4. Resolve template with user parameters
      const resolvedTemplate = await this.templateEngine.resolveTemplate(
        parsedTemplate,
        userParameters
      );

      // 5. Generate output based on format
      let generatedFiles: Map<string, string>;
      
      if (options.format === 'helm') {
        generatedFiles = this.yamlGenerator.generateHelmChart(resolvedTemplate);
      } else {
        generatedFiles = this.yamlGenerator.generateYaml(resolvedTemplate);
      }

      // 6. Write files to disk
      const fileList: string[] = [];
      for (const [filename, content] of generatedFiles) {
        const fullPath = path.join(options.outputPath, filename);
        //await this.fileService.writeFile(fullPath, content);
        await fs.writeFile(fullPath, content, 'utf-8');
        fileList.push(filename);
      }

      return {
        success: true,
        outputPath: options.outputPath,
        generatedFiles: fileList
      };

    } catch (error) {
      return {
        success: false,
        outputPath: '',
        generatedFiles: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  /**
   * Export template for sharing/backup
   * Pure template operation
   */
  async exportTemplate(
    templateId: string,
    includeParameters?: boolean
  ): Promise<TemplateExportData> {
    const template = await this.templateService.loadTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const exportData: TemplateExportData = {
      template: includeParameters ? template : {
        ...template,
        // Remove sensitive parameter values if needed
        resources: template.resources.map(resource => ({
          ...resource,
          selectedFields: resource.selectedFields.map(field => ({
            ...field,
            default: field.type === 'string' && field.name.toLowerCase().includes('password') 
              ? undefined 
              : field.default
          }))
        }))
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'config-pilot',
        version: '1.0.0'
      }
    };

    return exportData;
  }

  /**
   * Import template from export data
   * Returns the imported template - caller handles project association
   */
  async importTemplate(
    exportData: TemplateExportData,
    options: {
      overwriteExisting?: boolean;
      generateNewId?: boolean;
    } = {}
  ): Promise<EnhancedTemplate> {
    let template = exportData.template;
    
    // Handle ID conflicts
    if (options.generateNewId || await this.templateService.loadTemplate(template.id)) {
      template = {
        ...template,
        id: this.generateTemplateId(template.name),
        name: options.overwriteExisting ? template.name : `${template.name} (Imported)`
      };
    }

    // Save template and return it
    await this.templateService.saveTemplate(template);
    return template;
  }

  /**
   * Validate template parameters against schema
   */
  private validateParameters(
    template: any,
    userParameters: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required parameters
    for (const param of template.parameters || []) {
      if (param.required && !(param.name in userParameters)) {
        errors.push(`Required parameter '${param.name}' is missing`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert EnhancedTemplate to internal format
   */
  private convertToTemplateMetadata(template: EnhancedTemplate): any {
    return {
      metadata: template.metadata,
      parameters: template.resources.flatMap(resource => 
        resource.selectedFields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          default: field.default
        }))
      ),
      resources: template.resources
    };
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(name: string): string {
    const timestamp = Date.now();
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitizedName}-${timestamp}`;
  }

/**
 * Generate from metadata.json template directory
 * @param templatePath - Path to directory containing metadata.json
 * @param userParameters - User-provided parameter values
 * @param options - Generation options
 */
async generateFromMetadataTemplate(
  templatePath: string,
  userParameters: Record<string, any>,
  options: TemplateGenerationOptions
): Promise<TemplateGenerationResult> {
  try {
    // 1. Load template using TemplateParser
    const template = await this.templateParser.loadTemplate(templatePath);
    
    // 2. Validate parameters
    const validationResult = this.validateParameters(template, userParameters);
    if (!validationResult.valid) {
      return {
        success: false,
        outputPath: '',
        generatedFiles: [],
        errors: validationResult.errors
      };
    }

    // 3. Resolve template with parameters
    const resolvedTemplate = this.templateEngine.resolveTemplate(template, userParameters);

    // 4. Generate based on format
    let generatedFiles: Map<string, string>;
    
    if (options.format === 'helm') {
      generatedFiles = this.yamlGenerator.generateHelmChart(resolvedTemplate);
    } else if (options.format === 'kustomize') {
      generatedFiles = this.yamlGenerator.generateKustomize(resolvedTemplate); // Need to implement
    } else {
      generatedFiles = this.yamlGenerator.generateYaml(resolvedTemplate);
    }

    // 5. Write files
    const fileList: string[] = [];
    for (const [filename, content] of generatedFiles) {
      const fullPath = path.join(options.outputPath, filename);
      //await this.fileService.writeFile(fullPath, content);
      // Replace the error line with  
      await fs.writeFile(fullPath, content, 'utf-8');
      fileList.push(filename);
    }

    return {
      success: true,
      outputPath: options.outputPath,
      generatedFiles: fileList
    };
  } catch (error) {
    return {
      success: false,
      outputPath: '',
      generatedFiles: [],
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    };
  }
}  
}