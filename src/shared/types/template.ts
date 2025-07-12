import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
/**
 * Represents a field in a template with extensible format support
 * Supports Kubernetes, Terraform, Ansible, Kustomize, and future formats
 */
interface TemplateField {
    path: string // Field path (e.g., "spec.containers[].image")
    title: string // Human-readable field name
    type: string // Field type (string, number, boolean, object, array)
    required: boolean // Whether field is required
    description?: string // Field description for tooltips/help
    format?: string // Format hint (e.g., "email", "uri", "date-time")
    items?: any // Array items schema for array types
    templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' | 'helm' | 'docker-compose' // Extensible format support
    constraints?: {
      minimum?: number
      maximum?: number
      pattern?: string
      enum?: string[]
      minLength?: number
      maxLength?: number
    } // Validation constraints for different formats
    metadata?: Record<string, any> // Format-specific metadata
  }
  

/**
 * Template resource with multi-format support
 */
interface TemplateResource {
  kind: string
  apiVersion: string
  namespace?: string
  selectedFields: TemplateField[]
  templateType: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' | 'helm' | 'docker-compose'
  source?: 'kubernetes' | 'cluster-crds'
  originalSchema?: KubernetesResourceSchema
  formatSpecific?: {
    terraform?: {
      provider?: string
      resource?: string
    }
    ansible?: {
      module?: string
      collection?: string
    }
    kustomize?: {
      patchType?: 'strategic' | 'merge' | 'json'
    }
    helm?: {
      chart?: string
      version?: string
    }
  }
}

/**
 * Represents a complete template configuration
 */
interface Template {
  name: string // Template name
  description?: string // Template description
  resources: TemplateResource[] // Array of resources in this template
  createdAt?: Date // Creation timestamp
  updatedAt?: Date // Last update timestamp
}

export type { Template, TemplateResource, TemplateField }