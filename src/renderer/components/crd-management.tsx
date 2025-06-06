import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/renderer/components/ui/select'
import {
  Plus,
  Upload,
  Download,
  Trash2,
  Search,
  RefreshCw,
  FileText,
  Globe,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { Alert, AlertDescription } from '@/renderer/components/ui/alert'
import type { ContextData } from '@/shared/types/context-data'
import type { CRDSchema, CRDImportRequest } from '@/shared/types/kubernetes'
import yaml from 'js-yaml'

interface CRDManagementComponentProps {
  context: ContextData
}

interface GroupedCRDs {
  [group: string]: CRDSchema[]
}

export function CRDManagementComponent({ context }: CRDManagementComponentProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'manage' | 'discover'>('import')
  const [importedCRDs, setImportedCRDs] = useState<CRDSchema[]>([])
  const [groupedCRDs, setGroupedCRDs] = useState<GroupedCRDs>({})
  const [discoveredCRDs, setDiscoveredCRDs] = useState<CRDSchema[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importMethod, setImportMethod] = useState<'yaml' | 'url' | 'file'>('yaml')
  const [importContent, setImportContent] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [validationResult, setValidationResult] = useState<any>(null)

  useEffect(() => {
    loadImportedCRDs()
  }, [])

  const loadImportedCRDs = async () => {
    try {
      setIsLoading(true)
      const [crds, grouped] = await Promise.all([
        window.electronAPI.crd.list(),
        window.electronAPI.crd.listByGroup()
      ])
      setImportedCRDs(crds)
      setGroupedCRDs(grouped)
    } catch (error) {
      console.error('Failed to load CRDs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportCRD = async () => {
    try {
      setIsLoading(true)
      
      const request: CRDImportRequest = {
        method: importMethod,
        content: importMethod === 'yaml' ? importContent : undefined,
        url: importMethod === 'url' ? importUrl : undefined,
        filePath: importMethod === 'file' ? importContent : undefined, // For file, content would be the path
        context: {
          product: context.product,
          customer: context.customer,
          environment: context.environment
        }
      }

      const result = await window.electronAPI.crd.import(request)
      
      if (result.success) {
        setImportDialogOpen(false)
        setImportContent('')
        setImportUrl('')
        await loadImportedCRDs()
      } else {
        console.error('Import failed:', result.error)
      }
    } catch (error) {
      console.error('Failed to import CRD:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleValidateCRD = async () => {
    try {
      if (!importContent) return
      
      const crdDefinition = yaml.load(importContent)
      const result = await window.electronAPI.crd.validate(crdDefinition)
      setValidationResult(result)
    } catch (error) {
      setValidationResult({ valid: false, errors: [error.message] })
    }
  }

  const handleDiscoverCRDs = async () => {
    try {
      setIsLoading(true)
      const discovered = await window.electronAPI.crd.discover()
      setDiscoveredCRDs(discovered)
    } catch (error) {
      console.error('Failed to discover CRDs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCRD = async (id: string) => {
    try {
      await window.electronAPI.crd.delete(id)
      await loadImportedCRDs()
    } catch (error) {
      console.error('Failed to delete CRD:', error)
    }
  }

  const filteredCRDs = importedCRDs.filter(crd => 
    crd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crd.group.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">CRD Management</h2>
          <p className="text-muted-foreground">
            Import and manage Custom Resource Definitions for enhanced Kubernetes resources
          </p>
        </div>
        
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Import CRD
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Custom Resource Definition</DialogTitle>
              <DialogDescription>
                Import CRDs from YAML content, URL, or file to extend your Kubernetes resources
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Import Method</label>
                <Select value={importMethod} onValueChange={(value: 'yaml' | 'url' | 'file') => setImportMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yaml">YAML Content</SelectItem>
                    <SelectItem value="url">From URL</SelectItem>
                    <SelectItem value="file">From File</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {importMethod === 'yaml' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">CRD YAML Content</label>
                    <Button variant="outline" size="sm" onClick={handleValidateCRD}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Validate
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Paste your CRD YAML definition here..."
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  {validationResult && (
                    <Alert variant={validationResult.valid ? "default" : "destructive"}>
                      {validationResult.valid ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {validationResult.valid 
                          ? "CRD definition is valid" 
                          : `Validation errors: ${validationResult.errors?.join(', ')}`
                        }
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {importMethod === 'url' && (
                <div>
                  <label className="text-sm font-medium">CRD URL</label>
                  <Input
                    placeholder="https://example.com/crd.yaml"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                </div>
              )}

              {importMethod === 'file' && (
                <div>
                  <label className="text-sm font-medium">File Path</label>
                  <Input
                    placeholder="/path/to/crd.yaml"
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImportCRD} disabled={isLoading}>
                  {isLoading ? 'Importing...' : 'Import CRD'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'import' | 'manage' | 'discover')}>
        <TabsList>
          <TabsTrigger value="manage">Imported CRDs ({importedCRDs.length})</TabsTrigger>
          <TabsTrigger value="discover">Discover from Cluster</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search CRDs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" onClick={loadImportedCRDs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {Object.keys(groupedCRDs).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedCRDs).map(([group, crds]) => (
                <Card key={group}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {group || 'Core'}
                      <Badge variant="secondary">{crds.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {crds.filter(crd => 
                        crd.name.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map((crd) => (
                        <div key={crd.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{crd.name}</h4>
                              <Badge variant="outline">{crd.version}</Badge>
                              {crd.scope && (
                                <Badge variant="secondary">{crd.scope}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {crd.description || `${crd.group}/${crd.version}`}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Imported: {new Date(crd.importedAt).toLocaleDateString()}</span>
                              {crd.source && <span>Source: {crd.source}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDeleteCRD(crd.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No CRDs Imported</h3>
                  <p className="text-muted-foreground mb-4">
                    Import Custom Resource Definitions to extend your Kubernetes resources
                  </p>
                  <Button onClick={() => setImportDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Import Your First CRD
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Discover CRDs from Cluster</h3>
              <p className="text-sm text-muted-foreground">
                Scan your connected Kubernetes cluster for existing Custom Resource Definitions
              </p>
            </div>
            <Button onClick={handleDiscoverCRDs} disabled={isLoading}>
              <Globe className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Discovering...' : 'Discover CRDs'}
            </Button>
          </div>

          {discoveredCRDs.length > 0 ? (
            <div className="grid gap-3">
              {discoveredCRDs.map((crd) => (
                <Card key={crd.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{crd.name}</h4>
                          <Badge variant="outline">{crd.version}</Badge>
                          <Badge variant="secondary">{crd.scope}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {crd.group}/{crd.version}
                        </p>
                      </div>
                      <Button size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No CRDs Discovered</h3>
                  <p className="text-muted-foreground mb-4">
                    Click "Discover CRDs" to scan your cluster for Custom Resource Definitions
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}