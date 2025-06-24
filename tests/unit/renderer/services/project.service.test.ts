import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectService } from '../../../../src/renderer/services/project.service';

// Mock electron API
const mockElectronAPI = {
  createProject: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  listProjects: vi.fn()
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(() => {
    projectService = new ProjectService();
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a new project successfully', async () => {
      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        path: '/test/path'
      };

      mockElectronAPI.createProject.mockResolvedValue(mockProject);

      const result = await projectService.createProject(mockProject);

      expect(mockElectronAPI.createProject).toHaveBeenCalledWith(mockProject);
      expect(result).toEqual(mockProject);
    });

    it('should handle project creation errors', async () => {
      const error = new Error('Failed to create project');
      mockElectronAPI.createProject.mockRejectedValue(error);

      await expect(projectService.createProject({})).rejects.toThrow('Failed to create project');
    });
  });

  describe('loadProject', () => {
    it('should load a project successfully', async () => {
      const mockProject = { id: 'test-project', name: 'Test Project' };
      mockElectronAPI.loadProject.mockResolvedValue(mockProject);

      const result = await projectService.loadProject('test-project');

      expect(mockElectronAPI.loadProject).toHaveBeenCalledWith('test-project');
      expect(result).toEqual(mockProject);
    });
  });
});