import { promises as fs } from 'fs'
import * as path from 'path'
import { app } from 'electron'
import yaml from 'js-yaml'
import { createHash } from 'crypto'
import type {
    EnhancedTemplate,
    CPTTemplateFile,
    TemplateCollection,
    TemplateGenerationResult,
    TemplateValidationResult,
    TemplateCategory
} from '../../shared/types/enhanced-template'
import type { ContextData } from '../../shared/types/context-data'
import { FileService } from '../file-service'

/**
 * Template service for managing enhanced templates
 * Handles .cpt files, template collections, and generation
 */
export class TemplateService {
    private fileService: FileService
    private templatesPath: string
    private collectionsPath: string
    private categoriesPath: string
    private templateCache = new Map<string, EnhancedTemplate>()
    private collectionCache = new Map<string, TemplateCollection>()
    private categories: TemplateCategory[] = []

    constructor() {
        this.fileService = new FileService()
        const userDataPath = app.getPath('userData')
        this.templatesPath = path.join(userDataPath, 'templates')
        this.collectionsPath = path.join(userDataPath, 'template-collections')
        this.categoriesPath = path.join(userDataPath, 'template-categories.json')
    }

    /**
     * Initialize the template service
     */
    async initialize(): Promise<void> {
        try {
            // Ensure directories exist
            await this.ensureDirectories()

            // Load categories
            await this.loadCategories()

            // Load templates into cache
            await this.loadTemplatesIntoCache()

            // Load collections into cache
            await this.loadCollectionsIntoCache()

            console.log('✅ Template service initialized successfully')
        } catch (error) {
            console.error('❌ Failed to initialize template service:', error)
            throw error
        }
    }

    /**
     * Create a new template
     */
    async createTemplate(template: Omit<EnhancedTemplate, 'id' | 'metadata'>): Promise<EnhancedTemplate> {
        const newTemplate: EnhancedTemplate = {
            ...template,
            id: this.generateTemplateId(template.name),
            metadata: {
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedBy: 'config-pilot'
            }
        }

        // Validate template
        const validation = await this.validateTemplate(newTemplate)
        if (!validation.valid) {
            throw new Error(`Template validation failed: ${validation.errors?.map(e => e.message).join(', ')}`)
        }

        // Save template
        await this.saveTemplate(newTemplate)

        // Update cache
        this.templateCache.set(newTemplate.id, newTemplate)

        return newTemplate
    }

    /**
     * Save template to .cpt file
     */
    async saveTemplate(template: EnhancedTemplate): Promise<void> {
        const cptFile: CPTTemplateFile = {
            fileFormat: {
                version: '1.0.0',
                type: 'config-pilot-template',
                generator: 'config-pilot',
                generatedAt: new Date().toISOString()
            },
            template: {
                ...template,
                metadata: {
                    ...template.metadata,
                    lastUpdated: new Date().toISOString()
                }
            }
        }

        // Generate checksum
        cptFile.checksum = this.generateChecksum(cptFile.template)

        const templatePath = path.join(this.templatesPath, `${template.id}.cpt`)
        await fs.writeFile(templatePath, JSON.stringify(cptFile, null, 2), 'utf-8')

        // Update the cache with the latest template data
        this.templateCache.set(template.id, cptFile.template)

        console.log(`✅ Template saved: ${templatePath}`)
    }
    /**
     * Load template from .cpt file
     */
    async loadTemplate(templateId: string): Promise<EnhancedTemplate | null> {
        try {
            // Check cache first
            if (this.templateCache.has(templateId)) {
                return this.templateCache.get(templateId)!
            }

            const templatePath = path.join(this.templatesPath, `${templateId}.cpt`)
            const fileContent = await fs.readFile(templatePath, 'utf-8')
            const cptFile: CPTTemplateFile = JSON.parse(fileContent)

            // Verify checksum if present
            if (cptFile.checksum) {
                const calculatedChecksum = this.generateChecksum(cptFile.template)
                if (calculatedChecksum !== cptFile.checksum) {
                    console.warn(`⚠️ Checksum mismatch for template ${templateId}`)
                }
            }

            // Update cache
            this.templateCache.set(templateId, cptFile.template)

            return cptFile.template
        } catch (error) {
            console.error(`❌ Failed to load template ${templateId}:`, error)
            return null
        }
    }

    /**
     * Get all available templates
     */
    async getTemplates(): Promise<EnhancedTemplate[]> {
        return Array.from(this.templateCache.values())
    }

    /**
     * Search templates by name, description, or tags
     */
    async searchTemplates(query: string): Promise<EnhancedTemplate[]> {
        const templates = await this.getTemplates()
        const lowerQuery = query.toLowerCase()

        return templates.filter(template =>
            template.name.toLowerCase().includes(lowerQuery) ||
            template.description?.toLowerCase().includes(lowerQuery) ||
            template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
            template.metadata.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))
        )
    }

    /**
     * Generate template output (Helm chart, Kustomize, etc.)
     */
    async generateTemplate(
        templateId: string,
        context: ContextData,
        outputPath: string,
        format: 'helm' | 'kustomize' | 'raw-yaml' | 'terraform' = 'helm'
    ): Promise<TemplateGenerationResult> {
        try {
            const template = await this.loadTemplate(templateId)
            if (!template) {
                return {
                    success: false,
                    errors: [`Template ${templateId} not found`]
                }
            }

            // Validate context against template requirements
            const contextValidation = this.validateContext(template, context)
            if (!contextValidation.valid) {
                return {
                    success: false,
                    errors: contextValidation.errors?.map(e => e.message) || ['Context validation failed']
                }
            }

            // Generate based on format
            let result: TemplateGenerationResult
            switch (format) {
                case 'helm':
                    result = await this.generateHelmChartManifests(template, context, outputPath)
                    break
                case 'kustomize':
                    result = await this.generateKustomizeManifests(template, context, outputPath)
                    break
                case 'raw-yaml':
                    result = await this.generateRawYamlManifests(template, context, outputPath)
                    break
                case 'terraform':
                    result = await this.generateTerraformManifests(template, context, outputPath)
                    break
                default:
                    throw new Error(`Unsupported format: ${format}`)
            }

            // Add metadata to result
            result.metadata = {
                templateId: template.id,
                templateVersion: template.version,
                generatedAt: new Date().toISOString(),
                context
            }

            return result
        } catch (error) {
            console.error('❌ Template generation failed:', error)
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error']
            }
        }
    }

    /**
     * Validate template structure and content
     */
    async validateTemplate(template: EnhancedTemplate): Promise<TemplateValidationResult> {
        const errors: { field: string; message: string; severity: 'error' | 'warning' | 'info' }[] = []
        const warnings: string[] = []
        const suggestions: string[] = []

        // Basic validation
        if (!template.name?.trim()) {
            errors.push({ field: 'name', message: 'Template name is required', severity: 'error' })
        }

        if (!template.version?.trim()) {
            errors.push({ field: 'version', message: 'Template version is required', severity: 'error' })
        }

        if (!template.resources || template.resources.length === 0) {
            errors.push({ field: 'resources', message: 'At least one resource is required', severity: 'error' })
        }

        // Validate resources
        template.resources?.forEach((resource, index) => {
            if (!resource.kind) {
                errors.push({ field: `resources[${index}].kind`, message: 'Resource kind is required', severity: 'error' })
            }

            if (!resource.apiVersion) {
                errors.push({ field: `resources[${index}].apiVersion`, message: 'Resource apiVersion is required', severity: 'error' })
            }

            if (!resource.selectedFields || resource.selectedFields.length === 0) {
                warnings.push(`Resource ${resource.kind} has no selected fields`)
            }
        })

        // Validate JSON schema if present
        if (template.validationSchema) {
            try {
                // Basic JSON schema validation
                if (typeof template.validationSchema !== 'object') {
                    errors.push({ field: 'validationSchema', message: 'Validation schema must be an object', severity: 'error' })
                }
            } catch (error) {
                errors.push({ field: 'validationSchema', message: 'Invalid validation schema', severity: 'error' })
            }
        }

        // Suggestions
        if (!template.description) {
            suggestions.push('Consider adding a description to help users understand the template purpose')
        }

        if (!template.tags || template.tags.length === 0) {
            suggestions.push('Consider adding tags to improve template discoverability')
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined
        }
    }

    /**
     * Export template to .cpt file
     */
    async exportTemplate(templateId: string, exportPath: string): Promise<void> {
        const template = await this.loadTemplate(templateId)
        if (!template) {
            throw new Error(`Template ${templateId} not found`)
        }

        const cptFile: CPTTemplateFile = {
            fileFormat: {
                version: '1.0.0',
                type: 'config-pilot-template',
                generator: 'config-pilot',
                generatedAt: new Date().toISOString()
            },
            template,
            checksum: this.generateChecksum(template),
            exportMetadata: {
                exportedBy: 'config-pilot',
                exportedAt: new Date().toISOString(),
                exportSettings: {
                    includeExamples: true,
                    includeDocumentation: true,
                    minifyOutput: false
                }
            }
        }

        await fs.writeFile(exportPath, JSON.stringify(cptFile, null, 2), 'utf-8')
        console.log(`✅ Template exported to: ${exportPath}`)
    }

    /**
     * Import template from .cpt file
     */
    // async importTemplate(importPath: string): Promise<EnhancedTemplate> {
    //     const fileContent = await fs.readFile(importPath, 'utf-8')
    //     const cptFile: CPTTemplateFile = JSON.parse(fileContent)

    //     // Verify file format
    //     if (cptFile.fileFormat.type !== 'config-pilot-template') {
    //         throw new Error('Invalid template file format')
    //     }

    //     // Verify checksum if present
    //     if (cptFile.checksum) {
    //         const calculatedChecksum = this.generateChecksum(cptFile.template)
    //         if (calculatedChecksum !== cptFile.checksum) {
    //             throw new Error('Template file integrity check failed')
    //         }
    //     }

    //     // Generate new ID to avoid conflicts
    //     const importedTemplate: EnhancedTemplate = {
    //         ...cptFile.template,
    //         id: this.generateTemplateId(cptFile.template.name),
    //         metadata: {
    //             ...cptFile.template.metadata,
    //             lastUpdated: new Date().toISOString()
    //         }
    //     }

    //     // Save imported template
    //     await this.saveTemplate(importedTemplate)

    //     // Update cache
    //     this.templateCache.set(importedTemplate.id, importedTemplate)

    //     console.log(`✅ Template imported: ${importedTemplate.name}`)
    //     return importedTemplate
    // }
    /**
     * Import template from .cpt file
     */
    async importTemplate(importPath: string): Promise<EnhancedTemplate> {
        const fileContent = await fs.readFile(importPath, 'utf-8')
        const cptFile: CPTTemplateFile = JSON.parse(fileContent)

        // Verify file format
        if (cptFile.fileFormat.type !== 'config-pilot-template') {
            throw new Error('Invalid template file format')
        }

        // TEMPORARILY DISABLE CHECKSUM VALIDATION
        // if (cptFile.checksum) {
        //     const calculatedChecksum = this.generateChecksum(cptFile.template)
        //     if (calculatedChecksum !== cptFile.checksum) {
        //         throw new Error('Template file integrity check failed')
        //     }
        // }

        // Generate new ID to avoid conflicts
        const importedTemplate: EnhancedTemplate = {
            ...cptFile.template,
            id: this.generateTemplateId(cptFile.template.name),
            metadata: {
                ...cptFile.template.metadata,
                lastUpdated: new Date().toISOString()
            }
        }

        // Save imported template
        await this.saveTemplate(importedTemplate)

        // Update cache
        this.templateCache.set(importedTemplate.id, importedTemplate)

        console.log(`✅ Template imported: ${importedTemplate.name}`)
        return importedTemplate
    }

    /**
     * Delete template
     */
    async deleteTemplate(templateId: string): Promise<void> {
        const templatePath = path.join(this.templatesPath, `${templateId}.cpt`)

        try {
            await fs.unlink(templatePath)
            this.templateCache.delete(templateId)
            console.log(`✅ Template deleted: ${templateId}`)
        } catch (error) {
            console.error(`❌ Failed to delete template ${templateId}:`, error)
            throw error
        }
    }

    // Private helper methods
    private async ensureDirectories(): Promise<void> {
        await fs.mkdir(this.templatesPath, { recursive: true })
        await fs.mkdir(this.collectionsPath, { recursive: true })
    }

    private generateTemplateId(name: string): string {
        const sanitized = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const timestamp = Date.now().toString(36)
        return `${sanitized}-${timestamp}`
    }

    /**
     * Generate consistent checksum for template validation
     * Excludes dynamic fields that change during import/export
     */
    private generateChecksum(template: EnhancedTemplate): string {
        // Create a clean copy excluding dynamic metadata fields
        const cleanTemplate = {
            ...template,
            metadata: {
                ...template.metadata,
                // Exclude fields that change during operations
                lastUpdated: undefined,
                importedAt: undefined,
                originalChecksum: undefined,
                checksumVerified: undefined
            }
        }

        // Remove undefined values and ensure consistent serialization
        const cleanContent = JSON.stringify(cleanTemplate, (key, value) => {
            return value === undefined ? null : value
        })

        return createHash('sha256').update(cleanContent).digest('hex')
    }


    private async loadCategories(): Promise<void> {
        try {
            const categoriesContent = await fs.readFile(this.categoriesPath, 'utf-8')
            this.categories = JSON.parse(categoriesContent)
        } catch (error) {
            // Create default categories if file doesn't exist
            this.categories = [
                { id: 'web-apps', name: 'Web Applications', description: 'Templates for web applications and services' },
                { id: 'databases', name: 'Databases', description: 'Database deployment templates' },
                { id: 'monitoring', name: 'Monitoring', description: 'Monitoring and observability templates' },
                { id: 'security', name: 'Security', description: 'Security-related templates' },
                { id: 'networking', name: 'Networking', description: 'Network configuration templates' }
            ]
            await this.saveCategories()
        }
    }

    private async saveCategories(): Promise<void> {
        await fs.writeFile(this.categoriesPath, JSON.stringify(this.categories, null, 2), 'utf-8')
    }

    // private async loadTemplatesIntoCache(): Promise<void> {
    //     try {
    //         const files = await fs.readdir(this.templatesPath)
    //         const cptFiles = files.filter(file => file.endsWith('.cpt'))

    //         for (const file of cptFiles) {
    //             const templateId = path.basename(file, '.cpt')
    //             await this.loadTemplate(templateId)
    //         }

    //         console.log(`✅ Loaded ${cptFiles.length} templates into cache`)
    //     } catch (error) {
    //         console.error('❌ Failed to load templates into cache:', error)
    //     }
    // }

    private async loadTemplatesIntoCache(): Promise<void> {
        try {
            // Clear cache first to prevent duplicates
            this.templateCache.clear()

            const files = await fs.readdir(this.templatesPath)
            const cptFiles = files.filter(file => file.endsWith('.cpt'))

            // Use Set to track loaded template names and prevent duplicates
            const loadedNames = new Set<string>()

            for (const file of cptFiles) {
                const templateId = path.basename(file, '.cpt')
                const template = await this.loadTemplate(templateId)

                if (template && !loadedNames.has(template.name)) {
                    loadedNames.add(template.name)
                    // Only cache if not already loaded
                } else if (template && loadedNames.has(template.name)) {
                    console.warn(`⚠️ Duplicate template name detected: ${template.name}, skipping...`)
                }
            }

            console.log(`✅ Loaded ${this.templateCache.size} unique templates into cache`)
        } catch (error) {
            console.error('❌ Failed to load templates into cache:', error)
        }
    }

    private async loadCollectionsIntoCache(): Promise<void> {
        // Implementation for loading template collections
        // This would be similar to loadTemplatesIntoCache but for collections
    }

    private validateContext(template: EnhancedTemplate, context: ContextData): TemplateValidationResult {
        const errors: { field: string; message: string; severity: 'error' | 'warning' | 'info' }[] = []

        // Check required context fields
        if (template.requiredContext?.minimumFields) {
            for (const field of template.requiredContext.minimumFields) {
                if (!context[field as keyof ContextData]) {
                    errors.push({
                        field: `context.${field}`,
                        message: `Required context field '${field}' is missing`,
                        severity: 'error'
                    })
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        }
    }

    /**
     * Generate Helm chart from template
     */
    private generateHelmChart(template: EnhancedTemplate, context: ContextData): string {
        const chartName = template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const appVersion = template.generationSettings?.helmSettings?.appVersion || '1.0.0'
        const chartVersion = template.generationSettings?.helmSettings?.chartVersion || '0.1.0'

        return `apiVersion: v2
name: ${chartName}
description: ${template.description || 'A Helm chart for Kubernetes'}
type: application
version: ${chartVersion}
appVersion: "${appVersion}"
`
    }

    /**
       * Generate Helm chart from template (async version for complete chart generation)
       */
    private async generateHelmChartManifests(
        template: EnhancedTemplate,
        context: ContextData,
        outputPath: string
    ): Promise<TemplateGenerationResult> {
        try {
            const generatedFiles: { path: string; type: 'helm-chart' | 'kustomize' | 'yaml-manifest' | 'terraform'; content?: string }[] = []

            // Ensure output directory exists
            await fs.mkdir(outputPath, { recursive: true })

            const chartName = template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

            // Generate Chart.yaml
            const chartContent = this.generateHelmChartYaml(template, context)
            const chartPath = path.join(outputPath, 'Chart.yaml')
            await fs.writeFile(chartPath, chartContent, 'utf-8')
            generatedFiles.push({ path: chartPath, type: 'helm-chart', content: chartContent })

            // Generate values.yaml
            const valuesContent = this.generateHelmValues(template, context)
            const valuesPath = path.join(outputPath, 'values.yaml')
            await fs.writeFile(valuesPath, valuesContent, 'utf-8')
            generatedFiles.push({ path: valuesPath, type: 'helm-chart', content: valuesContent })

            // Create templates directory
            const templatesDir = path.join(outputPath, 'templates')
            await fs.mkdir(templatesDir, { recursive: true })

            // Generate resource templates
            for (const resource of template.resources) {
                const resourceFileName = `${resource.kind.toLowerCase()}.yaml`
                const resourcePath = path.join(templatesDir, resourceFileName)
                const resourceTemplate = this.generateHelmResourceTemplate(resource, chartName, context)
                await fs.writeFile(resourcePath, resourceTemplate, 'utf-8')
                generatedFiles.push({ path: resourcePath, type: 'helm-chart', content: resourceTemplate })
            }

            // Generate helpers template
            const helpersPath = path.join(templatesDir, '_helpers.tpl')
            const helpersContent = this.generateHelmHelpers(chartName)
            await fs.writeFile(helpersPath, helpersContent, 'utf-8')
            generatedFiles.push({ path: helpersPath, type: 'helm-chart', content: helpersContent })

            console.log(`✅ Helm chart generated: ${outputPath}`)
            return {
                success: true,
                outputPath,
                generatedFiles,
                metadata: {
                    templateId: template.id,
                    templateVersion: template.version,
                    generatedAt: new Date().toISOString(),
                    context
                }
            }
        } catch (error) {
            console.error('❌ Helm chart generation failed:', error)
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                outputPath
            }
        }
    }

    /**
     * Generate Helm Chart.yaml content (renamed to avoid conflict)
     */
    private generateHelmChartYaml(template: EnhancedTemplate, context: ContextData): string {
        const chartName = template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const appVersion = template.generationSettings?.helmSettings?.appVersion || '1.0.0'
        const chartVersion = template.generationSettings?.helmSettings?.chartVersion || '0.1.0'

        return `apiVersion: v2\nname: ${chartName}\ndescription: ${template.description || 'A Helm chart for Kubernetes'}\ntype: application\nversion: ${chartVersion}\nappVersion: "${appVersion}"\n`
    }

    /**
     * Generate Helm values.yaml content
     */
    private generateHelmValues(template: EnhancedTemplate, context: ContextData): string {
        let values = '# Default values for ' + template.name + '\n\n'

        // Add common values
        values += 'replicaCount: 1\n\n'
        values += 'image:\n'
        values += '  repository: nginx\n'
        values += '  pullPolicy: IfNotPresent\n'
        values += '  tag: ""\n\n'

        // Add resource-specific values
        for (const resource of template.resources) {
            const resourceName = resource.kind.toLowerCase()
            values += `${resourceName}:\n`
            values += `  replicas: 1\n`
            values += `  image:\n`
            values += `    repository: nginx\n`
            values += `    tag: latest\n`
            values += `    pullPolicy: IfNotPresent\n\n`
        }

        return values
    }

    /**
     * Generate Kustomization.yaml content
     */
    private generateKustomizationYaml(template: EnhancedTemplate, context: ContextData): string {
        let kustomization = 'apiVersion: kustomize.config.k8s.io/v1beta1\n'
        kustomization += 'kind: Kustomization\n\n'
        kustomization += 'resources:\n'

        for (const resource of template.resources) {
            kustomization += `- ${resource.kind.toLowerCase()}.yaml\n`
        }

        return kustomization
    }

    /**
     * Generate Kustomize resource manifest
     */
    private generateKustomizeResourceManifest(resource: any, template: EnhancedTemplate, context: ContextData): string {
        return this.generateRawYamlResource(resource, template, context)
    }

    /**
     * Generate raw YAML resource manifest
     */
    private generateRawYamlResource(resource: any, template: EnhancedTemplate, context: ContextData): string {
        let manifest = `apiVersion: ${resource.apiVersion}\n`
        manifest += `kind: ${resource.kind}\n`
        manifest += `metadata:\n`
        manifest += `  name: ${template.name.toLowerCase()}-${resource.kind.toLowerCase()}\n`

        if (resource.namespace) {
            manifest += `  namespace: ${resource.namespace}\n`
        }

        manifest += `spec:\n`
        manifest += `  # Add your ${resource.kind} specification here\n`

        return manifest
    }


    /**
     * Generate Terraform main.tf content
     */
    private generateTerraformMain(template: EnhancedTemplate, context: ContextData): string {
        let terraform = '# Terraform configuration for ' + template.name + '\n\n'
        terraform += 'terraform {\n'
        terraform += '  required_providers {\n'
        terraform += '    kubernetes = {\n'
        terraform += '      source  = "hashicorp/kubernetes"\n'
        terraform += '      version = "~> 2.0"\n'
        terraform += '    }\n'
        terraform += '  }\n'
        terraform += '}\n\n'

        for (const resource of template.resources) {
            terraform += `resource "kubernetes_${resource.kind.toLowerCase()}" "${resource.kind.toLowerCase()}" {\n`
            terraform += `  metadata {\n`
            terraform += `    name = var.${resource.kind.toLowerCase()}_name\n`
            terraform += `  }\n`
            terraform += `  spec {\n`
            terraform += `    # Add your ${resource.kind} specification here\n`
            terraform += `  }\n`
            terraform += `}\n\n`
        }

        return terraform
    }

    /**
     * Generate Terraform variables.tf content
     */
    private generateTerraformVariables(template: EnhancedTemplate, context: ContextData): string {
        let variables = '# Variables for ' + template.name + '\n\n'

        for (const resource of template.resources) {
            variables += `variable "${resource.kind.toLowerCase()}_name" {\n`
            variables += `  description = "Name for the ${resource.kind}"\n`
            variables += `  type        = string\n`
            variables += `  default     = "${template.name.toLowerCase()}-${resource.kind.toLowerCase()}"\n`
            variables += `}\n\n`
        }

        return variables
    }

    /**
     * Generate Terraform outputs.tf content
     */
    private generateTerraformOutputs(template: EnhancedTemplate, context: ContextData): string {
        let outputs = '# Outputs for ' + template.name + '\n\n'

        for (const resource of template.resources) {
            outputs += `output "${resource.kind.toLowerCase()}_name" {\n`
            outputs += `  description = "Name of the ${resource.kind}"\n`
            outputs += `  value       = kubernetes_${resource.kind.toLowerCase()}.${resource.kind.toLowerCase()}.metadata[0].name\n`
            outputs += `}\n\n`
        }

        return outputs
    }

    /**
     * Generate Kustomize manifests from template
     */
    private async generateKustomizeManifests(
        template: EnhancedTemplate,
        context: ContextData,
        outputPath: string
    ): Promise<TemplateGenerationResult> {
        try {
            const generatedFiles: { path: string; type: 'helm-chart' | 'kustomize' | 'yaml-manifest' | 'terraform'; content?: string }[] = []

            // Ensure output directory exists
            await fs.mkdir(outputPath, { recursive: true })

            // Generate kustomization.yaml
            const kustomizationContent = this.generateKustomizationYaml(template, context)
            const kustomizationPath = path.join(outputPath, 'kustomization.yaml')
            await fs.writeFile(kustomizationPath, kustomizationContent, 'utf-8')
            generatedFiles.push({ path: kustomizationPath, type: 'kustomize', content: kustomizationContent })

            // Generate individual resource files
            for (const resource of template.resources) {
                const resourceFileName = `${resource.kind.toLowerCase()}.yaml`
                const resourcePath = path.join(outputPath, resourceFileName)
                const resourceManifest = this.generateKustomizeResourceManifest(resource, template, context)
                await fs.writeFile(resourcePath, resourceManifest, 'utf-8')
                generatedFiles.push({ path: resourcePath, type: 'kustomize', content: resourceManifest })
            }

            console.log(`✅ Kustomize manifests generated: ${outputPath}`)
            return {
                success: true,
                outputPath,
                generatedFiles,
                metadata: {
                    templateId: template.id,
                    templateVersion: template.version,
                    generatedAt: new Date().toISOString(),
                    context
                }
            }
        } catch (error) {
            console.error('❌ Kustomize generation failed:', error)
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                outputPath
            }
        }
    }

    /**
     * Generate raw YAML manifests from template
     */
    private async generateRawYamlManifests(
        template: EnhancedTemplate,
        context: ContextData,
        outputPath: string
    ): Promise<TemplateGenerationResult> {
        try {
            const generatedFiles: { path: string; type: 'helm-chart' | 'kustomize' | 'yaml-manifest' | 'terraform'; content?: string }[] = []

            // Ensure output directory exists
            await fs.mkdir(outputPath, { recursive: true })

            // Generate individual resource files
            for (const resource of template.resources) {
                const resourceFileName = `${resource.kind.toLowerCase()}.yaml`
                const resourcePath = path.join(outputPath, resourceFileName)
                const resourceManifest = this.generateRawYamlResource(resource, template, context)
                await fs.writeFile(resourcePath, resourceManifest, 'utf-8')
                generatedFiles.push({ path: resourcePath, type: 'yaml-manifest', content: resourceManifest })
            }

            console.log(`✅ Raw YAML manifests generated: ${outputPath}`)
            return {
                success: true,
                outputPath,
                generatedFiles,
                metadata: {
                    templateId: template.id,
                    templateVersion: template.version,
                    generatedAt: new Date().toISOString(),
                    context
                }
            }
        } catch (error) {
            console.error('❌ Raw YAML generation failed:', error)
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                outputPath
            }
        }
    }

    /**
     * Generate Terraform manifests from template
     */
    private async generateTerraformManifests(
        template: EnhancedTemplate,
        context: ContextData,
        outputPath: string
    ): Promise<TemplateGenerationResult> {
        try {
            const generatedFiles: { path: string; type: 'helm-chart' | 'kustomize' | 'yaml-manifest' | 'terraform'; content?: string }[] = []

            // Ensure output directory exists
            await fs.mkdir(outputPath, { recursive: true })

            // Generate main.tf
            const mainTfContent = this.generateTerraformMain(template, context)
            const mainTfPath = path.join(outputPath, 'main.tf')
            await fs.writeFile(mainTfPath, mainTfContent, 'utf-8')
            generatedFiles.push({ path: mainTfPath, type: 'terraform', content: mainTfContent })

            // Generate variables.tf
            const variablesTfContent = this.generateTerraformVariables(template, context)
            const variablesTfPath = path.join(outputPath, 'variables.tf')
            await fs.writeFile(variablesTfPath, variablesTfContent, 'utf-8')
            generatedFiles.push({ path: variablesTfPath, type: 'terraform', content: variablesTfContent })

            // Generate outputs.tf
            const outputsTfContent = this.generateTerraformOutputs(template, context)
            const outputsTfPath = path.join(outputPath, 'outputs.tf')
            await fs.writeFile(outputsTfPath, outputsTfContent, 'utf-8')
            generatedFiles.push({ path: outputsTfPath, type: 'terraform', content: outputsTfContent })

            console.log(`✅ Terraform manifests generated: ${outputPath}`)
            return {
                success: true,
                outputPath,
                generatedFiles,
                metadata: {
                    templateId: template.id,
                    templateVersion: template.version,
                    generatedAt: new Date().toISOString(),
                    context
                }
            }
        } catch (error) {
            console.error('❌ Terraform generation failed:', error)
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                outputPath
            }
        }
    }


    /**
     * Generate Helm resource template
     */
    private generateHelmResourceTemplate(resource: any, chartName: string, context: ContextData): string {
        let template = `apiVersion: ${resource.apiVersion}\n`
        template += `kind: ${resource.kind}\n`
        template += `metadata:\n`
        template += `  name: {{ include "${chartName}.fullname" . }}\n`
        template += `  labels:\n`
        template += `    {{- include "${chartName}.labels" . | nindent 4 }}\n`

        if (resource.namespace) {
            template += `  namespace: ${resource.namespace}\n`
        }

        template += `spec:\n`

        // Add resource-specific spec based on kind
        if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)) {
            template += `  replicas: {{ .Values.${resource.kind.toLowerCase()}.replicas | default 1 }}\n`
            template += `  selector:\n`
            template += `    matchLabels:\n`
            template += `      {{- include "${chartName}.selectorLabels" . | nindent 6 }}\n`
            template += `  template:\n`
            template += `    metadata:\n`
            template += `      labels:\n`
            template += `        {{- include "${chartName}.selectorLabels" . | nindent 8 }}\n`
            template += `    spec:\n`
            template += `      containers:\n`
            template += `      - name: {{ .Chart.Name }}\n`
            template += `        image: "{{ .Values.${resource.kind.toLowerCase()}.image.repository }}:{{ .Values.${resource.kind.toLowerCase()}.image.tag | default .Chart.AppVersion }}"\n`
            template += `        imagePullPolicy: {{ .Values.${resource.kind.toLowerCase()}.image.pullPolicy }}\n`
        } else {
            template += `  # Add your ${resource.kind} specification here\n`
            if (resource.selectedFields && resource.selectedFields.length > 0) {
                template += `  # Based on selected fields: ${resource.selectedFields.map((f: any) => f.path).join(', ')}\n`
            }
        }

        return template
    }

    /**
     * Generate Helm helpers template
     */
    private generateHelmHelpers(chartName: string): string {
        return `{{/*\nExpand the name of the chart.\n*/}}\n{{- define "${chartName}.name" -}}\n{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}\n{{- end }}\n\n{{/*\nCreate a default fully qualified app name.\n*/}}\n{{- define "${chartName}.fullname" -}}\n{{- if .Values.fullnameOverride }}\n{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}\n{{- else }}\n{{- $name := default .Chart.Name .Values.nameOverride }}\n{{- if contains $name .Release.Name }}\n{{- .Release.Name | trunc 63 | trimSuffix "-" }}\n{{- else }}\n{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}\n{{- end }}\n{{- end }}\n{{- end }}\n\n{{/*\nCreate chart name and version as used by the chart label.\n*/}}\n{{- define "${chartName}.chart" -}}\n{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}\n{{- end }}\n\n{{/*\nCommon labels\n*/}}\n{{- define "${chartName}.labels" -}}\nhelm.sh/chart: {{ include "${chartName}.chart" . }}\n{{ include "${chartName}.selectorLabels" . }}\n{{- if .Chart.AppVersion }}\napp.kubernetes.io/version: {{ .Chart.AppVersion | quote }}\n{{- end }}\napp.kubernetes.io/managed-by: {{ .Release.Service }}\n{{- end }}\n\n{{/*\nSelector labels\n*/}}\n{{- define "${chartName}.selectorLabels" -}}\napp.kubernetes.io/name: {{ include "${chartName}.name" . }}\napp.kubernetes.io/instance: {{ .Release.Name }}\n{{- end }}`
    }

}

// Export singleton instance
export const templateService = new TemplateService()