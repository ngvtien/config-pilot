"use client"

import React from "react"
import { Card, CardContent } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Button } from "@/renderer/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut
} from "@/renderer/components/ui/dropdown-menu"
import {
  Component,
  Edit,
  Trash2,
  FileText,
  Settings,
  Database,
  MoreVertical,
  GitBranch,
  History,
  GitPullRequest,
  GitMerge,
  Diff
} from "lucide-react"
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
        {/* Header with title on left and MoreVertical on far right */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className={typography.card.title}>Product Components</h3>
            <p className={typography.card.subtitle}>{productName}</p>
          </div>

          {/* MoreVertical positioned on the far right */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Git Section Label */}
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                Git Operations
              </div>

              {/* Git menu items */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Implement git diff functionality for Resource File Explorer
                }}
                className="group flex items-center px-3 py-2.5 text-sm transition-colors hover:bg-blue-500/10 focus:bg-blue-500/10 dark:hover:bg-blue-400/10 dark:focus:bg-blue-400/10"
              >
                <Diff className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" />
                <span className="font-medium text-blue-700 dark:text-blue-300">Git Diff</span>
                <DropdownMenuShortcut className="text-xs text-muted-foreground/60">⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Implement git history functionality for Resource File Explorer
                }}
                className="group flex items-center px-3 py-2.5 text-sm transition-colors hover:bg-green-500/10 focus:bg-green-500/10 dark:hover:bg-green-400/10 dark:focus:bg-green-400/10"
              >
                <History className="h-4 w-4 mr-3 text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors" />
                <span className="font-medium text-green-700 dark:text-green-300">History</span>
                <DropdownMenuShortcut className="text-xs text-muted-foreground/60">⌘H</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Implement create PR functionality for Resource File Explorer
                }}
                className="group flex items-center px-3 py-2.5 text-sm transition-colors hover:bg-purple-500/10 focus:bg-purple-500/10 dark:hover:bg-purple-400/10 dark:focus:bg-purple-400/10"
              >
                <GitPullRequest className="h-4 w-4 mr-3 text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors" />
                <span className="font-medium text-purple-700 dark:text-purple-300">Create PR</span>
                <DropdownMenuShortcut className="text-xs text-muted-foreground/60">⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Implement git merge functionality for Resource File Explorer
                }}
                className="group flex items-center px-3 py-2.5 text-sm transition-colors hover:bg-orange-500/10 focus:bg-orange-500/10 dark:hover:bg-orange-400/10 dark:focus:bg-orange-400/10"
              >
                <GitMerge className="h-4 w-4 mr-3 text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors" />
                <span className="font-medium text-orange-700 dark:text-orange-300">Merge</span>
                <DropdownMenuShortcut className="text-xs text-muted-foreground/60">⌘M</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

                {/* Action Buttons - Top Right with MoreVertical dropdown */}
                <div className="absolute top-2 right-2 transition-all duration-200 opacity-0 group-hover:opacity-100 z-50">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="cursor-pointer">
                        <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 shadow-lg border-border/50">
                      {onEditComponent && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('Edit component clicked for:', component.name)
                            onEditComponent(component)
                          }}
                          className="group flex items-center px-3 py-2.5 text-sm transition-colors hover:bg-accent focus:bg-accent"
                        >
                          <Edit className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                          <span className="font-medium">Edit {component.name}</span>
                        </DropdownMenuItem>
                      )}
                      {onDeleteComponent && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('Delete component clicked for:', component.name)
                            onDeleteComponent(component)
                          }}
                          className="group flex items-center px-3 py-2.5 text-sm transition-colors hover:bg-destructive/10 focus:bg-destructive/10 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-3 text-destructive/70 group-hover:text-destructive transition-colors" />
                          <span className="font-medium">Delete {component.name}</span>
                        </DropdownMenuItem>
                      )}

                    </DropdownMenuContent>
                  </DropdownMenu>
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