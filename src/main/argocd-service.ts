import axios, { type AxiosInstance, type CreateAxiosDefaults } from 'axios'
import https from 'https'
import { ArgoCDCredentialManager } from './argocd-credential-manager.js'
import { Environment } from '../shared/types/context-data.js'

export interface ArgoCDApplication {
    metadata: {
        name: string
        namespace: string
    }
    spec: {
        project: string
        source: {
            repoURL: string
            path: string
            targetRevision: string
        }
        destination: {
            server: string
            namespace: string
        }
        syncPolicy?: {
            automated?: {
                prune: boolean
                selfHeal: boolean
            }
        }
    }
    status?: {
        health: {
            status: string
        }
        sync: {
            status: string
        }
    }
}

export class ArgoCDService {
    private clients = new Map<string, AxiosInstance>()

    private async getArgoCDClient(environment: Environment): Promise<AxiosInstance> {
        const existingClient = this.clients.get(environment.toString())
        if (existingClient) {
            return existingClient
        }

        const credentials = await ArgoCDCredentialManager.getCredentials(environment)
        if (!credentials) {
            throw new Error(`No ArgoCD credentials found for environment: ${environment}`)
        }

        const config: CreateAxiosDefaults = {
            baseURL: credentials.url,
            headers: {
                'Authorization': `Bearer ${credentials.token}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: !credentials.insecureSkipTLSVerify
            })
        }

        const client = axios.create(config)
        this.clients.set(environment, client)
        return client
    }

    async testConnection(environment: Environment, url: string, token: string, insecureSkipTLSVerify = false): Promise<boolean> {
        try {
            const config: CreateAxiosDefaults = {
                baseURL: url,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: !insecureSkipTLSVerify
                }),
                timeout: 10000
            }

            const client = axios.create(config)
            const response = await client.get('/api/v1/version')
            return response.status === 200
        } catch (error) {
            console.error(`ArgoCD connection test failed for ${environment}:`, error)
            return false
        }
    }

    async getApplications(environment: Environment): Promise<ArgoCDApplication[]> {
        try {
            const client = await this.getArgoCDClient(environment)
            const response = await client.get('/api/v1/applications')
            return response.data.items || []
        } catch (error) {
            console.error(`Failed to get ArgoCD applications for ${environment}:`, error)
            throw error
        }
    }

    async getApplication(environment: Environment, name: string): Promise<ArgoCDApplication> {
        try {
            const client = await this.getArgoCDClient(environment)
            const response = await client.get(`/api/v1/applications/${name}`)
            return response.data
        } catch (error) {
            console.error(`Failed to get ArgoCD application ${name} for ${environment}:`, error)
            throw error
        }
    }

    async syncApplication(environment: Environment, name: string): Promise<boolean> {
        try {
            const client = await this.getArgoCDClient(environment)
            const response = await client.post(`/api/v1/applications/${name}/sync`)
            return response.status === 200
        } catch (error) {
            console.error(`Failed to sync ArgoCD application ${name} for ${environment}:`, error)
            throw error
        }
    }

    async createApplication(environment: Environment, application: ArgoCDApplication): Promise<ArgoCDApplication> {
        try {
            const client = await this.getArgoCDClient(environment)
            const response = await client.post('/api/v1/applications', application)
            return response.data
        } catch (error) {
            console.error(`Failed to create ArgoCD application for ${environment}:`, error)
            throw error
        }
    }

    async updateApplication(environment: Environment, name: string, application: ArgoCDApplication): Promise<ArgoCDApplication> {
        try {
            const client = await this.getArgoCDClient(environment)
            const response = await client.put(`/api/v1/applications/${name}`, application)
            return response.data
        } catch (error) {
            console.error(`Failed to update ArgoCD application ${name} for ${environment}:`, error)
            throw error
        }
    }

    async deleteApplication(environment: Environment, name: string): Promise<boolean> {
        try {
            const client = await this.getArgoCDClient(environment)
            const response = await client.delete(`/api/v1/applications/${name}`)
            return response.status === 200
        } catch (error) {
            console.error(`Failed to delete ArgoCD application ${name} for ${environment}:`, error)
            throw error
        }
    }
}