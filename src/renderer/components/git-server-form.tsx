import React, { useState, useEffect } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import type { GitServerConfig } from '@/shared/types/git-repository'

interface GitServerFormProps {
    server?: GitServerConfig | null
    onSave: (serverData: Omit<GitServerConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
    onCancel: () => void
}

/**
 * Form component for adding/editing Git servers
 */
export function GitServerForm({ server, onSave, onCancel }: GitServerFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        provider: 'github' as const,
        baseUrl: '',
        description: ''
    })

    useEffect(() => {
        if (server) {
            setFormData({
                name: server.name,
                provider: server.provider,
                baseUrl: server.baseUrl,
                description: server.description || ''
            })
        }
    }, [server])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(formData)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Server Name</Label>
                <Input
                    id="server-name"
                    placeholder="My Git Server"
                    value={formData.name || ''} // Ensure always controlled
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={formData.provider} onValueChange={(value: any) => setFormData({ ...formData, provider: value })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="gitea">Gitea</SelectItem>
                        <SelectItem value="bitbucket">Bitbucket</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                    id="server-url"
                    placeholder="https://git.example.com"
                    value={formData.baseUrl || ''} // Ensure always controlled
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <textarea
                    id="server-description"
                    placeholder="Optional description..."
                    value={formData.description || ''} // Ensure always controlled
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
            </div>

            <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                    {server ? 'Update' : 'Add'} Server
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}