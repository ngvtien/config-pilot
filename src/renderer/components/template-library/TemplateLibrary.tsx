import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import { Settings, Play, Search, Download, Upload, Trash2, Eye, Package, RefreshCw, Filter, Grid, List, Plus } from 'lucide-react'
import { EnhancedTemplatePreview } from './EnhancedTemplatePreview'
//import { TemplateCustomizer } from './TemplateCustomizer'
import { UnifiedTemplateView } from './UnifiedTemplateView'
import { TemplateCreator } from './TemplateCreator'
import { toast } from '@/renderer/hooks/use-toast'
import { useDialog } from '../../hooks/useDialog';
import { Alert, ModalAlert } from '../ui/Alert';
import { Confirm } from '../ui/Confirm';

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
 * - Create new template functionality
 */
export function TemplateLibrary({ onTemplateSelect, onTemplateImport }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  //const [showCustomizer, setShowCustomizer] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterType, setFilterType] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm
  } = useDialog();

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
      toast({
        variant: 'destructive',
        title: 'Loading Failed',
        description: 'Failed to load templates. Please try again.'
      })
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
        toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: 'Failed to search templates. Please try again.'
        })
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
        toast({
          title: 'Import Successful',
          description: 'Template imported successfully!'
        })
      }
    } catch (error) {
      console.error('Import failed:', error)
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'Failed to import template. Please check the file format.'
      })
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
        toast({
          title: 'Export Successful',
          description: 'Template exported successfully!'
        })
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Failed to export template. Please try again.'
      })
    }
  }

  /**
   * Handle template deletion with confirmation using React dialog
   */
  const handleDeleteTemplate = async (template: any) => {
    showConfirm({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.name}"?\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await window.electronAPI.template.delete(template.id);
          
          // Reset all modal-related state after successful deletion
          setShowPreview(false);
          setPreviewTemplate(null);
          setShowCreateModal(false);
          setSearchQuery('');
          setFilterType('all');          
          await loadTemplates(); // Refresh list
        } catch (error) {
          console.error('Delete failed:', error);
          showAlert({
            title: 'Error',
            message: 'Failed to delete template. Please try again.',
            variant: 'error'
          });
        }
      }
    })
  }

  /**
   * Handle template preview with detailed analysis
   */
  const handlePreviewTemplate = (template: any) => {
    setPreviewTemplate(template)
    setShowPreview(true)
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
        toast({
          title: 'Validation Successful',
          description: 'Template validation successful! All resources are valid.'
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Validation Failed',
          description: `Template validation failed: ${result.errors.join(', ')}`
        })
      }
    } catch (error) {
      console.error('Dry run failed:', error)
      toast({
        variant: 'destructive',
        title: 'Validation Failed',
        description: 'Dry run failed. Please try again.'
      })
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

      toast({
        title: 'Package Successful',
        description: `Template packaged successfully! OCI Reference: ${result.reference}`
      })
    } catch (error) {
      console.error('OCI packaging failed:', error)
      toast({
        variant: 'destructive',
        title: 'Package Failed',
        description: 'OCI packaging failed. Please try again.'
      })
    }
  }

  /**
   * Handle new template creation
   */
  const handleCreateTemplate = (newTemplate: any) => {
    // After creating, open it in edit mode
    setPreviewTemplate(newTemplate)
    //setShowCustomizer(false)
    setShowPreview(true)
    loadTemplates() // Refresh the list
  }

  /**
   * Filter templates by type
   */
  const filteredTemplates = templates.filter(template => {
    if (filterType === 'all') return true
    return template.templateType === filterType
  })

  /**
   * Handle template save with immediate refresh
   */
  const handleSaveTemplate = async (template: any) => {
    try {
      // Save the template
      await window.electronAPI.template.save(template)
      
      // Immediately refresh the template list
      await loadTemplates()
      
      toast({
        title: 'Template Saved',
        description: 'Template saved successfully!'
      })
    } catch (error) {
      console.error('Failed to save template:', error)
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Failed to save template. Please try again.'
      })
    }
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
                <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Template
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new template from scratch</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleImportTemplate} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Import
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
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          : "space-y-4"
        }>
          {filteredTemplates.map((template: any) => (
            <Card key={template.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle 
                  className="flex items-center justify-between cursor-pointer hover:text-blue-600 transition-colors" 
                  onClick={() => handlePreviewTemplate(template)}
                >
                  <span className="truncate text-lg font-semibold">{template.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {template.templateType || 'kubernetes'}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm cursor-pointer text-gray-600 dark:text-gray-300 line-clamp-2 min-h-[2.5rem]" onClick={() => handlePreviewTemplate(template)}>
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

                {/* Secondary Actions */}
                <div className="grid grid-cols-3 gap-1">
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
                        <Upload className="h-3 w-3" />
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
                : 'Get started by creating your first template or importing an existing one'
              }
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
              <Button onClick={handleImportTemplate} variant="outline" className="flex items-center gap-2">
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

        {/* Template Creator Modal */}
        <TemplateCreator
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTemplate}
        />

        {/* Unified Template View Modal */}
        {(showPreview) && previewTemplate && (
          <UnifiedTemplateView
            template={previewTemplate}
            mode={'preview'}
            onClose={() => {
              setShowPreview(false)
            }}
            onUse={(template) => {
              onTemplateSelect?.(template)
              setShowPreview(false)
            }}
            onSave={handleSaveTemplate}
            onDryRun={handleDryRun}
          />
        )}

        <ModalAlert
          isOpen={alertState.isOpen}
          title={alertState.title}
          message={alertState.message}
          variant={alertState.variant}
          onClose={closeAlert}
        />

        <Confirm
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          variant={confirmState.variant}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        />

      </div>
    </TooltipProvider>
  )
}