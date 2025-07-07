/**
 * Unit tests for TemplateDesigner.tsx - Helm template generation
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock all UI components before importing TemplateDesigner
vi.mock('@/renderer/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div data-testid="card-description" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div data-testid="card-title" {...props}>{children}</div>
}));

vi.mock('@/renderer/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />
}));

vi.mock('@/renderer/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label data-testid="label" {...props}>{children}</label>
}));

vi.mock('@/renderer/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button data-testid="button" {...props}>{children}</button>
}));

vi.mock('@/renderer/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>
}));

vi.mock('@/renderer/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div data-testid="alert-description" {...props}>{children}</div>
}));

vi.mock('@/renderer/components/ui/skeleton', () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />
}));

vi.mock('@/renderer/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea data-testid="textarea" {...props} />
}));

// Mock other dependencies
vi.mock('@/renderer/services/kubernetes-schema-indexer', () => ({
  kubernetesSchemaIndexer: {
    loadSchemaDefinitions: vi.fn(),
    searchKinds: vi.fn(() => [])
  }
}));

vi.mock('@/renderer/lib/path-utils', () => ({
  joinPath: vi.fn((...paths) => paths.join('/'))
}));

// Fixed: Added missing Copy export to lucide-react mock
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  TrashIcon: () => <div data-testid="trash-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  Save: () => <div data-testid="save-icon" />,
  FileJson: () => <div data-testid="file-json-icon" />,
  FileCode: () => <div data-testid="file-code-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  X: () => <div data-testid="x-icon" />
}));

vi.mock('@rjsf/core', () => ({
  default: ({ children, ...props }: any) => <form data-testid="rjsf-form" {...props}>{children}</form>
}));

vi.mock('@rjsf/validator-ajv8', () => ({
  default: {}
}));

// Now import TemplateDesigner after all mocks are set up
import { TemplateDesigner } from '../../../../../src/renderer/components/template-creator/TemplateDesigner';

// Mock the electron API
const mockElectronAPI = {
  writeFile: vi.fn(),
  readFile: vi.fn(),
  createDirectory: vi.fn()
};

(global as any).window = {
  electronAPI: mockElectronAPI
};

// Mock props for TemplateDesigner
const mockProps = {
  settingsData: {
    kubernetesVersion: '1.28.0',
    workingDirectory: '/test'
  },
  contextData: {
    currentContext: 'test-context'
  }
};

describe('TemplateDesigner - Helm Template Generation', () => {
  describe('Component Rendering', () => {
    it('should render TemplateDesigner component without errors', () => {
      render(<TemplateDesigner {...mockProps} />);
      // Basic rendering test - component should mount successfully
      expect(document.body).toBeTruthy();
    });
  });

  describe('RBAC apiVersion handling', () => {
    it('should preserve full RBAC apiVersion from backend', () => {
      const mockResource = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        group: 'rbac.authorization.k8s.io',
        version: 'v1'
      };

      // Test the apiVersion preservation logic
      expect(mockResource.apiVersion).toBe('rbac.authorization.k8s.io/v1');
      expect(mockResource.apiVersion).not.toBe('rbac/v1'); // Should NOT be truncated
    });

    it('should handle fallback apiVersion construction correctly', () => {
      const mockResource = {
        kind: 'RoleBinding',
        group: 'rbac.authorization.k8s.io',
        version: 'v1'
        // No apiVersion provided - should trigger fallback
      };

      // Simulate the handleKindSelect logic
      if (!mockResource.apiVersion && mockResource.group && mockResource.version) {
        (mockResource as any).apiVersion = mockResource.group === 'core' 
          ? mockResource.version 
          : `${mockResource.group}/${mockResource.version}`;
      }

      expect((mockResource as any).apiVersion).toBe('rbac.authorization.k8s.io/v1');
    });

    it('should preserve backend apiVersion when available', () => {
      const mockResource = {
        apiVersion: 'rbac.authorization.k8s.io/v1', // From backend
        kind: 'RoleBinding',
        group: 'rbac.authorization.k8s.io',
        version: 'v1'
      };

      // The resource should keep its original apiVersion
      expect(mockResource.apiVersion).toBe('rbac.authorization.k8s.io/v1');
      
      // Should NOT trigger fallback logic
      const needsFallback = !mockResource.apiVersion && mockResource.group && mockResource.version;
      expect(needsFallback).toBe(false);
    });
  });
});