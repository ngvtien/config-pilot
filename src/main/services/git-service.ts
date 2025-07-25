import { safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import os from 'os';
import { GitRepository, GitCredentials, GitOperationResult, GitDiffResult, GitAuthStatus, GitCommit, GitServerConfig, GitServerCredentials, GitServerValidationResult, GitValidationResult, RepositoryInfo } from '../../shared/types/git-repository';
//import { GitAuthService } from './git-auth-service';

import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { GiteaProvider } from './providers/gitea-provider';
import { BitbucketProvider } from './providers/bitbucket-provider';
import Store from 'electron-store';
import gitUrlParse from 'git-url-parse';

interface GitStoreSchema {
    servers: GitServerConfig[];
    repositories: GitRepository[];
    credentials: Record<string, string>; // serverId -> encrypted credentials
}

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

export interface CreateRepositoryConfig {
    name: string;
    description?: string;
    isPrivate: boolean;
    autoInit: boolean;
    gitignoreTemplate?: string;
    licenseTemplate?: string;
    provider: 'github' | 'gitlab' | 'gitea' | 'bitbucket';
    baseUrl?: string;
    url?: string; // Add this field for git-url-parse
    projectKey?: string; // For Bitbucket projects
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
    private store: any; //Store<GitStoreSchema>;
    //private credentialStore: any;
    //private _gitAuthService?: GitAuthService;   // Make it optional and lazy-loaded
    private giteaProvider = new GiteaProvider();
    private bitbucketProvider = new BitbucketProvider();

    constructor(workingDirectory?: string) {
        this.git = simpleGit({ baseDir: workingDirectory || process.cwd() });
        this.store = new Store<GitStoreSchema>({
            name: 'git-unified',
            defaults: { servers: [], repositories: [], credentials: {} }
        });
    }

    // Server Management
    getServers(): GitServerConfig[] {
        return this.store.get('servers', []);
    }

    saveServer(server: Omit<GitServerConfig, 'id' | 'createdAt' | 'updatedAt'>): GitServerConfig {
        const servers = this.getServers();

        // Use baseUrl as unique identifier - pragmatic and logical
        const serverId = server.baseUrl.replace(/[^a-zA-Z0-9]/g, '-');

        // Check if server already exists
        const existingIndex = servers.findIndex(s => s.baseUrl === server.baseUrl);

        if (existingIndex >= 0) {
            // Update existing server, preserving provider
            const updatedServer = {
                ...servers[existingIndex],
                ...server,
                id: servers[existingIndex].id,
                updatedAt: new Date().toISOString()
            };
            servers[existingIndex] = updatedServer;
            this.store.set('servers', servers);
            return updatedServer;
        }

        // Create new server
        const newServer: GitServerConfig = {
            ...server,
            id: serverId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        servers.push(newServer);
        this.store.set('servers', servers);
        return newServer;
    }


    // Repository Management
    getRepositories(): GitRepository[] {
        return this.store.get('repositories', []);
    }

    saveRepository(repository: GitRepository): GitRepository {
        const repositories = this.getRepositories();
        const existingIndex = repositories.findIndex(r => r.id === repository.id);
        if (existingIndex >= 0) {
            repositories[existingIndex] = repository;
        } else {
            repositories.push(repository);
        }
        this.store.set('repositories', repositories);
        return repository;
    }

    // Provider Routing
    private getProviderForUrl(url: string): { provider: 'gitea' | 'bitbucket', instance: GiteaProvider | BitbucketProvider } {
        const parsed = gitUrlParse(url);
        const baseUrl = parsed.port
            ? `${parsed.protocol}://${parsed.resource}:${parsed.port}`
            : `${parsed.protocol}://${parsed.resource}`;

        // 🔍 DEBUG: Log what we're looking for
        console.log('🔍 Looking for server with baseUrl:', baseUrl);

        const allServers = this.getServers();
        console.log('📋 All stored servers:', allServers.map(s => ({
            name: s.name,
            baseUrl: s.baseUrl,
            provider: s.provider,
            id: s.id
        })));

        const server = allServers.find(s => s.baseUrl === baseUrl);
        if (!server) throw new Error(`No server configured for ${baseUrl}`);

        // 🔍 DEBUG: Log what we found
        console.log('✅ Found server:', {
            name: server.name,
            baseUrl: server.baseUrl,
            provider: server.provider,
            id: server.id
        });

        switch (server.provider) {
            case 'gitea':
                return { provider: 'gitea', instance: this.giteaProvider };
            case 'bitbucket':
                return { provider: 'bitbucket', instance: this.bitbucketProvider };
            default:
                console.error('❌ Invalid provider found:', server.provider);
                throw new Error(`Unsupported provider: ${server.provider}`);
        }
    }

    /**
     * Get server configuration and credentials for a repository URL
     * @param url Repository URL
     * @param serverId Optional server ID to use instead of URL parsing
     * @returns Server configuration and credentials
     */
    private getServerAndCredentials(url: string, serverId?: string): { server: GitServerConfig, credentials: GitServerCredentials } {
        let server: GitServerConfig | undefined;

        if (serverId) {
            server = this.getServers().find(s => s.id === serverId);
            if (!server) throw new Error(`No server configured with ID: ${serverId}`);
        } else {
            const parsed = gitUrlParse(url);
            const baseUrl = parsed.port
                ? `${parsed.protocol}://${parsed.resource}:${parsed.port}`
                : `${parsed.protocol}://${parsed.resource}`;
            server = this.getServers().find(s => s.baseUrl === baseUrl);
            if (!server) throw new Error(`No server configured for ${baseUrl}`);
        }

        // ✅ FIXED: Use the same key format as credential manager
        const credentialKey = `configpilot-git-server:${server.id}`;

        // ✅ FIXED: Use the imported Store class instead of requiring it dynamically
        const credentialStore = new Store({ name: 'secure-credentials' }) as any;
        const encryptedCreds = credentialStore.get(credentialKey);

        if (!encryptedCreds) throw new Error(`No credentials for server ${server.id}`);

        // ✅ FIXED: Decrypt using safeStorage (already imported at the top)
        const decrypted = safeStorage.decryptString(Buffer.from(encryptedCreds, 'base64'));
        const credentials: GitServerCredentials = JSON.parse(decrypted);

        return { server, credentials };
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
                    repositoryInfo: repoInfo,
                    canConnect: true,
                    requiresAuth: false
                };
            }

            // If direct info fetch fails, try a lightweight clone test
            const authResult = await this.testConnection(url, credentials);

            return {
                isValid: authResult.success,
                authStatus: authResult.authStatus,
                error: authResult.error,
                canConnect: authResult.success,
                requiresAuth: authResult.requiresCredentials || false
            };
        } catch (error: any) {
            return {
                isValid: false,
                authStatus: 'failed',
                error: this.parseGitError(error.message),
                canConnect: false,
                requiresAuth: true
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

    // Core Operations    
    /**
     * Create a new repository using the specified provider
     * @param config Repository configuration
     * @param serverId Optional server ID to use for authentication
     * @returns Created repository information
     */
    async createRepository(config: CreateRepositoryConfig, serverId?: string): Promise<GitRepository> {
        const { server, credentials } = this.getServerAndCredentials(config.url!, serverId);
        const { instance } = this.getProviderForUrl(config.url!);

        return await instance.createRepository(server, credentials, config);
    }

    async setDefaultBranch(repositoryUrl: string, branchName: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { server, credentials } = this.getServerAndCredentials(repositoryUrl);
            const { provider, instance } = this.getProviderForUrl(repositoryUrl);
            const parsed = gitUrlParse(repositoryUrl);

            if (provider === 'gitea') {
                await (instance as GiteaProvider).setDefaultBranch(parsed.owner, parsed.name, branchName, server, credentials);
            } else if (provider === 'bitbucket') {
                await (instance as BitbucketProvider).setDefaultBranch(parsed.owner, parsed.name, branchName, server, credentials);
            }

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
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
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption is not available on this system');
        }

        const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
        this.store.set(credentialId, encrypted.toString('base64'));
    }

    /**
     * Get stored git credentials
     */
    async getStoredCredentials(repoId: string): Promise<GitCredentials | null> {
        try {
            const encryptedData = this.store.get(repoId) as string;
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
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                return null;
            }

            const encryptedData = this.store.get(credentialId) as string;
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

    /**
     * Authenticate with a Git server
     */
    async authenticateServer(serverId: string, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
        try {
            // Store credentials
            const credentialsKey = `credentials_${serverId}`;
            const encryptedCredentials = safeStorage.encryptString(JSON.stringify(credentials));
            this.store.set(credentialsKey, encryptedCredentials.toString('base64'));

            // Get server config
            const server = this.getServers().find(s => s.id === serverId);
            if (!server) {
                return {
                    isValid: false,
                    authStatus: 'failed',
                    error: 'Server not found',
                    canConnect: false
                };
            }

            // Get appropriate provider
            const provider = this.getProviderForUrl(server.baseUrl);
            if (!provider) {
                return {
                    isValid: false,
                    authStatus: 'failed',
                    error: 'Unsupported server provider',
                    canConnect: false
                };
            }

            // Test authentication
            const result = await provider.instance.testAuthentication(server, credentials);

            return result;
        } catch (error: any) {
            return {
                isValid: false,
                authStatus: 'failed',
                error: error.message,
                canConnect: false
            };
        }
    }

    /**
     * Validate repository access
     */
    async validateRepositoryAccess(repositoryUrl: string, serverId?: string): Promise<GitValidationResult> {
        try {
            // Parse repository URL
            const parsed = gitUrlParse(repositoryUrl);

            // Find server and credentials
            const { server, credentials } = await this.getServerAndCredentials(repositoryUrl, serverId);

            if (!server || !credentials) {
                return {
                    isValid: false,
                    authStatus: 'failed',
                    error: 'No server configuration or credentials found',
                    canConnect: false,
                    requiresAuth: true
                };
            }

            // Get appropriate provider
            const provider = this.getProviderForUrl(server.baseUrl);
            if (!provider) {
                return {
                    isValid: false,
                    authStatus: 'failed',
                    error: 'Unsupported server provider',
                    canConnect: false,
                    requiresAuth: true
                };
            }

            // Test repository access - only pass 3 parameters
            const hasAccess = await provider.instance.testRepositoryAccess(server, credentials, repositoryUrl);

            return {
                isValid: hasAccess,
                authStatus: hasAccess ? 'success' : 'failed',
                error: hasAccess ? undefined : 'Repository access denied',
                canConnect: hasAccess,
                requiresAuth: !hasAccess
            };
        } catch (error: any) {
            return {
                isValid: false,
                authStatus: 'failed',
                error: error.message,
                canConnect: false,
                requiresAuth: true
            };
        }
    }
}

// Export singleton instance
export const gitService = new GitService();