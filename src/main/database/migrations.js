const fs = require('fs');
const path = require('path');

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      // 1. Tabela de configurações (PIN, PIX, Versão)
      db.exec(`
        CREATE TABLE IF NOT EXISTS configuracoes (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          pin_hash TEXT,
          chave_pix TEXT,
          versao_sistema TEXT DEFAULT '1.0.0',
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Garante uma linha inicial com ID 1
      const configExists = db.prepare('SELECT id FROM configuracoes WHERE id = 1').get();
      if (!configExists) {
        db.prepare(`
          INSERT INTO configuracoes (id, versao_sistema) 
          VALUES (1, '1.0.0')
        `).run();
      }

      // 2. Tabela de clientes
      db.exec(`
        CREATE TABLE IF NOT EXISTS clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          cpf TEXT UNIQUE,
          telefone TEXT,
          endereco TEXT,
          status TEXT DEFAULT 'ativo',
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
        CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
        CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);
      `);

      // 3. Tabela de empréstimos
      db.exec(`
        CREATE TABLE IF NOT EXISTS emprestimos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliente_id INTEGER NOT NULL,
          valor_investido REAL NOT NULL CHECK (valor_investido > 0),
          taxa_juros REAL NOT NULL CHECK (taxa_juros >= 0),
          parcelas INTEGER NOT NULL CHECK (parcelas > 0),
          frequencia TEXT NOT NULL CHECK (frequencia IN ('diario', 'semanal', 'quinzenal', 'mensal')),
          data_inicio TEXT NOT NULL,
          status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'quitado', 'cancelado')),
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_emprestimos_cliente ON emprestimos(cliente_id);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos(status);
      `);

      // 4. Tabela de parcelas
      db.exec(`
        CREATE TABLE IF NOT EXISTS parcelas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          emprestimo_id INTEGER NOT NULL,
          numero_parcela INTEGER NOT NULL,
          valor REAL NOT NULL CHECK (valor >= 0),
          data_vencimento TEXT NOT NULL,
          data_pagamento TEXT,
          status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasada', 'cancelada')),
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_parcelas_emprestimo ON parcelas(emprestimo_id);
        CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas(data_vencimento);
        CREATE INDEX IF NOT EXISTS idx_parcelas_status ON parcelas(status);
      `);

      // 5. Tabela de movimentações de caixa
      db.exec(`
        CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
          valor REAL NOT NULL CHECK (valor > 0),
          descricao TEXT NOT NULL,
          data TEXT NOT NULL,
          origem_id INTEGER,
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes_caixa(data);
        CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes_caixa(tipo);
      `);
    }
  },
  {
    version: 2,
    name: 'partial_payments_and_attachments',
    up: (db) => {
      // 1. Tabela de Pagamentos Parciais (Histórico auditável de abatimentos)
      db.exec(`
        CREATE TABLE IF NOT EXISTS pagamentos_parciais (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          emprestimo_id INTEGER NOT NULL,
          valor_pago REAL NOT NULL CHECK (valor_pago > 0),
          tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('juros', 'principal', 'total')),
          data_pagamento TEXT NOT NULL,
          observacao TEXT,
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE
        );
      `);

      // 2. Tabela de Anexos de Clientes
      db.exec(`
        CREATE TABLE IF NOT EXISTS anexos_clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliente_id INTEGER NOT NULL,
          nome_arquivo TEXT NOT NULL,
          caminho_arquivo TEXT NOT NULL,
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        );
      `);

      // 3. Colunas de Saldo na tabela de Empréstimos
      db.exec(`
        ALTER TABLE emprestimos ADD COLUMN saldo_principal REAL DEFAULT 0;
        ALTER TABLE emprestimos ADD COLUMN saldo_juros REAL DEFAULT 0;
        ALTER TABLE emprestimos ADD COLUMN valor_juros_periodo REAL DEFAULT 0;
      `);

      // 4. Preencher os valores iniciais com base nos dados existentes
      // O saldo_principal é o próprio valor_investido.
      // O valor_juros_periodo é calculado usando a taxa (ex: 20 / 100.0 = 0.20)
      db.exec(`
        UPDATE emprestimos
        SET saldo_principal = valor_investido,
            valor_juros_periodo = valor_investido * (taxa_juros / 100.0),
            saldo_juros = valor_investido * (taxa_juros / 100.0);
      `);

      // 5. Colunas de Saldo na tabela de Parcelas (para manter histórico de pagamentos)
      db.exec(`
        ALTER TABLE parcelas ADD COLUMN valor_pago REAL DEFAULT 0;
        ALTER TABLE parcelas ADD COLUMN saldo_devedor REAL DEFAULT 0;
      `);

      // 6. Atualizar o saldo_devedor inicial das parcelas
      db.exec(`
        UPDATE parcelas
        SET valor_pago = CASE WHEN status = 'pago' THEN valor ELSE 0 END,
            saldo_devedor = CASE WHEN status = 'pago' THEN 0 ELSE valor END;
      `);

      // 7. Inserir migração no controle
      db.prepare('INSERT OR IGNORE INTO _migrations (version, name) VALUES (?, ?)').run(2, 'partial_payments_and_attachments');
    }
  }
];

/**
 * Executa todas as migrações pendentes com snapshot de backup automático prévio
 * @param {import('better-sqlite3-multiple-ciphers').Database} db 
 * @param {string} [dbPath] Caminho do arquivo do banco para criação de backup
 */
function runMigrationsWithBackup(db, dbPath = null) {
  // Cria tabela de controle de migrações se não existir
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM _migrations').all();
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  const pendingMigrations = migrations
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  if (pendingMigrations.length === 0) {
    return;
  }

  // Backup automático antes de rodar qualquer migração pendente
  let backupPath = null;
  if (dbPath && typeof dbPath === 'string') {
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    backupPath = path.join(backupDir, `backup_pre_migration_${Date.now()}.db`);

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    try {
      db.prepare('VACUUM INTO ?').run(backupPath);
    } catch (err) {
      const backupPathEscaped = backupPath.replace(/'/g, "''");
      db.prepare(`VACUUM INTO '${backupPathEscaped}'`).run();
    }
    console.log(`[Migrations] Backup pré-migração gerado com sucesso em: ${backupPath}`);
  }

  const applyMigration = db.transaction((migration) => {
    migration.up(db);
    db.prepare('INSERT OR IGNORE INTO _migrations (version, name) VALUES (?, ?)').run(
      migration.version,
      migration.name
    );
  });

  try {
    for (const migration of pendingMigrations) {
      applyMigration(migration);
      console.log(`[Migrations] Migration v${migration.version} (${migration.name}) aplicada com sucesso.`);
    }
  } catch (error) {
    console.error('[Migrations Error]: Erro crítico ao aplicar migrações pendentes:', error);
    if (backupPath && fs.existsSync(backupPath) && dbPath && fs.existsSync(dbPath)) {
      try {
        db.close();
        fs.copyFileSync(backupPath, dbPath);
        console.error(`[Migrations] Banco de dados restaurado a partir do backup: ${backupPath}`);
      } catch (restoreErr) {
        console.error('[Migrations Error]: Falha ao restaurar backup:', restoreErr);
      }
    } else {
      try { db.close(); } catch {}
    }
    throw error;
  }
}

/**
 * Executa todas as migrações pendentes (mantido para retrocompatibilidade)
 * @param {import('better-sqlite3-multiple-ciphers').Database} db 
 */
function runMigrations(db) {
  return runMigrationsWithBackup(db, null);
}

module.exports = {
  runMigrations,
  runMigrationsWithBackup,
  migrations
};
