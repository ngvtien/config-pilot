/**
 * ProductComponent data structure for individual deployable components
 * Each component resides as a folder within its parent product's Git repository
 */
export interface ProductComponent {
  id: string
  name: string // Component name (e.g., "cai-frontend")
  displayName?: string // Human-readable display name
  description?: string
  owner?: string // Component owner/maintainer
  isActive: boolean
  createdAt: string // ISO 8601 timestamp
  updatedAt: string // ISO 8601 timestamp
  
  // Parent product reference
  parentProduct: string // Product name (e.g., "cai")
  
  // Component folder path within the product repo
  componentFolderPath?: string // Absolute path to component folder
  
  metadata?: {
    version?: string // Component version
    category?: string // Component category
    tags?: string[] // Searchable tags
    
    // Component type and runtime information
    type?: 'microservice' | 'database' | 'cache' | 'queue' | 'gateway' | 'frontend' | 'job' | 'service'
    runtime?: string // Runtime/technology (nodejs, java, python, etc.)
    
    // UI-specific properties for component tiles
    status?: 'healthy' | 'warning' | 'error' // Component health status
    resourceCount?: number // Number of Kubernetes resources
    lastModified?: string // Last modification timestamp or relative time
    
    // GitOps-specific metadata
    gitOps?: {
      repositoryUrl?: string // Component-specific repository (if different from product)
      repositoryName?: string // Derived from component name if not specified
      defaultBranch?: string // Default Git branch
      environmentBranches?: Record<string, string> // env -> branch mapping
      helmChartPath?: string // Path to Helm chart within component folder
    }
  }
}

export interface ProductComponentListResponse {
  components: ProductComponent[]
  total: number
}

export interface ProductComponentValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Create a new product component with default values
 */
export function createNewProductComponent(
  name: string, 
  parentProduct: string, 
  displayName?: string, 
  owner?: string
): ProductComponent {
  return {
    id: `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    displayName: displayName || name,
    description: '',
    owner: owner || '',
    parentProduct: parentProduct.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      type: 'service',
      status: 'healthy',
      resourceCount: 0
    }
  }
}

/**
 * Validate product component data
 */
export function validateProductComponent(component: Partial<ProductComponent>): ProductComponentValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!component.name || component.name.trim().length === 0) {
    errors.push('Component name is required')
  }

  if (component.name && !/^[a-z0-9-]+$/.test(component.name)) {
    errors.push('Component name must contain only lowercase letters, numbers, and hyphens')
  }

  if (component.name && component.name.length > 50) {
    errors.push('Component name must be 50 characters or less')
  }

  if (!component.parentProduct || component.parentProduct.trim().length === 0) {
    errors.push('Parent product is required')
  }

  if (component.parentProduct && !/^[a-z0-9-]+$/.test(component.parentProduct)) {
    errors.push('Parent product must contain only lowercase letters, numbers, and hyphens')
  }

  if (!component.owner || component.owner.trim().length === 0) {
    warnings.push('Component owner is recommended')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get component repository name (usually same as component name)
 */
export function getComponentRepositoryName(component: ProductComponent): string {
  return component.metadata?.gitOps?.repositoryName || component.name
}

/**
 * Generate Kubernetes namespace for component deployment
 */
export function generateKubernetesNamespace(
  component: ProductComponent, 
  customer: string, 
  environment: string, 
  instance: string
): string {
  return `${component.parentProduct}-${environment}-${customer}-${instance}`.toLowerCase()
}

/**
 * Generate GitOps folder path for component in specific environment
 */
export function generateGitOpsFolderPath(
  component: ProductComponent, 
  environment: string
): string {
  return `gitops/environments/${environment}/components/${component.name}`
}

/**
 * Generate ApplicationSet name for ArgoCD
 */
export function generateApplicationSetName(
  component: ProductComponent, 
  environment: string
): string {
  return `${component.parentProduct}-${component.name}-${environment}`
}