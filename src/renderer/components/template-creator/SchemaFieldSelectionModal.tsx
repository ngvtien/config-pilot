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
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react'
import { DescriptionTooltip } from './DescriptionTooltip'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import type { TemplateField, TemplateResource } from '@/shared/types/template'
import { SchemaTreeNode } from '../../../shared/types/schema';
import { SchemaTreeView } from './SchemaTreeView';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { KubernetesSchemaService } from '../../services/kubernetes-schema-service'

interface SchemaFieldSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    resource: KubernetesResourceSchema | TemplateResource | null
    selectedFields: TemplateField[]
    onFieldsChange: (fields: TemplateField[]) => void
}

interface SchemaProperty {
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
}

// Persistence keys for localStorage
const STORAGE_KEYS = {
    SELECTED_FIELDS: 'schema-field-selection-selected-fields',
    EXPANDED_NODES: 'schema-field-selection-expanded-nodes',
    SELECTED_FIELDS_SCHEMA: 'schema-field-selection-selected-fields-schema'
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

    const [useSimpleView, setUseSimpleView] = useState(true)
    const [isSchemaLarge, setIsSchemaLarge] = useState(false)
    const [isRenderingSchema, setIsRenderingSchema] = useState(false)

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


    useEffect(() => {
        setIsSchemaLarge(schemaMetrics.isLarge)
        // Always use simple view for full schema preview
        setUseSimpleView(true)
    }, [schemaMetrics.isLarge])

    // Handle schema rendering with loading state
    const handleSchemaRender = async (renderFunction: () => void) => {
        if (schemaMetrics.isLarge) {
            setIsRenderingSchema(true)
            // Use setTimeout to allow UI to update with loading state
            setTimeout(() => {
                renderFunction()
                setIsRenderingSchema(false)
            }, 100)
        } else {
            renderFunction()
        }
    }

    // Handle view toggle with loading state
    const handleViewToggle = () => {
        if (schemaMetrics.isLarge) {
            setIsRenderingSchema(true)
            setTimeout(() => {
                setUseSimpleView(!useSimpleView)
                setIsRenderingSchema(false)
            }, 100)
        } else {
            setUseSimpleView(!useSimpleView)
        }
    }

    const schemaService = new KubernetesSchemaService()

    // Helper function to build proper resource key with null safety
    const buildResourceKey = (resource: TemplateResource | null): string => {
        // Add null safety check
        if (!resource || !resource.apiVersion || !resource.kind) {
            return ''
        }

        // Use the same logic as KubernetesSchemaService.buildSchemaKey
        if (resource.apiVersion === 'v1') {
            return `io.k8s.api.core.v1.${resource.kind}`
        } else {
            const [group, version] = resource.apiVersion.includes('/')
                ? resource.apiVersion.split('/')
                : ['core', resource.apiVersion]

            if (group === 'core') {
                return `io.k8s.api.core.${version}.${resource.kind}`
            } else {
                return `io.k8s.api.${group}.${version}.${resource.kind}`
            }
        }
    }

    //const resourceKey = resource?.apiVersion ? `${resource.apiVersion}/${resource.kind}` : resource?.kind || '';
    //const resourceKey = resource?.key || '';
    //const resourceKey = buildResourceKey(resource)
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

                    setSchemaTree(tree);

                    // Check if we have any persisted data for this resource
                    const hasPersistedData = sessionStorage.getItem(`expandedNodes_${resourceKey}`) !== null;

                    if (!hasPersistedData) {
                        // This is a fresh resource - auto-expand first level
                        const firstLevelPaths = new Set<string>();
                        tree.forEach(node => {
                            if (node.children && node.children.length > 0) {
                                firstLevelPaths.add(node.path);
                            }
                        });

                        console.log('🌳 Auto-expanding first level nodes for fresh resource:', Array.from(firstLevelPaths));
                        setExpandedObjects(firstLevelPaths);
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

    /**
     * Build filtered schema from full schema based on selected fields
     */
//     const filteredSchema = useMemo(() => {
//         if (!resource?.schema || localSelectedFields.length === 0) {
//             return {}
//         }

//         console.log('🔍 DEBUG: Building filtered schema from selected fields')
//         console.log('🔍 DEBUG: Selected fields:', localSelectedFields.map(f => f.path))
//         console.log('🔍 DEBUG: Resource info:', { source: resource.source, key: resource.key, kind: resource.kind })

//         // DUMP ORIGINAL SCHEMA STRUCTURE
//         //console.log('🔍 DEBUG: ORIGINAL SCHEMA DUMP:')
//         //console.log(JSON.stringify(resource.schema, null, 2))

//         // FIRST: Resolve all $ref in the schema before filtering
//         const resolveEntireSchema = (schema: any): any => {
//             if (!schema || typeof schema !== 'object') {
//                 return schema
//             }

//             // If this is a $ref, resolve it
//             if (schema.$ref) {
//                 const { resolved } = resolveSchemaReference(schema, resource.schema)
//                 return resolveEntireSchema(resolved) // Recursively resolve in case the resolved schema has more $ref
//             }

//             // If this is an object with properties, resolve each property
//             if (schema.properties) {
//                 const resolvedProperties: any = {}
//                 Object.keys(schema.properties).forEach(key => {
//                     resolvedProperties[key] = resolveEntireSchema(schema.properties[key])
//                 })
//                 return { ...schema, properties: resolvedProperties }
//             }

//             // If this is an array with items, resolve the items
//             if (schema.items) {
//                 return { ...schema, items: resolveEntireSchema(schema.items) }
//             }

//             return schema
//         }

//         // Start with a fully resolved schema (no $ref)
//         const resolvedSchema = resolveEntireSchema(resource.schema)
//         console.log('🔍 DEBUG: Schema fully resolved, root properties:', Object.keys(resolvedSchema.properties || {}))

//         // DUMP RESOLVED SCHEMA STRUCTURE
//         // console.log('🔍 DEBUG: RESOLVED SCHEMA DUMP:')
//         // console.log(JSON.stringify(resolvedSchema, null, 2))

//         // Get selected field paths (normalize them)
//         const selectedPaths = new Set(localSelectedFields.map(f => {
//             console.log('🔍 DEBUG: Processing original path:', f.path)

//             let normalizedPath = f.path

//             // Handle CRD paths first
//             if (resource.source === 'cluster-crds' && normalizedPath.startsWith('spec.versions[0].schema.openAPIV3Schema.properties.')) {
//                 normalizedPath = normalizedPath.replace('spec.versions[0].schema.openAPIV3Schema.properties.', '')
//                 console.log('🔍 DEBUG: CRD spec normalized path:', normalizedPath)
//             }

//             // Handle standard paths
//             if (normalizedPath.startsWith('properties.')) {
//                 normalizedPath = normalizedPath.replace('properties.', '')
//                 console.log('🔍 DEBUG: Standard normalized path:', normalizedPath)
//             }

//             // Handle CRD kind prefix paths (e.g., 'Application.apiVersion' -> 'apiVersion')
//             if (resource.source === 'cluster-crds' && resource?.kind && normalizedPath.startsWith(resource.kind + '.')) {
//                 normalizedPath = normalizedPath.replace(resource.kind + '.', '')
//                 console.log('🔍 DEBUG: CRD kind prefix normalized path:', normalizedPath)
//             }
//             // Handle standard resource prefix paths (e.g., 'io.k8s.api.core.v1.ConfigMap.apiVersion' -> 'apiVersion')
//             else if (resource?.key && normalizedPath.startsWith(resource.key + '.')) {
//                 normalizedPath = normalizedPath.replace(resource.key + '.', '')
//                 console.log('🔍 DEBUG: Resource prefix normalized path:', normalizedPath)
//             }

//             if (normalizedPath === f.path) {
//                 console.log('🔍 DEBUG: No normalization needed:', normalizedPath)
//             }

//             console.log('🔍 DEBUG: Final normalized path:', normalizedPath)
//             return normalizedPath
//         }))

//         console.log('🔍 DEBUG: Final selected paths set:', Array.from(selectedPaths))

//         // ===== DUMP SELECTED FIELDS SCHEMA =====
//         console.log('🎯 DEBUG: SELECTED FIELDS SCHEMA DUMP:')
//         console.log('Selected Fields Array:')
//         localSelectedFields.forEach((field, index) => {
//             console.log(`Field ${index + 1}:`, {
//                 path: field.path,
//                 title: field.title,
//                 type: field.type,
//                 required: field.required,
//                 description: field.description
//             })
//         })

//         // ===== DUMP NORMALIZED PATHS =====
//         // console.log('🎯 DEBUG: NORMALIZED PATHS:')
//         // Array.from(selectedPaths).forEach((path, index) => {
//         //     console.log(`Normalized Path ${index + 1}: "${path}"`)
//         // })

//         // const filterProperties = (schema: any, currentPath = '', depth = 0) => {
//         //     const indent = '  '.repeat(depth)
//         //     console.log(`${indent}🔍 DEBUG: filterProperties called with currentPath: "${currentPath}", depth: ${depth}`)
//         //     if (!schema?.properties) {
//         //         console.log(`${indent}🔍 DEBUG: No properties found in schema`)
//         //         return schema
//         //     }

//         //     console.log(`${indent}🔍 DEBUG: Schema properties available:`, Object.keys(schema.properties))

//         //     const filteredProps: any = {}

//         //     Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
//         //         const fieldPath = currentPath ? `${currentPath}.${key}` : key

//         //         // Include if this field is selected OR if it has selected children
//         //         const isSelected = selectedPaths.has(fieldPath)
//         //         const hasSelectedChildren = Array.from(selectedPaths).some(path =>
//         //             path.startsWith(fieldPath + '.')
//         //         )

//         //         //console.log(`${indent}🔍 DEBUG: Checking field "${fieldPath}" - selected: ${isSelected}, hasChildren: ${hasSelectedChildren}`)
//         //         //console.log(`${indent}🔍 DEBUG: Property "${key}" type:`, property.type)

//         //         if (isSelected || hasSelectedChildren) {
//         //             //console.log(`${indent}🔍 DEBUG: INCLUDING field "${fieldPath}"`)
//         //             filteredProps[key] = { ...property }

//         //             // Recursively filter nested properties
//         //             if (property.properties && hasSelectedChildren) {
//         //                 //console.log(`${indent}🔍 DEBUG: Recursively filtering nested properties for "${fieldPath}"`)
//         //                 const nestedFiltered = filterProperties(property, fieldPath, depth + 1)
//         //                 filteredProps[key] = {
//         //                     ...filteredProps[key],
//         //                     properties: nestedFiltered.properties
//         //                 }
//         //             }
//         //         } else {
//         //             console.log(`${indent}🔍 DEBUG: EXCLUDING field "${fieldPath}"`)
//         //         }
//         //     })

//         //     console.log(`${indent}🔍 DEBUG: Filtered properties at depth ${depth}:`, Object.keys(filteredProps))
//         //     return { ...schema, properties: filteredProps }
//         // }

// const filterProperties = (schema: any, currentPath = '', depth = 0) => {
//     const indent = '  '.repeat(depth)
//     console.log(`${indent}🔍 DEBUG: filterProperties called with currentPath: "${currentPath}", depth: ${depth}`)
    
//     // Handle schemas without properties (but may have items for arrays)
//     if (!schema?.properties && !schema?.items) {
//         console.log(`${indent}🔍 DEBUG: No properties or items found in schema`)
//         return schema
//     }

//     let result = { ...schema }

//     // Handle object properties
//     if (schema.properties) {
//         console.log(`${indent}🔍 DEBUG: Schema properties available:`, Object.keys(schema.properties))
//         const filteredProps: any = {}

//         Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
//             const fieldPath = currentPath ? `${currentPath}.${key}` : key

//             // Include if this field is selected OR if it has selected children
//             const isSelected = selectedPaths.has(fieldPath)
//             const hasSelectedChildren = Array.from(selectedPaths).some(path =>
//                 path.startsWith(fieldPath + '.')
//             )
//             // Check for array item selections (paths with [])
//             const hasSelectedArrayItems = Array.from(selectedPaths).some(path =>
//                 path.startsWith(fieldPath + '[]')
//             )

//             if (isSelected || hasSelectedChildren || hasSelectedArrayItems) {
//                 filteredProps[key] = { ...property }

//                 // Recursively filter nested properties
//                 if (property.properties && hasSelectedChildren) {
//                     const nestedFiltered = filterProperties(property, fieldPath, depth + 1)
//                     filteredProps[key] = {
//                         ...filteredProps[key],
//                         properties: nestedFiltered.properties
//                     }
//                 }

//                 // Handle array items when array items are selected
//                 if (property.type === 'array' && property.items && hasSelectedArrayItems) {
//                     const arrayItemPath = `${fieldPath}[]`
//                     const nestedFiltered = filterProperties(property.items, arrayItemPath, depth + 1)
//                     filteredProps[key] = {
//                         ...filteredProps[key],
//                         items: nestedFiltered
//                     }
//                 }
//             } else {
//                 console.log(`${indent}🔍 DEBUG: EXCLUDING field "${fieldPath}"`)
//             }
//         })

//         result.properties = filteredProps
//         console.log(`${indent}🔍 DEBUG: Filtered properties at depth ${depth}:`, Object.keys(filteredProps))
//     }

//     // Handle array items (when we're filtering an array's items schema)
//     if (schema.items && currentPath.endsWith('[]')) {
//         console.log(`${indent}🔍 DEBUG: Filtering array items schema for path: ${currentPath}`)
//         const filteredItems = filterProperties(schema.items, currentPath, depth + 1)
//         result.items = filteredItems
//     }

//     return result
// }

//         const filtered = filterProperties(resolvedSchema, '', 0)
//         //console.log('🎯 DEBUG: Final filtered schema properties:', Object.keys(filtered.properties || {}))

//         // DUMP FINAL FILTERED SCHEMA
//         //console.log('🔍 DEBUG: FINAL FILTERED SCHEMA DUMP:')
//         //console.log(JSON.stringify(filtered, null, 2))

//         return filtered
//     }, [resource?.schema, localSelectedFields, resource?.source, resource?.key, resource?.kind])
//     const memoizedSelectedSchema = useMemo(() => {
//         return JSON.stringify(filteredSchema, null, 2);
//     }, [filteredSchema]);

// Force schema recreation whenever fields change
useEffect(() => {
    setSchemaTimestamp(Date.now())
}, [localSelectedFields])

const filteredSchema = useMemo(() => {
    // Force fresh calculation by clearing any cached data
    console.log('🔄 FORCING FRESH SCHEMA CREATION - Timestamp:', schemaTimestamp)
    
    if (!resource?.schema || localSelectedFields.length === 0) {
        return {}
    }

    console.log('🔍 DEBUG: Building filtered schema from selected fields')
    console.log('🔍 DEBUG: Selected fields:', localSelectedFields.map(f => f.path))
    console.log('🔍 DEBUG: Resource info:', { source: resource.source, key: resource.key, kind: resource.kind })

    // FIRST: Resolve all $ref in the schema before filtering
    const resolveEntireSchema = (schema: any): any => {
        if (!schema || typeof schema !== 'object') {
            return schema
        }

        // If this is a $ref, resolve it
        if (schema.$ref) {
            const { resolved } = resolveSchemaReference(schema, resource.schema)
            return resolveEntireSchema(resolved) // Recursively resolve in case the resolved schema has more $ref
        }

        // If this is an object with properties, resolve each property
        if (schema.properties) {
            const resolvedProperties: any = {}
            Object.keys(schema.properties).forEach(key => {
                resolvedProperties[key] = resolveEntireSchema(schema.properties[key])
            })
            return { ...schema, properties: resolvedProperties }
        }

        // If this is an array with items, resolve the items
        if (schema.items) {
            return { ...schema, items: resolveEntireSchema(schema.items) }
        }

        return schema
    }

    // Start with a fully resolved schema (no $ref)
    const resolvedSchema = resolveEntireSchema(resource.schema)
    console.log('🔍 DEBUG: Schema fully resolved, root properties:', Object.keys(resolvedSchema.properties || {}))

    // Get selected field paths (normalize them)
    const selectedPaths = new Set(localSelectedFields.map(f => {
        console.log('🔍 DEBUG: Processing original path:', f.path)

        let normalizedPath = f.path

        // Handle CRD paths first
        if (resource.source === 'cluster-crds' && normalizedPath.startsWith('spec.versions[0].schema.openAPIV3Schema.properties.')) {
            normalizedPath = normalizedPath.replace('spec.versions[0].schema.openAPIV3Schema.properties.', '')
            console.log('🔍 DEBUG: CRD spec normalized path:', normalizedPath)
        }

        // Handle standard paths
        if (normalizedPath.startsWith('properties.')) {
            normalizedPath = normalizedPath.replace('properties.', '')
            console.log('🔍 DEBUG: Standard normalized path:', normalizedPath)
        }

        // Handle CRD kind prefix paths (e.g., 'Application.apiVersion' -> 'apiVersion')
        if (resource.source === 'cluster-crds' && resource?.kind && normalizedPath.startsWith(resource.kind + '.')) {
            normalizedPath = normalizedPath.replace(resource.kind + '.', '')
            console.log('🔍 DEBUG: CRD kind prefix normalized path:', normalizedPath)
        }
        // Handle standard resource prefix paths (e.g., 'io.k8s.api.core.v1.ConfigMap.apiVersion' -> 'apiVersion')
        else if (resource?.key && normalizedPath.startsWith(resource.key + '.')) {
            normalizedPath = normalizedPath.replace(resource.key + '.', '')
            console.log('🔍 DEBUG: Resource prefix normalized path:', normalizedPath)
        }

        if (normalizedPath === f.path) {
            console.log('🔍 DEBUG: No normalization needed:', normalizedPath)
        }

        console.log('🔍 DEBUG: Final normalized path:', normalizedPath)
        return normalizedPath
    }))

    console.log('🔍 DEBUG: Final selected paths set:', Array.from(selectedPaths))

    // ===== DUMP SELECTED FIELDS SCHEMA =====
    console.log('🎯 DEBUG: SELECTED FIELDS SCHEMA DUMP:')
    console.log('Selected Fields Array:')
    localSelectedFields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
            path: field.path,
            title: field.title,
            type: field.type,
            required: field.required,
            description: field.description
        })
    })

    // Filter the RESOLVED schema properties to only include selected fields
    const filterProperties = (schema: any, currentPath = '', depth = 0) => {
        const indent = '  '.repeat(depth)
        console.log(`${indent}🔍 DEBUG: filterProperties called with currentPath: "${currentPath}", depth: ${depth}`)
        
        // Handle schemas without properties (but may have items for arrays)
        if (!schema?.properties && !schema?.items) {
            console.log(`${indent}🔍 DEBUG: No properties or items found in schema`)
            return schema
        }

        let result = { ...schema }

        // Handle object properties
        if (schema.properties) {
            console.log(`${indent}🔍 DEBUG: Schema properties available:`, Object.keys(schema.properties))
            const filteredProps: any = {}

            Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
                const fieldPath = currentPath ? `${currentPath}.${key}` : key

                // Include if this field is selected OR if it has selected children
                const isSelected = selectedPaths.has(fieldPath)
                const hasSelectedChildren = Array.from(selectedPaths).some(path =>
                    path.startsWith(fieldPath + '.')
                )
                // Check for array item selections (paths with [])
                const hasSelectedArrayItems = Array.from(selectedPaths).some(path =>
                    path.startsWith(fieldPath + '[]')
                )

                if (isSelected || hasSelectedChildren || hasSelectedArrayItems) {
                    filteredProps[key] = { ...property }

                    // Recursively filter nested properties
                    if (property.properties && hasSelectedChildren) {
                        const nestedFiltered = filterProperties(property, fieldPath, depth + 1)
                        filteredProps[key] = {
                            ...filteredProps[key],
                            properties: nestedFiltered.properties
                        }
                    }

                    // Handle array items when array items are selected
                    if (property.type === 'array' && property.items && hasSelectedArrayItems) {
                        const arrayItemPath = `${fieldPath}[]`
                        const nestedFiltered = filterProperties(property.items, arrayItemPath, depth + 1)
                        filteredProps[key] = {
                            ...filteredProps[key],
                            items: nestedFiltered
                        }
                    }
                } else {
                    console.log(`${indent}🔍 DEBUG: EXCLUDING field "${fieldPath}"`)
                }
            })

            result.properties = filteredProps
            console.log(`${indent}🔍 DEBUG: Filtered properties at depth ${depth}:`, Object.keys(filteredProps))
        }

        // Handle array items (when we're filtering an array's items schema)
        if (schema.items && currentPath.endsWith('[]')) {
            console.log(`${indent}🔍 DEBUG: Filtering array items schema for path: ${currentPath}`)
            const filteredItems = filterProperties(schema.items, currentPath, depth + 1)
            result.items = filteredItems
        }

        return result
    }

    const filtered = filterProperties(resolvedSchema, '', 0)
    console.log('🎯 DEBUG: Final filtered schema properties:', Object.keys(filtered.properties || {}))

    // DUMP FINAL FILTERED SCHEMA
    console.log('🔍 DEBUG: FINAL FILTERED SCHEMA DUMP:')
    console.log(JSON.stringify(filtered, null, 2))

    return filtered
}, [resource?.schema, localSelectedFields, resource?.source, resource?.key, resource?.kind, schemaTimestamp]) // Add timestamp to dependencies

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
                level
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
            templateType: property.templateType || 'kubernetes'
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
                                            onFieldSelect={(path, type, name, description, required) => {
                                                const field: TemplateField = {
                                                    path,
                                                    title: name,
                                                    type,
                                                    description: description || '',
                                                    required: required || false
                                                };

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
                                                className={`p-3 border rounded-lg cursor-pointer transition-all duration-300 ${highlightedFieldPath === field.path
                                                    ? 'hover:bg-gray-50 dark:hover:bg-gray-800 transform scale-105 shadow-lg'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                                onClick={() => handleSelectedFieldClick(field.path)}
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
                                        {isSchemaLarge && !schemaMetrics.isTooLarge && (
                                            <Badge variant="warning" className="text-xs">
                                                Large Schema
                                            </Badge>
                                        )}
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
            </DialogContent>
        </Dialog>
    )
}