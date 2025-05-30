interface KubernetesContext {
  name: string
  cluster: string
  user: string
  namespace?: string
}

interface KubernetesConfig {
  contexts: KubernetesContext[]
  currentContext: string
  configPath: string
}

class KubernetesConfigService {
  private static instance: KubernetesConfigService
  private configPath: string
  private contexts: KubernetesContext[] = []
  private currentContext = ""
  private listeners: ((config: KubernetesConfig) => void)[] = []

  constructor() {
    this.configPath = this.getDefaultConfigPath()
  }

  static getInstance(): KubernetesConfigService {
    if (!KubernetesConfigService.instance) {
      KubernetesConfigService.instance = new KubernetesConfigService()
    }
    return KubernetesConfigService.instance
  }

  private getDefaultConfigPath(): string {
    if (typeof window !== "undefined" && window.electronAPI) {
      // Electron environment - use Electron API to get the proper path
      return window.electronAPI.getKubeConfigPath?.() || ""
    }
    // Web environment - no default path, user must set it
    return ""
  }

  async loadContexts(): Promise<KubernetesContext[]> {
    try {
      let configContent: string

      if (typeof window !== "undefined" && window.electronAPI?.readFile) {
        // Electron environment - read actual file
        configContent = await window.electronAPI.readFile(this.configPath)
      } else {
        // Web environment - use mock data or API
        return this.getMockContexts()
      }

      const config = this.parseKubeConfig(configContent)
      this.contexts = config.contexts
      this.currentContext = config.currentContext

      this.notifyListeners()
      return this.contexts
    } catch (error) {
      console.error("Failed to load Kubernetes config:", error)
      // Fallback to mock data
      return this.getMockContexts()
    }
  }

  private parseKubeConfig(_content: string): { contexts: KubernetesContext[]; currentContext: string } {
    try {
      // Parse YAML content (you'd need a YAML parser like js-yaml)
      // For now, return mock data
      return {
        contexts: this.getMockContexts(),
        currentContext: "docker-desktop",
      }
    } catch (error) {
      throw new Error("Failed to parse Kubernetes config file")
    }
  }

  private getMockContexts(): KubernetesContext[] {
    return [
      { name: "docker-desktop", cluster: "docker-desktop", user: "docker-desktop", namespace: "default" },
      { name: "minikube", cluster: "minikube", user: "minikube", namespace: "kube-system" },
      { name: "kind-kind", cluster: "kind-kind", user: "kind-kind" },
      { name: "production-cluster", cluster: "prod-k8s", user: "admin", namespace: "production" },
      { name: "staging-environment", cluster: "staging-k8s", user: "admin", namespace: "staging" },
    ]
  }

  setConfigPath(path: string): void {
    this.configPath = path
    // Save to settings
    this.saveConfigPath(path)
    // Reload contexts
    this.loadContexts()
  }

  getConfigPath(): string {
    return this.configPath
  }

  getCurrentContext(): string {
    return this.currentContext
  }

  async setCurrentContext(contextName: string): Promise<boolean> {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.setKubeContext) {
        await window.electronAPI.setKubeContext(contextName)
      }

      this.currentContext = contextName
      this.notifyListeners()
      return true
    } catch (error) {
      console.error("Failed to set Kubernetes context:", error)
      return false
    }
  }

  subscribe(listener: (config: KubernetesConfig) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners(): void {
    const config: KubernetesConfig = {
      contexts: this.contexts,
      currentContext: this.currentContext,
      configPath: this.configPath,
    }
    this.listeners.forEach((listener) => listener(config))
  }

  private saveConfigPath(path: string): void {
    try {
      const settings = JSON.parse(localStorage.getItem("configpilot_settings") || "{}")
      settings.kubeConfigPath = path
      localStorage.setItem("configpilot_settings", JSON.stringify(settings))
    } catch (error) {
      console.error("Failed to save config path:", error)
    }
  }

  loadConfigPath(): string {
    try {
      const settings = JSON.parse(localStorage.getItem("configpilot_settings") || "{}")
      return settings.kubeConfigPath || this.getDefaultConfigPath()
    } catch (error) {
      return this.getDefaultConfigPath()
    }
  }
}

export const kubernetesConfigService = KubernetesConfigService.getInstance()
export type { KubernetesContext, KubernetesConfig }
