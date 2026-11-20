const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

let dbInstance = null;
let currentDbPath = null;

/**
 * Obtém a chave de criptografia padrão ou configurada via variável de ambiente
 */
function getEncryptionKey() {
  return process.env.DB_ENCRYPTION_KEY || 'app-financeiro-default-key-v1';
}

/**
 * Inicializa a conexão com o banco de dados SQLite com criptografia
 * @param {string} [customPath] Caminho customizado para o arquivo de banco
 * @returns {Database.Database}
 */
function initDatabase(customPath = null) {
  if (dbInstance && (!customPath || customPath === currentDbPath)) {
    return dbInstance;
  }

  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }

  let dbPath = customPath;
  if (!dbPath) {
    const { app } = require('electron');
    const isDev = !app.isPackaged;
    if (isDev) {
      const devDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(devDir)) {
        fs.mkdirSync(devDir, { recursive: true });
      }
      dbPath = path.join(devDir, 'financeiro.db');
    } else {
      const userDataDir = app.getPath('userData');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      dbPath = path.join(userDataDir, 'financeiro.db');
    }
  } else {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  currentDbPath = dbPath;

  const db = new Database(dbPath, {
    verbose: process.env.DB_DEBUG === 'true' ? console.log : null
  });

  // Configuração de Criptografia SQLCipher / multiple-ciphers
  const encryptionKey = getEncryptionKey();
  if (encryptionKey) {
    db.pragma(`key = '${encryptionKey.replace(/'/g, "''")}'`);
  }

  // Pragmas de performance, integridade e integridade referencial
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  dbInstance = db;
  return dbInstance;
}

/**
 * Retorna a instância ativa do banco de dados
 * @returns {Database.Database}
 */
function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

/**
 * Fecha a conexão ativa com o banco de dados
 */
function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Retorna o caminho atual do arquivo do banco de dados
 * @returns {string|null}
 */
function getDbPath() {
  return currentDbPath;
}

module.exports = {
  initDatabase,
  getDb,
  closeDb,
  getDbPath,
  getEncryptionKey
};
