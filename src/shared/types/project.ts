export interface ProjectConfig {
  id: string
  name: string
  description?: string
  version: string
  createdAt: string
  updatedAt: string
  
  // Kubernetes configuration
  kubernetes?: {
    context?: string
    namespace?: string
    clusters: string[]
  }
  
  // Helm configuration
  helm?: {
    repositories: HelmRepository[]
    releases: HelmRelease[]
  }
  
  // Templates and configurations
  templates: ProjectTemplate[]
  configurations: ProjectConfiguration[]
  
  // User preferences for this project
  preferences: ProjectPreferences
}

export interface ProjectTemplate {
  id: string
  name: string
  type: 'kubernetes' | 'helm' | 'custom'
  content: string
  variables?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface ProjectConfiguration {
  id: string
  name: string
  type: string
  data: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface ProjectPreferences {
  autoSave: boolean
  autoSaveInterval: number // in seconds
  theme?: 'light' | 'dark' | 'system'
  editorSettings: {
    fontSize: number
    tabSize: number
    wordWrap: boolean
  }
}

export interface HelmRepository {
  name: string
  url: string
  username?: string
  password?: string
}

export interface HelmRelease {
  name: string
  namespace: string
  chart: string
  version: string
  values?: Record<string, any>
}

export interface ProjectMetadata {
  id: string
  name: string
  description?: string
  filePath: string
  lastOpened: string
  version: string
}

// Helper function to create a new project
export function createNewProject(name: string, description?: string): ProjectConfig {
    const now = new Date().toISOString()
    return {
      id: crypto.randomUUID(),
      name,
      description,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      templates: [],
      configurations: [],
      preferences: {
        autoSave: true,
        autoSaveInterval: 30,
        theme: 'system',
        editorSettings: {
          fontSize: 14,
          tabSize: 2,
          wordWrap: true
        }
      }
    }
  }