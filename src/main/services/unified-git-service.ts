// import simpleGit, { SimpleGit } from "simple-git"
// import { GitAuthService } from "./git-auth-service"
// import { GitRepositoryStore } from "./git-repository-store"
// import { GitAuthStatus, GitRepository, GitServerConfig, GitServerCredentials, GitServerValidationResult, GitValidationResult, GitServerAuthStatus, GitCredentials } from "@/shared/types/git-repository"
// import { CreateRepositoryConfig, GitService } from "./git-service"
// import gitUrlParse from 'git-url-parse'

// /**
//  * Unified Git service that consolidates server and repository management
//  * Provides a single entry point for all Git operations
//  */
// export class UnifiedGitService {
//     private gitAuthService: GitAuthService
//     private gitRepositoryStore: GitRepositoryStore
//     private gitService: GitService

//     constructor() {
//         this.gitAuthService = new GitAuthService()
//         this.gitRepositoryStore = new GitRepositoryStore()
//         this.gitService = new GitService()
//     }

//     /**
//      * Get all configured Git servers
//      */
//     async getServers(): Promise<GitServerConfig[]> {
//         return this.gitAuthService.getServers()
//     }

//     /**
//      * Save a Git server configuration
//      */
//     async saveServer(server: Omit<GitServerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitServerConfig> {
//         return this.gitAuthService.saveServer(server)
//     }

//     /**
//      * Authenticate to a Git server
//      */
//     async authenticateServer(serverId: string, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
//         return this.gitAuthService.authenticateToServer(serverId, credentials)
//     }

//     /**
//      * Get all repositories with enhanced server information
//      */
//     async getRepositories(): Promise<GitRepository[]> {
//         const repos = this.gitRepositoryStore.getRepositories()
//         const servers = await this.getServers()

//         // Enhance repositories with server info and auth status
//         return repos.map(repo => {
//             const server = servers.find(s => s.id === repo.serverId)
//             const authStatusObj = this.gitAuthService.getServerAuthStatus(repo.serverId)

//             return {
//                 ...repo,
//                 serverName: server?.name,
//                 authStatus: authStatusObj?.status || 'unknown'
//             }
//         })
//     }

//     /**
//      * Save a repository with validation
//      */
//     async saveRepository(repository: GitRepository): Promise<GitRepository> {
//         // Validate server exists
//         const server = this.gitAuthService.getServers().find(s => s.id === repository.serverId)
//         if (!server) {
//             throw new Error(`Server with ID ${repository.serverId} not found`)
//         }

//         // Validate repository access
//         const validation = await this.validateRepositoryAccess(repository.url, repository.serverId)
//         if (!validation.isValid) {
//             throw new Error(`Repository validation failed: ${validation.error}`)
//         }

//         repository.authStatus = validation.authStatus
//         repository.lastAuthCheck = new Date().toISOString()

//         this.gitRepositoryStore.saveRepository(repository)
//         return repository
//     }

//     /**
//      * Validate repository access using server credentials
//      */
//     async validateRepositoryAccess(url: string, serverId: string): Promise<GitValidationResult> {
//         const server = this.gitAuthService.getServers().find(s => s.id === serverId)
//         if (!server) {
//             return {
//                 isValid: false,
//                 error: 'Server not found',
//                 authStatus: 'failed',
//                 canConnect: false,
//                 requiresAuth: true
//             }
//         }

//         const credentials = await this.gitAuthService.getServerCredentials(serverId)
//         if (!credentials) {
//             return {
//                 isValid: false,
//                 error: 'No credentials found for server',
//                 authStatus: 'failed',
//                 canConnect: false,
//                 requiresAuth: true
//             }
//         }

//         // Use existing validation logic from GitService and enhance the result
//         const baseResult = await this.gitService.validateRepository(url, {
//             method: credentials.method,
//             token: credentials.token,
//             username: credentials.username,
//             password: credentials.password,
//             sshKeyPath: credentials.sshKeyPath,
//             url: url,
//             repoId: serverId
//         })

//         // Enhance the result with missing properties
//         return {
//             ...baseResult,
//             canConnect: baseResult.isValid,
//             requiresAuth: !baseResult.isValid && baseResult.authStatus === 'failed'
//         }
//     }

//     /**
//      * Create a new repository with auto-authentication
//      */
//     async createRepository(config: CreateRepositoryConfig, serverId?: string): Promise<GitRepository> {
//         let server: GitServerConfig | undefined;
//         let actualServerId: string;

//         if (serverId) {
//             // Use explicitly provided server
//             server = this.gitAuthService.getServers().find(s => s.id === serverId);
//             actualServerId = serverId;
//         } else {
//             // Extract base URL from repository URL
//             const baseUrl = new URL(config.baseUrl!).origin;

//             // Auto-detect server based on extracted base URL
//             const servers = this.gitAuthService.getServers();
//             server = servers.find(s => s.baseUrl === baseUrl);

//             // If no matching server found, create a new one automatically
//             if (!server) {
//                 const provider = this.detectProviderFromUrl(baseUrl);
//                 const newServer = await this.gitAuthService.saveServer({
//                     name: `Auto-detected ${provider} (${baseUrl})`,
//                     provider: provider,
//                     baseUrl: baseUrl,
//                     description: `Auto-created from repository URL: ${config.baseUrl!}`,
//                     isDefault: servers.length === 0 // Make it default if it's the first
//                 });
//                 server = newServer;
//             }

//             actualServerId = server.id;
//         }

//         if (!server) {
//             throw new Error('No Git server configuration found. Please configure a Git server first.');
//         }

//         // Get server credentials
//         const serverCredentials = await this.gitAuthService.getServerCredentials(actualServerId);
//         if (!serverCredentials) {
//             throw new Error(`Server '${server.name}' is not authenticated. Please authenticate the server first.`);
//         }

//         // Ensure the config includes the full URL for provider parsing
//         const enhancedConfig = {
//             ...config,
//             url: config.url || config.baseUrl // Make sure URL is available for git-url-parse
//         };

//         // Pass enhanced config to git service
//         const credentials: GitCredentials = {
//             method: serverCredentials.method,
//             token: serverCredentials.token,
//             username: serverCredentials.username,
//             password: serverCredentials.password,
//             sshKeyPath: serverCredentials.sshKeyPath,
//             url: server.baseUrl,
//             repoId: actualServerId
//         };

//         // Create repository using existing GitService logic
//         const createdRepo = await this.gitService.createRepository(enhancedConfig, credentials);

//         // Auto-save to repository store with proper serverId
//         const gitRepo: GitRepository = {
//             ...createdRepo,
//             serverId: actualServerId,
//             serverName: server.name
//         };

//         return this.saveRepository(gitRepo);
//     }

//     /**
//      * Detect Git provider type from base URL with enhanced detection
//      * @param baseUrl - The base URL of the Git server (e.g., "http://localhost:9080")
//      * @returns The detected provider type
//      */
//     private detectProviderFromUrl(baseUrl: string): 'github' | 'gitlab' | 'gitea' | 'bitbucket' {
//         const url = baseUrl.toLowerCase();

//         // Check for well-known hosted services
//         if (url.includes('github.com')) {
//             return 'github';
//         }
//         if (url.includes('gitlab.com') || url.includes('gitlab.')) {
//             return 'gitlab';
//         }
//         if (url.includes('bitbucket.org') || url.includes('bitbucket.')) {
//             return 'bitbucket';
//         }

//         // Enhanced detection for Bitbucket Server (on-premises)
//         // Check if URL contains /scm/ path which is typical for Bitbucket Server
//         try {
//             const parsed = gitUrlParse(baseUrl);
//             if (parsed.pathname && parsed.pathname.includes('/scm/')) {
//                 return 'bitbucket';
//             }
//         } catch (error) {
//             // If parsing fails, continue with default logic
//         }

//         // For self-hosted instances, default to Gitea as it's commonly used
//         return 'gitea';
//     }


//     /**
//      * Health check for all repositories grouped by server
//      */
//     async checkAllRepositoriesHealth(): Promise<{ serverId: string, serverName: string, status: GitAuthStatus, repositories: GitRepository[] }[]> {
//         const servers = await this.getServers()
//         const repositories = await this.getRepositories()

//         return Promise.all(servers.map(async server => {
//             const serverRepos = repositories.filter(repo => repo.serverId === server.id)
//             const authStatusObj = this.gitAuthService.getServerAuthStatus(server.id)

//             return {
//                 serverId: server.id,
//                 serverName: server.name,
//                 status: authStatusObj?.status || 'unknown',
//                 repositories: serverRepos
//             }
//         }))
//     }

//     /**
//      * Remove a repository
//      */
//     async removeRepository(repositoryId: string): Promise<void> {
//         return this.gitRepositoryStore.removeRepository(repositoryId)
//     }

//     /**
//      * Remove a Git server
//      */
//     async removeServer(serverId: string): Promise<void> {
//         return this.gitAuthService.removeServer(serverId)
//     }

// }