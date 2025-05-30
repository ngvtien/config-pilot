"use client"

import type * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface TreeNode {
  id: string
  label: React.ReactNode
  children?: TreeNode[]
  isExpanded?: boolean
  isSelected?: boolean
  onClick?: () => void
  onToggle?: () => void
  level?: number
  icon?: React.ReactNode
  actions?: React.ReactNode
}

interface TreeViewProps {
  data: TreeNode[]
  className?: string
}

const TreeItem = ({ node, level = 0 }: { node: TreeNode; level?: number }) => {
  const hasChildren = node.children && node.children.length > 0
  const paddingLeft = level * 12 + 8

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center py-1.5 px-3 rounded-lg cursor-pointer transition-all duration-150 group relative",
          "hover:bg-slate-100/80 dark:hover:bg-slate-800/60",
          "active:scale-[0.98] active:bg-slate-200/80 dark:active:bg-slate-700/80",
          node.isSelected && "bg-primary/5 transform scale-[1.02] shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        )}
        style={{ paddingLeft }}
        onClick={(e) => {
          e.preventDefault()
          node.onClick?.()
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            node.onClick?.()
          }
          if (e.key === "ArrowRight" && hasChildren && !node.isExpanded) {
            e.preventDefault()
            node.onToggle?.()
          }
          if (e.key === "ArrowLeft" && hasChildren && node.isExpanded) {
            e.preventDefault()
            node.onToggle?.()
          }
        }}
      >
        {/* Expand/Collapse Button - Larger click area */}
        <div className="flex items-center justify-center w-7 h-7 mr-2 -ml-1">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                node.onToggle?.()
              }}
              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-200/80 dark:hover:bg-slate-600/60 transition-all duration-150 hover:scale-105 active:scale-95"
              tabIndex={-1}
            >
              <div
                className={cn("transition-transform duration-200 ease-out", node.isExpanded ? "rotate-90" : "rotate-0")}
              >
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </button>
          ) : (
            <div className="w-7 h-7 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full opacity-60" />
            </div>
          )}
        </div>

        {/* Icon with better spacing */}
        {node.icon && (
          <div className="mr-3 p-1.5 bg-slate-100/80 dark:bg-slate-700/60 rounded-md shadow-sm transition-all duration-150 group-hover:shadow-md">
            {node.icon}
          </div>
        )}

        {/* Label - Better typography */}
        <div className="flex-1 min-w-0 transition-all duration-150">{node.label}</div>

        {/* Actions - Better hover state */}
        {node.actions && (
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 ml-3 transform translate-x-2 group-hover:translate-x-0">
            {node.actions}
          </div>
        )}

        {/* Selection indicator */}
        {node.isSelected && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full animate-in slide-in-from-left-2 duration-200" />
        )}
      </div>

      {/* Children with smooth animation */}
      {hasChildren && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            node.isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="ml-2 mt-1 space-y-0 border-l border-slate-200 dark:border-slate-700 pl-2 relative">
            {/* Connection line styling */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-slate-200 via-slate-300 to-transparent dark:from-slate-700 dark:via-slate-600 dark:to-transparent" />

            {node.children!.map((child) => (
              <TreeItem key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const TreeView = ({ data, className }: TreeViewProps) => {
  return (
    <div
      className={cn(
        "space-y-1 focus-within:outline-none max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar",
        className,
      )}
      role="tree"
      aria-label="Schema tree"
    >
      {data.map((node) => (
        <TreeItem key={node.id} node={node} />
      ))}
    </div>
  )
}
