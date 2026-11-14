import { BASE_BRASILAPI, buscarNaBrasilApi, type ErroDaConsulta } from "./consulta-cnpj";

/**
 * Consulta de CEP na base pública (SPEC-022, OPEN-004; ampliação da ADR-006): mesmo adaptador,
 * tempo limite e preenchimento manual quando falha. Só o CEP sai do sistema — nunca o CPF (INV-004).
 */

export type EnderecoDoCep = {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
};

export type ResultadoDoCep = { ok: true; endereco: EnderecoDoCep } | { ok: false; erro: ErroDaConsulta };

export interface ConsultaCep {
  consultar(cep: string): Promise<ResultadoDoCep>;
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Resposta da BrasilAPI (cep/v1): street, neighborhood, city, state. */
export function mapearCepBrasilApi(cep: string, corpo: Record<string, unknown>): EnderecoDoCep {
  const uf = texto(corpo.state)?.toUpperCase() ?? null;
  return {
    cep,
    logradouro: texto(corpo.street),
    bairro: texto(corpo.neighborhood),
    municipio: texto(corpo.city),
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null,
  };
}

export function criarConsultaCepBrasilApi(opcoes: { fetch?: typeof fetch; tempoLimiteMs?: number; base?: string } = {}): ConsultaCep {
  return {
    async consultar(cep) {
      const r = await buscarNaBrasilApi(`${opcoes.base || BASE_BRASILAPI}/cep/v1/${cep}`, "cep", opcoes);
      return r.ok ? { ok: true, endereco: mapearCepBrasilApi(cep, r.corpo) } : r;
    },
  };
}
