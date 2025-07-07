import type { ContextData, ContextMetadata } from './context-data'
import type { GitRepository } from './git-repository'

/**
 * Enhanced template field with validation and UI hints
 */
export interface EnhancedTemplateField {
  path: string // Field path (e.g., "spec.containers[].image")
  title: string // Human-readable field name
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'integer'
  required: boolean // Whether field is required
  description?: string // Field description for tooltips/help
  format?: string // Format hint (e.g., "email", "uri", "date-time")
  
  // Enhanced validation constraints
  constraints?: {
    minimum?: number
    maximum?: number
    pattern?: string
    enum?: string[]
    minLength?: number
    maxLength?: number
    minItems?: number
    maxItems?: number
  }
  
  // UI rendering hints
  uiHints?: {
    widget?: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'password' | 'email' | 'url'
    placeholder?: string
    helpText?: string
    group?: string // For grouping fields in UI
    order?: number // For field ordering
  }
  
  // Default values and examples
  default?: any
  examples?: any[]
  
  // Context-aware field (can reference context variables)
  contextAware?: boolean
  contextPath?: string // Path to context variable (e.g., "environment", "customer")
  
  // Template-specific metadata
  templateType: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' | 'helm' | 'docker-compose'
  metadata?: Record<string, any>
}

/**
 * Enhanced template resource with multi-format support
 */
export interface EnhancedTemplateResource {
  id: string // Unique identifier for this resource
  kind: string
  apiVersion: string
  namespace?: string
  selectedFields: EnhancedTemplateField[]
  templateType: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' | 'helm' | 'docker-compose'
  source?: 'kubernetes' | 'cluster-crds' | 'custom'
  
  // Resource-level configuration
  resourceConfig?: {
    generateNamespace?: boolean
    generateLabels?: boolean
    generateAnnotations?: boolean
    customLabels?: Record<string, string>
    customAnnotations?: Record<string, string>
  }
  
  // Format-specific configurations
  formatSpecific?: {
    terraform?: {
      provider?: string
      resource?: string
      module?: string
    }
    ansible?: {
      module?: string
      collection?: string
      playbook?: string
    }
    kustomize?: {
      patchType?: 'strategic' | 'merge' | 'json'
      patchTarget?: string
    }
    helm?: {
      chart?: string
      version?: string
      repository?: string
    }
  }
  
  // Validation and dependencies
  dependencies?: string[] // IDs of other resources this depends on
  validationRules?: {
    customRules?: string[] // Custom validation expressions
    requiredContext?: string[] // Required context fields
  }
}

/**
 * Template category for organization
 */
export interface TemplateCategory {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
}

/**
 * Enhanced template with comprehensive metadata
 */
export interface EnhancedTemplate {
  // Basic information
  id: string
  name: string
  description?: string
  version: string
  
  // Categorization and tagging
  category?: TemplateCategory
  tags?: string[]
  
  // Template content
  resources: EnhancedTemplateResource[]
  
  // Context requirements
  requiredContext?: {
    environments?: string[] // Required environment types
    products?: string[] // Compatible product types
    minimumFields?: string[] // Minimum required context fields
  }
  
  // Template metadata
  metadata: ContextMetadata & {
    author?: string
    license?: string
    homepage?: string
    repository?: GitRepository
    keywords?: string[]
    compatibility?: {
      kubernetesVersions?: string[]
      helmVersions?: string[]
      platforms?: string[]
    }
  }
  
  // Generation settings
  generationSettings?: {
    outputFormats?: ('helm' | 'kustomize' | 'raw-yaml' | 'terraform')[]
    defaultFormat?: 'helm' | 'kustomize' | 'raw-yaml' | 'terraform'
    helmSettings?: {
      chartVersion?: string
      appVersion?: string
      generateTests?: boolean
      generateNotes?: boolean
    }
    kustomizeSettings?: {
      generateKustomization?: boolean
      patchStrategy?: 'strategic' | 'merge' | 'json'
    }
  }
  
  // Validation schema
  validationSchema?: any // JSON Schema for template validation
  
  // Template preferences
  preferences?: {
    autoSave?: boolean
    generatePreview?: boolean
    validateOnSave?: boolean
  }
}

/**
 * .cpt file format structure
 */
export interface CPTTemplateFile {
  // File format metadata
  fileFormat: {
    version: '1.0.0'
    type: 'config-pilot-template'
    generator: 'config-pilot'
    generatedAt: string
  }
  
  // Complete template configuration
  template: EnhancedTemplate
  
  // File integrity
  checksum?: string
  
  // Export metadata
  exportMetadata?: {
    exportedBy?: string
    exportedAt: string
    exportSettings?: {
      includeExamples?: boolean
      includeDocumentation?: boolean
      minifyOutput?: boolean
    }
  }
}

/**
 * Template collection for managing multiple templates
 */
export interface TemplateCollection {
  id: string
  name: string
  description?: string
  templates: string[] // Template IDs
  metadata: ContextMetadata
  
  // Collection settings
  settings?: {
    autoUpdate?: boolean
    syncWithRepository?: boolean
    repository?: GitRepository
  }
}

/**
 * Template generation result
 */
export interface TemplateGenerationResult {
  success: boolean
  outputPath?: string
  generatedFiles?: {
    path: string
    type: 'helm-chart' | 'kustomize' | 'yaml-manifest' | 'terraform'
    content?: string
  }[]
  errors?: string[]
  warnings?: string[]
  metadata?: {
    templateId: string
    templateVersion: string
    generatedAt: string
    context: ContextData
  }
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  valid: boolean
  errors?: {
    field: string
    message: string
    severity: 'error' | 'warning' | 'info'
  }[]
  warnings?: string[]
  suggestions?: string[]
}