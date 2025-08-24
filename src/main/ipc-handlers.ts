import { ipcMain, dialog, app, type OpenDialogOptions } from "electron"
import fs from "fs/promises"
import * as path from 'path';
import { exec } from "child_process"
import util from "util"
import yaml from "js-yaml"
import { VaultService } from './vault-service'
import { VaultCredentialManager } from './vault-credential-manager'
import { ArgoCDService } from './argocd-service'
import { ArgoCDCredentialManager } from './argocd-credential-manager'
import { HelmOCIService } from './helm-oci-service'
import { HelmOCICredentialManager } from './helm-oci-credential-manager'
import { ProjectManager } from './project-manager'
import { PROJECT_CHANNELS } from '../shared/ipc/project-channels'
import type { ProjectConfig, ProjectMetadata } from '../shared/types/project'
import { FileService } from "./file-service"
import { PlatformDetectionService } from './services/platform-detection-service'
import { crdManagementService } from './services/crd-management-service'
import { CRDImportRequest, CRDSchema } from "@/shared/types/kubernetes"
import { schemaService } from './services/schema-service';
import { templateManager } from "./template-manager";
import { templateService } from "./services/template-service";
import { CustomerService } from './services/customer-service'
import { ProductService } from './services/product-service'
import { gitService } from './services/git-service';
import { GitCredentials, GitRepository, GitValidationResult } from '../shared/types/git-repository';
import { GitAdapterFactory } from './services/adapters/git-adapter-factory';
import { ProductComponentService } from './services/product-component-service'
import { Environment } from "@/shared/types/context-data";
import Logger, { updateLoggerConfig } from './logger';
import { LoggingSettings } from '../shared/types/settings-data';
import log from 'electron-log';
import Store from 'electron-store';
import { Customer } from "@/shared/types/customer";
import { gitOpsBatchService, BatchRepository } from './services/gitops-batch-service';

const execPromise = util.promisify(exec)

// Unified Git Service - Single instance for all Git operations
//const unifiedGitService = new UnifiedGitService();

// Legacy services - Keep for backward compatibility during migration
// const gitAuthService = new GitAuthService();
// const gitRepositoryStore = new GitRepositoryStore();

let platformDetectionService: PlatformDetectionService | null = null

/**
 * Register logging configuration IPC handlers
 */
export function registerLoggerHandlers() {
  // Update logger configuration
  ipcMain.handle('logger:updateConfig', async (_, settings: LoggingSettings) => {
    try {
      updateLoggerConfig(settings);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Set log level for specific transport
  ipcMain.handle('logger:setLogLevel', async (event, { transport, level }) => {
    try {
      if (transport === 'file') {
        log.transports.file.level = level as Logger.LevelOption;
      } else if (transport === 'console') {
        log.transports.console.level = level as Logger.LevelOption;
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Toggle file logging
  ipcMain.handle('logger:toggleFileLogging', async (_, enabled: boolean) => {
    try {
      log.transports.file.level = enabled ? 'info' : false;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Update file configuration
  ipcMain.handle('logger:updateFileConfig', async (_, config: { maxSize?: number; location?: string }) => {
    try {
      if (config.maxSize) {
        log.transports.file.maxSize = config.maxSize * 1024 * 1024; // Convert MB to bytes
      }
      if (config.location && config.location.trim()) {
        log.transports.file.resolvePathFn = () => path.join(config.location!, 'main.log');
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

/**
 * Register unified Git handlers that consolidate server and repository management
 */
export function registerUnifiedGitHandlers() {
  // Git handlers are now implemented in registerGitHandlers()
}

export function registerProductHandlers() {
  // Initialize product service
  ipcMain.handle('product:initialize', async () => {
    try {
      await ProductService.initialize()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get all products
  ipcMain.handle('product:getAllProducts', async () => {
    try {
      return await ProductService.getAllProducts()
    } catch (error: any) {
      throw new Error(`Failed to get products: ${error.message}`)
    }
  })

  // Get product by ID
  ipcMain.handle('product:getProductById', async (_, id: string) => {
    try {
      return await ProductService.getProductById(id)
    } catch (error: any) {
      throw new Error(`Failed to get product: ${error.message}`)
    }
  })

  // Create product
  ipcMain.handle('product:createProduct', async (_, product: any) => {
    try {
      return await ProductService.createProduct(product)
    } catch (error: any) {
      throw new Error(`Failed to create product: ${error.message}`)
    }
  })

  // Update product
  ipcMain.handle('product:updateProduct', async (_, id: string, updates: any) => {
    try {
      return await ProductService.updateProduct(id, updates)
    } catch (error: any) {
      throw new Error(`Failed to update product: ${error.message}`)
    }
  })

  // Delete product
  ipcMain.handle('product:deleteProduct', async (_, id: string) => {
    try {
      await ProductService.deleteProduct(id)
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to delete product: ${error.message}`)
    }
  })

  // Export products
  ipcMain.handle('product:exportProducts', async (_, filePath: string) => {
    try {
      await ProductService.exportProducts(filePath)
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to export products: ${error.message}`)
    }
  })

  // Import products
  ipcMain.handle('product:importProducts', async (_, filePath: string, mergeMode: 'replace' | 'merge') => {
    try {
      await ProductService.importProducts(filePath, mergeMode)
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to import products: ${error.message}`)
    }
  })

  // Show save dialog for export
  ipcMain.handle('product:showSaveDialog', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showSaveDialog({
      title: 'Export Products',
      defaultPath: 'products.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    return result.canceled ? null : result.filePath
  })

  // Show open dialog for import
  ipcMain.handle('product:showOpenDialog', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      title: 'Import Products',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}


/**
 * Initialize schema service handlers
 */
export function initializeSchemaHandlers(): void {

  // Auto-initialize schema service immediately
  const initializeSchemas = async () => {
    try {
      const appDataPath = app.getPath('userData');

      console.log('🔄 Auto-initializing schemas...');
      console.log('App data path:', appDataPath);

      // Register Kubernetes schema sources using Node.js path.join for main process
      schemaService.registerSchemaSource({
        id: 'kubernetes',
        name: 'Kubernetes Core API',
        path: path.join(appDataPath, 'schemas', 'k8s'),
        enabled: true
      });

      // Initialize vanilla k8s schemas first
      await schemaService.initialize();
      console.log('✅ Vanilla k8s schemas loaded');

      // Get the saved kubeconfig path from store
      const ElectronStore = (await import('electron-store')).default;
      const store = new ElectronStore();
      const savedConfigPath = (store as any).get('kubeConfigPath') as string | undefined;

      // Then discover and load CRDs from cluster
      await schemaService.initializeCRDs(savedConfigPath);
      console.log('✅ CRD discovery completed');

    } catch (error: any) {
      console.error('❌ Schema auto-initialization failed:', error);
    }
  };
  // ... existing code ...
  // Initialize immediately
  initializeSchemas();

  // Keep the IPC handler for manual re-initialization if needed
  ipcMain.handle('schema:initialize', async () => {
    try {
      await initializeSchemas();
      return { success: true };
    } catch (error: any) {
      console.error('Schema initialization failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Search within a specific source
  ipcMain.handle('schema:searchInSource', async (_, sourceId: string, query: string) => {
    return schemaService.searchInSource(sourceId, query);
  });

  // Get all resources from a specific source
  ipcMain.handle('schema:getResourcesFromSource', async (_, sourceId: string) => {
    return schemaService.getResourcesFromSource(sourceId);
  });

  // Get available schema sources
  ipcMain.handle('schema:getAvailableSources', async () => {
    return schemaService.getAvailableSources();
  });

  // Get source statistics
  ipcMain.handle('schema:getSourceStats', async (_, sourceId: string) => {
    return schemaService.getSourceStats(sourceId);
  });

  // Check if schema service is ready
  ipcMain.handle('schema:isReady', async () => {
    return schemaService.isReady();
  });

  // Dereference specific resource on-demand
  ipcMain.handle('schema:dereferenceResource', async (_, sourceId: string, resourceKey: string) => {
    return schemaService.dereferenceResource(sourceId, resourceKey);
  });

  // Get raw schema for resource (with $ref intact)
  ipcMain.handle('schema:getRawResourceSchema', async (_, sourceId: string, resourceKey: string) => {
    return schemaService.getRawResourceSchema(sourceId, resourceKey);
  });

  // NEW: Get schema tree for resource (replaces dereferencing for UI)
  ipcMain.handle('schema:getResourceSchemaTree', async (_, sourceId: string, resourceKey: string) => {
    return schemaService.getResourceSchemaTree(sourceId, resourceKey);
  });

  // Optional CRD-enhanced search (fallback to standard if CRDs not available)
  ipcMain.handle('schema:searchAllSourcesWithCRDs', async (_, query: string) => {
    return schemaService.searchAllSourcesWithCRDs(query);
  });

  // Optional CRD-enhanced resource listing (fallback to standard if CRDs not available)
  ipcMain.handle('schema:getAllResourcesWithCRDs', async () => {
    return schemaService.getAllResourcesWithCRDs();
  });

  // Add after existing schema handlers
  ipcMain.handle('schema:getCRDSchemaTree', async (_, group: string, version: string, kind: string) => {
    return schemaService.getCRDSchemaTree(group, version, kind);
  });

  ipcMain.handle('schema:getRawCRDSchema', async (_, cacheKey: string) => {
    return schemaService.getRawCRDSchema(cacheKey);
  });

}

/**
 * Register Git-related IPC handlers
 */
export function registerGitHandlers() {
  // Essential git server management handlers
  ipcMain.handle('git:getServers', async () => {
    try {
      return gitService.getServers()
    } catch (error: any) {
      console.error('Failed to get servers:', error)
      return []
    }
  })

  ipcMain.handle('git:saveServer', async (_, server: any) => {
    try {
      return await gitService.saveServer(server)
    } catch (error: any) {
      console.error('Failed to save server:', error)
      throw new Error(`Failed to save server: ${error.message}`)
    }
  })

  ipcMain.handle('git:removeServer', async (_, serverId: string) => {
    try {
      return await gitService.removeServer(serverId)
    } catch (error: any) {
      console.error('Failed to remove server:', error)
      throw new Error(`Failed to remove server: ${error.message}`)
    }
  })

  ipcMain.handle('git:updateServer', async (_, serverId: string, updates: any) => {
    try {
      return await gitService.updateServer(serverId, updates)
    } catch (error: any) {
      console.error('Failed to update server:', error)
      throw new Error(`Failed to update server: ${error.message}`)
    }
  })

  ipcMain.handle('git:testServerConnection', async (_, serverId: string) => {
    try {
      return await gitService.testServerConnection(serverId)
    } catch (error: any) {
      console.error('Failed to test server connection:', error)
      return { success: false, error: error.message }
    }
  })

  // ... existing code ...
  ipcMain.handle('git:validateRepositoryAccess', async (_, repositoryUrl: string, serverId?: string): Promise<GitValidationResult> => {
    try {
      return await gitService.validateRepositoryAccess(repositoryUrl, serverId)
    } catch (error: any) {
      return {
        isValid: false,
        authStatus: 'failed',
        error: error.message,
        canConnect: false,
        requiresAuth: true
      }
    }
  })

  // Get repositories - minimal implementation to stop the errors
  ipcMain.handle('git:getRepositories', async () => {
    try {
      return await gitService.getRepositories()
    } catch (error: any) {
      console.error('Failed to get repositories:', error)
      return []
    }
  })

  // Update product metadata in GitOps repository - ACTUAL GIT OPERATIONS
  console.log('[IPC] Registering git:updateProductMetadata handler')
  ipcMain.handle('git:updateProductMetadata', async (_, params: {
    repositoryUrl: string
    localPath: string
    productName: string
    metadata: string
    commitMessage: string
    branch: string
    components?: Array<{
      name: string
      metadata: any
    }>
  }) => {
    try {
      console.log('[IPC] git:updateProductMetadata called with params:', JSON.stringify(params, null, 2))
      const { repositoryUrl, localPath, productName, metadata, commitMessage, branch } = params

      console.log(`[GitOps] Starting update for ${productName}`)
      console.log(`[GitOps] Repository: ${repositoryUrl}`)
      console.log(`[GitOps] Local path: ${localPath}`)

      // Ensure the local repository directory exists
      await fs.mkdir(localPath, { recursive: true })

      // Get git adapter from factory
      const gitAdapter = GitAdapterFactory.getAdapter('isomorphic-git')

      // Get credentials for the repository
      let credentials: any = undefined
      try {
        // Try to get server credentials for this repository URL
        const servers = gitService.getServers()
        console.log(`[GitOps] Found ${servers.length} configured servers`)

        const matchingServer = servers.find(server => {
          const serverHost = new URL(server.baseUrl).hostname
          const repoHost = new URL(repositoryUrl).hostname
          return serverHost === repoHost
        })

        if (matchingServer) {
          console.log(`[GitOps] Found matching server: ${matchingServer.name}`)
          // Use the git service's method to get credentials
          try {
            const serverCredentials = (gitService as any).getServerAndCredentials(repositoryUrl)
            if (serverCredentials && serverCredentials.credentials) {
              credentials = {
                method: 'credentials',
                username: serverCredentials.credentials.username,
                password: serverCredentials.credentials.token || serverCredentials.credentials.password || ''
              }
              console.log(`[GitOps] Using credentials for server: ${matchingServer.name}`)
            }
          } catch (credError) {
            console.log(`[GitOps] Could not get server credentials:`, credError)
          }
        } else {
          console.log(`[GitOps] No matching server found for ${repositoryUrl}, trying without credentials`)
        }
      } catch (error) {
        console.log(`[GitOps] Could not get credentials, trying without auth:`, error)
      }

      // Check if this is already a git repository
      let isExistingRepo = false
      try {
        await fs.access(path.join(localPath, '.git'))
        isExistingRepo = true
        console.log(`[GitOps] Found existing repository at ${localPath}`)
      } catch {
        console.log(`[GitOps] No existing repository, will clone from ${repositoryUrl}`)
      }

      if (!isExistingRepo) {
        // Clone the repository for the first time
        console.log(`[GitOps] Cloning repository...`)
        const cloneResult = await gitAdapter.clone(repositoryUrl, localPath, credentials)
        if (!cloneResult.success) {
          throw new Error(`Failed to clone repository: ${cloneResult.error}`)
        }
        console.log(`[GitOps] Repository cloned successfully`)
      } else {
        // Pull latest changes if repository already exists
        console.log(`[GitOps] Pulling latest changes...`)
        const pullResult = await gitAdapter.pull(localPath, credentials)
        if (!pullResult.success) {
          console.warn(`[GitOps] Failed to pull latest changes: ${pullResult.error}`)
          // Continue anyway - we'll try to push our changes
        } else {
          console.log(`[GitOps] Latest changes pulled successfully`)
        }
      }

      // Create metadata.json file
      const metadataPath = path.join(localPath, 'metadata.json')
      await fs.writeFile(metadataPath, metadata, 'utf-8')
      console.log(`[GitOps] Created metadata.json`)

      // Create a basic README if it doesn't exist
      const readmePath = path.join(localPath, 'README.md')
      try {
        await fs.access(readmePath)
        console.log(`[GitOps] README.md already exists`)
      } catch {
        const readmeContent = `# GitOps Repository for ${productName}

This repository contains the GitOps configuration and metadata for the ${productName} product.

## Files

- \`metadata.json\` - Product metadata and configuration
- \`environments/\` - Environment-specific configurations (to be added)

## Usage

This repository is managed by ConfigPilot. Manual changes should be coordinated with the development team.

## Local Development

This repository is cloned locally at: \`${localPath}\`

You can make changes locally and they will be automatically committed and pushed when you save the product configuration.
`
        await fs.writeFile(readmePath, readmeContent, 'utf-8')
        console.log(`[GitOps] Created README.md`)
      }

      // Create component folders and metadata
      const { components } = params
      if (components && components.length > 0) {
        console.log(`[GitOps] Creating ${components.length} component folders...`)

        for (const component of components) {
          const componentFolderPath = path.join(localPath, component.name)

          // Create component folder
          await fs.mkdir(componentFolderPath, { recursive: true })
          console.log(`[GitOps] Created component folder: ${component.name}/`)

          // Create component metadata.json
          const componentMetadataPath = path.join(componentFolderPath, 'metadata.json')
          const componentMetadataContent = JSON.stringify({
            name: component.name,
            ...component.metadata,
            generated: {
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              generator: 'ConfigPilot Product Management'
            }
          }, null, 2)

          await fs.writeFile(componentMetadataPath, componentMetadataContent, 'utf-8')
          console.log(`[GitOps] Created component metadata: ${component.name}/metadata.json`)

          // Create component README
          const componentReadmePath = path.join(componentFolderPath, 'README.md')
          const componentReadmeContent = `# ${component.name}

This folder contains the GitOps configuration and metadata for the ${component.name} component.

## Files

- \`metadata.json\` - Component metadata and configuration
- \`environments/\` - Environment-specific configurations (to be added)
- \`manifests/\` - Kubernetes manifests (to be added)

## Usage

This component is part of the ${productName} product and is managed by ConfigPilot.
`

          await fs.writeFile(componentReadmePath, componentReadmeContent, 'utf-8')
          console.log(`[GitOps] Created component README: ${component.name}/README.md`)
        }
      }

      // Add files to git
      const filesToAdd = ['metadata.json']

      // Only add README if it was created (new repository)
      try {
        const readmeStats = await fs.stat(readmePath)
        if (readmeStats.isFile()) {
          filesToAdd.push('README.md')
        }
      } catch {
        // README doesn't exist, skip it
      }

      // Add component files
      if (components && components.length > 0) {
        for (const component of components) {
          filesToAdd.push(`${component.name}/metadata.json`)
          filesToAdd.push(`${component.name}/README.md`)
        }
      }

      console.log(`[GitOps] Adding files to git: ${filesToAdd.join(', ')}`)
      const addResult = await gitAdapter.add(filesToAdd, localPath)
      if (!addResult.success) {
        throw new Error(`Failed to add files: ${addResult.error}`)
      }

      // Commit changes
      console.log(`[GitOps] Committing changes: ${commitMessage}`)
      const commitResult = await gitAdapter.commit(commitMessage, localPath)
      if (!commitResult.success) {
        throw new Error(`Failed to commit changes: ${commitResult.error}`)
      }

      // Push changes
      console.log(`[GitOps] Pushing changes to remote...`)
      const pushResult = await gitAdapter.push(localPath, credentials)
      if (!pushResult.success) {
        throw new Error(`Failed to push changes: ${pushResult.error}`)
      }

      console.log(`[GitOps] Successfully updated GitOps repository for ${productName}`)
      return {
        success: true,
        message: 'Product metadata updated and pushed to GitOps repository',
        localPath: localPath
      }

    } catch (error: any) {
      console.error(`[GitOps] Operation failed:`, error)
      return { success: false, error: error.message }
    }
  })

  // ipcMain.handle('git:batchFetchGitOpsMetadata', async (event, repositories: BatchRepository[]) => {
  //   try {
  //     return await gitOpsBatchService.batchFetchMetadata(repositories, 'product');
  //   } catch (error) {
  //     console.error('[IPC] Error in git:batchFetchGitOpsMetadata:', error);
  //     return { success: false, results: [], errors: [String(error)] };
  //   }
  // });

  // Batch fetch GitOps metadata from multiple repositories
  ipcMain.handle('git:batchFetchGitOpsMetadata', async (_, params: {
    repositories: Array<{
      productName: string
      repositoryUrl: string
      localPath: string
    }>
  }) => {
    try {
      console.log(`[GitOps] Starting batch fetch for ${params.repositories.length} repositories`)

      const results: Array<{
        productName: string
        success: boolean
        metadata?: any
        components?: Array<{
          name: string
          metadata: any
        }>
        error?: string
      }> = []

      // Get git adapter
      const gitAdapter = GitAdapterFactory.getAdapter('isomorphic-git')

      for (const repo of params.repositories) {
        try {
          console.log(`[GitOps] Fetching metadata for ${repo.productName}`)

          // Ensure local directory exists
          await fs.mkdir(repo.localPath, { recursive: true })

          // Get credentials for this repository
          let credentials: any = undefined
          try {
            const servers = gitService.getServers()
            const matchingServer = servers.find(server => {
              const serverHost = new URL(server.baseUrl).hostname
              const repoHost = new URL(repo.repositoryUrl).hostname
              return serverHost === repoHost
            })

            if (matchingServer) {
              const serverCredentials = (gitService as any).getServerAndCredentials(repo.repositoryUrl)
              if (serverCredentials && serverCredentials.credentials) {
                credentials = {
                  method: 'credentials',
                  username: serverCredentials.credentials.username,
                  password: serverCredentials.credentials.token || serverCredentials.credentials.password || ''
                }
              }
            }
          } catch (credError) {
            console.log(`[GitOps] Could not get credentials for ${repo.productName}:`, credError)
          }

          // Check if repository exists locally
          let isExistingRepo = false
          try {
            await fs.access(path.join(repo.localPath, '.git'))
            isExistingRepo = true
          } catch {
            // Not a git repository yet
          }

          if (!isExistingRepo) {
            // Clone the repository
            const cloneResult = await gitAdapter.clone(repo.repositoryUrl, repo.localPath, credentials)
            if (!cloneResult.success) {
              throw new Error(`Failed to clone repository: ${cloneResult.error}`)
            }
          } else {
            // Pull latest changes
            const pullResult = await gitAdapter.pull(repo.localPath, credentials)
            if (!pullResult.success) {
              console.warn(`[GitOps] Failed to pull latest changes for ${repo.productName}: ${pullResult.error}`)
              // Continue anyway - use existing local data
            }
          }

          // Read product metadata
          let productMetadata = null
          try {
            const metadataPath = path.join(repo.localPath, 'metadata.json')
            const metadataContent = await fs.readFile(metadataPath, 'utf-8')
            productMetadata = JSON.parse(metadataContent)
          } catch (error) {
            console.warn(`[GitOps] Could not read product metadata for ${repo.productName}:`, error)
          }

          // Read component metadata from folders
          const components: Array<{ name: string, metadata: any }> = []
          try {
            const entries = await fs.readdir(repo.localPath, { withFileTypes: true })

            for (const entry of entries) {
              if (entry.isDirectory() && !entry.name.startsWith('.')) {
                try {
                  const componentMetadataPath = path.join(repo.localPath, entry.name, 'metadata.json')
                  const componentMetadataContent = await fs.readFile(componentMetadataPath, 'utf-8')
                  const componentMetadata = JSON.parse(componentMetadataContent)

                  components.push({
                    name: entry.name,
                    metadata: componentMetadata
                  })
                } catch (componentError) {
                  console.warn(`[GitOps] Could not read component metadata for ${entry.name}:`, componentError)
                }
              }
            }
          } catch (error) {
            console.warn(`[GitOps] Could not read component folders for ${repo.productName}:`, error)
          }

          results.push({
            productName: repo.productName,
            success: true,
            metadata: productMetadata,
            components: components
          })

          console.log(`[GitOps] Successfully fetched metadata for ${repo.productName} (${components.length} components)`)

        } catch (error: any) {
          console.error(`[GitOps] Failed to fetch metadata for ${repo.productName}:`, error)
          results.push({
            productName: repo.productName,
            success: false,
            error: error.message
          })
        }
      }

      console.log(`[GitOps] Batch fetch completed: ${results.filter(r => r.success).length}/${results.length} successful`)

      return {
        success: true,
        results: results
      }

    } catch (error: any) {
      console.error(`[GitOps] Batch fetch operation failed:`, error)
      return { success: false, error: error.message }
    }
  })

}

export function registerProductComponentHandlers() {
  // Initialize component service
  ipcMain.handle('productComponent:initialize', async () => {
    try {
      await ProductComponentService.initialize()
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to initialize component service: ${error.message}`)
    }
  })

  // Get all components
  ipcMain.handle('productComponent:getAllComponents', async () => {
    try {
      return await ProductComponentService.getAllComponents()
    } catch (error: any) {
      throw new Error(`Failed to get components: ${error.message}`)
    }
  })

  // Get components by product
  ipcMain.handle('productComponent:getComponentsByProduct', async (_, productName: string) => {
    try {
      return await ProductComponentService.getComponentsByProduct(productName)
    } catch (error: any) {
      throw new Error(`Failed to get components for product: ${error.message}`)
    }
  })

  // Create component
  ipcMain.handle('productComponent:createComponent', async (_, component) => {
    try {
      return await ProductComponentService.createComponent(component)
    } catch (error: any) {
      throw new Error(`Failed to create component: ${error.message}`)
    }
  })

  // Update component
  ipcMain.handle('productComponent:updateComponent', async (_, id: string, updates) => {
    try {
      return await ProductComponentService.updateComponent(id, updates)
    } catch (error: any) {
      throw new Error(`Failed to update component: ${error.message}`)
    }
  })

  // Delete component
  ipcMain.handle('productComponent:deleteComponent', async (_, id: string) => {
    try {
      await ProductComponentService.deleteComponent(id)
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to delete component: ${error.message}`)
    }
  })
}

/**
 * Registers all IPC handlers for the Electron main process.
 * Call this once from main.ts after app is ready.
 */
export function setupIpcHandlers(): void {
  /**
   * Get chart details: values.yaml content, optional schema, chart name
   */
  ipcMain.handle("chart:getDetails", async (_event, { path: chartPath }: { path: string }) => {
    try {
      // Read values.yaml content
      const valuesPath = path.join(chartPath, "values.yaml")
      const valuesContent = await fs.readFile(valuesPath, "utf-8")

      // Try reading optional schema JSON
      let schema = {}
      try {
        const schemaPath = path.join(chartPath, "values.schema.json")
        const schemaContent = await fs.readFile(schemaPath, "utf-8")
        schema = JSON.parse(schemaContent)
      } catch {
        console.log("No valid schema file found; continuing without schema.")
      }

      // Read Chart.yaml for chart metadata
      const chartYamlPath = path.join(chartPath, "Chart.yaml")
      const chartYaml = yaml.load(await fs.readFile(chartYamlPath, "utf-8")) as { name: string }

      return {
        name: chartYaml.name,
        namespace: "default", // Could come from app settings/config
        values: valuesContent,
        schema,
      }
    } catch (error: any) {
      console.error("Failed to get chart details:", error)
      throw new Error(`Failed to get chart details: ${error.message}`)
    }
  })

  /**
   * Save updated values.yaml file for a chart
   */
  ipcMain.handle("chart:saveValues", async (_event, { chartPath, values }: { chartPath: string; values: string }) => {
    try {
      const valuesPath = path.join(chartPath, "values.yaml")
      await fs.writeFile(valuesPath, values, "utf-8")
      return { success: true }
    } catch (error: any) {
      console.error("Failed to save values.yaml:", error)
      throw new Error(`Failed to save values.yaml: ${error.message}`)
    }
  })

  /**
   * Generate Helm templates from provided chart and values
   */
  ipcMain.handle(
    "helm:template",
    async (
      _event,
      {
        releaseName,
        namespace,
        valuesYaml,
        chartPath,
      }: {
        releaseName: string
        namespace: string
        valuesYaml: string
        chartPath: string
      },
    ) => {
      try {
        // Prepare temp directory for values.yaml
        const tempDir = path.join(app.getPath("temp"), "helm-ui")
        await fs.mkdir(tempDir, { recursive: true })
        const tempValuesPath = path.join(tempDir, "values.yaml")
        await fs.writeFile(tempValuesPath, valuesYaml, "utf-8")

        // Execute helm template command
        const { stdout } = await execPromise(
          `helm template ${releaseName} ${chartPath} --namespace ${namespace} -f ${tempValuesPath}`,
        )

        // Parse output into separate templates keyed by filename
        const templates: Record<string, string> = {}
        let currentFile: string | null = null
        let currentContent = ""

        for (const line of stdout.split("\n")) {
          if (line.startsWith("# Source:")) {
            if (currentFile) {
              templates[currentFile] = currentContent.trim()
            }
            currentFile = line.replace("# Source:", "").trim()
            currentContent = line + "\n"
          } else if (currentFile) {
            currentContent += line + "\n"
          }
        }

        // Add last collected template if any
        if (currentFile) {
          templates[currentFile] = currentContent.trim()
        }

        return { templates }
      } catch (error: any) {
        console.error("Failed to generate Helm templates:", error)
        throw new Error(`Failed to generate Helm templates: ${error.message}`)
      }
    },
  )

  /**
   * Show select directory dialog and return chosen path or null if canceled
   */
  ipcMain.handle("dialog:selectDirectory", async (_event, options?: OpenDialogOptions) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        ...(options ?? {}),
      })
      return result.canceled ? null : result.filePaths[0]
    } catch (error: any) {
      console.error("Failed to show select directory dialog:", error)
      throw new Error(`Failed to open directory dialog: ${error.message}`)
    }
  })

  /**
   * Show open file dialog and return chosen file path or null if canceled
   */
  ipcMain.handle("dialog:openFile", async (_event, options?: OpenDialogOptions) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          { name: "Configuration Files", extensions: ["yaml", "yml", "json", "config"] },
          { name: "All Files", extensions: ["*"] },
        ],
        ...(options ?? {}),
      })
      return result.canceled ? null : result.filePaths[0]
    } catch (error: any) {
      console.error("Failed to show open file dialog:", error)
      throw new Error(`Failed to open file dialog: ${error.message}`)
    }
  })

  /**
   * Create a new directory
   */
  ipcMain.handle("directory:create", async (_event, { path: dirPath }: { path: string }) => {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true, path: dirPath }
    } catch (error: any) {
      console.error("Failed to create directory:", error)
      throw new Error(`Failed to create directory: ${error.message}`)
    }
  })

  /**
   * Check if directory exists
   */
  ipcMain.handle("directory:exists", async (_event, { path: dirPath }: { path: string }) => {
    try {
      const stats = await fs.stat(dirPath)
      return { exists: true, isDirectory: stats.isDirectory() }
    } catch (error) {
      return { exists: false, isDirectory: false }
    }
  })

  /**
   * Ensure directory exists
   */
  ipcMain.handle('fs:ensureDirectory', async (_event, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error: any) {
      console.error('Failed to create directory:', error)
      throw new Error(`Failed to create directory: ${error.message}`)
    }
  })

  /**
   * Get directory info
   */
  ipcMain.handle("directory:info", async (_event, { path: dirPath }: { path: string }) => {
    try {
      const stats = await fs.stat(dirPath)
      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      }
    } catch (error: any) {
      throw new Error(`Failed to get directory info: ${error.message}`)
    }
  })

  /**
   * List directories
   */
  ipcMain.handle('fs:listDirectories', async (_event, dirPath: string) => {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true })
      return items.filter(item => item.isDirectory()).map(item => item.name)
    } catch (error: any) {
      console.error('Failed to list directories:', error)
      return []
    }
  })

  /**
   * List all files in a directory
   */
  ipcMain.handle('fs:listFiles', async (_event, dirPath: string) => {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true })
      return items.filter(item => item.isFile()).map(item => item.name)
    } catch (error: any) {
      console.error('Failed to list files:', error)
      return []
    }
  })

  // Add this handler with the other file system handlers
  ipcMain.handle('path:join', async (event, ...paths: string[]) => {
    const path = require('path');
    return path.join(...paths);
  });

  /**
   * File reading
   */
  ipcMain.handle("file:read", async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error: any) {
      console.error("Failed to read file:", error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  })

  /**
   * Write file
   */
  // ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  //   try {
  //     await fs.writeFile(filePath, content, 'utf-8')
  //     return { success: true }
  //   } catch (error: any) {
  //     console.error('Failed to write file:', error)
  //     throw new Error(`Failed to write file: ${error.message}`)
  //   }
  // })

  /**
   * Write file
   */
  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    try {
      // Normalize the path and ensure parent directory exists
      const normalizedPath = path.resolve(filePath)
      const dir = path.dirname(normalizedPath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(normalizedPath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      console.error('Failed to write file:', error)
      throw new Error(`Failed to write file: ${error.message}`)
    }
  })

  /**
   * Get file info
   */
  ipcMain.handle("file:info", async (_event, { path: filePath }: { path: string }) => {
    try {
      const stats = await fs.stat(filePath)
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      }
    } catch (error: any) {
      throw new Error(`Failed to get file info: ${error.message}`)
    }
  })

  /**
   * Delete file
   */
  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    try {
      await fs.unlink(filePath)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to delete file:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  })

  /**
   * Check if file exists
   */
  ipcMain.handle("file:exists", async (_event, { path: filePath }: { path: string }) => {
    try {
      const stats = await fs.stat(filePath)
      return { exists: true, isFile: stats.isFile(), isDirectory: stats.isDirectory() }
    } catch (error) {
      return { exists: false, isFile: false, isDirectory: false }
    }
  })

  /**
   * Get Electron user data directory
   */
  ipcMain.handle("app:getUserDataPath", async () => {
    return app.getPath("userData")
  })

  /**
   * Store secure credentials using Electron's safeStorage
   */
  ipcMain.handle("credentials:store", async (_event, key: string, data: string) => {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system')
      }

      const encrypted = safeStorage.encryptString(data)
      const store = (await import('electron-store')).default
      const credentialStore = new store({ name: 'secure-credentials' }) as any
      credentialStore.set(key, encrypted.toString('base64'))

      return { success: true }
    } catch (error: any) {
      console.error('Failed to store secure credentials:', error)
      throw new Error(`Failed to store secure credentials: ${error.message}`)
    }
  })

  /**
   * Retrieve secure credentials using Electron's safeStorage
   */
  ipcMain.handle("credentials:get", async (_event, key: string) => {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system')
      }

      const store = (await import('electron-store')).default
      const credentialStore = new store({ name: 'secure-credentials' }) as any
      const encryptedData = credentialStore.get(key) as string

      if (!encryptedData) {
        return null
      }

      const buffer = Buffer.from(encryptedData, 'base64')
      const decrypted = safeStorage.decryptString(buffer)

      return decrypted
    } catch (error: any) {
      console.error('Failed to retrieve secure credentials:', error)
      return null
    }
  })

  /**
   * Delete secure credentials
   */
  ipcMain.handle("credentials:delete", async (_event, key: string) => {
    try {
      const store = (await import('electron-store')).default
      const credentialStore = new store({ name: 'secure-credentials' }) as any
      credentialStore.delete(key)

      return { success: true }
    } catch (error: any) {
      console.error('Failed to delete secure credentials:', error)
      throw new Error(`Failed to delete secure credentials: ${error.message}`)
    }
  })

  /**
   * Test Vault connection
   */
  ipcMain.handle("vault:testConnection", async (_event, environment: string, url: string, token: string, namespace?: string) => {
    try {
      const vault = await import('node-vault')
      const client = vault.default({
        apiVersion: 'v1',
        endpoint: url,
        token: token,
        namespace: namespace
      })

      // Test connection by checking health
      await client.health()
      return { success: true, connected: true }
    } catch (error: any) {
      console.error(`Vault connection test failed for ${environment}:`, error)
      return { success: false, connected: false, error: error.message }
    }
  })

  /**
   * Store Vault credentials
   */
  ipcMain.handle("vault:storeCredentials", async (_event, environment: string, credentials: any) => {
    try {
      await VaultCredentialManager.storeCredentials(environment as any, credentials)
      return { success: true }
    } catch (error: any) {
      console.error(`Failed to store Vault credentials for ${environment}:`, error)
      throw new Error(`Failed to store Vault credentials: ${error.message}`)
    }
  })

  /**
   * Get Vault credentials
   */
  ipcMain.handle("vault:getCredentials", async (_event, environment: string) => {
    try {
      const credentials = await VaultCredentialManager.getCredentials(environment as any)
      return credentials
    } catch (error: any) {
      console.error(`Failed to get Vault credentials for ${environment}:`, error)
      return null
    }
  })

  /**
   * Write secret to Vault
   */
  ipcMain.handle("vault:writeSecret", async (_event, environment: string, path: string, key: string, value: string) => {
    try {
      const vaultService = new VaultService()
      const result = await vaultService.writeSecret(environment as any, path, key, value)
      return { success: result }
    } catch (error: any) {
      console.error(`Failed to write Vault secret for ${environment}:`, error)
      throw new Error(`Failed to write Vault secret: ${error.message}`)
    }
  })

  /**
   * Read secret from Vault
   */
  ipcMain.handle("vault:readSecret", async (_event, environment: string, path: string, key: string) => {
    try {
      const vaultService = new VaultService()
      const value = await vaultService.readSecret(environment as any, path, key)
      return { success: true, value }
    } catch (error: any) {
      console.error(`Failed to read Vault secret for ${environment}:`, error)
      throw new Error(`Failed to read Vault secret: ${error.message}`)
    }
  })

  ipcMain.handle("vault:readAllData", async (_event, environment: string, path: string) => {
    try {
      const vaultService = new VaultService();
      return await vaultService.readAllData(environment as Environment, path);
    } catch (error: any) {
      console.error('Failed to read all vault data:', error);
      throw error;
    }
  });

  ipcMain.handle("vault:writeSecretWithMetadata", async (
    _event,
    environment: string,
    path: string,
    key: string,
    value: string,
    metadata?: any
  ) => {
    try {
      const vaultService = new VaultService();
      return await vaultService.writeSecretWithMetadata(
        environment as Environment,
        path,
        key,
        value,
        metadata
      );
    } catch (error: any) {
      console.error('Failed to write secret with metadata:', error);
      throw error;
    }
  });

  /**
   * Read secret with metadata from Vault
   */
  ipcMain.handle("vault:readSecretWithMetadata", async (_event, environment: string, path: string, key: string) => {
    try {
      const vaultService = new VaultService();
      return await vaultService.readSecretWithMetadata(environment as Environment, path, key);
    } catch (error: any) {
      console.error('Failed to read secret with metadata:', error);
      throw error;
    }
  });

  // ArgoCD handlers
  ipcMain.handle("argocd:testConnection", async (_event, environment: string, url: string, token: string, insecureSkipTLSVerify?: boolean) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.testConnection(environment as any, url, token, insecureSkipTLSVerify)
    } catch (error: any) {
      console.error('ArgoCD connection test failed:', error)
      throw new Error(`ArgoCD connection test failed: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:storeCredentials", async (_event, environment: string, credentials: any) => {
    try {
      await ArgoCDCredentialManager.storeCredentials(environment as any, credentials)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to store ArgoCD credentials:', error)
      throw new Error(`Failed to store ArgoCD credentials: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:getCredentials", async (_event, environment: string) => {
    try {
      return await ArgoCDCredentialManager.getCredentials(environment as any)
    } catch (error: any) {
      console.error('Failed to get ArgoCD credentials:', error)
      throw new Error(`Failed to get ArgoCD credentials: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:getApplications", async (_event, environment: string) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.getApplications(environment as any)
    } catch (error: any) {
      console.error('Failed to get ArgoCD applications:', error)
      throw new Error(`Failed to get ArgoCD applications: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:getApplication", async (_event, environment: string, name: string) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.getApplication(environment as any, name)
    } catch (error: any) {
      console.error('Failed to get ArgoCD application:', error)
      throw new Error(`Failed to get ArgoCD application: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:syncApplication", async (_event, environment: string, name: string) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.syncApplication(environment as any, name)
    } catch (error: any) {
      console.error('Failed to sync ArgoCD application:', error)
      throw new Error(`Failed to sync ArgoCD application: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:createApplication", async (_event, environment: string, application: any) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.createApplication(environment as any, application)
    } catch (error: any) {
      console.error('Failed to create ArgoCD application:', error)
      throw new Error(`Failed to create ArgoCD application: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:updateApplication", async (_event, environment: string, name: string, application: any) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.updateApplication(environment as any, name, application)
    } catch (error: any) {
      console.error('Failed to update ArgoCD application:', error)
      throw new Error(`Failed to update ArgoCD application: ${error.message}`)
    }
  })

  ipcMain.handle("argocd:deleteApplication", async (_event, environment: string, name: string) => {
    try {
      const argoCDService = new ArgoCDService()
      return await argoCDService.deleteApplication(environment as any, name)
    } catch (error: any) {
      console.error('Failed to delete ArgoCD application:', error)
      throw new Error(`Failed to delete ArgoCD application: ${error.message}`)
    }
  })

  // Helm OCI handlers
  ipcMain.handle("helm-oci:testConnection", async (_event, environment: string, registryUrl: string, authMethod: string, username?: string, password?: string, token?: string, insecureSkipTLSVerify?: boolean) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.testConnection(environment as any, registryUrl, authMethod, username, password, token, insecureSkipTLSVerify)
    } catch (error: any) {
      console.error('Helm OCI connection test failed:', error)
      throw new Error(`Helm OCI connection test failed: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:storeCredentials", async (_event, environment: string, credentials: any) => {
    try {
      await HelmOCICredentialManager.storeCredentials(environment as any, credentials)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to store Helm OCI credentials:', error)
      throw new Error(`Failed to store Helm OCI credentials: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:getCredentials", async (_event, environment: string) => {
    try {
      return await HelmOCICredentialManager.getCredentials(environment as any)
    } catch (error: any) {
      console.error('Failed to get Helm OCI credentials:', error)
      throw new Error(`Failed to get Helm OCI credentials: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:getRepositories", async (_event, environment: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.getRepositories(environment as any)
    } catch (error: any) {
      console.error('Failed to get Helm repositories:', error)
      throw new Error(`Failed to get Helm repositories: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:searchCharts", async (_event, environment: string, query?: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.searchCharts(environment as any, query)
    } catch (error: any) {
      console.error('Failed to search Helm charts:', error)
      throw new Error(`Failed to search Helm charts: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:getChartVersions", async (_event, environment: string, chartName: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.getChartVersions(environment as any, chartName)
    } catch (error: any) {
      console.error('Failed to get chart versions:', error)
      throw new Error(`Failed to get chart versions: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:pullChart", async (_event, environment: string, chartName: string, version: string, destination?: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.pullChart(environment as any, chartName, version, destination)
    } catch (error: any) {
      console.error('Failed to pull chart:', error)
      throw new Error(`Failed to pull chart: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:inspectChart", async (_event, environment: string, chartName: string, version?: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.inspectChart(environment as any, chartName, version)
    } catch (error: any) {
      console.error('Failed to inspect chart:', error)
      throw new Error(`Failed to inspect chart: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:addRepository", async (_event, environment: string, name: string, url: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.addRepository(environment as any, name, url)
    } catch (error: any) {
      console.error('Failed to add repository:', error)
      throw new Error(`Failed to add repository: ${error.message}`)
    }
  })

  ipcMain.handle("helm-oci:removeRepository", async (_event, environment: string, name: string) => {
    try {
      const helmOCIService = new HelmOCIService()
      return await helmOCIService.removeRepository(environment as any, name)
    } catch (error: any) {
      console.error('Failed to remove repository:', error)
      throw new Error(`Failed to remove repository: ${error.message}`)
    }
  })

  // Project Management Handlers
  ipcMain.handle(PROJECT_CHANNELS.CREATE_PROJECT, async (_, name: string, description?: string): Promise<ProjectConfig> => {
    return ProjectManager.createProject(name, description)
  })

  ipcMain.handle(PROJECT_CHANNELS.SAVE_PROJECT, async (): Promise<string> => {
    return ProjectManager.saveProject()
  })

  ipcMain.handle(PROJECT_CHANNELS.SAVE_PROJECT_AS, async (): Promise<string> => {
    return ProjectManager.saveProject(true)
  })

  ipcMain.handle(PROJECT_CHANNELS.CLOSE_PROJECT, async (): Promise<void> => {
    return ProjectManager.closeProject()
  })

  ipcMain.handle(PROJECT_CHANNELS.GET_CURRENT_PROJECT, async (): Promise<ProjectConfig | null> => {
    return ProjectManager.getCurrentProject()
  })

  ipcMain.handle(PROJECT_CHANNELS.GET_RECENT_PROJECTS, async (): Promise<ProjectMetadata[]> => {
    return ProjectManager.getRecentProjects()
  })

  ipcMain.handle(PROJECT_CHANNELS.DELETE_PROJECT, async (_, filePath: string): Promise<void> => {
    return ProjectManager.deleteProject(filePath)
  })

  ipcMain.handle(PROJECT_CHANNELS.SHOW_OPEN_DIALOG, async (): Promise<string | null> => {
    return FileService.showOpenDialog()
  })

  ipcMain.handle(PROJECT_CHANNELS.SHOW_SAVE_DIALOG, async (_, defaultName?: string): Promise<string | null> => {
    return FileService.showSaveDialog(defaultName)
  })

  ipcMain.handle(PROJECT_CHANNELS.ENABLE_AUTO_SAVE, async (_, intervalSeconds: number): Promise<void> => {
    ProjectManager.enableAutoSave(intervalSeconds)
  })

  ipcMain.handle(PROJECT_CHANNELS.DISABLE_AUTO_SAVE, async (): Promise<void> => {
    ProjectManager.disableAutoSave()
  })

  ipcMain.handle(PROJECT_CHANNELS.EXPORT_PROJECT, async (_, exportPath: string): Promise<void> => {
    return ProjectManager.exportProject(exportPath)
  })

  ipcMain.handle(PROJECT_CHANNELS.OPEN_PROJECT, async (_, filePath?: string): Promise<ProjectConfig | null> => {
    try {
      return await ProjectManager.openProject(filePath)
    } catch (error) {
      // Handle user cancellation gracefully
      if (error instanceof Error && error.message === 'No file selected') {
        return null // Return null instead of throwing for cancellation
      }
      throw error // Re-throw actual errors
    }
  })

  // Platform detection handlers
  ipcMain.handle('platform:detect', async () => {
    try {
      if (!platformDetectionService) {
        platformDetectionService = new PlatformDetectionService()
      }
      return await platformDetectionService.detectPlatform()
    } catch (error) {
      console.error('Platform detection failed:', error)
      throw error
    }
  })

  ipcMain.handle('platform:update-kubeconfig', async (_, kubeConfigPath: string) => {
    try {
      if (!platformDetectionService) {
        platformDetectionService = new PlatformDetectionService(kubeConfigPath)
      } else {
        platformDetectionService.updateKubeConfig(kubeConfigPath)
      }
      return await platformDetectionService.detectPlatform()
    } catch (error) {
      console.error('Platform detection after kubeconfig update failed:', error)
      throw error
    }
  })

  ipcMain.handle('platform:clear-cache', async () => {
    if (platformDetectionService) {
      platformDetectionService.clearCache()
    }
    return true
  })

  // CRD Management handlers
  ipcMain.handle('crd:import', async (event, request: CRDImportRequest) => {
    try {
      return await crdManagementService.importCRD(request)
    } catch (error) {
      throw new Error(`Failed to import CRD: ${error}`)
    }
  })

  ipcMain.handle('crd:list', async () => {
    try {
      return await crdManagementService.listImportedCRDs()
    } catch (error) {
      throw new Error(`Failed to list CRDs: ${error}`)
    }
  })

  ipcMain.handle('crd:listByGroup', async () => {
    try {
      return await crdManagementService.getCRDsByGroup()
    } catch (error) {
      throw new Error(`Failed to list CRDs by group: ${error}`)
    }
  })

  ipcMain.handle('crd:delete', async (event, id: string) => {
    try {
      return await crdManagementService.deleteCRD(id)
    } catch (error) {
      throw new Error(`Failed to delete CRD: ${error}`)
    }
  })

  ipcMain.handle('crd:update', async (event, id: string, updates: Partial<CRDSchema>) => {
    try {
      return await crdManagementService.updateCRD(id, updates)
    } catch (error) {
      throw new Error(`Failed to update CRD: ${error}`)
    }
  })

  ipcMain.handle('crd:discover', async () => {
    try {
      return await crdManagementService.discoverClusterCRDs()
    } catch (error) {
      throw new Error(`Failed to discover cluster CRDs: ${error}`)
    }
  })

  ipcMain.handle('crd:validate', async (event, crdDefinition: any) => {
    try {
      return await crdManagementService.validateCRD(crdDefinition)
    } catch (error) {
      throw new Error(`Failed to validate CRD: ${error}`)
    }
  })


  // Template management handlers
  ipcMain.handle('template:create', async (_, templateData) => {
    return await templateManager.createTemplateFromDesigner(templateData)
  })

  // ipcMain.handle('template:create', async (event, templateData) => {
  //   try {
  //     const createdTemplate = await templateService.createTemplate(templateData)
  //     return createdTemplate
  //   } catch (error) {
  //     console.error('Failed to create template:', error)
  //     throw error
  //   }
  // })

  ipcMain.handle('template:load', async (_, templateId: string) => {
    return await templateService.loadTemplate(templateId)
  })

  ipcMain.handle('template:getAll', async () => {
    return await templateService.getTemplates()
  })

  ipcMain.handle('template:search', async (_, query: string) => {
    return await templateService.searchTemplates(query)
  })

  ipcMain.handle('template:validate', async (_, template) => {
    return await templateService.validateTemplate(template)
  })

  ipcMain.handle('template:generate', async (_, { templateId, context, outputPath, format }) => {
    return await templateService.generateTemplate(templateId, context, outputPath, format)
  })

  ipcMain.handle('template:export', async (_, { templateId, exportPath }) => {
    return await templateService.exportTemplate(templateId, exportPath)
  })

  ipcMain.handle('template:import', async (_, importPath: string) => {
    return await templateService.importTemplate(importPath)
  })

  ipcMain.handle('template:delete', async (_, templateId: string) => {
    return await templateService.deleteTemplate(templateId)
  })

  // Project-template integration handlers
  ipcMain.handle('template:getCompatibleForProject', async (_, project) => {
    return await templateManager.getCompatibleTemplates(project)
  })

  ipcMain.handle('template:generateForProject', async (_, { templateId, project, context, format }) => {
    return await templateManager.generateTemplateForProject(templateId, project, context, format)
  })

  ipcMain.handle('template:validateForProject', async (_, { templateId, project, context }) => {
    return await templateManager.validateTemplateForProject(templateId, project, context)
  })

  ipcMain.handle('template:getUsageStats', async (_, project) => {
    return await templateManager.getTemplateUsageStats(project)
  })

  ipcMain.handle('template:save', async (_, template) => {
    return await templateService.saveTemplate(template)
  })

  // ipcMain.handle('template:update', async (_, templateId: string, updates: any) => {
  //   return await templateService.updateTemplate(templateId, updates)
  // })

  // ipcMain.handle('template:duplicate', async (_, templateId: string) => {
  //   return await templateService.duplicateTemplate(templateId)
  // })

  // ipcMain.handle('template:getPreview', async (_, templateId: string, context: any) => {
  //   return await templateService.generatePreview(templateId, context)
  // })

  // Register customer handlers
  registerCustomerHandlers()

  // Register product handlers
  registerProductHandlers()
}

/**
 * Customer management IPC handlers
 */
export function registerCustomerHandlers() {
  // Initialize customer service
  ipcMain.handle('customer:initialize', async () => {
    try {
      await CustomerService.initialize()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get all customers
  ipcMain.handle('customer:getAllCustomers', async () => {
    try {
      return await CustomerService.getAllCustomers()
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Get customer by ID
  ipcMain.handle('customer:getCustomerById', async (_, id: string) => {
    try {
      return await CustomerService.getCustomerById(id)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Create customer
  ipcMain.handle('customer:createCustomer', async (_, customer) => {
    try {
      return await CustomerService.createCustomer(customer)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Update customer
  ipcMain.handle('customer:updateCustomer', async (_, id: string, updates) => {
    try {
      const updatedCustomer = await CustomerService.updateCustomer(id, updates)

      // Auto-push metadata to GitOps repository if customer has GitOps configured
      if (updatedCustomer.metadata?.gitOps?.repositoryUrl) {
        try {
          console.log(`🚀 Auto-pushing metadata for updated customer: ${updatedCustomer.name}`)

          // Generate metadata for the customer
          const metadata = CustomerService.generateCustomerMetadata(updatedCustomer)
          console.log(`🔍 DEBUG: Generated metadata:`, JSON.stringify(metadata, null, 2));

          // Get GitOps configuration
          const gitOpsConfig = updatedCustomer.metadata.gitOps
          const repositoryUrl = gitOpsConfig.repositoryUrl
          const serverId = gitOpsConfig.serverId

          console.log(`🔍 DEBUG: Repository URL: ${repositoryUrl}, Server ID: ${serverId}`);

          // Check if repository already exists and has proper structure
          try {
            console.log(`🔍 Checking if GitOps repository already exists and is properly configured...`);

            // Try to get repository info to see if it exists
            let gitCredentials: GitCredentials | undefined;
            if (serverId) {
              const { server, credentials: serverCreds } = (gitService as any).getServerAndCredentials(repositoryUrl!, serverId);
              gitCredentials = {
                username: serverCreds.username,
                password: serverCreds.token || serverCreds.password || '',
                token: serverCreds.token,
                method: serverCreds.method,
                url: repositoryUrl!,
                repoId: serverId
              };
            }

            const repositoryInfo = await gitService.getRepositoryInfo(repositoryUrl!, gitCredentials);

            if (repositoryInfo) {
              console.log(`ℹ️ Repository already exists at ${repositoryUrl}, checking branch structure...`);

              // Check if all required branches exist by trying to list remote branches
              try {
                const remoteRefs = await gitService.listRemote(repositoryUrl!, serverId);
                const requiredBranches = ['dev', 'sit', 'uat', 'prod'];
                const existingBranches = remoteRefs.filter(ref => ref.startsWith('refs/heads/')).map(ref => ref.replace('refs/heads/', ''));
                const missingBranches = requiredBranches.filter(branch => !existingBranches.includes(branch));

                console.log(`🔍 Found existing branches: ${existingBranches.join(', ')}`);
                console.log(`🔍 Required branches: ${requiredBranches.join(', ')}`);

                if (missingBranches.length === 0) {
                  console.log(`✅ Repository already has all required branches: ${existingBranches.join(', ')}`);
                  console.log(`✅ Skipping GitOps setup - repository is already properly configured`);
                  return; // Skip the setup since everything is already configured
                } else {
                  console.log(`⚠️ Repository exists but missing branches: ${missingBranches.join(', ')}`);
                  console.log(`🔧 Will proceed with setup to create missing branches...`);
                }
              } catch (branchCheckError) {
                console.log(`⚠️ Could not check branch structure, proceeding with full setup:`, branchCheckError);
              }
            } else {
              console.log(`🔍 Repository does not exist yet, proceeding with full setup`);
            }

            // Use the proper GitOps setup process
            console.log(`🏗️ Setting up GitOps repository with full branch structure...`);

            // Create repository with proper configuration
            const repoConfig = {
              name: `gitops-customers-${updatedCustomer.name}`,
              description: `GitOps repository for customer ${updatedCustomer.displayName || updatedCustomer.name}`,
              isPrivate: true,
              autoInit: true,
              gitignore: 'Kubernetes',
              license: 'MIT',
              provider: 'gitea' as const,
              url: repositoryUrl,
              defaultBranch: 'dev',
            };

            const repository = await gitService.createRepository(repoConfig, serverId);
            console.log(`✅ Repository created: ${repository.url}`);

            // Create environment branches with metadata
            const environments = ['dev', 'sit', 'uat', 'prod'];
            const branchResult = await gitService.createCustomerEnvironmentBranches(
              repositoryUrl!,
              environments,
              updatedCustomer,
              serverId
            );

            if (branchResult.success) {
              console.log(`✅ Environment branches created: ${branchResult.createdBranches.join(', ')}`);
            } else {
              console.warn(`⚠️ Some branches failed to create:`, branchResult.errors);
            }

          } catch (setupError: any) {
            console.error(`❌ Failed to setup GitOps repository: ${setupError.message}`);
            throw setupError;
          }

          console.log(`✅ Successfully pushed metadata for customer: ${updatedCustomer.name}`)
        } catch (gitError: any) {
          console.error(`❌ Failed to push metadata for customer ${updatedCustomer.name}:`, gitError)
          // Don't fail the customer update if GitOps push fails, just log the error
        }
      } else {
        console.log(`ℹ️ DEBUG: No GitOps configuration found for customer: ${updatedCustomer.name}`);
      }

      return updatedCustomer
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Delete customer
  ipcMain.handle('customer:deleteCustomer', async (_, id: string) => {
    try {
      await CustomerService.deleteCustomer(id)
      return { success: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Export customers
  ipcMain.handle('customer:exportCustomers', async (_, filePath: string) => {
    try {
      await CustomerService.exportCustomers(filePath)
      return { success: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Import customers
  ipcMain.handle('customer:importCustomers', async (_, filePath: string, mergeMode: 'replace' | 'merge') => {
    try {
      await CustomerService.importCustomers(filePath, mergeMode)
      return { success: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Show save dialog for export
  ipcMain.handle('customer:showSaveDialog', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Customers',
      defaultPath: 'customers.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePath
  })

  // Show open dialog for import
  ipcMain.handle('customer:showOpenDialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Customers',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Create customer with GitOps integration
  ipcMain.handle('customer:createCustomerWithGitOps', async (_, customer, gitOpsConfig) => {
    try {
      return await CustomerService.createCustomerWithGitOps(customer, gitOpsConfig)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Setup GitOps for existing customer
  ipcMain.handle('customer:setupGitOps', async (_, customerId: string, hostingOrg: string, gitOpsConfig) => {

    try {
      return await CustomerService.setupCustomerGitOps(customerId, gitOpsConfig, hostingOrg)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  // Get available Git servers for GitOps setup
  ipcMain.handle('customer:getAvailableGitServers', async () => {
    try {
      return await gitService.getServers()
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('customer:batchFetchGitOpsMetadata', async (_, repositories: BatchRepository[]) => {
    try {
      return await gitOpsBatchService.batchFetchMetadata(repositories, 'customer');
    } catch (error) {
      console.error('[IPC] Error in customer:batchFetchGitOpsMetadata:', error);
      return { success: false, results: [], errors: [String(error)] };
    }
  });

  // ipcMain.handle('customer:batchFetchGitOpsMetadata', async (_, serverId?: string) => {
  //   try {
  //     console.log('[Customer GitOps] Starting batch fetch of customer metadata from GitOps repositories');

  //     // Get available Git servers
  //     const servers = gitService.getServers();
  //     if (servers.length === 0) {
  //       throw new Error('No Git servers configured. Please configure a Git server first.');
  //     }

  //     // Use specified serverId or first available server
  //     let gitServer;
  //     if (serverId) {
  //       gitServer = servers.find(s => s.id === serverId) || servers[0];
  //     } else {
  //       gitServer = servers[0];
  //     }

  //     const baseUrl = gitServer.baseUrl.replace(/\/$/, '');

  //     // Discover all customer GitOps repositories using naming convention
  //     // We'll look for repositories with pattern: {baseUrl}/*/gitops.git
  //     const repositories: Array<{
  //       repositoryUrl: string;
  //       customerId: string;
  //     }> = [];


  //     const results: Array<{
  //       customerId: string;
  //       customerName: string;
  //       repositoryUrl: string;
  //       metadata: any;
  //       success: boolean;
  //       error?: string;
  //     }> = [];

  //     const errors: string[] = [];

  //     // Since we can't list all repositories from the Git server API easily,
  //     // we'll use a different approach: try to clone/fetch from repositories
  //     // with common customer ID patterns, or use a predefined list

  //     // For now, let's implement a basic discovery mechanism
  //     // This would need to be enhanced based on your Git server capabilities

  //     // Alternative approach: Try to access repositories for known customer patterns
  //     // This is a placeholder - you'd implement actual repository discovery here

  //     // For demonstration, we'll implement a method to try accessing repositories
  //     // and only include those that exist

  //     // Get git adapter and credentials
  //     const gitAdapter = GitAdapterFactory.getAdapter('isomorphic-git');
  //     let credentials: any = undefined;

  //     try {
  //       const serverCredentials = (gitService as any).getServerAndCredentials(baseUrl);
  //       if (serverCredentials && serverCredentials.credentials) {
  //         credentials = {
  //           method: 'credentials',
  //           username: serverCredentials.credentials.username,
  //           password: serverCredentials.credentials.token || serverCredentials.credentials.password || ''
  //         };
  //       }
  //     } catch (credError) {
  //       console.log('[Customer GitOps] Could not get credentials:', credError);
  //     }
  //     // Implement repository discovery by trying common patterns
  //     // This is a simplified approach - you'd enhance this based on your Git server

  //     // For now, let's create a more robust discovery mechanism
  //     // We'll scan for repositories that match the gitops.git pattern

  //     const discoveredCustomers: Array<{id: string, name: string}> = [];

  //     // Since we can't easily list repositories, we'll implement a method
  //     // that tries to clone repositories and reads customer info from metadata

  //     // This would be replaced with actual Git server API calls to list repositories
  //     // For now, we'll implement a basic approach

  //     // Let's implement a more practical approach:
  //     // 1. Try to access repositories using the naming convention
  //     // 2. Only process repositories that exist and have metadata.json

  //     // For this implementation, we'll use a discovery approach
  //     // where we try to access repositories and extract customer info from metadata

  //     // This is a placeholder for actual repository discovery
  //     // In practice, you'd use your Git server's API to list repositories

  //     console.log('[Customer GitOps] Repository discovery not fully implemented - would need Git server API integration');

  //     // Return empty results for now, indicating the discovery mechanism needs enhancement
  //     return {
  //       success: true,
  //       results: [],
  //       errors: ['Repository discovery requires Git server API integration']
  //     };

  //   } catch (error) {
  //     console.error('[IPC] Error in customer:batchFetchGitOpsMetadata:', error);
  //     return { success: false, results: [], errors: [String(error)] };
  //   }
  // });  

  ipcMain.handle('customer:pushMetadataToRepo', async (_, customerId: string) => {
    try {
      console.log(`[Customer GitOps] Pushing metadata for customer ${customerId}`)

      // Get customer data
      const customer = await CustomerService.getCustomerById(customerId)
      if (!customer) {
        throw new Error(`Customer with ID ${customerId} not found`)
      }

      // Check if customer has GitOps configuration
      if (!customer.metadata?.gitOps?.repositoryUrl) {
        throw new Error(`Customer ${customer.name} does not have GitOps repository configured`)
      }

      const repositoryUrl = customer.metadata.gitOps.repositoryUrl
      const localPath = path.join(app.getPath('userData'), 'gitops', 'customers', customer.name)

      // Generate customer metadata using the service method to ensure proper HTML decoding
      const customerMetadata = CustomerService.generateCustomerMetadata(customer)

      // Ensure local directory exists
      await fs.mkdir(localPath, { recursive: true })

      // Get git adapter and credentials
      const gitAdapter = GitAdapterFactory.getAdapter('isomorphic-git')
      let credentials: any = undefined

      try {
        const servers = gitService.getServers()
        const matchingServer = servers.find(server => {
          const serverHost = new URL(server.baseUrl).hostname
          const repoHost = new URL(repositoryUrl).hostname
          return serverHost === repoHost
        })

        if (matchingServer) {
          const serverCredentials = (gitService as any).getServerAndCredentials(repositoryUrl)
          if (serverCredentials && serverCredentials.credentials) {
            credentials = {
              method: 'credentials',
              username: serverCredentials.credentials.username,
              password: serverCredentials.credentials.token || serverCredentials.credentials.password || ''
            }
          }
        }
      } catch (credError) {
        console.log(`[Customer GitOps] Could not get credentials for ${customer.name}:`, credError)
      }

      // Check if repository exists locally
      let isExistingRepo = false
      try {
        await fs.access(path.join(localPath, '.git'))
        isExistingRepo = true
      } catch {
        // Not a git repository yet
      }

      if (!isExistingRepo) {
        // Clone the repository
        const cloneResult = await gitAdapter.clone(repositoryUrl, localPath, credentials)
        if (!cloneResult.success) {
          throw new Error(`Failed to clone repository: ${cloneResult.error}`)
        }
      } else {
        // Pull latest changes
        const pullResult = await gitAdapter.pull(localPath, credentials)
        if (!pullResult.success) {
          console.warn(`[Customer GitOps] Failed to pull latest changes: ${pullResult.error}`)
        }
      }

      // Write metadata.json
      const metadataPath = path.join(localPath, 'metadata.json')
      await fs.writeFile(metadataPath, JSON.stringify(customerMetadata, null, 2), 'utf-8')

      // Add files to git staging area
      const addResult = await gitAdapter.add('metadata.json', localPath)
      if (!addResult.success) {
        throw new Error(`Failed to add files to git: ${addResult.error}`)
      }

      // Commit and push changes
      const commitResult = await gitAdapter.commit(
        `Update customer metadata for ${customer.name}`,
        localPath
      )

      if (!commitResult.success) {
        throw new Error(`Failed to commit changes: ${commitResult.error}`)
      }

      const pushResult = await gitAdapter.push(localPath, credentials)
      if (!pushResult.success) {
        throw new Error(`Failed to push changes: ${pushResult.error}`)
      }

      console.log(`[Customer GitOps] Successfully pushed metadata for ${customer.name}`)

      return {
        success: true,
        message: `Metadata pushed successfully for customer ${customer.name}`
      }

    } catch (error: any) {
      console.error(`[Customer GitOps] Failed to push metadata:`, error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('customer:generateGitOpsRepositories', async (_, customers: Customer[]) => {
    try {
      console.log(`[Customer GitOps] Generating GitOps repositories for ${customers.length} customers`)

      const results: Array<{
        customerName: string
        success: boolean
        repositoryUrl?: string
        error?: string
      }> = []

      // Get available Git servers
      const servers = gitService.getServers()
      if (servers.length === 0) {
        throw new Error('No Git servers configured. Please configure a Git server first.')
      }

      // Use the first available server (or implement server selection logic)
      const gitServer = servers[0]
      const baseUrl = gitServer.baseUrl.replace(/\/$/, '') // Remove trailing slash

      for (const customer of customers) {
        try {
          // Generate repository URL following naming convention
          const repositoryName = `${customer.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-gitops`
          const repositoryUrl = `${baseUrl}/${repositoryName}.git`

          // Create repository using git service
          const createResult = await gitService.createRepository({
            name: repositoryName,
            description: `GitOps repository for customer ${customer.name}`,
            isPrivate: true,
            autoInit: true,
            provider: gitServer.provider || 'gitea' // Add missing provider property
          }, gitServer.id)

          // if (!createResult.success) {
          //   throw new Error(`Failed to create repository: ${createResult.error}`)
          // }

          // Update customer with GitOps metadata
          const updatedCustomer = {
            ...customer,
            metadata: {
              ...customer.metadata,
              gitOps: {
                repositoryUrl: repositoryUrl,
                serverId: gitServer.id,
                createdAt: new Date().toISOString()
              }
            }
          }

          // Save updated customer
          await CustomerService.updateCustomer(customer.id, updatedCustomer)

          // Push initial metadata to the repository
          try {
            await CustomerService.pushCustomerMetadataToRepo(customer)
            console.log(`[Customer GitOps] Successfully pushed initial metadata for ${customer.name}`)
          } catch (pushError: any) {
            console.warn(`[Customer GitOps] Failed to push initial metadata for ${customer.name}: ${pushError.message}`)
          }

          results.push({
            customerName: customer.name,
            success: true,
            repositoryUrl: repositoryUrl
          })

          console.log(`[Customer GitOps] Successfully created GitOps repository for ${customer.name}: ${repositoryUrl}`)

        } catch (error: any) {
          console.error(`[Customer GitOps] Failed to create GitOps repository for ${customer.name}:`, error)
          results.push({
            customerName: customer.name,
            success: false,
            error: error.message
          })
        }
      }

      console.log(`[Customer GitOps] Repository generation completed: ${results.filter(r => r.success).length}/${results.length} successful`)

      return {
        success: true,
        results: results
      }

    } catch (error: any) {
      console.error(`[Customer GitOps] Failed to generate GitOps repositories:`, error)
      return { success: false, error: error.message }
    }
  })

  /**
 * Save settings to electron-store for persistence across app restarts
 */
  ipcMain.handle('settings:save', async (_, settings: any) => {
    try {
      const store = new Store() as any;
      store.set('settings', settings);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to save settings to electron-store:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Join path segments - utility for cross-platform path handling
   */
  ipcMain.handle('joinPath', async (_, ...segments: string[]) => {
    return path.join(...segments)
  })

  /**
   * Read file content
   */
  ipcMain.handle('readFile', async (_, filePath: string) => {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error: any) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`)
    }
  })

  /**
   * Create directory recursively
   */
  ipcMain.handle('createDirectory', async (_, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`)
    }
  })

  /**
   * Write file with content
   */
  ipcMain.handle('writeFile', async (_, filePath: string, content: string) => {
    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath)
      await fs.mkdir(parentDir, { recursive: true })

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`)
    }
  })

}