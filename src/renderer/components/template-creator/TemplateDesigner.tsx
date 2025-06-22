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
import { SchemaFieldSelectionModal } from './SchemaFieldSelectionModal'
import { joinPath } from '@/renderer/lib/path-utils'

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
  const [searchInput, setSearchInput] = React.useState('');
  const [kinds, setKinds] = React.useState<string[]>([]);

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
      console.log('Persisted selected resources:', selectedResources.length, 'resources')
    } catch (error) {
      console.warn('Failed to persist selected resources:', error)
    }
  }, [selectedResources])


  const filteredKinds = React.useMemo(() => {
    return kinds.filter(kind =>
      kind.toLowerCase().includes(searchInput.toLowerCase())
    );
  }, [kinds, searchInput]);

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
  const convertToRJSFSchema = useCallback((kubernetesSchema: any): RJSFSchema => {
    if (!kubernetesSchema?.schema) return {}

    try {
      // Get the schema index to access all definitions
      const schemaIndex = kubernetesSchemaIndexer.getSchemaIndex()
      if (!schemaIndex) {
        console.warn('Schema index not available')
        return {}
      }

      // Use the indexer's getResolvedSchema method to resolve all $ref references
      const resolvedSchema = kubernetesSchemaIndexer.getResolvedSchema(
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
        const allKindsResults = availableKinds.map(kind => {
          const versions = kubernetesSchemaIndexer.getKindVersions(kind)
          return versions[0] // Return the first version for each kind
        }).filter(Boolean)
        setSearchResults(allKindsResults)
        console.log('🔍 No search term - showing all kinds:', allKindsResults.length)
        return
      }

      try {
        // Use enhanced search with CRDs
        const results = await kubernetesSchemaIndexer.searchResourcesWithCRDs(searchTerm)
        console.log('🔍 Enhanced search results:', results)
        console.log('🔍 CRD resources found:', results.filter(r => r.group !== 'core' && r.group !== ''))
        setSearchResults(results)
        console.log('✅ Using enhanced search with CRDs:', results.length, 'results')
      } catch (error) {
        console.warn('Enhanced search not available, using standard search:', error)
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
    const isAlreadySelected = selectedResources.some(r =>
      r.kind === resource.kind && r.apiVersion === `${resource.group}/${resource.version}`
    )

    if (isAlreadySelected) {
      return // Don't add duplicates
    }

    const newResource: TemplateResource = {
      apiVersion: `${resource.group}/${resource.version}`,
      kind: resource.kind,
      selectedFields: [],
      source: resource.source,
      originalSchema: resource // Store the original KubernetesResourceSchema
    }

    setSelectedResources(prev => [...prev, newResource])
    setSelectedResource(resource)

    // Clear search and close dropdown
    setSearchTerm('')
    setIsDropdownOpen(false)
  }

  // Function to handle field selection
  const handleFieldSelect = (resourceKey: string, field: TemplateField) => {
    setSelectedFields(prev => {
      const newFields = {
        ...prev,
        [resourceKey]: [...(prev[resourceKey] || []), field]
      }

      // Update template with selected fields
      setTemplate(t => {
        const updatedResources = t.resources.map(r => {
          const rKey = `${r.apiVersion}/${r.kind}`
          return rKey === resourceKey
            ? { ...r, fields: newFields[resourceKey] }
            : r
        })

        const newTemplate = {
          ...t,
          resources: updatedResources
        }

        onTemplateChange?.(newTemplate)
        return newTemplate
      })

      return newFields
    })
  }
  /**
   * Handle form data changes
   */
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
   * Remove a selected resource
   */
  const removeResource = (resourceToRemove: TemplateResource) => {
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
  }

  // Filter search results to exclude already selected resources
  const filteredSearchResults = useMemo(() => {
    const filtered = searchResults.filter((resource: { kind: any; group: any; version: any }) =>
      !selectedResources.some(selected =>
        selected.kind === resource.kind &&
        selected.apiVersion === `${resource.group}/${resource.version}`
      )
    )
    console.log('🔍 Filtered search results:', filtered.length, 'of', searchResults.length)
    console.log('🔍 CRDs in filtered results:', filtered.filter(r => r.group !== 'core' && r.group !== ''))
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
   * Save template to file
   */
  const saveTemplate = () => {
    // Implementation for saving template
    console.log('Saving template:', template)
    // This would save the template to the file system
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
                Template Designer
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
                  filteredSearchResults.map((resource, index) => (
                    <div
                      key={`${resource.group || 'core'}-${resource.version || 'v1'}-${resource.kind}-${index}`}
                      className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-b-0"
                      onClick={() => handleKindSelect(resource)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{resource.kind}</span>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {resource.version || 'v1'}
                          </Badge>
                          {(resource.group && resource.group !== 'core') && (
                            <Badge variant="outline" className="text-xs">
                              {resource.group}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {resource.description}
                        </p>
                      )}
                    </div>
                  ))
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
                const colorSchemes = [
                  {
                    bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
                    border: 'border-blue-200',
                    hover: 'hover:from-blue-100 hover:to-blue-150',
                    accent: 'text-blue-700',
                    badge: 'bg-blue-100 text-blue-800'
                  },
                  {
                    bg: 'bg-gradient-to-br from-green-50 to-green-100',
                    border: 'border-green-200',
                    hover: 'hover:from-green-100 hover:to-green-150',
                    accent: 'text-green-700',
                    badge: 'bg-green-100 text-green-800'
                  },
                  {
                    bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
                    border: 'border-purple-200',
                    hover: 'hover:from-purple-100 hover:to-purple-150',
                    accent: 'text-purple-700',
                    badge: 'bg-purple-100 text-purple-800'
                  },
                  {
                    bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
                    border: 'border-orange-200',
                    hover: 'hover:from-orange-100 hover:to-orange-150',
                    accent: 'text-orange-700',
                    badge: 'bg-orange-100 text-orange-800'
                  }
                ];

                const scheme = colorSchemes[index % colorSchemes.length];

                return (
                  <div
                    key={`${resource.apiVersion}-${resource.kind}-${index}`}
                    className={`${scheme.bg} ${scheme.border} ${scheme.hover} rounded-xl p-5 border-2 hover:shadow-lg hover:scale-105 transition-all duration-300 relative overflow-hidden cursor-pointer`}
                    onClick={() => {
                      const schemaResource = resource.originalSchema || resource;
                      if (resource.source == 'kubernetes') {
                        const resourceSchema = kubernetesSchemaIndexer.getKindVersions(resource.kind)?.[0]
                        if (resourceSchema) {
                          schemaResource.schema = resourceSchema.schema
                        }
                      }
                      setSelectedResourceForSchema(schemaResource)
                      setSelectedResourceIndex(index)
                      setSelectedResource(schemaResource)
                      setIsSchemaModalOpen(true)
                    }}

                  >
                    {/* Subtle accent line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${scheme.accent.replace('text-', 'bg-')}`}></div>

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className={`font-semibold text-lg ${scheme.accent} mb-1`}>{resource.kind}</h3>
                        <p className="text-sm text-gray-600 font-medium">{resource.apiVersion}</p>
                        {resource.namespace && (
                          <p className="text-xs text-gray-500 mt-1 bg-white/50 px-2 py-1 rounded-full inline-block">
                            Namespace: {resource.namespace}
                          </p>
                        )}
                      </div>
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
                    </div>

                    {resource.selectedFields && resource.selectedFields.length > 0 && (
                      <div className="mb-2">
                        <h4 className="text-sm font-semibold mb-2 text-gray-700">Selected Fields:</h4>
                        <div className="space-y-2 max-h-20 overflow-y-auto">
                          {resource.selectedFields.map((field, fieldIndex) => (
                            <div key={fieldIndex} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                              <span className="text-xs text-gray-700 truncate font-medium">
                                {field.title || field.path}
                              </span>
                              <Badge variant="secondary" className={`text-xs ml-2 ${scheme.badge} border-0`}>
                                {field.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Click indicator */}
                    <div className="text-xs text-gray-500 text-center mt-2 opacity-70">
                      Click to configure
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
      {/* <SourceSpecificSearch /> */}
      <SchemaFieldSelectionModal
        isOpen={isSchemaModalOpen}
        onClose={() => {
          setIsSchemaModalOpen(false)
          setSelectedResourceForSchema(null)
          setSelectedResourceIndex(null)
        }}
        resource={selectedResourceForSchema}
        selectedFields={selectedResourceIndex !== null ? selectedResources[selectedResourceIndex]?.selectedFields || [] : []}
        onFieldsChange={handleFieldSelectionChange}
        userDataDir={userDataDir}
        k8sVersion={kubernetesVersion}
      />

    </div>
  )
}

export default TemplateDesigner