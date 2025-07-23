import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitRepositoryService } from '../../../src/renderer/services/git-repository.service';
import { GitRepository } from '../../../src/shared/types/git-repository';

// Mock electron API
const mockElectronAPI = {
  git: {
    getRepositories: vi.fn(),
    saveRepository: vi.fn(),
    removeRepository: vi.fn(),
    validateRepository: vi.fn()
  }
};

// @ts-ignore
global.window = {
  electronAPI: mockElectronAPI
};

describe('GitRepositoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRepositories', () => {
    it('should return repositories from electron API', async () => {
      const mockRepos: GitRepository[] = [
        {
          id: '1',
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          branch: 'main',
          description: 'Test repository',
          permissions: { developer: 'read', devops: 'write', operations: 'read' },
          authStatus: 'success',
          lastAuthCheck: '2023-01-01T00:00:00.000Z'
        }
      ];
      
      mockElectronAPI.git.getRepositories.mockResolvedValue(mockRepos);
      
      const result = await GitRepositoryService.getRepositories();
      
      expect(result).toEqual(mockRepos);
      expect(mockElectronAPI.git.getRepositories).toHaveBeenCalledOnce();
    });

    it('should return empty array when electron API fails', async () => {
      mockElectronAPI.git.getRepositories.mockRejectedValue(new Error('API Error'));
      
      const result = await GitRepositoryService.getRepositories();
      
      expect(result).toEqual([]);
    });
  });

  describe('createRepository', () => {
    it('should create repository after validation', async () => {
      const repoData = {
        name: 'New Repo',
        url: 'https://github.com/test/new.git',
        branch: 'main',
        description: 'New repository',
        permissions: { developer: 'read', devops: 'write', operations: 'read' }
      };
      
      mockElectronAPI.git.validateRepository.mockResolvedValue({
        isValid: true,
        authStatus: 'success'
      });
      
      mockElectronAPI.git.saveRepository.mockResolvedValue(undefined);
      
      const result = await GitRepositoryService.createRepository(repoData);
      
      expect(result).toMatchObject(repoData);
      expect(result.id).toBeDefined();
      expect(result.authStatus).toBe('success');
      // Fix: expect the call with both URL and undefined credentials
      expect(mockElectronAPI.git.validateRepository).toHaveBeenCalledWith(repoData.url, undefined);
      expect(mockElectronAPI.git.saveRepository).toHaveBeenCalledWith(result);
    });

    it('should throw error when validation fails', async () => {
      const repoData = {
        name: 'Invalid Repo',
        url: 'invalid-url',
        branch: 'main',
        description: 'Invalid repository',
        permissions: { developer: 'read', devops: 'write', operations: 'read' }
      };
      
      mockElectronAPI.git.validateRepository.mockResolvedValue({
        isValid: false,
        authStatus: 'failed',
        error: 'Invalid URL'
      });
      
      await expect(GitRepositoryService.createRepository(repoData))
        .rejects.toThrow('Invalid URL');
    });

    it('should update existing repository', async () => {
      const existingRepos: GitRepository[] = [
        {
          id: '1',
          name: 'Existing Repo',
          url: 'https://github.com/test/existing.git',
          branch: 'main',
          description: 'Existing repository',
          permissions: { developer: 'read', devops: 'write', operations: 'read' },
          authStatus: 'success',
          lastAuthCheck: '2023-01-01T00:00:00.000Z'
        }
      ];
      
      const updates = {
        name: 'Updated Repo',
        description: 'Updated description'
      };
      
      mockElectronAPI.git.getRepositories.mockResolvedValue(existingRepos);
      mockElectronAPI.git.saveRepository.mockResolvedValue(undefined);
      
      const result = await GitRepositoryService.updateRepository('1', updates);
      
      expect(result.name).toBe('Updated Repo');
      expect(result.description).toBe('Updated description');
      expect(result.id).toBe('1');
      expect(mockElectronAPI.git.saveRepository).toHaveBeenCalledWith(result);
    });

    it('should revalidate repository when URL is updated', async () => {
      const existingRepos: GitRepository[] = [
        {
          id: '1',
          name: 'Existing Repo',
          url: 'https://github.com/test/existing.git',
          branch: 'main',
          description: 'Existing repository',
          permissions: { developer: 'read', devops: 'write', operations: 'read' },
          authStatus: 'success',
          lastAuthCheck: '2023-01-01T00:00:00.000Z'
        }
      ];
      
      const updates = {
        url: 'https://github.com/test/updated.git'
      };
      
      mockElectronAPI.git.getRepositories.mockResolvedValue(existingRepos);
      mockElectronAPI.git.validateRepository.mockResolvedValue({
        isValid: true,
        authStatus: 'success'
      });
      mockElectronAPI.git.saveRepository.mockResolvedValue(undefined);
      
      const result = await GitRepositoryService.updateRepository('1', updates);
      
      expect(result.url).toBe('https://github.com/test/updated.git');
      expect(result.authStatus).toBe('success');
      expect(mockElectronAPI.git.validateRepository).toHaveBeenCalledWith(updates.url, undefined);
      expect(mockElectronAPI.git.saveRepository).toHaveBeenCalledWith(result);
    });

    it('should throw error when repository not found for update', async () => {
      mockElectronAPI.git.getRepositories.mockResolvedValue([]);
      
      await expect(GitRepositoryService.updateRepository('nonexistent', { name: 'Updated' }))
        .rejects.toThrow('Repository not found');
    });
  });

  describe('removeRepository', () => {
    it('should remove repository successfully', async () => {
      mockElectronAPI.git.removeRepository.mockResolvedValue(undefined);
      
      await expect(GitRepositoryService.removeRepository('1')).resolves.not.toThrow();
      expect(mockElectronAPI.git.removeRepository).toHaveBeenCalledWith('1');
    });

    it('should throw error when removal fails', async () => {
      mockElectronAPI.git.removeRepository.mockRejectedValue(new Error('Removal failed'));
      
      await expect(GitRepositoryService.removeRepository('1'))
        .rejects.toThrow('Failed to remove repository: Error: Removal failed');
    });
  });

  describe('validateRepository', () => {
    it('should return validation result from electron API', async () => {
      const mockValidation = {
        isValid: true,
        authStatus: 'success' as const
      };
      
      mockElectronAPI.git.validateRepository.mockResolvedValue(mockValidation);
      
      const result = await GitRepositoryService.validateRepository('https://github.com/test/repo.git');
      
      expect(result).toEqual(mockValidation);
      expect(mockElectronAPI.git.validateRepository).toHaveBeenCalledWith('https://github.com/test/repo.git', undefined);
    });

    it('should return error result when validation fails', async () => {
      mockElectronAPI.git.validateRepository.mockRejectedValue(new Error('Network error'));
      
      const result = await GitRepositoryService.validateRepository('https://github.com/test/repo.git');
      
      expect(result).toEqual({
        isValid: false,
        authStatus: 'failed',
        error: 'Network error'
      });
    });

    it('should return default error when electron API is not available', async () => {
      // @ts-ignore
      global.window = { electronAPI: null };
      
      const result = await GitRepositoryService.validateRepository('https://github.com/test/repo.git');
      
      expect(result).toEqual({
        isValid: false,
        authStatus: 'failed',
        error: 'Git service not available'
      });
      
      // Restore mock
      // @ts-ignore
      global.window = { electronAPI: mockElectronAPI };
    });
  });

  describe('testConnection', () => {
    it('should return true when validation succeeds', async () => {
      mockElectronAPI.git.validateRepository.mockResolvedValue({
        isValid: true,
        authStatus: 'success'
      });
      
      const result = await GitRepositoryService.testConnection('https://github.com/test/repo.git');
      
      expect(result).toBe(true);
    });

    it('should return false when validation fails', async () => {
      mockElectronAPI.git.validateRepository.mockResolvedValue({
        isValid: false,
        authStatus: 'failed',
        error: 'Invalid URL'
      });
      
      const result = await GitRepositoryService.testConnection('https://github.com/test/repo.git');
      
      expect(result).toBe(false);
    });
  });
});