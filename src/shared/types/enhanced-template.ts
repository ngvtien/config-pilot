import type { ContextData, ContextMetadata } from './context-data'
import type { GitRepository } from './git-repository'

/**
 * Enhanced template field with validation and UI hints
 */
export interface EnhancedTemplateField {
    name: string;
    type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    title?: string;
    description?: string;
    required?: boolean;
    default?: any;
    format?: string;
    enum?: any[];  // Fixed: enum should be any[] not string[]
    items?: {
        type: EnhancedTemplateField['type'];
        fields?: EnhancedTemplateField[];
    };
    properties?: EnhancedTemplateField[];
    constraints?: {
        minLength?: number;
        maxLength?: number;
        minimum?: number;
        maximum?: number;
        pattern?: string;
        enum?: any[];  // Fixed: enum should be any[] not string[]
    };
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