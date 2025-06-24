import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron app FIRST - before any other imports
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data')
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn()
  }
}));

// Mock fs module - FileService imports { promises as fs } from 'fs'
// Need both default and named exports for Vitest ES module compatibility
vi.mock('fs', () => {
  const mockPromises = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    access: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined)
  };
  
  return {
    default: {
      promises: mockPromises
    },
    promises: mockPromises
  };
});

// Mock path module
vi.mock('path', () => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
    basename: vi.fn((path) => path.split('/').pop()),
    extname: vi.fn((path) => {
      const parts = path.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    })
  };
  
  return {
    default: mockPath,
    ...mockPath
  };
});

// Import after mocking
const { FileService } = await import('../../../../src/main/file-service');
const { promises: fs } = await import('fs');
const mockFs = vi.mocked(fs);
const path = await import('path');
const mockPath = vi.mocked(path);

describe('FileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations with proper return values
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify({
      id: 'test-id',
      name: 'Test Project',
      description: 'Test Description',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templates: []
    }));
    mockFs.access.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    
    // Reset path mocks
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockImplementation((path) => path.split('/').slice(0, -1).join('/'));
    mockPath.basename.mockImplementation((path) => path.split('/').pop() || '');
    mockPath.extname.mockImplementation((path) => {
      const parts = path.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    });
  });

  describe('initialize', () => {
    it('should initialize projects directory', async () => {
      await FileService.initialize();
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('projects'),
        { recursive: true }
      );
    });
  });

  describe('saveProject', () => {
    it('should save project successfully', async () => {
      const mockProject = {
        id: 'test-id',
        name: 'Test Project',
        description: 'Test Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        templates: []
      };
  
      const result = await FileService.saveProject(mockProject);
  
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('Test Project.cpilot'),
        expect.stringMatching(/"name"\s*:\s*"Test Project"/),
        'utf-8'
      );
      expect(result).toEqual(expect.stringContaining('Test Project.cpilot'));
    });
  });

  describe('loadProject', () => {
    it('should load project successfully', async () => {
      const result = await FileService.loadProject('/test/project.cpilot');

      expect(mockFs.readFile).toHaveBeenCalledWith('/test/project.cpilot', 'utf-8');
      expect(result).toEqual(expect.objectContaining({
        id: 'test-id',
        name: 'Test Project'
      }));
    });
  });
});