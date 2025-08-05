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
    width: 450,
    height: 350,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#0a0a0a',
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
      // Create a simple fallback splash
      splashWindow?.loadURL('data:text/html,<html><body style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;font-family:Arial;font-size:24px;">Loading ConfigPilot...</body></html>');
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
      await waitOn({ resources: ['http://localhost:5125'], delay: 1000, interval: 100, timeout: 30000 }); // Increased timeout
      await updateSplashStatusAsync('Loading application...');
      await mainWindow.loadURL('http://localhost:5125');
    } else {
      await updateSplashStatusAsync('Loading application...');
      // await mainWindow.loadFile(path.join(__dirname, '../renderer/index.prod.html'));
      await mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
    }
  } catch (err) {
    console.error('Failed to load main application:', err);
    await updateSplashStatusAsync('Loading fallback...');
    await mainWindow.loadFile(path.join(__dirname, '../renderer/fallback.html'));
  }

  // Multiple event handlers to ensure splash closes
  let splashClosed = false;
  
  const closeSplashOnce = async () => {
    if (!splashClosed) {
      splashClosed = true;
      await updateSplashStatusAsync('Application ready!');
      setTimeout(() => {
        closeSplashAndShowMain();
      }, 500);
    }
  };

  // Simplified event handling - just use did-finish-load
  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('Main window finished loading');
    await closeSplashOnce(); // Call closeSplashOnce instead of just updating status
  });

  // Reduced timeout and better error handling
  setTimeout(async() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      console.warn('Splash screen timeout - forcing close after 15 seconds');
      await updateSplashStatusAsync('Timeout - opening application...');
      closeSplashAndShowMain(); // Actually close the splash and show main window
    }
  }, 15000); // 15 second timeout

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('system-theme-changed', nativeTheme.shouldUseDarkColors);
  });
}

// Move splash creation to app 'ready' event instead of 'whenReady'
app.on('ready', () => {
  console.log('App ready - showing splash immediately');
  createSplashWindow();
});

app.whenReady().then(async () => {
  console.log('Electron app ready, creating splash screen...');

  // Wait for splash to be fully ready
  await waitForSplashReady();

  await updateSplashStatusAsync('Initializing services...');

  const savedConfigPath = store.get('kubeConfigPath') as string | undefined;
  setupIpcHandlers();
  initializeSchemaHandlers();
  registerUnifiedGitHandlers();
  registerProductComponentHandlers();

  // template service initialization
  await updateSplashStatusAsync('Loading templates...');
  await templateManager.initialize();

  // customer service initialization
  await updateSplashStatusAsync('Initializing customer service...');
  await CustomerService.initialize();

  // product service initialization
  await updateSplashStatusAsync('Initializing product service...');
  await ProductService.initialize();

  await updateSplashStatusAsync('Configuring Git services...');
  console.log('=== GIT SERVERS STARTUP LOGGING ===');
  try {
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
  } catch (error) {
    console.error('❌ Error listing Git servers:', error);
  }
  console.log('=== END GIT SERVERS LOGGING ===\n');

  // Add window control handlers
  await updateSplashStatusAsync('Setting up window handlers...');
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

  // Add new setTitle handler
  ipcMain.on('window:setTitle', (_event, title: string) => {
    if (mainWindow) {
      mainWindow.setTitle(title);
    }
  });

  await updateSplashStatusAsync('Initializing Kubernetes service...');
  initK8sService(savedConfigPath)

  await updateSplashStatusAsync('Creating main window...');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});