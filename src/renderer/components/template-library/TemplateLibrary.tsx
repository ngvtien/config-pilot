import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Search, Download, Upload, Trash2, Eye, Package } from 'lucide-react'

interface TemplateLibraryProps {
  onTemplateSelect?: (template: any) => void
  onTemplateImport?: (template: any) => void
}

export function TemplateLibrary({ onTemplateSelect, onTemplateImport }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const allTemplates = await window.electronAPI.template.getAll()
      setTemplates(allTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      try {
        const results = await window.electronAPI.template.search(query)
        setTemplates(results)
      } catch (error) {
        console.error('Search failed:', error)
      }
    } else {
      loadTemplates()
    }
  }

  const handleImportTemplate = async () => {
    try {
      const filePath = await window.electronAPI.openFile({
        ilters: [{ name: 'Config Pilot Templates', extensions: ['cpt'] }] 
      })
      
      if (filePath) {
        const importedTemplate = await window.electronAPI.template.import(filePath)
        onTemplateImport?.(importedTemplate)
        loadTemplates() // Refresh list
      }
    } catch (error) {
      console.error('Import failed:', error)
    }
  }

  const handleExportTemplate = async (templateId: string) => {
    try {
      const result = await window.electronAPI.showSaveDialog({
        defaultPath: `template-${templateId}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      })
      
      if (!result.canceled && result.filePath) {
        await window.electronAPI.template.export({ templateId, exportPath: result.filePath })
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await window.electronAPI.template.delete(templateId)
        loadTemplates() // Refresh list
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Template Library</h2>
        <Button onClick={handleImportTemplate} className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Import Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template: any) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{template.name}</span>
                <Badge variant="secondary">{template.templateType || 'kubernetes'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {template.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>{template.resources?.length || 0} resources</span>
                <span>{template.metadata?.version || '1.0.0'}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onTemplateSelect?.(template)}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Use
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportTemplate(template.id)}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading templates...</p>
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No templates found</p>
          <p className="text-sm text-gray-500">Import a template to get started</p>
        </div>
      )}
    </div>
  )
}