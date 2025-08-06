import { app, BrowserWindow, nativeTheme, screen, session, ipcMain, shell } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { initializeSchemaHandlers, setupIpcHandlers, registerProductComponentHandlers, registerUnifiedGitHandlers } from './ipc-handlers';
import waitOn from 'wait-on';
import { initK8sService } from './k8s-service-client';
import { templateManager } from './template-manager';
import { CustomerService } from './services/customer-service';
import { ProductService } from './services/product-service'
import { gitService } from './services/git-service';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const store = new Store() as any;

const config = new Store<{ windowState: WindowState }>({
  name: 'window-state',
  defaults: {
    windowState: {
      width: 1200,
      height: 900,
      isMaximized: false
    }
  }
}) as any;

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow;
let splashWindow: BrowserWindow | null = null;

function getValidWindowState(): WindowState {
  const savedState = config.get('windowState');
  const displays = screen.getAllDisplays();

  // If no position saved or single display, return basic dimensions
  if (!savedState.x || !savedState.y || displays.length === 1) {
    return {
      width: savedState.width,
      height: savedState.height,
      x: savedState.x,
      y: savedState.y,
      isMaximized: savedState.isMaximized
    };
  }

  // Check if window fits within any display
  const isVisible = displays.some(display => {
    const { x, y, width, height } = display.bounds;
    return (
      savedState.x! >= x &&
      savedState.y! >= y &&
      savedState.x! + savedState.width <= x + width &&
      savedState.y! + savedState.height <= y + height
    );
  });

  return isVisible ? savedState : {
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    isMaximized: savedState.isMaximized
  };
}

/**
 * Creates and shows the splash screen window
 */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 380,  // Reduced from 450
    height: 280, // Reduced from 350
    frame: false,
    alwaysOnTop: true,
    transparent: true,  // Changed from false to true
    // backgroundColor: '#0a0a0a',  // Removed - let the HTML handle background
    resizable: false,
    center: true,
    show: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load splash screen with corrected path
  const splashPath = isDev
    ? path.join(__dirname, '../../public/splash.html')
    : path.join(__dirname, '../dist-react/splash.html');

  console.log('Loading splash from:', splashPath);

  splashWindow.loadFile(splashPath)
    .then(() => {
      console.log('Splash screen loaded successfully');
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.focus();
      }
    })
    .catch((error) => {
      console.error('Failed to load splash screen:', error);
      // Create a transparent fallback splash
      splashWindow?.loadURL('data:text/html,<html><body style="background:rgba(10,10,10,0.95);color:white;display:flex;align-items:center;justify-content:center;font-family:Arial;font-size:24px;border-radius:12px;margin:10px;">Loading ConfigPilot...</body></html>');
    });

  // Single event handler for content loading
  splashWindow.webContents.on('did-finish-load', () => {
    console.log('Splash screen content loaded');
  });

  // Error handling
  splashWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Splash screen failed to load:', errorCode, errorDescription);
  });
}

/**
 * Updates splash screen status and waits for acknowledgment
 */
function updateSplashStatusAsync(status: string): Promise<void> {
  return new Promise((resolve) => {
    console.log('Splash status:', status);

    if (splashWindow && !splashWindow.isDestroyed()) {
      // Set up one-time listener for acknowledgment
      const handleAck = () => {
        ipcMain.removeListener('splash-status-received', handleAck);
        resolve();
      };
      ipcMain.once('splash-status-received', handleAck);

      // Send the status message
      const sendMessage = () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.webContents.send('splash-status', status);

          // Fallback timeout in case acknowledgment is never received
          setTimeout(() => {
            ipcMain.removeListener('splash-status-received', handleAck);
            resolve();
          }, 1000); // 1 second fallback
        } else {
          resolve();
        }
      };

      if (splashWindow.webContents.isLoading()) {
        splashWindow.webContents.once('did-finish-load', sendMessage);
      } else {
        // Small delay to ensure JavaScript is initialized
        setTimeout(sendMessage, 50);
      }
    } else {
      resolve();
    }
  });
}

/**
 * Waits for splash screen to be fully loaded and ready
 */
function waitForSplashReady(): Promise<void> {
  return new Promise((resolve) => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      if (splashWindow.webContents.isLoading()) {
        splashWindow.webContents.once('did-finish-load', () => {
          // Give splash screen time to initialize its JavaScript
          setTimeout(resolve, 100);
        });
      } else {
        setTimeout(resolve, 50);
      }
    } else {
      resolve();
    }
  });
}

/**
 * Closes splash window and shows main window
 */
function closeSplashAndShowMain() {
  console.log('Closing splash and showing main window');

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

async function createWindow() {
  await updateSplashStatusAsync('Creating main window...');

  const windowState = getValidWindowState();

  mainWindow = new BrowserWindow({
    ...windowState,
    show: false, // Keep hidden until ready
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      sandbox: true,
      contextIsolation: true
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Window state persistence
  const saveState = () => {
    if (!mainWindow) return;

    const bounds = mainWindow.getBounds();
    config.set('windowState', {
      ...bounds,
      isMaximized: mainWindow.isMaximized()
    });
  };

  const debounce = (fn: () => void, ms = 500) => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(fn, ms);
    };
  };

  const debouncedSave = debounce(saveState);
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', saveState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' } // Prevent opening in Electron
    }
    return { action: 'allow' } // Allow internal navigation
  })

// Load app with better error handling
  try {
    if (isDev) {
      await updateSplashStatusAsync('Starting development server...');
      console.log('Waiting for development server at http://localhost:5125');
      await waitOn({
        resources: ['http://localhost:5125'],
        delay: 1000,
        interval: 100,
        timeout: 10000
      });
      console.log('Development server is ready');

      await updateSplashStatusAsync('Loading application...');
      
      // Add more granular status updates during the loading phase
      setTimeout(async () => {
        await updateSplashStatusAsync('Connecting to React app...');
      }, 500);
      
      setTimeout(async () => {
        await updateSplashStatusAsync('Initializing UI components...');
      }, 1500);
      
      setTimeout(async () => {
        await updateSplashStatusAsync('Loading application data...');
      }, 3000);
      
      await mainWindow.loadURL('http://localhost:5125');
      console.log('Main window URL loaded');

      // More status updates during rendering
      await updateSplashStatusAsync('Rendering interface...');
      
      setTimeout(async () => {
        await updateSplashStatusAsync('Finalizing setup...');
      }, 200);
      
      setTimeout(async () => {
        await updateSplashStatusAsync('Application ready!');
        setTimeout(() => {
          closeSplashAndShowMain();
        }, 300);
      }, 700);

    } else {
      await updateSplashStatusAsync('Loading application...');
      
      // Add status updates for production build too
      setTimeout(async () => {
        await updateSplashStatusAsync('Loading application bundle...');
      }, 200);
      
      setTimeout(async () => {
        await updateSplashStatusAsync('Initializing components...');
      }, 800);
      
      await mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
      
      await updateSplashStatusAsync('Rendering interface...');
      
      setTimeout(async () => {
        await updateSplashStatusAsync('Application ready!');
        setTimeout(() => {
          closeSplashAndShowMain();
        }, 300);
      }, 500);
    }
  } catch (err) {
    console.error('Failed to load main application:', err);
    await updateSplashStatusAsync('Loading fallback...');
    await mainWindow.loadFile(path.join(__dirname, '../renderer/fallback.html'));
    
    // Even for fallback, provide status feedback
    setTimeout(async () => {
      await updateSplashStatusAsync('Fallback loaded - opening app...');
      setTimeout(() => {
        closeSplashAndShowMain();
      }, 500);
    }, 1000);
  }

  // Simplified backup handlers (since we now have manual control)
  let splashClosed = false;

  const closeSplashOnce = async () => {
    if (!splashClosed) {
      splashClosed = true;
      console.log('Backup: Closing splash screen - app is ready');
      closeSplashAndShowMain();
    }
  };

  // Reduced timeout as final safety net
  setTimeout(async () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      console.warn('⚠️ Final safety net: Force closing splash after 8 seconds');
      await updateSplashStatusAsync('Opening application...');
      closeSplashAndShowMain();
    }
  }, 8000);

  // Backup event handlers (in case the manual close fails)
  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('Backup: Main window finished loading');
    setTimeout(async () => {
      await closeSplashOnce();
    }, 500);
  });

  // Reduced timeout as final fallback
  setTimeout(async () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      console.warn('⚠️ Final fallback: Splash screen timeout after 5 seconds');
      await updateSplashStatusAsync('Timeout - opening application...');
      closeSplashAndShowMain();
    }
  }, 5000);

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('system-theme-changed', nativeTheme.shouldUseDarkColors);
  });
}

// Move splash creation to app 'ready' event instead of 'whenReady'
app.on('ready', () => {
  console.log('App ready - showing splash immediately');
  createSplashWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(async () => {
  console.log('Electron app ready, creating splash screen...');
  const appStartTime = Date.now();

  // Wait for splash to be fully ready
  const splashStartTime = Date.now();
  await waitForSplashReady();
  console.log(`⏱️ Splash ready time: ${Date.now() - splashStartTime}ms`);

  await updateSplashStatusAsync('Initializing services...');

  const savedConfigPath = store.get('kubeConfigPath') as string | undefined;

  // Phase 1: Setup IPC handlers immediately (no dependencies)
  const ipcStartTime = Date.now();
  setupIpcHandlers();
  initializeSchemaHandlers();
  registerUnifiedGitHandlers();
  registerProductComponentHandlers();
  setupWindowHandlers();
  console.log(`⏱️ IPC handlers setup time: ${Date.now() - ipcStartTime}ms`);

  // Phase 2: Parallel initialization of independent services with timing
  await updateSplashStatusAsync('Loading core services...');
  const coreServicesStartTime = Date.now();

  const [templateResult, customerResult, productResult] = await Promise.allSettled([
    // Template service initialization with timing
    (async () => {
      const start = Date.now();
      try {
        const result = await templateManager.initialize();
        console.log(`⏱️ ✅ Template service: ${Date.now() - start}ms`);
        return result;
      } catch (error) {
        console.log(`⏱️ ❌ Template service failed: ${Date.now() - start}ms`);
        throw error;
      }
    })(),

    // Customer service initialization with timing
    (async () => {
      const start = Date.now();
      try {
        const result = await CustomerService.initialize();
        console.log(`⏱️ ✅ Customer service: ${Date.now() - start}ms`);
        return result;
      } catch (error) {
        console.log(`⏱️ ❌ Customer service failed: ${Date.now() - start}ms`);
        throw error;
      }
    })(),

    // Product service initialization with timing
    (async () => {
      const start = Date.now();
      try {
        const result = await ProductService.initialize();
        console.log(`⏱️ ✅ Product service: ${Date.now() - start}ms`);
        return result;
      } catch (error) {
        console.log(`⏱️ ❌ Product service failed: ${Date.now() - start}ms`);
        throw error;
      }
    })()
  ]);

  console.log(`⏱️ Core services parallel time: ${Date.now() - coreServicesStartTime}ms`);

  // Handle any initialization failures
  [templateResult, customerResult, productResult].forEach((result, index) => {
    const serviceName = ['Template', 'Customer', 'Product'][index];
    if (result.status === 'rejected') {
      console.error(`❌ ${serviceName} service failed to initialize:`, result.reason);
    } else {
      console.log(`✅ ${serviceName} service initialized successfully`);
    }
  });

  // Phase 3: Git services configuration (can run in parallel with K8s)
  await updateSplashStatusAsync('Configuring services...');
  const configServicesStartTime = Date.now();

  const [gitConfigResult, k8sInitResult] = await Promise.allSettled([
    // Git services configuration with timing
    (async () => {
      const start = Date.now();
      try {
        console.log('=== GIT SERVERS STARTUP LOGGING ===');
        const allServers = gitService.getServers();
        console.log(`Total Git servers found: ${allServers.length}`);

        if (allServers.length === 0) {
          console.log('❌ NO GIT SERVERS CONFIGURED!');
        } else {
          allServers.forEach((server, index) => {
            console.log(`\n📡 Server ${index + 1}:`);
            console.log(`  - ID: ${server.id}`);
            console.log(`  - Base URL: ${server.baseUrl}`);
            console.log(`  - Provider: ${server.provider}`);
            console.log(`  - Name: ${server.name || 'N/A'}`);
            console.log(`  - Created: ${server.createdAt}`);
            console.log(`  - Updated: ${server.updatedAt}`);
          });
        }
        console.log('=== END GIT SERVERS LOGGING ===\n');
        console.log(`⏱️ ✅ Git configuration: ${Date.now() - start}ms`);
      } catch (error) {
        console.log(`⏱️ ❌ Git configuration failed: ${Date.now() - start}ms`);
        console.error('❌ Error listing Git servers:', error);
        throw error;
      }
    })(),

    // Kubernetes service initialization with timing
    (async () => {
      const start = Date.now();
      try {
        const result = await initK8sService(savedConfigPath);
        console.log(`⏱️ ✅ Kubernetes service: ${Date.now() - start}ms`);
        return result;
      } catch (error) {
        console.log(`⏱️ ❌ Kubernetes service failed: ${Date.now() - start}ms`);
        throw error;
      }
    })()
  ]);

  console.log(`⏱️ Config services parallel time: ${Date.now() - configServicesStartTime}ms`);

  // Handle service configuration results
  if (gitConfigResult.status === 'rejected') {
    console.error('❌ Git configuration failed:', gitConfigResult.reason);
  }
  if (k8sInitResult.status === 'rejected') {
    console.error('❌ Kubernetes initialization failed:', k8sInitResult.reason);
  }

  const windowStartTime = Date.now();
  await updateSplashStatusAsync('Creating main window...');
  createWindow();
  console.log(`⏱️ Window creation time: ${Date.now() - windowStartTime}ms`);

  console.log(`🏁 TOTAL APP STARTUP TIME: ${Date.now() - appStartTime}ms`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

/**
 * Setup window control handlers - extracted for better organization
 */
function setupWindowHandlers() {
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window:unmaximize', () => {
    if (mainWindow) mainWindow.unmaximize();
  });

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.on('window:setTitle', (_event, title: string) => {
    if (mainWindow) {
      mainWindow.setTitle(title);
    }
  });
}