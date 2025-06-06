import { FileService } from './file-service'
import type { ProjectConfig, ProjectMetadata } from '../shared/types/project'

export class ProjectManager {
  private static currentProject: ProjectConfig | null = null
  private static currentProjectPath: string | null = null
  private static autoSaveInterval: NodeJS.Timeout | null = null
  
  static async initialize(): Promise<void> {
    await FileService.initialize()
  }
  
  static async createProject(name: string, description?: string): Promise<ProjectConfig> {
    const { createNewProject } = await import('../shared/types/project')
    const project = createNewProject(name, description)
    
    this.currentProject = project
    this.currentProjectPath = null
    
    return project
  }
  
  static async openProject(filePath?: string): Promise<ProjectConfig> {
    let targetPath = filePath
    
    if (!targetPath) {
      targetPath = await FileService.showOpenDialog() as any
      if (!targetPath) {
        throw new Error('No file selected')
      }
    }
    
    const project = await FileService.loadProject(targetPath)
    this.currentProject = project
    this.currentProjectPath = targetPath
    
    // Enable auto-save if configured
    if (project.preferences.autoSave) {
      this.enableAutoSave(project.preferences.autoSaveInterval)
    }
    
    return project
  }
  
  static async saveProject(saveAs: boolean = false): Promise<string> {
    if (!this.currentProject) {
      throw new Error('No project is currently open')
    }
    
    let targetPath = this.currentProjectPath
    
    if (saveAs || !targetPath) {
      targetPath = await FileService.showSaveDialog(this.currentProject.name)
      if (!targetPath) {
        throw new Error('Save cancelled')
      }
    }
    
    const savedPath = await FileService.saveProject(this.currentProject, targetPath)
    this.currentProjectPath = savedPath
    
    return savedPath
  }
  
  static async closeProject(): Promise<void> {
    this.disableAutoSave()
    this.currentProject = null
    this.currentProjectPath = null
  }
  
  static getCurrentProject(): ProjectConfig | null {
    return this.currentProject
  }
  
  static getCurrentProjectPath(): string | null {
    return this.currentProjectPath
  }
  
  static updateProject(updates: Partial<ProjectConfig>): void {
    if (!this.currentProject) {
      throw new Error('No project is currently open')
    }
    
    this.currentProject = {
      ...this.currentProject,
      ...updates,
      updatedAt: new Date().toISOString()
    }
  }
  
  static async getRecentProjects(): Promise<ProjectMetadata[]> {
    return FileService.getRecentProjects()
  }
  
  static async deleteProject(filePath: string): Promise<void> {
    await FileService.deleteProject(filePath)
    
    // If the deleted project is currently open, close it
    if (this.currentProjectPath === filePath) {
      await this.closeProject()
    }
  }
  
  static async exportProject(exportPath: string): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project is currently open')
    }
    
    await FileService.exportProject(this.currentProject, exportPath)
  }
  
  static enableAutoSave(intervalSeconds: number = 30): void {
    this.disableAutoSave() // Clear existing interval
    
    this.autoSaveInterval = setInterval(async () => {
      try {
        if (this.currentProject && this.currentProjectPath) {
          await this.saveProject()
          console.log('Project auto-saved')
        }
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, intervalSeconds * 1000)
  }
  
  static disableAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
  }
}