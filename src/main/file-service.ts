import { promises as fs } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { app, dialog } from 'electron'
import type { ProjectConfig, ProjectMetadata } from '../shared/types/project'

export class FileService {
  private static readonly PROJECT_EXTENSION = '.cpilot'
  private static readonly PROJECTS_DIR = join(app.getPath('userData'), 'projects')
  private static readonly RECENT_PROJECTS_FILE = join(app.getPath('userData'), 'recent-projects.json')
  
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.PROJECTS_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create projects directory:', error)
    }
  }
  
  static async saveProject(projectConfig: ProjectConfig, filePath?: string): Promise<string> {
    try {
      let targetPath = filePath
      
      if (!targetPath) {
        targetPath = join(this.PROJECTS_DIR, `${projectConfig.name}${this.PROJECT_EXTENSION}`)
      }
      
      // Ensure directory exists
      await fs.mkdir(dirname(targetPath), { recursive: true })
      
      // Update timestamps
      const updatedConfig = {
        ...projectConfig,
        updatedAt: new Date().toISOString()
      }
      
      // Write project file
      await fs.writeFile(targetPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
      
      // Update recent projects
      await this.addToRecentProjects({
        id: updatedConfig.id,
        name: updatedConfig.name,
        description: updatedConfig.description,
        filePath: targetPath,
        lastOpened: new Date().toISOString(),
        version: updatedConfig.version
      })
      
      return targetPath
    } catch (error: any) {
      console.error('Failed to save project:', error)
      throw new Error(`Failed to save project: ${error.message}`)
    }
  }
  
  static async loadProject(filePath: string): Promise<ProjectConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const projectConfig = JSON.parse(content) as ProjectConfig
      
      // Update recent projects
      await this.addToRecentProjects({
        id: projectConfig.id,
        name: projectConfig.name,
        description: projectConfig.description,
        filePath,
        lastOpened: new Date().toISOString(),
        version: projectConfig.version
      })
      
      return projectConfig
    } catch (error: any) {
      console.error('Failed to load project:', error)
      throw new Error(`Failed to load project: ${error.message}`)
    }
  }
  
  static async showOpenDialog(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Open Config Pilot Project',
      filters: [
        { name: 'Config Pilot Projects', extensions: ['cpilot'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    return result.canceled ? null : result.filePaths[0]
  }
  
  static async showSaveDialog(defaultName?: string): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      title: 'Save Config Pilot Project',
      defaultPath: defaultName ? `${defaultName}${this.PROJECT_EXTENSION}` : undefined,
      filters: [
        { name: 'Config Pilot Projects', extensions: ['cpilot'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    return result.canceled ? null : result.filePath
  }
  
  static async getRecentProjects(): Promise<ProjectMetadata[]> {
    try {
      const content = await fs.readFile(this.RECENT_PROJECTS_FILE, 'utf-8')
      return JSON.parse(content) as ProjectMetadata[]
    } catch (error) {
      // File doesn't exist or is corrupted, return empty array
      return []
    }
  }
  
  private static async addToRecentProjects(metadata: ProjectMetadata): Promise<void> {
    try {
      const recentProjects = await this.getRecentProjects()
      
      // Remove existing entry if it exists
      const filteredProjects = recentProjects.filter(p => p.filePath !== metadata.filePath)
      
      // Add to beginning of list
      const updatedProjects = [metadata, ...filteredProjects].slice(0, 10) // Keep only 10 recent projects
      
      await fs.writeFile(this.RECENT_PROJECTS_FILE, JSON.stringify(updatedProjects, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to update recent projects:', error)
    }
  }
  
  static async deleteProject(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
      
      // Remove from recent projects
      const recentProjects = await this.getRecentProjects()
      const filteredProjects = recentProjects.filter(p => p.filePath !== filePath)
      await fs.writeFile(this.RECENT_PROJECTS_FILE, JSON.stringify(filteredProjects, null, 2), 'utf-8')
    } catch (error: any) {
      console.error('Failed to delete project:', error)
      throw new Error(`Failed to delete project: ${error.message}`)
    }
  }
  
  static async exportProject(projectConfig: ProjectConfig, exportPath: string): Promise<void> {
    try {
      const exportData = {
        ...projectConfig,
        exportedAt: new Date().toISOString(),
        exportedBy: 'Config Pilot v' + app.getVersion()
      }
      
      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8')
    } catch (error: any) {
      console.error('Failed to export project:', error)
      throw new Error(`Failed to export project: ${error.message}`)
    }
  }
}