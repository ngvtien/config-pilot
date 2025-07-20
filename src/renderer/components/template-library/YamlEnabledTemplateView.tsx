"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Badge } from '@/renderer/components/ui/badge'
import { Separator } from '@/renderer/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/renderer/components/ui/sheet'
import { 
  Eye, Download, Package, Settings, Play, FileText, Layers, 
  Edit3, Save, X, Plus, Trash2, ChevronDown, ChevronRight,
  Code, Zap, Package2, AlertCircle, CheckCircle,
  ChevronLeft, Split, Maximize2
} from 'lucide-react'
import { Template, TemplateResource, TemplateField } from '@/shared/types/template'
import YamlEditor, { YamlEditorProps } from '../yaml-editor'
import { cn } from "@/lib/utils"
import yaml from "js-yaml"

interface YamlEnabledTemplateViewProps {
  template: Template
  isOpen: boolean
  onClose: () => void
  onUse: (template: Template) => void
  onSave: (template: Template) => void
  onDryRun: (template: Template) => void
  mode?: 'preview' | 'edit'
  enableYamlByDefault?: boolean
  yamlLayout?: 'tabbed' | 'split' | 'yaml-only'
}

type EditMode = 'form' | 'yaml' | 'split'
type ScreenSize = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Enhanced template view with integrated YAML editing capabilities
 * Provides bi-directional synchronization between form and YAML content
 */
export function YamlEnabledTemplateView({ 
  template, 
  isOpen,
  onClose, 
  onUse, 
  onSave, 
  onDryRun,
  mode: initialMode = 'preview',
  enableYamlByDefault = false,
  yamlLayout = 'tabbed'
}: YamlEnabledTemplateViewProps) {
  const [currentMode, setCurrentMode] = useState<'preview' | 'edit'>(initialMode)
  const [editMode, setEditMode] = useState<EditMode>(enableYamlByDefault ? 'yaml' : 'form')
  const [editedTemplate, setEditedTemplate] = useState<Template>({
    ...template,
    resources: template.resources.map(r => ({ ...r, selectedFields: [...r.selectedFields] }))
  })
  const [preview, setPreview] = useState({ yaml: '', helm: '', kustomize: '' })
  const [loading, setLoading] = useState(false)
  const [expandedResources, setExpandedResources] = useState<Set<number>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editingResourceIndex, setEditingResourceIndex] = useState<number | null>(null)
  
  // YAML-specific state
  const [yamlContent, setYamlContent] = useState<string>('')
  const [yamlDrawerOpen, setYamlDrawerOpen] = useState(false)
  const [showQuickPreview, setShowQuickPreview] = useState(false)
  const [screenSize, setScreenSize] = useState<ScreenSize>('lg')

  /**
   * Generate JSON schema from selected template fields for YAML validation
   */
  const generateSchemaFromSelectedFields = useMemo(() => {
    const properties: any = {}
    const required: string[] = []

    editedTemplate.resources.forEach((resource, resourceIndex) => {
      const resourceKey = `${resource.kind.toLowerCase()}_${resourceIndex}`
      properties[resourceKey] = {
        type: 'object',
        title: `${resource.kind} Configuration`,
        properties: {}
      }

      resource.selectedFields.forEach((field) => {
        properties[resourceKey].properties[field.name] = {
          type: field.type === 'number' ? 'number' : 
                field.type === 'boolean' ? 'boolean' :
                field.type === 'array' ? 'array' : 'string',
          title: field.name,
          description: field.description
        }

        if (field.required) {
          if (!properties[resourceKey].required) {
            properties[resourceKey].required = []
          }
          properties[resourceKey].required.push(field.name)
        }
      })
    })

    return {
      type: 'object',
      title: `${editedTemplate.name} Configuration`,
      properties,
      required
    }
  }, [editedTemplate])

  /**
   * Generate YAML content from template data
   */
  const generateYamlFromTemplate = (template: Template): string => {
    // Add null checks for template
    if (!template) {
      return yaml.dump({ error: 'Template is undefined' }, { indent: 2 })
    }

    const yamlData = {
      apiVersion: 'v1',
      kind: 'Template',
      metadata: {
        name: template.name || 'Unnamed Template',
        description: template.description || 'No description provided'
      },
      resources: {} as Record<string, any>
    }

    // Add null checks for template.resources
    if (template.resources && Array.isArray(template.resources)) {
      template.resources.forEach((resource) => {
        // Add null checks for resource properties
        if (resource && resource.kind && resource.name) {
          const resourceKey = `${resource.kind.toLowerCase()}-${resource.name}`
          yamlData.resources[resourceKey] = {}

          // Add null checks for selectedFields
          if (resource.selectedFields && Array.isArray(resource.selectedFields)) {
            resource.selectedFields.forEach((field) => {
              if (field && field.name && field.type) {
                yamlData.resources[resourceKey][field.name] = getDefaultValueForType(field.type)
              }
            })
          }
        }
      })
    }

    return yaml.dump(yamlData, { indent: 2 })
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
   * Handle YAML content changes and sync back to form data
   */
  const handleYamlChange = (content: string) => {
    setYamlContent(content)
    setHasUnsavedChanges(true)
    
    try {
      const parsedYaml = require('js-yaml').load(content)
      if (parsedYaml && parsedYaml.metadata && parsedYaml.resources) {
        // Update template metadata
        const updatedTemplate = {
          ...editedTemplate,
          name: parsedYaml.metadata.name || editedTemplate.name,
          description: parsedYaml.metadata.description || editedTemplate.description,
          version: parsedYaml.metadata.version || editedTemplate.version
        }
        
        // Update resources based on YAML content
        // This is a simplified sync - in production, you'd want more robust parsing
        setEditedTemplate(updatedTemplate)
      }
    } catch (error) {
      console.warn('YAML parsing error:', error)
      // Don't update form data if YAML is invalid
    }
  }

  /**
   * Generate truncated YAML preview for quick view
   */
  const generateYamlPreview = (): string => {
    const fullYaml = yamlContent || generateYamlFromTemplate()
    const lines = fullYaml.split('\n')
    return lines.slice(0, 8).join('\n') + (lines.length > 8 ? '\n...' : '')
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
    // Update YAML content to reflect changes
    if (editMode === 'yaml' || editMode === 'split') {
      setYamlContent(generateYamlFromTemplate())
    }
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
    // Update YAML content to reflect changes
    if (editMode === 'yaml' || editMode === 'split') {
      setYamlContent(generateYamlFromTemplate())
    }
  }

  /**
   * Save changes
   */
  const handleSave = async () => {
    try {
      await onSave(editedTemplate)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Save failed:', error)
    }
  }

  /**
   * Initialize YAML content when switching to YAML mode
   */
  useEffect(() => {
    if ((editMode === 'yaml' || editMode === 'split') && !yamlContent) {
      setYamlContent(generateYamlFromTemplate())
    }
  }, [editMode])

  /**
   * Detect screen size for responsive layout
   */
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) setScreenSize('sm')
      else if (width < 1024) setScreenSize('md')
      else if (width < 1280) setScreenSize('lg')
      else setScreenSize('xl')
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /**
   * Render edit mode interface with YAML integration
   */
  const renderEditMode = () => {
    // For small screens, always use tabbed interface
    if (screenSize === 'sm' || screenSize === 'md') {
      return (
        <Tabs value={editMode === 'split' ? 'form' : editMode} onValueChange={(value) => setEditMode(value as EditMode)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="form">Form Editor</TabsTrigger>
              <TabsTrigger value="yaml">YAML Editor</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuickPreview(!showQuickPreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showQuickPreview ? 'Hide' : 'Show'} Preview
              </Button>
              <Sheet open={yamlDrawerOpen} onOpenChange={setYamlDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Maximize2 className="h-4 w-4 mr-1" />
                    Full YAML
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[600px] sm:w-[800px]">
                  <SheetHeader>
                    <SheetTitle>YAML Editor - {editedTemplate.name}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    {renderYamlEditor()}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          <TabsContent value="form">
            {showQuickPreview && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-sm">YAML Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    <code>{generateYamlPreview()}</code>
                  </pre>
                </CardContent>
              </Card>
            )}
            {renderFormEditor()}
          </TabsContent>
          
          <TabsContent value="yaml">
            {renderYamlEditor()}
          </TabsContent>
        </Tabs>
      )
    }

    // For larger screens, offer split view option
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button
              variant={editMode === 'form' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode('form')}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Form
            </Button>
            <Button
              variant={editMode === 'yaml' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode('yaml')}
            >
              <Code className="h-4 w-4 mr-1" />
              YAML
            </Button>
            <Button
              variant={editMode === 'split' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode('split')}
            >
              <Split className="h-4 w-4 mr-1" />
              Split
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Y</kbd> to toggle YAML
          </div>
        </div>

        {editMode === 'form' && renderFormEditor()}
        {editMode === 'yaml' && renderYamlEditor()}
        {editMode === 'split' && renderSplitView()}
      </div>
    )
  }

  /**
   * Render form editor section
   */
  const renderFormEditor = () => {
    if (editingResourceIndex !== null) {
      return renderResourceEditor(editingResourceIndex)
    }

    return (
      <div className="space-y-6">
        {/* Template metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editedTemplate.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedTemplate.description}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        {editedTemplate.resources.map((resource, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{resource.kind}</span>
                <Badge variant="secondary">{resource.selectedFields.length} fields</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {resource.selectedFields.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Field Name"
                      value={field.name}
                      onChange={(e) => handleFieldChange(index, fieldIndex, 'name', e.target.value)}
                    />
                    <select
                      className="px-3 py-2 border rounded-md"
                      value={field.type}
                      onChange={(e) => handleFieldChange(index, fieldIndex, 'type', e.target.value)}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="array">Array</option>
                      <option value="object">Object</option>
                    </select>
                    <Textarea
                      placeholder="Description"
                      value={field.description}
                      onChange={(e) => handleFieldChange(index, fieldIndex, 'description', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  /**
   * Render YAML editor section
   */
  const renderYamlEditor = () => {
    return (
      <div className="h-[600px]">
        <YamlEditor
          targetYamlFilename={`${editedTemplate.name.toLowerCase().replace(/\s+/g, '-')}.yaml`}
          jsonSchema={generateSchemaFromSelectedFields}
          context={{
            environment: 'development',
            product: editedTemplate.name
          }}
          layout="stacked"
          initialContent={yamlContent}
          onChange={handleYamlChange}
          title={`${editedTemplate.name} Configuration`}
        />
      </div>
    )
  }

  /**
   * Render split view with form and YAML side by side
   */
  const renderSplitView = () => {
    return (
      <div className="grid grid-cols-2 gap-4 h-[600px]">
        <div className="border rounded-lg p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Form Editor</h3>
          {renderFormEditor()}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">YAML Editor</h3>
          {renderYamlEditor()}
        </div>
      </div>
    )
  }

  /**
   * Render individual resource editor (simplified for brevity)
   */
  const renderResourceEditor = (resourceIndex: number) => {
    const resource = editedTemplate.resources[resourceIndex]
    return (
      <Card>
        <CardHeader>
          <CardTitle>Editing {resource.kind}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Simplified resource editor - implement based on existing UnifiedTemplateView */}
          <p>Resource editor for {resource.kind}</p>
        </CardContent>
      </Card>
    )
  }

  // Keyboard shortcut for YAML toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        setEditMode(prev => prev === 'yaml' ? 'form' : 'yaml')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-blue-600" />
              <span>{editedTemplate.name}</span>
              <Badge variant={currentMode === 'edit' ? 'default' : 'secondary'}>
                {currentMode === 'edit' ? 'Editing' : 'Preview'}
              </Badge>
              {hasUnsavedChanges && (
                <Badge variant="destructive" className="text-xs">
                  Unsaved Changes
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Mode Toggle */}
              <div className="flex bg-muted rounded-lg p-1">
                <Button
                  variant={currentMode === 'preview' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeSwitch('preview')}
                  className="h-8"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  variant={currentMode === 'edit' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeSwitch('edit')}
                  className="h-8"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
              
              {/* Action Buttons */}
              <Separator orientation="vertical" className="h-6" />
              
              <Button variant="outline" size="sm" onClick={() => onDryRun(editedTemplate)}>
                <Play className="h-4 w-4 mr-1" />
                Dry Run
              </Button>
              
              {currentMode === 'edit' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onSave(editedTemplate)}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              )}
              
              <Button variant="default" size="sm" onClick={() => onUse(editedTemplate)}>
                <Package2 className="h-4 w-4 mr-1" />
                Use Template
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {currentMode === 'preview' ? (
            <Tabs defaultValue="resources" className="h-full flex flex-col">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="helm">Helm</TabsTrigger>
                <TabsTrigger value="kustomize">Kustomize</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-hidden">
                <TabsContent value="resources" className="h-full overflow-auto">
                  {/* Resource preview content */}
                  <div className="space-y-4 p-4">
                    {editedTemplate.resources.map((resource, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-lg">{resource.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            {resource.selectedFields.map((field, fieldIndex) => (
                              <div key={fieldIndex} className="space-y-1">
                                <Label className="text-sm font-medium">{field.name}</Label>
                                <div className="text-sm text-muted-foreground">
                                  Type: {field.type} | Required: {field.required ? 'Yes' : 'No'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="yaml" className="h-full overflow-auto">
                  <div className="p-4">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{yamlContent || generateYamlFromTemplate()}</code>
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="helm" className="h-full overflow-auto">
                  <div className="p-4">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{preview.helm}</code>
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="kustomize" className="h-full overflow-auto">
                  <div className="p-4">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{preview.kustomize}</code>
                    </pre>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <div className="h-full overflow-auto">
              {renderEditMode()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}