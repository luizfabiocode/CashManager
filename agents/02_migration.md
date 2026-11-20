# Agente 02: Especialista em Migração de Banco de Dados (Feature v2)

## Objetivo

Criar a migração de versão 2 para adicionar suporte a Abatimento Parcial (com separação de Juros e Principal) e Anexos de Documentos.

## Instruções de Execução

Abra o arquivo `src/main/database/migrations.js` e adicione um novo objeto ao array de migrações:

```javascript
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
```
