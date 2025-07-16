import React, { useState } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Separator } from '@/renderer/components/ui/separator'
import {
  Download,
  Upload,
  Save,
  FileText,
  Package,
  Eye,
  Share2,
  Copy,
  RefreshCw
} from 'lucide-react'
import { generateHelmChart } from '@/renderer/utils/helm-template-generator'
import { Template } from '@/shared/types/template'

interface TemplateActionsProps {
  template: Template
  isValid: boolean
  onSave: () => void
  onLoad: (template: Template) => void
  onExport: (format: 'yaml' | 'json' | 'helm' | 'kustomize') => void
}

export function TemplateActions({
  template,
  isValid,
  onSave,
  onLoad,
  onExport
}: TemplateActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)

  const handleGenerateHelm = async () => {
    if (!isValid) return

    setIsGenerating(true)
    try {
      await generateHelmChart(template)
      setLastGenerated(new Date())
      onExport('helm')
    } catch (error) {
      console.error('Failed to generate Helm chart:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateTemplate = async (format: 'helm' | 'kustomize' | 'yaml') => {
    if (!isValid) return

    setIsGenerating(true)
    try {
      // Use the new backend API
      const result = await window.electronAPI.template.generate({
        templateId: template.id || 'temp-template',
        context: {}, // Add context from form data
        outputPath: './output', // Let user choose
        format
      })

      if (result.success) {
        setLastGenerated(new Date())
        onExport(format)
      } else {
        console.error('Generation failed:', result.errors)
      }
    } catch (error) {
      console.error(`Failed to generate ${format}:`, error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportTemplate = async (format: 'yaml' | 'json') => {
    try {
      const templateData = {
        ...template,
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          generator: 'ConfigPilot Template Designer'
        }
      }

      const content = format === 'yaml'
        ? yaml.dump(templateData)
        : JSON.stringify(templateData, null, 2)

      const blob = new Blob([content], { type: `application/${format}` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${template.name || 'template'}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export template:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Template Actions</span>
          <div className="flex items-center gap-2">
            {isValid ? (
              <Badge className="bg-green-100 text-green-800">✅ Ready</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800">❌ Invalid</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleGenerateHelm}
            disabled={!isValid || isGenerating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Helm Chart'}
          </Button>

          <Button
            variant="outline"
            onClick={() => onExport('yaml')}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview YAML
          </Button>
        </div>

        <Separator />

        {/* Secondary Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportTemplate('json')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportTemplate('yaml')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Export YAML
          </Button>

          <Button
            onClick={() => handleGenerateTemplate('kustomize')}
            disabled={!isValid || isGenerating}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Kustomize'}
          </Button>

        </div>

        {/* Template Statistics */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium text-gray-700">Template Summary</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Resources:</span>
              <span className="ml-2 font-medium">{template.resources?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Fields:</span>
              <span className="ml-2 font-medium">
                {template.resources?.reduce((sum, r) => sum + (r.selectedFields?.length || 0), 0) || 0}
              </span>
            </div>
          </div>
          {lastGenerated && (
            <div className="text-xs text-gray-500">
              Last generated: {lastGenerated.toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}