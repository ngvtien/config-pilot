"use client"
import { useState, useEffect, useMemo } from "react"
import { WorkspaceLayout } from "@/renderer/components/products/product-workspace-resizable"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Search, Plus, Edit, Package, Component, FileText, ChevronRight, Star, Trash2, Upload } from "lucide-react"
import { Product } from "@/shared/types/product"
import { ProductComponent as ProductComponentType } from "@/shared/types/product-component"
import { ProductModal } from "@/renderer/components/products/product-modal"
import { ProductComponentModal } from "@/renderer/components/products/product-component-modal"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"
import { useDialog } from "@/renderer/hooks/useDialog"
import { ResourceSelectionModal } from '@/renderer/components/k8s/ResourceSelectionModal';
import { ResourceYamlEditor } from '@/renderer/components/k8s/ResourceYamlEditor';

interface ProductWorkspacePageProps {
  onNavigateBack?: () => void
}

/**
 * Dedicated Product Workspace page with 3-panel layout:
 * Panel 1: Product Search & Results
 * Panel 2: Product Components
 * Panel 3: Component Resources/Templates
 */
export function ProductWorkspacePage({ onNavigateBack }: ProductWorkspacePageProps) {
  // State management
  const [products, setProducts] = useState<Product[]>([])
  const [components, setComponents] = useState<Record<string, ProductComponentType[]>>({})
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<ProductComponentType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Add favorites state management
  const [favoriteProducts, setFavoriteProducts] = useState<Set<string>>(new Set())

  // Filter state for enhanced left panel
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'recent'>('all')

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false)
  const [showComponentModal, setShowComponentModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingComponent, setEditingComponent] = useState<ProductComponentType | null>(null)

  // Resource selection modal states
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const [componentResources, setComponentResources] = useState<Record<string, any[]>>({});
  
  // Dialog hook for confirmations
  const { showConfirm, showAlert, AlertDialog, ConfirmDialog } = useDialog()

  // Load initial data
  useEffect(() => {
    loadProducts()
  }, [])

  /**
   * Load products from storage/API
   */
  const loadProducts = async () => {
    setIsLoading(true)
    try {
      // Mock data - replace with actual API call
      const mockProducts: Product[] = [
        {
          id: "product-1",
          name: "cai",
          displayName: "CAI",
          description: "Common Application Interface",
          owner: "Tim Walker",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            category: "backend",
            tags: ["api", "microservice"]
          }
        },
        {
          id: "product-2",
          name: "esb",
          displayName: "ESB",
          description: "Enterprise Service Bus",
          owner: "Platform Team",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            category: "integration",
            tags: ["messaging", "integration"]
          }
        }
      ]

      setProducts(mockProducts)

      // Load components for each product
      const mockComponents: Record<string, ProductComponentType[]> = {
        "cai": [
          {
            id: "comp-1",
            name: "cai-frontend",
            displayName: "CAI Frontend",
            description: "React frontend application",
            parentProduct: "cai",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              category: "frontend",
              tags: ["react", "ui"]
            }
          },
          {
            id: "comp-2",
            name: "cai-backend",
            displayName: "CAI Backend",
            description: "Node.js backend API",
            parentProduct: "cai",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              category: "backend",
              tags: ["nodejs", "api"]
            }
          }
        ],
        "esb": [
          {
            id: "comp-3",
            name: "esb-gateway",
            displayName: "ESB Gateway",
            description: "API Gateway component",
            parentProduct: "esb",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              category: "gateway",
              tags: ["api", "gateway"]
            }
          }
        ]
      }

      setComponents(mockComponents)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load favorites from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('product-favorites')
    if (savedFavorites) {
      try {
        const favoritesArray = JSON.parse(savedFavorites)
        setFavoriteProducts(new Set(favoritesArray))
      } catch (error) {
        console.error('Failed to load favorites:', error)
      }
    }
  }, [])

  /**
   * Toggle product favorite status
   */
  const toggleProductFavorite = (productId: string) => {
    setFavoriteProducts(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId)
      } else {
        newFavorites.add(productId)
      }

      // Save to localStorage
      localStorage.setItem('product-favorites', JSON.stringify(Array.from(newFavorites)))

      return newFavorites
    })
  }

  /**
   * Handle deleting a product with confirmation
   */
  const handleDeleteProduct = async (product: Product) => {
    showConfirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete product "${product.displayName || product.name}"?\n\nThis will also delete all associated components. This action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          // Delete from electronAPI if available
          await window.electronAPI?.product?.deleteProduct(product.id)

          // Update local state
          setProducts(prev => prev.filter(p => p.id !== product.id))
          setComponents(prev => {
            const updated = { ...prev }
            delete updated[product.name]
            return updated
          })

          // Clear selection if deleted product was selected
          if (selectedProduct?.id === product.id) {
            setSelectedProduct(null)
            setSelectedComponent(null)
          }

          showAlert({
            title: 'Success',
            message: 'Product deleted successfully',
            variant: 'success'
          })
        } catch (error: any) {
          showAlert({
            title: 'Error',
            message: `Failed to delete product: ${error.message}`,
            variant: 'error'
          })
        }
      }
    })
  }

  /**
   * Handle deleting a component with confirmation
   */
  const handleDeleteComponent = async (component: ProductComponentType) => {
    if (!selectedProduct) return

    showConfirm({
      title: 'Delete Component',
      message: `Are you sure you want to delete component "${component.displayName || component.name}"?\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          // Delete from electronAPI if available
          await window.electronAPI?.productComponent?.deleteComponent(component.id)

          // Update local state
          setComponents(prev => ({
            ...prev,
            [selectedProduct.name]: prev[selectedProduct.name]?.filter(c => c.id !== component.id) || []
          }))

          // Clear selection if deleted component was selected
          if (selectedComponent?.id === component.id) {
            setSelectedComponent(null)
          }

          showAlert({
            title: 'Success',
            message: 'Component deleted successfully',
            variant: 'success'
          })
        } catch (error: any) {
          showAlert({
            title: 'Error',
            message: `Failed to delete component: ${error.message}`,
            variant: 'error'
          })
        }
      }
    })
  }

  /**
   * Filter products based on search query
   */
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  /**
   * Handle product selection
   */
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setSelectedComponent(null) // Reset component selection
  }

  /**
   * Handle component selection
   */
  const handleComponentSelect = (component: ProductComponentType) => {
    setSelectedComponent(component)
  }

  /**
   * Handle product creation
   */
  const handleCreateProduct = () => {
    setEditingProduct(null)
    setShowProductModal(true)
  }

  /**
   * Handle product editing
   */
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setShowProductModal(true)
  }

  /**
   * Handle component creation
   */
  const handleCreateComponent = () => {
    if (!selectedProduct) return
    setEditingComponent(null)
    setShowComponentModal(true)
  }

  /**
   * Handle component editing
   */
  const handleEditComponent = (component: ProductComponentType) => {
    setEditingComponent(component)
    setShowComponentModal(true)
  }

  /**
   * Enhanced Panel 1: Product Search & Results with NavigatorPanel-style design
   */
  const renderProductPanel = () => {

    // Enhanced filtering logic
    const enhancedFilteredProducts = useMemo(() => {
      let filtered = filteredProducts

      // Apply category filter
      switch (activeFilter) {
        case 'favorites':
          // Filter by actual favorites
          filtered = filtered.filter(product => favoriteProducts.has(product.id))
          break
        case 'recent':
          // Sort by creation date or last modified
          filtered = filtered.sort((a, b) =>
            new Date(b.createdAt || b.updatedAt || 0).getTime() -
            new Date(a.createdAt || a.updatedAt || 0).getTime()
          ).slice(0, 5)
          break
      }

      return filtered
    }, [filteredProducts, activeFilter, favoriteProducts])

    /**
     * Get status indicator based on product health
     */
    const getProductStatus = (product: Product): 'healthy' | 'warning' | 'error' => {
      const componentCount = components[product.name]?.length || 0
      if (componentCount === 0) return 'warning'
      if (product.metadata?.status === 'error') return 'error'
      return 'healthy'
    }

    /**
     * Get status color for visual indicator
     */
    const getStatusColor = (status: 'healthy' | 'warning' | 'error') => {
      switch (status) {
        case 'healthy': return 'bg-green-500'
        case 'warning': return 'bg-yellow-500'
        case 'error': return 'bg-red-500'
        default: return 'bg-gray-500'
      }
    }

    return (
      <div className="flex flex-col h-full">
        {/* Enhanced Search Header */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className={typography.tile.title}>Products</h2>
            <Button onClick={handleCreateProduct} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products and components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-8", typography.utils.body)}
            />
          </div>

          {/* Quick Filters */}
          <div className="flex gap-1">
            {(['all', 'favorites', 'recent'] as const).map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(filter)}
                className={typography.utils.caption}
              >
                {filter === 'favorites' && <Star className="h-3 w-3 mr-1" />}
                {filter === 'recent' && <Package className="h-3 w-3 mr-1" />}
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Enhanced Product List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className={typography.card.subtitle}>Loading products...</p>
              </div>
            ) : enhancedFilteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className={typography.card.subtitle}>
                  {searchQuery ? 'No products found' : 'No products yet'}
                </p>
                <Button onClick={handleCreateProduct} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Product
                </Button>
              </div>
            ) : (
              enhancedFilteredProducts.map((product) => {
                const status = getProductStatus(product)
                const componentCount = components[product.name]?.length || 0
                const isFavorite = favoriteProducts.has(product.id)

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50",
                      selectedProduct?.id === product.id && "ring-2 ring-primary"
                    )}
                    onClick={() => handleProductSelect(product)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={cn(typography.tile.title, "truncate")}>
                              {product.displayName || product.name}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleProductFavorite(product.id)
                              }}
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Star 
                                className={cn(
                                  "h-4 w-4 transition-colors",
                                  isFavorite 
                                    ? "fill-yellow-400 text-yellow-400" 
                                    : "text-muted-foreground hover:text-yellow-400"
                                )} 
                              />
                            </button>
                          </div>
                          <p className={cn(typography.tile.subtitle, "mt-1 line-clamp-2")}>
                            {product.description}
                          </p>

                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className={typography.tile.badge}>
                              <Component className="h-3 w-3 mr-1" />
                              {componentCount} components
                            </Badge>
                            {product.metadata?.environment && (
                              <Badge variant="outline" className={typography.tile.badge}>
                                {product.metadata.environment}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <span className={typography.tile.metadata}>
                              {product.createdAt ?
                                new Date(product.createdAt).toLocaleDateString() :
                                'Recently created'
                              }
                            </span>
                            <div className="flex items-center gap-1">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                getStatusColor(status)
                              )} />
                              <span className={typography.tile.metadata}>
                                {status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditProduct(product)
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProduct(product)
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>

                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  /**
   * Panel 2: Product Components
   */
  const renderComponentPanel = () => {
    if (!selectedProduct) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <Component className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className={typography.tile.title}>Select a Product</h3>
          <p className={typography.card.subtitle}>Choose a product to view its components</p>
        </div>
      )
    }

    const productComponents = components[selectedProduct.name] || []

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className={typography.tile.title}>Components</h2>
            <Button onClick={handleCreateComponent} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </div>
          <p className={typography.card.subtitle}>
            {selectedProduct.displayName || selectedProduct.name}
          </p>
        </div>

        {/* Component List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {productComponents.length === 0 ? (
              <div className="text-center py-8">
                <Component className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className={typography.card.subtitle}>No components yet</p>
                <Button onClick={handleCreateComponent} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Component
                </Button>
              </div>
            ) : (
              productComponents.map((component) => (
                <Card
                  key={component.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedComponent?.id === component.id ? 'ring-2 ring-primary' : ''
                    }`}
                  onClick={() => handleComponentSelect(component)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className={typography.card.title}>
                        {component.displayName || component.name}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditComponent(component)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteComponent(component)
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className={typography.card.subtitle}>{component.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-2">
                        {component.metadata?.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Badge variant={component.isActive ? "default" : "secondary"}>
                        {component.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  /**
   * Panel 3: Enhanced Component Resources/Templates with Interactive Features
   */
const renderResourcePanel = () => {
  if (!selectedComponent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className={typography.tile.title}>Select a Component</h3>
        <p className={typography.card.subtitle}>Choose a component to view its resources and templates</p>
      </div>
    )
  }

  const currentResources = componentResources[selectedComponent.id] || [];
  const existingResourceKinds = currentResources.map(r => r.kind);

  const handleAddResource = (resource: any, yamlContent: string) => {
    const newResource = {
      id: `${selectedComponent.id}-${resource.kind}-${Date.now()}`,
      kind: resource.kind,
      apiVersion: resource.apiVersion,
      name: `${selectedComponent.name}-${resource.kind.toLowerCase()}`,
      yamlContent,
      status: 'draft',
      lastModified: new Date()
    };

    setComponentResources(prev => ({
      ...prev,
      [selectedComponent.id]: [...(prev[selectedComponent.id] || []), newResource]
    }));
  };

  const handleEditResource = (resource: any) => {
    setEditingResource(resource);
    setShowYamlEditor(true);
  };

  const handleSaveResource = (yamlContent: string) => {
    if (editingResource) {
      setComponentResources(prev => ({
        ...prev,
        [selectedComponent.id]: prev[selectedComponent.id].map(r => 
          r.id === editingResource.id 
            ? { ...r, yamlContent, lastModified: new Date() }
            : r
        )
      }));
    }
    setShowYamlEditor(false);
    setEditingResource(null);
  };

  const handleDeleteResource = (resourceId: string) => {
    setComponentResources(prev => ({
      ...prev,
      [selectedComponent.id]: prev[selectedComponent.id].filter(r => r.id !== resourceId)
    }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className={typography.tile.title}>Resources & Templates</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowResourceModal(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Deploy
            </Button>
          </div>
        </div>
        <p className={typography.card.subtitle}>
          {selectedComponent.name} • {currentResources.length} resources
        </p>
      </div>

      {/* Resources List */}
      <ScrollArea className="flex-1 p-4">
        {currentResources.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className={typography.card.subtitle}>No resources defined</p>
            <Button
              onClick={() => setShowResourceModal(true)}
              className="mt-4"
              variant="outline"
            >
              Add Your First Resource
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentResources.map((resource) => (
              <Card key={resource.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        resource.status === 'healthy' ? 'bg-green-500' :
                        resource.status === 'warning' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`} />
                      <div>
                        <h4 className="font-medium">{resource.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {resource.kind}
                          </Badge>
                          <span>•</span>
                          <span>{resource.apiVersion}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditResource(resource)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteResource(resource.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Modals */}
      <ResourceSelectionModal
        isOpen={showResourceModal}
        onClose={() => setShowResourceModal(false)}
  context={{
    environment: 'dev', // or get from your app state
    instance: 1,        // or get from your app state
    product: selectedProduct?.name || '',
    customer: '',       // get from your app state
    version: '',        // get from your app state
    baseHostUrl: ''     // get from your app state
  }}        
        onSelectResource={handleAddResource}
        existingResources={existingResourceKinds}
        productName={selectedProduct?.name || ''}
        componentName={selectedComponent.name}
      />

      <ResourceYamlEditor
        isOpen={showYamlEditor}
        onClose={() => setShowYamlEditor(false)}
        onSave={handleSaveResource}
        initialContent={editingResource?.yamlContent || ''}
        resourceKind={editingResource?.kind || ''}
        resourceName={editingResource?.name || ''}
      />
    </div>
  );
};

  return (
    <div className="h-full">
      <WorkspaceLayout
        navigator={renderProductPanel()}
        editor={renderComponentPanel()}
        context={renderResourcePanel()}
        output={null} // Hide output panel for this workspace
      />

      {/* Product Add/Edit Modal */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        product={editingProduct}
        onSave={(product) => {
          // Handle save logic
          console.log('Saving product:', product)
          setShowProductModal(false)
          loadProducts() // Refresh data
        }}
      />

      {/* Component Add/Edit Modal */}
      <ProductComponentModal
        isOpen={showComponentModal}
        onClose={() => setShowComponentModal(false)}
        component={editingComponent}
        parentProduct={selectedProduct?.name || ''}
        onSave={(component) => {
          // Handle save logic
          console.log('Saving component:', component)
          setShowComponentModal(false)
          loadProducts() // Refresh data
        }}
      />

      {/* Dialog components for confirmations */}
      <AlertDialog />
      <ConfirmDialog />

    </div>
  )
}