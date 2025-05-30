import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

// Define the structure of your log entry
export interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  data?: any;
}

// Define the structure of your main logger
export interface MainLogger {
  logs: LogEntry[];
  maxEntries: number;
  logFile: string;
  
  ensureLogDirectory(): void;
  log(level: string, source: string, message: string, data?: any): LogEntry;
  debug(source: string, message: string, data?: any): LogEntry;
  info(source: string, message: string, data?: any): LogEntry;
  warn(source: string, message: string, data?: any): LogEntry;
  error(source: string, message: string, data?: any): LogEntry;
}

// Define the structure for your global variables
declare global {
  var mainWindow: BrowserWindow | null;
}

// Define types for your IPC handlers
export interface SaveFileOptions {
  content: string;
  defaultPath: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface KubernetesResourceRequest {
  resourceType: string;
  namespace?: string;
  context?: string;
}

export interface KubernetesDeleteRequest {
  resourceType: string;
  name: string;
  namespace?: string;
  context?: string;
}

export interface YamlApplyRequest {
  yaml: string;
  namespace?: string;
}

// Define the interface for window state
export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}
