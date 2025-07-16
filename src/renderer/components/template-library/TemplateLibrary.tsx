import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import { Settings, Play, Search, Download, Upload, Trash2, Eye, Package, RefreshCw, Filter, Grid, List } from 'lucide-react'
import { EnhancedTemplatePreview } from './EnhancedTemplatePreview'
import { TemplateCustomizer } from './TemplateCustomizer'
import { UnifiedTemplateView } from './UnifiedTemplateView'

interface TemplateLibraryProps {
  onTemplateSelect?: (template: any) => void
  onTemplateImport?: (template: any) => void
}

/**
 * Enhanced Template Library with comprehensive tooltips and improved UI flow
 * Features:
 * - Tooltips on all interactive elements
 * - Better visual hierarchy
 * - Improved action grouping
 * - Enhanced loading and empty states
 * - Better responsive design
 */
export function TemplateLibrary({ onTemplateSelect, onTemplateImport }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    loadTemplates()
  }, [])

  /**
   * Load all templates from the backend
   */
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

  /**
   * Handle template search with debouncing
   */
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

  /**
   * Handle template import with user feedback
   */
  const handleImportTemplate = async () => {
    try {
      const filePath = await window.electronAPI.openFile({
        filters: [{ name: 'Config Pilot Templates', extensions: ['cpt'] }] 
      })
      
      if (filePath) {
        const importedTemplate = await window.electronAPI.template.import(filePath)
        onTemplateImport?.(importedTemplate)
        loadTemplates() // Refresh list
        alert('✅ Template imported successfully!')
      }
    } catch (error) {
      console.error('Import failed:', error)
      alert('❌ Failed to import template. Check console for details.')
    }
  }

  /**
   * Handle template export with proper file naming
   */
  const handleExportTemplate = async (template: any) => {
    try {
      const result = await window.electronAPI.showSaveDialog({
        defaultPath: `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.cpt`,
        filters: [{ name: 'Config Pilot Templates', extensions: ['cpt'] }]
      })
      
      if (!result.canceled && result.filePath) {
        await window.electronAPI.template.export({ templateId: template.id, exportPath: result.filePath })
        alert('✅ Template exported successfully!')
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('❌ Failed to export template. Check console for details.')
    }
  }

  /**
   * Handle template deletion with confirmation
   */
  const handleDeleteTemplate = async (template: any) => {
    const confirmed = confirm(`Are you sure you want to delete "${template.name}"?\n\nThis action cannot be undone.`)
    if (confirmed) {
      try {
        await window.electronAPI.template.delete(template.id)
        loadTemplates() // Refresh list
        alert('✅ Template deleted successfully!')
      } catch (error) {
        console.error('Delete failed:', error)
        alert('❌ Failed to delete template. Check console for details.')
      }
    }
  }

  /**
   * Handle template preview with detailed analysis
   */
  const handlePreviewTemplate = (template: any) => {
    setPreviewTemplate(template)
    setShowPreview(true)
  }

  /**
   * Handle template customization
   */
  const handleCustomizeTemplate = (template: any) => {
    setPreviewTemplate(template)
    setShowCustomizer(true)
    setShowPreview(false)
  }

  /**
   * Handle dry run validation
   */
  const handleDryRun = async (template: any) => {
    try {
      const result = await window.electronAPI.template.validate({
        templateId: template.id,
        context: {},
        dryRun: true
      })
      
      if (result.valid) {
        alert('✅ Template validation successful! All resources are valid.')
      } else {
        alert(`❌ Template validation failed:\n${result.errors.join('\n')}`)
      }
    } catch (error) {
      console.error('Dry run failed:', error)
      alert('❌ Dry run failed. Check console for details.')
    }
  }

  /**
   * Handle template packaging to OCI
   */
  const handlePackageToOCI = async (template: any) => {
    try {
      const result = await window.electronAPI.template.packageToOCI({
        templateId: template.id,
        registry: 'your-registry.com',
        repository: `templates/${template.name.toLowerCase()}`,
        tag: template.metadata?.version || '1.0.0'
      })
      
      alert(`📦 Template packaged successfully!\nOCI Reference: ${result.reference}`)
    } catch (error) {
      console.error('OCI packaging failed:', error)
      alert('❌ OCI packaging failed. Check console for details.')
    }
  }

  /**
   * Filter templates by type
   */
  const filteredTemplates = templates.filter(template => {
    if (filterType === 'all') return true
    return template.templateType === filterType
  })

  /**
   * Handle template usage - select template and close modal
   */
  const handleUseTemplate = (template: any) => {
    onTemplateSelect?.(template)
    setShowPreview(false)
    setShowCustomizer(false)
  }

  /**
   * Handle template save - refresh list and close modal
   */
  const handleSaveTemplate = (template: any) => {
    loadTemplates() // Refresh list after saving
    setShowCustomizer(false)
    setShowPreview(false)
    alert('✅ Template saved successfully!')
  }
  
  
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Enhanced Header with Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Template Library</h2>
            <p className="text-muted-foreground">
              Manage and deploy your infrastructure templates
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={loadTemplates} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh template list</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} 
                  variant="outline" 
                  size="sm"
                >
                  {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Switch to {viewMode === 'grid' ? 'list' : 'grid'} view</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleImportTemplate} className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import Template
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import a .cpt template file from your computer</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Enhanced Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search templates by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="kubernetes">Kubernetes</option>
              <option value="helm">Helm</option>
              <option value="kustomize">Kustomize</option>
              <option value="terraform">Terraform</option>
            </select>
          </div>
        </div>

        {/* Template Grid/List */}
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {filteredTemplates.map((template: any) => (
            <Card key={template.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate text-lg font-semibold">{template.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {template.templateType || 'kubernetes'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
                  {template.description || 'No description available'}
                </p>
                
                {/* Enhanced Resource Summary - Now Clickable */}
                <div 
                  className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handlePreviewTemplate(template)}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">
                      {template.resources?.length || 0}
                    </div>
                    <div className="text-xs text-gray-500">Resources</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">
                      {template.resources?.reduce((sum: number, r: any) => 
                        sum + (r.selectedFields?.filter((f: any) => f.required)?.length || 0), 0) || 0}
                    </div>
                    <div className="text-xs text-gray-500">Required Fields</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-purple-600">
                      {template.resources?.reduce((sum: number, r: any) => sum + (r.selectedFields?.length || 0), 0) || 0}
                    </div>
                    <div className="text-xs text-gray-500">Total Fields</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-600">
                      {template.metadata?.version || '1.0.0'}
                    </div>
                    <div className="text-xs text-gray-500">Version</div>
                  </div>
                </div>

                {/* Primary Actions */}
                {/* Secondary Actions */}
                <div className="grid grid-cols-4 gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCustomizeTemplate(template)}
                        className="text-xs"
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Customize template fields and properties</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePackageToOCI(template)}
                        className="text-xs"
                      >
                        <Package className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Package template as Helm chart and push to OCI registry</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportTemplate(template)}
                        className="text-xs"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export template as .cpt file</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTemplate(template)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete template permanently</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading templates...</p>
            <p className="text-sm text-gray-500">This may take a few moments</p>
          </div>
        )}

        {/* Enhanced Empty State */}
        {!loading && filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery || filterType !== 'all' ? 'No matching templates' : 'No templates found'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by importing your first template or creating a new one'
              }
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleImportTemplate} className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Template
              </Button>
              {(searchQuery || filterType !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('')
                    setFilterType('all')
                    loadTemplates()
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Template Preview Modal */}
        {/* {showPreview && previewTemplate && (
          <EnhancedTemplatePreview
            template={previewTemplate}
            onClose={() => setShowPreview(false)}
            onUse={(template) => {
              onTemplateSelect?.(template)
              setShowPreview(false)
            }}
            onCustomize={handleCustomizeTemplate}
            onDryRun={handleDryRun}
          />
        )} */}

        {/* Unified Template View Modal */}
        {(showPreview || showCustomizer) && previewTemplate && (
          <UnifiedTemplateView
            template={previewTemplate}
            mode={showCustomizer ? 'edit' : 'preview'}
            onClose={() => {
              setShowPreview(false)
              setShowCustomizer(false)
            }}
            onUse={(template) => {
              onTemplateSelect?.(template)
              setShowPreview(false)
              setShowCustomizer(false)
            }}
            onSave={(template) => {
              loadTemplates() // Refresh list after saving
              setShowCustomizer(false)
              setShowPreview(false)
              alert('✅ Template saved successfully!')
            }}
            onDryRun={handleDryRun}
          />
        )}

        {/* YAML-Enabled Template View Modal */}
{/* {(showPreview || showCustomizer) && previewTemplate && (
  <YamlEnabledTemplateView
    template={previewTemplate}
    isOpen={showPreview || showCustomizer}
    onClose={() => {
      setShowPreview(false)
      setShowCustomizer(false)
      setPreviewTemplate(null)
    }}
    onUse={handleUseTemplate}
    onSave={handleSaveTemplate}
    onDryRun={handleDryRun}
    mode={showCustomizer ? 'edit' : 'preview'}
  />
)} */}

        {/* Template Customizer Modal */}
        {showCustomizer && previewTemplate && (
          <TemplateCustomizer
            template={previewTemplate}
            onClose={() => setShowCustomizer(false)}
            onSave={(customizedTemplate) => {
              loadTemplates() // Refresh list after saving
              setShowCustomizer(false)
              alert('✅ Customized template saved successfully!')
            }}
          />
        )}
      </div>
    </TooltipProvider>
  )
}