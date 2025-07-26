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
import {
  Trash2, Edit, Plus, Download, Upload, Package, GitBranch,
  ChevronDown, ChevronRight, Component, Settings, Eye, EyeOff
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
  // generateKubernetesNamespace,
  // generateGitOpsFolderPath,
  // generateApplicationSetName
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
 * Enhanced product management page supporting Products and ProductComponents
 */
export function EnhancedProductManagementPage({ onNavigateBack }: EnhancedProductManagementPageProps) {
  // State for products and components
  const [products, setProducts] = useState<Product[]>([])
  const [components, setComponents] = useState<Record<string, ProductComponent[]>>({})
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

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
   * Load all products and their components
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
    } finally {
      setIsLoading(false)
    }
  }

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
   * Handle creating a new product
   */
  const handleCreateProduct = () => {
    setDialogMode('product')
    setDialogAction('create')
    setEditingProduct(null)
    setProductFormData({})
    setErrors([])
  }

  /**
   * Handle editing a product
   */
  const handleEditProduct = (product: Product) => {
    setDialogMode('product')
    setDialogAction('edit')
    setEditingProduct(product)
    setProductFormData(product)
    setErrors([])
  }

  /**
   * Handle creating a new component
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
   * Handle editing a component
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
   * Get category badge color
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Product & Component Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage products and their deployable components</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleImportProducts}>
            <Download className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExportProducts}>
            <Upload className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleCreateProduct}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Product List with Components */}
      <div className="space-y-4">
        {products.map((product) => {
          const productComponents = components[product.name] || []
          const isExpanded = expandedProducts.has(product.name)

          return (
            <Card key={product.id} className="overflow-hidden">
              {/* Product Header */}
              <CardHeader className="pb-3" onClick={() => toggleProductExpansion(product.name)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleProductExpansion(product.name)}
                      className="p-1 h-6 w-6"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <Package className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{product.displayName || product.name}</CardTitle>
                      <CardDescription>{product.description || 'No description'}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {productComponents.length} component{productComponents.length !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCreateComponent(product.name)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditProduct(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProduct(product)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Product Details & Components */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="grid gap-4">
                    {/* Product Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg" onClick={() => toggleProductExpansion(product.name)}>
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Internal Name:</span>
                        <code className="block bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs mt-1">{product.name}</code>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Owner:</span>
                        <p className="mt-1">{product.owner || 'Unassigned'}</p>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Category:</span>
                        <Badge className={`mt-1 ${getCategoryBadgeColor(product.metadata?.category)}`}>
                          {product.metadata?.category || 'general'}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                        <p className="mt-1 text-xs">{new Date(product.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Components */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Component className="h-4 w-4" />
                          Components ({productComponents.length})
                        </h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateComponent(product.name)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Component
                        </Button>
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
                            <Card key={component.id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">{component.displayName || component.name}</CardTitle>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditComponent(component)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteComponent(component)}
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
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
                                    <a
                                      href={component.metadata.gitOps.repositoryUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate max-w-24"
                                    >
                                      <GitBranch className="h-3 w-3 inline mr-1" />
                                      {component.metadata.gitOps.repositoryUrl.split('/').pop()}
                                    </a>
                                  </div>
                                )}
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                  <Badge variant={component.isActive ? 'default' : 'secondary'} className="text-xs">
                                    {component.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
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

      {/* Product Dialog */}
      <Dialog open={dialogMode === 'product'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
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
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={productFormData.displayName || ''}
                  onChange={(e) => setProductFormData({ ...productFormData, displayName: e.target.value })}
                  placeholder="e.g., Customer AI Platform"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Internal Name *</Label>
                <Input
                  id="name"
                  value={productFormData.name || ''}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="e.g., cai"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={productFormData.owner || ''}
                onChange={(e) => setProductFormData({ ...productFormData, owner: e.target.value })}
                placeholder="e.g., Platform Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
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
                <Label htmlFor="category">Category</Label>
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
                <Label htmlFor="version">Version</Label>
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
              <Label htmlFor="isActive">Active Product</Label>
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

      {/* Component Dialog */}
      <Dialog open={dialogMode === 'component'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
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
                <Label htmlFor="componentDisplayName">Display Name *</Label>
                <Input
                  id="componentDisplayName"
                  value={componentFormData.displayName || ''}
                  onChange={(e) => setComponentFormData({ ...componentFormData, displayName: e.target.value })}
                  placeholder="e.g., Frontend Application"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="componentName">Component Name *</Label>
                <Input
                  id="componentName"
                  value={componentFormData.name || ''}
                  onChange={(e) => setComponentFormData({ ...componentFormData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="e.g., cai-frontend"
                />
              </div>
            </div>

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

            <div className="space-y-2">
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
                      // Call your git service to create branch
                      console.log(`Creating branch: ${env} in ${repositoryUrl}`);

                      // Create default files in each branch
                      // - customers.yaml
                      // - appset.yaml
                      // - values.yaml (optional)

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
              <Label htmlFor="componentIsActive">Active Component</Label>
            </div>

            {/* GitOps Preview */}
            {componentFormData.name && componentFormData.parentProduct && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <h4 className="font-medium text-sm mb-2">GitOps Configuration Preview</h4>
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
  )
}