import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  DollarSign, 
  AlertTriangle, 
  Calendar,
  Loader2,
  Clock,
  ArrowRight,
  MessageCircle,
  Users
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

export default function DashboardView() {
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [parcelasAmanha, setParcelasAmanha] = useState([]);
  const [chavePix, setChavePix] = useState('');

  const carregarDashboard = useCallback(async () => {
    setCarregando(true);
    try {
      if (window.api?.dashboard?.obterResumo) {
        const res = await window.api.dashboard.obterResumo();
        if (res && res.success) {
          setResumo(res.data);
        } else if (res && typeof res === 'object' && !res.error) {
          setResumo(res);
        }
      }

      if (window.api?.parcelas?.listar) {
        const resP = await window.api.parcelas.listar({ apenasAmanha: true });
        if (resP && resP.success) {
          setParcelasAmanha(resP.data || []);
        } else if (Array.isArray(resP)) {
          setParcelasAmanha(resP);
        } else {
          setParcelasAmanha([]);
        }
      }

      if (window.api?.auth?.obterConfiguracoes) {
        const resCfg = await window.api.auth.obterConfiguracoes();
        if (resCfg && resCfg.success && resCfg.data?.chave_pix) {
          setChavePix(resCfg.data.chave_pix);
        } else if (resCfg?.chave_pix) {
          setChavePix(resCfg.chave_pix);
        }
      }
    } catch (err) {
      console.error('[DashboardView] Erro ao carregar resumo:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  // Ação de cobrança via WhatsApp
  const handleCobrarWhatsApp = (parcela, e) => {
    if (e) e.stopPropagation();

    const telLimpo = String(parcela.cliente_telefone || '').replace(/\D/g, '');
    if (!telLimpo || telLimpo.length < 10) {
      toast.error(`O cliente "${parcela.cliente_nome}" não possui telefone válido cadastrado.`);
      return;
    }

    const numeroLimpo = (telLimpo.startsWith('55') && (telLimpo.length === 12 || telLimpo.length === 13)) 
      ? telLimpo.slice(2) 
      : telLimpo;

    const valorFmt = formatarMoeda(parcela.valor);
    const pixTexto = chavePix ? ` Chave PIX: ${chavePix}.` : '';
    const mensagem = `Olá ${parcela.cliente_nome}! Passando para lembrar que sua parcela no valor de ${valorFmt} vence amanhã.${pixTexto} Qualquer dúvida, estamos à disposição!`;

    const url = `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  // Valores reais ou fallback
  const saldoCaixa = resumo?.saldoCaixa ?? 0;
  const capitalEmprestado = resumo?.capitalEmprestado ?? 0;
  const totalAReceber = resumo?.totalAReceber ?? 0;
  const lucroPrevisto = resumo?.lucroPrevisto ?? 0;
  const totalInadimplente = resumo?.inadimplencia?.totalValorInadimplente ?? 0;
  const qtdInadimplentes = resumo?.inadimplencia?.totalQtd ?? 0;

  if (carregando && !resumo) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
        <Loader2 size={36} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium">Atualizando indicadores do painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 5 Cards do Topo com cores responsivas no Modo Light e Dark */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Saldo em Caixa */}
        <div className="bg-white dark:bg-[#111827] border-t-2 border-t-emerald-500 rounded-2xl p-5 border-x border-b border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Saldo em Caixa
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <Wallet size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-heading">
            {formatarMoeda(saldoCaixa)}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Disponível para novos empréstimos
          </p>
        </div>

        {/* 2. Capital Emprestado */}
        <div className="bg-white dark:bg-[#111827] border-t-2 border-t-blue-500 rounded-2xl p-5 border-x border-b border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Capital Emprestado
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-heading">
            {formatarMoeda(capitalEmprestado)}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Capital ativo em circulação
          </p>
        </div>

        {/* 3. Total a Receber */}
        <div className="bg-white dark:bg-[#111827] border-t-2 border-t-purple-500 rounded-2xl p-5 border-x border-b border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total a Receber
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-heading">
            {formatarMoeda(totalAReceber)}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Principal + Juros futuros
          </p>
        </div>

        {/* 4. Lucro Previsto */}
        <div className="bg-white dark:bg-[#111827] border-t-2 border-t-amber-500 rounded-2xl p-5 border-x border-b border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Lucro Previsto
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <DollarSign size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-heading">
            {formatarMoeda(lucroPrevisto)}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Rendimento dos contratos ativos
          </p>
        </div>

        {/* 5. Inadimplência */}
        <div className="bg-white dark:bg-[#111827] border-t-2 border-t-rose-500 rounded-2xl p-5 border-x border-b border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Inadimplência
            </span>
            <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <AlertTriangle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-heading">
            {formatarMoeda(totalInadimplente)}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {qtdInadimplentes} tomador(es) em atraso
          </p>
        </div>
      </div>

      {/* Card de Lembrete Prévio de Vencimento com suporte completo a Light e Dark */}
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 font-heading">
              Lembrete Prévio de Vencimento
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                Vencimento Amanhã
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Notificação amigável com valor, data e chave PIX para envio prévio no WhatsApp
            </p>
          </div>
        </div>

        {parcelasAmanha.length === 0 ? (
          <div className="border border-dashed border-gray-300 dark:border-gray-700/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50/70 dark:bg-[#0b0f19]/50">
            <Calendar size={32} className="mb-2 text-gray-400 dark:text-gray-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Nenhuma parcela programada para vencer amanhã!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Quando houverem parcelas com vencimento no dia seguinte, elas aparecerão listadas aqui para disparo rápido.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {parcelasAmanha.map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    {item.cliente_nome ? item.cliente_nome.charAt(0) : '#'}
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.cliente_nome}
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Parcela {item.numero_parcela}/{item.total_parcelas} — Vence amanhã ({formatarData(item.data_vencimento)})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {formatarMoeda(item.valor)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCobrarWhatsApp(item, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs hover:scale-[1.02] active:scale-95 transition-all duration-200"
                    title="Cobrar no WhatsApp"
                  >
                    <MessageCircle size={14} />
                    <span>Cobrar no WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
