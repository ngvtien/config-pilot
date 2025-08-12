"use client"
import { useState, useEffect } from "react"
import { WorkspaceLayout } from "@/renderer/components/products/product-workspace-resizable"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/renderer/components/ui/collapsible"
import { Search, Plus, Edit, Package, Component, FileText, ChevronRight, ChevronDown, Trash2 } from "lucide-react"
import { Product } from "@/shared/types/product"
import { ProductComponent as ProductComponentType } from "@/shared/types/product-component"
import { typography } from "@/renderer/lib/typography"
import { cn } from "@/lib/utils"
import CodeMirror from '@uiw/react-codemirror'
import { yaml as yamlLanguage } from '@codemirror/lang-yaml'
//import { json as jsonLanguage } from "@codemirror/lang-json"
import { EditorView } from "@codemirror/view"
import { useEditorTheme } from '@/renderer/hooks/useEditorTheme'

// Import the mock data service
import { mockDataService, useMockData } from "@/renderer/services/mock-data.service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { jsonLanguage } from "@codemirror/lang-json"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/renderer/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/renderer/components/ui/tooltip"

interface EnhancedProductWorkspacePageProps {
  onNavigateBack?: () => void
}

/**
 * Enhanced Product Workspace with refined 3-panel layout:
 * Panel 1: Product + Component Navigator (expandable)
 * Panel 2: Component Management Hub (heavy lifting)
 * Panel 3: Resource Management (pure resource focus)
 */
export function EnhancedProductWorkspacePage({ onNavigateBack }: EnhancedProductWorkspacePageProps) {
  // Use mock data hook
  const mockData = useMockData()

  const { codeMirrorTheme, yamlExtensions } = useEditorTheme()

  // State management
  const [products, setProducts] = useState<Product[]>([])
  const [components, setComponents] = useState<Record<string, ProductComponentType[]>>({})
  const [componentResources, setComponentResources] = useState<Record<string, any[]>>({})
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<ProductComponentType | null>(null)
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Component editing state
  const [editingComponent, setEditingComponent] = useState<ProductComponentType | null>(null)
  const [componentFormData, setComponentFormData] = useState<Partial<ProductComponentType>>({})

  // Resource editing state
  const [resourceYaml, setResourceYaml] = useState('')
  const [resourceKind, setResourceKind] = useState('')

  /**
   * Load initial data using mock service
   */
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true)
      try {
        // Load products from mock service
        const mockProducts = mockData.products
        setProducts(mockProducts)

        // Load components for each product
        const allComponents: Record<string, ProductComponentType[]> = {}
        mockProducts.forEach(product => {
          const productComponents = mockData.getComponents(product.id)
          allComponents[product.id] = productComponents
        })
        setComponents(allComponents)

        // Auto-expand first product and select first component for demo
        if (mockProducts.length > 0) {
          const firstProduct = mockProducts[0]
          setExpandedProducts(new Set([firstProduct.id]))
          setSelectedProduct(firstProduct)

          const firstProductComponents = allComponents[firstProduct.id]
          if (firstProductComponents && firstProductComponents.length > 0) {
            const firstComponent = firstProductComponents[0]
            setSelectedComponent(firstComponent)
            await loadComponentResources(firstComponent.id)
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  /**
   * Toggle product expansion to show/hide components (accordion style - only one open at a time)
   */
  const toggleProductExpansion = (productId: string) => {
    const newExpanded = new Set<string>()

    // If clicking on already expanded product, collapse it
    if (expandedProducts.has(productId)) {
      // Leave newExpanded empty to collapse all
    } else {
      // Expand only the clicked product (auto-collapse others)
      newExpanded.add(productId)

      // Auto-select the product when expanded
      const product = products.find(p => p.id === productId)
      if (product) {
        setSelectedProduct(product)

        // Auto-select first component if available
        const productComponents = components[productId]
        if (productComponents && productComponents.length > 0) {
          handleComponentSelect(productComponents[0])
        }
      }
    }

    setExpandedProducts(newExpanded)
  }

  /**
   * Handle component selection for Panel 2
   */
  const handleComponentSelect = async (component: ProductComponentType) => {
    setSelectedComponent(component)
    setEditingComponent(null)
    setSelectedResource(null) // Clear resource selection initially
    
    // Load component resources for Panel 2 overview
    await loadComponentResources(component.id)
    
    // Auto-select first resource if available
    try {
      const resources = await mockData.getResources(component.id)
      if (resources && resources.length > 0) {
        const firstResource = resources[0]
        setSelectedResource(firstResource)
        // Load YAML content for the first resource
        const yamlContent = mockData.getYaml(firstResource.id)
        setResourceYaml(yamlContent)
        setResourceKind(firstResource.kind || '')
      }
    } catch (error) {
      console.error('Failed to auto-select first resource:', error)
    }
  }

  /**
   * Handle resource selection for Panel 3
   */
  const handleResourceSelect = (resource: any) => {
    setSelectedResource(resource)
    // Load YAML content from mock service
    const yamlContent = mockData.getYaml(resource.id)
    setResourceYaml(yamlContent)
    setResourceKind(resource.kind || '')
  }

  /**
   * Get icon for resource kind
   */
  const getResourceIcon = (kind: string) => {
    const icons: Record<string, string> = {
      'Deployment': '🎯',
      'Service': '🔧',
      'ConfigMap': '📋',
      'Secret': '🔐',
      'Ingress': '🌐',
      'StatefulSet': '📊',
      'HorizontalPodAutoscaler': '📈',
      'PersistentVolumeClaim': '💾',
      'CronJob': '⏰',
      'PodDisruptionBudget': '🛡️'
    }
    return icons[kind] || '📄'
  }

  /**
   * Get status badge variant
   */
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'active':
      case 'ready':
      case 'bound':
        return 'default'
      case 'pending':
      case 'creating':
        return 'secondary'
      case 'failed':
      case 'error':
      case 'stopped':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  /**
   * Start inline component editing
   */
  const startComponentEdit = (component: ProductComponentType) => {
    setEditingComponent(component)
    setComponentFormData(component)
  }

  /**
   * Save component changes
   */
  const saveComponentChanges = async () => {
    if (!editingComponent || !componentFormData) return

    try {
      // Save logic here
      console.log('Saving component:', componentFormData)
      setEditingComponent(null)
      setSelectedComponent({ ...editingComponent, ...componentFormData } as ProductComponentType)
    } catch (error) {
      console.error('Failed to save component:', error)
    }
  }

  /**
   * Load resources for a specific component
   */
  const loadComponentResources = async (componentId: string) => {
    try {
      const resources = await mockData.getResources(componentId)
      console.log('Loaded resources for component:', componentId, resources)
      setComponentResources(prev => ({
        ...prev,
        [componentId]: resources
      }))
    } catch (error) {
      console.error('Failed to load component resources:', error)
      setComponentResources(prev => ({
        ...prev,
        [componentId]: []
      }))
    }
  }

  /**
   * Filter products and components based on search query
   */
  const filteredProducts = products.filter(product => {
    const productMatches = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())

    // Also check if any components match the search
    const componentMatches = components[product.id]?.some(component =>
      component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.type?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return productMatches || componentMatches
  })

  /**
   * Filter components within a product based on search query
   */
  const getFilteredComponents = (productId: string) => {
    if (!searchQuery) return components[productId] || []

    return (components[productId] || []).filter(component =>
      component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.type?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  /**
   * Get resource counts for selected component
   */
  const getResourceCounts = (componentId: string) => {
    const resources = componentResources[componentId] || []
    const counts = {
      Deployment: 0,
      Service: 0,
      ConfigMap: 0,
      Secret: 0,
      Ingress: 0,
      Other: 0
    }

    resources.forEach(resource => {
      if (counts.hasOwnProperty(resource.kind)) {
        counts[resource.kind as keyof typeof counts]++
      } else {
        counts.Other++
      }
    })

    return counts
  }

/**
 * Render Panel 1: Product + Component Navigator (Enhanced)
 */
const renderProductNavigator = () => (
  <div className="h-full flex flex-col">
    {/* Simplified Header */}
    <div className="p-3 border-b bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={() => console.log('Create new product')}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create a new product</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {filteredProducts.map((product) => {
          const filteredComponents = getFilteredComponents(product.id)
          const isExpanded = expandedProducts.has(product.id)
          const isSelected = selectedProduct?.id === product.id

          return (
            <Collapsible
              key={product.id}
              open={isExpanded}
              onOpenChange={() => toggleProductExpansion(product.id)}
            >
              <CollapsibleTrigger asChild>
                <Card className={cn(
                  "group cursor-pointer transition-colors hover:bg-muted/50",
                  isSelected && "ring-1 ring-primary"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )} />
                          <h4 className={cn(
                            typography.tile.title, // Using tile.title for consistency
                            "truncate",
                            isSelected ? "text-primary" : ""
                          )}>
                            {product.name}
                          </h4>
                        </div>
                        
                        {/* Description on separate line */}
                        <p className={cn(typography.tile.subtitle, "mt-1 line-clamp-2")}>
                          {product.description}
                        </p>
                        
                        {/* Badge and Add Component button on same line */}
                        <div className="flex items-center justify-between mt-2">
                          <Badge 
                            variant={isExpanded ? "default" : "secondary"} 
                            className={typography.tile.badge}
                          >
                            <Component className="h-3 w-3 mr-1" />
                            {filteredComponents.length} components
                            {searchQuery && filteredComponents.length !== (components[product.id]?.length || 0) && (
                              <span className="ml-1 opacity-70">/{components[product.id]?.length || 0}</span>
                            )}
                          </Badge>
                          
                          {/* Add Component Button with Tooltip */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('Add component to', product.name)
                                    // TODO: Implement add component functionality
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Add a new component to {product.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      
                      <div className="ml-2 flex items-center gap-1">
                        {/* Product Action Buttons with Tooltips */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mr-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-primary/10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('Edit product:', product.name)
                                    // TODO: Implement edit product functionality
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit {product.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('Delete product:', product.name)
                                    // TODO: Implement delete product functionality
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete {product.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        {/* Chevron Icon */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleTrigger>

              <CollapsibleContent className="ml-4 mt-1 space-y-0.5">
                {filteredComponents.map((component) => (
                  <div
                    key={component.id}
                    className={cn(
                      "group cursor-pointer rounded border-l transition-all duration-150",
                      selectedComponent?.id === component.id 
                        ? "bg-primary/10 border-l-primary hover:bg-primary/15" 
                        : "border-l-transparent hover:bg-accent/40 hover:border-l-muted-foreground/30"
                    )}
                    onClick={() => handleComponentSelect(component)}
                  >
                    <div className="p-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <Component className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className={cn(
                          typography.tile.title, // Using tile.title for consistency
                          "flex-1 truncate",
                          selectedComponent?.id === component.id ? "text-primary font-medium" : "text-foreground"
                        )}>
                          {component.name}
                        </span>
                        <Badge variant="outline" className={cn(typography.tile.badge, "text-xs px-1.5 py-0 h-5")}>
                          {component.type}
                        </Badge>
                      </div>
                      {component.description && (
                        <div className={cn(typography.tile.subtitle, "mt-1 ml-5 truncate")}>
                          {component.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {filteredComponents.length === 0 && (
                  <div className="p-3 text-center">
                    <p className={cn(typography.tile.subtitle, "text-xs")}>
                      {searchQuery ? "No matching components" : "No components"}
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </ScrollArea>
  </div>
)


  /**
   * Render Panel 2: Component Management Hub
   */
  const renderComponentManagement = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 dark:shadow-none">
        {selectedComponent && selectedProduct && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Package className="h-3 w-3" />
            <span>{selectedProduct.name}</span>
            <ChevronRight className="h-3 w-3" />
            <Component className="h-3 w-3" />
            <span className="text-foreground font-medium">{selectedComponent.name}</span>
          </div>
        )}
        {selectedComponent && (
          <p className={cn(typography.panel.subtitle, "mt-1")}>Managing: {selectedComponent.name}</p>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {selectedComponent ? (
          <div className="space-y-6">
            {/* Component Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={typography.card.title}>Component Details</CardTitle>
                {!editingComponent && (
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startComponentEdit(selectedComponent)}
                      className="h-8 w-8 p-0"
                      title="Edit component"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Delete component"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {editingComponent ? (
                  // Inline editing form
                  <div className="space-y-4">
                    <div>
                      <label className={typography.form.label}>Name</label>
                      <Input
                        value={componentFormData.name || ''}
                        onChange={(e) => setComponentFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={typography.form.label}>Type</label>
                      <Input
                        value={componentFormData.type || ''}
                        onChange={(e) => setComponentFormData(prev => ({ ...prev, type: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={typography.form.label}>Description</label>
                      <Input
                        value={componentFormData.description || ''}
                        onChange={(e) => setComponentFormData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={saveComponentChanges}>Save</Button>
                      <Button variant="outline" onClick={() => setEditingComponent(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="space-y-2">
                    <div>
                      <span className={typography.form.label}>Name:</span>
                      <span className="ml-2">{selectedComponent.name}</span>
                    </div>
                    <div>
                      <span className={typography.form.label}>Type:</span>
                      <Badge className="ml-2">{selectedComponent.type}</Badge>
                    </div>
                    <div>
                      <span className={typography.form.label}>Description:</span>
                      <span className="ml-2">{selectedComponent.description}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

{/* Resource Overview */}
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className={typography.card.title}>Component Resources</CardTitle>
    <Button
      size="sm"
      variant="outline"
      onClick={() => console.log('Add resource')}
      className="h-8"
      title="Add new resource"
    >
      <Plus className="h-4 w-4 mr-1" />
      Add
    </Button>
  </CardHeader>
  <CardContent className="p-0">
    {(() => {
      const resources = selectedComponent ? (componentResources[selectedComponent.id] || []) : []
      return resources.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupResourcesByKind(resources)).map(([kind, kindResources]) => 
                kindResources.map((resource) => (
                  <TableRow
                    key={resource.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedResource?.id === resource.id
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => handleResourceSelect(resource)}
                  >
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        {getResourceIcon(kind)}
                        <span className={cn(
                          typography.form.label,
                          "text-xs"
                        )}>
                          {kind}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        {selectedResource?.id === resource.id && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                        <span className={cn(
                          typography.card.subtitle,
                          selectedResource?.id === resource.id && "font-medium text-primary"
                        )}>
                          {resource.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant={getStatusVariant(resource.status)}>
                        {resource.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('Edit resource:', resource.id)
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={cn(typography.card.subtitle, "text-center py-8 text-muted-foreground")}>
          No resources found for this component
        </p>
      )
    })()}
  </CardContent>
</Card>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className={typography.card.subtitle}>Select a component to manage</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )

  /**
   * Render Panel 4: Helm Chart Configuration
   */
  const renderHelmConfiguration = () => (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 p-4">
        {selectedComponent ? (
          <div className="space-y-6">
            {/* Helm Chart Configuration */}
                {(() => {
                  const helmChart = mockDataService.getComponentHelmChart(selectedComponent.id)
                  if (!helmChart) {
                    return (
                      <div className="text-center py-4">
                        <p className={typography.card.subtitle}>No Helm chart data available</p>
                      </div>
                    )
                  }
                  
                  return (
                    <Tabs defaultValue="values-yaml" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="values-yaml">values.yaml</TabsTrigger>
                        <TabsTrigger value="values-schema">values.schema.json</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="values-yaml" className="mt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className={typography.card.subtitle}>Helm Values Configuration</h4>
                          </div>
                          <div className="border rounded-md">
                            <CodeMirror
                              value={helmChart.valuesYaml}
                              height="100%"
                              extensions={[
                                yamlLanguage(),
                                ...yamlExtensions,
                              ]} 
                              theme={codeMirrorTheme}
                              editable={true}
                              basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                dropCursor: false,
                                allowMultipleSelections: false
                              }}
                            />
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="values-schema" className="mt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className={typography.card.subtitle}>Values Schema Definition</h4>
                          </div>
                          <div className="border rounded-md">
                            <CodeMirror
                              value={JSON.stringify(JSON.parse(helmChart.valuesSchema), null, 2)}
                              height="100%"
                              extensions={[
                                jsonLanguage,
                                ...readOnlyExtensions                                                                    
                              ]}
                              theme={codeMirrorTheme}
                              editable={true}
                              basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                dropCursor: false,
                                allowMultipleSelections: false
                              }}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  )
                })()}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className={typography.card.subtitle}>Select a component to configure Helm chart</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )

  /**
   * Render Panel 3: Resource Management
   */
const renderResourceManagement = () => (
  <div className="h-full flex flex-col">
    <div className="p-4 bg-muted/30 flex-shrink-0">
      {selectedResource ? (
        <div className="space-y-2">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selectedProduct?.displayName || selectedProduct?.name}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{selectedComponent?.name}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Resources</span>
          </div>

          {/* Selected resource info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getResourceIcon(selectedResource.kind)}
              <h3 className={cn(typography.panel.subtitle, "text-primary")}>
                {selectedResource.kind}: {selectedResource.name}
              </h3>
            </div>
            <Badge
              variant={getStatusVariant(selectedResource.status)}
              className="ml-auto"
            >
              {selectedResource.status}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <p className={typography.panel.subtitle}>No resource selected</p>
        </div>
      )}
    </div>

    <div className="flex-1 p-4 overflow-hidden">
      {selectedResource ? (
        <div className="h-full flex flex-col">
          {/* Resource Editor */}
          <Card className="h-full flex flex-col">
            {/* <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"></CardHeader> */}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={typography.card.title}>k8s Resource Editor</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex-1 border rounded overflow-hidden mb-4">
                <CodeMirror
                  value={resourceYaml}
                  onChange={(value) => setResourceYaml(value)}
                  height="100%"
                  theme={codeMirrorTheme}
                  extensions={[
                    yamlLanguage(),
                    ...yamlExtensions,
                  ]}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    highlightSelectionMatches: false,
                  }}
                  className="text-sm h-full"
                  placeholder="Enter YAML content..."
                />
              </div>
              <div className="flex space-x-2 flex-shrink-0">
                <Button>💾 Save</Button>
                <Button variant="outline">🔄 Validate</Button>
                <Button variant="outline">📋 Copy</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className={typography.card.subtitle}>Select a resource to edit</p>
        </div>
      )}
    </div>
  </div>
)
  return (
    <div className="h-full w-full">
      <WorkspaceLayout
        navigator={renderProductNavigator()}
        editor={renderComponentManagement()}
        context={renderResourceManagement()}
        helm={renderHelmConfiguration()}
        output={null}
      />
    </div>
  )
}

/**
 * Group resources by their kind for organized display
 */
const groupResourcesByKind = (resources: any[]) => {
  return resources.reduce((acc, resource) => {
    const kind = resource.kind || 'Unknown'
    if (!acc[kind]) {
      acc[kind] = []
    }
    acc[kind].push(resource)
    return acc
  }, {} as Record<string, any[]>)
}

// CodeMirror extensions for read-only display
const readOnlyExtensions = [
    EditorView.theme({
        "&": {
            fontSize: "14px",
        },
        ".cm-content": {
            padding: "16px",
        },
        ".cm-focused": {
            outline: "none",
        },
        ".cm-editor": {
            borderRadius: "0",
        },
    }),
    EditorView.editable.of(true),
]
