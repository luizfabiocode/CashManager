const { getDb } = require('../database/db');

/**
 * Realiza a baixa de uma parcela (marca como paga), lança a entrada no caixa e atualiza o status do empréstimo
 * @param {number} parcelaId 
 * @param {string} [dataPagamento] Formato YYYY-MM-DD
 * @returns {object}
 */
function darBaixaParcela(parcelaId, dataPagamento = null) {
  const db = getDb();
  const id = Number(parcelaId);

  if (!id || isNaN(id)) {
    throw new Error('ID de parcela inválido.');
  }

  // 1. Localizar parcela e dados do empréstimo
  const parcela = db.prepare(`
    SELECT p.*, e.cliente_id, e.parcelas AS total_parcelas, c.nome AS cliente_nome
    FROM parcelas p
    JOIN emprestimos e ON p.emprestimo_id = e.id
    JOIN clientes c ON e.cliente_id = c.id
    WHERE p.id = ?
  `).get(id);

  if (!parcela) {
    throw new Error(`Parcela #${id} não encontrada.`);
  }

  if (parcela.status === 'pago') {
    throw new Error(`A parcela #${parcela.numero_parcela} do empréstimo #${parcela.emprestimo_id} já está paga.`);
  }

  const dataBaixa = dataPagamento || new Date().toISOString().split('T')[0];

  // 2. Transação Atômica
  const transacao = db.transaction(() => {
    // 2.1 Atualiza parcela
    db.prepare(`
      UPDATE parcelas
      SET status = 'pago', data_pagamento = ?
      WHERE id = ?
    `).run(dataBaixa, id);

    // 2.2 Insere entrada no fluxo de caixa
    const descCaixa = `Recebimento Parcela ${parcela.numero_parcela}/${parcela.total_parcelas} - Empréstimo #${parcela.emprestimo_id} (${parcela.cliente_nome})`;
    db.prepare(`
      INSERT INTO movimentacoes_caixa (tipo, valor, descricao, data, origem_id)
      VALUES ('entrada', ?, ?, ?, ?)
    `).run(parcela.valor, descCaixa, dataBaixa, parcela.emprestimo_id);

    // 2.3 Verifica se restam parcelas pendentes no empréstimo
    const pendentes = db.prepare(`
      SELECT COUNT(*) AS total 
      FROM parcelas 
      WHERE emprestimo_id = ? AND status != 'pago'
    `).get(parcela.emprestimo_id);

    const emprestimoQuitado = pendentes.total === 0;

    if (emprestimoQuitado) {
      db.prepare(`
        UPDATE emprestimos 
        SET status = 'quitado' 
        WHERE id = ?
      `).run(parcela.emprestimo_id);
    }

    return {
      parcelaId: id,
      emprestimoId: parcela.emprestimo_id,
      numeroParcela: parcela.numero_parcela,
      valor: parcela.valor,
      dataPagamento: dataBaixa,
      status: 'pago',
      emprestimoQuitado
    };
  });

  return transacao();
}

/**
 * Lista parcelas com filtro de vencidas ou por período
 * @param {{ apenasVencidas?: boolean, apenasAmanha?: boolean, dataExata?: string, dataInicio?: string, dataFim?: string, clienteId?: number }} [filtros]
 */
function listarParcelas(filtros = {}) {
  const db = getDb();
  let query = `
    SELECT 
      p.*,
      e.cliente_id,
      e.taxa_juros,
      e.parcelas AS total_parcelas,
      c.nome AS cliente_nome,
      c.cpf AS cliente_cpf,
      c.telefone AS cliente_telefone,
      (CASE 
        WHEN p.status = 'pendente' AND date(p.data_vencimento) < date('now', 'localtime') THEN 1 
        ELSE 0 
      END) AS is_vencida,
      (CASE 
        WHEN p.status = 'pendente' AND date(p.data_vencimento) = date('now', 'localtime', '+1 day') THEN 1 
        ELSE 0 
      END) AS is_amanha
    FROM parcelas p
    JOIN emprestimos e ON p.emprestimo_id = e.id
    JOIN clientes c ON e.cliente_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (filtros.apenasVencidas) {
    query += ` AND p.status = 'pendente' AND date(p.data_vencimento) < date('now', 'localtime')`;
  }

  if (filtros.apenasAmanha) {
    query += ` AND p.status = 'pendente' AND date(p.data_vencimento) = date('now', 'localtime', '+1 day')`;
  }

  if (filtros.dataExata) {
    query += ` AND date(p.data_vencimento) = date(?)`;
    params.push(filtros.dataExata);
  }

  if (filtros.dataInicio) {
    query += ` AND date(p.data_vencimento) >= date(?)`;
    params.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    query += ` AND date(p.data_vencimento) <= date(?)`;
    params.push(filtros.dataFim);
  }

  if (filtros.clienteId) {
    query += ` AND e.cliente_id = ?`;
    params.push(filtros.clienteId);
  }

  query += ` ORDER BY p.data_vencimento ASC`;

  return db.prepare(query).all(...params);
}

/**
 * Adiciona um ciclo de período a uma data (YYYY-MM-DD) com base na frequência do empréstimo
 * @param {string} dataStr 
 * @param {'diario'|'semanal'|'quinzenal'|'mensal'} frequencia 
 * @returns {string} Nova data formatada em YYYY-MM-DD
 */
function calcularNovaDataVencimento(dataStr, frequencia) {
  if (!dataStr || typeof dataStr !== 'string') {
    dataStr = new Date().toISOString().split('T')[0];
  }
  const clean = dataStr.split('T')[0].trim();
  const partes = clean.split('-');
  let d;
  if (partes.length === 3) {
    const ano = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const dia = parseInt(partes[2], 10);
    if (!isNaN(ano) && !isNaN(mes) && !isNaN(dia)) {
      d = new Date(ano, mes, dia, 12, 0, 0);
    }
  }
  if (!d || isNaN(d.getTime())) {
    d = new Date(clean);
  }
  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const freq = (frequencia || 'mensal').toLowerCase();
  switch (freq) {
    case 'diario':
      d.setDate(d.getDate() + 1);
      break;
    case 'semanal':
      d.setDate(d.getDate() + 7);
      break;
    case 'quinzenal':
      d.setDate(d.getDate() + 15);
      break;
    case 'mensal': {
      const diaOriginal = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(diaOriginal, ultimoDia));
      break;
    }
    default:
      d.setDate(d.getDate() + 30);
      break;
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Registra pagamentos especiais em empréstimos:
 * - 'juros': Realiza o pagamento dos juros com rolagem de dívida (atualiza data das parcelas e adiciona novo ciclo de juros)
 * - 'principal': Abate valor do saldo devedor principal do empréstimo e de suas parcelas
 * - 'total': Quita integralmente o empréstimo e todas as suas parcelas pendentes
 * 
 * @param {number} emprestimoId
 * @param {number} valorPago
 * @param {'juros'|'principal'|'total'} tipoPagamento
 * @param {string} [dataPagamento] YYYY-MM-DD
 * @param {string} [observacao]
 * @returns {object} Novo estado consolidado do empréstimo
 */
function registrarPagamentoEspecial(emprestimoId, valorPago, tipoPagamento, dataPagamento = null, observacao = null) {
  const db = getDb();
  const id = Number(emprestimoId);

  // 1. Validações
  if (!id || isNaN(id)) {
    throw new Error('ID de empréstimo inválido.');
  }

  const numValorPago = Number(valorPago);
  if (isNaN(numValorPago) || numValorPago <= 0) {
    throw new Error('O valor pago deve ser um número maior que zero.');
  }

  const tiposValidos = ['juros', 'principal', 'total'];
  if (!tiposValidos.includes(tipoPagamento)) {
    throw new Error(`Tipo de pagamento inválido. Escolha entre: ${tiposValidos.join(', ')}.`);
  }

  const emprestimo = db.prepare(`
    SELECT e.*, c.nome AS cliente_nome, c.cpf AS cliente_cpf
    FROM emprestimos e
    JOIN clientes c ON e.cliente_id = c.id
    WHERE e.id = ?
  `).get(id);

  if (!emprestimo) {
    throw new Error(`Empréstimo #${id} não encontrado.`);
  }

  if (emprestimo.status === 'quitado') {
    throw new Error(`Não é possível registrar pagamento para o empréstimo #${id}, pois o contrato já está quitado.`);
  }

  const dataBaixa = dataPagamento || new Date().toISOString().split('T')[0];

  // 2. Transação Atômica
  const transacao = db.transaction(() => {
    // 2.1 Inserir no Histórico de Pagamentos Parciais
    const resultPagamento = db.prepare(`
      INSERT INTO pagamentos_parciais (emprestimo_id, valor_pago, tipo_pagamento, data_pagamento, observacao)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, numValorPago, tipoPagamento, dataBaixa, observacao ? observacao.trim() : null);

    // 2.2 Lançar no Fluxo de Caixa
    let descTipo = 'Pagamento de Juros (Rolagem)';
    if (tipoPagamento === 'principal') descTipo = 'Amortização de Principal';
    if (tipoPagamento === 'total') descTipo = 'Quitação Total Antecipada';

    const obsInfo = observacao && observacao.trim() ? ` - ${observacao.trim()}` : '';
    const descCaixa = `${descTipo} - Empréstimo #${id} (${emprestimo.cliente_nome})${obsInfo}`;

    db.prepare(`
      INSERT INTO movimentacoes_caixa (tipo, valor, descricao, data, origem_id)
      VALUES ('entrada', ?, ?, ?, ?)
    `).run(numValorPago, descCaixa, dataBaixa, id);

    // 2.3 Executar Lógica de Acordo com o Tipo de Pagamento
    if (tipoPagamento === 'juros') {
      // 1) Subtrair valorPago do saldo_juros (não deixar negativo)
      const saldoJurosAtual = Number(
        emprestimo.saldo_juros !== null && emprestimo.saldo_juros !== undefined
          ? emprestimo.saldo_juros
          : (emprestimo.valor_investido * (emprestimo.taxa_juros / 100.0))
      );
      const saldoJurosAposAbate = Math.max(0, Number((saldoJurosAtual - numValorPago).toFixed(2)));

      // 2) Atualizar data de vencimento das parcelas pendentes (somando o período pela frequência)
      const parcelasPendentes = db.prepare(`
        SELECT * FROM parcelas
        WHERE emprestimo_id = ? AND status != 'pago'
        ORDER BY numero_parcela ASC
      `).all(id);

      const updateParcelaData = db.prepare(`
        UPDATE parcelas
        SET data_vencimento = ?
        WHERE id = ?
      `);

      for (const p of parcelasPendentes) {
        const novaDataVencimento = calcularNovaDataVencimento(p.data_vencimento, emprestimo.frequencia);
        updateParcelaData.run(novaDataVencimento, p.id);
      }

      // 3) Recalcular o valor_juros_periodo baseado no saldo_principal e adicionar ao saldo_juros para o próximo ciclo
      const principalAtual = Number(
        emprestimo.saldo_principal !== null && emprestimo.saldo_principal !== undefined
          ? emprestimo.saldo_principal
          : emprestimo.valor_investido
      );
      const taxa = Number(emprestimo.taxa_juros || 0) / 100.0;
      const novoValorJurosPeriodo = Number((principalAtual * taxa).toFixed(2));
      const novoSaldoJuros = Number((saldoJurosAposAbate + novoValorJurosPeriodo).toFixed(2));

      db.prepare(`
        UPDATE emprestimos
        SET saldo_juros = ?,
            valor_juros_periodo = ?
        WHERE id = ?
      `).run(novoSaldoJuros, novoValorJurosPeriodo, id);

    } else if (tipoPagamento === 'principal') {
      // Subtrair valorPago do saldo_principal
      const principalAtual = Number(
        emprestimo.saldo_principal !== null && emprestimo.saldo_principal !== undefined
          ? emprestimo.saldo_principal
          : emprestimo.valor_investido
      );
      const novoSaldoPrincipal = Math.max(0, Number((principalAtual - numValorPago).toFixed(2)));

      // Recalcular valor_juros_periodo para os próximos ciclos proporcionalmente ao novo principal
      const taxa = Number(emprestimo.taxa_juros || 0) / 100.0;
      const novoValorJurosPeriodo = Number((novoSaldoPrincipal * taxa).toFixed(2));

      // Abater das parcelas pendentes
      let saldoParaAbater = numValorPago;
      const parcelasPendentes = db.prepare(`
        SELECT * FROM parcelas
        WHERE emprestimo_id = ? AND status != 'pago'
        ORDER BY numero_parcela ASC
      `).all(id);

      const updateParcelaAbate = db.prepare(`
        UPDATE parcelas
        SET valor_pago = ?,
            saldo_devedor = ?,
            status = ?,
            data_pagamento = ?
        WHERE id = ?
      `);

      for (const p of parcelasPendentes) {
        if (saldoParaAbater <= 0) break;
        const saldoDev = Number(p.saldo_devedor !== null && p.saldo_devedor !== undefined ? p.saldo_devedor : p.valor);
        const jaPago = Number(p.valor_pago || 0);

        if (saldoParaAbater >= saldoDev) {
          saldoParaAbater = Number((saldoParaAbater - saldoDev).toFixed(2));
          updateParcelaAbate.run(
            Number((jaPago + saldoDev).toFixed(2)),
            0,
            'pago',
            dataBaixa,
            p.id
          );
        } else {
          const novoJaPago = Number((jaPago + saldoParaAbater).toFixed(2));
          const novoSaldoDev = Number((saldoDev - saldoParaAbater).toFixed(2));
          saldoParaAbater = 0;
          updateParcelaAbate.run(
            novoJaPago,
            novoSaldoDev,
            'pendente',
            null,
            p.id
          );
        }
      }

      // Se o principal for totalmente liquidado e não restarem juros devidos, quita o empréstimo
      const saldoJurosRestante = Number(emprestimo.saldo_juros || 0);
      const novoStatus = (novoSaldoPrincipal === 0 && saldoJurosRestante === 0) ? 'quitado' : emprestimo.status;

      db.prepare(`
        UPDATE emprestimos
        SET saldo_principal = ?,
            valor_juros_periodo = ?,
            status = ?
        WHERE id = ?
      `).run(novoSaldoPrincipal, novoValorJurosPeriodo, novoStatus, id);

    } else if (tipoPagamento === 'total') {
      // Quitação total: zera principal, juros e encerra todas as parcelas
      db.prepare(`
        UPDATE emprestimos
        SET saldo_principal = 0,
            saldo_juros = 0,
            valor_juros_periodo = 0,
            status = 'quitado'
        WHERE id = ?
      `).run(id);

      db.prepare(`
        UPDATE parcelas
        SET status = 'pago',
            valor_pago = valor,
            saldo_devedor = 0,
            data_pagamento = ?
        WHERE emprestimo_id = ? AND status != 'pago'
      `).run(dataBaixa, id);
    }

    // 2.4 Retornar o novo estado consolidado do empréstimo
    const emprestimoAtualizado = db.prepare(`
      SELECT e.*, c.nome AS cliente_nome, c.cpf AS cliente_cpf, c.telefone AS cliente_telefone
      FROM emprestimos e
      JOIN clientes c ON e.cliente_id = c.id
      WHERE e.id = ?
    `).get(id);

    const parcelasAtualizadas = db.prepare(`
      SELECT * FROM parcelas
      WHERE emprestimo_id = ?
      ORDER BY numero_parcela ASC
    `).all(id);

    const pagamentosParciais = db.prepare(`
      SELECT * FROM pagamentos_parciais
      WHERE emprestimo_id = ?
      ORDER BY id DESC
    `).all(id);

    return {
      ...emprestimoAtualizado,
      parcelas: parcelasAtualizadas,
      pagamentos_parciais: pagamentosParciais,
      ultimoPagamento: {
        id: resultPagamento.lastInsertRowid,
        emprestimo_id: id,
        valor_pago: numValorPago,
        tipo_pagamento: tipoPagamento,
        data_pagamento: dataBaixa,
        observacao: observacao || null
      }
    };
  });

  return transacao();
}

module.exports = {
  darBaixaParcela,
  listarParcelas,
  calcularNovaDataVencimento,
  registrarPagamentoEspecial
};
