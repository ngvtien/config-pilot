import React, { useState } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Edit, Trash2, CheckCircle, AlertTriangle, XCircle, Star, ChevronDown, ChevronUp, Key } from 'lucide-react'
import type { GitServerConfig } from '@/shared/types/git-repository'
import { typography } from '@/renderer/lib/typography'

interface GitServerTileProps {
    server: GitServerConfig
    onEdit: (server: GitServerConfig) => void
    onDelete: (serverId: string) => void
    onSetCurrent: (serverId: string) => void
    isDefault?: boolean
    isCurrent?: boolean
}

/**
 * Enhanced compact horizontal tile component for Git servers
 * Features provider name display, current server indication, and collapsible auth details
 */
export function GitServerTile({ 
    server, 
    onEdit, 
    onDelete, 
    onSetCurrent, 
    isDefault, 
    isCurrent 
}: GitServerTileProps) {
    const [showAuthDetails, setShowAuthDetails] = useState(false)

    /**
     * Get provider icon and name mapping
     */
    const getProviderInfo = (provider: string) => {
        const providerMap = {
            github: { icon: '🟣', name: 'GitHub' },
            gitlab: { icon: '🟠', name: 'GitLab' }, 
            bitbucket: { icon: '🟦', name: 'Bitbucket' },
            gitea: { icon: '🟢', name: 'Gitea' }
        }
        return providerMap[provider as keyof typeof providerMap] || { icon: '⚪', name: 'Unknown' }
    }

    /**
     * Get connection status icon based on server status
     */
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'connected': return <CheckCircle className="w-3 h-3 text-green-500" />
            case 'auth_required': return <AlertTriangle className="w-3 h-3 text-yellow-500" />
            case 'failed': return <XCircle className="w-3 h-3 text-red-500" />
            default: return <AlertTriangle className="w-3 h-3 text-gray-400" />
        }
    }

    const providerInfo = getProviderInfo(server.provider)

    return (
        <div 
            className={`
                relative border rounded-lg p-4 bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer
                ${isCurrent ? 'ring-2 ring-primary bg-primary/10 border-primary/30' : ''}
                ${showAuthDetails ? 'h-auto min-h-[120px]' : 'h-28'}
            `}
            onClick={() => onSetCurrent(server.id)}
        >
            {/* Current Server Indicator */}
            {isCurrent && (
                <div className="absolute -top-1 -right-1 z-10">
                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Star className="w-3 h-3 fill-current" />
                    </div>
                </div>
            )}
            
            {/* Header with provider, status, and actions */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={typography.tile.icon}>{providerInfo.icon}</span>
                    <span className={`${typography.tile.metadata} font-medium`}>{providerInfo.name}</span>
                    {getStatusIcon('connected')}
                    {isDefault && <Badge variant="secondary" className={`${typography.tile.badge} px-1 py-0 h-4`}>Default</Badge>}
                    {isCurrent && <Badge variant="default" className={`${typography.tile.badge} px-1 py-0 h-4`}>Active</Badge>}
                </div>
                <div className="flex gap-1">
                    {/* Auth Details Toggle */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowAuthDetails(!showAuthDetails)
                        }}
                        className="h-6 w-6 p-0 hover:bg-accent"
                        title="Toggle authentication details"
                    >
                        {showAuthDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit(server)
                        }}
                        className="h-6 w-6 p-0 hover:bg-accent"
                        title="Edit server"
                    >
                        <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(server.id)
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete server"
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            </div>
            
            {/* Server info */}
            <div className="space-y-1.5">
                <h4 className={`${typography.tile.title} truncate`}>{server.name}</h4>
                <p className={`${typography.tile.subtitle} truncate`}>{server.baseUrl}</p>
            </div>

            {/* Collapsible Authentication Details */}
            {showAuthDetails && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-center gap-2">
                        <Key className="w-3 h-3 text-muted-foreground" />
                        <span className={`${typography.tile.badge} font-medium`}>Authentication Method</span>
                    </div>
                    <div className={`${typography.tile.metadata} pl-5`}>
                        {/* This would be populated from server credentials if available */}
                        <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Token Authentication
                        </span>
                    </div>
                    <div className={`${typography.tile.metadata} pl-5`}>
                        Last tested: {server.updatedAt ? new Date(server.updatedAt).toLocaleDateString() : 'Never'}
                    </div>
                </div>
            )}
        </div>
    )
}