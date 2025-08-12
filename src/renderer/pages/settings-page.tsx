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
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings,
  Palette,
  Code,
  RefreshCw,
  Server,
  FileText
} from "lucide-react"
import { AuthenticationModal } from "@/renderer/components/authentication-modal"
import { useTheme } from "@/renderer/components/theme-provider"
import { useZoom } from "@/renderer/hooks/use-zoom"
import type { ContextData } from "@/shared/types/context-data"
import type { GitRepository } from "@/shared/types/git-repository"
import type { SettingsData, LoggingSettings } from "@/shared/types/settings-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { joinPath } from "@/renderer/lib/path-utils"
import { KubernetesVersionSelector } from '@/renderer/components/kubernetes-version-selector'
import { VaultConfigurationSection } from "@/renderer/components/vault-configuration"
import { ArgoCDConfigurationSection } from '@/renderer/components/argocd-configuration'
import { HelmOCIConfigurationSection } from "@/renderer/components/helm-oci-configuration"
import { PlatformService } from '@/renderer/services/platform.service'
import type { PlatformInfo } from '@/main/services/platform-detection-service'
import { useDialog } from '@/renderer/hooks/useDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import { GitRepositoryService } from "@/renderer/services/git-repository.service"
import { GitConfigurationSection } from "@/renderer/components/git/git-configuration-section"
import { Switch } from "@/renderer/components/ui/switch"

interface SettingsPageProps {
  context: ContextData
  kubernetesContext: string
  onContextChange: (context: ContextData) => void
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
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

/**
 * Helper function to preserve authentication status when updating repositories
 * Only resets auth status if the repository URL actually changed
 */
const preserveAuthStatus = (newRepo: GitRepository, existingRepo?: GitRepository): GitRepository => {
  if (!existingRepo) return newRepo

  // Only reset auth status if the URL actually changed
  const shouldResetAuth = newRepo.url !== existingRepo.url

  return {
    ...newRepo,
    authStatus: shouldResetAuth ? "unknown" : existingRepo.authStatus,
    lastAuthCheck: shouldResetAuth ? undefined : existingRepo.lastAuthCheck
  }
}

export function SettingsPage({ context, onContextChange, settings, onSettingsChange }: SettingsPageProps) {
  const generateDefaultNamespace = (context: ContextData) => {
    if (context.instance > 0) {
      const formattedInstance = context.instance.toString().padStart(2, "0")
      return `${context.product}-${context.customer}-${context.environment}${formattedInstance}`.toLowerCase()
    } else {
      return `${context.product}-${context.customer}-${context.environment}`.toLowerCase()
    }
  }

  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null)
  const [isDetectingPlatform, setIsDetectingPlatform] = useState(false)

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

  // Add these state variables
  const [authMethod, setAuthMethod] = useState<"token" | "ssh" | "credentials">("token")

  const [gitProvider, setGitProvider] = useState("")
  const [gitServerConfig, setGitServerConfig] = useState({
    provider: "",
    baseUrl: "",
    authStatus: "unknown" as const,
    authMethod: "" as const,
    lastConfigured: null as string | null
  })

  const {
    showAlert,
    showErrorToast,
    AlertDialog
  } = useDialog();

  // Add platform detection function
  const handleDetectPlatform = async () => {
    setIsDetectingPlatform(true)
    try {
      const info = await PlatformService.detectPlatform()
      setPlatformInfo(info)

      // Update platform type in settings
      handleSettingChange('platformType', info.type)

      // Update platform features
      if (localSettings.platformSettings) {
        handleSettingChange('platformSettings', {
          ...localSettings.platformSettings,
          features: info.features
        })
      }
    } catch (error) {
      console.error('Platform detection failed:', error)
    } finally {
      setIsDetectingPlatform(false)
    }
  }

  // Load Git server configuration from localStorage on mount
  useEffect(() => {
    const savedGitConfig = localStorage.getItem("configpilot_git_server_config")
    if (savedGitConfig) {
      try {
        const configData = JSON.parse(savedGitConfig)
        setGitProvider(configData.provider || "")
        setGitServerConfig(configData)

        // Also restore the base URL to context if it exists
        if (configData.baseUrl && configData.baseUrl !== localContext.baseHostUrl) {
          handleContextChange("baseHostUrl", configData.baseUrl)
        }
      } catch (e) {
        console.error("Error parsing saved Git config:", e)
      }
    }
  }, [])

  // Update the useEffect that saves Git server configuration
  useEffect(() => {
    if (gitProvider && localContext.baseHostUrl && authModalRepo?.authStatus === 'authenticated') {
      const serverConfig = {
        id: localContext.baseHostUrl,
        serverId: localContext.baseHostUrl,
        provider: gitProvider, // ✅ EXPLICITLY SET - no auto-detection
        baseUrl: localContext.baseHostUrl,
        description: `${gitProvider} server configuration`
      }

      console.log('💾 Saving server with explicit provider:', gitProvider);

      // Use GitRepositoryService directly instead of addServer hook
      GitRepositoryService.saveServer(serverConfig).catch((error: any) => {
        console.error('Failed to save server to backend:', error)
      })
    }
  }, [gitProvider, localContext.baseHostUrl, authModalRepo?.authStatus, authMethod])

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

        // Use helper function to preserve auth status
        return preserveAuthStatus({ ...repo, url: newUrl }, repo)
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
          // Preserve existing auth status and lastAuthCheck
          authStatus: existingRepo.authStatus,
          lastAuthCheck: existingRepo.lastAuthCheck
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

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("configpilot_settings")
    if (savedSettings) {
      try {
        const settingsData = JSON.parse(savedSettings)
        setLocalSettings((prev) => {
          const defaultRepos = getEnvironmentAwareRepositories(context.environment)
          const savedRepos = settingsData.gitRepositories || defaultRepos

          // Merge saved repositories with defaults, preserving auth status
          const mergedRepos = defaultRepos.map((defaultRepo, index) => {
            const savedRepo = savedRepos[index]
            return savedRepo ? preserveAuthStatus(defaultRepo, savedRepo) : defaultRepo
          })

          return {
            ...prev,
            ...settingsData,
            gitRepositories: mergedRepos,
          }
        })
      } catch (e) {
        console.error("Error parsing saved settings:", e)
      }
    }
  }, [context.environment])

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

  const handleSave = async () => {
    if (hasSettingsChanges) {
      onSettingsChange(localSettings);

      // Also save to electron-store for persistence across app restarts
      try {
        if (window.electronAPI?.settings?.save) {
          await window.electronAPI.settings.save(localSettings);
        }
      } catch (error) {
        console.error('Failed to save settings to electron-store:', error);
      }

      setHasSettingsChanges(false);
    }

    if (hasContextChanges) {
      onContextChange(localContext);
      setHasContextChanges(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings)
    setLocalContext(context)
    setHasSettingsChanges(false)
    setHasContextChanges(false)
  }

  const [isSelectingFile, setIsSelectingFile] = useState(false);

  const handleKubeConfigSelect = async () => {
    setIsSelectingFile(true);
    try {
      const result = await window.electronAPI?.openFile({
        filters: [{ name: 'Kubernetes Config', extensions: ['yaml', 'yml', 'json', 'config'] }]
      });

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
        showAlert({
          title: "Failed to create directory",
          message: "Please check permissions and try again.",
        })
      }
    }
  }

  /**
   * Handle logging settings changes and apply them to the logger
   */
  const handleLoggingSettingsChange = async (newSettings: LoggingSettings) => {
    try {
      // Update the local settings in state
      setLocalSettings(prev => ({
        ...prev,
        loggingSettings: newSettings
      }));

      // Mark that settings have changed
      setHasSettingsChanges(true);

      // Apply the settings to the actual logger (if the API exists)
      if (window.electronAPI?.logger?.updateConfig) {
        const result = await window.electronAPI.logger.updateConfig(newSettings);

        if (!result.success) {
          console.error('Failed to update logger configuration:', result.error);
          // Optionally show user notification
        }
      } else {
        console.warn('Logger API not available - settings saved locally only');
      }
    } catch (error) {
      console.error('Error updating logging settings:', error);
    }
  };
  /**
   * Handle changes to logging settings
   */
  const handleLoggingSettingChange = (key: keyof LoggingSettings, value: any) => {
    const updatedSettings = {
      ...localSettings,
      loggingSettings: {
        ...localSettings.loggingSettings,
        [key]: value,
      },
    }
    setLocalSettings(updatedSettings)
    setHasSettingsChanges(true)
  }

  /**
   * Handle log directory selection
   */
  const handleLogDirectorySelect = async () => {
    try {
      const selectedPath = await window.electronAPI.selectDirectory({
        title: 'Select Log Directory',
        defaultPath: localSettings.loggingSettings?.logFileLocation || localSettings.baseDirectory,
      })

      if (selectedPath) {
        // Verify the directory exists and is accessible
        const dirInfo = await window.electronAPI.directoryExists(selectedPath)
        if (dirInfo.exists && dirInfo.isDirectory) {
          handleLoggingSettingChange('logFileLocation', selectedPath)
        } else {
          console.error('Selected path is not a valid directory')
        }
      }
    } catch (error) {
      console.error('Failed to select log directory:', error)
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
    <div className="space-y-6 settings-page">
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

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
          <TabsTrigger value="repositories">Git Repositories</TabsTrigger>
          <TabsTrigger value="vault">Vault</TabsTrigger>
          <TabsTrigger value="argocd">ArgoCD</TabsTrigger>
          <TabsTrigger value="helm-oci">Helm OCI</TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="space-y-6">
          <GitConfigurationSection
            context={context}
            onContextChange={onContextChange}
            authModalRepo={authModalRepo}
            setAuthModalRepo={setAuthModalRepo}
            setAuthModalOpen={setAuthModalOpen}
          />
        </TabsContent>

        <TabsContent value="vault" className="space-y-6">
          {/* Vault content - keeping existing code */}
          <VaultConfigurationSection
            context={context}
            settings={settings}
            onSettingsChange={onSettingsChange}
            onContextChange={onContextChange} // Add this prop
          />
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          {/* Application Settings */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Application</h3>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Working Directory</h4>
                <p className="text-sm text-muted-foreground mb-3">Local folder where files are created, updated, and compared against Git repositories</p>
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
              </div>

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
            </div>
          </div>

          {/* Logging Settings */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Logging</h3>
            </div>

            <div className="space-y-6">
              {/* Log Levels */}
              <div className="space-y-4">
                <h4 className="font-medium">Log Levels</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Main Process</Label>
                    <Select
                      value={settings.loggingSettings?.mainProcessLogLevel || 'info'}
                      onValueChange={(value: any) => {
                        const newSettings = {
                          ...settings.loggingSettings,
                          mainProcessLogLevel: value as 'error' | 'warn' | 'info' | 'debug'
                        };
                        handleLoggingSettingsChange(newSettings);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Renderer Process</Label>
                    <Select
                      value={localSettings.loggingSettings?.rendererProcessLogLevel || 'info'}
                      onValueChange={(value) => handleLoggingSettingChange('rendererProcessLogLevel', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">IPC Communication</Label>
                    <Select
                      value={localSettings.loggingSettings?.ipcLogLevel || 'warn'}
                      onValueChange={(value) => handleLoggingSettingChange('ipcLogLevel', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* File Logging Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">File Logging</h4>
                    <p className="text-sm text-muted-foreground">Save logs to files with automatic rotation</p>
                  </div>
                  <Switch
                    checked={localSettings.loggingSettings?.enableFileLogging || false}  // ✅ Use localSettings
                    onCheckedChange={(checked: any) => {
                      const newSettings = {
                        ...localSettings.loggingSettings,  // ✅ Use localSettings
                        enableFileLogging: checked
                      };
                      handleLoggingSettingsChange(newSettings);
                    }}
                  />
                </div>

                {localSettings.loggingSettings?.enableFileLogging !== false && (
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div>
                      <Label className="text-sm font-medium">Log File Location</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={localSettings.loggingSettings?.logFileLocation || ''}
                          onChange={(e) => handleLoggingSettingChange('logFileLocation', e.target.value)}
                          placeholder="Select log file directory"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLogDirectorySelect}
                          className="flex items-center gap-2"
                        >
                          <FolderOpen className="h-4 w-4" />
                          Browse
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Max File Size (MB)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={localSettings.loggingSettings?.maxLogFileSize || 10}
                          onChange={(e: any) => {
                            const newSettings = {
                              ...settings.loggingSettings,
                              maxLogFileSize: parseInt(e.target.value) || 10
                            };
                            handleLoggingSettingsChange(newSettings);
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Max Log Files</Label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={localSettings.loggingSettings?.maxLogFiles || 5}
                          onChange={(e) => handleLoggingSettingChange('maxLogFiles', parseInt(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Console Logging Options */}
              <div className="space-y-4">
                <h4 className="font-medium">Console Output</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Enable Console Logging</Label>
                      <p className="text-xs text-muted-foreground">Show logs in the development console</p>
                    </div>
                    <ToggleSwitch
                      enabled={localSettings.loggingSettings?.enableConsoleLogging ?? true}
                      onChange={(value) => handleLoggingSettingChange('enableConsoleLogging', value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Colored Output</Label>
                      <p className="text-xs text-muted-foreground">Use colors to distinguish log levels</p>
                    </div>
                    <ToggleSwitch
                      enabled={localSettings.loggingSettings?.enableColoredOutput ?? true}
                      onChange={(value) => handleLoggingSettingChange('enableColoredOutput', value)}
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4">
                <h4 className="font-medium">Advanced Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Timestamps</Label>
                      <p className="text-xs text-muted-foreground">Include timestamps in logs</p>
                    </div>
                    <ToggleSwitch
                      enabled={localSettings.loggingSettings?.enableTimestamps ?? true}
                      onChange={(value) => handleLoggingSettingChange('enableTimestamps', value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Process Labels</Label>
                      <p className="text-xs text-muted-foreground">Show [MAIN] and [RENDERER] labels</p>
                    </div>
                    <ToggleSwitch
                      enabled={localSettings.loggingSettings?.enableProcessLabels ?? true}
                      onChange={(value) => handleLoggingSettingChange('enableProcessLabels', value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Log Format</Label>
                  <Select
                    value={localSettings.loggingSettings?.logFormat || 'detailed'}
                    onValueChange={(value) => handleLoggingSettingChange('logFormat', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Performance Logging */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Performance Logging</h4>
                    <p className="text-sm text-muted-foreground">Log operations that exceed threshold</p>
                  </div>
                  <ToggleSwitch
                    enabled={localSettings.loggingSettings?.enablePerformanceLogging ?? false}
                    onChange={(value) => handleLoggingSettingChange('enablePerformanceLogging', value)}
                  />
                </div>

                {localSettings.loggingSettings?.enablePerformanceLogging && (
                  <div className="pl-4 border-l-2 border-muted">
                    <Label className="text-sm font-medium">Threshold (milliseconds)</Label>
                    <Input
                      type="number"
                      min="100"
                      max="10000"
                      value={localSettings.loggingSettings?.performanceLogThreshold || 1000}
                      onChange={(e) => handleLoggingSettingChange('performanceLogThreshold', parseInt(e.target.value))}
                      className="mt-1 max-w-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Appearance</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Theme</h4>
                  <p className="text-sm text-muted-foreground">Choose your preferred color theme</p>
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

          {/* Editor Settings */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Code className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Editor</h3>
            </div>

            <div className="space-y-6">
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
        <TabsContent value="argocd" className="space-y-4">
          <ArgoCDConfigurationSection
            context={context}
            settings={settings}
            onSettingsChange={onSettingsChange}
            onContextChange={onContextChange}
          />
        </TabsContent>

        <TabsContent value="helm-oci" className="space-y-4">
          <HelmOCIConfigurationSection
            context={context}
            settings={settings}
            onSettingsChange={onSettingsChange}
            onContextChange={onContextChange}
          />
        </TabsContent>

        <TabsContent value="kubernetes" className="space-y-4">
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Kubernetes Platform</h3>
            <div className="space-y-4">

              {/* Platform Type Selection */}
              <div className="border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="h-5 w-5" />
                  <h4 className="font-medium">Platform Type</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Select your Kubernetes platform type or enable auto-detection.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Label className="font-medium min-w-[120px]">Platform:</Label>
                    <Select
                      value={localSettings.platformType || 'auto-detect'}
                      onValueChange={(value) => handleSettingChange('platformType', value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto-detect">Auto-detect</SelectItem>
                        <SelectItem value="kubernetes">Vanilla Kubernetes</SelectItem>
                        <SelectItem value="openshift">Red Hat OpenShift</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDetectPlatform}
                      disabled={isDetectingPlatform}
                      className="flex items-center gap-2"
                    >
                      {isDetectingPlatform ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Detect
                    </Button>
                  </div>

                  {/* Platform Detection Results */}
                  {platformInfo && (
                    <div className="bg-muted/50 rounded-lg p-4 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Platform Detected</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><strong>Type:</strong> {platformInfo.type === 'openshift' ? 'Red Hat OpenShift' : 'Vanilla Kubernetes'}</p>
                        {platformInfo.version && <p><strong>Version:</strong> {platformInfo.version}</p>}
                        <p><strong>Detected:</strong> {platformInfo.detectedAt.toLocaleString()}</p>

                        <div className="mt-3">
                          <p className="font-medium mb-2">Available Features:</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <div className={platformInfo.features.hasRoutes ? 'text-green-600' : 'text-muted-foreground'}>
                              {platformInfo.features.hasRoutes ? '✓' : '✗'} Routes
                            </div>
                            <div className={platformInfo.features.hasDeploymentConfigs ? 'text-green-600' : 'text-muted-foreground'}>
                              {platformInfo.features.hasDeploymentConfigs ? '✓' : '✗'} DeploymentConfigs
                            </div>
                            <div className={platformInfo.features.hasBuildConfigs ? 'text-green-600' : 'text-muted-foreground'}>
                              {platformInfo.features.hasBuildConfigs ? '✓' : '✗'} BuildConfigs
                            </div>
                            <div className={platformInfo.features.hasImageStreams ? 'text-green-600' : 'text-muted-foreground'}>
                              {platformInfo.features.hasImageStreams ? '✓' : '✗'} ImageStreams
                            </div>
                            <div className={platformInfo.features.hasSecurityContextConstraints ? 'text-green-600' : 'text-muted-foreground'}>
                              {platformInfo.features.hasSecurityContextConstraints ? '✓' : '✗'} SCCs
                            </div>
                            <div className={platformInfo.features.hasIngressControllers ? 'text-green-600' : 'text-muted-foreground'}>
                              {platformInfo.features.hasIngressControllers ? '✓' : '✗'} Ingress
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="h-5 w-5" />
                  <h4 className="font-medium">Kubernetes Version</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure the Kubernetes version for schema validation and resource creation.
                </p>
                <KubernetesVersionSelector
                  selectedVersion={localSettings.kubernetesVersion || 'v1.31.0'}
                  onVersionChange={(version) => handleSettingChange('kubernetesVersion', version)}
                  onVersionInfoChange={(info) => {
                    // Optional: Store version info in settings if needed
                  }}
                />
              </div>

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
        onSuccess={(credentials: any) => {
          window.electronAPI?.logger?.debug('Authentication completed successfully', {
            serverName: authModalRepo?.name,
            serverUrl: authModalRepo?.url,
            timestamp: new Date().toISOString(),
            credentialsReceived: !!credentials
          });
          console.log('Credentials received:', credentials)
          if (authModalRepo) {
            window.electronAPI?.logger?.info('Updating repository authentication status', {
              repositoryId: authModalRepo.id,
              repositoryName: authModalRepo.name,
              newStatus: 'success'
            });
            // Update repository auth status
            const updatedRepos = localSettings.gitRepositories.map((repo: any) =>
              repo.id === authModalRepo.id
                ? {
                  ...repo,
                  authStatus: "success" as const,
                  lastAuthCheck: new Date().toISOString(),
                }
                : repo,
            )
            console.log('🔐 [SETTINGS-PAGE] Updated repositories list:', updatedRepos)
            handleSettingChange("gitRepositories", updatedRepos)
            console.log('🔐 [SETTINGS-PAGE] Repository auth status updated successfully!')
          } else {
            console.log('🔐 [SETTINGS-PAGE] WARNING: No authModalRepo found, skipping repository update')
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

      <AlertDialog />
    </div>
  )
}
