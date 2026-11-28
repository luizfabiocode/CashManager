import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import ClientesView from './views/ClientesView';
import EmprestimosView from './views/EmprestimosView';
import ParcelasView from './views/ParcelasView';
import CaixaView from './views/CaixaView';
import ConfiguracoesView from './views/ConfiguracoesView';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0b0f19] text-gray-800 dark:text-gray-200 font-sans overflow-hidden transition-colors duration-200">
      <Toaster 
        theme={isDark ? 'dark' : 'light'} 
        position="top-right" 
        richColors 
        closeButton 
      />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        isDark={isDark}
        toggleTheme={toggleTheme} 
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative custom-scrollbar">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'clientes' && <ClientesView />}
          {activeTab === 'emprestimos' && <EmprestimosView />}
          {activeTab === 'parcelas' && <ParcelasView />}
          {activeTab === 'caixa' && <CaixaView />}
          {activeTab === 'configuracoes' && (
            <ConfiguracoesView 
              theme={theme} 
              isDark={isDark} 
              toggleTheme={toggleTheme} 
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
