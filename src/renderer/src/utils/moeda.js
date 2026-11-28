/**
 * Utilitários para tratamento, máscara e conversão de valores monetários e numéricos (pt-BR).
 */

/**
 * Formata um número ou string numérica para exibição como moeda brasileira (BRL).
 * Ex: 1000.5 -> "R$ 1.000,50"
 */
export function formatarMoeda(valor) {
  const num = typeof valor === 'number' ? valor : parseMoedaParaFloat(valor);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

/**
 * Formata um valor numérico para o padrão pt-BR com separador de milhar e casas decimais.
 * Ex: 1000 -> "1.000,00" ou 1000.5 -> "1.000,50"
 */
export function formatarNumeroPtBR(valor, casasDecimais = 2) {
  if (valor === null || valor === undefined || valor === '') return '';
  const num = typeof valor === 'number' ? valor : parseMoedaParaFloat(valor);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais
  }).format(num);
}

/**
 * Aplica máscara de moeda brasileira durante a digitação livre no campo de input.
 * - Suporta digitação direta de números com pontuação de milhar dinâmica (ex: 1000 -> 1.000)
 * - Permite digitar vírgula ou ponto para casas decimais (ex: 1000,50 -> 1.000,50)
 * - Mantém a vírgula visível enquanto o usuário está digitando (ex: 1000, -> 1.000,)
 * - Limita a no máximo 2 casas decimais
 */
export function mascaraMoedaPtBR(valor) {
  if (valor === null || valor === undefined) return '';
  let str = String(valor).trim();
  if (!str) return '';

  // Filtra apenas números, pontos e vírgulas
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return '';

  let intPart = '';
  let decPart = '';
  let hasDecimal = false;

  if (str.includes(',')) {
    const parts = str.split(',');
    intPart = parts[0].replace(/\./g, '');
    decPart = parts.slice(1).join('').replace(/[^0-9]/g, '').slice(0, 2);
    hasDecimal = true;
  } else if (str.endsWith('.')) {
    // Tecla decimal digitada como ponto (ex: teclado numérico)
    intPart = str.slice(0, -1).replace(/\./g, '');
    decPart = '';
    hasDecimal = true;
  } else {
    // Verifica se possui ponto funcionando como separador decimal (1 ou 2 dígitos no final)
    const lastDotIdx = str.lastIndexOf('.');
    if (lastDotIdx !== -1) {
      const afterLastDot = str.slice(lastDotIdx + 1);
      if (/^\d{1,2}$/.test(afterLastDot)) {
        intPart = str.slice(0, lastDotIdx).replace(/\./g, '');
        decPart = afterLastDot;
        hasDecimal = true;
      } else {
        intPart = str.replace(/\./g, '');
      }
    } else {
      intPart = str;
    }
  }

  const intDigits = intPart.replace(/\D/g, '');
  let formattedInt = '';

  if (intDigits === '') {
    formattedInt = hasDecimal ? '0' : '';
  } else {
    // Remove zeros à esquerda mantendo pelo menos um dígito
    const cleanLeadingZeros = intDigits.replace(/^0+(?=\d)/, '');
    formattedInt = cleanLeadingZeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  if (hasDecimal) {
    return formattedInt ? `${formattedInt},${decPart}` : `0,${decPart}`;
  }
  return formattedInt;
}

/**
 * REGRA DE OURO: Converte string monetária formatada pt-BR ("1.000,50", "1.000", "250,00")
 * em um float limpo (1000.5, 1000, 250), pronto para ser enviado ao backend/banco de dados.
 */
export function parseMoedaParaFloat(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
  const limpo = String(valor).trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

/**
 * Handler genérico para inputs de moeda que previne o salto do cursor ao digitar.
 * Preserva a posição relativa do cursor calculando os dígitos válidos antes da edição.
 */
export function handleMoedaChange(e, onChange) {
  const input = e.target;
  const rawValue = input.value;
  const selectionStart = input.selectionStart ?? rawValue.length;

  // Conta quantos dígitos/vírgula existiam antes do cursor antes da formatação
  const rawBeforeCursor = rawValue.slice(0, selectionStart);
  const relevantCharsBefore = (rawBeforeCursor.match(/[0-9,]/g) || []).length;

  // Formata o novo valor
  const formatted = mascaraMoedaPtBR(rawValue);

  // Atualiza o estado
  if (typeof onChange === 'function') {
    onChange(formatted);
  }

  // Calcula a posição de destino do cursor no valor formatado
  let newCursorPos = 0;
  let relevantCharsCount = 0;

  while (newCursorPos < formatted.length && relevantCharsCount < relevantCharsBefore) {
    if (/[0-9,]/.test(formatted[newCursorPos])) {
      relevantCharsCount++;
    }
    newCursorPos++;
  }

  // Restaura a posição exata do cursor no próximo frame de renderização
  requestAnimationFrame(() => {
    try {
      if (input && typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    } catch {
      // Ignora erro se elemento desmontado
    }
  });

  return formatted;
}

/**
 * Previne que pressionar a tecla Enter em formulários quebre o estado do input
 * ou submeta o formulário de forma inesperada.
 */
export function prevenirEnter(e) {
  if (e.key === 'Enter') {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag !== 'textarea') {
      e.preventDefault();
    }
  }
}
