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
  persistenceKey?: string
  savePanelSizes: () => void
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
 * Resizable panel group component with optimized panel management and persistence
 */
interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction: "horizontal" | "vertical"
  persistenceKey?: string
}

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, ResizablePanelGroupProps>(
  ({ className, direction, children, persistenceKey, ...props }, ref) => {
    const panelsRef = React.useRef<Map<string, HTMLElement>>(new Map())
    const [isInitialized, setIsInitialized] = React.useState(false)

    /**
     * Load saved panel sizes from localStorage
     */
    const loadSavedSizes = React.useCallback(() => {
      if (!persistenceKey) return {}
      
      try {
        const saved = localStorage.getItem(`resizable-${persistenceKey}`)
        if (saved) {
          const sizes = JSON.parse(saved)
          console.log(`[Resizable] Loaded saved sizes for ${persistenceKey}:`, sizes)
          return sizes
        }
      } catch (e) {
        console.warn('[Resizable] Failed to load saved sizes:', e)
      }
      return {}
    }, [persistenceKey])

    /**
     * Apply saved size to a panel element
     */
    const applySavedSize = React.useCallback((element: HTMLElement, size: number) => {
      console.log(`[Resizable] Applying saved size ${size}% to panel`)
      
      // Only set flexBasis and flex properties, avoid explicit width/height
      element.style.flexBasis = `${size}%`
      element.style.flexGrow = "0"
      element.style.flexShrink = "0"
      
      // Remove any explicit width/height that might interfere with flex layout
      if (direction === "horizontal") {
        element.style.removeProperty('width')
        element.style.removeProperty('height')
      } else {
        element.style.removeProperty('height')
        element.style.removeProperty('width')
      }
    }, [direction])
    /**
     * Register a panel element
     */
    const registerPanel = React.useCallback((id: string, element: HTMLElement) => {
      console.log(`[Resizable] Registering panel: ${id}`)
      panelsRef.current.set(id, element)
      
      // Apply saved size after a short delay to ensure DOM is ready
      if (persistenceKey && isInitialized) {
        setTimeout(() => {
          const savedSizes = loadSavedSizes()
          if (savedSizes[id]) {
            applySavedSize(element, savedSizes[id])
          }
        }, 50)
      }
    }, [persistenceKey, isInitialized, loadSavedSizes, applySavedSize])

    /**
     * Unregister a panel element
     */
    const unregisterPanel = React.useCallback((id: string) => {
      console.log(`[Resizable] Unregistering panel: ${id}`)
      panelsRef.current.delete(id)
    }, [])

    /**
     * Get all registered panels
     */
    const getPanels = React.useCallback(() => {
      return panelsRef.current
    }, [])

    /**
     * Save current panel sizes to localStorage
     */
    const savePanelSizes = React.useCallback(() => {
      if (!persistenceKey || panelsRef.current.size === 0) {
        console.log('[Resizable] Skipping save - no persistence key or panels')
        return
      }
      
      const sizes: Record<string, number> = {}
      let containerSize = 0
      
      // Get container size from first panel's parent
      const firstPanel = Array.from(panelsRef.current.values())[0]
      if (firstPanel?.parentElement) {
        containerSize = direction === "horizontal" 
          ? firstPanel.parentElement.offsetWidth 
          : firstPanel.parentElement.offsetHeight
      }
      
      if (containerSize === 0) {
        console.warn('[Resizable] Container size is 0, skipping save')
        return
      }
      
      panelsRef.current.forEach((element, id) => {
        const elementSize = direction === "horizontal" 
          ? element.offsetWidth 
          : element.offsetHeight
        sizes[id] = Math.round((elementSize / containerSize) * 100)
      })
      
      console.log(`[Resizable] Saving panel sizes for ${persistenceKey}:`, sizes)
      localStorage.setItem(`resizable-${persistenceKey}`, JSON.stringify(sizes))
    }, [persistenceKey, direction])

    /**
     * Initialize saved sizes after component mounts
     */
    React.useEffect(() => {
      if (persistenceKey) {
        // Wait for panels to register, then apply saved sizes
        const timer = setTimeout(() => {
          setIsInitialized(true)
          const savedSizes = loadSavedSizes()
          
          panelsRef.current.forEach((element, id) => {
            if (savedSizes[id]) {
              applySavedSize(element, savedSizes[id])
            }
          })
        }, 100)
        
        return () => clearTimeout(timer)
      }
    }, [persistenceKey, loadSavedSizes, applySavedSize])

    // Create stable context value
    const contextValue = React.useMemo(() => ({
      direction,
      registerPanel,
      unregisterPanel,
      getPanels,
      persistenceKey,
      savePanelSizes
    }), [direction, registerPanel, unregisterPanel, getPanels, persistenceKey, savePanelSizes])

    // Save sizes when component unmounts
    React.useEffect(() => {
      return () => {
        if (persistenceKey) {
          console.log('[Resizable] Component unmounting, saving sizes')
          savePanelSizes()
        }
      }
    }, [savePanelSizes, persistenceKey])

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
 * Optimized resizable panel component with persistence support
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

    // Register/unregister panel with enhanced timing
    React.useEffect(() => {
      if (elementRef.current) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (elementRef.current) {
            registerPanel(finalId, elementRef.current)
          }
        })
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
 * High-performance resizable handle component with persistence
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

    const { direction, savePanelSizes } = context

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
     */
    const handleMouseMove = React.useCallback((e: MouseEvent) => {
      if (!dragStateRef.current) return

      const { startPos, beforePanel, afterPanel, beforeStartSize, afterStartSize, containerSize } = dragStateRef.current
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - startPos

      // Calculate new sizes with constraints (10% min, 90% max)
      const beforeNewSize = Math.max(10, Math.min(90, ((beforeStartSize + delta) / containerSize) * 100))
      const afterNewSize = Math.max(10, Math.min(90, ((afterStartSize - delta) / containerSize) * 100))

      // Apply direct style updates for immediate response - use only flexBasis
      if (beforePanel && afterPanel) {
        beforePanel.style.flexBasis = `${beforeNewSize}%`
        afterPanel.style.flexBasis = `${afterNewSize}%`
        beforePanel.style.flexGrow = "0"
        beforePanel.style.flexShrink = "0"
        afterPanel.style.flexGrow = "0"
        afterPanel.style.flexShrink = "0"
        
        // Remove explicit width/height to prevent layout conflicts
        if (direction === "horizontal") {
          beforePanel.style.removeProperty('width')
          afterPanel.style.removeProperty('width')
        } else {
          beforePanel.style.removeProperty('height')
          afterPanel.style.removeProperty('height')
        }
      }
    }, [direction])
    /**
     * Handle mouse up event to end drag operation
     */
    const handleMouseUp = React.useCallback(() => {
      console.log('[Resizable] Drag ended, saving panel sizes')
      
      // Save sizes immediately after drag
      setTimeout(() => {
        savePanelSizes()
      }, 10)
      
      // Clean up drag state
      dragStateRef.current = null
      setIsDragging(false)
      
      // Remove event listeners
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      
      // Reset cursor and selection
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }, [savePanelSizes])

    /**
     * Handle mouse down event to start drag operation
     */
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const handleElement = e.currentTarget as HTMLElement
      const container = handleElement.parentElement
      
      if (!container) return

      // Get all direct children that are panels
      const allChildren = Array.from(container.children) as HTMLElement[]
      const handleIndex = allChildren.indexOf(handleElement)
      
      // Find adjacent panels
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
      
      // Add event listeners
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }, [direction, handleMouseMove, handleMouseUp])

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex items-center justify-center transition-colors flex-shrink-0",
          direction === "horizontal"
            ? "w-2 cursor-col-resize hover:bg-border min-w-[8px]"
            : "h-2 cursor-row-resize hover:bg-border min-h-[8px]",
          isDragging && "bg-border",
          isHovering && "bg-muted",
          className
        )}
        style={{
          flexShrink: 0,
          flexGrow: 0,
          ...(direction === "horizontal" ? { minWidth: '8px', width: '8px' } : { minHeight: '8px', height: '8px' })
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {withHandle && (
          <div
            className={cn(
              "rounded-sm bg-border transition-colors",
              direction === "horizontal" ? "h-4 w-1" : "h-1 w-4",
              isDragging && "bg-ring"
            )}
          />
        )}
      </div>
    )
  }
)

ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }