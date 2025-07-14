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
import { ChevronRight, ChevronDown, Copy, Edit, X } from 'lucide-react'
import { DescriptionTooltip } from './DescriptionTooltip'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import type { TemplateField, TemplateResource } from '@/shared/types/template'
import { SchemaProperty, SchemaTreeNode } from '../../../shared/types/schema';
import { SchemaTreeView } from './SchemaTreeView';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { EnhancedTemplateField, ArrayItemFieldConfig } from '@/shared/types/enhanced-template-field'
import { normalizeFieldPath } from '../../utils/pathNormalization'
import { EnhancedPropertyEditor } from '../enhanced-property-editor'

interface SchemaFieldSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    resource: KubernetesResourceSchema | TemplateResource | null
    selectedFields: TemplateField[]
    onFieldsChange: (fields: TemplateField[]) => void
}

// Add JSONSchema7-compliant field configuration interface (minimal - just default for now)
interface JSONSchema7FieldConfig {
    default?: any
    title?: string
    description?: string
    format?: string
}

/**
 * Helper function to get field configuration in JSONSchema7 format
 * Only returns properties that have actual values (no nulls/empty strings)
 */
const getFieldConfiguration = (resourceKey: string, fieldPath: string): JSONSchema7FieldConfig => {
    const allConfigs = getPersistedFieldConfigurations(resourceKey)
    const storedConfig = allConfigs[fieldPath]

    console.log(`🔧 DEBUG: getFieldConfiguration called for ${fieldPath}`, {
        resourceKey,
        fieldPath,
        storedConfig,
        allConfigs: Object.keys(allConfigs)
    });

    // Handle backward compatibility - current storage might just be the default value
    if (storedConfig !== undefined && storedConfig !== null) {
        if (typeof storedConfig === 'object' && !Array.isArray(storedConfig)) {
            // New format: object with multiple properties
            const config: JSONSchema7FieldConfig = {}

            if (storedConfig.default !== undefined && storedConfig.default !== null && storedConfig.default !== '') {
                config.default = storedConfig.default
                console.log(`🔧 DEBUG: Found stored default for ${fieldPath}:`, storedConfig.default);
            }
            // FIXED: Always include title if it exists, even if empty
            if (storedConfig.title !== undefined && typeof storedConfig.title === 'string') {
                config.title = storedConfig.title
                console.log(`🔧 DEBUG: Found stored title for ${fieldPath}:`, storedConfig.title);
            }
            if (storedConfig.description && typeof storedConfig.description === 'string' && storedConfig.description.trim()) {
                config.description = storedConfig.description.trim()
                console.log(`🔧 DEBUG: Found stored description for ${fieldPath}:`, storedConfig.description.trim());
            }
            if (storedConfig.format && typeof storedConfig.format === 'string' && storedConfig.format.trim()) {
                config.format = storedConfig.format.trim()
                console.log(`🔧 DEBUG: Found stored format for ${fieldPath}:`, storedConfig.format.trim());
            }

            console.log(`🔧 DEBUG: getFieldConfiguration returning for ${fieldPath}:`, config);
            return config
        } else {
            // Old format: just the default value
            console.log(`🔧 DEBUG: Old format config for ${fieldPath}:`, storedConfig);
            return { default: storedConfig }
        }
    }

    console.log(`🔧 DEBUG: No stored config found for ${fieldPath}, returning empty object`);
    return {}
}

/**
 * Helper function to update field configuration in JSONSchema7 format
 * Only stores properties that have actual values
 */
const updateFieldConfiguration = (
    resourceKey: string,
    fieldPath: string,
    updates: Partial<JSONSchema7FieldConfig>
): JSONSchema7FieldConfig => {
    const allConfigs = getPersistedFieldConfigurations(resourceKey)
    let currentConfig = allConfigs[fieldPath] || {}

    // Ensure currentConfig is an object (handle backward compatibility)
    if (typeof currentConfig !== 'object' || Array.isArray(currentConfig)) {
        currentConfig = { default: currentConfig }
    }

    // Apply updates
    const mergedConfig = { ...currentConfig, ...updates }

    // Clean the configuration - only keep properties with actual values
    const cleanConfig: any = {}

    if (mergedConfig.default !== undefined && mergedConfig.default !== null && mergedConfig.default !== '') {
        cleanConfig.default = mergedConfig.default
    }
    if (mergedConfig.title && typeof mergedConfig.title === 'string' && mergedConfig.title.trim()) {
        cleanConfig.title = mergedConfig.title.trim()
    }
    if (mergedConfig.description && typeof mergedConfig.description === 'string' && mergedConfig.description.trim()) {
        cleanConfig.description = mergedConfig.description.trim()
    }
    if (mergedConfig.format && typeof mergedConfig.format === 'string' && mergedConfig.format.trim()) {
        cleanConfig.format = mergedConfig.format.trim()
    }

    // If clean config is empty, remove the field entirely
    if (Object.keys(cleanConfig).length === 0) {
        delete allConfigs[fieldPath]
    } else {
        allConfigs[fieldPath] = cleanConfig
    }

    persistFieldConfigurations(resourceKey, allConfigs)

    // Return the current configuration
    return getFieldConfiguration(resourceKey, fieldPath)
}

// Local interface for UI rendering - properties as array for easier iteration
export interface UISchemaProperty {
    name: string
    path: string
    type: string
    description?: string
    required?: boolean
    properties?: UISchemaProperty[]  // Array for UI rendering
    items?: UISchemaProperty
    hasChildren: boolean
    format?: string
    templateType?: 'kubernetes' | 'terraform' | 'ansible' | 'kustomize'
    isReference?: boolean
    level?: number
    enum?: any[]
    _rawProperty?: any  // Store the raw property data for lazy parsing
}

// Persistence keys for localStorage
const STORAGE_KEYS = {
    SELECTED_FIELDS: 'schema-field-selection-selected-fields',
    EXPANDED_NODES: 'schema-field-selection-expanded-nodes',
    SELECTED_FIELDS_SCHEMA: 'schema-field-selection-selected-fields-schema',
    FIELD_CONFIGURATIONS: 'schema-field-selection-field-configurations'
}

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
 * Clear field configurations for a specific resource
 */
export function clearFieldConfiguration(resourceKey: string, fieldPath: string) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.FIELD_CONFIGURATIONS)
        if (stored) {
            const allConfigurations = JSON.parse(stored)
            if (allConfigurations[resourceKey]) {
                delete allConfigurations[resourceKey][fieldPath]
                localStorage.setItem(STORAGE_KEYS.FIELD_CONFIGURATIONS, JSON.stringify(allConfigurations))
                console.log(`🧹 Cleared field configuration for ${resourceKey}.${fieldPath}`)
            }
        }
    } catch (error) {
        console.warn('Failed to clear field configuration:', error)
    }
}

export const setEffectiveFieldConfiguration = (resourceKey: string, fieldPath: string, config: Partial<JSONSchema7FieldConfig>): JSONSchema7FieldConfig => {
    const allConfigs = getPersistedFieldConfigurations(resourceKey)

    // Clean the config - remove undefined and empty string values
    const cleanConfig: any = {}
    Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
            cleanConfig[key] = value
        }
    })

    // If clean config is empty, remove the field entirely
    if (Object.keys(cleanConfig).length === 0) {
        delete allConfigs[fieldPath]
    } else {
        allConfigs[fieldPath] = cleanConfig
    }

    persistFieldConfigurations(resourceKey, allConfigs)

    // Return the current configuration - use getFieldConfiguration since this is the setter
    return getFieldConfiguration(resourceKey, fieldPath)
}

/**
 * Clear all field configurations
 */
/**
 * Clear all field configurations and cached data
 */
export function clearAllFieldConfigurations() {
    try {
        // Clear all localStorage entries
        localStorage.removeItem(STORAGE_KEYS.FIELD_CONFIGURATIONS)
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FIELDS)
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FIELDS_SCHEMA)

        // Clear all sessionStorage entries
        sessionStorage.removeItem(STORAGE_KEYS.EXPANDED_NODES)

        console.log('🧹 CLEARED ALL localStorage and sessionStorage for field configurations')
    } catch (error) {
        console.warn('Failed to clear all field configurations:', error)
    }
}

/**
 * Clear all data for a specific resource
 */
export function clearResourceData(resourceKey: string) {
    try {
        // Clear field configurations for this resource
        const stored = localStorage.getItem(STORAGE_KEYS.FIELD_CONFIGURATIONS)
        if (stored) {
            const allConfigurations = JSON.parse(stored)
            delete allConfigurations[resourceKey]
            localStorage.setItem(STORAGE_KEYS.FIELD_CONFIGURATIONS, JSON.stringify(allConfigurations))
        }

        // Clear selected fields for this resource
        const storedFields = localStorage.getItem(STORAGE_KEYS.SELECTED_FIELDS)
        if (storedFields) {
            const allSelections = JSON.parse(storedFields)
            delete allSelections[resourceKey]
            localStorage.setItem(STORAGE_KEYS.SELECTED_FIELDS, JSON.stringify(allSelections))
        }

        // Clear selected fields schema for this resource
        const storedSchema = localStorage.getItem(STORAGE_KEYS.SELECTED_FIELDS_SCHEMA)
        if (storedSchema) {
            const allSchemas = JSON.parse(storedSchema)
            delete allSchemas[resourceKey]
            localStorage.setItem(STORAGE_KEYS.SELECTED_FIELDS_SCHEMA, JSON.stringify(allSchemas))
        }

        // Clear expanded nodes for this resource
        const storedExpanded = sessionStorage.getItem(STORAGE_KEYS.EXPANDED_NODES)
        if (storedExpanded) {
            const allExpanded = JSON.parse(storedExpanded)
            delete allExpanded[resourceKey]
            sessionStorage.setItem(STORAGE_KEYS.EXPANDED_NODES, JSON.stringify(allExpanded))
        }

        console.log(`🧹 CLEARED ALL data for resource: ${resourceKey}`)
    } catch (error) {
        console.warn(`Failed to clear resource data for ${resourceKey}:`, error)
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
    //const [selectedFieldForConfig, setSelectedFieldForConfig] = useState<EnhancedTemplateField | null>(null)
    const [fieldConfigurations, setFieldConfigurations] = useState<Record<string, any>>({})
    const [arrayConfigurations, setArrayConfigurations] = useState<Record<string, ArrayItemFieldConfig>>({})
    //const [showFieldConfigModal, setShowFieldConfigModal] = useState(false)
    const [expandedFieldPath, setExpandedFieldPath] = useState<string | null>(null)

    const [schemaTimestamp, setSchemaTimestamp] = useState(Date.now())

    const [currentFieldStates, setCurrentFieldStates] = useState<Record<string, SchemaProperty>>({});

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

    /**
     * Handle field state changes - just store whatever the editor gives us
     */
    /**
     * Handle field state changes - just store whatever the editor gives us
     */
    const handleFieldStateChange = (fieldPath: string, currentState: SchemaProperty) => {
        console.log('🔥 DEBUG: ===== handleFieldStateChange START =====');
        console.log('🔥 DEBUG: Field state change detected', {
            fieldPath,
            currentState,
            currentStateTitle: currentState.title,
            currentStateDefault: currentState.default,
            currentStateDescription: currentState.description,
            currentStateFormat: currentState.format
        });

        setCurrentFieldStates(prev => {
            const updated = {
                ...prev,
                [fieldPath]: currentState
            };
            console.log('🔥 DEBUG: Updated currentFieldStates', updated);
            return updated;
        });

        // Trigger schema preview update
        const newTimestamp = Date.now();
        console.log('🔥 DEBUG: Triggering schema rebuild with timestamp', newTimestamp);
        setSchemaTimestamp(newTimestamp);
        
        console.log('🔥 DEBUG: ===== handleFieldStateChange END =====');
    };

    /**
     * Get effective field configuration for a field
     * Priority: current editor state > persisted config > base field
     */
    const getEffectiveFieldConfig = (fieldPath: string): SchemaProperty => {
        const baseField = localSelectedFields.find(f => f.path === fieldPath);
        const persistedConfig = getPersistedFieldConfigurations(resourceKey)[fieldPath] || {};
        const currentState = currentFieldStates[fieldPath];

        if (currentState) {
            // Editor is open and has current state - use that
            return currentState;
        } else {
            // Editor is closed - use persisted + base
            return { ...baseField, ...persistedConfig };
        }
    };

    const toggleFieldConfig = (fieldPath: string) => {
        setExpandedFieldPath(prev => prev === fieldPath ? null : fieldPath)
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

            // Enhanced resolution strategy - try multiple locations
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
                const defName = refPath[refPath.length - 1]
                resolved = fullSchema.components.schemas[defName]
                if (resolved) {
                    console.log('🔍 DEBUG: Found reference in components.schemas:', resolved)
                }
            }

            // 4. Enhanced: Try to load from external definitions file for vanilla Kubernetes resources
            if (!resolved && property.$ref.startsWith('#/definitions/io.k8s.')) {
                // This is a Kubernetes definition that should be in the definitions file
                console.log('🔍 DEBUG: Attempting to resolve Kubernetes definition from external source:', property.$ref)

                // For now, we'll mark it as resolvable but return a placeholder
                // In a real implementation, you might want to load this from the definitions file
                resolved = {
                    type: 'object',
                    description: `Kubernetes definition: ${property.$ref}`,
                    'x-kubernetes-ref': property.$ref, // Mark for later resolution
                    additionalProperties: true
                }
                console.log('🔍 DEBUG: Created placeholder for Kubernetes definition')
            }

            if (resolved) {
                // Recursively resolve the referenced schema
                const result = resolveSchemaReference(resolved, fullSchema, visited)
                return { resolved: result.resolved, isReference: true }
            }

            console.log('🔍 DEBUG: Could not resolve reference:', property.$ref)
            return {
                resolved: {
                    type: 'object',
                    description: `Unresolved reference: ${property.$ref}`,
                    'x-unresolved-ref': property.$ref
                },
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

        // Enhanced: Handle array items with better $ref resolution
        if (property.type === 'array' && property.items) {
            console.log('🔍 DEBUG: Processing array items:', property.items)

            // If items has $ref, resolve it
            if (property.items.$ref) {
                console.log('🔍 DEBUG: Array items has $ref:', property.items.$ref)
                const result = resolveSchemaReference(property.items, fullSchema, new Set(visited))
                return {
                    resolved: {
                        ...property,
                        items: result.resolved,
                        'x-items-was-ref': property.items.$ref // Track original ref for debugging
                    },
                    isReference: result.isReference
                }
            } else {
                // Recursively resolve items even if not a direct $ref
                const result = resolveSchemaReference(property.items, fullSchema, new Set(visited))
                return {
                    resolved: { ...property, items: result.resolved },
                    isReference: result.isReference
                }
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
     * Get effective field configuration - prioritizes current editor state over persisted config
     */
    const getEffectiveFieldConfiguration = (fieldPath: string): JSONSchema7FieldConfig => {
        console.log('🔥 DEBUG: ===== getEffectiveFieldConfiguration START =====');
        console.log('🔥 DEBUG: Getting effective config for', fieldPath);
        
        // First check if we have current editor state for this field
        const currentState = currentFieldStates[fieldPath];
        console.log('🔥 DEBUG: Current state from currentFieldStates', currentState);
        
        if (currentState) {
            const config: JSONSchema7FieldConfig = {};

            if (currentState.default !== undefined && currentState.default !== null && currentState.default !== '') {
                config.default = currentState.default;
                console.log('🔥 DEBUG: Applied default from currentState', currentState.default);
            }
            // FIXED: Always include title from currentState, even if empty
            if (currentState.title !== undefined) {
                config.title = currentState.title;
                console.log('🔥 DEBUG: Applied title from currentState', currentState.title);
            }
            if (currentState.description && currentState.description.trim()) {
                config.description = currentState.description.trim();
                console.log('🔥 DEBUG: Applied description from currentState', currentState.description.trim());
            }
            if (currentState.format && currentState.format.trim()) {
                config.format = currentState.format.trim();
                console.log('🔥 DEBUG: Applied format from currentState', currentState.format.trim());
            }

            console.log('🔥 DEBUG: Final config from currentState', config);
            console.log('🔥 DEBUG: ===== getEffectiveFieldConfiguration END (currentState) =====');
            return config;
        }

        // Fall back to persisted configuration
        const persistedConfig = getFieldConfiguration(resourceKey!, fieldPath);
        console.log('🔥 DEBUG: No currentState, using persisted config', persistedConfig);
        console.log('🔥 DEBUG: ===== getEffectiveFieldConfiguration END (persisted) =====');
        return persistedConfig;
    };

    /**
     * Build filtered schema directly from selected tree nodes
     * This eliminates the need for complex path normalization and matching
     */
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
         * Resolve a property and its $ref dependencies on-demand
         */
        const resolvePropertyOnDemand = (property: any): any => {
            if (!property) return property;

            // If this property has unresolved references, try to resolve them
            if (property['x-unresolved-ref'] || property['x-kubernetes-ref']) {
                console.log('🔧 DEBUG: Attempting on-demand resolution for:', property['x-unresolved-ref'] || property['x-kubernetes-ref']);

                // Try to resolve using the full schema context
                const resolved = resolveSchemaReference(
                    { $ref: property['x-unresolved-ref'] || property['x-kubernetes-ref'] },
                    originalSchema
                );

                if (resolved.resolved && !resolved.resolved['x-unresolved-ref']) {
                    console.log('🔧 DEBUG: Successfully resolved on-demand:', resolved.resolved);
                    return resolved.resolved;
                }
            }

            // For array types, ensure items are properly resolved
            if (property.type === 'array' && property.items) {
                return {
                    ...property,
                    items: resolvePropertyOnDemand(property.items)
                };
            }

            // For object types, recursively resolve properties
            if (property.type === 'object' && property.properties) {
                const resolvedProperties: any = {};
                Object.keys(property.properties).forEach(key => {
                    resolvedProperties[key] = resolvePropertyOnDemand(property.properties[key]);
                });
                return {
                    ...property,
                    properties: resolvedProperties
                };
            }

            return property;
        };

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
         * Enhanced buildFromNodes function that applies all 4 JSONSchema7 properties
         * @param nodes - Array of tree nodes to process
         * @param depth - Current depth for logging indentation
         * @returns Schema object with properties from selected nodes
         */

        const buildFromNodes = (nodes: SchemaTreeNode[], depth = 0): any => {
            const indent = '  '.repeat(depth);
            const properties: any = {};

            nodes.forEach((node, index) => {
                const isSelected = selectedPaths.has(node.path);
                const hasSelectedChildren = hasSelectedChildrenByPath(node.path, selectedPaths);

                if (isSelected || hasSelectedChildren) {
                    console.log(`${indent}✅ Including node: ${node.name} (path: ${node.path})`);

                    // Find the selected field for this node
                    const selectedField = localSelectedFields.find(f => {
                        let normalizedPath = f.path;
                        return normalizedPath === node.path;
                    });

                    // Start with base field schema
                    let fieldSchema = {
                        type: selectedField?.type || node.type || 'object',
                        ...(selectedField?.description && { description: selectedField.description }),
                        ...(node.required && { required: true })
                    };

                    // 🎯 APPLY ALL JSONSchema7 FIELD CONFIGURATIONS (only non-empty values)
                    if (resourceKey) {
                        const fieldConfig = getEffectiveFieldConfiguration(node.path);
                        console.log(`🔥 DEBUG: ===== APPLYING FIELD CONFIG =====`);
                        console.log(`🔥 DEBUG: Node path: ${node.path}`);
                        console.log(`🔥 DEBUG: Field config:`, fieldConfig);
                        console.log(`🔥 DEBUG: Field schema before config:`, fieldSchema);

                        // Apply default value if configured
                        if (fieldConfig.default !== undefined) {
                            fieldSchema = {
                                ...fieldSchema,
                                default: fieldConfig.default
                            }
                            console.log(`🔥 DEBUG: Applied default value to ${node.path}:`, fieldConfig.default)
                        }

                        // FIXED: Apply title if configured, including empty strings
                        if (fieldConfig.title !== undefined) {
                            fieldSchema = {
                                ...fieldSchema,
                                title: fieldConfig.title
                            }
                            console.log(`🔥 DEBUG: Applied title to ${node.path}:`, fieldConfig.title)
                        }

                        // Apply description if configured (override original description)
                        if (fieldConfig.description) {
                            fieldSchema = {
                                ...fieldSchema,
                                description: fieldConfig.description
                            }
                            console.log(`🔥 DEBUG: Applied description to ${node.path}:`, fieldConfig.description)
                        }

                        // Apply format if configured
                        if (fieldConfig.format) {
                            fieldSchema = {
                                ...fieldSchema,
                                format: fieldConfig.format
                            }
                            console.log(`🔥 DEBUG: Applied format to ${node.path}:`, fieldConfig.format)
                        }

                        console.log(`🔥 DEBUG: Field schema after config:`, fieldSchema);
                        console.log(`🔥 DEBUG: ===== FIELD CONFIG APPLIED =====`);
                    }

                    // Handle array types
                    if (selectedField?.type === 'array' && selectedField?.items) {
                        console.log(`🔧 DEBUG: Resolving array items for ${node.name}:`, selectedField.items);
                        fieldSchema = {
                            ...fieldSchema,
                            items: resolvePropertyOnDemand(selectedField.items)
                        };
                    }

                    properties[node.name] = fieldSchema;

                    // Handle children (existing logic)
                    if (hasSelectedChildren) {
                        const childPrefix = node.path + '.';
                        const childPaths = Array.from(selectedPaths)
                            .filter(path => path.startsWith(childPrefix))
                            .map(path => {
                                const relativePath = path.substring(childPrefix.length);
                                const firstSegment = relativePath.split('.')[0];
                                return {
                                    name: firstSegment,
                                    path: childPrefix + firstSegment,
                                    fullPath: path
                                };
                            });

                        const uniqueChildNodes = new Map<string, SchemaTreeNode>();
                        childPaths.forEach(child => {
                            if (!uniqueChildNodes.has(child.name)) {
                                uniqueChildNodes.set(child.name, {
                                    name: child.name,
                                    path: child.path,
                                    type: 'object',
                                    children: []
                                });
                            }
                        });

                        const childNodes = Array.from(uniqueChildNodes.values());
                        if (childNodes.length > 0) {
                            const childProperties = buildFromNodes(childNodes, depth + 1);
                            if (Object.keys(childProperties).length > 0) {
                                properties[node.name].properties = childProperties;
                                if (!properties[node.name].type) {
                                    properties[node.name].type = 'object';
                                }
                            }
                        }
                    }
                }
            });

            return properties;
        };

        const selectedProperties = buildFromNodes(treeNodes);

        const baseProperties: any = {};

        // Check if apiVersion is selected and apply its configuration
        if (selectedPaths.has('apiVersion')) {
            baseProperties.apiVersion = originalSchema.properties?.apiVersion || { type: 'string' };
            if (resourceKey) {
                const apiVersionConfig = getEffectiveFieldConfiguration('apiVersion');
                if (apiVersionConfig.default !== undefined) {
                    baseProperties.apiVersion.default = apiVersionConfig.default;
                    console.log('✅ Applied default to apiVersion:', apiVersionConfig.default);
                }
            }
        }

        // Check if kind is selected and apply its configuration
        if (selectedPaths.has('kind')) {
            baseProperties.kind = originalSchema.properties?.kind || { type: 'string' };
            if (resourceKey) {
                const kindConfig = getEffectiveFieldConfiguration('kind');
                if (kindConfig.default !== undefined) {
                    baseProperties.kind.default = kindConfig.default;
                    console.log('✅ Applied default to kind:', kindConfig.default);
                }
            }
        }

        // Check if metadata or any metadata children are selected
        const hasMetadataSelected = selectedPaths.has('metadata') ||
            Array.from(selectedPaths).some(path => path.startsWith('metadata.'));

        if (hasMetadataSelected) {
            baseProperties.metadata = originalSchema.properties?.metadata || {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    labels: { type: 'object' },
                    annotations: { type: 'object' }
                }
            };

            // Apply metadata configuration
            if (resourceKey) {
                const metadataConfig = getEffectiveFieldConfiguration('metadata');
                if (metadataConfig.default !== undefined) {
                    baseProperties.metadata.default = metadataConfig.default;
                    console.log('✅ Applied default to metadata:', metadataConfig.default);
                }
            }
        }

        // Create the result schema with only selected base properties
        const result = {
            type: 'object',
            properties: {
                ...baseProperties,
                ...selectedProperties
            }
        };

        console.log('🔧 DEBUG: Final schema result with field configurations:', result);
        // 🔥 ADD COMPREHENSIVE FILTERED SCHEMA LOGGING
        console.log('🔥 DEBUG: ===== COMPLETE FILTERED SCHEMA =====');
        console.log('🔥 DEBUG: Full filtered schema JSON:', JSON.stringify(result, null, 2));
        console.log('🔥 DEBUG: Schema properties:', Object.keys(result.properties || {}));
        
        // Log each property in detail
        if (result.properties) {
            Object.entries(result.properties).forEach(([propName, propSchema]) => {
                console.log(`🔥 DEBUG: Property "${propName}":`, propSchema);
            });
        }
        console.log('🔥 DEBUG: ===== END FILTERED SCHEMA =====');

        return result;
    };


    /**     
    * Memoized filtered schema that applies field configurations and filters based on selected fields
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

    }, [resource?.schema, localSelectedFields, schemaTimestamp, schemaTree, resource?.source, resource?.kind, resource?.key, currentFieldStates])

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
    ): UISchemaProperty[] => {
        if (!schema?.properties) return []

        const properties: UISchemaProperty[] = []

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
    const handleFieldToggle = (property: UISchemaProperty, checked: boolean) => {
        const field: TemplateField = {
            path: property.path,
            name: property.name,
            title: '',
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
     * Clear all selected fields and ALL cached data
     */
    const handleClearAll = () => {
        // Clear UI state
        setLocalSelectedFields([]);
        setCurrentFieldStates({});
        setExpandedObjects(new Set());

        // Clear ALL storage and cache
        clearAllFieldConfigurations();

        // Force schema timestamp update to trigger complete re-render
        setSchemaTimestamp(Date.now());

        console.log('🧹 CLEARED ALL selected fields and cached data - COMPLETE RESET');
    };
    /**
     * Remove a field and clear its cache and localStorage configuration
     */
    const handleRemoveField = (fieldPath: string) => {
        // Remove from selected fields
        setLocalSelectedFields(prev => prev.filter(f => f.path !== fieldPath));

        // Clear the field configuration from localStorage
        if (resourceKey) {
            clearFieldConfiguration(resourceKey, fieldPath);
            console.log(`🧹 Cleared localStorage for field: ${fieldPath}`);
        }

        // Clear from current field states cache
        setCurrentFieldStates(prev => {
            const newStates = { ...prev };
            delete newStates[fieldPath];
            console.log(`🧹 Cleared cache for field: ${fieldPath}`);
            return newStates;
        });
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
    const isPartiallySelected = (property: UISchemaProperty) => {
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
    const getAllChildPaths = (property: UISchemaProperty): string[] => {
        const paths: string[] = []

        const collectPaths = (prop: UISchemaProperty) => {
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
        // Merge current field states into selected fields before saving
        const fieldsWithConfigurations = localSelectedFields.map(field => {
            const currentState = currentFieldStates[field.path];
            if (currentState) {
                // Apply current field state (including cleared titles) to the field
                return {
                    ...field,
                    title: currentState.title !== undefined ? currentState.title : field.title,
                    description: currentState.description !== undefined ? currentState.description : field.description,
                    defaultValue: currentState.default !== undefined ? currentState.default : field.defaultValue,
                    // Add other properties as needed
                };
            }
            return field;
        });

        // FIXED: Persist current field states to local storage before closing
        if (resourceKey && Object.keys(currentFieldStates).length > 0) {
            const configurationsToSave: Record<string, any> = {};
            Object.entries(currentFieldStates).forEach(([fieldPath, state]) => {
                configurationsToSave[fieldPath] = {
                    ...(state.default !== undefined && { default: state.default }),
                    ...(state.title !== undefined && { title: state.title }),
                    ...(state.description !== undefined && { description: state.description }),
                    ...(state.format !== undefined && { format: state.format })
                };
            });
            persistFieldConfigurations(resourceKey, configurationsToSave);
            console.log('💾 Persisted current field states to local storage:', configurationsToSave);
        }

        // Persist the filtered schema when saving
        if (resourceKey && filteredSchema && Object.keys(filteredSchema).length > 0) {
            console.log('💾 Saving filtered schema on confirm:', resourceKey)
            persistSelectedFieldsSchema(resourceKey, filteredSchema)
        }

        onFieldsChange(fieldsWithConfigurations)
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

    /**
     * Generate a descriptive type label for array fields in selected fields
     * @param field - The template field to generate label for
     * @returns A string describing the field type
     */
    const getEnhancedTypeLabel = (field: TemplateField): string => {
        if (field.type !== 'array') {
            return field.type || 'unknown';
        }

        // Check if we have array item schema information
        if (field.items?.type) {
            return `array of ${field.items.type}`;
        }

        return 'array of object';
    };

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

                <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
                    {/* Left Panel - Schema Display */}
                    <Card className="flex flex-col min-h-0 col-span-1">
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
                                                    name,
                                                    title: '',
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
                    <Card className="flex flex-col min-h-0 col-span-2">
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
                                            <div key={field.path} className="border rounded-lg">
                                                {/* Clickable Field Header - Toggle Configuration */}
                                                <div
                                                    className={`p-3 cursor-pointer transition-all duration-300 ${expandedFieldPath === field.path
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                                        } ${highlightedFieldPath === field.path
                                                            ? 'transform scale-105 shadow-lg'
                                                            : ''
                                                        }`}
                                                    onClick={() => toggleFieldConfig(field.path)}
                                                    title={expandedFieldPath === field.path ? "Click to close configuration" : "Click to configure field"}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2 flex-1">
                                                            <span className="font-medium">{field.name}</span>
                                                            {field.required && (
                                                                <Badge variant="destructive" className="text-xs">Required</Badge>
                                                            )}
                                                            <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600">
                                                                {getEnhancedTypeLabel(field)}
                                                            </Badge>
                                                            {/* Visual indicator for expandable state */}
                                                            <div className={`transition-transform duration-200 ${expandedFieldPath === field.path ? 'rotate-90' : ''
                                                                }`}>
                                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                                            </div>
                                                        </div>

                                                        {/* Larger Remove Button */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevent triggering the row click
                                                                handleRemoveField(field.path);
                                                            }}
                                                            className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                                                            title="Remove field"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </Button>
                                                    </div>

                                                    <div className="text-xs text-gray-500 mt-1">{field.path}</div>
                                                    {field.description && (
                                                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{field.description}</div>
                                                    )}

                                                    {/* Configuration hint */}
                                                    {expandedFieldPath !== field.path && (
                                                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 opacity-70">
                                                            Click to configure this field
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Expandable Configuration Section */}
                                                {expandedFieldPath === field.path && (
                                                    <div className="border-t bg-gray-50 dark:bg-gray-900/50 p-4 animate-in slide-in-from-top-2 duration-200">
                                                        <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                                                            Configure: {field.title}
                                                        </div>
                                                        {/* <EnhancedPropertyEditor
                                                            property={convertTemplateFieldToSchemaProperty(field)}
                                                            onSave={handleFieldConfigSave}
                                                            onCancel={handleFieldConfigCancel}
                                                            onDelete={handleFieldConfigDelete}
                                                        /> */}

                                                        <EnhancedPropertyEditor
                                                            property={getEffectiveFieldConfig(field.path)}
                                                            fieldPath={field.path}
                                                            onStateChange={handleFieldStateChange}
                                                        />
                                                    </div>
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