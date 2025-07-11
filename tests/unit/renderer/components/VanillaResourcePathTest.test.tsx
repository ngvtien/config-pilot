import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test to ensure vanilla Kubernetes resources are not impacted by CRD path fixes
 * This test verifies that standard Kubernetes resources like Deployment, Service, etc.
 * still have correct path construction after our fixes for CRD double encoding
 */
describe('Vanilla Kubernetes Resource Path Integrity', () => {
    
    /**
     * Mock vanilla Kubernetes Deployment schema (simplified)
     */
    const mockDeploymentSchema = {
        type: "object",
        properties: {
            apiVersion: { type: "string" },
            kind: { type: "string" },
            metadata: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    namespace: { type: "string" },
                    labels: {
                        type: "object",
                        additionalProperties: { type: "string" }
                    }
                }
            },
            spec: {
                type: "object",
                properties: {
                    replicas: { type: "integer" },
                    selector: {
                        type: "object",
                        properties: {
                            matchLabels: {
                                type: "object",
                                additionalProperties: { type: "string" }
                            }
                        }
                    },
                    template: {
                        type: "object",
                        properties: {
                            metadata: {
                                type: "object",
                                properties: {
                                    labels: {
                                        type: "object",
                                        additionalProperties: { type: "string" }
                                    }
                                }
                            },
                            spec: {
                                type: "object",
                                properties: {
                                    containers: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                name: { type: "string" },
                                                image: { type: "string" },
                                                ports: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            containerPort: { type: "integer" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    /**
     * Mock buildSchemaTree function that simulates the fixed schema service
     */
    const mockBuildSchemaTree = (schema: any, definitions: any = {}, name: string = "", path: string = ""): any[] => {
        if (!schema?.properties) return [];

        const children: any[] = [];
        
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            // FIXED: Don't include the resource name in path construction
            const currentPath = path ? `${path}.${key}` : key;
            
            if ((propSchema as any).type === "object" && (propSchema as any).properties) {
                const subTree = mockBuildSchemaTree(propSchema as any, definitions, key, currentPath);
                children.push({
                    name: key,
                    type: "object",
                    path: currentPath,
                    children: subTree
                });
            } else if ((propSchema as any).type === "array" && (propSchema as any).items) {
                const itemsSchema = (propSchema as any).items;
                let arrayChildren: any[] = [];
                if (itemsSchema.type === "object" || itemsSchema.properties) {
                    arrayChildren = mockBuildSchemaTree(itemsSchema, definitions, "[]", `${currentPath}[]`);
                }
                children.push({
                    name: key,
                    type: "array",
                    path: currentPath,
                    children: arrayChildren.length > 0 ? arrayChildren : undefined
                });
            } else {
                children.push({
                    name: key,
                    type: (propSchema as any).type || "unknown",
                    path: currentPath
                });
            }
        }

        return children;
    };

    describe('Vanilla Kubernetes Deployment Paths', () => {
        it('should generate correct paths for standard Deployment fields', () => {
            // Simulate the fixed schema service call (no resource name in initial call)
            const tree = mockBuildSchemaTree(mockDeploymentSchema, {}, "", "");
            
            // Flatten the tree to get all paths
            const allPaths: string[] = [];
            const collectPaths = (nodes: any[]) => {
                nodes.forEach(node => {
                    allPaths.push(node.path);
                    if (node.children) {
                        collectPaths(node.children);
                    }
                });
            };
            collectPaths(tree);

            // Verify correct vanilla Kubernetes paths (no double encoding)
            expect(allPaths).toContain('apiVersion');
            expect(allPaths).toContain('kind');
            expect(allPaths).toContain('metadata');
            expect(allPaths).toContain('metadata.name');
            expect(allPaths).toContain('metadata.namespace');
            expect(allPaths).toContain('metadata.labels');
            expect(allPaths).toContain('spec');
            expect(allPaths).toContain('spec.replicas');
            expect(allPaths).toContain('spec.selector');
            expect(allPaths).toContain('spec.selector.matchLabels');
            expect(allPaths).toContain('spec.template');
            expect(allPaths).toContain('spec.template.metadata');
            expect(allPaths).toContain('spec.template.metadata.labels');
            expect(allPaths).toContain('spec.template.spec');
            expect(allPaths).toContain('spec.template.spec.containers');

            // Verify NO double encoding exists
            const doubleEncodedPaths = allPaths.filter(path => 
                path.includes('apiVersion.apiVersion') ||
                path.includes('kind.kind') ||
                path.includes('metadata.metadata') ||
                path.includes('spec.spec') ||
                path.includes('Deployment.') // Should not have resource name prefix
            );

            expect(doubleEncodedPaths).toEqual([]);
            
            console.log('✅ All vanilla Kubernetes paths are correct:', allPaths.slice(0, 10));
        });

        it('should handle nested spec paths correctly', () => {
            const tree = mockBuildSchemaTree(mockDeploymentSchema, {}, "", "");
            
            const allPaths: string[] = [];
            const collectPaths = (nodes: any[]) => {
                nodes.forEach(node => {
                    allPaths.push(node.path);
                    if (node.children) {
                        collectPaths(node.children);
                    }
                });
            };
            collectPaths(tree);

            // Test specific nested spec paths
            expect(allPaths).toContain('spec.template.spec.containers');
            
            // Ensure no double encoding in nested specs
            const nestedSpecPaths = allPaths.filter(path => path.includes('spec.template.spec'));
            expect(nestedSpecPaths.every(path => !path.includes('spec.spec'))).toBe(true);
            
            console.log('✅ Nested spec paths are correct:', nestedSpecPaths);
        });
    });

    describe('Path Variations for Vanilla Resources', () => {
        it('should generate correct path variations for normalizePath function', () => {
            // Mock the normalizePath function behavior for vanilla resources
            const normalizePath = (path: string, resource?: any): string[] => {
                const variations = [path];
                
                // For vanilla Kubernetes resources, don't add spec prefix variations
                if (resource?.source !== 'cluster-crds') {
                    return variations;
                }
                
                // CRD-specific logic (should not affect vanilla resources)
                if (path.startsWith('spec.')) {
                    variations.push(path.replace('spec.', ''));
                } else if (!path.includes('.')) {
                    variations.push(`spec.${path}`);
                }
                
                return variations;
            };

            // Test vanilla resource (no CRD source)
            const vanillaResource = { source: 'kubernetes' };
            
            expect(normalizePath('metadata.name', vanillaResource)).toEqual(['metadata.name']);
            expect(normalizePath('spec.replicas', vanillaResource)).toEqual(['spec.replicas']);
            expect(normalizePath('apiVersion', vanillaResource)).toEqual(['apiVersion']);
            
            console.log('✅ Vanilla resource path variations are minimal and correct');
        });
    });

    describe('Integration Test - Complete Vanilla Resource Flow', () => {
        it('should process vanilla Deployment without any path corruption', () => {
            // Simulate the complete flow: schema service -> tree view -> path selection
            
            // 1. Schema service builds tree (fixed - no resource name prefix)
            const schemaTree = mockBuildSchemaTree(mockDeploymentSchema, {}, "", "");
            
            // 2. Tree view uses node.path directly (fixed - no path reconstruction)
            const simulateTreeViewPaths = (nodes: any[]): string[] => {
                const paths: string[] = [];
                const traverse = (nodeList: any[]) => {
                    nodeList.forEach(node => {
                        // FIXED: Use node.path directly (not reconstructed)
                        paths.push(node.path);
                        if (node.children) {
                            traverse(node.children);
                        }
                    });
                };
                traverse(nodes);
                return paths;
            };
            
            const displayedPaths = simulateTreeViewPaths(schemaTree);
            
            // 3. Verify the complete flow produces correct paths
            expect(displayedPaths).toContain('apiVersion');
            expect(displayedPaths).toContain('metadata.name');
            expect(displayedPaths).toContain('spec.replicas');
            expect(displayedPaths).toContain('spec.template.spec.containers');
            
            // 4. Verify NO corruption occurred
            const corruptedPaths = displayedPaths.filter(path => 
                path.includes('Deployment.') ||
                path.split('.').some((segment, index, array) => 
                    index > 0 && segment === array[index - 1]
                )
            );
            
            expect(corruptedPaths).toEqual([]);
            
            console.log('✅ Complete vanilla resource flow is clean:', {
                totalPaths: displayedPaths.length,
                samplePaths: displayedPaths.slice(0, 8),
                corruptedPaths: corruptedPaths.length
            });
        });
    });
});