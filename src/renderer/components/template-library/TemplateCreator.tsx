import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Badge } from '@/renderer/components/ui/badge'
import { X, Search, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/renderer/hooks/use-toast'
import type { EnhancedTemplate, EnhancedTemplateResource } from '@/shared/types/enhanced-template'
import type { KubernetesResourceSchema } from '@/renderer/services/kubernetes-schema-indexer'
import { kubernetesSchemaIndexer } from '@/renderer/services/kubernetes-schema-indexer'

interface TemplateCreatorProps {
    isOpen: boolean
    onClose: () => void
    onSave: (template: EnhancedTemplate) => void
}

/**
 * Enhanced Template Creator with optional resource selection
 * Allows creating empty templates or templates with pre-selected resources
 */
export function TemplateCreator({ isOpen, onClose, onSave }: TemplateCreatorProps) {
    const [templateData, setTemplateData] = useState({
        name: '',
        description: '',
        version: '1.0.0',
        tags: [] as string[],
        templateType: 'kubernetes' as const
    })

    // Resource selection state
    const [selectedResources, setSelectedResources] = useState<EnhancedTemplateResource[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<KubernetesResourceSchema[]>([])
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [availableKinds, setAvailableKinds] = useState<string[]>([])

    const [tagInput, setTagInput] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const { toast } = useToast()
    const dropdownRef = useRef<HTMLDivElement>(null)

    /**
   * Reset form when modal opens
   */
    useEffect(() => {
        if (isOpen) {
            resetForm()
        }
    }, [isOpen])

    /**
     * Load available Kubernetes kinds on component mount
     */
    useEffect(() => {
        const loadKinds = async () => {
            try {
                const kinds = await kubernetesSchemaIndexer.getAvailableKindsWithCRDs()
                setAvailableKinds(kinds.map((kind: any) => ({ kind, apiVersion: 'v1', group: 'core' })) || [])
            } catch (error) {
                console.error('Failed to load available kinds:', error)
            }
        }

        if (isOpen) {
            loadKinds()
        }
    }, [isOpen])

    /**
     * Search for resources based on search term
     */
    useEffect(() => {
        const performSearch = async () => {
            if (!searchTerm.trim()) {
                setSearchResults([])
                return
            }

            try {
                const results = await kubernetesSchemaIndexer.searchResourcesWithCRDs(searchTerm)
                setSearchResults(results.slice(0, 10)) // Limit results
            } catch (error) {
                // Fallback to standard search
                const standardResults = kubernetesSchemaIndexer.searchResources(searchTerm)
                setSearchResults(standardResults.slice(0, 10))
            }
        }

        performSearch()
    }, [searchTerm])

    /**
     * Handle form input changes
     */
    const handleInputChange = (field: string, value: string) => {
        setTemplateData(prev => ({ ...prev, [field]: value }))
    }

    /**
     * Handle adding tags
     */
    const handleAddTag = () => {
        if (tagInput.trim() && !templateData.tags.includes(tagInput.trim())) {
            setTemplateData(prev => ({
                ...prev,
                tags: [...prev.tags, tagInput.trim()]
            }))
            setTagInput('')
        }
    }

    /**
     * Handle removing tags
     */
    const handleRemoveTag = (tagToRemove: string) => {
        setTemplateData(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }))
    }

    /**
     * Handle resource selection from dropdown
     */
    const handleResourceSelect = (resource: KubernetesResourceSchema) => {
        // Ensure apiVersion is present
        const apiVersion = resource.apiVersion ||
            (resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`)

        // Check for duplicates
        const isAlreadySelected = selectedResources.some(r =>
            r.kind === resource.kind && r.apiVersion === apiVersion
        )

        if (isAlreadySelected) {
            toast({
                variant: 'destructive',
                title: 'Resource Already Added',
                description: `${resource.kind} (${apiVersion}) is already in the template`
            })
            return
        }

        const newResource: EnhancedTemplateResource = {
            id: `${resource.kind.toLowerCase()}-${Date.now()}`,
            kind: resource.kind,
            apiVersion,
            selectedFields: [],
            templateType: 'kubernetes',
            source: resource.source || 'kubernetes'
        }

        setSelectedResources(prev => [...prev, newResource])
        setSearchTerm('')
        setIsDropdownOpen(false)

        toast({
            title: 'Resource Added',
            description: `${resource.kind} has been added to the template`
        })
    }

    /**
     * Handle removing a selected resource
     */
    const handleRemoveResource = (index: number) => {
        setSelectedResources(prev => prev.filter((_, i) => i !== index))
    }

    /**
     * Handle template creation
     */
    const handleCreateTemplate = async () => {
        // Validate required fields
        if (!templateData.name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Template name is required'
            })
            return
        }

        setIsCreating(true)
        try {
            // Create the enhanced template object
            const newTemplate: Omit<EnhancedTemplate, 'id' | 'metadata'> = {
                name: templateData.name.trim(),
                description: templateData.description.trim() || undefined,
                version: templateData.version,
                tags: templateData.tags,
                resources: selectedResources, // Use selected resources (can be empty)
                generationSettings: {
                    outputFormats: ['helm', 'kustomize', 'raw-yaml'],
                    defaultFormat: 'helm'
                }
            }

            // Call the backend to create the template
            const createdTemplate = await window.electronAPI.template.create(newTemplate)

            const resourceCount = selectedResources.length
            toast({
                title: 'Template Created',
                description: `Template "${templateData.name}" created with ${resourceCount} resource${resourceCount !== 1 ? 's' : ''}`
            })

            // Pass the created template to parent for further editing
            onSave(createdTemplate)

            // Reset form and close modal
            resetForm()
            onClose()
        } catch (error) {
            console.error('Failed to create template:', error)
            toast({
                variant: 'destructive',
                title: 'Creation Failed',
                description: 'Failed to create template. Please try again.'
            })
        } finally {
            setIsCreating(false)
        }
    }

    /**
     * Reset form to initial state
     */
    const resetForm = () => {
        setTemplateData({
            name: '',
            description: '',
            version: '1.0.0',
            tags: [],
            templateType: 'kubernetes'
        })
        setSelectedResources([])
        setSearchTerm('')
        setTagInput('')
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Create New Template</CardTitle>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Template Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column - Basic Info */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="template-name">Template Name *</Label>
                                <Input
                                    id="template-name"
                                    placeholder="Enter template name"
                                    value={templateData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="template-description">Description</Label>
                                <Textarea
                                    id="template-description"
                                    placeholder="Enter template description (optional)"
                                    value={templateData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="template-version">Version</Label>
                                <Input
                                    id="template-version"
                                    value={templateData.version}
                                    onChange={(e) => handleInputChange('version', e.target.value)}
                                />
                            </div>

                            {/* Tags */}
                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add tag"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                                    />
                                    <Button type="button" onClick={handleAddTag} size="sm">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {templateData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {templateData.tags.map((tag, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                                {tag}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 ml-1"
                                                    onClick={() => handleRemoveTag(tag)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Resource Selection */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Kubernetes Resources (Optional)</Label>
                                <p className="text-sm text-muted-foreground">
                                    Add resources now or leave empty to add them later in the designer
                                </p>

                                {/* Resource Search */}
                                <div className="relative" ref={dropdownRef}>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search for Kubernetes resources..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value)
                                                setIsDropdownOpen(e.target.value.trim().length > 0)
                                            }}
                                            onFocus={() => searchTerm.trim() && setIsDropdownOpen(true)}
                                            className="pl-10"
                                        />
                                    </div>

                                    {/* Search Results Dropdown */}
                                    {isDropdownOpen && searchResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                            {searchResults.map((resource, index) => {
                                                const apiVersion = resource.apiVersion ||
                                                    (resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`)

                                                return (
                                                    <div
                                                        key={`${resource.group || 'core'}-${resource.version || 'v1'}-${resource.kind}-${index}`}
                                                        className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-b-0"
                                                        onClick={() => handleResourceSelect(resource)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium">{resource.kind}</span>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {apiVersion}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Selected Resources */}
                            {selectedResources.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Selected Resources ({selectedResources.length})</Label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {selectedResources.map((resource, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                                                <div>
                                                    <span className="font-medium">{resource.kind}</span>
                                                    <Badge variant="outline" className="ml-2 text-xs">
                                                        {resource.apiVersion}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveResource(index)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateTemplate} disabled={isCreating}>
                            {isCreating ? 'Creating...' : 'Create Template'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}