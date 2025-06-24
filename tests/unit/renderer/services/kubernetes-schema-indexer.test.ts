/**
 * Unit tests for kubernetes-schema-indexer.ts - Frontend processing
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { KubernetesSchemaIndexer } from '../../../../src/renderer/services/kubernetes-schema-indexer';
import { createKubernetesResourceSchema } from '../../../../src/renderer/services/kubernetes-schema-indexer';

describe('KubernetesSchemaIndexer', () => {
  let indexer: KubernetesSchemaIndexer;

  beforeEach(() => {
    indexer = new KubernetesSchemaIndexer();
  });

  describe('metadata extraction from x-kubernetes-group-version-kind', () => {
    it('should preserve correct group information for RBAC resources', () => {
      const mockDefinitions = {
        definitions: {
          'io.k8s.api.rbac.v1.RoleBinding': {
            type: 'object',
            'x-kubernetes-group-version-kind': [
              {
                group: 'rbac.authorization.k8s.io',
                kind: 'RoleBinding',
                version: 'v1'
              }
            ]
          }
        }
      };

      const result = (indexer as any).indexMetadataLazy(mockDefinitions, 'test');
      const metadata = result.byGroupVersionKind.get('rbac.authorization.k8s.io/v1/RoleBinding');

      expect(metadata).toBeDefined();
      expect(metadata.group).toBe('rbac.authorization.k8s.io');
      expect(metadata.version).toBe('v1');
      expect(metadata.kind).toBe('RoleBinding');
    });

    it('should handle core resources correctly', () => {
      const mockDefinitions = {
        definitions: {
          'io.k8s.api.core.v1.Pod': {
            type: 'object',
            'x-kubernetes-group-version-kind': [
              {
                group: '',
                kind: 'Pod',
                version: 'v1'
              }
            ]
          }
        }
      };

      const result = (indexer as any).indexMetadataLazy(mockDefinitions, 'test');
      const metadata = result.byGroupVersionKind.get('core/v1/Pod');

      expect(metadata).toBeDefined();
      expect(metadata.group).toBe('core');
      expect(metadata.version).toBe('v1');
    });
  });

  describe('createKubernetesResourceSchema', () => {
    it('should NOT reconstruct apiVersion for RBAC resources', () => {
      const base = {
        group: 'rbac.authorization.k8s.io',
        version: 'v1',
        kind: 'RoleBinding'
      };
  
      // Call the standalone function directly, not as a method
      const result = createKubernetesResourceSchema(base);
      
      // Current WRONG behavior - this test will fail until we fix it
      expect(result.apiVersion).toBe('rbac.authorization.k8s.io/v1'); // This will fail!
      
      // TODO: Fix the implementation to preserve backend apiVersion
      // The correct behavior should be to use the apiVersion from backend
    });
  });
});