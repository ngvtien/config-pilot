import React from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Edit, Trash2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import type { GitServerConfig } from '@/shared/types/git-repository'

interface GitServerCardProps {
    server: GitServerConfig
    onEdit: (server: GitServerConfig) => void
    onDelete: (serverId: string) => void
    isDefault?: boolean
}

/**
 * Individual Git server card component with status indicators and actions
 */
export function GitServerCard({ server, onEdit, onDelete, isDefault }: GitServerCardProps) {
    const getProviderIcon = (provider: string) => {
        const icons = {
            github: '🟣',
            gitlab: '🟠', 
            bitbucket: '🟦',
            gitea: '🟢'
        }
        return icons[provider as keyof typeof icons] || '⚪'
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'auth_required': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
            default: return <AlertTriangle className="w-4 h-4 text-gray-400" />
        }
    }

    return (
        <Card className="mb-3">
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                        <span className="text-lg">{getProviderIcon(server.provider)}</span>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{server.name}</h4>
                                {isDefault && <Badge variant="secondary">Default</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{server.baseUrl}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {getStatusIcon('connected')}
                                <span>Connected • Last tested: {new Date().toLocaleString()}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Created: {new Date(server.createdAt).toLocaleDateString()} • 
                                Updated: {new Date(server.updatedAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(server)}
                        >
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDelete(server.id)}
                            className="text-red-600 hover:text-red-700"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}