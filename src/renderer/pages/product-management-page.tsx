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
import { Trash2, Edit, Plus, Download, Upload, Package, GitBranch } from 'lucide-react'
import type { Product } from '@/shared/types/product'
import { createNewProduct, validateProduct } from '@/shared/types/product'
import { useDialog } from '@/renderer/hooks/useDialog'
import { useRepositorySelector } from '@/renderer/hooks/use-repository-selector'
import { GitRepositoryService } from '@/renderer/services/git-repository.service'
import { RepositoryRegistrationDialog } from '@/renderer/components/git/repository-registration-dialog'
import { EnhancedRepositorySelector } from '@/renderer/components/git/enhanced-repository-selector'
import { GitRepository, PermissionFilter } from '../../shared/types/git-repository'
// import { EnhancedRepositorySelector } from '@/renderer/components/git/enhanced-repository-selector'
// import { GitOpsStructureValidator } from '@/renderer/components/git/gitops-structure-validator'

interface ProductManagementPageProps {
  onNavigateBack?: () => void
}

/**
 * Product management page for CRUD operations
 */
export function ProductManagementPage({ onNavigateBack }: ProductManagementPageProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<Product>>({})
  const [errors, setErrors] = useState<string[]>([])

  const { repositories, loading, error } = useRepositorySelector('developer');
  const [showNewRepoDialog, setShowNewRepoDialog] = useState(false)

  // Load products on component mount
  useEffect(() => {
    loadProducts()
  }, [])

  /**
   * Filter repositories by permission (implement the missing function)
   */
  const getRepositoriesByPermission = (filter: PermissionFilter): GitRepository[] => {
    return repositories.filter((repo: { permissions: { [x: string]: any } }) => {
      const userPermission = repo.permissions[filter.role];
      return userPermission === filter.level || userPermission === 'admin';
    });
  };

  /**
   * Test repository connection (implement the missing function)
   */
  const testConnection = async (repositoryUrl: string): Promise<boolean> => {
    try {
      return await GitRepositoryService.testConnection(repositoryUrl);
    } catch {
      return false;
    }
  };

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
   * Handle creating a new product
   */
  const handleCreateProduct = () => {
    setEditingProduct(null)
    setFormData({})
    setErrors([])
    setIsDialogOpen(true)
  }

  /**
   * Handle editing an existing product
   */
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setFormData(product)
    setErrors([])
    setIsDialogOpen(true)
  }

  /**
   * Handle saving product (create or update)
   */
  const handleSaveProduct = async () => {
    const validation = validateProduct(formData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    try {
      if (editingProduct) {
        await window.electronAPI?.product?.updateProduct(editingProduct.id, formData)
      } else {
        await window.electronAPI?.product?.createProduct(formData)
      }
      await loadProducts()
      setIsDialogOpen(false)
    } catch (error: any) {
      setErrors([error.message || 'Failed to save product'])
    }
  }

  const { showConfirm, showAlert, AlertDialog, ConfirmDialog } = useDialog()

  /**
   * Handle deleting a product
   */
  const handleDeleteProduct = async (product: Product) => {
    showConfirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete product "${product.displayName || product.name}"?\n\nThis action cannot be undone.`,
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await window.electronAPI?.product?.deleteProduct(product.id)
          await loadProducts()
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
   * Add new repository from product form
   */
  const handleAddNewRepository = async (repoData: any) => {
    try {
      const newRepo = await GitRepositoryService.createRepository(repoData)
      // Update form with new repository URL
      handleRepositoryChange(newRepo.url)
      setShowNewRepoDialog(false)
    } catch (error: any) {
      console.error('Failed to add repository:', error.message)
    }
  }

  /**
   * Handle repository selection
   */
  const handleRepositoryChange = (repositoryUrl: string) => {
    setFormData({
      ...formData,
      metadata: { ...formData.metadata, repository: repositoryUrl }
    })
  }

  const handleCreateBranch = async (repoUrl: string, branchName: string) => {
    try {
      console.log(`Creating branch ${branchName} in repository ${repoUrl}`);
      // In real implementation, this would call the backend to create the branch
      // and potentially update the product's repository configuration
    } catch (error) {
      console.error('Failed to create branch:', error);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading products...</p>
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
            <h1 className="text-2xl font-bold">Product Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your products and their configurations</p>
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

      {/* Product List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{product.displayName || product.name}</CardTitle>
                <div className="flex items-center gap-1">
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
              <CardDescription>{product.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs text-gray-900 dark:text-gray-100">{product.name}</code>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Owner:</span>
                <span className="text-gray-900 dark:text-gray-100">{product.owner || 'Unassigned'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Category:</span>
                <Badge className={getCategoryBadgeColor(product.metadata?.category)}>
                  {product.metadata?.category || 'general'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <Badge variant={product.isActive ? 'default' : 'secondary'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {product.metadata?.version && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Version:</span>
                  <span className="text-gray-900 dark:text-gray-100">{product.metadata.version}</span>
                </div>
              )}
              {product.metadata?.repository && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Repository:</span>
                  <a 
                    href={product.metadata.repository} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs truncate max-w-48"
                  >
                    {product.metadata.repository}
                  </a>
                </div>
              )}              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Updated: {new Date(product.updatedAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update the product information below.'
                : 'Create a new product by filling out the form below.'}
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
                  value={formData.displayName || ''}
                  onChange={(e: { target: { value: any } }) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g., User Management API"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Internal Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e: { target: { value: string } }) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="e.g., user-mgmt-api"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={formData.owner || ''}
                onChange={(e: { target: { value: any } }) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="e.g., Backend Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e: { target: { value: any } }) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the product"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.metadata?.category || 'general'}
                  onValueChange={(value: any) => setFormData({
                    ...formData,
                    metadata: { ...formData.metadata, category: value }
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
                  value={formData.metadata?.version || ''}
                  onChange={(e: { target: { value: any } }) => setFormData({
                    ...formData,
                    metadata: { ...formData.metadata, version: e.target.value }
                  })}
                  placeholder="e.g., 1.0.0"
                />
              </div>
            </div>

            {/**
            <div className="space-y-2">
              <Label htmlFor="repository">Repository</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.metadata?.repository || ''}
                  onValueChange={handleRepositoryChange}
                  disabled={reposLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repositories.map((repo: any) => (
                      <SelectItem key={repo.id} value={repo.url}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>{repo.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {repo.branch}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewRepoDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select from configured repositories or add a new one
              </p>
            </div>
 */}

            {/*
             <div className="space-y-2">
              <Label htmlFor="repository">Repository Configuration</Label>
              <EnhancedRepositorySelector
                value={formData.metadata?.repository || ''}
                onChange={handleRepositoryChange}
                onCreateBranch={handleCreateBranch}
              />
              {formData.metadata?.repository && (
                <GitOpsStructureValidator repositoryUrl={formData.metadata.repository} />
              )}
              <p className="text-xs text-muted-foreground">
                Select a repository that follows the GitOps structure defined in the PRD
              </p>
            </div>
*/}

            {/* <div className="space-y-2">
              <Label htmlFor="repository">Repository</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.metadata?.repository || ''}
                  onValueChange={handleRepositoryChange}
                  disabled={reposLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repositories.map((repo: any) => (
                      <SelectItem key={repo.id} value={repo.url}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>{repo.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {repo.branch}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewRepoDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select from configured repositories or add a new one
              </p>
            </div> */}

            <div className="space-y-2">
              <Label htmlFor="repository">Repository *</Label>
              <EnhancedRepositorySelector
                repositories={repositories}
                getRepositoriesByPermission={getRepositoriesByPermission}
                testConnection={testConnection}
                value={editingProduct?.repository || ''}
                onChange={(repositoryUrl: any) => {
                  if (editingProduct) {
                    setEditingProduct({ ...editingProduct, repository: repositoryUrl });
                  }
                }}
                onCreateBranch={handleCreateBranch}
                filterByPermission={{
                  role: 'developer',
                  level: 'any'
                }}
                showGitOpsValidation={true}
                className="min-h-32"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive ?? true}
                onCheckedChange={(checked: any) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active Product</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct}>
              {editingProduct ? 'Update' : 'Create'} Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RepositoryRegistrationDialog
        open={showNewRepoDialog}
        onOpenChange={setShowNewRepoDialog}
        onSuccess={handleAddNewRepository}
      />

      <AlertDialog />
      <ConfirmDialog />
    </div>
  )
}