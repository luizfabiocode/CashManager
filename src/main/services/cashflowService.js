const { getDb } = require('../database/db');

/**
 * Calcula o saldo consolidado atual em caixa (Entradas - Saídas)
 * @returns {number}
 */
function obterSaldoAtual() {
  const db = getDb();
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saldo
    FROM movimentacoes_caixa
  `).get();

  return Number((row ? row.saldo : 0).toFixed(2));
}

/**
 * Registra uma movimentação no fluxo de caixa
 * @param {'entrada'|'saida'} tipo 
 * @param {number} valor 
 * @param {string} descricao 
 * @param {string} [data] Data no formato ISO/YYYY-MM-DD
 * @param {number} [origemId]
 * @returns {object}
 */
function registrarMovimentacao(tipo, valor, descricao, data = null, origemId = null) {
  if (tipo !== 'entrada' && tipo !== 'saida') {
    throw new Error('Tipo de movimentação inválido. Deve ser "entrada" ou "saida".');
  }

  const numValor = Number(valor);
  if (isNaN(numValor) || numValor <= 0) {
    throw new Error('O valor da movimentação deve ser maior que zero.');
  }

  if (!descricao || descricao.trim().length === 0) {
    throw new Error('A descrição da movimentação é obrigatória.');
  }

  const dataMovimentacao = data || new Date().toISOString().split('T')[0];
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO movimentacoes_caixa (tipo, valor, descricao, data, origem_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(tipo, Number(numValor.toFixed(2)), descricao.trim(), dataMovimentacao, origemId);

  return {
    id: result.lastInsertRowid,
    tipo,
    valor: Number(numValor.toFixed(2)),
    descricao: descricao.trim(),
    data: dataMovimentacao,
    origem_id: origemId
  };
}

/**
 * Obtém o extrato das movimentações de caixa com filtros
 * @param {{ dataInicio?: string, dataFim?: string, tipo?: string, busca?: string }} [filtros]
 * @returns {Array<object>}
 */
function obterExtratoCaixa(filtros = {}) {
  const db = getDb();
  let query = `SELECT * FROM movimentacoes_caixa WHERE 1=1`;
  const params = [];

  if (filtros.dataInicio) {
    query += ` AND date(data) >= date(?)`;
    params.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    query += ` AND date(data) <= date(?)`;
    params.push(filtros.dataFim);
  }

  if (filtros.tipo && (filtros.tipo === 'entrada' || filtros.tipo === 'saida')) {
    query += ` AND tipo = ?`;
    params.push(filtros.tipo);
  }

  if (filtros.busca && filtros.busca.trim().length > 0) {
    query += ` AND descricao LIKE ?`;
    params.push(`%${filtros.busca.trim()}%`);
  }

  query += ` ORDER BY data DESC, id DESC`;

  const movimentacoes = db.prepare(query).all(...params);
  const saldoAtual = obterSaldoAtual();

  return {
    saldoAtual,
    movimentacoes
  };
}

module.exports = {
  obterSaldoAtual,
  registrarMovimentacao,
  obterExtratoCaixa
};
