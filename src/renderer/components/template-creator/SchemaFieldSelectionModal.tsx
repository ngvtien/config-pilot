import { useState, useEffect, useMemo } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Separator } from '@/renderer/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { ChevronRight, ChevronDown, Copy, Check, Edit } from 'lucide-react'
import { DescriptionTooltip } from './DescriptionTooltip'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import type { TemplateField, TemplateResource } from '@/shared/types/template'
import { SchemaTreeNode } from '../../../shared/types/schema';
import { SchemaTreeView } from './SchemaTreeView';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { EnhancedTemplateField, ArrayItemFieldConfig } from '@/shared/types/enhanced-template-field'
import { FieldConfigurationPanel } from './FieldConfigurationPanel'
import { normalizeFieldPath, findPropertyInSchema } from '../../utils/pathNormalization'

interface SchemaFieldSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    resource: KubernetesResourceSchema | TemplateResource | null
    selectedFields: TemplateField[]
    onFieldsChange: (fields: TemplateField[]) => void
}

export interface SchemaProperty {
    name: string
    path: string
    type: string
    description?: string
    required?: boolean
    properties?: SchemaProperty[]
    items?: SchemaProperty
    hasChildren: boolean
    format?: string
    templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize'
    isReference: boolean
    level?: number
    enum?: string[]
}

// Persistence keys for localStorage
const STORAGE_KEYS = {
    SELECTED_FIELDS: 'schema-field-selection-selected-fields',
    EXPANDED_NODES: 'schema-field-selection-expanded-nodes',
    SELECTED_FIELDS_SCHEMA: 'schema-field-selection-selected-fields-schema',
    FIELD_CONFIGURATIONS: 'schema-field-selection-field-configurations'
}

const convertToTreeNodes = (properties: SchemaProperty[]): SchemaTreeNode[] => {
    const nodeMap = new Map<string, SchemaTreeNode>();
    const rootNodes: SchemaTreeNode[] = [];

    // First pass: create all nodes
    properties.forEach(prop => {
        const node: SchemaTreeNode = {
            name: prop.name,
            path: prop.path,
            type: prop.type,
            description: prop.description,
            required: prop.required,
            children: []
        };
        nodeMap.set(prop.path, node);
    });

    // Second pass: build hierarchy
    properties.forEach(prop => {
        const node = nodeMap.get(prop.path)!;
        const pathParts = prop.path.split('.');

        if (pathParts.length === 1) {
            // Root level node
            rootNodes.push(node);
        } else {
            // Find parent
            const parentPath = pathParts.slice(0, -1).join('.');
            const parent = nodeMap.get(parentPath);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(node);
            }
        }
    });

    return rootNodes;
};

export function isPathSelected(path: string, selectedPaths: Set<string>, resourceKind?: string): boolean {
    // Check exact match
    if (selectedPaths.has(path)) return true;

    // Check CRD variations if resourceKind is provided
    if (resourceKind) {
        // Check with resource kind prefix (e.g. 'Application.spec.info')
        const prefixedPath = `${resourceKind}.${path}`;
        if (selectedPaths.has(prefixedPath)) return true;

        // Check without 'spec.' prefix if path starts with it
        if (path.startsWith('spec.')) {
            const noSpecPath = path.substring(5);
            if (selectedPaths.has(noSpecPath)) return true;
        }
    }

    return false;
}

function getPersistedFieldConfigurations(resourceKey: string): Record<string, any> {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.FIELD_CONFIGURATIONS)
        if (stored) {
            const allConfigurations = JSON.parse(stored)
            return allConfigurations[resourceKey] || {}
        }
    } catch (error) {
        console.warn('Failed to load persisted field configurations:', error)
    }
    return {}
}

function persistFieldConfigurations(resourceKey: string, configurations: Record<string, any>) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.FIELD_CONFIGURATIONS)
        const allConfigurations = stored ? JSON.parse(stored) : {}
        allConfigurations[resourceKey] = configurations
        localStorage.setItem(STORAGE_KEYS.FIELD_CONFIGURATIONS, JSON.stringify(allConfigurations))
    } catch (error) {
        console.warn('Failed to persist field configurations:', error)
    }
}

/**
 * Get persisted selected fields from localStorage
 */
function getPersistedSelectedFields(resourceKey: string): TemplateField[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_FIELDS)
        if (stored) {
            const allSelections = JSON.parse(stored)
            return allSelections[resourceKey] || []
        }
    } catch (error) {
        console.warn('Failed to load persisted selected fields:', error)
    }
    return []
}

/**
 * Persist selected fields to localStorage
 */
function persistSelectedFields(resourceKey: string, fields: TemplateField[]) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_FIELDS)
        const allSelections = stored ? JSON.parse(stored) : {}
        allSelections[resourceKey] = fields
        localStorage.setItem(STORAGE_KEYS.SELECTED_FIELDS, JSON.stringify(allSelections))
    } catch (error) {
        console.warn('Failed to persist selected fields:', error)
    }
}

/**
 * Get persisted expanded nodes from sessionStorage (session-only)
 */
function getPersistedExpandedNodes(resourceKey: string): Set<string> {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEYS.EXPANDED_NODES)
        if (stored) {
            const allExpanded = JSON.parse(stored)
            return new Set(allExpanded[resourceKey] || [])
        }
    } catch (error) {
        console.warn('Failed to load persisted expanded nodes:', error)
    }
    return new Set()
}

/**
 * Persist expanded nodes to sessionStorage
 */
function persistExpandedNodes(resourceKey: string, expandedNodes: Set<string>) {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEYS.EXPANDED_NODES)
        const allExpanded = stored ? JSON.parse(stored) : {}
        allExpanded[resourceKey] = Array.from(expandedNodes)
        sessionStorage.setItem(STORAGE_KEYS.EXPANDED_NODES, JSON.stringify(allExpanded))
    } catch (error) {
        console.warn('Failed to persist expanded nodes:', error)
    }
}

/**
 * Get persisted selected fields schema from localStorage
 */
function getPersistedSelectedFieldsSchema(resourceKey: string): any | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_FIELDS_SCHEMA)
        if (stored) {
            const allSchemas = JSON.parse(stored)
            return allSchemas[resourceKey] || null
        }
    } catch (error) {
        console.warn('Failed to load persisted selected fields schema:', error)
    }
    return null
}

/**
 * Persist selected fields schema to localStorage
 */
function persistSelectedFieldsSchema(resourceKey: string, schema: any) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_FIELDS_SCHEMA)
        const allSchemas = stored ? JSON.parse(stored) : {}
        allSchemas[resourceKey] = schema
        localStorage.setItem(STORAGE_KEYS.SELECTED_FIELDS_SCHEMA, JSON.stringify(allSchemas))
    } catch (error) {
        console.warn('Failed to persist selected fields schema:', error)
    }
}

/**
 * Generate path variations for a given path based on resource type
 * This helps handle different ways a path might be represented in the schema
 */
export const normalizePath = (path: string, resource?: any): string[] => {
    // Always keep the original path as first variation
    const variations = [path];

    // For CRDs, we need to handle paths with and without spec. prefix
    if (resource?.source === 'cluster-crds') {
        if (path.startsWith('spec.')) {
            // Add variation without spec. prefix
            variations.push(path.replace('spec.', ''));
        } else if (!path.includes('.') && path !== 'spec') {
            // For top-level fields that don't have a dot and are not 'spec' itself, add spec. prefix variation
            variations.push(`spec.${path}`);
        }

        // Also add resource kind prefixed variations if kind is available
        if (resource?.kind) {
            variations.push(`${resource.kind}.${path}`);
            if (path.startsWith('spec.')) {
                variations.push(`${resource.kind}.${path.replace('spec.', '')}`);
            } else if (!path.includes('.') && path !== 'spec') {
                variations.push(`${resource.kind}.spec.${path}`);
            }
        }
    }

    // For debugging
    console.log('🔍 DEBUG: Path variations:', variations);
    return variations;
};

/**
 * Modal component for selecting schema fields with tooltips and hierarchical display
 * Supports multiple template formats and state persistence
 */
//export function SchemaFieldSelectionModal({
export const SchemaFieldSelectionModal: React.FC<SchemaFieldSelectionModalProps> = ({
    isOpen,
    onClose,
    resource,
    selectedFields,
    onFieldsChange
}) => {
    const [localSelectedFields, setLocalSelectedFields] = useState<TemplateField[]>(selectedFields)
    const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set())
    const [showSchemaPreview, setShowSchemaPreview] = useState(false)
    const [schemaTree, setSchemaTree] = useState<SchemaTreeNode[]>([]);
    const [isLoadingSchema, setIsLoadingSchema] = useState(false);
    const [highlightedFieldPath, setHighlightedFieldPath] = useState<string | null>(null);
    const [showSelectedPreview, setShowSelectedPreview] = useState(false)
    const [selectedFieldForConfig, setSelectedFieldForConfig] = useState<EnhancedTemplateField | null>(null)
    const [fieldConfigurations, setFieldConfigurations] = useState<Record<string, any>>({})
    const [arrayConfigurations, setArrayConfigurations] = useState<Record<string, ArrayItemFieldConfig>>({})
    const [showFieldConfigModal, setShowFieldConfigModal] = useState(false)

    const [schemaTimestamp, setSchemaTimestamp] = useState(Date.now())

    const memoizedFullSchema = useMemo(() => {
        if (!resource?.schema) return '{}'
        return JSON.stringify(resource.schema, null, 2)
    }, [resource?.schema])

    const schemaMetrics = useMemo(() => {
        const schemaSize = memoizedFullSchema.length
        const isLarge = schemaSize > 100000 // 100KB threshold
        const isTooLarge = schemaSize > 500000 // 500KB threshold - don't render at all
        const lineCount = memoizedFullSchema.split('\n').length

        return {
            size: schemaSize,
            isLarge,
            isTooLarge,
            lineCount,
            sizeFormatted: (schemaSize / 1024).toFixed(1) + 'KB'
        }
    }, [memoizedFullSchema])

    // Force schema recreation whenever fields change
    useEffect(() => {
        setSchemaTimestamp(Date.now())
    }, [localSelectedFields])


    // Use apiVersion/kind format consistently for storage and retrieval
    const resourceKey = resource?.key || (resource?.apiVersion && resource?.kind ? `${resource.apiVersion}/${resource.kind}` : '');

    useEffect(() => {
        if (resource && isOpen) {
            setIsLoadingSchema(true);

            // Determine if this is a CRD resource
            const isCRD = resource.source === 'cluster-crds';

            console.log('Getting schema tree for resource:', {
                resource: resource.key,
                isCRD,
                source: resource.source
            });

            let schemaPromise: Promise<SchemaTreeNode[]>;

            if (isCRD) {
                // Use CRD-specific IPC channel
                schemaPromise = window.electronAPI.invoke(
                    'schema:getCRDSchemaTree',
                    resource.group,
                    resource.version,
                    resource.kind
                );
            } else {
                // Use standard kubernetes schema IPC channel
                const sourceId = 'kubernetes';
                schemaPromise = window.electronAPI.invoke(
                    'schema:getResourceSchemaTree',
                    sourceId,
                    resourceKey
                );
            }

            schemaPromise
                .then((tree: SchemaTreeNode[]) => {
                    console.log('Schema tree received:', tree);

                    if (!tree || !Array.isArray(tree)) {
                        console.error('Invalid schema tree received:', tree);
                        setSchemaTree([]);
                        setIsLoadingSchema(false);
                        return;
                    }

                    // Filter the tree to only include spec and allowed metadata fields
                    const filteredTree = tree.filter(node => {
                        // Always include spec
                        if (node.path === 'spec') return true;
                        // Only include metadata.labels and metadata.annotations
                        if (node.path === 'metadata') {
                            // Keep metadata but filter its children later
                            return true;
                        }
                        // Exclude other top-level fields (status, operation, etc.)
                        return false;
                    });

                    // If we have metadata, filter its children
                    const metadataNode = filteredTree.find(node => node.path === 'metadata');
                    if (metadataNode && metadataNode.children) {
                        metadataNode.children = metadataNode.children.filter(child =>
                            child.name === 'labels' || child.name === 'annotations'
                        );
                    }

                    setSchemaTree(tree);

                    // Check if we have any persisted data for this resource
                    const hasPersistedData = sessionStorage.getItem(`expandedNodes_${resourceKey}`) !== null;

                    if (!hasPersistedData) {
                        // This is a fresh resource - start with all nodes collapsed
                        console.log('🌳 Starting with collapsed tree for fresh resource');
                        setExpandedObjects(new Set<string>());
                    } else {
                        // Load persisted expanded state
                        const persistedExpanded = getPersistedExpandedNodes(resourceKey);
                        console.log('📥 Loading persisted expanded nodes:', persistedExpanded.size);
                        setExpandedObjects(persistedExpanded);
                    }
                    setIsLoadingSchema(false);
                })
                .catch((error: any) => {
                    console.error('Failed to fetch schema tree:', error);
                    setSchemaTree([]);
                    setIsLoadingSchema(false);
                });
        }
    }, [resource, isOpen, resourceKey]);

    // useEffect(() => {
    //     if (resource && isOpen) {
    //         setIsLoadingSchema(true);

    //         // Check if resource already has a filtered schema
    //         if (resource.schema) {
    //             console.log('Using filtered schema from resource prop:', resource.schema);
    //             const treeNodes = convertSchemaToTreeNodes(resource.schema);
    //             setSchemaTree(treeNodes);
    //             setIsLoadingSchema(false);
    //             return;
    //         }

    //         // Fallback to IPC calls if no schema in resource
    //         const resourceKey = resource.key || `${resource.apiVersion}/${resource.kind}`;
    //         const isCRD = resource.source === 'cluster-crds';

    //         console.log('🔄 Loading schema via IPC for resource:', {
    //             resource: resource.key,
    //             isCRD,
    //             source: resource.source
    //         });

    //         let schemaPromise: Promise<SchemaTreeNode[]>;

    //         if (isCRD) {
    //             // Use CRD-specific IPC channel
    //             schemaPromise = window.electronAPI.invoke(
    //                 'schema:getCRDSchemaTree',
    //                 resource.group,
    //                 resource.version,
    //                 resource.kind
    //             );
    //         } else {
    //             // Use standard kubernetes schema IPC channel
    //             const sourceId = 'kubernetes';
    //             schemaPromise = window.electronAPI.invoke(
    //                 'schema:getResourceSchemaTree',
    //                 sourceId,
    //                 resourceKey
    //             );
    //         }

    //         schemaPromise
    //             .then((tree: SchemaTreeNode[]) => {
    //                 console.log('Schema tree received:', tree);

    //                 if (!tree || !Array.isArray(tree)) {
    //                     console.error('Invalid schema tree received:', tree);
    //                     setSchemaTree([]);
    //                     setIsLoadingSchema(false);
    //                     return;
    //                 }

    //                 setSchemaTree(tree);

    //                 // Check if we have any persisted data for this resource
    //                 const hasPersistedData = sessionStorage.getItem(`expandedNodes_${resourceKey}`) !== null;

    // if (!hasPersistedData) {
    //     // This is a fresh resource - start with all nodes collapsed
    //     console.log('🌳 Starting with collapsed tree for fresh resource');
    //     setExpandedObjects(new Set<string>());
    // } else {
    //     // Load persisted expanded state
    //     const persistedExpanded = getPersistedExpandedNodes(resourceKey);
    //     console.log('📥 Loading persisted expanded nodes:', persistedExpanded.size);
    //     setExpandedObjects(persistedExpanded);
    // }
    //                 setIsLoadingSchema(false);
    //             })
    //             .catch((error: any) => {
    //                 console.error('Failed to fetch schema tree:', error);
    //                 setSchemaTree([]);
    //                 setIsLoadingSchema(false);
    //             });
    //     }
    // }, [resource, isOpen, resourceKey]);

    useEffect(() => {
        if (resource && resourceKey) {
            console.log('🔄 Resource changed, loading persisted state:', resourceKey)

            // Always clear current selections first when switching resources
            setLocalSelectedFields([]);
            // DON'T clear expandedObjects here - let the schema loading useEffect handle it

            // Load persisted data for this specific resource
            const persistedFields = getPersistedSelectedFields(resourceKey)
            console.log('📥 Loaded persisted selected fields:', persistedFields.length)
            setLocalSelectedFields(persistedFields)
        }
    }, [resourceKey])

    // Only update from props if we're opening modal fresh and no persisted data exists
    useEffect(() => {
        if (isOpen && selectedFields.length > 0 && resourceKey) {
            const persistedFields = getPersistedSelectedFields(resourceKey)
            // Only use props if no persisted data exists
            if (persistedFields.length === 0) {
                console.log('📝 Using props as no persisted data found')
                setLocalSelectedFields(selectedFields)
            }
        }
    }, [isOpen, selectedFields.length, resourceKey]) // Fixed: use length instead of array

    // Persist state changes
    useEffect(() => {
        if (resourceKey && localSelectedFields.length >= 0) {
            persistSelectedFields(resourceKey, localSelectedFields)
        }
    }, [localSelectedFields, resourceKey])


    useEffect(() => {
        if (resourceKey) {
            persistExpandedNodes(resourceKey, expandedObjects)
        }
    }, [expandedObjects, resourceKey])

    useEffect(() => {
        if (resourceKey) {
            const persistedConfigurations = getPersistedFieldConfigurations(resourceKey)
            setFieldConfigurations(persistedConfigurations)
        }
    }, [resourceKey])

    const handleOpenFieldConfig = (field: EnhancedTemplateField) => {
        // Merge the field with saved configurations
        const fieldWithSavedConfig = {
            ...field,
            defaultValue: fieldConfigurations[field.path] !== undefined
                ? fieldConfigurations[field.path]
                : field.defaultValue
        };
        setSelectedFieldForConfig(fieldWithSavedConfig);
        setShowFieldConfigModal(true);
    };

    /**
     * Handle closing field configuration modal
     */
    const handleCloseFieldConfig = () => {
        setShowFieldConfigModal(false)
        setSelectedFieldForConfig(null)
    }

    /**
     * Handle default value changes for fields
     */
    // Update handleDefaultValueChange to persist immediately
    const handleDefaultValueChange = (fieldPath: string, value: any) => {
        setFieldConfigurations(prev => {
            const updated = { ...prev, [fieldPath]: value }
            // Persist immediately
            if (resourceKey) {
                persistFieldConfigurations(resourceKey, updated)
            }
            return updated
        })
    }
    /**
     * Handle nested field toggle for complex types
     */
    // const handleNestedFieldToggle = (parentPath: string, nestedField: SchemaProperty, checked: boolean) => {
    //     // Implementation for nested field handling
    //     console.log('Nested field toggle:', { parentPath, nestedField, checked })
    // }
    const handleNestedFieldToggle = (fieldPath: string, nestedPath: string, enabled: boolean) => {
        console.log('Nested field toggle:', { fieldPath, nestedPath, enabled })
    }

    /**
     * Handle array configuration changes
     */
    const handleArrayConfigChange = (parentPath: string, config: ArrayItemFieldConfig) => {
        setArrayConfigurations(prev => ({
            ...prev,
            [parentPath]: config
        }))
    }

    /**
     * Resolve schema references recursively
     * @param property - The schema property that might contain $ref
     * @param fullSchema - The complete schema for reference resolution
     * @param visited - Set to prevent circular references
     */
    const resolveSchemaReference = (
        property: any,
        fullSchema: any,
        visited: Set<string> = new Set()
    ): { resolved: any; isReference: boolean } => {
        if (!property || typeof property !== 'object') {
            return { resolved: property, isReference: false }
        }

        // Handle $ref properties
        if (property.$ref && typeof property.$ref === 'string') {
            const refPath = property.$ref.replace('#/', '').split('/')
            console.log('🔍 DEBUG: Resolving $ref:', property.$ref, 'refPath:', refPath)

            // Prevent circular references
            if (visited.has(property.$ref)) {
                return {
                    resolved: {
                        type: 'object',
                        description: `Circular reference: ${property.$ref}`
                    },
                    isReference: true
                }
            }

            visited.add(property.$ref)

            // Try multiple locations for definitions
            let resolved = null

            // 1. Try the standard path from the ref
            let current = fullSchema
            for (const segment of refPath) {
                current = current?.[segment]
            }
            if (current) {
                resolved = current
                console.log('🔍 DEBUG: Found reference at standard path:', resolved)
            }

            // 2. If not found, try looking in CRD schema structure
            if (!resolved && fullSchema.spec?.versions?.[0]?.schema?.openAPIV3Schema) {
                current = fullSchema.spec.versions[0].schema.openAPIV3Schema
                for (const segment of refPath) {
                    current = current?.[segment]
                }
                if (current) {
                    resolved = current
                    console.log('🔍 DEBUG: Found reference in CRD schema:', resolved)
                }
            }

            // 3. Try looking in components/schemas (OpenAPI 3.0 style)
            if (!resolved && fullSchema.components?.schemas) {
                const defName = refPath[refPath.length - 1] // Get the last part of the path
                resolved = fullSchema.components.schemas[defName]
                if (resolved) {
                    console.log('🔍 DEBUG: Found reference in components.schemas:', resolved)
                }
            }

            // 4. Try looking for ObjectMeta specifically in common locations
            if (!resolved && property.$ref.includes('ObjectMeta')) {
                // Look for ObjectMeta in various possible locations
                const objectMetaLocations = [
                    fullSchema.definitions?.['io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta'],
                    fullSchema.spec?.versions?.[0]?.schema?.openAPIV3Schema?.definitions?.['io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta'],
                    fullSchema.components?.schemas?.ObjectMeta,
                    fullSchema.components?.schemas?.['io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta']
                ]

                for (const location of objectMetaLocations) {
                    if (location) {
                        resolved = location
                        console.log('🔍 DEBUG: Found ObjectMeta at specific location:', resolved)
                        break
                    }
                }
            }

            // 5. If still not found, create a basic ObjectMeta structure
            if (!resolved && property.$ref.includes('ObjectMeta')) {
                resolved = {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Name must be unique within a namespace.' },
                        namespace: { type: 'string', description: 'Namespace defines the space within which each name must be unique.' },
                        uid: { type: 'string', description: 'UID is the unique in time and space value for this object.' },
                        resourceVersion: { type: 'string', description: 'An opaque value that represents the internal version of this object.' },
                        generation: { type: 'integer', description: 'A sequence number representing a specific generation of the desired state.' },
                        creationTimestamp: { type: 'string', format: 'date-time', description: 'CreationTimestamp is a timestamp representing the server time when this object was created.' },
                        deletionTimestamp: { type: 'string', format: 'date-time', description: 'DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted.' },
                        deletionGracePeriodSeconds: { type: 'integer', description: 'Number of seconds allowed for this object to gracefully terminate.' },
                        labels: { type: 'object', additionalProperties: { type: 'string' }, description: 'Map of string keys and values that can be used to organize and categorize objects.' },
                        annotations: { type: 'object', additionalProperties: { type: 'string' }, description: 'Annotations is an unstructured key value map stored with a resource.' },
                        ownerReferences: { type: 'array', items: { type: 'object' }, description: 'List of objects depended by this object.' },
                        finalizers: { type: 'array', items: { type: 'string' }, description: 'Must be empty before the object is deleted from the registry.' },
                        managedFields: { type: 'array', items: { type: 'object' }, description: 'ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow.' }
                    }
                }
                console.log('🔍 DEBUG: Created fallback ObjectMeta structure')
            }

            if (resolved) {
                // Recursively resolve the referenced schema
                const result = resolveSchemaReference(resolved, fullSchema, visited)
                return { resolved: result.resolved, isReference: true }
            }

            console.log('🔍 DEBUG: Could not resolve reference:', property.$ref)
            return {
                resolved: { type: 'unknown', description: `Unresolved reference: ${property.$ref}` },
                isReference: true
            }
        }

        // Handle object properties
        if (property.type === 'object' && property.properties) {
            const resolvedProperties: any = {}
            Object.keys(property.properties).forEach(key => {
                const result = resolveSchemaReference(
                    property.properties[key],
                    fullSchema,
                    new Set(visited)
                )
                resolvedProperties[key] = result.resolved
            })
            return {
                resolved: { ...property, properties: resolvedProperties },
                isReference: false
            }
        }

        // Handle array items
        if (property.type === 'array' && property.items) {
            const result = resolveSchemaReference(property.items, fullSchema, new Set(visited))
            return {
                resolved: { ...property, items: result.resolved },
                isReference: result.isReference
            }
        }

        return { resolved: property, isReference: false }
    }

    const convertSchemaToTreeNodes = (schema: any, parentPath = ''): SchemaTreeNode[] => {
        if (!schema?.properties) return [];

        return Object.entries(schema.properties).map(([key, property]: [string, any]) => {
            const path = parentPath ? `${parentPath}.${key}` : key;
            const node: SchemaTreeNode = {
                name: key,
                path,
                type: property.type || 'unknown',
                description: property.description,
                required: schema.required?.includes(key) || false,
                enum: property.enum, // Include enum property
                children: property.properties ? convertSchemaToTreeNodes(property, path) : []
            };
            return node;
        });
    };

    useEffect(() => {
        setSchemaTimestamp(Date.now())
    }, [localSelectedFields])

    /**
     * Build filtered schema directly from selected tree nodes
     * This eliminates the need for complex path normalization and matching
     */
    // const buildSchemaFromSelectedNodes = (
    //     originalSchema: any,
    //     selectedPaths: Set<string>,
    //     treeNodes: SchemaTreeNode[]
    // ): any => {
    //     console.log('🌳 Building schema from selected tree nodes:', Array.from(selectedPaths));

    //     /**
    //      * Check if a path or any of its children are selected
    //      */
    //     const isPathOrChildSelected = (node: SchemaTreeNode, selectedPaths: Set<string>): boolean => {
    //         if (selectedPaths.has(node.path)) {
    //             return true;
    //         }
    //         if (node.children) {
    //             return node.children.some(child => isPathOrChildSelected(child, selectedPaths));
    //         }
    //         return false;
    //     };

    //     /**
    //      * Find property definition in schema by path
    //      */
    //     const findPropertyByPath = (schema: any, path: string): any => {
    //         const parts = path.split('.');
    //         let current = schema;

    //         for (const part of parts) {
    //             if (current?.properties?.[part]) {
    //                 current = current.properties[part];
    //             } else {
    //                 return null;
    //             }
    //         }
    //         return current;
    //     };

    //     /**
    //      * Recursively build schema structure from tree nodes
    //      */
    //     const buildSchemaFromNodes = (nodes: SchemaTreeNode[], currentSchema: any): any => {
    //         const result: any = {
    //             type: 'object',
    //             properties: {}
    //         };

    //         nodes.forEach(node => {
    //             // Check if this node or any of its children are selected
    //             const isNodeSelected = selectedPaths.has(node.path);
    //             const hasSelectedChildren = node.children?.some(child => 
    //                 isPathOrChildSelected(child, selectedPaths)
    //             );

    //             if (isNodeSelected || hasSelectedChildren) {
    //                 // Find the original property definition
    //                 const originalProperty = findPropertyByPath(originalSchema, node.path);

    //                 if (originalProperty) {
    //                     result.properties[node.name] = { ...originalProperty };

    //                     // Apply custom configurations from selected fields
    //                     const resourceKey = resource?.key || `${resource?.apiVersion}/${resource?.kind}`;
    //                     const fullFieldPath = `${resourceKey}.${node.path}`;
    //                     const selectedField = localSelectedFields.find(f => f.path === fullFieldPath);

    //                     if (selectedField) {
    //                         if (selectedField.title && selectedField.title !== node.name) {
    //                             result.properties[node.name].title = selectedField.title;
    //                         }
    //                         if (selectedField.defaultValue !== undefined) {
    //                             result.properties[node.name].default = selectedField.defaultValue;
    //                         }
    //                     }

    //                     // Recursively build children if they exist and have selections
    //                     if (node.children && node.children.length > 0 && hasSelectedChildren) {
    //                         if (originalProperty.type === 'object' && originalProperty.properties) {
    //                             const childSchema = buildSchemaFromNodes(node.children, originalSchema);
    //                             if (Object.keys(childSchema.properties).length > 0) {
    //                                 result.properties[node.name].properties = childSchema.properties;
    //                             }
    //                         } else if (originalProperty.type === 'array' && originalProperty.items) {
    //                             // Handle array items
    //                             const childSchema = buildSchemaFromNodes(node.children, originalSchema);
    //                             if (Object.keys(childSchema.properties).length > 0) {
    //                                 result.properties[node.name].items = {
    //                                     ...originalProperty.items,
    //                                     properties: childSchema.properties
    //                                 };
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         });

    //         return result;
    //     };

    //     // Build the filtered schema from tree nodes
    //     const filteredSchema = buildSchemaFromNodes(treeNodes, originalSchema);

    //     // Always include required Kubernetes fields
    //     if (originalSchema.properties) {
    //         // Preserve apiVersion and kind if they exist
    //         if (originalSchema.properties.apiVersion) {
    //             filteredSchema.properties.apiVersion = originalSchema.properties.apiVersion;
    //         }
    //         if (originalSchema.properties.kind) {
    //             filteredSchema.properties.kind = originalSchema.properties.kind;
    //         }

    //         // Include minimal metadata with labels and annotations
    //         if (originalSchema.properties.metadata) {
    //             filteredSchema.properties.metadata = {
    //                 type: 'object',
    //                 properties: {}
    //             };

    //             // Add labels and annotations if they exist
    //             if (originalSchema.properties.metadata.properties?.labels) {
    //                 filteredSchema.properties.metadata.properties.labels =
    //                     originalSchema.properties.metadata.properties.labels;
    //             }
    //             if (originalSchema.properties.metadata.properties?.annotations) {
    //                 filteredSchema.properties.metadata.properties.annotations =
    //                     originalSchema.properties.metadata.properties.annotations;
    //             }
    //         }
    //     }

    //     console.log('🌳 Built filtered schema:', filteredSchema);
    //     return filteredSchema;
    // };


    // /**
    //  * Build filtered schema directly from selected tree nodes
    //  * This eliminates the need for complex path normalization and matching
    //  */
    // const buildSchemaFromSelectedNodes = (
    //     originalSchema: any,
    //     selectedPaths: Set<string>,
    //     treeNodes: SchemaTreeNode[]
    // ): any => {
    //     const findPropertyByPath = (schema: any, path: string): any => {
    //         const parts = path.split('.');
    //         let current = schema;

    //         for (const part of parts) {
    //             if (current?.properties?.[part]) {
    //                 current = current.properties[part];
    //             } else {
    //                 return null;
    //             }
    //         }
    //         return current;
    //     };

    //     const isPathOrChildSelected = (node: SchemaTreeNode, selectedPaths: Set<string>): boolean => {
    //         if (selectedPaths.has(node.path)) {
    //             return true;
    //         }

    //         return node.children?.some(child => isPathOrChildSelected(child, selectedPaths)) || false;
    //     };

    //     const buildSchemaFromNodes = (nodes: SchemaTreeNode[], currentSchema: any): any => {
    //         const result: any = {
    //             type: 'object',
    //             properties: {}
    //         };

    //         nodes.forEach(node => {
    //             const isNodeSelected = selectedPaths.has(node.path);
    //             const hasSelectedChildren = node.children?.some((child: SchemaTreeNode) => 
    //                 isPathOrChildSelected(child, selectedPaths)
    //             );

    //             if (isNodeSelected || hasSelectedChildren) {
    //                 const originalProperty = findPropertyByPath(originalSchema, node.path);

    //                 if (originalProperty) {
    //                     result.properties[node.name] = { ...originalProperty };

    //                     if (node.children && node.children.length > 0 && hasSelectedChildren) {
    //                         const childSchema = buildSchemaFromNodes(node.children, originalProperty);
    //                         if (Object.keys(childSchema.properties).length > 0) {
    //                             result.properties[node.name].properties = childSchema.properties;
    //                         }
    //                     }
    //                 }
    //             }
    //         });

    //         return result;
    //     };

    //     // Always include required Kubernetes fields
    //     const baseSchema = {
    //         type: 'object',
    //         properties: {
    //             apiVersion: originalSchema.properties?.apiVersion || { type: 'string' },
    //             kind: originalSchema.properties?.kind || { type: 'string' },
    //             metadata: {
    //                 type: 'object',
    //                 properties: {
    //                     name: { type: 'string' },
    //                     labels: { type: 'object' },
    //                     annotations: { type: 'object' }
    //                 }
    //             }
    //         }
    //     };

    //     // Build filtered schema from tree nodes
    //     const filteredResult = buildSchemaFromNodes(treeNodes, originalSchema);

    //     // Merge with base schema
    //     return {
    //         ...baseSchema,
    //         properties: {
    //             ...baseSchema.properties,
    //             ...filteredResult.properties
    //         }
    //     };
    // };


    const buildSchemaFromSelectedNodes = (
        originalSchema: any,
        selectedPaths: Set<string>,
        treeNodes: SchemaTreeNode[]
    ): any => {
        console.log('🔧 DEBUG buildSchemaFromSelectedNodes: Starting with', {
            selectedPathsCount: selectedPaths.size,
            selectedPaths: Array.from(selectedPaths),
            treeNodesCount: treeNodes.length,
            treeNodeNames: treeNodes.map(n => ({ name: n.name, path: n.path, hasChildren: !!n.children?.length }))
        });

        /**
         * Check if a node has any selected children by examining selected paths
         * @param nodePath - The path of the current node
         * @param selectedPaths - Set of all selected paths
         * @returns true if any selected path starts with nodePath + '.'
         */
        const hasSelectedChildrenByPath = (nodePath: string, selectedPaths: Set<string>): boolean => {
            const childPrefix = nodePath + '.';
            return Array.from(selectedPaths).some(path => path.startsWith(childPrefix));
        };

        /**
         * Recursively build schema from tree nodes
         * @param nodes - Array of tree nodes to process
         * @param depth - Current depth for logging indentation
         * @returns Schema object with properties from selected nodes
         */
        const buildFromNodes = (nodes: SchemaTreeNode[], depth = 0): any => {
            const indent = '  '.repeat(depth);
            const properties: any = {};

            console.log(`${indent}🔧 DEBUG buildFromNodes: Processing ${nodes.length} nodes at depth ${depth}`);

            nodes.forEach((node, index) => {
                const isSelected = selectedPaths.has(node.path);

                // FIXED: Check for selected children by examining selected paths directly
                const hasSelectedChildren = hasSelectedChildrenByPath(node.path, selectedPaths);

                console.log(`${indent}🔧 DEBUG Node ${index + 1}:`, {
                    name: node.name,
                    path: node.path,
                    isSelected,
                    hasSelectedChildren,
                    willInclude: isSelected || hasSelectedChildren
                });

                // If this node is selected OR has selected children, include it
                if (isSelected || hasSelectedChildren) {
                    console.log(`${indent}✅ Including node: ${node.name}`);

                    // Find the selected field for this node to get its description
                    const selectedField = localSelectedFields.find(f => {
                        // Normalize the field path to match node path
                        let normalizedPath = f.path;
                        // Add normalization logic here if needed
                        return normalizedPath === node.path;
                    });

                    // Debug logging for array types
                    if (selectedField?.type === 'array') {
                        console.log(`🔧 DEBUG Array field: ${node.name}`, {
                            selectedFieldItems: selectedField?.items,
                            nodeType: node.type,
                            nodePath: node.path,
                            selectedFieldPath: selectedField?.path,
                            selectedFieldHasItems: 'items' in selectedField,
                            selectedFieldItemsType: typeof selectedField?.items,
                            selectedFieldItemsStringified: selectedField?.items ? JSON.stringify(selectedField.items, null, 2) : 'undefined'
                        });
                    }

                    // Start with the node's schema if available                                        
                    properties[node.name] = {
                        type: selectedField?.type || node.type || 'object',
                        ...(selectedField?.description && { description: selectedField.description }),
                        ...(selectedField?.type === 'array' && selectedField?.items && { 
                            items: selectedField.items 
                        }),
                        ...(node.required && { required: true })
                    };

                    // If node has selected children, we need to build child properties
                    if (hasSelectedChildren) {
                        console.log(`${indent}🔧 Processing children for: ${node.name} (has selected children)`);

                        // Find all child paths for this node
                        const childPrefix = node.path + '.';
                        const childPaths = Array.from(selectedPaths)
                            .filter(path => path.startsWith(childPrefix))
                            .map(path => {
                                // Get the immediate child name (first segment after the prefix)
                                const relativePath = path.substring(childPrefix.length);
                                const firstSegment = relativePath.split('.')[0];
                                return {
                                    name: firstSegment,
                                    path: childPrefix + firstSegment,
                                    fullPath: path
                                };
                            });

                        // Create unique child nodes
                        const uniqueChildNodes = new Map<string, SchemaTreeNode>();
                        childPaths.forEach(child => {
                            if (!uniqueChildNodes.has(child.name)) {
                                uniqueChildNodes.set(child.name, {
                                    name: child.name,
                                    path: child.path,
                                    type: 'object', // Default type, will be refined
                                    children: []
                                });
                            }
                        });

                        // Recursively build child properties
                        const childNodes = Array.from(uniqueChildNodes.values());
                        if (childNodes.length > 0) {
                            const childProperties = buildFromNodes(childNodes, depth + 1);
                            if (Object.keys(childProperties).length > 0) {
                                properties[node.name].properties = childProperties;
                                if (!properties[node.name].type) {
                                    properties[node.name].type = 'object';
                                }
                                console.log(`${indent}✅ Added ${Object.keys(childProperties).length} child properties to: ${node.name}`);
                            }
                        }
                    }
                } else {
                    console.log(`${indent}❌ Skipping node: ${node.name}`);
                }
            });

            console.log(`${indent}🔧 DEBUG buildFromNodes result: ${Object.keys(properties).length} properties`, Object.keys(properties));
            return properties;
        };

        // Always include required Kubernetes base fields
        const baseSchema = {
            type: 'object',
            properties: {
                apiVersion: originalSchema.properties?.apiVersion || { type: 'string' },
                kind: originalSchema.properties?.kind || { type: 'string' },
                metadata: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        labels: { type: 'object' },
                        annotations: { type: 'object' }
                    }
                }
            }
        };

        // Build properties from selected tree nodes
        console.log('🔧 DEBUG: Building properties from tree nodes...');
        const selectedProperties = buildFromNodes(treeNodes);

        console.log('🔧 DEBUG: Final results:', {
            baseSchemaProperties: Object.keys(baseSchema.properties),
            selectedProperties: Object.keys(selectedProperties),
            totalProperties: Object.keys({ ...baseSchema.properties, ...selectedProperties }).length
        });

        // Merge base schema with selected properties
        const result = {
            ...baseSchema,
            properties: {
                ...baseSchema.properties,
                ...selectedProperties
            }
        };

        console.log('🔧 DEBUG: Final schema result:', result);
        return result;
    };

    /**
     * Memoized filtered schema that applies field configurations and filters based on selected fields
     */
    // const filteredSchema = useMemo(() => {
    //     // Force fresh calculation by clearing any cached data
    //     console.log('🔄 FORCING FRESH SCHEMA CREATION - Timestamp:', schemaTimestamp)
    //     console.log('🔧 DEBUG: Current fieldConfigurations:', fieldConfigurations)
    //     console.log('🔧 DEBUG: Current localSelectedFields:', localSelectedFields.map(f => ({ path: f.path, title: f.title, defaultValue: f.defaultValue })))

    //     if (!resource?.schema || localSelectedFields.length === 0) {
    //         return {}
    //     }

    //     console.log('🔍 DEBUG: Building filtered schema from selected fields')
    //     console.log('🔍 DEBUG: Selected fields:', localSelectedFields.map(f => f.path))
    //     console.log('🔍 DEBUG: Resource info:', { source: resource.source, key: resource.key, kind: resource.kind })

    //     // FIRST: Resolve all $ref in the schema before filtering
    //     const resolveEntireSchema = (schema: any): any => {
    //         if (!schema || typeof schema !== 'object') {
    //             return schema
    //         }

    //         // If this is a $ref, resolve it
    //         if (schema.$ref) {
    //             const { resolved } = resolveSchemaReference(schema, resource.schema)
    //             return resolveEntireSchema(resolved) // Recursively resolve in case the resolved schema has more $ref
    //         }

    //         // If this is an object with properties, resolve each property
    //         if (schema.properties) {
    //             const resolvedProperties: any = {}
    //             Object.keys(schema.properties).forEach(key => {
    //                 resolvedProperties[key] = resolveEntireSchema(schema.properties[key])
    //             })
    //             return { ...schema, properties: resolvedProperties }
    //         }

    //         // If this is an array with items, resolve the items
    //         if (schema.items) {
    //             return { ...schema, items: resolveEntireSchema(schema.items) }
    //         }

    //         return schema
    //     }

    //     // Start with a fully resolved schema (no $ref)
    //     const resolvedSchema = resolveEntireSchema(resource.schema)
    //     console.log('🔍 DEBUG: Schema fully resolved, root properties:', Object.keys(resolvedSchema.properties || {}))

    //     // Get selected field paths (normalize them)
    //     const selectedPaths = new Set(localSelectedFields.map(f => {
    //         console.log('🔍 DEBUG: Processing original path:', f.path)

    //         let normalizedPath = f.path

    //         // Handle CRD paths - more comprehensive normalization
    //         if (resource.source === 'cluster-crds') {
    //             // Remove CRD-specific prefixes in order of specificity
    //             const prefixesToRemove = [
    //                 'spec.versions[0].schema.openAPIV3Schema.properties.',
    //                 `${resource.kind}.spec.`,
    //                 `${resource.kind}.`,
    //                 'spec.',
    //                 'properties.'
    //             ]

    //             for (const prefix of prefixesToRemove) {
    //                 if (normalizedPath.startsWith(prefix)) {
    //                     normalizedPath = normalizedPath.replace(prefix, '')
    //                     console.log(`🔍 DEBUG: Removed prefix "${prefix}", result: ${normalizedPath}`)
    //                     break // Only remove the first matching prefix
    //                 }
    //             }
    //         } else {
    //             // Handle standard paths
    //             if (normalizedPath.startsWith('properties.')) {
    //                 normalizedPath = normalizedPath.replace('properties.', '')
    //                 console.log('🔍 DEBUG: Standard normalized path:', normalizedPath)
    //             }

    //             // Handle standard resource prefix paths (e.g., 'io.k8s.api.core.v1.ConfigMap.apiVersion' -> 'apiVersion')
    //             if (resource?.key && normalizedPath.startsWith(resource.key + '.')) {
    //                 normalizedPath = normalizedPath.replace(resource.key + '.', '')
    //                 console.log('🔍 DEBUG: Resource prefix normalized path:', normalizedPath)
    //             }
    //         }

    //         console.log('🔍 DEBUG: Final normalized path:', normalizedPath)
    //         return normalizedPath
    //     }))
    //     console.log('🔍 DEBUG: Final selected paths set:', Array.from(selectedPaths))

    //     // ===== DUMP SELECTED FIELDS SCHEMA =====
    //     console.log('🎯 DEBUG: SELECTED FIELDS SCHEMA DUMP:')
    //     console.log('Selected Fields Array:')
    //     localSelectedFields.forEach((field, index) => {
    //         console.log(`Field ${index + 1}:`, {
    //             path: field.path,
    //             title: field.title,
    //             type: field.type,
    //             required: field.required,
    //             description: field.description
    //         })
    //     })

    //     /**
    //      * Filter schema properties to include only selected fields and apply field configurations
    //      * @param schema - The schema object to filter
    //      * @param currentPath - Current path in the schema hierarchy
    //      * @param depth - Current depth for debugging indentation
    //      * @returns Filtered schema with applied configurations
    //      */
    //     // const filterProperties = (schema: any, currentPath = '', depth = 0) => {
    //     //     const indent = '  '.repeat(depth)
    //     //     console.log(`${indent}🔍 DEBUG: filterProperties called with currentPath: "${currentPath}", depth: ${depth}`)
    //     //     console.log(`${indent}🔍 DEBUG: Resource info:`, { source: resource?.source, key: resource?.key, kind: resource?.kind })
    //     //     console.log(`${indent}🔍 DEBUG: Selected paths:`, Array.from(selectedPaths))

    //     //     // Handle schemas without properties (but may have items for arrays)
    //     //     if (!schema?.properties && !schema?.items) {
    //     //         console.log(`${indent}🔍 DEBUG: No properties or items found in schema`)
    //     //         return schema
    //     //     }

    //     //     let result = { ...schema }

    //     //     // Handle object properties
    //     //     if (schema.properties) {
    //     //         console.log(`${indent}🔍 DEBUG: Schema properties available:`, Object.keys(schema.properties))
    //     //         const filteredProps: any = {}

    //     //         Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
    //     //             const fieldPath = currentPath ? `${currentPath}.${key}` : key

    //     //             console.log(`${indent}🔍 DEBUG: Checking field "${key}" with path "${fieldPath}"`)

    //     //             const isCRD = resource?.source === 'cluster-crds';
    //     //             const crdPrefix = isCRD ? 'spec.versions[0].schema.openAPIV3Schema.properties.' : '';
    //     //             const fullPath = `${crdPrefix}${fieldPath}`

    //     //             // Generate all possible path variations for this field
    //     //             //const pathVariations = getCRDPathVariations(fieldPath, resource);
    //     //             const pathVariations = normalizePath(fieldPath, resource);
    //     //             // Include if this field is selected OR if it has selected children
    //     //             //const isSelected = selectedPaths.has(fieldPath)

    //     //             // Check both with and without CRD prefix
    //     //             const isSelected = pathVariations.some(variation =>
    //     //                 selectedPaths.has(variation)
    //     //             );

    //     //             // const isSelected = selectedPaths.has(fieldPath) ||
    //     //             //     selectedPaths.has(fullPath) ||
    //     //             //     selectedPaths.has(fieldPath.replace('spec.', ''))

    //     //             // console.log(`${indent}🔍 DEBUG: isSelected result: ${isSelected}`)
    //     //             // console.log(`${indent}🔍 DEBUG: Checking for ${resource.kind}.${fieldPath}: ${selectedPaths.has(`${resource.kind}.${fieldPath}`)}`)

    //     //             // const hasSelectedChildren = Array.from(selectedPaths).some(path =>
    //     //             //     path.startsWith(fieldPath + '.')
    //     //             // )

    //     //             // const hasSelectedChildren = Array.from(selectedPaths).some(path => {
    //     //             //     return path.startsWith(`${fieldPath}.`) ||
    //     //             //         path.startsWith(`${fullPath}.`) ||
    //     //             //         path.startsWith(`${fieldPath.replace('spec.', '')}.`)
    //     //             // })

    //     //             // const hasSelectedChildren = Array.from(selectedPaths).some(selectedPath =>
    //     //             //     pathVariations.some(variation =>
    //     //             //         selectedPath.startsWith(`${variation}.`) ||
    //     //             //         selectedPath.startsWith(`${variation}[]`)
    //     //             //     )
    //     //             // );

    //     //             const hasSelectedChildren = Array.from(selectedPaths).some(selectedPath =>
    //     //                 pathVariations.some(variation =>
    //     //                     selectedPath.startsWith(`${variation}.`) ||
    //     //                     selectedPath.startsWith(`${variation}[]`)
    //     //                 )
    //     //             );

    //     //             const isParentOfSelectedPath = Array.from(selectedPaths).some(selectedPath => {
    //     //                 // Check if any selected path starts with this field's path
    //     //                 return pathVariations.some(variation =>
    //     //                     selectedPath.startsWith(variation + '.') ||
    //     //                     selectedPath === variation
    //     //                 );
    //     //             });

    //     //             console.log(`${indent}🔍 DEBUG: hasSelectedChildren result: ${hasSelectedChildren}`)

    //     //             // Check for array item selections (paths with [])
    //     //             // const hasSelectedArrayItems = Array.from(selectedPaths).some(path =>
    //     //             //     path.startsWith(fieldPath + '[]')
    //     //             // )

    //     //             const hasSelectedArrayItems = Array.from(selectedPaths).some(path =>
    //     //                 path.startsWith(fieldPath + '[]') ||
    //     //                 (resource.source === 'cluster-crds' && path.startsWith(`${resource.kind}.${fieldPath}[]`))
    //     //             )

    //     //             if (isSelected || hasSelectedChildren || hasSelectedArrayItems) {
    //     //                 filteredProps[key] = { ...property }

    //     //                 // FIXED: Construct the full field configuration key with resource prefix
    //     //                 const fullFieldConfigKey = resource?.key ? `${resource.key}.${fieldPath}` : fieldPath

    //     //                 // Apply field configurations (custom title and default value)
    //     //                 const fieldConfig = fieldConfigurations[fullFieldConfigKey]
    //     //                 console.log(`🔧 DEBUG: Checking field config for "${key}" with full key "${fullFieldConfigKey}": ${fieldConfig}`)
    //     //                 console.log(`🔧 DEBUG: All fieldConfigurations:`, fieldConfigurations)

    //     //                 if (fieldConfig !== undefined) {
    //     //                     // Apply custom default value if configured
    //     //                     filteredProps[key].default = fieldConfig
    //     //                     console.log(`✅ DEBUG: Applied default value "${fieldConfig}" to field "${key}"`)
    //     //                 }

    //     //                 // FIXED: Apply custom title from selected fields using full path
    //     //                 const selectedField = localSelectedFields.find(f => f.path === fullFieldConfigKey)
    //     //                 if (selectedField && selectedField.title && selectedField.title !== key) {
    //     //                     filteredProps[key].title = selectedField.title
    //     //                     console.log(`✅ DEBUG: Applied custom title "${selectedField.title}" to field "${key}"`)
    //     //                 }

    //     //                 // Also check if the selected field has a defaultValue property
    //     //                 if (selectedField && selectedField.defaultValue !== undefined) {
    //     //                     filteredProps[key].default = selectedField.defaultValue
    //     //                     console.log(`✅ DEBUG: Applied defaultValue "${selectedField.defaultValue}" from selectedField to "${key}"`)
    //     //                 }

    //     //                 console.log(`🔧 DEBUG: Final property for "${key}":`, filteredProps[key])

    //     //                 // Recursively filter nested properties
    //     //                 if (property.properties && hasSelectedChildren) {
    //     //                     const nestedFiltered = filterProperties(property, fieldPath, depth + 1)
    //     //                     filteredProps[key] = {
    //     //                         ...filteredProps[key],
    //     //                         properties: nestedFiltered.properties
    //     //                     }
    //     //                 }

    //     //                 // Handle array items when array items are selected
    //     //                 if (property.type === 'array' && property.items && hasSelectedArrayItems) {
    //     //                     const arrayItemPath = `${fieldPath}[]`
    //     //                     const nestedFiltered = filterProperties(property.items, arrayItemPath, depth + 1)
    //     //                     filteredProps[key] = {
    //     //                         ...filteredProps[key],
    //     //                         items: nestedFiltered
    //     //                     }
    //     //                 }
    //     //             } else {
    //     //                 console.log(`${indent}🔍 DEBUG: EXCLUDING field "${fieldPath}"`)
    //     //             }
    //     //         })

    //     //         result.properties = filteredProps
    //     //         console.log(`${indent}🔍 DEBUG: Filtered properties at depth ${depth}:`, Object.keys(filteredProps))
    //     //     }

    //     //     // Handle array items (when we're filtering an array's items schema)
    //     //     if (schema.items && currentPath.endsWith('[]')) {
    //     //         console.log(`${indent}🔍 DEBUG: Filtering array items schema for path: ${currentPath}`)
    //     //         const filteredItems = filterProperties(schema.items, currentPath, depth + 1)
    //     //         result.items = filteredItems
    //     //     }

    //     //     return result
    //     // }


    //     // ... existing code ...

    //     const filterProperties = (schema: any, currentPath = '', depth = 0) => {
    //         const indent = '  '.repeat(depth)
    //         console.log(`${indent}🔍 DEBUG: filterProperties called with currentPath: "${currentPath}", depth: ${depth}`)
    //         console.log(`${indent}🔍 DEBUG: Resource info:`, { source: resource?.source, key: resource?.key, kind: resource?.kind })
    //         console.log(`${indent}🔍 DEBUG: Selected paths:`, Array.from(selectedPaths))

    //         // Handle schemas without properties (but may have items for arrays)
    //         if (!schema?.properties && !schema?.items) {
    //             console.log(`${indent}🔍 DEBUG: No properties or items found in schema`)
    //             return schema
    //         }

    //         let result = { ...schema }

    //         // Handle object properties
    //         if (schema.properties) {
    //             console.log(`${indent}🔍 DEBUG: Schema properties available:`, Object.keys(schema.properties))
    //             const filteredProps: any = {}

    //             Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
    //                 const fieldPath = currentPath ? `${currentPath}.${key}` : key

    //                 console.log(`${indent}🔍 DEBUG: Checking field "${key}" with path "${fieldPath}"`)

    //                 const isCRD = resource?.source === 'cluster-crds';
    //                 const crdPrefix = isCRD ? 'spec.versions[0].schema.openAPIV3Schema.properties.' : '';
    //                 const fullPath = `${crdPrefix}${fieldPath}`

    //                 // Generate all possible path variations for this field
    //                 const pathVariations = normalizePath(fieldPath, resource);

    //                 // Check if this field is selected
    //                 const isSelected = pathVariations.some(variation =>
    //                     selectedPaths.has(variation)
    //                 );

    //                 // FIXED: Improved hasSelectedChildren logic with special handling for spec field
    //                 let hasSelectedChildren = false;

    //                 if (key === 'spec' && property.properties) {
    //                     // Special handling for spec field - use hasSpecSelectedChildren
    //                     hasSelectedChildren = hasSpecSelectedChildren(selectedPaths, property.properties);
    //                     console.log(`${indent}🔍 DEBUG: Using hasSpecSelectedChildren for spec field: ${hasSelectedChildren}`)
    //                 } else {
    //                     // Regular hasSelectedChildren logic for other fields
    //                     hasSelectedChildren = Array.from(selectedPaths).some(selectedPath =>
    //                         pathVariations.some(variation =>
    //                             selectedPath.startsWith(`${variation}.`) ||
    //                             selectedPath.startsWith(`${variation}[]`)
    //                         )
    //                     );
    //                 }

    //                 const isParentOfSelectedPath = Array.from(selectedPaths).some(selectedPath => {
    //                     // Check if any selected path starts with this field's path
    //                     return pathVariations.some(variation =>
    //                         selectedPath.startsWith(variation + '.') ||
    //                         selectedPath === variation
    //                     );
    //                 });

    //                 console.log(`${indent}🔍 DEBUG: hasSelectedChildren result: ${hasSelectedChildren}`)

    //                 // Check for array item selections (paths with [])
    //                 const hasSelectedArrayItems = Array.from(selectedPaths).some(path =>
    //                     path.startsWith(fieldPath + '[]') ||
    //                     (resource.source === 'cluster-crds' && path.startsWith(`${resource.kind}.${fieldPath}[]`))
    //                 )

    //                 if (isSelected || hasSelectedChildren || hasSelectedArrayItems) {
    //                     filteredProps[key] = { ...property }

    //                     // FIXED: Construct the full field configuration key with resource prefix
    //                     const fullFieldConfigKey = resource?.key ? `${resource.key}.${fieldPath}` : fieldPath

    //                     // Apply field configurations (custom title and default value)
    //                     const fieldConfig = fieldConfigurations[fullFieldConfigKey]
    //                     console.log(`🔧 DEBUG: Checking field config for "${key}" with full key "${fullFieldConfigKey}": ${fieldConfig}`)
    //                     console.log(`🔧 DEBUG: All fieldConfigurations:`, fieldConfigurations)

    //                     if (fieldConfig !== undefined) {
    //                         // Apply custom default value if configured
    //                         filteredProps[key].default = fieldConfig
    //                         console.log(`✅ DEBUG: Applied default value "${fieldConfig}" to field "${key}"`)
    //                     }

    //                     // FIXED: Apply custom title from selected fields using full path
    //                     const selectedField = localSelectedFields.find(f => f.path === fullFieldConfigKey)
    //                     if (selectedField && selectedField.title && selectedField.title !== key) {
    //                         filteredProps[key].title = selectedField.title
    //                         console.log(`✅ DEBUG: Applied custom title "${selectedField.title}" to field "${key}"`)
    //                     }

    //                     // Also check if the selected field has a defaultValue property
    //                     if (selectedField && selectedField.defaultValue !== undefined) {
    //                         filteredProps[key].default = selectedField.defaultValue
    //                         console.log(`✅ DEBUG: Applied defaultValue "${selectedField.defaultValue}" from selectedField to "${key}"`)
    //                     }

    //                     console.log(`🔧 DEBUG: Final property for "${key}":`, filteredProps[key])

    //                     // Recursively filter nested properties
    //                     if (property.properties && hasSelectedChildren) {
    //                         const nestedFiltered = filterProperties(property, fieldPath, depth + 1)
    //                         filteredProps[key] = {
    //                             ...filteredProps[key],
    //                             properties: nestedFiltered.properties
    //                         }
    //                     }

    //                     // Handle array items when array items are selected
    //                     if (property.type === 'array' && property.items && hasSelectedArrayItems) {
    //                         const arrayItemPath = `${fieldPath}[]`
    //                         const nestedFiltered = filterProperties(property.items, arrayItemPath, depth + 1)
    //                         filteredProps[key] = {
    //                             ...filteredProps[key],
    //                             items: nestedFiltered
    //                         }
    //                     }
    //                 } else {
    //                     console.log(`${indent}🔍 DEBUG: EXCLUDING field "${fieldPath}"`)
    //                 }
    //             })

    //             result.properties = filteredProps
    //             console.log(`${indent}🔍 DEBUG: Filtered properties at depth ${depth}:`, Object.keys(filteredProps))
    //         }

    //         // Handle array items (when we're filtering an array's items schema)
    //         if (schema.items && currentPath.endsWith('[]')) {
    //             console.log(`${indent}🔍 DEBUG: Filtering array items schema for path: ${currentPath}`)
    //             const filteredItems = filterProperties(schema.items, currentPath, depth + 1)
    //             result.items = filteredItems
    //         }

    //         return result
    //     }

    //     const filtered = filterProperties(resolvedSchema, '', 0)

    //     // Ensure we always include apiVersion, kind, and metadata (with limited fields)
    //     if (filtered.properties) {
    //         // Preserve apiVersion and kind if they exist in the original schema
    //         if (resolvedSchema.properties?.apiVersion) {
    //             filtered.properties.apiVersion = resolvedSchema.properties.apiVersion;
    //         }
    //         if (resolvedSchema.properties?.kind) {
    //             filtered.properties.kind = resolvedSchema.properties.kind;
    //         }

    //         // Include metadata with only labels and annotations if they exist
    //         if (resolvedSchema.properties?.metadata) {
    //             filtered.properties.metadata = {
    //                 type: 'object',
    //                 properties: {}
    //             };

    //             // Add labels if it exists in the original schema
    //             if (resolvedSchema.properties.metadata.properties?.labels) {
    //                 filtered.properties.metadata.properties.labels =
    //                     resolvedSchema.properties.metadata.properties.labels;
    //             }

    //             // Add annotations if it exists in the original schema
    //             if (resolvedSchema.properties.metadata.properties?.annotations) {
    //                 filtered.properties.metadata.properties.annotations =
    //                     resolvedSchema.properties.metadata.properties.annotations;
    //             }
    //         }

    //         // Check if any selected fields are related to spec (either with or without the prefix)
    //         const hasSpecRelatedFields = localSelectedFields.some(f => {
    //             const path = f.path;
    //             return path.includes('spec.') ||
    //                 (resource?.source === 'cluster-crds' &&
    //                     Array.from(selectedPaths).some(sp =>
    //                         sp.startsWith('spec.') ||
    //                         (!sp.includes('.') && resolvedSchema.properties?.spec?.properties?.[sp])
    //                     ));
    //         });

    //         if (resolvedSchema.properties?.spec && hasSpecRelatedFields) {
    //             // Instead of filtering the spec object, preserve its structure and properties
    //             filtered.properties.spec = {
    //                 ...resolvedSchema.properties.spec,
    //                 properties: {}
    //             };

    //             // Add only the selected properties to the spec object
    //             if (resolvedSchema.properties.spec.properties) {
    //                 Object.entries(resolvedSchema.properties.spec.properties).forEach(([key, property]) => {
    //                     const specPath = `spec.${key}`;
    //                     const normalizedPaths = normalizePath(specPath, resource);

    //                     // Check if this property or any of its children are selected
    //                     const isSelected = normalizedPaths.some(path => selectedPaths.has(path));
    //                     const hasSelectedChildren = Array.from(selectedPaths).some(selectedPath =>
    //                         normalizedPaths.some(variation =>
    //                             selectedPath.startsWith(`${variation}.`) ||
    //                             selectedPath.startsWith(`${variation}[]`)
    //                         )
    //                     );

    //                     if (isSelected || hasSelectedChildren) {
    //                         // If selected, add this property to the filtered spec
    //                         filtered.properties.spec.properties[key] = property;

    //                         // If it has selected children, recursively filter its properties
    //                         if (hasSelectedChildren && property.properties) {
    //                             const nestedFiltered = filterProperties(property, specPath, 1);
    //                             filtered.properties.spec.properties[key] = nestedFiltered;
    //                         }
    //                     }
    //                 });
    //             }
    //         }

    //         // Add spec field if it exists in the original schema and we have selected fields that start with spec.
    //         if (resolvedSchema.properties?.spec && localSelectedFields.some(f => f.path.includes('spec.'))) {
    //             // Create a filtered spec object with only the selected fields
    //             const specFiltered = filterProperties(resolvedSchema.properties.spec, 'spec', 0);
    //             filtered.properties.spec = specFiltered;
    //         } else if (resolvedSchema.properties?.spec) {
    //             // Check if any normalized paths match spec's children
    //             const hasSpecChildren = hasSpecSelectedChildren(
    //                 selectedPaths,
    //                 resolvedSchema.properties.spec.properties
    //             );

    //             if (hasSpecChildren) {
    //                 // Create a filtered spec object with only the selected fields
    //                 const specFiltered = filterProperties(resolvedSchema.properties.spec, 'spec', 0);
    //                 filtered.properties.spec = specFiltered;
    //             }
    //         }            // Add status field if it exists in the original schema and we have selected fields that start with status.
    //         if (resolvedSchema.properties?.status && localSelectedFields.some(f => f.path.includes('status.'))) {
    //             // Create a filtered status object with only the selected fields
    //             const statusFiltered = filterProperties(resolvedSchema.properties.status, 'status', 0);
    //             filtered.properties.status = statusFiltered;
    //         }

    //         // Add operation field if it exists in the original schema and we have selected fields that start with operation.
    //         if (resolvedSchema.properties?.operation && localSelectedFields.some(f => f.path.includes('operation.'))) {
    //             // Create a filtered operation object with only the selected fields
    //             const operationFiltered = filterProperties(resolvedSchema.properties.operation, 'operation', 0);
    //             filtered.properties.operation = operationFiltered;
    //         }
    //     }

    //     console.log('🎯 DEBUG: Final filtered schema properties:', Object.keys(filtered.properties || {}));

    //     // DUMP FINAL FILTERED SCHEMA
    //     console.log('🔍 DEBUG: FINAL FILTERED SCHEMA DUMP:')
    //     console.log(JSON.stringify(filtered, null, 2))

    //     return filtered
    // }, [resource?.schema, localSelectedFields, resource?.source, resource?.key, resource?.kind, schemaTimestamp, fieldConfigurations])


    /**
     * Universal path normalization function that strips any resource prefix
     * to get relative paths that match tree node paths
     */
    const findMatchingTreeNodes = (
        selectedFields: TemplateField[],
        treeNodes: SchemaTreeNode[],
        resourceKey: string
    ): Set<string> => {
        const matchedPaths = new Set<string>();

        console.log('🔍 Starting universal field matching with:', {
            selectedFieldsCount: selectedFields.length,
            treeNodesCount: treeNodes.length,
            resourceKey
        });

        /**
         * Build a map of all tree nodes by their path for quick lookup
         */
        const nodeMap = new Map<string, SchemaTreeNode>();
        const buildNodeMap = (nodes: SchemaTreeNode[]) => {
            nodes.forEach(node => {
                nodeMap.set(node.path, node);
                if (node.children && node.children.length > 0) {
                    buildNodeMap(node.children);
                }
            });
        };
        buildNodeMap(treeNodes);

        console.log('🔍 Available tree node paths:', Array.from(nodeMap.keys()));

        /**
         * Universal path normalization: strip any resource prefix to get relative paths
         * This handles cases where selectedFields have full resource paths but tree uses relative paths
         */
        const normalizedSelectedPaths = selectedFields.map(field => {
            let normalizedPath = field.path;

            // Strategy 1: Remove current resourceKey prefix if present
            if (normalizedPath.startsWith(`${resourceKey}.`)) {
                normalizedPath = normalizedPath.substring(`${resourceKey}.`.length);
                console.log('🔍 Removed current resourceKey prefix:', { original: field.path, normalized: normalizedPath });
                return normalizedPath;
            }

            // Strategy 2: Remove any resource-like prefix (contains dots and ends with a dot)
            // Pattern: "some.resource.key.field.path" -> "field.path"
            const parts = normalizedPath.split('.');
            if (parts.length > 2) {
                // Look for common K8s field patterns to determine where the resource prefix ends
                const commonK8sFields = ['metadata', 'spec', 'data', 'status', 'kind', 'apiVersion'];

                for (let i = 0; i < parts.length; i++) {
                    if (commonK8sFields.includes(parts[i])) {
                        normalizedPath = parts.slice(i).join('.');
                        console.log('🔍 Found K8s field boundary, normalized:', {
                            original: field.path,
                            normalized: normalizedPath,
                            boundary: parts[i]
                        });
                        break;
                    }
                }
            }

            console.log('🔍 Path normalization result:', { original: field.path, normalized: normalizedPath });
            return normalizedPath;
        });

        /**
         * Match normalized paths against tree nodes
         */
        normalizedSelectedPaths.forEach((selectedPath, index) => {
            console.log('🔍 Processing selected path:', selectedPath);

            if (nodeMap.has(selectedPath)) {
                matchedPaths.add(selectedPath);
                console.log('✅ Matched path found:', selectedPath);
            } else {
                console.log('⚠️ Selected path not found in tree:', selectedPath);
                console.log('🔍 Original field path was:', selectedFields[index].path);
            }
        });

        console.log('🔍 Universal field matching complete:', {
            totalMatches: matchedPaths.size,
            matchedPaths: Array.from(matchedPaths),
            normalizedSelectedPaths
        });

        return matchedPaths;
    };
    /**
         * Memoized filtered schema that applies field configurations and filters based on selected fields
         */
    /**
     * FIXED: Use the working filteredSchema implementation with proper path normalization
     */
    const filteredSchema = useMemo(() => {
        console.log('🔄 Building schema from selected tree nodes - Timestamp:', schemaTimestamp)
        console.log('🔧 DEBUG: Current localSelectedFields:', localSelectedFields.map(f => ({ path: f.path, title: f.title })))

        if (!resource?.schema || localSelectedFields.length === 0) {
            return {}
        }

        // FIXED: Use our working path normalization utilities for all resources
        console.log('🔍 DEBUG: Available tree node paths:', schemaTree.map(n => n.path))
        console.log('🔍 DEBUG: Schema tree nodes:', schemaTree.length)

        // Convert selected fields to normalized paths
        const resourceKey = resource.key || `${resource.apiVersion}/${resource.kind}`;
        const selectedPaths = new Set(
            localSelectedFields.map(field => normalizeFieldPath(field.path, resourceKey))
        );

        console.log('🔍 FIXED: Selected paths after normalization:', Array.from(selectedPaths))

        // Use our working tree-based schema building approach
        const result = buildSchemaFromSelectedNodes(resource.schema, selectedPaths, schemaTree)

        console.log('✅ Built filtered schema with fixed utilities:', result)
        return result

    }, [resource?.schema, localSelectedFields, schemaTimestamp, schemaTree, resource?.source, resource?.kind, resource?.key])

    // const filteredSchema = useMemo(() => {
    //     if (!resource?.schema || localSelectedFields.length === 0) {
    //         return {}
    //     }

    //     const resolvedSchema = resource.schema
    //     const selectedPaths = new Set(localSelectedFields.map(f => {
    //         // Extract the actual field path by removing the resource prefix
    //         const resourceKey = resource?.key || `${resource?.apiVersion}/${resource?.kind}`;
    //         return f.path.startsWith(`${resourceKey}.`) ? f.path.substring(`${resourceKey}.`.length) : f.path;
    //     }));

    //     console.log('🔍 DEBUG: Selected paths for filtering:', Array.from(selectedPaths));
    //     console.log('🔍 DEBUG: Available tree nodes:', schemaTree);

    //     // Use the new tree-based approach instead of complex path normalization
    //     if (schemaTree && schemaTree.length > 0) {
    //         return buildSchemaFromSelectedNodes(resolvedSchema, selectedPaths, schemaTree);
    //     }

    //     // Fallback to empty schema if no tree is available
    //     return {};
    // }, [resource?.schema, localSelectedFields, resource?.source, resource?.key, resource?.kind, schemaTimestamp, fieldConfigurations, schemaTree])

    const memoizedSelectedSchema = useMemo(() => {
        return JSON.stringify(filteredSchema, null, 2);
    }, [filteredSchema]);

    useEffect(() => {
        if (resourceKey && filteredSchema && Object.keys(filteredSchema).length > 0) {
            console.log('🔄 Persisting filtered schema for resource:', resourceKey)
            persistSelectedFieldsSchema(resourceKey, filteredSchema)
        }
    }, [filteredSchema, resourceKey])

    /**
     * Parse schema properties with reference resolution
     * @param schema - The schema to parse
     * @param prefix - Field path prefix
     * @param level - Nesting level for UI indentation
     */
    const parseSchemaProperties = (
        schema: any,
        prefix: string = '',
        level: number = 0
    ): SchemaProperty[] => {
        if (!schema?.properties) return []

        const properties: SchemaProperty[] = []

        Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
            const fieldPath = prefix ? `${prefix}.${key}` : key

            // Resolve references before processing
            const { resolved: resolvedProperty, isReference } = resolveSchemaReference(
                property,
                resource?.schema
            )

            // Determine if this property has children
            const hasChildren = (
                (resolvedProperty.type === 'object' && resolvedProperty.properties) ||
                (resolvedProperty.type === 'array' &&
                    resolvedProperty.items?.type === 'object' &&
                    resolvedProperty.items?.properties)
            )

            properties.push({
                name: key,
                path: fieldPath,
                type: resolvedProperty.type || 'unknown',
                description: resolvedProperty.description || '',
                required: schema.required?.includes(key) || false,
                hasChildren,
                isReference, // Set the reference flag
                level,
                enum: resolvedProperty.enum
            })

            // Recursively process nested objects
            if (hasChildren && expandedObjects[fieldPath]) {
                if (resolvedProperty.type === 'object') {
                    properties.push(...parseSchemaProperties(
                        resolvedProperty,
                        fieldPath,
                        level + 1
                    ))
                } else if (resolvedProperty.type === 'array' && resolvedProperty.items) {
                    properties.push(...parseSchemaProperties(
                        resolvedProperty.items,
                        `${fieldPath}[]`,
                        level + 1
                    ))
                }
            }
        })

        return properties
    }

    const schemaProperties = useMemo(() => {
        if (!resource?.schema) {
            return []
        }
        return parseSchemaProperties(resource.schema)
    }, [resource])

    /**
     * Toggle expansion of object properties with persistence
     */
    const toggleObjectExpansion = (path: string) => {
        setExpandedObjects(prev => {
            const newSet = new Set(prev)
            if (newSet.has(path)) {
                newSet.delete(path)
            } else {
                newSet.add(path)
            }
            return newSet
        })
    }

    /**
     * Handle schema preview
     */
    const handlePreviewSchema = () => {
        if (resource?.schema) {
            //console.log('🔍 Raw Schema Structure:', JSON.stringify(resource.schema, null, 2))
            //console.log('🔍 Parsed Schema Properties:', schemaProperties)
            setShowSchemaPreview(true)
        }
    }

    /**
     * Handle preview of selected fields only
     */
    const handlePreviewSelected = () => {
        if (localSelectedFields.length > 0) {
            setShowSelectedPreview(true)
        }

    }

    // Update the handleFieldToggle function to ensure immediate persistence (around line 812)
    const handleFieldToggle = (property: SchemaProperty, checked: boolean) => {
        const field: TemplateField = {
            path: property.path,
            title: property.name,
            type: property.type,
            required: property.required || false,
            description: property.description,
            format: property.format,
            templateType: property.templateType || 'kubernetes',
            constraints: property.enum ? { enum: property.enum } : undefined
        }

        if (checked) {
            setLocalSelectedFields(prev => {
                // Remove any child fields if selecting parent object
                const filteredFields = prev.filter(f => !f.path.startsWith(property.path + '.'))
                const newFields = [...filteredFields, field]

                // Trigger immediate persistence of filtered schema
                setTimeout(() => {
                    if (resourceKey) {
                        const currentFilteredSchema = /* filteredSchema will be recalculated */
                            console.log('🔄 Field added, persisting updated schema:', property.path)
                    }
                }, 0)

                return newFields
            })

            // Auto-expand object if it has children
            if (property.hasChildren) {
                setExpandedObjects(prev => new Set([...prev, property.path]))
            }
        } else {
            setLocalSelectedFields(prev => {
                // Remove this field and any child fields
                const newFields = prev.filter(f => !f.path.startsWith(property.path) && f.path !== property.path)

                // Trigger immediate persistence of filtered schema
                setTimeout(() => {
                    if (resourceKey) {
                        console.log('🔄 Field removed, persisting updated schema:', property.path)
                    }
                }, 0)

                return newFields
            })
        }
    }


    /**
     * Clear all selected fields
     */
    const handleClearAll = () => {
        setLocalSelectedFields([]);
    };

    const handleRemoveField = (fieldPath: string) => {
        setLocalSelectedFields(prev => prev.filter(f => f.path !== fieldPath));
    };

    // const handleSelectedFieldClick = (fieldPath: string) => {
    //     // Find the field in the schema tree and expand its parent path
    //     const pathParts = fieldPath.split('.');
    //     const newExpanded = new Set(expandedObjects);

    //     // Expand all parent paths
    //     for (let i = 1; i <= pathParts.length; i++) {
    //         const parentPath = pathParts.slice(0, i).join('.');
    //         newExpanded.add(parentPath);
    //     }

    //     setExpandedObjects(newExpanded);

    //     // Set the highlighted field
    //     setHighlightedFieldPath(fieldPath);

    //     // Optional: Clear highlight after a few seconds
    //     setTimeout(() => {
    //         setHighlightedFieldPath(null);
    //     }, 3000);
    // };

    const handleSelectedFieldClick = (fieldPath: string) => {
        // Find the field in the schema tree and expand its parent path
        const pathParts = fieldPath.split('.');
        const newExpanded = new Set(expandedObjects);

        // Expand all parent paths
        for (let i = 1; i <= pathParts.length; i++) {
            const parentPath = pathParts.slice(0, i).join('.');
            newExpanded.add(parentPath);
        }

        setExpandedObjects(newExpanded);

        // Set the highlighted field
        setHighlightedFieldPath(fieldPath);

        // Find the selected field and convert it to EnhancedTemplateField for configuration
        // const selectedField = localSelectedFields.find(f => f.path === fieldPath);
        // if (selectedField) {
        //     const enhancedField: EnhancedTemplateField = {
        //         path: selectedField.path,
        //         title: selectedField.title,
        //         type: selectedField.type,
        //         required: selectedField.required,
        //         description: selectedField.description,
        //         defaultValue: fieldConfigurations[fieldPath] || undefined,
        //         hasDefaultValue: fieldConfigurations[fieldPath] !== undefined,
        //         isConfigured: fieldConfigurations[fieldPath] !== undefined
        //     };
        //     setSelectedFieldForConfig(enhancedField);
        // }

        const selectedField = localSelectedFields.find(f => f.path === fieldPath)
        if (selectedField) {
            const enhancedField: EnhancedTemplateField = {
                ...selectedField,
                defaultValue: fieldConfigurations[selectedField.path],
                arrayConfig: arrayConfigurations[selectedField.path] || []
            }
            setSelectedFieldForConfig(enhancedField)
        }

        // Optional: Clear highlight after a few seconds
        setTimeout(() => {
            setHighlightedFieldPath(null);
        }, 3000);
    };

    const handleToggleExpand = (path: string) => {
        const newExpanded = new Set(expandedObjects);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedObjects(newExpanded);
    };

    /**
     * Check if a field is currently selected
     */
    const isFieldSelected = (path: string) => {
        return localSelectedFields.some(field => field.path === path)
    }

    /**
     * Check if field is partially selected (some children selected)
     */
    const isPartiallySelected = (property: SchemaProperty) => {
        if (!property.hasChildren) return false
        const childPaths = getAllChildPaths(property)
        const selectedChildPaths = localSelectedFields.filter(f =>
            childPaths.some(childPath => f.path.startsWith(childPath))
        )
        return selectedChildPaths.length > 0 && selectedChildPaths.length < childPaths.length
    }

    /**
     * Get all possible child paths for an object property
     */
    const getAllChildPaths = (property: SchemaProperty): string[] => {
        const paths: string[] = []

        const collectPaths = (prop: SchemaProperty) => {
            paths.push(prop.path)
            if (prop.properties) {
                prop.properties.forEach(collectPaths)
            }
            if (prop.items) {
                collectPaths(prop.items)
            }
        }

        if (property.properties) {
            property.properties.forEach(collectPaths)
        }
        if (property.items) {
            collectPaths(property.items)
        }

        return paths
    }

    /**
     * Render a schema property with improved expand/collapse functionality
     */
    const renderProperty = (property: SchemaProperty, level = 0) => {
        const isSelected = isFieldSelected(property.path)
        const isPartial = isPartiallySelected(property)
        const isExpanded = expandedObjects.has(property.path)
        const indent = level * 20

        return (
            <div key={property.path} className="space-y-1">
                <div
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    style={{ marginLeft: `${indent}px` }}
                >
                    {/* Expansion toggle for objects */}
                    {property.hasChildren ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                            onClick={() => toggleObjectExpansion(property.path)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ChevronRight className="h-3 w-3" />
                            )}
                        </Button>
                    ) : (
                        <div className="w-6" />
                    )}

                    <Checkbox
                        id={property.path}
                        checked={isSelected}
                        ref={(el: { indeterminate: boolean }) => {
                            if (el && isPartial) {
                                el.indeterminate = true
                            }
                        }}
                        onCheckedChange={(checked: boolean) => handleFieldToggle(property, checked as boolean)}
                    />

                    <div className="flex-1 flex items-center space-x-2">
                        <label
                            htmlFor={property.path}
                            className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100"
                        >
                            {property.name}
                        </label>
                        {property.required && (
                            <Badge variant="destructive" className="text-xs px-1 py-0">Required</Badge>
                        )}
                        <Badge
                            variant="secondary"
                            className="text-xs px-1 py-0 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                            {property.type}
                        </Badge>
                        {property.hasChildren && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                                {property.properties?.length || 0} fields
                            </Badge>
                        )}
                        {property.isReference && (
                            <Badge variant="outline" className="ml-2 text-xs">
                                ref
                            </Badge>
                        )}
                        {property.enum && property.enum.length > 0 && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                                enum
                            </Badge>
                        )}
                        <DescriptionTooltip description={property.description} />
                    </div>
                </div>

                {/* Render nested properties when expanded */}
                {property.hasChildren && isExpanded && property.properties && (
                    <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                        {property.properties.map(nestedProp =>
                            renderProperty(nestedProp, level + 1)
                        )}
                    </div>
                )}
                {property.hasChildren && isExpanded && property.items && (
                    <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                        {renderProperty(property.items, level + 1)}
                    </div>
                )}
            </div>
        )
    }

    /**
     * Handle save with persistence
     */
    const handleSave = () => {

        // Persist the filtered schema when saving
        if (resourceKey && filteredSchema && Object.keys(filteredSchema).length > 0) {
            console.log('💾 Saving filtered schema on confirm:', resourceKey)
            persistSelectedFieldsSchema(resourceKey, filteredSchema)
        }

        onFieldsChange(localSelectedFields)
        onClose()
    }

    /**
     * Handle cancel - reset to original selection
     */
    const handleCancel = () => {
        setLocalSelectedFields(selectedFields)
        onClose()
    }

    if (!resource) return null

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <span>Configure Fields for {resource.kind}</span>
                        <Badge variant="outline">{resource.apiVersion}</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Select the fields you want to include in your template. Selections are automatically saved and restored.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                    {/* Left Panel - Schema Display */}
                    <Card className="flex flex-col min-h-0">
                        <CardHeader className="flex-shrink-0">
                            <CardTitle className="text-lg">Schema Structure</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 p-0">
                            <ScrollArea className="h-full">
                                <div className="p-4">
                                    {isLoadingSchema ? (
                                        <div className="flex items-center justify-center h-32">
                                            <div className="text-gray-500">Loading schema...</div>
                                        </div>
                                    ) : (
                                        <SchemaTreeView
                                            nodes={schemaTree}
                                            onFieldSelect={(path, type, name, description, required, items) => {
                                                // Debug logging for field selection
                                                console.log('🔧 DEBUG onFieldSelect called:', {
                                                    path,
                                                    type,
                                                    name,
                                                    description,
                                                    required,
                                                    items,
                                                    itemsType: typeof items,
                                                    itemsStringified: items ? JSON.stringify(items, null, 2) : 'undefined'
                                                });

                                                const field: TemplateField = {
                                                    path,
                                                    title: name,
                                                    type,
                                                    description: description || '',
                                                    required: required || false,
                                                    ...(type === 'array' && items && { items })
                                                };

                                                // Debug the created field
                                                console.log('🔧 DEBUG Created field:', field);

                                                // Toggle selection
                                                const isSelected = localSelectedFields.some(f => f.path === path);
                                                if (isSelected) {
                                                    setLocalSelectedFields(prev => prev.filter(f => f.path !== path));
                                                } else {
                                                    setLocalSelectedFields(prev => [...prev, field]);
                                                }
                                            }}
                                            selectedPaths={new Set(localSelectedFields.map(f => f.path))}
                                            expandedPaths={expandedObjects}
                                            onToggleExpand={handleToggleExpand}
                                            highlightedPath={highlightedFieldPath} // Add this prop
                                        />
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Right Panel - Selected Fields Summary */}
                    <Card className="flex flex-col min-h-0">
                        <CardHeader className="flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">
                                    Selected Fields ({localSelectedFields.length})
                                </CardTitle>
                                {localSelectedFields.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleClearAll}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        Clear All
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                {localSelectedFields.length === 0 ? (
                                    <div className="text-center text-gray-500 mt-8">
                                        No fields selected yet.
                                        <br />
                                        Select fields from the schema on the left.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {localSelectedFields.map((field, index) => (
                                            <div
                                                key={field.path}
                                                className={`p-3 border rounded-lg transition-all duration-300 ${highlightedFieldPath === field.path
                                                    ? 'hover:bg-gray-50 dark:hover:bg-gray-800 transform scale-105 shadow-lg'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium">{field.title}</span>
                                                        {field.required && (
                                                            <Badge variant="destructive" className="text-xs">Required</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {field.type}
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleOpenFieldConfig(field)}
                                                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                            title="Configure field"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveField(field.path);
                                                            }}
                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                            title="Remove field"
                                                        >
                                                            <span className="text-lg font-medium">×</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">{field.path}</div>
                                                {field.description && (
                                                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{field.description}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <Separator />

                <DialogFooter className="flex-shrink-0 flex flex-row justify-between items-center w-full">
                    <div className="flex space-x-2 mr-auto">
                        <Button
                            variant="outline"
                            onClick={handlePreviewSchema}
                        >
                            Preview Schema
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePreviewSelected}
                            disabled={localSelectedFields.length === 0}
                            className={localSelectedFields.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                            Preview Selected ({localSelectedFields.length})
                        </Button>

                    </div>
                    <div className="flex space-x-2 ml-auto">
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>

                        {/* <Button
                            variant="secondary"
                            onClick={() => {
                                onFieldsChange(localSelectedFields)
                                onOpenConfiguration?.(localSelectedFields)
                            }}
                            disabled={localSelectedFields.length === 0}
                        >
                            Configure Fields ({localSelectedFields.length})
                        </Button> */}

                        <Button onClick={handleSave}>
                            Save Selection ({localSelectedFields.length} fields)
                        </Button>
                    </div>
                </DialogFooter>

                {showSelectedPreview && (
                    <Dialog open={showSelectedPreview} onOpenChange={setShowSelectedPreview}>
                        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                    <span>Selected Fields Schema - {resource?.kind} ({localSelectedFields.length} fields)</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(memoizedSelectedSchema)
                                                // You could add a toast notification here
                                            } catch (error) {
                                                console.error('Failed to copy to clipboard:', error)
                                            }
                                        }}
                                        className="flex items-center space-x-2"
                                    >
                                        <Copy className="h-4 w-4" />
                                        <span>Copy</span>
                                    </Button>
                                </DialogTitle>
                                <DialogDescription>
                                    This shows the schema structure for only the selected fields with syntax highlighting and line numbers
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 min-h-0">
                                <ScrollArea className="h-full">
                                    <SyntaxHighlighter
                                        language="json"
                                        style={oneDark}
                                        showLineNumbers={true}
                                        lineNumberStyle={{
                                            minWidth: '3em',
                                            paddingRight: '1em',
                                            color: '#6b7280',
                                            borderRight: '1px solid #374151',
                                            marginRight: '1em',
                                            textAlign: 'right'
                                        }}
                                        customStyle={{
                                            margin: 0,
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.5'
                                        }}
                                        codeTagProps={{
                                            style: {
                                                fontFamily: 'Fira Code, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New, monospace'
                                            }
                                        }}
                                    >
                                        {memoizedSelectedSchema}
                                    </SyntaxHighlighter>
                                </ScrollArea>
                            </div>
                            <DialogFooter>
                                <Button onClick={() => setShowSelectedPreview(false)}>
                                    Close
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Full Schema Preview Modal - Simple View Only */}
                {showSchemaPreview && (
                    <Dialog open={showSchemaPreview} onOpenChange={setShowSchemaPreview}>
                        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span>Full Schema Preview - {resource?.kind}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {schemaMetrics.sizeFormatted} • {schemaMetrics.lineCount.toLocaleString()} lines
                                        </Badge>
                                        {schemaMetrics.isTooLarge && (
                                            <Badge variant="destructive" className="text-xs">
                                                Too Large to Display
                                            </Badge>
                                        )}
                                        {/* {isSchemaLarge && !schemaMetrics.isTooLarge && (
                                            <Badge variant="warning" className="text-xs">
                                                Large Schema
                                            </Badge>
                                        )} */}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(memoizedFullSchema)
                                                } catch (error) {
                                                    console.error('Failed to copy to clipboard:', error)
                                                }
                                            }}
                                            className="flex items-center space-x-2"
                                        >
                                            <Copy className="h-4 w-4" />
                                            <span>Copy</span>
                                        </Button>
                                    </div>
                                </DialogTitle>
                                <DialogDescription>
                                    {schemaMetrics.isTooLarge
                                        ? 'Schema is too large to display in the UI. Use the copy button to get the full content.'
                                        : 'Complete schema structure in plain text format for optimal performance'
                                    }
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 min-h-0">
                                {schemaMetrics.isTooLarge ? (
                                    // Show message for extremely large schemas
                                    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                                        <div className="text-center p-8">
                                            <div className="text-6xl mb-4">📄</div>
                                            <h3 className="text-lg font-semibold mb-2">Schema Too Large to Display</h3>
                                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                                This schema is {schemaMetrics.sizeFormatted} ({schemaMetrics.lineCount.toLocaleString()} lines) which is too large to render safely.
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-500">
                                                Use the Copy button above to get the full schema content.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    // Simple, performant text view
                                    <ScrollArea className="h-full">
                                        <pre
                                            className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 border-0 overflow-auto whitespace-pre-wrap break-words rounded-lg"
                                            style={{
                                                fontFamily: 'Fira Code, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New, monospace',
                                                fontSize: '0.875rem',
                                                lineHeight: '1.5',
                                                margin: 0,
                                                minHeight: '100%',
                                                tabSize: 2
                                            }}
                                        >
                                            {memoizedFullSchema}
                                        </pre>
                                    </ScrollArea>
                                )}
                            </div>
                            <DialogFooter>
                                <Button onClick={() => setShowSchemaPreview(false)}>
                                    Close
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Field Configuration Modal */}
                <Dialog open={showFieldConfigModal} onOpenChange={handleCloseFieldConfig}>
                    <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="flex items-center space-x-2">
                                <span>Configure Field: {selectedFieldForConfig?.title}</span>
                                <Badge variant="outline">{selectedFieldForConfig?.type}</Badge>
                            </DialogTitle>
                            <DialogDescription>
                                Configure default values and behavior for this field.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 min-h-0">
                            {selectedFieldForConfig && (
                                <FieldConfigurationPanel
                                    field={selectedFieldForConfig}
                                    onDefaultValueChange={handleDefaultValueChange}
                                    onNestedFieldToggle={handleNestedFieldToggle}
                                    onArrayConfigChange={handleArrayConfigChange}
                                />
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseFieldConfig}>
                                Cancel
                            </Button>
                            <Button onClick={handleCloseFieldConfig}>
                                Save Configuration
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    )
}

/**
 * FIXED: Improved hasSpecSelectedChildren function using our path normalization logic
 * @param selectedPaths - Set of selected field paths
 * @param specProperties - The spec object properties from schema
 * @returns boolean indicating if any spec children are selected
 */
export const hasSpecSelectedChildren = (selectedPaths: Set<string>, specProperties: any): boolean => {
    if (!specProperties) return false;

    // Get all top-level property names in the spec object
    const specChildrenNames = Object.keys(specProperties);

    // FIXED: Use proper path normalization to check for spec children
    return specChildrenNames.some(childName =>
        Array.from(selectedPaths).some(selectedPath => {
            // Normalize the selected path to remove any resource prefixes
            const normalizedPath = normalizeFieldPath(selectedPath, '');

            // Check if the normalized path matches spec children patterns
            return normalizedPath === childName ||
                normalizedPath.startsWith(`${childName}.`) ||
                normalizedPath.startsWith(`${childName}[]`) ||
                normalizedPath === `spec.${childName}` ||
                normalizedPath.startsWith(`spec.${childName}.`) ||
                normalizedPath.startsWith(`spec.${childName}[]`);
        })
    );
};