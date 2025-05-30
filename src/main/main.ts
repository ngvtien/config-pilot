import { app, BrowserWindow, screen, nativeTheme } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupIpcHandlers } from './ipc-handlers.js';
import waitOn from 'wait-on';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

// ES Modules compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(__dirname)

const config = new Store<{ windowState: WindowState }>({
  name: 'window-state',
  defaults: {
    windowState: {
      width: 1200,
      height: 900,
      isMaximized: false
    }
  }
});

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
    isMaximized: savedState.isMaximized
  };
}

async function createWindow() {
  const windowState = getValidWindowState();

  mainWindow = new BrowserWindow({
    ...windowState,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});