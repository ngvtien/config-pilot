"use client"
import React, { useState, useEffect } from 'react'
import { ProductWorkspace4Panel } from '@/renderer/components/products/product-workspace-4panel'
import { SmartFileTree, FileTreeNode } from '@/renderer/components/ide/smart-file-tree'
import { ContextAwareEditor } from '@/renderer/components/ide/context-aware-editor'
import { Product } from '@/shared/types/product'
import { ProductComponent } from '@/shared/types/product-component'
import { ProductComponentTiles } from '@/renderer/components/products/product-component-tiles'
import { ProductComponentNavigator } from '@/renderer/components/products/product-component-navigator'
import { typography } from '@/renderer/lib/typography'
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Input } from '@/renderer/components/ui/input'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { ScrollArea } from '@/renderer/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/renderer/components/ui/collapsible'
import { FolderOpen, X, Package, GitBranch, ChevronDown, ChevronRight, Folder, Search, MoreVertical, Plus, Edit, Trash2, ArrowLeft, Component } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'

interface ProductDeploymentDesignerPoCProps {
  onNavigateBack?: () => void
}

/**
 * PoC: Product & Deployment Designer with 4-panel IDE-style layout
 * Enhanced with multi-file tab support
 * Layout: [Navigator | FileExplorer | Multi-File Editor with Tabs]
 *         [              Console Output                      ]
 */
export function ProductDeploymentDesignerPoC({ onNavigateBack }: ProductDeploymentDesignerPoCProps) {
  // Product and component selection state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<ProductComponent | null>(null)

  // GitOps integration state
  const [gitOpsData, setGitOpsData] = useState<Array<{
    productName: string
    success: boolean
    metadata?: any
    components?: Array<{ name: string, metadata: any }>
    error?: string
  }>>([])
  const [isLoadingGitOps, setIsLoadingGitOps] = useState(false)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')

  // Multi-file editor state
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null)
  const [openFiles, setOpenFiles] = useState<FileTreeNode[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<Record<string, string>>({})

  // Console output state
  const [consoleOutput, setConsoleOutput] = useState<string[]>([])

  // Add error and loading states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxConsoleLines] = useState(100) // Limit console output

  // Remove folder management state - using GitOps data instead

  /**
 * Open a file in a new tab or switch to existing tab
 */
  const openFile = async (file: FileTreeNode) => {
    // Check if file is already open
    setOpenFiles(prev => {
      if (!prev.find(f => f.id === file.id)) {
        return [...prev, file]
      }
      return prev
    })

    setActiveFileId(file.id)

    // Load content if not already loaded
    if (!fileContents[file.id]) {
      try {
        setIsLoading(true)
        setError(null)

        let content: string
        if (file.content && file.content.trim()) {
          // Use the existing content from the file (e.g., from newly created resources)
          content = file.content
          addToConsole(`Loaded existing content for: ${file.path}`)
        } else {
          // Generate mock content for files without existing content
          content = await generateMockContentSafe(file)
          addToConsole(`Generated mock content for: ${file.path}`)
        }

        setFileContents(prev => ({
          ...prev,
          [file.id]: content
        }))

        addToConsole(`Opened file in tab: ${file.path}`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setError(errorMessage)
        addToConsole(`Error opening file: ${errorMessage}`, 'error')
      } finally {
        setIsLoading(false)
      }
    }
  }

  /**
   * Close a file tab
   */
  const closeFile = (fileId: string) => {
    setOpenFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId)
      // Update active file if the closed file was active
      setActiveFileId(currentActiveId => {
        if (currentActiveId === fileId) {
          return updated.length > 0 ? updated[0].id : null
        }
        return currentActiveId
      })
      return updated
    })

    // Remove file content from memory
    setFileContents(prev => {
      const { [fileId]: removed, ...rest } = prev
      return rest
    })

    const closedFile = openFiles.find(f => f.id === fileId)
    if (closedFile) {
      addToConsole(`Closed file: ${closedFile.path}`)
    }
  }

  /**
   * Enhanced file selection with automatic tab opening
   */
  const handleFileSelect = async (file: FileTreeNode) => {
    setSelectedFile(file)
    // Automatically open the file in a tab
    await openFile(file)
  }

  /**
   * Safe console output with size management
   */
  const addToConsole = (message: string, type: 'info' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const formattedMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`

    setConsoleOutput(prev => {
      const newOutput = [...prev, formattedMessage]
      // Keep only the last maxConsoleLines entries
      return newOutput.slice(-maxConsoleLines)
    })
  }

  // Removed folder management functions - using GitOps data instead

  /**
   * Enhanced mock content generation with validation
   */
  const generateMockContentSafe = async (file: FileTreeNode): Promise<string> => {
    if (!file || !file.name) {
      throw new Error('Invalid file object')
    }

    // Validate component name for YAML generation
    const componentName = selectedComponent?.name?.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() || 'example'

    if (file.metadata?.fileType === 'yaml') {
      if (file.metadata?.resourceKind === 'Deployment') {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${componentName}
  labels:
    app: ${componentName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${componentName}
  template:
    metadata:
      labels:
        app: ${componentName}
    spec:
      containers:
      - name: ${componentName}
        image: nginx:latest
        ports:
        - containerPort: 80`
      }
      if (file.metadata?.chartType) {
        return `apiVersion: v2
name: ${componentName}
description: A Helm chart for ${selectedComponent?.displayName || componentName}
type: application
version: 0.1.0
appVersion: "1.0.0"`
      }
    }

    return `# ${file.name}
# Content for ${file.path}
# Component: ${componentName}
# Generated: ${new Date().toISOString()}`
  }

  /**
   * Generate mock content based on file type
   */
  const generateMockContent = (file: FileTreeNode): string => {
    if (file.metadata?.fileType === 'yaml') {
      if (file.metadata?.resourceKind === 'Deployment') {
        return `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${selectedComponent?.name || 'example'}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${selectedComponent?.name || 'example'}`
      }
      if (file.metadata?.chartType) {
        return `apiVersion: v2\nname: ${selectedComponent?.name || 'example'}\ndescription: A Helm chart\ntype: application\nversion: 0.1.0`
      }
    }
    return `# ${file.name}\n# Content for ${file.path}`
  }

  /**
   * Fetch GitOps data for all products
   */
  const fetchGitOpsData = async () => {
    setIsLoadingGitOps(true)
    addToConsole('Fetching products from product management system...', 'info')

    try {
      // First, try to get all products from the product management system
      let products: any[] = []

      try {
        const result = await window.electronAPI?.product?.getAllProducts?.()
        addToConsole(`Raw products result: ${JSON.stringify(result)}`, 'info')

        if (Array.isArray(result)) {
          products = result
        } else if (result && typeof result === 'object') {
          // Handle case where result might be wrapped in an object
          products = result.products || result.data || []
        }
      } catch (productError: any) {
        addToConsole(`Error calling getAllProducts: ${productError.message}`, 'error')
      }

      if (!products || !Array.isArray(products) || products.length === 0) {
        addToConsole('No products found in product management system, using fallback approach', 'warning')

        // Fallback: Use known GitOps repositories from settings or configuration
        // This is a temporary solution until the product service is working
        const fallbackRepositories = [
          {
            productName: 'cai',
            repositoryUrl: 'http://localhost:9080/da/gitops-products-cai.git',
            localPath: 'C:\\tmp/repositories/gitops-products-cai'
          },
          {
            productName: 'esb',
            repositoryUrl: 'http://localhost:9080/da/gitops-products-esb.git',
            localPath: 'C:\\tmp/repositories/gitops-products-esb'
          }
        ]

        addToConsole('Using fallback repositories for GitOps data', 'info')

        // Fetch GitOps metadata for fallback repositories
        const result = await window.electronAPI?.git?.batchFetchGitOpsMetadata?.({
          repositories: fallbackRepositories
        })

        if (result?.success) {
          setGitOpsData(result.results)
          const successCount = result.results.filter((r: any) => r.success).length
          addToConsole(`Successfully fetched GitOps data: ${successCount}/${result.results.length} repositories`, 'info')

          // Auto-select first successful product if available
          const firstSuccessfulProduct = result.results.find((r: any) => r.success)
          if (firstSuccessfulProduct && firstSuccessfulProduct.metadata) {
            const productData: Product = {
              id: firstSuccessfulProduct.productName,
              name: firstSuccessfulProduct.productName,
              displayName: firstSuccessfulProduct.metadata?.product?.displayName || firstSuccessfulProduct.productName,
              description: firstSuccessfulProduct.metadata?.product?.description || '',
              metadata: firstSuccessfulProduct.metadata,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as Product

            handleProductSelect(productData)
          }
        } else {
          throw new Error(result?.error || 'Failed to fetch GitOps data from fallback repositories')
        }
        return
      }

      addToConsole(`Found ${products.length} products, checking GitOps configuration...`, 'info')

      // Filter products that have GitOps configuration
      const gitOpsProducts = products.filter((product: any) =>
        product.metadata?.gitOps?.repositoryUrl && product.metadata?.gitOps?.localPath
      )

      if (gitOpsProducts.length === 0) {
        addToConsole('No products have GitOps repositories configured', 'warning')
        setGitOpsData([])
        return
      }

      addToConsole(`Found ${gitOpsProducts.length} products with GitOps configuration`, 'info')

      // Build repository list from products with GitOps configuration
      const repositories = gitOpsProducts.map((product: any) => ({
        productName: product.name,
        repositoryUrl: product.metadata.gitOps.repositoryUrl,
        localPath: product.metadata.gitOps.localPath
      }))

      addToConsole('Fetching GitOps metadata from repositories...', 'info')

      // Fetch GitOps metadata for all repositories
      const result = await window.electronAPI?.git?.batchFetchGitOpsMetadata?.({
        repositories
      })

      if (result?.success) {
        setGitOpsData(result.results)
        const successCount = result.results.filter((r: any) => r.success).length
        addToConsole(`Successfully fetched GitOps data: ${successCount}/${result.results.length} repositories`, 'info')

        // Auto-select first successful product if available
        const firstSuccessfulProduct = result.results.find((r: any) => r.success)
        if (firstSuccessfulProduct && firstSuccessfulProduct.metadata) {
          const productData: Product = {
            id: firstSuccessfulProduct.productName,
            name: firstSuccessfulProduct.productName,
            displayName: firstSuccessfulProduct.metadata?.product?.displayName || firstSuccessfulProduct.productName,
            description: firstSuccessfulProduct.metadata?.product?.description || '',
            metadata: firstSuccessfulProduct.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Product

          handleProductSelect(productData)
        }
      } else {
        throw new Error(result?.error || 'Failed to fetch GitOps data')
      }
    } catch (error: any) {
      addToConsole(`Error fetching GitOps data: ${error.message}`, 'error')
      setError(error.message)
      setGitOpsData([])
    } finally {
      setIsLoadingGitOps(false)
    }
  }

  /**
   * Enhanced product selection with validation
   */
  const handleProductSelect = (product: Product) => {
    if (!product || !product.id) {
      addToConsole('Invalid product selected', 'error')
      return
    }

    setSelectedProduct(product)
    setSelectedComponent(null)
    setSelectedFile(null)
    setFileContents({})
    setError(null)
    addToConsole(`Selected product: ${product.displayName || product.name}`)
  }

  /**
   * Enhanced component selection with GitOps integration
   */
  const handleComponentSelect = (component: ProductComponent) => {
    if (!component || !component.id) {
      addToConsole('Invalid component selected', 'error')
      return
    }

    // Construct the component folder path based on GitOps structure
    let componentFolderPath = ''
    if (selectedProduct) {
      const productGitOps = gitOpsData.find(p => p.productName === selectedProduct.name)
      if (productGitOps && productGitOps.success) {
        // Construct path: <product-repo-local-path>/<component-name>
        const productLocalPath = productGitOps.metadata?.localPath || `C:\\tmp\\repositories\\gitops-products-${selectedProduct.name}`
        componentFolderPath = `${productLocalPath}\\${component.name}`
        addToConsole(`Component folder path: ${componentFolderPath}`, 'info')
      }
    }

    // Update component with folder path
    const updatedComponent = {
      ...component,
      componentFolderPath
    }

    setSelectedComponent(updatedComponent)
    setSelectedFile(null)
    setFileContents({})
    setError(null)
    addToConsole(`Selected component: ${component.displayName || component.name}`)

    // Load component resources from GitOps data
    if (selectedProduct) {
      const productGitOps = gitOpsData.find(p => p.productName === selectedProduct.name)
      if (productGitOps && productGitOps.components) {
        const componentGitOps = productGitOps.components.find(c => c.name === component.name)
        if (componentGitOps) {
          addToConsole(`Found GitOps data for component: ${component.name}`, 'info')
          addToConsole(`Expected structure: resources/, charts/, charts/templates/`, 'info')
        }
      }
    }
  }

  /**
   * Get available components for the selected product from GitOps data
   */
  const getAvailableComponents = (): ProductComponent[] => {
    if (!selectedProduct) return []

    const productGitOps = gitOpsData.find(p => p.productName === selectedProduct.name)
    if (!productGitOps || !productGitOps.components) return []

    return productGitOps.components.map(comp => ({
      id: `${selectedProduct.name}-${comp.name}`,
      name: comp.name,
      displayName: comp.metadata?.displayName || comp.name,
      description: comp.metadata?.description || '',
      parentProduct: selectedProduct.name,
      metadata: comp.metadata,
      isActive: comp.metadata?.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ProductComponent))
  }

  /**
   * Handle content changes for specific file
   */
  const handleContentChange = (fileId: string, content: string) => {
    setFileContents(prev => ({ ...prev, [fileId]: content }))

    const file = openFiles.find(f => f.id === fileId)
    if (file) {
      // Update the file object with new content
      file.content = content
      addToConsole(`Modified: ${file.path}`)
    }
  }

  /**
   * Save K8s resource to GitOps repository
   */
  const saveResourceToGitOps = async (file: FileTreeNode, content: string) => {
    if (!selectedProduct || !selectedComponent) {
      addToConsole('No product or component selected', 'error')
      return
    }

    try {
      addToConsole(`Saving ${file.name} to GitOps repository...`, 'info')

      // Find the GitOps data for the current product
      const productGitOps = gitOpsData.find(p => p.productName === selectedProduct.name)
      if (!productGitOps || !productGitOps.success) {
        throw new Error('GitOps data not available for this product')
      }

      // Create the resource file in the component folder
      const resourcePath = `${selectedComponent.name}/${file.name}`

      // This would be a new IPC call to save individual files to GitOps
      // For now, we'll simulate the save operation
      addToConsole(`Resource saved: ${resourcePath}`, 'info')
      addToConsole(`Content length: ${content.length} characters`, 'info')

      // TODO: Implement actual GitOps file save operation
      // await window.electronAPI?.git?.saveResourceToGitOps?.({
      //   productName: selectedProduct.name,
      //   componentName: selectedComponent.name,
      //   resourcePath: file.name,
      //   content: content,
      //   commitMessage: `Update ${file.name} for ${selectedComponent.name}`
      // })

    } catch (error: any) {
      addToConsole(`Error saving resource: ${error.message}`, 'error')
    }
  }

  /**
   * Enhanced editor action handler with GitOps integration
   */
  const handleEditorAction = async (action: string, file: FileTreeNode) => {
    addToConsole(`Editor action: ${action} on ${file.path}`)

    switch (action) {
      case 'save':
        const content = fileContents[file.id] || ''
        await saveResourceToGitOps(file, content)
        break
      case 'deploy':
        addToConsole(`Deploying ${file.name} to cluster...`, 'info')
        // TODO: Implement deployment logic
        break
      case 'validate':
        addToConsole(`Validating ${file.name}...`, 'info')
        // TODO: Implement YAML validation
        break
      default:
        addToConsole(`Unknown action: ${action}`, 'warning')
    }
  }

  // Auto-load GitOps data on component mount
  useEffect(() => {
    fetchGitOpsData()
  }, [])

  /**
   * Render the product navigator panel
   */
  // const renderNavigatorPanel = () => {
  //   return (
  //     <ProductComponentNavigator
  //       selectedProduct={selectedProduct}
  //       selectedComponent={selectedComponent}
  //       onProductSelect={handleProductSelect}
  //       onComponentSelect={handleComponentSelect}
  //       onNavigateBack={onNavigateBack}
  //     />
  //   )
  // }

  /**
   * Filter products and components based on search query
   */
  const getFilteredGitOpsData = () => {
    if (!searchQuery.trim()) return gitOpsData

    return gitOpsData.filter(productData => {
      const productName = productData.metadata?.product?.displayName || productData.productName
      const productMatches = productName.toLowerCase().includes(searchQuery.toLowerCase())

      const componentMatches = productData.components?.some(comp =>
        (comp.metadata?.displayName || comp.name).toLowerCase().includes(searchQuery.toLowerCase())
      )

      return productMatches || componentMatches
    })
  }

  /**
   * Handle product CRUD operations
   */
  const handleProductAction = (action: string, productData: any) => {
    addToConsole(`Product ${action}: ${productData.productName}`, 'info')

    switch (action) {
      case 'edit':
        // TODO: Open product edit dialog
        break
      case 'delete':
        // TODO: Show delete confirmation
        break
      case 'add-component':
        // TODO: Open add component dialog
        break
      default:
        addToConsole(`Unknown product action: ${action}`, 'warning')
    }
  }

  /**
   * Handle component CRUD operations
   */
  const handleComponentAction = (action: string, productData: any, componentData: any) => {
    addToConsole(`Component ${action}: ${componentData.name}`, 'info')

    switch (action) {
      case 'edit':
        // TODO: Open component edit dialog
        break
      case 'delete':
        // TODO: Show delete confirmation
        break
      default:
        addToConsole(`Unknown component action: ${action}`, 'warning')
    }
  }

  /**
   * Convert GitOps data to Product format for the navigator
   */
  const getProductsFromGitOps = (): Product[] => {
    return gitOpsData
      .filter(productData => productData.success && productData.metadata)
      .map(productData => ({
        id: productData.productName,
        name: productData.productName,
        displayName: productData.metadata?.product?.displayName || productData.productName,
        description: productData.metadata?.product?.description || '',
        owner: productData.metadata?.product?.owner || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          version: productData.metadata?.product?.version || '1.0.0',
          category: productData.metadata?.product?.category || 'platform',
          tags: productData.metadata?.product?.tags || [],
          gitOps: productData.metadata
        }
      } as Product))
  }

  /**
   * Get components for a specific product from GitOps data
   */
  const getComponentsForProduct = (productName: string): ProductComponent[] => {
    const productData = gitOpsData.find(p => p.productName === productName)
    if (!productData || !productData.components) return []

    return productData.components.map(comp => ({
      id: `${productName}-${comp.name}`,
      name: comp.name,
      displayName: comp.metadata?.displayName || comp.name,
      description: comp.metadata?.description || '',
      parentProduct: productName,
      isActive: comp.metadata?.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...comp.metadata,
        type: comp.metadata?.category || 'service'
      }
    } as ProductComponent))
  }

  /**
   * Render the navigator panel using the existing ProductComponentNavigator
   */
  // const renderNavigatorPanel = () => {
  //   // Create a custom navigator that uses GitOps data
  //   const gitOpsProducts = getProductsFromGitOps()
    
  //   return (
  //     <div className="h-full flex flex-col bg-slate-900">
  //       {/* Enhanced Header */}
  //       <div className="p-4 bg-slate-800 border-b border-slate-700">
  //         <div className="flex items-center gap-2 mb-3">
  //           {onNavigateBack && (
  //             <Button variant="ghost" size="sm" onClick={onNavigateBack} className="h-7 w-7 p-0">
  //               <ArrowLeft className="h-3.5 w-3.5" />
  //             </Button>
  //           )}
  //           <h2 className="text-lg font-bold text-white">GitOps Designer</h2>
  //           <div className="flex-1" />
  //           <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
  //             <MoreVertical className="h-4 w-4 text-muted-foreground" />
  //           </Button>
  //         </div>
  //         <div className="relative">
  //           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
  //           <Input
  //             placeholder="Search products and components..."
  //             value={searchQuery}
  //             onChange={(e) => setSearchQuery(e.target.value)}
  //             className={cn("!pl-10 !pr-3 h-8", typography.utils.body)}
  //           />
  //         </div>
  //       </div>

  //       {/* Loading State */}
  //       {isLoadingGitOps && (
  //         <div className="flex items-center justify-center py-12">
  //           <div className="text-center">
  //             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
  //             <div className="text-sm text-gray-500">Syncing GitOps repositories...</div>
  //           </div>
  //         </div>
  //       )}

  //       {/* Enhanced Products Tree */}
  //       {!isLoadingGitOps && (
  //         <div className="flex-1 overflow-auto p-4 space-y-3">
  //           {getFilteredGitOpsData().length === 0 ? (
  //             <div className="text-center py-12 text-gray-500">
  //               <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
  //               <p className="font-medium mb-2">No GitOps repositories found</p>
  //               <p className="text-sm mb-4">Configure products with GitOps repositories to get started</p>
  //               <Button
  //                 variant="outline"
  //                 onClick={fetchGitOpsData}
  //                 className="gap-2"
  //               >
  //                 <GitBranch className="h-4 w-4" />
  //                 Load GitOps Data
  //               </Button>
  //             </div>
  //           ) : (
  //             getFilteredGitOpsData().map((productData, index) => (
  //               <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  //                 {/* Enhanced Product Header */}
  //                 <div
  //                   className={`p-4 cursor-pointer transition-all duration-200 ${
  //                     selectedProduct?.name === productData.productName
  //                       ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-500'
  //                       : 'hover:bg-gray-50 dark:hover:bg-gray-700'
  //                   }`}
  //                   onClick={() => {
  //                     if (productData.success && productData.metadata) {
  //                       const product: Product = {
  //                         id: productData.productName,
  //                         name: productData.productName,
  //                         displayName: productData.metadata?.product?.displayName || productData.productName,
  //                         description: productData.metadata?.product?.description || '',
  //                         metadata: productData.metadata,
  //                         createdAt: new Date().toISOString(),
  //                         updatedAt: new Date().toISOString()
  //                       } as Product
  //                       handleProductSelect(product)
  //                     }
  //                   }}
  //                 >
  //                   <div className="flex items-start justify-between">
  //                     <div className="flex items-center gap-3 flex-1">
  //                       <div className="flex items-center gap-2">
  //                         {selectedProduct?.name === productData.productName ? (
  //                           <ChevronDown className="h-4 w-4 text-blue-500" />
  //                         ) : (
  //                           <ChevronRight className="h-4 w-4 text-gray-400" />
  //                         )}
  //                         <Package className="h-5 w-5 text-blue-500" />
  //                       </div>
  //                       <div className="flex-1">
  //                         <div className="flex items-center gap-2">
  //                           <span className="font-semibold text-gray-800 dark:text-gray-200">
  //                             {productData.metadata?.product?.displayName || productData.productName}
  //                           </span>
  //                           <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
  //                             v{productData.metadata?.product?.version || '1.0.0'}
  //                           </span>
  //                         </div>
  //                         {productData.metadata?.product?.description && (
  //                           <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
  //                             {productData.metadata.product.description}
  //                           </p>
  //                         )}
  //                       </div>
  //                     </div>
  //                     <div className="flex items-center gap-2 ml-2">
  //                       {productData.success ? (
  //                         <div className="flex items-center gap-1 text-xs text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
  //                           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
  //                           Synced
  //                         </div>
  //                       ) : (
  //                         <div className="flex items-center gap-1 text-xs text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full">
  //                           <div className="w-2 h-2 bg-red-500 rounded-full"></div>
  //                           Error
  //                         </div>
  //                       )}
  //                       {productData.components && (
  //                         <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
  //                           {productData.components.length} components
  //                         </span>
  //                       )}
  //                     </div>
  //                   </div>
  //                 </div>

  //                   {/* Enhanced Component Nodes */}
  //                   {selectedProduct?.name === productData.productName && productData.components && (
  //                     <div className="ml-6 mt-1 space-y-1">
  //                       {productData.components.map((comp, compIndex) => (
  //                         <div
  //                           key={compIndex}
  //                           className={`group flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md cursor-pointer transition-colors ${selectedComponent?.name === comp.name
  //                               ? 'bg-gray-600 text-white'
  //                               : 'hover:bg-gray-800 text-gray-400'
  //                             }`}
  //                           onClick={() => {
  //                             const component: ProductComponent = {
  //                               id: `${productData.productName}-${comp.name}`,
  //                               name: comp.name,
  //                               displayName: comp.metadata?.displayName || comp.name,
  //                               description: comp.metadata?.description || '',
  //                               parentProduct: productData.productName,
  //                               metadata: comp.metadata,
  //                               isActive: comp.metadata?.isActive ?? true,
  //                               createdAt: new Date().toISOString(),
  //                               updatedAt: new Date().toISOString()
  //                             } as ProductComponent
  //                             handleComponentSelect(component)
  //                           }}
  //                         >
  //                           <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
  //                             <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
  //                           </div>
  //                           <Folder className="h-3 w-3 text-blue-500 flex-shrink-0" />
  //                           <div className="flex-1 min-w-0">
  //                             <span className="text-sm font-medium truncate">
  //                               {comp.metadata?.displayName || comp.name}
  //                             </span>
  //                           </div>
  //                           <div className="flex items-center gap-2 flex-shrink-0">
  //                             <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
  //                               {comp.metadata?.category || 'service'}
  //                             </span>
  //                             <Button
  //                               variant="ghost"
  //                               size="sm"
  //                               className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
  //                               onClick={(e) => {
  //                                 e.stopPropagation()
  //                                 handleComponentAction('menu', productData, comp)
  //                               }}
  //                               title="Component options"
  //                             >
  //                               <MoreVertical className="h-2.5 w-2.5" />
  //                             </Button>
  //                           </div>
  //                         </div>
  //                       ))}
  //                     </div>
  //                   )}
  //                 </div>
  //               ))
  //           )}
  //         </div>
  //       )}

  //       {/* Enhanced Back Button */}
  //       {onNavigateBack && (
  //         <div className="p-3 border-t bg-white dark:bg-gray-800">
  //           <Button
  //             variant="ghost"
  //             onClick={onNavigateBack}
  //             className="w-full justify-start text-sm text-gray-600 hover:text-gray-800"
  //           >
  //             ← Back to Product Management
  //           </Button>
  //         </div>
  //       )}
  //     </div>
  //   )
  // }

  /**
   * Render the navigator panel using the existing ProductComponentNavigator
   */
  const renderNavigatorPanel = () => {
    // Create a custom navigator that uses GitOps data
    const gitOpsProducts = getProductsFromGitOps()
    
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Enhanced Header */}
        <div className="p-4 bg-muted/10 border-b">
          <div className="flex items-center gap-2 mb-3">
            {onNavigateBack && (
              <Button variant="ghost" size="sm" onClick={onNavigateBack} className="h-7 w-7 p-0">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            <h2 className={cn("text-lg font-bold", typography.tile.title)}>GitOps Designer</h2>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
            <Input
              placeholder="Search products and components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("!pl-10 !pr-3 h-8", typography.utils.body)}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoadingGitOps && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <div className={cn("text-sm text-muted-foreground", typography.utils.caption)}>Syncing GitOps repositories...</div>
            </div>
          </div>
        )}

        {/* Enhanced Products Tree */}
        {!isLoadingGitOps && (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {getFilteredGitOpsData().length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4" />
                <p className={cn("font-medium mb-2", typography.tile.title)}>No GitOps repositories found</p>
                <p className={cn("text-sm mb-4", typography.utils.body)}>Configure products with GitOps repositories to get started</p>
                <Button
                  variant="outline"
                  onClick={fetchGitOpsData}
                  className="gap-2"
                >
                  <GitBranch className="h-4 w-4" />
                  Load GitOps Data
                </Button>
              </div>
            ) : (
              getFilteredGitOpsData().map((productData, index) => (
                <div key={index} className="bg-card rounded-lg border shadow-sm overflow-hidden">
                  {/* Enhanced Product Header */}
                  <div
                    className={cn(
                      "p-4 cursor-pointer transition-all duration-200",
                      selectedProduct?.name === productData.productName
                        ? "bg-primary/5 border-l-4 border-primary"
                        : "hover:bg-muted/30"
                    )}
                    onClick={() => {
                      if (productData.success && productData.metadata) {
                        const product: Product = {
                          id: productData.productName,
                          name: productData.productName,
                          displayName: productData.metadata?.product?.displayName || productData.productName,
                          description: productData.metadata?.product?.description || '',
                          metadata: productData.metadata,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        } as Product
                        handleProductSelect(product)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          {selectedProduct?.name === productData.productName ? (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-semibold", typography.tile.title)}>
                              {productData.metadata?.product?.displayName || productData.productName}
                            </span>
                            <span className={cn("text-xs bg-muted px-2 py-1 rounded-full", typography.tile.badge)}>
                              v{productData.metadata?.product?.version || '1.0.0'}
                            </span>
                          </div>
                          {productData.metadata?.product?.description && (
                            <p className={cn("text-sm text-muted-foreground mt-1", typography.tile.subtitle)}>
                              {productData.metadata.product.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {productData.success ? (
                          <div className={cn("text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full", typography.tile.badge)}>
                            <div className="w-2 h-2 bg-green-500 rounded-full inline-block mr-1 animate-pulse"></div>
                            Synced
                          </div>
                        ) : (
                          <div className={cn("text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-full", typography.tile.badge)}>
                            <div className="w-2 h-2 bg-red-500 rounded-full inline-block mr-1"></div>
                            Error
                          </div>
                        )}
                        {productData.components && (
                          <span className={cn("text-xs bg-muted px-2 py-1 rounded-full", typography.tile.badge)}>
                            {productData.components.length} components
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Component Nodes */}
                  {selectedProduct?.name === productData.productName && productData.components && (
                    <div className="ml-6 mt-1 space-y-1 pb-2">
                      {productData.components.map((comp, compIndex) => (
                        <div
                          key={compIndex}
                          className={cn(
                            "group flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md cursor-pointer transition-colors",
                            selectedComponent?.name === comp.name
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted/50 text-muted-foreground"
                          )}
                          onClick={() => {
                            const component: ProductComponent = {
                              id: `${productData.productName}-${comp.name}`,
                              name: comp.name,
                              displayName: comp.metadata?.displayName || comp.name,
                              description: comp.metadata?.description || '',
                              parentProduct: productData.productName,
                              metadata: comp.metadata,
                              isActive: comp.metadata?.isActive ?? true,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString()
                            } as ProductComponent
                            handleComponentSelect(component)
                          }}
                        >
                          <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          </div>
                          <Folder className="h-3 w-3 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className={cn("text-sm font-medium truncate", typography.utils.body)}>
                              {comp.metadata?.displayName || comp.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={cn("text-xs bg-muted px-1.5 py-0.5 rounded", typography.tile.badge)}>
                              {comp.metadata?.category || 'service'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleComponentAction('menu', productData, comp)
                              }}
                              title="Component options"
                            >
                              <MoreVertical className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Enhanced Back Button */}
        {onNavigateBack && (
          <div className="p-3 border-t bg-muted/10">
            <Button
              variant="ghost"
              onClick={onNavigateBack}
              className={cn("w-full justify-start text-sm", typography.utils.caption)}
            >
              ← Back to Product Management
            </Button>
          </div>
        )}
      </div>
    )
  }

  // // Add these new handlers
  // const handleComponentSelect = (component: any) => {
  //   setSelectedComponent(component)
  //   console.log('Component selected:', component)
  // }

  const handleEditComponent = (component: any) => {
    console.log('Edit component:', component)
    // Add your edit logic here
  }

  const handleDeleteComponent = (component: any) => {
    console.log('Delete component:', component)
    // Add your delete logic here
  }

  // /**
  //  * Render the file explorer panel with product-component integration
  //  */
  // const renderFileExplorer = () => {
  //   return (
  //     <SmartFileTree
  //       productId={selectedProduct?.id}
  //       componentId={selectedComponent?.id}
  //       onFileSelect={handleFileSelect}
  //       selectedFileId={selectedFile?.id}
  //       // New props for component integration
  //       selectedProductId={selectedProduct?.id}
  //       selectedProductName={selectedProduct?.name}
  //       selectedComponentId={selectedComponent?.id}
  //       onComponentSelect={handleComponentSelect}
  //       onEditComponent={handleEditComponent}
  //       onDeleteComponent={handleDeleteComponent}
  //     />
  //   )
  // }

  /**
   * Enhanced file explorer with selected product-component card
   */
  const renderFileExplorer = () => {
    // Convert ProductComponent to the format expected by ProductComponentTiles
    const convertToTileComponent = (component: ProductComponent) => {
      return {
        id: component.id,
        name: component.displayName || component.name,
        description: component.description || '',
        type: (component.metadata?.category as any) || 'microservice',
        status: 'healthy' as const,
        resourceCount: 5, // Mock value - could be calculated from actual resources
        lastModified: new Date(component.updatedAt).toLocaleDateString(),
        folderPath: component.componentFolderPath
      }
    }

    const tileComponents = selectedProduct && selectedComponent ? [convertToTileComponent(selectedComponent)] : []

    return (
      <div className="h-full flex flex-col">
        {/* Selected Product-Component Card */}
        {selectedProduct && selectedComponent && (
          <ProductComponentTiles
            productId={selectedProduct.id}
            productName={selectedProduct.displayName || selectedProduct.name}
            components={tileComponents}
            selectedComponentId={selectedComponent.id}
            onComponentSelect={(component: ProductComponent) => {

              // Handle component selection if needed
              addToConsole(`Component tile clicked: ${component.name}`)
            }}
            onEditComponent={handleEditComponent}
            onDeleteComponent={handleDeleteComponent}
          />
        )}

        {/* File Tree */}
        <div className="flex-1">
          <SmartFileTree
            productId={selectedProduct?.id}
            componentId={selectedComponent?.id}
            onFileSelect={handleFileSelect}
            selectedFileId={selectedFile?.id}
            selectedProductId={selectedProduct?.id}
            selectedProductName={selectedProduct?.name}
            selectedComponentId={selectedComponent?.id}
            onComponentSelect={handleComponentSelect}
            onEditComponent={handleEditComponent}
            onDeleteComponent={handleDeleteComponent}
            rootPath={selectedComponent?.componentFolderPath}
          />
        </div>
      </div>
    )
  }

  /**
   * Enhanced multi-file editor with tabs
   */
  const renderEditor = () => {
    return (
      <div className="h-full flex flex-col">
        {error && (
          <div className={cn(
            "p-3 bg-red-50 border-b border-red-200",
            typography.status.error
          )}>
            Error: {error}
          </div>
        )}
        {isLoading && (
          <div className={cn(
            "p-3 bg-blue-50 border-b border-blue-200",
            typography.status.info
          )}>
            Loading file content...
          </div>
        )}

        {openFiles.length > 0 ? (
          <div className="flex-1 flex flex-col">
            {/* Multi-File Tab Bar */}
            <Tabs value={activeFileId || ''} onValueChange={setActiveFileId} className="flex-none">
              <TabsList className="w-full justify-start rounded-none border-b bg-muted/30">
                {openFiles.map((file) => (
                  <TabsTrigger
                    key={file.id}
                    value={file.id}
                    className={cn(
                      "flex items-center gap-2 max-w-[200px] px-3 py-2",
                      typography.navigation.tab
                    )}
                  >
                    <span className="truncate text-sm">{file.name}</span>
                    <X
                      className="h-3 w-3 hover:bg-muted rounded opacity-60 hover:opacity-100"
                      aria-label={`Close ${file.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        closeFile(file.id)
                      }}
                    />
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Editor Content for Each Tab */}
              {openFiles.map((file) => (
                <TabsContent key={file.id} value={file.id} className="flex-1 mt-0">
                  <ContextAwareEditor
                    selectedFile={file}
                    content={fileContents[file.id] || ''}
                    onContentChange={(content) => handleContentChange(file.id, content)}
                    onAction={handleEditorAction}
                    className="h-full"
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        ) : (
          <div className={cn(
            "flex items-center justify-center h-full",
            typography.body.lg,
            "text-muted-foreground"
          )}>
            Select a file to start editing
          </div>
        )}
      </div>
    )
  }

  /**
   * Render the console output panel with proper typography
   */
  /**
   * Render the console output panel with clear button in header
   */
  const renderConsoleOutput = () => {
    return (
      <div className="h-full flex flex-col">
        {/* Console content - now takes full height */}
        <div className={cn(
          "flex-1 overflow-auto p-4 bg-gray-900 text-green-400"
        )}>
          {consoleOutput.length === 0 ? (
            <div className={cn(typography.body.xs, "text-gray-500")}>
              Console output will appear here...
            </div>
          ) : (
            consoleOutput.map((line, index) => (
              <div
                key={index}
                className={cn(
                  "mb-1",
                  "font-mono text-xs leading-relaxed tracking-normal"
                )}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  const renderConsoleOutput2 = () => {
    return (
      <div className="h-full flex flex-col relative">
        {/* Floating Clear Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConsoleOutput([])}
          className="absolute top-2 right-2 z-10 h-6 w-6 p-0 bg-gray-800/80 hover:bg-gray-700 border border-gray-600"
          title="Clear console"
        >
          <X className="h-3 w-3 text-gray-400" />
        </Button>

        {/* Console content */}
        <div className={cn(
          "flex-1 overflow-auto p-4 bg-gray-900 text-green-400"
        )}>
          {consoleOutput.length === 0 ? (
            <div className={cn(typography.body.xs, "text-gray-500")}>
              Console output will appear here...
            </div>
          ) : (
            consoleOutput.map((line, index) => (
              <div
                key={index}
                className={cn(
                  "mb-1",
                  "font-mono text-xs leading-relaxed tracking-normal"
                )}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <ProductWorkspace4Panel
        navigator={renderNavigatorPanel()}
        fileExplorer={renderFileExplorer()}
        editor={renderEditor()}
        consoleOutput={renderConsoleOutput2()}
        persistenceKey="product-deployment-designer-poc"
      />
    </div>
  )
}