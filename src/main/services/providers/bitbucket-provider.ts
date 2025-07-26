import { GitServerConfig, GitServerCredentials, GitServerValidationResult } from '../../../shared/types/git-repository';
import gitUrlParse from 'git-url-parse';

/**
 * Bitbucket on-premise provider implementation for simple authentication
 * Supports personal access tokens and basic authentication
 */
export class BitbucketProvider {
  /**
   * Test authentication with Bitbucket server using app password or credentials
   */
  async testAuthentication(server: GitServerConfig, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
    try {
      // Bitbucket Server API endpoint
      const apiUrl = `${server.baseUrl}/rest/api/1.0/users/${credentials.username || 'current'}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add authentication header based on method
      if (credentials.method === 'token' && credentials.token && credentials.username) {
        // For Bitbucket, token is typically an app password used with username
        const auth = Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
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

      console.log(`Testing Bitbucket authentication for ${credentials.username} at ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        //timeout: 10000
      });

      console.log(`HTTP Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const userData = await response.json();
        console.log('Authentication successful, user data:', { name: userData.name, displayName: userData.displayName });

        return {
          isValid: true,
          authStatus: 'success',
          canConnect: true,
          userInfo: {
            username: userData.name,
            name: userData.displayName,
            email: userData.emailAddress
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
      console.error('Bitbucket authentication error:', error);
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
      if (!repoInfo.project || !repoInfo.repo) {
        return false;
      }

      const apiUrl = `${server.baseUrl}/rest/api/1.0/projects/${repoInfo.project}/repos/${repoInfo.repo}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (credentials.method === 'token' && credentials.token && credentials.username) {
        const auth = Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
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
   * Extract repository information from Bitbucket URL
   */
  private extractRepoInfoFromUrl(url: string): { project: string; repo: string } {
    try {
      const parsed = gitUrlParse(url);

      // Handle Bitbucket Server URLs which typically have /scm/PROJECT/repo.git format
      if (parsed.pathname.includes('/scm/')) {
        const pathParts = parsed.pathname.split('/');
        const scmIndex = pathParts.indexOf('scm');
        if (scmIndex >= 0 && pathParts.length > scmIndex + 2) {
          return {
            project: pathParts[scmIndex + 1],
            repo: pathParts[scmIndex + 2].replace('.git', '')
          };
        }
      }

      // Fallback to standard git-url-parse owner/name
      return {
        project: parsed.owner || '',
        repo: parsed.name || ''
      };
    } catch (error) {
      console.error('Failed to parse Bitbucket repository URL:', error);
      return { project: '', repo: '' };
    }
  }

  /**
   * Create repository using Bitbucket Server API with project support
   */
  async createRepository(server: GitServerConfig, credentials: GitServerCredentials, config: any): Promise<any> {
    try {
      const repoInfo = this.extractRepoInfoFromUrl(config.url);
      const projectKey = repoInfo.project || config.projectKey || 'DEFAULT';

      const apiUrl = `${server.baseUrl}/rest/api/1.0/projects/${projectKey}/repos`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (credentials.method === 'token' && credentials.token && credentials.username) {
        const auth = Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      console.log(`Creating Bitbucket repository in project ${projectKey} at ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoInfo.repo || config.name,
          description: config.description || '',
          public: !config.isPrivate,
          scmId: 'git'
        }),
      });

      if (response.ok) {
        const repoData = await response.json();
        console.log('Bitbucket repository created successfully:', repoData.name);
        return repoData;
      } else if (response.status === 409) {
        // Repository already exists - try to fetch existing repository info
        console.warn(`Repository ${projectKey}/${repoInfo.repo} already exists, attempting to fetch existing repository info`);

        try {
          const existingRepoUrl = `${server.baseUrl}/rest/api/1.0/projects/${projectKey}/repos/${repoInfo.repo}`;
          const existingResponse = await fetch(existingRepoUrl, {
            method: 'GET',
            headers,
          });

          if (existingResponse.ok) {
            const existingRepo = await existingResponse.json();
            console.log('Found existing Bitbucket repository:', existingRepo.name);
            return existingRepo;
          } else {
            throw new Error(`Repository ${projectKey}/${repoInfo.repo} exists but cannot be accessed. You may not have sufficient permissions.`);
          }
        } catch (fetchError: any) {
          throw new Error(`Repository ${projectKey}/${repoInfo.repo} already exists but cannot be accessed: ${fetchError.message}`);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to create repository: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error: any) {
      throw new Error(`Bitbucket repository creation failed: ${error.message}`);
    }
  }

  /**
   * Set the default branch for a Bitbucket repository
   * Uses Bitbucket Server REST API v1.0
   */
  async setDefaultBranch(project: string, repo: string, branchName: string, server: GitServerConfig, credentials: GitServerCredentials): Promise<void> {
    try {
      // Bitbucket Server API endpoint for updating repository settings
      const apiUrl = `${server.baseUrl}/rest/api/1.0/projects/${project}/repos/${repo}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add authentication header
      if (credentials.method === 'token' && credentials.token && credentials.username) {
        const auth = Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else if (credentials.method === 'credentials' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else {
        throw new Error('Invalid authentication method or missing credentials');
      }

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          defaultBranch: branchName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to set default branch: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log(`✅ Successfully set default branch to '${branchName}' for ${project}/${repo}`);
    } catch (error: any) {
      throw new Error(`Bitbucket setDefaultBranch failed: ${error.message}`);
    }
  }

}