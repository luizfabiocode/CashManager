import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CircleDollarSign, 
  Plus, 
  Search, 
  Eye, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X,
  Clock,
  DollarSign
} from 'lucide-react';
import ModalDetalhesEmprestimo from '../components/modals/ModalDetalhesEmprestimo';

function formatarMoeda(valor) {
  const num = typeof valor === 'number' ? valor : parseFloat(valor) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

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

export default function EmprestimosView() {
  const [emprestimos, setEmprestimos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('ativos'); // 'ativos' | 'quitados' | 'todos'
  const [busca, setBusca] = useState('');

  // Modal Detalhes do Empréstimo
  const [emprestimoDetalhesId, setEmprestimoDetalhesId] = useState(null);
  const [isDetalhesOpen, setIsDetalhesOpen] = useState(false);

  // Modal Novo Empréstimo
  const [isNovoEmprestimoOpen, setIsNovoEmprestimoOpen] = useState(false);
  const [clientesDisponiveis, setClientesDisponiveis] = useState([]);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('20');
  const [novasParcelas, setNovasParcelas] = useState('1');
  const [novaFrequencia, setNovaFrequencia] = useState('mensal');
  const [novaDataInicio, setNovaDataInicio] = useState(() => new Date().toISOString().split('T')[0]);

  // Carrega lista de empréstimos
  const carregarEmprestimos = useCallback(async () => {
    setCarregando(true);
    try {
      if (window.api?.emprestimos?.listar) {
        const res = await window.api.emprestimos.listar();
        if (res && res.success) {
          setEmprestimos(res.data || []);
        } else if (Array.isArray(res)) {
          setEmprestimos(res);
        } else {
          setEmprestimos([]);
        }
      }
    } catch (err) {
      console.error('[EmprestimosView] Erro ao carregar empréstimos:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carrega clientes para o dropdown do novo empréstimo
  const carregarClientesDropdown = async () => {
    try {
      if (window.api?.clientes?.listar) {
        const res = await window.api.clientes.listar();
        const lista = res && res.success ? res.data : (Array.isArray(res) ? res : []);
        setClientesDisponiveis(lista);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    carregarEmprestimos();
  }, [carregarEmprestimos]);

  // Abre modal de detalhes
  const handleAbrirDetalhes = (id, e) => {
    if (e) e.stopPropagation();
    setEmprestimoDetalhesId(id);
    setIsDetalhesOpen(true);
  };

  // Abre modal de novo empréstimo
  const handleAbrirNovoEmprestimo = async () => {
    await carregarClientesDropdown();
    setNovoClienteId('');
    setNovoValor('');
    setNovaTaxa('20');
    setNovasParcelas('1');
    setNovaFrequencia('mensal');
    setNovaDataInicio(new Date().toISOString().split('T')[0]);
    setIsNovoEmprestimoOpen(true);
  };

  // Submissão do novo empréstimo
  const handleSalvarNovoEmprestimo = async (e) => {
    e.preventDefault();
    if (!novoClienteId) {
      alert('Selecione um cliente.');
      return;
    }
    const val = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor de investimento válido maior que zero.');
      return;
    }

    setSalvandoNovo(true);
    try {
      if (window.api?.emprestimos?.criar) {
        const payload = {
          clienteId: Number(novoClienteId),
          valorInvestido: val,
          taxaJuros: parseFloat(novaTaxa) || 0,
          parcelas: parseInt(novasParcelas, 10) || 1,
          frequencia: novaFrequencia,
          dataInicio: novaDataInicio
        };
        const res = await window.api.emprestimos.criar(payload);
        if (res && (res.success || res.id)) {
          alert('Empréstimo contratado com sucesso!');
          setIsNovoEmprestimoOpen(false);
          await carregarEmprestimos();
        } else {
          alert(res?.error || 'Erro ao contratar empréstimo.');
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Falha ao registrar empréstimo.');
    } finally {
      setSalvandoNovo(false);
    }
  };

  // Filtro por abas e busca
  const emprestimosFiltrados = useMemo(() => {
    return emprestimos.filter((emp) => {
      // Filtro de aba
      if (abaAtiva === 'ativos' && emp.status !== 'ativo') return false;
      if (abaAtiva === 'quitados' && emp.status !== 'quitado') return false;

      // Filtro de busca
      const termo = busca.toLowerCase().trim();
      if (!termo) return true;

      const matchCliente = emp.cliente_nome && emp.cliente_nome.toLowerCase().includes(termo);
      const matchCpf = emp.cliente_cpf && emp.cliente_cpf.includes(termo);
      const matchId = String(emp.id).includes(termo);
      return matchCliente || matchCpf || matchId;
    });
  }, [emprestimos, abaAtiva, busca]);

  // Contadores
  const contadores = useMemo(() => {
    const ativos = emprestimos.filter(e => e.status === 'ativo');
    const quitados = emprestimos.filter(e => e.status === 'quitado');
    const totalInvestidoAtivo = ativos.reduce((acc, cur) => acc + (Number(cur.valor_investido) || 0), 0);
    const totalPendente = ativos.reduce((acc, cur) => acc + (Number(cur.valor_pendente) || 0), 0);

    return {
      total: emprestimos.length,
      ativosCount: ativos.length,
      quitadosCount: quitados.length,
      totalInvestidoAtivo,
      totalPendente
    };
  }, [emprestimos]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Topo: KPIs de Empréstimos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Capital Ativo em Giro</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CircleDollarSign size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 font-heading">
            {formatarMoeda(contadores.totalInvestidoAtivo)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {contadores.ativosCount} contrato(s) em andamento
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total a Receber</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-heading">
            {formatarMoeda(contadores.totalPendente)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Principal + Juros futuros de parcelas pendentes
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Contratos Quitados</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-heading">
            {contadores.quitadosCount}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Liquidados e encerrados com sucesso
          </p>
        </div>
      </div>

      {/* Barra de Filtros: Abas + Busca + Botão Novo */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Abas */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setAbaAtiva('ativos')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              abaAtiva === 'ativos'
                ? 'bg-white dark:bg-[#111827] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Ativos ({contadores.ativosCount})
          </button>

          <button
            onClick={() => setAbaAtiva('quitados')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              abaAtiva === 'quitados'
                ? 'bg-white dark:bg-[#111827] text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Quitados ({contadores.quitadosCount})
          </button>

          <button
            onClick={() => setAbaAtiva('todos')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              abaAtiva === 'todos'
                ? 'bg-white dark:bg-[#111827] text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Todos ({contadores.total})
          </button>
        </div>

        {/* Busca e Novo Empréstimo */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou Nº..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={handleAbrirNovoEmprestimo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0"
          >
            <Plus size={15} />
            <span>Novo Empréstimo</span>
          </button>
        </div>
      </div>

      {/* Tabela de Empréstimos */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        {carregando ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando carteira de empréstimos...</p>
          </div>
        ) : emprestimosFiltrados.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-1">
              <CircleDollarSign size={24} />
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">Nenhum contrato encontrado</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              Não há empréstimos correspondentes à aba ou termo de busca selecionado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-6">Contrato / Cliente</th>
                  <th className="py-3.5 px-4">Valor Emprestado</th>
                  <th className="py-3.5 px-4">Taxa / Rendimento</th>
                  <th className="py-3.5 px-4">Parcelas / Progresso</th>
                  <th className="py-3.5 px-4">Início</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {emprestimosFiltrados.map((emp) => {
                  const qtdTotal = Number(emp.total_parcelas_count || emp.parcelas) || 1;
                  const qtdPagas = Number(emp.parcelas_pagas_count) || 0;
                  const temAtraso = Number(emp.parcelas_atrasadas_count) > 0;
                  const pct = Math.min(100, Math.round((qtdPagas / qtdTotal) * 100));

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => handleAbrirDetalhes(emp.id)}
                      className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-200"
                    >
                      {/* Cliente e ID */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            #{emp.id}
                          </span>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                              {emp.cliente_nome || 'Cliente não identificado'}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              {emp.frequencia ? emp.frequencia.toUpperCase() : 'MENSAL'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Valor Emprestado */}
                      <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">
                        {formatarMoeda(emp.valor_investido)}
                      </td>

                      {/* Taxa de Juros */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{emp.taxa_juros}%</span>
                          <span className="text-[10px] text-gray-400">ao período</span>
                        </div>
                      </td>

                      {/* Progresso de Parcelas */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5 w-36">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              {qtdPagas}/{qtdTotal} pagas
                            </span>
                            <span className="text-[10px] text-gray-400">{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                emp.status === 'quitado' 
                                  ? 'bg-emerald-500' 
                                  : (temAtraso ? 'bg-rose-500' : 'bg-blue-600')
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Data de Início */}
                      <td className="py-4 px-4 text-xs text-gray-500 dark:text-gray-400">
                        {formatarData(emp.data_inicio)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          emp.status === 'quitado'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : (temAtraso
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20')
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            emp.status === 'quitado'
                              ? 'bg-emerald-500'
                              : (temAtraso ? 'bg-rose-500' : 'bg-blue-500')
                          }`} />
                          {emp.status === 'quitado' ? 'Quitado' : (temAtraso ? 'Em Atraso' : 'Ativo')}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={(e) => handleAbrirDetalhes(emp.id, e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-950/40 text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                          <Eye size={14} />
                          <span>Ver Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalhes do Empréstimo */}
      <ModalDetalhesEmprestimo
        isOpen={isDetalhesOpen}
        emprestimoId={emprestimoDetalhesId}
        onClose={() => {
          setIsDetalhesOpen(false);
          setEmprestimoDetalhesId(null);
        }}
        onRefresh={() => {
          carregarEmprestimos();
        }}
      />

      {/* Sub-Modal de Criação de Novo Empréstimo */}
      {isNovoEmprestimoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-gray-900 dark:text-white">Novo Empréstimo</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Contratação de novo financiamento ou mútuo</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNovoEmprestimoOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoEmprestimo} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Cliente Tomador *
                </label>
                <select
                  required
                  value={novoClienteId}
                  onChange={(e) => setNovoClienteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o cliente...</option>
                  {clientesDisponiveis.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.cpf ? `(${c.cpf})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Valor Emprestado (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    placeholder="1000.00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Taxa de Juros (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={novaTaxa}
                    onChange={(e) => setNovaTaxa(e.target.value)}
                    placeholder="20"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Quantidade de Parcelas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={novasParcelas}
                    onChange={(e) => setNovasParcelas(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Frequência *
                  </label>
                  <select
                    value={novaFrequencia}
                    onChange={(e) => setNovaFrequencia(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="semanal">Semanal</option>
                    <option value="diario">Diário</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Data de Início *
                </label>
                <input
                  type="date"
                  required
                  value={novaDataInicio}
                  onChange={(e) => setNovaDataInicio(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNovoEmprestimoOpen(false)}
                  disabled={salvandoNovo}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNovo}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {salvandoNovo ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>{salvandoNovo ? 'Gravando...' : 'Concluir Empréstimo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
