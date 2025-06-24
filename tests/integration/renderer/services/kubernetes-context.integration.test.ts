import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KubernetesService } from '../../../../src/renderer/services/kubernetes';

const mockElectronAPI = {
  invoke: vi.fn()
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('Kubernetes Context Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should switch contexts and update cluster info', async () => {
    const mockContexts = [
      { name: 'context1', cluster: 'cluster1' },
      { name: 'context2', cluster: 'cluster2' }
    ];
    
    const mockConnectionStatus = {
      connected: true,
      currentContext: 'context2'
    };

    // Mock the invoke calls
    mockElectronAPI.invoke
      .mockResolvedValueOnce(mockContexts) // k8s:getContexts
      .mockResolvedValueOnce(true) // k8s:switchContext
      .mockResolvedValueOnce(mockConnectionStatus); // k8s:getConnectionStatus

    // Get available contexts (static method)
    const contexts = await KubernetesService.getContexts();
    expect(contexts).toEqual(mockContexts);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('k8s:getContexts');

    // Switch context (static method)
    const result = await KubernetesService.switchContext('context2');
    expect(result).toBe(true);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('k8s:switchContext', 'context2');

    // Verify connection status
    const status = await KubernetesService.getConnectionStatus();
    expect(status).toEqual(mockConnectionStatus);
    expect(mockElectronAPI.invoke).toHaveBeenCalledWith('k8s:getConnectionStatus');
  });
});