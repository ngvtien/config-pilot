import { HelmOCICredentialManager } from './helm-oci-credential-manager'
import { Environment } from '../../shared/types/context-data'

export class HelmOCIApiService {
  static async testConnection(environment: Environment, registryUrl: string, authMethod: string, username?: string, password?: string, token?: string, insecureSkipTLSVerify?: boolean): Promise<boolean> {
    return HelmOCICredentialManager.testConnection(environment, registryUrl, authMethod, username, password, token, insecureSkipTLSVerify)
  }

  static async getRepositories(environment: Environment): Promise<any[]> {
    return HelmOCICredentialManager.getRepositories(environment)
  }

  static async searchCharts(environment: Environment, query?: string): Promise<any[]> {
    return HelmOCICredentialManager.searchCharts(environment, query)
  }

  static async getChartVersions(environment: Environment, chartName: string): Promise<any[]> {
    return HelmOCICredentialManager.getChartVersions(environment, chartName)
  }

  static async pullChart(environment: Environment, chartName: string, version: string, destination?: string): Promise<string> {
    return HelmOCICredentialManager.pullChart(environment, chartName, version, destination)
  }

  static async inspectChart(environment: Environment, chartName: string, version?: string): Promise<any> {
    return HelmOCICredentialManager.inspectChart(environment, chartName, version)
  }

  static async addRepository(environment: Environment, name: string, url: string): Promise<boolean> {
    return HelmOCICredentialManager.addRepository(environment, name, url)
  }

  static async removeRepository(environment: Environment, name: string): Promise<boolean> {
    return HelmOCICredentialManager.removeRepository(environment, name)
  }
}