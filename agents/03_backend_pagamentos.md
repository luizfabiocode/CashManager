# Agente 03: Especialista em Regras de Negócio (Pagamentos Parciais)

## Objetivo

Implementar a lógica de backend para registrar o pagamento de juros (com rolagem de dívida) ou quitação total/parcial do principal.

## Instruções de Execução

### 1. Criar a função no Serviço (`src/main/services/installmentService.js`)

Crie a função `registrarPagamentoEspecial(emprestimoId, valorPago, tipoPagamento, dataPagamento, observacao)`.
O `tipoPagamento` deve aceitar: 'juros', 'principal', 'total'.
A função deve usar `db.transaction()` e seguir esta lógica:

- **Validação:** Buscar o empréstimo. Se `status === 'quitado'`, lançar erro.
- **Inserir no Histórico:** Inserir o registro na tabela `pagamentos_parciais` com os dados recebidos.
- **Lançar no Caixa:** Inserir em `movimentacoes_caixa` com `tipo = 'entrada'` e a descrição indicando o tipo de pagamento (ex: "Pagamento de Juros - Empréstimo #X").
- **Lógica por Tipo:**
  - Se `tipoPagamento === 'juros'`:
    - Subtrair `valorPago` do `saldo_juros` do empréstimo (não deixar ficar negativo).
    - Atualizar a data de vencimento das parcelas pendentes para a nova data (somar o período baseado na frequência do empréstimo).
    - Recalcular o `valor_juros_periodo` e adicionar ao `saldo_juros` para o próximo ciclo.
  - Se `tipoPagamento === 'principal'`:
    - Subtrair `valorPago` do `saldo_principal` do empréstimo.
    - (Opcional: abater também das parcelas correspondentes).
  - Se `tipoPagamento === 'total'`:
    - Zerar `saldo_principal` e `saldo_juros`.
    - Atualizar `status` do empréstimo para 'quitado'.
    - Atualizar todas as parcelas pendentes para 'pago'.
- **Retornar:** O objeto com o novo estado do empréstimo.

### 2. Expor no IPC (`src/main/ipc/registerIpcHandlers.js`)

- Criar o handler para o canal `'emprestimos:pagamentoEspecial'` que chama a função `registrarPagamentoEspecial`.

### 3. Expor no Preload (`src/main/preload.js`)

- Adicionar a função `pagamentoEspecial` dentro do objeto `emprestimos` (ou onde fizer sentido na sua estrutura de API exposta ao frontend).
