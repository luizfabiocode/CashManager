# Agente 07: Arquiteto Frontend (Design Premium, Dark/Light Mode e Integração)

## Contexto

O backend está 100% pronto. O layout base já existe. O seu objetivo é substituir os arquivos placeholder das views por telas completas, bonitas, interativas e 100% conectadas ao `window.api`.

## Instruções Gerais

- Use `lucide-react` para todos os ícones.
- Use Tailwind CSS para estilização.
- **Interatividade:** Adicione classes de transição e hover em TODOS os botões, links de menu e linhas de tabela (ex: `transition-all duration-200`, `hover:scale-[1.02]`, `active:scale-95`, `hover:bg-gray-800/50`). Nada exagerado, apenas um feedback visual agradável.
- **Tema Claro/Escuro:** O sistema deve suportar os dois temas. Use a estratégia de classes do Tailwind (`dark:bg-[#0b0f19]` e `bg-gray-50` para o modo claro). Adicione um botão no rodapé da Sidebar (`Sidebar.jsx`) com ícones de Sol e Lua para alternar o tema, salvando a escolha no `localStorage`.
- Sempre use estados de `loading` (spinner) enquanto os dados são buscados.
- Formate dinheiro com `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)` e datas com `toLocaleDateString('pt-BR')`.

## Tarefas por Arquivo

### 1. `src/renderer/src/views/ClientesView.jsx`

- **API:** `window.api.clientes.listar()`.
- **Layout:** Barra de busca no topo. Tabela com colunas: Nome, CPF, Telefone, Status, Ações. Linhas da tabela devem ter efeito `hover:bg-gray-800/50 cursor-pointer`.
- **Ações:** Botão de editar (abre `ModalCliente`) e excluir.

### 2. `src/renderer/src/views/EmprestimosView.jsx`

- **API:** `window.api.emprestimos.listar()`.
- **Layout:** Abas (Tabs) no topo: "Ativos", "Quitados", "Todos". Tabela com: Cliente, Valor Emprestado, Juros (%), Parcelas, Status.
- **Ações:** Botão "Ver Detalhes" que chama o `ModalDetalhesEmprestimo`. Status com badges coloridas.

### 3. `src/renderer/src/views/ParcelasView.jsx`

- **API:** `window.api.parcelas.listar()`.
- **Layout:** Abas: "Vencidas", "A Vencer", "Pagas". Tabela com: Cliente, Nº Parcela, Valor, Vencimento, Status.
- **Ações:** Botão "Dar Baixa" (chama `window.api.parcelas.darBaixa`) e botão do WhatsApp para cobrança.

### 4. `src/renderer/src/views/CaixaView.jsx`

- **API:** `window.api.caixa.obterSaldo()` e `window.api.caixa.obterExtrato()`.
- **Layout:** Topo com 3 Cards (Saldo em verde, Entradas em azul, Saídas em vermelho) com efeito hover. Abaixo, tabela de extrato com: Data, Descrição, Tipo e Valor.
- **Ações:** Botão "Nova Movimentação".

### 5. Atualização do `Sidebar.jsx` e `tailwind.config.js`

- Adicione o botão de Dark/Light mode no final da Sidebar.
- No `tailwind.config.js`, adicione `darkMode: 'class'`.

### 6. Correção do `main.js` (A Tela Preta)

- Abra o `src/main/main.js`.
- Na função `createWindow`, garanta que a linha de produção está exatamente assim:

```javascript
const indexPath = path.join(app.getAppPath(), "dist", "renderer", "index.html");
mainWindow.loadFile(indexPath);
```
