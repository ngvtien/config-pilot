import { KubeConfig, CustomObjectsApi, ApiextensionsV1Api, V1CustomResourceDefinition } from '@kubernetes/client-node'
import type {
    CRDImportRequest,
    CRDSchema,
    ValidationResult,
    GroupedCRDs,
    CRDSource
} from '@/shared/types/kubernetes'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { exec } from 'child_process'
import { promisify } from 'util'


const execAsync = promisify(exec)

export class CRDManagementService {
    private kubeConfig: KubeConfig
    private customApi: CustomObjectsApi
    private apiExtensionsApi: ApiextensionsV1Api
    private storageDir: string
    private importedCRDs: Map<string, CRDSchema> = new Map()
    private initialized: boolean = false

    constructor(kubeConfigPath?: string, storageDir?: string) {
        
        // // Temporarily disable TLS verification for local development
        // const originalTLSReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
        // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        this.kubeConfig = new KubeConfig()

        if (kubeConfigPath) {
            this.kubeConfig.loadFromFile(kubeConfigPath)
        } else {
            this.kubeConfig.loadFromDefault()
        }

    // // Check if we're connecting to a local cluster using HTTP
    // const currentCluster = this.kubeConfig.getCurrentCluster()
    // const isHTTPCluster = currentCluster && currentCluster.server.startsWith('http://')
    
    // if (isHTTPCluster) {
    //     // For HTTP clusters, we need to set insecure-skip-tls-verify to true
    //     // This modifies the cluster configuration directly
    //     const clusters = this.kubeConfig.clusters
    //     //const currentClusterName = this.kubeConfig.getCurrentContext()?.cluster
    //     const currentClusterName = this.kubeConfig.getCurrentCluster.name; //.getCurrentContext()?.cluster
        
    //     if (currentClusterName) {
    //         const cluster = clusters.find(c => c.name === currentClusterName)
    //         if (cluster) {
    //             // Set the insecure-skip-tls-verify flag for HTTP clusters
    //             (cluster as any).skipTLSVerify = true
    //             console.log('🔓 Enabled insecure TLS skip for HTTP cluster:', cluster.server)
    //         }
    //     }
    // }

        this.customApi = this.kubeConfig.makeApiClient(CustomObjectsApi)
        this.apiExtensionsApi = this.kubeConfig.makeApiClient(ApiextensionsV1Api)
        this.storageDir = storageDir || path.join(process.cwd(), 'data', 'crds')

        // Initialize asynchronously
        this.initialize()
    }

    private async initialize(): Promise<void> {
        try {
            await this.initializeStorage()
            await this.loadStoredCRDs()
            this.initialized = true
        } catch (error) {
            console.error('Failed to initialize CRD Management Service:', error)
        }
    }

    private async initializeStorage(): Promise<void> {
        try {
            await fs.mkdir(this.storageDir, { recursive: true })
        } catch (error) {
            console.error('Failed to initialize CRD storage directory:', error)
            throw error
        }
    }

    private async loadStoredCRDs(): Promise<void> {
        try {
            // Check if directory exists first
            try {
                await fs.access(this.storageDir)
            } catch {
                // Directory doesn't exist, which is fine for first run
                return
            }

            const files = await fs.readdir(this.storageDir)
            const crdFiles = files.filter(file => file.endsWith('.json'))

            for (const file of crdFiles) {
                const filePath = path.join(this.storageDir, file)
                const content = await fs.readFile(filePath, 'utf-8')
                const crd: CRDSchema = JSON.parse(content)
                this.importedCRDs.set(crd.id, crd)
            }
        } catch (error) {
            console.error('Failed to load stored CRDs:', error)
        }
    }

    // Add a method to ensure initialization is complete
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize()
        }
    }

    async importCRD(request: CRDImportRequest): Promise<CRDSchema> {
        await this.ensureInitialized()
        let crdDefinition: any

        // Fetch CRD based on source type
        switch (request.source) {
            case 'url':
                crdDefinition = await this.fetchCRDFromURL(request.url!)
                break
            case 'file':
                crdDefinition = await this.loadCRDFromFile(request.file!)
                break
            case 'cluster':
                crdDefinition = await this.fetchCRDFromCluster(request.name, request.namespace)
                break
            default:
                throw new Error(`Unsupported source type: ${request.source}`)
        }

        // Validate CRD
        const validation = await this.validateCRD(crdDefinition)
        if (!validation.isValid) {
            throw new Error(`Invalid CRD: ${validation.errors.map(e => e.message).join(', ')}`)
        }

        // Convert to CRDSchema
        const crdSchema = this.convertToCRDSchema(crdDefinition, request)

        // Store CRD
        await this.storeCRD(crdSchema)
        this.importedCRDs.set(crdSchema.id, crdSchema)

        return crdSchema
    }

    private async fetchCRDFromURL(url: string): Promise<any> {
        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to fetch CRD from URL: ${response.statusText}`)
            }

            const content = await response.text()
            return this.parseCRDContent(content)
        } catch (error) {
            throw new Error(`Failed to fetch CRD from URL: ${error}`)
        }
    }

    private async loadCRDFromFile(file: File): Promise<any> {
        try {
            const content = await file.text()
            return this.parseCRDContent(content)
        } catch (error) {
            throw new Error(`Failed to load CRD from file: ${error}`)
        }
    }

    private async fetchCRDFromCluster(name: string, namespace?: string): Promise<any> {
        try {
            const response = await this.apiExtensionsApi.readCustomResourceDefinition({
                name,
            }) as V1CustomResourceDefinition
            return response.spec
        } catch (error) {
            throw new Error(`Failed to fetch CRD from cluster: ${error}`)
        }
    }

    private parseCRDContent(content: string): any {
        try {
            // Try JSON first
            return JSON.parse(content)
        } catch {
            try {
                // Try YAML
                return yaml.load(content)
            } catch (error) {
                throw new Error(`Failed to parse CRD content: ${error}`)
            }
        }
    }

    async validateCRD(crdDefinition: any): Promise<ValidationResult> {
        const errors: any[] = []
        const warnings: any[] = []

        // Basic validation
        if (!crdDefinition.apiVersion || !crdDefinition.kind) {
            errors.push({
                path: 'root',
                message: 'Missing required fields: apiVersion and kind',
                code: 'MISSING_REQUIRED_FIELDS'
            })
        }

        if (crdDefinition.kind !== 'CustomResourceDefinition') {
            errors.push({
                path: 'kind',
                message: 'Expected kind to be CustomResourceDefinition',
                code: 'INVALID_KIND'
            })
        }

        if (!crdDefinition.spec?.group || !crdDefinition.spec?.names?.kind) {
            errors.push({
                path: 'spec',
                message: 'Missing required spec fields: group and names.kind',
                code: 'MISSING_SPEC_FIELDS'
            })
        }

        // Schema validation
        if (!crdDefinition.spec?.versions || !Array.isArray(crdDefinition.spec.versions)) {
            errors.push({
                path: 'spec.versions',
                message: 'Missing or invalid versions array',
                code: 'INVALID_VERSIONS'
            })
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    private convertToCRDSchema(crdDefinition: any, request: CRDImportRequest): CRDSchema {
        const spec = crdDefinition.spec
        const names = spec.names
        const latestVersion = spec.versions[spec.versions.length - 1]

        return {
            id: `${spec.group}/${names.kind}`,
            name: request.name || names.kind,
            description: request.description || crdDefinition.metadata?.annotations?.['description'],
            group: spec.group,
            version: latestVersion.name,
            kind: names.kind,
            plural: names.plural,
            scope: spec.scope,
            schema: latestVersion.schema?.openAPIV3Schema || {},
            source: {
                type: request.source,
                location: request.url || request.file?.name || 'cluster',
                lastFetched: new Date()
            },
            importedAt: new Date(),
            isActive: true
        }
    }

    private async storeCRD(crd: CRDSchema): Promise<void> {
        try {
            const fileName = `${crd.group}-${crd.kind}.json`
            const filePath = path.join(this.storageDir, fileName)
            await fs.writeFile(filePath, JSON.stringify(crd, null, 2))
        } catch (error) {
            console.error('Failed to store CRD:', error)
        }
    }

    async listImportedCRDs(): Promise<CRDSchema[]> {
        await this.ensureInitialized()
        return Array.from(this.importedCRDs.values())
    }

    async getCRDsByGroup(): Promise<GroupedCRDs> {
        await this.ensureInitialized()
        const grouped: GroupedCRDs = {}

        for (const crd of this.importedCRDs.values()) {
            const groupVersion = `${crd.group}/${crd.version}`

            if (!grouped[groupVersion]) {
                grouped[groupVersion] = {
                    group: crd.group,
                    version: crd.version,
                    crds: []
                }
            }

            grouped[groupVersion].crds.push(crd)
        }

        return grouped
    }

    async deleteCRD(id: string): Promise<void> {
        await this.ensureInitialized()
        const crd = this.importedCRDs.get(id)
        if (!crd) {
            throw new Error(`CRD not found: ${id}`)
        }

        // Remove from memory
        this.importedCRDs.delete(id)

        // Remove from storage
        try {
            const fileName = `${crd.group}-${crd.kind}.json`
            const filePath = path.join(this.storageDir, fileName)
            await fs.unlink(filePath)
        } catch (error) {
            console.error('Failed to delete CRD file:', error)
        }
    }

    async updateCRD(id: string, updates: Partial<CRDSchema>): Promise<CRDSchema> {
        await this.ensureInitialized()
        const crd = this.importedCRDs.get(id)
        if (!crd) {
            throw new Error(`CRD not found: ${id}`)
        }

        const updatedCRD = { ...crd, ...updates, lastUsed: new Date() }
        this.importedCRDs.set(id, updatedCRD)
        await this.storeCRD(updatedCRD)

        return updatedCRD
    }

    // async discoverClusterCRDs(): Promise<CRDSchema[]> {
    //     await this.ensureInitialized()
    //     try {
    //         const response = await this.apiExtensionsApi.listCustomResourceDefinition()
    //         const crds: CRDSchema[] = []

    //         for (const crdDef of response.items) {
    //             const crdSchema = this.convertToCRDSchema(crdDef, {
    //                 name: crdDef.spec.names.kind,
    //                 source: 'cluster'
    //             })
    //             crds.push(crdSchema)
    //         }

    //         return crds
    //     } catch (error) {
    //         console.error('Failed to discover cluster CRDs:', error)
    //         return []
    //     }
    // }

    async discoverClusterCRDs(): Promise<CRDSchema[]> {
        try {
            console.log('🔍 Discovering CRDs from cluster using Kubernetes client...')
            
            // Get the current cluster configuration
            const currentCluster = this.kubeConfig.getCurrentCluster()
            if (!currentCluster) {
                throw new Error('No current cluster found in kubeconfig')
            }
            
            console.log(`🔗 Connecting to cluster: ${currentCluster.server}`)
            
            let apiExtensionsApi: ApiextensionsV1Api
            
            // For local clusters (localhost, 127.0.0.1) or HTTP endpoints, configure TLS verification
            if (currentCluster.server.includes('localhost') || 
                currentCluster.server.includes('127.0.0.1') ||
                currentCluster.server.startsWith('http://')) {
                
                console.log('🔧 Configuring client for local/WSL cluster with TLS verification disabled')
                
                // Get current user and context for proper authentication
                const currentUser = this.kubeConfig.getCurrentUser()
                const currentContext = this.kubeConfig.getCurrentContext()
                
                if (!currentUser || !currentContext) {
                    throw new Error('No current user or context found in kubeconfig')
                }
                
                // Create a new cluster configuration with proper insecure settings
                const modifiedCluster = {
                    name: 'temp-cluster',
                    server: currentCluster.server,
                    'insecure-skip-tls-verify': true
                }
                
                // Create a new kubeconfig with the modified cluster but preserve user auth
                const tempKubeConfig = new KubeConfig()
                const configData = {
                    apiVersion: 'v1',
                    kind: 'Config',
                    clusters: [{
                        name: 'temp-cluster',
                        cluster: modifiedCluster
                    }],
                    users: [{
                        name: 'temp-user',
                        user: currentUser // Preserve the original user credentials
                    }],
                    contexts: [{
                        name: 'temp-context',
                        context: {
                            cluster: 'temp-cluster',
                            user: 'temp-user'
                        }
                    }],
                    'current-context': 'temp-context'
                }
                
                tempKubeConfig.loadFromString(JSON.stringify(configData))
                
                // Create a temporary API client with the modified configuration
                apiExtensionsApi = tempKubeConfig.makeApiClient(ApiextensionsV1Api)
            } else {
                // For remote clusters, use the original configuration
                console.log('🔧 Using standard cluster configuration')
                apiExtensionsApi = this.kubeConfig.makeApiClient(ApiextensionsV1Api)
            }
            
            // List all CRDs using the appropriate client
            const response = await apiExtensionsApi.listCustomResourceDefinition()
            const crds = response.items || []
            
            console.log(`📋 Found ${crds.length} CRDs in cluster`)
            
            const crdSchemas: CRDSchema[] = []
            
            for (const crd of crds) {
                try {
                    const crdSchema = this.convertToCRDSchema(crd, {
                        name: crd.spec.names.kind,
                        source: 'cluster'
                    })
                    if (crdSchema) {
                        crdSchemas.push(crdSchema)
                        console.log(`✅ Converted CRD: ${crdSchema.group}/${crdSchema.version}/${crdSchema.kind}`)
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to convert CRD ${crd.metadata?.name}:`, error)
                }
            }
            
            console.log(`🎉 Successfully discovered ${crdSchemas.length} CRDs from cluster`)
            return crdSchemas
            
        } catch (error) {
            console.error('❌ Failed to discover cluster CRDs:', error)
            
            // Provide helpful error messages based on the error type
            if (error instanceof Error) {
                if (error.message.includes('ECONNREFUSED')) {
                    console.error('💡 Connection refused - check if your Kubernetes cluster is running')
                    console.error('💡 For WSL clusters, ensure the cluster is accessible from Windows')
                    console.error(`💡 Cluster endpoint: ${this.kubeConfig.getCurrentCluster()?.server}`)
                } else if (error.message.includes('certificate') || error.message.includes('TLS')) {
                    console.error('💡 TLS/Certificate error - the cluster configuration may need adjustment')
                } else if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
                    console.error('💡 Authentication/Authorization error - check your kubeconfig credentials')
                }
            }
            
            return []
        }
    }
}

export const crdManagementService = new CRDManagementService()