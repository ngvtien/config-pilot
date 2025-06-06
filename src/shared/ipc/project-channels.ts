export const PROJECT_CHANNELS = {
  // Project lifecycle
  CREATE_PROJECT: 'project:create',
  OPEN_PROJECT: 'project:open',
  SAVE_PROJECT: 'project:save',
  SAVE_PROJECT_AS: 'project:save-as',
  CLOSE_PROJECT: 'project:close',
  
  // Project management
  GET_CURRENT_PROJECT: 'project:get-current',
  GET_RECENT_PROJECTS: 'project:get-recent',
  GET_PROJECT_METADATA: 'project:get-metadata',
  DELETE_PROJECT: 'project:delete',
  
  // File operations
  SHOW_OPEN_DIALOG: 'project:show-open-dialog',
  SHOW_SAVE_DIALOG: 'project:show-save-dialog',
  
  // Auto-save
  ENABLE_AUTO_SAVE: 'project:enable-auto-save',
  DISABLE_AUTO_SAVE: 'project:disable-auto-save',
  
  // Export/Import
  EXPORT_PROJECT: 'project:export',
  IMPORT_PROJECT: 'project:import',

  // Platform detection channels
  DETECT_PLATFORM: 'platform:detect',
  UPDATE_PLATFORM_KUBECONFIG: 'platform:update-kubeconfig',
  CLEAR_PLATFORM_CACHE: 'platform:clear-cache',
    
} as const

export type ProjectChannels = typeof PROJECT_CHANNELS[keyof typeof PROJECT_CHANNELS]