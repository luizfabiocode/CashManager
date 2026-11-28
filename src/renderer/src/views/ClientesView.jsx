import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Pencil, 
  Trash2, 
  Phone, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  X,
  CreditCard,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import ModalCliente from '../components/modals/ModalCliente';

/**
 * Utilitário de formatação de CPF (000.000.000-00)
 */
function formatarCPF(cpf) {
  if (!cpf) return '-';
  const limpo = String(cpf).replace(/\D/g, '');
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

/**
 * Utilitário de formatação de telefone ((00) 00000-0000)
 */
function formatarTelefone(tel) {
  if (!tel) return '-';
  const limpo = String(tel).replace(/\D/g, '');
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return tel;
}

export default function ClientesView() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Estado do ModalCliente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState(null);

  // Carrega lista de clientes da API
  const carregarClientes = useCallback(async () => {
    setCarregando(true);
    try {
      if (window.api?.clientes?.listar) {
        const res = await window.api.clientes.listar();
        if (res && res.success) {
          setClientes(res.data || []);
        } else if (Array.isArray(res)) {
          setClientes(res);
        } else {
          setClientes([]);
        }
      }
    } catch (err) {
      console.error('[ClientesView] Erro ao carregar clientes:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  // Abertura do modal para novo cliente
  const handleNovoCliente = () => {
    setClienteParaEditar(null);
    setIsModalOpen(true);
  };

  // Abertura do modal para edição
  const handleEditarCliente = (cliente, e) => {
    if (e) e.stopPropagation();
    setClienteParaEditar(cliente);
    setIsModalOpen(true);
  };

  // Abrir conversa no WhatsApp com o cliente
  const handleWhatsAppCliente = (cliente, e) => {
    if (e) e.stopPropagation();

    if (!cliente.telefone) {
      alert(`O cliente "${cliente.nome}" não possui telefone cadastrado.`);
      return;
    }

    const limpo = String(cliente.telefone).replace(/\D/g, '');
    if (!limpo) {
      alert(`O cliente "${cliente.nome}" não possui telefone válido cadastrado.`);
      return;
    }

    const numeroLimpo = (limpo.startsWith('55') && (limpo.length === 12 || limpo.length === 13))
      ? limpo.slice(2)
      : limpo;

    const url = `https://wa.me/55${numeroLimpo}`;
    window.open(url, '_blank');
  };

  // Exclusão de cliente
  const handleExcluirCliente = async (cliente, e) => {
    if (e) e.stopPropagation();
    
    if (cliente.emprestimos_ativos > 0) {
      alert(`O cliente "${cliente.nome}" possui ${cliente.emprestimos_ativos} empréstimo(s) ativo(s) e não pode ser excluído.`);
      return;
    }

    const confirmar = window.confirm(`Deseja realmente excluir o cliente "${cliente.nome}"? Esta ação é irreversível.`);
    if (!confirmar) return;

    try {
      if (window.api?.clientes?.remover) {
        const res = await window.api.clientes.remover(cliente.id);
        if (res && (res.success || res.success !== false)) {
          await carregarClientes();
        } else {
          alert(res?.error || 'Erro ao excluir cliente.');
        }
      }
    } catch (err) {
      console.error('[ClientesView] Erro ao excluir cliente:', err);
      alert(err.message || 'Falha ao remover cliente.');
    }
  };

  // Filtro em tempo real por busca e status
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((cli) => {
      const termo = busca.toLowerCase().trim();
      const matchBusca = !termo || 
        (cli.nome && cli.nome.toLowerCase().includes(termo)) ||
        (cli.cpf && cli.cpf.includes(termo)) ||
        (cli.telefone && cli.telefone.includes(termo));

      const matchStatus = filtroStatus === 'todos' || cli.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [clientes, busca, filtroStatus]);

  // Indicadores
  const totalClientes = clientes.length;
  const clientesComEmprestimo = clientes.filter(c => Number(c.emprestimos_ativos) > 0).length;
  const clientesInadimplentes = clientes.filter(c => Number(c.parcelas_atrasadas) > 0).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Topo: Indicadores Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Cadastrado</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 font-heading">{totalClientes}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tomadores registrados na base</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Com Contratos Ativos</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-heading">{clientesComEmprestimo}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Clientes com empréstimos em andamento</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Inadimplência</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-heading">{clientesInadimplentes}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Clientes com parcelas vencidas pendentes</p>
        </div>
      </div>

      {/* Barra de Ações: Busca, Filtro e Botão Novo Cliente */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF ou telefone..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          />
          {busca && (
            <button 
              onClick={() => setBusca('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Apenas Ativos</option>
            <option value="inativo">Inativos</option>
          </select>

          <button
            onClick={handleNovoCliente}
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0"
          >
            <UserPlus size={16} />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        {carregando ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Carregando lista de clientes...</p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-1">
              <Users size={24} />
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">Nenhum cliente encontrado</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              {busca ? 'Tente ajustar os termos de busca para encontrar o cliente desejado.' : 'Clique no botão "Novo Cliente" acima para cadastrar o primeiro tomador.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-6">Nome</th>
                  <th className="py-3.5 px-4">CPF</th>
                  <th className="py-3.5 px-4">Telefone</th>
                  <th className="py-3.5 px-4 text-center">Contratos</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {clientesFiltrados.map((cliente) => {
                  const temAtraso = Number(cliente.parcelas_atrasadas) > 0;
                  const temAtivo = Number(cliente.emprestimos_ativos) > 0;

                  return (
                    <tr
                      key={cliente.id}
                      onClick={() => handleEditarCliente(cliente)}
                      className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-200"
                    >
                      {/* Nome e Inicial */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/20 group-hover:scale-105 transition-transform duration-200">
                            {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                              {cliente.nome}
                            </p>
                            {cliente.endereco && (
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-xs">
                                {cliente.endereco}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="py-4 px-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                        {formatarCPF(cliente.cpf)}
                      </td>

                      {/* Telefone */}
                      <td className="py-4 px-4 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-gray-400" />
                          <span>{formatarTelefone(cliente.telefone)}</span>
                        </div>
                      </td>

                      {/* Contratos / Parcelas */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {temAtivo && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {cliente.emprestimos_ativos} ativo(s)
                            </span>
                          )}
                          {temAtraso && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              {cliente.parcelas_atrasadas} em atraso
                            </span>
                          )}
                          {!temAtivo && !temAtraso && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">Sem ativos</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          cliente.status === 'ativo' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                            : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cliente.status === 'ativo' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleWhatsAppCliente(cliente, e)}
                            className="p-2 rounded-lg text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:scale-110 active:scale-95 transition-all duration-200"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleEditarCliente(cliente, e)}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:scale-110 active:scale-95 transition-all duration-200"
                            title="Editar dados e documentos"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleExcluirCliente(cliente, e)}
                            className="p-2 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:scale-110 active:scale-95 transition-all duration-200"
                            title="Excluir cliente"
                          >
                            <Trash2 size={15} />
                          </button>
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

      {/* Modal de Cliente (Criação, Edição e Anexos de Documentos) */}
      <ModalCliente
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clienteParaEditar={clienteParaEditar}
        onSuccess={() => {
          carregarClientes();
        }}
      />
    </div>
  );
}
