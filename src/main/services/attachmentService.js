const fs = require('fs');
const path = require('path');
const { app, dialog, shell, BrowserWindow } = require('electron');
const { getDb } = require('../database/db');

/**
 * Retorna o diretório base para armazenamento de anexos de documentos
 */
function getAnexosBaseDir() {
  const electron = require('electron');
  const app = electron && electron.app ? electron.app : null;
  const isDev = !app || !app.isPackaged;
  const baseDir = isDev 
    ? path.join(process.cwd(), 'data', 'anexos') 
    : path.join(app.getPath('userData'), 'anexos');

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * Abre a janela de seleção de arquivo do sistema operacional (Windows/Mac/Linux)
 * @returns {Promise<string|null>} Caminho do arquivo selecionado ou null se cancelado
 */
async function selecionarArquivo() {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Selecionar Documento para Anexar',
    properties: ['openFile'],
    filters: [
      { name: 'Documentos e Imagens', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'xlsx', 'xls', 'txt'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

/**
 * Salva um novo anexo copiando-o para a pasta do cliente e registrando no banco
 * @param {number} clienteId
 * @param {string} filePath
 * @returns {object} Registro do anexo salvo
 */
function salvarAnexo(clienteId, filePath) {
  if (!clienteId) {
    throw new Error('ID do cliente é obrigatório para anexar documento.');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Caminho do arquivo inválido ou não informado.');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de origem não encontrado: ${filePath}`);
  }

  const baseDir = getAnexosBaseDir();
  const clienteDir = path.join(baseDir, String(clienteId));
  if (!fs.existsSync(clienteDir)) {
    fs.mkdirSync(clienteDir, { recursive: true });
  }

  const nomeArquivoOriginal = path.basename(filePath);
  const timestamp = Date.now();
  // Sanitiza nome do arquivo para evitar caracteres conflitantes no sistema de arquivos
  const nomeSeguro = `${timestamp}_${nomeArquivoOriginal.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const destino = path.join(clienteDir, nomeSeguro);

  // Copia o arquivo para a pasta segura de anexos
  fs.copyFileSync(filePath, destino);

  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO anexos_clientes (cliente_id, nome_arquivo, caminho_arquivo)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(clienteId, nomeArquivoOriginal, destino);

  return {
    id: result.lastInsertRowid,
    cliente_id: clienteId,
    nome_arquivo: nomeArquivoOriginal,
    caminho_arquivo: destino,
    criado_em: new Date().toISOString()
  };
}

/**
 * Lista todos os documentos anexados de um cliente
 * @param {number} clienteId
 * @returns {Array<object>}
 */
function listarAnexos(clienteId) {
  if (!clienteId) {
    return [];
  }

  const db = getDb();
  return db.prepare(`
    SELECT id, cliente_id, nome_arquivo, caminho_arquivo, criado_em
    FROM anexos_clientes
    WHERE cliente_id = ?
    ORDER BY id DESC
  `).all(clienteId);
}

/**
 * Abre o arquivo utilizando o aplicativo padrão do sistema operacional
 * @param {string} caminhoArquivo
 * @returns {Promise<{ opened: boolean }>}
 */
async function abrirAnexo(caminhoArquivo) {
  if (!caminhoArquivo || typeof caminhoArquivo !== 'string') {
    throw new Error('Caminho do anexo não informado.');
  }

  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error('O arquivo não foi encontrado no disco. Ele pode ter sido movido ou excluído.');
  }

  const erro = await shell.openPath(caminhoArquivo);
  if (erro) {
    throw new Error(`Não foi possível abrir o arquivo: ${erro}`);
  }

  return { opened: true };
}

/**
 * Remove o arquivo do disco e exclui o registro no banco de dados
 * @param {number} id
 * @param {string} [caminhoArquivo]
 * @returns {{ success: boolean }}
 */
function removerAnexo(id, caminhoArquivo = null) {
  if (!id) {
    throw new Error('ID do anexo não informado.');
  }

  const db = getDb();
  let pathExcluir = caminhoArquivo;

  if (!pathExcluir) {
    const anexo = db.prepare('SELECT caminho_arquivo FROM anexos_clientes WHERE id = ?').get(id);
    if (anexo) {
      pathExcluir = anexo.caminho_arquivo;
    }
  }

  if (pathExcluir && fs.existsSync(pathExcluir)) {
    try {
      fs.unlinkSync(pathExcluir);
    } catch (err) {
      console.warn(`[attachmentService] Aviso: Não foi possível apagar o arquivo físico "${pathExcluir}":`, err.message);
    }
  }

  const result = db.prepare('DELETE FROM anexos_clientes WHERE id = ?').run(id);

  return {
    success: result.changes > 0
  };
}

module.exports = {
  selecionarArquivo,
  salvarAnexo,
  listarAnexos,
  abrirAnexo,
  removerAnexo
};
