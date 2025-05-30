import type { OpenDialogOptions } from "electron";

export interface LoggerAPI {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  getLogs: () => Promise<string[]>;
  clearLogs: () => Promise<void>;
  setLogLevel: (level: string) => Promise<void>;
  exportLogs: (format: string) => Promise<void>;
  onNewLog: (callback: (logEntry: any) => void) => () => void;
}

export interface ElectronAPI {
  saveYaml: (content: string, env: string) => void;
  commitYamlToGit: (content: string, env: string) => void;
  openFile: () => Promise<string | undefined>;
  saveFile: (content: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  log: (message: any) => void;
  error: (message: any) => void;
  warn: (message: any) => void;

  loadKubeConfig: () => Promise<string>;
  setKubeContext: (contextName: string) => Promise<boolean>;

  logger: LoggerAPI;
}
