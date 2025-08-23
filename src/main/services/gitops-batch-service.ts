import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs/promises';
import { GitAdapterFactory } from './adapters/git-adapter-factory';
import { gitService } from './git-service';
import { GitCredentials } from '../../shared/types/git-repository';
import { generateLocalRepositoryPath } from '../../shared/types/product';

export interface BatchRepository {
  entityName: string; // customerName or productName
  repositoryUrl: string;
  serverId?: string;
  localPath?: string; // Optional - will be generated if not provided
}

export interface BatchFetchResult {
  success: boolean;
  results: Array<{
    entityName: string;
    success: boolean;
    metadata?: any;
    components?: any[]; // For products only
    error?: string;
  }>;
  errors: string[];
}

/**
 * Unified GitOps batch metadata fetching service
 * Follows product path convention for consistency
 */
export class GitOpsBatchService {
  
  /**
   * Generate local path following product convention
   * Products: {userData}/repositories/gitops-products-{productName}
   * Customers: {userData}/repositories/gitops-customers-{customerName}
   */
  private generateLocalPath(entityName: string, entityType: 'product' | 'customer'): string {
    const baseDirectory = app.getPath('userData');
    
    if (entityType === 'product') {
      return generateLocalRepositoryPath(baseDirectory, entityName);
    } else {
      // Follow same pattern for customers
      const safeEntityName = entityName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const cleanBaseDirectory = baseDirectory.replace(/[/\\]+$/, '');
      return `${cleanBaseDirectory}/repositories/gitops-customers-${safeEntityName}`;
    }
  }

  /**
   * Convert server credentials to Git credentials format
   */
  private convertToGitCredentials(serverCreds: any, repositoryUrl: string): GitCredentials {
    return {
      username: serverCreds.username,
      password: serverCreds.token || serverCreds.password || '',
      token: serverCreds.token,
      method: serverCreds.method,
      url: repositoryUrl,
      repoId: ''
    };
  }

  /**
   * Batch fetch metadata from GitOps repositories
   */
  async batchFetchMetadata(
    repositories: BatchRepository[], 
    entityType: 'product' | 'customer'
  ): Promise<BatchFetchResult> {
    const results: BatchFetchResult['results'] = [];
    const errors: string[] = [];

    console.log(`[GitOpsBatch] Starting batch fetch for ${repositories.length} ${entityType} repositories`);

    for (const repo of repositories) {
      try {
        console.log(`[GitOpsBatch] Processing ${entityType}: ${repo.entityName}`);
        
        // Generate local path if not provided
        const localPath = repo.localPath || this.generateLocalPath(repo.entityName, entityType);
        console.log(`[GitOpsBatch] Local path: ${localPath}`);

        // Ensure directory exists
        await fs.mkdir(localPath, { recursive: true });

        // Get Git adapter
        const gitAdapter = GitAdapterFactory.getAdapter('isomorphic-git');

        // Get credentials
        let gitCredentials: GitCredentials | undefined;
        if (repo.serverId) {
          try {
            const { server, credentials: serverCreds } = (gitService as any).getServerAndCredentials(
              repo.repositoryUrl, 
              repo.serverId
            );
            gitCredentials = this.convertToGitCredentials(serverCreds, repo.repositoryUrl);
          } catch (credError) {
            console.log(`[GitOpsBatch] Could not get credentials for ${repo.entityName}:`, credError);
          }
        }

        // Check if repository exists locally
        let isExistingRepo = false;
        try {
          await fs.access(path.join(localPath, '.git'));
          isExistingRepo = true;
        } catch {
          // Not a git repository yet
        }

        // Clone or pull
        if (!isExistingRepo) {
          console.log(`[GitOpsBatch] Cloning ${repo.repositoryUrl} to ${localPath}`);
          await gitAdapter.clone(repo.repositoryUrl, localPath, gitCredentials);
        } else {
          console.log(`[GitOpsBatch] Pulling latest changes for ${repo.entityName}`);
          await gitAdapter.pull(localPath, gitCredentials);
        }

        // Read metadata.json
        const metadataPath = path.join(localPath, 'metadata.json');
        let metadata: any = null;
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch (metadataError) {
          console.log(`[GitOpsBatch] Could not read metadata for ${repo.entityName}:`, metadataError);
        }

        // Read components.json for products only
        let components: any[] = [];
        if (entityType === 'product') {
          try {
            const componentsPath = path.join(localPath, 'components.json');
            const componentsContent = await fs.readFile(componentsPath, 'utf-8');
            components = JSON.parse(componentsContent);
          } catch (componentsError) {
            console.log(`[GitOpsBatch] Could not read components for ${repo.entityName}:`, componentsError);
          }
        }

        const result: any = {
          entityName: repo.entityName,
          success: true,
          metadata
        };
        
        if (entityType === 'product') {
          result.components = components;
        }
        
        results.push(result);

      } catch (error) {
        const errorMessage = `Failed to fetch metadata for ${repo.entityName}: ${error}`;
        console.error(`[GitOpsBatch] ${errorMessage}`);
        errors.push(errorMessage);
        
        results.push({
          entityName: repo.entityName,
          success: false,
          error: errorMessage
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }
}

// Export singleton instance
export const gitOpsBatchService = new GitOpsBatchService();