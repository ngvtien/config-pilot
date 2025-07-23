import { GitServerConfig, GitServerCredentials, GitServerValidationResult } from '../../../shared/types/git-repository';
import { CreateRepositoryConfig } from '../git-service';

/**
 * Gitea provider implementation for simple token-based authentication
 * Supports personal access tokens and basic authentication
 */
export class GiteaProvider {
  /**
   * Test authentication with Gitea server using personal access token or credentials
   */
  async testAuthentication(server: GitServerConfig, credentials: GitServerCredentials): Promise<GitServerValidationResult> {
    try {
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

      // Remove timeout property - use AbortController instead
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`HTTP Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const userInfo = await response.json();
        console.log('Gitea authentication successful, user data:', { login: userInfo.login, full_name: userInfo.full_name });

        return {
          isValid: true,
          authStatus: 'success',
          canConnect: true,
          userInfo: {
            username: userInfo.login || userInfo.username,
            email: userInfo.email,
            name: userInfo.full_name || userInfo.name
          }
        };
      } else {
        const errorText = await response.text();
        console.error(`Gitea authentication failed with status ${response.status}:`, errorText);
        return {
          isValid: false,
          authStatus: 'failed',
          error: `Authentication failed: ${response.status} ${response.statusText}`,
          canConnect: true
        };
      }
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
   * Test repository access using server credentials
   */
  async testRepositoryAccess(server: GitServerConfig, credentials: GitServerCredentials, repositoryUrl: string): Promise<boolean> {
    try {
      // Extract owner and repo from URL
      const urlParts = repositoryUrl.replace(server.baseUrl, '').split('/');
      const owner = urlParts[1];
      const repo = urlParts[2]?.replace('.git', '');

      if (!owner || !repo) {
        return false;
      }

      const apiUrl = `${server.baseUrl}/api/v1/repos/${owner}/${repo}`;
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
        //timeout: 10000
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create repository using Gitea API
   */
  async createRepository(server: GitServerConfig, credentials: GitServerCredentials, config: any): Promise<any> {
    try {
      const apiUrl = `${server.baseUrl}/api/v1/user/repos`;
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
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: config.name,
          description: config.description || '',
          private: config.isPrivate || false,
          auto_init: config.autoInit || false,
          gitignores: config.gitignoreTemplate || '',
          license: config.licenseTemplate || ''
        }),
        //timeout: 10000
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Failed to create repository: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      throw new Error(`Gitea repository creation failed: ${error.message}`);
    }
  }
}