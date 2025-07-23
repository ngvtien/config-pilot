import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import os from 'os';
import { GitRepository, GitCredentials, GitOperationResult, GitDiffResult, GitAuthStatus, GitCommit, GitServerConfig, GitServerCredentials } from '../../shared/types/git-repository';
import { GitAuthService } from './git-auth-service';

export interface MergeOptions {
    noFf?: boolean;  // Force create merge commit even for fast-forward
    squash?: boolean; // Squash commits into single commit
}

export interface MergeConflictInfo {
    hasConflicts: boolean;
    conflicts?: string[];
}

export interface MergeRequestInfo {
    sourceBranch: string;
    targetBranch: string;
    title: string;
    description?: string;
}

export interface GitValidationResult {
    isValid: boolean;
    authStatus: GitAuthStatus;
    error?: string;
    repositoryInfo?: RepositoryInfo;
}

export interface RepositoryInfo {
    name: string;
    description?: string;
    defaultBranch: string;
    isPrivate: boolean;
    size: number;
    language?: string;
    topics: string[];
}

export interface CreateRepositoryConfig {
    name: string;
    description?: string;
    isPrivate: boolean;
    autoInit: boolean;
    gitignoreTemplate?: string;
    licenseTemplate?: string;
    provider: 'github' | 'gitlab' | 'gitea' | 'bitbucket';
    baseUrl?: string;
}

export interface GitOpsConfig {
    product: string;
    environments: string[];
    customers?: string[];
    generateApplicationSet: boolean;
    templatePath?: string;
}

export interface ApplicationSetConfig {
    name: string;
    namespace: string;
    project: string;
    repoUrl: string;
    path: string;
    targetRevision: string;
    environments: string[];
}

export interface CloneResult {
    success: boolean;
    localPath: string;
    error?: string;
}

export interface AuthResult {
    success: boolean;
    authStatus: GitAuthStatus;
    error?: string;
    requiresCredentials?: boolean;
}

/**
 * Service class for handling Git operations with secure credential management
 */
export class GitService {
    private git: SimpleGit;
    private credentialStore: any;
    private _gitAuthService?: GitAuthService;   // Make it optional and lazy-loaded

    constructor(workingDirectory?: string) {
        const options: Partial<SimpleGitOptions> = {
            baseDir: workingDirectory || process.cwd(),
            binary: 'git',
            maxConcurrentProcesses: 6,
            trimmed: false,
        };

        this.git = simpleGit(options);
        this.initializeCredentialStore();
    }

    /**
     * Get GitAuthService instance with lazy initialization
     */
    private get gitAuthService(): GitAuthService {
        if (!this._gitAuthService) {
            // Lazy import to avoid circular dependency
            const { GitAuthService } = require('./git-auth-service');
            this._gitAuthService = new GitAuthService();
        }
        return this._gitAuthService!;
    }

    /**
     * Initialize the credential store using dynamic import
     */
    private async initializeCredentialStore(): Promise<void> {
        const Store = (await import('electron-store')).default;
        this.credentialStore = new Store({ name: 'git-credentials' });
    }

    /**
     * Ensure credential store is initialized before use
     */
    private async ensureCredentialStore(): Promise<void> {
        if (!this.credentialStore) {
            await this.initializeCredentialStore();
        }
    }

    /**
     * Validate repository URL and check authentication status
     */
    async validateRepository(url: string, credentials?: GitCredentials): Promise<GitValidationResult> {
        try {
            // First, try to get repository info without cloning
            const repoInfo = await this.getRepositoryInfo(url, credentials);

            if (repoInfo) {
                return {
                    isValid: true,
                    authStatus: 'success',
                    repositoryInfo: repoInfo
                };
            }

            // If direct info fetch fails, try a lightweight clone test
            const authResult = await this.testConnection(url, credentials);

            return {
                isValid: authResult.success,
                authStatus: authResult.authStatus,
                error: authResult.error
            };
        } catch (error: any) {
            return {
                isValid: false,
                authStatus: 'failed',
                error: this.parseGitError(error.message)
            };
        }
    }

    /**
   * Test connection to repository without full clone
   */
    async testConnection(url: string, credentials?: GitCredentials): Promise<AuthResult> {
        try {
            let authenticatedUrl = url;

            if (credentials) {
                authenticatedUrl = this.buildAuthenticatedUrl(url, credentials);
            }

            // Use git ls-remote to test connection without cloning
            await this.git.listRemote([authenticatedUrl, 'HEAD']);

            return {
                success: true,
                authStatus: 'success'
            };
        } catch (error: any) {
            const errorMessage = error.message.toLowerCase();

            if (errorMessage.includes('authentication') || errorMessage.includes('permission denied')) {
                return {
                    success: false,
                    authStatus: 'failed',
                    error: 'Authentication failed. Please check your credentials.',
                    requiresCredentials: true
                };
            }

            if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
                return {
                    success: false,
                    authStatus: 'failed',
                    error: 'Repository not found. Please check the URL.'
                };
            }

            return {
                success: false,
                authStatus: 'failed',
                error: this.parseGitError(error.message)
            };
        }
    }

    /**
     * Create a new repository (delegates to provider-specific implementation)
     */
    async createRepository(config: CreateRepositoryConfig, credentials: GitCredentials): Promise<GitRepository> {
        try {
            switch (config.provider) {
                case 'gitea':
                    return await this.createGiteaRepository(config, credentials);
                case 'github':
                    return await this.createGitHubRepository(config, credentials);
                case 'gitlab':
                    return await this.createGitLabRepository(config, credentials);
                case 'bitbucket':
                    return await this.createBitbucketRepository(config, credentials);
                default:
                    throw new Error(`Provider ${config.provider} not supported`);
            }
        } catch (error: any) {
            throw new Error(`Failed to create repository: ${error.message}`);
        }
    }


    /**
     * Initialize GitOps folder structure in repository
     */
    async initializeGitOpsStructure(repoPath: string, config: GitOpsConfig): Promise<GitOperationResult> {
        try {
            const gitOpsPath = path.join(repoPath, 'gitops', config.product);

            // Create environment directories
            for (const env of config.environments) {
                const envPath = path.join(gitOpsPath, env);
                await fs.mkdir(envPath, { recursive: true });

                // Create customers directory for each environment
                const customersPath = path.join(envPath, 'customers');
                await fs.mkdir(customersPath, { recursive: true });

                // Create instances directory structure
                const instancesPath = path.join(customersPath, 'instances');
                await fs.mkdir(instancesPath, { recursive: true });
            }

            // Generate ApplicationSet if requested
            if (config.generateApplicationSet) {
                await this.generateApplicationSetTemplate(repoPath, config);
            }

            // Create default README
            const readmePath = path.join(gitOpsPath, 'README.md');
            const readmeContent = this.generateGitOpsReadme(config);
            await fs.writeFile(readmePath, readmeContent, 'utf-8');

            return {
                success: true,
                message: `GitOps structure initialized for product ${config.product}`,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                success: false,
                message: 'Failed to initialize GitOps structure',
                error: `Failed to initialize GitOps structure: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Generate ApplicationSet template for ArgoCD
     */
    async generateApplicationSetTemplate(repoPath: string, config: GitOpsConfig): Promise<void> {
        const appSetConfig: ApplicationSetConfig = {
            name: `${config.product}-appset`,
            namespace: 'argocd',
            project: 'default',
            repoUrl: '{{.repoUrl}}', // Will be replaced during deployment
            path: `gitops/${config.product}/{{.path.path}}`,
            targetRevision: 'HEAD',
            environments: config.environments
        };

        const applicationSet = {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'ApplicationSet',
            metadata: {
                name: appSetConfig.name,
                namespace: appSetConfig.namespace
            },
            spec: {
                generators: [
                    {
                        git: {
                            repoURL: appSetConfig.repoUrl,
                            revision: appSetConfig.targetRevision,
                            directories: [
                                {
                                    path: `gitops/${config.product}/*/customers/instances/*`,
                                    exclude: false
                                }
                            ]
                        }
                    }
                ],
                template: {
                    metadata: {
                        name: `${config.product}-{{.path.basename}}`,
                        labels: {
                            product: config.product,
                            environment: '{{.path[1]}}',
                            customer: '{{.path[3]}}',
                            instance: '{{.path.basename}}'
                        }
                    },
                    spec: {
                        project: appSetConfig.project,
                        source: {
                            repoURL: appSetConfig.repoUrl,
                            targetRevision: appSetConfig.targetRevision,
                            path: '{{.path.path}}',
                            helm: {
                                valueFiles: ['values.yaml']
                            }
                        },
                        destination: {
                            server: 'https://kubernetes.default.svc',
                            namespace: `${config.product}-{{.path[1]}}-{{.path[3]}}-{{.path.basename}}`
                        },
                        syncPolicy: {
                            automated: {
                                prune: true,
                                selfHeal: true
                            },
                            syncOptions: [
                                'CreateNamespace=true'
                            ]
                        }
                    }
                }
            }
        };

        const appSetPath = path.join(repoPath, 'gitops', config.product, 'applicationset.yaml');
        const yamlContent = yaml.dump(applicationSet, { indent: 2 });
        await fs.writeFile(appSetPath, yamlContent, 'utf-8');
    }

    /**
     * Get repository information from remote
     */
    async getRepositoryInfo(url: string, credentials?: GitCredentials): Promise<RepositoryInfo | null> {
        try {
            let authenticatedUrl = url;
            if (credentials) {
                authenticatedUrl = this.buildAuthenticatedUrl(url, credentials);
            }

            // Actually test if repository exists using git ls-remote
            await this.git.listRemote([authenticatedUrl, 'HEAD']);

            // If successful, extract repository info
            const urlParts = url.split('/');
            const repoName = urlParts[urlParts.length - 1].replace('.git', '');

            return {
                name: repoName,
                defaultBranch: 'main',
                isPrivate: false,
                size: 0,
                topics: []
            };
        } catch (error) {
            // Repository doesn't exist or is not accessible
            return null;
        }
    }

    /**
     * Discover repositories from a base URL
     */
    async discoverRepositories(baseUrl: string, credentials?: GitCredentials): Promise<GitRepository[]> {
        // This would need provider-specific implementation
        // For now, return empty array
        return [];
    }

    /**
     * Get diff between branches or commits
     */
    async getDiff(from: string, to: string): Promise<GitDiffResult> {
        try {
            const diffSummary = await this.git.diffSummary([from, to]);

            return {
                files: diffSummary.files.map(file => ({
                    path: file.file,
                    status: this.mapDiffStatus(file),
                    additions: ('insertions' in file) ? file.insertions || 0 : 0,
                    deletions: ('deletions' in file) ? file.deletions || 0 : 0,
                    changes: (('insertions' in file) ? file.insertions || 0 : 0) + (('deletions' in file) ? file.deletions || 0 : 0)
                })),
                totalAdditions: diffSummary.insertions || 0,
                totalDeletions: diffSummary.deletions || 0,
                totalChanges: (diffSummary.insertions || 0) + (diffSummary.deletions || 0)
            };
        } catch (error: any) {
            throw new Error(`Failed to get diff: ${error.message}`);
        }
    }

    /**
     * Get staged changes diff
     */
    async getStagedDiff(): Promise<GitDiffResult> {
        return this.getDiff('HEAD', '--staged');
    }

    /**
     * Compare two branches
     */
    async compareBranches(baseBranch: string, compareBranch: string): Promise<GitDiffResult> {
        return this.getDiff(baseBranch, compareBranch);
    }

    // Private helper methods

    /**
     * Parse Git error messages into user-friendly text
     */
    private parseGitError(errorMessage: string): string {
        const message = errorMessage.toLowerCase();

        if (message.includes('authentication failed')) {
            return 'Authentication failed. Please check your credentials.';
        }

        if (message.includes('permission denied')) {
            return 'Permission denied. You may not have access to this repository.';
        }

        if (message.includes('not found') || message.includes('does not exist')) {
            return 'Repository not found. Please check the URL.';
        }

        if (message.includes('network')) {
            return 'Network error. Please check your internet connection.';
        }

        return errorMessage;
    }

    /**
     * Map diff file status
     */
    private mapDiffStatus(file: any): 'added' | 'modified' | 'deleted' | 'renamed' {
        if (file.insertions > 0 && file.deletions === 0) return 'added';
        if (file.insertions === 0 && file.deletions > 0) return 'deleted';
        if (file.insertions > 0 && file.deletions > 0) return 'modified';
        return 'modified';
    }

    /**
     * Generate GitOps README content
     */
    private generateGitOpsReadme(config: GitOpsConfig): string {
        return `# GitOps Structure for ${config.product}

This directory contains the GitOps configuration for the ${config.product} product.

## Structure

\`\`\`
gitops/${config.product}/
├── applicationset.yaml          # ArgoCD ApplicationSet definition
${config.environments.map(env => `├── ${env}/                      # ${env} environment
│   └── customers/               # Customer-specific configurations
│       └── instances/           # Instance-specific configurations`).join('\n')}
└── README.md                    # This file
\`\`\`

## Environments

${config.environments.map(env => `- **${env}**: ${env.charAt(0).toUpperCase() + env.slice(1)} environment`).join('\n')}

## Usage

1. Create customer directories under each environment
2. Create instance directories under customer directories
3. Place Helm values.yaml files in instance directories
4. ArgoCD will automatically discover and deploy applications

## ApplicationSet

The ApplicationSet uses GitDirectoryGenerator to automatically discover applications based on the directory structure.
`;
    }

    // Provider-specific repository creation methods

    /**
     * Create repository on GitHub
     */
    private async createGitHubRepository(config: CreateRepositoryConfig, credentials: GitCredentials): Promise<GitRepository> {
        // Implementation would use GitHub API
        throw new Error('GitHub repository creation not implemented yet');
    }

    /**
     * Create repository on GitLab
     */
    private async createGitLabRepository(config: CreateRepositoryConfig, credentials: GitCredentials): Promise<GitRepository> {
        // Implementation would use GitLab API
        throw new Error('GitLab repository creation not implemented yet');
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
            return { success: true, message: `Repository cloned to ${localPath}`, timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: 'Failed to clone repository', error: error.message, timestamp: new Date().toISOString() };
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
                return { success: true, message: `Switched to branch ${branchName}`, timestamp: new Date().toISOString() };
            } else {
                // Create new branch from base branch
                await this.git.checkoutLocalBranch(branchName);
                return { success: true, message: `Created and switched to branch ${branchName}`, timestamp: new Date().toISOString() };
            }
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
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

            return { success: true, message: `Updated overrides for ${customer}/${env}`, timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: 'Failed to update repository', error: error.message, timestamp: new Date().toISOString() };
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

            return { success: true, message: `Committed ${filePath}`, timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: 'Failed to commit YAML', error: error.message, timestamp: new Date().toISOString() };
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
            return { success: true, message: `Pushed changes to ${remote}`, timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
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
            return { success: true, message: `Pulled changes from ${remote}`, timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Merge a branch into the current branch
     */
    async mergeBranch(branchName: string, options?: MergeOptions): Promise<GitOperationResult> {
        try {
            const mergeOptions: string[] = [];

            if (options?.noFf) {
                mergeOptions.push('--no-ff');
            }

            if (options?.squash) {
                mergeOptions.push('--squash');
            }

            await this.git.merge([branchName, ...mergeOptions]);
            return { success: true, message: `Successfully merged ${branchName}`, timestamp: new Date().toISOString() };

        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
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
                message: `Successfully merged ${customerBranch} into ${targetBranch}`,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Check if there are merge conflicts
     */
    async checkMergeConflicts(branchName: string): Promise<MergeConflictInfo> {
        try {
            // Try to merge without committing
            await this.git.raw(['merge', '--no-commit', '--no-ff', branchName]);

            // Check status after merge attempt
            const status = await this.git.status();

            if (status.conflicted.length > 0) {
                // Abort the merge since we were just checking
                await this.git.raw(['merge', '--abort']);

                return {
                    hasConflicts: true,
                    conflicts: status.conflicted
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

            return { success: true, message: 'Merge conflicts resolved successfully', timestamp: new Date().toISOString() };

        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Abort an ongoing merge
     */
    async abortMerge(): Promise<GitOperationResult> {
        try {
            await this.git.raw(['merge', '--abort']);
            return { success: true, message: 'Merge aborted successfully', timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
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
                sha: commit.hash,
                message: commit.message,
                author: {
                    name: commit.author_name,
                    email: commit.author_email,
                    date: commit.date
                },
                committer: {
                    name: commit.author_name,
                    email: commit.author_email,
                    date: commit.date
                },
                url: '' // Add appropriate URL if available
            }));
        } catch (error: any) {
            throw new Error(`Failed to get commit history: ${error.message}`);
        }
    }

    /**
     * Store git credentials securely
     */
    async storeCredentials(credentialId: string, credentials: GitCredentials): Promise<void> {
        await this.ensureCredentialStore();

        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption is not available on this system');
        }

        const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
        this.credentialStore.set(credentialId, encrypted.toString('base64'));
    }

    /**
     * Get stored git credentials
     */
    async getStoredCredentials(repoId: string): Promise<GitCredentials | null> {
        try {
            const encryptedData = this.credentialStore.get(repoId) as string;
            if (!encryptedData) {
                return null;
            }

            const decrypted = safeStorage.decryptString(Buffer.from(encryptedData, 'base64'));
            return JSON.parse(decrypted) as GitCredentials;
        } catch (error) {
            console.error('Failed to decrypt credentials:', error);
            return null;
        }
    }

    /**
     * Configure git credentials for operations
     */
    private async configureCredentials(credentialId: string): Promise<void> {
        const credentials = await this.getCredentialsForOperation(credentialId);
        if (credentials && credentials.username) {
            await this.git.addConfig('user.name', credentials.username);
        }
    }

    /**
     * Get credentials for git operations
     */
    async getCredentialsForOperation(credentialId: string): Promise<GitCredentials | null> {
        await this.ensureCredentialStore();

        try {
            if (!safeStorage.isEncryptionAvailable()) {
                return null;
            }

            const encryptedData = this.credentialStore.get(credentialId) as string;
            if (!encryptedData) {
                return null;
            }

            const decrypted = safeStorage.decryptString(Buffer.from(encryptedData, 'base64'));
            return JSON.parse(decrypted) as GitCredentials;
        } catch (error) {
            console.error('Failed to retrieve credentials:', error);
            return null;
        }
    }

    /**
     * Build authenticated URL for git operations
     */
    private buildAuthenticatedUrl(repoUrl: string, credentials: GitCredentials): string {
        try {
            if (credentials.method === 'token' && credentials.token) {
                const url = new URL(repoUrl);
                url.username = credentials.token;
                url.password = 'x-oauth-basic';
                return url.toString();
            } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
                const url = new URL(repoUrl);
                url.username = encodeURIComponent(credentials.username);
                url.password = encodeURIComponent(credentials.password);
                return url.toString();
            }
            return repoUrl;
        } catch {
            // If URL parsing fails, return original URL
            return repoUrl;
        }
    }

    /**
     * Prepare merge request information
     */
    async prepareMergeRequest(sourceBranch: string, targetBranch: string, title: string, description?: string): Promise<MergeRequestInfo> {
        try {
            // Validate that both branches exist
            const branches = await this.git.branch();
            const allBranches = [...branches.all];

            if (!allBranches.includes(sourceBranch)) {
                throw new Error(`Source branch '${sourceBranch}' does not exist`);
            }

            if (!allBranches.includes(targetBranch)) {
                throw new Error(`Target branch '${targetBranch}' does not exist`);
            }

            return {
                sourceBranch,
                targetBranch,
                title,
                description
            };
        } catch (error: any) {
            throw new Error(`Failed to prepare merge request: ${error.message}`);
        }
    }

    /**
     * Enhanced Gitea repository creation using provider implementation
     */
    private async createGiteaRepository(config: CreateRepositoryConfig, credentials: GitCredentials): Promise<GitRepository> {
        try {
            // Use server information from credentials if available
            let server: GitServerConfig | undefined;
            let serverCredentials: GitServerCredentials | undefined;

            if (credentials.url && credentials.repoId) {
                // Server info passed through credentials from UnifiedGitService
                server = {
                    id: credentials.repoId,
                    name: 'Auto-detected Gitea',
                    provider: 'gitea',
                    baseUrl: credentials.url,
                    description: 'Auto-detected server',
                    isDefault: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                serverCredentials = {
                    serverId: credentials.repoId,
                    method: credentials.method,
                    token: credentials.token,
                    username: credentials.username,
                    password: credentials.password,
                    sshKeyPath: credentials.sshKeyPath
                };
            } else {
                // Fallback to old logic for backward compatibility
                const servers = this.gitAuthService.getServers();
                server = servers.find(s => s.provider === 'gitea' &&
                    (config.baseUrl ? s.baseUrl === config.baseUrl : s.isDefault));

                if (!server) {
                    throw new Error('No Gitea server configuration found');
                }

                const creds = await this.gitAuthService.getServerCredentials(server.id);
                if (!creds) {
                    throw new Error('No credentials found for Gitea server');
                }
                serverCredentials = creds;
            }

            if (!server || !serverCredentials) {
                throw new Error('Server configuration or credentials not available');
            }

            const giteaProvider = new (await import('./providers/gitea-provider')).GiteaProvider();
            const repoData = await giteaProvider.createRepository(server, serverCredentials, config);

            return {
                id: `gitea-${Date.now()}`,
                name: config.name,
                url: repoData.clone_url || repoData.ssh_url,
                branch: 'main',
                description: config.description || '',
                permissions: { developer: 'dev-only', devops: 'full', operations: 'read-only' },
                serverId: server.id,
                authStatus: 'success',
                lastAuthCheck: new Date().toISOString()
            };

        } catch (error: any) {
            throw new Error(`Gitea repository creation failed: ${error.message}`);
        }
    }
    /**
     * Enhanced Bitbucket repository creation using provider implementation
     */
    private async createBitbucketRepository(config: CreateRepositoryConfig, credentials: GitCredentials): Promise<GitRepository> {
        try {
            // Use server information from credentials if available
            let server: GitServerConfig | undefined;
            let serverCredentials: GitServerCredentials | undefined;

            if (credentials.url && credentials.repoId) {
                // Server info passed through credentials from UnifiedGitService
                server = {
                    id: credentials.repoId,
                    name: 'Auto-detected Bitbucket',
                    provider: 'bitbucket',
                    baseUrl: credentials.url,
                    description: 'Auto-detected server',
                    isDefault: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                serverCredentials = {
                    serverId: credentials.repoId,
                    method: credentials.method,
                    token: credentials.token,
                    username: credentials.username,
                    password: credentials.password,
                    sshKeyPath: credentials.sshKeyPath
                };
            } else {
                // Fallback to old logic for backward compatibility
                const servers = this.gitAuthService.getServers();
                server = servers.find(s => s.provider === 'bitbucket' &&
                    (config.baseUrl ? s.baseUrl === config.baseUrl : s.isDefault));

                if (!server) {
                    throw new Error('No Bitbucket server configuration found');
                }

                const creds = await this.gitAuthService.getServerCredentials(server.id);
                if (!creds) {
                    throw new Error('No credentials found for Bitbucket server');
                }
                serverCredentials = creds;
            }

            if (!server || !serverCredentials) {
                throw new Error('Server configuration or credentials not available');
            }

            const bitbucketProvider = new (await import('./providers/bitbucket-provider')).BitbucketProvider();
            const repoData = await bitbucketProvider.createRepository(server, serverCredentials, config);

            return {
                id: `bitbucket-${Date.now()}`,
                name: config.name,
                url: repoData.links?.clone?.find((link: any) => link.name === 'http')?.href || '',
                branch: 'main',
                description: config.description || '',
                permissions: { developer: 'dev-only', devops: 'full', operations: 'read-only' },
                serverId: server.id,
                authStatus: 'success',
                lastAuthCheck: new Date().toISOString()
            };

        } catch (error: any) {
            throw new Error(`Bitbucket repository creation failed: ${error.message}`);
        }
    }

    /**
     * Create environment branches with GitOps structure
     */
    async createEnvironmentBranches(repositoryUrl: string, environments: string[]): Promise<{ success: boolean; createdBranches: string[]; errors: any[] }> {
        const createdBranches: string[] = [];
        const errors: any[] = [];

        try {
            // Clone repository to temporary location
            const tempDir = path.join(os.tmpdir(), `gitops-setup-${Date.now()}`);
            await this.cloneRepository(repositoryUrl, tempDir);

            // Switch to temp directory
            const tempGit = simpleGit(tempDir);

            for (const env of environments) {
                try {
                    // Create and checkout new branch
                    await tempGit.checkoutLocalBranch(env);

                    // Create GitOps directory structure
                    const gitopsDir = path.join(tempDir, 'gitops');
                    const envDir = path.join(gitopsDir, env);
                    const customersDir = path.join(envDir, 'customers');

                    await fs.mkdir(customersDir, { recursive: true });

                    // Create default files
                    const defaultFiles = {
                        'customers.yaml': `# Customer configurations for ${env} environment\ncustomers: []\n`,
                        'appset.yaml': `# ApplicationSet template for ${env} environment\napiVersion: argoproj.io/v1alpha1\nkind: ApplicationSet\n`,
                        'values.yaml': `# Default values for ${env} environment\nenvironment: ${env}\n`
                    };

                    for (const [filename, content] of Object.entries(defaultFiles)) {
                        await fs.writeFile(path.join(envDir, filename), content);
                    }

                    // Commit changes
                    await tempGit.add('.');
                    await tempGit.commit(`Initialize ${env} environment structure`);

                    // Push branch
                    await tempGit.push('origin', env);

                    createdBranches.push(env);
                } catch (error: any) {
                    console.error(`Failed to create ${env} branch:`, error);
                    errors.push({ environment: env, error: error.message });
                }
            }

            // Cleanup temp directory
            await fs.rm(tempDir, { recursive: true, force: true });

            return {
                success: createdBranches.length > 0,
                createdBranches,
                errors
            };

        } catch (error: any) {
            return {
                success: false,
                createdBranches,
                errors: [{ error: error.message }]
            };
        }
    }
}

// Export singleton instance
export const gitService = new GitService();