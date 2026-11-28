# 💰 Ca$hManager - Controle Financeiro Desktop

O **Ca$hManager** é uma aplicação desktop offline de alta performance, projetada para gestão de empréstimos, controle de clientes, fluxo de caixa e cobranças. O sistema prioriza a privacidade absoluta dos dados, mantendo todas as informações financeiras criptografadas localmente na máquina do usuário.

## ✨ Funcionalidades Principais

- **Gestão de Clientes e Empréstimos:** Cadastro completo de tomadores e geração automática de contratos com parcelas.
- **Pagamento Parcial (Rolagem de Juros):** Flexibilidade para o cliente pagar apenas os juros no vencimento, rolando a dívida principal para o próximo ciclo com recálculo automático.
- **Anexo de Documentos:** Upload de contratos, RG e comprovantes vinculados diretamente ao perfil do cliente.
- **Integração com WhatsApp:** Botões de cobrança rápida (com envio de mensagem pré-formatada e chave PIX) diretamente do Dashboard e da lista de clientes.
- **Segurança de Nível Bancário:** Banco de dados SQLite local totalmente criptografado (AES-256 via SQLCipher).
- **Backup Automático:** Sistema inteligente que realiza um snapshot do banco de dados antes de qualquer atualização estrutural, garantindo zero perda de dados.
- **Auto-Updater:** Atualizações automáticas via GitHub Releases, garantindo que o cliente esteja sempre na última versão sem precisar reinstalar o app manualmente.
- **Interface Premium:** Design moderno e responsivo construído com Tailwind CSS, incluindo alternância entre Modo Claro e Escuro.

## 🛠️ Tecnologias Utilizadas

- **Runtime:** [Electron](https://www.electronjs.org/)
- **Frontend:** [React](https://react.dev/) (com Vite e Tailwind CSS)
- **Backend (Main Process):** Node.js
- **Banco de Dados:** SQLite com criptografia nativa ([better-sqlite3-multiple-ciphers](https://github.com/m4heshd/better-sqlite3-multiple-ciphers))
- **Notificações:** Sonner (Toasts)
- **Ícones:** Lucide React

## 📂 Estrutura do Projeto

```text
cashmanager_codigo_fonte/
├── agents/              # Documentação técnica e instruções de evolução (Prompts para IA)
├── docs/                # Documentação geral do sistema
├── src/
│   ├── main/            # Processo Principal do Electron (Backend)
│   │   ├── database/    # Conexão SQLite, Criptografia e Migrações
│   │   ├── ipc/         # Ponte de comunicação segura (IPC)
│   │   ├── services/    # Regras de negócio (Empréstimos, Caixa, Clientes, Backup)
│   │   ├── main.js      # Inicialização do Electron
│   │   ├── preload.js   # Context Bridge (Segurança)
│   │   └── updater.js   # Configuração do Auto-Updater
│   └── renderer/        # Interface Gráfica (Frontend React)
│       ├── src/
│       │   ├── components/ # Componentes globais (Sidebar, Header, Modais)
│       │   ├── context/    # Context API (Gerenciamento de Tema)
│       │   ├── views/      # Telas do sistema (Dashboard, Clientes, Empréstimos, etc)
│       │   └── App.jsx
│       └── index.html
├── package.json
└── vite.config.js

🚀 Como Executar o Projeto Localmente
Pré-requisitos
Node.js instalado (versão 18+ recomendada).

Instalação e Execução

Clone o repositório:
git clone https://github.com/luizfabiocode/CashManager.git
cd CashManager

Instale as dependências:
npm install

Para rodar em modo de desenvolvimento (necessário abrir dois terminais):

Terminal 1 (Frontend): npx vite

Terminal 2 (Electron): npm run dev

Para gerar o instalador de produção:
npm run build

🔒 Nota sobre Segurança e Persistência de Dados
Na versão de produção, o banco de dados (financeiro.db) é criado e mantido fora da pasta de instalação, especificamente na pasta de dados do usuário do sistema operacional (ex: %appdata%/app-controle-financeiro no Windows).
Isso garante que atualizações automáticas do aplicativo nunca afetem ou apaguem os dados dos clientes.

📄 Licença
Este projeto é de uso privado. Todos os direitos reservados.

```
