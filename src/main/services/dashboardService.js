const { getDb } = require('../database/db');
const { obterSaldoAtual } = require('./cashflowService');

/**
 * Retorna o resumo consolidado de KPIs financeiros para o Dashboard
 * @returns {object}
 */
function obterResumoDashboard() {
  const db = getDb();

  // 1. Saldo em Caixa
  const saldoCaixa = obterSaldoAtual();

  // 2. Capital Emprestado (Soma do valor_investido de empréstimos com status 'ativo')
  const capitalRow = db.prepare(`
    SELECT COALESCE(SUM(valor_investido), 0) AS capital_emprestado
    FROM emprestimos
    WHERE status = 'ativo'
  `).get();
  const capitalEmprestado = Number((capitalRow ? capitalRow.capital_emprestado : 0).toFixed(2));

  // 3. Total a Receber (Soma das parcelas com status 'pendente' vinculadas a empréstimos ativos)
  const aReceberRow = db.prepare(`
    SELECT COALESCE(SUM(p.valor), 0) AS total_a_receber
    FROM parcelas p
    JOIN emprestimos e ON p.emprestimo_id = e.id
    WHERE p.status = 'pendente' AND e.status = 'ativo'
  `).get();
  const totalAReceber = Number((aReceberRow ? aReceberRow.total_a_receber : 0).toFixed(2));

  // 4. Lucro Previsto:
  // (Soma de todas as parcelas dos empréstimos ativos) - (Soma do valor investido dos empréstimos ativos)
  const lucroRow = db.prepare(`
    SELECT 
      COALESCE(SUM(p.valor), 0) - COALESCE(SUM(DISTINCT e.valor_investido), 0) AS lucro_previsto
    FROM emprestimos e
    JOIN parcelas p ON p.emprestimo_id = e.id
    WHERE e.status = 'ativo'
  `).get();

  // Para evitar anomalias em JOINs de múltiplas parcelas com DISTINCT em valores iguais, calculamos de forma precisa:
  const emprestimosAtivos = db.prepare(`
    SELECT id, valor_investido FROM emprestimos WHERE status = 'ativo'
  `).all();

  let lucroPrevisto = 0;
  for (const emp of emprestimosAtivos) {
    const somaParcelas = db.prepare(`
      SELECT COALESCE(SUM(valor), 0) AS total FROM parcelas WHERE emprestimo_id = ?
    `).get(emp.id).total;
    lucroPrevisto += (somaParcelas - emp.valor_investido);
  }
  lucroPrevisto = Number(lucroPrevisto.toFixed(2));

  // 5. Inadimplentes (Clientes com parcelas com data_vencimento < hoje e status = 'pendente')
  const inadimplentesRows = db.prepare(`
    SELECT 
      c.id AS cliente_id,
      c.nome AS cliente_nome,
      c.telefone AS cliente_telefone,
      c.cpf AS cliente_cpf,
      COUNT(p.id) AS parcelas_atrasadas_qtd,
      SUM(p.valor) AS valor_total_atrasado,
      MIN(p.data_vencimento) AS atraso_desde
    FROM parcelas p
    JOIN emprestimos e ON p.emprestimo_id = e.id
    JOIN clientes c ON e.cliente_id = c.id
    WHERE p.status = 'pendente' 
      AND date(p.data_vencimento) < date('now', 'localtime')
      AND e.status = 'ativo'
    GROUP BY c.id
    ORDER BY valor_total_atrasado DESC
  `).all();

  const totalInadimplentesQtd = inadimplentesRows.length;
  const totalValorInadimplente = Number(
    inadimplentesRows.reduce((acc, curr) => acc + curr.valor_total_atrasado, 0).toFixed(2)
  );

  // 6. Parcelas que Vencem Amanhã (Notificação / Lembrete Prévio)
  const parcelasAmanhaRows = db.prepare(`
    SELECT 
      p.id,
      p.numero_parcela,
      p.valor,
      p.data_vencimento,
      p.status,
      p.emprestimo_id,
      e.parcelas AS total_parcelas,
      c.id AS cliente_id,
      c.nome AS cliente_nome,
      c.telefone AS cliente_telefone,
      c.cpf AS cliente_cpf
    FROM parcelas p
    JOIN emprestimos e ON p.emprestimo_id = e.id
    JOIN clientes c ON e.cliente_id = c.id
    WHERE p.status = 'pendente' 
      AND e.status = 'ativo'
      AND date(p.data_vencimento) = date('now', 'localtime', '+1 day')
    ORDER BY c.nome ASC, p.numero_parcela ASC
  `).all();

  const totalAmanhaQtd = parcelasAmanhaRows.length;
  const totalAmanhaValor = Number(
    parcelasAmanhaRows.reduce((acc, curr) => acc + curr.valor, 0).toFixed(2)
  );

  // 7. Contagens adicionais para o dashboard
  const totalClientes = db.prepare("SELECT COUNT(*) AS total FROM clientes WHERE status = 'ativo'").get().total;
  const totalEmprestimosAtivos = emprestimosAtivos.length;

  return {
    saldoCaixa,
    capitalEmprestado,
    lucroPrevisto,
    totalAReceber,
    inadimplencia: {
      totalClientesInadimplentes: totalInadimplentesQtd,
      totalValorInadimplente,
      lista: inadimplentesRows
    },
    lembretesAmanha: {
      totalQtd: totalAmanhaQtd,
      totalValor: totalAmanhaValor,
      lista: parcelasAmanhaRows
    },
    estatisticas: {
      totalClientesAtivos: totalClientes,
      totalEmprestimosAtivos
    }
  };
}

module.exports = {
  obterResumoDashboard
};
