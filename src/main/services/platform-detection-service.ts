import { KubeConfig, CoreV1Api, CustomObjectsApi, ApisApi, VersionApi } from '@kubernetes/client-node'
import type { PlatformSettings } from '@/shared/types/settings-data'

export interface PlatformInfo {
    type: 'kubernetes' | 'openshift'
    version?: string
    features: {
        hasRoutes: boolean
        hasDeploymentConfigs: boolean
        hasBuildConfigs: boolean
        hasImageStreams: boolean
        hasSecurityContextConstraints: boolean
        hasIngressControllers: boolean
    }
    detectedAt: Date
}

export class PlatformDetectionService {
    private kubeConfig: KubeConfig
    private coreApi: CoreV1Api
    private customApi: CustomObjectsApi
    private apisApi: ApisApi
    private versionApi: VersionApi
    private cachedPlatformInfo: PlatformInfo | null = null
    private cacheExpiry: Date | null = null
    private readonly CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

    constructor(kubeConfigPath?: string) {
        this.kubeConfig = new KubeConfig()

        if (kubeConfigPath) {
            this.kubeConfig.loadFromFile(kubeConfigPath)
        } else {
            this.kubeConfig.loadFromDefault()
        }

        this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api)
        this.customApi = this.kubeConfig.makeApiClient(CustomObjectsApi)
        this.apisApi = this.kubeConfig.makeApiClient(ApisApi)
        this.versionApi = this.kubeConfig.makeApiClient(VersionApi)
    }


    async detectPlatform(): Promise<PlatformInfo> {
        // Return cached result if still valid
        if (this.cachedPlatformInfo && this.cacheExpiry && new Date() < this.cacheExpiry) {
            return this.cachedPlatformInfo
        }

        try {
            const platformInfo = await this.performDetection()

            // Cache the result
            this.cachedPlatformInfo = platformInfo
            this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_MS)

            return platformInfo
        } catch (error) {
            console.error('Platform detection failed:', error)

            // Return default Kubernetes platform info on failure
            return {
                type: 'kubernetes',
                features: {
                    hasRoutes: false,
                    hasDeploymentConfigs: false,
                    hasBuildConfigs: false,
                    hasImageStreams: false,
                    hasSecurityContextConstraints: false,
                    hasIngressControllers: true
                },
                detectedAt: new Date()
            }
        }
    }

    private async performDetection(): Promise<PlatformInfo> {
        // Method 1: Check for OpenShift-specific API groups
        const isOpenShift = await this.checkOpenShiftAPIGroups()

        if (isOpenShift) {
            const features = await this.detectOpenShiftFeatures()
            const version = await this.getOpenShiftVersion()

            return {
                type: 'openshift',
                version,
                features,
                detectedAt: new Date()
            }
        } else {
            const features = await this.detectKubernetesFeatures()
            const version = await this.getKubernetesVersion()

            return {
                type: 'kubernetes',
                version,
                features,
                detectedAt: new Date()
            }
        }
    }

    private async checkOpenShiftAPIGroups(): Promise<boolean> {
        try {
            const response = await this.apisApi.getAPIVersions()
            const apiGroups = response.groups || []
            return apiGroups.some(group =>
                group.name === 'route.openshift.io' ||
                group.name === 'build.openshift.io' ||
                group.name === 'image.openshift.io'
            )
        } catch (error: any) {
            if (error.message && error.message.includes('HTTP protocol is not allowed')) {
                console.warn('HTTP connection detected, skipping OpenShift API group check')
                return false // Assume not OpenShift if we can't check securely
            }
            console.error('Failed to check API groups:', error)
            return false
        }
    }

    private async detectOpenShiftFeatures(): Promise<PlatformInfo['features']> {
        const features = {
            hasRoutes: false,
            hasDeploymentConfigs: false,
            hasBuildConfigs: false,
            hasImageStreams: false,
            hasSecurityContextConstraints: false,
            hasIngressControllers: true // OpenShift also supports Ingress
        }

        try {
            // Check for Routes
            try {
                await this.customApi.listClusterCustomObject(
                    {
                        group: 'route.openshift.io',
                        version: 'v1',
                        plural: 'routes',
                        limit: 1
                    }
                )
                features.hasRoutes = true
            } catch { }

            // Check for DeploymentConfigs
            try {
                await this.customApi.listClusterCustomObject({
                    group: 'apps.openshift.io',
                    version: 'v1',
                    plural: 'deploymentconfigs',
                    limit: 1
                })
                features.hasDeploymentConfigs = true
            } catch { }

            // Check for BuildConfigs
            try {
                await this.customApi.listClusterCustomObject({
                    group: 'build.openshift.io',
                    version: 'v1',
                    plural: 'buildconfigs',
                    limit: 1
                })
                features.hasBuildConfigs = true
            } catch { }

            // Check for ImageStreams
            try {
                await this.customApi.listClusterCustomObject(
                    {
                        group: 'image.openshift.io',
                        version: 'v1',
                        plural: 'imagestreams',
                        limit: 1
                    })
                features.hasImageStreams = true
            } catch { }

            // Check for SecurityContextConstraints
            try {
                await this.customApi.listClusterCustomObject({
                    group: 'security.openshift.io',
                    version: 'v1',
                    plural: 'securitycontextconstraints',
                    limit: 1
                })
                features.hasSecurityContextConstraints = true
            } catch { }

        } catch (error) {
            console.warn('Error detecting OpenShift features:', error)
        }

        return features
    }

    private async detectKubernetesFeatures(): Promise<PlatformInfo['features']> {
        const features = {
            hasRoutes: false,
            hasDeploymentConfigs: false,
            hasBuildConfigs: false,
            hasImageStreams: false,
            hasSecurityContextConstraints: false,
            hasIngressControllers: true // Assume Ingress is available in vanilla K8s
        }

        // Vanilla Kubernetes doesn't have OpenShift-specific resources
        // but we can check for other capabilities if needed

        return features
    }

    private async getOpenShiftVersion(): Promise<string | undefined> {
        try {
            // Try to get OpenShift version from cluster version operator
            const { body } = await this.customApi.getClusterCustomObject(
                {
                    group: 'config.openshift.io',
                    version: 'v1',
                    plural: 'clusterversions',
                    name: 'version'
                }
            )

            return (body as any)?.status?.desired?.version
        } catch (error) {
            console.warn('Could not get OpenShift version:', error)
            return undefined
        }
    }


    private async getKubernetesVersion(): Promise<string | undefined> {
        try {
            const versionInfo = await this.versionApi.getCode()
            return versionInfo.gitVersion
        } catch (error) {
            console.warn('Could not get Kubernetes version:', error)
            return undefined
        }
    }

    // Clear cache to force re-detection
    clearCache(): void {
        this.cachedPlatformInfo = null
        this.cacheExpiry = null
    }

    // Update kubeconfig path and clear cache
    updateKubeConfig(kubeConfigPath: string): void {
        this.kubeConfig = new KubeConfig()
        this.kubeConfig.loadFromFile(kubeConfigPath)
        this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api)
        this.customApi = this.kubeConfig.makeApiClient(CustomObjectsApi)
        this.apisApi = this.kubeConfig.makeApiClient(ApisApi)
        this.clearCache()
    }
}