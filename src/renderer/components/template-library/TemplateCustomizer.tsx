import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Badge } from '@/renderer/components/ui/badge'
import { Separator } from '@/renderer/components/ui/separator'
import { Plus, Trash2, Save, X, Settings } from 'lucide-react'
import { Template, TemplateResource, TemplateField } from '@/shared/types/template'
import { TemplateDesigner } from '../template-creator/TemplateDesigner'

interface TemplateCustomizerProps {
  template: Template
  onClose: () => void
  onSave: (customizedTemplate: Template) => void
}

/**
 * Template customizer component that allows consumers to:
 * - Modify template metadata
 * - Add/remove/edit resource fields
 * - Customize field values and constraints
 * - Preview changes in real-time
 */
export function TemplateCustomizer({ template, onClose, onSave }: TemplateCustomizerProps) {
  const [customizedTemplate, setCustomizedTemplate] = useState<Template>({
    ...template,
    name: `${template.name} (Customized)`,
    resources: template.resources.map(r => ({ ...r, selectedFields: [...r.selectedFields] }))
  })
  
  const [selectedResourceIndex, setSelectedResourceIndex] = useState<number>(0)
  const [showDesigner, setShowDesigner] = useState(false)

  /**
   * Handle template metadata changes
   */
  const handleMetadataChange = (field: string, value: string) => {
    setCustomizedTemplate(prev => ({
      ...prev,
      [field]: value
    }))
  }

  /**
   * Handle resource field modifications
   */
  const handleFieldChange = (resourceIndex: number, fieldIndex: number, field: string, value: any) => {
    setCustomizedTemplate(prev => {
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
  }

  /**
   * Add new field to resource
   */
  const handleAddField = (resourceIndex: number) => {
    const newField: TemplateField = {
      name: 'newField',
      type: 'string',
      required: false,
      description: 'Custom field'
    }
    
    setCustomizedTemplate(prev => {
      const newTemplate = { ...prev }
      newTemplate.resources = [...prev.resources]
      newTemplate.resources[resourceIndex] = { ...prev.resources[resourceIndex] }
      newTemplate.resources[resourceIndex].selectedFields = [
        ...prev.resources[resourceIndex].selectedFields,
        newField
      ]
      return newTemplate
    })
  }

  /**
   * Remove field from resource
   */
  const handleRemoveField = (resourceIndex: number, fieldIndex: number) => {
    setCustomizedTemplate(prev => {
      const newTemplate = { ...prev }
      newTemplate.resources = [...prev.resources]
      newTemplate.resources[resourceIndex] = { ...prev.resources[resourceIndex] }
      newTemplate.resources[resourceIndex].selectedFields = prev.resources[resourceIndex].selectedFields.filter(
        (_, index) => index !== fieldIndex
      )
      return newTemplate
    })
  }

  /**
   * Save customized template
   */
  const handleSave = async () => {
    try {
      // Save the customized template
      await window.electronAPI.template.save(customizedTemplate)
      onSave(customizedTemplate)
    } catch (error) {
      console.error('Failed to save customized template:', error)
      alert('Failed to save template. Check console for details.')
    }
  }

  if (showDesigner) {
    return (
      <div className="fixed inset-0 bg-white z-50">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">Advanced Template Designer</h2>
            <Button onClick={() => setShowDesigner(false)} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Back to Customizer
            </Button>
          </div>
          <div className="flex-1">
            <TemplateDesigner
              initialTemplate={customizedTemplate}
              onTemplateChange={setCustomizedTemplate}
              settingsData={{} as any} // You'll need to pass actual settings
              contextData={{} as any} // You'll need to pass actual context
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-5/6 h-5/6 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Customize Template</h3>
              <p className="text-sm text-gray-600">Modify template fields and properties</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowDesigner(true)} variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Advanced Designer
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Template Metadata */}
            <div className="space-y-4">
              <h4 className="font-semibold">Template Information</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="template-name">Name</Label>
                  <Input
                    id="template-name"
                    value={customizedTemplate.name}
                    onChange={(e) => handleMetadataChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="template-description">Description</Label>
                  <Textarea
                    id="template-description"
                    value={customizedTemplate.description || ''}
                    onChange={(e) => handleMetadataChange('description', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* Resource List */}
              <div>
                <h4 className="font-semibold mb-3">Resources</h4>
                <div className="space-y-2">
                  {customizedTemplate.resources.map((resource, index) => (
                    <Card 
                      key={index}
                      className={`cursor-pointer transition-colors ${
                        selectedResourceIndex === index ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedResourceIndex(index)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{resource.kind}</h5>
                            <p className="text-xs text-gray-600">{resource.selectedFields.length} fields</p>
                          </div>
                          <Badge variant="outline">{resource.templateType}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Field Editor */}
            <div className="lg:col-span-2">
              {customizedTemplate.resources[selectedResourceIndex] && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">
                      {customizedTemplate.resources[selectedResourceIndex].kind} Fields
                    </h4>
                    <Button 
                      size="sm" 
                      onClick={() => handleAddField(selectedResourceIndex)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field
                    </Button>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-auto">
                    {customizedTemplate.resources[selectedResourceIndex].selectedFields.map((field, fieldIndex) => (
                      <Card key={fieldIndex} className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Field Name</Label>
                            <Input
                              value={field.name}
                              onChange={(e) => handleFieldChange(selectedResourceIndex, fieldIndex, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <select
                              className="w-full p-2 border rounded"
                              value={field.type}
                              onChange={(e) => handleFieldChange(selectedResourceIndex, fieldIndex, 'type', e.target.value)}
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="array">Array</option>
                              <option value="object">Object</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              value={field.description || ''}
                              onChange={(e) => handleFieldChange(selectedResourceIndex, fieldIndex, 'description', e.target.value)}
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label>Default Value</Label>
                            <Input
                              value={field.default || ''}
                              onChange={(e) => handleFieldChange(selectedResourceIndex, fieldIndex, 'default', e.target.value)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => handleFieldChange(selectedResourceIndex, fieldIndex, 'required', e.target.checked)}
                              />
                              <span className="text-sm">Required</span>
                            </label>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveField(selectedResourceIndex, fieldIndex)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}