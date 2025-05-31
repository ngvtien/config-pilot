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
}