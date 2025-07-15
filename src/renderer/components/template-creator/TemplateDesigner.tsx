import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Alert, AlertDescription } from '@/renderer/components/ui/alert'
import { Skeleton } from '@/renderer/components/ui/skeleton'
import { Search, FileText, ChevronDown, TrashIcon, Download, Eye, Save, FileJson, FileCode } from 'lucide-react'
import { kubernetesSchemaIndexer } from '@/renderer/services/kubernetes-schema-indexer'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import type { SettingsData } from '@/shared/types/settings-data'
import type { ContextData } from '@/shared/types/context-data'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema } from '@rjsf/utils'
import { TextWidget, TextareaWidget, CheckboxWidget, SelectWidget } from './custom-widgets'
import { Template, TemplateResource, TemplateField } from '@/shared/types/template'
import { Textarea } from '@/renderer/components/ui/textarea'
import { SchemaFieldSelectionModal, clearResourceData } from './SchemaFieldSelectionModal'
import { joinPath } from '@/renderer/lib/path-utils'
import { generateHelmResourceTemplate, generateResourceYamlPreview } from '@/renderer/utils/helm-template-generator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import { YamlPreview } from './YamlPreview'
import { generateYamlFromFilteredSchema } from '../../utils/schema-yaml-generator'

interface TemplateDesignerProps {
  initialTemplate?: Template
  onTemplateChange?: (template: Template) => void
  settingsData: SettingsData
  contextData: ContextData
}

/**
 * TemplateDesigner component with searchable Kubernetes kinds dropdown
 * Uses the existing kubernetesSchemaIndexer service for caching and efficient loading
 * Gets Kubernetes version from settings data instead of manual selection
 */
export function TemplateDesigner({ initialTemplate, onTemplateChange, settingsData, contextData }: TemplateDesignerProps) {
  // Update the template state initialization with persistence
  const [template, setTemplate] = useState<Template>(() => {
    try {
      const saved = localStorage.getItem('template-designer-template-data')
      if (saved) {
        const parsedTemplate = JSON.parse(saved)
        return {
          name: parsedTemplate.name || '',
          description: parsedTemplate.description || '',
          resources: [] // Resources are handled separately
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted template data:', error)
    }

    return initialTemplate || {
      name: '',
      resources: []
    }
  })

  const [searchResults, setSearchResults] = useState<KubernetesResourceSchema[]>([])

  const [selectedFields, setSelectedFields] = useState<{
    [resourceKey: string]: TemplateField[]
  }>({})

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKind, setSelectedKind] = useState<KubernetesResourceSchema | null>(null)
  const [availableKinds, setAvailableKinds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userDataDir, setUserDataDir] = useState<string>('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [selectedResources, setSelectedResources] = useState<TemplateResource[]>(() => {
    try {
      const saved = localStorage.getItem('template-designer-selected-resources')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.warn('Failed to load persisted selected resources:', error)
      return []
    }
  });

  const [selectedResource, setSelectedResource] = useState<KubernetesResourceSchema | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false)
  const [selectedResourceForSchema, setSelectedResourceForSchema] = useState<KubernetesResourceSchema | null>(null)
  const [selectedResourceIndex, setSelectedResourceIndex] = useState<number | null>(null)

  const [isYamlPreviewOpen, setIsYamlPreviewOpen] = useState(false)
  const [previewYamlContent, setPreviewYamlContent] = useState('')
  const [previewResourceKind, setPreviewResourceKind] = useState('')
  const [lastConfiguredResourceIndex, setLastConfiguredResourceIndex] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isDropdownOpen])

  useEffect(() => {
    // Auto-close dropdown when search term is empty
    if (!searchTerm.trim()) {
      setIsDropdownOpen(false)
    }
  }, [searchTerm])

  // Get Kubernetes version from settings data
  const kubernetesVersion = settingsData.kubernetesVersion

  // Persist template name and description
  useEffect(() => {
    try {
      const templateData = {
        name: template.name,
        description: template.description
      }
      localStorage.setItem('template-designer-template-data', JSON.stringify(templateData))
      console.log('Persisted template data:', templateData)
    } catch (error) {
      console.warn('Failed to persist template data:', error)
    }
  }, [template.name, template.description])

  // Persist selectedResources changes
  useEffect(() => {
    try {
      localStorage.setItem('template-designer-selected-resources', JSON.stringify(selectedResources))
      //console.log('Persisted selected resources:', selectedResources.length, 'resources')
    } catch (error) {
      console.warn('Failed to persist selected resources:', error)
    }
  }, [selectedResources])

  /**
   * Transform schema property for RJSF compatibility
   */
  const transformSchemaProperty = (property: any, propertyName?: string): any => {
    if (!property || typeof property !== 'object') return property

    const transformed = { ...property }

    // Remove any undefined $ref properties
    if (transformed['$ref'] === undefined) {
      delete transformed['$ref']
    }

    // Handle enum properties
    if (transformed.enum && Array.isArray(transformed.enum)) {
      transformed.enum = transformed.enum.filter(val => val !== undefined && val !== null)
      if (transformed.enum.length === 0) {
        delete transformed.enum
      }
    }

    // Handle array properties
    if (transformed.type === 'array' && transformed.items) {
      transformed.items = transformSchemaProperty(transformed.items)

      if (transformed.items.type === 'object' && transformed.items.properties) {
        const transformedProperties: any = {}
        Object.keys(transformed.items.properties).forEach(key => {
          transformedProperties[key] = transformSchemaProperty(transformed.items.properties[key], key)
        })
        transformed.items.properties = transformedProperties
      }
    }

    // Handle object properties recursively
    if (transformed.type === 'object' && transformed.properties) {
      const transformedProperties: any = {}
      Object.keys(transformed.properties).forEach(key => {
        transformedProperties[key] = transformSchemaProperty(transformed.properties[key], key)
      })
      transformed.properties = transformedProperties
    }

    // Handle oneOf/anyOf for union types
    if (transformed.oneOf && Array.isArray(transformed.oneOf)) {
      transformed.oneOf = transformed.oneOf.map((schema: any) => transformSchemaProperty(schema))
    }

    if (transformed.anyOf && Array.isArray(transformed.anyOf)) {
      transformed.anyOf = transformed.anyOf.map((schema: any) => transformSchemaProperty(schema))
    }

    return transformed
  }

  // Add custom widgets configuration
  const customWidgets = {
    TextWidget,
    TextareaWidget,
    CheckboxWidget,
    SelectWidget,
  }

  /**
   * Generate UI schema with proper description hiding
   */
  const generateUISchema = useCallback((kubernetesSchema: KubernetesResourceSchema) => {
    const uiSchema: any = {
      'ui:options': {
        hideDescription: true,
      },
      metadata: {
        'ui:order': ['name', 'namespace', 'labels', 'annotations'],
        'ui:options': {
          hideDescription: true,
        },
        name: {
          'ui:placeholder': 'Enter resource name',
          'ui:options': {
            hideDescription: true,
          }
        },
        namespace: {
          'ui:placeholder': 'Enter namespace (optional)',
          'ui:options': {
            hideDescription: true,
          }
        },
        labels: {
          'ui:widget': 'textarea',
          'ui:placeholder': 'key1=value1\nkey2=value2',
          'ui:options': {
            hideDescription: true,
          }
        },
        annotations: {
          'ui:widget': 'textarea',
          'ui:placeholder': 'key1=value1\nkey2=value2',
          'ui:options': {
            hideDescription: true,
          }
        }
      },
      spec: {
        'ui:options': {
          hideDescription: true,
        },
      }
    }

    return uiSchema
  }, [])

  /**
   * Convert Kubernetes schema to RJSF schema format
   */
  /**
 * Convert Kubernetes schema to RJSF schema format
 */
  const convertToRJSFSchema = useCallback(async (kubernetesSchema: any): Promise<RJSFSchema> => {
    if (!kubernetesSchema?.schema) return {}

    try {
      // Get the schema index to access all definitions
      const schemaIndex = kubernetesSchemaIndexer.getSchemaIndex()
      if (!schemaIndex) {
        console.warn('Schema index not available')
        return {}
      }

      // Use the indexer's getResolvedSchema method to resolve all $ref references
      const resolvedSchema = await kubernetesSchemaIndexer.getResolvedSchema(
        kubernetesSchema.group,
        kubernetesSchema.version,
        kubernetesSchema.kind
      )

      if (!resolvedSchema) {
        console.warn(`Could not resolve schema for ${kubernetesSchema.kind}`)
        return {}
      }

      // Create the base RJSF schema
      const rjsfSchema: RJSFSchema = {
        type: 'object',
        title: `${kubernetesSchema.kind} Configuration`,
        properties: {
          metadata: {
            type: 'object',
            title: 'Metadata',
            properties: {
              name: {
                type: 'string',
                title: 'Name',
              },
              namespace: {
                type: 'string',
                title: 'Namespace',
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
            },
            required: ['name']
          }
        },
        required: ['metadata'],
        definitions: {}
      }

      // Helper function to collect all $ref references recursively
      const collectReferences = (obj: any, refs: Set<string> = new Set()): Set<string> => {
        if (!obj || typeof obj !== 'object') return refs

        if (Array.isArray(obj)) {
          obj.forEach(item => collectReferences(item, refs))
          return refs
        }

        // Check for $ref property
        if (obj['$ref'] && typeof obj['$ref'] === 'string') {
          refs.add(obj['$ref'])
        }

        // Recursively check all properties
        Object.values(obj).forEach(value => {
          collectReferences(value, refs)
        })

        return refs
      }

      // Helper function to add definition to schema recursively
      const addDefinition = (ref: string, processedRefs: Set<string> = new Set()) => {
        if (!ref.startsWith('#/definitions/')) return
        if (processedRefs.has(ref)) return // Prevent infinite recursion

        const definitionKey = ref.replace('#/definitions/', '')
        if (rjsfSchema.definitions && rjsfSchema.definitions[definitionKey]) return

        const definition = schemaIndex.definitions?.[definitionKey]
        if (!definition) {
          console.warn(`Definition not found: ${definitionKey}`)
          return
        }

        processedRefs.add(ref)
        const transformedDefinition = transformSchemaProperty(definition)
        if (!rjsfSchema.definitions) rjsfSchema.definitions = {}
        rjsfSchema.definitions[definitionKey] = transformedDefinition

        // Recursively add any nested definitions
        const nestedRefs = collectReferences(transformedDefinition)
        nestedRefs.forEach(nestedRef => {
          if (!processedRefs.has(nestedRef)) {
            addDefinition(nestedRef, processedRefs)
          }
        })
      }

      // Add the spec property from resolved schema
      if (resolvedSchema.properties?.spec) {
        rjsfSchema.properties!.spec = {
          ...transformSchemaProperty(resolvedSchema.properties.spec),
          title: 'Specification'
        }
        rjsfSchema.required!.push('spec')
      }

      // Collect and add all referenced definitions
      const allRefs = collectReferences(rjsfSchema)
      allRefs.forEach(ref => addDefinition(ref))

      return rjsfSchema
    } catch (error) {
      console.error('Error converting schema to RJSF format:', error)
      return {
        type: 'object',
        title: `${kubernetesSchema.kind} Configuration (Error)`,
        properties: {
          metadata: {
            type: 'object',
            title: 'Metadata',
            properties: {
              name: {
                type: 'string',
                title: 'Name',
              }
            },
            required: ['name']
          }
        },
        required: ['metadata']
      }
    }
  }, [])

  /**
   * Compute RJSF schema from selected kind
   */
  const rjsfSchema = useMemo(() => {
    if (!selectedKind) return null
    return convertToRJSFSchema(selectedKind)
  }, [selectedKind, convertToRJSFSchema])

  /**
   * Load user data directory on component mount
   */
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

  /**
   * Load schema definitions using the existing kubernetesSchemaIndexer service
   */
  const loadSchemaDefinitions = async (version: string = kubernetesVersion) => {
    if (!userDataDir) return

    setIsLoading(true)
    setError(null)

    try {
      //const definitionsPath = `${userDataDir}/schemas/${version}/_definitions.json`
      const definitionsPath = joinPath(userDataDir, 'schemas', 'k8s', version, '_definitions.json');

      // Check if file exists
      const fileExists = await window.electronAPI.fileExists(definitionsPath)
      if (!fileExists) {
        throw new Error(`Schema definitions not found for version ${version}. Please download the schema first.`)
      }

      // Use the existing kubernetesSchemaIndexer service (it handles caching internally)
      await kubernetesSchemaIndexer.loadSchemaDefinitions(definitionsPath)

      // Try to enhance with CRDs (optional, non-breaking)
      try {
        const enhancedKinds = await kubernetesSchemaIndexer.getAvailableKindsWithCRDs()
        setAvailableKinds(enhancedKinds)
        console.log('✅ Enhanced with CRD schemas')
      } catch (crdError) {
        console.warn('CRD enhancement not available, using standard schemas:', crdError)
        // Fallback to standard functionality
        const standardKinds = kubernetesSchemaIndexer.getAvailableKinds()
        setAvailableKinds(standardKinds)
      }

    } catch (err: any) {
      console.error('Failed to load schema definitions:', err)
      setError(err.message || 'Failed to load schema definitions')
      setAvailableKinds([])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Search for resources using the indexer's search functionality
   */
  useEffect(() => {
    /**
     * Perform enhanced search with CRD support
     */
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        // Return all kinds as basic search results when no search term
        const allKindsPromises = availableKinds.map(async kind => {
          const versions = await kubernetesSchemaIndexer.getKindVersions(kind)
          return versions[0] // Return the first version for each kind
        }).filter(Boolean)

        // Wait for all promises to resolve
        const allKindsResults = await Promise.all(allKindsPromises)
        setSearchResults(allKindsResults.filter(Boolean))
        console.log('🔍 No search term - showing all kinds:', allKindsResults.length)
        return
      }

      try {
        // Use enhanced search with CRDs
        const results = await kubernetesSchemaIndexer.searchResourcesWithCRDs(searchTerm)
        //console.log('🔍 Enhanced search results:', results)
        //console.log('🔍 CRD resources found:', results.filter(r => r.group !== 'core' && r.group !== ''))
        setSearchResults(results)
        //console.log('✅ Using enhanced search with CRDs:', results.length, 'results')
      } catch (error) {
        //console.warn('Enhanced search not available, using standard search:', error)
        // Fallback to standard search
        const standardResults = kubernetesSchemaIndexer.searchResources(searchTerm)
        setSearchResults(standardResults)
      }
    }

    performSearch()
  }, [searchTerm, availableKinds])

  /**
   * Handle kind selection from searchable dropdown
   */
  const handleKindSelect = (resource: KubernetesResourceSchema) => {
    // Check if resource is already selected
    console.log('handleKindSelect received resource:', resource);

    // Ensure apiVersion is always present - fallback calculation
    if (!resource.apiVersion && resource.group && resource.version) {
      resource.apiVersion = resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`
      console.log('✅ Added fallback apiVersion:', resource.apiVersion)
    }

    // Use the actual apiVersion for duplicate check instead of manually constructing it
    const isAlreadySelected = selectedResources.some(r =>
      r.kind === resource.kind && r.apiVersion === resource.apiVersion
    )

    if (isAlreadySelected) {
      return // Don't add duplicates
    }

    // Ensure apiVersion is always present - fallback calculation
    if (!resource.apiVersion && resource.group && resource.version) {
      resource.apiVersion = resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`
      console.log('✅ Added fallback apiVersion:', resource.apiVersion)
    }

    console.log('🐛 DEBUG - Resource before creating TemplateResource:', {
      kind: resource.kind,
      group: resource.group,
      version: resource.version,
      apiVersion: resource.apiVersion,
      source: resource.source
    });

    const newResource: TemplateResource = {
      apiVersion: resource.apiVersion, // Use the properly set apiVersion
      kind: resource.kind,
      selectedFields: [],
      source: resource.source,
      originalSchema: resource
    }

    console.log('🐛 DEBUG - Created TemplateResource:', {
      apiVersion: newResource.apiVersion,
      kind: newResource.kind
    });

    setSelectedResources(prev => [...prev, newResource])
    setSelectedResource(resource)

    // Clear search and close dropdown
    setSearchTerm('')
    setIsDropdownOpen(false)
  }

  // Function to handle field selection
  const handleFormChange = ({ formData: newFormData }: { formData: any }) => {
    setFormData(newFormData)
  }

  // Load schema definitions when userDataDir is available or when kubernetesVersion changes
  useEffect(() => {
    if (userDataDir && kubernetesVersion) {
      loadSchemaDefinitions(kubernetesVersion)
    }
  }, [userDataDir, kubernetesVersion])

/**
 * Remove a selected resource and clear all its cached data
 */
const removeResource = (resourceToRemove: TemplateResource) => {
  // Generate resource key for clearing cached data
  const resourceKey = `${resourceToRemove.apiVersion}/${resourceToRemove.kind}`;
  
  // CLEAR ALL cached data for this resource FIRST
  clearResourceData(resourceKey);
  
  // Remove from selected resources
  setSelectedResources(prev =>
    prev.filter(resource =>
      !(resource.apiVersion === resourceToRemove.apiVersion &&
        resource.kind === resourceToRemove.kind)
    )
  )

  // Clear selected resource if it's the one being removed
  if (selectedResource &&
    selectedResource.kind === resourceToRemove.kind &&
    `${selectedResource.group}/${selectedResource.version}` === resourceToRemove.apiVersion) {
    setSelectedResource(null)
  }
  
  console.log(`🧹 REMOVED resource and CLEARED ALL cached data: ${resourceKey}`);
}

  // Filter search results to exclude already selected resources
  const filteredSearchResults = useMemo(() => {
    const filtered = searchResults.filter((resource: { kind: any; group: any; version: any }) =>
      !selectedResources.some(selected =>
        selected.kind === resource.kind &&
        selected.apiVersion === `${resource.group}/${resource.version}`
      )
    )
    // console.log('🔍 Filtered search results:', filtered.length, 'of', searchResults.length)
    // console.log('🔍 CRDs in filtered results:', filtered.filter(r => r.group !== 'core' && r.group !== ''))
    return filtered
  }, [searchResults, selectedResources])

  /**
 * Handle field selection changes from the modal
 */
  const handleFieldSelectionChange = (fields: TemplateField[]) => {
    if (selectedResourceIndex !== null) {
      const updatedResources = [...selectedResources]
      updatedResources[selectedResourceIndex] = {
        ...updatedResources[selectedResourceIndex],
        selectedFields: fields
      }
      setSelectedResources(updatedResources)

      // Update template
      const updatedTemplate = {
        ...template,
        resources: updatedResources
      }
      setTemplate(updatedTemplate)
      onTemplateChange?.(updatedTemplate)
    }
  }

  /**
   * Generate YAML preview of the template
   */
  const generateYamlPreview = () => {
    // Implementation for YAML generation
    console.log('Generating YAML preview for template:', template)
    // This would generate YAML based on selected resources and fields
  }

  /**
   * Generate JSON preview of the template
   */
  const generateJsonPreview = () => {
    // Implementation for JSON generation
    console.log('Generating JSON preview for template:', template)
    // This would generate JSON based on selected resources and fields
  }

  /**
   * Save template to file system with folder structure
   */
  const saveTemplate = async () => {
    if (!template.name.trim()) {
      console.error('Template name is required')
      return
    }

    try {
      // Create the template folder structure: {baseDirectory}/{template-name}
      const templateDir = joinPath(settingsData.baseDirectory, template.name)

      // Ensure the template directory exists
      await window.electronAPI.createDirectory(templateDir)

      // Create helm subdirectory
      const helmDir = joinPath(templateDir, 'helm')
      await window.electronAPI.createDirectory(helmDir)

      // Create kustomize subdirectory  
      const kustomizeDir = joinPath(templateDir, 'kustomize')
      await window.electronAPI.createDirectory(kustomizeDir)

      // Prepare template metadata
      const templateMetadata = {
        name: template.name,
        description: template.description || '',
        resources: selectedResources.map(resource => ({
          kind: resource.kind,
          apiVersion: resource.apiVersion,
          namespace: resource.namespace,
          selectedFields: resource.selectedFields || [],
          templateType: resource.templateType || 'kubernetes',
          source: resource.source
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Save template.metadata.json in the template directory
      const metadataPath = joinPath(templateDir, 'template.metadata.json')
      await window.electronAPI.writeFile(metadataPath, JSON.stringify(templateMetadata, null, 2))

      // Generate and save template.schema.json (JSON Schema for validation)
      const schemaPath = joinPath(templateDir, 'template.schema.json')
      const templateSchema = generateTemplateSchema(templateMetadata)
      await window.electronAPI.writeFile(schemaPath, JSON.stringify(templateSchema, null, 2))

      // Generate Helm files
      await generateHelmFiles(helmDir, templateMetadata)

      // Generate Kustomize files
      await generateKustomizeFiles(kustomizeDir, templateMetadata)

      console.log('✅ Template saved successfully to:', templateDir)

      // Optional: Show success notification to user
      // You might want to add a toast notification here

    } catch (error) {
      console.error('❌ Failed to save template:', error)
      // Optional: Show error notification to user
    }
  }

  /**
   * Generate JSON Schema for template validation
   */
  /**
   * Generates a simplified template schema that groups fields by resource type
   * Creates a user-friendly structure like deployment.replicas, configmap.data, etc.
   * @param template - The template containing selected resources and fields
   * @returns JSON Schema object for form generation
   */
  const generateTemplateSchema = (template: Template): any => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      title: template.name,
      description: template.description,
      properties: {} as any,
      required: [] as string[]
    };

    template.resources.forEach((resource) => {
      // Use lowercase resource kind as the property key (e.g., "deployment", "configmap")
      const resourceKey = resource.kind.toLowerCase();

      // Initialize the resource object in the schema
      schema.properties[resourceKey] = {
        type: "object",
        title: `${resource.kind} Configuration`,
        description: `Configuration for ${resource.kind} resource`,
        properties: {} as any,
        required: [] as string[]
      };

      // Process each selected field for this resource
      resource.selectedFields.forEach(field => {
        // Extract the final property name from the path (e.g., "spec.replicas" -> "replicas")
        const fieldParts = field.path.split('.');
        const fieldName = fieldParts[fieldParts.length - 1].replace(/\[\]/g, '');

        // Create the field schema based on the field type and constraints
        const fieldSchema: any = {
          title: fieldName.charAt(0).toUpperCase() + fieldName.slice(1), // Capitalize first letter
          description: field.description || `Configuration for ${fieldName}`
        };

        // Set the type and constraints based on the field type
        switch (field.type) {
          case 'string':
            fieldSchema.type = 'string';
            if (field.constraints?.enum) {
              fieldSchema.enum = field.constraints.enum;
            }
            if (field.constraints?.pattern) {
              fieldSchema.pattern = field.constraints.pattern;
            }
            if (field.constraints?.minLength) {
              fieldSchema.minLength = field.constraints.minLength;
            }
            if (field.constraints?.maxLength) {
              fieldSchema.maxLength = field.constraints.maxLength;
            }
            break;

          case 'number':
          case 'integer':
            fieldSchema.type = field.type;
            if (field.constraints?.minimum !== undefined) {
              fieldSchema.minimum = field.constraints.minimum;
            }
            if (field.constraints?.maximum !== undefined) {
              fieldSchema.maximum = field.constraints.maximum;
            }
            // Set sensible defaults for common fields
            if (fieldName === 'replicas') {
              fieldSchema.default = 1;
            }
            break;

          case 'boolean':
            fieldSchema.type = 'boolean';
            break;

          case 'array':
            fieldSchema.type = 'array';
            fieldSchema.items = {
              type: 'string' // Default to string, could be enhanced based on array item type
            };
            if (field.constraints?.minItems !== undefined) {
              fieldSchema.minItems = field.constraints.minItems;
            }
            if (field.constraints?.maxItems !== undefined) {
              fieldSchema.maxItems = field.constraints.maxItems;
            }
            break;

          case 'object':
            fieldSchema.type = 'object';
            fieldSchema.additionalProperties = true;
            // Set default empty object for common object fields
            if (fieldName === 'env' || fieldName === 'data' || fieldName === 'labels' || fieldName === 'annotations') {
              fieldSchema.default = {};
            }
            break;

          default:
            fieldSchema.type = 'string';
        }

        // Add examples if available
        if (field.example !== undefined) {
          fieldSchema.examples = [field.example];
        }

        // Set default value if available and not already set
        if (field.default !== undefined && fieldSchema.default === undefined) {
          fieldSchema.default = field.default;
        }

        // Add field to the resource schema
        schema.properties[resourceKey].properties[fieldName] = fieldSchema;

        // Mark as required if specified
        if (field.required) {
          schema.properties[resourceKey].required.push(fieldName);
        }
      });

      // Add the resource to the main required array if it has required fields
      if (schema.properties[resourceKey].required.length > 0) {
        schema.required.push(resourceKey);
      }
    });

    return schema;
  };

  /**
   * Generate Helm Chart files
   */
  const generateHelmFiles = async (helmDir: string, templateMetadata: any) => {
    // Generate Chart.yaml
    const chartYaml = {
      apiVersion: 'v2',
      name: templateMetadata.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: templateMetadata.description || `A Helm chart for ${templateMetadata.name}`,
      type: 'application',
      version: '0.1.0',
      appVersion: '1.0.0'
    }

    const chartContent = `# Generated Helm Chart for ${templateMetadata.name}\napiVersion: ${chartYaml.apiVersion}\nname: ${chartYaml.name}\ndescription: ${chartYaml.description}\ntype: ${chartYaml.type}\nversion: ${chartYaml.version}\nappVersion: ${chartYaml.appVersion}`

    const chartPath = joinPath(helmDir, 'Chart.yaml')
    await window.electronAPI.writeFile(chartPath, chartContent)

    // Generate values.yaml
    const valuesContent = generateValuesYaml(templateMetadata)
    const valuesPath = joinPath(helmDir, 'values.yaml')
    await window.electronAPI.writeFile(valuesPath, valuesContent)

    // Create templates directory
    const templatesDir = joinPath(helmDir, 'templates')
    await window.electronAPI.createDirectory(templatesDir)

    // Generate individual resource template files using the enhanced function
    for (const resource of templateMetadata.resources) {
      const resourceFileName = `${resource.kind.toLowerCase()}.yaml`
      const resourcePath = joinPath(templatesDir, resourceFileName)

      // Use the enhanced function with Helm helpers enabled
      const resourceTemplate = generateHelmResourceTemplate(resource, templateMetadata.name, true)
      await window.electronAPI.writeFile(resourcePath, resourceTemplate)
    }
  }

  /**
   * Generate values.yaml content for Helm chart
   */
  const generateValuesYaml = (templateMetadata: any): string => {
    let valuesContent = `# Default values for ${templateMetadata.name}\n# This is a YAML-formatted file.\n\n`

    templateMetadata.resources.forEach((resource: any) => {
      const resourceKey = resource.kind.toLowerCase()
      valuesContent += `${resourceKey}:\n`
      valuesContent += `  enabled: true\n`

      if (resource.selectedFields && resource.selectedFields.length > 0) {
        resource.selectedFields.forEach((field: any) => {
          const fieldKey = field.path.split('.').pop() || field.title.toLowerCase().replace(/\s+/g, '')
          const defaultValue = getDefaultValueForType(field.type)
          valuesContent += `  ${fieldKey}: ${defaultValue}\n`
        })
      }
      valuesContent += '\n'
    })

    return valuesContent
  }

  /**
   * Handle YAML preview for a specific resource
   */
  const handlePreviewYaml = (resource: TemplateResource) => {
    if (!resource.selectedFields || resource.selectedFields.length === 0) {
      setPreviewYamlContent('# No fields selected for this resource\n# Please select fields to generate YAML preview')
    } else {
      // Use the new filtered schema approach
      const resourceKey = resource.apiVersion ?
        `${resource.apiVersion}/${resource.kind}` :
        resource.kind

      const yamlContent = generateYamlFromFilteredSchema(resourceKey, resource)
      setPreviewYamlContent(yamlContent)
    }
    setPreviewResourceKind(resource.kind)
    setIsYamlPreviewOpen(true)
  }

  /**
   * Generate Kustomize files
   */
  const generateKustomizeFiles = async (kustomizeDir: string, templateMetadata: any) => {
    // Generate kustomization.yaml
    const kustomizationContent = generateKustomizationYaml(templateMetadata)
    const kustomizationPath = joinPath(kustomizeDir, 'kustomization.yaml')
    await window.electronAPI.writeFile(kustomizationPath, kustomizationContent)

    // Generate individual resource files for Kustomize
    for (const resource of templateMetadata.resources) {
      const resourceFileName = `${resource.kind.toLowerCase()}.yaml`
      const resourcePath = joinPath(kustomizeDir, resourceFileName)

      const resourceManifest = generateKustomizeResourceManifest(resource, templateMetadata.name)
      await window.electronAPI.writeFile(resourcePath, resourceManifest)
    }
  }

  /**
   * Generate kustomization.yaml content
   */
  const generateKustomizationYaml = (templateMetadata: any): string => {
    let content = `apiVersion: kustomize.config.k8s.io/v1beta1\n`
    content += `kind: Kustomization\n\n`
    content += `metadata:\n`
    content += `  name: ${templateMetadata.name.toLowerCase()}\n\n`
    content += `resources:\n`

    templateMetadata.resources.forEach((resource: any) => {
      content += `- ${resource.kind.toLowerCase()}.yaml\n`
    })

    content += `\n# Add common labels to all resources\n`
    content += `commonLabels:\n`
    content += `  app: ${templateMetadata.name.toLowerCase()}\n`
    content += `  version: v1.0.0\n\n`

    content += `# Add common annotations\n`
    content += `commonAnnotations:\n`
    content += `  generated-by: config-pilot\n`
    content += `  template: ${templateMetadata.name}\n`

    return content
  }

  /**
   * Generate Kustomize resource manifest
   */
  const generateKustomizeResourceManifest = (resource: any, templateName: string): string => {
    let manifest = `apiVersion: ${resource.apiVersion}\n`
    manifest += `kind: ${resource.kind}\n`
    manifest += `metadata:\n`
    manifest += `  name: ${templateName.toLowerCase()}-${resource.kind.toLowerCase()}\n`

    if (resource.namespace) {
      manifest += `  namespace: ${resource.namespace}\n`
    }

    manifest += `spec:\n`

    if (resource.kind === 'Deployment' || resource.kind === 'StatefulSet' || resource.kind === 'DaemonSet') {
      manifest += `  replicas: 1\n`
      manifest += `  selector:\n`
      manifest += `    matchLabels:\n`
      manifest += `      app: ${templateName.toLowerCase()}\n`
      manifest += `  template:\n`
      manifest += `    metadata:\n`
      manifest += `      labels:\n`
      manifest += `        app: ${templateName.toLowerCase()}\n`
      manifest += `    spec:\n`
      manifest += `      containers:\n`
      manifest += `      - name: ${templateName.toLowerCase()}\n`
      manifest += `        image: nginx:latest\n`
      manifest += `        ports:\n`
      manifest += `        - containerPort: 80\n`
    } else {
      manifest += `  # Add your ${resource.kind} specification here\n`
      if (resource.selectedFields && resource.selectedFields.length > 0) {
        manifest += `  # Based on selected fields: ${resource.selectedFields.map((f: any) => f.path).join(', ')}\n`
      }
    }

    return manifest
  }

  /**
   * Get default value for field type
   */
  const getDefaultValueForType = (type: string): string => {
    switch (type) {
      case 'string': return '""'
      case 'number': return '0'
      case 'boolean': return 'false'
      case 'array': return '[]'
      case 'object': return '{}'
      default: return '""'
    }
  }

  /**
   * Check if template has data to enable buttons
   */
  const hasTemplateData = template.name.trim() !== '' && selectedResources.length > 0

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Deployment Template Designer
              </CardTitle>
              <CardDescription>
                Select a Kubernetes resource kind to create a template (using Kubernetes {kubernetesVersion})
              </CardDescription>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateYamlPreview}
                disabled={!hasTemplateData}
                className="flex items-center gap-2"
              >
                <FileCode className="h-4 w-4" />
                Preview YAML
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={generateJsonPreview}
                disabled={!hasTemplateData}
                className="flex items-center gap-2"
              >
                <FileJson className="h-4 w-4" />
                Preview JSON
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log('Export template')}
                disabled={!hasTemplateData}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>

              <Button
                size="sm"
                onClick={saveTemplate}
                disabled={!hasTemplateData}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Template
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template Details */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                placeholder="Enter template name"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Description (Optional)</Label>
              <Textarea
                id="template-description"
                value={template.description || ''}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                placeholder="Enter template description"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Searchable Kind Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kubernetes Resource Kind</CardTitle>
          <CardDescription>
            Search and select Kubernetes resource types ({availableKinds.length} kinds available)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Searchable Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Label htmlFor="kind-search">Select Resource Kind:</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="kind-search"
                placeholder="Search for Kubernetes kinds (e.g., Pod, Deployment, Service)..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  // Only open dropdown if there's a search term
                  if (e.target.value.trim()) {
                    setIsDropdownOpen(true)
                  }
                }}
                onFocus={() => {
                  // Only open dropdown if there's a search term
                  if (searchTerm.trim()) {
                    setIsDropdownOpen(true)
                  }
                }}
                onBlur={() => {
                  // Delay closing to allow for click events on dropdown items
                  setTimeout(() => setIsDropdownOpen(false), 150)
                }}
                className="pl-10 pr-10"
                disabled={isLoading}
              />
              <ChevronDown
                className="absolute right-3 top-3 h-4 w-4 text-muted-foreground cursor-pointer"
                onClick={() => {
                  if (searchTerm.trim()) {
                    setIsDropdownOpen(!isDropdownOpen)
                  }
                }}
              />
            </div>

            {/* Dropdown Results */}
            {isDropdownOpen && !isLoading && !error && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredSearchResults.length > 0 ? (
                  filteredSearchResults.map((resource, index) => {
                    // Ensure apiVersion is present for display
                    const displayResource = {
                      ...resource,
                      apiVersion: resource.apiVersion || (resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`)
                    }
                    return (
                      <div
                        key={`${resource.group || 'core'}-${resource.version || 'v1'}-${resource.kind}-${index}`}
                        className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-b-0"
                        onClick={() => handleKindSelect(displayResource)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{resource.kind}</span>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {displayResource.apiVersion}
                            </Badge>
                            {/* {(resource.group && resource.group !== 'core') && (
                              <Badge variant="outline" className="text-xs">
                                {resource.group}
                              </Badge>
                            )} */}
                          </div>
                        </div>
                        {resource.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-muted-foreground">
                    {searchTerm ?
                      `No available kinds found matching "${searchTerm}"` :
                      selectedResources.length > 0 ?
                        'All matching resources have been selected' :
                        'No kinds available'
                    }
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Resources List */}
      {selectedResources.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Selected Resources ({selectedResources.length})</CardTitle>
                <CardDescription>
                  Resources that will be included in your template
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedResources([])
                  setSelectedResource(null)
                }}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedResources.map((resource, index) => {
                // Alternate color schemes for visual variety
                // const colorSchemes = [
                //   {
                //     bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
                //     border: 'border-blue-200',
                //     hover: 'hover:from-blue-100 hover:to-blue-150',
                //     accent: 'text-blue-700',
                //     badge: 'bg-blue-100 text-blue-800',
                //     configured: 'border-blue-300 bg-gradient-to-br from-blue-100 to-blue-200',
                //     selected: 'from-blue-200 to-blue-300 border-blue-400 shadow-blue-200'
                //   },
                //   {
                //     bg: 'bg-gradient-to-br from-green-50 to-green-100',
                //     border: 'border-green-200',
                //     hover: 'hover:from-green-100 hover:to-green-150',
                //     accent: 'text-green-700',
                //     badge: 'bg-green-100 text-green-800',
                //     configured: 'border-green-300 bg-gradient-to-br from-green-100 to-green-200',
                //     selected: 'from-green-200 to-green-300 border-green-400 shadow-green-200'
                //   },
                //   {
                //     bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
                //     border: 'border-purple-200',
                //     hover: 'hover:from-purple-100 hover:to-purple-150',
                //     accent: 'text-purple-700',
                //     badge: 'bg-purple-100 text-purple-800',
                //     configured: 'border-purple-300 bg-gradient-to-br from-purple-100 to-purple-200',
                //     selected: 'from-purple-200 to-purple-300 border-purple-400 shadow-purple-200'
                //   },
                //   {
                //     bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
                //     border: 'border-orange-200',
                //     hover: 'hover:from-orange-100 hover:to-orange-150',
                //     accent: 'text-orange-700',
                //     badge: 'bg-orange-100 text-orange-800',
                //     configured: 'border-orange-300 bg-gradient-to-br from-orange-100 to-orange-200',
                //     selected: 'from-orange-200 to-orange-300 border-orange-400 shadow-orange-200'
                //   }
                // ];

                const colorSchemes = [
                  {
                    bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
                    border: 'border-amber-200',
                    hover: 'hover:from-amber-100 hover:to-amber-150',
                    accent: 'text-amber-700',
                    badge: 'bg-amber-100 text-amber-800',
                    configured: 'border-amber-300 bg-gradient-to-br from-amber-100 to-amber-200',
                    selected: 'from-amber-200 to-amber-300 border-amber-400 shadow-amber-200'
                  },
                  {
                    bg: 'bg-gradient-to-br from-green-50 to-green-100',
                    border: 'border-green-200',
                    hover: 'hover:from-green-100 hover:to-green-150',
                    accent: 'text-green-700',
                    badge: 'bg-green-100 text-green-800',
                    configured: 'border-green-300 bg-gradient-to-br from-green-100 to-green-200',
                    selected: 'from-green-200 to-green-300 border-green-400 shadow-green-200'
                  },
                  {
                    bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
                    border: 'border-purple-200',
                    hover: 'hover:from-purple-100 hover:to-purple-150',
                    accent: 'text-purple-700',
                    badge: 'bg-purple-100 text-purple-800',
                    configured: 'border-purple-300 bg-gradient-to-br from-purple-100 to-purple-200',
                    selected: 'from-purple-200 to-purple-300 border-purple-400 shadow-purple-200'
                  },
                  {
                    bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
                    border: 'border-orange-200',
                    hover: 'hover:from-orange-100 hover:to-orange-150',
                    accent: 'text-orange-700',
                    badge: 'bg-orange-100 text-orange-800',
                    configured: 'border-orange-300 bg-gradient-to-br from-orange-100 to-orange-200',
                    selected: 'from-orange-200 to-orange-300 border-orange-400 shadow-orange-200'
                  }
                ];

                const scheme = colorSchemes[index % colorSchemes.length];

                // Check if this resource is currently selected for configuration OR was the last configured
                const isCurrentlySelected = selectedResourceIndex === index;
                const isLastConfigured = lastConfiguredResourceIndex === index && !isCurrentlySelected;
                const hasConfiguredFields = resource.selectedFields && resource.selectedFields.length > 0;

                // Determine the tile's visual state
                const getTileClasses = () => {
                  let baseClasses = `rounded-xl p-5 border-2 transition-all duration-500 relative overflow-hidden cursor-pointer group`;

                  if (isCurrentlySelected) {
                    // Currently selected tile - prominent styling
                    return `${baseClasses} bg-gradient-to-br ${scheme.selected} transform scale-105 shadow-xl`;
                  } else if (isLastConfigured) {
                    // Last configured tile - retain bigger size with enhanced styling
                    return `${baseClasses} ${scheme.configured} hover:shadow-lg hover:scale-105 ${scheme.hover} transform scale-[1.02] shadow-lg`;
                  } else if (hasConfiguredFields) {
                    // Other configured tiles - subtle indication
                    return `${baseClasses} ${scheme.configured} hover:shadow-lg hover:scale-[1.02] ${scheme.hover}`;
                  } else {
                    // Unconfigured tile - default styling with subtle indication
                    return `${baseClasses} ${scheme.bg} ${scheme.border} hover:shadow-lg hover:scale-105 ${scheme.hover} opacity-90`;
                  }
                };

                return (
                  <div
                    key={`${resource.apiVersion}-${resource.kind}-${index}`}
                    // className={`${scheme.bg} ${scheme.border} ${scheme.hover} rounded-xl p-5 border-2 hover:shadow-lg hover:scale-105 transition-all duration-300 relative overflow-hidden cursor-pointer group`}
                    className={getTileClasses()}
                    onClick={async () => {
                      const schemaResource = resource.originalSchema || resource;
                      if (resource.source == 'kubernetes') {
                        console.log('🔍 Requesting schema for kind:', resource.kind);
                        console.log('🔍 Schema indexer initialized:', !!kubernetesSchemaIndexer.lazyIndex);

                        const versions = await kubernetesSchemaIndexer.getKindVersions(resource.kind);
                        const resourceSchema = versions?.[0]
                        if (resourceSchema) {
                          schemaResource.schema = resourceSchema.schema
                          console.log('✅ Schema found and assigned');
                        }
                        else {
                          console.warn('❌ No schema found for kind:', resource.kind);
                        }
                      }
                      setSelectedResourceForSchema(schemaResource)
                      setSelectedResourceIndex(index)
                      setSelectedResource(schemaResource)
                      setIsSchemaModalOpen(true)
                    }}
                  >
                    {/* Enhanced accent line with selection indicator */}
                    <div className={`absolute top-0 left-0 right-0 transition-all duration-300 ${isCurrentlySelected
                        ? `h-3 ${scheme.accent.replace('text-', 'bg-')} shadow-md`
                        : isLastConfigured
                          ? `h-2 ${scheme.accent.replace('text-', 'bg-')} opacity-80`
                          : hasConfiguredFields
                            ? `h-2 ${scheme.accent.replace('text-', 'bg-')} group-hover:h-3`
                            : `h-1 ${scheme.accent.replace('text-', 'bg-')} group-hover:h-2`
                      }`}></div>

                    {/* Selection indicator badge */}
                    {isCurrentlySelected && (
                      <div className="absolute top-3 right-3 z-10">
                        <div className={`w-3 h-3 rounded-full ${scheme.accent.replace('text-', 'bg-')} animate-pulse shadow-lg`}></div>
                      </div>
                    )}

                    {/* Last configured indicator */}
                    {isLastConfigured && !isCurrentlySelected && (
                      <div className="absolute top-3 right-3 z-10">
                        <div className="w-2 h-2 rounded-full bg-blue-400 shadow-md border border-white"></div>
                      </div>
                    )}

                    {/* Configuration status indicator */}
                    {hasConfiguredFields && !isCurrentlySelected && !isLastConfigured && (
                      <div className="absolute top-3 right-3 z-10">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-md"></div>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold text-lg ${scheme.accent}`}>{resource.kind}</h3>
                          {isCurrentlySelected && (
                            <Badge variant="outline" className="text-xs bg-white/80 text-amber-600 border-amber-300">
                              Configuring
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 font-medium">{resource.apiVersion}</p>
                        {resource.namespace && (
                          <p className="text-xs text-gray-500 mt-1 bg-white/50 px-2 py-1 rounded-full inline-block">
                            📁 {resource.namespace}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent tile click when previewing YAML
                                  handlePreviewYaml(resource);
                                }}
                                className="text-amber-500 hover:text-amber-700 hover:bg-amber-50/80 p-2 h-auto rounded-full transition-colors"
                                aria-label="Preview YAML"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              align="end"
                              alignOffset={-22}
                              sideOffset={5}
                              className="z-[9999] bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg border-0 animate-none"
                              avoidCollisions={true}
                              collisionPadding={20}
                            >
                              Preview YAML
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent tile click when removing
                                  removeResource(resource);
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50/80 p-2 h-auto rounded-full transition-colors"
                                aria-label="Remove resource"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              align="end"
                              alignOffset={-22}
                              sideOffset={5}
                              className="z-[9999] bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg border-0 animate-none"
                              avoidCollisions={true}
                              collisionPadding={20}
                            >
                              Remove resource
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                    </div>

                    {/* Enhanced status section */}
                    {hasConfiguredFields ? (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${isLastConfigured ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                          <h4 className="text-sm font-semibold text-gray-700">
                            {resource.selectedFields.length} Field{resource.selectedFields.length !== 1 ? 's' : ''} Configured
                          </h4>
                        </div>
                        <div className="space-y-2 max-h-20 overflow-y-auto">
                          {resource.selectedFields.map((field, fieldIndex) => (
                            <div key={fieldIndex} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                              <span className="text-xs text-gray-700 truncate font-medium">
                                {field.name || field.path}
                              </span>
                              <Badge variant="secondary" className={`text-xs ml-2 ${scheme.badge} border-0`}>
                                {field.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <h4 className="text-sm font-medium text-gray-600">
                            No fields configured
                          </h4>
                        </div>
                        <p className="text-xs text-gray-500 bg-white/40 rounded-lg p-2">
                          Click to select and configure fields for this resource
                        </p>
                      </div>
                    )}

                    {/* Enhanced click indicator */}
                    <div className={`text-xs text-center mt-2 transition-opacity duration-300 ${isCurrentlySelected
                        ? 'text-amber-600 font-medium opacity-100'
                        : isLastConfigured
                          ? 'text-amber-500 opacity-80 group-hover:opacity-100'
                          : 'text-gray-500 opacity-70 group-hover:opacity-100'
                      }`}>
                      {isCurrentlySelected ? 'Currently configuring...' : isLastConfigured ? 'Last configured - click to reconfigure' : 'Click to configure'}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      {selectedResource && rjsfSchema && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configure {selectedResource.kind}</CardTitle>
                <CardDescription>
                  Fill in the configuration for your {selectedResource.kind} resource
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedResource(null)}
              >
                Close Configuration
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form
              schema={rjsfSchema}
              uiSchema={generateUISchema(selectedResource)}
              formData={formData}
              onChange={handleFormChange}
              validator={validator}
              widgets={customWidgets}
            />
          </CardContent>
        </Card>
      )}

      {/* Schema Field Selection Modal */}
      <SchemaFieldSelectionModal
        isOpen={isSchemaModalOpen}
        onClose={() => {
          // Update last configured resource index before closing
          if (selectedResourceIndex !== null) {
            setLastConfiguredResourceIndex(selectedResourceIndex);
          }
          setIsSchemaModalOpen(false)
          setSelectedResourceForSchema(null)
          setSelectedResourceIndex(null) // Only clear the current selection, not the last configured
        }}
        resource={selectedResourceForSchema}
        selectedFields={selectedResourceIndex !== null ? selectedResources[selectedResourceIndex]?.selectedFields || [] : []}
        onFieldsChange={handleFieldSelectionChange}
        userDataDir={userDataDir}
        k8sVersion={kubernetesVersion}
      />

      {/* YAML Preview Modal */}
      <YamlPreview
        isOpen={isYamlPreviewOpen}
        onClose={() => setIsYamlPreviewOpen(false)}
        yamlContent={previewYamlContent}
        resourceKind={previewResourceKind}
      />

    </div>
  )
}

export default TemplateDesigner