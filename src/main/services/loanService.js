const { getDb } = require('../database/db');
const { obterSaldoAtual, registrarMovimentacao } = require('./cashflowService');

function parseDataSegura(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') {
    return new Date();
  }
  const clean = dataStr.split('T')[0].trim();
  const partes = clean.split('-');
  if (partes.length === 3) {
    const ano = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const dia = parseInt(partes[2], 10);
    if (!isNaN(ano) && !isNaN(mes) && !isNaN(dia)) {
      const d = new Date(ano, mes, dia, 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;
  return new Date();
}

function formatarDataISO(d) {
  let dateObj = d;
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Adiciona dias a uma data no formato YYYY-MM-DD
 */
function adicionarDias(dataStr, dias) {
  try {
    const d = parseDataSegura(dataStr);
    d.setDate(d.getDate() + (parseInt(dias, 10) || 0));
    return formatarDataISO(d);
  } catch (e) {
    return formatarDataISO(new Date());
  }
}

/**
 * Adiciona meses a uma data no formato YYYY-MM-DD
 */
function adicionarMeses(dataStr, meses) {
  try {
    const d = parseDataSegura(dataStr);
    d.setMonth(d.getMonth() + (parseInt(meses, 10) || 0));
    return formatarDataISO(d);
  } catch (e) {
    return formatarDataISO(new Date());
  }
}

/**
 * Calcula a data de vencimento da parcela de acordo com a frequência
 */
function calcularDataVencimento(dataInicio, frequencia, numeroParcela) {
  const i = parseInt(numeroParcela, 10) || 1;
  switch (frequencia) {
    case 'diario':
      return adicionarDias(dataInicio, i);
    case 'semanal':
      return adicionarDias(dataInicio, i * 7);
    case 'quinzenal':
      return adicionarDias(dataInicio, i * 15);
    case 'mensal':
      return adicionarMeses(dataInicio, i);
    default:
      return adicionarDias(dataInicio, i * 30);
  }
}

/**
 * Cria um novo empréstimo com transação atômica, geração de parcelas e saída de caixa
 * @param {{
 *   cliente_id: number,
 *   valor_investido: number,
 *   taxa_juros: number,
 *   parcelas: number,
 *   frequencia: 'diario'|'semanal'|'quinzenal'|'mensal',
 *   data_inicio?: string
 * }} dados
 */
function criarEmprestimo(dados) {
  const db = getDb();

  const clienteId = Number(dados.cliente_id);
  const valorInvestido = Number(dados.valor_investido);
  const taxaJuros = Number(dados.taxa_juros);
  const qtdParcelas = parseInt(dados.parcelas, 10);
  const frequencia = (dados.frequencia || 'mensal').toLowerCase();
  const dataInicio = dados.data_inicio || new Date().toISOString().split('T')[0];

  // 1. Validações de entrada
  if (!clienteId || isNaN(clienteId)) {
    throw new Error('Cliente inválido ou não informado.');
  }

  const cliente = db.prepare('SELECT id, nome FROM clientes WHERE id = ?').get(clienteId);
  if (!cliente) {
    throw new Error(`Cliente #${clienteId} não encontrado.`);
  }

  if (isNaN(valorInvestido) || valorInvestido <= 0) {
    throw new Error('O valor investido deve ser maior que zero.');
  }

  if (isNaN(taxaJuros) || taxaJuros < 0) {
    throw new Error('A taxa de juros não pode ser negativa.');
  }

  if (isNaN(qtdParcelas) || qtdParcelas <= 0) {
    throw new Error('A quantidade de parcelas deve ser no mínimo 1.');
  }

  const frequenciasValidas = ['diario', 'semanal', 'quinzenal', 'mensal'];
  if (!frequenciasValidas.includes(frequencia)) {
    throw new Error(`Frequência inválida. Escolha entre: ${frequenciasValidas.join(', ')}.`);
  }

  // 2. Validação de Saldo em Caixa
  const saldoAtual = obterSaldoAtual();
  if (saldoAtual < valorInvestido) {
    throw new Error(
      `Saldo em caixa insuficiente. Saldo disponível: R$ ${saldoAtual.toFixed(2)} | Valor solicitado: R$ ${valorInvestido.toFixed(2)}`
    );
  }

  // 3. Cálculo Financeiro
  const fatorJuros = 1 + (taxaJuros / 100);
  const valorTotalRetorno = Number((valorInvestido * fatorJuros).toFixed(2));
  const valorParcelaPadrao = Number((valorTotalRetorno / qtdParcelas).toFixed(2));

  // Ajuste de centavos para a soma das parcelas ser exatamente igual ao total previsto
  const parcelasArray = [];
  let somaCalculada = 0;

  for (let i = 1; i <= qtdParcelas; i++) {
    const dataVenc = calcularDataVencimento(dataInicio, frequencia, i);
    let valorParcela = valorParcelaPadrao;

    if (i === qtdParcelas) {
      // Ajuste na última parcela
      valorParcela = Number((valorTotalRetorno - somaCalculada).toFixed(2));
    } else {
      somaCalculada += valorParcela;
    }

    parcelasArray.push({
      numero_parcela: i,
      valor: valorParcela,
      data_vencimento: dataVenc,
      status: 'pendente'
    });
  }

  // 4. Execução da Transação Atômica no SQLite
  const transacao = db.transaction(() => {
    // 4.1 Inserir Empréstimo
    const insertEmprestimo = db.prepare(`
      INSERT INTO emprestimos (cliente_id, valor_investido, taxa_juros, parcelas, frequencia, data_inicio, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ativo')
    `).run(clienteId, valorInvestido, taxaJuros, qtdParcelas, frequencia, dataInicio);

    const emprestimoId = insertEmprestimo.lastInsertRowid;

    // 4.2 Inserir Parcelas
    const insertParcela = db.prepare(`
      INSERT INTO parcelas (emprestimo_id, numero_parcela, valor, data_vencimento, status)
      VALUES (?, ?, ?, ?, 'pendente')
    `);

    for (const p of parcelasArray) {
      insertParcela.run(emprestimoId, p.numero_parcela, p.valor, p.data_vencimento);
    }

    // 4.3 Inserir Saída de Caixa
    const descCaixa = `Empréstimo #${emprestimoId} - ${cliente.nome} (${qtdParcelas}x de R$ ${valorParcelaPadrao.toFixed(2)})`;
    db.prepare(`
      INSERT INTO movimentacoes_caixa (tipo, valor, descricao, data, origem_id)
      VALUES ('saida', ?, ?, ?, ?)
    `).run(valorInvestido, descCaixa, dataInicio, emprestimoId);

    return emprestimoId;
  });

  const emprestimoId = transacao();

  return obterDetalhesEmprestimo(emprestimoId);
}

/**
 * Lista empréstimos com informações completas do cliente e progresso
 * @param {{ status?: string, cliente_id?: number, busca?: string }} [filtros]
 */
function listarEmprestimos(filtros = {}) {
  const db = getDb();
  let query = `
    SELECT 
      e.*,
      c.nome AS cliente_nome,
      c.cpf AS cliente_cpf,
      c.telefone AS cliente_telefone,
      COALESCE(SUM(p.valor), 0) AS valor_total_parcelas,
      COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.valor ELSE 0 END), 0) AS valor_pago,
      COALESCE(SUM(CASE WHEN p.status = 'pendente' THEN p.valor ELSE 0 END), 0) AS valor_pendente,
      COUNT(p.id) AS total_parcelas_count,
      COUNT(CASE WHEN p.status = 'pago' THEN 1 END) AS parcelas_pagas_count,
      COUNT(CASE WHEN p.status = 'pendente' AND date(p.data_vencimento) < date('now', 'localtime') THEN 1 END) AS parcelas_atrasadas_count
    FROM emprestimos e
    JOIN clientes c ON e.cliente_id = c.id
    LEFT JOIN parcelas p ON p.emprestimo_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (filtros.status) {
    query += ` AND e.status = ?`;
    params.push(filtros.status);
  }

  if (filtros.cliente_id) {
    query += ` AND e.cliente_id = ?`;
    params.push(filtros.cliente_id);
  }

  if (filtros.busca && filtros.busca.trim().length > 0) {
    query += ` AND (c.nome LIKE ? OR c.cpf LIKE ?)`;
    const termo = `%${filtros.busca.trim()}%`;
    params.push(termo, termo);
  }

  query += ` GROUP BY e.id ORDER BY e.id DESC`;

  return db.prepare(query).all(...params);
}

/**
 * Retorna os detalhes completos de um empréstimo e suas parcelas
 * @param {number} id
 */
function obterDetalhesEmprestimo(id) {
  const db = getDb();
  const emprestimo = db.prepare(`
    SELECT 
      e.*,
      c.nome AS cliente_nome,
      c.cpf AS cliente_cpf,
      c.telefone AS cliente_telefone,
      c.endereco AS cliente_endereco
    FROM emprestimos e
    JOIN clientes c ON e.cliente_id = c.id
    WHERE e.id = ?
  `).get(id);

  if (!emprestimo) return null;

  const parcelas = db.prepare(`
    SELECT * FROM parcelas 
    WHERE emprestimo_id = ? 
    ORDER BY numero_parcela ASC
  `).all(id);

  const valorTotalRetorno = parcelas.reduce((acc, p) => acc + p.valor, 0);
  const valorTotalPago = parcelas.filter(p => p.status === 'pago').reduce((acc, p) => acc + p.valor, 0);
  const valorTotalPendente = parcelas.filter(p => p.status !== 'pago').reduce((acc, p) => acc + p.valor, 0);

  let pagamentosParciais = [];
  try {
    pagamentosParciais = db.prepare(`
      SELECT * FROM pagamentos_parciais 
      WHERE emprestimo_id = ? 
      ORDER BY id DESC
    `).all(id);
  } catch (e) {
    pagamentosParciais = [];
  }

  return {
    ...emprestimo,
    valor_total_retorno: Number(valorTotalRetorno.toFixed(2)),
    valor_total_pago: Number(valorTotalPago.toFixed(2)),
    valor_total_pendente: Number(valorTotalPendente.toFixed(2)),
    lucro_total_previsto: Number((valorTotalRetorno - emprestimo.valor_investido).toFixed(2)),
    parcelas,
    pagamentos_parciais: pagamentosParciais
  };
}

module.exports = {
  criarEmprestimo,
  listarEmprestimos,
  obterDetalhesEmprestimo,
  calcularDataVencimento
};
