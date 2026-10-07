/**
 * CNPJ (SPEC-004, INV-003): normalização, dígitos verificadores e formatação.
 * Funções puras (ADR-005).
 */

/** Só os dígitos; null se não forem exatamente 14. */
export function normalizarCnpj(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 14 ? digitos : null;
}

function digitoVerificador(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...base].reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ com 14 dígitos, dígitos verificadores corretos e sem todos os dígitos iguais. */
export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!cnpj || /^(\d)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoVerificador(cnpj.slice(0, 12));
  const segundo = digitoVerificador(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

/** "00000000000191" → "00.000.000/0001-91". */
export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * A razão social de um MEI costuma terminar com o CPF do titular
 * ("MARIA SILVA 12345678901" ou "MARIA SILVA 123.456.789-01"). Retira esse final
 * (SPEC-004, OPEN-004: minimização — o CPF não é usado no sistema).
 */
export function removerCpfDaRazaoSocial(razaoSocial: string): string {
  return razaoSocial.replace(/[\s,.-]*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/, "").trim();
}
