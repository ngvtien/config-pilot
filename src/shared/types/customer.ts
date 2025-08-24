/**
 * Customer data structure for multi-customer management
 */
export interface Customer {
  id: string
  name: string
  displayName?: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  metadata?: {
    contactEmail?: string
    region?: string
    tier?: 'basic' | 'premium' | 'enterprise'
    tags?: string[]
    gitOps?: {
      repositoryUrl?: string
      serverId?: string
      environments?: string[]
      setupDate?: string
    }
  }
}

/**
 * GitOps setup configuration for customer
 */
export interface CustomerGitOpsConfig {
  serverId: string
  gitBaseUrl: string
  createGitOpsRepo: boolean
  environments?: string[] // defaults to ['dev', 'sit', 'uat', 'prod']
}

/**
 * Result of GitOps repository creation
 */
export interface CustomerGitOpsResult {
  success: boolean
  repository?: {
    url: string
    name: string
  }
  branches?: string[]
  errors?: string[]
  message?: string
}

export interface CustomerListResponse {
  customers: Customer[]
  total: number
}

/**
 * Result of fetching customer metadata from GitOps repositories
 */
export interface CustomerGitOpsMetadataResult {
  success: boolean
  metadata: CustomerGitOpsMetadata[]
  errors: CustomerGitOpsError[]
}

/**
 * Customer metadata fetched from GitOps repository
 */
export interface CustomerGitOpsMetadata {
  repositoryUrl: string
  customerName: string
  metadata: any
  fetchedAt: string
}

/**
 * Error when fetching customer metadata from GitOps
 */
export interface CustomerGitOpsError {
  repositoryUrl?: string
  customerName?: string
  error: string
}

/**
 * Result of syncing local customers with GitOps metadata
 */
export interface CustomerGitOpsSyncResult {
  success: boolean
  synced: CustomerSyncItem[]
  conflicts: CustomerConflictItem[]
  missing: CustomerMissingItem[]
}

/**
 * Customer that is in sync between local and GitOps
 */
export interface CustomerSyncItem {
  customerName: string
  status: 'in_sync'
  repositoryUrl: string
}

/**
 * Customer with conflicts between local and GitOps data
 */
export interface CustomerConflictItem {
  customerName: string
  local: Customer
  gitOps: any
  repositoryUrl: string
}

/**
 * Customer missing either locally or in GitOps
 */
export interface CustomerMissingItem {
  type: 'missing_locally' | 'missing_in_gitops'
  customerName: string
  gitOpsMetadata?: any
  localCustomer?: Customer
  repositoryUrl?: string
}

export interface CustomerValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Helper function to create a new customer
 */
export function createNewCustomer(name: string, displayName?: string): Customer {
  return {
    id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    displayName: displayName || name,
    description: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

/**
 * Validate customer data
 */
export function validateCustomer(customer: Partial<Customer>): CustomerValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!customer.name || customer.name.trim().length === 0) {
    errors.push('Customer name is required')
  }

  if (customer.name && !/^[a-z0-9-]+$/.test(customer.name)) {
    errors.push('Customer name must contain only lowercase letters, numbers, and hyphens')
  }

  if (customer.name && customer.name.length > 50) {
    errors.push('Customer name must be 50 characters or less')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}