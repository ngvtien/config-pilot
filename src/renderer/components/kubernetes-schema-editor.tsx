import React, { useState, useEffect, useMemo } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema, UiSchema } from '@rjsf/utils'
import { Button } from '@/renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Separator } from '@/renderer/components/ui/separator'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { useTheme } from '@/renderer/components/theme-provider' // Import 

import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { joinPath } from '@/renderer/lib/path-utils'


import {
    FileText,
    Settings,
    Eye,
    Save,
    X,
    Layers,
    Database,
    Network,
    Shield,
    Globe,
    Box,
    Key,
    Route,
    Copy,
    Plus,        // Add this
    ChevronUp,   // Add this
    ChevronDown  // Add this
} from 'lucide-react'

import yaml from 'js-yaml'
import { kubernetesSchemaService } from '@/renderer/services/kubernetes-schema-service'
import { kubernetesSchemaIndexer } from '@/renderer/services/kubernetes-schema-indexer'
// Resource type icons mapping
const RESOURCE_ICONS = {
    'Deployment': Layers,
    'Service': Network,
    'ConfigMap': Settings,
    'Secret': Key,
    'Pod': Box,
    'Namespace': Globe,
    'PersistentVolume': Database,
    'PersistentVolumeClaim': Database,
    'Ingress': Route,
    'ServiceAccount': Shield
}

interface KubernetesSchemaEditorProps {
    context: {
        product: string
        customer: string
        environment: string
    }
    k8sVersion: string
    onSave?: (content: string, resourceType: string) => void
    onClose?: () => void
}

const safeJoinPath = (...segments: (string | undefined | null)[]): string => {
    return joinPath(...segments.map(segment => segment || ''))
}

// CodeMirror extensions for read-only display
const readOnlyExtensions = [
    EditorView.theme({
        "&": {
            fontSize: "14px",
        },
        ".cm-content": {
            padding: "16px",
        },
        ".cm-focused": {
            outline: "none",
        },
        ".cm-editor": {
            borderRadius: "0",
        },
    }),
    EditorView.editable.of(false),
]
// Custom widgets that use your UI components
const customWidgets = {
    TextWidget: (props: any) => {
        const { id, value, onChange, label, placeholder, disabled, readonly, required } = props
        return (
            <div className="space-y-2">
                <Label htmlFor={id} className={required ? "after:content-['*'] after:text-destructive" : ""}>
                    {label}
                </Label>
                <Input
                    id={id}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readonly}
                    className="w-full"
                />
            </div>
        )
    },
    TextareaWidget: (props: any) => {
        const { id, value, onChange, label, placeholder, disabled, readonly, required, options } = props
        return (
            <div className="space-y-2">
                <Label htmlFor={id} className={required ? "after:content-['*'] after:text-destructive" : ""}>
                    {label}
                </Label>
                <Textarea
                    id={id}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readonly}
                    rows={options?.rows || 3}
                    className="w-full resize-none"
                />
            </div>
        )
    },
    SelectWidget: (props: any) => {
        const { id, value, onChange, label, options, disabled, readonly, required } = props
        return (
            <div className="space-y-2">
                <Label htmlFor={id} className={required ? "after:content-['*'] after:text-destructive" : ""}>
                    {label}
                </Label>
                <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.enumOptions?.map((option: any) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )
    },
    CheckboxWidget: (props: any) => {
        const { id, value, onChange, label, disabled, readonly, required } = props
        return (
            <div className="flex items-center space-x-2">
                <Checkbox
                    id={id}
                    checked={value || false}
                    onCheckedChange={onChange}
                    disabled={disabled}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor={id} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${required ? "after:content-['*'] after:text-destructive" : ""}`}>
                    {label}
                </Label>
            </div>
        )
    },

    // Add to customWidgets
    NumberWidget: (props: any) => {
        const { id, value, onChange, label, placeholder, disabled, readonly, required, schema } = props
        const { minimum, maximum } = schema || {}

        return (
            <div className="space-y-2">
                <Label htmlFor={id} className={required ? "after:content-['*'] after:text-destructive" : ""}>
                    {label}
                    {(minimum !== undefined || maximum !== undefined) && (
                        <span className="text-xs text-muted-foreground ml-1">
                            ({minimum !== undefined ? `min: ${minimum}` : ''}
                            {minimum !== undefined && maximum !== undefined ? ', ' : ''}
                            {maximum !== undefined ? `max: ${maximum}` : ''})
                        </span>
                    )}
                </Label>
                <Input
                    id={id}
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => {
                        const val = e.target.value
                        onChange(val === '' ? undefined : Number(val))
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readonly}
                    min={minimum}
                    max={maximum}
                    className="w-full"
                />
            </div>
        )
    },
}

// Basic K8s resource schemas
const getResourceSchema = (resourceType: string): RJSFSchema => {
    const baseSchema: RJSFSchema = {
        type: 'object',
        required: ['apiVersion', 'kind', 'metadata'],
        properties: {
            apiVersion: {
                type: 'string',
                title: 'API Version',
                default: getDefaultApiVersion(resourceType)
            },
            kind: {
                type: 'string',
                title: 'Kind',
                default: resourceType,
                readOnly: true
            },
            metadata: {
                type: 'object',
                title: 'Metadata',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                        title: 'Name',
                        pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
                    },
                    namespace: {
                        type: 'string',
                        title: 'Namespace',
                        pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
                    },
                    labels: {
                        type: 'object',
                        title: 'Labels',
                        additionalProperties: {
                            type: 'string'
                        }
                    },
                    annotations: {
                        type: 'object',
                        title: 'Annotations',
                        additionalProperties: {
                            type: 'string'
                        }
                    }
                }
            }
        }
    }

    // Add resource-specific spec
    switch (resourceType) {
        case 'Deployment':
            baseSchema.properties!.spec = getDeploymentSpec()
            break
        case 'Service':
            baseSchema.properties!.spec = getServiceSpec()
            break
        case 'ConfigMap':
            baseSchema.properties!.data = {
                type: 'object',
                title: 'Data',
                additionalProperties: {
                    type: 'string'
                }
            }
            break
        case 'Secret':
            baseSchema.properties!.data = {
                type: 'object',
                title: 'Data (Base64 encoded)',
                additionalProperties: {
                    type: 'string'
                }
            }
            break
    }

    return baseSchema
}


const getDefaultApiVersion = (resourceType: string): string => {
    switch (resourceType) {
        case 'Deployment': return 'apps/v1'
        case 'Service': return 'v1'
        case 'ConfigMap': return 'v1'
        case 'Secret': return 'v1'
        case 'Ingress': return 'networking.k8s.io/v1'
        case 'Pod': return 'v1'
        case 'Namespace': return 'v1'
        case 'PersistentVolume': return 'v1'
        case 'PersistentVolumeClaim': return 'v1'
        case 'ServiceAccount': return 'v1'
        default: return 'v1'
    }
}

const getDeploymentSpec = (): RJSFSchema => ({
    type: 'object',
    title: 'Deployment Spec',
    required: ['selector', 'template'],
    properties: {
        replicas: {
            type: 'integer',
            title: 'Replicas',
            default: 1,
            minimum: 0
        },
        selector: {
            type: 'object',
            title: 'Selector',
            required: ['matchLabels'],
            properties: {
                matchLabels: {
                    type: 'object',
                    title: 'Match Labels',
                    additionalProperties: {
                        type: 'string'
                    }
                }
            }
        },
        template: {
            type: 'object',
            title: 'Pod Template',
            required: ['metadata', 'spec'],
            properties: {
                metadata: {
                    type: 'object',
                    title: 'Pod Metadata',
                    properties: {
                        labels: {
                            type: 'object',
                            title: 'Labels',
                            additionalProperties: {
                                type: 'string'
                            }
                        }
                    }
                },
                spec: {
                    type: 'object',
                    title: 'Pod Spec',
                    required: ['containers'],
                    properties: {
                        containers: {
                            type: 'array',
                            title: 'Containers',
                            items: {
                                type: 'object',
                                required: ['name', 'image'],
                                properties: {
                                    name: {
                                        type: 'string',
                                        title: 'Container Name'
                                    },
                                    image: {
                                        type: 'string',
                                        title: 'Image'
                                    },
                                    ports: {
                                        type: 'array',
                                        title: 'Ports',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                containerPort: {
                                                    type: 'integer',
                                                    title: 'Container Port'
                                                },
                                                protocol: {
                                                    type: 'string',
                                                    title: 'Protocol',
                                                    enum: ['TCP', 'UDP'],
                                                    default: 'TCP'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
})

const getServiceSpec = (): RJSFSchema => ({
    type: 'object',
    title: 'Service Spec',
    required: ['selector'],
    properties: {
        type: {
            type: 'string',
            title: 'Service Type',
            enum: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'],
            default: 'ClusterIP'
        },
        selector: {
            type: 'object',
            title: 'Selector',
            additionalProperties: {
                type: 'string'
            }
        },
        ports: {
            type: 'array',
            title: 'Ports',
            items: {
                type: 'object',
                required: ['port'],
                properties: {
                    name: {
                        type: 'string',
                        title: 'Port Name'
                    },
                    port: {
                        type: 'integer',
                        title: 'Port'
                    },
                    targetPort: {
                        type: 'integer',
                        title: 'Target Port'
                    },
                    protocol: {
                        type: 'string',
                        title: 'Protocol',
                        enum: ['TCP', 'UDP'],
                        default: 'TCP'
                    }
                }
            }
        }
    }
})

const uiSchema: UiSchema = {
    'ui:submitButtonOptions': {
        norender: true
    },
    metadata: {
        labels: {
            'ui:widget': 'textarea',
            'ui:options': {
                rows: 3
            }
        },
        annotations: {
            'ui:widget': 'textarea',
            'ui:options': {
                rows: 3
            }
        },
        creationTimestamp: {
            'ui:widget': 'DateTimeWidget'
        }
    },
    spec: {
        // Add specific UI hints for common fields
        replicas: {
            'ui:widget': 'NumberWidget'
        }
    }
}

const RESOURCE_TYPES = [
    'Deployment',
    'Service',
    'ConfigMap',
    'Secret',
    'Ingress'
]

// Custom field template for better spacing and styling
const CustomFieldTemplate = (props: any) => {
    const { id, children, errors, help, description, hidden, required, displayLabel } = props

    if (hidden) {
        return <div className="hidden">{children}</div>
    }

    return (
        <div className="mb-4">
            {children}
            {description && (
                <div className="text-sm text-muted-foreground mt-1">{description}</div>
            )}
            {errors && (
                <div className="text-sm text-destructive mt-1">
                    {errors}
                </div>
            )}
            {help && (
                <div className="text-sm text-muted-foreground mt-1">{help}</div>
            )}
        </div>
    )
}

// Custom object field template for better nested object styling
const CustomObjectFieldTemplate = (props: any) => {
    const { title, description, properties, required, disabled, readonly, uiSchema, idSchema } = props

    return (
        <div className="space-y-4">
            {title && (
                <div className="border-b border-border pb-2 mb-4">
                    <h3 className="text-lg font-medium">{title}</h3>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    )}
                </div>
            )}
            <div className="grid gap-4">
                {properties.map((element: any) => (
                    <div key={element.name} className="space-y-2">
                        {element.content}
                    </div>
                ))}
            </div>
        </div>
    )
}

// Custom array field template for better array styling
const CustomArrayFieldTemplate = (props: any) => {
    const { title, items, canAdd, onAddClick, disabled, readonly, uiSchema, idSchema } = props

    return (
        <div className="space-y-4">
            {title && (
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{title}</h3>
                    {canAdd && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onAddClick}
                            disabled={disabled || readonly}
                        >
                            Add Item
                        </Button>
                    )}
                </div>
            )}
            <div className="space-y-3">
                {items && items.map((element: any) => (
                    <div key={element.key} className="flex items-start gap-2 p-3 border border-border rounded-lg">
                        <div className="flex-1">
                            {element.children}
                        </div>
                        {element.hasRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={element.onDropIndexClick(element.index)}
                                disabled={disabled || readonly}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// Enhanced UI Schema with better enum handling
const enhancedUiSchema: UiSchema = {
    'ui:submitButtonOptions': {
        norender: true
    },
    'ui:globalOptions': {
        addable: true,
        orderable: true,
        removable: true
    },
    metadata: {
        'ui:title': 'Metadata',
        'ui:description': 'Basic information about the resource',
        name: {
            'ui:placeholder': 'Enter resource name',
            'ui:help': 'Must be a valid DNS subdomain name'
        },
        namespace: {
            'ui:placeholder': 'Enter namespace',
            'ui:help': 'Namespace where the resource will be created'
        },
        labels: {
            'ui:widget': 'textarea',
            'ui:options': {
                rows: 4
            },
            'ui:placeholder': 'key1: value1\nkey2: value2',
            'ui:help': 'Key-value pairs for labeling the resource'
        },
        annotations: {
            'ui:widget': 'textarea',
            'ui:options': {
                rows: 3
            },
            'ui:placeholder': 'annotation1: value1\nannotation2: value2',
            'ui:help': 'Additional metadata for the resource'
        }
    },
    spec: {
        'ui:title': 'Specification',
        'ui:description': 'Resource-specific configuration',
        // Common enum field configurations
        protocol: {
            'ui:help': 'Network protocol for the service'
        },
        type: {
            'ui:help': 'Type of the resource'
        },
        strategy: {
            'ui:help': 'Deployment strategy'
        },
        restartPolicy: {
            'ui:help': 'Pod restart policy'
        }
    }
}

// Add resource grouping configuration after the RESOURCE_ICONS mapping
const RESOURCE_GROUPS = {
    workloads: {
        title: '🧩 Workloads',
        description: 'Resources that run applications or jobs',
        resources: ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Pod']
    },
    configuration: {
        title: '🟦 Configuration',
        description: 'Used to inject config into workloads',
        resources: ['ConfigMap', 'Secret', 'ServiceAccount']
    },
    networking: {
        title: '🟨 Networking & Access',
        description: 'Define internal/external access, routing, and service discovery',
        resources: ['Service', 'Ingress', 'NetworkPolicy']
    },
    storage: {
        title: '🟥 Storage',
        description: 'Defines volumes and data persistence',
        resources: ['PersistentVolume', 'PersistentVolumeClaim', 'StorageClass']
    },
    security: {
        title: '🟪 RBAC & Security',
        description: 'Manage permissions and access',
        resources: ['Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding', 'PodSecurityPolicy']
    },
    others: {
        title: '🟧 Others',
        description: 'Additional Kubernetes resources',
        resources: [] // Will be populated with remaining resources
    }
}

// Helper function to categorize available resources
const categorizeResources = (availableKinds: string[]) => {
    const categorized = { ...RESOURCE_GROUPS }
    const usedResources = new Set<string>()

    // Populate known categories
    Object.keys(categorized).forEach(groupKey => {
        if (groupKey !== 'others') {
            categorized[groupKey].resources = categorized[groupKey].resources.filter(resource => {
                if (availableKinds.includes(resource)) {
                    usedResources.add(resource)
                    return true
                }
                return false
            })
        }
    })

    // Add remaining resources to 'others'
    categorized.others.resources = availableKinds.filter(resource => !usedResources.has(resource))

    return categorized
}


export default function KubernetesSchemaEditor({
    context,
    k8sVersion,
    onSave,
    onClose
}: KubernetesSchemaEditorProps) {
    const STORAGE_KEYS = {
        availableKinds: `k8s-available-kinds-${k8sVersion}`,
        selectedResourceType: `k8s-selected-resource-type-${context.product}-${context.customer}-${context.environment}`,
        expandedGroups: `k8s-expanded-groups-${context.product}-${context.customer}-${context.environment}`
    }

    // Helper function to get cached data
    const getCachedData = (key: string, defaultValue: any) => {
        try {
            const cached = localStorage.getItem(key)
            return cached ? JSON.parse(cached) : defaultValue
        } catch {
            return defaultValue
        }
    }

    // State with localStorage initialization
    const [selectedResourceType, setSelectedResourceType] = useState<string>(() =>
        getCachedData(STORAGE_KEYS.selectedResourceType, 'Deployment')
    )
    const [formData, setFormData] = useState<any>({})
    const [yamlPreview, setYamlPreview] = useState<string>('')
    const [schema, setSchema] = useState<RJSFSchema | null>(null)
    const [availableKinds, setAvailableKinds] = useState<string[]>(() =>
        getCachedData(STORAGE_KEYS.availableKinds, [])
    )
    const [isLoadingKinds, setIsLoadingKinds] = useState(() => {
        // Only show loading if we don't have cached data
        const cached = getCachedData(STORAGE_KEYS.availableKinds, [])
        return cached.length === 0
    })
    const [isLoadingSchema, setIsLoadingSchema] = useState(false)
    const [userDataDir, setUserDataDir] = useState<string>('')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        const cached = getCachedData(STORAGE_KEYS.expandedGroups, ['workloads'])
        return new Set(cached)
    })

    const { theme } = useTheme() // Get current theme
    // Helper function to determine if we're in dark mode
    const isDarkMode = useMemo(() => {
        if (theme === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches
        }
        return theme === 'dark'
    }, [theme])

    // Persist state changes
    useEffect(() => {
        if (availableKinds.length > 0) {
            localStorage.setItem(STORAGE_KEYS.availableKinds, JSON.stringify(availableKinds))
        }
    }, [availableKinds, STORAGE_KEYS.availableKinds])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.selectedResourceType, JSON.stringify(selectedResourceType))
    }, [selectedResourceType, STORAGE_KEYS.selectedResourceType])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.expandedGroups, JSON.stringify([...expandedGroups]))
    }, [expandedGroups, STORAGE_KEYS.expandedGroups])

    // Load available resource kinds from schema indexer
    useEffect(() => {
        const loadAvailableKinds = async () => {
            if (!userDataDir || !k8sVersion) {
                setIsLoadingKinds(false) // Important: clear loading if dependencies not ready
                return
            }

            setIsLoadingKinds(true) // Set loading state
            try {
                const definitionsPath = `${userDataDir}/schemas/${k8sVersion}/_definitions.json`
                await kubernetesSchemaIndexer.loadSchemaDefinitions(definitionsPath)
                const kinds = kubernetesSchemaIndexer.getAvailableKinds()
                setAvailableKinds(kinds)

                // Ensure selected resource type is valid
                if (kinds.length > 0 && !kinds.includes(selectedResourceType)) {
                    setSelectedResourceType(kinds[0]) // Set to first available kind
                }
            } catch (error) {
                console.error('Failed to load schema definitions:', error)
                // Fallback to common resource types
                const fallbackKinds = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress']

                setAvailableKinds(fallbackKinds)
                if (!fallbackKinds.includes(selectedResourceType)) {
                    setSelectedResourceType('Deployment')
                }
            } finally {
                setIsLoadingKinds(false) // Clear loading state
            }
        }

        loadAvailableKinds()
    }, [userDataDir, k8sVersion])

    // const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['workloads']))

    // Categorize resources when availableKinds changes
    const categorizedResources = useMemo(() => {
        return categorizeResources(availableKinds)
    }, [availableKinds])

    const toggleGroup = (groupKey: string) => {
        const newExpanded = new Set(expandedGroups)
        if (newExpanded.has(groupKey)) {
            newExpanded.delete(groupKey)
        } else {
            newExpanded.add(groupKey)
        }
        setExpandedGroups(newExpanded)
    }

    // Load user data directory
    useEffect(() => {
        const loadUserDataDir = async () => {
            try {
                const dataDir = await window.electronAPI.getUserDataPath()
                setUserDataDir(dataDir)
            } catch (error) {
                console.error('Failed to get user data directory:', error)
            }
        }
        loadUserDataDir()
    }, [])

    const defaultFormData = useMemo(() => {
        return {
            apiVersion: getDefaultApiVersion(selectedResourceType),
            kind: selectedResourceType,
            metadata: {
                name: '',
                namespace: context.environment,
                labels: {
                    'app.kubernetes.io/name': '',
                    'app.kubernetes.io/instance': context.customer,
                    'app.kubernetes.io/version': k8sVersion,
                    'app.kubernetes.io/component': selectedResourceType.toLowerCase(),
                    'app.kubernetes.io/part-of': context.product
                }
            }
        }
    }, [selectedResourceType, context, k8sVersion])

    useEffect(() => {
        setFormData(defaultFormData)
    }, [defaultFormData])

    // Convert Kubernetes OpenAPI schema to RJSF format
    const convertK8sSchemaToRJSF = (k8sSchema: any, fullDefinitions?: any): RJSFSchema => {
        // The Kubernetes schema is already in JSON Schema format
        // We need to include the full definitions context for reference resolution
        const schema: RJSFSchema = {
            ...k8sSchema,
            $schema: 'http://json-schema.org/draft-07/schema#'
        }

        // If we have full definitions, include them so RJSF can resolve references
        if (fullDefinitions && fullDefinitions.definitions) {
            schema.definitions = fullDefinitions.definitions
        }

        return schema
    }

    // Load actual Kubernetes schema when resource type changes
    useEffect(() => {
        const loadSchema = async () => {
            // Wait for kinds to be loaded first
            if (!selectedResourceType || !k8sVersion || !userDataDir) return

            setIsLoadingSchema(true)
            try {
                // Get the API version for the resource type
                const apiVersion = getDefaultApiVersion(selectedResourceType)

                // Load the full definitions file to get all schema references
                const definitionsPath = safeJoinPath(
                    userDataDir,
                    'schemas',
                    k8sVersion,
                    '_definitions.json'
                )

                // const definitionsPath = `${userDataDir}/schemas/${k8sVersion}/_definitions.json`
                const definitionsContent = await window.electronAPI.readFile(definitionsPath)
                const fullDefinitions = JSON.parse(definitionsContent)

                // Load the real Kubernetes schema
                const k8sSchema = await kubernetesSchemaService.getSchema(
                    selectedResourceType,
                    apiVersion,
                    k8sVersion,
                    userDataDir
                )

                if (k8sSchema) {
                    // Convert Kubernetes schema to RJSF format with full definitions
                    const rjsfSchema = convertK8sSchemaToRJSF(k8sSchema, fullDefinitions)
                    setSchema(rjsfSchema)

                    // Set default form data
                    const defaultData = {
                        apiVersion,
                        kind: selectedResourceType,
                        metadata: {
                            name: '',
                            namespace: context.environment,
                            labels: {
                                'app.kubernetes.io/name': '',
                                'app.kubernetes.io/instance': context.customer,
                                'app.kubernetes.io/version': k8sVersion,
                                'app.kubernetes.io/component': selectedResourceType.toLowerCase(),
                                'app.kubernetes.io/part-of': context.product
                            }
                        }
                    }
                    setFormData(defaultData)
                }
            } catch (error) {
                console.error('Failed to load schema:', error)
            } finally {
                setIsLoadingSchema(false)
            }
        }

        loadSchema()
    }, [selectedResourceType, k8sVersion, userDataDir, context])

    useEffect(() => {
        try {
            const yamlString = yaml.dump(formData, { indent: 2 })
            setYamlPreview(yamlString)
        } catch (error) {
            setYamlPreview('# Invalid YAML data')
        }
    }, [formData])

    const handleResourceTypeChange = (resourceType: string) => {
        setSelectedResourceType(resourceType)
    }

    const handleFormChange = ({ formData: newFormData }: { formData: any }) => {
        setFormData(newFormData)
    }

    const handleSave = () => {
        if (onSave) {
            onSave(yamlPreview, selectedResourceType)
        }
    }

    if (isLoadingSchema) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading Kubernetes schema...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Create Kubernetes Resource</h2>
                    <p className="text-sm text-muted-foreground">
                        Schema-based editor for {context.product} - {context.customer} - {context.environment}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">k8s {k8sVersion}</Badge>
                    {/* <Badge variant="secondary">Real Schema</Badge> */}
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Resource
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Resource Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {
                        isLoadingKinds ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-sm text-muted-foreground">Loading resource types...</div>
                            </div>
                        ) : (

                            Object.entries(categorizedResources).map(([groupKey, group]) => {
                                // Skip empty groups
                                if (group.resources.length === 0) return null

                                const isExpanded = expandedGroups.has(groupKey)

                                return (
                                    <div key={groupKey} className="border rounded-lg">
                                        {/* Group Header */}
                                        <button
                                            onClick={() => toggleGroup(groupKey)}
                                            className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between"
                                        >
                                            <div>
                                                <h3 className="font-medium text-sm">{group.title}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {group.resources.length}
                                                </Badge>
                                                {isExpanded ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                        </button>

                                        {/* Group Resources */}
                                        {isExpanded && (
                                            <div className="p-3 pt-0 border-t">
                                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                                    {group.resources.map((type) => {
                                                        const IconComponent = RESOURCE_ICONS[type as keyof typeof RESOURCE_ICONS] || Box
                                                        return (
                                                            <Button
                                                                key={type}
                                                                variant={selectedResourceType === type ? 'default' : 'outline'}
                                                                onClick={() => handleResourceTypeChange(type)}
                                                                className="h-16 flex flex-col gap-1 text-xs"
                                                                title={type}
                                                            >
                                                                <IconComponent className="h-4 w-4" />
                                                                <span className="truncate">{type}</span>
                                                            </Button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            }))
                    }
                </CardContent>
            </Card>

            {/* Form and Preview */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Form Section */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Configuration Form</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <ScrollArea className="h-[600px] pr-4">
                            {schema ? (
                                <div className="space-y-6">
                                    <Form
                                        schema={schema}
                                        formData={formData}
                                        onChange={handleFormChange}
                                        validator={validator}
                                        showErrorList={false}
                                        uiSchema={enhancedUiSchema}
                                        widgets={customWidgets}
                                        templates={{
                                            FieldTemplate: CustomFieldTemplate,
                                            ObjectFieldTemplate: CustomObjectFieldTemplate,
                                            ArrayFieldTemplate: CustomArrayFieldTemplate
                                        }}
                                        className="space-y-6"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-32">
                                    <p className="text-muted-foreground">No schema available for {selectedResourceType}</p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Enhanced YAML Preview Section with Syntax Highlighting */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>YAML Preview</CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    {yamlPreview.split('\n').length} lines
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(yamlPreview)}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0">
                        <ScrollArea className="h-[600px]">
                            <CodeMirror
                                value={yamlPreview}
                                height="600px"
                                theme={isDarkMode ? oneDark : undefined}
                                extensions={[
                                    yamlLanguage(),
                                    ...readOnlyExtensions,
                                    EditorView.theme({
                                        "&": {
                                            height: "100%",
                                        },
                                        ".cm-editor": {
                                            height: "100%",
                                        },
                                        ".cm-scroller": {
                                            overflow: "auto",
                                            maxHeight: "100%",
                                        },
                                    }),
                                ]}
                                editable={false}
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: false,
                                    dropCursor: false,
                                    allowMultipleSelections: false,
                                }}
                            />
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}