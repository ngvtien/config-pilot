import { useState, useEffect } from 'react'
import { kubernetesSchemaIndexer } from '@/renderer/services/kubernetes-schema-indexer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Input } from '@/renderer/components/ui/input'
import { Badge } from '@/renderer/components/ui/badge'
import { joinPath } from '@/renderer/lib/path-utils'

interface KubernetesResourceSelectorProps {
  onSchemaSelect: (schema: any, resourceInfo: any) => void
  schemaVersion: string
}

export function KubernetesResourceSelector({ onSchemaSelect, schemaVersion }: KubernetesResourceSelectorProps) {
  const [availableKinds, setAvailableKinds] = useState<string[]>([])
  const [selectedKind, setSelectedKind] = useState<string>('')
  const [kindVersions, setKindVersions] = useState<any[]>([])
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadSchemaIndex()
  }, [schemaVersion])

  useEffect(() => {
    if (searchTerm.trim()) {
      const results = kubernetesSchemaIndexer.searchResources(searchTerm)
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }, [searchTerm])

  const loadSchemaIndex = async () => {
    setIsLoading(true)
    try {
      const userDataDir = await window.electronAPI.getUserDataPath()
      const definitionsPath = joinPath(userDataDir, 'schemas', 'k8s', schemaVersion, '_definitions.json');
      
      await kubernetesSchemaIndexer.loadSchemaDefinitions(definitionsPath)
      const kinds = kubernetesSchemaIndexer.getAvailableKinds()
      setAvailableKinds(kinds)
    } catch (error) {
      console.error('Failed to load schema index:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKindSelect = async (kind: string) => {
    setSelectedKind(kind)
    const versions = await kubernetesSchemaIndexer.getKindVersions(kind)
    setKindVersions(versions)
    setSelectedResource(null)
  }

  const handleResourceSelect = async (resource: any) => {
    setSelectedResource(resource)

    // Get the schema properties specifically for form generation
    const schemaProperties = await kubernetesSchemaIndexer.getSchemaProperties(
        resource.group,
        resource.version,
        resource.kind
      )
      
    // Also get the full resolved schema if needed
    const fullSchema = await kubernetesSchemaIndexer.getResolvedSchema(
        resource.group,
        resource.version,
        resource.kind
      )
    
      onSchemaSelect({
        properties: schemaProperties,
        fullSchema: fullSchema,
        resourceInfo: resource
      }, resource)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <Input
          placeholder="Search for Kubernetes resources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
            {searchResults.map((resource, index) => (
              <div
                key={index}
                className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                onClick={() => handleResourceSelect(resource)}
              >
                <div className="font-medium">{resource.displayName}</div>
                <div className="text-sm text-gray-600">{resource.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kind Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Resource Kind</label>
        <Select value={selectedKind} onValueChange={handleKindSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select a resource kind" />
          </SelectTrigger>
          <SelectContent>
            {availableKinds.map(kind => (
              <SelectItem key={kind} value={kind}>{kind}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Version Selection */}
      {kindVersions.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">API Version</label>
          <div className="space-y-2">
            {kindVersions.map((resource, index) => (
              <div
                key={index}
                className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                  selectedResource?.key === resource.key ? 'border-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => handleResourceSelect(resource)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{resource.displayName}</div>
                    <div className="text-sm text-gray-600">{resource.key}</div>
                  </div>
                  <Badge variant="outline">
                    {resource.group}/{resource.version}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}