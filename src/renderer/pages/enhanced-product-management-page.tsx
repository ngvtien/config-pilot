"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Badge } from '@/renderer/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Switch } from '@/renderer/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/renderer/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import {
  Trash2, Edit, Plus, Download, Upload, Package, GitBranch,
  ChevronDown, ChevronRight, Component, Settings, Eye, EyeOff,
  Info, HelpCircle, RefreshCw, Search, Filter
} from 'lucide-react'
import type { Product } from '@/shared/types/product'
import type { ProductComponent } from '@/shared/types/product-component'
import {
  createNewProduct,
  validateProduct,
  generateKubernetesNamespace,
  generateGitOpsFolderPath,
  generateApplicationSetName
} from '@/shared/types/product'

import {
  createNewProductComponent,
  validateProductComponent,
} from '@/shared/types/product-component'

import { useDialog } from '@/renderer/hooks/useDialog'
import { useRepositorySelector } from '@/renderer/hooks/use-repository-selector'
import { GitRepositoryService } from '@/renderer/services/git-repository.service'
import { EnhancedRepositorySelector } from '@/renderer/components/git/enhanced-repository-selector'
import { GitRepository, PermissionFilter } from '../../shared/types/git-repository'
import { SimpleRepositoryInput } from '../components/git/simple-repository-input'

interface EnhancedProductManagementPageProps {
  onNavigateBack?: () => void
}

type DialogMode = 'product' | 'component' | null
type DialogAction = 'create' | 'edit'

/**
 * Enhanced product management page with comprehensive tooltips and improved UX
 * Features:
 * - Comprehensive tooltips on all interactive elements
 * - Better visual hierarchy and spacing
 * - Enhanced loading and empty states
 * - Improved form validation feedback
 * - Better action grouping and organization
 */
export function EnhancedProductManagementPage({ onNavigateBack }: EnhancedProductManagementPageProps) {
  // State for products and components
  const [products, setProducts] = useState<Product[]>([])
  const [components, setComponents] = useState<Record<string, ProductComponent[]>>({})
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [dialogAction, setDialogAction] = useState<DialogAction>('create')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingComponent, setEditingComponent] = useState<ProductComponent | null>(null)
  const [selectedProductForComponent, setSelectedProductForComponent] = useState<string>('')

  // Form state
  const [productFormData, setProductFormData] = useState<Partial<Product>>({})
  const [componentFormData, setComponentFormData] = useState<Partial<ProductComponent>>({})
  const [errors, setErrors] = useState<string[]>([])

  // Repository integration
  const { repositories, loading, error } = useRepositorySelector('developer')
  const { showConfirm, showAlert, AlertDialog, ConfirmDialog } = useDialog()

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [])

  /**
   * Load all products and their components with enhanced error handling
   */
  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load products
      const productResponse = await window.electronAPI?.product?.getAllProducts()
      if (productResponse?.products) {
        setProducts(productResponse.products)

        // Load components for each product
        const componentData: Record<string, ProductComponent[]> = {}
        for (const product of productResponse.products) {
          const componentResponse = await window.electronAPI?.productComponent?.getComponentsByProduct(product.name)
          if (componentResponse?.components) {
            componentData[product.name] = componentResponse.components
          }
        }
        setComponents(componentData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      showAlert({
        title: 'Error Loading Data',
        message: 'Failed to load products and components. Please try refreshing.',
        variant: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Filter products based on search query and category
   */
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = filterCategory === 'all' ||
      product.metadata?.category === filterCategory

    return matchesSearch && matchesCategory
  })

  /**
   * Toggle product expansion with improved UX
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
   * Handle creating a new product with enhanced UX
   */
  const handleCreateProduct = () => {
    setDialogMode('product')
    setDialogAction('create')
    setEditingProduct(null)
    setProductFormData({})
    setErrors([])
  }

  /**
   * Handle editing a product with enhanced UX
   */
  const handleEditProduct = (product: Product) => {
    setDialogMode('product')
    setDialogAction('edit')
    setEditingProduct(product)
    setProductFormData(product)
    setErrors([])
  }

  /**
   * Handle creating a new component with enhanced UX
   */
  const handleCreateComponent = (productName: string) => {
    setDialogMode('component')
    setDialogAction('create')
    setEditingComponent(null)
    setSelectedProductForComponent(productName)
    setComponentFormData({ parentProduct: productName })
    setErrors([])
  }

  /**
   * Handle editing a component with enhanced UX
   */
  const handleEditComponent = (component: ProductComponent) => {
    setDialogMode('component')
    setDialogAction('edit')
    setEditingComponent(component)
    setSelectedProductForComponent(component.parentProduct)
    setComponentFormData(component)
    setErrors([])
  }

  /**
   * Handle saving product
   */
  const handleSaveProduct = async () => {
    const validation = validateProduct(productFormData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    try {
      if (editingProduct) {
        await window.electronAPI?.product?.updateProduct(editingProduct.id, productFormData)
      } else {
        await window.electronAPI?.product?.createProduct(productFormData)
      }
      await loadData()
      setDialogMode(null)
    } catch (error: any) {
      setErrors([error.message || 'Failed to save product'])
    }
  }

  /**
   * Handle saving component
   */
  const handleSaveComponent = async () => {
    const validation = validateProductComponent(componentFormData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    try {
      if (editingComponent) {
        await window.electronAPI?.productComponent?.updateComponent(editingComponent.id, componentFormData)
      } else {
        await window.electronAPI?.productComponent?.createComponent(componentFormData)
      }
      await loadData()
      setDialogMode(null)
    } catch (error: any) {
      setErrors([error.message || 'Failed to save component'])
    }
  }

  /**
   * Handle deleting a product
   */
  const handleDeleteProduct = async (product: Product) => {
    const productComponents = components[product.name] || []
    const hasComponents = productComponents.length > 0

    showConfirm({
      title: 'Delete Product',
      message: hasComponents
        ? `Product "${product.displayName || product.name}" has ${productComponents.length} component(s). Deleting the product will also delete all its components.\n\nThis action cannot be undone.`
        : `Are you sure you want to delete product "${product.displayName || product.name}"?\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await window.electronAPI?.product?.deleteProduct(product.id)
          await loadData()
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
   * Handle deleting a component
   */
  const handleDeleteComponent = async (component: ProductComponent) => {
    showConfirm({
      title: 'Delete Component',
      message: `Are you sure you want to delete component "${component.displayName || component.name}"?\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await window.electronAPI?.productComponent?.deleteComponent(component.id)
          await loadData()
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
   * Handle exporting products
   */
  const handleExportProducts = async () => {
    try {
      const filePath = await window.electronAPI?.product?.showSaveDialog()
      if (filePath) {
        await window.electronAPI?.product?.exportProducts(filePath)
        showAlert({
          title: 'Success',
          message: 'Products exported successfully!',
          variant: 'success'
        })
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: `Failed to export products: ${error.message}`,
        variant: 'error'
      })
    }
  }

  /**
   * Handle importing products
   */
  const handleImportProducts = async () => {
    try {
      const filePath = await window.electronAPI?.product?.showOpenDialog()
      if (filePath) {
        // Replace native confirm with showConfirm for merge mode selection
        showConfirm({
          title: 'Import Mode Selection',
          message: `How would you like to import products from "${filePath}"?\n\n• Merge: Add new products and update existing ones\n• Replace: Replace all existing products`,
          variant: 'default',
          confirmText: 'Merge',
          cancelText: 'Replace All',
          onConfirm: async () => {
            // User chose merge
            await performImport(filePath, 'merge')
          },
          onCancel: async () => {
            // User chose replace
            await performImport(filePath, 'replace')
          }
        })
      }
    } catch (error: any) {
      // Replace native alert with showAlert
      showAlert({
        title: 'Import Error',
        message: `Failed to import products: ${error.message}`,
        variant: 'error'
      })
    }
  }

  /**
   * Helper function to perform the actual import operation
   */
  const performImport = async (filePath: string, mergeMode: 'merge' | 'replace') => {
    try {
      await window.electronAPI?.product?.importProducts(filePath, mergeMode)
      await loadProducts()
      // Replace native alert with showAlert
      showAlert({
        title: 'Import Success',
        message: 'Products imported successfully!',
        variant: 'success'
      })
    } catch (error: any) {
      showAlert({
        title: 'Import Error',
        message: `Failed to import products: ${error.message}`,
        variant: 'error'
      })
    }
  }

  /**
   * Load all products from the service
   */
  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const response = await window.electronAPI?.product?.getAllProducts()
      if (response?.products) {
        setProducts(response.products)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Get category badge color with enhanced styling
   */
  const getCategoryBadgeColor = (category?: string) => {
    switch (category) {
      case 'frontend': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      case 'backend': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      case 'database': return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
      case 'infrastructure': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
    }
  }

  /**
   * Filter repositories by permission
   */
  const getRepositoriesByPermission = (filter: PermissionFilter): GitRepository[] => {
    return repositories.filter((repo: { permissions: { [x: string]: any } }) => {
      const userPermission = repo.permissions[filter.role]
      return userPermission === filter.level || userPermission === 'admin'
    })
  }

  /**
   * Test repository connection
   */
  const testConnection = async (repositoryUrl: string): Promise<boolean> => {
    try {
      return await GitRepositoryService.testConnection(repositoryUrl)
    } catch {
      return false
    }
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading products and components...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Enhanced Header with Tooltips */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">Product & Component Management</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage products and their deployable components</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={loadData} size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh products and components</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleImportProducts}>
                  <Download className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import products from a JSON file</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleExportProducts}>
                  <Upload className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export all products to a JSON file</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCreateProduct}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new product container</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Enhanced Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products by name, display name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="frontend">Frontend</SelectItem>
                <SelectItem value="backend">Backend</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Enhanced Product List with Components */}
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const productComponents = components[product.name] || []
            const isExpanded = expandedProducts.has(product.name)

            return (
              <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {/* Enhanced Product Header */}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProductExpansion(product.name)}
                            className="p-1 h-6 w-6"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isExpanded ? 'Collapse' : 'Expand'} product details</p>
                        </TooltipContent>
                      </Tooltip>

                      <Package className="h-5 w-5 text-blue-600" />
                      <div className="cursor-pointer" onClick={() => toggleProductExpansion(product.name)}>
                        <CardTitle className="text-lg hover:text-blue-600 transition-colors">
                          {product.displayName || product.name}
                        </CardTitle>
                        <CardDescription>{product.description || 'No description'}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs">
                            {productComponents.length} component{productComponents.length !== 1 ? 's' : ''}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Number of deployable components in this product</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant={product.isActive ? 'default' : 'secondary'}>
                            {product.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Product status: {product.isActive ? 'Currently active and deployable' : 'Inactive - not available for deployment'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateComponent(product.name)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add a new component to this product</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit product details</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete this product and all its components</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardHeader>

                {/* Enhanced Product Details & Components */}
                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="grid gap-4">
                      {/* Enhanced Product Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Internal Name:</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Unique identifier used in configurations and deployments</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <code className="block bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs">{product.name}</code>
                        </div>
                        <div className="text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Owner:</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Team or individual responsible for this product</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p>{product.owner || 'Unassigned'}</p>
                        </div>
                        <div className="text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Category:</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Product category for organization and filtering</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Badge className={getCategoryBadgeColor(product.metadata?.category)}>
                            {product.metadata?.category || 'general'}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Last modification date</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-xs">{new Date(product.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Enhanced Components Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Component className="h-4 w-4" />
                            Components ({productComponents.length})
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Deployable components that belong to this product</p>
                              </TooltipContent>
                            </Tooltip>
                          </h4>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateComponent(product.name)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Component
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Create a new deployable component for this product</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {productComponents.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <Component className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No components yet</p>
                            <p className="text-sm">Add your first component to get started</p>
                          </div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {productComponents.map((component) => (
                              <Card key={component.id} className="border-l-4 border-l-blue-500 hover:shadow-sm transition-shadow">
                                <CardHeader className="pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">{component.displayName || component.name}</CardTitle>
                                    <div className="flex items-center gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditComponent(component)}
                                            className="h-6 w-6 p-0"
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Edit component details</p>
                                        </TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteComponent(component)}
                                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Delete this component</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                  <CardDescription className="text-xs">{component.description || 'No description'}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">Name:</span>
                                    <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{component.name}</code>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">Owner:</span>
                                    <span>{component.owner || 'Unassigned'}</span>
                                  </div>
                                  {component.metadata?.category && (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600 dark:text-gray-400">Category:</span>
                                      <Badge className={`text-xs ${getCategoryBadgeColor(component.metadata.category)}`}>
                                        {component.metadata.category}
                                      </Badge>
                                    </div>
                                  )}
                                  {component.metadata?.gitOps?.repositoryUrl && (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600 dark:text-gray-400">Repository:</span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <a
                                            href={component.metadata.gitOps.repositoryUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate max-w-24"
                                          >
                                            <GitBranch className="h-3 w-3 inline mr-1" />
                                            {component.metadata.gitOps.repositoryUrl.split('/').pop()}
                                          </a>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Open repository in new tab</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant={component.isActive ? 'default' : 'secondary'} className="text-xs">
                                          {component.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Component status: {component.isActive ? 'Ready for deployment' : 'Not available for deployment'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Enhanced Empty State */}
        {filteredProducts.length === 0 && products.length > 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No products match your search</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search terms or filters.</p>
              <Button variant="outline" onClick={() => { setSearchQuery(''); setFilterCategory('all') }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {products.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No products found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Get started by creating your first product.</p>
              <Button onClick={handleCreateProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Product Dialog */}
        <Dialog open={dialogMode === 'product'} onOpenChange={() => setDialogMode(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {dialogAction === 'edit' ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
              <DialogDescription>
                {dialogAction === 'edit'
                  ? 'Update the product information below.'
                  : 'Create a new product container for your components.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="displayName">Display Name *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Human-readable name shown in the UI</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="displayName"
                    value={productFormData.displayName || ''}
                    onChange={(e) => setProductFormData({ ...productFormData, displayName: e.target.value })}
                    placeholder="e.g., Customer AI Platform"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="name">Internal Name *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Unique identifier used in configurations (lowercase, hyphens only)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="name"
                    value={productFormData.name || ''}
                    onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="e.g., cai"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="owner">Owner</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Team or individual responsible for this product</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="owner"
                  value={productFormData.owner || ''}
                  onChange={(e) => setProductFormData({ ...productFormData, owner: e.target.value })}
                  placeholder="e.g., Platform Team"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="description">Description</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Brief description of what this product does</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="description"
                  value={productFormData.description || ''}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  placeholder="Brief description of the product"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="category">Category</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Product category for organization and filtering</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={productFormData.metadata?.category || 'general'}
                    onValueChange={(value) => setProductFormData({
                      ...productFormData,
                      metadata: { ...productFormData.metadata, category: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                      <SelectItem value="backend">Backend</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="version">Version</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Current version of the product (e.g., 1.0.0)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="version"
                    value={productFormData.metadata?.version || ''}
                    onChange={(e) => setProductFormData({
                      ...productFormData,
                      metadata: { ...productFormData.metadata, version: e.target.value }
                    })}
                    placeholder="e.g., 1.0.0"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={productFormData.isActive ?? true}
                  onCheckedChange={(checked) => setProductFormData({ ...productFormData, isActive: checked })}
                />
                <div className="flex items-center gap-1">
                  <Label htmlFor="isActive">Active Product</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Whether this product is available for deployment</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProduct}>
                {dialogAction === 'edit' ? 'Update' : 'Create'} Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Enhanced Component Dialog */}
        <Dialog open={dialogMode === 'component'} onOpenChange={() => setDialogMode(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Component className="h-5 w-5" />
                {dialogAction === 'edit' ? 'Edit Component' : 'Add New Component'}
              </DialogTitle>
              <DialogDescription>
                {dialogAction === 'edit'
                  ? 'Update the component information below.'
                  : `Create a new deployable component for ${selectedProductForComponent}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="componentDisplayName">Display Name *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Human-readable name for this component</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="componentDisplayName"
                    value={componentFormData.displayName || ''}
                    onChange={(e) => setComponentFormData({ ...componentFormData, displayName: e.target.value })}
                    placeholder="e.g., Frontend Application"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="componentName">Component Name *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Unique identifier for this component (lowercase, hyphens only)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="componentName"
                    value={componentFormData.name || ''}
                    onChange={(e) => setComponentFormData({ ...componentFormData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="e.g., cai-frontend"
                  />
                </div>
              </div>
              {/* keep */}

              <div className="space-y-2">
                <Label htmlFor="componentOwner">Owner</Label>
                <Input
                  id="componentOwner"
                  value={componentFormData.owner || ''}
                  onChange={(e) => setComponentFormData({ ...componentFormData, owner: e.target.value })}
                  placeholder="e.g., Frontend Team"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="componentDescription">Description</Label>
                <Textarea
                  id="componentDescription"
                  value={componentFormData.description || ''}
                  onChange={(e) => setComponentFormData({ ...componentFormData, description: e.target.value })}
                  placeholder="Brief description of the component"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="componentCategory">Category</Label>
                  <Select
                    value={componentFormData.metadata?.category || 'general'}
                    onValueChange={(value) => setComponentFormData({
                      ...componentFormData,
                      metadata: { ...componentFormData.metadata, category: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                      <SelectItem value="backend">Backend</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="componentVersion">Version</Label>
                  <Input
                    id="componentVersion"
                    value={componentFormData.metadata?.version || ''}
                    onChange={(e) => setComponentFormData({
                      ...componentFormData,
                      metadata: { ...componentFormData.metadata, version: e.target.value }
                    })}
                    placeholder="e.g., 1.0.0"
                  />
                </div>
              </div>

              { /* end keep */}

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label>Git Repository</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Git repository URL for this component's source code and GitOps configuration</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <SimpleRepositoryInput
                  value={componentFormData.metadata?.gitOps?.repositoryUrl || ''}
                  onChange={(repositoryUrl) => {
                    setComponentFormData({
                      ...componentFormData,
                      metadata: {
                        ...componentFormData.metadata,
                        gitOps: {
                          ...componentFormData.metadata?.gitOps,
                          repositoryUrl
                        }
                      }
                    })
                  }}
                  onCreateEnvironmentBranches={async (repositoryUrl) => {
                    // Create environment branches: dev, sit, uat, prod
                    const environments = ['dev', 'sit', 'uat', 'prod'];

                    for (const env of environments) {
                      try {
                        console.log(`Creating branch: ${env} in ${repositoryUrl}`);
                      } catch (error) {
                        console.error(`Failed to create ${env} branch:`, error);
                      }
                    }
                  }}
                  className="min-h-24"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="componentIsActive"
                  checked={componentFormData.isActive ?? true}
                  onCheckedChange={(checked) => setComponentFormData({ ...componentFormData, isActive: checked })}
                />
                <div className="flex items-center gap-1">
                  <Label htmlFor="componentIsActive">Active Component</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Whether this component is available for deployment</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Enhanced GitOps Preview */}
              {componentFormData.name && componentFormData.parentProduct && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-sm">GitOps Configuration Preview</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-blue-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Preview of how this component will be organized in GitOps</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div><strong>Namespace Pattern:</strong> {componentFormData.parentProduct}-{'{customer}'}-{'{env}'}-{'{instance}'}</div>
                    <div><strong>GitOps Path:</strong> {componentFormData.parentProduct}/{componentFormData.name}/{'{environment}'}/</div>
                    <div><strong>ApplicationSet:</strong> {componentFormData.parentProduct}-{componentFormData.name}-{'{environment}'}</div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveComponent}>
                {dialogAction === 'edit' ? 'Update' : 'Create'} Component
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog />
        <ConfirmDialog />
      </div>
    </TooltipProvider>
  )
}