const fs = require('fs');
const path = require('path');
const { getDb, closeDb, initDatabase, getDbPath, getEncryptionKey } = require('../database/db');
const { runMigrations } = require('../database/migrations');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Verifica os primeiros bytes do arquivo para determinar seu tipo:
 * - 'sqlite'    → banco SQLite padrão, não criptografado (magic header presente)
 * - 'encrypted' → banco SQLite criptografado (SQLCipher / formato interno do app)
 * - 'invalid'   → arquivo inválido, corrompido ou de tipo desconhecido
 *
 * @param {string} filePath
 * @returns {'sqlite'|'encrypted'|'invalid'}
 */
function verificarTipoArquivoSQLite(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 'invalid';
    const stat = fs.statSync(filePath);
    if (stat.size < 100) return 'invalid';

    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    // Magic header do SQLite 3 padrão (não criptografado)
    if (buf.toString('utf8', 0, 16) === 'SQLite format 3\u0000') {
      return 'sqlite';
    }

    // Bancos criptografados pelo SQLCipher não têm o magic header,
    // mas têm tamanho múltiplo de página (512, 1024, 2048, 4096...)
    const pageSizes = [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
    if (stat.size >= 512 && pageSizes.some(ps => stat.size % ps === 0)) {
      return 'encrypted';
    }

    return 'invalid';
  } catch {
    return 'invalid';
  }
}

/**
 * Escapa um valor para o formato CSV (separador ponto-e-vírgula).
 * @param {*} valor
 * @returns {string}
 */
function escaparCSV(valor) {
  if (valor === null || valor === undefined) return '';
  const str = String(valor);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Obtém os nomes das colunas de uma tabela via PRAGMA table_info.
 * Usado quando a tabela está vazia e não há linhas para inspecionar.
 * @param {object} db - Instância do banco
 * @param {string} tabela
 * @returns {string[]}
 */
function obterColunasDaTabela(db, tabela) {
  try {
    const info = db.prepare(`PRAGMA table_info('${tabela}')`).all();
    return info.map(col => col.name);
  } catch {
    return [];
  }
}

/**
 * Normaliza um caminho de arquivo para usar barras forward (/).
 * Necessário para evitar erros de parsing em strings SQL no Windows.
 * @param {string} filePath
 * @returns {string}
 */
function normalizarCaminhoSQL(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * Tenta exportar o banco sem criptografia usando ATTACH + sqlcipher_export.
 *
 * Fluxo:
 *  1. Remove arquivo de destino existente.
 *  2. ATTACH o destino como banco vazio sem cipher (sqlcipher_mem_security OFF + cipher_use_hmac OFF + kdf_iter 0 + KEY '').
 *  3. Executa sqlcipher_export('plaintext') para copiar todos os objetos.
 *  4. DETACH e valida o magic header do arquivo gerado.
 *  5. Em caso de falha, tenta estratégia alternativa via PRAGMA rekey.
 *
 * @param {object} db - Instância better-sqlite3-multiple-ciphers já autenticada
 * @param {string} destino - Caminho absoluto do arquivo .sqlite de saída
 * @returns {boolean} true se o arquivo gerado for um SQLite padrão válido
 */
function tentarExportarDescriptografado(db, destino) {
  // Normaliza o path para forward slashes (evita falhas de parsing SQL no Windows)
  const destinoSQL = normalizarCaminhoSQL(destino);
  const destinoEscapado = destinoSQL.replace(/'/g, "''");

  // ── Estratégia A: ATTACH + sqlcipher_export ────────────────────────────────
  try {
    if (fs.existsSync(destino)) fs.unlinkSync(destino);

    // Abre o arquivo de destino como banco SQLite padrão sem criptografia.
    // A KEY '' instrui o driver a não aplicar cipher no banco anexado.
    db.prepare(`ATTACH DATABASE '${destinoEscapado}' AS plaintext KEY ''`).run();

    // Garante que o banco de destino não herde as configurações de cipher da
    // conexão principal. Aplica explicitamente cipher_plaintext no schema anexado.
    try {
      db.pragma(`plaintext.cipher = 'plaintext'`);
    } catch {
      // pragma de schema específico pode não ser suportado; silencia e prossegue
    }

    // Copia todos os objetos (tabelas, índices, triggers, views) do banco
    // principal para o banco de destino sem criptografia.
    db.prepare(`SELECT sqlcipher_export('plaintext')`).run();

    db.prepare(`DETACH DATABASE plaintext`).run();

    if (verificarTipoArquivoSQLite(destino) === 'sqlite') {
      console.log('[backupService] Exportação descr. (Estratégia A — ATTACH) concluída com sucesso.');
      return true;
    }

    // Arquivo gerado ainda está criptografado — limpa e tenta Estratégia B
    console.warn('[backupService] Estratégia A gerou arquivo ainda criptografado. Tentando Estratégia B...');
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
  } catch (errA) {
    console.error('[backupService] Estratégia A (ATTACH + sqlcipher_export) falhou:', errA.message);
    try { db.prepare(`DETACH DATABASE plaintext`).run(); } catch { /* já desanexado */ }
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
  }

  // ── Estratégia B: VACUUM INTO + rekey para sem cipher ─────────────────────
  // Cria primeiro uma cópia criptografada via VACUUM INTO e depois
  // abre essa cópia como banco separado para fazer rekey('') nela.
  try {
    if (fs.existsSync(destino)) fs.unlinkSync(destino);

    // Cria cópia fiel do banco atual (ainda criptografada)
    db.prepare(`VACUUM INTO '${destinoEscapado}'`).run();

    if (!fs.existsSync(destino) || fs.statSync(destino).size < 512) {
      throw new Error('VACUUM INTO não gerou arquivo válido.');
    }

    // Importa Database localmente para não criar dependência circular no módulo
    const Database = require('better-sqlite3-multiple-ciphers');
    const dbCopia = new Database(destino);

    // Autentica a cópia com a mesma chave do banco principal
    const encKey = getEncryptionKey();
    if (encKey) {
      dbCopia.pragma(`key = '${encKey.replace(/'/g, "''")}'`);
    }

    // Remove a criptografia — rekey('') converte para SQLite padrão
    dbCopia.pragma(`rekey = ''`);
    dbCopia.close();

    if (verificarTipoArquivoSQLite(destino) === 'sqlite') {
      console.log('[backupService] Exportação descr. (Estratégia B — rekey) concluída com sucesso.');
      return true;
    }

    console.error('[backupService] Estratégia B também falhou em gerar SQLite padrão.');
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
    return false;
  } catch (errB) {
    console.error('[backupService] Estratégia B (VACUUM INTO + rekey) falhou:', errB.message);
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Backup Portável (descriptografado — .sqlite legível)
// ─────────────────────────────────────────────────────────────

/**
 * Gera um arquivo de backup SQLite DESCRIPTOGRAFADO (arquivo .sqlite padrão,
 * legível em ferramentas como DB Browser for SQLite).
 *
 * Estratégia de exportação (em ordem de tentativa):
 *  1. VACUUM INTO → verificação do magic header (melhor qualidade)
 *  2. ATTACH + sqlcipher_export → exportação sem cipher
 *  3. Cópia direta do arquivo de banco (fallback final)
 *
 * @param {string} caminhoDestino - Caminho onde o backup será salvo (.sqlite recomendado)
 * @returns {{ success: boolean, caminho: string, criptografado: boolean, mensagem: string }}
 */
function gerarBackupBanco(caminhoDestino) {
  if (!caminhoDestino) {
    throw new Error('Caminho de destino do backup não informado.');
  }

  // Força extensão correta para evitar confusão
  if (!caminhoDestino.endsWith('.sqlite') && !caminhoDestino.endsWith('.db')) {
    caminhoDestino = caminhoDestino + '.sqlite';
  }

  const db = getDb();

  // Remove destino existente (VACUUM INTO exige arquivo inexistente)
  if (fs.existsSync(caminhoDestino)) {
    fs.unlinkSync(caminhoDestino);
  }

  // ── Estratégia 1: VACUUM INTO ──────────────────────────────
  let vacuumOk = false;
  try {
    db.prepare(`VACUUM INTO '${caminhoDestino.replace(/'/g, "''")}'`).run();
    vacuumOk = true;
  } catch (err) {
    console.warn('[backupService] VACUUM INTO falhou:', err.message);
  }

  if (vacuumOk) {
    const tipo = verificarTipoArquivoSQLite(caminhoDestino);
    if (tipo === 'sqlite') {
      return {
        success: true,
        caminho: caminhoDestino,
        criptografado: false,
        mensagem: `Backup gerado com sucesso!\nArquivo SQLite padrão (aberto em qualquer editor) salvo em:\n${path.basename(caminhoDestino)}`
      };
    }

    // VACUUM INTO produziu arquivo criptografado → tenta descriptografar via ATTACH
    if (tipo === 'encrypted') {
      if (fs.existsSync(caminhoDestino)) fs.unlinkSync(caminhoDestino);
      const exportadoLimpo = tentarExportarDescriptografado(db, caminhoDestino);
      if (exportadoLimpo) {
        return {
          success: true,
          caminho: caminhoDestino,
          criptografado: false,
          mensagem: `Backup gerado com sucesso!\nArquivo SQLite padrão salvo em:\n${path.basename(caminhoDestino)}`
        };
      }

      // Não conseguiu descriptografar — salva criptografado e avisa
      if (fs.existsSync(caminhoDestino)) fs.unlinkSync(caminhoDestino);
      db.prepare(`VACUUM INTO '${caminhoDestino.replace(/'/g, "''")}'`).run();
      return {
        success: true,
        caminho: caminhoDestino,
        criptografado: true,
        mensagem:
          `Backup gerado com sucesso!\n` +
          `⚠️ O arquivo está no formato criptografado interno do Ca$hManager.\n` +
          `Para exportar dados legíveis, use a opção "Exportar Relatório CSV".`
      };
    }
  }

  // ── Estratégia 2: Cópia direta do arquivo de banco ─────────
  const origPath = getDbPath();
  if (origPath && fs.existsSync(origPath)) {
    if (fs.existsSync(caminhoDestino)) fs.unlinkSync(caminhoDestino);
    fs.copyFileSync(origPath, caminhoDestino);

    const tipo = verificarTipoArquivoSQLite(caminhoDestino);
    const criptografado = tipo !== 'sqlite';

    return {
      success: true,
      caminho: caminhoDestino,
      criptografado,
      mensagem: criptografado
        ? `Backup gerado (cópia direta).\n⚠️ Arquivo no formato interno — use "Exportar CSV" para dados legíveis.`
        : `Backup gerado com sucesso!\nArquivo SQLite padrão salvo em:\n${path.basename(caminhoDestino)}`
    };
  }

  throw new Error('Não foi possível gerar o backup. Nenhuma estratégia disponível.');
}

// ─────────────────────────────────────────────────────────────
// 2. Backup Criptografado Interno (formato .db para restauração)
// ─────────────────────────────────────────────────────────────

/**
 * Gera um backup no formato interno criptografado do Ca$hManager (.db).
 * Esse arquivo é restaurável pelo próprio app, mas NÃO legível em editores externos.
 *
 * @param {string} caminhoDestino
 * @returns {{ success: boolean, caminho: string, criptografado: boolean, mensagem: string }}
 */
function gerarBackupCriptografado(caminhoDestino) {
  if (!caminhoDestino) throw new Error('Caminho de destino não informado.');

  const db = getDb();

  if (fs.existsSync(caminhoDestino)) fs.unlinkSync(caminhoDestino);

  try {
    db.prepare(`VACUUM INTO '${caminhoDestino.replace(/'/g, "''")}'`).run();
  } catch (err) {
    const origPath = getDbPath();
    if (origPath && fs.existsSync(origPath)) {
      fs.copyFileSync(origPath, caminhoDestino);
    } else {
      throw err;
    }
  }

  return {
    success: true,
    caminho: caminhoDestino,
    criptografado: true,
    mensagem: `Backup interno gerado com sucesso em:\n${path.basename(caminhoDestino)}\n(Restaurável pelo Ca$hManager)`
  };
}

// ─────────────────────────────────────────────────────────────
// 3. Restauração do Banco
// ─────────────────────────────────────────────────────────────

/**
 * Restaura o banco de dados a partir de um arquivo de backup interno (.db criptografado).
 * Valida a integridade do arquivo antes de substituir o banco atual e reverte
 * automaticamente em caso de falha.
 *
 * @param {string} caminhoOrigem - Caminho do arquivo de backup a restaurar
 * @returns {{ success: boolean, mensagem: string }}
 */
function restaurarBackupBanco(caminhoOrigem) {
  if (!caminhoOrigem || !fs.existsSync(caminhoOrigem)) {
    throw new Error('Arquivo de backup selecionado não existe ou é inválido.');
  }

  // ── Validação do arquivo de origem ──────────────────────────
  const tipoArquivo = verificarTipoArquivoSQLite(caminhoOrigem);

  if (tipoArquivo === 'invalid') {
    throw new Error(
      'O arquivo selecionado não é um banco SQLite válido.\n\n' +
      'Selecione um arquivo .db gerado pela função "Backup Completo" do Ca$hManager.'
    );
  }

  if (tipoArquivo === 'sqlite') {
    throw new Error(
      'O arquivo selecionado é um banco SQLite padrão (não criptografado).\n\n' +
      'Para restaurar, selecione o arquivo .db gerado pela opção "Backup Completo" do Ca$hManager.\n' +
      'Arquivos .sqlite exportados são apenas para visualização externa e não podem ser restaurados diretamente.'
    );
  }

  const dbPath = getDbPath();
  if (!dbPath) throw new Error('Caminho do banco de dados principal não encontrado.');

  // ── Fecha a conexão ativa ────────────────────────────────────
  closeDb();

  // ── Cria backup temporário de segurança ──────────────────────
  const backupTemp = `${dbPath}.bak_${Date.now()}`;
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupTemp);
  }

  try {
    // ── Substitui o banco pelo arquivo de backup ──────────────
    fs.copyFileSync(caminhoOrigem, dbPath);

    // ── Abre e valida com migração e integrity_check ──────────
    const novoDb = initDatabase(dbPath);
    runMigrations(novoDb);

    const integridade = novoDb.prepare('PRAGMA integrity_check').get();
    if (!integridade || integridade.integrity_check !== 'ok') {
      throw new Error('Verificação de integridade (PRAGMA integrity_check) falhou no banco restaurado.');
    }

    // Tudo certo — remove backup temporário
    if (fs.existsSync(backupTemp)) fs.unlinkSync(backupTemp);

    return {
      success: true,
      mensagem: 'Banco de dados restaurado com sucesso!\nReinicie o aplicativo para garantir a estabilidade.'
    };
  } catch (error) {
    console.error('[backupService] Falha ao restaurar, revertendo:', error);
    // Reverte para o banco original
    if (fs.existsSync(backupTemp)) {
      if (fs.existsSync(dbPath)) {
        try { fs.unlinkSync(dbPath); } catch { /* silencia */ }
      }
      fs.copyFileSync(backupTemp, dbPath);
      try { initDatabase(dbPath); } catch { /* silencia */ }
      try { fs.unlinkSync(backupTemp); } catch { /* silencia */ }
    }
    throw new Error(
      `Falha ao restaurar banco de dados: ${error.message}\n\n` +
      'O banco de dados original foi preservado automaticamente.'
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Exportação CSV
// ─────────────────────────────────────────────────────────────

/**
 * Exporta uma tabela do banco para arquivo CSV legível no Excel/LibreOffice.
 * - Separador: ponto-e-vírgula (padrão brasileiro no Excel)
 * - Codificação: UTF-8 com BOM (para exibição correta de acentos no Excel)
 * - Quebra de linha: CRLF (\r\n)
 *
 * @param {'clientes'|'emprestimos'|'parcelas'|'movimentacoes_caixa'} nomeTabela
 * @param {string} caminhoDestino
 * @returns {{ success: boolean, totalRegistros: number, mensagem: string }}
 */
function exportarTabelaCSV(nomeTabela, caminhoDestino) {
  const tabelasValidas = ['clientes', 'emprestimos', 'parcelas', 'movimentacoes_caixa'];
  if (!tabelasValidas.includes(nomeTabela)) {
    throw new Error(`Tabela "${nomeTabela}" inválida. Escolha entre: ${tabelasValidas.join(', ')}.`);
  }
  if (!caminhoDestino) {
    throw new Error('Caminho de destino do arquivo CSV não informado.');
  }

  const db = getDb();
  let rows = [];

  if (nomeTabela === 'clientes') {
    rows = db.prepare(
      'SELECT id, nome, cpf, telefone, endereco, status, criado_em FROM clientes ORDER BY nome ASC'
    ).all();
  } else if (nomeTabela === 'emprestimos') {
    rows = db.prepare(`
      SELECT e.id, c.nome AS cliente_nome, c.cpf AS cliente_cpf,
             e.valor_investido, e.taxa_juros, e.parcelas, e.frequencia,
             e.data_inicio, e.status, e.criado_em
      FROM emprestimos e
      JOIN clientes c ON e.cliente_id = c.id
      ORDER BY e.id DESC
    `).all();
  } else if (nomeTabela === 'parcelas') {
    rows = db.prepare(`
      SELECT p.id, p.emprestimo_id, c.nome AS cliente_nome,
             p.numero_parcela, p.valor, p.data_vencimento, p.data_pagamento, p.status
      FROM parcelas p
      JOIN emprestimos e ON p.emprestimo_id = e.id
      JOIN clientes c ON e.cliente_id = c.id
      ORDER BY p.data_vencimento ASC
    `).all();
  } else if (nomeTabela === 'movimentacoes_caixa') {
    rows = db.prepare(
      'SELECT id, tipo, valor, descricao, data, origem_id, criado_em FROM movimentacoes_caixa ORDER BY data DESC, id DESC'
    ).all();
  }

  // Colunas: da primeira row ou via PRAGMA (tabela vazia — bug fix)
  const colunas = rows.length > 0
    ? Object.keys(rows[0])
    : obterColunasDaTabela(db, nomeTabela);

  if (colunas.length === 0) {
    throw new Error(`Não foi possível determinar as colunas da tabela "${nomeTabela}".`);
  }

  const linhas = rows.map(row => colunas.map(col => escaparCSV(row[col])).join(';'));
  const conteudo = '\uFEFF' + [colunas.join(';'), ...linhas].join('\r\n') + '\r\n';

  fs.writeFileSync(caminhoDestino, conteudo, 'utf8');

  return {
    success: true,
    totalRegistros: rows.length,
    mensagem: rows.length > 0
      ? `Relatório exportado com sucesso! ${rows.length} registro(s) salvos em:\n${path.basename(caminhoDestino)}`
      : `Relatório exportado com sucesso! A tabela "${nomeTabela}" está vazia (apenas cabeçalho exportado).`
  };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

module.exports = {
  gerarBackupBanco,
  gerarBackupCriptografado,
  restaurarBackupBanco,
  exportarTabelaCSV,
  verificarTipoArquivoSQLite
};