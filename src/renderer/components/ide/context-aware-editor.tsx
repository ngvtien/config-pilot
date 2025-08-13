"use client"

import React, { useState, useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { yaml } from "@codemirror/lang-yaml"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { EditorView } from "@codemirror/view"
import { useEditorTheme } from "@/renderer/hooks/useEditorTheme"
import { Button } from "@/renderer/components/ui/button"
import { Badge } from "@/renderer/components/ui/badge"
import { Separator } from "@/renderer/components/ui/separator"
import { Play, Package, CheckCircle, FileText, Save, Download } from "lucide-react"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"

interface FileTreeNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  category: 'charts' | 'resources' | 'config'
  metadata?: {
    fileType?: 'yaml' | 'json' | 'helm' | 'markdown' | 'tpl'
    resourceKind?: string
    chartType?: 'component' | 'product'
  }
}

interface ContextAwareEditorProps {
  selectedFile?: FileTreeNode | null
  content?: string
  onContentChange?: (content: string) => void
  onAction?: (action: string, file: FileTreeNode) => void
  className?: string
}

/**
 * Get file extension from file name or path
 */
const getFileExtension = (fileName: string): string => {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Determine file type from extension
 */
const getFileTypeFromExtension = (extension: string): string => {
  switch (extension) {
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'tpl':
    case 'template':
      return 'tpl'
    case 'json':
      return 'json'
    case 'yaml':
    case 'yml':
      return 'yaml'
    default:
      return 'yaml' // Default fallback
  }
}

/**
 * Context-aware editor that adapts based on selected file type
 * Provides relevant actions for different file types
 */
export function ContextAwareEditor({
  selectedFile,
  content = '',
  onContentChange,
  onAction,
  className
}: ContextAwareEditorProps) {
  const { codeMirrorTheme, yamlExtensions, jsonExtensions } = useEditorTheme()

  const [isModified, setIsModified] = useState(false)

  // Determine language and extensions based on file type
  const editorConfig = useMemo(() => {
    if (!selectedFile) {
      return {
        language: yaml(),
        extensions: [yaml(), ...yamlExtensions],
        mode: 'yaml'
      }
    }

    // Get file type from metadata or infer from file extension
    let fileType = selectedFile.metadata?.fileType
    if (!fileType) {
      const extension = getFileExtension(selectedFile.name)
      fileType = getFileTypeFromExtension(extension) as any
    }

    switch (fileType) {
      case 'json':
        return {
          language: json(),
          extensions: [json(), ...jsonExtensions],

          mode: 'json'
        }
      case 'markdown':
        return {
          language: markdown(),
          extensions: [markdown(), ...jsonExtensions],

          mode: 'markdown'
        }
      case 'tpl':
        // TPL files are often template files, we'll treat them as YAML with syntax highlighting
        // You can customize this based on your specific TPL format
        return {
          language: yaml(),
          extensions: [yaml()],
          mode: 'tpl'
        }
      case 'yaml':
      default:
        return {
          language: yaml(),
          extensions: [yaml(), ...yamlExtensions],

          mode: 'yaml'
        }
    }
  }, [selectedFile])
  
  // Get context-specific actions based on file type
  const getContextActions = () => {
    if (!selectedFile) return []

    const actions = [
      {
        id: 'save',
        label: 'Save',
        icon: Save,
        variant: 'default' as const,
        disabled: !isModified
      },
      {
        id: 'download',
        label: 'Download',
        icon: Download,
        variant: 'outline' as const
      }
    ]

    // Chart-specific actions
    if (selectedFile.category === 'charts') {
      actions.push(
        {
          id: 'validate-chart',
          label: 'Validate Chart',
          icon: CheckCircle,
          variant: 'outline' as const
        },
        {
          id: 'package-helm',
          label: 'Package Helm',
          icon: Package,
          variant: 'outline' as const
        }
      )
    }

    // Resource-specific actions
    if (selectedFile.category === 'resources') {
      actions.push(
        {
          id: 'dry-run-k8s',
          label: 'Dry Run K8s',
          icon: Play,
          variant: 'outline' as const
        },
        {
          id: 'validate-resource',
          label: 'Validate Resource',
          icon: CheckCircle,
          variant: 'outline' as const
        }
      )
    }

    return actions
  }

  const contextActions = getContextActions()

  /**
   * Handle content changes
   */
  const handleContentChange = (value: string) => {
    setIsModified(value !== content)
    onContentChange?.(value)
  }

  /**
   * Handle action button clicks
   */
  const handleAction = (actionId: string) => {
    if (!selectedFile) return
    
    if (actionId === 'save') {
      setIsModified(false)
    }
    
    onAction?.(actionId, selectedFile)
  }

  if (!selectedFile) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className={cn(typography.heading.sm, "text-muted-foreground mb-2")}>No File Selected</h3>
          <p className={cn(typography.body.sm, "text-muted-foreground")}>Select a file from the explorer to start editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Editor Header */}
      <div className="border-b p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className={cn(typography.heading.sm, "font-medium")}>{selectedFile.name}</h3>
            {isModified && (
              <Badge variant="secondary" className="text-xs">Modified</Badge>
            )}
            {selectedFile.metadata?.resourceKind && (
              <Badge variant="outline" className="text-xs">
                {selectedFile.metadata.resourceKind}
              </Badge>
            )}
            {selectedFile.metadata?.chartType && (
              <Badge variant="secondary" className="text-xs">
                {selectedFile.metadata.chartType} chart
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {contextActions.map(action => {
              const Icon = action.icon
              return (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  disabled={action.disabled}
                  onClick={() => handleAction(action.id)}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {action.label}
                </Button>
              )
            })}
          </div>
        </div>
        <p className={cn(typography.body.xs, "text-muted-foreground")}>{selectedFile.path}</p>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={handleContentChange}
          height="100%"
          theme={codeMirrorTheme}
          extensions={editorConfig.extensions}
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
            searchKeymap: true,
          }}
        />
      </div>
    </div>
  )
}