"use client"
import { useState, useEffect } from "react"
import { AppSidebar } from "@/renderer/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/renderer/components/ui/breadcrumb"
import { SidebarInset, SidebarProvider } from "@/renderer/components/ui/sidebar"
import { ContextSelector } from "@/renderer/components/context-selector"
import { SettingsPage } from "@/renderer/pages/settings-page"
import { SchemaEditor } from "@/renderer/components/schema-editor"
import ValueEditor from "@/renderer/components/value-editor"
import SecretsEditor from "@/renderer/components/secrets-editor"
import FileExplorerPage from "@/renderer/pages/file-explorer-page"
import type { ContextData } from "@/shared/types/context-data"
import type { SettingsData } from "@/shared/types/settings-data"

type UserRole = "developer" | "devops" | "operations"
type ViewType =
  | "schema"
  | "values"
  | "secrets"
  | "chart-builder"
  | "template-editor"
  | "oci-registry"
  | "kubernetes"
  | "argocd"
  | "git-repos"
  | "file-explorer"
  | "settings"

interface AppLayoutPageProps {
  contextData?: ContextData
  settingsData?: SettingsData
  onContextChange?: (context: ContextData) => void
  onSettingsChange?: (settings: SettingsData) => void
}

export default function AppLayoutPage({
  contextData: propContextData,
  settingsData: propSettingsData,
  onContextChange: propOnContextChange,
  onSettingsChange: propOnSettingsChange,
}: AppLayoutPageProps) {
  const [userRole, setUserRole] = useState<UserRole>("developer")
  const [view, setView] = useState<ViewType>("schema")
  const [kubernetesContext, setKubernetesContext] = useState<string>("docker-desktop")

  // Use props if provided, otherwise use local state
  const [localContext, setLocalContext] = useState<ContextData>({
    environment: "dev",
    instance: 0,
    product: "k8s",
    customer: "ACE",
    version: "1.2.7",
    baseHostUrl: "",
  })

  const [localSettings, setLocalSettings] = useState<SettingsData>({
    autoSave: true,
    darkMode: false,
    lineNumbers: true,
    wordWrap: true,
    autoRefreshContexts: true,
    defaultNamespace: "default",
    baseDirectory: "/opt/config-pilot/configs",
    kubeConfigPath: "~/.kube/config",
    gitRepositories: [],
    editorSettings: {
      fontSize: 14,
      tabSize: 2,
      theme: "dark",
      fontFamily: "",
      insertSpaces: false,
      wordWrap: "wordWrapColumn",
      wordWrapColumn: 0,
      minimap: false,
      lineNumbers: "off",
      folding: false,
      autoIndent: "none",
      formatOnSave: false,
      formatOnPaste: false,
      trimTrailingWhitespace: false,
      insertFinalNewline: false,
      bracketPairColorization: false,
      showWhitespace: "none",
    },
    kubernetesSettings: {
      defaultContext: "docker-desktop",
      timeoutDuration: 30000,
      defaultNamespace: "",
      autoSwitchContext: false,
      validateResources: false,
      dryRunByDefault: false,
      showSystemNamespaces: false,
      refreshInterval: 0,
      maxLogLines: 0,
      followLogs: false,
      contexts: [],
    },
    securitySettings: {
      encryptLocalData: true,
      requireAuthForSensitiveOps: false,
      enableSecureStorage: false,
      sessionTimeout: 0,
      auditLogging: false,
      allowRemoteConnections: false,
      trustedHosts: [],
      sslVerification: false,
    },
    uiSettings: {
      compactMode: false,
      showLineNumbers: true,
      theme: "light",
      accentColor: "",
      showTooltips: false,
      animationsEnabled: false,
      sidebarWidth: 0,
      panelLayout: "auto",
      showMinimap: false,
      fontSize: "small",
      density: "comfortable",
    },
    backupSettings: {
      enableAutoBackup: true,
      backupInterval: 3600,
      maxBackups: 10,
      backupLocation: "",
      includeSecrets: false,
      compressBackups: false,
      cloudSync: {
        enabled: false,
        provider: undefined,
        credentials: undefined,
        syncInterval: undefined,
      },
    },
  })

  // Use controlled or uncontrolled mode
  const context = propContextData || localContext
  const settings = propSettingsData || localSettings

  // Load from localStorage only if not controlled
  useEffect(() => {
    if (!propContextData) {
      const savedContext = localStorage.getItem("helm_editor_context")
      if (savedContext) {
        try {
          const contextData = JSON.parse(savedContext)
          setLocalContext({
            environment: contextData.environment || "dev",
            instance: contextData.instance || 0,
            product: contextData.product || "k8s",
            customer: contextData.customer || "ACE",
            version: contextData.version || "1.2.7",
            baseHostUrl: contextData.baseHostUrl || "",
          })
        } catch (e) {
          console.error("Error parsing saved context:", e)
        }
      }
    }

    if (!propSettingsData) {
      const savedSettings = localStorage.getItem("config_pilot_settings")
      if (savedSettings) {
        try {
          const settingsData = JSON.parse(savedSettings)
          setLocalSettings((prev) => ({ ...prev, ...settingsData }))
        } catch (e) {
          console.error("Error parsing saved settings:", e)
        }
      }
    }
  }, [propContextData, propSettingsData])

  // Set initial view based on role - ONLY RUN ONCE ON MOUNT
  useEffect(() => {
    if (userRole === "developer") {
      setView("schema")
    } else {
      setView("values")
    }
  }, []) // Empty dependency array means this only runs once on mount

  // Save to localStorage only if not controlled
  const saveContextToLocalStorage = (newContext: ContextData) => {
    if (!propContextData) {
      try {
        const contextData = {
          ...newContext,
          lastUpdated: new Date().toISOString(),
        }
        localStorage.setItem("helm_editor_context", JSON.stringify(contextData))
      } catch (e) {
        console.error("Error saving context to localStorage:", e)
      }
    }
  }

  const saveSettingsToLocalStorage = (newSettings: SettingsData) => {
    if (!propSettingsData) {
      try {
        localStorage.setItem("config_pilot_settings", JSON.stringify(newSettings))
      } catch (e) {
        console.error("Error saving settings to localStorage:", e)
      }
    }
  }

  const handleContextChange = (newContext: ContextData) => {
    if (propOnContextChange) {
      propOnContextChange(newContext)
    } else {
      setLocalContext(newContext)
      saveContextToLocalStorage(newContext)
    }
  }

  const handleSettingsChange = (newSettings: SettingsData) => {
    if (propOnSettingsChange) {
      propOnSettingsChange(newSettings)
    } else {
      setLocalSettings(newSettings)
      saveSettingsToLocalStorage(newSettings)
    }
  }

  const handleKubernetesContextChange = (contextName: string) => {
    setKubernetesContext(contextName)
    console.log("Kubernetes context changed to:", contextName)
  }

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case "developer":
        return "Developer"
      case "devops":
        return "DevOps"
      case "operations":
        return "Operations"
      default:
        return role
    }
  }

  const getViewDisplayName = (viewType: ViewType) => {
    switch (viewType) {
      case "chart-builder":
        return "Chart Builder"
      case "template-editor":
        return "Template Editor"
      case "oci-registry":
        return "OCI Registry"
      case "git-repos":
        return "Git Repositories"
      case "file-explorer":
        return "File Explorer"
      default:
        return viewType.charAt(0).toUpperCase() + viewType.slice(1)
    }
  }

  const renderContent = () => {
    switch (view) {
      case "schema":
        return <SchemaEditor context={context} baseDirectory= {settings.baseDirectory} />
      case "secrets":
        return ( 
          <SecretsEditor
            context={context}
            schemaPath="/src/mock/schema/secrets.schema.json"
            baseDirectory= {settings.baseDirectory}
            onChange={(value) => {
              // Save changes to localStorage for persistence
              localStorage.setItem(`secrets_editor_${context.environment}`, value)
              console.log(`Secrets updated for ${context.environment}:`, value)
            }}
          />        
      )
      case "values":
        return (
          <ValueEditor
            context={context}
            schemaPath="/src/mock/schema/values.schema.json"
            baseDirectory= {settings.baseDirectory}
            onChange={(value) => {
              // Save changes to localStorage for persistence
              localStorage.setItem(`value_editor_${context.environment}`, value)
              console.log(`Values updated for ${context.environment}:`, value)
            }}
          />
        )
      case "kubernetes":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Kubernetes</h2>
            <p className="text-muted-foreground">Manage Kubernetes deployments and resources.</p>
            <div className="border rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-semibold mb-2">Kubernetes Management</h3>
              <p className="text-muted-foreground">Deploy and manage your applications on Kubernetes clusters.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Current context: <span className="font-mono">{kubernetesContext}</span>
              </p>
            </div>
          </div>
        )
      case "file-explorer":
        return (
          <FileExplorerPage
            context={{
              baseDirectory: settings.baseDirectory,
              customer: context.customer,
              product: context.product,
              environment: context.environment,
              instance: context.instance,
            }}
          />
        )
      case "settings":
        return (
          <SettingsPage
            context={context}
            kubernetesContext={kubernetesContext}
            onContextChange={handleContextChange}
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />
        )
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="text-6xl">🚧</div>
            <h3 className="text-xl font-semibold">Coming Soon</h3>
            <p className="text-muted-foreground">This feature is currently under development.</p>
          </div>
        )
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar
        userRole={userRole}
        setUserRole={setUserRole}
        view={view}
        setView={setView}
        environment={context.environment}
        setEnvironment={(env) => handleContextChange({ ...context, environment: env })}
        kubernetesContext={kubernetesContext}
        setKubernetesContext={handleKubernetesContextChange}
        onSaveContext={() => saveContextToLocalStorage(context)}
      />
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-background border-b">
          <div className="flex items-center gap-2 px-4 w-full">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbPage>ConfigPilot</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbPage>{getRoleDisplayName(userRole)}</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{getViewDisplayName(view)}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Right side - Context Selector */}
            <div className="ml-auto">
              <ContextSelector context={context} onContextChange={handleContextChange} />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{renderContent()}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
