"use client"

import React, { useState, useMemo, useEffect } from "react"
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Package, FileText, Settings, Code, Plus, Trash2, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Badge } from "@/renderer/components/ui/badge"
import { typography } from "@/renderer/lib/typography"
import { Separator } from "@/renderer/components/ui/separator"
import { ResourceAdditionWizard } from "./resource-addition-wizard"
import { Dialog, DialogContent, DialogTrigger } from "@/renderer/components/ui/dialog"
import { Button } from "@/renderer/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/renderer/components/ui/alert-dialog"
import { DialogDescription, DialogTitle } from "@/renderer/components/ui/dialog"
import { ProductComponentTiles, mockProductComponents } from "../products/product-component-tiles"

/**
 * File tree node interface based on PRD structure
 */
interface FileTreeNode {
    id: string
    name: string
    type: 'file' | 'folder'
    path: string
    category: 'charts' | 'resources' | 'config'
    children?: FileTreeNode[]
    isExpanded?: boolean
    content?: string // Add this if missing
    metadata?: {
        fileType?: 'yaml' | 'json' | 'helm'
        resourceKind?: string
        chartType?: 'component' | 'product'
    }
}

interface SmartFileTreeProps {
    productId?: string
    componentId?: string
    onFileSelect?: (file: FileTreeNode) => void
    selectedFileId?: string
    className?: string
    // New props for component integration
    selectedProductId?: string
    selectedProductName?: string
    selectedComponentId?: string
    onComponentSelect?: (component: any) => void
    onEditComponent?: (component: any) => void
    onDeleteComponent?: (component: any) => void
    rootPath?: string
}

/**
 * Smart file tree component that generates structure based on PRD
 * Categorizes files into charts, resources, and configuration
 */
export function SmartFileTree({
    productId,
    componentId,
    onFileSelect,
    selectedFileId,
    className,
    selectedProductId,
    selectedProductName,
    selectedComponentId,
    onComponentSelect,
    onEditComponent,
    onDeleteComponent,
    rootPath
}: SmartFileTreeProps) {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['charts', 'resources']))
    const [showResourceWizard, setShowResourceWizard] = useState(false)
    const [dynamicResources, setDynamicResources] = useState<FileTreeNode[]>([])
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [resourceToDelete, setResourceToDelete] = useState<FileTreeNode | null>(null)

    const [fileSystemTree, setFileSystemTree] = useState<FileTreeNode[]>([])

    // Load file system tree when rootPath changes
    useEffect(() => {
        console.log('🔍 SmartFileTree: rootPath changed to:', rootPath)
        if (rootPath) {
            console.log('🔍 SmartFileTree: rootPath changed to:', rootPath)
            loadFileSystemTree(rootPath)
        } else {
            console.log('❌ No rootPath provided, clearing file system tree')
            setFileSystemTree([])
        }
    }, [rootPath])

    /**
     * Load actual file system tree from the selected component folder
     */
    const loadFileSystemTree = async (path: string) => {
        try {
            console.log('🚀 Starting to build file system tree from:', path)
            const tree = await buildFileSystemTree(path, '')
            console.log('✅ File system tree loaded successfully:', tree)
            console.log('📊 Tree has', tree.length, 'root items')
            setFileSystemTree(tree)
        } catch (error) {
            console.error('❌ Failed to load file system tree:', error)
            setFileSystemTree([])
        }
    }

    /**
     * Recursively build file system tree from actual directory
     */
    const buildFileSystemTree = async (dirPath: string, relativePath: string): Promise<FileTreeNode[]> => {
        try {
            const items = await window.electronAPI.invoke('fs:listDirectories', dirPath)
            const files = await window.electronAPI.invoke('fs:listFiles', dirPath)

            const nodes: FileTreeNode[] = []

            // Add directories
            for (const item of items) {
                const fullPath = await window.electronAPI.joinPath(dirPath, item)
                const itemRelativePath = relativePath ? `${relativePath}/${item}` : item

                const children = await buildFileSystemTree(fullPath, itemRelativePath)

                nodes.push({
                    id: `fs-${itemRelativePath}`,
                    name: item,
                    type: 'folder',
                    path: fullPath,
                    category: getCategoryFromPath(itemRelativePath),
                    children,
                    isExpanded: item === 'resources' || item === 'charts'
                })
            }

            // Add files
            for (const file of files) {
                const fullPath = await window.electronAPI.joinPath(dirPath, file)
                const fileRelativePath = relativePath ? `${relativePath}/${file}` : file

                nodes.push({
                    id: `fs-${fileRelativePath}`,
                    name: file,
                    type: 'file',
                    path: fullPath,
                    category: getCategoryFromPath(fileRelativePath),
                    metadata: getFileMetadata(file)
                })
            }

            return nodes
        } catch (error) {
            console.error(`Failed to read directory ${dirPath}:`, error)
            return []
        }
    }
    /**
     * Determine category based on file path
     */
    const getCategoryFromPath = (path: string): 'charts' | 'resources' | 'config' => {
        if (path.includes('charts') || path.includes('templates')) return 'charts'
        if (path.includes('resources')) return 'resources'
        return 'config'
    }

    /**
     * Get file metadata based on extension
     */
    const getFileMetadata = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase()

        if (ext === 'yaml' || ext === 'yml') {
            return { fileType: 'yaml' as const }
        }
        if (ext === 'json') {
            return { fileType: 'json' as const }
        }
        return { fileType: 'yaml' as const }
    }

    /**
     * Handle resource creation with proper component folder path
     */
    const handleResourceCreate = async (resourceData: any) => {
        try {
            // Handle in-memory only mode
            if (resourceData.inMemoryOnly) {
                const resourcePath = rootPath
                    ? await window.electronAPI.joinPath(rootPath, 'resources', resourceData.fileName || 'new-resource.yaml')
                    : `./resources/${resourceData.fileName || 'new-resource.yaml'}`

                const newResource: FileTreeNode = {
                    id: `resource-${Date.now()}`,
                    name: resourceData.fileName || 'new-resource.yaml',
                    type: 'file',
                    path: resourcePath,
                    category: 'resources',
                    content: resourceData.template || resourceData.content || ''
                }
                setDynamicResources(prev => [...prev, newResource])

                // Auto-select the newly created resource
                if (onFileSelect) {
                    onFileSelect(newResource)
                }

                setShowResourceWizard(false)
                return
            }

            // Use rootPath to create proper component resources folder path
            const resourcesDir = rootPath
                ? await window.electronAPI.joinPath(rootPath, 'resources')
                : './resources'

            const resourcePath = await window.electronAPI.joinPath(resourcesDir, resourceData.fileName || 'new-resource.yaml')

            // Ensure we have content to write
            const contentToWrite = resourceData.template || resourceData.content || ''
            if (!contentToWrite) {
                console.error('No content provided for resource creation')
                throw new Error('Resource content is required')
            }

            try {
                // Ensure directory exists with proper error handling
                await window.electronAPI.createDirectory(resourcesDir)
            } catch (dirError) {
                console.warn('Directory creation failed or already exists:', dirError)
                // Continue with file creation even if directory creation fails
            }

            try {
                // Write the resource file - Fixed: use the correct content property
                await window.electronAPI.writeFile(resourcePath, contentToWrite)
                console.log('Resource file created successfully:', resourcePath)

                // Read the file content back to ensure UI shows actual content
                const actualContent = await window.electronAPI.readFile(resourcePath)

                // Always add to UI state with actual file content
                const newResource: FileTreeNode = {
                    id: `resource-${Date.now()}`,
                    name: resourceData.fileName || 'new-resource.yaml',
                    type: 'file',
                    path: resourcePath,
                    category: 'resources',
                    content: actualContent || contentToWrite // Use actual file content
                }
                setDynamicResources(prev => [...prev, newResource])

                // Auto-select the newly created resource
                if (onFileSelect) {
                    onFileSelect(newResource)
                }

                // Close the modal after successful creation
                setShowResourceWizard(false)

                // Refresh the file system tree to show the new file
                if (rootPath) {
                    loadFileSystemTree(rootPath)
                }

            } catch (fileError) {
                console.error('Failed to create resource file:', fileError)
                console.warn('Adding resource to UI state only (file creation failed)')

                // Fallback: add to UI with template content
                const newResource: FileTreeNode = {
                    id: `resource-${Date.now()}`,
                    name: resourceData.fileName || 'new-resource.yaml',
                    type: 'file',
                    path: resourcePath,
                    category: 'resources',
                    content: contentToWrite
                }
                setDynamicResources(prev => [...prev, newResource])

                // Auto-select the newly created resource even if file creation failed
                if (onFileSelect) {
                    onFileSelect(newResource)
                }

                // Close the modal even if file creation failed (resource added to UI)
                setShowResourceWizard(false)
            }

        } catch (error) {
            console.error('Failed to create resource:', error)
            // Don't close modal on error - let user retry or cancel manually
            // Show user-friendly error message
            // You might want to show an error toast/notification here
        }
    }


    /**
 * Handle resource deletion
 * Shows confirmation dialog before deletion
 */
    const handleDeleteResource = (resource: FileTreeNode) => {
        setResourceToDelete(resource)
        setDeleteDialogOpen(true)
    }

    /**
     * Confirm resource deletion
     * TODO: Integrate with actual file system operations
     */
    const confirmDeleteResource = () => {
        if (resourceToDelete) {
            // Remove from dynamic resources
            setDynamicResources(prev =>
                prev.filter(resource => resource.id !== resourceToDelete.id)
            )

            // TODO: Delete actual file from file system
            // await window.electronAPI?.deleteFile?.(resourceToDelete.path)

            console.log('Resource deleted:', resourceToDelete.name)

            // Reset dialog state
            setResourceToDelete(null)
            setDeleteDialogOpen(false)
        }
    }

    // Generate file tree structure based on PRD
    const fileTree = useMemo(() => {
        console.log('🎯 useMemo triggered:')
        console.log('   - rootPath:', rootPath)
        console.log('   - fileSystemTree.length:', fileSystemTree.length)
        console.log('   - productId:', productId)
        console.log('   - componentId:', componentId)

        // If we have a rootPath and file system tree, use that
        if (rootPath && fileSystemTree.length > 0) {
            console.log('✅ Using file system tree with', fileSystemTree.length, 'items')
            return fileSystemTree
        }

        console.log('⚠️ Falling back to mock tree')

        if (!productId) return []

        // If no component is selected, show product-level structure
        if (!componentId) {
            return [
                {
                    id: 'product-overview',
                    name: 'Product Overview',
                    type: 'folder',
                    path: '/product',
                    category: 'config',
                    isExpanded: true,
                    children: [
                        {
                            id: 'product-readme',
                            name: 'README.md',
                            type: 'file',
                            path: '/product/README.md',
                            category: 'config',
                            metadata: { fileType: 'yaml' }
                        },
                        {
                            id: 'product-config',
                            name: 'product.yaml',
                            type: 'file',
                            path: '/product/product.yaml',
                            category: 'config',
                            metadata: { fileType: 'yaml' }
                        }
                    ]
                }
            ]
        }

        // Component-specific file structure - REORDERED for proper workflow
        const tree: FileTreeNode[] = [
            // 1. RESOURCES FIRST - Raw Kubernetes manifests for validation
            {
                id: 'component-resources',
                name: 'resources',
                type: 'folder',
                path: `/components/${componentId}/resources`,
                category: 'resources',
                isExpanded: true,
                children: [
                    // Static resources
                    {
                        id: `${componentId}-deployment`,
                        name: 'deployment.yaml',
                        type: 'file',
                        path: `/components/${componentId}/resources/deployment.yaml`,
                        category: 'resources',
                        metadata: { fileType: 'yaml', resourceKind: 'Deployment' }
                    },
                    {
                        id: `${componentId}-service`,
                        name: 'service.yaml',
                        type: 'file',
                        path: `/components/${componentId}/resources/service.yaml`,
                        category: 'resources',
                        metadata: { fileType: 'yaml', resourceKind: 'Service' }
                    },
                    {
                        id: `${componentId}-configmap`,
                        name: 'configmap.yaml',
                        type: 'file',
                        path: `/components/${componentId}/resources/configmap.yaml`,
                        category: 'resources',
                        metadata: { fileType: 'yaml', resourceKind: 'ConfigMap' }
                    },
                    // Add dynamic resources here
                    ...dynamicResources
                ]
            },
            // 2. CONFIG SECOND - Component configuration
            {
                id: 'component-config',
                name: 'config',
                type: 'folder',
                path: `/components/${componentId}/config`,
                category: 'config',
                isExpanded: true,
                children: [
                    {
                        id: `${componentId}-readme`,
                        name: 'README.md',
                        type: 'file',
                        path: `/components/${componentId}/config/README.md`,
                        category: 'config',
                        metadata: { fileType: 'yaml' }
                    },
                    {
                        id: `${componentId}-component-yaml`,
                        name: 'component.yaml',
                        type: 'file',
                        path: `/components/${componentId}/config/component.yaml`,
                        category: 'config',
                        metadata: { fileType: 'yaml' }
                    }
                ]
            },
            // 3. CHARTS LAST - Helm charts processed after validation
            {
                id: 'component-charts',
                name: 'charts',
                type: 'folder',
                path: `/components/${componentId}/charts`,
                category: 'charts',
                isExpanded: true,
                children: [
                    {
                        id: `${componentId}-chart-yaml`,
                        name: 'Chart.yaml',
                        type: 'file',
                        path: `/components/${componentId}/charts/Chart.yaml`,
                        category: 'charts',
                        metadata: { fileType: 'yaml', chartType: 'component' }
                    },
                    {
                        id: `${componentId}-values-yaml`,
                        name: 'values.yaml',
                        type: 'file',
                        path: `/components/${componentId}/charts/values.yaml`,
                        category: 'charts',
                        metadata: { fileType: 'yaml', chartType: 'component' }
                    },
                    {
                        id: `${componentId}-templates`,
                        name: 'templates',
                        type: 'folder',
                        path: `/components/${componentId}/charts/templates`,
                        category: 'charts',
                        children: [
                            {
                                id: `${componentId}-deployment-template`,
                                name: 'deployment.yaml',
                                type: 'file',
                                path: `/components/${componentId}/charts/templates/deployment.yaml`,
                                category: 'charts',
                                metadata: { fileType: 'yaml', resourceKind: 'Deployment' }
                            },
                            {
                                id: `${componentId}-service-template`,
                                name: 'service.yaml',
                                type: 'file',
                                path: `/components/${componentId}/charts/templates/service.yaml`,
                                category: 'charts',
                                metadata: { fileType: 'yaml', resourceKind: 'Service' }
                            }
                        ]
                    }
                ]
            }
        ]

        return tree
        //}, [productId, componentId, dynamicResources])
    }, [productId, componentId, dynamicResources, rootPath, fileSystemTree])

    /**
     * Toggle node expansion
     */
    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev)
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId)
            } else {
                newSet.add(nodeId)
            }
            return newSet
        })
    }

    /**
     * Get icon for file/folder based on type and metadata
     */
    const getIcon = (node: FileTreeNode) => {
        if (node.type === 'folder') {
            const isExpanded = expandedNodes.has(node.id)
            if (node.category === 'charts') {
                return isExpanded ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <Folder className="h-4 w-4 text-blue-500" />
            }
            return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
        }

        // File icons based on type
        if (node.metadata?.fileType === 'yaml') {
            return <FileText className="h-4 w-4 text-orange-500" />
        }
        if (node.metadata?.fileType === 'json') {
            return <Code className="h-4 w-4 text-green-500" />
        }
        return <File className="h-4 w-4" />
    }

    /**
     * Render individual file tree node with enhanced color coding and delete functionality
     */
    const renderNode = (node: FileTreeNode, level: number = 0): React.ReactNode => {
        const isExpanded = expandedNodes.has(node.id)
        const hasChildren = node.children && node.children.length > 0
        const isSelected = selectedFileId === node.id
        const isDynamicResource = dynamicResources.some(r => r.id === node.id)

        const toggleExpanded = () => {
            setExpandedNodes(prev => {
                const newSet = new Set(prev)
                if (isExpanded) {
                    newSet.delete(node.id)
                } else {
                    newSet.add(node.id)
                }
                return newSet
            })
        }

        // Update the handleClick function in renderNode
        const handleClick = async () => {
            if (node.type === 'file' && onFileSelect) {
                // Always try to read actual file content for all files
                try {
                    const actualContent = await window.electronAPI.readFile(node.path)
                    const updatedNode = { ...node, content: actualContent }
                    onFileSelect(updatedNode)
                } catch (error) {
                    console.warn('Could not read file content:', error)
                    // If file reading fails, pass the node without content
                    // The IDE editor will handle generating mock content as fallback
                    onFileSelect(node)
                }
            } else if (hasChildren) {
                toggleExpanded()
            }
        }
        const getIcon = () => {
            if (node.type === 'folder') {
                return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
            }

            switch (node.metadata?.fileType) {
                case 'helm': return <Package className="h-4 w-4 text-blue-600" />
                case 'yaml': return <FileText className="h-4 w-4 text-green-600" />
                case 'json': return <Code className="h-4 w-4 text-orange-600" />
                default: return <File className="h-4 w-4 text-gray-500" />
            }
        }

        // Enhanced color coding based on category and type with softer, more minimalistic colors
        const getNodeColors = () => {
            if (isDynamicResource) {
                return "bg-blue-50/30 dark:bg-blue-950/20 border-l-2 border-l-blue-300/50 dark:border-l-blue-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
            }

            switch (node.category) {
                case 'resources':
                    return level === 0
                        ? "bg-green-50/30 dark:bg-green-950/20 border-l-2 border-l-green-300/50 dark:border-l-green-700/50 hover:bg-green-50/50 dark:hover:bg-green-950/30"
                        : "hover:bg-green-50/20 dark:hover:bg-green-950/10"
                case 'config':
                    return level === 0
                        ? "bg-amber-50/30 dark:bg-amber-950/20 border-l-2 border-l-amber-300/50 dark:border-l-amber-700/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/30"
                        : "hover:bg-amber-50/20 dark:hover:bg-amber-950/10"
                case 'charts':
                    return level === 0
                        ? "bg-blue-50/30 dark:bg-blue-950/20 border-l-2 border-l-blue-300/50 dark:border-l-blue-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                        : "hover:bg-blue-50/20 dark:hover:bg-blue-950/10"
                default:
                    return "hover:bg-muted/30"
            }
        }

        return (
            <div key={node.id} className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 group",
                        getNodeColors(),
                        isSelected && "bg-accent ring-1 ring-accent-foreground/20",
                        level > 0 && "ml-4"
                    )}
                    onClick={handleClick}
                >
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded()
                            }}
                            className="p-0.5 hover:bg-accent rounded transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ChevronRight className="h-3 w-3" />
                            )}
                        </button>
                    )}

                    {!hasChildren && <div className="w-4" />}

                    <div className="text-muted-foreground">
                        {getIcon()}
                    </div>

                    <span className={cn(
                        typography.body.sm,
                        "flex-1 font-medium text-foreground",
                        isDynamicResource && "text-blue-700 dark:text-blue-400",
                        level === 0 && "font-semibold"
                    )}>
                        {node.name}
                        {isDynamicResource && (
                            <Badge variant="secondary" className="ml-2 text-xs bg-blue-50/50 dark:bg-blue-950/30 text-blue-600/80 dark:text-blue-400/80 border-blue-200/50 dark:border-blue-800/50">
                                New
                            </Badge>
                        )}

                    </span>

                    {/* Enhanced resource badges with softer colors */}
                    {node.metadata?.resourceKind && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-xs font-medium",
                                isDynamicResource
                                    ? "bg-blue-50/30 dark:bg-blue-950/20 text-blue-600/80 dark:text-blue-400/80 border-blue-200/50 dark:border-blue-700/50"
                                    : "bg-muted/50 text-muted-foreground/80 border-border/50"
                            )}
                        >
                            {node.metadata.resourceKind}
                        </Badge>
                    )}

                    {node.metadata?.chartType && (
                        <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                            {node.metadata.chartType}
                        </Badge>
                    )}

                    {/* Enhanced workflow stage indicators with dark mode */}
                    {level === 0 && node.category === 'resources' && (
                        <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700 font-medium">
                            1. Validate
                        </Badge>
                    )}
                    {level === 0 && node.category === 'config' && (
                        <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700 font-medium">
                            2. Configure
                        </Badge>
                    )}
                    {level === 0 && node.category === 'charts' && (
                        <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700 font-medium">
                            3. Package
                        </Badge>
                    )}

                    {/* Enhanced delete menu for dynamic resources */}
                    {isDynamicResource && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-7 w-7 p-0 transition-all duration-200 zoom-exclude",
                                        "opacity-0 group-hover:opacity-100",
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreVertical className="h-3 w-3 zoom-exclude" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteResource(node)
                                    }}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Resource
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {hasChildren && isExpanded && (
                    <div className="ml-2">
                        {node.children?.map(child => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={cn("h-full bg-background", className)}>
            {/* Enhanced header with proper dark mode support */}
            <div className="border-b bg-muted/50 dark:bg-muted/80 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className={cn(typography.heading.sm, "font-semibold text-foreground")}>Resource File Explorer</h3>
                        <p className={cn(typography.body.xs, "text-muted-foreground mt-1")}>
                            DevOps Workflow:
                            <span className="text-green-600 dark:text-green-400 font-medium">Validate</span> →
                            <span className="text-yellow-600 dark:text-yellow-400 font-medium">Configure</span> →
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Package</span>
                        </p>
                    </div>

                    <Dialog open={showResourceWizard} onOpenChange={setShowResourceWizard}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 bg-background hover:bg-accent border-border text-primary"
                                disabled={!componentId}
                            >
                                <Plus className="h-4 w-4" />
                                Add Resource
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                            <DialogTitle>Add New Resource</DialogTitle>
                            <DialogDescription>
                                Create a new Kubernetes resource for your component
                            </DialogDescription>
                            <ResourceAdditionWizard
                                existingResources={[
                                    ...fileTree
                                        .find(node => node.category === 'resources')
                                        ?.children?.map(child => child.metadata?.resourceKind || '') || [],
                                    ...dynamicResources.map(r => r.metadata?.resourceKind || '')
                                ]}
                                onResourceCreate={handleResourceCreate}
                                onCancel={() => setShowResourceWizard(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* File tree with enhanced styling */}
            <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                    {fileTree.map((node, index) => (
                        <div key={node.id}>
                            {renderNode(node)}
                            {index < fileTree.length - 1 && (
                                <div className="my-4 px-2">
                                    <Separator className="bg-border" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Enhanced delete confirmation dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">Delete Resource</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>"{resourceToDelete?.name}"</strong>?
                            This action cannot be undone and will remove the resource from your project.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteResource}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}