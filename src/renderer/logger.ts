import log from 'electron-log/renderer';

// Browser console colors (CSS styles)
const CONSOLE_STYLES = {
  error: 'color: #ff4444; font-weight: bold;',
  warn: 'color: #ffaa00; font-weight: bold;',
  info: 'color: #4488ff;',
  debug: 'color: #888888;',
  renderer: 'color: #44ff44; font-weight: bold;',
  ui: 'color: #ff44ff; font-weight: bold;',
  api: 'color: #44ffff; font-weight: bold;'
};

/**
 * Enhanced renderer logger with colored browser console output
 */
class RendererLogger {
  private scope: string;
  private isDev: boolean;
  
  constructor(scope: string) {
    this.scope = scope;
    this.isDev = process.env.NODE_ENV === 'development';
  }
  
  /**
   * Log with both electron-log (for main process) and browser console (for colors)
   */
  private logWithColor(level: string, message: string, ...args: any[]) {
    // Always send to main process via electron-log
    const electronLogger = log.scope(this.scope);
    electronLogger[level as keyof typeof electronLogger](message, ...args);
    
    // In development, also log to browser console with colors
    if (this.isDev && typeof window !== 'undefined') {
      const timestamp = new Date().toLocaleTimeString();
      const scopeStyle = CONSOLE_STYLES[this.scope as keyof typeof CONSOLE_STYLES] || CONSOLE_STYLES.renderer;
      const levelStyle = CONSOLE_STYLES[level as keyof typeof CONSOLE_STYLES] || '';
      
      const styledMessage = `%c🎨 [${timestamp}] %c[${this.scope.toUpperCase()}] %c[${level.toUpperCase()}] %c${message}`;
      
      console.log(
        styledMessage,
        'color: #666;',           // timestamp
        scopeStyle,               // scope
        levelStyle,               // level
        'color: inherit;',        // message
        ...args
      );
    }
  }
  
  error(message: string, ...args: any[]) {
    this.logWithColor('error', message, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    this.logWithColor('warn', message, ...args);
  }
  
  info(message: string, ...args: any[]) {
    this.logWithColor('info', message, ...args);
  }
  
  debug(message: string, ...args: any[]) {
    this.logWithColor('debug', message, ...args);
  }
}

/**
 * Configure basic electron-log for IPC transport to main process
 */
log.transports.console.format = '🎨 [{h}:{i}:{s}] [RENDERER] [{level}] {text}';
log.transports.ipc.level = 'info';

// Add renderer context to all logs sent to main process
log.hooks.push((message, transport) => {
  if (transport === log.transports.ipc) {
    message.data.unshift('[RENDERER-PROCESS]');
  }
  return message;
});

// Create enhanced scoped loggers
export const rendererLog = new RendererLogger('renderer');
export const uiLog = new RendererLogger('ui');
export const apiLog = new RendererLogger('api');

export default log;