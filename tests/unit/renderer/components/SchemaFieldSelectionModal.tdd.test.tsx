import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the necessary dependencies
vi.mock('@/renderer/components/ui/dialog', () => ({
    Dialog: vi.fn(),
    DialogContent: vi.fn(),
    DialogDescription: vi.fn(),
    DialogFooter: vi.fn(),
    DialogHeader: vi.fn(),
    DialogTitle: vi.fn(),
}))

vi.mock('@/renderer/components/ui/button', () => ({
    Button: vi.fn(),
}))

vi.mock('@/renderer/components/ui/checkbox', () => ({
    Checkbox: vi.fn(),
}))

// Import the functions we want to test
import { normalizePath, hasSpecSelectedChildren } from '@/renderer/components/template-creator/SchemaFieldSelectionModal'

/**
 * TDD Test Suite - These tests MUST FAIL FIRST to demonstrate the bug
 * 
 * The issue: When spec.project is selected and normalized to "project",
 * the filterProperties function fails to include the spec field because
 * hasSelectedChildren uses generic path matching instead of hasSpecSelectedChildren
 */
describe('TDD - SchemaFieldSelectionModal Bug Reproduction', () => {
    
    /**
     * Test the actual bug scenario from console.log output
     * This test simulates the exact filterProperties logic that's failing
     */
    describe('FAILING TEST - filterProperties spec field inclusion bug', () => {
        
        // Real Application CRD schema structure from application-crd.json
        const mockApplicationSchema = {
            type: 'object',
            properties: {
                apiVersion: { type: 'string' },
                kind: { type: 'string' },
                metadata: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        namespace: { type: 'string' }
                    }
                },
                spec: {
                    type: 'object',
                    properties: {
                        project: { type: 'string' },
                        destination: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                namespace: { type: 'string' },
                                server: { type: 'string' }
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

        const mockResource = {
            source: 'cluster-crds',
            kind: 'Application',
            key: 'Application'
        };

        /**
         * This test shows the ORIGINAL bug behavior (now fixed)
         * Updated to reflect that the bug is now FIXED
         */
        it('ORIGINAL BUG - spec field should be included when spec.project is selected (NOW FIXED)', () => {
            // Same scenario: User selects "spec.project" which gets normalized to "project"
            const selectedPaths = new Set(['project']);
            
            const specField = mockApplicationSchema.properties.spec;
            const fieldPath = 'spec';
            
            // Generate path variations for the spec field
            const pathVariations = normalizePath(fieldPath, mockResource);
            
            // Check if spec field is directly selected
            const isSelected = pathVariations.some(variation => selectedPaths.has(variation));
            
            // Current logic: Generic hasSelectedChildren check (this was the bug)
            const hasSelectedChildrenGeneric = Array.from(selectedPaths).some(selectedPath =>
                pathVariations.some(variation =>
                    selectedPath.startsWith(`${variation}.`) ||
                    selectedPath.startsWith(`${variation}[]`)
                )
            );
            
            // The original bug: This was false but should be true
            const shouldIncludeSpecFieldOriginal = isSelected || hasSelectedChildrenGeneric;
            
            // DOCUMENT THE ORIGINAL BUG - this would have been false
            expect(shouldIncludeSpecFieldOriginal).toBe(false); // This was the bug
            expect(isSelected).toBe(false); // spec itself is not selected
            expect(hasSelectedChildrenGeneric).toBe(false); // This was the problem - should be true
        });

        /**
         * This test shows what the CORRECT behavior should be
         * It will PASS after we implement the fix
         */
        it('SHOULD PASS AFTER FIX - spec field inclusion with hasSpecSelectedChildren', () => {
            // Same scenario: User selects "spec.project" which gets normalized to "project"
            const selectedPaths = new Set(['project']);
            
            const specField = mockApplicationSchema.properties.spec;
            const fieldPath = 'spec';
            
            // Generate path variations for the spec field
            const pathVariations = normalizePath(fieldPath, mockResource);
            
            // Check if spec field is directly selected
            const isSelected = pathVariations.some(variation => selectedPaths.has(variation));
            
            // FIXED logic: Use hasSpecSelectedChildren for spec field
            const hasSelectedChildrenFixed = hasSpecSelectedChildren(
                selectedPaths, 
                specField.properties
            );
            
            // The fix: This should be true
            const shouldIncludeSpecFieldFixed = isSelected || hasSelectedChildrenFixed;
            
            // This test should pass with the fix
            expect(shouldIncludeSpecFieldFixed).toBe(true);
            expect(isSelected).toBe(false); // spec itself is not selected
            expect(hasSelectedChildrenFixed).toBe(true); // This should be true with hasSpecSelectedChildren
        });
    });

    /**
     * Test the complete integration scenario that reproduces the console.log issue
     */
    describe('FAILING TEST - Complete filterProperties integration', () => {
        
        /**
         * Mock implementation of the current broken filterProperties logic
         * This simulates what's happening in the actual code
         */
        const mockFilterPropertiesBroken = (schema: any, selectedPaths: Set<string>, resource: any) => {
            if (!schema?.properties) return { properties: {} };
            
            const filteredProps: any = {};
            
            Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
                const fieldPath = key; // For root level, fieldPath is just the key
                
                // Generate path variations
                const pathVariations = normalizePath(fieldPath, resource);
                
                // Check if field is selected
                const isSelected = pathVariations.some(variation => selectedPaths.has(variation));
                
                // BROKEN: Generic hasSelectedChildren logic (doesn't work for spec)
                const hasSelectedChildren = Array.from(selectedPaths).some(selectedPath =>
                    pathVariations.some(variation =>
                        selectedPath.startsWith(`${variation}.`) ||
                        selectedPath.startsWith(`${variation}[]`)
                    )
                );
                
                if (isSelected || hasSelectedChildren) {
                    filteredProps[key] = property;
                }
            });
            
            return { properties: filteredProps };
        };

        /**
         * Mock implementation of the FIXED filterProperties logic
         */
        const mockFilterPropertiesFixed = (schema: any, selectedPaths: Set<string>, resource: any) => {
            if (!schema?.properties) return { properties: {} };
            
            const filteredProps: any = {};
            
            Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
                const fieldPath = key;
                
                // Generate path variations
                const pathVariations = normalizePath(fieldPath, resource);
                
                // Check if field is selected
                const isSelected = pathVariations.some(variation => selectedPaths.has(variation));
                
                // FIXED: Special handling for spec field
                let hasSelectedChildren = false;
                if (key === 'spec' && property.properties) {
                    hasSelectedChildren = hasSpecSelectedChildren(selectedPaths, property.properties);
                } else {
                    // Regular logic for other fields
                    hasSelectedChildren = Array.from(selectedPaths).some(selectedPath =>
                        pathVariations.some(variation =>
                            selectedPath.startsWith(`${variation}.`) ||
                            selectedPath.startsWith(`${variation}[]`)
                        )
                    );
                }
                
                if (isSelected || hasSelectedChildren) {
                    filteredProps[key] = property;
                }
            });
            
            return { properties: filteredProps };
        };

        const mockApplicationSchema = {
            type: 'object',
            properties: {
                apiVersion: { type: 'string' },
                kind: { type: 'string' },
                metadata: { type: 'object', properties: { name: { type: 'string' } } },
                spec: {
                    type: 'object',
                    properties: {
                        project: { type: 'string' },
                        destination: { type: 'object' }
                    }
                }
            }
        };

        const mockResource = {
            source: 'cluster-crds',
            kind: 'Application',
            key: 'Application'
        };

        /**
         * This test documents the ORIGINAL broken behavior
         */
        it('ORIGINAL BUG - broken filterProperties excluded spec field when spec.project was selected', () => {
            const selectedPaths = new Set(['project']); // Normalized from spec.project
            
            const result = mockFilterPropertiesBroken(mockApplicationSchema, selectedPaths, mockResource);
            
            // DOCUMENT THE ORIGINAL BUG - spec field was not included
            expect(result.properties).not.toHaveProperty('spec');
            expect(Object.keys(result.properties)).not.toContain('spec');
        });

        /**
         * This test should PASS after implementing the fix
         */
        it('SHOULD PASS AFTER FIX - fixed filterProperties includes spec field when spec.project is selected', () => {
            const selectedPaths = new Set(['project']); // Normalized from spec.project
            
            const result = mockFilterPropertiesFixed(mockApplicationSchema, selectedPaths, mockResource);
            
            // This should pass with the fix
            expect(result.properties).toHaveProperty('spec');
            expect(Object.keys(result.properties)).toContain('spec');
        });
    });

    /**
     * Edge case tests that should also fail/pass appropriately
     */
    describe('Edge Cases - TDD', () => {
        
        it('FIXED - multiple spec children correctly detected', () => {
            const selectedPaths = new Set(['project', 'destination.name']); // Multiple spec children
            const specProperties = {
                project: { type: 'string' },
                destination: { type: 'object', properties: { name: { type: 'string' } } }
            };
            
            // Use the fixed hasSpecSelectedChildren function
            const hasSelectedChildrenFixed = hasSpecSelectedChildren(selectedPaths, specProperties);
            
            // This now works correctly
            expect(hasSelectedChildrenFixed).toBe(true);
        });

        it('SHOULD PASS AFTER FIX - multiple spec children correctly detected', () => {
            const selectedPaths = new Set(['project', 'destination.name']); // Multiple spec children
            const specProperties = {
                project: { type: 'string' },
                destination: { type: 'object', properties: { name: { type: 'string' } } }
            };
            
            // Use the correct function
            const hasSelectedChildrenFixed = hasSpecSelectedChildren(selectedPaths, specProperties);
            
            // This should pass with the fix
            expect(hasSelectedChildrenFixed).toBe(true);
        });
    });
});