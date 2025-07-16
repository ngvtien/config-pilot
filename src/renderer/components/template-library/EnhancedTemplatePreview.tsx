import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Badge } from '@/renderer/components/ui/badge'
import { Separator } from '@/renderer/components/ui/separator'
import { Eye, Download, Package, Settings, Play, FileText, Layers } from 'lucide-react'
import { Template, TemplateResource, TemplateField } from '@/shared/types/template'

interface EnhancedTemplatePreviewProps {
  template: Template
  onClose: () => void
  onUse: (template: Template) => void
  onCustomize: (template: Template) => void
  onDryRun: (template: Template) => void
}

/**
 * Enhanced template preview component with detailed resource analysis,
 * field inspection, and consumer-focused actions
 */
export function EnhancedTemplatePreview({ 
  template, 
  onClose, 
  onUse, 
  onCustomize, 
  onDryRun 
}: EnhancedTemplatePreviewProps) {
  const [preview, setPreview] = useState({ yaml: '', helm: '', kustomize: '' })
  const [loading, setLoading] = useState(false)
  const [resourceDetails, setResourceDetails] = useState<any[]>([])
  const [selectedResource, setSelectedResource] = useState<TemplateResource | null>(null)

  useEffect(() => {
    generatePreviews()
    analyzeResources()
  }, [template])

  /**
   * Generate preview content for different formats
   */
  const generatePreviews = async () => {
    setLoading(true)
    try {
      const [yamlResult, helmResult, kustomizeResult] = await Promise.all([
        window.electronAPI.template.generate({
          templateId: template.id,
          context: {},
          outputPath: '/tmp',
          format: 'yaml'
        }),
        window.electronAPI.template.generate({
          templateId: template.id,
          context: {},
          outputPath: '/tmp',
          format: 'helm'
        }),
        window.electronAPI.template.generate({
          templateId: template.id,
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
   * Analyze template resources and extract field details
   */
  const analyzeResources = () => {
    const details = template.resources.map(resource => ({
      ...resource,
      fieldCount: resource.selectedFields.length,
      requiredFields: resource.selectedFields.filter(f => f.required).length,
      optionalFields: resource.selectedFields.filter(f => !f.required).length,
      fieldTypes: resource.selectedFields.reduce((acc, field) => {
        acc[field.type] = (acc[field.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }))
    setResourceDetails(details)
  }

  /**
   * Handle dry run validation
   */
  const handleDryRun = async () => {
    try {
      await onDryRun(template)
    } catch (error) {
      console.error('Dry run failed:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-5/6 h-5/6 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold">{template.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{template.resources.length} Resources</Badge>
                <Badge variant="secondary">
                  {template.resources.reduce((sum, r) => sum + r.selectedFields.length, 0)} Fields
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDryRun} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                Dry Run
              </Button>
              <Button onClick={() => onCustomize(template)} variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Customize
              </Button>
              <Button onClick={() => onUse(template)}>
                <Package className="h-4 w-4 mr-2" />
                Use Template
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          <Tabs defaultValue="resources" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="resources">Resources & Fields</TabsTrigger>
              <TabsTrigger value="yaml">YAML Preview</TabsTrigger>
              <TabsTrigger value="helm">Helm Chart</TabsTrigger>
              <TabsTrigger value="kustomize">Kustomize</TabsTrigger>
            </TabsList>
            
            {/* Resource Analysis Tab */}
            <TabsContent value="resources" className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                {/* Resource List */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Template Resources
                  </h4>
                  {resourceDetails.map((resource, index) => (
                    <Card 
                      key={index} 
                      className={`cursor-pointer transition-colors ${
                        selectedResource === template.resources[index] 
                          ? 'ring-2 ring-blue-500' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedResource(template.resources[index])}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{resource.kind}</h5>
                          <Badge variant="outline">{resource.templateType}</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{resource.apiVersion}</p>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {resource.fieldCount} fields
                          </span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            {resource.requiredFields} required
                          </span>
                          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {resource.optionalFields} optional
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Field Details */}
                <div>
                  {selectedResource ? (
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {selectedResource.kind} Fields
                      </h4>
                      <div className="space-y-2 max-h-96 overflow-auto">
                        {selectedResource.selectedFields.map((field, fieldIndex) => (
                          <Card key={fieldIndex} className="p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{field.name}</span>
                              <div className="flex gap-1">
                                <Badge variant={field.required ? 'destructive' : 'secondary'} className="text-xs">
                                  {field.type}
                                </Badge>
                                {field.required && (
                                  <Badge variant="outline" className="text-xs">Required</Badge>
                                )}
                              </div>
                            </div>
                            {field.description && (
                              <p className="text-xs text-gray-600 mb-1">{field.description}</p>
                            )}
                            {field.default && (
                              <p className="text-xs text-blue-600">Default: {JSON.stringify(field.default)}</p>
                            )}
                            {field.enum && (
                              <p className="text-xs text-purple-600">
                                Options: {field.enum.join(', ')}
                              </p>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Select a resource to view its fields</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* YAML Preview Tab */}
            <TabsContent value="yaml" className="flex-1 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto h-full">
                {loading ? 'Generating preview...' : preview.yaml}
              </pre>
            </TabsContent>
            
            {/* Helm Chart Tab */}
            <TabsContent value="helm" className="flex-1 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto h-full">
                {loading ? 'Generating preview...' : preview.helm}
              </pre>
            </TabsContent>
            
            {/* Kustomize Tab */}
            <TabsContent value="kustomize" className="flex-1 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto h-full">
                {loading ? 'Generating preview...' : preview.kustomize}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}