const { ipcMain, dialog, BrowserWindow } = require('electron');
const authService = require('../services/authService');
const clientService = require('../services/clientService');
const loanService = require('../services/loanService');
const installmentService = require('../services/installmentService');
const cashflowService = require('../services/cashflowService');
const dashboardService = require('../services/dashboardService');
const backupService = require('../services/backupService');
const attachmentService = require('../services/attachmentService');
const updater = require('../updater');

/**
 * Função utilitária para capturar e formatar erros de IPC de forma consistente
 */
function handleSafe(handler) {
  return async (event, ...args) => {
    try {
      const data = await handler(event, ...args);
      return { success: true, data };
    } catch (error) {
      console.error('[IPC Error]:', error);
      return { success: false, error: error.message || 'Ocorreu um erro interno.' };
    }
  };
}

/**
 * Registra todos os IPC Handlers no processo principal
 */
function registerIpcHandlers() {
  // ================= 1. AUTENTICAÇÃO E PIN =================
  ipcMain.handle('auth:verificarPinConfigurado', handleSafe(() => {
    return authService.verificarPinConfigurado();
  }));

  ipcMain.handle('auth:cadastrarPin', handleSafe((event, pin) => {
    return authService.cadastrarPin(pin);
  }));

  ipcMain.handle('auth:autenticarPin', handleSafe((event, pin) => {
    return authService.autenticarPin(pin);
  }));

  ipcMain.handle('auth:obterConfiguracoes', handleSafe(() => {
    return authService.obterConfiguracoes();
  }));

  ipcMain.handle('auth:atualizarChavePix', handleSafe((event, chavePix) => {
    return authService.atualizarChavePix(chavePix);
  }));

  // ================= 2. CLIENTES =================
  ipcMain.handle('clientes:listar', handleSafe((event, filtros) => {
    return clientService.listarClientes(filtros);
  }));

  ipcMain.handle('clientes:obterPorId', handleSafe((event, id) => {
    return clientService.obterClientePorId(id);
  }));

  ipcMain.handle('clientes:criar', handleSafe((event, dados) => {
    return clientService.criarCliente(dados);
  }));

  ipcMain.handle('clientes:atualizar', handleSafe((event, id, dados) => {
    return clientService.atualizarCliente(id, dados);
  }));

  ipcMain.handle('clientes:remover', handleSafe((event, id) => {
    return clientService.removerCliente(id);
  }));

  // ================= 3. EMPRÉSTIMOS =================
  ipcMain.handle('emprestimos:criar', handleSafe((event, dados) => {
    return loanService.criarEmprestimo(dados);
  }));

  ipcMain.handle('emprestimos:listar', handleSafe((event, filtros) => {
    return loanService.listarEmprestimos(filtros);
  }));

  ipcMain.handle('emprestimos:obterDetalhes', handleSafe((event, id) => {
    return loanService.obterDetalhesEmprestimo(id);
  }));

  ipcMain.handle('emprestimos:pagamentoEspecial', handleSafe((event, ...args) => {
    let dados = {};
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      dados = args[0];
    } else {
      const [emprestimoId, valorPago, tipoPagamento, dataPagamento, observacao] = args;
      dados = { emprestimoId, valorPago, tipoPagamento, dataPagamento, observacao };
    }

    return installmentService.registrarPagamentoEspecial(
      dados.emprestimoId || dados.emprestimo_id,
      dados.valorPago || dados.valor_pago || dados.valor,
      dados.tipoPagamento || dados.tipo_pagamento || dados.tipo,
      dados.dataPagamento || dados.data_pagamento || dados.data,
      dados.observacao
    );
  }));

  // ================= 4. PARCELAS =================
  ipcMain.handle('parcelas:darBaixa', handleSafe((event, parcelaId, dataPagamento) => {
    return installmentService.darBaixaParcela(parcelaId, dataPagamento);
  }));

  ipcMain.handle('parcelas:listar', handleSafe((event, filtros) => {
    return installmentService.listarParcelas(filtros);
  }));

  // ================= 5. FLUXO DE CAIXA =================
  ipcMain.handle('caixa:obterSaldo', handleSafe(() => {
    return cashflowService.obterSaldoAtual();
  }));

  ipcMain.handle('caixa:obterExtrato', handleSafe((event, filtros) => {
    return cashflowService.obterExtratoCaixa(filtros);
  }));

  ipcMain.handle('caixa:registrarMovimentacao', handleSafe((event, dados) => {
    return cashflowService.registrarMovimentacao(
      dados.tipo,
      dados.valor,
      dados.descricao,
      dados.data,
      dados.origemId
    );
  }));

  // ================= 6. DASHBOARD =================
  ipcMain.handle('dashboard:obterResumo', handleSafe(() => {
    return dashboardService.obterResumoDashboard();
  }));

  // ================= 7. BACKUP, RESTAURAÇÃO E EXPORTAÇÃO CSV =================

  // Backup portável SQLite (descriptografado, abrível em editores externos)
  ipcMain.handle('backup:gerarBackup', handleSafe(async () => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const dataAtual = new Date().toISOString().split('T')[0];
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Backup Portável — SQLite Padrão (Legível)',
      defaultPath: `cashmanager_backup_${dataAtual}.sqlite`,
      filters: [
        { name: 'Banco de Dados SQLite Padrão', extensions: ['sqlite'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { cancelado: true };
    }

    return backupService.gerarBackupBanco(filePath);
  }));

  // Backup interno criptografado (formato interno do app — para restauração)
  ipcMain.handle('backup:gerarBackupCriptografado', handleSafe(async () => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const dataAtual = new Date().toISOString().split('T')[0];
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Backup Interno — Criptografado (Para Restauração)',
      defaultPath: `cashmanager_backup_seguro_${dataAtual}.db`,
      filters: [
        { name: 'Banco Ca$hManager (.db)', extensions: ['db'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { cancelado: true };
    }

    return backupService.gerarBackupCriptografado(filePath);
  }));

  ipcMain.handle('backup:restaurarBackup', handleSafe(async () => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Arquivo de Backup para Restauração',
      properties: ['openFile'],
      filters: [
        { name: 'Banco de Dados SQLite', extensions: ['sqlite', 'db'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { cancelado: true };
    }

    return backupService.restaurarBackupBanco(filePaths[0]);
  }));

  ipcMain.handle('backup:exportarCSV', handleSafe(async (event, nomeTabela) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const dataAtual = new Date().toISOString().split('T')[0];
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: `Exportar Relatório CSV - ${nomeTabela}`,
      defaultPath: `relatorio_${nomeTabela}_${dataAtual}.csv`,
      filters: [
        { name: 'Arquivo CSV', extensions: ['csv'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { cancelado: true };
    }

    return backupService.exportarTabelaCSV(nomeTabela, filePath);
  }));

  // ================= 8. AUTO-UPDATER =================
  ipcMain.handle('updater:verificar', handleSafe(async () => {
    return await updater.verificarAtualizacao();
  }));

  ipcMain.handle('updater:baixar', handleSafe(async () => {
    return await updater.baixarAtualizacao();
  }));

  ipcMain.handle('updater:instalar', handleSafe(() => {
    updater.instalarAtualizacao();
    return { success: true };
  }));

  ipcMain.handle('updater:obterStatus', handleSafe(() => {
    return updater.getUpdateStatus();
  }));

  // ================= 9. SHELL / LINKS EXTERNOS =================
  ipcMain.handle('shell:openExternal', handleSafe(async (event, url) => {
    if (!url || typeof url !== 'string') {
      throw new Error('URL inválida.');
    }
    const { shell } = require('electron');
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      await shell.openExternal(url);
      return { opened: true };
    }
    throw new Error('Protocolo não permitido para abertura externa.');
  }));

  // ================= 10. ANEXOS DE DOCUMENTOS =================
  ipcMain.handle('anexos:selecionar', handleSafe(async () => {
    return attachmentService.selecionarArquivo();
  }));

  ipcMain.handle('anexos:salvar', handleSafe(async (event, dados) => {
    let clienteId, filePath;
    if (dados && typeof dados === 'object') {
      clienteId = dados.clienteId || dados.cliente_id;
      filePath = dados.filePath || dados.caminhoArquivo || dados.caminho_arquivo;
    }
    return attachmentService.salvarAnexo(clienteId, filePath);
  }));

  ipcMain.handle('anexos:listar', handleSafe(async (event, clienteId) => {
    return attachmentService.listarAnexos(clienteId);
  }));

  ipcMain.handle('anexos:abrir', handleSafe(async (event, caminhoArquivo) => {
    return attachmentService.abrirAnexo(caminhoArquivo);
  }));

  ipcMain.handle('anexos:remover', handleSafe(async (event, id, caminhoArquivo) => {
    return attachmentService.removerAnexo(id, caminhoArquivo);
  }));
}

module.exports = {
  registerIpcHandlers
};
