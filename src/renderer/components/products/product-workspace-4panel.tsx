"use client"

import React from "react"
import { Package, FolderTree, FileEdit, Terminal } from "lucide-react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { cn } from "@/lib/utils"
import { WorkspacePanel } from "@/renderer/components/ui/workspace-panel"

/**
 * Resizable handle component with visual indicator
 */
interface ResizableHandleProps {
  direction?: "horizontal" | "vertical"
  className?: string
}

const ResizableHandle: React.FC<ResizableHandleProps> = ({
  direction = "horizontal",
  className
}) => {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative flex items-center justify-center bg-border transition-colors hover:bg-accent",
        direction === "horizontal"
          ? "w-1 cursor-col-resize"
          : "h-1 cursor-row-resize",
        className
      )}
    >
      <div
        className={cn(
          "bg-border transition-colors group-hover:bg-accent-foreground",
          direction === "horizontal"
            ? "h-4 w-0.5"
            : "w-4 h-0.5"
        )}
      />
    </PanelResizeHandle>
  )
}

/**
 * 4-panel workspace layout for Product & Deployment Designer
 * Layout: [Navigator | FileExplorer | Editor]
 *         [        Console Output         ]
 */
interface ProductWorkspace4PanelProps {
  navigator: React.ReactNode
  fileExplorer: React.ReactNode
  editor: React.ReactNode
  consoleOutput: React.ReactNode
  persistenceKey?: string
}

export const ProductWorkspace4Panel: React.FC<ProductWorkspace4PanelProps> = ({
  navigator,
  fileExplorer,
  editor,
  consoleOutput,
  persistenceKey = "product-workspace-4panel"
}) => {
  return (
    <div className="h-full w-full">
      <PanelGroup
        direction="vertical"
        className="h-full"
        autoSaveId={persistenceKey}
      >
        {/* Top Section - 3 panels horizontally */}
        <Panel defaultSize={75} minSize={50} maxSize={85}>
          <PanelGroup
            direction="horizontal"
            autoSaveId={`${persistenceKey}-top-horizontal`}
          >
            {/* Panel 1 - Products & Components Navigator */}
            <WorkspacePanel
              id="navigator"
              title="Product Navigator"
              subtitle="Browse & Select"
              purpose="Choose products and components to work with"
              actionHint="Click to select"
              icon={<Package className="h-4 w-4" />}
              statusBadge={{ text: "3 Products", variant: "secondary" }}
              defaultSize={25}
              minSize={15}
              maxSize={40}
            >
              {navigator}
            </WorkspacePanel>

            <ResizableHandle direction="horizontal" />

            {/* Panel 2 - File Explorer */}
            <WorkspacePanel
              id="file-explorer"
              title="Component Structure"
              subtitle="Resources & Templates"
              purpose="Navigate and manage configuration files"
              actionHint="Double-click to open"
              icon={<FolderTree className="h-4 w-4" />}
              statusBadge={{ text: "12 Files", variant: "outline" }}
              defaultSize={25}
              minSize={15}
              maxSize={40}
            >
              {fileExplorer}
            </WorkspacePanel>

            <ResizableHandle direction="horizontal" />

            {/* Panel 3 - Editor */}
            <WorkspacePanel
              id="editor"
              title="Resource Configuration Editor"
              subtitle="YAML/JSON"
              purpose="Edit and validate configuration files"
              actionHint="Auto-save enabled"
              icon={<FileEdit className="h-4 w-4" />}
              statusBadge={{ text: "Modified", variant: "destructive" }}
              defaultSize={50}
              minSize={30}
              maxSize={70}
            >
              {editor}
            </WorkspacePanel>
          </PanelGroup>
        </Panel>

        <ResizableHandle direction="vertical" />

        {/* Panel 4 - Console Output (spans full width) */}
        <WorkspacePanel
          id="console-output"
          title="Build & Deploy Console"
          subtitle="Real-time Output"
          purpose="Monitor deployment progress and debug issues"
          actionHint="Scroll for history"
          icon={<Terminal className="h-4 w-4" />}
          statusBadge={{ text: "Running", variant: "default" }}
          collapsible={true}
          defaultSize={25}
          minSize={15}
          maxSize={50}
        >
          {consoleOutput}
        </WorkspacePanel>
      </PanelGroup>
    </div>
  )
}