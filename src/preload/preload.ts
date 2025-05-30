// import { contextBridge, ipcRenderer } from "electron";
// import fs from "fs";
// import os from "os";
// import path from "path";
// import type { ElectronAPI } from "../shared/types/electron-api.js";

// let log: any;
// try {
//   log = require("electron-log/renderer");
//   console.log("[PRELOAD] electron-log loaded successfully");
// } catch {
//   log = {
//     info: (...args: any[]) => console.info("[INFO]", ...args),
//     warn: (...args: any[]) => console.warn("[WARN]", ...args),
//     error: (...args: any[]) => console.error("[ERROR]", ...args),
//     debug: (...args: any[]) => console.debug("[DEBUG]", ...args),
//   };
//   console.warn("[PRELOAD] electron-log not available, using fallback logger");
// }

// log.info("Preload script executing", { source: "preload" });

// const electronAPI: ElectronAPI = {
//   saveYaml: (content, env) => ipcRenderer.send("save-yaml", content, env),
//   commitYamlToGit: (content, env) => ipcRenderer.send("commit-yaml-to-git", content, env),
//   openFile: () => ipcRenderer.invoke("dialog:openFile"),
//   saveFile: (content) => ipcRenderer.invoke("dialog:saveFile", content),
//   getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
//   log: (message) => ipcRenderer.send("log:message", "info", message),
//   error: (message) => ipcRenderer.send("log:message", "error", message),
//   warn: (message) => ipcRenderer.send("log:message", "warn", message),

//   loadKubeConfig: async () => {
//     try {
//       console.log("[PRELOAD] loadKubeConfig called");
//       const kubeconfigPath = path.join(os.homedir(), ".kube", "config");
//       console.log("[PRELOAD] Looking for kubeconfig at:", kubeconfigPath);

//       if (fs.existsSync(kubeconfigPath)) {
//         console.log("[PRELOAD] Kubeconfig file found");
//         const config = fs.readFileSync(kubeconfigPath, "utf8");
//         console.log("[PRELOAD] Kubeconfig loaded successfully");
//         return config;
//       } else {
//         console.error("[PRELOAD] Kubeconfig file not found at:", kubeconfigPath);
//         throw new Error("Kubeconfig file not found");
//       }
//     } catch (error) {
//       console.error("[PRELOAD] Error loading kubeconfig:", error);
//       throw error;
//     }
//   },

//   setKubeContext: async (contextName) => {
//     console.log("[PRELOAD] setKubeContext called with:", contextName);
//     try {
//       const result = await ipcRenderer.invoke("set-kube-context", contextName);
//       console.log("[PRELOAD] setKubeContext result:", result);
//       return result;
//     } catch (error) {
//       console.error("[PRELOAD] setKubeContext error:", error);
//       throw error;
//     }
//   },

//   logger: {
//     debug: (message, data = {}) =>
//       ipcRenderer.send("log-message", { level: "debug", source: "renderer", message, data }),
//     info: (message, data = {}) =>
//       ipcRenderer.send("log-message", { level: "info", source: "renderer", message, data }),
//     warn: (message, data = {}) =>
//       ipcRenderer.send("log-message", { level: "warn", source: "renderer", message, data }),
//     error: (message, data = {}) =>
//       ipcRenderer.send("log-message", { level: "error", source: "renderer", message, data }),
//     getLogs: () => ipcRenderer.invoke("get-logs"),
//     clearLogs: () => ipcRenderer.invoke("clear-logs"),
//     setLogLevel: (level) => ipcRenderer.invoke("set-log-level", level),
//     exportLogs: (format) => ipcRenderer.invoke("export-logs", format),
//     onNewLog: (callback) => {
//       const listener = (_: any, logEntry: any) => callback(logEntry);
//       ipcRenderer.on("new-log-entry", listener);
//       return () => {
//         ipcRenderer.removeListener("new-log-entry", listener);
//       };
//     },
//   },
// };

// contextBridge.exposeInMainWorld("electronAPI", electronAPI);



// const { contextBridge, ipcRenderer } = require("electron")
// const fs = require("fs")
// const os = require("os")
// const path = require("path")

// console.log("[PRELOAD] Starting preload script with CommonJS")

// const electronAPI = {
//   testGitCredentials: (params: any) => ipcRenderer.invoke("test-git-credentials", params),
//   selectFile: (options: any) => ipcRenderer.invoke("dialog:selectFile", options),
//   selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),
//   checkGitAuth: (url: any) => ipcRenderer.invoke("check-git-auth", url),
//   readFile: (filePath: any) => ipcRenderer.invoke("read-file", filePath),
//   setKubeContext: (contextName: any) => ipcRenderer.invoke("set-kube-context", contextName),
//   getKubeConfigPath: () => ipcRenderer.invoke("get-kube-config-path"),
//   storeSecureCredentials: (params: any) => ipcRenderer.invoke("store-secure-credentials", params),
//   getSecureCredentials: (params: any) => ipcRenderer.invoke("get-secure-credentials", params),
//   removeSecureCredentials: (params: any) => ipcRenderer.invoke("remove-secure-credentials", params),
//   listSecureCredentials: (service: any) => ipcRenderer.invoke("list-secure-credentials", service),
//   updateCredentialUsage: (params: any) => ipcRenderer.invoke("update-credential-usage", params),
//   chartGetDetails: (chartPath: any) => ipcRenderer.invoke("chart:getDetails", chartPath),
//   chartSaveValues: (chartPath: any, values: any) => ipcRenderer.invoke("chart:saveValues", chartPath, values),
//   helmTemplate: (params: any) => ipcRenderer.invoke("helm:template", params),

//   // Add the existing methods from your IPC handlers
//   saveYaml: (content: any, env: any) => ipcRenderer.send("save-yaml", content, env),
//   commitYamlToGit: (content: any, env: any) => ipcRenderer.send("commit-yaml-to-git", content, env),
//   openFile: () => ipcRenderer.invoke("dialog:openFile"),
//   saveFile: (content: any) => ipcRenderer.invoke("dialog:saveFile", content),
//   getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
//   log: (message: any) => ipcRenderer.send("log:message", "info", message),
//   error: (message: any) => ipcRenderer.send("log:message", "error", message),
//   warn: (message: any) => ipcRenderer.send("log:message", "warn", message),

//   loadKubeConfig: async () => {
//     try {
//       console.log("[PRELOAD] loadKubeConfig called")
//       const kubeconfigPath = path.join(os.homedir(), ".kube", "config")

//       if (fs.existsSync(kubeconfigPath)) {
//         const config = fs.readFileSync(kubeconfigPath, "utf8")
//         return config
//       } else {
//         throw new Error("Kubeconfig file not found")
//       }
//     } catch (error) {
//       console.error("[PRELOAD] Error loading kubeconfig:", error)
//       throw error
//     }
//   },
// }

// contextBridge.exposeInMainWorld("electronAPI", electronAPI)
// console.log("[PRELOAD] electronAPI exposed to main world")


import { contextBridge, ipcRenderer } from 'electron';

// Simple example API - customize as needed
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});

// Add this to confirm preload is loading
console.log('Preload script loaded successfully');