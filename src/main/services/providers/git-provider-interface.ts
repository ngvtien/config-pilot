import { GitServerConfig, GitServerCredentials, GitServerValidationResult } from '../../../shared/types/git-repository';

export interface CreateOrganizationConfig {
  name: string;
  displayName?: string;
  description?: string;
  website?: string;
  location?: string;
  visibility?: 'public' | 'private';
}

export interface CreateProjectConfig {
  key: string;
  name: string;
  description?: string;
  public?: boolean;
}

export interface GitProviderInterface {
  /**
   * Test authentication with the Git server
   */
  testAuthentication(server: GitServerConfig, credentials: GitServerCredentials): Promise<GitServerValidationResult>;

  /**
   * Test repository access
   */
  testRepositoryAccess(server: GitServerConfig, credentials: GitServerCredentials, repositoryUrl: string): Promise<boolean>;

  /**
   * Create a new repository
   */
  createRepository(server: GitServerConfig, credentials: GitServerCredentials, config: any): Promise<any>;

  /**
   * Create organization (Gitea) or project (Bitbucket)
   */
  createOrganization(server: GitServerConfig, credentials: GitServerCredentials, config: CreateOrganizationConfig | CreateProjectConfig): Promise<any>;

  /**
   * Set default branch for a repository
   */
  setDefaultBranch(owner: string, repo: string, branchName: string, server: GitServerConfig, credentials: GitServerCredentials): Promise<void>;

  /**
   * List repositories in an organization/project
   */
  listRepositories(server: GitServerConfig, organizationOrProject: string, credentials?: GitServerCredentials): Promise<any[]>;
}

// Provider-specific interfaces
export interface GiteaProviderInterface extends GitProviderInterface {
  /**
   * Create organization in Gitea
   */
  createOrganization(server: GitServerConfig, credentials: GitServerCredentials, config: CreateOrganizationConfig): Promise<any>;
}

export interface BitbucketProviderInterface extends GitProviderInterface {
  /**
   * Create project in Bitbucket
   */
  createOrganization(server: GitServerConfig, credentials: GitServerCredentials, config: CreateProjectConfig): Promise<any>;
}