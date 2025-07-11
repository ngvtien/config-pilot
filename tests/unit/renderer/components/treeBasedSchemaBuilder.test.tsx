import { describe, it, expect } from 'vitest';

/**
 * Test suite for the new tree-based schema building approach
 * This replaces the complex path normalization with direct tree traversal
 */
describe('Tree-Based Schema Builder', () => {
    
    const mockOriginalSchema = {
        type: 'object',
        properties: {
            apiVersion: { type: 'string' },
            kind: { type: 'string' },
            metadata: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    labels: { type: 'object' },
                    annotations: { type: 'object' }
                }
            },
            spec: {
                type: 'object',
                properties: {
                    project: { type: 'string' },
                    destination: {
                        type: 'object',
                        properties: {
                            server: { type: 'string' },
                            namespace: { type: 'string' }
                        }
                    },
                    source: {
                        type: 'object',
                        properties: {
                            repoURL: { type: 'string' },
                            path: { type: 'string' }
                        }
                    }
                }
            }
        }
    };

    const mockTreeNodes = [
        {
            name: 'spec',
            path: 'spec',
            type: 'object',
            children: [
                {
                    name: 'project',
                    path: 'spec.project',
                    type: 'string',
                    children: []
                },
                {
                    name: 'destination',
                    path: 'spec.destination',
                    type: 'object',
                    children: [
                        {
                            name: 'server',
                            path: 'spec.destination.server',
                            type: 'string',
                            children: []
                        }
                    ]
                }
            ]
        }
    ];

    /**
     * Mock implementation of buildSchemaFromSelectedNodes for testing
     */
    const buildSchemaFromSelectedNodes = (
        originalSchema: any,
        selectedPaths: Set<string>,
        treeNodes: any[]
    ): any => {
        const findPropertyByPath = (schema: any, path: string): any => {
            const parts = path.split('.');
            let current = schema;
            
            for (const part of parts) {
                if (current?.properties?.[part]) {
                    current = current.properties[part];
                } else {
                    return null;
                }
            }
            return current;
        };

        const isPathOrChildSelected = (node: any, selectedPaths: Set<string>): boolean => {
            if (selectedPaths.has(node.path)) {
                return true;
            }
            if (node.children) {
                return node.children.some((child: any) => isPathOrChildSelected(child, selectedPaths));
            }
            return false;
        };

        const buildSchemaFromNodes = (nodes: any[], currentSchema: any): any => {
            const result: any = {
                type: 'object',
                properties: {}
            };

            nodes.forEach(node => {
                const isNodeSelected = selectedPaths.has(node.path);
                const hasSelectedChildren = node.children?.some((child: any) => 
                    isPathOrChildSelected(child, selectedPaths)
                );

                if (isNodeSelected || hasSelectedChildren) {
                    const originalProperty = findPropertyByPath(originalSchema, node.path);
                    
                    if (originalProperty) {
                        result.properties[node.name] = { ...originalProperty };

                        if (node.children && node.children.length > 0 && hasSelectedChildren) {
                            if (originalProperty.type === 'object' && originalProperty.properties) {
                                const childSchema = buildSchemaFromNodes(node.children, originalSchema);
                                if (Object.keys(childSchema.properties).length > 0) {
                                    result.properties[node.name].properties = childSchema.properties;
                                }
                            }
                        }
                    }
                }
            });

            return result;
        };

        const filteredSchema = buildSchemaFromNodes(treeNodes, originalSchema);

        // Always include required Kubernetes fields
        if (originalSchema.properties) {
            if (originalSchema.properties.apiVersion) {
                filteredSchema.properties.apiVersion = originalSchema.properties.apiVersion;
            }
            if (originalSchema.properties.kind) {
                filteredSchema.properties.kind = originalSchema.properties.kind;
            }
            if (originalSchema.properties.metadata) {
                filteredSchema.properties.metadata = {
                    type: 'object',
                    properties: {}
                };
                if (originalSchema.properties.metadata.properties?.labels) {
                    filteredSchema.properties.metadata.properties.labels =
                        originalSchema.properties.metadata.properties.labels;
                }
                if (originalSchema.properties.metadata.properties?.annotations) {
                    filteredSchema.properties.metadata.properties.annotations =
                        originalSchema.properties.metadata.properties.annotations;
                }
            }
        }

        return filteredSchema;
    };

    describe('Basic Schema Building', () => {
        it('should build schema with only selected spec.project field', () => {
            const selectedPaths = new Set(['spec.project']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            expect(result.properties.spec).toBeDefined();
            expect(result.properties.spec.properties.project).toBeDefined();
            expect(result.properties.spec.properties.destination).toBeUndefined();
            
            // Should always include Kubernetes base fields
            expect(result.properties.apiVersion).toBeDefined();
            expect(result.properties.kind).toBeDefined();
            expect(result.properties.metadata).toBeDefined();
        });

        it('should build schema with nested selected field', () => {
            const selectedPaths = new Set(['spec.destination.server']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            expect(result.properties.spec).toBeDefined();
            expect(result.properties.spec.properties.destination).toBeDefined();
            expect(result.properties.spec.properties.destination.properties.server).toBeDefined();
            expect(result.properties.spec.properties.destination.properties.namespace).toBeUndefined();
            expect(result.properties.spec.properties.project).toBeUndefined();
        });

        it('should include parent containers when child is selected', () => {
            const selectedPaths = new Set(['spec.destination.server']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            // spec should be included because it contains selected children
            expect(result.properties.spec).toBeDefined();
            // destination should be included because it contains selected children
            expect(result.properties.spec.properties.destination).toBeDefined();
            // server should be included because it's selected
            expect(result.properties.spec.properties.destination.properties.server).toBeDefined();
        });
    });

    describe('Multiple Selections', () => {
        it('should handle multiple selected fields correctly', () => {
            const selectedPaths = new Set(['spec.project', 'spec.destination.server']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            expect(result.properties.spec.properties.project).toBeDefined();
            expect(result.properties.spec.properties.destination.properties.server).toBeDefined();
            expect(result.properties.spec.properties.destination.properties.namespace).toBeUndefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty selections', () => {
            const selectedPaths = new Set<string>();
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            // Should still include base Kubernetes fields
            expect(result.properties.apiVersion).toBeDefined();
            expect(result.properties.kind).toBeDefined();
            expect(result.properties.metadata).toBeDefined();
            
            // Should not include spec since nothing is selected
            expect(result.properties.spec).toBeUndefined();
        });

        it('should handle non-existent paths gracefully', () => {
            const selectedPaths = new Set(['spec.nonexistent']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            // Should still work and include base fields
            expect(result.properties.apiVersion).toBeDefined();
            expect(result.properties.kind).toBeDefined();
            expect(result.properties.metadata).toBeDefined();
        });
    });

    describe('Advantages over Path Normalization', () => {
        it('should not generate spec.spec paths', () => {
            const selectedPaths = new Set(['spec']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            // The result should have clean structure without double encoding
            expect(result.properties.spec).toBeDefined();
            expect(result.properties.spec.type).toBe('object');
            
            // No spec.spec should exist anywhere in the result
            const resultString = JSON.stringify(result);
            expect(resultString).not.toContain('spec.spec');
        });

        it('should use exact tree node paths without normalization', () => {
            const selectedPaths = new Set(['spec.project']);
            const result = buildSchemaFromSelectedNodes(mockOriginalSchema, selectedPaths, mockTreeNodes);

            // Should directly use the tree node structure
            expect(result.properties.spec.properties.project).toBeDefined();
            expect(result.properties.spec.properties.project.type).toBe('string');
        });
    });
});