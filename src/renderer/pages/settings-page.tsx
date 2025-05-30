"use client"
import { useState, useEffect } from "react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import {
  FolderOpen,
  Plus,
  GitBranch,
  CheckCircle,
  XCircle,
  Loader2,
  Key,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react"
import { Badge } from "@/renderer/components/ui/badge"
import { Alert, AlertDescription } from "@/renderer/components/ui/alert"
import { AuthenticationModal } from "@/renderer/components/authentication-modal"
import { useTheme } from "@/renderer/components/theme-provider"
import { useZoom } from "@/renderer/hooks/use-zoom"
import type { ContextData } from "@/shared/types/context-data"
import type { GitRepository } from "@/shared/types/git-repository"
import type { SettingsData } from "@/shared/types/settings-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { joinPath } from "@/renderer/lib/path-utils"

interface SettingsPageProps {
  context: ContextData
  kubernetesContext: string
  onContextChange: (context: ContextData) => void
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
}

const getPermissionDescription = (permission: string, environment: string) => {
  const descriptions = {
    full: "Full read/write access",
    "read-only": "Read-only access",
    "dev-only": environment === "dev" ? "Full access (DEV environment)" : "Limited to DEV environment only",
    none: "No access",
  }
  return descriptions[permission as keyof typeof descriptions] || permission
}

const getEnvironmentAwareRepositories = (environment: string): GitRepository[] => [
  {
    id: "1",
    name: "product-config-definitions",
    url: "https://github.com/company/product-config-definitions.git",
    branch: "main",
    description: "Configuration schemas and definitions",
    permissions: {
      developer:
        environment === "dev" || environment === "sit" ? "full" : environment === "uat" ? "dev-only" : "read-only",
      devops: "full",
      operations: environment === "dev" ? "read-only" : "full",
    },
    authStatus: "unknown",
  },
  {
    id: "2",
    name: "product-config-values",
    url: "https://github.com/company/product-config-values.git",
    branch: "main",
    description: "Environment-specific configuration values",
    permissions: {
      developer: environment === "dev" || environment === "sit" ? "full" : "none",
      devops: "full",
      operations: environment === "dev" ? "read-only" : "full",
    },
    authStatus: "unknown",
  },
  {
    id: "3",
    name: "cluster-platform-resources",
    url: "https://github.com/company/cluster-platform-resources.git",
    branch: "main",
    description: "Platform and infrastructure configurations",
    permissions: {
      developer: environment === "dev" ? "full" : environment === "sit" ? "read-only" : "none",
      devops: "full",
      operations: environment === "dev" ? "read-only" : "full",
    },
    authStatus: "unknown",
  },
]

export function SettingsPage({ context, onContextChange, settings, onSettingsChange }: SettingsPageProps) {
  const generateDefaultNamespace = (context: ContextData) => {
    if (context.instance > 0) {
      const formattedInstance = context.instance.toString().padStart(2, "0")
      return `${context.product}-${context.customer}-${context.environment}${formattedInstance}`.toLowerCase()
    } else {
      return `${context.product}-${context.customer}-${context.environment}`.toLowerCase()
    }
  }

  const [localSettings, setLocalSettings] = useState<SettingsData>(settings)
  const [localContext, setLocalContext] = useState<ContextData>(context)
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false)
  const [hasContextChanges, setHasContextChanges] = useState(false)

  const [newRepo, setNewRepo] = useState<Partial<GitRepository>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null)

  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalRepo, setAuthModalRepo] = useState<GitRepository | null>(null)

  const { theme, setTheme } = useTheme()

  // Replace the local zoom state with the global zoom hook
  const { zoomLevel, setZoomLevel, increaseZoom, decreaseZoom, resetZoom } = useZoom()

  // Sync local state with props when they change
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  useEffect(() => {
    setLocalContext(context)
  }, [context])

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("configpilot_settings")
    if (savedSettings) {
      try {
        const settingsData = JSON.parse(savedSettings)
        setLocalSettings((prev) => ({
          ...prev,
          ...settingsData,
          gitRepositories: settingsData.gitRepositories || getEnvironmentAwareRepositories(context.environment),
        }))
      } catch (e) {
        console.error("Error parsing saved settings:", e)
      }
    }
  }, [context.environment])

  // Update default namespace when context changes
  useEffect(() => {
    const newDefaultNamespace = generateDefaultNamespace(context)
    setLocalSettings((prev) => ({ ...prev, defaultNamespace: newDefaultNamespace }))
  }, [context])

  // Update repository URLs when context changes
  useEffect(() => {
    if (localContext.baseHostUrl && context.product) {
      const updatedRepos = localSettings.gitRepositories.map((repo) => {
        let newUrl = repo.url

        if (repo.name === "product-config-definitions") {
          newUrl = `${localContext.baseHostUrl}/${context.product}/config-definitions.git`
        } else if (repo.name === "product-config-values") {
          const instanceSuffix = context.instance === 0 ? "" : `-${context.instance}`
          newUrl = `${localContext.baseHostUrl}/${context.product}/${context.environment}${instanceSuffix}/config-values.git`
        } else if (repo.name === "cluster-platform-resources") {
          newUrl = `${localContext.baseHostUrl}/${context.product}/${context.environment}/cluster-platform-resources.git`
        }

        // Reset auth status when URL changes
        const authStatus = newUrl !== repo.url ? "unknown" : repo.authStatus

        return { ...repo, url: newUrl, authStatus }
      })

      // Only update if URLs actually changed
      const urlsChanged = updatedRepos.some((repo, index) => repo.url !== localSettings.gitRepositories[index].url)

      if (urlsChanged) {
        handleSettingChange("gitRepositories", updatedRepos)
      }
    }
  }, [localContext.baseHostUrl, context.product, context.environment, context.instance, localSettings.gitRepositories])

  // Update repository permissions when environment changes
  useEffect(() => {
    const updatedRepos = getEnvironmentAwareRepositories(context.environment).map((envRepo, index) => {
      const existingRepo = localSettings.gitRepositories[index]
      return existingRepo
        ? {
          ...existingRepo,
          permissions: envRepo.permissions,
        }
        : envRepo
    })

    handleSettingChange("gitRepositories", updatedRepos)
  }, [context.environment])


  const [kubeConfigState, setKubeConfigState] = useState<{
    active: string;
    available: { default: string; userSelected: string | null };
  }>({
    active: "",
    available: { default: "", userSelected: null }
  });


  // Load initial state
  useEffect(() => {
    const loadConfigs = async () => {
      if (window.electronAPI) {
        const available = await window.electronAPI.getAvailableConfigs();
        const active = await window.electronAPI.getActiveConfigPath();
        setKubeConfigState({ active, available });
        handleSettingChange('kubeConfigPath', active); // Sync with settings
      }
    };
    loadConfigs();
  }, []);

  const handleSettingChange = (key: keyof SettingsData, value: any) => {
    const updatedSettings = { ...localSettings, [key]: value }
    setLocalSettings(updatedSettings)
    setHasSettingsChanges(true)
  }

  const handleContextChange = (key: keyof ContextData, value: any) => {
    const updatedContext = { ...localContext, [key]: value }
    setLocalContext(updatedContext)
    setHasContextChanges(true)
  }

  const handleSave = () => {
    if (hasSettingsChanges) {
      onSettingsChange(localSettings)
      setHasSettingsChanges(false)
    }

    if (hasContextChanges) {
      onContextChange(localContext)
      setHasContextChanges(false)
    }
  }

  const handleReset = () => {
    setLocalSettings(settings)
    setLocalContext(context)
    setHasSettingsChanges(false)
    setHasContextChanges(false)
  }

  const checkRepositoryAuth = async (repoId: string) => {
    // Update status to checking
    const updatedRepos = localSettings.gitRepositories.map((repo) =>
      repo.id === repoId ? { ...repo, authStatus: "checking" as const } : repo,
    )
    handleSettingChange("gitRepositories", updatedRepos)

    const repo = localSettings.gitRepositories.find((r) => r.id === repoId)
    if (!repo) return

    try {
      let authResult: "success" | "failed" = "failed"

      if (typeof window !== "undefined" && window.electronAPI?.checkGitAuth) {
        // Electron environment - use actual git commands
        authResult = await window.electronAPI.checkGitAuth(repo.url)
      } else {
        // Web environment - simulate the check
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate network delay
        authResult = Math.random() > 0.8 ? "success" : "failed"
      }

      // Update the repository with auth result
      const finalRepos = localSettings.gitRepositories.map((r) =>
        r.id === repoId
          ? {
            ...r,
            authStatus: authResult,
            lastAuthCheck: new Date().toISOString(),
          }
          : r,
      )
      handleSettingChange("gitRepositories", finalRepos)

      // If auth failed, show the authentication modal
      if (authResult === "failed") {
        const failedRepo = localSettings.gitRepositories.find((r) => r.id === repoId)
        if (failedRepo) {
          setAuthModalRepo(failedRepo)
          setAuthModalOpen(true)
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error)

      // Update status to failed
      const failedRepos = localSettings.gitRepositories.map((r) =>
        r.id === repoId
          ? {
            ...r,
            authStatus: "failed" as const,
            lastAuthCheck: new Date().toISOString(),
          }
          : r,
      )
      handleSettingChange("gitRepositories", failedRepos)

      // If auth failed, show the authentication modal
      const failedRepo = localSettings.gitRepositories.find((r) => r.id === repoId)
      if (failedRepo) {
        setAuthModalRepo(failedRepo)
        setAuthModalOpen(true)
      }
    }
  }

  // Replace your Kubernetes settings section with:

  // const handleKubeConfigSelect = async () => {
  //   try {
  //     let selectedPath: string | null = null

  //     if (window.electronAPI?.openFile) {
  //       selectedPath = await window.electronAPI.openFile({
  //         filters: [{ name: 'Kubernetes Config', extensions: ['yaml', 'yml', 'json', 'config'] }]
  //       })
  //     } else {
  //       // Web fallback
  //       const input = document.createElement('input')
  //       input.type = 'file'
  //       input.accept = '.yaml,.yml,.json,.config'
  //       input.onchange = (e) => {
  //         const files = (e.target as HTMLInputElement).files
  //         if (files?.[0]) {
  //           selectedPath = files[0].name
  //         }
  //       }
  //       input.click()
  //     }

  //     if (selectedPath) {
  //       // Save to settings
  //       handleSettingChange('kubeConfigPath', selectedPath)

  //       // Update Kubernetes service
  //       if (window.electronAPI?.invoke) {
  //         await window.electronAPI.invoke('k8s:setConfigPath', selectedPath)
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error selecting kubeconfig:', error)
  //   }
  // }

  // const handleKubeConfigSelect = async () => {
  //   try {
  //     const filePath = await window.electronAPI?.openFile?.({
  //       filters: [{ name: 'Kubernetes Config', extensions: ['yaml', 'yml', 'json', 'config'] }]
  //     });

  //     if (filePath) {
  //       const success = await window.electronAPI.setUserConfigPath(filePath);
  //       if (success) {
  //         const activePath = await window.electronAPI.getActiveConfigPath();
  //         setKubeConfigState(prev => ({
  //           active: activePath,
  //           available: { ...prev.available, userSelected: filePath }
  //         }));
  //         handleSettingChange('kubeConfigPath', activePath);
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Failed to update kubeconfig:', error);
  //   }
  // }

  const [isSelectingFile, setIsSelectingFile] = useState(false);

    
  const handleKubeConfigSelect = async () => {
    setIsSelectingFile(true);
    try {
      const result = await window.electronAPI?.openFile({
        filters: [{ name: 'Kubernetes Config', extensions: ['yaml', 'yml', 'json', 'config'] }]
      });

      // if (result && !result.canceled && result.filePaths.length > 0) {
      //   const rawPath = result.filePaths[0];
      //   console.log('Selected path:', rawPath); // Debug

      //   const success = await window.electronAPI.setUserConfigPath(rawPath);
      //   if (success) {
      //     const activePath = await window.electronAPI.getActiveConfigPath();
      //     console.log('Active path confirmed:', activePath); // Debug
      //     handleSettingChange('kubeConfigPath', activePath);
      //   }
      // }

      if (result && !result.canceled) {
        const rawPath = result;
        console.log('Selected path:', rawPath); // Debug

        const success = await window.electronAPI.setUserConfigPath(rawPath);
        if (success) {
          const activePath = await window.electronAPI.getActiveConfigPath();
          console.log('Active path confirmed:', activePath); // Debug
          handleSettingChange('kubeConfigPath', activePath);
        }
      }      

    } catch (error) {
      console.error('Failed to update kubeconfig:', error);
    }
  }

  // const handleKubeConfigSelect = async () => {
  //   try {
  //     const result = await window.electronAPI?.openFile();

  //     if (!result || result.canceled) return;

  //     // Handle both Electron and web cases
  //     // const rawPath = Array.isArray(result) ?
  //     //   result[0] : // Web fallback
  //     //   result.filePaths?.[0]; // Electron

  //     // if (!rawPath) {
  //     //   console.error('No path selected');
  //     //   return;
  //     // }

  //     console.log('Selected path:', result);

  //     // For UNC paths, ensure we have the correct format
  //     const normalizedPath = result.startsWith('\\\\') ?
  //       result.replace(/\\/g, '\\\\') :
  //       result;

  //     const success = await window.electronAPI?.setUserConfigPath(normalizedPath);
  //     if (success) {
  //       const activePath = await window.electronAPI.getActiveConfigPath();
  //       console.log('Active path confirmed:', activePath);
  //       handleSettingChange('kubeConfigPath', activePath);
  //     }
  //   } catch (error) {
  //     console.error('Failed to update kubeconfig:', error);
  //   }
  // };

  const getAuthStatusIcon = (status?: string) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Key className="h-4 w-4 text-gray-400" />
    }
  }

  const getAuthStatusText = (status?: string) => {
    switch (status) {
      case "checking":
        return "Checking..."
      case "success":
        return "Authenticated"
      case "failed":
        return "Auth Failed"
      default:
        return "Unknown"
    }
  }

  const getPermissionBadge = (permission: string) => {
    const variants = {
      full: "default",
      "read-only": "secondary",
      "dev-only": "outline",
      none: "destructive",
    } as const

    return (
      <Badge variant={variants[permission as keyof typeof variants] || "secondary"} className="text-xs w-fit min-w-0">
        {permission === "dev-only" ? "Dev only" : permission.charAt(0).toUpperCase() + permission.slice(1)}
      </Badge>
    )
  }

  const addRepository = () => {
    if (newRepo.name && newRepo.url) {
      const repo: GitRepository = {
        id: Date.now().toString(),
        name: newRepo.name,
        url: newRepo.url,
        branch: newRepo.branch || "main",
        description: newRepo.description || "",
        permissions: newRepo.permissions || {
          developer: "none",
          devops: "none",
          operations: "none",
        },
        authStatus: "unknown",
      }

      const updatedRepos = [...localSettings.gitRepositories, repo]
      handleSettingChange("gitRepositories", updatedRepos)
      setNewRepo({})
    }
  }

  const handleDirectorySelect = async () => {
    try {
      if (window.electronAPI?.selectDirectory) {
        const selectedPath = await window.electronAPI.selectDirectory({
          title: "Select Base Directory",
          buttonLabel: "Select Directory",
          properties: ["openDirectory", "createDirectory"],
        })

        if (selectedPath) {
          // Verify the directory exists and is accessible
          const dirInfo = await window.electronAPI.directoryExists(selectedPath)
          if (dirInfo.exists && dirInfo.isDirectory) {
            handleSettingChange("baseDirectory", selectedPath)
          } else {
            console.error("Selected path is not a valid directory")
          }
        }
      } else {
        // Fallback for web environment
        const input = document.createElement("input")
        input.type = "file"
        input.webkitdirectory = true
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files
          if (files && files.length > 0) {
            const path = files[0].webkitRelativePath.split("/")[0]
            handleSettingChange("baseDirectory", path)
          }
        }
        input.click()
      }
    } catch (error) {
      console.error("Error selecting directory:", error)
    }
  }

  const createNewDirectory = async () => {
    const dirName = prompt("Enter directory name:")
    if (dirName) {
      try {
        if (window.electronAPI?.createDirectory) {
          // Create full path using our custom path utilities
          const basePath = localSettings.baseDirectory || process.env.HOME || process.env.USERPROFILE || "/tmp"
          const fullPath = joinPath(basePath, dirName)

          const result = await window.electronAPI.createDirectory(fullPath)
          if (result.success) {
            handleSettingChange("baseDirectory", result.path)
          }
        } else {
          // Fallback for web environment
          handleSettingChange("baseDirectory", dirName)
        }
      } catch (error) {
        console.error("Error creating directory:", error)
        alert("Failed to create directory. Please check permissions and try again.")
      }
    }
  }

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-10 h-6 rounded-full relative transition-colors ${enabled ? "bg-amber-500" : "bg-gray-300"}`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${enabled ? "translate-x-5" : "translate-x-1"
          }`}
      />
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Configure your application preferences and settings.</p>
        </div>
        <div className="flex gap-2">
          {(hasSettingsChanges || hasContextChanges) && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasSettingsChanges && !hasContextChanges}>
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="repositories" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="repositories">Git Repositories</TabsTrigger>
          <TabsTrigger value="directory">Base Directory</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="space-y-4">
          {/* Git Repositories content - keeping existing code */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Git Repositories</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configure Git repositories for separation of duties (SoD) based on user roles.
            </p>

            {/* Base Host URL */}
            <div className="mb-4">
              <Label htmlFor="baseHostUrl" className="text-sm font-medium">
                Base Host URL
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Base URL for Git repositories (e.g., https://github.com/{context.customer})
              </p>
              <Input
                id="baseHostUrl"
                value={localContext.baseHostUrl}
                onChange={(e) => {
                  const lowercaseValue = e.target.value.toLowerCase()
                  handleContextChange("baseHostUrl", lowercaseValue)
                }}
                placeholder={`https://github.com/${context.customer}`}
                className="w-full"
              />
              {localContext.baseHostUrl && (
                <p className="text-xs text-muted-foreground mt-1">Current: {localContext.baseHostUrl}</p>
              )}
            </div>

            {/* Repository List */}
            <div className="space-y-3 mb-4">
              {localSettings.gitRepositories.map((repo) => (
                <div key={repo.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{repo.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {repo.branch}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {getAuthStatusIcon(repo.authStatus)}
                          <span className="text-xs text-muted-foreground">{getAuthStatusText(repo.authStatus)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{repo.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">{repo.url.toLowerCase()}</p>

                      {repo.lastAuthCheck && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last checked: {new Date(repo.lastAuthCheck).toLocaleString()}
                        </p>
                      )}

                      {repo.authStatus === "failed" && (
                        <Alert className="mt-2">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Authentication failed. Please check your Git credentials and repository access permissions.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Permissions Grid */}
                      <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">Developer:</span>
                          {getPermissionBadge(repo.permissions.developer)}
                          <span className="text-xs text-muted-foreground">
                            {getPermissionDescription(repo.permissions.developer, context.environment)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">DevOps:</span>
                          {getPermissionBadge(repo.permissions.devops)}
                          <span className="text-xs text-muted-foreground">
                            {getPermissionDescription(repo.permissions.devops, context.environment)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">Operations:</span>
                          {getPermissionBadge(repo.permissions.operations)}
                          <span className="text-xs text-muted-foreground">
                            {getPermissionDescription(repo.permissions.operations, context.environment)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkRepositoryAuth(repo.id)}
                        disabled={repo.authStatus === "checking"}
                        className="flex items-center gap-2"
                      >
                        {repo.authStatus === "checking" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4" />
                        )}
                        Auth
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRepoId(repo.id)
                          setNewRepo({
                            ...repo,
                            url: repo.url || `${localContext.baseHostUrl}/${context.product}/config-definitions.git`,
                          })
                          setIsModalOpen(true)
                        }}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          {/* Base Directory content - keeping existing code */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Base Directory</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="baseDirectory" className="text-sm font-medium">
                  Working Directory
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Local folder where files are created, updated, and compared against Git repositories
                </p>
                <div className="flex gap-2">
                  <Input
                    id="baseDirectory"
                    value={localSettings.baseDirectory}
                    onChange={(e) => handleSettingChange("baseDirectory", e.target.value)}
                    placeholder="Select or enter base directory path"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDirectorySelect}
                    className="flex items-center gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Browse
                  </Button>
                  <Button variant="outline" size="sm" onClick={createNewDirectory} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New
                  </Button>
                </div>
                {localSettings.baseDirectory && (
                  <p className="text-xs text-muted-foreground mt-1">Current: {localSettings.baseDirectory}</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">General</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto-save</h4>
                  <p className="text-sm text-muted-foreground">Automatically save changes as you type</p>
                </div>
                <ToggleSwitch
                  enabled={localSettings.autoSave}
                  onChange={(value) => handleSettingChange("autoSave", value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Dark mode</h4>
                  <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                  >
                    Light
                  </Button>
                  <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                  >
                    System
                  </Button>
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Zoom Level</h4>
                  <p className="text-sm text-muted-foreground">
                    Adjust interface zoom (Ctrl+Scroll or use buttons) - Current: {zoomLevel}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={decreaseZoom}
                    disabled={zoomLevel <= 50}
                    className="flex items-center gap-1"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-mono min-w-[3rem] text-center">{zoomLevel}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={increaseZoom}
                    disabled={zoomLevel >= 200}
                    className="flex items-center gap-1"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetZoom}
                    disabled={zoomLevel === 100}
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {/* Editor content - keeping existing code */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Editor</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Line numbers</h4>
                  <p className="text-sm text-muted-foreground">Show line numbers in code editor</p>
                </div>
                <ToggleSwitch
                  enabled={localSettings.lineNumbers}
                  onChange={(value) => handleSettingChange("lineNumbers", value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Word wrap</h4>
                  <p className="text-sm text-muted-foreground">Wrap long lines in the editor</p>
                </div>
                <ToggleSwitch
                  enabled={localSettings.wordWrap}
                  onChange={(value) => handleSettingChange("wordWrap", value)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kubernetes" className="space-y-4">
          {/* Kubernetes content - keeping existing code */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Kubernetes</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto-refresh contexts</h4>
                  <p className="text-sm text-muted-foreground">Automatically refresh Kubernetes contexts</p>
                </div>
                <ToggleSwitch
                  enabled={localSettings.autoRefreshContexts}
                  onChange={(value) => handleSettingChange("autoRefreshContexts", value)}
                />
              </div>

              <div>
                <Label htmlFor="kubeconfigPath" className="font-medium">
                  Kubernetes Config File
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Path to your kubectl config file (default: ~/.kube/config)
                </p>
                <div className="flex gap-2">
                  <Input
                    id="kubeconfigPath"
                    value={localSettings.kubeConfigPath || "~/.kube/config"}
                    onChange={(e) => handleSettingChange("kubeConfigPath", e.target.value)}
                    placeholder="~/.kube/config"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSelectingFile}
                    onClick={handleKubeConfigSelect}
                    className="flex items-center gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Browse
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="defaultNamespace" className="font-medium">
                  Default namespace
                </Label>
                <Input
                  id="defaultNamespace"
                  value={localSettings.defaultNamespace}
                  onChange={(e) => handleSettingChange("defaultNamespace", e.target.value)}
                  placeholder={generateDefaultNamespace(context)}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AuthenticationModal
        isOpen={authModalOpen}
        repository={authModalRepo}
        onClose={() => {
          setAuthModalOpen(false)
          setAuthModalRepo(null)
        }}
        onSuccess={(credentials) => {
          console.log(credentials)
          if (authModalRepo) {
            // Update repository auth status
            const updatedRepos = localSettings.gitRepositories.map((repo) =>
              repo.id === authModalRepo.id
                ? {
                  ...repo,
                  authStatus: "success" as const,
                  lastAuthCheck: new Date().toISOString(),
                }
                : repo,
            )
            handleSettingChange("gitRepositories", updatedRepos)
          }
          setAuthModalOpen(false)
          setAuthModalRepo(null)
        }}
      />

      {/* Repository Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-2xl mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingRepoId ? "Update Repository" : "Register New Repository"}
            </h3>

            <div className="grid grid-cols-1 gap-3 mb-3">
              <div>
                <Label className="text-xs">Git URL</Label>
                <Input
                  placeholder={`${localContext.baseHostUrl}/${context.product}/config-definitions.git`}
                  value={
                    newRepo.url ||
                    (localContext.baseHostUrl && context.product
                      ? `${localContext.baseHostUrl}/${context.product}/config-definitions.git`
                      : "")
                  }
                  onChange={(e) => setNewRepo({ ...newRepo, url: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <Label className="text-xs">Branch</Label>
                <Input
                  placeholder="main"
                  value={newRepo.branch || ""}
                  onChange={(e) => setNewRepo({ ...newRepo, branch: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingRepoId(null)
                  setNewRepo({})
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingRepoId) {
                    // Update existing repository
                    const updatedRepos = localSettings.gitRepositories.map((repo) =>
                      repo.id === editingRepoId ? { ...repo, ...newRepo, authStatus: "unknown" } : repo,
                    )
                    handleSettingChange("gitRepositories", updatedRepos)
                  } else {
                    // Add new repository
                    addRepository()
                  }
                  setIsModalOpen(false)
                  setEditingRepoId(null)
                  setNewRepo({})
                }}
              >
                {editingRepoId ? "Update" : "Register"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
