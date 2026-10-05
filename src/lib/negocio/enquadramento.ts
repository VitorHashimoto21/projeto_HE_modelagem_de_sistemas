import type { AnexoSimples, AtividadeMei, RegimeTributario } from "@/generated/prisma/enums";
import { removerCpfDaRazaoSocial } from "@/lib/dominio/cnpj";
import type { DadosDoCnpj } from "@/lib/integracoes/consulta-cnpj";

/**
 * Sugestão de enquadramento a partir do CNPJ (SPEC-004, 5.1; RF58, RF59). Pura: os
 * dados da consulta e o Anexo do CNAE (SPEC-003) chegam prontos.
 */

export type AnexoDoCnae = { anexo: AnexoSimples; sujeitoFatorR: boolean } | null;

export type Sugestao = {
  nome: string;
  razaoSocial: string;
  cnaePrincipal: string | null;
  regime: Extract<RegimeTributario, "MEI" | "SIMPLES_NACIONAL">;
  anexoSimples: AnexoSimples | null;
  sujeitoFatorR: boolean;
  atividadeMei: AtividadeMei | null;
  /** O CNAE não está na tabela CnaeAnexo: a pessoa escolhe o Anexo (CA-04). */
  cnaeForaDaTabela: boolean;
  avisos: string[];
};

export type ResultadoDaSugestao =
  | { ok: true; sugestao: Sugestao }
  /** OPEN-002 e OPEN-003: casos em que o cadastro não segue. */
  | { ok: false; motivo: "ForaDoSimples" | "SituacaoImpeditiva"; mensagem: string };

export const MENSAGENS_ENQUADRAMENTO = {
  foraDoSimples:
    "Pela base pública, esta empresa não é MEI nem optante pelo Simples Nacional. Por enquanto o Health Enterprise atende MEI, Simples Nacional e autônomos.",
  situacaoImpeditiva: (s: string) => `Este CNPJ está com a situação ${s} na Receita Federal e não pode ser cadastrado.`,
  situacaoComAviso: (s: string) =>
    `A situação deste CNPJ na Receita é ${s}. Regularize junto à Receita; a base pública também pode estar desatualizada.`,
  anexoUnico:
    "O mesmo Anexo vale para todo o faturamento do negócio. Se você vende produtos e serviços em Anexos diferentes, o imposto será uma aproximação (RN24).",
  cnaeForaDaTabela:
    "Não encontramos o Anexo do seu CNAE na nossa tabela. Escolha o Anexo abaixo — ele aparece no seu extrato do Simples ou com o seu contador.",
} as const;

const IMPEDITIVAS = new Set(["BAIXADA", "NULA"]);
const COM_AVISO = new Set(["INAPTA", "SUSPENSA"]);

/** Atividade do MEI sugerida pelo Anexo do CNAE: I e II → comércio/indústria; III a V → serviços. */
export function atividadeMeiDoAnexo(anexo: AnexoSimples | undefined): AtividadeMei | null {
  if (!anexo) return null;
  return anexo === "I" || anexo === "II" ? "COMERCIO_INDUSTRIA" : "SERVICOS";
}

export function sugerirEnquadramento(dados: DadosDoCnpj, anexoDoCnae: AnexoDoCnae): ResultadoDaSugestao {
  if (IMPEDITIVAS.has(dados.situacao)) {
    return { ok: false, motivo: "SituacaoImpeditiva", mensagem: MENSAGENS_ENQUADRAMENTO.situacaoImpeditiva(dados.situacao) };
  }
  if (!dados.optanteMei && !dados.optanteSimples) {
    return { ok: false, motivo: "ForaDoSimples", mensagem: MENSAGENS_ENQUADRAMENTO.foraDoSimples };
  }

  const avisos: string[] = [];
  if (COM_AVISO.has(dados.situacao)) avisos.push(MENSAGENS_ENQUADRAMENTO.situacaoComAviso(dados.situacao));

  const razaoSocial = removerCpfDaRazaoSocial(dados.razaoSocial);
  const nome = dados.nomeFantasia ? removerCpfDaRazaoSocial(dados.nomeFantasia) || razaoSocial : razaoSocial;
  const regime = dados.optanteMei ? "MEI" : "SIMPLES_NACIONAL";
  const cnaeForaDaTabela = !anexoDoCnae;

  if (regime === "SIMPLES_NACIONAL") {
    avisos.push(MENSAGENS_ENQUADRAMENTO.anexoUnico);
    if (cnaeForaDaTabela) avisos.push(MENSAGENS_ENQUADRAMENTO.cnaeForaDaTabela);
  }

  return {
    ok: true,
    sugestao: {
      nome: nome.slice(0, 120),
      razaoSocial,
      cnaePrincipal: dados.cnae,
      regime,
      anexoSimples: regime === "SIMPLES_NACIONAL" ? (anexoDoCnae?.anexo ?? null) : null,
      sujeitoFatorR: regime === "SIMPLES_NACIONAL" && (anexoDoCnae?.sujeitoFatorR ?? false),
      atividadeMei: regime === "MEI" ? atividadeMeiDoAnexo(anexoDoCnae?.anexo) : null,
      cnaeForaDaTabela,
      avisos,
    },
  };
}
