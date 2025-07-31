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

  /**
   * Create new customer with GitOps repository setup
   */
  static async createCustomerWithGitOps(
    customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>,
    gitServerConfig: {
      serverId: string;
      gitBaseUrl: string;
      createGitOpsRepo?: boolean;
    }
  ): Promise<{ customer: Customer; gitOpsRepo?: any }> {
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

    let gitOpsRepo = null;

    // Create GitOps repository if requested
    if (gitServerConfig.createGitOpsRepo) {
      try {
        gitOpsRepo = await this.createCustomerGitOpsRepository(newCustomer, gitServerConfig);
      } catch (error: any) {
        console.warn(`Failed to create GitOps repository for customer ${newCustomer.name}:`, error.message);
        // Don't fail customer creation if GitOps repo creation fails
      }
    }

    return { customer: newCustomer, gitOpsRepo };
  }

  /**
   * Create GitOps repository for a customer
   */
  // static async createCustomerGitOpsRepository(
  //   customer: Customer,
  //   gitServerConfig: {
  //     serverId: string;
  //     gitBaseUrl: string;
  //   }
  // ): Promise<any> {
  //   const { gitService } = await import('./git-service');

  //   // Construct GitOps repository URL: {gitBaseUrl}/{customerId}/gitops.git
  //   const gitOpsRepoName = `${customer.name}-gitops`;
  //   const gitOpsRepoUrl = `${gitServerConfig.gitBaseUrl}/${customer.name}/gitops.git`;

  //   try {
  //     // Create the repository using git service
  //     const repoConfig = {
  //       name: gitOpsRepoName,
  //       description: `GitOps repository for customer: ${customer.displayName || customer.name}`,
  //       isPrivate: true,
  //       autoInit: true,
  //       provider: 'gitea' as const, // Assuming Gitea based on existing code
  //       baseUrl: gitServerConfig.gitBaseUrl,
  //       url: gitOpsRepoUrl
  //     };

  //     const repository = await gitService.createRepository(repoConfig, gitServerConfig.serverId);

  //     // Create 4 environment branches: dev, sit, uat, prod
  //     const environments = ['dev', 'sit', 'uat', 'prod'];
  //     const branchResult = await gitService.createEnvironmentBranches(
  //       repository.url,
  //       environments,
  //       gitServerConfig.serverId
  //     );

  //     console.log(`✅ Created GitOps repository for customer ${customer.name}:`, {
  //       repository: repository.url,
  //       branches: branchResult.createdBranches
  //     });

  //     return {
  //       repository,
  //       branches: branchResult.createdBranches,
  //       errors: branchResult.errors
  //     };

  //   } catch (error: any) {
  //     console.error(`❌ Failed to create GitOps repository for customer ${customer.name}:`, error);
  //     throw new Error(`Failed to create GitOps repository: ${error.message}`);
  //   }
  // }

  static async createCustomerGitOpsRepository(
    customer: Customer,
    gitServerConfig: {
      serverId: string;
      gitBaseUrl: string;
    }
  ): Promise<any> {
    const { gitService } = await import('./git-service');

    // Construct GitOps repository URL: {gitBaseUrl}/{customerId}/gitops.git
    const gitOpsRepoName = `${customer.name}-gitops`;
    const gitOpsRepoUrl = `${gitServerConfig.gitBaseUrl}/${customer.name}/gitops.git`;

    try {
      // First, create the organization for the customer
      const orgConfig = {
        name: customer.name,
        displayName: customer.displayName || customer.name,
        description: `Organization for customer: ${customer.displayName || customer.name}`,
        visibility: 'private' as const
      };

      try {
        await gitService.createOrganisation(gitServerConfig.gitBaseUrl, orgConfig);
        console.log(`✅ Created organization '${customer.name}' for customer`);
      } catch (orgError: any) {
        // If organization already exists, that's fine, continue
        if (orgError.message?.includes('already exists') || orgError.message?.includes('409')) {
          console.log(`ℹ️ Organization '${customer.name}' already exists, continuing...`);
        } else {
          console.warn(`⚠️ Failed to create organization '${customer.name}':`, orgError.message);
          // Continue anyway - maybe the organization exists but we can't detect it
        }
      }

      // Create the repository using git service
      const repoConfig = {
        name: gitOpsRepoName,
        description: `GitOps repository for customer: ${customer.displayName || customer.name}`,
        isPrivate: true,
        autoInit: true,
        provider: 'gitea' as const, // Assuming Gitea based on existing code
        baseUrl: gitServerConfig.gitBaseUrl,
        url: gitOpsRepoUrl
      };

      const repository = await gitService.createRepository(repoConfig, gitServerConfig.serverId);

      // Create 4 environment branches: dev, sit, uat, prod
      const environments = ['dev', 'sit', 'uat', 'prod'];
      const branchResult = await gitService.createCustomerEnvironmentBranches(
        gitOpsRepoUrl, // Use the correct clone URL
        environments,
        customer.name,
        gitServerConfig.serverId
      );

      console.log(`✅ Created GitOps repository for customer ${customer.name}:`, {
        repository: repository.url,
        branches: branchResult.createdBranches
      });

      return {
        repository,
        branches: branchResult.createdBranches,
        errors: branchResult.errors
      };

    } catch (error: any) {
      console.error(`❌ Failed to create GitOps repository for customer ${customer.name}:`, error);
      throw new Error(`Failed to create GitOps repository: ${error.message}`);
    }
  }

  /**
   * Setup GitOps repository for existing customer
   */
  static async setupCustomerGitOps(
    customerId: string,
    gitServerConfig: {
      serverId: string;
      gitBaseUrl: string;
    }
  ): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID '${customerId}' not found`);
    }

    return await this.createCustomerGitOpsRepository(customer, gitServerConfig);
  }

}