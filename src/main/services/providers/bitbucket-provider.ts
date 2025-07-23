import { GitServerConfig, GitServerCredentials, GitServerValidationResult } from '../../../shared/types/git-repository';

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
      // Extract project and repo from URL
      const urlParts = repositoryUrl.replace(server.baseUrl, '').split('/');
      const project = urlParts[2]; // /scm/PROJECT/repo.git
      const repo = urlParts[3]?.replace('.git', '');

      if (!project || !repo) {
        return false;
      }

      const apiUrl = `${server.baseUrl}/rest/api/1.0/projects/${project}/repos/${repo}`;
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
   * Create repository using Bitbucket Server API
   */
  async createRepository(server: GitServerConfig, credentials: GitServerCredentials, config: any): Promise<any> {
    try {
      // Bitbucket requires a project key, use a default or extract from config
      const projectKey = config.projectKey || 'DEFAULT';
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

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: config.name,
          description: config.description || '',
          public: !config.isPrivate,
          scmId: 'git'
        }),
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Failed to create repository: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      throw new Error(`Bitbucket repository creation failed: ${error.message}`);
    }
  }
}