import { ContextData } from "./context-data.js";
export interface KubernetesContext {
    name: string;
}
export interface ContextAwareKubernetesResource {
    apiVersion: string;
    kind: string;
    metadata: {
        name: string;
        namespace?: string;
        labels: Record<string, string>;
        annotations?: Record<string, string>;
    };
    spec: Record<string, any>;
    status?: Record<string, any>;
}
export interface KubernetesResourceTemplate {
    kind: string;
    apiVersion: string;
    displayName: string;
    description: string;
    category: 'workload' | 'config' | 'network' | 'storage' | 'security';
    schemaUrl: string;
    defaultSpec: Record<string, any>;
    requiredFields: string[];
    contextFields: {
        namePattern: string;
        namespacePattern?: string;
        defaultLabels: Record<string, string>;
    };
}
export interface KubernetesResourceFormData {
    kind: string;
    apiVersion: string;
    name: string;
    namespace?: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    spec: Record<string, any>;
}
export interface ResourceValidationResult {
    isValid: boolean;
    errors: Array<{
        path: string;
        message: string;
        severity: 'error' | 'warning';
    }>;
    warnings: Array<{
        path: string;
        message: string;
    }>;
}
export interface KubernetesSchema {
    $schema: string;
    type: string;
    properties: Record<string, any>;
    required?: string[];
    definitions?: Record<string, any>;
}
export interface ContextNaming {
    generateResourceName(context: ContextData, resourceType: string, customName?: string): string;
    generateNamespace(context: ContextData): string;
    generateLabels(context: ContextData): Record<string, string>;
    generateFilePath(context: ContextData, resourceType: string): string;
    validateNaming(name: string, context: ContextData): boolean;
}
export declare const KUBERNETES_RESOURCE_TEMPLATES: KubernetesResourceTemplate[];
