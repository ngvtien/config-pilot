"use client"

import React, { useState, useMemo } from "react"
import { Input } from "@/renderer/components/ui/input"
import { Button } from "@/renderer/components/ui/button"
import { Badge } from "@/renderer/components/ui/badge"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Card, CardContent } from "@/renderer/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/renderer/components/ui/collapsible"
import { Search, ChevronDown, ChevronRight, Package, Component, ArrowLeft, Plus, Trash2, Edit, MoreVertical } from "lucide-react"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"
import { Product } from "@/shared/types/product"
import { ProductComponent } from "@/shared/types/product-component"
import { useMockData } from "@/renderer/services/mock-data.service"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu"

/**
 * Navigator panel for product and component selection
 */
interface ProductComponentNavigatorProps {
  selectedProduct?: Product | null
  selectedComponent?: ProductComponent | null
  onProductSelect?: (product: Product) => void
  onComponentSelect?: (component: ProductComponent) => void
  onNavigateBack?: () => void
  onEditProduct?: (product: Product) => void
  onDeleteProduct?: (product: Product) => void
  onAddComponent?: (product: Product) => void
  onAddProduct?: () => void
}

export const ProductComponentNavigator: React.FC<ProductComponentNavigatorProps> = ({
  selectedProduct,
  selectedComponent,
  onProductSelect,
  onComponentSelect,
  onNavigateBack,
  onEditProduct,
  onDeleteProduct,
  onAddComponent,
  onAddProduct
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // Use the centralized mock data service instead of local mock data
  const mockData = useMockData()
  const mockProducts = mockData.products

  /**
   * Handle action button clicks without triggering product selection
   */
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  // Mock data with proper Product and ProductComponent interfaces
  // const mockProducts: Product[] = [
  //   {
  //     id: "product-1",
  //     name: "cai",
  //     displayName: "Customer AI Platform",
  //     description: "AI-powered customer service platform",
  //     owner: "platform-team",
  //     isActive: true,
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //     metadata: {
  //       version: "1.0.0",
  //       category: "platform",
  //       tags: ["ai", "customer-service"]
  //     }
  //   },
  //   {
  //     id: "product-2",
  //     name: "payment-gateway",
  //     displayName: "Payment Gateway",
  //     description: "Secure payment processing service",
  //     owner: "payments-team",
  //     isActive: true,
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //     metadata: {
  //       version: "2.1.0",
  //       category: "financial",
  //       tags: ["payments", "security"]
  //     }
  //   },
  //   {
  //     id: "product-3",
  //     name: "notification-engine",
  //     displayName: "Notification Engine",
  //     description: "Multi-channel notification service",
  //     owner: "platform-team",
  //     isActive: true,
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //     metadata: {
  //       version: "1.5.0",
  //       category: "communication",
  //       tags: ["notifications", "messaging"]
  //     }
  //   }
  // ]

  // Get components for each product from the mock data service
  const mockComponents: Record<string, ProductComponent[]> = useMemo(() => {
    const components: Record<string, ProductComponent[]> = {}
    mockProducts.forEach(product => {
      components[product.name] = mockData.getComponents(product.id)
    })
    return components
  }, [mockProducts, mockData])

  /**
   * Filter products based on search query
   */
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return mockProducts

    return mockProducts.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  /**
   * Toggle product expansion
   */
  const toggleProductExpansion = (productName: string) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productName)) {
      newExpanded.delete(productName)
    } else {
      newExpanded.add(productName)
    }
    setExpandedProducts(newExpanded)
  }

  /**
   * Handle product selection
   */
  const handleProductSelect = (product: Product) => {
    onProductSelect?.(product)
    // Auto-expand the selected product
    setExpandedProducts(prev => new Set([...prev, product.name]))
  }

  /**
   * Handle component selection
   */
  const handleComponentSelect = (component: ProductComponent) => {
    onComponentSelect?.(component)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - compact and clean */}
      <div className="p-3 border-b bg-muted/10">
        <div className="flex items-center gap-2 mb-3">
          {onNavigateBack && (
            <Button variant="ghost" size="sm" onClick={onNavigateBack} className="h-7 w-7 p-0">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <h2 className={typography.tile.title}>Products & Components</h2>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onAddProduct && (
                <DropdownMenuItem onClick={onAddProduct}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
          <Input
            placeholder="Search products and components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("!pl-10 !pr-3 h-8", typography.utils.body)}
          >
          </Input>
        </div>
      </div>

      {/* Product and Component List - balanced spacing */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredProducts.map((product) => {
            const isExpanded = expandedProducts.has(product.name)
            const isSelected = selectedProduct?.id === product.id
            const components = mockComponents[product.name] || []

            return (
              <Collapsible
                key={product.id}
                open={isExpanded}
              //onOpenChange={() => toggleProductExpansion(product.name)}
              >
                <Card
                  className={cn(
                    "group cursor-pointer transition-all duration-150 hover:bg-muted/30 hover:shadow-sm relative",
                    isSelected && "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                  )}
                  onClick={() => {
                    // Only select the product if it's not already selected
                    if (selectedProduct?.id !== product.id) {
                      onProductSelect?.(product)
                    }
                    // Always toggle expansion on card click
                    toggleProductExpansion(product.name)
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(typography.tile.title, "truncate font-medium")}>
                              {product.displayName || product.name}
                            </h4>
                            <p className={cn(typography.tile.subtitle, "mt-0.5 line-clamp-1 text-sm")}>
                              {product.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={cn(typography.tile.badge, "px-2 py-0.5 text-xs")}>
                            <Component className="h-3 w-3 mr-1" />
                            {components.length} components
                          </Badge>
                          {product.metadata?.category && (
                            <Badge variant="outline" className={cn(typography.tile.badge, "px-2 py-0.5 text-xs")}>
                              {product.metadata.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons - compact */}
                      <div className="flex items-start gap-1">
                        {/* Edit and Delete Buttons */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="cursor-pointer">
                                <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onEditProduct && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEditProduct(product)
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit {product.name}
                                </DropdownMenuItem>
                              )}
                              {onDeleteProduct && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteProduct(product)
                                  }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete {product.name}
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />

                              {onAddComponent && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onAddComponent(product)
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Component
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                        </div>

                        {/* Expand/Collapse Indicator - now just visual */}
                        <div className="h-6 w-6 flex items-center justify-center">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>

                <CollapsibleContent>
                  <div className="ml-4 mt-1 space-y-1.5 pb-1">
                    {components.length > 0 ? (
                      components.map((component) => {
                        const isComponentSelected = selectedComponent?.id === component.id

                        return (
                          <Card
                            key={component.id}
                            className={cn(
                              "cursor-pointer transition-all duration-150 hover:bg-muted/20 hover:shadow-sm",
                              isComponentSelected && "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/10"
                            )}
                            onClick={() => handleComponentSelect(component)}
                          >
                            <CardContent className="p-2.5">
                              <div className="flex items-start gap-2">
                                <div className="p-1 rounded-sm bg-muted">
                                  <Component className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className={cn(typography.tile.subtitle, "font-medium block text-sm")}>
                                    {component.displayName || component.name}
                                  </span>
                                  {component.description && (
                                    <p className={cn(typography.utils.caption, "mt-0.5 text-muted-foreground text-xs")}>
                                      {component.description}
                                    </p>
                                  )}
                                  {component.metadata?.tags && (
                                    <div className="flex gap-1 mt-1.5">
                                      {component.metadata.tags.slice(0, 3).map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })
                    ) : (
                      <div className="text-center py-4">
                        <div className="p-2 rounded-full bg-muted/50 w-fit mx-auto mb-2">
                          <Component className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className={cn(typography.utils.caption, "text-muted-foreground text-xs")}>
                          No components available
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}