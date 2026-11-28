import React from 'react';
import { Plus, UserPlus, ArrowRightLeft } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const titles = {
    dashboard: 'Visão Geral & Indicadores',
    clientes: 'Gestão de Clientes',
    emprestimos: 'Gestão de Empréstimos',
    parcelas: 'Parcelas & Cobranças',
    caixa: 'Fluxo de Caixa',
    configuracoes: 'Configurações & Backup'
  };

  const descriptions = {
    dashboard: 'Acompanhamento consolidado de empréstimos, caixa e inadimplência',
    clientes: 'Cadastro de tomadores, histórico de crédito e documentos anexados',
    emprestimos: 'Contratos vigentes, saldos devedores e amortizações especiais',
    parcelas: 'Controle de recebimentos, notificações de vencimento e WhatsApp',
    caixa: 'Histórico detalhado de movimentações financeiras, entradas e saídas',
    configuracoes: 'Parâmetros operacionais, segurança com PIN e backups do banco'
  };

  return (
    <header className="h-[88px] border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0b0f19] flex items-center justify-between px-6 md:px-8 shrink-0 transition-colors duration-200">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight font-heading">
          {titles[activeTab] || 'Ca$hManager'}
        </h2>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {descriptions[activeTab] || 'Sistema Desktop de Gestão Financeira'}
        </p>
      </div>
      
      <div className="flex items-center gap-2.5">
        <button 
          onClick={() => setActiveTab && setActiveTab('emprestimos')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-2 shadow-md shadow-blue-600/20"
        >
          <Plus size={15} /> 
          <span className="hidden sm:inline">Novo</span> Empréstimo
        </button>

        <button 
          onClick={() => setActiveTab && setActiveTab('clientes')}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-2 border border-gray-200 dark:border-gray-700 shadow-xs"
        >
          <UserPlus size={15} /> 
          <span className="hidden sm:inline">Cadastrar</span> Cliente
        </button>

        <button 
          onClick={() => setActiveTab && setActiveTab('caixa')}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-2 border border-gray-200 dark:border-gray-700 shadow-xs"
        >
          <ArrowRightLeft size={15} /> 
          Caixa
        </button>
      </div>
    </header>
  );
}
