import axios, { type AxiosInstance, type CreateAxiosDefaults } from 'axios'
import https from 'https'
import { HelmOCICredentialManager } from './helm-oci-credential-manager.js'
import { Environment } from '../shared/types/context-data'
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

export interface HelmChart {
  name: string
  version: string
  description?: string
  appVersion?: string
  created?: string
  digest?: string
  urls?: string[]
}

export interface HelmRepository {
  name: string
  url: string
  type: 'oci' | 'http'
}

export interface HelmChartVersion {
  version: string
  appVersion?: string
  created?: string
  description?: string
  digest?: string
}

export class HelmOCIService {
  private clients = new Map<string, AxiosInstance>()

  private async getHelmOCIClient(environment: Environment): Promise<AxiosInstance> {
    const existingClient = this.clients.get(environment.toString())
    if (existingClient) {
      return existingClient
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
  
    const credentials = await HelmOCICredentialManager.getCredentials(environment)
    if (!credentials) {
      throw new Error(`No Helm OCI credentials found for environment: ${environment}`)
    }

    // Add authentication based on auth method
    if (credentials.authMethod === 'token' && credentials.token) {
        headers['Authorization'] = `Bearer ${credentials.token}`
      } else if (credentials.authMethod === 'username' && credentials.username && credentials.password) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
        headers['Authorization'] = `Basic ${auth}`
      }

      const config: CreateAxiosDefaults = {
        baseURL: credentials.registryUrl,
        timeout: 30000,
        headers
      }
  
    // Handle insecure TLS
    if (credentials.insecureSkipTLSVerify) {
      config.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
    }
    const client = axios.create(config)
    this.clients.set(environment, client)
    return client
  }

  async testConnection(environment: Environment, registryUrl: string, authMethod: string, username?: string, password?: string, token?: string, insecureSkipTLSVerify?: boolean): Promise<boolean> {
    try {
      // Test connection using Helm CLI for OCI registries
      let helmCommand = 'helm registry login'
      
      if (authMethod === 'token' && token) {
        helmCommand += ` --password-stdin ${registryUrl} <<< "${token}"`
      } else if (authMethod === 'username' && username && password) {
        helmCommand += ` --username "${username}" --password-stdin ${registryUrl} <<< "${password}"`
      } else if (authMethod === 'anonymous') {
        // For anonymous access, try to list repositories
        helmCommand = `helm search repo --regexp ".*" --max-col-width 0`
      }

      if (insecureSkipTLSVerify) {
        helmCommand += ' --insecure'
      }

      await execPromise(helmCommand)
      return true
    } catch (error) {
      console.error(`Helm OCI connection test failed for ${environment}:`, error)
      return false
    }
  }

  async getRepositories(environment: Environment): Promise<HelmRepository[]> {
    try {
      const { stdout } = await execPromise('helm repo list -o json')
      const repos = JSON.parse(stdout) as HelmRepository[]
      return repos.filter(repo => repo.url.startsWith('oci://'))
    } catch (error) {
      console.error(`Failed to get Helm repositories for ${environment}:`, error)
      throw error
    }
  }

  async searchCharts(environment: Environment, query?: string): Promise<HelmChart[]> {
    try {
      const searchQuery = query || '.*'
      const { stdout } = await execPromise(`helm search repo --regexp "${searchQuery}" -o json --max-col-width 0`)
      return JSON.parse(stdout) as HelmChart[]
    } catch (error) {
      console.error(`Failed to search Helm charts for ${environment}:`, error)
      throw error
    }
  }

  async getChartVersions(environment: Environment, chartName: string): Promise<HelmChartVersion[]> {
    try {
      const { stdout } = await execPromise(`helm search repo ${chartName} --versions -o json --max-col-width 0`)
      const versions = JSON.parse(stdout) as HelmChart[]
      return versions.map(v => ({
        version: v.version,
        appVersion: v.appVersion,
        created: v.created,
        description: v.description,
        digest: v.digest
      }))
    } catch (error) {
      console.error(`Failed to get chart versions for ${chartName} in ${environment}:`, error)
      throw error
    }
  }

  async pullChart(environment: Environment, chartName: string, version: string, destination?: string): Promise<string> {
    try {
      const destPath = destination || './charts'
      const { stdout } = await execPromise(`helm pull ${chartName} --version ${version} --destination ${destPath} --untar`)
      return stdout
    } catch (error) {
      console.error(`Failed to pull chart ${chartName}:${version} for ${environment}:`, error)
      throw error
    }
  }

  async inspectChart(environment: Environment, chartName: string, version?: string): Promise<any> {
    try {
      const versionFlag = version ? `--version ${version}` : ''
      const { stdout } = await execPromise(`helm show chart ${chartName} ${versionFlag}`)
      return stdout
    } catch (error) {
      console.error(`Failed to inspect chart ${chartName} for ${environment}:`, error)
      throw error
    }
  }

  async addRepository(environment: Environment, name: string, url: string): Promise<boolean> {
    try {
      const credentials = await HelmOCICredentialManager.getCredentials(environment)
      let command = `helm repo add ${name} ${url}`
      
      if (credentials?.authMethod === 'username' && credentials.username && credentials.password) {
        command += ` --username "${credentials.username}" --password "${credentials.password}"`
      }
      
      if (credentials?.insecureSkipTLSVerify) {
        command += ' --insecure-skip-tls-verify'
      }
      
      await execPromise(command)
      await execPromise('helm repo update')
      return true
    } catch (error) {
      console.error(`Failed to add repository ${name} for ${environment}:`, error)
      throw error
    }
  }

  async removeRepository(environment: Environment, name: string): Promise<boolean> {
    try {
      await execPromise(`helm repo remove ${name}`)
      return true
    } catch (error) {
      console.error(`Failed to remove repository ${name} for ${environment}:`, error)
      throw error
    }
  }
}