import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/renderer/components/ui/badge';
import { SchemaTreeNode } from '../../../shared/types/schema';

interface SchemaTreeViewProps {
    nodes: SchemaTreeNode[] | null;
    onFieldSelect?: (path: string, type: string, name: string, description?: string, required?: boolean) => void;
    selectedPaths?: Set<string>;
    expandedPaths?: Set<string>;
    onToggleExpand?: (path: string) => void;
    highlightedPath?: string | null;
    className?: string;
}

/**
 * Renders a hierarchical tree view of schema properties with selection capability
 * Integrates with SchemaFieldSelectionModal for template field selection
 */
export const SchemaTreeView: React.FC<SchemaTreeViewProps> = ({
    nodes,
    onFieldSelect,
    selectedPaths = new Set(),
    expandedPaths = new Set(), // Add this
    onToggleExpand,
    highlightedPath = null,
    className = ""
}) => {
    // const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Handle null or empty nodes
    if (!nodes || nodes.length === 0) {
        return (
            <div className={`schema-tree ${className}`}>
                <div className="text-gray-500 dark:text-gray-400 text-sm p-4 text-center">
                    {!nodes ? 'Loading schema...' : 'No schema properties available'}
                </div>
            </div>
        );
    }

    /**
     * Toggle expansion state of a tree node
     */
    const toggleNode = (path: string) => {
        if (onToggleExpand) {
            onToggleExpand(path);
        }
    };

    /**
     * Render individual tree node with proper styling and interaction
     */
    const renderNode = (node: SchemaTreeNode, path: string = '', level: number = 0) => {
        const currentPath = path ? `${path}.${node.name}` : node.name;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedPaths.has(currentPath); // Use expandedPaths instead
        const isSelected = selectedPaths.has(currentPath);
        const indent = level * 16;

        return (
            <div key={currentPath} className="space-y-1">
                <div
                    className={`flex items-center space-x-2 p-2 rounded-md transition-colors cursor-pointer ${isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    style={{ marginLeft: `${indent}px` }}
                    onClick={() => {
                        if (hasChildren) {
                            toggleNode(currentPath);
                        } else if (onFieldSelect) {
                            onFieldSelect(
                                currentPath,
                                Array.isArray(node.type) ? node.type[0] : node.type || 'unknown',
                                node.name,
                                node.description,
                                node.required
                            );
                        }
                    }}
                >
                    {/* Add a highlight indicator */}
                    {currentPath === highlightedPath && (       
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse flex-shrink-0" />
                    )}

                    {/* Expansion toggle */}
                    {hasChildren ? (
                        <div className="w-4 h-4 flex items-center justify-center">
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                            ) : (
                                <ChevronRight className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                            )}
                        </div>
                    ) : (
                        <div className="w-4 h-4" />
                    )}

                    {/* Field name and metadata */}
                    <div className="flex-1 flex items-center space-x-2 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {node.name}
                        </span>
                        <Badge
                            variant="secondary"
                            className="text-xs px-1 py-0 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 flex-shrink-0"
                        >
                            {Array.isArray(node.type) ? node.type[0] : node.type}
                        </Badge>
                        {node.required && (
                            <Badge variant="destructive" className="text-xs px-1 py-0 flex-shrink-0">
                                Required
                            </Badge>
                        )}
                        {hasChildren && (
                            <Badge variant="outline" className="text-xs px-1 py-0 flex-shrink-0">
                                {node.children!.length} fields
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Render children when expanded */}
                {hasChildren && isExpanded && (
                    <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                        {node.children!.map(child => renderNode(child, currentPath, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`schema-tree space-y-1 ${className}`}>
            {nodes.map(node => renderNode(node))}
        </div>
    );
};