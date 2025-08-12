"use client"

import React, { useState } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/renderer/components/ui/resizable"
import { SmartFileTree } from "./smart-file-tree"
import { ContextAwareEditor } from "./context-aware-editor"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { X } from "lucide-react"

interface FileTreeNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  category: 'charts' | 'resources' | 'config'
  children?: FileTreeNode[]
  isExpanded?: boolean
  content?: string // Add this missing property
  metadata?: {
    fileType?: 'yaml' | 'json' | 'helm'
    resourceKind?: string
    chartType?: 'component' | 'product'
  }
}

interface IDEStyleEditorProps {
  productId?: string
  componentId?: string
  onAction?: (action: string, file: FileTreeNode) => void
  className?: string
}

/**
 * Main IDE-style editor component combining file tree and context-aware editor
 * Provides a familiar IDE experience for editing Helm charts and Kubernetes resources
 */
export function IDEStyleEditor({
  productId,
  componentId,
  onAction,
  className
}: IDEStyleEditorProps) {
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null)
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [openFiles, setOpenFiles] = useState<FileTreeNode[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)


  /**
   * Open a file in a new tab or switch to existing tab
   */
  const openFile = async (file: FileTreeNode) => {
    // Check if file is already open
    setOpenFiles(prev => {
      if (!prev.find(f => f.id === file.id)) {
        return [...prev, file]
      }
      return prev
    })

    setActiveFileId(file.id)

    // Load content if not already loaded
    if (!fileContents[file.id]) {
      try {
        const content = await loadFileContent(file)
        setFileContents(prev => ({
          ...prev,
          [file.id]: content
        }))
      } catch (error) {
        console.log('File not found, generating mock content:', error)
        const mockContent = generateMockContent(file)
        setFileContents(prev => ({
          ...prev,
          [file.id]: mockContent
        }))
      }
    }
  }

  /**
   * Load file content from disk or generate mock content
   */
  const loadFileContent = async (file: FileTreeNode): Promise<string> => {
    // First check if the file already has content (for dynamic resources)
    if (file.content) {
      return file.content
    }

    try {
      // Try to read actual file content first (for dynamic resources)
      if (window.electronAPI?.readFile) {
        return await window.electronAPI.readFile(file.path)
      }
    } catch (error) {
      // If file doesn't exist or can't be read, generate mock content
      console.log('File not found, generating mock content:', error)
    }
    return generateMockContent(file)
  }

  /**
   * Close a file tab
   */
  const closeFile = (fileId: string) => {
    setOpenFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId)
      // Fix: Use functional update to avoid stale closure
      setActiveFileId(currentActiveId => {
        if (currentActiveId === fileId) {
          return updated.length > 0 ? updated[0].id : null
        }
        return currentActiveId
      })
      return updated
    })
  }

  /**
   * Handle file selection from tree - now automatically opens file in tab
   */
  const handleFileSelect = async (file: FileTreeNode) => {
    setSelectedFile(file)
    // Automatically open the file in a tab
    await openFile(file)
  }

  // /**
  //  * Handle content changes in editor
  //  */
  // const handleContentChange = (content: string) => {
  //   if (!selectedFile) return
  //   setFileContents(prev => ({ ...prev, [selectedFile.id]: content }))
  // }
  /**
 * Handle content changes for specific file
 */
  const handleContentChange = (fileId: string, content: string) => {
    setFileContents(prev => ({ ...prev, [fileId]: content }))
  }

  /**
   * Generate mock content based on file type
   */
  const generateMockContent = (file: FileTreeNode): string => {
    if (file.name === 'Chart.yaml') {
      return `apiVersion: v2
name: ${componentId || productId || 'example'}
description: A Helm chart for ${file.metadata?.chartType || 'application'}
type: application
version: 0.1.0
appVersion: "1.0.0"
`
    }

    if (file.name === 'values.yaml') {
      return `# Default values for ${componentId || productId || 'example'}
replicaCount: 1

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 100m
    memory: 128Mi
`
    }

    if (file.name === 'values.schema.json') {
      return `{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "type": "object",
  "properties": {
    "replicaCount": {
      "type": "integer",
      "minimum": 1
    },
    "image": {
      "type": "object",
      "properties": {
        "repository": { "type": "string" },
        "tag": { "type": "string" },
        "pullPolicy": { "type": "string" }
      }
    }
  }
}
`
    }

    if (file.metadata?.resourceKind === 'Deployment') {
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${componentId || 'example'}
  labels:
    app: ${componentId || 'example'}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${componentId || 'example'}
  template:
    metadata:
      labels:
        app: ${componentId || 'example'}
    spec:
      containers:
      - name: ${componentId || 'example'}
        image: nginx:latest
        ports:
        - containerPort: 80
`
    }

    return `# ${file.name}
# Edit this file to configure your ${file.metadata?.resourceKind || 'resource'}
`
  }

  return (
    <div className={cn("h-full", className)}>
      <ResizablePanelGroup direction="horizontal">
        {/* File Tree Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <SmartFileTree
            productId={productId}
            componentId={componentId}
            onFileSelect={handleFileSelect}
            selectedFileId={selectedFile?.id}
            className="h-full border-r"
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor Panel */}
        <ResizablePanel defaultSize={75}>
          {openFiles.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* Tab Bar */}
              <Tabs value={activeFileId || ''} onValueChange={setActiveFileId} className="flex-none">
                <TabsList className="w-full justify-start rounded-none border-b">
                  {openFiles.map((file) => (
                    <TabsTrigger
                      key={file.id}
                      value={file.id}
                      className="flex items-center gap-2 max-w-[200px]"
                    >
                      <span className="truncate">{file.name}</span>
                      <X
                        className="h-3 w-3 hover:bg-muted rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          closeFile(file.id)
                        }}
                      />
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Editor Content */}
                {openFiles.map((file) => (
                  <TabsContent key={file.id} value={file.id} className="flex-1 mt-0">
                    <ContextAwareEditor
                      selectedFile={file}
                      content={fileContents[file.id] || ''}
                      onContentChange={(content) => handleContentChange(file.id, content)}
                      onAction={onAction}
                      className="h-full"
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a file to start editing
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}