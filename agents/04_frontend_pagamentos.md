# Agente 04: Especialista em UI/UX React (Pagamentos Parciais)

## Objetivo

Adicionar a interface na tela de detalhes do empréstimo para permitir que o usuário registre pagamentos de juros (rolagem), principal ou quitação total.

## Instruções de Execução

Abra o componente do modal de detalhes do empréstimo (provavelmente `src/renderer/src/components/modals/ModalDetalhesEmprestimo.jsx`).

### 1. Adicionar Botão de Ação

No cabeçalho do modal (onde ficam as informações do cliente e status do empréstimo), adicione um botão verde com o texto **"Registrar Pagamento"** (ou um ícone de cifrão), visível apenas se o empréstimo estiver com `status === 'ativo'`.

### 2. Criar o Modal de Pagamento (Sub-modal)

Crie um novo estado (ex: `isPagamentoModalOpen`) no componente. Quando o usuário clicar em "Registrar Pagamento", ele deve abrir um novo modal (ou uma seção expansível) com os seguintes campos:

- **Tipo de Pagamento:** Um select com as opções "Apenas Juros (Rolagem)", "Abater Principal" ou "Quitar Tudo".
- **Valor Pago (R$):** Um input numérico (deve ser preenchido automaticamente com o valor total de juros se a opção for "Apenas Juros" e for pagar a totalidade; mas o usuário pode alterar para pagamentos parciais).
- **Data do Pagamento:** Input de data (padrão = hoje).
- **Observação:** Campo de texto opcional.
- Um botão **"Confirmar Pagamento"**.

### 3. Lógica de Envio (Integração com a API)

Ao clicar em "Confirmar Pagamento":

1. Chame `window.api.emprestimos.pagamentoEspecial({ emprestimoId: id, valorPago, tipoPagamento, dataPagamento, observacao })`.
2. Certifique-se de mapear o select para os valores exatos: `'juros'`, `'principal'`, `'total'`.
3. Exiba um estado de loading no botão enquanto a promessa não resolve.
4. Se retornar sucesso, feche o sub-modal, exiba uma notificação (toast) de sucesso e **atualize os dados do empréstimo** (chame `obterDetalhes` novamente para puxar o novo saldo e a nova data de vencimento).
5. Se der erro, mostre um alerta com a mensagem retornada pelo backend.

### 4. Exibição de Saldos (Opcional, mas recomendado)

Na área de detalhes do empréstimo, mostre claramente:

- **Saldo Principal:** R$ XX,XX
- **Juros do Período:** R$ XX,XX
- **Vencimento Atual:** DD/MM/AAAA
