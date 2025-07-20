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
  }
}

export interface CustomerListResponse {
  customers: Customer[]
  total: number
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