import { ArgoCDCredentialManager } from './argocd-credential-manager'

export class ArgoCDApiService {
  // Connection testing
  static async testConnection(environment: string, url: string, token: string, insecureSkipTLSVerify = false) {
    return ArgoCDCredentialManager.testConnection(environment, url, token, insecureSkipTLSVerify)
  }

  // Application operations
  static async getApplications(environment: string) {
    return ArgoCDCredentialManager.getApplications(environment)
  }

  static async getApplication(environment: string, name: string) {
    return ArgoCDCredentialManager.getApplication(environment, name)
  }

  static async syncApplication(environment: string, name: string) {
    return ArgoCDCredentialManager.syncApplication(environment, name)
  }

  static async createApplication(environment: string, application: any) {
    return ArgoCDCredentialManager.createApplication(environment, application)
  }

  static async updateApplication(environment: string, name: string, application: any) {
    return ArgoCDCredentialManager.updateApplication(environment, name, application)
  }

  static async deleteApplication(environment: string, name: string) {
    return ArgoCDCredentialManager.deleteApplication(environment, name)
  }
}