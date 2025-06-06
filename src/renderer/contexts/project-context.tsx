import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ProjectConfig, ProjectMetadata } from '../../shared/types/project'
import { ProjectService } from '../services/project.service'

interface ProjectContextType {
    currentProject: ProjectConfig | null
    recentProjects: ProjectMetadata[]
    isLoading: boolean
    createProject: (name: string, description?: string) => Promise<void>
    openProject: (filePath?: string) => Promise<void>
    saveProject: () => Promise<void>
    saveAsProject: () => Promise<void>
    closeProject: () => Promise<void>
    deleteProject: (filePath: string) => Promise<void>
    loadRecentProjects: () => Promise<void>
    exportProject: (exportPath: string) => Promise<void>
    enableAutoSave: (intervalSeconds: number) => Promise<void>
    disableAutoSave: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [currentProject, setCurrentProject] = useState<ProjectConfig | null>(null)
    const [recentProjects, setRecentProjects] = useState<ProjectMetadata[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Define loadRecentProjects first
    const loadRecentProjects = useCallback(async () => {
        try {
            const projects = await ProjectService.getRecentProjects()
            setRecentProjects(projects)
        } catch (error) {
            console.error('Failed to load recent projects:', error)
        }
    }, [])

    const createProject = useCallback(async (name: string, description?: string) => {
        setIsLoading(true)
        try {
            const project = await ProjectService.createProject(name, description)
            setCurrentProject(project)
            await loadRecentProjects()
        } catch (error) {
            console.error('Failed to create project:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [loadRecentProjects])

    const openProject = useCallback(async (filePath?: string) => {
        setIsLoading(true)
        try {
            const project = await ProjectService.openProject(filePath)
            if (project) {
                setCurrentProject(project)
                await loadRecentProjects()
            }
            // If project is null, user canceled - do nothing
        } catch (error) {
            console.error('Failed to open project:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [loadRecentProjects])

    const saveProject = useCallback(async () => {
        if (!currentProject) return
        setIsLoading(true)
        try {
            await ProjectService.saveProject()
        } catch (error) {
            console.error('Failed to save project:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [currentProject])

    const saveAsProject = useCallback(async () => {
        if (!currentProject) return
        setIsLoading(true)
        try {
            const newPath = await ProjectService.saveAsProject()
            // Update current project path if needed
            if (newPath && currentProject) {
                setCurrentProject({ ...currentProject, filePath: newPath })
            }
            await loadRecentProjects()
        } catch (error) {
            console.error('Failed to save project as:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [currentProject])

    const closeProject = useCallback(async () => {
        setIsLoading(true)
        try {
            await ProjectService.closeProject()
            setCurrentProject(null)
        } catch (error) {
            console.error('Failed to close project:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [])

    const deleteProject = useCallback(async (filePath: string) => {
        setIsLoading(true)
        try {
            await ProjectService.deleteProject(filePath)
            await loadRecentProjects()
            // If the deleted project is currently open, close it
            if (currentProject?.filePath === filePath) {
                setCurrentProject(null)
            }
        } catch (error) {
            console.error('Failed to delete project:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [currentProject, loadRecentProjects])

    const exportProject = useCallback(async (exportPath: string) => {
        if (!currentProject) return
        setIsLoading(true)
        try {
            await ProjectService.exportProject(exportPath)
        } catch (error) {
            console.error('Failed to export project:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [currentProject])

    const enableAutoSave = useCallback(async (intervalSeconds: number) => {
        try {
            await ProjectService.enableAutoSave(intervalSeconds)
        } catch (error) {
            console.error('Failed to enable auto-save:', error)
            throw error
        }
    }, [])

    const disableAutoSave = useCallback(async () => {
        try {
            await ProjectService.disableAutoSave()
        } catch (error) {
            console.error('Failed to disable auto-save:', error)
            throw error
        }
    }, [])

    //   // Load recent projects on mount
    //   useEffect(() => {
    //     loadRecentProjects()
    //   }, [])

    // Load recent projects and current project on mount
    useEffect(() => {
        const initializeProjects = async () => {
            console.log('🔄 Initializing projects...')
            await loadRecentProjects()

            // Try to restore current project
            try {
                console.log('🔍 Checking for current project...')
                const current = await ProjectService.getCurrentProject()
                console.log('📋 Current project from backend:', current)
                if (current) {
                    console.log('✅ Setting current project:', current.name)
                    setCurrentProject(current)
                } else {
                    console.log('❌ No current project found')
                }
            } catch (error) {
                console.error('❌ Failed to restore current project:', error)
            }
        }

        initializeProjects()
    }, [])

    return (
        <ProjectContext.Provider value={{
            currentProject,
            recentProjects,
            isLoading,
            createProject,
            openProject,
            saveProject,
            saveAsProject,
            closeProject,
            deleteProject,
            loadRecentProjects,
            exportProject,
            enableAutoSave,
            disableAutoSave
        }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (!context) {
        throw new Error('useProject must be used within ProjectProvider')
    }
    return context
}