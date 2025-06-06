import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
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
import KubernetesSchemaEditor from '@/renderer/components/kubernetes-schema-editor'

import type { ContextData } from '@/shared/types/context-data'
import type { SettingsData } from '@/shared/types/settings-data'
import type { ContextAwareKubernetesResource } from '@/shared/types/kubernetes'
import yaml from 'js-yaml'
import { joinPath } from '@/renderer/lib/path-utils'
import { CRDManagementComponent } from "@/renderer/components/crd-management"

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
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'crd'>('create')
  const [savedResources, setSavedResources] = useState<SavedResource[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKind, setSelectedKind] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const selectedK8sVersion = settings.kubernetesVersion || 'v1.31.0'

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

  // Memoize the context-dependent values to prevent unnecessary re-runs
const contextKey = useMemo(() => {
  return `${context.product}-${context.customer}-${context.environment}-${context.instance}`
}, [context.product, context.customer, context.environment, context.instance])

  // Load saved resources on mount and context change
  useEffect(() => {
    loadSavedResources()
  }, [contextKey])

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

  const handleSaveResource = useCallback(async (content: string, resourceType: string) => {
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
  }, []);

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

  // Add this handler alongside the existing handleSaveResource
  const handleSaveResourceV2 = useCallback(async (content: string, resourceType: string) => {
    try {
      // Parse the YAML content to get resource details
      const parsedResource = yaml.load(content) as any

      if (!parsedResource || !parsedResource.metadata?.name) {
        throw new Error('Invalid resource: missing metadata.name')
      }

      // Create the resource object in the expected format
      const resource: ContextAwareKubernetesResource = {
        ...parsedResource,
        context: {
          product: context.product,
          customer: context.customer,
          environment: context.environment,
          version: selectedK8sVersion
        }
      }

      // Generate file path
      const fileName = `${parsedResource.metadata.name}-${resourceType.toLowerCase()}.yaml`
      const filePath = safeJoinPath(
        settings.baseDirectory || '',
        'k8s-resources',
        context.product || '',
        context.customer || '',
        context.environment || '',
        fileName
      )

      // Save the resource
      await handleSaveResource(resource, filePath)

    } catch (error) {
      console.error('Error saving resource:', error)
      // Handle error appropriately
    }
  }, [context, selectedK8sVersion, settings, handleSaveResource])

  const memoizedContext = useMemo(() => context, [contextKey])
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kubernetes Resources</h1>
          <p className="text-muted-foreground">
            Create and manage Kubernetes resources for {context.product} - {context.customer} - {context.environment}
          </p>
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

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Context: {context.customer}/{context.environment}/{context.instance}
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'create' | 'manage' | 'crd')}>
      <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Create Resources</TabsTrigger>
          <TabsTrigger value="manage">Manage Resources</TabsTrigger>
          <TabsTrigger value="crd">CRD Management</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          {/* Resource Creator Components */}
          <Tabs defaultValue="v2" className="w-full">
            <TabsContent value="v2">
              <KubernetesSchemaEditor
                  context={context}
                  k8sVersion={selectedK8sVersion}
                  onSave={handleSaveResourceV2}
                  onClose={() => setShowResourceCreatorV2(false)}
                />              
            </TabsContent>
          </Tabs>
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

        <TabsContent value="crd" className="mt-6">
          <CRDManagementComponent context={context} />
        </TabsContent>
                
      </Tabs>
    </div>
  )
}