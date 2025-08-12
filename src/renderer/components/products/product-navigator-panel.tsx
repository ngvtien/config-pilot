"use client"

import React, { useState, useMemo } from "react"
import { Input } from "@/renderer/components/ui/input"
import { Button } from "@/renderer/components/ui/button"
import { Badge } from "@/renderer/components/ui/badge"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Card, CardContent } from "@/renderer/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"
import { Search, Filter, Star, Package, Component, ChevronRight, Edit, Trash2, Plus } from "lucide-react"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"

/**
 * Product search result interface
 */
interface ProductSearchResult {
  id: string
  name: string
  description: string
  components: number
  environment: string
  status: 'healthy' | 'warning' | 'error'
  lastModified: string
  isFavorite: boolean
}

/**
 * Navigator panel with enhanced product search and CRUD actions
 */
interface NavigatorPanelProps {
  onProductSelect?: (product: ProductSearchResult) => void
  selectedProductId?: string
  onEditProduct?: (product: ProductSearchResult) => void
  onDeleteProduct?: (product: ProductSearchResult) => void
  onAddComponent?: (product: ProductSearchResult) => void
}

export const NavigatorPanel: React.FC<NavigatorPanelProps> = ({
  onProductSelect,
  selectedProductId,
  onEditProduct,
  onDeleteProduct,
  onAddComponent
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'recent'>('all')

  // Mock data - replace with actual data source
  const mockProducts: ProductSearchResult[] = [
    {
      id: "1",
      name: "User Authentication Service",
      description: "OAuth2 and JWT authentication microservice",
      components: 5,
      environment: "production",
      status: "healthy",
      lastModified: "2 hours ago",
      isFavorite: true
    },
    {
      id: "2",
      name: "Payment Gateway",
      description: "Secure payment processing with multiple providers",
      components: 3,
      environment: "staging",
      status: "warning",
      lastModified: "1 day ago",
      isFavorite: false
    },
    {
      id: "3",
      name: "Notification Engine",
      description: "Multi-channel notification delivery system",
      components: 7,
      environment: "development",
      status: "error",
      lastModified: "3 days ago",
      isFavorite: true
    }
  ]

  /**
   * Filter products based on search query and active filter
   */
  const filteredProducts = useMemo(() => {
    let filtered = mockProducts

    // Apply text search
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply category filter
    switch (activeFilter) {
      case 'favorites':
        filtered = filtered.filter(product => product.isFavorite)
        break
      case 'recent':
        // Mock recent filter - in real app, this would be based on lastModified
        filtered = filtered.slice(0, 2)
        break
      default:
        break
    }

    return filtered
  }, [searchQuery, activeFilter])

  /**
   * Get status indicator color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  /**
   * Handle product tile click while preventing event bubbling for action buttons
   */
  const handleProductClick = (product: ProductSearchResult) => {
    onProductSelect?.(product)
  }
  /**
   * Handle action button clicks with event prevention
   */
  const handleActionClick = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation()
    event.preventDefault()
    action()
  }

  const filters = ['all', 'favorites', 'recent'] as const

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="p-3 border-b space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1">
          {filters.map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter(filter)}
              className="text-xs"
            >
              {filter === 'favorites' && <Star className="h-3 w-3 mr-1" />}
              {filter === 'recent' && <Package className="h-3 w-3 mr-1" />}
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Search Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={cn(
                "group relative cursor-pointer transition-all duration-200 hover:shadow-md border overflow-visible",
                selectedProductId === product.id
                  ? "ring-2 ring-primary border-primary/50 bg-primary/5"
                  : "hover:border-primary/30 hover:bg-accent/50"
              )}
              onClick={() => handleProductClick(product)}
            >
              <CardContent className="p-4 relative">
                {/* Product Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-2 h-2 rounded-full", getStatusColor(product.status))} />
                  <h3 className={cn(typography.tile.title, "font-semibold")}>
                    {product.name}
                  </h3>
                  <Badge variant="secondary" className={typography.tile.badge}>
                    {product.environment}
                  </Badge>
                </div>

                {/* Product Description */}
                <p className={cn(typography.tile.subtitle, "mb-3 line-clamp-2")}>
                  {product.description}
                </p>

                {/* Product Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className={cn(typography.utils.caption, "flex items-center gap-1")}>
                      <Component className="h-3 w-3" />
                      {product.components} components
                    </span>
                    <span className={cn(typography.utils.caption, "text-muted-foreground")}>
                      Updated {product.lastModified}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Action Buttons - SIMPLIFIED VERSION */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0 bg-white/90 hover:bg-blue-50"
                    onClick={(e) => handleActionClick(e, () => onEditProduct?.(product))}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0 bg-white/90 hover:bg-red-50"
                    onClick={(e) => handleActionClick(e, () => onDeleteProduct?.(product))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Add Component Button */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0 bg-white/90 hover:bg-green-50"
                    onClick={(e) => handleActionClick(e, () => onAddComponent?.(product))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

    </div>
  )
}