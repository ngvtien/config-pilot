import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Icon size variants with automatic zoom-exclude handling
 */
const iconVariants = cva(
  "flex-shrink-0", // Prevent icon from shrinking in flex containers
  {
    variants: {
      size: {
        xs: "h-3 w-3",
        sm: "h-4 w-4", 
        md: "h-5 w-5",
        lg: "h-6 w-6",
        xl: "h-8 w-8",
      },
      context: {
        standalone: "zoom-exclude", // Standalone icons need zoom protection
        inline: "", // Icons paired with text scale naturally
        decorative: "zoom-exclude", // Decorative icons need protection
      }
    },
    defaultVariants: {
      size: "sm",
      context: "standalone",
    },
  }
)

export interface IconProps
  extends React.ComponentProps<"svg">,
    VariantProps<typeof iconVariants> {
  /** The Lucide icon component to render */
  icon: LucideIcon
  /** Whether this icon is standalone (needs zoom-exclude) or inline with text */
  context?: "standalone" | "inline" | "decorative"
  /** Override automatic zoom-exclude behavior */
  forceZoomExclude?: boolean
}

/**
 * Standardized icon component with automatic zoom-exclude handling
 * 
 * @param icon - The Lucide icon component
 * @param size - Icon size (xs, sm, md, lg, xl)
 * @param context - Usage context (standalone, inline, decorative)
 * @param forceZoomExclude - Override automatic zoom-exclude behavior
 */
const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconComponent, size, context, forceZoomExclude, className, ...props }, ref) => {
    const shouldExcludeZoom = forceZoomExclude ?? (context === "standalone" || context === "decorative")
    
    return (
      <IconComponent
        ref={ref}
        className={cn(
          iconVariants({ size, context }),
          shouldExcludeZoom && "zoom-exclude",
          className
        )}
        {...props}
      />
    )
  }
)
Icon.displayName = "Icon"

export { Icon, iconVariants }