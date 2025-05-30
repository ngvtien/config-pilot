"use client"

import type React from "react"
import { useRef, useState, useEffect, useCallback } from "react"
import yaml from "js-yaml"
import { Button } from "@/renderer/components/ui/button"
import { Card, CardHeader } from "@/renderer/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/renderer/components/ui/tabs"
import { Copy } from "lucide-react"
import CodeMirror from "@uiw/react-codemirror"
import { yaml as yamlLanguage } from "@codemirror/lang-yaml"
import { json as jsonLanguage } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"
import { jsonTheme, jsonReadOnlyExtensions, readOnlyExtensions } from "@/renderer/lib/codemirror-themes"
import YamlEditor, { type YamlEditorLayout } from "@/renderer/components/yaml-editor"
import type { ContextData } from "@/shared/types/context-data"
import { generateConfigMap, generateConfigJson } from "@/renderer/lib/config-generator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"
import { buildConfigPath } from "@/renderer/lib/path-utils"

interface ValueEditorProps {
  initialValue?: string
  onChange?: (value: string) => void
  environment?: string
  schemaPath?: string
  layout?: YamlEditorLayout
  context?: ContextData
  baseDirectory?: string
}

const ValueEditor: React.FC<ValueEditorProps> = ({
  initialValue = `replicaCount: 1
image:
  repository: nginx
  tag: "1.21.0"
service:
  type: ClusterIP
  port: 80
ingress:
  enabled: false
  hosts:
    - host: example.local
      paths: ["/"]
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi`,
  onChange,
  environment = "dev",
  schemaPath = "/src/mock/schema/values.schema.json",
  layout = "side-by-side",
  context,
  baseDirectory = "/opt/config-pilot/configs",
}) => {
  const [yamlContent, setYamlContent] = useState(initialValue)
  const [displayFormat, setDisplayFormat] = useState<"configjson" | "configmap">("configjson")
  const [leftPanelWidth, setLeftPanelWidth] = useState(60) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use provided context or create one from environment prop for backward compatibility
  const editorContext: ContextData = context || {
    environment: environment as any,
    instance: 0,
    product: "helm-values",
    customer: "default",
    version: "1.0.0",
    baseHostUrl: "",
  }

  // Build the file path using the path utility
  const filePath = buildConfigPath(
    baseDirectory,
    editorContext.customer,
    editorContext.environment,
    editorContext.instance,
    editorContext.product,
    "values.yaml",
  )

  // Handle YAML content changes from the YamlEditor
  const handleYamlChange = (content: string) => {
    setYamlContent(content)
    if (onChange) {
      onChange(content)
    }
  }

  // Horizontal splitter drag functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      // Constrain between 20% and 80%
      const constrainedWidth = Math.min(Math.max(newLeftWidth, 20), 80)
      setLeftPanelWidth(constrainedWidth)
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const generateConfigMapOutput = () => {
    try {
      const values = (yaml.load(yamlContent) as Record<string, any>) || {}

      // Convert nested objects to strings for ConfigMap
      const flattenedValues: Record<string, string> = {}
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          flattenedValues[key] = JSON.stringify(value)
        } else {
          flattenedValues[key] = String(value)
        }
      })

      return generateConfigMap(
        flattenedValues,
        editorContext.environment || "default",
        `${editorContext.product || "app"}-config`,
      )
    } catch (error) {
      console.error("Error generating ConfigMap:", error)
      return "Error generating ConfigMap"
    }
  }

  const generateConfigJsonOutput = () => {
    try {
      const values = (yaml.load(yamlContent) as Record<string, any>) || {}

      // Convert to string values for the generator
      const stringValues: Record<string, string> = {}
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          stringValues[key] = JSON.stringify(value)
        } else {
          stringValues[key] = String(value)
        }
      })

      return generateConfigJson(stringValues)
    } catch (error) {
      console.error("Error generating Config.json:", error)
      return "Error generating Config.json"
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Simple toast notification
    const toast = document.createElement("div")
    toast.textContent = "Copied to clipboard!"
    toast.className = "fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 bg-green-500"
    document.body.appendChild(toast)
    setTimeout(() => document.body.removeChild(toast), 2000)
  }

  const renderDisplayContent = () => {
    let content = ""
    let language: any = yamlLanguage()
    let theme = oneDark
    let extensions = readOnlyExtensions

    switch (displayFormat) {
      case "configmap":
        content = generateConfigMapOutput()
        language = yamlLanguage()
        theme = oneDark
        extensions = readOnlyExtensions
        break
      case "configjson":
        content = generateConfigJsonOutput()
        language = jsonLanguage()
        theme = jsonTheme
        extensions = jsonReadOnlyExtensions
        break
    }

    return (
      <div className="h-full">
        <CodeMirror
          value={content}
          height="100%"
          theme={theme}
          extensions={[language, ...extensions]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            bracketMatching: true,
            closeBrackets: false,
            autocompletion: false,
            highlightSelectionMatches: false,
          }}
          className="text-sm"
        />
      </div>
    )
  }

  if (layout === "stacked") {
    // For stacked layout, just use the YamlEditor without output panel
    return (
      <YamlEditor
        targetYamlFilename="values.yaml"
        jsonSchemaFile={schemaPath}
        context={editorContext}
        layout={layout}
        initialContent={initialValue}
        onChange={handleYamlChange}
        title="Helm Values Editor"
      />
    )
  }

  // For side-by-side layout, show YamlEditor + Output panel
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Helm Values Editor</h1>
          <p className="text-muted-foreground">
            Editing for <span className="font-medium font-mono text-sm">{filePath}</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden" ref={containerRef}>
        {/* Left Panel - YamlEditor */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: `${leftPanelWidth}%` }}>
          <YamlEditor
            targetYamlFilename="values.yaml"
            jsonSchemaFile={schemaPath}
            context={editorContext}
            layout="stacked"
            initialContent={initialValue}
            onChange={handleYamlChange}
            title=""
          />
        </div>

        {/* Horizontal Splitter - Hidden by default, shows on hover */}
        <div className="relative group">
          <div
            className="w-0.5 bg-transparent hover:bg-primary/20 cursor-col-resize flex-shrink-0 transition-all duration-200 group-hover:w-1 group-hover:bg-border"
            onMouseDown={handleMouseDown}
            style={{
              backgroundColor: isDragging ? "hsl(var(--primary))" : undefined,
              width: isDragging ? "4px" : undefined,
            }}
          />
          {/* Invisible hover area for easier targeting */}
          <div className="absolute inset-0 -left-2 -right-2 cursor-col-resize" onMouseDown={handleMouseDown} />
        </div>

        {/* Right Panel - Output Display */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: `${100 - leftPanelWidth}%` }}>
          <Card className="flex flex-col m-4 ml-2 overflow-hidden h-full">
            <CardHeader className="pb-0 flex-shrink-0">
              <Tabs
                value={displayFormat}
                onValueChange={(value) => setDisplayFormat(value as "configjson" | "configmap")}
                className="h-full flex flex-col"
              >
                <div className="flex justify-between items-center">
                  <TabsList className="grid w-auto grid-cols-2 flex-shrink-0">
                    <TabsTrigger value="configjson">config.json</TabsTrigger>
                    <TabsTrigger value="configmap">ConfigMap</TabsTrigger>
                  </TabsList>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const content =
                              displayFormat === "configmap" ? generateConfigMapOutput() : generateConfigJsonOutput()
                            copyToClipboard(content)
                          }}
                          className="hover:bg-muted"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy to clipboard</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <TabsContent value="configjson" className="m-0 flex-1 overflow-hidden">
                  <div className="h-full overflow-hidden border rounded-lg">{renderDisplayContent()}</div>
                </TabsContent>
                <TabsContent value="configmap" className="m-0 flex-1 overflow-hidden">
                  <div className="h-full overflow-hidden border rounded-lg">{renderDisplayContent()}</div>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ValueEditor
