/**
 * Schema-related type definitions shared between main and renderer processes
 */
export interface SchemaTreeNode {
  name: string;
  path: string;           // Add path field
  type?: string;
  description?: string;   // Add description field
  required?: boolean;     // Add required field
  children?: SchemaTreeNode[];
}

export interface FlattenedResource {
  key: string;
  kind: string;
  apiVersion?: string;
  group?: string;
  properties: Record<string, any>;
  required?: string[];
  description?: string;
  source: string;
  originalKey?: string; // this field to store the original schema definition key (e.g., "io.k8s.api.apps.v1.Deployment")
}

export interface SchemaProperty {
  type: string;
  description?: string;
  required?: boolean;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  hasChildren?: boolean;
  _rawProperty?: any;
}

export interface SchemaSource {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}