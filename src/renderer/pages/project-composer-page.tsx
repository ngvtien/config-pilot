import React, { useState, useEffect } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Trash2, Plus, FileText, Settings, Package, Upload } from 'lucide-react'
import type { EnhancedTemplate, TemplateCollection, TemplateGenerationResult } from '@/shared/types/enhanced-template'
import type { ProjectConfig } from '@/shared/types/project'

/**
 * Project composer page for creating projects with multiple templates
 */
export function ProjectComposerPage() {
  const [projectName, setProjectName] = useState('')
  const [selectedTemplates, setSelectedTemplates] = useState<EnhancedTemplate[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<EnhancedTemplate[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<TemplateGenerationResult | null>(null)

  /**
   * Load available templates on component mount
   */
  useEffect(() => {
    loadAvailableTemplates()
  }, [])

  /**
   * Load templates from the template manager
   */
  const loadAvailableTemplates = async () => {
    try {
      const templates = await window.electronAPI.template.getAll()
      setAvailableTemplates(templates)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  /**
   * Import template from file dialog
   */
  const importTemplate = async () => {
    try {
      const result = await window.electronAPI.openFile({
        filters: [
          { name: 'Config Pilot Templates', extensions: ['cpt'] },
          { name: 'YAML Templates', extensions: ['yaml', 'yml'] },
          { name: 'JSON Templates', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (result) {
        const importedTemplate = await window.electronAPI.template.import(result)
        // Refresh available templates list
        await loadAvailableTemplates()
        console.log('Template imported successfully:', importedTemplate.name)
      }
    } catch (error) {
      console.error('Template import failed:', error)
    }
  }

  /**
   * Import template from manual YAML content
   */
  const importManualTemplate = async () => {
    try {
      const result = await window.electronAPI.openFile({
        filters: [{ name: 'YAML Files', extensions: ['yaml', 'yml'] }]
      })
      
      if (result) {
        const content = await window.electronAPI.readFile(result)
        // Use the manual template generator
        const manualResult = await window.electronAPI.generateFromManualTemplate({
          templateName: 'Imported Template',
          namespace: 'default',
          values: {},
          yamlContent: content
        })
        
        if (manualResult.success) {
          await loadAvailableTemplates()
          console.log('Manual template imported successfully')
        }
      }
    } catch (error) {
      console.error('Manual template import failed:', error)
    }
  }

  /**
   * Add a template to the project composition
   */
  const addTemplate = (template: EnhancedTemplate) => {
    if (!selectedTemplates.find(t => t.id === template.id)) {
      setSelectedTemplates([...selectedTemplates, template])
    }
  }

  /**
   * Remove a template from the project composition
   */
  const removeTemplate = (templateId: string) => {
    setSelectedTemplates(selectedTemplates.filter(t => t.id !== templateId))
  }

  /**
   * Generate the project with selected templates
   */
  const generateProject = async () => {
    if (!projectName.trim() || selectedTemplates.length === 0) {
      return
    }

    setIsGenerating(true)
    try {
      // Create project configuration
      const projectConfig: Partial<ProjectConfig> = {
        name: projectName,
        templates: selectedTemplates.map(t => t.id)
      }

      // Generate project with multiple templates
      const results = []
      for (const template of selectedTemplates) {
        const result = await window.electronAPI.template.generateForProject({
          templateId: template.id,
          project: projectConfig,
          context: { projectName },
          format: 'helm'
        })
        results.push(result)
      }

      setGenerationResult({
        success: true,
        outputPath: `./projects/${projectName}`,
        generatedFiles: results.flatMap(r => r.generatedFiles || []),
        errors: [],
        warnings: []
      })
    } catch (error) {
      console.error('Failed to generate project:', error)
      setGenerationResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        generatedFiles: []
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Composer</h1>
          <p className="text-muted-foreground">
            Create a new project by combining multiple templates
          </p>
        </div>
      </div>

      {/* Project Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Project Configuration</CardTitle>
          <CardDescription>
            Configure your project settings and select templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Project Name</label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Templates */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Available Templates</h3>
            <div className="flex gap-2">
              <Button onClick={importTemplate} variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import Template
              </Button>
              <Button onClick={importManualTemplate} variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Import YAML
              </Button>
            </div>
          </div>
          
          {availableTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No templates available</p>
              <p className="text-sm">Import templates to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {availableTemplates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{template.name}</h4>
                      <Button
                        onClick={() => addTemplate(template)}
                        size="sm"
                        variant="ghost"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    {template.metadata?.category && (
                      <Badge variant="secondary" className="text-xs">
                        {template.metadata.category}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Selected Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Selected Templates ({selectedTemplates.length})
            </CardTitle>
            <CardDescription>
              Templates that will be included in your project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedTemplates.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No templates selected
                </p>
              ) : (
                selectedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {template.resources?.length || 0} resources
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        v{template.version || '1.0.0'}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation Results */}
      {generationResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              Generation {generationResult.success ? 'Successful' : 'Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generationResult.success ? (
              <div className="space-y-2">
                <p className="text-green-600">Project generated successfully!</p>
                {generationResult.outputPath && (
                  <p className="text-sm text-muted-foreground">
                    Output: {generationResult.outputPath}
                  </p>
                )}
                {generationResult.generatedFiles && (
                  <div>
                    <p className="text-sm font-medium">Generated files:</p>
                    <ul className="text-sm text-muted-foreground ml-4">
                      {generationResult.generatedFiles.map((file, index) => (
                        <li key={index}>• {file.path} ({file.type})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-red-600">Generation failed</p>
                {generationResult.errors && (
                  <ul className="text-sm text-red-600 ml-4">
                    {generationResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button
          onClick={generateProject}
          disabled={!projectName.trim() || selectedTemplates.length === 0 || isGenerating}
          size="lg"
        >
          {isGenerating ? 'Generating...' : 'Generate Project'}
        </Button>
      </div>
    </div>
  )
}