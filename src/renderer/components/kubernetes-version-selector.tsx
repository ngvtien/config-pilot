import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Progress } from '@/renderer/components/ui/progress'
import { Alert, AlertDescription } from '@/renderer/components/ui/alert'
import { Badge } from '@/renderer/components/ui/badge'
import { Download, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { kubernetesSchemaService } from '@/renderer/services/kubernetes-schema-service'
import { joinPath } from '@/renderer/lib/path-utils'

interface KubernetesVersionSelectorProps {
    selectedVersion: string
    onVersionChange: (version: string) => void
    onVersionInfoChange?: (info: { availableVersions: number; localVersions: number }) => void
}

interface DownloadProgress {
    downloaded: number
    total: number
    resource?: string
}

export const KubernetesVersionSelector = React.memo(({
    selectedVersion,
    onVersionChange,
    onVersionInfoChange,
}: KubernetesVersionSelectorProps) => {
    const [availableVersions, setAvailableVersions] = useState<string[]>([])
    const [localVersions, setLocalVersions] = useState<string[]>([])
    const [isLoadingVersions, setIsLoadingVersions] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [userDataDir, setUserDataDir] = useState<string>('')

    // Get the proper user data directory
    useEffect(() => {
        const getUserDataDir = async () => {
            try {
                const dataDir = await window.electronAPI.getUserDataPath()
                setUserDataDir(dataDir)
            } catch (error) {
                console.error('Failed to get user data directory:', error)
            }
        }
        getUserDataDir()
    }, [])

    useEffect(() => {
        if (onVersionInfoChange) {
            onVersionInfoChange({
                availableVersions: availableVersions.length,
                localVersions: localVersions.length
            })
        }
    }, [availableVersions, localVersions, onVersionInfoChange])

    useEffect(() => {
        if (onVersionInfoChange) {
            onVersionInfoChange({
                availableVersions: availableVersions.length,
                localVersions: localVersions.length
            })
        }
    }, [availableVersions, localVersions, onVersionInfoChange])

    // Load versions when userDataDir is available
    useEffect(() => {
        if (userDataDir) {
            loadVersions()
        }
    }, [userDataDir])

    // Update the onVersionChange handler to save selection
    const handleVersionChange = (version: string) => {
        localStorage.setItem('kubernetes-selected-version', version)
        onVersionChange(version)
    }

    const safeJoinPath = (...segments: (string | undefined | null)[]): string => {
        return joinPath(...segments.map(segment => segment || ''))
    }

    const loadVersions = async () => {
        if (!userDataDir) return

        setIsLoadingVersions(true)
        setError(null)

        try {
            // Check localStorage cache first
            const cacheKey = 'kubernetes-available-versions'
            const cacheTimestampKey = 'kubernetes-available-versions-timestamp'
            const localCacheKey = `kubernetes-local-versions-${userDataDir}`
            const localCacheTimestampKey = `kubernetes-local-versions-timestamp-${userDataDir}`

            const cachedVersions = localStorage.getItem(cacheKey)
            const cacheTimestamp = localStorage.getItem(cacheTimestampKey)
            const cachedLocalVersions = localStorage.getItem(localCacheKey)
            const localCacheTimestamp = localStorage.getItem(localCacheTimestampKey)

            const remoteCacheExpiry = 10 * 60 * 1000 // 10 minutes for remote
            const localCacheExpiry = 2 * 60 * 1000   // 2 minutes for local
            const now = Date.now()

            let available: string[]

            // Check remote cache
            if (cachedVersions && cacheTimestamp &&
                now - parseInt(cacheTimestamp) < remoteCacheExpiry) {
                available = JSON.parse(cachedVersions)
                console.log('Using cached remote versions')
            } else {
                console.log('Fetching fresh remote versions')
                available = await kubernetesSchemaService.fetchAvailableVersions()
                localStorage.setItem(cacheKey, JSON.stringify(available))
                localStorage.setItem(cacheTimestampKey, now.toString())
            }

            // Check local cache
            let local: string[]
            if (cachedLocalVersions && localCacheTimestamp &&
                now - parseInt(localCacheTimestamp) < localCacheExpiry) {
                local = JSON.parse(cachedLocalVersions)
                console.log('Using cached local versions')
            } else {
                console.log('Fetching fresh local versions')
                local = await kubernetesSchemaService.getAvailableVersions(userDataDir)
                localStorage.setItem(localCacheKey, JSON.stringify(local))
                localStorage.setItem(localCacheTimestampKey, now.toString())
            }

            setAvailableVersions(available)
            setLocalVersions(local)

            // IMPORTANT: Restore saved version AFTER setting available versions
            const savedVersion = localStorage.getItem('kubernetes-selected-version')
            if (savedVersion && available.includes(savedVersion)) {
                // Restore saved version if it's still available
                if (!selectedVersion) {
                    console.log(`Restoring saved version: ${savedVersion}`)
                    onVersionChange(savedVersion)
                }
            } else if (!selectedVersion && available.length > 0) {
                // Set default to latest version and save it
                const defaultVersion = available[0]
                console.log(`Setting default version: ${defaultVersion}`)
                localStorage.setItem('kubernetes-selected-version', defaultVersion)
                onVersionChange(defaultVersion)
            }

        } catch (err: any) {
            setError(`Failed to load versions: ${err.message}`)
        } finally {
            setIsLoadingVersions(false)
        }
    }

    //   const handleDownloadVersion = async (version: string) => {
    //     if (!userDataDir) {
    //       setError('User data directory not available')
    //       return
    //     }

    //     setIsDownloading(true)
    //     setDownloadProgress({ downloaded: 0, total: 1 })
    //     setError(null)

    //     try {
    //       await kubernetesSchemaService.downloadSchemaWithProgress(
    //         version.replace('v', ''),
    //         userDataDir, // Use proper user data directory
    //         setDownloadProgress
    //       )

    //       // Refresh local versions
    //       const local = await kubernetesSchemaService.getAvailableVersions(userDataDir)
    //       setLocalVersions(local)

    //       setDownloadProgress(null)
    //     } catch (err: any) {
    //       setError(`Download failed: ${err.message}`)
    //       setDownloadProgress(null)
    //     } finally {
    //       setIsDownloading(false)
    //     }
    //   }

    // Update download handler to invalidate local cache
    const handleDownloadVersion = async (version: string) => {
        if (!userDataDir) {
            setError('User data directory not available')
            return
        }

        setIsDownloading(true)
        setDownloadProgress({ downloaded: 0, total: 1 })
        setError(null)

        try {
            await kubernetesSchemaService.downloadSchemaWithProgress(
                version.replace('v', ''),
                userDataDir,
                setDownloadProgress
            )

            // Clear local cache and refresh
            localStorage.removeItem(`kubernetes-local-versions-${userDataDir}`)
            localStorage.removeItem(`kubernetes-local-versions-timestamp-${userDataDir}`)

            const local = await kubernetesSchemaService.getAvailableVersions(userDataDir)
            setLocalVersions(local)

            // Update cache with fresh data
            localStorage.setItem(`kubernetes-local-versions-${userDataDir}`, JSON.stringify(local))
            localStorage.setItem(`kubernetes-local-versions-timestamp-${userDataDir}`, Date.now().toString())

            setDownloadProgress(null)
        } catch (err: any) {
            setError(`Download failed: ${err.message}`)
            setDownloadProgress(null)
        } finally {
            setIsDownloading(false)
        }
    }

    const isVersionLocal = (version: string) => {
        return localVersions.includes(version)
    }

    // Update refresh handler to clear cache
    const handleRefresh = () => {
        // Clear cache to force fresh data
        localStorage.removeItem('kubernetes-available-versions')
        localStorage.removeItem('kubernetes-available-versions-timestamp')
        localStorage.removeItem(`kubernetes-local-versions-${userDataDir}`)
        localStorage.removeItem(`kubernetes-local-versions-timestamp-${userDataDir}`)
        loadVersions()
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">
                    Kubernetes Version
                </label>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <Select
                            value={selectedVersion}
                            onValueChange={handleVersionChange}
                            disabled={isLoadingVersions}>

                            <SelectTrigger className="w-full">
                                <div className="flex items-center justify-between w-full">
                                    <SelectValue placeholder="Select Kubernetes version" />
                                    {selectedVersion && (
                                        <Badge
                                            variant={localVersions.includes(selectedVersion) ? "secondary" : "outline"}
                                            className="ml-2 text-xs"
                                        >
                                            {localVersions.includes(selectedVersion) ? (
                                                <>
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Local
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-3 h-3 mr-1" />
                                                    Remote
                                                </>
                                            )}
                                        </Badge>
                                    )}
                                </div>
                            </SelectTrigger>


                            <SelectContent>
                                {availableVersions.map((version) => (
                                    <SelectItem key={version} value={version}>
                                        {version}
                                    </SelectItem>
                                ))}
                            </SelectContent>

                        </Select>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoadingVersions || isDownloading}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoadingVersions ? 'animate-spin' : ''}`} />
                    </Button>

                    {selectedVersion && (
                        <Button
                            onClick={() => handleDownloadVersion(selectedVersion)}
                            disabled={isDownloading || !userDataDir}
                            size="sm"
                            variant={isVersionLocal(selectedVersion) ? "outline" : "default"}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isVersionLocal(selectedVersion) ? 'Re-download' : 'Download'} Schema
                        </Button>
                    )}

                </div>
            </div>

            {/* Download Progress */}
            {downloadProgress && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>Downloading schema...</span>
                        <span>{Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%</span>
                    </div>
                    <Progress
                        value={(downloadProgress.downloaded / downloadProgress.total) * 100}
                        className="w-full"
                    />
                    {downloadProgress.resource && (
                        <p className="text-xs text-muted-foreground">
                            Downloading: {downloadProgress.resource}
                        </p>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Status Information */}
            <div className="text-sm text-muted-foreground space-y-1">
                <p>Available versions: {availableVersions.length}</p>
                <p>Downloaded versions: {localVersions.length}</p>
                {userDataDir && (
                    <p className="text-xs">Schema directory: {joinPath(userDataDir, 'schemas')}</p>
                )}
            </div>
        </div>
    )
})