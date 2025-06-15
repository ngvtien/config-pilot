/**
 * Schema-related type definitions shared between main and renderer processes
 */
export interface SchemaTreeNode {
  name: string;
  type?: string;
  children?: SchemaTreeNode[];
}

export interface FlattenedResource {
  kind: string;
  apiVersion?: string;
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