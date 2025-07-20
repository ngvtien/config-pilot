import * as yaml from 'js-yaml';
import * as path from 'path';
import { templateService } from './services/template-service';
import type { EnhancedTemplate, EnhancedTemplateResource, TemplateCategory } from '../shared/types/enhanced-template';
import type { ContextData } from '../shared/types/context-data';

/**
 * Interface for manual template generation options
 */
export interface ManualTemplateOptions {
  templateName: string;
  namespace: string;
  values: Record<string, any>;
}

/**
 * Interface for manual template generation result
 */
export interface ManualTemplateResult {
  success: boolean;
  outputPath?: string;
  generatedFiles?: {
    path: string;
    type: 'helm-chart' | 'kustomize' | 'yaml-manifest' | 'terraform';
    content?: string;
  }[];
  errors?: string[];
}

/**
 * Generates Helm and/or Kustomize files from manual YAML template content
 * @param yamlContent - Raw YAML content from manual template file
 * @param format - Output format: 'helm', 'kustomize', or 'both'
 * @param options - Generation options including template name, namespace, and values
 * @returns Promise<ManualTemplateResult> - Generation result with success status and file paths
 */
export async function generateFromManualTemplate(
  yamlContent: string,
  format: 'helm' | 'kustomize' | 'both',
  options: ManualTemplateOptions
): Promise<ManualTemplateResult> {
  try {
    // Parse YAML content into Kubernetes resources
    const resources = parseYamlContent(yamlContent);
    
    if (resources.length === 0) {
      return {
        success: false,
        errors: ['No valid Kubernetes resources found in YAML content']
      };
    }

    // Convert to EnhancedTemplate format
    const enhancedTemplate = convertToEnhancedTemplate(resources, options);
    
    // Validate the template
    const validationResult = await templateService.validateTemplate(enhancedTemplate);
    if (!validationResult.valid) {
      return {
        success: false,
        errors: validationResult.errors?.map(e => e.message) || ['Template validation failed']
      };
    }

    // Generate output based on format
    const results: ManualTemplateResult[] = [];
    
    if (format === 'helm' || format === 'both') {
      const helmResult = await generateHelmFromTemplate(enhancedTemplate, options);
      results.push(helmResult);
    }
    
    if (format === 'kustomize' || format === 'both') {
      const kustomizeResult = await generateKustomizeFromTemplate(enhancedTemplate, options);
      results.push(kustomizeResult);
    }

    // Combine results
    const allErrors = results.flatMap(r => r.errors || []);
    const allFiles = results.flatMap(r => r.generatedFiles || []);
    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      outputPath: results[0]?.outputPath,
      generatedFiles: allFiles,
      errors: allErrors.length > 0 ? allErrors : undefined
    };

  } catch (error) {
    console.error('Error generating from manual template:', error);
    return {
      success: false,
      errors: [`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Parses YAML content into array of Kubernetes resources
 * @param yamlContent - Raw YAML content
 * @returns Array of parsed Kubernetes resources
 */
function parseYamlContent(yamlContent: string): any[] {
  try {
    const documents = yaml.loadAll(yamlContent);
    return documents.filter((doc: any) => 
      doc && 
      typeof doc === 'object' && 
      'apiVersion' in doc && 
      'kind' in doc
    );
  } catch (error) {
    console.error('Error parsing YAML content:', error);
    return [];
  }
}

/**
 * Converts Kubernetes resources to EnhancedTemplate format
 * @param resources - Array of Kubernetes resources
 * @param options - Template generation options
 * @returns EnhancedTemplate object
 */
function convertToEnhancedTemplate(
  resources: any[], 
  options: ManualTemplateOptions
): EnhancedTemplate {
  const enhancedResources: EnhancedTemplateResource[] = resources.map((resource, index) => ({
    id: `resource-${index}`,
    kind: resource.kind,
    apiVersion: resource.apiVersion,
    namespace: resource.metadata?.namespace || options.namespace,
    selectedFields: [], // Empty for manual templates
    templateType: 'kubernetes' as const,
    source: 'custom' as const
  }));

  const category: TemplateCategory = {
    id: 'manual',
    name: 'Manual',
    description: 'Manually created templates'
  };

  return {
    id: `manual-${Date.now()}`,
    name: options.templateName,
    version: '1.0.0',
    description: `Manual template generated from YAML content`,
    category,
    resources: enhancedResources,
    metadata: {
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedBy: 'manual-generator'
    }
  };
}

/**
 * Generates Helm chart from EnhancedTemplate
 * @param template - EnhancedTemplate object
 * @param options - Generation options
 * @returns Promise<ManualTemplateResult> - Helm generation result
 */
async function generateHelmFromTemplate(
  template: EnhancedTemplate, 
  options: ManualTemplateOptions
): Promise<ManualTemplateResult> {
  try {
    const outputPath = path.join(process.cwd(), 'output', 'helm', options.templateName);
    
    // Create proper ContextData object
    const context: ContextData = {
      environment: 'dev',
      instance: 1,
      product: 'manual',
      customer: 'default',
      version: '1.0.0',
      baseHostUrl: 'localhost'
    };

    const result = await templateService.generateTemplate(
      template.id,
      context,
      outputPath,
      'helm'
    );

    return {
      success: result.success,
      outputPath,
      generatedFiles: result.generatedFiles || [],
      errors: result.errors
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Helm generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Generates Kustomize manifests from EnhancedTemplate
 * @param template - EnhancedTemplate object
 * @param options - Generation options
 * @returns Promise<ManualTemplateResult> - Kustomize generation result
 */
async function generateKustomizeFromTemplate(
  template: EnhancedTemplate, 
  options: ManualTemplateOptions
): Promise<ManualTemplateResult> {
  try {
    const outputPath = path.join(process.cwd(), 'output', 'kustomize', options.templateName);
    
    // Create proper ContextData object
    const context: ContextData = {
      environment: 'dev',
      instance: 1,
      product: 'manual',
      customer: 'default',
      version: '1.0.0',
      baseHostUrl: 'localhost'
    };

    const result = await templateService.generateTemplate(
      template.id,
      context,
      outputPath,
      'kustomize'
    );

    return {
      success: result.success,
      outputPath,
      generatedFiles: result.generatedFiles || [],
      errors: result.errors
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Kustomize generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}