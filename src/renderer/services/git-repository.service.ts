import { GitRepository, GitValidationResult, GitCredentials } from '../../shared/types/git-repository';

/**
 * Lightweight Git repository service for data operations
 * Updated to use the unified Git interface
 */
export class GitRepositoryService {
  /**
   * Get all repositories from electron store
   */
  static async getRepositories(): Promise<GitRepository[]> {
    try {
      return await window.electronAPI?.git?.getRepositories() || [];
    } catch (error) {
      console.error('Failed to get repositories:', error);
      return [];
    }
  }

  /**
   * Save repository to electron store
   */
  static async saveRepository(repo: GitRepository): Promise<void> {
    try {
      await window.electronAPI?.git?.saveRepository(repo);
    } catch (error) {
      console.error('Failed to save repository:', error);
      throw new Error(`Failed to save repository: ${error}`);
    }
  }

  /**
   * Remove repository from electron store
   */
  static async removeRepository(id: string): Promise<void> {
    try {
      // Update to use unified API (this needs to be added to UnifiedGitService)
      await window.electronAPI?.git?.removeRepository?.(id) || 
      await window.electronAPI?.invoke('git:removeRepository', id);
    } catch (error) {
      console.error('Failed to remove repository:', error);
      throw new Error(`Failed to remove repository: ${error}`);
    }
  }

  /**
   * Validate repository URL and authentication using unified interface
   */
  static async validateRepository(url: string, serverId?: string): Promise<GitValidationResult> {
    try {
      if (serverId) {
        // Use the new unified validation method
        return await window.electronAPI?.git?.validateRepositoryAccess(url, serverId) || {
          isValid: false,
          authStatus: 'failed',
          error: 'Git service not available',
          canConnect: false,
          requiresAuth: true
        };
      } else {
        // Remove legacy fallback - force use of unified service
        throw new Error('Server ID is required for repository validation');
      }
    } catch (error: any) {
      return {
        isValid: false,
        authStatus: 'failed',
        error: error.message || 'Validation failed',
        canConnect: false,
        requiresAuth: true
      };
    }
  }

  /**
   * Test connection to repository
   */
  static async testConnection(url: string, serverId?: string): Promise<boolean> {
    const result = await this.validateRepository(url, serverId);
    return result.isValid && result.canConnect;
  }

  /**
   * Create a new repository with validation using unified interface
   */
  static async createRepository(repoData: Omit<GitRepository, 'id'>, serverId?: string): Promise<GitRepository> {
    try {
      if (serverId && repoData.serverId) {
        // Use the new unified creation method
        return await window.electronAPI?.git?.createRepository(repoData, serverId) || {
          ...repoData,
          id: Date.now().toString(),
          authStatus: 'failed',
          lastAuthCheck: new Date().toISOString()
        };
      } else {
        // Legacy creation method
        const validation = await this.validateRepository(repoData.url, serverId);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Repository validation failed');
        }

        const newRepo: GitRepository = {
          ...repoData,
          id: Date.now().toString(),
          authStatus: validation.authStatus,
          lastAuthCheck: new Date().toISOString()
        };

        await this.saveRepository(newRepo);
        return newRepo;
      }
    } catch (error: any) {
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  }

  /**
   * Update existing repository
   */
  static async updateRepository(id: string, updates: Partial<GitRepository>): Promise<GitRepository> {
    const repositories = await this.getRepositories();
    const existingRepo = repositories.find(r => r.id === id);
    
    if (!existingRepo) {
      throw new Error('Repository not found');
    }

    const updatedRepo = { ...existingRepo, ...updates };

    // If URL changed, revalidate
    if (updates.url && updates.url !== existingRepo.url) {
      const validation = await this.validateRepository(updates.url);
      updatedRepo.authStatus = validation.authStatus;
      updatedRepo.lastAuthCheck = new Date().toISOString();
    }

    await this.saveRepository(updatedRepo);
    return updatedRepo;
  }

  /**
   * Get all Git servers
   */
  static async getServers(): Promise<any[]> {
    try {
      return await window.electronAPI?.git?.getServers() || [];
    } catch (error) {
      console.error('Failed to get servers:', error);
      return [];
    }
  }

  /**
   * Save Git server configuration
   */
  static async saveServer(server: any): Promise<void> {
    try {
      await window.electronAPI?.git?.saveServer(server);
    } catch (error) {
      console.error('Failed to save server:', error);
      throw new Error(`Failed to save server: ${error}`);
    }
  }

  /**
   * Authenticate to a Git server
   */
  static async authenticateServer(serverId: string, credentials: any): Promise<void> {
    try {
      await window.electronAPI?.git?.authenticateServer(serverId, credentials);
    } catch (error: any) {
      console.error('Failed to authenticate server:', error);
      throw new Error(`Failed to authenticate server: ${error}`);
    }
  }

  /**
   * Check health of all repositories and servers
   */
  static async checkHealth(): Promise<any> {
    try {
      return await window.electronAPI?.git?.checkHealth() || { status: 'unknown' };
    } catch (error: any) {
      console.error('Failed to check health:', error);
      return { status: 'error', error: error.message };
    }
  }
}