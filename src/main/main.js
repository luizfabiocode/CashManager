const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, closeDb, getDbPath } = require('./database/db');
const { runMigrationsWithBackup } = require('./database/migrations');
const { registerIpcHandlers } = require('./ipc/registerIpcHandlers');
const { setupAutoUpdater } = require('./updater');

// Permite carregamento de módulos e arquivos locais no protocolo file://
app.commandLine.appendSwitch('allow-file-access-from-files');

function logApp(message, error = null) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}`;
  if (error) {
    console.error(logMsg, error);
  } else {
    console.log(logMsg);
  }
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    const logFile = path.join(userData, 'app.log');
    fs.appendFileSync(logFile, `${logMsg}${error ? ' ' + (error.stack || error) : ''}\n`);
  } catch (e) {}
}

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, '../renderer/src/assets/logo.svg');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: 'Ca$hManager',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    backgroundColor: '#0b0f19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: false // Libera carregamento de módulos locais via file://
    }
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
    const exists = fs.existsSync(indexPath);
    logApp(`[Main] Modo Produção Detectado. Caminho: ${indexPath} | Arquivo Existe: ${exists}`);

    mainWindow.loadFile(indexPath).catch(err => {
      logApp('[Main Error] Erro ao carregar index.html via loadFile:', err);
    });
  }

  // Log de carregamento e falhas no renderer
  mainWindow.webContents.on('did-finish-load', () => {
    logApp('[Main] Página HTML carregada com sucesso (did-finish-load)');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logApp(`[Main Error] Falha de carregamento: ${errorCode} - ${errorDescription} (${validatedURL})`);
  });

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

  // Atalhos de desenvolvedor: F12 para DevTools, F5 para recarregar
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