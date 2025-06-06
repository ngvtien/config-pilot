import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  Plus,
  Save,
  X,
  ChevronDown,
  Clock
} from "lucide-react"


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/renderer/components/ui/dialog"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/renderer/components/ui/sidebar"
import { useProject } from '../contexts/project-context'
import { useState, useCallback } from 'react'
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"

export function NavProjects() {
  const {
    recentProjects,
    openProject,
    deleteProject,
    createProject,
    saveProject,
    currentProject,
    isLoading,
    closeProject  // Add this if available
  } = useProject()

  // Add this right after the useProject hook (around line 48)
  console.log('Debug - currentProject:', currentProject)
  console.log('Debug - currentProject exists:', !!currentProject)

  const { isMobile } = useSidebar()
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const handleCreateProject = async () => {
    setShowCreateDialog(true)
  }

  const handleCreateConfirm = async () => {
    if (!projectName.trim()) return

    setIsCreating(true)
    try {
      await createProject(projectName.trim(), projectDescription.trim() || undefined)
      setShowCreateDialog(false)
      setProjectName('')
      setProjectDescription('')
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateCancel = () => {
    setShowCreateDialog(false)
    setProjectName('')
    setProjectDescription('')
  }

  const handleOpenProject = async (filePath?: string) => {
    try {
      await openProject(filePath)
    } catch (error) {
      // Only log actual errors, not user cancellations
      if (error instanceof Error && !error.message.includes('No file selected')) {
        console.error('Failed to open project:', error)
      }
    }
  }

  const handleDeleteProject = async (filePath: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete "${projectName}"?`)) {
      try {
        await deleteProject(filePath)
      } catch (error) {
        console.error('Failed to delete project:', error)
      }
    }
  }

  // Add this handler function
  // Update the handleSaveProject function to check for current project
  const handleSaveProject = useCallback(async () => {
    if (!currentProject) {
      console.warn('No project loaded to save')
      return
    }
    try {
      await saveProject()
      console.log('Project saved successfully')
      // Optional: Show success notification
    } catch (error) {
      console.error('Failed to save project:', error)
      // Optional: Show error notification
    }
  }, [saveProject, currentProject])

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>
          Projects
        </SidebarGroupLabel>
        <SidebarMenu>
          {/* Single Projects Dropdown */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Folder className="text-muted-foreground" />
                  <span>{currentProject ? `Current: ${currentProject.name}` : 'No Project Open'}</span>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {/* Current Project Actions */}
                <DropdownMenuItem onClick={handleCreateProject}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>New Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenProject()}>
                  <Folder className="mr-2 h-4 w-4" />
                  <span>Open Project...</span>
                </DropdownMenuItem>
                
                {/* Current Project Actions (only when project is open) */}
                {currentProject && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSaveProject}>
                      <Save className="mr-2 h-4 w-4" />
                      <span>Save Project</span>
                    </DropdownMenuItem>
                    {closeProject && (
                      <DropdownMenuItem onClick={() => closeProject()}>
                        <X className="mr-2 h-4 w-4" />
                        <span>Close Project</span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                
                {/* Recent Projects Section */}
                {recentProjects.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      <Clock className="mr-2 h-3 w-3 inline" />
                      Recent Projects
                    </div>
                    {recentProjects.slice(0, 5).map((project) => (
                      <DropdownMenuItem 
                        key={project.id}
                        onClick={() => handleOpenProject(project.filePath)}
                        className="pl-6"
                      >
                        <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span>{project.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {project.description || 'No description'}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="ml-auto p-1 hover:bg-accent rounded">
                              <MoreHorizontal className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right">
                            <DropdownMenuItem onClick={() => handleOpenProject(project.filePath)}>
                              <Folder className="mr-2 h-4 w-4" />
                              <span>Open</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Forward className="mr-2 h-4 w-4" />
                              <span>Export</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteProject(project.filePath, project.name)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </DropdownMenuItem>
                    ))}
                    {recentProjects.length > 5 && (
                      <DropdownMenuItem className="pl-6 text-muted-foreground">
                        <span>... and {recentProjects.length - 5} more</span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter the details for your new project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="col-span-3"
                placeholder="My Project"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="col-span-3"
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCreateCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateConfirm}
              disabled={!projectName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}