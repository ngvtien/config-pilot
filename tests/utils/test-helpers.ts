import { vi } from 'vitest';
import { act } from '@testing-library/react';

/**
 * Mock Electron API for testing
 */
export const createMockElectronAPI = (overrides = {}) => {
  return {
    helmTemplate: vi.fn(),
    loadSchemaDefinitions: vi.fn(),
    getUserDataPath: vi.fn().mockResolvedValue('/mock/user/data'),
    saveTemplate: vi.fn(),
    loadTemplate: vi.fn(),
    getKubernetesContexts: vi.fn(),
    setCurrentContext: vi.fn(),
    getClusterInfo: vi.fn(),
    createProject: vi.fn(),
    loadProject: vi.fn(),
    saveProject: vi.fn(),
    deleteProject: vi.fn(),
    listProjects: vi.fn(),
    ...overrides
  };
};

/**
 * Setup mock for component testing
 */
export const setupComponentTest = (electronAPIOverrides = {}) => {
  const mockElectronAPI = createMockElectronAPI(electronAPIOverrides);
  
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true
  });
  
  return mockElectronAPI;
};

/**
 * Wrapper for async testing with act
 */
export const asyncAct = async (callback: () => Promise<void>) => {
  await act(async () => {
    await callback();
  });
};

/**
 * Mock window.matchMedia
 */
export const mockMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};