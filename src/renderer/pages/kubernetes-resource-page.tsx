import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/renderer/components/ui/alert'
import { 
  Plus, 
  FileText, 
  Folder, 
  Search, 
  Filter,
  GitBranch,
  Upload,
  Download,
  Trash2,
  Edit,
  Eye
} from 'lucide-react'
import { KubernetesResourceCreator } from '@/renderer/components/kubernetes-resource-creator'
import type { ContextData } from '@/shared/types/context-data'
import type { SettingsData } from '@/shared/types/settings-data'
import type { ContextAwareKubernetesResource } from '@/shared/types/kubernetes'
import { contextNamingService } from '@/renderer/services/context-naming-service'
import yaml from 'js-yaml'
import { KubernetesVersionSelector } from '@/renderer/components/kubernetes-version-selector'
import { joinPath } from '@/renderer/lib/path-utils'

interface KubernetesResourcePageProps {
  context: ContextData
  settings: SettingsData
}

interface SavedResource {
  id: string
  name: string
  kind: string
  namespace: string
  filePath: string
  lastModified: Date
  content: ContextAwareKubernetesResource
}

export function KubernetesResourcePage({ context, settings }: KubernetesResourcePageProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create')
  const [savedResources, setSavedResources] = useState<SavedResource[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKind, setSelectedKind] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Add version state
  const [selectedK8sVersion, setSelectedK8sVersion] = useState<string>(() => {
    return localStorage.getItem('kubernetes-selected-version') || 'v1.27.0'
  })

  // Add state for version information
  const [versionInfo, setVersionInfo] = useState<{
    availableVersions: number
    localVersions: number
  }>({ availableVersions: 0, localVersions: 0 })

  // Add userDataDir state
  const [userDataDir, setUserDataDir] = useState<string>('')

  const safeJoinPath = (...segments: (string | undefined | null)[]): string => {
    return joinPath(...segments.map(segment => segment || ''))
  }

  // Load user data directory
  useEffect(() => {
    const loadUserDataDir = async () => {
      try {
        const dataDir = await window.electronAPI.getUserDataPath()
        setUserDataDir(dataDir)
      } catch (error) {
        console.error('Failed to get user data directory:', error)
      }
    }
    loadUserDataDir()
  }, [])

  // Load saved resources on mount and context change
  useEffect(() => {
    loadSavedResources()
  }, [context])

  const loadSavedResources = async () => {
    setIsLoading(true)
    try {
      // Use the joinPath utility for proper OS path separators
      // Use the joinPath utility for proper OS path separators
      const basePath = joinPath(
        settings.baseDirectory || '',
        'k8s-resources',
        context.product || '',
        context.customer || '',
        context.environment || '',
        context.instance || ''
      )
      
      // Mock implementation - in real app, this would use IPC to scan filesystem
      const mockResources: SavedResource[] = [
        {
          id: '1',
          name: `${context.product}-${context.customer}-${context.environment}-deployment`,
          kind: 'Deployment',
          namespace: `${context.customer}-${context.environment}`,
          filePath: `${basePath}/deployment.yaml`,
          lastModified: new Date(),
          content: {} as ContextAwareKubernetesResource
        }
      ]
      
      setSavedResources(mockResources)
    } catch (error) {
      console.error('Error loading saved resources:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveResource = async (
    resource: ContextAwareKubernetesResource, 
    filePath: string
  ) => {
    try {
      const yamlContent = yaml.dump(resource, { 
        indent: 2, 
        lineWidth: -1,
        noRefs: true 
      })

      // Use Electron IPC to save file
      const fullPath = `${settings.baseDirectory}/${filePath}`
      
      // This would call the main process to save the file
      await window.electronAPI.saveFile({
        filePath: fullPath,
        content: yamlContent,
        createDirectories: true
      })

      // Refresh the saved resources list
      await loadSavedResources()
      
      // Switch to manage tab to show the saved resource
      setActiveTab('manage')
      
      console.log('Resource saved successfully:', fullPath)
    } catch (error) {
      console.error('Error saving resource:', error)
      throw error
    }
  }

  const handleDeleteResource = async (resource: SavedResource) => {
    try {
      // This would call the main process to delete the file
      await window.electronAPI.deleteFile(resource.filePath)
      await loadSavedResources()
    } catch (error) {
      console.error('Error deleting resource:', error)
    }
  }

  const filteredResources = savedResources.filter(resource => {
    const matchesSearch = resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.kind.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesKind = !selectedKind || resource.kind === selectedKind
    return matchesSearch && matchesKind
  })

  const uniqueKinds = Array.from(new Set(savedResources.map(r => r.kind)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kubernetes Resources</h1>
          <p className="text-muted-foreground">
            Create and manage Kubernetes resources for {context.product} - {context.customer} - {context.environment}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Context: {context.customer}/{context.environment}/{context.instance}
          </Badge>
        </div>
      </div>

      {/* Context Info */}
      <Card>
        <CardContent className="pt-6">
          {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Product:</span>
              <div className="text-muted-foreground">{context.product}</div>
            </div>
            <div>
              <span className="font-medium">Customer:</span>
              <div className="text-muted-foreground">{context.customer}</div>
            </div>
            <div>
              <span className="font-medium">Environment:</span>
              <div className="text-muted-foreground">{context.environment}</div>
            </div>
            <div>
              <span className="font-medium">Base Directory:</span>
              <div className="text-muted-foreground font-mono text-xs">
                {settings.baseDirectory}/k8s-resources/{context.product}/{context.customer}/{context.environment}/{context.instance}
              </div>
            </div>
          </div> */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Available versions: {versionInfo.availableVersions}</p>
              <p>Downloaded versions: {versionInfo.localVersions}</p>
              {userDataDir && (
                <p className="text-xs">Schema directory: {joinPath(userDataDir, 'schemas')}</p>
              )}
                            {userDataDir && (
                <p className="text-xs">Schema directory: {joinPath(userDataDir, 'schemas')}</p>
              )}
<p className="text-xs">
                Resource directory: {safeJoinPath(
                  settings.baseDirectory,
                  'k8s-resources',
                  context.product,
                  context.customer,
                  context.environment,
                  context.instance
                )}
              </p>
            </div>

        </CardContent>
      </Card>

      {/* Add Version Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Schema Configuration</CardTitle>
        </CardHeader>
        <CardContent>
        <KubernetesVersionSelector
                  selectedVersion={selectedK8sVersion}
                  onVersionChange={setSelectedK8sVersion}
                  onVersionInfoChange={setVersionInfo}
                />
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'create' | 'manage')}>
        <TabsList>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Resource
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Manage Resources ({savedResources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <KubernetesResourceCreator
            context={context}
            settings={settings}
            k8sVersion={selectedK8sVersion}
            onSave={handleSaveResource}
          />
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <div className="space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search resources..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedKind}
                      onChange={(e) => setSelectedKind(e.target.value)}
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">All Types</option>
                      {uniqueKinds.map(kind => (
                        <option key={kind} value={kind}>{kind}</option>
                      ))}
                    </select>
                  </div>
                  
                  <Button variant="outline" size="sm" onClick={loadSavedResources}>
                    <FileText className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resources List */}
            <div className="grid gap-4">
              {filteredResources.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-muted-foreground">
                      {savedResources.length === 0 
                        ? 'No resources found. Create your first resource using the Create tab.'
                        : 'No resources match your search criteria.'
                      }
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredResources.map((resource) => (
                  <Card key={resource.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{resource.name}</h3>
                              <Badge variant="secondary">{resource.kind}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Namespace: {resource.namespace} • Modified: {resource.lastModified.toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-1">
                              {resource.filePath}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            <GitBranch className="h-4 w-4" />
                            Commit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteResource(resource)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}