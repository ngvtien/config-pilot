export class ArgoCDCredentialManager {
  static async storeCredentials(environment: string, credentials: {
    url: string
    token?: string
    username?: string
    password?: string
    authMethod: 'token' | 'username' | 'sso'
    insecureSkipTLSVerify?: boolean
  }): Promise<void> {
    await window.electronAPI.argocd.storeCredentials(environment, credentials)
  }

  static async getCredentials(environment: string): Promise<{
    url: string
    token?: string
    username?: string
    password?: string
    authMethod: 'token' | 'username' | 'sso'
    insecureSkipTLSVerify?: boolean
  } | null> {
    return await window.electronAPI.argocd.getCredentials(environment)
  }

  static async testConnection(environment: string, url: string, token: string, insecureSkipTLSVerify = false): Promise<boolean> {
    return await window.electronAPI.argocd.testConnection(environment, url, token, insecureSkipTLSVerify)
  }

  static async getApplications(environment: string) {
    return await window.electronAPI.argocd.getApplications(environment)
  }

  static async getApplication(environment: string, name: string) {
    return await window.electronAPI.argocd.getApplication(environment, name)
  }

  static async syncApplication(environment: string, name: string): Promise<boolean> {
    return await window.electronAPI.argocd.syncApplication(environment, name)
  }

  static async createApplication(environment: string, application: any) {
    return await window.electronAPI.argocd.createApplication(environment, application)
  }

  static async updateApplication(environment: string, name: string, application: any) {
    return await window.electronAPI.argocd.updateApplication(environment, name, application)
  }

  static async deleteApplication(environment: string, name: string): Promise<boolean> {
    return await window.electronAPI.argocd.deleteApplication(environment, name)
  }
}