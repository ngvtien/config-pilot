import { GitServerConfig, GitServerCredentials, GitServerValidationResult } from '../../../shared/types/git-repository';
import gitUrlParse from 'git-url-parse';

/**
 * Gitea provider implementation for simple authentication
 * Supports personal access tokens and basic authentication
 */
export class GiteaProvider {
  /**
   * Test authentication with Gitea server using token or credentials
   */
  async testAuthentication(server: GitServerConfig, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
    try {
      // Gitea API endpoint for current user
      const apiUrl = `${server.baseUrl}/api/v1/user`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add authentication header based on method
      if (credentials.method === 'token' && credentials.token) {
        headers['Authorization'] = `token ${credentials.token}`;
      } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else {
        return {
          isValid: false,
          authStatus: 'failed',
          error: 'Invalid authentication method or missing credentials',
          canConnect: false
        };
      }

      console.log(`Testing Gitea authentication at ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        //timeout: 10000
      });

      console.log(`HTTP Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const userData = await response.json();
        console.log('Authentication successful, user data:', { login: userData.login, full_name: userData.full_name });

        return {
          isValid: true,
          authStatus: 'success',
          canConnect: true,
          userInfo: {
            username: userData.login,
            name: userData.full_name,
            email: userData.email
          }
        };
      } else {
        const errorText = await response.text();
        console.error(`Authentication failed with status ${response.status}:`, errorText);

        return {
          isValid: false,
          authStatus: 'failed',
          error: `HTTP ${response.status}: ${response.statusText}`,
          canConnect: true // Server is reachable but auth failed
        };
      }
    } catch (error: any) {
      console.error('Gitea authentication error:', error);
      return {
        isValid: false,
        authStatus: 'failed',
        error: error.message,
        canConnect: false
      };
    }
  }

  /**
   * Test repository access using server credentials
   */
  async testRepositoryAccess(server: GitServerConfig, credentials: GitServerCredentials, repositoryUrl: string): Promise<boolean> {
    try {
      const repoInfo = this.extractRepoInfoFromUrl(repositoryUrl);
      if (!repoInfo.owner || !repoInfo.name) {
        return false;
      }

      const apiUrl = `${server.baseUrl}/api/v1/repos/${repoInfo.owner}/${repoInfo.name}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (credentials.method === 'token' && credentials.token) {
        headers['Authorization'] = `token ${credentials.token}`;
      } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract repository information from Git URL
   */
  private extractRepoInfoFromUrl(url: string): { owner: string; name: string } {
    try {
      const parsed = gitUrlParse(url);
      return {
        owner: parsed.owner || '',
        name: parsed.name || ''
      };
    } catch (error) {
      console.error('Failed to parse repository URL:', error);
      return { owner: '', name: '' };
    }
  }

  /**
   * Check if an owner is an organization by querying Gitea API
   */
  private async isOrganization(server: GitServerConfig, credentials: GitServerCredentials, owner: string): Promise<boolean> {
    try {
      const apiUrl = `${server.baseUrl}/api/v1/orgs/${owner}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (credentials.method === 'token' && credentials.token) {
        headers['Authorization'] = `token ${credentials.token}`;
      } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create repository using Gitea API with organization support
   */
  async createRepository(server: GitServerConfig, credentials: GitServerCredentials, config: any): Promise<any> {
    try {
      console.log('Creating repository with config:', config);
      console.log('Full URL being parsed:', config.url);
      const repoInfo = this.extractRepoInfoFromUrl(config.url);
      console.log('Extracted repo info:', repoInfo);
      const owner = repoInfo.owner;

      // Determine if we should create in organization or user context
      const isOrg = owner ? await this.isOrganization(server, credentials, owner) : false;
      console.log(`Owner: ${owner}, Is Organization: ${isOrg}`);

      // Choose appropriate API endpoint
      const apiUrl = isOrg
        ? `${server.baseUrl}/api/v1/orgs/${owner}/repos`
        : `${server.baseUrl}/api/v1/user/repos`;

      console.log('Using API URL:', apiUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (credentials.method === 'token' && credentials.token) {
        headers['Authorization'] = `token ${credentials.token}`;
      } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      console.log(`Creating Gitea repository at ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoInfo.name || config.name,
          description: config.description || '',
          private: config.isPrivate || false,
          auto_init: false
        }),
      });

      if (response.ok) {
        const repoData = await response.json();
        console.log('Repository created successfully:', repoData.full_name);
        return repoData;
      } else if (response.status === 409) {
        // Repository already exists - try to fetch existing repository info
        console.warn(`Repository ${owner}/${repoInfo.name} already exists, attempting to fetch existing repository info`);

        try {
          const existingRepoUrl = `${server.baseUrl}/api/v1/repos/${owner}/${repoInfo.name}`;
          const existingResponse = await fetch(existingRepoUrl, {
            method: 'GET',
            headers,
          });

          if (existingResponse.ok) {
            const existingRepo = await existingResponse.json();
            console.log('Found existing repository:', existingRepo.full_name);
            return existingRepo;
          } else {
            throw new Error(`Repository ${owner}/${repoInfo.name} exists but cannot be accessed. You may not have sufficient permissions.`);
          }
        } catch (fetchError: any) {
          throw new Error(`Repository ${owner}/${repoInfo.name} already exists but cannot be accessed: ${fetchError.message}`);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to create repository: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error: any) {
      throw new Error(`Gitea repository creation failed: ${error.message}`);
    }
  }

  /**
   * Extract repository information from Git URL (legacy method for backward compatibility)
   */
  extractRepoInfoFromGit(gitUrl: string): { owner: string; repo: string } {
    const repoInfo = this.extractRepoInfoFromUrl(gitUrl);
    return {
      owner: repoInfo.owner,
      repo: repoInfo.name
    };
  }

  /**
   * Set the default branch for a repository
   */
  async setDefaultBranch(owner: string, repo: string, branchName: string, server: GitServerConfig, credentials: GitServerCredentials): Promise<void> {
    const apiUrl = `${server.baseUrl}/api/v1/repos/${owner}/${repo}`;
    
    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${credentials.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ default_branch: branchName })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to set default branch: ${response.status}`);
    }
  }
}