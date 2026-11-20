import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  QrCode, 
  Check, 
  Shield, 
  Key, 
  Database, 
  Download, 
  RotateCcw, 
  FileSpreadsheet, 
  RefreshCw 
} from 'lucide-react';

/**
 * Tela de Configurações & Backup do Ca$hManager
 * Gerencia tema visual, chave PIX padrão, PIN de segurança,
 * backups (.sqlite e .db), restauração do banco e exportação em CSV.
 */
export default function ConfiguracoesView({ 
  config, 
  refreshConfig, 
  cadastrarPin, 
  theme = 'light', 
  toggleTheme, 
  isDark = false, 
  addToast 
}) {
  const [chavePix, setChavePix] = useState('');
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [novoPin, setNovoPin] = useState('');
  const [confirmaPin, setConfirmaPin] = useState('');
  const [atualizandoPin, setAtualizandoPin] = useState(false);
  const [statusUpdater, setStatusUpdater] = useState('Sistema pronto');
  const [checandoUpdater, setChecandoUpdater] = useState(false);

  useEffect(() => {
    if (config?.chave_pix) {
      setChavePix(config.chave_pix);
    }
  }, [config]);

  const handleSalvarPix = async (e) => {
    e.preventDefault();
    setSalvandoPix(true);
    try {
      if (window.api?.auth) {
        const res = await window.api.auth.atualizarChavePix(chavePix);
        if (res.success) {
          addToast?.('Chave PIX padrão atualizada com sucesso!', 'success');
          refreshConfig?.();
        } else {
          addToast?.(res.error || 'Erro ao atualizar chave PIX', 'error');
        }
      }
    } catch (err) {
      addToast?.(err.message, 'error');
    } finally {
      setSalvandoPix(false);
    }
  };

  const handleAtualizarPin = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(novoPin)) {
      addToast?.('O PIN deve conter exatamente 4 números.', 'error');
      return;
    }
    if (novoPin !== confirmaPin) {
      addToast?.('A confirmação do PIN não coincide.', 'error');
      return;
    }
    setAtualizandoPin(true);
    try {
      const res = await cadastrarPin(novoPin);
      if (res.success) {
        addToast?.('PIN de segurança atualizado com sucesso!', 'success');
        setNovoPin('');
        setConfirmaPin('');
      } else {
        addToast?.(res.error || 'Erro ao atualizar PIN', 'error');
      }
    } catch (err) {
      addToast?.(err.message, 'error');
    } finally {
      setAtualizandoPin(false);
    }
  };

  const handleBackupPortavel = async () => {
    try {
      if (window.api?.backup) {
        const res = await window.api.backup.gerarBackup();
        if (res.data?.cancelado) return;
        if (res.success) {
          const msg = res.data?.mensagem || 'Backup portável SQLite gerado com sucesso!';
          const avisoCripto = res.data?.criptografado ? '⚠️ Arquivo criptografado (interno).' : '';
          addToast?.(avisoCripto || msg.split('\n')[0], res.data?.criptografado ? 'warning' : 'success');
        } else {
          addToast?.(res.error || 'Erro ao gerar backup', 'error');
        }
      }
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const handleBackupSeguro = async () => {
    try {
      if (window.api?.backup) {
        const res = await window.api.backup.gerarBackupCriptografado();
        if (res.data?.cancelado) return;
        if (res.success) {
          addToast?.('Backup interno seguro (.db) gerado com sucesso!', 'success');
        } else {
          addToast?.(res.error || 'Erro ao gerar backup', 'error');
        }
      }
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const handleRestaurar = async () => {
    const confirmou = window.confirm(
      'ATENÇÃO: A restauração substituirá todos os dados locais pelo arquivo de backup selecionado.\n\n' +
      'Selecione APENAS arquivos .db gerados pela opção "Backup Seguro (Restaurável)" do Ca$hManager.\n\n' +
      'Deseja continuar?'
    );
    if (!confirmou) return;

    try {
      if (window.api?.backup) {
        const res = await window.api.backup.restaurarBackup();
        if (res.data?.cancelado) return;
        if (res.success) {
          addToast?.(res.data?.mensagem?.split('\n')[0] || 'Banco de dados restaurado com sucesso!', 'success');
          setTimeout(() => window.location.reload(), 1800);
        } else {
          addToast?.(res.error || 'Erro ao restaurar backup', 'error');
        }
      }
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const handleExportarCSV = async (tabela, rotulo) => {
    try {
      if (window.api?.backup) {
        const res = await window.api.backup.exportarCSV(tabela);
        if (res.success && !res.data?.cancelado) {
          addToast?.(`Relatório de ${rotulo} exportado em .csv com sucesso!`, 'success');
        }
      }
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const handleVerificarAtualizacao = async () => {
    setChecandoUpdater(true);
    setStatusUpdater('Consultando servidor de releases...');
    try {
      if (window.api?.updater) {
        const res = await window.api.updater.verificar();
        if (res.success && res.data?.result) {
          setStatusUpdater(`Nova versão ${res.data.result.version} encontrada!`);
          addToast?.(`Nova versão disponível: ${res.data.result.version}`, 'info');
        } else {
          setStatusUpdater('Seu aplicativo está na versão mais recente (v1.0.0).');
          addToast?.('Você já possui a versão mais recente.', 'success');
        }
      }
    } catch {
      setStatusUpdater('Não foi possível conectar ao servidor de releases no momento.');
    } finally {
      setChecandoUpdater(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Aparência & Tema */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <h4 className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Aparência & Tema Visual
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Alterne entre o Modo Escuro e Claro com persistência automática de preferências.
            </p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Tema Atual: <strong className="capitalize text-blue-600 dark:text-blue-400">{theme}</strong>
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/20 active:scale-95 transition-all"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>Alternar para {isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
            </button>
          </div>
        </div>

        {/* Chave PIX */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <QrCode className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold font-heading text-slate-900 dark:text-white">
              Chave PIX para Cobranças
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Esta chave será incluída automaticamente nas mensagens de cobrança enviadas pelo WhatsApp.
          </p>
          <form onSubmit={handleSalvarPix} className="space-y-3">
            <div>
              <input
                type="text"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder="Ex: CPF, CNPJ, e-mail, telefone ou chave aleatória"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={salvandoPix}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>{salvandoPix ? 'Salvando...' : 'Salvar Chave PIX'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Alteração do PIN */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Shield className="w-5 h-5" />
          </div>
          <h4 className="text-base font-bold font-heading text-slate-900 dark:text-white">
            Segurança & Alteração do PIN (4 Dígitos)
          </h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          O PIN é criptografado com hash Bcrypt no banco de dados e protege o sistema contra acessos não autorizados.
        </p>
        <form onSubmit={handleAtualizarPin} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Novo PIN (4 números)
            </label>
            <input
              type="password"
              maxLength={4}
              value={novoPin}
              onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-center tracking-widest font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Confirmar Novo PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={confirmaPin}
              onChange={(e) => setConfirmaPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-center tracking-widest font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={atualizandoPin}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-60"
          >
            <Key className="w-4 h-4" />
            <span>{atualizandoPin ? 'Atualizando...' : 'Atualizar PIN'}</span>
          </button>
        </form>
      </div>

      {/* Backup, Restauração & Relatórios em CSV */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold font-heading text-slate-900 dark:text-white">
              Backup, Restauração & Relatórios em CSV
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exporte cópias íntegras do banco SQLite para segurança ou relatórios em planilha formatados com UTF-8 BOM.
          </p>
        </div>

        {/* NOTA: Bloco de aviso em amarelo sobre .sqlite e .db removido para simplificar e limpar o layout */}

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleBackupPortavel}
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left transition-all group"
            >
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform flex-shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Backup Portável (.sqlite)
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Legível no DB Browser, Excel, etc.
                </span>
              </div>
            </button>

            <button
              onClick={handleBackupSeguro}
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left transition-all group"
            >
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform flex-shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Backup Seguro (.db)
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Criptografado — restaurável pelo Ca$hManager
                </span>
              </div>
            </button>
          </div>

          <button
            onClick={handleRestaurar}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-800 text-left transition-all group"
          >
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform flex-shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 dark:group-hover:text-rose-400">
                Restaurar Backup do Banco
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Selecione um arquivo .db (Backup Seguro) para restaurar
              </span>
            </div>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
            Exportar Tabelas Formatadas para Excel (.csv)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => handleExportarCSV('clientes', 'Clientes')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Clientes</span>
            </button>
            <button
              onClick={() => handleExportarCSV('emprestimos', 'Empréstimos')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              <span>Empréstimos</span>
            </button>
            <button
              onClick={() => handleExportarCSV('parcelas', 'Parcelas')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-500" />
              <span>Parcelas</span>
            </button>
            <button
              onClick={() => handleExportarCSV('movimentacoes_caixa', 'Fluxo de Caixa')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <span>Caixa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Updater */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Suporte a Atualizações (Auto-Updater)
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{statusUpdater}</p>
        </div>
        <button
          onClick={handleVerificarAtualizacao}
          disabled={checandoUpdater}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checandoUpdater ? 'animate-spin' : ''}`} />
          <span>Checar Novas Versões</span>
        </button>
      </div>
    </div>
  );
}
