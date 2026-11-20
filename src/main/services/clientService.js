const { getDb } = require('../database/db');

/**
 * Lista todos os clientes com suporte a busca e filtro por status
 * @param {{ busca?: string, status?: string }} [filtros]
 * @returns {Array<object>}
 */
function listarClientes(filtros = {}) {
  const db = getDb();
  let query = `
    SELECT c.*, 
      (SELECT COUNT(e.id) FROM emprestimos e WHERE e.cliente_id = c.id AND e.status = 'ativo') AS emprestimos_ativos,
      (SELECT COUNT(p.id) FROM parcelas p 
       JOIN emprestimos e ON p.emprestimo_id = e.id 
       WHERE e.cliente_id = c.id AND p.status = 'pendente' AND date(p.data_vencimento) < date('now', 'localtime')) AS parcelas_atrasadas
    FROM clientes c
    WHERE 1=1
  `;
  const params = [];

  if (filtros.busca && filtros.busca.trim().length > 0) {
    query += ` AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.telefone LIKE ?)`;
    const termo = `%${filtros.busca.trim()}%`;
    params.push(termo, termo, termo);
  }

  if (filtros.status) {
    query += ` AND c.status = ?`;
    params.push(filtros.status);
  }

  query += ` ORDER BY c.nome COLLATE NOCASE ASC`;

  return db.prepare(query).all(...params);
}

/**
 * Obtém os dados de um cliente específico pelo ID
 * @param {number} id
 * @returns {object|null}
 */
function obterClientePorId(id) {
  const db = getDb();
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  if (!cliente) return null;

  const emprestimos = db.prepare(`
    SELECT * FROM emprestimos WHERE cliente_id = ? ORDER BY id DESC
  `).all(id);

  return {
    ...cliente,
    emprestimos
  };
}

/**
 * Cadastra um novo cliente com validação de duplicidade de CPF
 * @param {{ nome: string, cpf?: string, telefone?: string, endereco?: string }} dados
 * @returns {object}
 */
function criarCliente(dados) {
  if (!dados.nome || dados.nome.trim().length === 0) {
    throw new Error('O nome do cliente é obrigatório.');
  }

  const db = getDb();
  const nome = dados.nome.trim();
  const cpf = dados.cpf ? dados.cpf.trim() : null;
  const telefone = dados.telefone ? dados.telefone.trim() : null;
  const endereco = dados.endereco ? dados.endereco.trim() : null;

  if (cpf) {
    const existeCpf = db.prepare('SELECT id FROM clientes WHERE cpf = ?').get(cpf);
    if (existeCpf) {
      throw new Error(`Já existe um cliente cadastrado com o CPF "${cpf}".`);
    }
  }

  const result = db.prepare(`
    INSERT INTO clientes (nome, cpf, telefone, endereco, status)
    VALUES (?, ?, ?, ?, 'ativo')
  `).run(nome, cpf, telefone, endereco);

  return {
    id: result.lastInsertRowid,
    nome,
    cpf,
    telefone,
    endereco,
    status: 'ativo'
  };
}

/**
 * Atualiza os dados de um cliente
 * @param {number} id
 * @param {{ nome?: string, cpf?: string, telefone?: string, endereco?: string, status?: string }} dados
 * @returns {object}
 */
function atualizarCliente(id, dados) {
  const db = getDb();
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  if (!cliente) {
    throw new Error(`Cliente #${id} não encontrado.`);
  }

  const nome = dados.nome !== undefined ? dados.nome.trim() : cliente.nome;
  const cpf = dados.cpf !== undefined ? (dados.cpf ? dados.cpf.trim() : null) : cliente.cpf;
  const telefone = dados.telefone !== undefined ? (dados.telefone ? dados.telefone.trim() : null) : cliente.telefone;
  const endereco = dados.endereco !== undefined ? (dados.endereco ? dados.endereco.trim() : null) : cliente.endereco;
  const status = dados.status !== undefined ? dados.status : cliente.status;

  if (!nome || nome.length === 0) {
    throw new Error('O nome do cliente não pode ser vazio.');
  }

  if (cpf && cpf !== cliente.cpf) {
    const existeCpf = db.prepare('SELECT id FROM clientes WHERE cpf = ? AND id != ?').get(cpf, id);
    if (existeCpf) {
      throw new Error(`Já existe outro cliente cadastrado com o CPF "${cpf}".`);
    }
  }

  db.prepare(`
    UPDATE clientes 
    SET nome = ?, cpf = ?, telefone = ?, endereco = ?, status = ?
    WHERE id = ?
  `).run(nome, cpf, telefone, endereco, status, id);

  return {
    id,
    nome,
    cpf,
    telefone,
    endereco,
    status
  };
}

/**
 * Remove um cliente caso não possua empréstimos vinculados
 * @param {number} id
 */
function removerCliente(id) {
  const db = getDb();
  const emprestimosCount = db.prepare('SELECT COUNT(*) AS total FROM emprestimos WHERE cliente_id = ?').get(id);

  if (emprestimosCount && emprestimosCount.total > 0) {
    throw new Error('Não é possível excluir um cliente que possui histórico de empréstimos.');
  }

  const result = db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
  return {
    success: result.changes > 0
  };
}

module.exports = {
  listarClientes,
  obterClientePorId,
  criarCliente,
  atualizarCliente,
  removerCliente
};
