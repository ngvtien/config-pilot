import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/renderer/components/ui/dialog';
import { Button } from '@/renderer/components/ui/button';
import { Badge } from '@/renderer/components/ui/badge';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import { Separator } from '@/renderer/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { ChevronRight, ChevronDown, Copy, Loader2 } from 'lucide-react';
import { DescriptionTooltip } from './DescriptionTooltip';
import { FlattenedResource, SchemaProperty, SchemaTreeNode } from '../../../shared/types/schema';
import { SchemaTreeView } from './SchemaTreeView';

interface ResourceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    resource: FlattenedResource | null;
}

/**
 * Modal component for displaying detailed resource schema information
 */
export function ResourceDetailModal({ isOpen, onClose, resource }: ResourceDetailModalProps) {
    const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
    const [showRawSchema, setShowRawSchema] = useState(false);
    const [dereferencedResource, setDereferencedResource] = useState<FlattenedResource | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [schemaTree, setSchemaTree] = useState<SchemaTreeNode[] | null>(null);

    /**
     * Fetch dereferenced schema when resource changes
     */
    useEffect(() => {
        if (resource && (!resource.properties || Object.keys(resource.properties).length === 0)) {
            const dereferenceResource = async () => {
                try {
                    // Use the original schema definition key if available, otherwise fall back to constructed key
                    const resourceKey = resource.originalKey ||
                        (resource.apiVersion ? `${resource.apiVersion}/${resource.kind}` : resource.kind);

                    console.log('Getting schema tree for resource:', { sourceId: resource.source, resourceKey });

                    // Get the new tree structure
                    const tree = await window.electronAPI.invoke('schema:getResourceSchemaTree', resource.source, resourceKey);

                    if (tree) {
                        setSchemaTree(tree);
                        console.log('Schema tree:', tree);

                        // For backward compatibility, you can still set the dereferenced resource
                        // or convert the tree back to the old format if needed
                        setDereferencedResource(resource);
                    } else {
                        setError('Failed to get schema tree');
                    }
                } catch (err) {
                    console.error('Error getting schema tree:', err);
                    setError('Failed to get schema tree');
                } finally {
                    setIsLoading(false);
                }
            };

            setIsLoading(true);
            setError(null);
            dereferenceResource();
        } else {
            setDereferencedResource(resource);
            setIsLoading(false);
        }
    }, [resource]);

    /**
     * Parse schema properties into a hierarchical structure
     */
    const parseSchemaProperties = (
        schema: any,
        prefix: string = '',
        level: number = 0
    ): SchemaProperty[] => {
        if (!schema?.properties) return [];

        const properties: SchemaProperty[] = [];

        Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
            const fieldPath = prefix ? `${prefix}.${key}` : key;

            // More robust check for children
            const hasObjectChildren = property.type === 'object' &&
                property.properties &&
                typeof property.properties === 'object' &&
                Object.keys(property.properties).length > 0;

            const hasArrayChildren = property.type === 'array' &&
                property.items &&
                property.items.type === 'object' &&
                property.items.properties &&
                typeof property.items.properties === 'object' &&
                Object.keys(property.items.properties).length > 0;

            const hasChildren = hasObjectChildren || hasArrayChildren;

            // Debug logging to see what's happening
            console.log(`Property: ${key}, Type: ${property.type}, HasChildren: ${hasChildren}`, {
                hasObjectChildren,
                hasArrayChildren,
                properties: property.properties,
                items: property.items
            });

            const schemaProperty: SchemaProperty = {
                name: key,
                path: fieldPath,
                type: property.type || 'unknown',
                description: property.description || '',
                required: schema.required?.includes(key) || false,
                hasChildren,
                level,
                format: property.format,
                // Store the raw property data for lazy parsing
                _rawProperty: property
            };

            properties.push(schemaProperty);
        });

        return properties;
    };

    /**
     * Get the root schema properties (only parse once, not dependent on expanded state)
     */
    const schemaProperties = useMemo(() => {
        if (!dereferencedResource?.properties) {
            return [];
        }
        // Fix: Pass the complete schema object with required array
        return parseSchemaProperties({
            properties: dereferencedResource.properties,
            required: dereferencedResource.required || []
        });
    }, [dereferencedResource]);

    /**
     * Toggle expansion of object properties
     */
    const toggleObjectExpansion = (path: string) => {
        setExpandedObjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    /**
     * Copy property path to clipboard
     */
    const copyPath = async (path: string) => {
        try {
            await navigator.clipboard.writeText(path);
            // You could add a toast notification here
        } catch (err) {
            console.error('Failed to copy path:', err);
        }
    };

    /**
     * Render a schema property with proper hierarchical grouping
     */
    const renderProperty = (property: SchemaProperty, level = 0) => {
        const isExpanded = expandedObjects.has(property.path);
        const indent = level * 20;

        // Parse children on-demand when expanded
        let childProperties: SchemaProperty[] = [];
        let arrayItems: SchemaProperty | undefined;

        if (property.hasChildren && isExpanded) {
            const rawProp = property._rawProperty;

            if (rawProp?.type === 'object' && rawProp.properties) {
                childProperties = parseSchemaProperties(
                    { properties: rawProp.properties, required: rawProp.required },
                    property.path,
                    level + 1
                );
            }

            if (rawProp?.type === 'array' && rawProp.items?.properties) {
                arrayItems = {
                    name: 'items',
                    path: `${property.path}[]`,
                    type: 'object',
                    hasChildren: Object.keys(rawProp.items.properties).length > 0,
                    level: level + 1,
                    _rawProperty: rawProp.items
                } as SchemaProperty;
            }
        }

        return (
            <div key={property.path} className="space-y-1">
                <div
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    style={{ marginLeft: `${indent}px` }}
                >
                    {/* Expansion toggle for objects - always show for objects with children */}
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

                    <div className="flex-1 flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {property.name}
                        </span>
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
                                {(() => {
                                    const rawProp = property._rawProperty;
                                    if (rawProp?.type === 'object' && rawProp.properties) {
                                        return Object.keys(rawProp.properties).length;
                                    }
                                    if (rawProp?.type === 'array' && rawProp.items?.properties) {
                                        return Object.keys(rawProp.items.properties).length;
                                    }
                                    return 0;
                                })()} fields
                            </Badge>
                        )}
                        <DescriptionTooltip description={property.description} />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyPath(property.path)}
                            title="Copy path"
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {/* Only render nested properties when explicitly expanded */}
                {property.hasChildren && isExpanded && childProperties.length > 0 && (
                    <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                        {childProperties.map(nestedProperty =>
                            renderProperty(nestedProperty, level + 1)
                        )}
                    </div>
                )}

                {/* Only render array items when explicitly expanded */}
                {property.hasChildren && isExpanded && arrayItems && (
                    <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                        {renderProperty(arrayItems, level + 1)}
                    </div>
                )}
            </div>
        );
    };

    if (!resource) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <span>{resource.kind}</span>
                        {resource.apiVersion && (
                            <Badge variant="secondary">{resource.apiVersion}</Badge>
                        )}
                        <Badge variant="outline">{resource.source}</Badge>
                    </DialogTitle>
                    {resource.description && (
                        <DialogDescription>{resource.description}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="ml-2">Loading schema...</span>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-32 text-red-500">
                            <span>{error}</span>
                        </div>
                    ) : !schemaTree || schemaTree.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-gray-500">
                            <span>No schema properties available</span>
                        </div>
                    ) : (
                        <ScrollArea className="h-full overflow-auto">
                            <div className="p-4 min-h-0">
                                <SchemaTreeView nodes={schemaTree} />
                            </div>
                        </ScrollArea>
                    )}
                </div>
                <Separator />

                <DialogFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setShowRawSchema(true)}
                        disabled={isLoading || !dereferencedResource}
                    >
                        View Raw Schema
                    </Button>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>

            {/* Raw Schema Modal */}
            <Dialog open={showRawSchema} onOpenChange={setShowRawSchema}>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Raw Schema - {resource.kind}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-96">
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
                            {JSON.stringify(dereferencedResource, null, 2)}
                        </pre>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={() => setShowRawSchema(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}