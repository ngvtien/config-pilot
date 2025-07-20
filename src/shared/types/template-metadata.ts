/**
 * Core template metadata structure for parseable templates
 */
export interface TemplateMetadata {
  metadata: {
    name: string;
    version: string;
    description: string;
    category?: string;
    tags?: string[];
  };
  parameters: Record<string, ParameterDefinition>;
  resources: Record<string, KubernetesResource>;
  generation: {
    helm?: {
      enabled: boolean;
      chartName: string;
      chartVersion: string;
    };
    kustomize?: {
      enabled: boolean;
      baseDir: string;
      overlays: string[];
    };
  };
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  default?: any;
  description?: string;
  required?: boolean;
  properties?: Record<string, ParameterDefinition>;
}

export interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: Record<string, any>;
  spec?: Record<string, any>;
  [key: string]: any;
}