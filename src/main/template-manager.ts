import { templateService } from './services/template-service'
import type {
  EnhancedTemplate,
  TemplateGenerationResult,
  TemplateValidationResult,
  TemplateCollection
} from '../shared/types/enhanced-template'
import type { ContextData } from '../shared/types/context-data'
import type { ProjectConfig } from '../shared/types/project'

/**
 * Template manager for high-level template operations
 * Integrates with project management and provides business logic
 */
export class TemplateManager {
  private initialized = false

  /**
   * Initialize the template manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await templateService.initialize()
      this.initialized = true
      console.log('✅ Template manager initialized')
    } catch (error) {
      console.error('❌ Failed to initialize template manager:', error)
      throw error
    }
  }

  /**
   * Create a new template from the template designer
   */
  async createTemplateFromDesigner(
    templateData: {
      name: string
      description?: string
      resources: any[]
      category?: string
      tags?: string[]
    }
  ): Promise<EnhancedTemplate> {
    // Convert designer data to enhanced template format
    const enhancedTemplate = this.convertDesignerDataToTemplate(templateData)

    return await templateService.createTemplate(enhancedTemplate)
  }

  /**
   * Generate template for a specific project context
   */
  async generateTemplateForProject(
    templateId: string,
    project: ProjectConfig,
    context: ContextData,
    outputFormat: 'helm' | 'kustomize' | 'raw-yaml' = 'helm'
  ): Promise<TemplateGenerationResult> {
    // Ensure template manager is initialized
    await this.initialize()

    // Generate output path based on project structure
    const outputPath = this.generateProjectOutputPath(project, templateId, outputFormat)

    return await templateService.generateTemplate(templateId, context, outputPath, outputFormat)
  }

  /**
   * Get templates compatible with project requirements
   */
  async getCompatibleTemplates(project: ProjectConfig): Promise<EnhancedTemplate[]> {
    const allTemplates = await templateService.getTemplates()

    // Filter templates based on project requirements
    return allTemplates.filter(template => {
      // Check Kubernetes version compatibility
      if (project.kubernetes?.clusters && template.metadata.compatibility?.kubernetesVersions) {
        // Add compatibility logic here
      }

      // Check Helm compatibility
      if (project.helm && template.metadata.compatibility?.helmVersions) {
        // Add Helm version compatibility logic here
      }

      return true // For now, return all templates
    })
  }

  /**
   * Validate template against project context
   */
  async validateTemplateForProject(
    templateId: string,
    project: ProjectConfig,
    context: ContextData
  ): Promise<TemplateValidationResult> {
    const template = await templateService.loadTemplate(templateId)
    if (!template) {
      return {
        valid: false,
        errors: [{ field: 'template', message: 'Template not found', severity: 'error' }]
      }
    }

    // Validate template structure
    const templateValidation = await templateService.validateTemplate(template)
    if (!templateValidation.valid) {
      return templateValidation
    }

    // Additional project-specific validation
    const errors: { field: string; message: string; severity: 'error' | 'warning' | 'info' }[] = []

    // Check if template requires contexts that project doesn't support
    if (template.requiredContext?.environments) {
      // Add environment validation logic
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Import template and add to project
   */
  async importTemplateToProject(
    importPath: string,
    project: ProjectConfig
  ): Promise<{ template: EnhancedTemplate; addedToProject: boolean }> {
    const template = await templateService.importTemplate(importPath)

    // Optionally add template reference to project
    const addedToProject = this.addTemplateToProject(template, project)

    return { template, addedToProject }
  }

  /**
   * Get template usage statistics for a project
   */
  async getTemplateUsageStats(project: ProjectConfig): Promise<{
    totalTemplates: number
    usedTemplates: number
    favoriteTemplates: string[]
    recentlyUsed: string[]
  }> {
    const allTemplates = await templateService.getTemplates()

    // This would track template usage in project metadata
    return {
      totalTemplates: allTemplates.length,
      usedTemplates: 0, // Would be tracked in project metadata
      favoriteTemplates: [], // Would be stored in project preferences
      recentlyUsed: [] // Would be tracked in project metadata
    }
  }

  // Update convertDesignerDataToTemplate method around line 164
  private convertDesignerDataToTemplate(templateData: any): Omit<EnhancedTemplate, 'id' | 'metadata'> {
    return {
      name: templateData.name,
      description: templateData.description,
      version: templateData.version || '1.0.0',
      resources: (templateData.resources || []).map((resource: any) => ({
        id: resource.id || `${resource.kind.toLowerCase()}-${Date.now()}`,
        kind: resource.kind,
        apiVersion: resource.apiVersion,
        namespace: resource.namespace,
        selectedFields: resource.selectedFields || [],
        templateType: resource.templateType || 'kubernetes',
        source: resource.source || 'kubernetes'
      })),
      tags: templateData.tags || [],
      generationSettings: templateData.generationSettings || {
        outputFormats: ['helm', 'kustomize', 'raw-yaml'],
        defaultFormat: 'helm'
      }
    }
  }
  private generateProjectOutputPath(
    project: ProjectConfig,
    templateId: string,
    format: string
  ): string {
    // Generate output path based on project structure
    // This would integrate with the project's base directory
    return `/path/to/project/generated/${templateId}-${format}`
  }

  private addTemplateToProject(template: EnhancedTemplate, project: ProjectConfig): boolean {
    // Logic to add template reference to project
    // This would modify the project's template references
    return true
  }
}

// Export singleton instance
export const templateManager = new TemplateManager()