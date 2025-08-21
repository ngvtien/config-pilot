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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu"

/**
 * Navigator panel for product and component selection using real gitops data
 */
interface RealDataProductComponentNavigatorProps {
  products: Product[]
  components: Record<string, ProductComponent[]>
  selectedProduct?: Product | null
  selectedComponent?: ProductComponent | null
  onProductSelect?: (product: Product) => void
  onComponentSelect?: (component: ProductComponent) => void
  onNavigateBack?: () => void
  onEditProduct?: (product: Product) => void
  onDeleteProduct?: (product: Product) => void
  onAddComponent?: (product: Product) => void
  onAddProduct?: () => void
  isLoading?: boolean
}

export const RealDataProductComponentNavigator: React.FC<RealDataProductComponentNavigatorProps> = ({
  products,
  components,
  selectedProduct,
  selectedComponent,
  onProductSelect,
  onComponentSelect,
  onNavigateBack,
  onEditProduct,
  onDeleteProduct,
  onAddComponent,
  onAddProduct,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  /**
   * Handle action button clicks without triggering product selection
   */
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  /**
   * Filter products based on search query
   */
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products

    return products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery, products])

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

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b bg-muted/10">
          <h2 className={typography.tile.title}>Products & Components</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className={typography.utils.caption}>Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - compact and clean */}
      <div className="p-3 border-b bg-muted/10">
        <div className="flex items-center gap-2 mb-3">
          {onNavigateBack && (
            <Button variant="ghost" size="sm" onClick={onNavigateBack} className="h-7 w-7 p-0">
              <ArrowLeft className="h-3.5 w-3.5 zoom-exclude" />
            </Button>
          )}
          <h2 className={typography.tile.title}>Products & Components</h2>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-4 w-4 text-muted-foreground zoom-exclude" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onAddProduct && (
                <DropdownMenuItem onClick={onAddProduct}>
                  <Plus className="h-4 w-4 mr-2 zoom-exclude" />
                  Add Product
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10 zoom-exclude" />
          <Input
            placeholder="Search products and components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("!pl-10 !pr-3 h-8", typography.utils.body)}
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 zoom-exclude" />
              <p className={typography.utils.caption}>No products found</p>
              {searchQuery && (
                <p className={typography.utils.caption}>Try adjusting your search</p>
              )}
            </div>
          ) : (
            filteredProducts.map((product) => {
              const productComponents = components[product.name] || []
              const isExpanded = expandedProducts.has(product.name)
              const isSelected = selectedProduct?.id === product.id

              return (
                <Collapsible 
                  key={product.id} 
                  open={isExpanded} 
                  onOpenChange={() => toggleProductExpansion(product.name)}
                >
                  <div>
                    <Card 
                      className={cn(
                        "border hover:bg-muted/30 transition-colors cursor-pointer",
                        isSelected && "ring-1 ring-primary bg-primary/5"
                      )}
                      onClick={() => handleProductSelect(product)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleProductExpansion(product.name)
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 zoom-exclude" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 zoom-exclude" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className={typography.tile.title}>{product.displayName || product.name}</h3>
                                <Badge variant="outline" className={typography.tile.badge}>
                                  {product.metadata?.category || 'platform'}
                                </Badge>
                              </div>
                              <p className={typography.tile.subtitle}>{product.description}</p>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => handleActionClick(e, () => {})}
                              >
                                <MoreVertical className="h-3.5 w-3.5 zoom-exclude" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {onEditProduct && (
                                <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onEditProduct(product))}>
                                  <Edit className="h-4 w-4 mr-2 zoom-exclude" />
                                  Edit Product
                                </DropdownMenuItem>
                              )}
                              {onAddComponent && (
                                <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onAddComponent(product))}>
                                  <Plus className="h-4 w-4 mr-2 zoom-exclude" />
                                  Add Component
                                </DropdownMenuItem>
                              )}
                              {onDeleteProduct && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => handleActionClick(e, () => onDeleteProduct(product))}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2 zoom-exclude" />
                                    Delete Product
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>

                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-1">
                        {productComponents.length === 0 ? (
                          <div className="text-center py-4">
                            <Component className="h-8 w-8 text-muted-foreground mx-auto mb-2 zoom-exclude" />
                            <p className={typography.utils.caption}>No components</p>
                          </div>
                        ) : (
                          productComponents.map((component) => {
                            const isComponentSelected = selectedComponent?.id === component.id
                            
                            return (
                              <div
                                key={component.id}
                                className={cn(
                                  "ml-4 p-2 rounded-md border cursor-pointer hover:bg-muted/20 transition-colors",
                                  isComponentSelected && "bg-primary/5 ring-1 ring-primary/20"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleComponentSelect(component)
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Component className="h-3.5 w-3.5 text-muted-foreground zoom-exclude" />
                                    <div>
                                      <h4 className={typography.tile.title}>{component.displayName || component.name}</h4>
                                      <p className={typography.tile.subtitle}>{component.description}</p>
                                    </div>
                                  </div>
                                  <Badge 
                                    variant={component.metadata?.status === 'healthy' ? 'default' : 'secondary'}
                                    className={typography.tile.badge}
                                  >
                                    {component.metadata?.status || 'active'}
                                  </Badge>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )}