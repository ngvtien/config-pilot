import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { CredentialManagerService } from '../credential-manager.service';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GitRepository {
    url: string;
    branch: string;
    localPath: string;
}

export interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: Date;
}

export interface GitOperationResult {
    success: boolean;
    message?: string;
    error?: string;
}

export interface GitCredentials {
    username: string;
    password: string; // This could be a token
}

/**
 * Service class for handling Git operations with secure credential management
 */
export class GitService {
    private git: SimpleGit;
    private credentialManager: CredentialManagerService;

    constructor(workingDirectory?: string) {
        const options: Partial<SimpleGitOptions> = {
            baseDir: workingDirectory || process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,
            trimmed: false,
        };

        this.git = simpleGit(options);
        this.credentialManager = new CredentialManagerService();
    }

    /**
     * Clone a repository with secure credential handling
     */
    async cloneRepository(repoUrl: string, localPath: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            let authenticatedUrl = repoUrl;

            // If credentials are provided, use them for authentication
            if (credentialId) {
                const credentials = await this.getCredentialsForOperation(credentialId);
                if (credentials) {
                    authenticatedUrl = this.buildAuthenticatedUrl(repoUrl, credentials);
                }
            }

            await this.git.clone(authenticatedUrl, localPath);
            return { success: true, message: `Repository cloned to ${localPath}` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Checkout or create a customer branch
     */
    async checkoutCustomerBranch(customer: string, env: string, baseBranch: string = 'main'): Promise<GitOperationResult> {
        try {
            const branchName = `customer/${customer}/${env}`;

            // Check if branch exists locally
            const branches = await this.git.branchLocal();
            const branchExists = branches.all.includes(branchName);

            if (branchExists) {
                // Switch to existing branch
                await this.git.checkout(branchName);
                return { success: true, message: `Switched to branch ${branchName}` };
            } else {
                // Create new branch from base branch
                await this.git.checkoutLocalBranch(branchName);
                return { success: true, message: `Created and switched to branch ${branchName}` };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get customer-specific overrides from the current branch
     */
    async getCustomerOverrides(customer: string, env: string): Promise<any> {
        try {
            const overridesPath = path.join('customers', customer, env, 'values.yaml');

            // Check if file exists
            try {
                await fs.access(overridesPath);
                const content = await fs.readFile(overridesPath, 'utf-8');
                return { success: true, content };
            } catch {
                // File doesn't exist, return empty overrides
                return { success: true, content: '# Customer overrides\n' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Update customer overrides and commit changes
     */
    async updateCustomerOverrides(customer: string, env: string, values: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            const overridesPath = path.join('customers', customer, env, 'values.yaml');
            const dirPath = path.dirname(overridesPath);

            // Ensure directory exists
            await fs.mkdir(dirPath, { recursive: true });

            // Write the values file
            await fs.writeFile(overridesPath, values, 'utf-8');

            // Stage the file
            await this.git.add(overridesPath);

            // Commit the changes
            const commitMessage = `Update ${customer}/${env} configuration`;
            await this.git.commit(commitMessage);

            return { success: true, message: `Updated overrides for ${customer}/${env}` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Commit YAML content to git repository
     */
    async commitYamlToGit(filePath: string, content: string, commitMessage: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            // Write the YAML content to file
            await fs.writeFile(filePath, content, 'utf-8');

            // Stage the file
            await this.git.add(filePath);

            // Commit the changes
            await this.git.commit(commitMessage);

            return { success: true, message: `Committed ${filePath}` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Push changes to remote repository
     */
    async pushChanges(remote: string = 'origin', branch?: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            if (credentialId) {
                // Update git credentials before pushing
                await this.configureCredentials(credentialId);
            }

            await this.git.push(remote, branch);
            return { success: true, message: `Pushed changes to ${remote}` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Pull latest changes from remote
     */
    async pullChanges(remote: string = 'origin', branch?: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            if (credentialId) {
                await this.configureCredentials(credentialId);
            }

            await this.git.pull(remote, branch);
            return { success: true, message: `Pulled changes from ${remote}` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current repository status
     */
    async getStatus() {
        try {
            const status = await this.git.status();
            return { success: true, status };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get commit history
     */
    async getCommitHistory(maxCount: number = 10): Promise<GitCommit[]> {
        try {
            const log = await this.git.log({ maxCount });
            return log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author_name,
                date: new Date(commit.date)
            }));
        } catch (error: any) {
            throw new Error(`Failed to get commit history: ${error.message}`);
        }
    }

    /**
     * Configure git credentials for operations
     */
    private async configureCredentials(credentialId: string): Promise<void> {
        const credentials = await this.getCredentialsForOperation(credentialId);
        if (credentials) {
            // Configure git with credentials (this is a simplified approach)
            // In production, you might want to use credential helpers or SSH keys
            await this.git.addConfig('user.name', credentials.username);
        }
    }

    /**
     * Get credentials for git operations
     */
    private async getCredentialsForOperation(credentialId: string): Promise<GitCredentials | null> {
        try {
            // Use the existing credential manager to get credentials
            await this.credentialManager.useCredentialsForGitOperation(credentialId);

            // This is a placeholder - you'll need to implement actual credential retrieval
            // based on your credential storage system
            return null; // Replace with actual credential retrieval
        } catch (error) {
            console.error('Failed to get credentials:', error);
            return null;
        }
    }

    /**
     * Build authenticated URL for git operations
     */
    private buildAuthenticatedUrl(repoUrl: string, credentials: GitCredentials): string {
        try {
            const url = new URL(repoUrl);
            url.username = encodeURIComponent(credentials.username);
            url.password = encodeURIComponent(credentials.password);
            return url.toString();
        } catch {
            // If URL parsing fails, return original URL
            return repoUrl;
        }
    }

    /**
     * Merge a branch into the current branch
     */
    async mergeBranch(branchName: string, options?: { noFf?: boolean, squash?: boolean }): Promise<GitOperationResult> {
        try {
            const mergeOptions: string[] = [];

            if (options?.noFf) {
                mergeOptions.push('--no-ff');
            }

            if (options?.squash) {
                mergeOptions.push('--squash');
            }

            await this.git.merge([branchName, ...mergeOptions]);
            return { success: true, message: `Successfully merged ${branchName}` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Merge customer branch into target branch (e.g., staging, production)
     */
    async mergeCustomerBranch(customer: string, env: string, targetBranch: string): Promise<GitOperationResult> {
        try {
            const customerBranch = `customer/${customer}/${env}`;

            // First, checkout the target branch
            await this.git.checkout(targetBranch);

            // Pull latest changes from remote
            await this.git.pull('origin', targetBranch);

            // Merge the customer branch with --no-ff to preserve branch history
            await this.git.merge([customerBranch, '--no-ff']);

            return {
                success: true,
                message: `Successfully merged ${customerBranch} into ${targetBranch}`
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if there are merge conflicts
     */
    async checkMergeConflicts(branchName: string): Promise<{ hasConflicts: boolean, conflicts?: string[] }> {
        try {
            // Perform a dry-run merge to check for conflicts
            const status = await this.git.status();

            // Try to merge without committing
            await this.git.raw(['merge', '--no-commit', '--no-ff', branchName]);

            // Check status after merge attempt
            const postMergeStatus = await this.git.status();

            if (postMergeStatus.conflicted.length > 0) {
                // Abort the merge since we were just checking
                await this.git.raw(['merge', '--abort']);

                return {
                    hasConflicts: true,
                    conflicts: postMergeStatus.conflicted
                };
            }

            // Abort the merge since we were just checking
            await this.git.raw(['merge', '--abort']);

            return { hasConflicts: false };
        } catch (error: any) {
            // If merge fails, there are likely conflicts
            try {
                await this.git.raw(['merge', '--abort']);
            } catch {
                // Ignore abort errors
            }

            return {
                hasConflicts: true,
                conflicts: [error.message]
            };
        }
    }

    /**
     * Resolve merge conflicts and continue merge
     */
    async resolveMergeConflicts(resolvedFiles: string[]): Promise<GitOperationResult> {
        try {
            // Add resolved files
            for (const file of resolvedFiles) {
                await this.git.add(file);
            }

            // Continue the merge
            await this.git.raw(['commit', '--no-edit']);

            return { success: true, message: 'Merge conflicts resolved successfully' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Abort an ongoing merge
     */
    async abortMerge(): Promise<GitOperationResult> {
        try {
            await this.git.raw(['merge', '--abort']);
            return { success: true, message: 'Merge aborted successfully' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a merge request/pull request workflow
     */
    async prepareMergeRequest(sourceBranch: string, targetBranch: string, title: string, description?: string): Promise<GitOperationResult> {
        try {
            // Ensure we're on the source branch
            await this.git.checkout(sourceBranch);

            // Push the source branch to remote
            await this.git.push('origin', sourceBranch);

            // This would typically integrate with GitHub/GitLab APIs
            // For now, we'll just return success with instructions
            return {
                success: true,
                message: `Branch ${sourceBranch} pushed. Create PR: ${sourceBranch} → ${targetBranch}\nTitle: ${title}\nDescription: ${description || 'No description provided'}`
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
export const gitService = new GitService();