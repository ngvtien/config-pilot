"use client"

import React, { useRef, useState, useEffect, useCallback } from "react"
import { ImperativePanelHandle, Panel } from "react-resizable-panels"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"
import { Button } from "@/renderer/components/ui/button"
import { Badge } from "@/renderer/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"
import { Maximize2, Minimize2, Info } from "lucide-react"

/**
 * Compact workspace panel with optimized header height
 */
interface WorkspacePanelProps {
  id: string
  title: string
  subtitle?: string
  purpose?: string
  statusBadge?: {
    text: string
    variant?: "default" | "secondary" | "destructive" | "outline"
  }
  actionHint?: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultSize?: number
  minSize?: number
  maxSize?: number
  className?: string
  collapsible?: boolean
  onToggle?: (isExpanded: boolean) => void
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  id,
  title,
  subtitle,
  purpose,
  statusBadge,
  actionHint,
  icon,
  children,
  defaultSize = 25,
  minSize = 10,
  maxSize = 90,
  className,
  collapsible = false,
  onToggle
}) => {
  const panelRef = useRef<ImperativePanelHandle>(null)
  const [isExpanded, setIsExpanded] = useState(collapsible)
  const [previousSize, setPreviousSize] = useState(defaultSize)

  /**
   * Check if panel is currently at max size and sync expanded state
   */
  const syncExpandedState = useCallback(() => {
    if (!panelRef.current || !collapsible) return
    
    const currentSize = panelRef.current.getSize()
    const isAtMaxSize = Math.abs(currentSize - maxSize) < 1 // Allow 1% tolerance
    
    if (isAtMaxSize !== isExpanded) {
      setIsExpanded(isAtMaxSize)
    }
  }, [collapsible, maxSize, isExpanded])

  /**
   * Sync state on mount and when panel size changes
   */
  useEffect(() => {
    if (!collapsible) return
    
    // Initial sync after a short delay to ensure panel is rendered
    const timer = setTimeout(syncExpandedState, 100)
    
    // Set up periodic sync to catch external size changes
    const interval = setInterval(syncExpandedState, 500)
    
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [collapsible, syncExpandedState])

  /**
   * Toggle panel between expanded (max size) and collapsed (previous/min size)
   */
  const handleToggle = () => {
    if (!panelRef.current) return

    const currentSize = panelRef.current.getSize()
    const isCurrentlyAtMax = Math.abs(currentSize - maxSize) < 1
    
    if (isCurrentlyAtMax) {
      // Currently expanded: collapse to previous size or min size
      const targetSize = previousSize > minSize ? previousSize : minSize
      panelRef.current.resize(targetSize)
      setIsExpanded(false)
    } else {
      // Currently collapsed: save current size and expand to max
      setPreviousSize(currentSize)
      panelRef.current.resize(maxSize)
      setIsExpanded(true)
    }
    
    onToggle?.(!isCurrentlyAtMax)
  }

  return (
    <Panel
      ref={panelRef}
      id={id}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      className={cn("relative flex flex-col", className)}
    >
      {/* Compact Single-Row Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 dark:bg-muted/60 min-h-[44px]">
        {/* Left Section - Icon, Title & Status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && (
            <div className="text-muted-foreground flex-shrink-0">
              {icon}
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                typography.panel.sectionTitle,
                "text-foreground font-medium leading-tight truncate"
              )}>
                {title}
              </h3>
              
              {subtitle && (
                <span className={cn(
                  typography.body.xs,
                  "text-muted-foreground hidden sm:inline-block"
                )}>
                  • {subtitle}
                </span>
              )}
            </div>
          </div>
          
          {statusBadge && (
            <Badge variant={statusBadge.variant || "secondary"} className="text-xs flex-shrink-0">
              {statusBadge.text}
            </Badge>
          )}
        </div>
        
        {/* Right Section - Info & Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Contextual Info Tooltip */}
          {(purpose || actionHint) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-accent"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    {purpose && (
                      <p className={cn(typography.body.xs, "font-medium")}>
                        {purpose}
                      </p>
                    )}
                    {actionHint && (
                      <p className={cn(typography.body.xs, "text-muted-foreground")}>
                        💡 {actionHint}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Collapse/Expand Button */}
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="h-6 w-6 p-0 hover:bg-accent"
              title={isExpanded ? "Collapse panel" : "Expand panel"}
            >
              {isExpanded ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </Panel>
  )
}