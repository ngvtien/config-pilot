"use client"

import type React from "react"
import { useRef, useState, useEffect, useCallback } from "react"
import yaml from "js-yaml"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Badge } from "@/renderer/components/ui/badge"
import { Upload, Download, RefreshCw, Copy, Plus, X, Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react"
import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"
import type { ContextData } from "@/shared/types/context-data"

// Layout options for the editor
export type YamlEditorLayout = "stacked" | "side-by-side"

// Display format options for the output panel
export type YamlEditorDisplayFormat = "configmap" | "configjson" | "raw-yaml"

export interface YamlEditorProps {
  /** Target YAML filename to edit */
  targetYamlFilename: string
  /** Path to the JSON schema file */
  jsonSchemaFile?: string
  /** Dynamic JSON schema object (alternative to jsonSchemaFile) */
  jsonSchema?: any
  /** Context data for environment/product information */
  context: ContextData
  /** Layout configuration - stacked (vertical) or side-by-side (horizontal) */
  layout?: YamlEditorLayout
  /** Initial YAML content */
  initialContent?: string
  /** Callback when content changes */
  onChange?: (content: string) => void
  /** Custom title for the editor */
  title?: string
  /** Hide the header and action buttons */
  hideHeader?: boolean
  /** Custom action buttons to display in header */
  customActions?: React.ReactNode
}

// Custom JSON theme with purple/pink accent colors (consistent with other editors)
const jsonTheme = EditorView.theme({
  "&": {
    color: "#f8f8f2",
    backgroundColor: "#1a1a2e",
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "#f8f8f0",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor": {
    borderRadius: "0",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "Fira Code, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
    maxHeight: "100%",
    overflow: "auto",
  },
  ".cm-gutters": {
    backgroundColor: "#16213e",
    color: "#6272a4",
    border: "none",
  },
  ".cm-lineNumbers": {
    color: "#6272a4",
  },
  ".cm-activeLine": {
    backgroundColor: "#44475a40",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#44475a40",
  },
  ".cm-selectionMatch": {
    backgroundColor: "#44475a",
  },
  ".cm-searchMatch": {
    backgroundColor: "#ffb86c40",
    outline: "1px solid #ffb86c",
  },
  ".cm-cursor": {
    borderLeftColor: "#f8f8f0",
  },
  ".cm-selection": {
    backgroundColor: "#44475a",
  },
})

const jsonHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#ff79c6" },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#8be9fd" },
  { tag: [t.function(t.variableName), t.labelName], color: "#50fa7b" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#bd93f9" },
  { tag: [t.definition(t.name), t.separator], color: "#f8f8f2" },
  {
    tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: "#ffb86c",
  },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#ff79c6" },
  { tag: [t.meta, t.comment], color: "#6272a4" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#8be9fd", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#bd93f9" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#bd93f9" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#f1fa8c" },
  { tag: t.invalid, color: "#ff5555" },
])

// CodeMirror extensions for read-only display
const readOnlyExtensions = [
  EditorView.theme({
    "&": {
      fontSize: "14px",
    },
    ".cm-content": {
      padding: "16px",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-editor": {
      borderRadius: "0",
    },
  }),
  EditorView.editable.of(false),
]

// JSON-specific read-only extensions
const jsonReadOnlyExtensions = [
  EditorView.theme({
    "&": {
      fontSize: "14px",
    },
    ".cm-content": {
      padding: "16px",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-editor": {
      borderRadius: "0",
    },
  }),
  EditorView.editable.of(false),
  syntaxHighlighting(jsonHighlightStyle),
]

const YamlEditor: React.FC<YamlEditorProps> = ({
  targetYamlFilename,
  jsonSchemaFile,
  jsonSchema,
  context,
  layout = "stacked",
  initialContent = "",
  onChange,
  title,
  hideHeader = false,
  customActions,
}) => {
  const [yamlContent, setYamlContent] = useState(initialContent)
  const [formData, setFormData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showYamlEditor, setShowYamlEditor] = useState(true)
  const [isYamlExpanded, setIsYamlExpanded] = useState(false)
  const [schema, setSchema] = useState<any>(null)

  // Layout state management
  const [leftPanelWidth, setLeftPanelWidth] = useState(65) // Percentage
  const [verticalSplitRatio, setVerticalSplitRatio] = useState(60) // Percentage for form vs yaml
  const [isDraggingVertical, setIsDraggingVertical] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false)

  // Generate storage keys based on context and filename
  const getStorageKey = (suffix: string) => {
    return `yaml_editor_${context.environment}_${context.product}_${targetYamlFilename}_${suffix}`
  }

  /**
 * Handle horizontal splitter mouse down event for side-by-side layout
 */
  const handleHorizontalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingHorizontal(true)
  }

  // Load schema when component mounts
  useEffect(() => {
    loadSchema()
  }, [jsonSchemaFile, jsonSchema])

  // Load values when component mounts or context changes
  useEffect(() => {
    loadYamlContent()
  }, [context, targetYamlFilename])

  useEffect(() => {
    /**
     * Handle mouse move events for both horizontal and vertical splitters
     */
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHorizontal && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
        setLeftPanelWidth(Math.max(20, Math.min(80, newLeftWidth)))
      }

      if (isDraggingVertical && leftColumnRef.current) {
        const containerRect = leftColumnRef.current.getBoundingClientRect()
        const newRatio = ((e.clientY - containerRect.top) / containerRect.height) * 100
        setVerticalSplitRatio(Math.max(20, Math.min(80, newRatio)))
      }
    }

    /**
     * Handle mouse up events to stop dragging
     */
    const handleMouseUp = () => {
      setIsDraggingHorizontal(false)
      setIsDraggingVertical(false)
    }

    if (isDraggingHorizontal || isDraggingVertical) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingHorizontal, isDraggingVertical])
  // Load schema from file or localStorage
  const loadSchema = async () => {
    try {

      // If a dynamic schema object is provided, use it directly
      if (jsonSchema) {
        setSchema({ ...jsonSchema })
        showNotification("Dynamic schema loaded!", "success")
        return
      }

      // If no jsonSchemaFile is provided and no dynamic schema, use default
      if (!jsonSchemaFile) {
        const defaultSchema = {
          type: "object",
          properties: {
            metadata: {
              type: "object",
              title: "Metadata",
              properties: {
                name: {
                  type: "string",
                  title: "Name",
                  default: "",
                },
                namespace: {
                  type: "string",
                  title: "Namespace",
                  default: "default",
                },
              },
            },
            spec: {
              type: "object",
              title: "Specification",
              properties: {},
            },
          },
        }
        setSchema(defaultSchema)
        showNotification("Using default schema", "success")
        return
      }

      // First try to load from localStorage
      const savedSchema = localStorage.getItem(`schema_${jsonSchemaFile}`)
      if (savedSchema) {
        try {
          const schemaData = JSON.parse(savedSchema)
          setSchema({ ...schemaData })
          showNotification("Schema loaded from cache!", "success")
          return
        } catch (error) {
          console.error("Error parsing saved schema:", error)
          localStorage.removeItem(`schema_${jsonSchemaFile}`) // Remove corrupted data
        }
      }

      // Try to load from the schema editor's localStorage (more likely to exist)
      const schemaEditorKey = `schema_${context.environment}_${context.product}`
      const schemaEditorData = localStorage.getItem(schemaEditorKey)
      if (schemaEditorData) {
        try {
          const parsedData = JSON.parse(schemaEditorData)
          if (parsedData && typeof parsedData === "object") {
            setSchema({ ...parsedData })
            localStorage.setItem(`schema_${jsonSchemaFile}`, JSON.stringify(parsedData))
            showNotification("Schema loaded from Schema Editor!", "success")
            return
          }
        } catch (error) {
          console.error("Error parsing schema editor data:", error)
        }
      }

      // If no schema found, create a basic default schema
      const defaultSchema = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            title: "Metadata",
            properties: {
              name: {
                type: "string",
                title: "Name",
                default: "",
              },
              namespace: {
                type: "string",
                title: "Namespace",
                default: "default",
              },
            },
          },
          spec: {
            type: "object",
            title: "Specification",
            properties: {},
          },
        },
      }

      setSchema(defaultSchema)
      localStorage.setItem(`schema_${jsonSchemaFile}`, JSON.stringify(defaultSchema))
      showNotification("Using default schema", "success")
    } catch (error) {
      console.error("Error loading schema:", error)
      showNotification("Error loading schema", "error")
    }
  }

  // Load YAML content from localStorage or use initial content
  const loadYamlContent = async () => {
    try {
      setIsLoading(true)

      // Try to load from localStorage
      const savedContent = localStorage.getItem(getStorageKey("content"))
      if (savedContent) {
        setYamlContent(savedContent)
        try {
          const parsedValues = yaml.load(savedContent) as any
          setFormData(parsedValues || {})
        } catch (e) {
          console.error("Error parsing YAML:", e)
        }
        setIsLoading(false)
        return
      }

      // Use initial content or default
      const defaultContent =
        initialContent ||
        `# ${targetYamlFilename}
apiVersion: v1
kind: ConfigMap
metadata:
  name: example-config
  namespace: default
data:
  key: value`

      setYamlContent(defaultContent)
      try {
        const parsedValues = yaml.load(defaultContent) as any
        setFormData(parsedValues || {})
      } catch (e) {
        console.error("Error parsing YAML:", e)
      }
      setIsLoading(false)
    } catch (error) {
      console.error("Error loading YAML content:", error)
      setIsLoading(false)
    }
  }

  // Notify parent component of changes
  useEffect(() => {
    if (onChange) {
      onChange(yamlContent)
    }
  }, [yamlContent])

  // const showNotification = (message: string, type: "success" | "error" = "success") => {
  //   // Simple toast notification - you could replace with a proper toast library
  //   const toast = document.createElement("div")
  //   toast.textContent = message
  //   toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
  //     type === "success" ? "bg-green-500" : "bg-red-500"
  //   }`
  //   document.body.appendChild(toast)
  //   setTimeout(() => document.body.removeChild(toast), 2000)
  // }
  const showNotification = (message: string, type: "success" | "error" = "success") => {
    // Silent mode - do nothing
    console.log(`[${type.toUpperCase()}] ${message}`) // Optional: log to console instead
  }

  const handleYamlChange = (value: string | undefined) => {
    if (value === undefined) return
    setYamlContent(value)
    try {
      const parsedValues = yaml.load(value) as any
      setFormData(parsedValues || {})
    } catch (e) {
      console.error("Error parsing YAML:", e)
    }

    // Save to localStorage
    localStorage.setItem(getStorageKey("content"), value)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setYamlContent(content)
      try {
        const parsedValues = yaml.load(content) as any
        setFormData(parsedValues || {})
      } catch (e) {
        console.error("Error parsing YAML:", e)
      }
      localStorage.setItem(getStorageKey("content"), content)
    }
    reader.readAsText(file)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  // Vertical splitter drag functionality (between form and yaml editor)
  const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingVertical(true)
  }, [])

  const handleVerticalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingVertical || !leftColumnRef.current) return

      const containerRect = leftColumnRef.current.getBoundingClientRect()
      const newTopHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100

      // Constrain between 30% and 80%
      const constrainedHeight = Math.min(Math.max(newTopHeight, 30), 80)
      setVerticalSplitRatio(constrainedHeight)
    },
    [isDraggingVertical],
  )

  const handleVerticalMouseUp = useCallback(() => {
    setIsDraggingVertical(false)
  }, [])

  useEffect(() => {
    if (isDraggingVertical) {
      document.addEventListener("mousemove", handleVerticalMouseMove)
      document.addEventListener("mouseup", handleVerticalMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleVerticalMouseMove)
        document.removeEventListener("mouseup", handleVerticalMouseUp)
      }
    }
  }, [isDraggingVertical, handleVerticalMouseMove, handleVerticalMouseUp])

  // Get the title for a property from the schema if available
  const getPropertyTitle = (path: string[], key: string): string => {
    if (!schema) return key

    try {
      let current = schema

      if (path.length === 0) {
        if (current.properties && current.properties[key] && current.properties[key].title) {
          return current.properties[key].title
        }
        return key
      }

      for (let i = 0; i < path.length; i++) {
        if (!current.properties || !current.properties[path[i]]) {
          return key
        }
        current = current.properties[path[i]]
      }

      if (current.properties && current.properties[key] && current.properties[key].title) {
        return current.properties[key].title
      }

      return key
    } catch (error) {
      console.error("Error getting property title:", error)
      return key
    }
  }

  // Update form data and regenerate YAML
  const updateFormData = (path: string[], value: any) => {
    const newFormData = JSON.parse(JSON.stringify(formData))
    let current = newFormData

    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]] === undefined) {
        if (i === path.length - 2 && Array.isArray(value)) {
          current[path[i]] = []
        } else {
          current[path[i]] = {}
        }
      }
      current = current[path[i]]
    }

    current[path[path.length - 1]] = value
    setFormData(newFormData)

    const newYamlContent = yaml.dump(newFormData)
    setYamlContent(newYamlContent)

    if (onChange) {
      onChange(newYamlContent)
    }

    localStorage.setItem(getStorageKey("content"), newYamlContent)
  }

  // Add a new item to an array
  const addArrayItem = (path: string[], arrayType: string, isObject = false) => {
    const newFormData = JSON.parse(JSON.stringify(formData))
    let current = newFormData

    for (let i = 0; i < path.length; i++) {
      if (current[path[i]] === undefined) {
        current[path[i]] = i === path.length - 1 ? [] : {}
      }
      current = current[path[i]]
    }

    if (isObject) {
      if (path[path.length - 1] === "ports") {
        current.push({ name: "", port: 0 })
      } else {
        current.push({})
      }
    } else if (arrayType === "number") {
      current.push(0)
    } else {
      current.push("")
    }

    setFormData(newFormData)
    const newYamlContent = yaml.dump(newFormData)
    setYamlContent(newYamlContent)

    if (onChange) {
      onChange(newYamlContent)
    }

    localStorage.setItem(getStorageKey("content"), newYamlContent)
  }

  // Remove an item from an array
  const removeArrayItem = (path: string[], index: number) => {
    const newFormData = JSON.parse(JSON.stringify(formData))
    let current = newFormData

    for (let i = 0; i < path.length; i++) {
      if (current[path[i]] === undefined) return
      current = current[path[i]]
    }

    if (Array.isArray(current)) {
      current.splice(index, 1)
      setFormData(newFormData)
      const newYamlContent = yaml.dump(newFormData)
      setYamlContent(newYamlContent)

      if (onChange) {
        onChange(newYamlContent)
      }

      localStorage.setItem(getStorageKey("content"), newYamlContent)
    }
  }

  // Update a property of an object in an array
  const updateObjectArrayItem = (path: string[], index: number, key: string, value: any) => {
    const newFormData = JSON.parse(JSON.stringify(formData))
    let current = newFormData

    for (let i = 0; i < path.length; i++) {
      if (current[path[i]] === undefined) return
      current = current[path[i]]
    }

    if (Array.isArray(current) && current[index]) {
      current[index][key] = value
      setFormData(newFormData)
      const newYamlContent = yaml.dump(newFormData)
      setYamlContent(newYamlContent)

      if (onChange) {
        onChange(newYamlContent)
      }

      localStorage.setItem(getStorageKey("content"), newYamlContent)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification("Copied to clipboard!")
  }

  const copyEditorContent = () => {
    copyToClipboard(yamlContent)
  }

  const downloadYaml = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = targetYamlFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const refreshSchema = () => {
    // Clear cached schema and reload
    localStorage.removeItem(`schema_${jsonSchemaFile}`)
    loadSchema()
  }

  // Recursively render form fields
  const renderFormFields = (data: any, basePath: string[] = [], level = 0) => {
    if (!data) return null

    return Object.entries(data).map(([key, value]) => {
      const path = [...basePath, key]
      const displayName = getPropertyTitle(basePath, key)

      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "object") {
          // Object array
          return (
            <div key={path.join(".")} className={`space-y-3 ${level > 0 ? "ml-4 pl-4 border-l-2 border-border" : ""}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">{displayName}</Label>
                <Badge variant="secondary" className="text-xs">
                  Array
                </Badge>
              </div>
              <div className="space-y-3">
                {value.map((item, index) => (
                  <Card key={`${path.join(".")}-${index}`} className="relative">
                    <CardContent className="pt-4 pr-10">
                      <div className="space-y-3">
                        {Object.entries(item).map(([itemKey, itemValue]) => (
                          <div key={`${path.join(".")}-${index}-${itemKey}`} className="flex items-center space-x-3">
                            <Label className="w-20 text-sm">
                              {getPropertyTitle([...path, index.toString()], itemKey)}
                            </Label>
                            <div className="flex-1">
                              {typeof itemValue === "number" ? (
                                <Input
                                  type="number"
                                  value={itemValue || 0}
                                  onChange={(e) => updateObjectArrayItem(path, index, itemKey, Number(e.target.value))}
                                  className="h-8"
                                />
                              ) : typeof itemValue === "boolean" ? (
                                <Checkbox
                                  checked={!!itemValue}
                                  onCheckedChange={(checked) => updateObjectArrayItem(path, index, itemKey, checked)}
                                />
                              ) : (
                                <Input
                                  type="text"
                                  value={itemValue || ""}
                                  onChange={(e) => updateObjectArrayItem(path, index, itemKey, e.target.value)}
                                  className="h-8"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 h-6 w-6 p-0"
                        onClick={() => removeArrayItem(path, index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(path, "object", true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          )
        } else {
          // Primitive array
          return (
            <div key={path.join(".")} className={`space-y-3 ${level > 0 ? "ml-4 pl-4 border-l-2 border-border" : ""}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">{displayName}</Label>
                <Badge variant="secondary" className="text-xs">
                  Array
                </Badge>
              </div>
              <div className="space-y-2">
                {value.map((item, index) => (
                  <div key={`${path.join(".")}-${index}`} className="flex items-center space-x-2">
                    <div className="flex-1">
                      {typeof item === "number" ? (
                        <Input
                          type="number"
                          value={item || 0}
                          onChange={(e) => {
                            const newArray = [...value]
                            newArray[index] = Number(e.target.value)
                            updateFormData(path, newArray)
                          }}
                          className="h-8"
                        />
                      ) : (
                        <Input
                          type="text"
                          value={item || ""}
                          onChange={(e) => {
                            const newArray = [...value]
                            newArray[index] = e.target.value
                            updateFormData(path, newArray)
                          }}
                          className="h-8"
                        />
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeArrayItem(path, index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(path, typeof value[0] === "number" ? "number" : "text")}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          )
        }
      } else if (typeof value === "object" && value !== null) {
        // Nested object
        return (
          <div key={path.join(".")} className={`space-y-4 ${level > 0 ? "ml-4 pl-4 border-l-2 border-border" : ""}`}>
            <div className="flex items-center space-x-2">
              <Label className="text-base font-semibold text-foreground">{displayName}</Label>
            </div>
            <div className="space-y-4">{renderFormFields(value, path, level + 1)}</div>
          </div>
        )
      } else {
        // Simple field
        return (
          <div key={path.join(".")} className={`space-y-2 ${level > 0 ? "ml-4 pl-4 border-l-2 border-border" : ""}`}>
            <div className="flex items-center space-x-3">
              <Label className="w-32 text-sm font-medium text-foreground">{displayName}</Label>
              <div className="flex-1">
                {typeof value === "boolean" ? (
                  <Checkbox checked={!!value} onCheckedChange={(checked) => updateFormData(path, checked)} />
                ) : typeof value === "number" ? (
                  <Input
                    type="number"
                    value={value || 0}
                    onChange={(e) => updateFormData(path, Number(e.target.value))}
                    className="h-8"
                  />
                ) : (
                  <Input
                    type="text"
                    value={value || ""}
                    onChange={(e) => updateFormData(path, e.target.value)}
                    className="h-8"
                  />
                )}
              </div>
            </div>
          </div>
        )
      }
    })
  }

  /**
   * Renders the layout based on the selected layout mode
   * For side-by-side: Form editor on left, YAML editor on right with 50:50 default split
   * When showYamlEditor is false, form editor takes full width
   */
  const renderLayout = () => {
    if (layout === "side-by-side") {
      // True side-by-side layout (horizontal split)
      return (
        <div className="flex gap-3 flex-1 min-h-0" ref={containerRef}>
          {/* Left Panel - Form Editor */}
          <div
            className="flex flex-col min-w-0 overflow-hidden"
            style={{
              width: showYamlEditor ? `${leftPanelWidth}%` : '100%'
            }}
            ref={leftColumnRef}
          >
            <Card className="flex flex-col m-4 mr-2 overflow-hidden h-full">
              {!hideHeader && (
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-lg">Form Editor</CardTitle>
                </CardHeader>
              )}
              <CardContent className={`flex-1 overflow-hidden p-0 ${hideHeader ? 'pt-4' : ''}`}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="space-y-6 p-4">{renderFormFields(formData, [], 0)}</div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Horizontal Splitter - Only show when YAML editor is visible */}
          {showYamlEditor && (
            <div className="relative group">
              <div
                className="w-0.5 bg-transparent hover:bg-primary/20 cursor-col-resize flex-shrink-0 transition-all duration-200 group-hover:w-1 group-hover:bg-border"
                onMouseDown={handleHorizontalMouseDown}
                role="separator"
                aria-label="Resize panels"
                style={{
                  backgroundColor: isDraggingHorizontal ? "hsl(var(--primary))" : undefined,
                  width: isDraggingHorizontal ? "4px" : undefined,
                }}
              />
              {/* Invisible hover area for easier targeting */}
              <div className="absolute inset-0 -left-2 -right-2 cursor-col-resize" onMouseDown={handleHorizontalMouseDown} />
            </div>
          )}

          {/* Right Panel - YAML Editor */}
          {showYamlEditor && (
            <div
              className="flex flex-col min-w-0 overflow-hidden"
              style={{ width: `${100 - leftPanelWidth}%` }}
            >
              <Card className="flex flex-col m-4 ml-2 overflow-hidden h-full">
                {!hideHeader && (
                  <CardHeader className="pb-2 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">YAML Editor</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={copyEditorContent}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsYamlExpanded(!isYamlExpanded)}>
                          {isYamlExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                )}
                <CardContent className={`p-0 flex-1 overflow-hidden ${hideHeader ? 'pt-4' : ''}`}>
                  <div className="h-full border rounded-b-lg overflow-hidden">
                    <CodeMirror
                      value={yamlContent}
                      height="100%"
                      theme={oneDark}
                      extensions={[
                        yamlLanguage(),
                        EditorView.theme({
                          "&": { height: "100%" },
                          ".cm-editor": { height: "100%" },
                          ".cm-scroller": { overflow: "auto", maxHeight: "100%" },
                        }),
                      ]}
                      onChange={(value) => handleYamlChange(value)}
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
                      className="text-sm h-full"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )
    } else {
      // Stacked layout (vertical split) - Form on top, YAML on bottom
      return (
        <div className="flex flex-col gap-3 flex-1 min-h-0" ref={leftColumnRef}>
          {/* Form Editor */}
          <Card
            className="flex flex-col overflow-hidden"
            style={{ height: showYamlEditor ? `${verticalSplitRatio}%` : "100%" }}
          >
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-lg">Form Editor</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-6 p-4">{renderFormFields(formData, [], 0)}</div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Vertical Splitter - Hidden by default, shows on hover */}
          {showYamlEditor && (
            <div className="relative group">
              <div
                className="h-0.5 bg-transparent hover:bg-primary/20 cursor-row-resize flex-shrink-0 transition-all duration-200 group-hover:h-1 group-hover:bg-border"
                onMouseDown={handleVerticalMouseDown}
                style={{
                  backgroundColor: isDraggingVertical ? "hsl(var(--primary))" : undefined,
                  height: isDraggingVertical ? "4px" : undefined,
                }}
              />
              {/* Invisible hover area for easier targeting */}
              <div
                className="absolute inset-0 -top-2 -bottom-2 cursor-row-resize"
                onMouseDown={handleVerticalMouseDown}
              />
            </div>
          )}

          {/* YAML Editor */}
          {showYamlEditor && (
            <Card className="flex flex-col overflow-hidden" style={{ height: `${100 - verticalSplitRatio}%` }}>
              <CardHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">YAML Editor</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={copyEditorContent}>
                      <Copy className="h-4 w-4 mr-2" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsYamlExpanded(!isYamlExpanded)}>
                      {isYamlExpanded ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="h-full border rounded-b-lg overflow-hidden">
                  <CodeMirror
                    value={yamlContent}
                    height="100%"
                    theme={oneDark}
                    extensions={[
                      yamlLanguage(),
                      EditorView.theme({
                        "&": {
                          height: "100%",
                        },
                        ".cm-editor": {
                          height: "100%",
                        },
                        ".cm-scroller": {
                          overflow: "auto",
                          maxHeight: "100%",
                        },
                      }),
                    ]}
                    onChange={(value) => handleYamlChange(value)}
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
                    className="text-sm h-full"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )
    }
  }

  // Main Content
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Conditional Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between p-4 border-b bg-card flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground">{title || `${targetYamlFilename} Editor`}</h1>
          <div className="flex items-center space-x-2">
            {customActions}
            <Button variant="outline" size="sm" onClick={triggerFileInput}>
              <Upload className="h-4 w-4 mr-2" />
              Load File
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".yaml,.yml" onChange={handleFileUpload} />
            <Button variant="outline" size="sm" onClick={() => setShowYamlEditor(!showYamlEditor)}>
              {showYamlEditor ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showYamlEditor ? "Hide YAML" : "Show YAML"}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadYaml}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={refreshSchema}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Schema
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={hideHeader ? "h-full" : "flex-1"}>
        {renderLayout()}
      </div>
    </div>
  )
}

export default YamlEditor
