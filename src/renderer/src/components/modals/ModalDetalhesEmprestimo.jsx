import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  X, 
  Loader2, 
  CheckCircle2, 
  MessageCircle, 
  AlertCircle, 
  Clock, 
  Calendar, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

/**
 * Utilitário de formatação de moeda brasileira (BRL)
 */
function formatarMoeda(valor) {
  const num = typeof valor === 'number' ? valor : parseFloat(valor) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

/**
 * Utilitário de formatação de data ISO para DD/MM/AAAA
 */
function formatarData(dataStr) {
  if (!dataStr) return '-';
  try {
    const clean = String(dataStr).split('T')[0].trim();
    const partes = clean.split('-');
    if (partes.length === 3) {
      return `${partes[2].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[0]}`;
    }
    return clean;
  } catch {
    return dataStr;
  }
}

/**
 * Formata telefone brasileiro para exibição
 */
function formatarTelefone(tel) {
  if (!tel) return '';
  const limpo = String(tel).replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return tel;
}

/**
 * Converte valor numérico para string com formato monetário amigável (ex: 250 -> "250,00")
 */
function formatarInputMoeda(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '';
  return num.toFixed(2).replace('.', ',');
}

/**
 * Converte string digitada livremente ("1.250,50", "250,50", "250.50") para Float válido
 */
function converterStringParaFloat(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  let s = String(str).trim();
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s) || 0;
}

/**
 * Trata digitação livre no campo monetário:
 * Permite números, vírgula e ponto, mantendo no máximo 2 casas decimais sem travar
 */
function tratarDigitacaoMoeda(valorDigitado) {
  let limpo = String(valorDigitado).replace(/[^0-9.,]/g, '');
  const sepIdx = limpo.search(/[.,]/);
  if (sepIdx !== -1) {
    const intPart = limpo.slice(0, sepIdx);
    const sep = limpo[sepIdx];
    const decPart = limpo.slice(sepIdx + 1).replace(/[.,]/g, '').slice(0, 2);
    return `${intPart}${sep}${decPart}`;
  }
  return limpo;
}

/**
 * Componente ModalDetalhesEmprestimo
 * Exibe todos os dados do contrato, parcelas, saldos devedores (principal e juros)
 * e permite o registro de pagamentos especiais (juros/rolagem, abatimento de principal e quitação total).
 */
export default function ModalDetalhesEmprestimo({ isOpen, emprestimoId, onClose, onRefresh }) {
  const [emprestimo, setEmprestimo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Estados do Sub-Modal de Pagamento Especial
  const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState('juros'); // 'juros' | 'principal' | 'total'
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().split('T')[0]);
  const [observacao, setObservacao] = useState('');
  const [loadingPagamento, setLoadingPagamento] = useState(false);

  // Carrega detalhes completos do empréstimo
  const carregarDetalhes = useCallback(async () => {
    if (!emprestimoId) return;
    setCarregando(true);
    try {
      if (window.api?.emprestimos?.obterDetalhes) {
        const res = await window.api.emprestimos.obterDetalhes(emprestimoId);
        if (res.success) {
          setEmprestimo(res.data);
        } else {
          alert(res.error || 'Erro ao carregar detalhes do empréstimo.');
        }
      }
    } catch (err) {
      console.error('[ModalDetalhesEmprestimo] Erro:', err);
      alert(err.message || 'Erro ao conectar à API de empréstimos.');
    } finally {
      setCarregando(false);
    }
  }, [emprestimoId]);

  useEffect(() => {
    if (isOpen && emprestimoId) {
      carregarDetalhes();
    }
  }, [isOpen, emprestimoId, carregarDetalhes]);

  // Abre sub-modal de pagamento preenchendo automaticamente com os juros do ciclo
  const abrirModalPagamento = () => {
    if (!emprestimo) return;

    const jurosPadrao = emprestimo.saldo_juros !== undefined && emprestimo.saldo_juros !== null
      ? emprestimo.saldo_juros
      : emprestimo.valor_juros_periodo || (emprestimo.valor_investido * (emprestimo.taxa_juros / 100));

    setTipoPagamento('juros');
    setValorPago(formatarInputMoeda(jurosPadrao));
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setObservacao('');
    setIsPagamentoModalOpen(true);
  };

  // Atualiza automaticamente o valor sugerido ao trocar o tipo de pagamento
  const handleTrocaTipoPagamento = (novoTipo) => {
    setTipoPagamento(novoTipo);
    if (!emprestimo) return;

    if (novoTipo === 'juros') {
      const juros = emprestimo.saldo_juros !== undefined && emprestimo.saldo_juros !== null
        ? emprestimo.saldo_juros
        : emprestimo.valor_juros_periodo || (emprestimo.valor_investido * (emprestimo.taxa_juros / 100));
      setValorPago(formatarInputMoeda(juros));
    } else if (novoTipo === 'principal') {
      const principal = emprestimo.saldo_principal !== undefined && emprestimo.saldo_principal !== null
        ? emprestimo.saldo_principal
        : emprestimo.valor_investido;
      setValorPago(formatarInputMoeda(principal));
    } else if (novoTipo === 'total') {
      const principal = emprestimo.saldo_principal !== undefined && emprestimo.saldo_principal !== null
        ? emprestimo.saldo_principal
        : emprestimo.valor_investido;
      const juros = Number(emprestimo.saldo_juros || 0);
      setValorPago(formatarInputMoeda(principal + juros));
    }
  };

  // Envio da operação para o backend IPC
  const handleConfirmarPagamento = async (e) => {
    if (e) e.preventDefault();
    const numValor = converterStringParaFloat(valorPago);

    if (isNaN(numValor) || numValor <= 0) {
      alert('Por favor, informe um valor numérico válido maior que zero.');
      return;
    }

    setLoadingPagamento(true);
    try {
      if (window.api?.emprestimos?.pagamentoEspecial) {
        const payload = {
          emprestimoId,
          valorPago: numValor,
          tipoPagamento,
          dataPagamento: dataPagamento || new Date().toISOString().split('T')[0],
          observacao: observacao ? observacao.trim() : null
        };

        const res = await window.api.emprestimos.pagamentoEspecial(payload);

        if (res.success) {
          alert('Pagamento registrado com sucesso!');
          setIsPagamentoModalOpen(false);
          setObservacao('');
          await carregarDetalhes();
          if (onRefresh) onRefresh();
        } else {
          alert(res.error || 'Erro ao registrar pagamento especial.');
        }
      } else {
        alert('API window.api.emprestimos.pagamentoEspecial não encontrada.');
      }
    } catch (err) {
      console.error('[ModalDetalhesEmprestimo] Erro ao submeter pagamento especial:', err);
      alert(err.message || 'Falha ao processar pagamento especial.');
    } finally {
      setLoadingPagamento(false);
    }
  };

  // Baixa individual padrão de parcela
  const handleBaixaParcela = async (parcela) => {
    if (!window.confirm(`Confirmar recebimento da Parcela #${parcela.numero_parcela} no valor de ${formatarMoeda(parcela.valor)}?`)) {
      return;
    }
    try {
      if (window.api?.parcelas?.darBaixa) {
        const dataHoje = new Date().toISOString().split('T')[0];
        const res = await window.api.parcelas.darBaixa(parcela.id, dataHoje);
        if (res.success) {
          alert(`Parcela recebida! Entrada de ${formatarMoeda(parcela.valor)} registrada no caixa.`);
          await carregarDetalhes();
          if (onRefresh) onRefresh();
        } else {
          alert(res.error || 'Erro ao dar baixa na parcela.');
        }
      }
    } catch (err) {
      alert(err.message || 'Erro ao dar baixa.');
    }
  };

  // Envio de lembrete de cobrança no WhatsApp
  const handleCobrarWhatsApp = (parcela) => {
    if (!emprestimo?.cliente_telefone) {
      alert(`O cliente "${emprestimo?.cliente_nome}" não possui telefone cadastrado.`);
      return;
    }
    const tel = String(emprestimo.cliente_telefone).replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${emprestimo.cliente_nome}, lembrete da parcela #${parcela.numero_parcela} do seu empréstimo no valor de ${formatarMoeda(parcela.valor)} com vencimento em ${formatarData(parcela.data_vencimento)}.`
    );
    const url = `https://wa.me/55${tel}?text=${mensagem}`;
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  // Próximo vencimento pendente
  const primeiraPendente = emprestimo?.parcelas?.find(p => p.status !== 'pago');
  const proximoVencimento = primeiraPendente ? primeiraPendente.data_vencimento : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white">
                  Detalhes do Empréstimo #{emprestimoId}
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  emprestimo?.status === 'quitado' 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                }`}>
                  {emprestimo?.status === 'quitado' ? 'Quitado' : 'Ativo'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliente: <strong>{emprestimo?.cliente_nome || '...'}</strong> ({formatarTelefone(emprestimo?.cliente_telefone) || 'Sem telefone'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÃO REGISTRAR PAGAMENTO (VISÍVEL APENAS QUANDO ATIVO) */}
            {emprestimo?.status === 'ativo' && (
              <button
                type="button"
                onClick={abrirModalPagamento}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
              >
                <DollarSign className="w-4 h-4" />
                <span>Registrar Pagamento</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {carregando || !emprestimo ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>Carregando dados do contrato...</span>
            </div>
          ) : (
            <>
              {/* CARDS DE SALDOS E VALORES PRINCIPAIS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Saldo Principal</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    {formatarMoeda(emprestimo.saldo_principal !== undefined && emprestimo.saldo_principal !== null ? emprestimo.saldo_principal : emprestimo.valor_investido)}
                  </strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Juros do Período</span>
                  <strong className="text-base font-bold text-amber-600 dark:text-amber-400 font-heading">
                    {formatarMoeda(emprestimo.valor_juros_periodo || (emprestimo.valor_investido * (emprestimo.taxa_juros / 100)))}
                  </strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Vencimento Atual</span>
                  <strong className="text-base font-bold text-blue-600 dark:text-blue-400 font-heading">
                    {proximoVencimento ? formatarData(proximoVencimento) : 'Sem pendências'}
                  </strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Taxa / Frequência</span>
                  <strong className="text-base font-bold text-slate-900 dark:text-white font-heading capitalize">
                    {emprestimo.taxa_juros}% ({emprestimo.frequencia})
                  </strong>
                </div>
              </div>

              {/* SEGUNDA LINHA DE RESUMO: INVESTIDO / RECEBIDO / PENDENTE */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Valor Original Investido</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {formatarMoeda(emprestimo.valor_investido)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Total Já Recebido</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(emprestimo.valor_total_pago)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Total a Receber</span>
                  <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {formatarMoeda(emprestimo.valor_total_pendente)}
                  </span>
                </div>
              </div>

              {/* TABELA DE PARCELAS */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Cronograma de Parcelas do Contrato
                </h4>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-400 uppercase">
                      <tr>
                        <th className="py-3 px-3.5"># Parcela</th>
                        <th className="py-3 px-3.5">Vencimento</th>
                        <th className="py-3 px-3.5">Valor Nominal</th>
                        <th className="py-3 px-3.5">Valor Pago</th>
                        <th className="py-3 px-3.5">Saldo Devedor</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {emprestimo.parcelas?.map((parcela) => {
                        const isPago = parcela.status === 'pago';
                        const dataVenc = parcela.data_vencimento ? parcela.data_vencimento.split('T')[0] : '';
                        const dataHoje = new Date().toISOString().split('T')[0];
                        const isAtrasada = !isPago && dataVenc < dataHoje;

                        return (
                          <tr key={parcela.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-3.5 font-bold text-slate-800 dark:text-slate-200">
                              {parcela.numero_parcela}ª Parcela
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                              {formatarData(parcela.data_vencimento)}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                              {formatarMoeda(parcela.valor)}
                            </td>
                            <td className="py-3 px-3.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                              {formatarMoeda(parcela.valor_pago || (isPago ? parcela.valor : 0))}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                              {formatarMoeda(parcela.saldo_devedor !== undefined ? parcela.saldo_devedor : (isPago ? 0 : parcela.valor))}
                            </td>
                            <td className="py-3 px-3.5">
                              {isPago ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Pago
                                </span>
                              ) : isAtrasada ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  <AlertCircle className="w-3 h-3" />
                                  Atrasada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isPago && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleCobrarWhatsApp(parcela)}
                                      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition-all"
                                      title="Cobrar no WhatsApp com PIX"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleBaixaParcela(parcela)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Baixar</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HISTÓRICO DE PAGAMENTOS / ROLAGENS (SE HOUVER) */}
              {emprestimo.pagamentos_parciais && emprestimo.pagamentos_parciais.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Histórico de Pagamentos Especiais / Rolagens</span>
                  </h4>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Valor Pago</th>
                          <th className="py-2.5 px-3">Observação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                        {emprestimo.pagamentos_parciais.map((pag) => (
                          <tr key={pag.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                            <td className="py-2 px-3 font-medium">{formatarData(pag.data_pagamento)}</td>
                            <td className="py-2 px-3 font-semibold capitalize">
                              {pag.tipo_pagamento === 'juros' && <span className="text-amber-500">Juros (Rolagem)</span>}
                              {pag.tipo_pagamento === 'principal' && <span className="text-blue-500">Amortização Principal</span>}
                              {pag.tipo_pagamento === 'total' && <span className="text-emerald-500">Quitação Total</span>}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                              {formatarMoeda(pag.valor_pago)}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                              {pag.observacao || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* ======================================================== */}
      {/* SUB-MODAL DE REGISTRO DE PAGAMENTO ESPECIAL              */}
      {/* ======================================================== */}
      {isPagamentoModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Header do Sub-modal */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Registrar Pagamento
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Contrato #{emprestimoId} — {emprestimo?.cliente_nome}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPagamentoModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário do Sub-modal */}
            <form onSubmit={handleConfirmarPagamento} className="p-5 space-y-4">
              
              {/* Campo Tipo de Pagamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Tipo de Pagamento
                </label>
                <select
                  value={tipoPagamento}
                  onChange={(e) => handleTrocaTipoPagamento(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                >
                  <option value="juros">Apenas Juros (Rolagem de Dívida)</option>
                  <option value="principal">Abater do Principal</option>
                  <option value="total">Quitar Tudo</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {tipoPagamento === 'juros' && 'Renova a dívida adiando a data de vencimento e lançando os juros no caixa.'}
                  {tipoPagamento === 'principal' && 'Amortiza o saldo investido original e reduz as parcelas pendentes.'}
                  {tipoPagamento === 'total' && 'Liquida totalmente o contrato e encerra todas as parcelas pendentes.'}
                </p>
              </div>

              {/* Campo Valor Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Valor Pago (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={valorPago}
                  onChange={(e) => setValorPago(tratarDigitacaoMoeda(e.target.value))}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Campo Data do Pagamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Data do Pagamento
                </label>
                <input
                  type="date"
                  required
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Campo Observação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Observação (Opcional)
                </label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Pago via PIX pelo tomador"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Botões de Ação do Formulário */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPagamentoModalOpen(false)}
                  disabled={loadingPagamento}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loadingPagamento}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {loadingPagamento ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar Pagamento</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
