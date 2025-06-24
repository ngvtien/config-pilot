import type { ProjectConfig, ProjectMetadata } from '@/shared/types/project'

export class ProjectService {
  static async createProject(name: string, description?: string): Promise<ProjectConfig> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.create(name, description)
  }

  static async openProject(filePath?: string): Promise<ProjectConfig | null> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.open(filePath)
  }

  static async saveProject(): Promise<string> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.save()
  }

  static async saveAsProject(): Promise<string> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.saveAs()
  }

  static async closeProject(): Promise<void> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.close()
  }

  static async getCurrentProject(): Promise<ProjectConfig | null> {
    if (!window.electronAPI?.project) {
        throw new Error('Project API not available')
    }
    return window.electronAPI.project.getCurrent()
  }

  static async getRecentProjects(): Promise<ProjectMetadata[]> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.getRecent()
  }

  static async deleteProject(filePath: string): Promise<void> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.delete(filePath)
  }

  static async showOpenDialog(): Promise<string | null> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.showOpenDialog()
  }

  static async showSaveDialog(defaultName?: string): Promise<string | null> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.showSaveDialog(defaultName)
  }

  static async enableAutoSave(intervalSeconds: number): Promise<void> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.enableAutoSave(intervalSeconds)
  }

  static async disableAutoSave(): Promise<void> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.disableAutoSave()
  }

  static async exportProject(exportPath: string): Promise<void> {
    if (!window.electronAPI?.project) {
      throw new Error('Project API not available')
    }
    return window.electronAPI.project.export(exportPath)
  }
  
}