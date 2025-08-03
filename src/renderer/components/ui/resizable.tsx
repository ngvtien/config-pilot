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
    const { direction, getPanels } = useResizablePanelGroup()
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

    /**
     * Handle mouse enter for better cursor feedback
     */
    const handleMouseEnter = React.useCallback(() => {
      setIsHovering(true)
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
    }, [direction])

    /**
     * Handle mouse leave to reset cursor
     */
    const handleMouseLeave = React.useCallback(() => {
      if (!isDragging) {
        setIsHovering(false)
        document.body.style.cursor = ""
      }
    }, [isDragging])

    /**
     * Enhanced mouse down handler with aggressive event capture
     */
    const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      // Immediate visual feedback - set cursor and styles before any async operations
      const handle = e.currentTarget
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"
      document.body.style.pointerEvents = "none" // Prevent interference from other elements
      handle.style.backgroundColor = "hsl(var(--accent))"
      handle.style.zIndex = "9999" // Ensure handle stays on top

      // Add capture listeners immediately for better responsiveness
      const handleGlobalMouseMove = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        handleMouseMove(e)
      }

      const handleGlobalMouseUp = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        document.removeEventListener('mousemove', handleGlobalMouseMove, true)
        document.removeEventListener('mouseup', handleGlobalMouseUp, true)
        handleMouseUp()
      }
      // Use capture phase for immediate response
      document.addEventListener('mousemove', handleGlobalMouseMove, true)
      document.addEventListener('mouseup', handleGlobalMouseUp, true)

      const container = handle.parentElement
      if (!container) return

      const panels = getPanels()
      const containerChildren = Array.from(container.children)
      const handleIndex = containerChildren.indexOf(handle)

      // Find adjacent panels efficiently
      let beforePanel: HTMLElement | null = null
      let afterPanel: HTMLElement | null = null

      for (let i = handleIndex - 1; i >= 0; i--) {
        const child = containerChildren[i] as HTMLElement
        const panelId = child.getAttribute('data-panel-id')
        if (panelId && panels.has(panelId)) {
          beforePanel = child
          break
        }
      }

      for (let i = handleIndex + 1; i < containerChildren.length; i++) {
        const child = containerChildren[i] as HTMLElement
        const panelId = child.getAttribute('data-panel-id')
        if (panelId && panels.has(panelId)) {
          afterPanel = child
          break
        }
      }

      if (!beforePanel || !afterPanel) {
        // Reset styles if panels not found
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        handle.style.backgroundColor = ""
        return
      }

      const containerRect = container.getBoundingClientRect()
      const beforeRect = beforePanel.getBoundingClientRect()
      const afterRect = afterPanel.getBoundingClientRect()

      dragStateRef.current = {
        startPos: direction === "horizontal" ? e.clientX : e.clientY,
        beforePanel,
        afterPanel,
        beforeStartSize: direction === "horizontal" ? beforeRect.width : beforeRect.height,
        afterStartSize: direction === "horizontal" ? afterRect.width : afterRect.height,
        containerSize: direction === "horizontal" ? containerRect.width : containerRect.height
      }

      // Set dragging state after immediate visual feedback
      setIsDragging(true)
    }, [direction, getPanels])

    /**
     * Enhanced mouse up handler with proper cleanup
     */
    const handleMouseUp = React.useCallback(() => {
      if (isDragging) {
        setIsDragging(false)
        dragStateRef.current = null

        // Reset all styles immediately
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        document.body.style.pointerEvents = ""

        // Reset handle styles
        const handles = document.querySelectorAll('[data-resizable-handle]')
        handles.forEach(handle => {
          if (handle instanceof HTMLElement) {
            handle.style.backgroundColor = ""
            handle.style.zIndex = ""
          }
        })
      }
    }, [isDragging])

    /**
     * Optimized mouse move handler using requestAnimationFrame
     */
    const handleMouseMove = React.useCallback((e: MouseEvent) => {
      if (!isDragging || !dragStateRef.current) return

      const { startPos, beforePanel, afterPanel, beforeStartSize, afterStartSize, containerSize } = dragStateRef.current
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - startPos

      // Calculate new sizes with constraints
      const beforeNewSize = Math.max(10, Math.min(90, ((beforeStartSize + delta) / containerSize) * 100))
      const afterNewSize = Math.max(10, Math.min(90, ((afterStartSize - delta) / containerSize) * 100))

      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        if (beforePanel && afterPanel) {
          beforePanel.style.flexBasis = `${beforeNewSize}%`
          afterPanel.style.flexBasis = `${afterNewSize}%`

          // For vertical layouts, explicitly set height
          if (direction === "vertical") {
            beforePanel.style.height = `${beforeNewSize}%`
            afterPanel.style.height = `${afterNewSize}%`
            // Ensure flex properties don't interfere
            beforePanel.style.flexGrow = "0"
            beforePanel.style.flexShrink = "0"
            afterPanel.style.flexGrow = "0"
            afterPanel.style.flexShrink = "0"
          } else {
            // For horizontal layouts, explicitly set width
            beforePanel.style.width = `${beforeNewSize}%`
            afterPanel.style.width = `${afterNewSize}%`
            // Ensure flex properties don't interfere
            beforePanel.style.flexGrow = "0"
            beforePanel.style.flexShrink = "0"
            afterPanel.style.flexGrow = "0"
            afterPanel.style.flexShrink = "0"
          }
        }
      })
    }, [isDragging, direction])

    // Optimized event listeners with passive option
    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove, { passive: true })
        document.addEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
        document.body.style.userSelect = "none"

        return () => {
          document.removeEventListener("mousemove", handleMouseMove)
          document.removeEventListener("mouseup", handleMouseUp)
          document.body.style.cursor = ""
          document.body.style.userSelect = ""
        }
      }
    }, [isDragging, handleMouseMove, handleMouseUp, direction])

    return (
      <div
        ref={ref}
        data-resizable-handle
        className={cn(
          "relative flex items-center justify-center bg-transparent transition-all duration-100 group",
          direction === "horizontal"
            ? "w-4 cursor-col-resize hover:bg-accent/20" // Increased from w-3 to w-4
            : "h-4 cursor-row-resize hover:bg-accent/20", // Increased from h-3 to h-4
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
              ? "w-0.5 h-full group-hover:w-1 group-hover:bg-accent" // Thicker default line
              : "h-0.5 w-full group-hover:h-1 group-hover:bg-accent",
            isDragging && "bg-accent w-1 h-1", // Even thicker when dragging
            isHovering && "bg-accent/70"
          )}
        />

        {/* Always show handle for better visibility */}
        <div
          className={cn(
            "absolute rounded-sm bg-muted-foreground/30 transition-all duration-100",
            "group-hover:bg-muted-foreground/70",
            direction === "horizontal"
              ? "h-10 w-1.5 group-hover:w-2" // Larger and more visible
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