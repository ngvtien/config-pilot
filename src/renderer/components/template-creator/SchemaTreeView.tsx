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
 * Render individual tree node with minimal visual indicators (selected-only checkboxes)
 */
    const renderNode = (node: SchemaTreeNode, path: string = '', level: number = 0) => {
        const currentPath = path ? `${path}.${node.name}` : node.name;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedPaths.has(currentPath);
        const isSelected = selectedPaths.has(currentPath);
        const isHighlighted = currentPath === highlightedPath;
        const indent = level * 16;

        return (
            <div key={currentPath} className="space-y-1">
                <div
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-all duration-300 cursor-pointer relative ${isHighlighted
                            ? 'bg-gradient-to-r from-yellow-100 via-yellow-50 to-transparent dark:from-yellow-900/50 dark:via-yellow-800/30 dark:to-transparent shadow-lg transform scale-[1.02]'
                            : isSelected
                                ? 'bg-gradient-to-r from-green-100 via-green-50 to-transparent dark:from-green-900/40 dark:via-green-800/20 dark:to-transparent shadow-md'
                                : 'hover:bg-gradient-to-r hover:from-gray-100 hover:to-transparent dark:hover:from-gray-700 dark:hover:to-transparent'
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
                    {/* Visual indicators */}
                    <div className="flex items-center space-x-1">
                        {/* Highlight pulse indicator */}
                        {isHighlighted && (
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse flex-shrink-0 shadow-md" />
                        )}

                        {/* Selection indicator - only show small dot if selected and not highlighted */}
                        {isSelected && !isHighlighted && (
                            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 shadow-sm" />
                        )}
                    </div>

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
                        <span className={`text-sm font-medium truncate transition-colors ${isSelected
                                ? 'text-green-800 dark:text-green-200 font-semibold'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}>
                            {node.name}
                        </span>
                        <Badge
                            variant="secondary"
                            className={`text-xs px-1 py-0 flex-shrink-0 transition-colors ${isSelected
                                    ? 'bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                                }`}
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

                    {/* Only show circular checkbox when field is selected */}
                    {!hasChildren && isSelected && (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shadow-md transform scale-110 transition-all duration-200">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
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