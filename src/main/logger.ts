import log from 'electron-log';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { LoggingSettings } from '../shared/types/settings-data';

// ANSI color codes that work reliably in all terminals
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
} as const;

// Log level colors
const LOG_COLORS = {
    error: `${COLORS.red}${COLORS.bright}`,
    warn: `${COLORS.yellow}${COLORS.bright}`,
    info: `${COLORS.blue}`,
    verbose: `${COLORS.cyan}`,
    debug: `${COLORS.gray}`,
    silly: `${COLORS.magenta}`
} as const;

// Process scope colors
const PROCESS_COLORS = {
    main: `${COLORS.green}${COLORS.bright}`,
    service: `${COLORS.blue}${COLORS.bright}`,
    ipc: `${COLORS.magenta}${COLORS.bright}`,
    perf: `${COLORS.yellow}${COLORS.bright}`,
    renderer: `${COLORS.cyan}${COLORS.bright}`
} as const;

/**
 * Update logger configuration based on settings
 */
export function updateLoggerConfig(settings: LoggingSettings): void {
    try {
        // Update log levels
        log.transports.file.level = settings.mainProcessLogLevel;
        log.transports.console.level = settings.enableConsoleLogging ? settings.mainProcessLogLevel : false;

        // Update file logging settings
        if (settings.enableFileLogging) {
            log.transports.file.maxSize = settings.maxLogFileSize * 1024 * 1024; // Convert MB to bytes

            // Set custom log file location if specified
            if (settings.logFileLocation) {
                log.transports.file.resolvePathFn = () => path.join(settings.logFileLocation, 'main.log');
            }
        } else {
            log.transports.file.level = false;
        }

        // Update console formatting based on settings
        if (settings.enableTimestamps || settings.enableProcessLabels || settings.logFormat) {
            log.transports.console.format = (info) => {
                const timestamp = settings.enableTimestamps ? `[${new Date().toISOString()}] ` : '';
                const processLabel = settings.enableProcessLabels ? `[MAIN] ` : '';
                const levelColor = settings.enableColoredOutput ? LOG_COLORS[info.level as keyof typeof LOG_COLORS] || '' : '';
                const resetColor = settings.enableColoredOutput ? COLORS.reset : '';

                const message = `${timestamp}${processLabel}${levelColor}${info.level.toUpperCase()}${resetColor}: ${info.data}`;

                // Return array format as required by electron-log
                return [message];
            };
        } else {
            log.transports.console.format = '{h}:{i}:{s}.{ms} › [{level}] {text}';
        }

        mainLog.info('Logger configuration updated successfully');
    } catch (error) {
        console.error('Failed to update logger configuration:', error);
    }
}

/**
 * Configure electron-log with proper IPC support and colored console output
 */
export function configureLogger() {
    const isDev = !app.isPackaged;
    const userDataPath = app.getPath('userData');
    const logsPath = path.join(userDataPath, 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
    }

    // CRITICAL: Initialize electron-log for IPC communication first
    log.initialize();

    // Configure file transport
    log.transports.file.level = isDev ? 'debug' : 'info';
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.file.resolvePathFn = () => path.join(logsPath, 'main.log');

    // Configure console transport for IPC support (required for renderer communication)
    log.transports.console.level = isDev ? 'debug' : 'info';
    log.transports.console.format = '[{h}:{i}:{s}] [MAIN] [{level}] {text}';

    // Add colored console output hook for development
    if (isDev) {
        log.hooks.push((message, transport) => {
            if (transport === log.transports.console) {
                const level = message.level;
                const text = message.data.join(' ');

                // Extract scope from message if present
                let scope = 'main';
                const scopeMatch = text.match(/\[(\w+)\]/);
                if (scopeMatch) {
                    scope = scopeMatch[1].toLowerCase();
                }

                // Apply colors based on level and scope
                const levelColor = LOG_COLORS[level as keyof typeof LOG_COLORS] || '';
                const scopeColor = PROCESS_COLORS[scope as keyof typeof PROCESS_COLORS] || PROCESS_COLORS.main;

                // Format with colors
                const coloredText = `${scopeColor}[${scope.toUpperCase()}]${COLORS.reset} ${levelColor}[${level.toUpperCase()}]${COLORS.reset} ${text}`;

                // Override the message data for colored output
                message.data = [coloredText];
            }
            return message;
        });
    }
}


/**
 * Performance logger with colored timing output
 */
export class PerformanceLogger {
    private timers = new Map<string, number>();

    /**
     * Start timing an operation
     */
    time(operation: string): void {
        this.timers.set(operation, Date.now());
        log.debug(`[PERF] ⏱️  Started timing: ${operation}`);
    }

    /**
     * End timing and log the duration
     */
    timeEnd(operation: string, metadata?: any): number {
        const startTime = this.timers.get(operation);
        if (!startTime) {
            log.warn(`[PERF] ⚠️  No timer found for operation: ${operation}`);
            return 0;
        }

        const duration = Date.now() - startTime;
        this.timers.delete(operation);

        const message = `[PERF] ✅ ${operation} completed in ${duration}ms`;

        if (metadata) {
            log.info(message, metadata);
        } else {
            log.info(message);
        }

        return duration;
    }
}

/**
 * Scoped logger for different parts of the application
 */
class ScopedLogger {
    private scope: string;

    constructor(scope: string) {
        this.scope = scope;
    }

    error(message: string, ...args: any[]) {
        log.error(`[${this.scope.toUpperCase()}] ${message}`, ...args);
    }

    warn(message: string, ...args: any[]) {
        log.warn(`[${this.scope.toUpperCase()}] ${message}`, ...args);
    }

    info(message: string, ...args: any[]) {
        log.info(`[${this.scope.toUpperCase()}] ${message}`, ...args);
    }

    debug(message: string, ...args: any[]) {
        log.debug(`[${this.scope.toUpperCase()}] ${message}`, ...args);
    }
}

// Export scoped loggers
export const mainLog = new ScopedLogger('main');
export const serviceLog = new ScopedLogger('service');
export const ipcLog = new ScopedLogger('ipc');
export const perfLog = new PerformanceLogger();

export default log;