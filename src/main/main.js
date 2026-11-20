const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, closeDb, getDbPath } = require('./database/db');
const { runMigrationsWithBackup } = require('./database/migrations');
const { registerIpcHandlers } = require('./ipc/registerIpcHandlers');
const { setupAutoUpdater } = require('./updater');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: 'Ca$hManager',
    icon: path.join(__dirname, '../renderer/src/assets/logo.svg'),
    backgroundColor: '#0b0f19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      enableRemoteModule: false,
      spellcheck: false
    }
  });

  // Configuração estrita de Content Security Policy (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:5173 ws://localhost:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com http://localhost:5173; font-src 'self' https://fonts.gstatic.com data: http://localhost:5173; img-src 'self' data: https: http://localhost:5173; connect-src 'self' http://localhost:5173 ws://localhost:5173;"
        ]
      }
    });
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const distPath = path.join(__dirname, '../../dist/renderer/index.html');

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    // Fallback para dev local ou index direto
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Configuração de abertura de links externos no navegador padrão (WhatsApp, etc)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      const { shell } = require('electron');
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        event.preventDefault();
        const { shell } = require('electron');
        shell.openExternal(url);
      }
    }
  });

  // Atalhos de desenvolvedor: F12 ou Ctrl+Shift+I / Cmd+Opt+I para DevTools, F5 / Ctrl+R para recarregar
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i') || (input.meta && input.alt && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r') || (input.meta && input.key.toLowerCase() === 'r')) {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialização da aplicação
app.whenReady().then(() => {
  try {
    console.log('[Main] Inicializando Banco de Dados...');
    const db = initDatabase();
    const dbPath = getDbPath();
    console.log('[Main] Executando Migrations com Backup Automático...');
    runMigrationsWithBackup(db, dbPath);
    console.log('[Main] Registrando IPC Handlers...');
    registerIpcHandlers();
    console.log('[Main] Configurando Auto-Updater...');
    setupAutoUpdater();

    createWindow();
  } catch (error) {
    console.error('[Main Error]: Falha ao iniciar aplicativo:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
