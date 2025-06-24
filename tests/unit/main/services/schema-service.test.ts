/**
 * Unit tests for schema-service.ts - RBAC apiVersion extraction
 */
// import { beforeEach, describe, it } from 'node:test';
import { beforeEach, describe, it, expect } from 'vitest';
import { SchemaService } from '../../../../src/main/services/schema-service';
import { JSONSchema7 } from 'json-schema';

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
});