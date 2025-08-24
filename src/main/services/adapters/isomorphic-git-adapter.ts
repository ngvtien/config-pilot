import * as git from 'isomorphic-git';
import * as fs from 'fs';
import * as path from 'path';
import { GitAdapterInterface } from './git-adapter-interface';
import { GitCredentials, GitOperationResult, GitDiffResult, RepositoryInfo } from '../../../shared/types/git-repository';

/**
 * Isomorphic Git adapter implementation
 * Provides cross-platform Git operations using isomorphic-git
 */
export class IsomorphicGitAdapter implements GitAdapterInterface {

  /**
   * Build authentication object for isomorphic-git
   */
  private buildAuth(credentials?: GitCredentials): any {
    if (!credentials) return undefined;

    switch (credentials.method) {
      case 'token':
        return {
          username: credentials.token,
          password: 'x-oauth-basic'
        };
      case 'credentials':
        return {
          username: credentials.username,
          password: credentials.password
        };
      default:
        return undefined;
    }
  }

  /**
   * Clone a repository
   */
  async clone(url: string, localPath: string, credentials?: GitCredentials): Promise<GitOperationResult> {
    try {
      await git.clone({
        fs,
        http: require('isomorphic-git/http/node'),
        dir: localPath,
        url,
        onAuth: () => this.buildAuth(credentials),
        singleBranch: false,
        depth: undefined
      });

      return {
        success: true,
        message: `Repository cloned to ${localPath}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to clone repository',
        error: this.parseGitError(error.message),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test connection to repository
   */
  async testConnection(url: string, credentials?: GitCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      await git.getRemoteInfo({
        http: require('isomorphic-git/http/node'),
        url,
        onAuth: () => this.buildAuth(credentials)
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.parseGitError(error.message)
      };
    }
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(url: string, credentials?: GitCredentials): Promise<RepositoryInfo | null> {
    try {
      const info = await git.getRemoteInfo({
        http: require('isomorphic-git/http/node'),
        url,
        onAuth: () => this.buildAuth(credentials)
      });

      // Extract repository name from URL
      const urlParts = url.split('/');
      const repoName = urlParts[urlParts.length - 1].replace('.git', '');

      return {
        name: repoName,
        defaultBranch: info.refs?.HEAD?.target || 'main',
        isPrivate: false, // Cannot determine from remote info
        size: 0, // Not available from isomorphic-git
        topics: [] // Not available from isomorphic-git
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List remote references
   */
  async listRemote(url: string, credentials?: GitCredentials): Promise<string[]> {
    try {
      const info = await git.getRemoteInfo({
        http: require('isomorphic-git/http/node'),
        url,
        onAuth: () => this.buildAuth(credentials)
      });

      return Object.keys(info.refs || {});
    } catch (error) {
      return [];
    }
  }

  /**
   * Get diff between branches or commits
   */
  async getDiff(from: string, to: string, workingDir: string): Promise<GitDiffResult> {
    try {
      // For now, return a basic diff structure
      // isomorphic-git doesn't have built-in diff functionality like simple-git
      // This would need to be implemented using git.walk or other methods
      return {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        totalChanges: 0
      };
    } catch (error: any) {
      throw new Error(`Failed to get diff: ${error.message}`);
    }
  }

  /**
   * Get staged changes diff
   */
  async getStagedDiff(workingDir: string): Promise<GitDiffResult> {
    // Similar to getDiff, this would need custom implementation
    return {
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      totalChanges: 0
    };
  }

  /**
   * Get local branches
   */
  async getBranches(workingDir: string): Promise<string[]> {
    try {
      const branches = await git.listBranches({
        fs,
        dir: workingDir
      });

      return branches;
    } catch (error) {
      return [];
    }
  }

  /**
   * Checkout branch
   */
  async checkout(branchName: string, workingDir: string): Promise<GitOperationResult> {
    try {
      await git.checkout({
        fs,
        dir: workingDir,
        ref: branchName
      });

      return {
        success: true,
        message: `Switched to branch ${branchName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to checkout branch',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create and checkout new branch
   */
  async checkoutNewBranch(branchName: string, workingDir: string): Promise<GitOperationResult> {
    try {
      await git.branch({
        fs,
        dir: workingDir,
        ref: branchName
      });

      await git.checkout({
        fs,
        dir: workingDir,
        ref: branchName
      });

      return {
        success: true,
        message: `Created and switched to branch ${branchName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to create branch',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Add files to staging
   */
  async add(filePaths: string | string[], workingDir: string): Promise<GitOperationResult> {
    try {
      const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

      for (const filePath of paths) {
        await git.add({
          fs,
          dir: workingDir,
          filepath: filePath
        });
      }

      return {
        success: true,
        message: `Added ${paths.length} file(s) to staging`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to add files',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Commit changes
   */
  async commit(message: string, workingDir: string): Promise<GitOperationResult> {
    try {
      const sha = await git.commit({
        fs,
        dir: workingDir,
        message,
        author: {
          name: 'ConfigPilot',
          email: 'configpilot@example.com'
        }
      });

      return {
        success: true,
        message: `Committed changes: ${sha}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to commit changes',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Push changes
   */
  async push(workingDir: string, credentials?: GitCredentials, remote: string = 'origin', branch?: string, force: boolean = false): Promise<GitOperationResult> {
    try {
      const pushOptions: any = {
        fs,
        http: require('isomorphic-git/http/node'),
        dir: workingDir,
        remote: remote,
        onAuth: () => this.buildAuth(credentials)
      };

      if (branch) {
        pushOptions.ref = branch;
      }

      if (force) {
        pushOptions.force = true;
      }

      await git.push(pushOptions);

      return {
        success: true,
        message: 'Changes pushed successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to push changes',
        error: this.parseGitError(error.message),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Pull changes
   */
  async pull(workingDir: string, credentials?: GitCredentials): Promise<GitOperationResult> {
    try {
      await git.pull({
        fs,
        http: require('isomorphic-git/http/node'),
        dir: workingDir,
        onAuth: () => this.buildAuth(credentials),
        author: {
          name: 'ConfigPilot',
          email: 'configpilot@example.com'
        }
      });

      return {
        success: true,
        message: 'Changes pulled successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to pull changes',
        error: this.parseGitError(error.message),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * List all branches (local and remote)
   */
  async listBranches(workingDir: string): Promise<string[]> {
    try {
      const localBranches = await git.listBranches({
        fs,
        dir: workingDir
      });

      const remoteBranches = await git.listBranches({
        fs,
        dir: workingDir,
        remote: 'origin'
      });

      return [...new Set([...localBranches, ...remoteBranches])];
    } catch (error) {
      return [];
    }
  }

  /**
   * Checkout existing branch
   */
  async checkoutBranch(branchName: string, workingDir: string): Promise<GitOperationResult> {
    return this.checkout(branchName, workingDir);
  }

  /**
   * Parse Git error messages into user-friendly text
   */
  private parseGitError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes('authentication') || message.includes('401')) {
      return 'Authentication failed. Please check your credentials.';
    }

    if (message.includes('permission denied') || message.includes('403')) {
      return 'Permission denied. You may not have access to this repository.';
    }

    if (message.includes('not found') || message.includes('404')) {
      return 'Repository not found. Please check the URL.';
    }

    if (message.includes('network') || message.includes('timeout')) {
      return 'Network error. Please check your internet connection.';
    }

    return errorMessage;
  }

  /**
   * Initialize a new git repository
   */
  async init(workingDir: string): Promise<GitOperationResult> {
    try {
      await git.init({
        fs,
        dir: workingDir,
        defaultBranch: 'dev'
      });

      return {
        success: true,
        message: 'Repository initialized successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to initialize repository',
        error: this.parseGitError(error.message),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Add a remote to the repository
   */
  async addRemote(name: string, url: string, workingDir: string): Promise<GitOperationResult> {
    try {
      await git.addRemote({
        fs,
        dir: workingDir,
        remote: name,
        url: url
      });

      return {
        success: true,
        message: `Remote ${name} added successfully`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to add remote',
        error: this.parseGitError(error.message),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get repository status (modified, added, deleted files)
   */
  async status(workingDir: string): Promise<GitOperationResult> {
    try {
      const statusMatrix = await git.statusMatrix({
        fs,
        dir: workingDir
      });

      // Filter for files that have changes (not just unmodified files)
      const changedFiles = statusMatrix.filter(([filepath, headStatus, workdirStatus, stageStatus]) => {
        // headStatus: 0 = absent, 1 = present
        // workdirStatus: 0 = absent, 1 = present, 2 = modified
        // stageStatus: 0 = absent, 1 = present, 2 = modified, 3 = added
        return workdirStatus !== headStatus || stageStatus !== headStatus;
      });

      return {
        success: true,
        message: `Found ${changedFiles.length} changed files`,
        data: changedFiles.map(([filepath]) => filepath),
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to get repository status',
        error: this.parseGitError(error.message),
        timestamp: new Date().toISOString()
      };
    }
  }
}