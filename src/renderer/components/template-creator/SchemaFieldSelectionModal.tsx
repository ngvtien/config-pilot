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
import { ChevronRight, ChevronDown } from 'lucide-react'
import { DescriptionTooltip } from './DescriptionTooltip'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import type { TemplateField } from '@/shared/types/template'
import { SchemaTreeNode } from '../../../shared/types/schema';
import { SchemaTreeView } from './SchemaTreeView';

interface SchemaFieldSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    resource: KubernetesResourceSchema | null
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
    EXPANDED_NODES: 'schema-field-selection-expanded-nodes'
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
 * Modal component for selecting schema fields with tooltips and hierarchical display
 * Supports multiple template formats and state persistence
 */
export function SchemaFieldSelectionModal({
    isOpen,
    onClose,
    resource,
    selectedFields,
    onFieldsChange
}: SchemaFieldSelectionModalProps) {
    const [localSelectedFields, setLocalSelectedFields] = useState<TemplateField[]>(selectedFields)
    const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set())
    const [showSchemaPreview, setShowSchemaPreview] = useState(false)
    const [schemaTree, setSchemaTree] = useState<SchemaTreeNode[]>([]);
    const [isLoadingSchema, setIsLoadingSchema] = useState(false);
    const [highlightedFieldPath, setHighlightedFieldPath] = useState<string | null>(null);

    // Generate resource key for persistence (fix undefined apiVersion)
    //const resourceKey = resource ? (resource.key || `${resource.kind}-${resource.apiVersion || resource.group + '/' + resource.version}`) : '';
    //const resourceKey = resource ? (resource.key || `io.k8s.api.${resource.group || 'core'}.${resource.version}.${resource.kind}`) : '';

    console.log('🔍 Resource object:', resource);
    console.log('🔍 Resource key:', resource?.key);
    console.log('🔍 Resource kind:', resource?.kind);
    console.log('🔍 Resource apiVersion:', resource?.apiVersion);
    console.log('🔍 Resource group:', resource?.group);
    const resourceKey = resource?.key || '';
    console.log('🔍 Final resourceKey:', resourceKey);

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

            // Navigate to the referenced schema
            let resolved = fullSchema
            for (const segment of refPath) {
                resolved = resolved?.[segment]
            }

            if (resolved) {
                // Recursively resolve the referenced schema
                const result = resolveSchemaReference(resolved, fullSchema, visited)
                return { resolved: result.resolved, isReference: true }
            }

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
            console.log('🔍 Raw Schema Structure:', JSON.stringify(resource.schema, null, 2))
            console.log('🔍 Parsed Schema Properties:', schemaProperties)
            setShowSchemaPreview(true)
        }
    }

    /**
     * Handle field selection with persistence
     */
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
                return [...filteredFields, field]
            })

            // Auto-expand object if it has children
            if (property.hasChildren) {
                setExpandedObjects(prev => new Set([...prev, property.path]))
            }
        } else {
            setLocalSelectedFields(prev => {
                // Remove this field and any child fields
                return prev.filter(f => !f.path.startsWith(property.path) && f.path !== property.path)
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
            className={`p-3 border rounded-lg cursor-pointer transition-all duration-300 ${
                highlightedFieldPath === field.path
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
                    <Button
                        variant="outline"
                        onClick={handlePreviewSchema}
                        className="mr-auto"
                    >
                        Preview Schema
                    </Button>
                    <div className="flex space-x-2 ml-auto">
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            Save Selection ({localSelectedFields.length} fields)
                        </Button>
                    </div>
                </DialogFooter>
                {/* Schema Preview Modal */}
                {showSchemaPreview && (
                    <Dialog open={showSchemaPreview} onOpenChange={setShowSchemaPreview}>
                        <DialogContent className="max-w-4xl h-[80vh]">
                            <DialogHeader>
                                <DialogTitle>Raw Schema Structure - {resource?.kind}</DialogTitle>
                                <DialogDescription>
                                    This shows the actual schema data being parsed
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1">
                                <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
                                    {JSON.stringify(resource?.schema, null, 2)}
                                </pre>
                            </ScrollArea>
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