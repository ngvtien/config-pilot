/**
 * Unit tests for schema-service.ts - RBAC apiVersion extraction
 */
// import { beforeEach, describe, it } from 'node:test';
import { beforeEach, describe, it, expect } from 'vitest';
import { SchemaService } from '../../../../src/main/services/schema-service';
import { JSONSchema7 } from 'json-schema';
import { FlattenedResource } from '../../../../src/shared/types/schema';

describe('SchemaService - extractApiVersionFromKey', () => {
  let schemaService: SchemaService;

  beforeEach(() => {
    schemaService = new SchemaService();
  });

  describe('x-kubernetes-group-version-kind metadata handling', () => {
    it('should extract correct apiVersion from RBAC RoleBinding metadata', () => {
      const definition: JSONSchema7 = {
        type: 'object',
        'x-kubernetes-group-version-kind': [
          {
            group: 'rbac.authorization.k8s.io',
            kind: 'RoleBinding',
            version: 'v1'
          }
        ]
      } as any;

      const result = (schemaService as any).extractApiVersionFromKey(
        'io.k8s.api.rbac.v1.RoleBinding',
        definition
      );

      expect(result).toBe('rbac.authorization.k8s.io/v1');
    });

    it('should extract correct apiVersion from RBAC Role metadata', () => {
      const definition: JSONSchema7 = {
        type: 'object',
        'x-kubernetes-group-version-kind': [
          {
            group: 'rbac.authorization.k8s.io',
            kind: 'Role',
            version: 'v1'
          }
        ]
      } as any;

      const result = (schemaService as any).extractApiVersionFromKey(
        'io.k8s.api.rbac.v1.Role',
        definition
      );

      expect(result).toBe('rbac.authorization.k8s.io/v1');
    });

    it('should handle core resources correctly', () => {
      const definition: JSONSchema7 = {
        type: 'object',
        'x-kubernetes-group-version-kind': [
          {
            group: '',
            kind: 'Pod',
            version: 'v1'
          }
        ]
      } as any;

      const result = (schemaService as any).extractApiVersionFromKey(
        'io.k8s.api.core.v1.Pod',
        definition
      );

      expect(result).toBe('v1');
    });

    it('should fallback to key parsing when metadata is missing', () => {
      const definition: JSONSchema7 = {
        type: 'object'
      };

      const result = (schemaService as any).extractApiVersionFromKey(
        'io.k8s.api.apps.v1.Deployment',
        definition
      );

      expect(result).toBe('apps/v1');
    });

    it('should prioritize metadata over key parsing', () => {
      const definition: JSONSchema7 = {
        type: 'object',
        'x-kubernetes-group-version-kind': [
          {
            group: 'rbac.authorization.k8s.io',
            kind: 'ClusterRole',
            version: 'v1'
          }
        ]
      } as any;

      // Even with truncated key, should use metadata
      const result = (schemaService as any).extractApiVersionFromKey(
        'io.k8s.api.rbac.v1.ClusterRole',
        definition
      );

      expect(result).toBe('rbac.authorization.k8s.io/v1');
    });
  });

  describe('flattenResource integration', () => {
    it('should create flattened resource with correct apiVersion from metadata', () => {
      const definition: JSONSchema7 = {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          kind: { type: 'string' },
          metadata: { type: 'object' }
        },
        'x-kubernetes-group-version-kind': [
          {
            group: 'rbac.authorization.k8s.io',
            kind: 'RoleBinding',
            version: 'v1'
          }
        ]
      } as any;

      const source = { id: 'test-source' };
      const result = (schemaService as any).flattenResource(
        'io.k8s.api.rbac.v1.RoleBinding',
        definition,
        source
      );

      expect(result).not.toBeNull();
      expect(result.apiVersion).toBe('rbac.authorization.k8s.io/v1');
      expect(result.kind).toBe('RoleBinding');
    });
  });

  describe('SchemaService - searchInSource prioritized search', () => {
    let schemaService: SchemaService;
    
    beforeEach(() => {
      schemaService = new SchemaService();
      
      // Mock the resourcesBySource map with test data
      const mockResources = new Map<string, FlattenedResource>([
        ['role', {
          key: 'io.k8s.api.rbac.v1.Role',
          kind: 'Role',
          apiVersion: 'rbac.authorization.k8s.io/v1',
          description: 'Role is a namespaced, logical grouping of PolicyRules',
          source: 'kubernetes'
        }],
        ['rolebinding', {
          key: 'io.k8s.api.rbac.v1.RoleBinding',
          kind: 'RoleBinding',
          apiVersion: 'rbac.authorization.k8s.io/v1',
          description: 'RoleBinding references a role, but does not contain it',
          source: 'kubernetes'
        }],
        ['clusterrole', {
          key: 'io.k8s.api.rbac.v1.ClusterRole',
          kind: 'ClusterRole',
          apiVersion: 'rbac.authorization.k8s.io/v1',
          description: 'ClusterRole is a cluster level, logical grouping of PolicyRules',
          source: 'kubernetes'
        }],
        ['deployment', {
          key: 'io.k8s.api.apps.v1.Deployment',
          kind: 'Deployment',
          apiVersion: 'apps/v1',
          description: 'Deployment enables declarative updates for Pods and ReplicaSets',
          source: 'kubernetes'
        }],
        ['customrole', {
          key: 'custom.example.com.v1.CustomRole',
          kind: 'CustomRole',
          apiVersion: 'custom.example.com/v1',
          description: 'A custom role resource',
          source: 'cluster-crds'
        }]
      ]);
      
      // Set up the mock data
      (schemaService as any).resourcesBySource = new Map([['kubernetes', mockResources]]);
      (schemaService as any).isInitialized = true;
    });
  
    describe('exact match prioritization', () => {
      it('should return exact match first when searching for "Role"', () => {
        const results = schemaService.searchInSource('kubernetes', 'Role');
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].kind).toBe('Role');
        expect(results[0].apiVersion).toBe('rbac.authorization.k8s.io/v1');
      });
  
      it('should return exact match first when searching for "role" (case insensitive)', () => {
        const results = schemaService.searchInSource('kubernetes', 'role');
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].kind).toBe('Role');
      });
    });
  
    describe('starts-with match prioritization', () => {
      it('should return starts-with matches after exact matches', () => {
        const results = schemaService.searchInSource('kubernetes', 'Role');
        
        // Should have Role first (exact), then RoleBinding (starts with)
        expect(results.length).toBeGreaterThanOrEqual(2);
        expect(results[0].kind).toBe('Role'); // exact match
        expect(results[1].kind).toBe('RoleBinding'); // starts with match
      });
  
      it('should prioritize starts-with over contains matches', () => {
        const results = schemaService.searchInSource('kubernetes', 'Cluster');
        
        // ClusterRole should come before any resources that just contain "cluster" in description
        const clusterRoleIndex = results.findIndex(r => r.kind === 'ClusterRole');
        expect(clusterRoleIndex).toBe(0); // Should be first as it starts with "Cluster"
      });
    });
  
    describe('contains match as fallback', () => {
      it('should include resources that contain search term in description', () => {
        const results = schemaService.searchInSource('kubernetes', 'PolicyRules');
        
        // Should find Role and ClusterRole as they contain "PolicyRules" in description
        expect(results.length).toBeGreaterThanOrEqual(2);
        const kinds = results.map(r => r.kind);
        expect(kinds).toContain('Role');
        expect(kinds).toContain('ClusterRole');
      });
  
      it('should include resources that contain search term in apiVersion', () => {
        const results = schemaService.searchInSource('kubernetes', 'rbac');
        
        // Should find all RBAC resources
        expect(results.length).toBeGreaterThanOrEqual(3);
        const kinds = results.map(r => r.kind);
        expect(kinds).toContain('Role');
        expect(kinds).toContain('RoleBinding');
        expect(kinds).toContain('ClusterRole');
      });
    });
  
    describe('search result ordering', () => {
      it('should maintain alphabetical order within each priority group', () => {
        const results = schemaService.searchInSource('kubernetes', 'Role');
        
        // Within starts-with matches, should be alphabetical
        const startsWithMatches = results.filter(r => 
          r.kind.toLowerCase().startsWith('role') && r.kind.toLowerCase() !== 'role'
        );
        
        if (startsWithMatches.length > 1) {
          for (let i = 1; i < startsWithMatches.length; i++) {
            expect(startsWithMatches[i-1].kind.localeCompare(startsWithMatches[i].kind))
              .toBeLessThanOrEqual(0);
          }
        }
      });
    });
  
    describe('edge cases', () => {
      it('should return empty array for non-existent source', () => {
        const results = schemaService.searchInSource('non-existent', 'Role');
        expect(results).toEqual([]);
      });
  
      it('should return empty array when not initialized', () => {
        (schemaService as any).isInitialized = false;
        const results = schemaService.searchInSource('kubernetes', 'Role');
        expect(results).toEqual([]);
      });
  
      it('should handle empty search query', () => {
        const results = schemaService.searchInSource('kubernetes', '');
        expect(results).toEqual([]);
      });
  
      it('should handle whitespace-only search query', () => {
        const results = schemaService.searchInSource('kubernetes', '   ');
        expect(results).toEqual([]);
      });
  
      it('should handle search query with no matches', () => {
        const results = schemaService.searchInSource('kubernetes', 'NonExistentResource');
        expect(results).toEqual([]);
      });
    });
  
    describe('case sensitivity', () => {
      it('should be case insensitive for exact matches', () => {
        const upperResults = schemaService.searchInSource('kubernetes', 'ROLE');
        const lowerResults = schemaService.searchInSource('kubernetes', 'role');
        const mixedResults = schemaService.searchInSource('kubernetes', 'RoLe');
        
        expect(upperResults[0]?.kind).toBe('Role');
        expect(lowerResults[0]?.kind).toBe('Role');
        expect(mixedResults[0]?.kind).toBe('Role');
      });
  
      it('should be case insensitive for starts-with matches', () => {
        const results = schemaService.searchInSource('kubernetes', 'ROLE');
        const kinds = results.map(r => r.kind);
        expect(kinds).toContain('RoleBinding');
      });
    });
  });
  
  describe('SchemaService - searchAllSourcesWithCRDs integration', () => {
    let schemaService: SchemaService;
    
    beforeEach(() => {
      schemaService = new SchemaService();
      
      // Mock multiple sources
      const k8sResources = new Map<string, FlattenedResource>([
        ['role', {
          key: 'io.k8s.api.rbac.v1.Role',
          kind: 'Role',
          apiVersion: 'rbac.authorization.k8s.io/v1',
          description: 'Role is a namespaced, logical grouping of PolicyRules',
          source: 'kubernetes'
        }]
      ]);
      
      const crdResources = new Map<string, FlattenedResource>([
        ['customrole', {
          key: 'custom.example.com.v1.CustomRole',
          kind: 'CustomRole',
          apiVersion: 'custom.example.com/v1',
          description: 'A custom role resource',
          source: 'cluster-crds'
        }]
      ]);
      
      (schemaService as any).resourcesBySource = new Map([
        ['kubernetes', k8sResources],
        ['cluster-crds', crdResources]
      ]);
      (schemaService as any).isInitialized = true;
    });
  
    it('should search across all sources and remove duplicates', () => {
      const results = schemaService.searchAllSourcesWithCRDs('Role');
      
      expect(results.length).toBeGreaterThan(0);
      const kinds = results.map(r => r.kind);
      expect(kinds).toContain('Role');
      expect(kinds).toContain('CustomRole');
      
      // Should prioritize exact match
      expect(results[0].kind).toBe('Role');
    });
  
    it('should handle fallback when CRDs are not available', () => {
      // Simulate CRD failure by throwing error in searchInSource for CRD source
      const originalSearchInSource = schemaService.searchInSource;
      schemaService.searchInSource = function(sourceId: string, query: string) {
        if (sourceId === 'cluster-crds') {
          throw new Error('CRD source not available');
        }
        return originalSearchInSource.call(this, sourceId, query);
      };
      
      const results = schemaService.searchAllSourcesWithCRDs('Role');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].kind).toBe('Role');
    });
  });
});