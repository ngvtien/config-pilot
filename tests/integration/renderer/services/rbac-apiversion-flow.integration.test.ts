/**
 * Comprehensive RBAC apiVersion flow test - from backend through frontend to template output
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SchemaService } from '../../../../src/main/services/schema-service';
import { KubernetesSchemaIndexer } from '../../../../src/renderer/services/kubernetes-schema-indexer';
import { generateHelmResourceTemplate } from '../../../../src/renderer/utils/helm-template-generator';

// Mock the electron API for file operations
const mockElectronAPI = {
  readFile: vi.fn()
};
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI
});

describe('RBAC apiVersion Complete Flow', () => {
  let schemaService: SchemaService;
  let schemaIndexer: KubernetesSchemaIndexer;

  beforeEach(() => {
    vi.clearAllMocks();
    schemaService = new SchemaService();
    schemaIndexer = new KubernetesSchemaIndexer();
  });

  it('should preserve RBAC apiVersion through complete backend-to-frontend-to-template flow', async () => {
    // 1. Backend: Schema service extracts correct apiVersion
    const mockDefinition = {
      type: 'object',
      'x-kubernetes-group-version-kind': [{
        group: 'rbac.authorization.k8s.io',
        kind: 'RoleBinding',
        version: 'v1'
      }]
    } as any;

    const backendApiVersion = (schemaService as any).extractApiVersionFromKey(
      'io.k8s.api.rbac.v1.RoleBinding',
      mockDefinition
    );
    expect(backendApiVersion).toBe('rbac.authorization.k8s.io/v1');

    // 2. Frontend: Mock schema definitions file
    const mockSchemaDefinitions = {
      definitions: {
        'io.k8s.api.rbac.v1.RoleBinding': mockDefinition
      }
    };

    // Mock file reading to return our test definitions
    mockElectronAPI.readFile.mockResolvedValue(JSON.stringify(mockSchemaDefinitions));

    // Load schemas using the correct API
    await schemaIndexer.loadSchemaDefinitions('/mock/path/to/definitions.json');
    const indexedSchema = await schemaIndexer.getSchemaByGVK('rbac.authorization.k8s.io', 'v1', 'RoleBinding');
    
    expect(indexedSchema).not.toBeNull();
    expect(indexedSchema!.apiVersion).toBe('rbac.authorization.k8s.io/v1');
    expect(indexedSchema!.group).toBe('rbac.authorization.k8s.io');
    expect(indexedSchema!.version).toBe('v1');

    // 3. Template generation: Should use correct apiVersion
    const templateResource = {
      apiVersion: indexedSchema!.apiVersion,
      kind: 'RoleBinding',
      metadata: { name: 'test-rolebinding' },
      subjects: [],
      roleRef: { kind: 'Role', name: 'test-role', apiGroup: 'rbac.authorization.k8s.io' }
    };

    const helmTemplate = generateHelmResourceTemplate(templateResource, 'test-template');
    expect(helmTemplate).toContain('apiVersion: rbac.authorization.k8s.io/v1');
    expect(helmTemplate).not.toContain('apiVersion: rbac/v1');
  });

  it('should handle Role resources with correct apiVersion', async () => {
    const mockDefinition = {
      type: 'object',
      'x-kubernetes-group-version-kind': [{
        group: 'rbac.authorization.k8s.io',
        kind: 'Role',
        version: 'v1'
      }]
    } as any;

    const backendApiVersion = (schemaService as any).extractApiVersionFromKey(
      'io.k8s.api.rbac.v1.Role',
      mockDefinition
    );
    expect(backendApiVersion).toBe('rbac.authorization.k8s.io/v1');

    const mockSchemaDefinitions = {
      definitions: {
        'io.k8s.api.rbac.v1.Role': mockDefinition
      }
    };

    mockElectronAPI.readFile.mockResolvedValue(JSON.stringify(mockSchemaDefinitions));

    await schemaIndexer.loadSchemaDefinitions('/mock/path/to/definitions.json');
    const indexedSchema = await schemaIndexer.getSchemaByGVK('rbac.authorization.k8s.io', 'v1', 'Role');
    
    expect(indexedSchema).not.toBeNull();
    expect(indexedSchema!.apiVersion).toBe('rbac.authorization.k8s.io/v1');
  });

  it('should detect apiVersion corruption points', async () => {
    // Test where apiVersion might get corrupted during processing
    const originalResource = {
      group: 'rbac.authorization.k8s.io',
      version: 'v1',
      kind: 'RoleBinding',
      apiVersion: 'rbac.authorization.k8s.io/v1'
    };

    // Test fallback logic that might be corrupting apiVersion
    const testFallback = (resource: any) => {
      if (!resource.apiVersion && resource.group && resource.version) {
        resource.apiVersion = resource.group === 'core' ? resource.version : `${resource.group}/${resource.version}`;
      }
      return resource;
    };

    const result = testFallback({ ...originalResource, apiVersion: undefined });
    expect(result.apiVersion).toBe('rbac.authorization.k8s.io/v1');

    // Test that existing apiVersion is preserved
    const preservedResult = testFallback(originalResource);
    expect(preservedResult.apiVersion).toBe('rbac.authorization.k8s.io/v1');
  });
});