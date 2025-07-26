/**
 * ProductComponent data structure for individual deployable components
 */
export interface ProductComponent {
  id: string
  name: string // Component name (e.g., "cai-frontend")
  displayName?: string
  description?: string
  owner?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  
  // Parent product reference
  parentProduct: string // Product name (e.g., "cai")
  
  metadata?: {
    version?: string
    category?: string
    tags?: string[]
    
    // GitOps-specific metadata
    gitOps?: {
      repositoryUrl?: string // Component-specific repository
      repositoryName?: string // Derived from component name if not specified
      defaultBranch?: string
      environmentBranches?: Record<string, string> // env -> branch mapping
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
    updatedAt: new Date().toISOString()
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
 * Generate repository name for a component
 * Defaults to parentProduct but can be overridden via gitOps.repositoryName
 */
export function getComponentRepositoryName(component: ProductComponent): string {
  return component.metadata?.gitOps?.repositoryName || component.parentProduct
}

/**
 * Generate Kubernetes namespace for a component
 * Format: {product}-{customer}-{env}-{instance}
 */
export function generateKubernetesNamespace(
  component: ProductComponent, 
  customer: string, 
  environment: string, 
  instance: string
): string {
  return `${component.parentProduct}-${customer}-${environment}-${instance}`
}

/**
 * Generate GitOps folder path for a component
 * Format: {parentProduct}/{componentName}/{environment}/
 */
export function generateGitOpsFolderPath(
  component: ProductComponent, 
  environment: string
): string {
  return `${component.parentProduct}/${component.name}/${environment}/`
}

/**
 * Generate ApplicationSet name for a component
 * Format: {parentProduct}-{componentName}-{environment}
 */
export function generateApplicationSetName(
  component: ProductComponent, 
  environment: string
): string {
  return `${component.parentProduct}-${component.name}-${environment}`
}