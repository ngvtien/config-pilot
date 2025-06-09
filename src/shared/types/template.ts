/**
 * Represents a field selected from a resource schema
 */
interface TemplateField {
  path: string // JSON path to the field (e.g., "spec.replicas")
  title: string // Display name for the field
  description?: string // Optional description
  type: string // Field type (string, number, boolean, etc.)
  required: boolean // Whether the field is required
  defaultValue?: any // Optional default value
}

/**
 * Represents a resource included in a template
 */
interface TemplateResource {
  apiVersion: string // e.g., "apps/v1"
  kind: string // e.g., "Deployment"
  namespace?: string // Optional namespace
  fields: TemplateField[] // Selected fields for this resource
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