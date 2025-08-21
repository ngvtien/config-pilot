import { GitCredentials, GitOperationResult, GitDiffResult, GitCommit, RepositoryInfo } from '../../../shared/types/git-repository';

export interface GitAdapterInterface {
  /**
   * Clone a repository
   */
  clone(url: string, localPath: string, credentials?: GitCredentials): Promise<GitOperationResult>;

  /**
   * Test connection to repository
   */
  testConnection(url: string, credentials?: GitCredentials): Promise<{ success: boolean; error?: string }>;

  /**
   * Get repository information
   */
  getRepositoryInfo(url: string, credentials?: GitCredentials): Promise<RepositoryInfo | null>;

  /**
   * List remote references
   */
  listRemote(url: string, credentials?: GitCredentials): Promise<string[]>;

  /**
   * Get diff between branches or commits
   */
  getDiff(from: string, to: string, workingDir: string): Promise<GitDiffResult>;

  /**
   * Get staged changes diff
   */
  getStagedDiff(workingDir: string): Promise<GitDiffResult>;

  /**
   * Get local branches
   */
  getBranches(workingDir: string): Promise<string[]>;

  /**
   * Checkout branch
   */
  checkout(branchName: string, workingDir: string): Promise<GitOperationResult>;

  /**
   * Create and checkout new branch
   */
  checkoutNewBranch(branchName: string, workingDir: string): Promise<GitOperationResult>;

  /**
   * Add files to staging
   */
  add(filePaths: string | string[], workingDir: string): Promise<GitOperationResult>;

  /**
   * Commit changes
   */
  commit(message: string, workingDir: string): Promise<GitOperationResult>;

  /**
   * Push changes
   */
  push(workingDir: string, credentials?: GitCredentials): Promise<GitOperationResult>;

  /**
   * Pull changes
   */
  pull(workingDir: string, credentials?: GitCredentials): Promise<GitOperationResult>;
}