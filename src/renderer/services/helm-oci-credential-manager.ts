import { Environment } from '../../shared/types/context-data'

interface HelmOCICredentials {
  registryUrl: string
  authMethod: 'token' | 'username' | 'anonymous' | 'aws' | 'gcp' | 'azure'
  username?: string
  password?: string
  token?: string
  insecureSkipTLSVerify?: boolean
  // Cloud provider specific
  awsRegion?: string
  gcpProject?: string
  azureSubscription?: string
}

export class HelmOCICredentialManager {
  static async storeCredentials(environment: Environment, credentials: HelmOCICredentials): Promise<void> {
    await window.electronAPI.helmOCI.storeCredentials(environment, credentials)
  }

  static async getCredentials(environment: Environment): Promise<HelmOCICredentials | null> {
    return await window.electronAPI.helmOCI.getCredentials(environment)
  }

  static async hasStoredCredentials(environment: Environment): Promise<boolean> {
    const credentials = await this.getCredentials(environment)
    return credentials !== null
  }

  static async testConnection(environment: Environment, registryUrl: string, authMethod: string, username?: string, password?: string, token?: string, insecureSkipTLSVerify?: boolean): Promise<boolean> {
    return await window.electronAPI.helmOCI.testConnection(environment, registryUrl, authMethod, username, password, token, insecureSkipTLSVerify)
  }

  static async getRepositories(environment: Environment): Promise<any[]> {
    return await window.electronAPI.helmOCI.getRepositories(environment)
  }

  static async searchCharts(environment: Environment, query?: string): Promise<any[]> {
    return await window.electronAPI.helmOCI.searchCharts(environment, query)
  }

  static async getChartVersions(environment: Environment, chartName: string): Promise<any[]> {
    return await window.electronAPI.helmOCI.getChartVersions(environment, chartName)
  }

  static async pullChart(environment: Environment, chartName: string, version: string, destination?: string): Promise<string> {
    return await window.electronAPI.helmOCI.pullChart(environment, chartName, version, destination)
  }

  static async inspectChart(environment: Environment, chartName: string, version?: string): Promise<any> {
    return await window.electronAPI.helmOCI.inspectChart(environment, chartName, version)
  }

  static async addRepository(environment: Environment, name: string, url: string): Promise<boolean> {
    return await window.electronAPI.helmOCI.addRepository(environment, name, url)
  }

  static async removeRepository(environment: Environment, name: string): Promise<boolean> {
    return await window.electronAPI.helmOCI.removeRepository(environment, name)
  }
}