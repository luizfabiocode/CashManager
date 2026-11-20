# Agente 01: Especialista em Infraestrutura e Banco de Dados

## Objetivo

Corrigir o bug crítico de inicialização do banco de dados (erro `mkdirSync` dentro do `app.asar`) e implementar a blindagem de backup automático antes de migrações. Isso garante que o banco do usuário final nunca seja perdido em atualizações.

## Instruções de Execução

### 1. Correção do Caminho do Banco (`src/main/database/db.js`)

- Altere a função `initDatabase`.
- Garanta que a variável `isDev` seja verdadeira apenas se não estiver empacotado (`!app.isPackaged`).
- Se for produção (`isDev = false`), o caminho do banco deve ser **estritamente** `path.join(app.getPath('userData'), 'financeiro.db')` (não crie subpastas aninhadas desnecessárias como `data/` para evitar erros de permissão).
- Se for desenvolvimento (`isDev = true`), use `path.join(process.cwd(), 'data', 'financeiro.db')`.
- Certifique-se de que `fs.mkdirSync` crie a pasta `userData` caso não exista, com `{ recursive: true }`.

### 2. Backup Automático de Segurança (`src/main/database/migrations.js`)

- Crie uma função chamada `runMigrationsWithBackup(db, dbPath)`.
- Essa função deve substituir a chamada antiga de `runMigrations`.
- **Lógica:** Antes de rodar qualquer migração pendente, ela deve verificar se há migrações a serem feitas. Se houver, execute o comando `db.prepare("VACUUM INTO ?").run(backupPath)` para criar um snapshot do banco atual (salve em `path.join(path.dirname(dbPath), 'backups')` com o timestamp no nome, ex: `backup_pre_migration_123456.db`).
- Aplique as migrações dentro de uma transação. Se der sucesso, pode manter o backup (para auditoria). Se der erro, restaure o backup, feche o banco e lance um erro claro no console.

### 3. Integração no Main Process (`src/main/main.js`)

- Verifique onde a função de inicialização de migração é chamada no `main.js`. Altere para chamar a nova função `runMigrationsWithBackup(db, dbPath)`.

## Critério de Aceite

O aplicativo deve abrir normalmente na máquina local (sem o erro `ENOTDIR`). O arquivo `financeiro.db` deve ser criado/aberto em `C:\Users\seu_usuario\AppData\Roaming\CashManager\financeiro.db`. Um backup deve ser gerado na pasta `backups` se houver migração pendente.
