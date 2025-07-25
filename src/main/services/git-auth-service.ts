// import Store from 'electron-store';
// import { safeStorage } from 'electron';
// import { GitServerConfig, GitServerCredentials, GitServerAuthStatus, GitServerValidationResult, GitRepositoryAccessStatus, GitRepositoryPermissions } from '../../shared/types/git-repository';
// import { GiteaProvider } from './providers/gitea-provider';
// import { BitbucketProvider } from './providers/bitbucket-provider';

// interface GitAuthStoreSchema {
//   servers: GitServerConfig[];
//   credentials: Record<string, string>; // serverId -> encrypted credentials
//   authStatus: Record<string, GitServerAuthStatus>; // serverId -> auth status
// }

// /**
//  * Service for managing Git server authentication and credentials
//  * Extends existing GitService with server-level authentication
//  */
// export class GitAuthService {
//   private authStore: any; // Store<GitAuthStoreSchema>;
//   private giteaProvider: GiteaProvider;
//   private bitbucketProvider: BitbucketProvider;

//   constructor() {
//     this.authStore = new Store<GitAuthStoreSchema>({
//       name: 'git-auth',
//       defaults: {
//         servers: [],
//         credentials: {},
//         authStatus: {}
//       }
//     });
//     this.giteaProvider = new GiteaProvider();
//     this.bitbucketProvider = new BitbucketProvider();
//   }

//   /**
//    * Get all configured Git servers
//    */
//   getServers(): GitServerConfig[] {
//     return this.authStore.get('servers', []);
//   }

//   /**
//    * Add or update a Git server configuration
//    */
//   async saveServer(server: Omit<GitServerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitServerConfig> {
//     const servers = this.getServers();
//     const existingIndex = servers.findIndex(s => s.baseUrl === server.baseUrl);
    
//     const serverConfig: GitServerConfig = {
//       ...server,
//       id: existingIndex >= 0 ? servers[existingIndex].id : Date.now().toString(),
//       createdAt: existingIndex >= 0 ? servers[existingIndex].createdAt : new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     };

//     if (existingIndex >= 0) {
//       servers[existingIndex] = serverConfig;
//     } else {
//       servers.push(serverConfig);
//     }

//     this.authStore.set('servers', servers);
//     return serverConfig;
//   }

//   /**
//    * Remove a Git server and its credentials
//    */
//   async removeServer(serverId: string): Promise<void> {
//     const servers = this.getServers().filter(s => s.id !== serverId);
//     this.authStore.set('servers', servers);
    
//     // Remove credentials and auth status
//     const credentials = this.authStore.get('credentials', {});
//     const authStatus = this.authStore.get('authStatus', {});
    
//     delete credentials[serverId];
//     delete authStatus[serverId];
    
//     this.authStore.set('credentials', credentials);
//     this.authStore.set('authStatus', authStatus);
//   }

//   /**
//    * Store server credentials securely
//    */
//   async storeServerCredentials(serverId: string, credentials: GitServerCredentials): Promise<void> {
//     if (!safeStorage.isEncryptionAvailable()) {
//       throw new Error('Encryption is not available on this system');
//     }

//     const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
//     const credentialsStore = this.authStore.get('credentials', {});
//     credentialsStore[serverId] = encrypted.toString('base64');
//     this.authStore.set('credentials', credentialsStore);
//   }

//   /**
//    * Get stored server credentials
//    */
//   async getServerCredentials(serverId: string): Promise<GitServerCredentials | null> {
//     try {
//       const credentialsStore = this.authStore.get('credentials', {});
//       const encryptedData = credentialsStore[serverId];
      
//       if (!encryptedData) {
//         return null;
//       }

//       const decrypted = safeStorage.decryptString(Buffer.from(encryptedData, 'base64'));
//       return JSON.parse(decrypted) as GitServerCredentials;
//     } catch (error) {
//       console.error('Failed to decrypt server credentials:', error);
//       return null;
//     }
//   }

//   /**
//    * Test authentication to a Git server
//    */
//   async authenticateToServer(serverId: string, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
//     const server = this.getServers().find(s => s.id === serverId);
//     if (!server) {
//       return {
//         isValid: false,
//         authStatus: 'failed',
//         error: 'Server not found',
//         canConnect: false
//       };
//     }

//     try {
//       // Use provider-specific authentication
//       const result = await this.testServerConnection(server, credentials);
      
//       if (result.isValid) {
//         // Store credentials and update auth status
//         await this.storeServerCredentials(serverId, credentials);
//         await this.updateAuthStatus(serverId, {
//           serverId,
//           status: 'success',
//           lastCheck: new Date().toISOString(),
//           userInfo: result.userInfo || result.serverInfo?.userInfo
//         });
//       } else {
//         await this.updateAuthStatus(serverId, {
//           serverId,
//           status: 'failed',
//           lastCheck: new Date().toISOString(),
//           error: result.error
//         });
//       }

//       return result;
//     } catch (error: any) {
//       const authStatus: GitServerAuthStatus = {
//         serverId,
//         status: 'failed',
//         lastCheck: new Date().toISOString(),
//         error: error.message
//       };
      
//       await this.updateAuthStatus(serverId, authStatus);
      
//       return {
//         isValid: false,
//         authStatus: 'failed',
//         error: error.message,
//         canConnect: false
//       };
//     }
//   }

//   /**
//    * Get authentication status for a server
//    */
//   getServerAuthStatus(serverId: string): GitServerAuthStatus | null {
//     const authStatus = this.authStore.get('authStatus', {});
//     return authStatus[serverId] || null;
//   }

//   /**
//    * Update authentication status for a server
//    */
//   private async updateAuthStatus(serverId: string, status: GitServerAuthStatus): Promise<void> {
//     const authStatus = this.authStore.get('authStatus', {});
//     authStatus[serverId] = status;
//     this.authStore.set('authStatus', authStatus);
//   }

//   /**
//    * Test connection to Git server using provider-specific methods
//    */
//   private async testServerConnection(server: GitServerConfig, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
//     try {
//       switch (server.provider) {
//         case 'gitea':
//           return await this.giteaProvider.testAuthentication(server, credentials);
//         case 'bitbucket':
//           return await this.bitbucketProvider.testAuthentication(server, credentials);
//         default:
//           // For other providers, return a basic validation result
//           // The actual validation will be handled by GitService when needed
//           return {
//             isValid: true, // Assume valid for now, will be validated during actual operations
//             authStatus: 'success',
//             canConnect: true,
//             error: undefined
//           };
//       }
//     } catch (error: any) {
//       return {
//         isValid: false,
//         authStatus: 'failed',
//         error: error.message,
//         canConnect: false
//       };
//     }
//   }

//   /**
//    * Test repository access using provider-specific implementations
//    */
//   async testRepositoryAccess(serverId: string, repositoryUrl: string): Promise<GitRepositoryAccessStatus> {
//     const server = this.getServers().find(s => s.id === serverId);
//     const credentials = await this.getServerCredentials(serverId);

//     if (!server || !credentials) {
//       return {
//         repositoryUrl,
//         serverId,
//         hasAccess: false,
//         permissions: { developer: 'none', devops: 'none', operations: 'none' },
//         lastCheck: new Date().toISOString(),
//         error: 'Server or credentials not found'
//       };
//     }

//     try {
//       let hasAccess = false;

//       switch (server.provider) {
//         case 'gitea':
//           hasAccess = await this.giteaProvider.testRepositoryAccess(server, credentials, repositoryUrl);
//           break;
//         case 'bitbucket':
//           hasAccess = await this.bitbucketProvider.testRepositoryAccess(server, credentials, repositoryUrl);
//           break;
//         default:
//           // For other providers, assume access is available
//           // The actual validation will be handled by GitService when needed
//           hasAccess = true;
//       }

//       return {
//         repositoryUrl,
//         serverId,
//         hasAccess,
//         permissions: this.determinePermissions({ isValid: hasAccess }),
//         lastCheck: new Date().toISOString()
//       };
//     } catch (error: any) {
//       return {
//         repositoryUrl,
//         serverId,
//         hasAccess: false,
//         permissions: { developer: 'none', devops: 'none', operations: 'none' },
//         lastCheck: new Date().toISOString(),
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Build a test repository URL for server validation
//    */
//   private buildTestRepositoryUrl(server: GitServerConfig): string {
//     // Use a known public repository for each provider to test connectivity
//     switch (server.provider) {
//       case 'github':
//         return server.baseUrl.includes('github.com') 
//           ? 'https://github.com/octocat/Hello-World.git'
//           : `${server.baseUrl}/api/v3/user`; // GitHub Enterprise API endpoint
//       case 'gitlab':
//         return `${server.baseUrl}/api/v4/user`; // GitLab API endpoint
//       case 'gitea':
//         return `${server.baseUrl}/api/v1/user`; // Gitea API endpoint
//       case 'bitbucket':
//         return server.baseUrl.includes('bitbucket.org')
//           ? 'https://api.bitbucket.org/2.0/user'
//           : `${server.baseUrl}/rest/api/1.0/users`; // Bitbucket Server API
//       default:
//         return `${server.baseUrl}/api/v1/user`;
//     }
//   }

//   /**
//    * Determine repository permissions based on validation result
//    */
//   private determinePermissions(validation: any): GitRepositoryPermissions {
//     // This is a simplified implementation
//     // In a real scenario, you'd query the Git provider's API for actual permissions
//     if (validation.isValid) {
//       return {
//         developer: 'read-only',
//         devops: 'full',
//         operations: 'read-only'
//       };
//     }
    
//     return {
//       developer: 'none',
//       devops: 'none',
//       operations: 'none'
//     };
//   }
// }