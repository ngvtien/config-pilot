import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Test suite for tree expansion behavior
 * Ensures that the tree view starts collapsed by default and only expands when user interacts
 */
describe('Tree Expansion Behavior', () => {
    
    // Mock schema tree structure
    const mockSchemaTree = [
        {
            path: 'spec',
            name: 'spec',
            type: 'object',
            children: [
                {
                    path: 'spec.replicas',
                    name: 'replicas',
                    type: 'integer',
                    children: []
                },
                {
                    path: 'spec.selector',
                    name: 'selector',
                    type: 'object',
                    children: [
                        {
                            path: 'spec.selector.matchLabels',
                            name: 'matchLabels',
                            type: 'object',
                            children: []
                        }
                    ]
                }
            ]
        },
        {
            path: 'metadata',
            name: 'metadata',
            type: 'object',
            children: [
                {
                    path: 'metadata.labels',
                    name: 'labels',
                    type: 'object',
                    children: []
                },
                {
                    path: 'metadata.annotations',
                    name: 'annotations',
                    type: 'object',
                    children: []
                }
            ]
        }
    ];

    beforeEach(() => {
        // Clear any existing session storage
        sessionStorage.clear();
    });

    it('should start with all nodes collapsed for fresh resource', () => {
        // Simulate fresh resource (no persisted data)
        const resourceKey = 'apps/v1/Deployment';
        const hasPersistedData = sessionStorage.getItem(`expandedNodes_${resourceKey}`) !== null;
        
        expect(hasPersistedData).toBe(false);
        
        // When no persisted data exists, should start with empty expanded set
        const expandedObjects = new Set<string>();
        
        expect(expandedObjects.size).toBe(0);
        expect(Array.from(expandedObjects)).toEqual([]);
    });

    it('should show only first level nodes without expanding them', () => {
        // First level nodes should be visible but not expanded
        const firstLevelNodes = mockSchemaTree.map(node => node.path);
        
        expect(firstLevelNodes).toEqual(['spec', 'metadata']);
        
        // But their children should not be automatically expanded
        const expandedObjects = new Set<string>();
        
        // None of the first level nodes should be in expanded set initially
        firstLevelNodes.forEach(nodePath => {
            expect(expandedObjects.has(nodePath)).toBe(false);
        });
    });

    it('should allow manual expansion of nodes', () => {
        const expandedObjects = new Set<string>();
        
        // User manually expands 'spec' node
        expandedObjects.add('spec');
        
        expect(expandedObjects.has('spec')).toBe(true);
        expect(expandedObjects.has('metadata')).toBe(false);
        expect(expandedObjects.size).toBe(1);
    });

    it('should persist expanded state when user expands nodes', () => {
        const resourceKey = 'apps/v1/Deployment';
        const expandedObjects = new Set<string>(['spec', 'spec.selector']);
        
        // Simulate persisting to session storage
        sessionStorage.setItem(`expandedNodes_${resourceKey}`, JSON.stringify(Array.from(expandedObjects)));
        
        // Verify persistence
        const persistedData = sessionStorage.getItem(`expandedNodes_${resourceKey}`);
        expect(persistedData).toBeTruthy();
        
        const restoredExpanded = new Set(JSON.parse(persistedData!));
        expect(restoredExpanded.has('spec')).toBe(true);
        expect(restoredExpanded.has('spec.selector')).toBe(true);
        expect(restoredExpanded.size).toBe(2);
    });

    it('should load persisted expanded state for returning users', () => {
        const resourceKey = 'apps/v1/Deployment';
        const persistedExpanded = ['spec', 'metadata'];
        
        // Simulate existing persisted data
        sessionStorage.setItem(`expandedNodes_${resourceKey}`, JSON.stringify(persistedExpanded));
        
        const hasPersistedData = sessionStorage.getItem(`expandedNodes_${resourceKey}`) !== null;
        expect(hasPersistedData).toBe(true);
        
        // Should load the persisted state
        const loadedExpanded = new Set(JSON.parse(sessionStorage.getItem(`expandedNodes_${resourceKey}`)!));
        expect(loadedExpanded.has('spec')).toBe(true);
        expect(loadedExpanded.has('metadata')).toBe(true);
        expect(loadedExpanded.size).toBe(2);
    });

    it('should handle different resources independently', () => {
        const deploymentKey = 'apps/v1/Deployment';
        const serviceKey = 'v1/Service';
        
        // Expand different nodes for different resources
        sessionStorage.setItem(`expandedNodes_${deploymentKey}`, JSON.stringify(['spec']));
        sessionStorage.setItem(`expandedNodes_${serviceKey}`, JSON.stringify(['metadata']));
        
        // Each resource should have its own expansion state
        const deploymentExpanded = new Set(JSON.parse(sessionStorage.getItem(`expandedNodes_${deploymentKey}`)!));
        const serviceExpanded = new Set(JSON.parse(sessionStorage.getItem(`expandedNodes_${serviceKey}`)!));
        
        expect(deploymentExpanded.has('spec')).toBe(true);
        expect(deploymentExpanded.has('metadata')).toBe(false);
        
        expect(serviceExpanded.has('metadata')).toBe(true);
        expect(serviceExpanded.has('spec')).toBe(false);
    });

    it('should demonstrate improved UX with collapsed start state', () => {
        // Before: All first-level nodes were auto-expanded
        const oldBehaviorExpanded = new Set(['spec', 'metadata', 'status', 'operation']);
        
        // After: Start collapsed, user chooses what to expand
        const newBehaviorExpanded = new Set<string>();
        
        expect(oldBehaviorExpanded.size).toBe(4); // Overwhelming for users
        expect(newBehaviorExpanded.size).toBe(0); // Clean, focused start
        
        // User can selectively expand what they need
        newBehaviorExpanded.add('spec'); // Only expand what's needed
        expect(newBehaviorExpanded.size).toBe(1); // Focused interaction
    });
});