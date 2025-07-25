import { ipcMain, dialog, app, type OpenDialogOptions } from "electron"
import fs from "fs/promises"
import * as path from 'path';
import { exec } from "child_process"
import util from "util"
import yaml from "js-yaml"
import Store from 'electron-store';
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
//import { GitRepositoryStore } from './services/git-repository-store';
import { GitRepository, GitValidationResult, GitCredentials } from '../shared/types/git-repository';
//import { GitAuthService } from './services/git-auth-service';
//import { UnifiedGitService } from './services/unified-git-service';
import { ProductComponentService } from './services/product-component-service'

const execPromise = util.promisify(exec)

// Unified Git Service - Single instance for all Git operations
//const unifiedGitService = new UnifiedGitService();

// Legacy services - Keep for backward compatibility during migration
// const gitAuthService = new GitAuthService();
// const gitRepositoryStore = new GitRepositoryStore();

let platformDetectionService: PlatformDetectionService | null = null

/**
 * Register unified Git handlers that consolidate server and repository management
 */
export function registerUnifiedGitHandlers() {
  // Server Management
  ipcMain.handle('git:getServers', async () => {
    try {
      return await gitService.getServers();
    } catch (error: any) {
      throw new Error(`Failed to get servers: ${error.message}`);
    }
  });

  ipcMain.handle('git:saveServer', async (_, server) => {
    try {
      return await gitService.saveServer(server);
    } catch (error: any) {
      throw new Error(`Failed to save server: ${error.message}`);
    }
  });

  ipcMain.handle('git:authenticateServer', async (_, serverId: string, credentials) => {
    try {
      return await gitService.authenticateServer(serverId, credentials);
    } catch (error: any) {
      throw new Error(`Failed to authenticate to server: ${error.message}`);
    }
  });

  // Repository Management with Server Integration
  ipcMain.handle('git:getRepositories', async (): Promise<GitRepository[]> => {
    try {
      return await gitService.getRepositories();
    } catch (error: any) {
      console.error('Failed to get repositories:', error);
      return [];
    }
  });

  ipcMain.handle('git:saveRepository', async (_, repository: GitRepository): Promise<GitRepository> => {
    try {
      return await gitService.saveRepository(repository);
    } catch (error: any) {
      console.error('Failed to save repository:', error);
      throw new Error(`Failed to save repository: ${error.message}`);
    }
  });

  ipcMain.handle('git:validateRepositoryAccess', async (_, url: string, serverId: string): Promise<GitValidationResult> => {
    try {
      return await gitService.validateRepositoryAccess(url, serverId);
    } catch (error: any) {
      console.error('Failed to validate repository access:', error);
      return {
        isValid: false,
        error: error.message || 'Validation failed',
        canConnect: false,
        requiresAuth: true
      };
    }
  });

  ipcMain.handle('git:createRepository', async (_, config, serverId?: string) => {
    try {
      return await gitService.createRepository(config, serverId);
    } catch (error: any) {
      console.error('Error occurred in handler for \'git:createRepository\':', error);
      throw error;
    }
  });

  // ipcMain.handle('git:createRepository', async (_, config: any, serverId: string): Promise<GitRepository> => {
  //   try {
  //     return await gitService.createRepository(config, serverId);
  //   } catch (error: any) {
  //     console.error('Failed to create repository:', error);
  //     throw new Error(`Failed to create repository: ${error.message}`);
  //   }
  // });

  // Health Check
  // ipcMain.handle('git:checkHealth', async () => {
  //   try {
  //     return await gitService.checkAllRepositoriesHealth();
  //   } catch (error: any) {
  //     console.error('Failed to check Git health:', error);
  //     throw new Error(`Failed to check Git health: ${error.message}`);
  //   }
  // });

  // Legacy Git Operations (keep existing functionality)
  ipcMain.handle('git:clone', async (_, repoUrl: string, localPath: string, credentialId?: string) => {
    try {
      return await gitService.cloneRepository(repoUrl, localPath, credentialId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:prepareCustomerBranch', async (_, customer: string, env: string) => {
    try {
      return await gitService.checkoutCustomerBranch(customer, env);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:getCustomerOverrides', async (_, customer: string, env: string) => {
    try {
      return await gitService.getCustomerOverrides(customer, env);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:updateCustomerOverrides', async (_, customer: string, env: string, values: string) => {
    try {
      return await gitService.updateCustomerOverrides(customer, env, values);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:commitYamlToGit', async (_, filePath: string, content: string, commitMessage: string, credentialId?: string) => {
    try {
      return await gitService.commitYamlToGit(filePath, content, commitMessage, credentialId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:push', async (_, remote?: string, branch?: string, credentialId?: string) => {
    try {
      return await gitService.pushChanges(remote, branch, credentialId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:pull', async (_, remote?: string, branch?: string, credentialId?: string) => {
    try {
      return await gitService.pullChanges(remote, branch, credentialId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:status', async () => {
    try {
      return await gitService.getStatus();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:getCommitHistory', async (_, maxCount?: number) => {
    try {
      return await gitService.getCommitHistory(maxCount);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:merge', async (_, branchName: string, options?: { noFf?: boolean, squash?: boolean }) => {
    try {
      return await gitService.mergeBranch(branchName, options);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:mergeCustomerBranch', async (_, customer: string, env: string, targetBranch: string) => {
    try {
      return await gitService.mergeCustomerBranch(customer, env, targetBranch);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:checkMergeConflicts', async (_, branchName: string) => {
    try {
      return await gitService.checkMergeConflicts(branchName);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:resolveMergeConflicts', async (_, resolvedFiles: string[]) => {
    try {
      return await gitService.resolveMergeConflicts(resolvedFiles);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:abortMerge', async () => {
    try {
      return await gitService.abortMerge();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:prepareMergeRequest', async (_, sourceBranch: string, targetBranch: string, title: string, description?: string) => {
    try {
      return await gitService.prepareMergeRequest(sourceBranch, targetBranch, title, description);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('git:createEnvironmentBranches', async (_, repositoryUrl: string, environments: string[]): Promise<{ success: boolean; createdBranches: string[]; errors: any[] }> => {
    try {
      const result = await gitService.createEnvironmentBranches(repositoryUrl, environments);
      return result;
    } catch (error: any) {
      console.error('Failed to create environment branches:', error);
      throw new Error(`Failed to create environment branches: ${error.message}`);
    }
  });

  // ipcMain.handle('git:removeRepository', async (_, repositoryId: string): Promise<void> => {
  //   try {
  //     return await gitService.removeRepository(repositoryId);
  //   } catch (error: any) {
  //     console.error('Failed to remove repository:', error);
  //     throw new Error(`Failed to remove repository: ${error.message}`);
  //   }
  // });

  // ipcMain.handle('git:removeServer', async (_, serverId: string): Promise<void> => {
  //   try {
  //     return await gitService.removeServer(serverId);
  //   } catch (error: any) {
  //     console.error('Failed to remove server:', error);
  //     throw new Error(`Failed to remove server: ${error.message}`);
  //   }
  // });

  ipcMain.handle('git:setDefaultBranch', async (_, repositoryUrl: string, branchName: string) => {
    try {
      return await gitService.setDefaultBranch(repositoryUrl, branchName);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

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

// export function registerGitAuthHandlers() {
//   // Server management
//   ipcMain.handle('git-auth:getServers', async () => {
//     try {
//       return gitAuthService.getServers();
//     } catch (error: any) {
//       throw new Error(`Failed to get servers: ${error.message}`);
//     }
//   });

//   ipcMain.handle('git-auth:saveServer', async (_, server) => {
//     try {
//       return await gitAuthService.saveServer(server);
//     } catch (error: any) {
//       throw new Error(`Failed to save server: ${error.message}`);
//     }
//   });

//   ipcMain.handle('git-auth:removeServer', async (_, serverId: string) => {
//     try {
//       return await gitAuthService.removeServer(serverId);
//     } catch (error: any) {
//       throw new Error(`Failed to remove server: ${error.message}`);
//     }
//   });

//   // Authentication
//   ipcMain.handle('git-auth:authenticateToServer', async (_, serverId: string, credentials) => {
//     try {
//       return await gitAuthService.authenticateToServer(serverId, credentials);
//     } catch (error: any) {
//       throw new Error(`Failed to authenticate to server: ${error.message}`);
//     }
//   });

//   ipcMain.handle('git-auth:getServerAuthStatus', async (_, serverId: string) => {
//     try {
//       return gitAuthService.getServerAuthStatus(serverId);
//     } catch (error: any) {
//       throw new Error(`Failed to get server auth status: ${error.message}`);
//     }
//   });

//   ipcMain.handle('git-auth:testRepositoryAccess', async (_, repositoryUrl: string, serverId: string) => {
//     try {
//       return await gitAuthService.testRepositoryAccess(repositoryUrl, serverId);
//     } catch (error: any) {
//       throw new Error(`Failed to test repository access: ${error.message}`);
//     }
//   });
// }

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
      return await CustomerService.updateCustomer(id, updates)
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
}