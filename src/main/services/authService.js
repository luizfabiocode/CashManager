const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');

const SALT_ROUNDS = 10;

/**
 * Verifica se já existe um PIN cadastrado no sistema
 * @returns {{ configurado: boolean }}
 */
function verificarPinConfigurado() {
  const db = getDb();
  const row = db.prepare('SELECT pin_hash FROM configuracoes WHERE id = 1').get();
  return {
    configurado: Boolean(row && row.pin_hash && row.pin_hash.trim().length > 0)
  };
}

/**
 * Cadastra ou atualiza o PIN de segurança de 4 dígitos
 * @param {string} pin PIN numérico de 4 dígitos
 * @returns {{ success: boolean, message: string }}
 */
function cadastrarPin(pin) {
  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
    throw new Error('O PIN deve conter exatamente 4 dígitos numéricos.');
  }

  const db = getDb();
  const hash = bcrypt.hashSync(pin.trim(), SALT_ROUNDS);

  db.prepare(`
    UPDATE configuracoes 
    SET pin_hash = ?, atualizado_em = CURRENT_TIMESTAMP 
    WHERE id = 1
  `).run(hash);

  return {
    success: true,
    message: 'PIN cadastrado com sucesso.'
  };
}

/**
 * Autentica o usuário comparando o PIN informado com o hash Bcrypt
 * @param {string} pin PIN informado
 * @returns {{ autenticado: boolean, message: string }}
 */
function autenticarPin(pin) {
  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
    return {
      autenticado: false,
      message: 'PIN inválido. Digite 4 números.'
    };
  }

  const db = getDb();
  const row = db.prepare('SELECT pin_hash FROM configuracoes WHERE id = 1').get();

  if (!row || !row.pin_hash) {
    return {
      autenticado: false,
      primeiroAcesso: true,
      message: 'Nenhum PIN configurado no sistema. Cadastre um novo PIN.'
    };
  }

  const matches = bcrypt.compareSync(pin.trim(), row.pin_hash);

  if (!matches) {
    return {
      autenticado: false,
      message: 'PIN incorreto.'
    };
  }

  return {
    autenticado: true,
    message: 'Autenticação realizada com sucesso.'
  };
}

/**
 * Retorna as configurações gerais (sem expor o hash do PIN)
 * @returns {object}
 */
function obterConfiguracoes() {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, chave_pix, versao_sistema, criado_em, atualizado_em,
           (CASE WHEN pin_hash IS NOT NULL AND LENGTH(pin_hash) > 0 THEN 1 ELSE 0 END) AS pin_configurado
    FROM configuracoes 
    WHERE id = 1
  `).get();

  return row || {};
}

/**
 * Atualiza a chave PIX padrão
 * @param {string} chavePix
 */
function atualizarChavePix(chavePix) {
  const db = getDb();
  db.prepare(`
    UPDATE configuracoes 
    SET chave_pix = ?, atualizado_em = CURRENT_TIMESTAMP 
    WHERE id = 1
  `).run(chavePix || null);

  return {
    success: true,
    message: 'Chave PIX atualizada com sucesso.'
  };
}

module.exports = {
  verificarPinConfigurado,
  cadastrarPin,
  autenticarPin,
  obterConfiguracoes,
  atualizarChavePix
};
