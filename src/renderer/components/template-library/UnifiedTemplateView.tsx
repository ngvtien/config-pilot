import React, { useState, useEffect } from 'react'
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
  ChevronLeft
} from 'lucide-react'
import { Template, TemplateResource, TemplateField } from '@/shared/types/template'
import { cn } from "@/lib/utils"
import yaml from 'js-yaml'
import YamlEditor from '@/renderer/components/yaml-editor'

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
    resources: template.resources.map(r => ({ ...r, selectedFields: [...r.selectedFields] }))
  })
  const [preview, setPreview] = useState({ yaml: '', helm: '', kustomize: '' })
  const [loading, setLoading] = useState(false)
  const [expandedResources, setExpandedResources] = useState<Set<number>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editingResourceIndex, setEditingResourceIndex] = useState<number | null>(null)

  useEffect(() => {
    if (currentMode === 'preview') {
      generatePreviews()
    }
  }, [currentMode, editedTemplate])

  // useEffect(() => {
  //   if (currentMode === 'preview') {
  //     generatePreviews()
  //   }
  // }, [currentMode])

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
   * Handle mode switching with unsaved changes warning
   */
  const handleModeSwitch = (newMode: 'preview' | 'edit') => {
    if (hasUnsavedChanges && newMode === 'preview') {
      const confirmed = confirm('You have unsaved changes. Switch to preview mode anyway?')
      if (!confirmed) return
    }
    setCurrentMode(newMode)
  }

  /**
   * Handle template metadata changes
   */
  const handleMetadataChange = (field: string, value: string) => {
    setEditedTemplate(prev => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  /**
   * Handle resource field modifications
   */
  const handleFieldChange = (resourceIndex: number, fieldIndex: number, field: string, value: any) => {
    setEditedTemplate(prev => {
      const newTemplate = { ...prev }
      newTemplate.resources = [...prev.resources]
      newTemplate.resources[resourceIndex] = { ...prev.resources[resourceIndex] }
      newTemplate.resources[resourceIndex].selectedFields = [...prev.resources[resourceIndex].selectedFields]
      newTemplate.resources[resourceIndex].selectedFields[fieldIndex] = {
        ...prev.resources[resourceIndex].selectedFields[fieldIndex],
        [field]: value
      }
      return newTemplate
    })
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
   * Save changes
   */
  const handleSave = async () => {
    try {
      await window.electronAPI.template.save(editedTemplate)
      onSave(editedTemplate)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template. Check console for details.')
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
    resource.selectedFields.forEach(field => {
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
    const requiredFields = resource.selectedFields.filter(f => f.required).length
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
              </div>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="bg-background">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {resource.selectedFields.map((field, fieldIndex) => (
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
            onChange={(content) => handleResourceYamlChange(index, content)}
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
              {resource.selectedFields.slice(0, 5).map((field, fieldIndex) => (
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
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                {/* Always editable metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <Label htmlFor="header-name" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Template Name</Label>
                    <Input
                      id="header-name"
                      value={editedTemplate.name}
                      onChange={(e) => handleMetadataChange('name', e.target.value)}
                      className="text-xl font-bold text-slate-900 dark:text-slate-100 border-0 px-0 bg-transparent focus:ring-0 focus:border-b-2 focus:border-blue-500 shadow-none"
                      placeholder="Template name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="header-version" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Version</Label>
                    <Input
                      id="header-version"
                      value={editedTemplate.version || ''}
                      onChange={(e) => handleMetadataChange('version', e.target.value)}
                      className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-0 px-0 bg-transparent focus:ring-0 focus:border-b-2 focus:border-blue-500 shadow-none"
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="header-description" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Description</Label>
                    <Input
                      id="header-description"
                      value={editedTemplate.description || ''}
                      onChange={(e) => handleMetadataChange('description', e.target.value)}
                      className="text-base font-medium text-slate-700 dark:text-slate-300 border-0 px-0 bg-transparent focus:ring-0 focus:border-b-2 focus:border-blue-500 shadow-none"
                      placeholder="Template description"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Mode Toggle - only show if not editing individual resource */}
                {/* {editingResourceIndex === null && (
                  <div className="flex bg-gray-800 dark:bg-gray-200 rounded-lg p-1 border border-gray-600 dark:border-gray-400">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleModeSwitch('preview')}
                      className={cn(
                        "flex items-center gap-2 transition-all font-medium",
                        currentMode === 'preview' 
                          ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-md border border-gray-300 dark:border-gray-600" 
                          : "bg-transparent text-gray-300 dark:text-gray-700 hover:bg-gray-700 dark:hover:bg-gray-300 hover:text-white dark:hover:text-gray-900"
                      )}
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleModeSwitch('edit')}
                      className={cn(
                        "flex items-center gap-2 transition-all font-medium",
                        currentMode === 'edit' 
                          ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-md border border-gray-300 dark:border-gray-600" 
                          : "bg-transparent text-gray-300 dark:text-gray-700 hover:bg-gray-700 dark:hover:bg-gray-300 hover:text-white dark:hover:text-gray-900"
                      )}
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit All
                      {hasUnsavedChanges && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
                    </Button>
                  </div>
                )} */}

                {/* Back button when editing individual resource */}
                {/* {editingResourceIndex !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={exitResourceEdit}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-sm font-medium">Back to All Resources</p>
                      <p className="text-xs text-slate-400 mt-1">Return to template overview</p>
                    </TooltipContent>
                  </Tooltip>
                )} */}

                {/* Close button with tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onClose}
                      className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all duration-200 group border border-transparent hover:border-red-200 dark:hover:border-red-800"
                    >
                      <X className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-700">
                    <p className="text-sm font-medium">Close template preview</p>
                    <p className="text-xs text-slate-400 mt-1">ESC</p>
                  </TooltipContent>
                </Tooltip>
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
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold">Template Resources</h3>
                        <div className="flex gap-2">
                          <Badge variant="outline">{editedTemplate.resources.length} resources</Badge>
                          <Badge variant="outline">
                            {editedTemplate.resources.reduce((acc, r) => acc + r.selectedFields.length, 0)} total fields
                          </Badge>
                        </div>
                      </div>
                      {editedTemplate.resources.map((resource, index) => renderResourceSummary(resource, index))}
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
                      {editedTemplate.resources.map((resource, index) => renderResourceEditor(resource, index))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}