"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Resizable panel group context
 */
interface ResizablePanelGroupContextValue {
  direction: "horizontal" | "vertical"
  registerPanel: (id: string, element: HTMLElement) => void
  unregisterPanel: (id: string) => void
  getPanels: () => Map<string, HTMLElement>
}

const ResizablePanelGroupContext = React.createContext<ResizablePanelGroupContextValue | null>(null)

/**
 * Hook to use resizable panel group context
 */
const useResizablePanelGroup = () => {
  const context = React.useContext(ResizablePanelGroupContext)
  if (!context) {
    throw new Error("useResizablePanelGroup must be used within a ResizablePanelGroup")
  }
  return context
}

/**
 * Resizable panel group component with optimized panel management
 */
interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction: "horizontal" | "vertical"
}

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, ResizablePanelGroupProps>(
  ({ className, direction, children, ...props }, ref) => {
    const panelsRef = React.useRef<Map<string, HTMLElement>>(new Map())

    /**
     * Register a panel element for resizing operations
     */
    const registerPanel = React.useCallback((id: string, element: HTMLElement) => {
      panelsRef.current.set(id, element)
    }, [])

    /**
     * Unregister a panel element
     */
    const unregisterPanel = React.useCallback((id: string) => {
      panelsRef.current.delete(id)
    }, [])

    /**
     * Get all registered panels
     */
    const getPanels = React.useCallback(() => {
      return panelsRef.current
    }, [])

    // Create a stable context value to prevent unnecessary re-renders
    const contextValue = React.useMemo(() => ({
      direction,
      registerPanel,
      unregisterPanel,
      getPanels
    }), [direction, registerPanel, unregisterPanel, getPanels])

    return (
      <ResizablePanelGroupContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(
            "flex h-full w-full",
            direction === "horizontal" ? "flex-row" : "flex-col",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </ResizablePanelGroupContext.Provider>
    )
  }
)
ResizablePanelGroup.displayName = "ResizablePanelGroup"

/**
 * Optimized resizable panel component
 */
interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number
  minSize?: number
  maxSize?: number
  id?: string
}

const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePanelProps>(
  ({ className, defaultSize = 50, minSize = 10, maxSize = 90, children, style, id, ...props }, ref) => {
    const { registerPanel, unregisterPanel, direction } = useResizablePanelGroup()
    const panelId = React.useId()
    const finalId = id || panelId
    const elementRef = React.useRef<HTMLDivElement>(null)

    // Register/unregister panel on mount/unmount
    React.useEffect(() => {
      if (elementRef.current) {
        registerPanel(finalId, elementRef.current)
      }
      return () => {
        unregisterPanel(finalId)
      }
    }, [finalId, registerPanel, unregisterPanel])

    return (
      <div
        ref={(node) => {
          elementRef.current = node
          if (typeof ref === "function") {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
        data-panel-id={finalId}
        className={cn("flex-1 overflow-hidden", className)}
        style={{
          flexBasis: `${defaultSize}%`,
          minWidth: direction === "horizontal" ? `${minSize}%` : undefined,
          maxWidth: direction === "horizontal" ? `${maxSize}%` : undefined,
          minHeight: direction === "vertical" ? `${minSize}%` : undefined,
          maxHeight: direction === "vertical" ? `${maxSize}%` : undefined,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ResizablePanel.displayName = "ResizablePanel"

/**
 * High-performance resizable handle component
 */
interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean
}

const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps>(
  ({ className, withHandle = false, ...props }, ref) => {
    const context = useResizablePanelGroup()
    const [isDragging, setIsDragging] = React.useState(false)
    const [isHovering, setIsHovering] = React.useState(false)
    const dragStateRef = React.useRef<{
      startPos: number
      beforePanel: HTMLElement | null
      afterPanel: HTMLElement | null
      beforeStartSize: number
      afterStartSize: number
      containerSize: number
    } | null>(null)

    const { direction } = context

    /**
     * Handle mouse enter event to show hover state
     */
    const handleMouseEnter = React.useCallback(() => {
      setIsHovering(true)
    }, [])

    /**
     * Handle mouse leave event to hide hover state
     */
    const handleMouseLeave = React.useCallback(() => {
      setIsHovering(false)
    }, [])

    /**
     * Handle mouse move during drag operation
     * Updates panel sizes based on mouse position
     */
    const handleMouseMove = React.useCallback((e: MouseEvent) => {
      if (!dragStateRef.current) return

      const { startPos, beforePanel, afterPanel, beforeStartSize, afterStartSize, containerSize } = dragStateRef.current
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - startPos

      // Calculate new sizes with constraints (10% min, 90% max)
      const beforeNewSize = Math.max(10, Math.min(90, ((beforeStartSize + delta) / containerSize) * 100))
      const afterNewSize = Math.max(10, Math.min(90, ((afterStartSize - delta) / containerSize) * 100))

      // Apply direct style updates for immediate response
      if (beforePanel && afterPanel) {
        beforePanel.style.flexBasis = `${beforeNewSize}%`
        afterPanel.style.flexBasis = `${afterNewSize}%`

        if (direction === "vertical") {
          beforePanel.style.height = `${beforeNewSize}%`
          afterPanel.style.height = `${afterNewSize}%`
          beforePanel.style.flexGrow = "0"
          beforePanel.style.flexShrink = "0"
          afterPanel.style.flexGrow = "0"
          afterPanel.style.flexShrink = "0"
        } else {
          beforePanel.style.width = `${beforeNewSize}%`
          afterPanel.style.width = `${afterNewSize}%`
          beforePanel.style.flexGrow = "0"
          beforePanel.style.flexShrink = "0"
          afterPanel.style.flexGrow = "0"
          afterPanel.style.flexShrink = "0"
        }
      }
    }, [direction])

    /**
     * Handle mouse up event to end drag operation
     * Cleans up event listeners and resets state
     */
    const handleMouseUp = React.useCallback(() => {
      // Clean up drag state
      dragStateRef.current = null
      setIsDragging(false)
      
      // Remove event listeners
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      
      // Reset cursor and selection
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }, [handleMouseMove])

    /**
     * Handle mouse down event to start drag operation
     * Finds adjacent panels and sets up drag state
     */
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const handleElement = e.currentTarget as HTMLElement
      const container = handleElement.parentElement // The ResizablePanelGroup container
      
      if (!container) return

      // Get all direct children that are panels (not handles)
      const allChildren = Array.from(container.children) as HTMLElement[]
      const panels = allChildren.filter(child => child.hasAttribute('data-panel-id'))
      
      if (panels.length < 2) return

      // Find the handle's position among siblings
      const handleIndex = allChildren.indexOf(handleElement)
      
      // Find adjacent panels by looking at siblings around the handle
      let beforePanel: HTMLElement | null = null
      let afterPanel: HTMLElement | null = null
      
      // Look backwards for the before panel
      for (let i = handleIndex - 1; i >= 0; i--) {
        if (allChildren[i].hasAttribute('data-panel-id')) {
          beforePanel = allChildren[i]
          break
        }
      }
      
      // Look forwards for the after panel
      for (let i = handleIndex + 1; i < allChildren.length; i++) {
        if (allChildren[i].hasAttribute('data-panel-id')) {
          afterPanel = allChildren[i]
          break
        }
      }

      if (!beforePanel || !afterPanel) return

      // Store initial drag state
      const containerSize = direction === "horizontal" ? container.offsetWidth : container.offsetHeight
      const beforeStartSize = direction === "horizontal" ? beforePanel.offsetWidth : beforePanel.offsetHeight
      const afterStartSize = direction === "horizontal" ? afterPanel.offsetWidth : afterPanel.offsetHeight
      const startPos = direction === "horizontal" ? e.clientX : e.clientY

      dragStateRef.current = {
        startPos,
        beforePanel,
        afterPanel,
        beforeStartSize,
        afterStartSize,
        containerSize
      }

      setIsDragging(true)
      
      // Set cursor and prevent text selection
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"
      
      // Add event listeners - single system only
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }, [context, direction, handleMouseMove, handleMouseUp])

    return (
      <div
        ref={ref}
        data-resizable-handle
        className={cn(
          "relative flex items-center justify-center bg-transparent transition-all duration-100 group",
          direction === "horizontal"
            ? "w-4 cursor-col-resize hover:bg-accent/20"
            : "h-4 cursor-row-resize hover:bg-accent/20",
          isDragging && "bg-accent/30",
          isHovering && "bg-accent/10",
          className
        )}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* More prominent visual indicator */}
        <div
          className={cn(
            "absolute bg-border transition-all duration-100",
            direction === "horizontal"
              ? "w-0.5 h-full group-hover:w-1 group-hover:bg-accent"
              : "h-0.5 w-full group-hover:h-1 group-hover:bg-accent",
            isDragging && "bg-accent w-1 h-1",
            isHovering && "bg-accent/70"
          )}
        />

        {/* Always show handle for better visibility */}
        <div
          className={cn(
            "absolute rounded-sm bg-muted-foreground/30 transition-all duration-100",
            "group-hover:bg-muted-foreground/70",
            direction === "horizontal"
              ? "h-10 w-1.5 group-hover:w-2"
              : "h-1.5 w-10 group-hover:h-2",
            isDragging && "bg-muted-foreground",
            isHovering && "bg-muted-foreground/50"
          )}
        />
      </div>
    )
  }
)
ResizableHandle.displayName = "ResizableHandle"
export { ResizablePanelGroup, ResizablePanel, ResizableHandle }