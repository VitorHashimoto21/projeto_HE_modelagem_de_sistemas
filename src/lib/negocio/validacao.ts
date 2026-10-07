import { AnexoSimples, AtividadeMei, RegimeTributario } from "@/generated/prisma/enums";
import { cnpjValido, normalizarCnpj } from "@/lib/dominio/cnpj";
import { normalizarCnae } from "@/lib/dominio/fiscal";
import type { ErrosDeCampo } from "@/lib/auth/validacao";

/**
 * Validação dos dados do negócio por regime (SPEC-004, 5.3; INV-002). Roda no
 * navegador e no servidor. Recebe os campos do formulário como texto.
 */

export const MENSAGENS_NEGOCIO = {
  nomeObrigatorio: "Informe o nome do negócio",
  nomeLongo: "Use no máximo 120 caracteres",
  regimeObrigatorio: "Escolha o regime do negócio",
  cnpjObrigatorio: "Informe o CNPJ",
  cnpjInvalido: "CNPJ inválido",
  cnpjNaoPermitido: "Negócio autônomo não tem CNPJ",
  anexoObrigatorio: "Escolha o Anexo do Simples Nacional",
  atividadeObrigatoria: "Escolha a atividade do MEI",
  impostoObrigatorio: "Informe o percentual de imposto que você paga",
  impostoInvalido: "Use um percentual entre 0 e 99,99",
  cnaeInvalido: "CNAE deve ter 7 dígitos (ex.: 4772-5/00)",
  campoForaDoRegime: "Este campo não vale para o regime escolhido",
} as const;

export type DadosDoNegocio = {
  nome: string;
  regime: RegimeTributario;
  cnpj: string | null;
  razaoSocial: string | null;
  cnaePrincipal: string | null;
  anexoSimples: AnexoSimples | null;
  sujeitoFatorR: boolean;
  atividadeMei: AtividadeMei | null;
  impostoPercentualManual: number | null;
};

export type ValidacaoDoNegocio = { ok: true; dados: DadosDoNegocio } | { ok: false; erros: ErrosDeCampo };

const vazio = (v: string | undefined) => !v || v.trim() === "";
const pertence = <T extends Record<string, string>>(e: T, v: string | undefined): v is T[keyof T] =>
  !!v && (Object.values(e) as string[]).includes(v);

/** "6,5" ou "6.5" → 6.5; null se não for número. */
export function lerPercentual(v: string | undefined): number | null {
  if (vazio(v)) return null;
  const n = Number(v!.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function validarNegocio(campos: Record<string, string>): ValidacaoDoNegocio {
  const erros: ErrosDeCampo = {};
  const nome = (campos.nome ?? "").trim();
  if (!nome) erros.nome = MENSAGENS_NEGOCIO.nomeObrigatorio;
  else if (nome.length > 120) erros.nome = MENSAGENS_NEGOCIO.nomeLongo;

  const regime = campos.regime;
  if (!pertence(RegimeTributario, regime)) {
    erros.regime = MENSAGENS_NEGOCIO.regimeObrigatorio;
    return { ok: false, erros };
  }

  const exige = (campo: string, mensagem: string) => {
    if (vazio(campos[campo])) erros[campo] = mensagem;
  };
  const proibe = (campo: string, mensagem: string = MENSAGENS_NEGOCIO.campoForaDoRegime) => {
    if (!vazio(campos[campo])) erros[campo] = mensagem;
  };

  // CNPJ: obrigatório e válido para MEI e Simples; proibido para Autônomo.
  let cnpj: string | null = null;
  if (regime === "AUTONOMO") {
    proibe("cnpj", MENSAGENS_NEGOCIO.cnpjNaoPermitido);
  } else if (vazio(campos.cnpj)) {
    erros.cnpj = MENSAGENS_NEGOCIO.cnpjObrigatorio;
  } else if (!cnpjValido(campos.cnpj)) {
    erros.cnpj = MENSAGENS_NEGOCIO.cnpjInvalido;
  } else {
    cnpj = normalizarCnpj(campos.cnpj);
  }

  let cnaePrincipal: string | null = null;
  if (!vazio(campos.cnaePrincipal)) {
    cnaePrincipal = normalizarCnae(campos.cnaePrincipal);
    if (!cnaePrincipal) erros.cnaePrincipal = MENSAGENS_NEGOCIO.cnaeInvalido;
  }

  let anexoSimples: AnexoSimples | null = null;
  let atividadeMei: AtividadeMei | null = null;
  let impostoPercentualManual: number | null = null;
  const sujeitoFatorR = regime === "SIMPLES_NACIONAL" && campos.sujeitoFatorR === "on";

  if (regime === "SIMPLES_NACIONAL") {
    if (pertence(AnexoSimples, campos.anexoSimples)) anexoSimples = campos.anexoSimples;
    else erros.anexoSimples = MENSAGENS_NEGOCIO.anexoObrigatorio;
    proibe("atividadeMei");
    proibe("impostoPercentual");
  } else if (regime === "MEI") {
    if (pertence(AtividadeMei, campos.atividadeMei)) atividadeMei = campos.atividadeMei;
    else erros.atividadeMei = MENSAGENS_NEGOCIO.atividadeObrigatoria;
    proibe("anexoSimples");
    proibe("impostoPercentual");
  } else {
    exige("impostoPercentual", MENSAGENS_NEGOCIO.impostoObrigatorio);
    if (!erros.impostoPercentual) {
      const p = lerPercentual(campos.impostoPercentual);
      if (p === null || p < 0 || p > 99.99) erros.impostoPercentual = MENSAGENS_NEGOCIO.impostoInvalido;
      else impostoPercentualManual = Math.round(p * 100) / 100;
    }
    proibe("anexoSimples");
    proibe("atividadeMei");
    proibe("razaoSocial");
    proibe("cnaePrincipal");
  }

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      nome,
      regime,
      cnpj,
      razaoSocial: regime === "AUTONOMO" ? null : (campos.razaoSocial ?? "").trim() || null,
      cnaePrincipal,
      anexoSimples,
      sujeitoFatorR,
      atividadeMei,
      impostoPercentualManual,
    },
  };
}
