/**
 * Schema-related type definitions shared between main and renderer processes
 */
export interface SchemaTreeNode {
  name: string;
  path: string;           // Add path field
  type?: string;
  description?: string;   // Add description field
  required?: boolean;     // Add required field
  items?: any;            // Array items schema for array types
  enum?: any[];           // Fixed: enum should be any[] not string[]
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

/**
 * Unified SchemaProperty interface that supports all variations used across the application
 * Based on JSONSchema7 specification
 */
export interface SchemaProperty {
  // Core identification properties
  name?: string;                                    // Property name
  path?: string;                                    // Property path in schema
  
  // Schema definition properties (from JSONSchema7)
  type: string;                                     // Property type (string, number, boolean, array, object, etc.)
  title?: string;                                   // Human-readable title
  description?: string;                             // Property description
  format?: string;                                  // Format specification (e.g., date, time, email)
  default?: any;                                    // Default value
  enum?: any[];                                     // Fixed: enum values can be any type (string, number, boolean, etc.)
  
  // Object and array properties
  properties?: Record<string, SchemaProperty>;      // Object properties
  items?: SchemaProperty;                           // Array items schema
  required?: string[];                              // Required properties for objects
  
  // UI and metadata properties
  hasChildren?: boolean;                            // Whether this property has child properties
  templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize'; // Template type
  isReference?: boolean;                            // Whether this is a reference
  level?: number;                                   // Nesting level in UI
  constraints?: {                                   // Additional constraints
    enum?: any[];                                   // Enum constraints
    [key: string]: any;                             // Other constraints
  };
  
  // Internal properties
  _rawProperty?: any;                               // Raw property data for internal use
}

export interface SchemaSource {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}