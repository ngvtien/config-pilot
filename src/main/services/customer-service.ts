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

    // Check for duplicate names (case-insensitive)
    if (customers.some(c => c.name.toLowerCase() === customer.name.toLowerCase())) {
      throw new Error(`Customer with name '${customer.name}' already exists (case-insensitive check)`)
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
      console.error(`❌ Customer with ID '${id}' not found`)
      console.error(`📋 Available customers:`, customers.map(c => ({ id: c.id, name: c.name })))
      throw new Error(`Customer with ID '${id}' not found`)
    }

    // Check for duplicate names (excluding current customer, case-insensitive)
    if (updates.name && customers.some(c => c.id !== id && c.name.toLowerCase() === updates.name!.toLowerCase())) {
      throw new Error(`Customer with name '${updates.name}' already exists (case-insensitive check)`)
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
    let finalCustomer = newCustomer;

    // Create GitOps repository if requested
    if (gitServerConfig.createGitOpsRepo) {
      try {
        gitOpsRepo = await this.createCustomerGitOpsRepository(newCustomer, gitServerConfig);
        // Use the updated customer from GitOps setup
        if (gitOpsRepo.updatedCustomer) {
          finalCustomer = gitOpsRepo.updatedCustomer;
        }
      } catch (error: any) {
        console.warn(`Failed to create GitOps repository for customer ${newCustomer.name}:`, error.message);
        // Don't fail customer creation if GitOps repo creation fails
      }
    }
    return { customer: finalCustomer, gitOpsRepo };
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

  /**
   * Sanitize and validate Git server configuration with comprehensive logging
   * @param gitServerConfig - Raw git server configuration
   * @returns Sanitized configuration
   */
  private static sanitizeGitServerConfig(gitServerConfig: { serverId: string; gitBaseUrl: string }) {
    console.log(`🔍 [DEBUG] Raw gitServerConfig input:`, JSON.stringify(gitServerConfig, null, 2));

    let { serverId, gitBaseUrl } = gitServerConfig;

    // Sanitize gitBaseUrl - handle common issues
    const originalBaseUrl = gitBaseUrl;

    // Remove trailing slashes
    gitBaseUrl = gitBaseUrl.replace(/\/+$/, '');

    // Handle placeholder URLs
    if (gitBaseUrl.includes('git.example.com') || gitBaseUrl.includes('example.com')) {
      console.warn(`⚠️ [SANITIZE] Detected placeholder URL: ${gitBaseUrl}`);
      // Try to use a fallback or throw an error
      if (process.env.NODE_ENV !== 'production') {
        gitBaseUrl = 'http://localhost:9080'; // Development fallback
        console.log(`🔧 [SANITIZE] Using development fallback: ${gitBaseUrl}`);
      } else {
        throw new Error(`Invalid Git server URL: ${originalBaseUrl}. Please configure a valid Git server in Settings.`);
      }
    }

    // Ensure URL has protocol
    if (!gitBaseUrl.startsWith('http://') && !gitBaseUrl.startsWith('https://')) {
      gitBaseUrl = `http://${gitBaseUrl}`;
      console.log(`🔧 [SANITIZE] Added http protocol: ${gitBaseUrl}`);
    }

    // Validate URL format
    try {
      new URL(gitBaseUrl);
    } catch (error) {
      console.error(`❌ [SANITIZE] Invalid URL format: ${gitBaseUrl}`);
      throw new Error(`Invalid Git server URL format: ${gitBaseUrl}`);
    }

    // Sanitize serverId
    if (!serverId || serverId.trim() === '') {
      serverId = gitBaseUrl;
      console.log(`🔧 [SANITIZE] Generated serverId from baseUrl: ${serverId}`);
    }

    const sanitized = { serverId, gitBaseUrl };

    if (originalBaseUrl !== gitBaseUrl) {
      console.log(`🔄 [SANITIZE] URL changed from '${originalBaseUrl}' to '${gitBaseUrl}'`);
    }

    console.log(`✅ [DEBUG] Sanitized gitServerConfig:`, JSON.stringify(sanitized, null, 2));
    return sanitized;
  }

  static async createCustomerGitOpsRepository(
    customer: Customer,
    gitServerConfig: {
      serverId: string;
      gitBaseUrl: string;
    },
    hostingOrg: string = 'da'
  ): Promise<any> {
    console.log(`🚀 [DEBUG] === Starting GitOps Repository Creation ===`);
    console.log(`🔍 [DEBUG] Customer:`, JSON.stringify({
      id: customer.id,
      name: customer.name,
      displayName: customer.displayName
    }, null, 2));
    console.log(`🔍 [DEBUG] Hosting Organization: ${hostingOrg}`);

    // Sanitize configuration with fuzzy logic
    const sanitizedConfig = this.sanitizeGitServerConfig(gitServerConfig);

    const { gitService } = await import('./git-service');

    // Use generateGitOpsRepositoryUrl to construct the repository URL
    const gitOpsRepoUrl = this.generateGitOpsRepositoryUrl(
      customer,
      sanitizedConfig.gitBaseUrl,
      hostingOrg
    );

    console.log(`🔍 [DEBUG] Repository URL construction:`);
    console.log(`  - gitOpsRepoUrl: ${gitOpsRepoUrl}`);

    try {
      // Check if repository already exists before attempting creation
      console.log(`🔍 [DEBUG] Checking if repository already exists...`);
      try {
        const validationResult = await gitService.validateRepositoryAccess(gitOpsRepoUrl, sanitizedConfig.serverId);
        if (validationResult.isValid && validationResult.repositoryInfo) {
          console.log(`ℹ️ [DEBUG] Repository already exists at ${gitOpsRepoUrl}, skipping creation`);

          // Update customer metadata with existing repository URL
          const updatedCustomer = await this.updateCustomer(customer.id, {
            metadata: {
              ...customer.metadata,
              gitOps: {
                repositoryUrl: gitOpsRepoUrl,
                serverId: sanitizedConfig.serverId,
                environments: ['dev', 'sit', 'uat', 'prod'],
                setupDate: new Date().toISOString()
              }
            }
          });

          return {
            repository: validationResult.repositoryInfo,
            branches: [],
            updatedCustomer,
            errors: [],
            skipped: true,
            message: 'Repository already exists, skipped creation'
          };
        }
      } catch (validationError: any) {
        console.log(`🔍 [DEBUG] Repository validation failed:`, validationError.message);
        // Continue with creation if validation fails (repository likely doesn't exist)
      }

      // Create GitOps repository configuration
      const repoConfig = {
        name: `gitops-customers-${customer.name}`,
        description: `GitOps repository for customer ${customer.displayName || customer.name}`,
        isPrivate: true,
        autoInit: true,
        gitignore: 'Kubernetes',
        license: 'MIT',
        provider: 'gitea' as const,
        url: gitOpsRepoUrl,
        defaultBranch: 'dev',
      };

      console.log(`📦 [DEBUG] Creating repository with config:`, JSON.stringify(repoConfig, null, 2));

      const repository = await gitService.createRepository(repoConfig, sanitizedConfig.serverId);

      await gitService.setDefaultBranch(repository.url, 'dev');

      console.log(`✅ [DEBUG] Repository created:`, JSON.stringify({
        url: repository.url,
        name: repository.name,
        id: repository.id
      }, null, 2));

      // Create 4 environment branches: dev, sit, uat, prod
      const environments = ['dev', 'sit', 'uat', 'prod'];
      console.log(`🌿 [DEBUG] Creating environment branches:`, environments);

      const branchResult = await gitService.createCustomerEnvironmentBranches(
        gitOpsRepoUrl,
        environments,
        customer.name,
        sanitizedConfig.serverId
      );

      console.log(`✅ [DEBUG] Branch creation result:`, JSON.stringify(branchResult, null, 2));

      console.log(`✅ [DEBUG] Created GitOps repository for customer ${customer.name}:`, {
        repository: repository.url,
        branches: branchResult.createdBranches
      });

      // Update customer metadata with the actual repository URL
      const finalRepositoryUrl = gitOpsRepoUrl;
      console.log(`💾 [DEBUG] Updating customer metadata with repositoryUrl: ${finalRepositoryUrl}`);

      const updatedCustomer = await this.updateCustomer(customer.id, {
        metadata: {
          ...customer.metadata,
          gitOps: {
            repositoryUrl: finalRepositoryUrl,
            serverId: sanitizedConfig.serverId,
            environments: ['dev', 'sit', 'uat', 'prod'],
            setupDate: new Date().toISOString()
          }
        }
      });

      console.log(`✅ [DEBUG] Customer metadata updated successfully`);
      console.log(`🎉 [DEBUG] === GitOps Repository Creation Completed ===`);

      return {
        repository,
        branches: branchResult.createdBranches,
        updatedCustomer,
        errors: branchResult.errors
      };

    } catch (error: any) {
      console.error(`❌ [DEBUG] GitOps repository creation failed:`, {
        error: error.message,
        stack: error.stack,
        customer: customer.name,
        gitServerConfig: sanitizedConfig,
        hostingOrg
      });
      throw error;
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
    },
    hostingOrg: string
  ): Promise<any> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID '${customerId}' not found`);
    }

    return await this.createCustomerGitOpsRepository(customer, gitServerConfig, hostingOrg);
  }

  /**
   * Decode HTML entities in a string
   */
  private static decodeHtmlEntities(text: string): string {
    if (!text) return text;

    const htmlEntities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '='
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return htmlEntities[entity] || entity;
    });
  }

  /**
   * Generate customer metadata.json content
   */
  static generateCustomerMetadata(customer: Customer) {
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        displayName: this.decodeHtmlEntities(customer.displayName || customer.name),
        description: this.decodeHtmlEntities(customer.description || ''),
        isActive: customer.isActive,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        metadata: customer.metadata
      },
      generated: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        generator: 'ConfigPilot Customer Management'
      }
    }
  }

  /**
   * Push customer metadata to GitOps repository
   */
  static async pushCustomerMetadataToRepo(customer: Customer): Promise<void> {
    // Implementation similar to product metadata push
  }

  /**
   * Sync GitOps customers to localStorage for update operations
   */
  static async syncGitOpsCustomersToLocalStorage(gitOpsCustomers: Customer[]): Promise<void> {
    try {
      // Get existing localStorage customers
      const { customers: localCustomers } = await this.getAllCustomers()
      
      // console.log(`🔄 Syncing GitOps customers to localStorage:`)
      // console.log(`📁 Local customers (${localCustomers.length}):`, localCustomers.map(c => ({ id: c.id, name: c.name })))
      // console.log(`🌐 GitOps customers (${gitOpsCustomers.length}):`, gitOpsCustomers.map(c => ({ id: c.id, name: c.name })))
      
      // Create a map of existing customers by name for efficient lookup
      const localCustomerMap = new Map(localCustomers.map(c => [c.name.toLowerCase(), c]))
      
      // Update or add GitOps customers to localStorage
      const updatedCustomers = [...localCustomers]
      
      for (const gitOpsCustomer of gitOpsCustomers) {
        const existingCustomer = localCustomerMap.get(gitOpsCustomer.name.toLowerCase())
        
        if (existingCustomer) {
          // Update existing customer with GitOps data but keep the original ID
          const updatedCustomer = {
            ...gitOpsCustomer,
            id: existingCustomer.id // Keep the original localStorage ID
          }
          const index = updatedCustomers.findIndex(c => c.id === existingCustomer.id)
          if (index !== -1) {
            updatedCustomers[index] = updatedCustomer
            console.log(`🔄 Updated existing customer: ${existingCustomer.name} (ID: ${existingCustomer.id})`)
          }
        } else {
          // Add new customer from GitOps
          updatedCustomers.push(gitOpsCustomer)
          console.log(`➕ Added new customer from GitOps: ${gitOpsCustomer.name} (ID: ${gitOpsCustomer.id})`)
        }
      }
      
      // Save updated customers to localStorage
      await this.saveCustomers(updatedCustomers)
      // console.log(`✅ Synchronized ${gitOpsCustomers.length} GitOps customers to localStorage`)
      // console.log(`📊 Final customer count: ${updatedCustomers.length}`)
      
    } catch (error: any) {
      //console.error('❌ Failed to sync GitOps customers to localStorage:', error)
      throw new Error(`Failed to sync GitOps customers: ${error.message}`)
    }
  }

  /**
   * Generate GitOps repository URL following naming convention
   */
  static generateGitOpsRepositoryUrl(customer: Customer, gitBaseUrl: string, hostingOrg?: string): string {
    if (hostingOrg) {
      return `${gitBaseUrl}/${hostingOrg}/gitops-customers-${customer.name}.git`
    }
    return `${gitBaseUrl}/${customer.name}/gitops.git`
  }

  /**
   * Fetch all customer metadata from GitOps repositories
   * Discovers repositories following the naming convention: {gitbaseUrl}/{hostingOrg}/gitops-customers-*.git
   */
  static async fetchAllCustomerMetadataFromGitOps(gitBaseUrl: string, hostingOrg: string, serverId?: string): Promise<{
    success: boolean;
    metadata: any[];
    errors: any[];
  }> {
    const { GitService } = await import('./git-service');
    const gitService = new GitService();

    const metadata: any[] = [];
    const errors: any[] = [];

    try {
      // Get all repositories from the hosting organization
      const repositories = await gitService.listRepositoriesInOrganization(gitBaseUrl, hostingOrg, serverId);

      // Debug: Log all repository names and structure to see what's available
      console.log(`📋 All repositories in organization '${hostingOrg}':`, repositories.map(r => r.name));
      console.log(`🔍 Sample repository structure:`, repositories[0] ? JSON.stringify(repositories[0], null, 2) : 'No repositories found');

      // Filter repositories that match the GitOps customer naming convention
      // Note: Gitea API returns repository names without .git suffix, but we expect the full URL to have .git
      const customerRepos = repositories.filter(repo =>
        repo.name.startsWith('gitops-customers-')
      );

      console.log(`🔍 Found ${customerRepos.length} customer GitOps repositories matching pattern 'gitops-customers-*'`);

      // Fetch metadata.json from each repository
      for (const repo of customerRepos) {
        try {
          // Construct proper repository URL with .git suffix
          const repoUrl = `${gitBaseUrl}/${hostingOrg}/${repo.name}.git`;
          const customerName = repo.name.replace('gitops-customers-', '');

          console.log(`📥 Fetching metadata.json for customer '${customerName}' from ${repoUrl}`);

          // Try to fetch metadata.json from different branches
          let metadataContent = null;
          const branchesToTry = ['dev', 'main', 'master'];
          
          for (const branch of branchesToTry) {
            try {
              console.log(`📥 Trying to fetch metadata.json from branch '${branch}' for customer '${customerName}'`);
              metadataContent = await gitService.fetchFileFromRepository(
                repoUrl,
                'metadata.json',
                branch,
                serverId
              );
              
              if (metadataContent.success && metadataContent.content) {
                console.log(`✅ Successfully found metadata.json in branch '${branch}' for customer '${customerName}'`);
                break;
              }
            } catch (branchError) {
              console.log(`⚠️ Branch '${branch}' not found for customer '${customerName}', trying next branch`);
              continue;
            }
          }

          if (metadataContent && metadataContent.success && metadataContent.content) {
            console.log(`✅ Successfully fetched metadata.json for customer '${customerName}'`);
            const parsedMetadata = JSON.parse(metadataContent.content);
            metadata.push({
              repositoryUrl: repoUrl,
              customerName: customerName,
              metadata: parsedMetadata,
              fetchedAt: new Date().toISOString()
            });
          } else {
            console.log(`❌ No metadata.json found for customer '${customerName}' in ${repoUrl}`);
            errors.push({
              repositoryUrl: repoUrl,
              customerName: customerName,
              error: metadataContent?.error || 'Failed to fetch metadata.json from any branch'
            });
          }
        } catch (error: any) {
          const customerName = repo.name.replace('gitops-customers-', '');
          const repoUrl = `${gitBaseUrl}/${hostingOrg}/${repo.name}.git`;
          errors.push({
            repositoryUrl: repoUrl,
            customerName: customerName,
            error: error.message
          });
          console.error(`❌ Error fetching metadata for ${customerName}:`, error);
        }
      }

      return {
        success: metadata.length > 0,
        metadata,
        errors
      };

    } catch (error: any) {
      console.error('❌ Failed to fetch customer metadata from GitOps repositories:', error);
      return {
        success: false,
        metadata: [],
        errors: [{ error: error.message }]
      };
    }
  }

  /**
   * Sync local customer data with GitOps metadata
   * Compares local customers with GitOps metadata and identifies discrepancies
   */
  static async syncWithGitOpsMetadata(gitBaseUrl: string, hostingOrg: string, serverId?: string): Promise<{
    success: boolean;
    synced: any[];
    conflicts: any[];
    missing: any[];
  }> {
    try {
      // Fetch all GitOps metadata
      const gitOpsResult = await this.fetchAllCustomerMetadataFromGitOps(gitBaseUrl, hostingOrg, serverId);

      if (!gitOpsResult.success) {
        throw new Error('Failed to fetch GitOps metadata');
      }

      // Get local customers
      const localCustomersResponse = await this.getAllCustomers();
      const localCustomers = localCustomersResponse.customers;

      const synced: any[] = [];
      const conflicts: any[] = [];
      const missing: any[] = [];

      // Check each GitOps metadata against local customers
      for (const gitOpsData of gitOpsResult.metadata) {
        const gitOpsCustomer = gitOpsData.metadata.customer;
        const localCustomer = localCustomers.find(c => c.name === gitOpsData.customerName);

        if (!localCustomer) {
          // Customer exists in GitOps but not locally
          missing.push({
            type: 'missing_locally',
            customerName: gitOpsData.customerName,
            gitOpsMetadata: gitOpsCustomer,
            repositoryUrl: gitOpsData.repositoryUrl
          });
        } else {
          // Compare local vs GitOps data
          const hasConflicts =
            localCustomer.displayName !== gitOpsCustomer.displayName ||
            localCustomer.description !== gitOpsCustomer.description ||
            localCustomer.isActive !== gitOpsCustomer.isActive;

          if (hasConflicts) {
            conflicts.push({
              customerName: gitOpsData.customerName,
              local: localCustomer,
              gitOps: gitOpsCustomer,
              repositoryUrl: gitOpsData.repositoryUrl
            });
          } else {
            synced.push({
              customerName: gitOpsData.customerName,
              status: 'in_sync',
              repositoryUrl: gitOpsData.repositoryUrl
            });
          }
        }
      }

      // Check for customers that exist locally but not in GitOps
      for (const localCustomer of localCustomers) {
        const hasGitOps = gitOpsResult.metadata.some(g => g.customerName === localCustomer.name);
        if (!hasGitOps) {
          missing.push({
            type: 'missing_in_gitops',
            customerName: localCustomer.name,
            localCustomer: localCustomer
          });
        }
      }

      return {
        success: true,
        synced,
        conflicts,
        missing
      };

    } catch (error: any) {
      console.error('❌ Failed to sync with GitOps metadata:', error);
      return {
        success: false,
        synced: [],
        conflicts: [],
        missing: []
      };
    }
  }
}