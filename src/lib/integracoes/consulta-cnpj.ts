import { normalizarCnae } from "@/lib/dominio/fiscal";

/**
 * Consulta de CNPJ na base pública (SPEC-004; ADR-006). O contrato `ConsultaCnpj`
 * isola o provedor: hoje a BrasilAPI, amanhã outro, sem mudar o domínio.
 *
 * Minimização (INV-004 da SPEC-004): no cadastro do negócio, só os campos de `DadosDoCnpj`
 * saem do adaptador. Sócios, e-mail, telefone e endereço são descartados e nunca vão para log.
 * O cliente empresa (SPEC-022, OPEN-004 e OPEN-009) usa `consultarEmpresa`, que traz também o
 * endereço, o telefone e o e-mail públicos da empresa — nunca os sócios.
 */

export type DadosDoCnpj = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  /** CNAE principal normalizado ("0000-0/00"), ou null se ausente. */
  cnae: string | null;
  optanteMei: boolean;
  optanteSimples: boolean;
  /** Situação cadastral em maiúsculas (ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA). */
  situacao: string;
};

/** Dados públicos da empresa para o cadastro do cliente (SPEC-022): campos vazios vêm null. */
export type DadosDaEmpresa = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
};

export type ErroDaConsulta = "Indisponivel" | "NaoEncontrado";

export type ResultadoDaConsulta = { ok: true; dados: DadosDoCnpj } | { ok: false; erro: ErroDaConsulta };
export type ResultadoDaEmpresa = { ok: true; dados: DadosDaEmpresa } | { ok: false; erro: ErroDaConsulta };

export interface ConsultaCnpj {
  consultar(cnpj: string): Promise<ResultadoDaConsulta>;
  consultarEmpresa(cnpj: string): Promise<ResultadoDaEmpresa>;
}

export const BASE_BRASILAPI = "https://brasilapi.com.br/api";
const TEMPO_LIMITE_MS = 5_000; // INV-005
export const USER_AGENT = "HealthEnterprise/1.0 (+https://github.com/VitorHashimoto21/projeto_HE_modelagem_de_sistemas)";

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no"]);

/** Numerais romanos até XXXIX ("Torre II", "Quadra XV"), com a pontuação que vier depois. */
const ROMANO = /^(?=[ivx])x{0,3}(ix|iv|v?i{0,3})[,.;]?$/;

/** A Receita grava tudo em maiúsculas: "JARDIM DAS VERTENTES" → "Jardim das Vertentes". */
export function capitalizar(valor: string | null): string | null {
  if (!valor) return null;
  return valor
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((p, i) => {
      if (i > 0 && MINUSCULAS.has(p)) return p;
      if (i > 0 && ROMANO.test(p)) return p.toUpperCase();
      return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1);
    })
    .join(" ");
}

export function mapearRespostaBrasilApi(cnpj: string, corpo: Record<string, unknown>): DadosDoCnpj {
  return {
    cnpj,
    razaoSocial: texto(corpo.razao_social) ?? "",
    nomeFantasia: texto(corpo.nome_fantasia),
    cnae: corpo.cnae_fiscal === null || corpo.cnae_fiscal === undefined ? null : normalizarCnae(String(corpo.cnae_fiscal)),
    optanteMei: corpo.opcao_pelo_mei === true,
    optanteSimples: corpo.opcao_pelo_simples === true,
    situacao: (texto(corpo.descricao_situacao_cadastral) ?? "DESCONHECIDA").toUpperCase(),
  };
}

/** Endereço, telefone e e-mail públicos da empresa (SPEC-022); os sócios (qsa) nunca saem daqui. */
export function mapearEmpresaBrasilApi(corpo: Record<string, unknown>): DadosDaEmpresa {
  const tipo = texto(corpo.descricao_tipo_de_logradouro);
  const via = texto(corpo.logradouro);
  const logradouro = via && tipo && !via.toUpperCase().startsWith(tipo.toUpperCase()) ? `${tipo} ${via}` : via;
  const numero = texto(corpo.numero);
  const cep = String(corpo.cep ?? "").replace(/\D/g, "");
  const telefone = String(corpo.ddd_telefone_1 ?? "").replace(/\D/g, "");
  const email = texto(corpo.email);
  const uf = texto(corpo.uf)?.toUpperCase() ?? null;
  return {
    razaoSocial: texto(corpo.razao_social) ?? "",
    nomeFantasia: texto(corpo.nome_fantasia),
    cep: cep.length === 8 ? cep : null,
    logradouro: capitalizar(logradouro),
    numero: numero && /^S\/?N$/i.test(numero) ? "S/N" : numero,
    complemento: capitalizar(texto(corpo.complemento)),
    bairro: capitalizar(texto(corpo.bairro)),
    municipio: capitalizar(texto(corpo.municipio)),
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null,
    telefone: telefone.length === 10 || telefone.length === 11 ? telefone : null,
    email: email && email.includes("@") ? email.toLowerCase() : null,
  };
}

/**
 * Busca com tempo limite e identificação; 400/404 = não encontrado, outros erros = indisponível.
 * Compartilhada com a consulta de CEP (SPEC-022). Nada da resposta vai para log.
 */
export async function buscarNaBrasilApi(
  url: string,
  rotulo: string,
  opcoes: { fetch?: typeof fetch; tempoLimiteMs?: number },
): Promise<{ ok: true; corpo: Record<string, unknown> } | { ok: false; erro: ErroDaConsulta }> {
  try {
    const resposta = await (opcoes.fetch ?? fetch)(url, {
      // A BrasilAPI recusa (403) requisições sem identificação, como o "node" padrão do fetch.
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS),
      cache: "no-store",
    });
    if (resposta.status === 404 || resposta.status === 400) return { ok: false, erro: "NaoEncontrado" };
    if (!resposta.ok) {
      console.error(`[${rotulo}] BrasilAPI respondeu`, resposta.status);
      return { ok: false, erro: "Indisponivel" };
    }
    return { ok: true, corpo: (await resposta.json()) as Record<string, unknown> };
  } catch (erro) {
    console.error(`[${rotulo}] consulta falhou:`, erro instanceof Error ? erro.name : "erro");
    return { ok: false, erro: "Indisponivel" };
  }
}

export function criarConsultaBrasilApi(
  opcoes: { fetch?: typeof fetch; tempoLimiteMs?: number; base?: string } = {},
): ConsultaCnpj {
  const url = (cnpj: string) => `${opcoes.base || BASE_BRASILAPI}/cnpj/v1/${cnpj}`;
  return {
    async consultar(cnpj) {
      const r = await buscarNaBrasilApi(url(cnpj), "cnpj", opcoes);
      return r.ok ? { ok: true, dados: mapearRespostaBrasilApi(cnpj, r.corpo) } : r;
    },
    async consultarEmpresa(cnpj) {
      const r = await buscarNaBrasilApi(url(cnpj), "cnpj", opcoes);
      return r.ok ? { ok: true, dados: mapearEmpresaBrasilApi(r.corpo) } : r;
    },
  };
}
