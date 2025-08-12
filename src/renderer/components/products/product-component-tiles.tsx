"use client"

import React from "react"
import { Card, CardContent } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Button } from "@/renderer/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"
import { Component, Edit, Trash2, FileText, Settings, Database } from "lucide-react"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"

/**
 * Interface for product component data
 */
interface ProductComponent {
  id: string
  name: string
  description: string
  type: 'microservice' | 'database' | 'cache' | 'queue' | 'gateway'
  status: 'healthy' | 'warning' | 'error'
  resourceCount: number
  lastModified: string
}

/**
 * Props for ProductComponentTiles component
 */
interface ProductComponentTilesProps {
  productId?: string
  productName?: string
  components: ProductComponent[]
  selectedComponentId?: string
  onComponentSelect?: (component: ProductComponent) => void
  onEditComponent?: (component: ProductComponent) => void
  onDeleteComponent?: (component: ProductComponent) => void
}

/**
 * Get status color for component status indicator
 */
const getStatusColor = (status: ProductComponent['status']) => {
  switch (status) {
    case 'healthy': return 'bg-green-500'
    case 'warning': return 'bg-yellow-500'
    case 'error': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
}

/**
 * Get component type icon
 */
const getComponentIcon = (type: ProductComponent['type']) => {
  switch (type) {
    case 'microservice': return <Component className="h-4 w-4" />
    case 'database': return <Database className="h-4 w-4" />
    case 'cache': return <FileText className="h-4 w-4" />
    case 'queue': return <FileText className="h-4 w-4" />
    case 'gateway': return <Settings className="h-4 w-4" />
    default: return <Component className="h-4 w-4" />
  }
}

/**
 * Product Component Tiles component for File Explorer panel
 * Shows components of the selected product with CRUD actions
 */
export const ProductComponentTiles: React.FC<ProductComponentTilesProps> = ({
  productId,
  productName,
  components,
  selectedComponentId,
  onComponentSelect,
  onEditComponent,
  onDeleteComponent
}) => {
  /**
   * Handle component card click
   */
  const handleComponentClick = (component: ProductComponent) => {
    onComponentSelect?.(component)
  }

  /**
   * Handle action button click with event propagation prevention
   */
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    e.preventDefault()
    action()
  }

  if (!productId || components.length === 0) {
    return (
      <div className="p-4 text-center border-b bg-muted/20">
        <Component className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className={typography.card.subtitle}>
          {!productId ? "Select a product to view components" : "No components found"}
        </p>
      </div>
    )
  }

  return (
    <div className="border-b bg-muted/20">
      <div className="p-4">
        <div className="mb-3">
          <h3 className={typography.card.title}>Product Components</h3>
          <p className={typography.card.subtitle}>{productName}</p>
        </div>

        {/* Changed from grid to single column for full width */}
        <div className="space-y-3">
          {components.map((component) => (
            <Card
              key={component.id}
              className={cn(
                "group relative cursor-pointer transition-all duration-200 hover:shadow-md border overflow-visible",
                selectedComponentId === component.id
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "hover:border-primary/30 hover:bg-accent/50"
              )}
              onClick={() => handleComponentClick(component)}
            >
              <CardContent className="p-3 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-16"> {/* Increased padding to prevent overlap */}
                    <div className="flex items-center gap-2 mb-1">
                      {getComponentIcon(component.type)}
                      <h4 className={cn(typography.tile.title, "text-sm truncate")}>
                        {component.name}
                      </h4>
                    </div>

                    <p className={cn(typography.tile.subtitle, "text-xs line-clamp-1 mb-2")}>
                      {component.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {component.resourceCount} resources
                      </Badge>

                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          getStatusColor(component.status)
                        )} />
                        <span className={cn(typography.tile.metadata, "text-xs")}>
                          {component.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Top Right with increased spacing */}
                <div className="absolute top-2 right-2 flex gap-3 transition-all duration-200 opacity-0 group-hover:opacity-100 z-50">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 w-6 p-0 bg-white border border-blue-200 shadow-lg hover:bg-blue-50 hover:border-blue-300"
                          onClick={(e) => handleActionClick(e, () => {
                            console.log('Edit component clicked for:', component.name)
                            onEditComponent?.(component)
                          })}
                        >
                          <Edit className="h-3 w-3 text-blue-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit {component.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 w-6 p-0 bg-white border border-red-200 shadow-lg hover:bg-red-50 hover:border-red-300"
                          onClick={(e) => handleActionClick(e, () => {
                            console.log('Delete component clicked for:', component.name)
                            onDeleteComponent?.(component)
                          })}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete {component.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// Mock data for testing
export const mockProductComponents: ProductComponent[] = [
  {
    id: "comp-1",
    name: "API Gateway",
    description: "Main entry point for all API requests",
    type: "gateway",
    status: "healthy",
    resourceCount: 5,
    lastModified: "2 hours ago"
  },
  {
    id: "comp-2",
    name: "User Service",
    description: "Handles user authentication and management",
    type: "microservice",
    status: "healthy",
    resourceCount: 8,
    lastModified: "1 day ago"
  },
  {
    id: "comp-3",
    name: "Redis Cache",
    description: "In-memory data structure store",
    type: "cache",
    status: "warning",
    resourceCount: 3,
    lastModified: "3 hours ago"
  }
]