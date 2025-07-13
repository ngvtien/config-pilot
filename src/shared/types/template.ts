import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
/**
 * Represents a field in a template with extensible format support
 * Supports Kubernetes, Terraform, Ansible, Kustomize, and future formats
 */
export interface TemplateField {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    default?: any;
    description?: string;
    enum?: any[];  // Fixed: enum should be any[] not string[]
    items?: {
        type: TemplateField['type'];
        fields?: TemplateField[];
    };
    path?: string;
    title?: string;
    format?: string;
    templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' | 'helm' | 'docker-compose';
    constraints?: {
        minLength?: number;
        maxLength?: number;
        minimum?: number;
        maximum?: number;
        pattern?: string;
        enum?: any[];
    };    
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