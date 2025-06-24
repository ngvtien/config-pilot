import { describe, expect, it } from 'vitest';
import { generateHelmResourceTemplate } from '../../../../src/renderer/utils/helm-template-generator';

describe('generateHelmResourceTemplate', () => {
  it('should generate correct Helm template with proper RBAC apiVersion', () => {
    const mockResource = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      group: 'rbac.authorization.k8s.io',
      version: 'v1'
    };

    const result = generateHelmResourceTemplate(mockResource, 'test-template');

    expect(result).toContain('apiVersion: rbac.authorization.k8s.io/v1');
    expect(result).toContain('kind: RoleBinding');
    expect(result).not.toContain('apiVersion: rbac/v1'); // Should NOT be truncated
  });

  it('should handle different resource kinds correctly', () => {
    const deploymentResource = {
      apiVersion: 'apps/v1',
      kind: 'Deployment'
    };

    const result = generateHelmResourceTemplate(deploymentResource, 'test-app');

    expect(result).toContain('apiVersion: apps/v1');
    expect(result).toContain('kind: Deployment');
    expect(result).toContain('replicas: {{ .Values.deployment.replicas | default 1 }}');
  });
});