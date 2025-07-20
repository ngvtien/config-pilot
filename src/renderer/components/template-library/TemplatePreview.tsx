import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Badge } from '@/renderer/components/ui/badge'
import { Eye, Download, Package } from 'lucide-react'

interface TemplatePreviewProps {
  template: any
  onClose: () => void
  onUse: (template: any) => void
}

export function TemplatePreview({ template, onClose, onUse }: TemplatePreviewProps) {
  const [preview, setPreview] = useState({ yaml: '', helm: '', kustomize: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    generatePreviews()
  }, [template])

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-4/5 h-4/5 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl">{template.name}</h3>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
            <div className="flex gap-2">
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
          <Tabs defaultValue="yaml" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="yaml">YAML</TabsTrigger>
              <TabsTrigger value="helm">Helm Chart</TabsTrigger>
              <TabsTrigger value="kustomize">Kustomize</TabsTrigger>
            </TabsList>
            
            <TabsContent value="yaml" className="flex-1 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto h-full">
                {loading ? 'Generating preview...' : preview.yaml}
              </pre>
            </TabsContent>
            
            <TabsContent value="helm" className="flex-1 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto h-full">
                {loading ? 'Generating preview...' : preview.helm}
              </pre>
            </TabsContent>
            
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