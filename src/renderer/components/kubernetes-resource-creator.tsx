import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Alert, AlertDescription } from '@/renderer/components/ui/alert'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Separator } from '@/renderer/components/ui/separator'
import { Save, FileText, Code, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import yaml from 'js-yaml'
import CodeMirror from '@uiw/react-codemirror'
import { yaml as yamlLanguage } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ContextData } from '@/shared/types/context-data'
import type { SettingsData } from '@/shared/types/settings-data'
import type { 
  KubernetesResourceTemplate, 
  KubernetesResourceFormData,
  ContextAwareKubernetesResource 
} from '@/shared/types/kubernetes'
import { KUBERNETES_RESOURCE_TEMPLATES } from '@/shared/types/kubernetes'
import { contextNamingService } from '@/renderer/services/context-naming-service'
import { kubernetesSchemaService } from '@/renderer/services/kubernetes-schema-service'

interface KubernetesResourceCreatorProps {
  context: ContextData
  settings: SettingsData
  k8sVersion?: string // Add version prop
  onSave?: (resource: ContextAwareKubernetesResource, filePath: string) => Promise<void>
}

export function KubernetesResourceCreator({ 
  context, 
  settings,
  k8sVersion = 'v1.27.0', // Default version
  onSave 
}: KubernetesResourceCreatorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<KubernetesResourceTemplate | null>(null)
  const [formData, setFormData] = useState<KubernetesResourceFormData>({
    kind: '',
    apiVersion: '',
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
    spec: {}
  })
  const [yamlContent, setYamlContent] = useState('')
  const [activeTab, setActiveTab] = useState<'form' | 'yaml'>('form')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentSchema, setCurrentSchema] = useState<any>(null)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  
  // Add userDataDir state
  const [userDataDir, setUserDataDir] = useState<string>('')
  
  // Get the proper user data directory
  useEffect(() => {
    const getUserDataDir = async () => {
      try {
        const dataDir = await window.electronAPI.getUserDataPath()
        setUserDataDir(dataDir)
      } catch (error) {
        console.error('Failed to get user data directory:', error)
        // Fallback to settings.baseDirectory if needed
        setUserDataDir(settings.baseDirectory)
      }
    }
    getUserDataDir()
  }, [])

  // Initialize form when template or context changes
  useEffect(() => {
    if (selectedTemplate) {
      initializeForm(selectedTemplate)
    }
  }, [selectedTemplate, context])

  // Sync form data to YAML when form changes
  useEffect(() => {
    if (activeTab === 'yaml' && selectedTemplate) {
      syncFormToYaml()
    }
  }, [formData, activeTab, selectedTemplate])

  // Load schema when template changes
  useEffect(() => {
    if (selectedTemplate) {
      loadSchema(selectedTemplate.kind, selectedTemplate.apiVersion)
    }
  }, [selectedTemplate, k8sVersion])

  // Use the k8sVersion when fetching schemas
  // Use the k8sVersion when fetching schemas
  const loadSchema = async (kind: string, apiVersion: string) => {
    setIsLoadingSchema(true)
    try {
      const schema = await kubernetesSchemaService.getSchema(kind, apiVersion, k8sVersion, userDataDir)
      setCurrentSchema(schema)
    } catch (error) {
      console.error('Failed to load schema:', error)
    } finally {
      setIsLoadingSchema(false)
    }
  }
    
  const initializeForm = (template: KubernetesResourceTemplate) => {
    const generatedName = contextNamingService.generateResourceName(
      context, 
      template.kind
    )
    const generatedNamespace = contextNamingService.generateNamespace(context)
    const generatedLabels = {
      ...contextNamingService.generateLabels(context),
      ...Object.fromEntries(
        Object.entries(template.contextFields.defaultLabels).map(([key, value]) => [
          key,
          contextNamingService.interpolatePattern(value, context)
        ])
      )
    }

    setFormData({
      kind: template.kind,
      apiVersion: template.apiVersion,
      name: generatedName,
      namespace: generatedNamespace,
      labels: generatedLabels,
      annotations: {
        'configpilot.io/created-by': 'kubernetes-resource-creator',
        'configpilot.io/created-at': new Date().toISOString()
      },
      spec: { ...template.defaultSpec }
    })
  }

  const syncFormToYaml = () => {
    const resource: ContextAwareKubernetesResource = {
      apiVersion: formData.apiVersion,
      kind: formData.kind,
      metadata: {
        name: formData.name,
        namespace: formData.namespace,
        labels: formData.labels,
        annotations: formData.annotations
      },
      spec: formData.spec
    }

    try {
      const yamlStr = yaml.dump(resource, { 
        indent: 2, 
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      })
      setYamlContent(yamlStr)
    } catch (error) {
      console.error('Error converting to YAML:', error)
    }
  }

  const syncYamlToForm = () => {
    try {
      const resource = yaml.load(yamlContent) as ContextAwareKubernetesResource
      setFormData({
        kind: resource.kind,
        apiVersion: resource.apiVersion,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace || '',
        labels: resource.metadata.labels || {},
        annotations: resource.metadata.annotations || {},
        spec: resource.spec || {}
      })
    } catch (error) {
      console.error('Error parsing YAML:', error)
      setValidationErrors(['Invalid YAML format'])
    }
  }

  const validateResource = useCallback(async () => {
    if (!selectedTemplate) return

    setIsValidating(true)
    try {
      const result = await kubernetesSchemaService.validateResource(
        { ...formData, metadata: { name: formData.name, namespace: formData.namespace, labels: formData.labels } },
        selectedTemplate
      )
      setValidationErrors(result.errors)
    } catch (error) {
      setValidationErrors(['Validation failed: ' + (error as Error).message])
    } finally {
      setIsValidating(false)
    }
  }, [formData, selectedTemplate])

  const handleSave = async () => {
    if (!selectedTemplate || !onSave) return

    setIsSaving(true)
    try {
      await validateResource()
      
      if (validationErrors.length > 0) {
        return
      }

      const resource: ContextAwareKubernetesResource = {
        apiVersion: formData.apiVersion,
        kind: formData.kind,
        metadata: {
          name: formData.name,
          namespace: formData.namespace,
          labels: formData.labels,
          annotations: formData.annotations
        },
        spec: formData.spec
      }

      const filePath = contextNamingService.generateFilePath(
        context, 
        selectedTemplate.kind,
        formData.name
      )

      await onSave(resource, filePath)
    } catch (error) {
      console.error('Error saving resource:', error)
      setValidationErrors(['Save failed: ' + (error as Error).message])
    } finally {
      setIsSaving(false)
    }
  }

  const renderFormFields = () => {
    if (!selectedTemplate) return null

    return (
      <div className="space-y-6">
        {/* Basic Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Resource Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter resource name"
                />
              </div>
              <div>
                <Label htmlFor="namespace">Namespace</Label>
                <Input
                  id="namespace"
                  value={formData.namespace}
                  onChange={(e) => setFormData(prev => ({ ...prev, namespace: e.target.value }))}
                  placeholder="Enter namespace"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Labels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Labels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(formData.labels).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {key}: {value}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spec Fields - This would be dynamically generated based on schema */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Specification</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={JSON.stringify(formData.spec, null, 2)}
              onChange={(e) => {
                try {
                  const spec = JSON.parse(e.target.value)
                  setFormData(prev => ({ ...prev, spec }))
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              className="font-mono text-sm"
              rows={10}
              placeholder="Enter resource specification as JSON"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Create Kubernetes Resource</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template">Resource Type</Label>
              <Select
                value={selectedTemplate?.kind || ''}
                onValueChange={(value) => {
                  const template = KUBERNETES_RESOURCE_TEMPLATES.find(t => t.kind === value)
                  setSelectedTemplate(template || null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a resource type" />
                </SelectTrigger>
                <SelectContent>
                  {KUBERNETES_RESOURCE_TEMPLATES.map((template) => (
                    <SelectItem key={template.kind} value={template.kind}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                        <span>{template.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedTemplate && (
              <div className="text-sm text-muted-foreground">
                {selectedTemplate.description}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <>
          {/* Validation Status */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validationErrors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Form/YAML Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => {
            if (value === 'yaml' && activeTab === 'form') {
              syncFormToYaml()
            } else if (value === 'form' && activeTab === 'yaml') {
              syncYamlToForm()
            }
            setActiveTab(value as 'form' | 'yaml')
          }}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="form" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Form Editor
                </TabsTrigger>
                <TabsTrigger value="yaml" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  YAML Editor
                </TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={validateResource}
                  disabled={isValidating}
                >
                  {isValidating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Validate
                </Button>
                
                <Button
                  onClick={handleSave}
                  disabled={isSaving || validationErrors.length > 0}
                  className="flex items-center gap-2"
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Resource
                </Button>
              </div>
            </div>

            <TabsContent value="form" className="mt-6">
              <ScrollArea className="h-[600px]">
                {renderFormFields()}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="yaml" className="mt-6">
              <Card>
                <CardContent className="p-0">
                  <CodeMirror
                    value={yamlContent}
                    onChange={setYamlContent}
                    extensions={[yamlLanguage()]}
                    theme={settings.darkMode ? oneDark : undefined}
                    className="text-sm"
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      dropCursor: false,
                      allowMultipleSelections: false,
                      indentOnInput: true,
                      bracketMatching: true,
                      closeBrackets: true,
                      autocompletion: true,
                      highlightSelectionMatches: false,
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}