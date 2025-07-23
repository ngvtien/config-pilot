import Store from 'electron-store';
import { GitRepository, GitValidationResult, GitCredentials } from '../../shared/types/git-repository';
import { GitService } from './git-service';

interface GitRepositoryStoreSchema {
  repositories: GitRepository[];
}

/**
 * Git repository storage and management service
 * Handles persistence and validation of Git repositories
 */
export class GitRepositoryStore {
  private store: any;
  private gitService: GitService;

  constructor() {
    this.store = new Store<GitRepositoryStoreSchema>({
      name: 'git-repositories',
      defaults: {
        repositories: []
      }
    });
    this.gitService = new GitService();
  }

  /**
   * Get all stored repositories
   */
  getRepositories(): GitRepository[] {
    return this.store.get('repositories', []);
  }

  /**
   * Save a repository to storage
   */
  saveRepository(repository: GitRepository): void {
    const repositories = this.getRepositories();
    const existingIndex = repositories.findIndex(repo => repo.id === repository.id);
    
    if (existingIndex >= 0) {
      repositories[existingIndex] = repository;
    } else {
      repositories.push(repository);
    }
    
    this.store.set('repositories', repositories);
  }

  /**
   * Remove a repository from storage
   */
  removeRepository(id: string): void {
    const repositories = this.getRepositories();
    const filteredRepos = repositories.filter(repo => repo.id !== id);
    this.store.set('repositories', filteredRepos);
  }

  /**
   * Validate repository URL and credentials
   */
  async validateRepository(url: string, credentials?: GitCredentials): Promise<GitValidationResult> {
    try {
      const result = await this.gitService.validateRepository(url, credentials);
      // Convert git-service result to shared type format
      return {
        isValid: result.isValid,
        authStatus: result.authStatus,
        error: result.error,
        canConnect: result.isValid && !result.error,
        requiresAuth: result.authStatus === 'failed' || result.authStatus === 'unknown',
        repositoryInfo: result.repositoryInfo
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        canConnect: false,
        requiresAuth: false
      };
    }
  }

  /**
   * Get repository by ID
   */
  getRepositoryById(id: string): GitRepository | undefined {
    const repositories = this.getRepositories();
    return repositories.find(repo => repo.id === id);
  }

  /**
   * Get repository by URL
   */
  getRepositoryByUrl(url: string): GitRepository | undefined {
    const repositories = this.getRepositories();
    return repositories.find(repo => repo.url === url);
  }
}