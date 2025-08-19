/**
 * Product data structure for parent products that unify multiple components
 * Each product maps 1:1 with a Git repository
 */
export interface Product {
  id: string
  name: string // Product name (e.g., "cai") - used as repository name
  displayName?: string // Human-readable display name
  description?: string
  owner?: string // Primary owner/maintainer
  isActive: boolean
  createdAt: string // ISO 8601 timestamp
  updatedAt: string // ISO 8601 timestamp
  repoFolderPath?: string // Absolute path to product repository
  metadata?: {
    version?: string // Product version
    category?: string // Product category (platform, integration, frontend, data)
    tags?: string[] // Searchable tags
    repository?: string // Git repository URL
    documentation?: string // Documentation URL
    
    // RBAC and access control
    rbac?: {
      owners?: string[] // Users with full access
      maintainers?: string[] // Users with write access
      viewers?: string[] // Users with read access
    }
  }
}

export interface ProductListResponse {
  products: Product[]
  total: number
}

export interface ProductValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Create a new product with default values
 */
export function createNewProduct(name: string, displayName?: string, owner?: string): Product {
  return {
    id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    displayName: displayName || name,
    description: '',
    owner: owner || '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

/**
 * Validate product data
 */
export function validateProduct(product: Partial<Product>): ProductValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!product.name || product.name.trim().length === 0) {
    errors.push('Product name is required')
  }

  if (product.name && !/^[a-z0-9-]+$/.test(product.name)) {
    errors.push('Product name must contain only lowercase letters, numbers, and hyphens')
  }

  if (product.name && product.name.length > 50) {
    errors.push('Product name must be 50 characters or less')
  }

  if (!product.owner || product.owner.trim().length === 0) {
    warnings.push('Product owner is recommended')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}