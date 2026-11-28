import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  User, 
  X, 
  Paperclip, 
  Trash2, 
  FileText, 
  Plus, 
  ExternalLink, 
  Loader2, 
  Check, 
  AlertCircle, 
  Info 
} from 'lucide-react';
import { prevenirEnter } from '../../utils/moeda';

/**
 * Utilitário para formatar CPF (000.000.000-00)
 */
function formatarCPF(valor) {
  if (!valor) return '';
  const limpo = String(valor).replace(/\D/g, '').slice(0, 11);
  if (limpo.length > 9) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  if (limpo.length > 6) {
    return limpo.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  }
  if (limpo.length > 3) {
    return limpo.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  }
  return limpo;
}

/**
 * Utilitário para formatar Telefone / WhatsApp ((00) 00000-0000)
 */
function formatarTelefone(valor) {
  if (!valor) return '';
  const limpo = String(valor).replace(/\D/g, '').slice(0, 11);
  if (limpo.length > 10) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (limpo.length > 6) {
    return limpo.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
  }
  if (limpo.length > 2) {
    return limpo.replace(/(\d{2})(\d{1,5})/, '($1) $2');
  }
  return limpo;
}

/**
 * Formata data ISO para formato legível DD/MM/AAAA
 */
function formatarDataHora(dataStr) {
  if (!dataStr) return '';
  try {
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) return dataStr;
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const min = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  } catch {
    return dataStr;
  }
}

/**
 * Componente ModalCliente
 * Gerencia cadastro/edição de clientes e seus documentos anexados.
 */
export default function ModalCliente({ 
  isOpen, 
  onClose, 
  clienteParaEditar, 
  cliente: clienteProp, 
  onSuccess, 
  addToast 
}) {
  // Unifica a referência do cliente recebido (suporta clienteParaEditar ou cliente)
  const clienteAtual = clienteParaEditar || clienteProp || null;
  const clienteId = clienteAtual?.id || null;

  // Estados dos campos de cadastro
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Estados de gerenciamento de anexos
  const [anexos, setAnexos] = useState([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);
  const [anexandoDocumento, setAnexandoDocumento] = useState(false);
  const [removendoId, setRemovendoId] = useState(null);

  // Sincroniza campos quando o modal abre ou cliente muda
  useEffect(() => {
    if (clienteAtual) {
      setNome(clienteAtual.nome || '');
      setCpf(clienteAtual.cpf ? formatarCPF(clienteAtual.cpf) : '');
      setTelefone(clienteAtual.telefone ? formatarTelefone(clienteAtual.telefone) : '');
      setEndereco(clienteAtual.endereco || '');
    } else {
      setNome('');
      setCpf('');
      setTelefone('');
      setEndereco('');
    }
  }, [clienteAtual, isOpen]);

  // Carrega a lista de documentos anexados do cliente
  const carregarAnexos = useCallback(async () => {
    if (!clienteId) {
      setAnexos([]);
      return;
    }

    setCarregandoAnexos(true);
    try {
      if (window.api?.anexos?.listar) {
        const res = await window.api.anexos.listar(clienteId);
        if (res && res.success) {
          setAnexos(res.data || []);
        } else if (Array.isArray(res)) {
          setAnexos(res);
        } else {
          setAnexos([]);
        }
      } else {
        setAnexos([]);
      }
    } catch (err) {
      console.error('[ModalCliente] Erro ao listar anexos do cliente:', err);
      setAnexos([]);
    } finally {
      setCarregandoAnexos(false);
    }
  }, [clienteId]);

  // Dispara a busca de anexos sempre que o modal abre para um cliente existente
  useEffect(() => {
    if (isOpen && clienteId) {
      carregarAnexos();
    } else {
      setAnexos([]);
    }
  }, [isOpen, clienteId, carregarAnexos]);

  // Fluxo de seleção e gravação de novo anexo
  const handleAnexarNovoDocumento = async () => {
    if (!clienteId) return;

    if (!window.api?.anexos?.selecionar || !window.api?.anexos?.salvar) {
      const msg = 'Recurso de anexos não disponível no ambiente atual.';
      if (addToast) addToast(msg, 'error');
      toast.error(msg);
      return;
    }

    try {
      setAnexandoDocumento(true);

      // 1. Abre a caixa de diálogo do sistema operacional
      const resSelecao = await window.api.anexos.selecionar();
      const filePath = resSelecao?.data !== undefined ? resSelecao.data : resSelecao;
      const pathFinal = typeof filePath === 'string' ? filePath : filePath?.filePath;

      // Se o usuário cancelou o seletor de arquivos
      if (!pathFinal) {
        return;
      }

      // 2. Salva o documento no backend
      const resSalvar = await window.api.anexos.salvar({
        clienteId: clienteId,
        filePath: pathFinal
      });

      if (resSalvar && (resSalvar.success || resSalvar.id)) {
        if (addToast) {
          addToast('Documento anexado com sucesso!', 'success');
        }
        toast.success('Documento anexado com sucesso!');
        // 3. Atualiza a lista de anexos na tela
        await carregarAnexos();
      } else {
        const erroMsg = resSalvar?.error || 'Erro ao salvar o anexo do cliente.';
        if (addToast) addToast(erroMsg, 'error');
        toast.error(erroMsg);
      }
    } catch (err) {
      console.error('[ModalCliente] Falha ao anexar documento:', err);
      const erroMsg = err.message || 'Falha ao anexar documento.';
      if (addToast) addToast(erroMsg, 'error');
      toast.error(erroMsg);
    } finally {
      setAnexandoDocumento(false);
    }
  };

  // Abre o documento anexado no visualizador padrão do SO
  const handleAbrirAnexo = async (caminhoArquivo) => {
    if (!caminhoArquivo) return;
    try {
      if (window.api?.anexos?.abrir) {
        const res = await window.api.anexos.abrir(caminhoArquivo);
        if (res && res.success === false) {
          const msg = res.error || 'Não foi possível abrir o documento.';
          if (addToast) addToast(msg, 'error');
          toast.error(msg);
        }
      } else {
        // Fallback para shell
        if (window.api?.shell?.openExternal) {
          await window.api.shell.openExternal(`file://${caminhoArquivo}`);
        }
      }
    } catch (err) {
      console.error('[ModalCliente] Erro ao abrir documento:', err);
      const msg = err.message || 'Erro ao abrir documento.';
      if (addToast) addToast(msg, 'error');
      toast.error(msg);
    }
  };

  // Remove um anexo com confirmação
  const handleRemoverAnexo = (anexo) => {
    if (!anexo?.id) return;

    toast(`Deseja realmente remover o anexo "${anexo.nome_arquivo}"?`, {
      action: {
        label: 'Remover',
        onClick: async () => {
          setRemovendoId(anexo.id);
          try {
            if (window.api?.anexos?.remover) {
              const res = await window.api.anexos.remover(anexo.id, anexo.caminho_arquivo);
              if (res && (res.success || res.success !== false)) {
                if (addToast) {
                  addToast('Documento removido com sucesso!', 'success');
                }
                toast.success('Documento removido com sucesso!');
                await carregarAnexos();
              } else {
                const msg = res?.error || 'Erro ao remover anexo.';
                if (addToast) addToast(msg, 'error');
                toast.error(msg);
              }
            }
          } catch (err) {
            console.error('[ModalCliente] Erro ao remover documento:', err);
            const msg = err.message || 'Erro ao remover documento.';
            if (addToast) addToast(msg, 'error');
            toast.error(msg);
          } finally {
            setRemovendoId(null);
          }
        }
      },
      cancel: {
        label: 'Cancelar'
      }
    });
  };

  // Submissão do formulário de cliente (Criar ou Atualizar)
  const handleSubmitCliente = async (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      const msg = 'O nome do cliente é obrigatório.';
      if (addToast) addToast(msg, 'error');
      toast.error(msg);
      return;
    }

    setSalvando(true);
    try {
      const dadosCliente = {
        nome: nome.trim(),
        cpf: cpf.trim() ? cpf.replace(/\D/g, '') : null,
        telefone: telefone.trim() ? telefone.replace(/\D/g, '') : null,
        endereco: endereco.trim() ? endereco.trim() : null
      };

      if (clienteId) {
        // Atualização de cliente existente
        if (window.api?.clientes?.atualizar) {
          const res = await window.api.clientes.atualizar(clienteId, dadosCliente);
          if (res.success) {
            if (onClose) onClose();
            if (addToast) addToast('Cliente atualizado com sucesso!', 'success');
            toast.success('Cliente atualizado com sucesso!');
            if (onSuccess) onSuccess(res.data);
          } else {
            const erroMsg = res.error || 'Erro ao atualizar dados do cliente.';
            if (addToast) addToast(erroMsg, 'error');
            toast.error(erroMsg);
          }
        }
      } else {
        // Cadastro de novo cliente
        if (window.api?.clientes?.criar) {
          const res = await window.api.clientes.criar(dadosCliente);
          if (res.success) {
            if (onClose) onClose();
            if (addToast) addToast('Cliente cadastrado com sucesso!', 'success');
            toast.success('Cliente cadastrado com sucesso!');
            if (onSuccess) onSuccess(res.data);
          } else {
            const erroMsg = res.error || 'Erro ao cadastrar novo cliente.';
            if (addToast) addToast(erroMsg, 'error');
            toast.error(erroMsg);
          }
        }
      }
    } catch (err) {
      console.error('[ModalCliente] Erro ao salvar cliente:', err);
      const erroMsg = err.message || 'Erro ao processar formulário do cliente.';
      if (addToast) addToast(erroMsg, 'error');
      toast.error(erroMsg);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white">
                {clienteId ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {clienteId 
                  ? 'Atualize os dados e gerencie os documentos deste cliente'
                  : 'Preencha os dados cadastrais do tomador de empréstimo'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL - SCROLLÁVEL */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* FORMULÁRIO DE DADOS CADASTRAIS */}
          <form id="form-cliente" onSubmit={handleSubmitCliente} onKeyDown={prevenirEnter} className="space-y-4">
            
            {/* Campo Nome */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Grid CPF e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatarCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Campo Endereço */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Endereço Completo
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </form>

          {/* DIVISOR */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-2" />

          {/* ========================================================= */}
          {/* SEÇÃO DE ANEXOS DE DOCUMENTOS                             */}
          {/* ========================================================= */}
          <div>
            {!clienteId ? (
              /* Caso 1: Cliente novo (ainda não salvo) */
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                  <Paperclip className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Documentos Anexados
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Salve o cliente primeiro para anexar documentos.
                  </p>
                </div>
              </div>
            ) : (
              /* Caso 2: Cliente já existente (permite anexar e listar) */
              <div className="space-y-3">
                {/* Cabeçalho da Seção */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Documentos Anexados
                    </h4>
                    {anexos.length > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {anexos.length}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAnexarNovoDocumento}
                    disabled={anexandoDocumento}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {anexandoDocumento ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Anexando...</span>
                      </>
                    ) : (
                      <>
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Anexar Novo Documento</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Lista de Anexos */}
                {carregandoAnexos ? (
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Carregando documentos...</span>
                  </div>
                ) : anexos.length === 0 ? (
                  /* Mensagem quando não há anexos */
                  <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center text-center gap-1.5">
                    <Paperclip className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Nenhum documento anexado
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Clique em "Anexar Novo Documento" para incluir contratos, comprovantes ou identidades.
                    </p>
                  </div>
                ) : (
                  /* Lista de arquivos anexados */
                  <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                    {anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800 transition-all"
                      >
                        {/* Nome do arquivo clicável */}
                        <div
                          onClick={() => handleAbrirAnexo(anexo.caminho_arquivo)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          title={`Clique para abrir: ${anexo.nome_arquivo}`}
                        >
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0 group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors">
                                {anexo.nome_arquivo}
                              </span>
                              <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            {anexo.criado_em && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                Anexado em {formatarDataHora(anexo.criado_em)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ações: Abrir e Remover */}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleAbrirAnexo(anexo.caminho_arquivo)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            title="Abrir arquivo no sistema"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoverAnexo(anexo)}
                            disabled={removendoId === anexo.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all disabled:opacity-50"
                            title="Remover documento"
                          >
                            {removendoId === anexo.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* RODAPÉ COM BOTÕES DE AÇÃO */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-all"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="form-cliente"
            disabled={salvando || !nome.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{clienteId ? 'Atualizar Cliente' : 'Cadastrar Cliente'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
