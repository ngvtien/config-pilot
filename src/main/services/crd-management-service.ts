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

export class CRDManagementService {
    private kubeConfig: KubeConfig
    private customApi: CustomObjectsApi
    private apiExtensionsApi: ApiextensionsV1Api
    private storageDir: string
    private importedCRDs: Map<string, CRDSchema> = new Map()
    private initialized: boolean = false

    constructor(kubeConfigPath?: string, storageDir?: string) {
        this.kubeConfig = new KubeConfig()

        if (kubeConfigPath) {
            this.kubeConfig.loadFromFile(kubeConfigPath)
        } else {
            this.kubeConfig.loadFromDefault()
        }

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

    async discoverClusterCRDs(): Promise<CRDSchema[]> {
        await this.ensureInitialized()
        try {
            const response = await this.apiExtensionsApi.listCustomResourceDefinition()
            const crds: CRDSchema[] = []

            for (const crdDef of response.items) {
                const crdSchema = this.convertToCRDSchema(crdDef, {
                    name: crdDef.spec.names.kind,
                    source: 'cluster'
                })
                crds.push(crdSchema)
            }

            return crds
        } catch (error) {
            console.error('Failed to discover cluster CRDs:', error)
            return []
        }
    }
}

export const crdManagementService = new CRDManagementService()