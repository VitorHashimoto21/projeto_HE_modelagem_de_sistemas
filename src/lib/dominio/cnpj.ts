/**
 * CNPJ (SPEC-004, INV-003): normalização, dígitos verificadores e formatação.
 * SPEC-022 (OPEN-007): também o CNPJ com letras (IN RFB nº 2.229/2024), emitido desde 07/2026:
 * 12 posições com letras ou dígitos e 2 dígitos verificadores. Funções puras (ADR-005).
 */

/** Sem pontuação, em maiúsculas; null se não forem 12 letras ou dígitos seguidos de 2 dígitos. */
export function normalizarCnpj(valor: string): string | null {
  const limpo = valor.replace(/[\s./-]/g, "").toUpperCase();
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(limpo) ? limpo : null;
}

/** Módulo 11; cada caractere vale o código ASCII menos 48 (os dígitos continuam valendo 0 a 9). */
function digitoVerificador(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...base].reduce((acc, c, i) => acc + (c.charCodeAt(0) - 48) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ com 14 posições, dígitos verificadores corretos e sem todas as posições iguais. */
export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!cnpj || /^(.)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoVerificador(cnpj.slice(0, 12));
  const segundo = digitoVerificador(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

/** "00000000000191" → "00.000.000/0001-91"; "12ABC34501DE35" → "12.ABC.345/01DE-35". */
export function formatarCnpj(cnpj: string): string {
  const c = normalizarCnpj(cnpj);
  if (!c) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/**
 * A razão social de um MEI costuma terminar com o CPF do titular
 * ("MARIA SILVA 12345678901" ou "MARIA SILVA 123.456.789-01"). Retira esse final
 * (SPEC-004, OPEN-004: minimização — o CPF não é usado no sistema).
 */
export function removerCpfDaRazaoSocial(razaoSocial: string): string {
  return razaoSocial.replace(/[\s,.-]*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/, "").trim();
}
