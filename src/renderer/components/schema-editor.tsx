"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Textarea } from "@/renderer/components/ui/textarea"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { Card, CardContent, CardHeader } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/renderer/components/ui/alert"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/renderer/components/ui/dialog"
import {
  Save,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit,
  Trash2,
  Plus,
  X,
  Upload,
  File,
  Hash,
  Type,
  ToggleLeft,
  List,
  Braces,
  Sparkles,
} from "lucide-react"
import { Switch } from "@/renderer/components/ui/switch"
import { ChevronRight } from "lucide-react"

import { EditorView, basicSetup } from "codemirror"
import { json } from "@codemirror/lang-json"
import { EditorState } from "@codemirror/state"
import { linter, lintGutter } from "@codemirror/lint"
import { jsonParseLinter } from "@codemirror/lang-json"
import { syntaxHighlighting } from "@codemirror/language"

import type { ContextData } from "@/shared/types/context-data"
import { jsonTheme, jsonHighlightStyle } from "@/renderer/lib/codemirror-themes"
import { buildConfigPath } from "@/renderer/lib/path-utils"

interface SchemaProperty {
  type: string
  title?: string
  description?: string
  default?: any
  enum?: string[]
  properties?: { [key: string]: SchemaProperty }
  items?: SchemaProperty
  required?: string[]
}

interface Schema {
  type: string
  properties: { [key: string]: SchemaProperty }
  required?: string[]
}

interface SchemaEditorProps {
  context: ContextData
  baseDirectory: string
}

// Mock schema data
const mockSchema: Schema = {
  type: "object",
  properties: {
    replicaCount: {
      type: "integer",
      title: "Replica Number",
      description: "Number of pod replicas to run",
      default: 1,
    },
    environments: {
      type: "array",
      title: "Environments",
      description: "List of deployment environments",
      items: {
        type: "string",
      },
    },
    image: {
      type: "object",
      title: "Container Image",
      description: "Docker image configuration",
      properties: {
        repository: {
          type: "string",
          title: "Repository",
          description: "Docker image repository",
          default: "nginx",
        },
        tag: {
          type: "string",
          title: "Tag",
          description: "Image tag or version",
          default: "latest",
        },
      },
    },
    service: {
      type: "object",
      title: "Service Configuration",
      description: "Kubernetes service settings",
      properties: {
        type: {
          type: "string",
          title: "Service Type",
          description: "Type of Kubernetes service",
          enum: ["ClusterIP", "NodePort", "LoadBalancer"],
        },
        port: {
          type: "integer",
          title: "Port",
          description: "Service port number",
        },
        ports: {
          type: "array",
          title: "Multiple Ports",
          description: "Array of port configurations",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                title: "Port Name",
              },
              port: {
                type: "number",
                title: "Port Number",
              },
            },
          },
        },
      },
    },
    config: {
      type: "object",
      title: "Application Configuration",
      description: "Runtime configuration settings",
      properties: {
        featureToggles: {
          type: "object",
          title: "Feature Toggles",
          description: "Feature flag configurations",
          properties: {
            enableNewUI: {
              type: "boolean",
              title: "Enable New UI",
              description: "Toggle for new user interface",
              default: true,
            },
            enableBetaMode: {
              type: "boolean",
              title: "Enable Beta Mode",
              description: "Enable experimental features",
              default: false,
            },
          },
        },
        logging: {
          type: "object",
          title: "Logging Configuration",
          description: "Application logging settings",
          properties: {
            level: {
              type: "string",
              title: "Log Level",
              description: "Minimum log level to output",
              enum: ["Trace", "Debug", "Information", "Warning", "Error", "Critical"],
              default: "Information",
            },
            output: {
              type: "string",
              title: "Log Output",
              description: "Where to send log output",
              enum: ["Console", "File", "Both"],
              default: "Console",
            },
          },
        },
        connectionStrings: {
          type: "object",
          title: "Connection Strings",
          description: "Database and service connections",
          properties: {
            defaultConnection: {
              type: "string",
              title: "Default Database",
              description: "Primary database connection string",
              default: "Server=db;Database=myapp;User Id=sa;Password=yourStrong(!)Password;",
            },
          },
        },
      },
    },
  },
}

// Custom debounce hook
function useDebounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedFunc = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => func(...args), delay)
    },
    [func, delay],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedFunc as T
}

const EnhancedCodeMirrorEditor = React.memo(
  ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const lastValueRef = useRef(value)

    // Debounce the onChange callback to reduce frequent updates
    const debouncedOnChange = useDebounce(onChange, 150)

    useEffect(() => {
      if (!editorRef.current) return

      // Only create editor if it doesn't exist
      if (!viewRef.current) {
        const state = EditorState.create({
          doc: value,
          extensions: [
            basicSetup,
            json(),
            jsonTheme,
            syntaxHighlighting(jsonHighlightStyle),
            linter(jsonParseLinter()),
            lintGutter(),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const newValue = update.state.doc.toString()
                if (newValue !== lastValueRef.current) {
                  lastValueRef.current = newValue
                  debouncedOnChange(newValue)
                }
              }
            }),
            EditorView.theme({
              "&": {
                height: "100%",
                fontSize: "14px",
              },
              ".cm-content": {
                padding: "16px",
              },
              ".cm-focused": {
                outline: "none",
              },
              ".cm-editor": {
                height: "100%",
              },
              ".cm-scroller": {
                height: "100%",
              },
            }),
          ],
        })

        viewRef.current = new EditorView({
          state,
          parent: editorRef.current,
        })
      }

      return () => {
        // Only destroy on unmount, not on every render
      }
    }, []) // Empty dependency array means this only runs once on mount

    // Update editor content when value changes externally (but not from editor itself)
    useEffect(() => {
      if (viewRef.current && value !== lastValueRef.current) {
        lastValueRef.current = value
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: value,
          },
        })
      }
    }, [value])

    // Clean up on unmount
    useEffect(() => {
      return () => {
        if (viewRef.current) {
          viewRef.current.destroy()
          viewRef.current = null
        }
      }
    }, [])

    return <div ref={editorRef} className="h-full w-full rounded-lg border overflow-hidden" />
  },
)

EnhancedCodeMirrorEditor.displayName = "EnhancedCodeMirrorEditor"

// Simplified Add Property Dialog Component
const AddPropertyDialog = React.memo(
  ({
    onAddProperty,
    existingProperties,
    parentPath = "",
  }: {
    onAddProperty: (parentPath: string, name: string, property: SchemaProperty) => void
    existingProperties: string[]
    parentPath?: string
  }) => {
    const [open, setOpen] = useState(false)
    const [propertyName, setPropertyName] = useState("")
    const [propertyType, setPropertyType] = useState("string")
    const [propertyTitle, setPropertyTitle] = useState("")
    const [propertyDescription, setPropertyDescription] = useState("")
    const [error, setError] = useState("")

    // Array specific states - simplified
    const [arrayItemType, setArrayItemType] = useState("string")
    const [objectProperties, setObjectProperties] = useState<Array<{ name: string; type: string }>>([])

    const resetForm = useCallback(() => {
      setPropertyName("")
      setPropertyType("string")
      setPropertyTitle("")
      setPropertyDescription("")
      setError("")
      setArrayItemType("string")
      setObjectProperties([])
    }, [])

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
          resetForm()
        }
      },
      [resetForm],
    )

    const handleAddObjectProperty = useCallback(() => {
      const name = `property${objectProperties.length + 1}`
      setObjectProperties((prev) => [...prev, { name, type: "string" }])
    }, [objectProperties.length])

    const handleRemoveObjectProperty = useCallback((index: number) => {
      setObjectProperties((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const handleObjectPropertyChange = useCallback((index: number, field: "name" | "type", value: string) => {
      setObjectProperties((prev) => prev.map((prop, i) => (i === index ? { ...prop, [field]: value } : prop)))
    }, [])

    const handleSubmit = useCallback(() => {
      const trimmedName = propertyName.trim()

      if (!trimmedName) {
        setError("Property name is required")
        return
      }

      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmedName)) {
        setError("Property name must start with a letter and contain only letters, numbers, and underscores")
        return
      }

      if (existingProperties.includes(trimmedName)) {
        setError(`Property "${trimmedName}" already exists at this level`)
        return
      }

      // Create the property object based on type
      const newProperty: SchemaProperty = {
        type: propertyType,
        title: propertyTitle.trim() || trimmedName,
        description: propertyDescription.trim(),
      }

      // Set default values based on type
      switch (propertyType) {
        case "string":
          newProperty.default = ""
          break
        case "number":
        case "integer":
          newProperty.default = 0
          break
        case "boolean":
          newProperty.default = false
          break
        case "object":
          newProperty.properties = {}
          break
        case "array":
          if (arrayItemType === "object" && objectProperties.length > 0) {
            const itemProperties: { [key: string]: SchemaProperty } = {}
            objectProperties.forEach((prop) => {
              itemProperties[prop.name] = {
                type: prop.type,
                title: prop.name,
                default:
                  prop.type === "string"
                    ? ""
                    : prop.type === "number" || prop.type === "integer"
                      ? 0
                      : prop.type === "boolean"
                        ? false
                        : undefined,
              }
            })
            newProperty.items = {
              type: "object",
              properties: itemProperties,
            }
          } else {
            newProperty.items = { type: arrayItemType }
          }
          newProperty.default = []
          break
      }

      onAddProperty(parentPath, trimmedName, newProperty)
      resetForm()
      setOpen(false)
    }, [
      propertyName,
      propertyType,
      propertyTitle,
      propertyDescription,
      existingProperties,
      parentPath,
      arrayItemType,
      objectProperties,
      onAddProperty,
      resetForm,
    ])

    const isArrayType = propertyType === "array"
    const isObjectArrayType = isArrayType && arrayItemType === "object"

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border-emerald-200 text-emerald-700 hover:text-emerald-800 dark:from-emerald-950 dark:to-emerald-900 dark:border-emerald-800 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>
              Create a new property for your schema. The property name should be unique within its parent.
            </DialogDescription>
          </DialogHeader>

          {parentPath && (
            <div className="mb-4 p-2 bg-muted rounded-md">
              <p className="text-xs font-mono">
                Adding to: <span className="font-semibold">{parentPath || "root"}</span>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="property-name">Property Name *</Label>
              <Input
                id="property-name"
                value={propertyName}
                onChange={(e) => {
                  setPropertyName(e.target.value)
                  setError("")
                }}
                placeholder="e.g., myProperty"
                className={error ? "border-destructive" : ""}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-type">Type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="integer">Integer</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-title">Display Title</Label>
              <Input
                id="property-title"
                value={propertyTitle}
                onChange={(e) => setPropertyTitle(e.target.value)}
                placeholder="Human-readable title (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-description">Description</Label>
              <Textarea
                id="property-description"
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                placeholder="Describe what this property is for (optional)"
                rows={2}
              />
            </div>

            {/* Simplified Array Configuration */}
            {isArrayType && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium text-sm">Array Configuration</h4>

                <div className="space-y-2">
                  <Label htmlFor="array-item-type">Array Item Type</Label>
                  <Select value={arrayItemType} onValueChange={setArrayItemType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="integer">Integer</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Simplified Object Properties */}
                {isObjectArrayType && (
                  <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium">Object Properties</h5>
                      <Button variant="outline" size="sm" onClick={handleAddObjectProperty} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>

                    {objectProperties.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {objectProperties.map((prop, index) => (
                          <div key={index} className="flex items-center gap-2 bg-background p-2 rounded-md">
                            <Input
                              value={prop.name}
                              onChange={(e) => handleObjectPropertyChange(index, "name", e.target.value)}
                              placeholder="Property name"
                              className="h-7 text-xs flex-1"
                            />
                            <Select
                              value={prop.type}
                              onValueChange={(value) => handleObjectPropertyChange(index, "type", value)}
                            >
                              <SelectTrigger className="h-7 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="integer">Integer</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveObjectProperty(index)}
                              className="h-7 w-7 p-0 text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 text-xs text-muted-foreground">
                        Click "Add" to define object properties
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Add Property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  },
)

AddPropertyDialog.displayName = "AddPropertyDialog"

// Memoized tree node component with proper expansion/collapse
const TreeNodeWithChildren = React.memo(
  ({ node, level = 0, onToggle }: { node: any; level?: number; onToggle: (nodeId: string) => void }) => {
    const hasChildren = node.children && node.children.length > 0
    const paddingLeft = level * 16

    return (
      <div className="select-none">
        <div
          className={`flex items-center py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 group relative ${
            node.isSelected
              ? "bg-primary/5 transform scale-[1.02] shadow-sm"
              : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={(e) => {
            e.stopPropagation()
            if (node.onClick) node.onClick()
          }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <div
              className="flex items-center justify-center w-6 h-6 mr-2"
              onClick={(e) => {
                e.stopPropagation()
                if (node.onToggle) node.onToggle()
              }}
            >
              <div className={`transition-transform duration-200 ${node.isExpanded ? "rotate-90" : "rotate-0"}`}>
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
          )}

          {/* Icon */}
          {node.icon && <div className="mr-3 p-1 bg-slate-100/80 dark:bg-slate-700/60 rounded-md">{node.icon}</div>}

          {/* Label */}
          <div className="flex-1 min-w-0">{node.label}</div>

          {/* Selection indicator */}
          {node.isSelected && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
          )}
        </div>

        {/* Children with smooth animation */}
        {hasChildren && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              node.isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-4 mt-1 space-y-0 border-l border-slate-200 dark:border-slate-700 pl-2">
              {node.children.map((child: any) => (
                <TreeNodeWithChildren key={child.id} node={child} level={level + 1} onToggle={onToggle} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)

TreeNodeWithChildren.displayName = "TreeNodeWithChildren"

// Move this function outside of renderSplitView to make it accessible
export function SchemaEditor({ context, baseDirectory }: SchemaEditorProps) {
  const [schema, setSchema] = useState<Schema>(mockSchema)
  const [schemaText, setSchemaText] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Load expanded state from localStorage
    const saved = localStorage.getItem(`schema_expanded_${context.environment}_${context.product}`)
    if (saved) {
      try {
        return new Set(JSON.parse(saved))
      } catch (e) {
        console.error("Error parsing saved expanded state:", e)
      }
    }
    // Default to having root expanded
    return new Set(["root"])
  })
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<string | null>(null)
  const [propertyForm, setPropertyForm] = useState<SchemaProperty>({
    type: "string",
    title: "",
    description: "",
  })
  const [newEnumValue, setNewEnumValue] = useState("")
  const [isFileLoading, setIsFileLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add these state variables after the existing useState declarations
  const [panelSplit, setPanelSplit] = useState(50) // Percentage for middle panel (Property Editor)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartSplit, setDragStartSplit] = useState(50)

  // Build the file path using the path utility
  const filePath = buildConfigPath(
    baseDirectory,
    context.customer,
    context.environment,
    context.instance,
    context.product,
    "values.schema.json",
  )

  const getPropertyByPath = useCallback(
    (path: string): SchemaProperty | null => {
      // Handle root selection
      if (path === "root") {
        return schema as SchemaProperty
      }

      const parts = path.split(".")
      let current: any = schema

      for (const part of parts) {
        if (part === "items" && current.items) {
          current = current.items
        } else if (current.properties && current.properties[part]) {
          current = current.properties[part]
        } else {
          return null
        }
      }

      return current
    },
    [schema],
  )

  const getExistingPropertiesAtLevel = useCallback(
    (path: string | null): string[] => {
      if (!path) {
        // Root level properties
        return Object.keys(schema.properties || {})
      }

      const parts = path.split(".")
      let current: any = schema

      for (const part of parts) {
        if (part === "items" && current.items) {
          current = current.items
        } else if (current.properties && current.properties[part]) {
          current = current.properties[part]
        } else {
          return []
        }
      }

      return Object.keys(current.properties || {})
    },
    [schema],
  )

  // Memoize schema text to prevent unnecessary updates
  const memoizedSchemaText = useMemo(() => {
    return JSON.stringify(schema, null, 2)
  }, [schema])

  // Initialize schema text from schema object
  useEffect(() => {
    setSchemaText(memoizedSchemaText)
  }, [memoizedSchemaText])

  // Load schema from localStorage or use mock
  useEffect(() => {
    const savedSchema = localStorage.getItem(`schema_${context.environment}_${context.product}`)
    if (savedSchema) {
      try {
        const parsedSchema = JSON.parse(savedSchema)
        setSchema(parsedSchema)
      } catch (e) {
        console.error("Error parsing saved schema:", e)
      }
    }
  }, [context])

  const handleEditProperty = useCallback(
    (path: string) => {
      const property = getPropertyByPath(path)
      if (property) {
        setPropertyForm({ ...property })
        setEditingProperty(path)
      }
    },
    [getPropertyByPath],
  )

  // Debounce schema text changes
  const debouncedSchemaUpdate = useDebounce((value: string) => {
    try {
      const parsed = JSON.parse(value)
      setSchema(parsed)
      setError(null)
    } catch (e) {
      setError("Invalid JSON syntax")
    }
  }, 300)

  const handleSchemaTextChange = useCallback(
    (value: string) => {
      setSchemaText(value)
      setError(null)
      debouncedSchemaUpdate(value)
    },
    [debouncedSchemaUpdate],
  )

  const handleSave = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate JSON
      const parsedSchema = JSON.parse(schemaText)

      // Save to localStorage
      localStorage.setItem(`schema_${context.environment}_${context.product}`, JSON.stringify(parsedSchema))

      setSchema(parsedSchema)
      setSuccess("Schema saved successfully!")

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError("Failed to save schema: Invalid JSON")
    } finally {
      setIsLoading(false)
    }
  }, [schemaText, context])

  const handleDownload = useCallback(() => {
    const blob = new Blob([schemaText], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `values.schema.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [schemaText])

  const handleReset = useCallback(() => {
    setSchema(mockSchema)
    setError(null)
    setSuccess(null)
    setSelectedProperty(null)
    setEditingProperty(null)
  }, [])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".json")) {
      setError("Please select a valid JSON file")
      return
    }

    setIsFileLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const parsedSchema = JSON.parse(text)

      // Validate that it's a proper JSON schema
      if (typeof parsedSchema !== "object" || !parsedSchema.type) {
        throw new Error("Invalid JSON schema format")
      }

      setSchema(parsedSchema)
      setSuccess(`Schema loaded from ${file.name}`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(`Failed to load schema: ${e instanceof Error ? e.message : "Invalid JSON"}`)
    } finally {
      setIsFileLoading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Helper functions for property manipulation

  const updatePropertyByPath = useCallback(
    (path: string, updatedProperty: SchemaProperty) => {
      const newSchema = JSON.parse(JSON.stringify(schema))
      const parts = path.split(".")
      let current: any = newSchema

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        if (part === "items" && current.items) {
          current = current.items
        } else if (current.properties && current.properties[part]) {
          current = current.properties[part]
        }
      }

      const lastPart = parts[parts.length - 1]
      if (lastPart === "items") {
        current.items = updatedProperty
      } else if (current.properties) {
        current.properties[lastPart] = updatedProperty
      }

      setSchema(newSchema)
    },
    [schema],
  )

  const deletePropertyByPath = useCallback(
    (path: string) => {
      const newSchema = JSON.parse(JSON.stringify(schema))
      const parts = path.split(".")
      let current: any = newSchema

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        if (part === "items" && current.items) {
          current = current.items
        } else if (current.properties && current.properties[part]) {
          current = current.properties[part]
        }
      }

      const lastPart = parts[parts.length - 1]
      if (current.properties && current.properties[lastPart]) {
        delete current.properties[lastPart]
      }

      setSchema(newSchema)
      setSelectedProperty(null)
      setEditingProperty(null)
    },
    [schema],
  )

  const addNewProperty = useCallback(
    (parentPath: string, propertyName: string, property: SchemaProperty) => {
      const newSchema = JSON.parse(JSON.stringify(schema))
      let current: any = newSchema

      if (parentPath) {
        const parts = parentPath.split(".")
        for (const part of parts) {
          if (part === "items" && current.items) {
            current = current.items
          } else if (current.properties && current.properties[part]) {
            current = current.properties[part]
          }
        }
      }

      if (!current.properties) {
        current.properties = {}
      }

      current.properties[propertyName] = property
      setSchema(newSchema)
      setSuccess(`Property "${propertyName}" added successfully!`)
      setTimeout(() => setSuccess(null), 3000)

      // Auto-select the new property for editing
      const newPath = parentPath ? `${parentPath}.${propertyName}` : propertyName
      setSelectedProperty(newPath)
      handleEditProperty(newPath)
    },
    [schema, handleEditProperty],
  )

  const handleUpdateProperty = useCallback(() => {
    if (editingProperty) {
      updatePropertyByPath(editingProperty, propertyForm)
      setSuccess("Property updated successfully!")
      setTimeout(() => setSuccess(null), 3000)
    }
  }, [editingProperty, propertyForm, updatePropertyByPath])

  const handleDeleteProperty = useCallback(
    (path: string) => {
      if (confirm("Are you sure you want to delete this property?")) {
        deletePropertyByPath(path)
        setSuccess("Property deleted successfully!")
        setTimeout(() => setSuccess(null), 3000)
      }
    },
    [deletePropertyByPath],
  )

  const handleAddEnumValue = useCallback(() => {
    if (newEnumValue.trim()) {
      const currentEnum = propertyForm.enum || []
      setPropertyForm({
        ...propertyForm,
        enum: [...currentEnum, newEnumValue.trim()],
      })
      setNewEnumValue("")
    }
  }, [newEnumValue, propertyForm])

  const handleRemoveEnumValue = useCallback(
    (index: number) => {
      const currentEnum = propertyForm.enum || []
      setPropertyForm({
        ...propertyForm,
        enum: currentEnum.filter((_, i) => i !== index),
      })
    },
    [propertyForm],
  )

  const getTypeColor = useCallback((type: string) => {
    const colors = {
      string: "bg-gradient-to-r from-emerald-500 to-emerald-600",
      number: "bg-gradient-to-r from-blue-500 to-blue-600",
      integer: "bg-gradient-to-r from-blue-500 to-blue-600",
      boolean: "bg-gradient-to-r from-purple-500 to-purple-600",
      object: "bg-gradient-to-r from-amber-500 to-amber-600",
      array: "bg-gradient-to-r from-pink-500 to-pink-600",
    }
    return colors[type as keyof typeof colors] || "bg-gradient-to-r from-gray-500 to-gray-600"
  }, [])

  const toggleSection = useCallback(
    (path: string) => {
      setExpandedSections((prev) => {
        const newExpanded = new Set(prev)
        if (newExpanded.has(path)) {
          newExpanded.delete(path)
        } else {
          newExpanded.add(path)
        }

        // Persist to localStorage
        localStorage.setItem(
          `schema_expanded_${context.environment}_${context.product}`,
          JSON.stringify(Array.from(newExpanded)),
        )

        return newExpanded
      })
    },
    [context],
  )

  const buildTreeData = useCallback(
    (properties: { [key: string]: SchemaProperty }, basePath = ""): any[] => {
      return Object.entries(properties).map(([key, property]) => {
        const currentPath = basePath ? `${basePath}.${key}` : key
        const hasChildren =
          (property.type === "object" && property.properties) || (property.type === "array" && property.items)
        const isExpanded = expandedSections.has(currentPath)
        const isSelected = selectedProperty === currentPath

        const label = (
          <div className="flex items-center gap-3 min-w-0 flex-1" key={currentPath}>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate text-sm">{property.title || key}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-medium text-white shrink-0 shadow-sm px-1.5 py-0.5 ${getTypeColor(property.type)}`}
                >
                  {property.type}
                </Badge>
                {property.enum && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 shrink-0 shadow-sm px-1.5 py-0.5"
                  >
                    enum
                  </Badge>
                )}
                {property.default !== undefined && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 shrink-0 shadow-sm px-1.5 py-0.5"
                  >
                    default
                  </Badge>
                )}
              </div>
              {property.description && (
                <div
                  className="text-xs text-muted-foreground/80 truncate mt-1 leading-relaxed"
                  key={`${currentPath}_description`}
                >
                  {property.description}
                </div>
              )}
            </div>

            {/* Add Property button for object types - only show when selected */}
            {property.type === "object" && isSelected && (
              <div className="flex items-center ml-auto">
                <AddPropertyDialog
                  onAddProperty={addNewProperty}
                  existingProperties={getExistingPropertiesAtLevel(currentPath)}
                  parentPath={currentPath}
                />
              </div>
            )}
          </div>
        )

        const node: any = {
          id: currentPath,
          label,
          icon: getTypeIcon(property.type),
          isExpanded,
          isSelected,
          onClick: () => {
            setSelectedProperty(currentPath)
            handleEditProperty(currentPath)
            if (hasChildren && !isExpanded) {
              toggleSection(currentPath)
            }
          },
          onToggle: () => toggleSection(currentPath),
        }

        const children: any[] = []

        if (property.type === "object" && property.properties) {
          children.push(...buildTreeData(property.properties, currentPath))
        }

        if (property.type === "array" && property.items) {
          const itemsPath = `${currentPath}.items`
          const itemsIsExpanded = expandedSections.has(itemsPath)

          const itemsNode = {
            id: itemsPath,
            children: {},
            label: (
              <div className="flex items-center gap-2">
                <span className="font-medium text-blue-800 dark:text-blue-300 text-sm">Array Items</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-medium text-white shadow-sm px-1.5 py-0.5 ${getTypeColor(property.items.type)}`}
                >
                  {property.items.type}
                </Badge>
              </div>
            ),
            icon: getTypeIcon(property.items.type),
            isSelected: selectedProperty === itemsPath,
            isExpanded: itemsIsExpanded,
            onClick: () => {
              // For array items, always redirect to the parent array for editing
              setSelectedProperty(currentPath)
              handleEditProperty(currentPath)
              if (property.items?.type === "object" && property.items.properties && !itemsIsExpanded) {
                toggleSection(itemsPath)
              }
            },
            onToggle: () => toggleSection(itemsPath),
          }

          if (property.items.type === "object" && property.items.properties) {
            // Create child nodes for object properties, but make them redirect to parent array
            const objectPropertyNodes = Object.entries(property.items.properties).map(([propKey, propSchema]) => {
              const propPath = `${itemsPath}.${propKey}`
              return {
                id: propPath,
                label: (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-muted-foreground">{propSchema.title || propKey}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium px-1.5 py-0.5 ${getTypeColor(propSchema.type)} text-white`}
                    >
                      {propSchema.type}
                    </Badge>
                    {propSchema.enum && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5"
                      >
                        enum
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5"
                    >
                      array item
                    </Badge>
                  </div>
                ),
                icon: getTypeIcon(propSchema.type),
                isSelected: selectedProperty === currentPath, // Select parent array instead
                onClick: () => {
                  // Redirect to parent array for editing
                  setSelectedProperty(currentPath)
                  handleEditProperty(currentPath)
                },
              }
            })
            itemsNode.children = objectPropertyNodes
          }

          children.push(itemsNode)
        }

        if (children.length > 0) {
          node.children = children
        }

        return node
      })
    },
    [
      expandedSections,
      selectedProperty,
      getTypeColor,
      handleEditProperty,
      toggleSection,
      addNewProperty,
      getExistingPropertiesAtLevel,
    ],
  )

  const getTypeIcon = useCallback((type: string) => {
    const icons = {
      string: <Type className="h-4 w-4 text-emerald-500" />,
      number: <Hash className="h-4 w-4 text-blue-500" />,
      integer: <Hash className="h-4 w-4 text-blue-500" />,
      boolean: <ToggleLeft className="h-4 w-4 text-purple-500" />,
      object: <Braces className="h-4 w-4 text-amber-500" />,
      array: <List className="h-4 w-4 text-pink-500" />,
    }
    return icons[type as keyof typeof icons] || <File className="h-4 w-4 text-gray-500" />
  }, [])

  // Auto-select root node by default
  useEffect(() => {
    if (schema && schema.properties && !selectedProperty) {
      setSelectedProperty("root")
      handleEditProperty("root")
    }
  }, [schema, selectedProperty, handleEditProperty])

  const renderPropertyEditor = useCallback(() => {
    if (!selectedProperty) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-2xl mb-6">
            <Edit className="h-10 w-10 text-primary/50 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Select a Property</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Click on any property in the tree view to edit its configuration
          </p>
        </div>
      )
    }

    // Show loading state while property is being loaded
    if (selectedProperty && !editingProperty) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-2xl mb-6">
            <Loader2 className="h-10 w-10 text-primary/50 mx-auto animate-spin" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Loading Property</h3>
          <p className="text-sm text-muted-foreground max-w-md">Preparing property editor...</p>
        </div>
      )
    }

    // Check if this is an array property with object items
    const currentProperty = getPropertyByPath(editingProperty!)
    const isArrayWithObjects = currentProperty?.type === "array" && currentProperty?.items?.type === "object"

    return (
      <div className="h-full flex flex-col">
        <div className="border-b pb-4 mb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {isArrayWithObjects && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
                  >
                    Array of Objects
                  </Badge>
                )}
              </div>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded-md inline-block">{editingProperty}</p>
              {isArrayWithObjects && currentProperty?.items?.properties && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Array Item Properties:</strong> {Object.keys(currentProperty.items.properties).join(", ")}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    Use the default values section below to configure array items with these properties.
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteProperty(editingProperty!)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 min-h-0">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={propertyForm.title || ""}
              onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
              placeholder="Display name"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={propertyForm.description || ""}
              onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
              placeholder="Property description"
              rows={3}
            />
          </div>

          {propertyForm.type !== "object" && (
            <>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={propertyForm.type}
                  onChange={(value) =>
                    setPropertyForm({
                      ...propertyForm,
                      type: value,
                      enum: value !== "string" ? undefined : propertyForm.enum,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="integer">Integer</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="object">Object</SelectItem>
                    <SelectItem value="array">Array</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Value</Label>
                {propertyForm.type === "boolean" ? (
                  // Boolean Switch
                  <div className="flex items-center space-x-3 p-3 rounded-md border bg-muted/30">
                    <Switch
                      checked={propertyForm.default === true}
                      onCheckedChange={(checked) => {
                        setPropertyForm((prev) => ({ ...prev, default: checked }))
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{propertyForm.default === true ? "True" : "False"}</span>
                      <span className="text-xs text-muted-foreground">Toggle to set the default boolean value</span>
                    </div>
                  </div>
                ) : propertyForm.type === "array" ? (
                  // Array Editor
                  <div className="space-y-3 border rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium">Array Items</h5>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Add a new item based on the array item type
                          const itemType = propertyForm.items?.type || "string"
                          let newItem

                          switch (itemType) {
                            case "string":
                              newItem = ""
                              break
                            case "number":
                            case "integer":
                              newItem = 0
                              break
                            case "boolean":
                              newItem = false
                              break
                            case "object":
                              // For object types, create an empty object with the defined properties
                              if (propertyForm.items?.properties) {
                                newItem = {}
                                Object.entries(propertyForm.items.properties).forEach(([key, prop]) => {
                                  newItem[key] =
                                    prop.default !== undefined
                                      ? prop.default
                                      : prop.type === "string"
                                        ? ""
                                        : prop.type === "number" || prop.type === "integer"
                                          ? 0
                                          : prop.type === "boolean"
                                            ? false
                                            : prop.type === "array"
                                              ? []
                                              : {}
                                })
                              } else {
                                newItem = {}
                              }
                              break
                            default:
                              newItem = ""
                          }

                          const currentDefault = Array.isArray(propertyForm.default) ? [...propertyForm.default] : []
                          setPropertyForm((prev) => ({
                            ...prev,
                            default: [...currentDefault, newItem],
                          }))
                        }}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                      </Button>
                    </div>

                    {Array.isArray(propertyForm.default) && propertyForm.default.length > 0 ? (
                      <ScrollArea className="h-48 rounded-md border">
                        <div className="p-2 space-y-2">
                          {propertyForm.default.map((item, index) => (
                            <div key={index} className="flex flex-col gap-2 bg-muted/30 p-3 rounded-md">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-xs">
                                  Item {index + 1}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newDefault = [...propertyForm.default]
                                    newDefault.splice(index, 1)
                                    setPropertyForm((prev) => ({ ...prev, default: newDefault }))
                                  }}
                                  className="h-6 w-6 p-0 text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>

                              {propertyForm.items?.type === "object" && propertyForm.items.properties ? (
                                // Object item editor
                                <div className="space-y-2 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                                  {Object.entries(propertyForm.items.properties).map(([propKey, propSchema]) => (
                                    <div key={propKey} className="grid grid-cols-3 gap-2 items-center">
                                      <Label className="text-xs">{propSchema.title || propKey}</Label>
                                      {propSchema.type === "boolean" ? (
                                        <Switch
                                          checked={item[propKey] === true}
                                          onCheckedChange={(checked) => {
                                            const newDefault = [...propertyForm.default]
                                            newDefault[index] = { ...newDefault[index], [propKey]: checked }
                                            setPropertyForm((prev) => ({ ...prev, default: newDefault }))
                                          }}
                                        />
                                      ) : (
                                        <Input
                                          value={item[propKey] !== undefined ? String(item[propKey]) : ""}
                                          onChange={(e) => {
                                            let value = e.target.value

                                            // Convert value based on type
                                            if (propSchema.type === "number" || propSchema.type === "integer") {
                                              value = value === "" ? "" : Number(value)
                                            }

                                            const newDefault = [...propertyForm.default]
                                            newDefault[index] = { ...newDefault[index], [propKey]: value }
                                            setPropertyForm((prev) => ({ ...prev, default: newDefault }))
                                          }}
                                          className="h-7 text-xs"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                // Simple item editor
                                <Input
                                  value={String(item)}
                                  onChange={(e) => {
                                    let value = e.target.value

                                    // Convert value based on type
                                    if (
                                      propertyForm.items?.type === "number" ||
                                      propertyForm.items?.type === "integer"
                                    ) {
                                      value = value === "" ? "" : Number(value)
                                    } else if (propertyForm.items?.type === "boolean") {
                                      value = value === "true"
                                    }

                                    const newDefault = [...propertyForm.default]
                                    newDefault[index] = value
                                    setPropertyForm((prev) => ({ ...prev, default: newDefault }))
                                  }}
                                  className="text-xs"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex items-center justify-center h-20 rounded-md border border-dashed text-muted-foreground">
                        No array items added
                      </div>
                    )}

                    {propertyForm.items && (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                        <span className="font-medium">Item Type:</span> {propertyForm.items.type}
                        {propertyForm.items.type === "object" && propertyForm.items.properties && (
                          <div className="mt-1">
                            <span className="font-medium">Properties:</span>{" "}
                            {Object.keys(propertyForm.items.properties).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // Regular input for other types
                  <Input
                    value={propertyForm.default ?? ""}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      let value: any = inputValue

                      // Only convert types if the input is not empty
                      if (inputValue !== "") {
                        if (propertyForm.type === "number" || propertyForm.type === "integer") {
                          const numValue = Number(inputValue)
                          value = isNaN(numValue) ? inputValue : numValue
                        } else if (propertyForm.type === "boolean") {
                          value = inputValue === "true"
                        }
                      }

                      setPropertyForm((prev) => ({ ...prev, default: value }))
                    }}
                    placeholder="Default value"
                  />
                )}
              </div>

              {propertyForm.type === "string" && (
                <div className="space-y-3">
                  <Label>Enum Values</Label>
                  {propertyForm.enum?.length ? (
                    <ScrollArea className="h-32 rounded-md border">
                      <div className="p-2 space-y-1">
                        {propertyForm.enum.map((value, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between px-3 py-2 text-sm bg-muted/50 rounded hover:bg-muted"
                          >
                            <span className="font-mono">{value}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEnumValue(index)}
                              className="h-6 w-6 p-0 text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-20 rounded-md border border-dashed text-muted-foreground">
                      No enum values added
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      value={newEnumValue}
                      onChange={(e) => setNewEnumValue(e.target.value)}
                      placeholder="Add new enum value"
                      onKeyDown={(e) => e.key === "Enter" && handleAddEnumValue()}
                    />
                    <Button variant="outline" onClick={handleAddEnumValue} disabled={!newEnumValue.trim()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t pt-4 flex justify-end flex-shrink-0">
          <Button onClick={handleUpdateProperty} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Update Property
          </Button>
        </div>
      </div>
    )
  }, [
    selectedProperty,
    editingProperty,
    getPropertyByPath,
    propertyForm,
    newEnumValue,
    handleDeleteProperty,
    handleUpdateProperty,
    handleAddEnumValue,
    handleRemoveEnumValue,
    addNewProperty,
    getExistingPropertiesAtLevel,
  ])

  // Add these handlers after the existing useCallback functions
  const handleSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setDragStartX(e.clientX)
      setDragStartSplit(panelSplit)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [panelSplit],
  )

  const handleSplitterMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      e.preventDefault()
      const containerWidth = window.innerWidth * 0.67 // Approximate width of panels 2 & 3 (2/3 of screen)
      const deltaX = e.clientX - dragStartX
      const deltaPercentage = (deltaX / containerWidth) * 100

      const newSplit = Math.max(25, Math.min(75, dragStartSplit + deltaPercentage))
      setPanelSplit(newSplit)
    },
    [isDragging, dragStartX, dragStartSplit],
  )

  const handleSplitterMouseUp = useCallback(() => {
    setIsDragging(false)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  // Add useEffect for global mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleSplitterMouseMove)
      document.addEventListener("mouseup", handleSplitterMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleSplitterMouseMove)
        document.removeEventListener("mouseup", handleSplitterMouseUp)
      }
    }
  }, [isDragging, handleSplitterMouseMove, handleSplitterMouseUp])

  // Update the renderSplitView function to give Tree View 1/3 of the width and make Property Editor and JSON Editor share the remaining space equally
  const renderSplitView = useCallback(() => {
    // Calculate height based on viewport minus header and controls
    const panelHeight = "calc(100vh - 220px)"

    // Calculate grid template columns based on split ratio
    const middlePanelWidth = `${panelSplit}%`
    const rightPanelWidth = `${100 - panelSplit}%`

    // Add root node to tree data
    const treeData = [
      {
        id: "root",
        label: (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate text-sm">Root Schema</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium text-white shrink-0 shadow-sm px-1.5 py-0.5 bg-gradient-to-r from-gray-500 to-gray-600"
                >
                  {schema.type}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground/80 truncate mt-1 leading-relaxed">
                Root schema configuration
              </div>
            </div>
            {selectedProperty === "root" && (
              <div className="flex items-center ml-auto">
                <AddPropertyDialog
                  onAddProperty={addNewProperty}
                  existingProperties={getExistingPropertiesAtLevel(null)}
                  parentPath=""
                />
              </div>
            )}
          </div>
        ),
        icon: <Braces className="h-4 w-4 text-gray-500" />,
        isExpanded: expandedSections.has("root"),
        isSelected: selectedProperty === "root",
        onClick: () => {
          setSelectedProperty("root")
          handleEditProperty("root")
          if (!expandedSections.has("root")) {
            toggleSection("root")
          }
        },
        onToggle: () => toggleSection("root"),
        children: buildTreeData(schema.properties),
      },
    ]

    return (
      <div className="flex gap-3" style={{ height: panelHeight }}>
        {/* Schema Tree - Left Panel (1/3 width) */}
        <div className="w-1/3 h-full flex flex-col flex-shrink-0">
          <Card className="h-full border-0 shadow-sm flex flex-col">
            <CardHeader className="p-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold">Schema Structure</h4>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {treeData.map((node) => (
                  <TreeNodeWithChildren
                    key={node.id}
                    node={node}
                    level={0}
                    onToggle={(nodeId) => {
                      if (node.onToggle) node.onToggle()
                    }}
                  />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Resizable panels container - remaining 2/3 width */}
        <div className="w-2/3 flex h-full">
          {/* Property Editor - Middle Panel (Resizable) */}
          <div className="h-full flex flex-col" style={{ width: middlePanelWidth }}>
            <Card className="h-full border-0 shadow-sm flex flex-col">
              <CardHeader className="p-4 pb-2 flex-shrink-0">
                <h4 className="text-lg font-semibold">Property Editor</h4>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 min-h-0">
                <ScrollArea className="h-full">{renderPropertyEditor()}</ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Splitter */}
          <div
            className="w-0.5 bg-transparent hover:bg-border group cursor-col-resize transition-all duration-200 flex-shrink-0 relative"
            onMouseDown={handleSplitterMouseDown}
          >
            {/* Invisible wider hit area for easier grabbing */}
            <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize" />

            {/* Visual indicator on hover */}
            <div className="absolute inset-y-0 left-0 w-full group-hover:w-1 group-hover:bg-border transition-all duration-200" />

            {/* Active state indicator */}
            <div
              className={`absolute inset-y-0 left-0 w-1 ${isDragging ? "bg-primary/60" : "bg-transparent"} transition-colors duration-150`}
            />
          </div>

          {/* JSON Editor - Right Panel (Resizable) */}
          <div className="h-full flex flex-col" style={{ width: rightPanelWidth }}>
            <Card className="h-full border-0 shadow-sm flex flex-col">
              <CardHeader className="p-4 pb-2 flex-shrink-0">
                <h4 className="text-lg font-semibold">JSON Editor</h4>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="h-full">
                    <EnhancedCodeMirrorEditor value={schemaText} onChange={handleSchemaTextChange} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }, [
    schema,
    selectedProperty,
    getPropertyByPath,
    addNewProperty,
    buildTreeData,
    renderPropertyEditor,
    schemaText,
    handleSchemaTextChange,
    panelSplit,
    isDragging,
    handleSplitterMouseDown,
    expandedSections,
    toggleSection,
    getTypeColor,
    getExistingPropertiesAtLevel,
    handleEditProperty,
  ])

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schema Editor</h1>
          <p className="text-muted-foreground">
            Editing schema for <span className="font-medium font-mono text-sm">{filePath}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isLoading || !!error}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" onClick={handleUploadClick} disabled={isFileLoading}>
            {isFileLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {renderSplitView()}

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
