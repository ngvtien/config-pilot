import { safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import os from 'os';
import { GitRepository, GitCredentials, GitOperationResult, GitDiffResult, GitAuthStatus, GitCommit, GitServerConfig, GitServerCredentials, GitServerValidationResult, GitValidationResult, RepositoryInfo } from '../../shared/types/git-repository';
import { CreateOrganizationConfig, CreateProjectConfig, GitProviderInterface } from './providers/git-provider-interface';

import { GitAdapterFactory, GitAdapterType } from './adapters/git-adapter-factory';
import { GitAdapterInterface } from './adapters/git-adapter-interface';
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

type CreateOrgRequest =
    | { provider: GitProviderInterface; config: CreateOrganizationConfig }
    | { provider: GitProviderInterface; config: CreateProjectConfig };
/**
 * Service class for handling Git operations with secure credential management
 */
export class GitService {
    private gitAdapter: GitAdapterInterface;
    private store: any; //Store<GitStoreSchema>;
    //private credentialStore: any;
    //private _gitAuthService?: GitAuthService;   // Make it optional and lazy-loaded
    private giteaProvider = new GiteaProvider();
    private bitbucketProvider = new BitbucketProvider();
    private workingDirectory: string;

    constructor(workingDirectory?: string, adapterType: GitAdapterType = 'isomorphic-git') {
        this.workingDirectory = workingDirectory || process.cwd();
        this.gitAdapter = GitAdapterFactory.getAdapter(adapterType);
        this.store = new Store<GitStoreSchema>({
            name: 'git-unified',
            defaults: { servers: [], repositories: [], credentials: {} }
        });
    }

    // Server Management
    getServers(): GitServerConfig[] {
        return this.store.get('servers', []);
    }

    /**
     * Normalize URL by removing trailing slashes for consistent comparison
     * @param url - URL to normalize
     * @returns Normalized URL
     */
    private normalizeUrl(url: string): string {
        return url.replace(/\/+$/, '');
    }

    saveServer(server: Omit<GitServerConfig, 'id' | 'createdAt' | 'updatedAt'>): GitServerConfig {
        const servers = this.getServers();

        // Normalize baseUrl to prevent duplicates with trailing slashes
        const normalizedBaseUrl = this.normalizeUrl(server.baseUrl);
        const serverId = normalizedBaseUrl;

        // Check if server already exists using normalized URL
        const existingIndex = servers.findIndex(s => this.normalizeUrl(s.baseUrl) === normalizedBaseUrl);

        if (existingIndex >= 0) {
            // ✅ CORRECTLY UPDATES existing server, ensuring provider is explicitly preserved
            const updatedServer = {
                ...servers[existingIndex],
                ...server,
                baseUrl: normalizedBaseUrl, // Use normalized URL
                id: serverId,
                updatedAt: new Date().toISOString()
            };
            servers[existingIndex] = updatedServer;
            this.store.set('servers', servers);
            console.log('🔄 Updated existing server:', updatedServer.id, 'Provider:', updatedServer.provider);
            return updatedServer;
        }

        // Only creates new server if none exists with same normalized baseUrl
        const newServer: GitServerConfig = {
            ...server,
            baseUrl: normalizedBaseUrl, // Use normalized URL
            id: serverId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        servers.push(newServer);
        this.store.set('servers', servers);
        console.log('➕ Created new server:', newServer.id, 'Provider:', newServer.provider);
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
            // Normalize serverId by removing trailing slash
            const normalizedServerId = serverId.endsWith('/') ? serverId.slice(0, -1) : serverId;
            server = this.getServers().find(s => s.id === normalizedServerId);
            if (!server) throw new Error(`No server configured with ID: ${serverId}`);
        } else {
            const parsed = gitUrlParse(url);
            const baseUrl = parsed.port
                ? `${parsed.protocol}://${parsed.resource}:${parsed.port}`
                : `${parsed.protocol}://${parsed.resource}`;

            // Get all servers matching the baseUrl and return the first one
            // Sort by preference: most recently updated first
            const matchingServers = this.getServers()
                .filter(s => s.baseUrl === baseUrl)
                .sort((a, b) => {
                    const aTime = new Date(a.updatedAt || a.createdAt).getTime();
                    const bTime = new Date(b.updatedAt || b.createdAt).getTime();
                    return bTime - aTime; // Most recent first
                });

            server = matchingServers[0];
            if (!server) throw new Error(`No server configured for ${baseUrl}`);
        }

        const credentialKey = `configpilot-git-server:${server.id}`;
        const credentialStore = new Store({ name: 'secure-credentials' }) as any;
        const encryptedCreds = credentialStore.get(credentialKey);

        if (!encryptedCreds) throw new Error(`No credentials for server ${server.id}`);

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
            const result = await this.gitAdapter.testConnection(url, credentials);

            if (result.success) {
                return {
                    success: true,
                    authStatus: 'success'
                };
            } else {
                const errorMessage = result.error?.toLowerCase() || '';

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
                    error: result.error || 'Unknown error'
                };
            }
        } catch (error: any) {
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
            return await this.gitAdapter.getRepositoryInfo(url, credentials);
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
            return await this.gitAdapter.getDiff(from, to, this.workingDirectory);
        } catch (error: any) {
            throw new Error(`Failed to get diff: ${error.message}`);
        }
    }

    /**
     * Get staged changes diff
     */
    async getStagedDiff(): Promise<GitDiffResult> {
        try {
            return await this.gitAdapter.getStagedDiff(this.workingDirectory);
        } catch (error: any) {
            throw new Error(`Failed to get staged diff: ${error.message}`);
        }
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
            let credentials: GitCredentials | undefined;

            // If credentials are provided, use them for authentication
            if (credentialId) {
                credentials = await this.getCredentialsForOperation(credentialId) || undefined;
            }

            return await this.gitAdapter.clone(repoUrl, localPath, credentials);
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
            const branches = await this.gitAdapter.getBranches(this.workingDirectory);
            const branchExists = branches.includes(branchName);

            if (branchExists) {
                // Switch to existing branch
                return await this.gitAdapter.checkout(branchName, this.workingDirectory);
            } else {
                // Create new branch from base branch
                return await this.gitAdapter.checkoutNewBranch(branchName, this.workingDirectory);
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
            const addResult = await this.gitAdapter.add(overridesPath, this.workingDirectory);
            if (!addResult.success) {
                return addResult;
            }

            // Commit the changes
            const commitMessage = `Update ${customer}/${env} configuration`;
            const commitResult = await this.gitAdapter.commit(commitMessage, this.workingDirectory);
            if (!commitResult.success) {
                return commitResult;
            }

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
            const addResult = await this.gitAdapter.add(filePath, this.workingDirectory);
            if (!addResult.success) {
                return addResult;
            }

            // Commit the changes
            const commitResult = await this.gitAdapter.commit(commitMessage, this.workingDirectory);
            if (!commitResult.success) {
                return commitResult;
            }

            return { success: true, message: 'YAML content committed successfully', timestamp: new Date().toISOString() };
        } catch (error: any) {
            return { success: false, message: 'Failed to commit YAML content', error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Push changes to remote repository
     */
    async pushChanges(remote: string = 'origin', branch?: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            let credentials: GitCredentials | undefined;
            if (credentialId) {
                credentials = await this.getCredentialsForOperation(credentialId) || undefined;
            }

            return await this.gitAdapter.push(this.workingDirectory, credentials);
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Pull latest changes from remote
     */
    async pullChanges(remote: string = 'origin', branch?: string, credentialId?: string): Promise<GitOperationResult> {
        try {
            let credentials: GitCredentials | undefined;
            if (credentialId) {
                credentials = await this.getCredentialsForOperation(credentialId) || undefined;
            }

            return await this.gitAdapter.pull(this.workingDirectory, credentials);
        } catch (error: any) {
            return { success: false, message: "Operation failed", error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Merge a branch into the current branch
     * Note: isomorphic-git doesn't support merge operations directly
     */
    async mergeBranch(branchName: string, options?: MergeOptions): Promise<GitOperationResult> {
        return {
            success: false,
            message: "Merge operations are not supported with isomorphic-git adapter",
            error: "Use git CLI or switch to a different adapter for merge operations",
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Merge customer branch into target branch (e.g., staging, production)
     * Note: isomorphic-git doesn't support merge operations directly
     */
    async mergeCustomerBranch(customer: string, env: string, targetBranch: string): Promise<GitOperationResult> {
        return {
            success: false,
            message: "Merge operations are not supported with isomorphic-git adapter",
            error: "Use git CLI or switch to a different adapter for merge operations",
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check if there are merge conflicts
     * Note: isomorphic-git doesn't support merge operations directly
     */
    async checkMergeConflicts(branchName: string): Promise<MergeConflictInfo> {
        return {
            hasConflicts: false,
            conflicts: ["Merge conflict detection not supported with isomorphic-git adapter"]
        };
    }

    /**
     * Resolve merge conflicts and continue merge
     * Note: isomorphic-git doesn't support merge operations directly
     */
    async resolveMergeConflicts(resolvedFiles: string[]): Promise<GitOperationResult> {
        return {
            success: false,
            message: "Merge conflict resolution not supported with isomorphic-git adapter",
            error: "Use git CLI or switch to a different adapter for merge operations",
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Abort an ongoing merge
     * Note: isomorphic-git doesn't support merge operations directly
     */
    async abortMerge(): Promise<GitOperationResult> {
        return {
            success: false,
            message: "Merge abort not supported with isomorphic-git adapter",
            error: "Use git CLI or switch to a different adapter for merge operations",
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get current repository status
     * Note: isomorphic-git has limited status functionality
     */
    async getStatus() {
        try {
            // isomorphic-git doesn't have a direct status equivalent
            // This would need custom implementation using git.walk
            return { 
                success: false, 
                error: "Status functionality not implemented with isomorphic-git adapter" 
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get commit history
     * Note: isomorphic-git has different log functionality
     */
    async getCommitHistory(maxCount: number = 10): Promise<GitCommit[]> {
        try {
            // isomorphic-git doesn't have the same log functionality as simple-git
            // This would need custom implementation using git.log
            return [];
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
     * Prepare merge request information
     */
    async prepareMergeRequest(sourceBranch: string, targetBranch: string, title: string, description?: string): Promise<MergeRequestInfo> {
        try {
            // Validate that both branches exist
            const branches = await this.gitAdapter.getBranches(this.workingDirectory);

            if (!branches.includes(sourceBranch)) {
                throw new Error(`Source branch '${sourceBranch}' does not exist`);
            }

            if (!branches.includes(targetBranch)) {
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
    async createEnvironmentBranches(repositoryUrl: string, environments: string[], serverId?: string): Promise<{ success: boolean; createdBranches: string[]; errors: any[] }> {
        const createdBranches: string[] = [];
        const errors: any[] = [];

        try {
            // Get credentials for the server
            let gitCredentials: GitCredentials | undefined;
            if (serverId) {
                const { server, credentials: serverCreds } = this.getServerAndCredentials(repositoryUrl, serverId);
                // Convert GitServerCredentials to GitCredentials format
                gitCredentials = {
                    username: serverCreds.username,
                    password: serverCreds.token || serverCreds.password || '',
                    token: serverCreds.token,
                    method: serverCreds.method,
                    url: repositoryUrl,
                    repoId: serverId
                };
            }

            // Clone repository to temporary location with credentials
            const tempDir = path.join(os.tmpdir(), `gitops-setup-${Date.now()}`);
            const cloneResult = await this.gitAdapter.clone(repositoryUrl, tempDir, gitCredentials);
            
            if (!cloneResult.success) {
                throw new Error(cloneResult.error || 'Failed to clone repository');
            }

            // Create a new adapter instance for the temp directory
            const tempAdapter = GitAdapterFactory.getAdapter('isomorphic-git');

            for (const env of environments) {
                try {
                    // Create and checkout new branch
                    const branchResult = await tempAdapter.checkoutNewBranch(env, tempDir);
                    if (!branchResult.success) {
                        throw new Error(branchResult.error || 'Failed to create branch');
                    }

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

                    // Stage and commit changes
                    const addResult = await tempAdapter.add('.', tempDir);
                    if (!addResult.success) {
                        throw new Error(addResult.error || 'Failed to stage files');
                    }

                    const commitResult = await tempAdapter.commit(`Initialize ${env} environment structure`, tempDir);
                    if (!commitResult.success) {
                        throw new Error(commitResult.error || 'Failed to commit changes');
                    }

                    // Push branch
                    const pushResult = await tempAdapter.push(tempDir, gitCredentials);
                    if (!pushResult.success) {
                        throw new Error(pushResult.error || 'Failed to push branch');
                    }

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
     * Create environment branches for customer git integration with simple README.md files
     * Different from createEnvironmentBranches which is for product integration
     */
    async createCustomerEnvironmentBranches(repositoryUrl: string, environments: string[], customerName: string, serverId?: string): Promise<{ success: boolean; createdBranches: string[]; errors: any[] }> {
        const createdBranches: string[] = [];
        const errors: any[] = [];

        try {
            // Get credentials for the server
            let gitCredentials: GitCredentials | undefined;
            if (serverId) {
                const { server, credentials: serverCreds } = this.getServerAndCredentials(repositoryUrl, serverId);
                // Convert GitServerCredentials to GitCredentials format
                gitCredentials = {
                    username: serverCreds.username,
                    password: serverCreds.token || serverCreds.password || '',
                    token: serverCreds.token,
                    method: serverCreds.method,
                    url: repositoryUrl,
                    repoId: serverId
                };
            }

            // Clone repository to temporary location with credentials
            const tempDir = path.join(os.tmpdir(), `customer-gitops-setup-${Date.now()}`);
            const cloneResult = await this.gitAdapter.clone(repositoryUrl, tempDir, gitCredentials);
            
            if (!cloneResult.success) {
                throw new Error(cloneResult.error || 'Failed to clone repository');
            }

            // Create a new adapter instance for the temp directory
            const tempAdapter = GitAdapterFactory.getAdapter('isomorphic-git');

            for (const env of environments) {
                try {
                    // Create and checkout new branch from main
                    const branchResult = await tempAdapter.checkoutNewBranch(env, tempDir);
                    if (!branchResult.success) {
                        throw new Error(branchResult.error || 'Failed to create branch');
                    }

                    // Create simple README.md for customer environment
                    const readmeContent = `# ${customerName} - ${env.toUpperCase()} Environment\n\nThis branch contains configurations for the ${env} environment of ${customerName}.\n\n## Usage\n\nThis branch is used for GitOps deployments to the ${env} environment.\n`;

                    await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);

                    // Stage and commit changes
                    const addResult = await tempAdapter.add('.', tempDir);
                    if (!addResult.success) {
                        throw new Error(addResult.error || 'Failed to stage files');
                    }

                    const commitResult = await tempAdapter.commit(`Initialize ${env} environment for ${customerName}`, tempDir);
                    if (!commitResult.success) {
                        throw new Error(commitResult.error || 'Failed to commit changes');
                    }

                    // Push branch
                    const pushResult = await tempAdapter.push(tempDir, gitCredentials);
                    if (!pushResult.success) {
                        throw new Error(pushResult.error || 'Failed to push branch');
                    }

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

    /**
     * Simple Git authentication check for a given URL
     * Returns "success" or "failed" based on basic connectivity
     */
    async checkGitAuth(url: string): Promise<"success" | "failed"> {
        try {
            console.log(`[GitService] Checking Git auth for URL: ${url}`);

            // Parse the URL to get server information
            const parsed = gitUrlParse(url);
            if (!parsed || !parsed.source) {
                console.log(`[GitService] Invalid URL format: ${url}`);
                return "failed";
            }

            // Try to find a matching server configuration
            const servers = this.getServers();
            const matchingServer = servers.find(server => {
                const serverHost = new URL(server.baseUrl).hostname;
                return serverHost === parsed.source;
            });

            if (!matchingServer) {
                console.log(`[GitService] No server configuration found for ${parsed.source}`);
                return "failed";
            }

            // Use existing validateRepositoryAccess method
            const result = await this.validateRepositoryAccess(url, matchingServer.id);

            console.log(`[GitService] Validation result:`, result);
            return result.isValid ? "success" : "failed";

        } catch (error: any) {
            console.error(`[GitService] Error checking Git auth for ${url}:`, error);
            return "failed";
        }
    }


    /**
     * Remove a server by ID
     * @param serverId Server ID to remove
     * @returns boolean indicating success
     */
    removeServer(serverId: string): boolean {
        const servers = this.getServers();
        const initialLength = servers.length;
        const filteredServers = servers.filter(s => s.id !== serverId);

        if (filteredServers.length < initialLength) {
            this.store.set('servers', filteredServers);

            // Also clean up associated credentials
            const credentials = this.store.get('credentials', {});
            delete credentials[serverId];
            this.store.set('credentials', credentials);

            return true;
        }
        return false;
    }

    /**
     * Clean up duplicate servers based on baseUrl
     * Keeps the most recent server (by updatedAt) for each unique baseUrl
     * @returns Object with cleanup statistics
     */
    cleanupDuplicateServers(): { removed: number; kept: number; duplicateGroups: any[] } {
        const servers = this.getServers();
        const serverGroups = new Map<string, GitServerConfig[]>();

        // Group servers by baseUrl
        servers.forEach(server => {
            const baseUrl = server.baseUrl;
            if (!serverGroups.has(baseUrl)) {
                serverGroups.set(baseUrl, []);
            }
            serverGroups.get(baseUrl)!.push(server);
        });

        const serversToKeep: GitServerConfig[] = [];
        const duplicateGroups: any[] = [];
        let removedCount = 0;

        // For each group, keep only the best server
        serverGroups.forEach((groupServers, baseUrl) => {
            if (groupServers.length > 1) {
                // Sort by preference: 
                // 1. Has provider defined
                // 2. Most recent updatedAt
                // 3. Most recent createdAt
                const sortedServers = groupServers.sort((a, b) => {
                    // Prefer servers with provider defined
                    if (a.provider && !b.provider) return -1;
                    if (!a.provider && b.provider) return 1;

                    // Then by updatedAt (most recent first)
                    const aUpdated = new Date(a.updatedAt || a.createdAt).getTime();
                    const bUpdated = new Date(b.updatedAt || b.createdAt).getTime();
                    return bUpdated - aUpdated;
                });

                const keepServer = sortedServers[0];
                const removeServers = sortedServers.slice(1);

                serversToKeep.push(keepServer);
                removedCount += removeServers.length;

                duplicateGroups.push({
                    baseUrl,
                    kept: keepServer,
                    removed: removeServers
                });
            } else {
                serversToKeep.push(groupServers[0]);
            }
        });

        // Update the store with cleaned servers
        this.store.set('servers', serversToKeep);

        // Clean up orphaned credentials
        const credentials = this.store.get('credentials', {});
        const validServerIds = new Set(serversToKeep.map(s => s.id));
        const cleanedCredentials: Record<string, string> = {};

        Object.entries(credentials).forEach(([serverId, cred]) => {
            if (validServerIds.has(serverId)) {
                cleanedCredentials[serverId] = cred as string; // Add type assertion
            }
        });

        this.store.set('credentials', cleanedCredentials);

        return {
            removed: removedCount,
            kept: serversToKeep.length,
            duplicateGroups
        };
    }

    /**
     * Get duplicate servers grouped by baseUrl
     * @returns Array of duplicate groups
     */
    getDuplicateServers(): { baseUrl: string; servers: GitServerConfig[]; count: number }[] {
        const servers = this.getServers();
        const serverGroups = new Map<string, GitServerConfig[]>();

        servers.forEach(server => {
            const baseUrl = server.baseUrl;
            if (!serverGroups.has(baseUrl)) {
                serverGroups.set(baseUrl, []);
            }
            serverGroups.get(baseUrl)!.push(server);
        });

        return Array.from(serverGroups.entries())
            .filter(([_, groupServers]) => groupServers.length > 1)
            .map(([baseUrl, groupServers]) => ({
                baseUrl,
                servers: groupServers,
                count: groupServers.length
            }));
    }


    // /**
    //  * Create organization in Gitea
    //  */
    // async createOrganisation(serverUrl: string, config: CreateOrganizationConfig, serverId?: string): Promise<any>;
    // /**
    //  * Create project in Bitbucket
    //  */
    // async createOrganisation(serverUrl: string, config: CreateProjectConfig, serverId?: string): Promise<any>;
    // /**
    //  * Create organization/project based on provider type
    //  */
    // async createOrganisation(serverUrl: string, config: CreateOrganizationConfig | CreateProjectConfig, serverId?: string): Promise<any> {
    //     const { server, credentials } = this.getServerAndCredentials(serverUrl, serverId);
    //     const { provider, instance } = this.getProviderForUrl(serverUrl);

    //     if (provider === 'gitea') {
    //         // TypeScript knows this is CreateOrganizationConfig due to provider check
    //         return await (instance as GiteaProvider).createOrganization(server, credentials, config as CreateOrganizationConfig);
    //     } else if (provider === 'bitbucket') {
    //         // TypeScript knows this is CreateProjectConfig due to provider check
    //         return await (instance as BitbucketProvider).createOrganization(server, credentials, config as CreateProjectConfig);
    //     } else {
    //         throw new Error(`Unsupported provider: ${provider}`);
    //     }
    // }

    /**
     * Creates an organization or project based on the provider type.
     * Uses discriminated union for type safety without casting.
     * @param serverUrl The URL of the Git server
     * @param config The configuration for creating organization/project
     */
    async createOrganisation(
        serverUrl: string,
        config: CreateOrganizationConfig | CreateProjectConfig
    ): Promise<void> {
        const { provider: providerType, instance: providerInstance } = this.getProviderForUrl(serverUrl);
        const { server, credentials } = this.getServerAndCredentials(serverUrl);

        // Create the discriminated union request object
        const request: CreateOrgRequest = providerType === 'gitea'
            ? { provider: providerInstance, config: config as CreateOrganizationConfig }
            : { provider: providerInstance, config: config as CreateProjectConfig };

        // Pass all required parameters: server, credentials, and config
        await request.provider.createOrganization(server, credentials, request.config);
    }

    /**
     * Update an existing server
     * @param serverId Server ID to update
     * @param updates Partial server data to update
     * @returns Updated server configuration
     */
    updateServer(serverId: string, updates: Partial<GitServerConfig>): GitServerConfig {
        const servers = this.getServers();
        const serverIndex = servers.findIndex(s => s.id === serverId);

        if (serverIndex === -1) {
            throw new Error(`Server with ID ${serverId} not found`);
        }

        const existingServer = servers[serverIndex];
        const updatedServer: GitServerConfig = {
            ...existingServer,
            ...updates,
            id: serverId, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };

        // Normalize the URL if baseUrl is being updated
        if (updates.baseUrl) {
            updatedServer.baseUrl = this.normalizeUrl(updates.baseUrl);
        }

        servers[serverIndex] = updatedServer;
        this.store.set('servers', servers);

        return updatedServer;
    }

    /**
     * Test server connection by server ID
     * @param serverId Server ID to test
     * @returns Connection test result
     */
    async testServerConnection(serverId: string): Promise<{ success: boolean; status: string; message?: string }> {
        try {
            const servers = this.getServers();
            const server = servers.find(s => s.id === serverId);

            if (!server) {
                return {
                    success: false,
                    status: 'error',
                    message: `Server with ID ${serverId} not found`
                };
            }

            // Get stored credentials for this server
            const credentialsData = this.store.get('credentials', {});
            const encryptedCredentials = credentialsData[serverId];

            if (!encryptedCredentials) {
                return {
                    success: false,
                    status: 'no_credentials',
                    message: 'No credentials found for this server'
                };
            }

            // Decrypt credentials
            let credentials: GitServerCredentials;
            try {
                const decryptedData = safeStorage.decryptString(Buffer.from(encryptedCredentials, 'base64'));
                credentials = JSON.parse(decryptedData);
            } catch (error) {
                return {
                    success: false,
                    status: 'credential_error',
                    message: 'Failed to decrypt stored credentials'
                };
            }

            // Test the connection using the existing authenticateServer method
            const result = await this.authenticateServer(serverId, credentials);

            return {
                success: result.isValid,
                status: result.isValid ? 'connected' : 'failed',
                message: result.error
            };

        } catch (error: any) {
            console.error(`[GitService] Error testing server connection for ${serverId}:`, error);
            return {
                success: false,
                status: 'error',
                message: error.message || 'Unknown error occurred'
            };
        }
    }

}

// Export singleton instance
export const gitService = new GitService();