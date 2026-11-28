import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  CalendarClock, 
  Search, 
  CheckCircle2, 
  MessageCircle, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Loader2, 
  X,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { formatarMoeda } from '../utils/moeda';

function formatarData(dataStr) {
  if (!dataStr) return '-';
  try {
    const clean = String(dataStr).split('T')[0].trim();
    const partes = clean.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
}

function limparTelefone(tel) {
  if (!tel) return '';
  return String(tel).replace(/\D/g, '');
}

export default function ParcelasView() {
  const [parcelas, setParcelas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('vencidas'); // 'vencidas' | 'avencer' | 'pagas'
  const [busca, setBusca] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [baixandoId, setBaixandoId] = useState(null);

  // Carrega configuração de PIX
  useEffect(() => {
    async function carregarConfig() {
      try {
        if (window.api?.auth?.obterConfiguracoes) {
          const res = await window.api.auth.obterConfiguracoes();
          if (res && res.success && res.data?.chave_pix) {
            setChavePix(res.data.chave_pix);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    carregarConfig();
  }, []);

  // Carrega parcelas
  const carregarParcelas = useCallback(async () => {
    setCarregando(true);
    try {
      if (window.api?.parcelas?.listar) {
        const res = await window.api.parcelas.listar();
        if (res && res.success) {
          setParcelas(res.data || []);
        } else if (Array.isArray(res)) {
          setParcelas(res);
        } else {
          setParcelas([]);
        }
      }
    } catch (err) {
      console.error('[ParcelasView] Erro ao carregar parcelas:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarParcelas();
  }, [carregarParcelas]);

  // Ação de dar baixa
  const handleDarBaixa = (parcela, e) => {
    if (e) e.stopPropagation();
    
    toast(`Confirmar o recebimento da Parcela #${parcela.numero_parcela}?`, {
      description: `${parcela.cliente_nome} - ${formatarMoeda(parcela.valor)}`,
      action: {
        label: 'Confirmar',
        onClick: async () => {
          setBaixandoId(parcela.id);
          try {
            if (window.api?.parcelas?.darBaixa) {
              const hoje = new Date().toISOString().split('T')[0];
              const res = await window.api.parcelas.darBaixa(parcela.id, hoje);
              if (res && (res.success || res.success !== false)) {
                toast.success(`Parcela baixada com sucesso! Entrada de ${formatarMoeda(parcela.valor)} lançada no caixa.`);
                await carregarParcelas();
              } else {
                toast.error(res?.error || 'Erro ao dar baixa na parcela.');
              }
            }
          } catch (err) {
            console.error(err);
            toast.error(err.message || 'Falha ao processar baixa.');
          } finally {
            setBaixandoId(null);
          }
        }
      },
      cancel: {
        label: 'Cancelar'
      }
    });
  };

  // Disparo de mensagem no WhatsApp
  const handleCobrarWhatsApp = async (parcela, e) => {
    if (e) e.stopPropagation();

    const telLimpo = limparTelefone(parcela.cliente_telefone);
    if (!telLimpo || telLimpo.length < 10) {
      toast.error(`O cliente "${parcela.cliente_nome}" não possui telefone válido cadastrado.`);
      return;
    }

    const ddiTel = (telLimpo.length === 10 || telLimpo.length === 11) ? `55${telLimpo}` : telLimpo;
    const valorFmt = formatarMoeda(parcela.valor);
    const dataFmt = formatarData(parcela.data_vencimento);
    const pixTexto = chavePix ? ` Chave PIX: ${chavePix}.` : '';

    let textoMensagem = '';
    if (parcela.is_vencida || (parcela.status === 'pendente' && new Date(parcela.data_vencimento) < new Date())) {
      textoMensagem = `Olá ${parcela.cliente_nome}, tudo bem? Constatamos que a parcela ${parcela.numero_parcela}/${parcela.total_parcelas} do seu empréstimo, no valor de ${valorFmt}, venceu em ${dataFmt}.${pixTexto} Por favor, envie o comprovante assim que efetuar o pagamento. Obrigado!`;
    } else {
      textoMensagem = `Olá ${parcela.cliente_nome}, tudo bem? Passando para lembrar que a parcela ${parcela.numero_parcela}/${parcela.total_parcelas} do seu empréstimo, no valor de ${valorFmt}, vence em ${dataFmt}.${pixTexto} Qualquer dúvida, estamos à disposição!`;
    }

    const link = `https://wa.me/${ddiTel}?text=${encodeURIComponent(textoMensagem)}`;

    try {
      if (window.api?.shell?.openExternal) {
        await window.api.shell.openExternal(link);
      } else {
        window.open(link, '_blank');
      }
    } catch (err) {
      console.error(err);
      window.open(link, '_blank');
    }
  };

  // Separação de parcelas por categoria
  const hojeStr = new Date().toISOString().split('T')[0];

  const parcelasClassificadas = useMemo(() => {
    const vencidas = [];
    const aVencer = [];
    const pagas = [];

    parcelas.forEach((p) => {
      if (p.status === 'pago') {
        pagas.push(p);
      } else {
        // Pendente: verifica se já venceu
        const dataVenc = String(p.data_vencimento).split('T')[0];
        if (dataVenc < hojeStr || p.is_vencida === 1) {
          vencidas.push(p);
        } else {
          aVencer.push(p);
        }
      }
    });

    return { vencidas, aVencer, pagas };
  }, [parcelas, hojeStr]);

  // Filtro de acordo com a aba ativa e busca
  const listaExibicao = useMemo(() => {
    let base = [];
    if (abaAtiva === 'vencidas') base = parcelasClassificadas.vencidas;
    else if (abaAtiva === 'avencer') base = parcelasClassificadas.aVencer;
    else if (abaAtiva === 'pagas') base = parcelasClassificadas.pagas;

    const termo = busca.toLowerCase().trim();
    if (!termo) return base;

    return base.filter((p) => {
      const matchCliente = p.cliente_nome && p.cliente_nome.toLowerCase().includes(termo);
      const matchEmp = String(p.emprestimo_id).includes(termo);
      const matchParc = String(p.numero_parcela).includes(termo);
      return matchCliente || matchEmp || matchParc;
    });
  }, [abaAtiva, parcelasClassificadas, busca]);

  // Totais financeiros por aba
  const totalVencidoValor = parcelasClassificadas.vencidas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const totalAVencerValor = parcelasClassificadas.aVencer.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const totalPagoValor = parcelasClassificadas.pagas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Topo: KPIs de Cobrança */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Vencidas */}
        <div 
          onClick={() => setAbaAtiva('vencidas')}
          className={`p-5 rounded-2xl bg-white dark:bg-[#111827] border cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xs ${
            abaAtiva === 'vencidas' 
              ? 'border-rose-500/50 ring-2 ring-rose-500/20' 
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Parcelas Vencidas</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-heading">
            {formatarMoeda(totalVencidoValor)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {parcelasClassificadas.vencidas.length} parcela(s) em atraso
          </p>
        </div>

        {/* A Vencer */}
        <div 
          onClick={() => setAbaAtiva('avencer')}
          className={`p-5 rounded-2xl bg-white dark:bg-[#111827] border cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xs ${
            abaAtiva === 'avencer' 
              ? 'border-blue-500/50 ring-2 ring-blue-500/20' 
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-500">A Vencer</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Clock size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2 font-heading">
            {formatarMoeda(totalAVencerValor)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {parcelasClassificadas.aVencer.length} parcela(s) futuras programadas
          </p>
        </div>

        {/* Pagas */}
        <div 
          onClick={() => setAbaAtiva('pagas')}
          className={`p-5 rounded-2xl bg-white dark:bg-[#111827] border cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-xs ${
            abaAtiva === 'pagas' 
              ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' 
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Recebidas / Pagas</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-heading">
            {formatarMoeda(totalPagoValor)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {parcelasClassificadas.pagas.length} parcela(s) liquidadas
          </p>
        </div>
      </div>

      {/* Barra de Filtros: Abas + Busca */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Abas */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setAbaAtiva('vencidas')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              abaAtiva === 'vencidas'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Vencidas ({parcelasClassificadas.vencidas.length})
          </button>

          <button
            onClick={() => setAbaAtiva('avencer')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              abaAtiva === 'avencer'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            A Vencer ({parcelasClassificadas.aVencer.length})
          </button>

          <button
            onClick={() => setAbaAtiva('pagas')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              abaAtiva === 'pagas'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Pagas ({parcelasClassificadas.pagas.length})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative flex-1 md:w-80 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por tomador ou contrato..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Parcelas */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        {carregando ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Buscando parcelas...</p>
          </div>
        ) : listaExibicao.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-1">
              <CalendarClock size={24} />
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">Nenhuma parcela encontrada</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              Não existem parcelas na categoria selecionada ({abaAtiva}) para os filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-6">Cliente</th>
                  <th className="py-3.5 px-4">Contrato</th>
                  <th className="py-3.5 px-4">Nº Parcela</th>
                  <th className="py-3.5 px-4">Valor</th>
                  <th className="py-3.5 px-4">Vencimento</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {listaExibicao.map((parcela) => {
                  const estaPaga = parcela.status === 'pago';
                  const dataVenc = String(parcela.data_vencimento).split('T')[0];
                  const estaVencida = !estaPaga && (dataVenc < hojeStr || parcela.is_vencida === 1);
                  const venceHoje = !estaPaga && dataVenc === hojeStr;

                  return (
                    <tr
                      key={parcela.id}
                      className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-all duration-200"
                    >
                      {/* Cliente */}
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {parcela.cliente_nome || 'Cliente'}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {parcela.cliente_telefone || 'Sem telefone'}
                          </p>
                        </div>
                      </td>

                      {/* Contrato */}
                      <td className="py-4 px-4 text-xs font-mono text-gray-600 dark:text-gray-300">
                        #{parcela.emprestimo_id}
                      </td>

                      {/* Número da Parcela */}
                      <td className="py-4 px-4">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                          Parcela {parcela.numero_parcela}/{parcela.total_parcelas || '?'}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">
                        {formatarMoeda(parcela.valor)}
                      </td>

                      {/* Vencimento */}
                      <td className="py-4 px-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span className={estaVencida ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-300'}>
                            {formatarData(parcela.data_vencimento)}
                          </span>
                        </div>
                        {estaPaga && parcela.data_pagamento && (
                          <p className="text-[10px] text-emerald-500 mt-0.5">
                            Pago em {formatarData(parcela.data_pagamento)}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          estaPaga
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : estaVencida
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : venceHoje
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            estaPaga
                              ? 'bg-emerald-500'
                              : estaVencida
                              ? 'bg-rose-500'
                              : venceHoje
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`} />
                          {estaPaga ? 'Paga' : estaVencida ? 'Vencida' : venceHoje ? 'Vence Hoje' : 'A Vencer'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botão de WhatsApp */}
                          {!estaPaga && (
                            <button
                              type="button"
                              onClick={(e) => handleCobrarWhatsApp(parcela, e)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold shadow-xs hover:scale-105 active:scale-95 transition-all duration-200"
                              title="Cobrança / Lembrete via WhatsApp"
                            >
                              <MessageCircle size={14} />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                          )}

                          {/* Botão Dar Baixa */}
                          {!estaPaga && (
                            <button
                              type="button"
                              onClick={(e) => handleDarBaixa(parcela, e)}
                              disabled={baixandoId === parcela.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50"
                            >
                              {baixandoId === parcela.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              <span>Dar Baixa</span>
                            </button>
                          )}

                          {estaPaga && (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={14} />
                              <span>Quitada</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
