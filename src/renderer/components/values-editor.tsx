"use client"

import type React from "react"
import { useState } from "react"
import yaml from "js-yaml"
import { Button } from "@/renderer/components/ui/button"
import { Card, CardHeader } from "@/renderer/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/renderer/components/ui/tabs"
import { Copy } from "lucide-react"
import YamlEditor, { type YamlEditorLayout } from "@/renderer/components/yaml-editor"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { ContextData } from "@/shared/types/context-data"
import { generateConfigMap } from "@/renderer/lib/config-generator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"
import { buildConfigPath } from "@/renderer/lib/path-utils"
import { useEditorTheme } from '@/renderer/hooks/useEditorTheme'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"

interface ValuesEditorProps {
  initialValue?: string
  onChange?: (value: string) => void
  environment?: string
  schemaPath?: string
  layout?: YamlEditorLayout
  context?: ContextData
  baseDirectory?: string
}

const ValuesEditor: React.FC<ValuesEditorProps> = ({
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

  //const { codeMirrorTheme, jsonCodeMirrorTheme, jsonExtensions } = useEditorTheme()
  const { syntaxHighlighterTheme, syntaxHighlighterCustomStyle } = useEditorTheme()

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

  const generateConfigMapOutput = () => {
    try {
      const values = (yaml.load(yamlContent) as Record<string, any>) || {}

      // Convert nested objects to strings for ConfigMap using YAML formatting
      const flattenedValues: Record<string, string> = {}
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          // Use YAML dump for proper formatting instead of JSON.stringify
          flattenedValues[key] = yaml.dump(value, { flowLevel: 0, indent: 2 }).trim()
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

      // Keep objects as objects for JSON output, only stringify when necessary
      const processedValues: Record<string, any> = {}
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          // Keep objects as objects for proper JSON formatting
          processedValues[key] = value
        } else {
          processedValues[key] = value
        }
      })

      // Pass the processed values directly to maintain proper JSON structure
      return JSON.stringify({
        metadata: {
          generatedAt: new Date().toISOString(),
          type: "configuration",
        },
        configuration: processedValues,
      }, null, 2)
    } catch (error) {
      console.error("Error generating Config.json:", error)
      return "Error generating Config.json"
    }
  }
  /**
   * Copies the provided text to the clipboard
   * @param text - The text content to copy
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  /**
   * Renders the display content using JsonEditor for JSON and YamlEditor for YAML
   */
  const renderDisplayContent = () => {
    if (displayFormat === "configjson") {
      const content = generateConfigJsonOutput()
      return (
        <div className="h-full" data-testid="json-output-editor">
          <SyntaxHighlighter
            readOnly={true}
            language="json"
            style={syntaxHighlighterTheme}
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{
              ...syntaxHighlighterCustomStyle,
              height: '100%'
            }}
            className="border-0"
          >
            {content}
          </SyntaxHighlighter>


        </div>
      )
    } else {
      // For ConfigMap (YAML), keep using the original CodeMirror approach
      const content = generateConfigMapOutput()
      return (
        <div className="h-full" data-testid="yaml-output-editor">
          <SyntaxHighlighter
            readOnly={true}
            language="yaml"
            style={syntaxHighlighterTheme}
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{
              ...syntaxHighlighterCustomStyle,
              height: '100%'
            }}
            className="border-0"
          >
            {content}
          </SyntaxHighlighter>

        </div>
      )
    }
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

      {/* Main Content with ResizablePanelGroup */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" persistenceKey="values-panel-form" className="h-full">
          {/* Left Panel - YamlEditor */}
          <ResizablePanel id="left-panel-form" defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col">
              <YamlEditor
                targetYamlFilename="values.yaml"
                jsonSchemaFile={schemaPath}
                context={editorContext}
                layout="stacked"
                initialContent={initialValue}
                onChange={handleYamlChange}
                title=""
                persistenceKey="value-editor"
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Output Display */}
          <ResizablePanel id="right-panel-form" defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col">
              <Card className="flex flex-col m-4 ml-2 overflow-hidden h-full">
                <CardHeader className="pb-0 flex-shrink-0">
                  <Tabs
                    value={displayFormat}
                    onValueChange={(value: any) => setDisplayFormat(value as "configjson" | "configmap")}
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
                              aria-label="Copy to clipboard"
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
export default ValuesEditor
