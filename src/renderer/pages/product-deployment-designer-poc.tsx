"use client"
import React, { useState, useEffect } from 'react'
import { ProductWorkspace4Panel } from '@/renderer/components/products/product-workspace-4panel'
import { NavigatorPanel } from '@/renderer/components/products/product-navigator-panel'
import { SmartFileTree, FileTreeNode } from '@/renderer/components/ide/smart-file-tree'
import { ContextAwareEditor } from '@/renderer/components/ide/context-aware-editor'
import { Product } from '@/shared/types/product'
import { ProductComponent } from '@/shared/types/product-component'
import { ProductComponentNavigator } from '@/renderer/components/products/product-component-navigator'
import { ProductComponentTiles } from '@/renderer/components/products/product-component-tiles'
import { typography } from '@/renderer/lib/typography'
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { X } from 'lucide-react'
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
   * Enhanced component selection with validation
   */
  const handleComponentSelect = (component: ProductComponent) => {
    if (!component || !component.id) {
      addToConsole('Invalid component selected', 'error')
      return
    }

    setSelectedComponent(component)
    setSelectedFile(null)
    setFileContents({})
    setError(null)
    addToConsole(`Selected component: ${component.displayName || component.name}`)
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
   * Enhanced editor action handler
   */
  const handleEditorAction = (action: string, file: FileTreeNode) => {
    addToConsole(`Editor action: ${action} on ${file.path}`)
    // Handle editor actions like save, deploy, etc.
  }

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

  const renderNavigatorPanel = () => {
    return (
      <ProductComponentNavigator
        selectedProduct={selectedProduct}
        selectedComponent={selectedComponent}
        onProductSelect={handleProductSelect}
        onComponentSelect={handleComponentSelect}
        onNavigateBack={onNavigateBack}
        // Add the hover action handlers
        onEditProduct={(product) => {
          console.log('Edit product:', product)
          // Add your edit logic here
        }}
        onDeleteProduct={(product) => {
          console.log('Delete product:', product)
          // Add your delete logic here
        }}
        onAddComponent={(product) => {
          console.log('Add component to:', product)
          // Add your add component logic here
        }}
        onAddProduct={() => {
          console.log('Add new product')
          // Add your add product logic here
        }}
      />
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
        lastModified: new Date(component.updatedAt).toLocaleDateString()
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
        className="absolute top-2 right-2 z-10 h-6 w-6 p-0 bg-gray-800/80 hover:bg-gray-700 border border-gray-600 zoom-exclude"
        title="Clear console"
      >
        <X className="h-3 w-3 text-gray-400 zoom-exclude" />
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