import * as k8s from "@kubernetes/client-node"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { ipcMain } from "electron"
import yaml from "js-yaml"
import Store from 'electron-store';

// Path to kubeconfig file
const KUBECONFIG_PATH = process.env.KUBECONFIG || path.join(os.homedir(), ".kube", "config")

// Interface for Kubernetes context
interface K8sContext {
  name: string
  cluster: string
  authInfo: string
  namespace?: string
  active: boolean
}

// Interface for Kubernetes namespace
interface K8sNamespace {
  name: string
  status: string
}

// Interface for Kubernetes pod
interface K8sPod {
  name: string
  namespace: string
  status: string
  ready: string
  restarts: number
  age: string
}

// Interface for connection status
interface ConnectionStatus {
  connected: boolean
  currentContext: string | null
  error?: string
}

// Class to manage Kubernetes operations
class KubernetesService {
  private kc: k8s.KubeConfig
  private k8sCoreApi: k8s.CoreV1Api | null = null
  private connectionStatus: ConnectionStatus = {
    connected: false,
    currentContext: null,
  }

  private configPaths: {
    default: string;  // ~/.kube/config
    userSelected: string | null; // Custom path from UI
    active: string;   // Currently used path
  };

  // 1. Add config path management
  private configPath?: string;

  // Load the kubeconfig file (doesn't require connection)
  private loadKubeConfig(): void {
    try {
      // Try to load from default location
      if (fs.existsSync(KUBECONFIG_PATH)) {
        console.log(`Loading kubeconfig from ${KUBECONFIG_PATH}`)
        this.kc.loadFromFile(KUBECONFIG_PATH)
        this.connectionStatus.currentContext = this.kc.getCurrentContext()
        console.log(`Loaded kubeconfig with current context: ${this.connectionStatus.currentContext}`)
      } else {
        console.warn(`Kubeconfig file not found at ${KUBECONFIG_PATH}`)
        // Don't try to load from cluster here, we'll do that explicitly when connecting
      }
    } catch (error) {
      console.error("Error loading kubeconfig:", error)
    }
  }

  // Get all available contexts (doesn't require connection)
  getContexts(): K8sContext[] {
    try {
      const currentContext = this.kc.getCurrentContext()
      return this.kc.getContexts().map((context) => ({
        name: context.name,
        cluster: context.cluster,
        authInfo: context.user,
        namespace: context.namespace || "default",
        active: context.name === currentContext,
      }))
    } catch (error) {
      console.error("Error getting contexts:", error)
      return []
    }
  }

  // Get current context (doesn't require connection)
  getCurrentContext(): string | null {
    try {
      return this.kc.getCurrentContext()
    } catch (error) {
      console.error("Error getting current context:", error)
      return null
    }
  }

  // Switch context (doesn't require connection to the new context)
  switchContext(contextName: string): boolean {
    try {
      // First check if the context exists
      const contexts = this.kc.getContexts()
      const contextExists = contexts.some((ctx) => ctx.name === contextName)

      if (!contextExists) {
        console.error(`Context ${contextName} not found in kubeconfig`)
        return false
      }

      // Switch the context in the KubeConfig object
      this.kc.setCurrentContext(contextName)
      this.connectionStatus.currentContext = contextName

      // Reset the connection status since we haven't connected to the new context yet
      this.connectionStatus.connected = false
      this.connectionStatus.error = undefined

      // Don't create the API client yet - we'll do that when connect() is called
      this.k8sCoreApi = null

      console.log(`Switched to context ${contextName} (not connected yet)`)
      return true
    } catch (error) {
      console.error(`Error switching to context ${contextName}:`, error)
      return false
    }
  }

  // Connect to the current context (requires connection)
  async connect(): Promise<ConnectionStatus> {
    try {
      console.log(`Connecting to context: ${this.connectionStatus.currentContext}`)

      // Create the API client for the current context
      this.k8sCoreApi = this.kc.makeApiClient(k8s.CoreV1Api)

      // Test the connection with a simple API call
      await this.k8sCoreApi.getAPIResources()

      // If we get here, the connection was successful
      this.connectionStatus.connected = true
      this.connectionStatus.error = undefined
      console.log(`Successfully connected to context: ${this.connectionStatus.currentContext}`)

      return { ...this.connectionStatus }
    } catch (error) {
      this.connectionStatus.connected = false
      this.connectionStatus.error = error instanceof Error ? error.message : String(error)

      console.error(`Failed to connect to context ${this.connectionStatus.currentContext}:`, error)
      return { ...this.connectionStatus }
    }
  }

  // Get connection status (doesn't require connection)
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus }
  }

  // Get namespaces in current context (requires connection)
  async getNamespaces(): Promise<K8sNamespace[]> {
    if (!this.k8sCoreApi || !this.connectionStatus.connected) {
      console.warn("Cannot get namespaces: Not connected to Kubernetes")
      return []
    }

    try {
      // Call the API with the correct return type
      const namespaceList = await this.k8sCoreApi.listNamespace()

      // Process the namespace list
      return namespaceList.items.map((ns) => ({
        name: ns.metadata?.name || "unknown",
        status: ns.status?.phase || "Unknown",
      }))
    } catch (error) {
      console.error("Error getting namespaces:", error)
      // Update connection status if this fails
      this.connectionStatus.connected = false
      this.connectionStatus.error = error instanceof Error ? error.message : String(error)
      return []
    }
  }

  // Get pods in a namespace (requires connection)
  async getPods(namespace = "default"): Promise<K8sPod[]> {
    if (!this.k8sCoreApi || !this.connectionStatus.connected) {
      console.warn(`Cannot get pods in namespace ${namespace}: Not connected to Kubernetes`)
      return []
    }

    try {
      // Create the request object according to the type definition
      const request: k8s.CoreV1ApiListNamespacedPodRequest = {
        namespace: namespace,
      }

      // Call the API with the properly typed request object
      const podList = await this.k8sCoreApi.listNamespacedPod(request)

      // Process the pod list
      return podList.items.map((pod) => {
        // Calculate ready containers
        const containerStatuses = pod.status?.containerStatuses || []
        const readyCount = containerStatuses.filter((status) => status.ready).length
        const totalCount = containerStatuses.length
        const readyString = `${readyCount}/${totalCount}`

        // Calculate restarts
        const restarts = containerStatuses.reduce((sum, status) => sum + (status.restartCount || 0), 0)

        // Calculate age
        const creationTimestamp = pod.metadata?.creationTimestamp
        const age = creationTimestamp ? this.calculateAge(new Date(creationTimestamp)) : "Unknown"

        // Determine status
        let status = pod.status?.phase || "Unknown"
        if (status === "Running") {
          const isReady = readyCount === totalCount
          if (!isReady) {
            status = "Running (Not Ready)"
          }
        }

        return {
          name: pod.metadata?.name || "unknown",
          namespace: pod.metadata?.namespace || namespace,
          status: status,
          ready: readyString,
          restarts: restarts,
          age: age,
        }
      })
    } catch (error) {
      console.error(`Error getting pods in namespace ${namespace}:`, error)
      // Update connection status if this fails
      this.connectionStatus.connected = false
      this.connectionStatus.error = error instanceof Error ? error.message : String(error)
      return []
    }
  }

  // Helper function to calculate age in human-readable format
  private calculateAge(creationTime: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - creationTime.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `${diffDays}d`
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours > 0) {
      return `${diffHours}h`
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}m`
  }

  constructor(initialPath?: string) {
    this.kc = new k8s.KubeConfig();
    this.configPaths = {
      default: path.join(os.homedir(), ".kube", "config"),
      userSelected: initialPath || null,
      active: initialPath || path.join(os.homedir(), ".kube", "config")
    };
    this.loadConfig();
  }

  private loadConfig(): void {
    // Priority: 1. User selected 2. Default
    this.configPaths.active = this.configPaths.userSelected || this.configPaths.default;

    try {
      if (fs.existsSync(this.configPaths.active)) {
        this.kc.loadFromFile(this.configPaths.active);
        console.log(`Loaded config from ${this.configPaths.active}`);
      } else {
        console.warn(`Kubeconfig not found at ${this.configPaths.active}`);
      }
    } catch (error) {
      console.error("Error loading kubeconfig:", error);
    }
  }

  public debugConfigState() {
    console.log('Current config state:', {
      activePath: this.configPaths.active,
      exists: fs.existsSync(this.configPaths.active),
      contexts: this.kc.getContexts().map(c => c.name),
      currentContext: this.kc.getCurrentContext()
    });
  }

  // public setUserConfigPath(path: string): boolean {
  //   if (!fs.existsSync(path)) return false;

  //   this.configPaths.userSelected = path;
  //   this.loadConfig(); // Reload with new path
  //   return true;
  // }

  // public setUserConfigPath(path: string): boolean {
  //   if (!this.validateConfigPath(path)) return false;

  //   this.configPaths.userSelected = path;
  //   this.configPaths.active = path;

  //   // Complete reload cycle
  //   this.kc = new k8s.KubeConfig();
  //   this.loadConfig();

  //   // Reset connection
  //   this.connectionStatus = {
  //     connected: false,
  //     currentContext: null
  //   };
  //   this.k8sCoreApi = null;

  //   return true;
  // }

  public setUserConfigPath(rawPath: string): boolean {
    const normalizedPath = rawPath; //this.normalizePath(rawPath);

    if (!this.validateConfigPath(normalizedPath)) {
      return false;
    }

    this.configPaths.userSelected = normalizedPath;
    this.configPaths.active = normalizedPath;

    // Complete reload
    this.kc = new k8s.KubeConfig();
    try {
      this.kc.loadFromFile(normalizedPath);
      console.log(`Successfully loaded config from ${normalizedPath}`);
      return true;
    } catch (error) {
      console.error(`Failed to load config from ${normalizedPath}:`, error);
      return false;
    }
  }

  public getActiveConfigPath(): string {
    return this.configPaths.active;
  }

  public getAvailableConfigs(): { default: string; userSelected: string | null } {
    return { ...this.configPaths };
  }

  // 2. Add method to reload config
  reloadConfig(newPath?: string): void {
    if (newPath) {
      this.configPath = newPath
    }
    this.loadKubeConfig()
  }

  // validateConfigPath(path: string): boolean {
  //   try {
  //     if (!fs.existsSync(path)) {
  //       throw new Error(`Config file not found at ${path}`)
  //     }
  //     // Try to parse the file to validate it's a proper kubeconfig
  //     const config = fs.readFileSync(path, 'utf-8')
  //     const parsed = yaml.load(config)
  //     if (!parsed || typeof parsed !== 'object') {
  //       throw new Error('Invalid kubeconfig format')
  //     }
  //     return true
  //   } catch (error) {
  //     console.error('Invalid kubeconfig:', error)
  //     return false
  //   }
  // }

  validateConfigPath(rawPath: string): boolean {
    try {
      const normalizedPath =  rawPath; //this.normalizePath(rawPath);
      if (!fs.existsSync(normalizedPath)) {
        console.error(`Config file not found at ${normalizedPath}`);
        return false;
      }

      const config = fs.readFileSync(normalizedPath, 'utf-8');
      const parsed = yaml.load(config);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid kubeconfig format');
      }
      return true;
    } catch (error) {
      console.error('Invalid kubeconfig:', error);
      return false;
    }
  }

  normalizePath(rawPath: string): string {
    // Handle UNC paths (Windows network paths)
    if (rawPath.startsWith('\\\\')) {
      return rawPath.replace(/\\/g, '\\\\');
    }
    return path.normalize(rawPath);
  }

}

// Initialize Kubernetes service
export function initK8sService(initialConfigPath?: string) {
  const k8sService = new KubernetesService(initialConfigPath);

  // Log available contexts (doesn't require connection)
  const contexts = k8sService.getContexts()
  console.log(
    `Available Kubernetes contexts (${contexts.length}):`,
    contexts.map((ctx) => `${ctx.name}${ctx.active ? " (active)" : ""}`).join(", "),
  )

  // Try to connect to the current context (async, won't block initialization)
  k8sService.connect().then((status) => {
    console.log(`Initial connection status: ${status.connected ? "Connected" : "Disconnected"}`)
    if (!status.connected && status.error) {
      console.log(`Connection error: ${status.error}`)
    }
  })

  // Register IPC handlers for communication with the renderer process
  ipcMain.handle("k8s:getContexts", () => {
    return k8sService.getContexts()
  })

  ipcMain.handle("k8s:getCurrentContext", () => {
    return k8sService.getCurrentContext()
  })

  ipcMain.handle("k8s:switchContext", async (_, contextName) => {
    return k8sService.switchContext(contextName)
  })

  ipcMain.handle("k8s:connect", async () => {
    return await k8sService.connect()
  })

  ipcMain.handle("k8s:getConnectionStatus", () => {
    return k8sService.getConnectionStatus()
  })

  ipcMain.handle("k8s:getNamespaces", async () => {
    return await k8sService.getNamespaces()
  })

  ipcMain.handle("k8s:getPods", async (_, namespace) => {
    return await k8sService.getPods(namespace)
  })

  ipcMain.handle("k8s:setConfigPath", async (_, path) => {
    if (!k8sService.validateConfigPath(path)) {
      return { success: false, error: 'Invalid kubeconfig file' }
    }
    k8sService.reloadConfig(path)
    return { success: true }
  })

  // ipcMain.handle("k8s:setUserConfigPath", (_, path) => {
  //   return k8sService.setUserConfigPath(path);
  // });

  ipcMain.handle("k8s:setUserConfigPath", (_, path) => {
    const success = k8sService.setUserConfigPath(path);
    k8sService.debugConfigState();
    if (success) {
      new Store().set('kubeConfigPath', path);
    }
    return success;
  });

  // ipcMain.handle("k8s:setUserConfigPath", (_, rawPath) => {
  //   console.log(`Received path request: ${rawPath}`); // Debug original
  //   const normalizedPath = k8sService.normalizePath(rawPath);
  //   console.log(`Normalized path: ${normalizedPath}`); // Debug normalized

  //   const success = k8sService.setUserConfigPath(normalizedPath);
  //   if (success) {
  //     new Store().set('kubeConfigPath', normalizedPath);
  //     console.log(`Successfully set config path to: ${normalizedPath}`);
  //   } else {
  //     console.error(`Failed to set config path to: ${normalizedPath}`);
  //   }

  //   // Debug output
  //   console.log('Current active path:', k8sService.getActiveConfigPath());
  //   console.log('Available contexts:', k8sService.getContexts().map(c => c.name));

  //   return success;
  // });

  ipcMain.handle("k8s:getActiveConfigPath", () => {
    return k8sService.getActiveConfigPath();
  });

  ipcMain.handle("k8s:getAvailableConfigs", () => {
    return k8sService.getAvailableConfigs();
  });

  console.log("Kubernetes client service initialized")
}

