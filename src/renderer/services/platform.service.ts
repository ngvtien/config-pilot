import type { PlatformInfo } from '@/main/services/platform-detection-service'

export class PlatformService {
  static async detectPlatform(): Promise<PlatformInfo> {
    return window.electronAPI.platform.detect()
  }

  static async updateKubeConfig(kubeConfigPath: string): Promise<PlatformInfo> {
    return window.electronAPI.platform.updateKubeConfig(kubeConfigPath)
  }

  static async clearCache(): Promise<boolean> {
    return window.electronAPI.platform.clearCache()
  }
}