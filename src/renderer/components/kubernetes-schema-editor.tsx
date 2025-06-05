import { useState, useEffect, useMemo } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema, UiSchema } from '@rjsf/utils'
import { Button } from '@/renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { useTheme } from '@/renderer/components/theme-provider'

import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { json as jsonLanguage } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { joinPath } from '@/renderer/lib/path-utils'

import {
    Settings,
    Eye,
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
    Search
} from 'lucide-react'

import yaml from 'js-yaml'
import { kubernetesSchemaService } from '@/renderer/services/kubernetes-schema-service'
import { kubernetesSchemaIndexer } from '@/renderer/services/kubernetes-schema-indexer'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@radix-ui/react-dialog'
import { DialogHeader } from '@/renderer/components/ui/dialog'

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

// Custom field template for better styling
const CustomFieldTemplate = (props: any) => {
    const { id, classNames, label, help, required, description, errors, children } = props
    return (
        <div className={`space-y-2 ${classNames}`}>
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

// Resource grouping configuration
const RESOURCE_GROUPS = {
    workloads: {
        title: '🧩 Workloads',
        description: 'Resources that run applications or jobs',
        resources: ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Pod', 'ReplicaSet']
    },
    cluster: {
        title: '🏗️ Cluster Infrastructure',
        description: 'Internal resources that affect scheduling and topology',
        resources: ['Namespace', 'PersistentVolume', 'PersistentVolumeClaim', 'StorageClass', 'Node', 'CSIDriver', 'CSIDriverList', 'CSINode']
    },
    configuration: {
        title: '📦 Configuration & Secrets',
        description: 'Used to inject config into workloads',
        resources: ['ConfigMap', 'Secret', 'ServiceAccount']
    },
    networking: {
        title: '🌐 Networking',
        description: 'Define internal/external access, routing, and service discovery',
        resources: ['Service', 'Ingress', 'IngressClass', 'NetworkPolicy', 'EndpointSlice']
    },
    // storage: {
    //     title: '💾 Storage',
    //     description: 'Defines volumes and data persistence',
    //     resources: ['PersistentVolume', 'PersistentVolumeClaim', 'StorageClass']
    // },
    security: {
        title: '🔐 RBAC & Security',
        description: 'Manage permissions and access',
        resources: ['Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding', 'PodSecurityPolicy', 'NetworkPolicy', 'SecurityContext', 'LimitRange', 'ResourceQuota']
    },
    policy: {
        title: '📋 Policy & Automation',
        description: 'Internal resources that affect scheduling and topology',
        resources: ['ValidatingWebhookConfiguration', 'MutatingWebhookConfiguration', 'PodDisruptionBudget', 'PriorityClass']
    },
    observability: {
        title: '📈 Observability',
        description: 'Monitoring, logging, and tracing',
        resources: ['Event', 'EventList', 'WatchEvent', 'HorizontalPodAutoscaler', 'HorizontalPodAutoscalerList']
    },
    others: {
        title: '🔄 Others',
        description: 'Additional Kubernetes resources',
        resources: []
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

// Helper function to get category for a resource type
const getCategoryForResourceType = (resourceType: string): string => {
    for (const [categoryKey, category] of Object.entries(RESOURCE_GROUPS)) {
        if (category.resources.includes(resourceType)) {
            return categoryKey
        }
    }
    return 'others'
}

// Popular resource types for large categories
const popularResourceTypes = {
    others: ['CustomResourceDefinition', 'ConfigMap', 'Secret', 'PersistentVolume']
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
        expandedGroups: `k8s-expanded-groups-${context.product}-${context.customer}-${context.environment}`,
        selectedCategory: `k8s-selected-category-${context.product}-${context.customer}-${context.environment}`,
        resourceTypeFilter: `k8s-resource-filter-${context.product}-${context.customer}-${context.environment}`
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
        const cached = getCachedData(STORAGE_KEYS.availableKinds, [])
        return cached.length === 0
    })
    const [isLoadingSchema, setIsLoadingSchema] = useState(false)
    const [userDataDir, setUserDataDir] = useState<string>('')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        const cached = getCachedData(STORAGE_KEYS.expandedGroups, ['workloads'])
        return new Set(cached)
    })

    // New state variables for the optimized layout
    const [selectedCategory, setSelectedCategory] = useState<string>(() =>
        getCachedData(STORAGE_KEYS.selectedCategory, 'workloads')
    )
    const [resourceTypeFilter, setResourceTypeFilter] = useState<string>(() =>
        getCachedData(STORAGE_KEYS.resourceTypeFilter, '')
    )
    const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])

    // Add new state for schema viewer
    const [showSchemaViewer, setShowSchemaViewer] = useState(false)
    const [rawSchemaContent, setRawSchemaContent] = useState<string>('')

    // Add function to view raw schema
    const handleViewSchema = async () => {
        if (!schema) return

        try {
            // Format the schema as pretty JSON
            const formattedSchema = JSON.stringify(schema, null, 2)
            setRawSchemaContent(formattedSchema)
            setShowSchemaViewer(true)
        } catch (error) {
            console.error('Failed to format schema:', error)
        }
    }

    const { theme } = useTheme()

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

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.selectedCategory, JSON.stringify(selectedCategory))
    }, [selectedCategory, STORAGE_KEYS.selectedCategory])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.resourceTypeFilter, JSON.stringify(resourceTypeFilter))
    }, [resourceTypeFilter, STORAGE_KEYS.resourceTypeFilter])

    // Load available resource kinds from schema indexer
    useEffect(() => {
        const loadAvailableKinds = async () => {
            if (!userDataDir || !k8sVersion) {
                setIsLoadingKinds(false)
                return
            }

            setIsLoadingKinds(true)
            try {
                const definitionsPath = `${userDataDir}/schemas/${k8sVersion}/_definitions.json`
                await kubernetesSchemaIndexer.loadSchemaDefinitions(definitionsPath)
                const kinds = kubernetesSchemaIndexer.getAvailableKinds()
                setAvailableKinds(kinds)

                if (kinds.length > 0 && !kinds.includes(selectedResourceType)) {
                    setSelectedResourceType(kinds[0])
                }
            } catch (error) {
                console.error('Failed to load schema definitions:', error)
                const fallbackKinds = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress']
                setAvailableKinds(fallbackKinds)
                if (!fallbackKinds.includes(selectedResourceType)) {
                    setSelectedResourceType('Deployment')
                }
            } finally {
                setIsLoadingKinds(false)
            }
        }

        loadAvailableKinds()
    }, [userDataDir, k8sVersion])

    // Categorize resources when availableKinds changes
    const categorizedResources = useMemo(() => {
        return categorizeResources(availableKinds)
    }, [availableKinds])

    // Get filtered resource types based on selected category and search filter
    const filteredResourceTypes = useMemo(() => {
        const categoryResources = categorizedResources[selectedCategory]?.resources || []

        if (!resourceTypeFilter) {
            // For large categories, show popular items first
            if (selectedCategory === 'others' && categoryResources.length > 20) {
                const popular = popularResourceTypes.others.filter(type =>
                    categoryResources.includes(type)
                )
                const remaining = categoryResources.filter(type =>
                    !popular.includes(type)
                ).sort()
                return [...popular, ...remaining]
            }
            return categoryResources.sort()
        }

        return categoryResources.filter(type =>
            type.toLowerCase().includes(resourceTypeFilter.toLowerCase())
        ).sort()
    }, [categorizedResources, selectedCategory, resourceTypeFilter])

    // Determine display method based on category size
    const getDisplayMethod = (category: string, items: string[]) => {
        if (items.length <= 8) return 'horizontal'
        if (items.length <= 20) return 'grid'
        return 'dropdown'
    }

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
        const schema: RJSFSchema = {
            ...k8sSchema,
            $schema: 'http://json-schema.org/draft-07/schema#'
        }

        if (fullDefinitions && fullDefinitions.definitions) {
            schema.definitions = fullDefinitions.definitions
        }

        return schema
    }

    // Load actual Kubernetes schema when resource type changes
    useEffect(() => {
        const loadSchema = async () => {
            if (!selectedResourceType || !k8sVersion || !userDataDir) return

            setIsLoadingSchema(true)
            try {
                const apiVersion = getDefaultApiVersion(selectedResourceType)
                const definitionsPath = safeJoinPath(
                    userDataDir,
                    'schemas',
                    k8sVersion,
                    '_definitions.json'
                )

                const definitionsContent = await window.electronAPI.readFile(definitionsPath)
                const fullDefinitions = JSON.parse(definitionsContent)

                const k8sSchema = await kubernetesSchemaService.getSchema(
                    selectedResourceType,
                    apiVersion,
                    k8sVersion,
                    userDataDir
                )

                if (k8sSchema) {
                    const rjsfSchema = convertK8sSchemaToRJSF(k8sSchema, fullDefinitions)
                    setSchema(rjsfSchema)

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
        setResourceTypeFilter('')
        setSearchSuggestions([])
    }

    const handleFormChange = ({ formData: newFormData }: { formData: any }) => {
        setFormData(newFormData)
    }

    const handleSave = () => {
        if (onSave) {
            onSave(yamlPreview, selectedResourceType)
        }
    }

    // Enhanced search with auto-complete
    const handleSearchChange = (value: string) => {
        setResourceTypeFilter(value)
        if (value.length > 0 && selectedCategory === 'others') {
            const suggestions = availableKinds
                .filter(kind =>
                    getCategoryForResourceType(kind) === 'others' &&
                    kind.toLowerCase().includes(value.toLowerCase())
                )
                .slice(0, 10)
            setSearchSuggestions(suggestions)
        } else {
            setSearchSuggestions([])
        }
    }

    // Render resource type selector based on display method
    const renderResourceTypeSelector = () => {
        const categoryItems = filteredResourceTypes
        const displayMethod = getDisplayMethod(selectedCategory, categoryItems)

        switch (displayMethod) {
            case 'horizontal':
                return (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {categoryItems.map((type) => {
                            const IconComponent = RESOURCE_ICONS[type as keyof typeof RESOURCE_ICONS] || Box
                            return (
                                <Button
                                    key={type}
                                    variant={selectedResourceType === type ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleResourceTypeChange(type)}
                                    className="flex items-center gap-2 whitespace-nowrap"
                                >
                                    <IconComponent className="h-4 w-4" />
                                    {type}
                                </Button>
                            )
                        })}
                    </div>
                )
            case 'grid':
                return (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto">
                        {categoryItems.map((type) => {
                            const IconComponent = RESOURCE_ICONS[type as keyof typeof RESOURCE_ICONS] || Box
                            return (
                                <Button
                                    key={type}
                                    variant={selectedResourceType === type ? "default" : "outline"}
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
                )
            case 'dropdown':
                return (
                    <Select value={selectedResourceType} onValueChange={handleResourceTypeChange}>
                        <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Select resource type..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {categoryItems.map((type) => {
                                const IconComponent = RESOURCE_ICONS[type as keyof typeof RESOURCE_ICONS] || Box
                                return (
                                    <SelectItem key={type} value={type}>
                                        <div className="flex items-center gap-2">
                                            <IconComponent className="h-4 w-4" />
                                            <span>{type}</span>
                                        </div>
                                    </SelectItem>
                                )
                            })}
                        </SelectContent>
                    </Select>
                )
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
        <div className="space-y-4 h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-xl font-semibold">Create Kubernetes Resource</h2>
                    <p className="text-sm text-muted-foreground">
                        Schema-based editor for {context.product} - {context.customer} - {context.environment}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">k8s {k8sVersion}</Badge>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Resource
                    </Button>
                </div>
            </div>

            {/* Compact Resource Type Selector */}
            <Card className="flex-shrink-0">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Resource Type</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                            {filteredResourceTypes.length} available
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingKinds ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="text-sm text-muted-foreground">Loading resource types...</div>
                        </div>
                    ) : (
                        <>
                            {/* Category Tabs */}
                            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                                <TabsList className="grid w-full grid-cols-8">
                                    {Object.entries(categorizedResources).map(([key, group]) => {
                                        if (group.resources.length === 0) return null
                                        return (
                                            <TabsTrigger key={key} value={key} className="text-xs">
                                                {group.title} ({group.resources.length})
                                            </TabsTrigger>
                                        )
                                    })}
                                </TabsList>

                                {Object.entries(categorizedResources).map(([key, group]) => {
                                    if (group.resources.length === 0) return null
                                    return (
                                        <TabsContent key={key} value={key} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-muted-foreground flex-1">
                                                    {group.description}
                                                </p>
                                                {/* Search for large categories */}
                                                {group.resources.length > 8 && (
                                                    <div className="relative">
                                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Search resources..."
                                                            value={resourceTypeFilter}
                                                            onChange={(e) => handleSearchChange(e.target.value)}
                                                            className="pl-8 w-[250px]"
                                                        />
                                                        {searchSuggestions.length > 0 && (
                                                            <div className="absolute top-full left-0 right-0 bg-background border rounded-md shadow-lg z-10 max-h-[200px] overflow-y-auto">
                                                                {searchSuggestions.map((suggestion) => (
                                                                    <div
                                                                        key={suggestion}
                                                                        className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                                                        onClick={() => {
                                                                            handleResourceTypeChange(suggestion)
                                                                        }}
                                                                    >
                                                                        {suggestion}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {renderResourceTypeSelector()}
                                        </TabsContent>
                                    )
                                })}
                            </Tabs>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Form and Preview - Dynamic Height */}
            <div className="grid gap-4 lg:grid-cols-2 flex-1 min-h-0">
                {/* Form Section */}
                <Card className="flex flex-col min-h-0">
                    <CardHeader className="flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <CardTitle>Configuration Form</CardTitle>
                            {schema && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleViewSchema}
                                    className="text-xs"
                                >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View Schema
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <ScrollArea className="h-full pr-4">
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

                {/* YAML Preview Section */}
                <Card className="flex flex-col min-h-0">
                    <CardHeader className="flex-shrink-0">
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
                    <CardContent className="flex-1 p-0 min-h-0">
                        <div className="h-full">
                            <CodeMirror
                                value={yamlPreview}
                                height="100%"
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
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Schema Viewer Modal */}
            <Dialog open={showSchemaViewer} onOpenChange={setShowSchemaViewer}>
            <DialogContent className="w-[min(95vw,theme(maxWidth.6xl))] h-[85vh] flex flex-col resize overflow-hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 border-2 border-border shadow-2xl">
                    <DialogHeader className="flex-shrink-0 sticky top-0 bg-background z-10 border-b pb-3">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="pl-4 text-lg font-bold text-foreground drop-shadow-sm">
                                JSON Resource Type Schema - <span className="text-amber-600 dark:text-amber-450">{selectedResourceType}</span>
                            </DialogTitle>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (rawSchemaContent) {
                                            navigator.clipboard.writeText(rawSchemaContent);
                                        }
                                    }}
                                    className="text-xs pt-1 h-8 w-8 p-0"
                                    title="Copy schema to clipboard"
                                >
                                    <Copy className="h-5 w-5" />
                                    <span className="sr-only">Copy</span>
                                </Button>
                                <DialogClose asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Close dialog">
                                        <X className="h-6 w-6" />
                                        <span className="sr-only">Close</span>
                                    </Button>
                                </DialogClose>
                            </div>

                        </div>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-auto">
                        <div className="border rounded-md h-full">
                            <CodeMirror
                                value={rawSchemaContent || ''}
                                height="100%"
                                theme={isDarkMode ? oneDark : undefined}
                                extensions={[
                                    jsonLanguage(),
                                    EditorView.lineWrapping,
                                    ...readOnlyExtensions
                                ]}
                                editable={false}
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    dropCursor: false,
                                    allowMultipleSelections: false,
                                    indentOnInput: false
                                }}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}