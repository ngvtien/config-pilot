import '@testing-library/jest-dom'
import { vi } from 'vitest';

// Mock Electron APIs
Object.defineProperty(window, 'electronAPI', {
  value: {
    helmTemplate: vi.fn(),
    loadSchemaDefinitions: vi.fn(),
    getUserDataPath: vi.fn().mockResolvedValue('/mock/user/data'),
    createProject: vi.fn(),
    loadProject: vi.fn(),
    saveProject: vi.fn(),
    deleteProject: vi.fn(),
    listProjects: vi.fn(),
    // Add other electron API mocks as needed
  },
  writable: true
})
  
// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(() => null)
}))

// Mock window.matchMedia
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
})

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true
})

// Add this to existing mocks
Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  value: vi.fn().mockReturnValue(false),
  writable: true,
});

Object.defineProperty(Element.prototype, 'setPointerCapture', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  value: vi.fn(),
  writable: true,
});

// Mock scrollIntoView for Radix UI Select
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

// Mock console methods for React DOM
Object.defineProperty(global.console, 'warn', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(global.console, 'error', {
  value: vi.fn(),
  writable: true,
});