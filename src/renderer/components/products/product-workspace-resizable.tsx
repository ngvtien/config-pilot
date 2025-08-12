"use client"

import React, {  } from "react"
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
 * 5-panel workspace layout with output spanning columns 2 & 3 only
 */
interface WorkspaceLayoutProps {
  navigator: React.ReactNode
  editor: React.ReactNode
  context: React.ReactNode
  helm: React.ReactNode
  output: React.ReactNode
  persistenceKey?: string
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  navigator,
  editor,
  context,
  helm,
  output,
  persistenceKey = "workspace-layout-5panel"
}) => {
  return (
    <div className="h-full w-full">
      <PanelGroup 
        direction="horizontal" 
        className="h-full"
        autoSaveId={persistenceKey}
      >
        {/* Left Column - Navigator */}
        <WorkspacePanel
          id="navigator"
          title="Products & Components"
          defaultSize={20}
          minSize={15}
          maxSize={40}
        >
          {navigator}
        </WorkspacePanel>

        <PanelResizeHandle />

        {/* Middle & Right Columns - Editor/Helm and Context with Output below */}
        <Panel defaultSize={80} minSize={60} maxSize={85}>
          <PanelGroup direction="vertical" autoSaveId={`${persistenceKey}-main-vertical`}>
            {/* Top Section - Editor/Helm and Context side by side */}
            <Panel defaultSize={75} minSize={50} maxSize={85}>
              <PanelGroup direction="horizontal" autoSaveId={`${persistenceKey}-top-horizontal`}>
                {/* Middle Column - Editor and Helm stacked */}
                <Panel defaultSize={62} minSize={40} maxSize={80}>
                  <PanelGroup direction="vertical" autoSaveId={`${persistenceKey}-editor-helm-vertical`}>
                    <WorkspacePanel
                      id="editor"
                      title="Component Management"
                      defaultSize={60}
                      minSize={30}
                      maxSize={80}
                    >
                      {editor}
                    </WorkspacePanel>

                    <PanelResizeHandle />

                    <WorkspacePanel
                      id="helm"
                      title="Helm Chart Configuration"
                      collapsible={true}
                      defaultSize={40}
                      minSize={20}
                      maxSize={70}
                    >
                      {helm}
                    </WorkspacePanel>
                  </PanelGroup>
                </Panel>

                <PanelResizeHandle />

                {/* Right Column - Context */}
                <WorkspacePanel
                  id="context"
                  title="Resource Management"
                  defaultSize={38}
                  minSize={20}
                  maxSize={60}
                >
                  {context}
                </WorkspacePanel>
              </PanelGroup>
            </Panel>

            <ResizableHandle direction="vertical" />

            {/* Bottom Section - Output spanning only columns 2 & 3 */}
            <WorkspacePanel
              id="output"
              title="Output"
              collapsible={true}
              defaultSize={25}
              minSize={15}
              maxSize={50}
            >
              {output}
            </WorkspacePanel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  )
}