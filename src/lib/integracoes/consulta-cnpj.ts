import { normalizarCnae } from "@/lib/dominio/fiscal";

/**
 * Consulta de CNPJ na base pública (SPEC-004; ADR-006). O contrato `ConsultaCnpj`
 * isola o provedor: hoje a BrasilAPI, amanhã outro, sem mudar o domínio.
 *
 * Minimização (INV-004): só os campos abaixo saem do adaptador. Sócios, e-mail,
 * telefone e endereço que a API devolve são descartados aqui e nunca vão para log.
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

export type ResultadoDaConsulta =
  | { ok: true; dados: DadosDoCnpj }
  | { ok: false; erro: "Indisponivel" | "NaoEncontrado" };

export interface ConsultaCnpj {
  consultar(cnpj: string): Promise<ResultadoDaConsulta>;
}

const URL_BRASILAPI = "https://brasilapi.com.br/api/cnpj/v1/";
const TEMPO_LIMITE_MS = 5_000; // INV-005
const USER_AGENT = "HealthEnterprise/1.0 (+https://github.com/VitorHashimoto21/projeto_HE_modelagem_de_sistemas)";

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

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

export function criarConsultaBrasilApi(
  opcoes: { fetch?: typeof fetch; tempoLimiteMs?: number } = {},
): ConsultaCnpj {
  const buscar = opcoes.fetch ?? fetch;
  const tempoLimite = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS;
  return {
    async consultar(cnpj) {
      try {
        const resposta = await buscar(`${URL_BRASILAPI}${cnpj}`, {
          // A BrasilAPI recusa (403) requisições sem identificação, como o "node" padrão do fetch.
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(tempoLimite),
          cache: "no-store",
        });
        if (resposta.status === 404 || resposta.status === 400) return { ok: false, erro: "NaoEncontrado" };
        if (!resposta.ok) {
          console.error("[cnpj] BrasilAPI respondeu", resposta.status);
          return { ok: false, erro: "Indisponivel" };
        }
        return { ok: true, dados: mapearRespostaBrasilApi(cnpj, (await resposta.json()) as Record<string, unknown>) };
      } catch (erro) {
        console.error("[cnpj] consulta falhou:", erro instanceof Error ? erro.name : "erro");
        return { ok: false, erro: "Indisponivel" };
      }
    },
  };
}
