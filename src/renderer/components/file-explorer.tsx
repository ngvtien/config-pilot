"use client"

import { useState, useMemo } from "react"
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  Building2,
  Package,
  Server,
  Database,
  Settings,
  FileText,
  Code,
  ImageIcon,
  Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import { Badge } from "@/renderer/components/ui/badge"
import { Card, CardHeader } from "@/renderer/components/ui/card"

// Context types
interface FileExplorerContext {
  baseDirectory: string
  customer: string
  product: string
  environment: string
  instance: number
}

// File/Folder types
interface FileSystemItem {
  id: string
  name: string
  type: "file" | "folder"
  path: string
  size?: number
  lastModified?: Date
  children?: FileSystemItem[]
  isExpanded?: boolean
  contextLevel?: "base" | "customer" | "product" | "environment" | "instance" | "content"
  metadata?: {
    customer?: string
    product?: string
    environment?: string
    instance?: number
  }
}

interface FileExplorerProps {
  context: FileExplorerContext
  onFileSelect?: (file: FileSystemItem) => void
  onContextChange?: (newContext: Partial<FileExplorerContext>) => void
  className?: string
}

// Mock data generator based on context
const generateFileSystemData = (context: FileExplorerContext): FileSystemItem[] => {
  const { baseDirectory, customer, product, environment, instance } = context

  // Base directory structure
  if (!customer) {
    return [
      {
        id: "customers",
        name: "customers",
        type: "folder",
        path: `${baseDirectory}/customers`,
        contextLevel: "base",
        children: [
          {
            id: "acme-corp",
            name: "acme-corp",
            type: "folder",
            path: "/customers/acme-corp",
            contextLevel: "customer",
            metadata: { customer: "acme-corp" },
          },
          {
            id: "globex",
            name: "globex",
            type: "folder",
            path: "/customers/globex",
            contextLevel: "customer",
            metadata: { customer: "globex" },
          },
          {
            id: "initech",
            name: "initech",
            type: "folder",
            path: "/customers/initech",
            contextLevel: "customer",
            metadata: { customer: "initech" },
          },
        ],
      },
      {
        id: "templates",
        name: "templates",
        type: "folder",
        path: "/templates",
        contextLevel: "base",
        children: [
          {
            id: "docker-compose.yml",
            name: "docker-compose.yml",
            type: "file",
            path: "/templates/docker-compose.yml",
            contextLevel: "content",
          },
          {
            id: "nginx.conf",
            name: "nginx.conf",
            type: "file",
            path: "/templates/nginx.conf",
            contextLevel: "content",
          },
        ],
      },
    ]
  }

  // Customer level - show products
  if (customer && !product) {
    return [
      {
        id: "products",
        name: "products",
        type: "folder",
        path: `/customers/${customer}/products`,
        contextLevel: "customer",
        children: [
          {
            id: "web-app",
            name: "web-app",
            type: "folder",
            path: `/customers/${customer}/products/web-app`,
            contextLevel: "product",
            metadata: { customer, product: "web-app" },
          },
          {
            id: "api-service",
            name: "api-service",
            type: "folder",
            path: `/customers/${customer}/products/api-service`,
            contextLevel: "product",
            metadata: { customer, product: "api-service" },
          },
          {
            id: "mobile-app",
            name: "mobile-app",
            type: "folder",
            path: `/customers/${customer}/products/mobile-app`,
            contextLevel: "product",
            metadata: { customer, product: "mobile-app" },
          },
        ],
      },
      {
        id: "customer-config.yml",
        name: "customer-config.yml",
        type: "file",
        path: `/customers/${customer}/customer-config.yml`,
        contextLevel: "content",
      },
    ]
  }

  // Product level - show environments
  if (customer && product && !environment) {
    return [
      {
        id: "environments",
        name: "environments",
        type: "folder",
        path: `/customers/${customer}/products/${product}/environments`,
        contextLevel: "product",
        children: [
          {
            id: "development",
            name: "development",
            type: "folder",
            path: `/customers/${customer}/products/${product}/environments/development`,
            contextLevel: "environment",
            metadata: { customer, product, environment: "development" },
          },
          {
            id: "staging",
            name: "staging",
            type: "folder",
            path: `/customers/${customer}/products/${product}/environments/staging`,
            contextLevel: "environment",
            metadata: { customer, product, environment: "staging" },
          },
          {
            id: "production",
            name: "production",
            type: "folder",
            path: `/customers/${customer}/products/${product}/environments/production`,
            contextLevel: "environment",
            metadata: { customer, product, environment: "production" },
          },
        ],
      },
      {
        id: "product-config.yml",
        name: "product-config.yml",
        type: "file",
        path: `/customers/${customer}/products/${product}/product-config.yml`,
        contextLevel: "content",
      },
    ]
  }

  // Environment level - show instances
  if (customer && product && environment && instance === undefined) {
    return [
      {
        id: "instances",
        name: "instances",
        type: "folder",
        path: `/customers/${customer}/products/${product}/environments/${environment}/instances`,
        contextLevel: "environment",
        children: [
          {
            id: "instance-01",
            name: "instance-01",
            type: "folder",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/1`,
            contextLevel: "instance",
            metadata: { customer, product, environment, instance: 1 },
          },
          {
            id: "instance-02",
            name: "instance-02",
            type: "folder",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/2`,
            contextLevel: "instance",
            metadata: { customer, product, environment, instance: 2 },
          },
        ],
      },
      {
        id: "environment-config.yml",
        name: "environment-config.yml",
        type: "file",
        path: `/customers/${customer}/products/${product}/environments/${environment}/environment-config.yml`,
        contextLevel: "content",
      },
    ]
  }

  // Instance level - show actual files
  if (customer && product && environment && instance !== undefined) {
    return [
      {
        id: "configs",
        name: "configs",
        type: "folder",
        path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/configs`,
        contextLevel: "content",
        children: [
          {
            id: "docker-compose.yml",
            name: "docker-compose.yml",
            type: "file",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/configs/docker-compose.yml`,
            contextLevel: "content",
            size: 2048,
            lastModified: new Date("2024-01-15"),
          },
          {
            id: "nginx.conf",
            name: "nginx.conf",
            type: "file",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/configs/nginx.conf`,
            contextLevel: "content",
            size: 1024,
            lastModified: new Date("2024-01-14"),
          },
          {
            id: "app.env",
            name: "app.env",
            type: "file",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/configs/app.env`,
            contextLevel: "content",
            size: 512,
            lastModified: new Date("2024-01-16"),
          },
        ],
      },
      {
        id: "logs",
        name: "logs",
        type: "folder",
        path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/logs`,
        contextLevel: "content",
        children: [
          {
            id: "app.log",
            name: "app.log",
            type: "file",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/logs/app.log`,
            contextLevel: "content",
            size: 10240,
            lastModified: new Date(),
          },
          {
            id: "error.log",
            name: "error.log",
            type: "file",
            path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/logs/error.log`,
            contextLevel: "content",
            size: 2048,
            lastModified: new Date(),
          },
        ],
      },
      {
        id: "instance-config.yml",
        name: "instance-config.yml",
        type: "file",
        path: `/customers/${customer}/products/${product}/environments/${environment}/instances/${instance}/instance-config.yml`,
        contextLevel: "content",
        size: 1536,
        lastModified: new Date("2024-01-15"),
      },
    ]
  }

  return []
}

// Get appropriate icon for context level
const getContextIcon = (contextLevel?: string, isExpanded?: boolean) => {
  switch (contextLevel) {
    case "customer":
      return <Building2 className="h-4 w-4 text-blue-600" />
    case "product":
      return <Package className="h-4 w-4 text-green-600" />
    case "environment":
      return <Server className="h-4 w-4 text-orange-600" />
    case "instance":
      return <Database className="h-4 w-4 text-purple-600" />
    case "base":
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-slate-600" />
      ) : (
        <Folder className="h-4 w-4 text-slate-600" />
      )
    default:
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-slate-600" />
      ) : (
        <Folder className="h-4 w-4 text-slate-600" />
      )
  }
}

// Get file icon based on extension
const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase()

  switch (ext) {
    case "yml":
    case "yaml":
      return <Settings className="h-4 w-4 text-red-500" />
    case "conf":
    case "config":
      return <Settings className="h-4 w-4 text-blue-500" />
    case "env":
      return <FileText className="h-4 w-4 text-green-500" />
    case "log":
      return <FileText className="h-4 w-4 text-yellow-500" />
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
      return <Code className="h-4 w-4 text-blue-400" />
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return <ImageIcon className="h-4 w-4 text-purple-500" />
    case "zip":
    case "tar":
    case "gz":
      return <Archive className="h-4 w-4 text-orange-500" />
    default:
      return <File className="h-4 w-4 text-slate-500" />
  }
}

// Format file size
const formatFileSize = (bytes?: number) => {
  if (!bytes) return ""
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

// File Explorer Item Component
const FileExplorerItem = ({
  item,
  level = 0,
  onSelect,
  onContextChange,
  expandedItems,
  setExpandedItems,
}: {
  item: FileSystemItem
  level?: number
  onSelect?: (item: FileSystemItem) => void
  onContextChange?: (newContext: Partial<FileExplorerContext>) => void
  expandedItems: Set<string>
  setExpandedItems: (items: Set<string>) => void
}) => {
  const isExpanded = expandedItems.has(item.id)
  const hasChildren = item.children && item.children.length > 0
  const paddingLeft = level * 16 + 8

  const handleToggle = () => {
    const newExpanded = new Set(expandedItems)
    if (isExpanded) {
      newExpanded.delete(item.id)
    } else {
      newExpanded.add(item.id)
    }
    setExpandedItems(newExpanded)
  }

  const handleClick = () => {
    if (item.type === "file") {
      onSelect?.(item)
    } else if (item.contextLevel && item.metadata) {
      // Navigate to this context level
      onContextChange?.(item.metadata)
    } else {
      handleToggle()
    }
  }

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-all duration-150 group hover:bg-slate-100/80 dark:hover:bg-slate-800/60",
          item.type === "file" && "hover:bg-blue-50/80 dark:hover:bg-blue-900/20",
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Button */}
        <div className="flex items-center justify-center w-6 h-6 mr-2">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleToggle()
              }}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-200/80 dark:hover:bg-slate-600/60 transition-all duration-150"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )}
            </button>
          ) : (
            <div className="w-6 h-6" />
          )}
        </div>

        {/* Icon */}
        <div className="mr-3">
          {item.type === "folder" ? getContextIcon(item.contextLevel, isExpanded) : getFileIcon(item.name)}
        </div>

        {/* Name and metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{item.name}</span>
            {item.contextLevel && item.contextLevel !== "content" && (
              <Badge variant="outline" className="text-xs">
                {item.contextLevel}
              </Badge>
            )}
          </div>
          {item.type === "file" && (item.size || item.lastModified) && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {item.size && formatFileSize(item.size)}
              {item.size && item.lastModified && " • "}
              {item.lastModified && item.lastModified.toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-2 border-l border-slate-200 dark:border-slate-700 pl-2">
          {item.children!.map((child) => (
            <FileExplorerItem
              key={child.id}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              onContextChange={onContextChange}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Context Breadcrumb Component
const ContextBreadcrumb = ({
  context,
  onContextChange,
}: {
  context: FileExplorerContext
  onContextChange?: (newContext: Partial<FileExplorerContext>) => void
}) => {
  const breadcrumbs = []

  breadcrumbs.push({
    label: context.baseDirectory || "/",
    level: "base",
    context: { baseDirectory: context.baseDirectory },
  })

  if (context.customer) {
    breadcrumbs.push({
      label: context.customer,
      level: "customer",
      context: { baseDirectory: context.baseDirectory, customer: context.customer },
    })
  }

  if (context.product) {
    breadcrumbs.push({
      label: context.product,
      level: "product",
      context: { ...context, environment: undefined, instance: undefined },
    })
  }

  if (context.environment) {
    breadcrumbs.push({
      label: context.environment,
      level: "environment",
      context: { ...context, instance: undefined },
    })
  }

  if (context.instance) {
    breadcrumbs.push({
      label: String(context.instance),
      level: "instance",
      context: context,
    })
  }

  return (
    <div className="flex items-center gap-1 p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
          <button
            onClick={() => onContextChange?.(crumb.context)}
            className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {crumb.label}
          </button>
        </div>
      ))}
    </div>
  )
}

// Main File Explorer Component
export const FileExplorer = ({ context, onFileSelect, onContextChange, className }: FileExplorerProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(["customers", "products", "environments", "instances"]),
  )

  const fileSystemData = useMemo(() => generateFileSystemData(context), [context])

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <ContextBreadcrumb context={context} onContextChange={onContextChange} />
      </CardHeader>
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-1">
          {fileSystemData.map((item) => (
            <FileExplorerItem
              key={item.id}
              item={item}
              onSelect={onFileSelect}
              onContextChange={onContextChange}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}