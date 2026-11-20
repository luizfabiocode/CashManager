# Agente 06: Especialista UI (Anexos de Documentos)

## Objetivo

Adicionar a interface visual para permitir que o usuário anexe e gerencie documentos vinculados aos clientes.

## Instruções de Execução

Abra o componente de edição de clientes (provavelmente `src/renderer/src/components/modals/ModalCliente.jsx` ou na tela de Clientes).

### 1. Área de Anexos no Modal (Se o cliente já existir)

Se o cliente for novo (ainda não tem ID), exiba uma mensagem: "Salve o cliente primeiro para anexar documentos."
Se o cliente já existir:

- Adicione uma seção chamada **"Documentos Anexados"**.
- Crie um botão **"Anexar Novo Documento"** com um ícone de clipe de papel (Paperclip).
- Ao clicar no botão:
  1. Chame `window.api.anexos.selecionar()` para abrir a janela do Windows.
  2. Se o usuário escolher um arquivo, chame `window.api.anexos.salvar({ clienteId: cliente.id, filePath })`.
  3. Atualize a lista de anexos na tela.

### 2. Lista de Anexos

- Faça um `useEffect` que chama `window.api.anexos.listar(cliente.id)` sempre que o modal abrir.
- Exiba os anexos em formato de lista, mostrando o `nome_arquivo`.
- Ao clicar no nome do arquivo, chame `window.api.anexos.abrir(caminho_arquivo)`.
- Adicione um pequeno botão de "Lixeira" ao lado de cada arquivo para chamar `window.api.anexos.remover(id, caminho_arquivo)`.

### 3. Design

- Use um design limpo com bordas tracejadas (estilo área de upload) ou uma lista simples com ícones.
- Certifique-se de que a tela não quebre se o cliente não tiver nenhum anexo (exiba a mensagem "Nenhum documento anexado").
