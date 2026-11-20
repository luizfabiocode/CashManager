const { autoUpdater } = require('electron-updater');
const { BrowserWindow } = require('electron');

let updateStatus = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  info: null,
  error: null
};

/**
 * Envia eventos de atualização para a janela do renderer
 */
function enviarStatusRenderer(canal, dados) {
  const janelas = BrowserWindow.getAllWindows();
  janelas.forEach(janela => {
    if (!janela.isDestroyed()) {
      janela.webContents.send(canal, dados);
    }
  });
}

/**
 * Inicializa os listeners do Auto-Updater
 */
function setupAutoUpdater() {
  // Desativa download automático para permitir controle pelo usuário
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateStatus = { ...updateStatus, checking: true, error: null };
    enviarStatusRenderer('updater:status', updateStatus);
  });

  autoUpdater.on('update-available', (info) => {
    updateStatus = {
      checking: false,
      available: true,
      downloading: false,
      downloaded: false,
      info,
      error: null
    };
    enviarStatusRenderer('updater:status', updateStatus);
  });

  autoUpdater.on('update-not-available', (info) => {
    updateStatus = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      info,
      error: null
    };
    enviarStatusRenderer('updater:status', updateStatus);
  });

  autoUpdater.on('error', (err) => {
    updateStatus = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      info: null,
      error: err ? err.message : 'Erro desconhecido ao verificar atualização.'
    };
    enviarStatusRenderer('updater:status', updateStatus);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    updateStatus = {
      ...updateStatus,
      downloading: true,
      progresso: {
        percentual: Math.round(progressObj.percent),
        velocidade: progressObj.bytesPerSecond,
        transferido: progressObj.transferred,
        total: progressObj.total
      }
    };
    enviarStatusRenderer('updater:progresso', updateStatus.progresso);
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateStatus = {
      ...updateStatus,
      downloading: false,
      downloaded: true,
      info
    };
    enviarStatusRenderer('updater:status', updateStatus);
  });
}

/**
 * Dispara a verificação manual de atualizações
 */
async function verificarAtualizacao() {
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      success: true,
      result: result ? result.updateInfo : null,
      status: updateStatus
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: updateStatus
    };
  }
}

/**
 * Inicia o download da atualização disponível
 */
async function baixarAtualizacao() {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Instala a atualização e reinicia o aplicativo
 */
function instalarAtualizacao() {
  autoUpdater.quitAndInstall();
}

module.exports = {
  setupAutoUpdater,
  verificarAtualizacao,
  baixarAtualizacao,
  instalarAtualizacao,
  getUpdateStatus: () => updateStatus
};
