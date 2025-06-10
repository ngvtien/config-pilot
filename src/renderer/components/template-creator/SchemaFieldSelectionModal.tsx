import { useState, useMemo, useEffect } from 'react'
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
    format?: string // For future format support (terraform, ansible, etc.)
    templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize' // Future format support
}

/**
 * Modal component for selecting schema fields with tooltips and hierarchical display
 * Supports multiple template formats: Kubernetes, Terraform, Ansible, Kustomize, etc.
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
    // Clear previous selections when resource changes
    useEffect(() => {
        if (resource) {
            console.log('🔄 Resource changed, clearing selections:', resource.kind)
            setLocalSelectedFields([])
            setExpandedObjects(new Set())
        }
    }, [resource?.kind, resource?.apiVersion])

    // Update local state when selectedFields prop changes
    useEffect(() => {
        setLocalSelectedFields(selectedFields)
    }, [selectedFields])

    /**
     * Recursively parse schema properties into a flat structure for easier rendering
     * Auto-expand object types even without explicit properties
     */
    const parseSchemaProperties = (schema: any, basePath = '', level = 0): SchemaProperty[] => {
        if (!schema || !schema.properties) {
            console.log('❌ No schema or properties found at level', level, 'basePath:', basePath)
            return []
        }

        console.log('📋 Parsing schema at level', level, 'basePath:', basePath, 'properties count:', Object.keys(schema.properties).length)
        const properties: SchemaProperty[] = []
        const required = schema.required || []

        Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
            const currentPath = basePath ? `${basePath}.${key}` : key
            
            // Simplified logic: object types are expandable, arrays with object items are expandable
            const isObjectType = value.type === 'object'
            const isArrayWithObjectItems = value.type === 'array' && value.items && value.items.type === 'object'
            const hasChildren = isObjectType || isArrayWithObjectItems

            // Enhanced debug logging
            console.log('🔍 Processing property:', {
                key,
                path: currentPath,
                type: value.type,
                isObjectType,
                isArrayWithObjectItems,
                hasChildren,
                hasExplicitProperties: !!value.properties,
                level
            })

            const property: SchemaProperty = {
                name: key,
                path: currentPath,
                type: value.type || 'object',
                description: value.description,
                required: required.includes(key),
                hasChildren,
                format: value.format,
                templateType: 'kubernetes'
            }

            properties.push(property)

            // Parse nested objects if they have explicit properties
            if (isObjectType && value.properties) {
                console.log('🔧 Parsing nested object with explicit properties:', currentPath)
                property.properties = parseSchemaProperties(value, currentPath, level + 1)
            }

            // Handle array items with object properties
            if (isArrayWithObjectItems && value.items.properties) {
                const itemsPath = `${currentPath}[]`
                console.log('🔧 Parsing array items with explicit properties:', itemsPath)
                property.items = {
                    name: 'items',
                    path: itemsPath,
                    type: value.items.type || 'object',
                    description: value.items.description,
                    hasChildren: true, // Array items with object type are always expandable
                    templateType: 'kubernetes'
                }
                property.items.properties = parseSchemaProperties(value.items, itemsPath, level + 1)
            }
        })

        console.log('✅ Parsed', properties.length, 'properties at level', level, 'with', properties.filter(p => p.hasChildren).length, 'having children')
        return properties
    }

    const schemaProperties = useMemo(() => {
        if (!resource?.schema) {
            console.log('❌ No resource schema available')
            return []
        }
        console.log('🚀 Parsing schema for resource:', resource.kind, resource.apiVersion)
        const parsed = parseSchemaProperties(resource.schema)
        console.log('📊 Total parsed properties:', parsed.length, 'with children:', parsed.filter(p => p.hasChildren).length)
        return parsed
    }, [resource])

    /**
     * Toggle expansion of object properties
     */
    const toggleObjectExpansion = (path: string) => {
        console.log('🔄 Toggling expansion for path:', path)
        setExpandedObjects(prev => {
            const newSet = new Set(prev)
            if (newSet.has(path)) {
                console.log('➖ Collapsing:', path)
                newSet.delete(path)
            } else {
                console.log('➕ Expanding:', path)
                newSet.add(path)
            }
            console.log('📂 All expanded objects:', Array.from(newSet))
            return newSet
        })
    }

    /**
     * Handle schema preview - shows raw schema structure
     */
    const handlePreviewSchema = () => {
        if (resource?.schema) {
            console.log('🔍 Raw Schema Structure:', JSON.stringify(resource.schema, null, 2))
            console.log('🔍 Schema Properties:', resource.schema.properties)
            console.log('🔍 Parsed Schema Properties:', schemaProperties)
            setShowSchemaPreview(true)
        }
    }    
    /**
     * Handle field selection with smart object handling
     * Supports extensible template formats
     */
    const handleFieldToggle = (property: SchemaProperty, checked: boolean) => {
        const field: TemplateField = {
            path: property.path,
            title: property.name,
            type: property.type,
            required: property.required || false,
            description: property.description,
            format: property.format, // For future format-specific handling
            templateType: property.templateType || 'kubernetes' // Extensible for other formats
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
     * Render a schema property with expandable object support
     * Auto-expands object type fields for better UX
     */
    const renderProperty = (property: SchemaProperty, level = 0) => {
        const isSelected = isFieldSelected(property.path)
        const isPartial = isPartiallySelected(property)
        const isExpanded = expandedObjects.has(property.path)
        const indent = level * 20

        // Debug logging for rendering
        if (property.hasChildren) {
            console.log('🎨 Rendering property with children:', {
                name: property.name,
                path: property.path,
                hasChildren: property.hasChildren,
                isExpanded,
                level
            })
        }

        return (
            <div key={property.path} className="space-y-1">
                <div
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    style={{ marginLeft: `${indent}px` }}
                >
                    {/* Expansion toggle for objects */}
                    {property.hasChildren && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                                console.log('🖱️ Expansion button clicked for:', property.path)
                                toggleObjectExpansion(property.path)
                            }}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ChevronRight className="h-3 w-3" />
                            )}
                        </Button>
                    )}

                    {/* Spacer for non-expandable items */}
                    {!property.hasChildren && <div className="w-6" />}

                    <Checkbox
                        id={property.path}
                        checked={isSelected}
                        ref={(el) => {
                            if (el && isPartial) {
                                el.indeterminate = true
                            }
                        }}
                        onCheckedChange={(checked) => handleFieldToggle(property, checked as boolean)}
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
                        <DescriptionTooltip description={property.description} />
                    </div>
                </div>

                {/* Render nested properties when expanded */}
                {property.hasChildren && isExpanded && property.properties && (
                    <div className="ml-4">
                        {console.log('🌳 Rendering nested properties for:', property.path, property.properties.length)}
                        {property.properties.map(nestedProp =>
                            renderProperty(nestedProp, level + 1)
                        )}
                    </div>
                )}
                {property.hasChildren && isExpanded && property.items && (
                    <div className="ml-4">
                        {console.log('🌳 Rendering array items for:', property.path)}
                        {renderProperty(property.items, level + 1)}
                    </div>
                )}
            </div>
        )
    }

    /**
     * Handle save and close
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
                        Select the fields you want to include in your template. Use the tooltips to understand each field's purpose.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
                    {/* Left Panel - Schema Display */}
                    <Card className="flex flex-col">
                        <CardHeader className="flex-shrink-0">
                            <CardTitle className="text-lg">Schema Structure</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="space-y-1">
                                    {schemaProperties.map(property => renderProperty(property))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Right Panel - Selected Fields Summary */}
                    <Card className="flex flex-col">
                        <CardHeader className="flex-shrink-0">
                            <CardTitle className="text-lg">
                                Selected Fields ({localSelectedFields.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
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
                                            <div key={field.path} className="p-3 border rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium">{field.title}</span>
                                                        {field.required && (
                                                            <Badge variant="destructive" className="text-xs">Required</Badge>
                                                        )}
                                                    </div>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {field.type}
                                                    </Badge>
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

                <DialogFooter className="flex-shrink-0 justify-between">
                    <div className="flex space-x-2">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handlePreviewSchema}
                            className="text-xs"
                        >
                            Preview Schema
                        </Button>
                    </div>
                    <div className="flex space-x-2">
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