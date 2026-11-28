import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CircleDollarSign, 
  CalendarClock, 
  ArrowRightLeft, 
  Settings, 
  DollarSign,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar({ activeTab, setActiveTab, theme: propTheme, isDark: propIsDark, toggleTheme: propToggleTheme }) {
  const contextTheme = useTheme();
  
  const isDark = propIsDark !== undefined ? propIsDark : contextTheme.isDark;
  const toggleTheme = propToggleTheme || contextTheme.toggleTheme;

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'clientes', icon: Users, label: 'Clientes' },
    { id: 'emprestimos', icon: CircleDollarSign, label: 'Empréstimos' },
    { id: 'parcelas', icon: CalendarClock, label: 'Parcelas & Cobrança' },
    { id: 'caixa', icon: ArrowRightLeft, label: 'Fluxo de Caixa' },
    { id: 'configuracoes', icon: Settings, label: 'Configurações & Backup' },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-colors duration-200 shadow-sm">
      {/* Top Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <DollarSign className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight font-heading">
            Ca$hManager
          </h1>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold">
            Desktop V1.0
          </span>
        </div>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium text-sm group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-[1.01]' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:scale-[1.02] active:scale-95'
              }`}
            >
              <item.icon 
                size={20} 
                className={`transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'
                }`} 
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-4 bg-white/80 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: Alternar Tema mostrando a AÇÃO clara */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Alternar tema"
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-xs text-xs font-semibold"
        >
          {isDark ? (
            <>
              <Sun size={16} className="text-amber-500" />
              <span>Mudar para Modo Claro</span>
            </>
          ) : (
            <>
              <Moon size={16} className="text-blue-500" />
              <span>Mudar para Modo Escuro</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
