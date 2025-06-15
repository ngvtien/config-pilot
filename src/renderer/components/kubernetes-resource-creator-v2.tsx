"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Button } from "@/renderer/components/ui/button"
import { Badge } from "@/renderer/components/ui/badge"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { Separator } from "@/renderer/components/ui/separator"
import { Save, FileText, AlertCircle, CheckCircle, RefreshCw } from "lucide-react"
import { KubernetesResourceSelector } from "./kubernetes-resource-selector"
import YamlEditor  from "@/renderer/components/yaml-editor"
import { kubernetesSchemaIndexer } from "@/renderer/services/kubernetes-schema-indexer"
import type { ContextData } from "@/shared/types/context-data"
import yaml from "js-yaml"
import { joinPath } from '@/renderer/lib/path-utils';

interface KubernetesResourceCreatorV2Props {
  context: ContextData
  k8sVersion?: string // Add version prop
  onSave?: (content: string, resourceType: string) => void
  onClose?: () => void
}

interface SelectedResource {
  kind: string
  group?: string
  version: string
  displayName: string
  key: string
}

const KubernetesResourceCreatorV2: React.FC<KubernetesResourceCreatorV2Props> = ({
  context,
  k8sVersion = 'v1.27.0', // Default version
  onSave,
  onClose,
}) => {  
  // State management
  const [selectedResource, setSelectedResource] = useState<SelectedResource | null>(null)
  const [selectedSchema, setSelectedSchema] = useState<any>(null)
  const [yamlContent, setYamlContent] = useState<string>("")
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"selector" | "editor">("selector")
  const [schemaIndexer] = useState(() => kubernetesSchemaIndexer)
  const [isSchemaIndexerReady, setIsSchemaIndexerReady] = useState(false)

  const safeK8sVersion = k8sVersion || 'v1.27.0'

// Debug: Track renders
//const renderCount = useRef(0);
const prevPropsRef = useRef<any>();
//renderCount.current += 1;

// Check what props changed
if (prevPropsRef.current) {
  const propsChanged = {
    context: prevPropsRef.current.context !== context,
    k8sVersion: prevPropsRef.current.k8sVersion !== k8sVersion,
    onSave: prevPropsRef.current.onSave !== onSave,
    onClose: prevPropsRef.current.onClose !== onClose,
  };
  //console.log('Props that changed:', propsChanged);
  // if (propsChanged.context) {
  //   console.log('Context changed from:', prevPropsRef.current.context);
  //   console.log('Context changed to:', context);
  // }
}
prevPropsRef.current = { context, k8sVersion, onSave, onClose };

// console.log('Current state:', {
//   selectedResource: selectedResource?.displayName,
//   activeTab,
//   isLoadingSchema,
//   isSchemaIndexerReady,
//   yamlContentLength: yamlContent.length,
//   validationErrorsCount: validationErrors.length
// });

  // Initialize schema indexer
  useEffect(() => {
    const initializeSchemaIndexer = async () => {

      // Don't proceed if k8sVersion is undefined or empty
      if (!safeK8sVersion) {
        console.warn('k8sVersion is not available yet, skipping schema initialization')
        return
      }

      try {
      // Get user data directory and construct proper schema path
      const userDataDir = await window.electronAPI.getUserDataPath()
      const definitionsPath = joinPath(userDataDir, 'schemas', 'k8s', safeK8sVersion, '_definitions.json');
      
      await schemaIndexer.loadSchemaDefinitions(definitionsPath)
      setIsSchemaIndexerReady(true)
      } catch (error) {
        console.error("Failed to initialize schema indexer:", error)
        showNotification("Failed to load Kubernetes schemas", "error")
      }
    }

    initializeSchemaIndexer()
  }, [safeK8sVersion])

  // Handle resource selection from KubernetesResourceSelector
  // const handleSchemaSelect = async (schema: any, resource: SelectedResource) => {
  //   // Batch state updates to prevent infinite loops
  //   setSelectedResource(resource)
  //   setIsLoadingSchema(true)
  //   setValidationErrors([])

  //   // Use setTimeout to defer the heavy operations and prevent blocking
  //   setTimeout(async () => {
  //     try {
  //       // Use the schema properties from the selector
  //       const schemaProperties = schema.properties || schema.fullSchema

  //       if (schemaProperties) {
  //         // Generate initial YAML content based on the schema
  //         const initialContent = generateInitialYamlContent(resource, schemaProperties)
          
  //         // Batch the final state updates
  //         setSelectedSchema(schemaProperties)
  //         setYamlContent(initialContent)
  //         setActiveTab("editor")
  //         setIsLoadingSchema(false)
          
  //         showNotification(`Schema loaded for ${resource.displayName}`, "success")
  //       } else {
  //         throw new Error("Schema not found")
  //       }
  //     } catch (error) {
  //       console.error("Error loading schema:", error)
  //       showNotification(`Failed to load schema for ${resource.displayName}`, "error")
        
  //       // Fallback to basic schema
  //       const fallbackSchema = createFallbackSchema(resource)
  //       const initialContent = generateInitialYamlContent(resource, fallbackSchema)
        
  //       // Batch fallback state updates
  //       setSelectedSchema(fallbackSchema)
  //       setYamlContent(initialContent)
  //       setActiveTab("editor")
  //       setIsLoadingSchema(false)
  //     }
  //   }, 0)
  // }

// Handle resource selection from KubernetesResourceSelector
const handleSchemaSelect = useCallback(async (schema: any, resource: SelectedResource) => {
  console.log('=== handleSchemaSelect called ===');
  
  try {
    // Batch initial state updates
    setSelectedResource(resource);
    setIsLoadingSchema(true);
    setValidationErrors([]);

    const schemaProperties = schema.properties || schema.fullSchema;

    if (schemaProperties) {
      const initialContent = generateInitialYamlContent(resource, schemaProperties);
      
      // Batch final state updates in a single render cycle
      React.startTransition(() => {
        setSelectedSchema(schemaProperties);
        setYamlContent(initialContent);
        setActiveTab("editor");
        setIsLoadingSchema(false);
      });
      
      showNotification(`Schema loaded for ${resource.displayName}`, "success");
    } else {
      throw new Error("Schema not found");
    }
  } catch (error) {
    console.error("Error loading schema:", error);
    
    const fallbackSchema = createFallbackSchema(resource);
    const initialContent = generateInitialYamlContent(resource, fallbackSchema);
    
    // Batch fallback state updates
    React.startTransition(() => {
      setSelectedSchema(fallbackSchema);
      setYamlContent(initialContent);
      setActiveTab("editor");
      setIsLoadingSchema(false);
    });
    
    showNotification(`Failed to load schema for ${resource.displayName}`, "error");
  }
}, []); // Empty dependency array since the function doesn't depend on any props/state

  // Generate initial YAML content based on resource type and schema
// Generate initial YAML content based on resource type and schema
const generateInitialYamlContent = (resource: SelectedResource, schema: any): string => {
  const baseContent: any = {
    apiVersion: resource.group ? `${resource.group}/${resource.version}` : resource.version,
    kind: resource.kind,
    metadata: {
      name: `example-${resource.kind.toLowerCase()}`,
      namespace: resource.kind !== "Namespace" && resource.kind !== "ClusterRole" && resource.kind !== "ClusterRoleBinding" ? "default" : undefined,
    },
  }

  // Add spec section if the schema has spec properties
  if (schema.properties?.spec) {
    baseContent.spec = {}
    
    // Add some common spec fields based on resource type
    if (resource.kind === "Deployment") {
      baseContent.spec = {
        replicas: 1,
        selector: {
          matchLabels: {
            app: `example-${resource.kind.toLowerCase()}`,
          },
        },
        template: {
          metadata: {
            labels: {
              app: `example-${resource.kind.toLowerCase()}`,
            },
          },
          spec: {
            containers: [
              {
                name: "app",
                image: "nginx:latest",
                ports: [
                  {
                    containerPort: 80,
                  },
                ],
              },
            ],
          },
        },
      }
    } else if (resource.kind === "Service") {
      baseContent.spec = {
        selector: {
          app: "example-app",
        },
        ports: [
          {
            port: 80,
            targetPort: 80,
            protocol: "TCP",
          },
        ],
        type: "ClusterIP",
      }
    } else if (resource.kind === "ConfigMap") {
      baseContent.data = {
        "config.yaml": "# Configuration data here",
      }
    }
  }

  // Clean up undefined values
  const cleanContent = JSON.parse(JSON.stringify(baseContent, (key, value) => value === undefined ? undefined : value))
  
  return yaml.dump(cleanContent, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  })
}
// Create fallback schema for unsupported resource types
const createFallbackSchema = (resource: SelectedResource): any => {
  return {
    type: "object",
    title: resource.displayName,
    properties: {
      apiVersion: {
        type: "string",
        title: "API Version",
        default: resource.group ? `${resource.group}/${resource.version}` : resource.version,
        readOnly: true,
      },
      kind: {
        type: "string",
        title: "Kind",
        default: resource.kind,
        readOnly: true,
      },
      metadata: {
        type: "object",
        title: "Metadata",
        properties: {
          name: {
            type: "string",
            title: "Name",
            description: "Name of the resource",
          },
          namespace: {
            type: "string",
            title: "Namespace",
            description: "Namespace for the resource",
            default: "default",
          },
          labels: {
            type: "object",
            title: "Labels",
            additionalProperties: {
              type: "string",
            },
          },
          annotations: {
            type: "object",
            title: "Annotations",
            additionalProperties: {
              type: "string",
            },
          },
        },
        required: ["name"],
      },
      spec: {
        type: "object",
        title: "Specification",
        description: `Specification for ${resource.kind}`,
        properties: {},
      },
    },
    required: ["apiVersion", "kind", "metadata"],
  }
}

  // Handle YAML content changes
  const handleYamlChange = (content: string) => {
    setYamlContent(content)
    validateYamlContent(content)
  }

  // Validate YAML content
  const validateYamlContent = (content: string) => {
    const errors: string[] = []

    try {
      const parsed = yaml.load(content) as any
      
      if (!parsed) {
        errors.push("YAML content is empty")
      } else {
        // Basic validation
        if (!parsed.apiVersion) {
          errors.push("Missing required field: apiVersion")
        }
        if (!parsed.kind) {
          errors.push("Missing required field: kind")
        }
        if (!parsed.metadata?.name) {
          errors.push("Missing required field: metadata.name")
        }
        
        // Validate against selected resource type
        if (selectedResource) {
          if (parsed.kind !== selectedResource.kind) {
            errors.push(`Kind mismatch: expected ${selectedResource.kind}, got ${parsed.kind}`)
          }
        }
      }
    } catch (error) {
      errors.push(`Invalid YAML syntax: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    setValidationErrors(errors)
  }

  // Handle save action
  const handleSave = async () => {
    if (!selectedResource || !yamlContent.trim()) {
      showNotification("Please select a resource type and provide content", "error")
      return
    }

    if (validationErrors.length > 0) {
      showNotification("Please fix validation errors before saving", "error")
      return
    }

    setIsSaving(true)
    try {
      // Save to file or call parent callback
      if (onSave) {
        await onSave(yamlContent, selectedResource.kind)
      } else {
        // Default save behavior - save to localStorage or file
        const filename = `${selectedResource.kind.toLowerCase()}-${Date.now()}.yaml`
        localStorage.setItem(`k8s_resource_${filename}`, yamlContent)
        showNotification(`Resource saved as ${filename}`, "success")
      }
    } catch (error) {
      console.error("Error saving resource:", error)
      showNotification("Failed to save resource", "error")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to resource selection
  const handleBackToSelection = () => {
    setActiveTab("selector")
    setSelectedResource(null)
    setSelectedSchema(null)
    setYamlContent("")
    setValidationErrors([])
  }

  // Show notification helper
// Show notification helper
const showNotification = (message: string, type: "success" | "error" = "success") => {
  const toast = document.createElement("div")
  toast.textContent = message
  toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
    type === "success" ? "bg-green-500" : "bg-red-500"
  }`
  document.body.appendChild(toast)
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast)
    }
  }, 3000)
}

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold">Create Kubernetes Resource</h1>
          {selectedResource && (
            <Badge variant="secondary" className="ml-2">
              {selectedResource.displayName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedResource && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToSelection}
              disabled={isLoadingSchema}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Change Resource
            </Button>
          )}
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "selector" | "editor")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selector" disabled={!isSchemaIndexerReady}>
              1. Select Resource Type
            </TabsTrigger>
            <TabsTrigger value="editor" disabled={!selectedResource}>
              2. Configure Resource
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selector" className="h-full mt-0">
            <div className="h-full p-4">
              {!isSchemaIndexerReady ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-muted-foreground">Loading Kubernetes schemas...</p>
                  </div>
                </div>
              ) : (
                <KubernetesResourceSelector
                onSchemaSelect={handleSchemaSelect}
                schemaVersion={safeK8sVersion}
              />
              )}
            </div>
          </TabsContent>

          <TabsContent value="editor" className="h-full mt-0">
            <div className="h-full flex flex-col">
              {/* Validation Status */}
              {validationErrors.length > 0 && (
                <Alert className="m-4 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Validation Errors:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationErrors.length === 0 && yamlContent.trim() && (
                <Alert className="m-4 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Resource configuration is valid and ready to save.
                  </AlertDescription>
                </Alert>
              )}

              {/* Editor */}
              <div className="flex-1 mx-4 mb-4">
                {isLoadingSchema ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                      <p className="text-muted-foreground">Loading schema...</p>
                    </div>
                  </div>
                ) : selectedSchema ? (
                  <YamlEditor
                    targetYamlFilename={`${selectedResource?.kind || 'resource'}.yaml`}
                    jsonSchema={selectedSchema}
                    context={context}
                    layout="side-by-side"
                    initialContent={yamlContent}
                    onChange={handleYamlChange}
                    title={`Create ${selectedResource?.displayName || 'Kubernetes Resource'}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Please select a resource type first.</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedResource && (
                      <span>
                        Creating: {selectedResource.displayName} ({selectedResource.kind})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleBackToSelection}
                      disabled={isLoadingSchema || isSaving}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={!selectedResource || !yamlContent.trim() || validationErrors.length > 0 || isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Resource
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(KubernetesResourceCreatorV2);