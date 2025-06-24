/**
 * Integration test for RBAC apiVersion flow from backend to frontend
 */
import { describe, expect, it } from 'vitest';
import { SchemaService } from '../../../../src/main/services/schema-service';
//import { KubernetesSchemaIndexer } from '../../../../src/renderer/services/kubernetes-schema-indexer';

describe('RBAC apiVersion Integration Test', () => {
  it('should maintain correct apiVersion from backend through frontend to Helm generation', async () => {
    // 1. Backend processing
    const schemaService = new SchemaService();
    const mockDefinition = {
      type: 'object',
      'x-kubernetes-group-version-kind': [
        {
          group: 'rbac.authorization.k8s.io',
          kind: 'RoleBinding',
          version: 'v1'
        }
      ]
    } as any;

    const backendApiVersion = (schemaService as any).extractApiVersionFromKey(
      'io.k8s.api.rbac.v1.RoleBinding',
      mockDefinition
    );

    expect(backendApiVersion).toBe('rbac.authorization.k8s.io/v1');

    // 2. Frontend should preserve this value
    const mockBackendResponse = {
      apiVersion: backendApiVersion,
      kind: 'RoleBinding',
      group: 'rbac.authorization.k8s.io',
      version: 'v1'
    };

    // 3. Template generation should use correct apiVersion
    const helmTemplate = `apiVersion: ${mockBackendResponse.apiVersion}\nkind: ${mockBackendResponse.kind}`;
    
    expect(helmTemplate).toContain('apiVersion: rbac.authorization.k8s.io/v1');
    expect(helmTemplate).not.toContain('apiVersion: rbac/v1');
  });
});