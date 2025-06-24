import { render, renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProjectProvider, useProject } from '../../../../src/renderer/contexts/project-context'
import { ProjectService } from '../../../../src/renderer/services/project.service'
import type { ProjectConfig, ProjectMetadata } from '../../../../src/shared/types/project'
import React from 'react'

// Mock ProjectService
vi.mock('../../../../src/renderer/services/project.service')

const mockProjectService = vi.mocked(ProjectService)

/**
 * Test wrapper component for ProjectProvider
 */
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
)

/**
 * Mock project data for testing
 */
const mockProject: ProjectConfig = {
  id: 'test-project-1',
  name: 'Test Project',
  description: 'A test project',
  filePath: '/path/to/project.json',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: '1.0.0'
}

const mockRecentProjects: ProjectMetadata[] = [
  {
    id: 'recent-1',
    name: 'Recent Project 1',
    filePath: '/path/to/recent1.json',
    lastOpened: new Date().toISOString()
  },
  {
    id: 'recent-2', 
    name: 'Recent Project 2',
    filePath: '/path/to/recent2.json',
    lastOpened: new Date().toISOString()
  }
]

describe('ProjectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('should provide initial state with null project and empty recent projects', async () => {
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      expect(result.current.currentProject).toBeNull()
      expect(result.current.recentProjects).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should load recent projects on initialization', async () => {
      mockProjectService.getRecentProjects.mockResolvedValue(mockRecentProjects)
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.recentProjects).toEqual(mockRecentProjects)
      })

      expect(mockProjectService.getRecentProjects).toHaveBeenCalledTimes(1)
    })

    it('should restore current project on initialization', async () => {
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(mockProject)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.currentProject).toEqual(mockProject)
      })

      expect(mockProjectService.getCurrentProject).toHaveBeenCalledTimes(1)
    })
  })

  describe('Project Creation', () => {
    it('should create a new project successfully', async () => {
      mockProjectService.createProject.mockResolvedValue(mockProject)
      mockProjectService.getRecentProjects.mockResolvedValue([mockProject])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.createProject('Test Project', 'Test Description')
      })

      expect(mockProjectService.createProject).toHaveBeenCalledWith('Test Project', 'Test Description')
      expect(result.current.currentProject).toEqual(mockProject)
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle project creation errors', async () => {
      const error = new Error('Failed to create project')
      mockProjectService.createProject.mockRejectedValue(error)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await expect(async () => {
        await act(async () => {
          await result.current.createProject('Test Project')
        })
      }).rejects.toThrow('Failed to create project')

      expect(result.current.isLoading).toBe(false)
    })

    it('should set loading state during project creation', async () => {
      let resolveCreate: (value: ProjectConfig) => void
      const createPromise = new Promise<ProjectConfig>((resolve) => {
        resolveCreate = resolve
      })
      
      mockProjectService.createProject.mockReturnValue(createPromise)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      act(() => {
        result.current.createProject('Test Project')
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolveCreate!(mockProject)
        await createPromise
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Project Opening', () => {
    it('should open a project with file path', async () => {
      mockProjectService.openProject.mockResolvedValue(mockProject)
      mockProjectService.getRecentProjects.mockResolvedValue([mockProject])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.openProject('/path/to/project.json')
      })

      expect(mockProjectService.openProject).toHaveBeenCalledWith('/path/to/project.json')
      expect(result.current.currentProject).toEqual(mockProject)
    })

    it('should open a project without file path (file dialog)', async () => {
      mockProjectService.openProject.mockResolvedValue(mockProject)
      mockProjectService.getRecentProjects.mockResolvedValue([mockProject])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.openProject()
      })

      expect(mockProjectService.openProject).toHaveBeenCalledWith(undefined)
      expect(result.current.currentProject).toEqual(mockProject)
    })

    it('should handle user cancellation during project opening', async () => {
      mockProjectService.openProject.mockResolvedValue(null)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.openProject()
      })

      expect(result.current.currentProject).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Project Saving', () => {
    it('should save current project', async () => {
      mockProjectService.saveProject.mockResolvedValue(undefined)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(mockProject)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.currentProject).toEqual(mockProject)
      })

      await act(async () => {
        await result.current.saveProject()
      })

      expect(mockProjectService.saveProject).toHaveBeenCalledTimes(1)
    })

    it('should not save when no current project', async () => {
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.saveProject()
      })

      expect(mockProjectService.saveProject).not.toHaveBeenCalled()
    })

    it('should save project as new file', async () => {
      const newPath = '/path/to/new-project.json'
      mockProjectService.saveAsProject.mockResolvedValue(newPath)
      mockProjectService.getRecentProjects.mockResolvedValue([mockProject])
      mockProjectService.getCurrentProject.mockResolvedValue(mockProject)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.currentProject).toEqual(mockProject)
      })

      await act(async () => {
        await result.current.saveAsProject()
      })

      expect(mockProjectService.saveAsProject).toHaveBeenCalledTimes(1)
      expect(result.current.currentProject?.filePath).toBe(newPath)
    })
  })

  describe('Project Deletion', () => {
    it('should delete a project and update recent projects', async () => {
      mockProjectService.deleteProject.mockResolvedValue(undefined)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.deleteProject('/path/to/project.json')
      })

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith('/path/to/project.json')
      expect(mockProjectService.getRecentProjects).toHaveBeenCalledTimes(2) // Initial load + after delete
    })

    it('should close current project if it matches deleted project', async () => {
      mockProjectService.deleteProject.mockResolvedValue(undefined)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(mockProject)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.currentProject).toEqual(mockProject)
      })

      await act(async () => {
        await result.current.deleteProject(mockProject.filePath)
      })

      expect(result.current.currentProject).toBeNull()
    })
  })

  describe('Auto-save functionality', () => {
    it('should enable auto-save with specified interval', async () => {
      mockProjectService.enableAutoSave.mockResolvedValue(undefined)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.enableAutoSave(30)
      })

      expect(mockProjectService.enableAutoSave).toHaveBeenCalledWith(30)
    })

    it('should disable auto-save', async () => {
      mockProjectService.disableAutoSave.mockResolvedValue(undefined)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(null)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await act(async () => {
        await result.current.disableAutoSave()
      })

      expect(mockProjectService.disableAutoSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when useProject is used outside ProjectProvider', () => {
      expect(() => {
        renderHook(() => useProject())
      }).toThrow('useProject must be used within ProjectProvider')
    })
  })

  describe('Loading States', () => {
    it('should manage loading state correctly across operations', async () => {
      let resolveOperation: () => void
      const operationPromise = new Promise<void>((resolve) => {
        resolveOperation = resolve
      })
      
      mockProjectService.saveProject.mockReturnValue(operationPromise)
      mockProjectService.getRecentProjects.mockResolvedValue([])
      mockProjectService.getCurrentProject.mockResolvedValue(mockProject)

      const { result } = renderHook(() => useProject(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.currentProject).toEqual(mockProject)
      })

      // Start operation
      act(() => {
        result.current.saveProject()
      })

      expect(result.current.isLoading).toBe(true)

      // Complete operation
      await act(async () => {
        resolveOperation!()
        await operationPromise
      })

      expect(result.current.isLoading).toBe(false)
    })
  })
})