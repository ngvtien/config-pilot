import { useEffect } from 'react'
import type { SettingsData } from '@/shared/types/settings-data'

export function useWindowTitle(settings: SettingsData) {
  useEffect(() => {
    const baseTitle = 'ConfigPilot'
    
    let title = baseTitle
    if (settings.baseDirectory && settings.baseDirectory.trim() !== '') {
      title = `${baseTitle} - ${settings.baseDirectory}`
    }
    
    // Update document title for web context
    document.title = title
    
    // Update Electron window title if available
    if (window.electronAPI?.setTitle) {
      window.electronAPI.setTitle(title)
    }
  }, [settings.baseDirectory])
}