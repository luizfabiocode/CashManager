import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Search, 
  Calendar, 
  Loader2, 
  X, 
  CheckCircle2, 
  Filter,
  DollarSign
} from 'lucide-react';
import { 
  formatarMoeda, 
  handleMoedaChange, 
  parseMoedaParaFloat, 
  prevenirEnter 
} from '../utils/moeda';

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

export default function CaixaView() {
  const [saldo, setSaldo] = useState(0);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'entrada' | 'saida'

  // Sub-modal Nova Movimentação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [salvandoMov, setSalvandoMov] = useState(false);
  const [novoTipo, setNovoTipo] = useState('entrada');
  const [novoValor, setNovoValor] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaData, setNovaData] = useState(() => new Date().toISOString().split('T')[0]);

  // Carrega Saldo e Extrato
  const carregarDadosCaixa = useCallback(async () => {
    setCarregando(true);
    try {
      if (window.api?.caixa) {
        const [resSaldo, resExtrato] = await Promise.all([
          window.api.caixa.obterSaldo(),
          window.api.caixa.obterExtrato()
        ]);

        if (resSaldo && resSaldo.success) {
          setSaldo(resSaldo.data || 0);
        } else if (typeof resSaldo === 'number') {
          setSaldo(resSaldo);
        }

        if (resExtrato && resExtrato.success) {
          setMovimentacoes(resExtrato.data?.movimentacoes || []);
          if (resExtrato.data?.saldoAtual !== undefined) {
            setSaldo(resExtrato.data.saldoAtual);
          }
        } else if (resExtrato?.movimentacoes) {
          setMovimentacoes(resExtrato.movimentacoes);
        } else if (Array.isArray(resExtrato)) {
          setMovimentacoes(resExtrato);
        }
      }
    } catch (err) {
      console.error('[CaixaView] Erro ao carregar caixa:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosCaixa();
  }, [carregarDadosCaixa]);

  // Salvar nova movimentação
  const handleSalvarMovimentacao = async (e) => {
    e.preventDefault();
    const val = parseMoedaParaFloat(novoValor);
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor numérico válido maior que zero.');
      return;
    }

    if (!novaDescricao.trim()) {
      toast.error('Informe uma descrição para a movimentação.');
      return;
    }

    setSalvandoMov(true);
    try {
      if (window.api?.caixa?.registrarMovimentacao) {
        const res = await window.api.caixa.registrarMovimentacao({
          tipo: novoTipo,
          valor: val,
          descricao: novaDescricao.trim(),
          data: novaData
        });

        if (res && (res.success || res.id)) {
          setIsModalOpen(false);
          setNovoValor('');
          setNovaDescricao('');
          toast.success('Movimentação registrada com sucesso!');
          await carregarDadosCaixa();
        } else {
          toast.error(res?.error || 'Erro ao registrar movimentação.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Falha ao processar movimentação.');
    } finally {
      setSalvandoMov(false);
    }
  };

  // Totais de entradas e saídas
  const totais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;

    movimentacoes.forEach((m) => {
      const v = Number(m.valor) || 0;
      if (m.tipo === 'entrada') entradas += v;
      else if (m.tipo === 'saida') saidas += v;
    });

    return { entradas, saidas };
  }, [movimentacoes]);

  // Filtro de lista
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter((m) => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (busca) {
        const termo = busca.toLowerCase().trim();
        const matchDesc = m.descricao && m.descricao.toLowerCase().includes(termo);
        const matchValor = String(m.valor).includes(termo);
        return matchDesc || matchValor;
      }
      return true;
    });
  }, [movimentacoes, filtroTipo, busca]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Topo: 3 Cards (Saldo em verde, Entradas em azul, Saídas em vermelho) com efeito hover */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card Saldo em Caixa (Verde) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Saldo em Caixa
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200">
              <Wallet size={20} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-heading">
            {formatarMoeda(saldo)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Disponibilidade imediata para novos empréstimos
          </p>
        </div>

        {/* Card Entradas (Azul) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Total de Entradas
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2 font-heading">
            {formatarMoeda(totais.entradas)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Recebimento de parcelas e aportes manuais
          </p>
        </div>

        {/* Card Saídas (Vermelho) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.02] transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Total de Saídas
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-200">
              <ArrowUpRight size={20} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-heading">
            {formatarMoeda(totais.saidas)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Empréstimos concedidos e retiradas
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Ações */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Filtros de Tipo */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              filtroTipo === 'todos'
                ? 'bg-white dark:bg-[#111827] text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Todas ({movimentacoes.length})
          </button>

          <button
            onClick={() => setFiltroTipo('entrada')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              filtroTipo === 'entrada'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Entradas
          </button>

          <button
            onClick={() => setFiltroTipo('saida')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              filtroTipo === 'saida'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Saídas
          </button>
        </div>

        {/* Busca e Botão Nova Movimentação */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setNovoTipo('entrada');
              setNovoValor('');
              setNovaDescricao('');
              setNovaData(new Date().toISOString().split('T')[0]);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0"
          >
            <Plus size={15} />
            <span>Nova Movimentação</span>
          </button>
        </div>
      </div>

      {/* Tabela de Extrato */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        {carregando ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Carregando extrato de movimentações...</p>
          </div>
        ) : movimentacoesFiltradas.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-1">
              <Wallet size={24} />
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">Nenhuma movimentação registrada</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              Lance aportes ou saídas manuais pelo botão "Nova Movimentação" acima.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-6">Data</th>
                  <th className="py-3.5 px-6">Descrição</th>
                  <th className="py-3.5 px-4 text-center">Tipo</th>
                  <th className="py-3.5 px-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {movimentacoesFiltradas.map((mov) => {
                  const isEntrada = mov.tipo === 'entrada';

                  return (
                    <tr
                      key={mov.id}
                      className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-all duration-200"
                    >
                      {/* Data */}
                      <td className="py-4 px-6 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{formatarData(mov.data)}</span>
                        </div>
                      </td>

                      {/* Descrição */}
                      <td className="py-4 px-6 font-medium text-gray-900 dark:text-white">
                        {mov.descricao}
                      </td>

                      {/* Tipo */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          isEntrada
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}>
                          {isEntrada ? (
                            <>
                              <ArrowDownLeft size={12} />
                              <span>Entrada</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={12} />
                              <span>Saída</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className={`py-4 px-6 text-right font-bold text-sm ${
                        isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {isEntrada ? `+ ${formatarMoeda(mov.valor)}` : `- ${formatarMoeda(mov.valor)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sub-modal: Nova Movimentação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${novoTipo === 'entrada' ? 'bg-blue-500/10 text-blue-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-gray-900 dark:text-white">Nova Movimentação</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lançamento de aporte, retirada ou despesa</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarMovimentacao} onKeyDown={prevenirEnter} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Tipo de Movimentação *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNovoTipo('entrada')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                      novoTipo === 'entrada'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <ArrowDownLeft size={14} /> Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoTipo('saida')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                      novoTipo === 'saida'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <ArrowUpRight size={14} /> Saída
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Valor (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={novoValor}
                  onChange={(e) => handleMoedaChange(e, setNovoValor)}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Descrição do Lançamento *
                </label>
                <input
                  type="text"
                  required
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Aporte inicial de capital"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Data da Movimentação *
                </label>
                <input
                  type="date"
                  required
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={salvandoMov}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoMov}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {salvandoMov ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>{salvandoMov ? 'Salvando...' : 'Confirmar Lançamento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
