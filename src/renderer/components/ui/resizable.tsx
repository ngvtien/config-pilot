"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Resizable panel group context
 */
interface ResizablePanelGroupContextValue {
  direction: "horizontal" | "vertical"
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
 * Resizable panel group component
 */
interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction: "horizontal" | "vertical"
}

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, ResizablePanelGroupProps>(
  ({ className, direction, children, ...props }, ref) => {
    return (
      <ResizablePanelGroupContext.Provider value={{ direction }}>
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
 * Resizable panel component
 */
interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number
  minSize?: number
  maxSize?: number
}

const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePanelProps>(
  ({ className, defaultSize = 50, minSize = 10, maxSize = 90, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 overflow-hidden", className)}
        style={{
          flexBasis: `${defaultSize}%`,
          minWidth: `${minSize}%`,
          maxWidth: `${maxSize}%`,
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
 * Resizable handle component
 */
interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean
}

const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps>(
  ({ className, withHandle = false, ...props }, ref) => {
    const { direction } = useResizablePanelGroup()
    const [isDragging, setIsDragging] = React.useState(false)
    const [startPos, setStartPos] = React.useState(0)
    const [startSizes, setStartSizes] = React.useState<number[]>([])
    const handleRef = React.useRef<HTMLDivElement>(null)

    /**
     * Handle mouse down event to start resizing
     */
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setStartPos(direction === "horizontal" ? e.clientX : e.clientY)
      
      // Get parent container and calculate initial sizes
      const container = handleRef.current?.parentElement
      if (container) {
        const panels = Array.from(container.children).filter(
          (child) => child !== handleRef.current && child.tagName === "DIV"
        ) as HTMLElement[]
        
        const sizes = panels.map((panel) => {
          const rect = panel.getBoundingClientRect()
          return direction === "horizontal" ? rect.width : rect.height
        })
        setStartSizes(sizes)
      }
    }, [direction])

    /**
     * Handle mouse move event during resizing
     */
    const handleMouseMove = React.useCallback(
      (e: MouseEvent) => {
        if (!isDragging || !handleRef.current) return

        const container = handleRef.current.parentElement
        if (!container) return

        const currentPos = direction === "horizontal" ? e.clientX : e.clientY
        const delta = currentPos - startPos
        
        const panels = Array.from(container.children).filter(
          (child) => child !== handleRef.current && child.tagName === "DIV"
        ) as HTMLElement[]

        if (panels.length >= 2) {
          const containerRect = container.getBoundingClientRect()
          const containerSize = direction === "horizontal" ? containerRect.width : containerRect.height
          
          // Calculate new sizes
          const leftPanel = panels[0]
          const rightPanel = panels[1]
          
          const leftNewSize = Math.max(
            10,
            Math.min(90, ((startSizes[0] + delta) / containerSize) * 100)
          )
          const rightNewSize = Math.max(
            10,
            Math.min(90, ((startSizes[1] - delta) / containerSize) * 100)
          )

          // Apply new sizes
          leftPanel.style.flexBasis = `${leftNewSize}%`
          rightPanel.style.flexBasis = `${rightNewSize}%`
        }
      },
      [isDragging, startPos, startSizes, direction]
    )

    /**
     * Handle mouse up event to stop resizing
     */
    const handleMouseUp = React.useCallback(() => {
      setIsDragging(false)
    }, [])

    // Add global mouse event listeners
    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
        return () => {
          document.removeEventListener("mousemove", handleMouseMove)
          document.removeEventListener("mouseup", handleMouseUp)
        }
      }
    }, [isDragging, handleMouseMove, handleMouseUp])

    return (
      <div
        ref={React.useMemo(() => {
          return (node: HTMLDivElement) => {
            handleRef.current = node
            if (typeof ref === "function") {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
          }
        }, [ref])}
                className={cn(
          "relative flex items-center justify-center bg-border-200 transition-colors hover:bg-accent",
          direction === "horizontal"
            ? "w-2 cursor-col-resize"
            : "h-2 cursor-row-resize",
          isDragging && "bg-accent",
          className
        )}
        onMouseDown={handleMouseDown}
        {...props}
      >
        {withHandle && (
          <div
            className={cn(
              "absolute rounded-sm bg-border transition-colors hover:bg-accent-foreground",
              direction === "horizontal"
                ? "h-4 w-1.5"
                : "h-1.5 w-4"
            )}
          />
        )}
      </div>
    )
  }
)
ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }