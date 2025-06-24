import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ProjectService } from '../../../../src/renderer/services/project.service'

// Mock electron API
const mockElectronAPI = {
  project: {
    create: vi.fn(),
    open: vi.fn(),
    save: vi.fn(),
    saveAs: vi.fn(),
    close: vi.fn(),
    getCurrent: vi.fn(),
    getRecent: vi.fn(),
    delete: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    enableAutoSave: vi.fn(),
    disableAutoSave: vi.fn(),
    export: vi.fn()
  }
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
})

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createProject', () => {
    it('should create a new project successfully', async () => {
      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        filePath: '/test/path.json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      }

      mockElectronAPI.project.create.mockResolvedValue(mockProject)

      const result = await ProjectService.createProject('Test Project', 'A test project')

      expect(mockElectronAPI.project.create).toHaveBeenCalledWith('Test Project', 'A test project')
      expect(result).toEqual(mockProject)
    })

    it('should handle project creation errors', async () => {
      const error = new Error('Failed to create project')
      mockElectronAPI.project.create.mockRejectedValue(error)

      await expect(ProjectService.createProject('Test Project')).rejects.toThrow('Failed to create project')
    })

    it('should throw error when Project API not available', async () => {
      const originalAPI = window.electronAPI
      // @ts-ignore
      window.electronAPI = undefined

      await expect(ProjectService.createProject('Test Project')).rejects.toThrow('Project API not available')

      window.electronAPI = originalAPI
    })
  })

  describe('openProject', () => {
    it('should open a project successfully', async () => {
      const mockProject = { 
        id: 'test-project', 
        name: 'Test Project',
        filePath: '/test/path.json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
      mockElectronAPI.project.open.mockResolvedValue(mockProject)

      const result = await ProjectService.openProject('/test/path.json')

      expect(mockElectronAPI.project.open).toHaveBeenCalledWith('/test/path.json')
      expect(result).toEqual(mockProject)
    })

    it('should handle file dialog when no path provided', async () => {
      const mockProject = { 
        id: 'test-project', 
        name: 'Test Project',
        filePath: '/selected/path.json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
      mockElectronAPI.project.open.mockResolvedValue(mockProject)

      const result = await ProjectService.openProject()

      expect(mockElectronAPI.project.open).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(mockProject)
    })
  })

  describe('getCurrentProject', () => {
    it('should get current project successfully', async () => {
      const mockProject = { 
        id: 'current-project', 
        name: 'Current Project',
        filePath: '/current/path.json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
      mockElectronAPI.project.getCurrent.mockResolvedValue(mockProject)

      const result = await ProjectService.getCurrentProject()

      expect(mockElectronAPI.project.getCurrent).toHaveBeenCalled()
      expect(result).toEqual(mockProject)
    })
  })

  describe('getRecentProjects', () => {
    it('should get recent projects successfully', async () => {
      const mockProjects = [
        {
          id: 'recent-1',
          name: 'Recent Project 1',
          filePath: '/recent1/path.json',
          lastOpened: new Date().toISOString()
        }
      ]
      mockElectronAPI.project.getRecent.mockResolvedValue(mockProjects)

      const result = await ProjectService.getRecentProjects()

      expect(mockElectronAPI.project.getRecent).toHaveBeenCalled()
      expect(result).toEqual(mockProjects)
    })
  })

  describe('saveProject', () => {
    it('should save project successfully', async () => {
      const savedPath = '/saved/path.json'
      mockElectronAPI.project.save.mockResolvedValue(savedPath)

      const result = await ProjectService.saveProject()

      expect(mockElectronAPI.project.save).toHaveBeenCalled()
      expect(result).toEqual(savedPath)
    })
  })

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      mockElectronAPI.project.delete.mockResolvedValue(undefined)

      await ProjectService.deleteProject('/path/to/delete.json')

      expect(mockElectronAPI.project.delete).toHaveBeenCalledWith('/path/to/delete.json')
    })
  })
})