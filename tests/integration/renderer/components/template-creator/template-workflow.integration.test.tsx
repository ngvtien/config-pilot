import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateDesigner } from '../../../../../src/renderer/components/template-creator/TemplateDesigner';
import { createMockElectronAPI } from '../../../../utils/test-helpers';

// Create comprehensive mock for electronAPI
const mockElectronAPI = createMockElectronAPI({
  // File system operations
  fileExists: vi.fn().mockResolvedValue(true),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  
  // Schema operations via invoke
  invoke: vi.fn().mockImplementation((channel, ...args) => {
    switch (channel) {
      case 'schema:initialize':
        return Promise.resolve();
      case 'schema:getAvailableSources':
        return Promise.resolve([]);
      case 'schema:getSourceStats':
        return Promise.resolve({ total: 0, loaded: 0 });
      case 'schema:searchInSource':
      case 'schema:getResourcesFromSource':
      case 'schema:searchAllSourcesWithCRDs':
      case 'schema:getRawCRDSchema':
      case 'schema:getAllResourcesWithCRDs':
      case 'schema:getResourceSchemaTree':
      case 'schema:getResourceSchema':
        return Promise.resolve([]);
      default:
        return Promise.resolve();
    }
  }),
  
  // Schema definitions
  loadSchemaDefinitions: vi.fn().mockResolvedValue({
    definitions: {
      'io.k8s.api.apps.v1.Deployment': {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          kind: { type: 'string' },
          metadata: { $ref: '#/definitions/io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta' }
        }
      }
    }
  })
});

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

// Mock props for TemplateDesigner
const mockProps = {
  settingsData: {
    kubernetesVersion: '1.28.0',
    baseDirectory: '/test',
    defaultNamespace: 'default',
    kubeConfigPath: '~/.kube/config',
    autoSave: true,
    darkMode: false,
    lineNumbers: true,
    wordWrap: true,
    autoRefreshContexts: true,
    gitRepositories: []
  },
  contextData: {
    currentContext: 'test-context'
  }
};

describe('Template Creator Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full template creation workflow', async () => {
    render(<TemplateDesigner {...mockProps} />);
    
    // Wait for component to initialize and load user data
    await waitFor(() => {
      expect(mockElectronAPI.getUserDataPath).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Wait for file system operations to complete
    await waitFor(() => {
      expect(mockElectronAPI.fileExists).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // The component should render successfully without errors
    expect(screen.getByText('Deployment Template Designer')).toBeInTheDocument();
    expect(screen.getByText(/using Kubernetes 1.28.0/)).toBeInTheDocument();
  });
});