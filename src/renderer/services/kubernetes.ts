import { KubernetesContext } from '@/shared/types/kubernetes'
  
// First, create a Kubernetes service
export class KubernetesService {
  static async getContexts(): Promise<KubernetesContext[]> {
    if (!window.electronAPI) {
      return [{ name: 'default' }, { name: 'minikube' }];
    }
    return window.electronAPI.invoke('k8s:getContexts');
  }

  static async getCurrentContext(): Promise<string> {
    if (!window.electronAPI) return 'default';
    return window.electronAPI.invoke('k8s:getCurrentContext');
  }

  static async switchContext(contextName: string): Promise<boolean> {
    if (!window.electronAPI) return true;
    return window.electronAPI.invoke('k8s:switchContext', contextName);
  }

  static async getConnectionStatus(): Promise<any> {
    if (!window.electronAPI) return { connected: false, currentContext: null };
    return window.electronAPI.invoke('k8s:getConnectionStatus');
  }

  static async connect(): Promise<any> {
    if (!window.electronAPI) return { connected: false };
    return window.electronAPI.invoke('k8s:connect');
  }

  static async getNamespaces(): Promise<any[]> {
    if (!window.electronAPI) return [];
    return window.electronAPI.invoke('k8s:getNamespaces');
  }

  static async getPods(namespace?: string): Promise<any[]> {
    if (!window.electronAPI) return [];
    return window.electronAPI.invoke('k8s:getPods', namespace);
  }

  static async getDeployments(namespace?: string): Promise<any[]> {
    if (!window.electronAPI) return [];
    return window.electronAPI.invoke('k8s:getDeployments', namespace);
  }

  static async getServices(namespace?: string): Promise<any[]> {
    if (!window.electronAPI) return [];
    return window.electronAPI.invoke('k8s:getServices', namespace);
  }

  static async getNodes(): Promise<any[]> {
    if (!window.electronAPI) return [];
    return window.electronAPI.invoke('k8s:getNodes');
  }
}