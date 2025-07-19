import { app, BrowserWindow, nativeTheme, screen, session, ipcMain } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { initializeSchemaHandlers, setupIpcHandlers } from './ipc-handlers';
import waitOn from 'wait-on';
import { initK8sService } from './k8s-service-client';
import { templateManager } from './template-manager';
import { CustomerService } from './services/customer-service';
import { ProductService } from './services/product-service'

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

async function createWindow() {
  const windowState = getValidWindowState();

  mainWindow = new BrowserWindow({
    ...windowState,
    show: false,
    //icon: path.join(__dirname, '..', 'assets', 'logo.png'),
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

  // Load app
  if (isDev) {
    try {
      await waitOn({ resources: ['http://localhost:5125'], timeout: 20000 });
      await mainWindow.loadURL('http://localhost:5125');
      mainWindow.show();
    } catch (err) {
      console.error('Dev server not ready:', err);
      await mainWindow.loadFile(path.join(__dirname, '../renderer/fallback.html'));
      mainWindow.show();
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.prod.html'));
    mainWindow.show();
  }

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('system-theme-changed', nativeTheme.shouldUseDarkColors);
  });

}

app.whenReady().then(async () => {
  const savedConfigPath = store.get('kubeConfigPath') as string | undefined;
  setupIpcHandlers();
  initializeSchemaHandlers();

  // template service initialization
  await templateManager.initialize();

  // customer service initialization
  await CustomerService.initialize();

  // product service initializatoin
  await ProductService.initialize();

  // Add window control handlers
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

  initK8sService(savedConfigPath)
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});