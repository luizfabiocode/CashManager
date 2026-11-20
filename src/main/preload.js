const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposição segura de APIs para a camada de Renderer via contextBridge
 */
contextBridge.exposeInMainWorld('api', {
  // 1. Autenticação e Configurações
  auth: {
    verificarPinConfigurado: () => ipcRenderer.invoke('auth:verificarPinConfigurado'),
    cadastrarPin: (pin) => ipcRenderer.invoke('auth:cadastrarPin', pin),
    autenticarPin: (pin) => ipcRenderer.invoke('auth:autenticarPin', pin),
    obterConfiguracoes: () => ipcRenderer.invoke('auth:obterConfiguracoes'),
    atualizarChavePix: (chavePix) => ipcRenderer.invoke('auth:atualizarChavePix', chavePix)
  },

  // 2. Clientes
  clientes: {
    listar: (filtros) => ipcRenderer.invoke('clientes:listar', filtros),
    obterPorId: (id) => ipcRenderer.invoke('clientes:obterPorId', id),
    criar: (dados) => ipcRenderer.invoke('clientes:criar', dados),
    atualizar: (id, dados) => ipcRenderer.invoke('clientes:atualizar', id, dados),
    remover: (id) => ipcRenderer.invoke('clientes:remover', id)
  },

  // 3. Empréstimos
  emprestimos: {
    criar: (dados) => ipcRenderer.invoke('emprestimos:criar', dados),
    listar: (filtros) => ipcRenderer.invoke('emprestimos:listar', filtros),
    obterDetalhes: (id) => ipcRenderer.invoke('emprestimos:obterDetalhes', id),
    pagamentoEspecial: (...args) => ipcRenderer.invoke('emprestimos:pagamentoEspecial', ...args)
  },

  // 4. Parcelas
  parcelas: {
    darBaixa: (parcelaId, dataPagamento) => ipcRenderer.invoke('parcelas:darBaixa', parcelaId, dataPagamento),
    listar: (filtros) => ipcRenderer.invoke('parcelas:listar', filtros)
  },

  // 5. Fluxo de Caixa
  caixa: {
    obterSaldo: () => ipcRenderer.invoke('caixa:obterSaldo'),
    obterExtrato: (filtros) => ipcRenderer.invoke('caixa:obterExtrato', filtros),
    registrarMovimentacao: (dados) => ipcRenderer.invoke('caixa:registrarMovimentacao', dados)
  },

  // 6. Dashboard
  dashboard: {
    obterResumo: () => ipcRenderer.invoke('dashboard:obterResumo')
  },

  // 7. Backup e Exportação
  backup: {
    gerarBackup: () => ipcRenderer.invoke('backup:gerarBackup'),
    gerarBackupCriptografado: () => ipcRenderer.invoke('backup:gerarBackupCriptografado'),
    restaurarBackup: () => ipcRenderer.invoke('backup:restaurarBackup'),
    exportarCSV: (nomeTabela) => ipcRenderer.invoke('backup:exportarCSV', nomeTabela)
  },

  // 8. Auto-Updater
  updater: {
    verificar: () => ipcRenderer.invoke('updater:verificar'),
    baixar: () => ipcRenderer.invoke('updater:baixar'),
    instalar: () => ipcRenderer.invoke('updater:instalar'),
    obterStatus: () => ipcRenderer.invoke('updater:obterStatus'),
    onStatus: (callback) => {
      const listener = (event, dados) => callback(dados);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
    onProgresso: (callback) => {
      const listener = (event, progresso) => callback(progresso);
      ipcRenderer.on('updater:progresso', listener);
      return () => ipcRenderer.removeListener('updater:progresso', listener);
    }
  },

  // 9. Shell (Abertura de Links Externos)
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // 10. Anexos de Documentos de Clientes
  anexos: {
    selecionar: () => ipcRenderer.invoke('anexos:selecionar'),
    salvar: (dados) => ipcRenderer.invoke('anexos:salvar', dados),
    listar: (clienteId) => ipcRenderer.invoke('anexos:listar', clienteId),
    abrir: (caminhoArquivo) => ipcRenderer.invoke('anexos:abrir', caminhoArquivo),
    remover: (id, caminhoArquivo) => ipcRenderer.invoke('anexos:remover', id, caminhoArquivo)
  }
});
