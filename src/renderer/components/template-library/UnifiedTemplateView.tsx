import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Badge } from '@/renderer/components/ui/badge'
import { Separator } from '@/renderer/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import {
  Eye, Download, Package, Settings, Play, FileText, Layers,
  Edit3, Save, X, Plus, Trash2, ChevronDown, ChevronRight,
  Code, Zap, Package2, AlertCircle, CheckCircle,
  ChevronLeft,
  Search
} from 'lucide-react'
import { Template, TemplateResource, TemplateField } from '@/shared/types/template'
import { cn } from "@/lib/utils"
import yaml from 'js-yaml'
import YamlEditor from '@/renderer/components/yaml-editor'
import { kubernetesSchemaIndexer } from '@/renderer/services/kubernetes-schema-indexer'
import { useDialog } from '@/renderer/hooks/useDialog';

interface UnifiedTemplateViewProps {
  template: Template
  onClose: () => void
  onUse: (template: Template) => void
  onSave: (template: Template) => void
  onDryRun: (template: Template) => void
  mode?: 'preview' | 'edit'
}

/**
 * Unified template view that combines preview and edit functionality
 * to reduce cognitive load and provide seamless user experience
 */
export function UnifiedTemplateView({
  template,
  onClose,
  onUse,
  onSave,
  onDryRun,
  mode: initialMode = 'preview'
}: UnifiedTemplateViewProps) {
  const [currentMode, setCurrentMode] = useState<'preview' | 'edit'>(initialMode)
  const [editedTemplate, setEditedTemplate] = useState<Template>({
    ...template,
    resources: template.resources.map((r: { selectedFields: any }) => ({ ...r, selectedFields: [...r.selectedFields] }))
  })
  const [preview, setPreview] = useState({ yaml: '', helm: '', kustomize: '' })
  const [loading, setLoading] = useState(false)
  const [expandedResources, setExpandedResources] = useState<Set<number>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editingResourceIndex, setEditingResourceIndex] = useState<number | null>(null)

  const [tagInput, setTagInput] = useState('')
  const [showAddResourceModal, setShowAddResourceModal] = useState(false)
  const [availableKinds, setAvailableKinds] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [originalTemplate, setOriginalTemplate] = useState<Template>({
    ...template,
    resources: template.resources.map((r: { selectedFields: any }) => ({ ...r, selectedFields: [...r.selectedFields] }))
  })

  const {
    showAlert,
    showErrorToast,
    AlertDialog
  } = useDialog();

  useEffect(() => {
    if (currentMode === 'preview') {
      generatePreviews()
    }
  }, [currentMode, editedTemplate])

  // Load available Kubernetes kinds on component mount
  useEffect(() => {
    loadAvailableKinds()
  }, [])

  /**
   * Load available Kubernetes kinds including CRDs
   */
  const loadAvailableKinds = async () => {
    try {
      // Use the correct API that includes CRDs
      const kinds = await kubernetesSchemaIndexer.getAvailableKindsWithCRDs()
      setAvailableKinds(kinds.map((kind: any) => ({ kind, apiVersion: 'v1', group: 'core' })) || [])
    } catch (error) {
      console.error('Failed to load available kinds with CRDs:', error)
      setAvailableKinds([])
    }
  }

  /**
 * Handle adding tags (following TemplateCreator.tsx pattern)
 */
  const handleAddTag = () => {
    if (tagInput.trim() && !editedTemplate.tags?.includes(tagInput.trim())) {
      const updatedTemplate = {
        ...editedTemplate,
        tags: [...(editedTemplate.tags || []), tagInput.trim()]
      }
      setEditedTemplate(updatedTemplate)
      setHasUnsavedChanges(true)
      setTagInput('')
    }
  }

  /**
   * Handle removing tags (following TemplateCreator.tsx pattern)
   */
  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTemplate = {
      ...editedTemplate,
      tags: editedTemplate.tags?.filter(tag => tag !== tagToRemove) || []
    }
    setEditedTemplate(updatedTemplate)
    setHasUnsavedChanges(true)
  }

  /**
   * Handle adding a new resource to the template with auto-save
   */
  const handleAddNewResource = async (selectedKind: any) => {
    try {
      // Check for duplicates
      const isDuplicate = editedTemplate.resources.some(
        (resource: { kind: any; apiVersion: any }) => resource.kind === selectedKind.kind && resource.apiVersion === selectedKind.apiVersion
      )

      if (isDuplicate) {
        showErrorToast(
          `${selectedKind.kind} (${selectedKind.apiVersion}) is already in this template.`,
          'Duplicate Resource'
        )        
        return
      }

      // Create new resource with proper templateType field
      const newResource: TemplateResource = {
        kind: selectedKind.kind,
        apiVersion: selectedKind.apiVersion || 'v1',
        selectedFields: [],
        templateType: 'kubernetes' // Add this required field
      }

      // Add to template
      const updatedTemplate = {
        ...editedTemplate,
        resources: [...editedTemplate.resources, newResource]
      }

      setEditedTemplate(updatedTemplate)
      setHasUnsavedChanges(true)
      setShowAddResourceModal(false)

      // Auto-save the template
      if (onSave) {
        await onSave(updatedTemplate)
        setHasUnsavedChanges(false)
      }

      console.log(`Added ${selectedKind.kind} to template and auto-saved`)
    } catch (error) {
      console.error('Failed to add resource:', error)
    }
  }

  /**
   * Check if template metadata has changed
   */
  const hasMetadataChanged = () => {
    const originalTags = originalTemplate.tags || []
    const editedTags = editedTemplate.tags || []

    return (
      editedTemplate.name !== originalTemplate.name ||
      editedTemplate.version !== originalTemplate.version ||
      editedTemplate.description !== originalTemplate.description ||
      JSON.stringify(originalTags.sort()) !== JSON.stringify(editedTags.sort())
    )
  }

  /**
   * Handle modal close with auto-save for metadata changes
   */
  const handleClose = async () => {
    try {
      // Check if metadata fields have changed
      if (hasMetadataChanged()) {
        console.log('Template metadata changed, auto-saving before close...')
        await onSave(editedTemplate)
        setHasUnsavedChanges(false)
      }
      onClose()
    } catch (error) {
      console.error('Failed to auto-save template on close:', error)
      // Still close the modal even if save fails
      onClose()
    }
  }

  /**
   * Filter available kinds based on search term
   */
  const filteredKinds = useMemo(() => {
    if (!searchTerm.trim()) return []

    // Group resources by category
    const results = availableKinds.filter(kind =>
      kind.kind.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (kind.group && kind.group.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 20) // Increased limit for better search results

    // Group by category
    const grouped = results.reduce((acc: any, kind) => {
      const category = kind.group || 'core'
      if (!acc[category]) acc[category] = []
      acc[category].push(kind)
      return acc
    }, {})

    // Convert to array format for rendering
    return Object.entries(grouped).map(([category, kinds]) => ({
      category,
      kinds
    }))
  }, [availableKinds, searchTerm])

  /**
   * Render Add Resource Modal
   */
  const renderAddResourceModal = () => {
    if (!showAddResourceModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-[500px] max-h-[600px] flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Add New Resource</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Search and select a Kubernetes resource to add to this template
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddResourceModal(false)
                  setSearchTerm('')
                  setIsDropdownOpen(false)
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-6">
            <div className="space-y-4">
              <div className="relative" ref={dropdownRef}>
                <Label htmlFor="resource-search">Search Resource Kind:</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="resource-search"
                    placeholder="Search for Kubernetes kinds (e.g., Pod, Deployment, Service)..."
                    value={searchTerm}
                    onChange={(e: { target: { value: React.SetStateAction<string> } }) => {
                      setSearchTerm(e.target.value)
                      setIsDropdownOpen(e.target.value.trim().length > 0)
                    }}
                    onFocus={() => {
                      if (searchTerm.trim()) {
                        setIsDropdownOpen(true)
                      }
                    }}
                    className="pl-10"
                  />
                </div>

                {/* Search Results Dropdown */}
                {isDropdownOpen && filteredKinds.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredKinds.map((resource, index) => {
                      const displayResource = {
                        ...resource,
                        apiVersion: resource.apiVersion || (resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`)
                      }
                      return (
                        <div
                          key={`${resource.group || 'core'}-${resource.version || 'v1'}-${resource.kind}-${index}`}
                          className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-b-0"
                          onClick={() => handleAddNewResource(displayResource)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{resource.kind}</span>
                            <div className="flex gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {displayResource.apiVersion}
                              </Badge>
                              {resource.source && (
                                <Badge variant="outline" className="text-xs">
                                  {resource.source}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {resource.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* No results message */}
                {isDropdownOpen && searchTerm.trim() && filteredKinds.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-3">
                    <p className="text-sm text-muted-foreground text-center">
                      No resources found matching "{searchTerm}"
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Add Common Resources */}
              <div className="space-y-2">
                <Label>Quick Add Common Resources:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { kind: 'Deployment', apiVersion: 'apps/v1' },
                    { kind: 'Service', apiVersion: 'v1' },
                    { kind: 'ConfigMap', apiVersion: 'v1' },
                    { kind: 'Secret', apiVersion: 'v1' },
                    { kind: 'Ingress', apiVersion: 'networking.k8s.io/v1' },
                    { kind: 'PersistentVolumeClaim', apiVersion: 'v1' }
                  ].map((resource) => {
                    const isAlreadyAdded = editedTemplate.resources.some((r: { kind: string; apiVersion: string }) =>
                      r.kind === resource.kind && r.apiVersion === resource.apiVersion
                    )
                    return (
                      <Button
                        key={resource.kind}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddNewResource(resource)}
                        disabled={isAlreadyAdded}
                        className="justify-start text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {resource.kind}
                        {isAlreadyAdded && <span className="ml-1 text-muted-foreground">(added)</span>}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  /**
   * Handle resource removal with confirmation
   */
  const handleRemoveResource = async (resourceIndex: number) => {
    try {
      const updatedTemplate = {
        ...editedTemplate,
        resources: editedTemplate.resources.filter((_, index) => index !== resourceIndex)
      }

      setEditedTemplate(updatedTemplate)
      setHasUnsavedChanges(true)

      // Auto-save the template
      if (onSave) {
        await onSave(updatedTemplate)
        setHasUnsavedChanges(false)
      }

      console.log(`Removed resource at index ${resourceIndex} and auto-saved`)
    } catch (error) {
      console.error('Failed to remove resource:', error)
    }
  }

  /**
   * Generate preview content for different formats
   */
  const generatePreviews = async () => {
    setLoading(true)
    try {
      const templateToPreview = currentMode === 'edit' ? editedTemplate : template
      const [yamlResult, helmResult, kustomizeResult] = await Promise.all([
        window.electronAPI.template.generate({
          templateId: templateToPreview.id,
          context: {},
          outputPath: '/tmp',
          format: 'raw-yaml' // Fix: Use 'raw-yaml' instead of 'yaml'
        }),
        window.electronAPI.template.generate({
          templateId: templateToPreview.id,
          context: {},
          outputPath: '/tmp',
          format: 'helm'
        }),
        window.electronAPI.template.generate({
          templateId: templateToPreview.id,
          context: {},
          outputPath: '/tmp',
          format: 'kustomize'
        })
      ])

      setPreview({
        yaml: yamlResult.generatedFiles?.join('\n\n') || '',
        helm: helmResult.generatedFiles?.join('\n\n') || '',
        kustomize: kustomizeResult.generatedFiles?.join('\n\n') || ''
      })
    } catch (error) {
      console.error('Preview generation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle template metadata changes
   */
  const handleMetadataChange = (field: string, value: string) => {
    setEditedTemplate((prev: any) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  /**
   * Toggle resource expansion
   */
  const toggleResourceExpansion = (index: number) => {
    const newExpanded = new Set(expandedResources)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedResources(newExpanded)
  }

  /**
   * Save changes with error handling and feedback
   */
  const handleSave = async () => {
    try {
      setLoading(true)
      // First validate the template structure
      const validationResult = await window.electronAPI.template.validate(editedTemplate)

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors?.map(e => e.message).join('\n')
        showAlert({
          title: 'Template Validation Failed',
          message: `Template validation failed:\n${errorMessages}`,
          variant: 'error'
        })
        return
      }

      // Then save if valid
      await window.electronAPI.template.save(editedTemplate)
      onSave(editedTemplate)
      setHasUnsavedChanges(false)

      // Provide success feedback
      // Replace with toast notification
      console.log('Template saved successfully')
    } catch (error) {
      console.error('Failed to save template:', error)
      showAlert({
        title: 'Save Failed',
        message: 'Failed to save template. Check console for details.',
        variant: 'error'
      })
    } finally {
      setLoading(false)
    }
  }


  /**
   * Handle resource-level dry run
   */
  const handleResourceDryRun = async (resourceIndex: number) => {
    try {
      const resource = editedTemplate.resources[resourceIndex]
      const singleResourceTemplate = {
        ...editedTemplate,
        resources: [resource]
      }
      await onDryRun(singleResourceTemplate)
    } catch (error) {
      console.error('Resource dry run failed:', error)
    }
  }

  /**
   * Handle resource-level edit
   */
  const handleResourceEdit = (resourceIndex: number) => {
    setEditingResourceIndex(resourceIndex)
    setCurrentMode('edit')
  }

  /**
   * Exit resource editing mode
   */
  const exitResourceEdit = () => {
    setEditingResourceIndex(null)
    setCurrentMode('preview')
  }

  /**
   * Generate YAML content for a specific resource
   */
  const generateResourceYaml = (resource: TemplateResource): string => {
    const resourceData = {
      apiVersion: resource.apiVersion,
      kind: resource.kind,
      metadata: {
        name: resource.name || `${resource.kind.toLowerCase()}-example`,
        namespace: 'default'
      },
      spec: {}
    }

    // Add selected fields to spec
    resource.selectedFields.forEach((field: { name: string | number; type: string }) => {
      if (field.name && field.type) {
        resourceData.spec[field.name] = getDefaultValueForType(field.type)
      }
    })

    return yaml.dump(resourceData, { indent: 2 })
  }

  /**
   * Handle YAML changes for individual resource
   */
  const handleResourceYamlChange = (resourceIndex: number, yamlContent: string) => {
    try {
      const parsedYaml = yaml.load(yamlContent)
      if (parsedYaml && typeof parsedYaml === 'object') {
        // Update the resource based on YAML changes
        const updatedResources = [...editedTemplate.resources]
        const resource = updatedResources[resourceIndex]

        // Update basic resource info
        if (parsedYaml.apiVersion) resource.apiVersion = parsedYaml.apiVersion
        if (parsedYaml.kind) resource.kind = parsedYaml.kind
        if (parsedYaml.metadata?.name) resource.name = parsedYaml.metadata.name

        // Sync selectedFields with spec (simplified)
        if (parsedYaml.spec) {
          const newFields = Object.keys(parsedYaml.spec).map(key => ({
            name: key,
            type: typeof parsedYaml.spec[key] === 'number' ? 'number' :
              typeof parsedYaml.spec[key] === 'boolean' ? 'boolean' :
                Array.isArray(parsedYaml.spec[key]) ? 'array' :
                  typeof parsedYaml.spec[key] === 'object' ? 'object' : 'string',
            required: false,
            defaultValue: parsedYaml.spec[key]
          }))
          resource.selectedFields = newFields
        }

        setEditedTemplate({
          ...editedTemplate,
          resources: updatedResources
        })
        setHasUnsavedChanges(true)
      }
    } catch (error) {
      console.warn('YAML parsing error:', error)
      // Don't update if YAML is invalid
    }
  }

  /**
   * Get default value based on field type
   */
  const getDefaultValueForType = (type: string): any => {
    switch (type) {
      case 'number': return 0
      case 'boolean': return false
      case 'array': return []
      case 'object': return {}
      default: return ''
    }
  }

  /**
   * Render resource summary for preview mode
   */
  const renderResourceSummary = (resource: TemplateResource, index: number) => {
    const isExpanded = expandedResources.has(index)
    const requiredFields = resource.selectedFields.filter((f: { required: any }) => f.required).length
    const totalFields = resource.selectedFields.length
    const isEven = index % 2 === 0

    return (
      <Card key={index} className="mb-4 border transition-all duration-200 hover:shadow-md">
        <CardHeader
          className={`cursor-pointer transition-colors border-b border-gray-200 dark:border-gray-700 ${isEven
            ? 'bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-700/40'
            : 'bg-background hover:bg-slate-50/30 dark:hover:bg-slate-800/20'
            }`}
          onClick={() => toggleResourceExpansion(index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-700 dark:text-gray-300" /> : <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" />}
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">{resource.kind}</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{resource.apiVersion}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">{totalFields} fields</Badge>
              <Badge variant={requiredFields > 0 ? "destructive" : "secondary"} className={requiredFields > 0 ? "" : "bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"}>
                {requiredFields} required
              </Badge>

              {/* Resource-level action buttons */}
              <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResourceEdit(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit this resource</TooltipContent>
                </Tooltip>

                {/* Add remove button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveResource(index)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove this resource</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="bg-background">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {resource.selectedFields.map((field: { name: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; required: any; description: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; type: any; defaultValue: any }, fieldIndex: React.Key | null | undefined) => (
                <div key={fieldIndex} className="p-3 border rounded-lg bg-card shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{field.name}</span>
                    {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{field.type}</Badge>
                    {field.defaultValue && (
                      <span className="text-xs text-gray-500">Default: {String(field.defaultValue)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  /**
   * Render resource editor for edit mode
   */
  //   const renderResourceEditor = (resource: TemplateResource, index: number) => {
  //     return (
  //       <Card key={index} className="mb-4">
  //         <CardHeader>
  //           <CardTitle className="flex items-center justify-between">
  //             <span>{resource.kind} - {resource.apiVersion}</span>
  //             <div className="flex items-center gap-2">
  //               {/* Dry-run button only in edit view */}
  //               <Tooltip>
  //                 <TooltipTrigger asChild>
  //                   <Button 
  //                     size="sm" 
  //                     variant="outline"
  //                     onClick={() => handleResourceDryRun(index)}
  //                     className="flex items-center gap-2"
  //                   >
  //                     <Zap className="h-4 w-4" />
  //                     Dry Run
  //                   </Button>
  //                 </TooltipTrigger>
  //                 <TooltipContent>Test this resource configuration</TooltipContent>
  //               </Tooltip>              
  //             </div>
  //           </CardTitle>
  //         </CardHeader>

  //         <CardContent>
  //           <div className="space-y-4">
  //             {resource.selectedFields.map((field, fieldIndex) => (
  //               <div key={fieldIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
  //                 <div className="space-y-2">
  //                   <Label htmlFor={`field-name-${index}-${fieldIndex}`}>Field Name</Label>
  //                   <Input
  //                     id={`field-name-${index}-${fieldIndex}`}
  //                     value={field.name}
  //                     onChange={(e) => handleFieldChange(index, fieldIndex, 'name', e.target.value)}
  //                     placeholder="Field name"
  //                   />
  //                 </div>

  //                 <div className="space-y-2">
  //                   <Label htmlFor={`field-type-${index}-${fieldIndex}`}>Type</Label>
  //                   <select
  //                     id={`field-type-${index}-${fieldIndex}`}
  //                     value={field.type}
  //                     onChange={(e) => handleFieldChange(index, fieldIndex, 'type', e.target.value)}
  //                     className="w-full p-2 border rounded-md"
  //                   >
  //                     <option value="string">String</option>
  //                     <option value="number">Number</option>
  //                     <option value="boolean">Boolean</option>
  //                     <option value="array">Array</option>
  //                     <option value="object">Object</option>
  //                   </select>
  //                 </div>

  //                 <div className="md:col-span-2 space-y-2">
  //                   <Label htmlFor={`field-desc-${index}-${fieldIndex}`}>Description</Label>
  //                   <Textarea
  //                     id={`field-desc-${index}-${fieldIndex}`}
  //                     value={field.description || ''}
  //                     onChange={(e) => handleFieldChange(index, fieldIndex, 'description', e.target.value)}
  //                     placeholder="Field description"
  //                     rows={2}
  //                   />
  //                 </div>

  //                 <div className="flex items-center gap-4">
  //                   <label className="flex items-center gap-2">
  //                     <input
  //                       type="checkbox"
  //                       checked={field.required || false}
  //                       onChange={(e) => handleFieldChange(index, fieldIndex, 'required', e.target.checked)}
  //                     />
  //                     <span className="text-sm">Required</span>
  //                   </label>
  //                 </div>

  //                 <div className="space-y-2">
  //                   <Label htmlFor={`field-default-${index}-${fieldIndex}`}>Default Value</Label>
  //                   <Input
  //                     id={`field-default-${index}-${fieldIndex}`}
  //                     value={field.defaultValue || ''}
  //                     onChange={(e) => handleFieldChange(index, fieldIndex, 'defaultValue', e.target.value)}
  //                     placeholder="Default value"
  //                   />
  //                 </div>
  //               </div>
  //             ))}
  //           </div>
  //         </CardContent>
  //       </Card>
  //     )
  //   }

  /**
   * Render resource editor for edit mode
   */
  const renderResourceEditor = (resource: TemplateResource, index: number) => {
    // If this is the resource being edited individually, use YamlEditor
    // If this is the resource being edited individually, use YamlEditor
    if (editingResourceIndex === index) {
      return (
        <div className="space-y-4">
          <YamlEditor
            targetYamlFilename={`${resource.kind.toLowerCase()}-${index}.yaml`}
            context={{
              environment: 'development',
              product: editedTemplate.name || 'template',
              region: 'us-east-1'
            }}
            layout="side-by-side"
            initialContent={generateResourceYaml(resource)}
            onChange={(content: string) => handleResourceYamlChange(index, content)}
            title={`Editing: ${resource.kind} - ${resource.apiVersion}`}
            hideHeader={false}
            customActions={
              <>
                {/* Save button for YAML editor mode */}
                {hasUnsavedChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save template changes</TooltipContent>
                  </Tooltip>
                )}

                {/* Dry Run button for YAML editor mode */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResourceDryRun(index)}
                      className="flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      Dry Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Test this resource configuration</TooltipContent>
                </Tooltip>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exitResourceEdit}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Overview
                </Button>
              </>
            }
          />
        </div>
      )
    }
    // Otherwise, show the regular card view for overview
    return (
      <Card key={index} className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{resource.kind} - {resource.apiVersion}</span>
            <div className="flex items-center gap-2">
              {/* Edit button to enter YAML editing mode */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResourceEdit(index)}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit YAML
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit this resource with YAML editor</TooltipContent>
              </Tooltip>

              {/* Dry-run button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResourceDryRun(index)}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Dry Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Test this resource configuration</TooltipContent>
              </Tooltip>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              Fields: {resource.selectedFields.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {resource.selectedFields.slice(0, 5).map((field: { name: any; type: any }, fieldIndex: any) => (
                <Badge key={fieldIndex} variant="secondary">
                  {field.name} ({field.type})
                </Badge>
              ))}
              {resource.selectedFields.length > 5 && (
                <Badge variant="outline">
                  +{resource.selectedFields.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-[95vw] h-[95vh] flex flex-col">
          {/* Header */}
          {/* Header */}
          {/* Header - Compact 2-row layout */}
          <CardHeader className="border-b relative py-3">
            {/* Close button - properly sized */}
            <div className="absolute top-2 right-2 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClose}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-transparent"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-700">
                  <div className="text-center">
                    <p className="text-sm font-medium">Close Template</p>
                    <p className="text-xs text-slate-300 mt-1">ESC • Auto-saves metadata changes</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Main content - 2 rows only */}
            <div className="pr-10 space-y-3">
              {/* Row 1: Template Name (prominent) */}
              <div>
                <Label htmlFor="header-name" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Template Name
                </Label>
                <Input
                  id="header-name"
                  value={editedTemplate.name}
                  onChange={(e) => handleMetadataChange('name', e.target.value)}
                  className="text-xl font-bold text-slate-900 dark:text-slate-100 border-0 px-0 bg-transparent focus:ring-0 focus:border-b-2 focus:border-slate-500 shadow-none placeholder:text-slate-400"
                  placeholder="Enter template name"
                />
              </div>

              {/* Row 2: Version, Description, and Tags in a single row */}
              <div className="grid grid-cols-12 gap-4 items-end">
                {/* Version - compact */}
                <div className="col-span-2">
                  <Label htmlFor="header-version" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    Version
                  </Label>
                  <Input
                    id="header-version"
                    value={editedTemplate.version || ''}
                    onChange={(e) => handleMetadataChange('version', e.target.value)}
                    className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-0 px-0 bg-transparent focus:ring-0 focus:border-b-2 focus:border-slate-500 shadow-none placeholder:text-slate-400"
                    placeholder="1.0.0"
                  />
                </div>

                {/* Description - takes more space */}
                <div className="col-span-6">
                  <Label htmlFor="header-description" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    Description
                  </Label>
                  <Input
                    id="header-description"
                    value={editedTemplate.description || ''}
                    onChange={(e) => handleMetadataChange('description', e.target.value)}
                    className="text-sm font-medium text-slate-800 dark:text-slate-200 border-0 px-0 bg-transparent focus:ring-0 focus:border-b-2 focus:border-slate-500 shadow-none placeholder:text-slate-400"
                    placeholder="Describe your template"
                  />
                </div>

                {/* Tags - compact inline */}
                <div className="col-span-4">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    Tags
                  </Label>
                  <div className="flex items-center gap-1">
                    {/* Show existing tags compactly */}
                    {(editedTemplate.tags || []).slice(0, 2).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200 border-slate-200 dark:border-slate-700 px-1 py-0">
                        {tag}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1 hover:bg-transparent"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <X className="h-2 w-2 hover:text-red-500" />
                        </Button>
                      </Badge>
                    ))}
                    {(editedTemplate.tags || []).length > 2 && (
                      <span className="text-xs text-slate-600">+{(editedTemplate.tags || []).length - 2}</span>
                    )}

                    {/* Quick add input */}
                    <div className="flex items-center ml-1">
                      <Input
                        placeholder="add"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        className="w-12 text-xs border-0 bg-transparent focus:ring-0 focus:border-b-1 focus:border-slate-500 shadow-none placeholder:text-slate-400 px-0"
                      />
                      <Button
                        type="button"
                        onClick={handleAddTag}
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 ml-1 text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-transparent"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          {/* Content */}
          <CardContent className="flex-1 overflow-hidden p-0">
            {currentMode === 'preview' ? (
              <Tabs defaultValue="resources" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-4 mx-6 mt-4">
                  <TabsTrigger value="resources" className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Resources ({editedTemplate.resources.length})
                  </TabsTrigger>
                  <TabsTrigger value="yaml" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    YAML
                  </TabsTrigger>
                  <TabsTrigger value="helm" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Helm
                  </TabsTrigger>
                  <TabsTrigger value="kustomize" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Kustomize
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-auto p-6">
                  <TabsContent value="resources" className="mt-0">
                    <div className="space-y-4">
                      {/* Improved header with better button positioning */}
                      <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Template Resources</h3>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddResourceModal(true)
                              loadAvailableKinds()
                            }}
                            className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/20"
                          >
                            <Plus className="h-4 w-4" />
                            Add Resource
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {editedTemplate.resources.length} resources
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {editedTemplate.resources.reduce((acc: any, r: { selectedFields: string | any[] }) => acc + r.selectedFields.length, 0)} total fields
                          </Badge>
                        </div>
                      </div>

                      {editedTemplate.resources.length === 0 ? (
                        <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                          <Layers className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                          <h4 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No resources yet</h4>
                          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            Start building your template by adding Kubernetes resources including CRDs
                          </p>
                          <div className="flex justify-center">
                            <Button
                              onClick={() => {
                                setShowAddResourceModal(true)
                                loadAvailableKinds()
                              }}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                            >
                              <Plus className="h-4 w-4" />
                              Add Your First Resource
                            </Button>
                          </div>
                        </div>
                      ) : (
                        editedTemplate.resources.map((resource: any, index: number) => renderResourceSummary(resource, index))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="yaml" className="mt-0">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm overflow-auto max-h-96">
                        <code>{loading ? 'Generating preview...' : preview.yaml}</code>
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="helm" className="mt-0">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm overflow-auto max-h-96">
                        <code>{loading ? 'Generating preview...' : preview.helm}</code>
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="kustomize" className="mt-0">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm overflow-auto max-h-96">
                        <code>{loading ? 'Generating preview...' : preview.kustomize}</code>
                      </pre>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <div className="h-full overflow-auto p-6">
                <div className="space-y-6">
                  {/* Show isolated resource editor when editing individual resource */}
                  {editingResourceIndex !== null ? (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold">
                          Editing: {editedTemplate.resources[editingResourceIndex].kind}
                        </h3>
                        <Badge variant="outline">
                          Resource {editingResourceIndex + 1} of {editedTemplate.resources.length}
                        </Badge>
                      </div>
                      {renderResourceEditor(editedTemplate.resources[editingResourceIndex], editingResourceIndex)}
                    </div>
                  ) : (
                    /* Show all resources when not editing individual resource */
                    <div>
                      <h3 className="text-lg font-semibold mb-4">All Resources</h3>
                      {editedTemplate.resources.map((resource: any, index: number) => renderResourceEditor(resource, index))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Resource Modal */}
      {showAddResourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-[600px] max-h-[80vh] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Kubernetes Resource
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddResourceModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search Kubernetes resources and CRDs..."
                    value={searchTerm}
                    onChange={(e: { target: { value: React.SetStateAction<string> } }) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Quick Add Common Resources */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Add</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress', 'PersistentVolumeClaim'].map(kind => (
                      <Button
                        key={kind}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddNewResource({ kind, apiVersion: 'v1' })}
                        className="text-xs"
                      >
                        {kind}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Filtered Results */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Available Resources {searchTerm && `(${filteredKinds.reduce((acc, group) => acc + (group.kinds as any[]).length, 0)} found)`}
                  </h4>
                  <div className="max-h-64 overflow-auto space-y-3">
                    {filteredKinds.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        {searchTerm ? 'No resources found matching your search' : 'Loading resources...'}
                      </p>
                    ) : (
                      filteredKinds.map((group, groupIndex) => (
                        <div key={groupIndex} className="space-y-1">
                          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.category}</h5>
                          {(group.kinds as any[]).map((kind, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                              onClick={() => handleAddNewResource(kind)}
                            >
                              <div>
                                <span className="font-medium">{kind.kind}</span>
                                <span className="text-sm text-gray-500 ml-2">{kind.apiVersion}</span>
                              </div>
                              <Plus className="h-4 w-4 text-gray-400" />
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog />
    </TooltipProvider>
  )
}