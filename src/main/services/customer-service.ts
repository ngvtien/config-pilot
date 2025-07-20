import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Customer, CustomerListResponse } from '../../shared/types/customer'

/**
 * Customer service for managing customer data with file-based storage
 */
export class CustomerService {
  private static readonly CUSTOMERS_FILE = join(app.getPath('userData'), 'customers.json')
  private static customersCache: Customer[] | null = null

  /**
   * Initialize customer service and ensure data file exists
   */
  static async initialize(): Promise<void> {
    try {
      await fs.access(this.CUSTOMERS_FILE)
    } catch {
      // File doesn't exist, create with default customers
      const defaultCustomers: Customer[] = [
        {
          id: 'customer-default',
          name: 'default',
          displayName: 'Default Customer',
          description: 'Default customer for development',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      await this.saveCustomers(defaultCustomers)
    }
  }

  /**
   * Get all customers
   */
  static async getAllCustomers(): Promise<CustomerListResponse> {
    try {
      if (!this.customersCache) {
        const content = await fs.readFile(this.CUSTOMERS_FILE, 'utf-8')
        this.customersCache = JSON.parse(content) as Customer[]
      }
      
      const activeCustomers = this.customersCache.filter(c => c.isActive)
      return {
        customers: activeCustomers.sort((a, b) => a.displayName?.localeCompare(b.displayName || '') || 0),
        total: activeCustomers.length
      }
    } catch (error: any) {
      console.error('Failed to load customers:', error)
      throw new Error(`Failed to load customers: ${error.message}`)
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomerById(id: string): Promise<Customer | null> {
    const { customers } = await this.getAllCustomers()
    return customers.find(c => c.id === id) || null
  }

  /**
   * Create new customer
   */
  static async createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const { customers } = await this.getAllCustomers()
    
    // Check for duplicate names
    if (customers.some(c => c.name === customer.name)) {
      throw new Error(`Customer with name '${customer.name}' already exists`)
    }

    const newCustomer: Customer = {
      ...customer,
      id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    customers.push(newCustomer)
    await this.saveCustomers(customers)
    
    return newCustomer
  }

  /**
   * Update existing customer
   */
  static async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { customers } = await this.getAllCustomers()
    const index = customers.findIndex(c => c.id === id)
    
    if (index === -1) {
      throw new Error(`Customer with ID '${id}' not found`)
    }

    // Check for duplicate names (excluding current customer)
    if (updates.name && customers.some(c => c.id !== id && c.name === updates.name)) {
      throw new Error(`Customer with name '${updates.name}' already exists`)
    }

    const updatedCustomer: Customer = {
      ...customers[index],
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date().toISOString()
    }

    customers[index] = updatedCustomer
    await this.saveCustomers(customers)
    
    return updatedCustomer
  }

  /**
   * Delete customer (soft delete by setting isActive to false)
   */
  static async deleteCustomer(id: string): Promise<void> {
    await this.updateCustomer(id, { isActive: false })
  }

  /**
   * Export customers data
   */
  static async exportCustomers(filePath: string): Promise<void> {
    const { customers } = await this.getAllCustomers()
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      customers
    }
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
  }

  /**
   * Import customers data
   */
  static async importCustomers(filePath: string, mergeMode: 'replace' | 'merge' = 'merge'): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8')
    const importData = JSON.parse(content)
    
    if (!importData.customers || !Array.isArray(importData.customers)) {
      throw new Error('Invalid import file format')
    }

    const existingCustomers = mergeMode === 'replace' ? [] : (await this.getAllCustomers()).customers
    const importedCustomers = importData.customers as Customer[]
    
    // Merge or replace customers
    const finalCustomers = mergeMode === 'replace' 
      ? importedCustomers
      : this.mergeCustomers(existingCustomers, importedCustomers)
    
    await this.saveCustomers(finalCustomers)
  }

  /**
   * Save customers to file and clear cache
   */
  private static async saveCustomers(customers: Customer[]): Promise<void> {
    await fs.writeFile(this.CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf-8')
    this.customersCache = customers // Update cache
  }

  /**
   * Merge imported customers with existing ones
   */
  private static mergeCustomers(existing: Customer[], imported: Customer[]): Customer[] {
    const merged = [...existing]
    
    for (const importedCustomer of imported) {
      const existingIndex = merged.findIndex(c => c.name === importedCustomer.name)
      if (existingIndex >= 0) {
        // Update existing customer
        merged[existingIndex] = {
          ...importedCustomer,
          id: merged[existingIndex].id, // Keep existing ID
          updatedAt: new Date().toISOString()
        }
      } else {
        // Add new customer
        merged.push({
          ...importedCustomer,
          id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          updatedAt: new Date().toISOString()
        })
      }
    }
    
    return merged
  }
}