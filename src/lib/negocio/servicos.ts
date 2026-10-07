import { CnpjJaCadastrado, type ConsultasDeNegocios } from "@/lib/db/negocios";
import type { ErrosDeCampo } from "@/lib/auth/validacao";
import { cnpjValido, normalizarCnpj } from "@/lib/dominio/cnpj";
import type { ConsultaCnpj } from "@/lib/integracoes/consulta-cnpj";
import { sugerirEnquadramento, type AnexoDoCnae, type Sugestao } from "./enquadramento";
import { MENSAGENS_NEGOCIO, validarNegocio } from "./validacao";

/**
 * Fluxos do negócio (SPEC-004, seção 5), independentes do Next.js: as Server Actions
 * só leem o formulário e chamam estas funções, que validam tudo de novo.
 */

export const MENSAGENS_FLUXO = {
  semSessao: "Sua sessão expirou. Entre de novo.",
  cnpjJaCadastrado: "Este CNPJ já está cadastrado no Health Enterprise. Peça um convite ao Dono do negócio.",
  consultaIndisponivel: "Não conseguimos consultar o CNPJ agora. Preencha os dados abaixo.",
  naoEncontrado: "CNPJ não encontrado na base pública. Preencha os dados abaixo.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
  somenteDono: "Só o Dono pode alterar os dados do negócio.",
  naoMembro: "Você não tem acesso a esse negócio.",
} as const;

export type EstadoDaConsulta =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo; cnpj?: string }
  /** OPEN-002/OPEN-003: o cadastro não segue com este CNPJ. */
  | { status: "bloqueado"; mensagem: string; cnpj: string }
  | { status: "sugerido"; cnpj: string; sugestao: Sugestao }
  /** Consulta indisponível ou CNPJ não encontrado: preenchimento manual (CA-03). */
  | { status: "manual"; cnpj: string; mensagem: string };

export type EstadoDoFormularioDeNegocio =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; negocioId: string };

export const CONSULTA_INICIAL: EstadoDaConsulta = { status: "ocioso" };
export const FORMULARIO_INICIAL: EstadoDoFormularioDeNegocio = { status: "ocioso" };

export type DependenciasDoNegocio = {
  /** Usuário da sessão validada no servidor (null = sem sessão — INV-008). */
  usuarioId: string | null;
  consulta: ConsultaCnpj;
  anexoDoCnae(cnae: string): Promise<AnexoDoCnae>;
  negocios: Pick<ConsultasDeNegocios, "criarComDono" | "cnpjCadastrado" | "papel" | "dadosFiscais" | "atualizarDadosFiscais">;
  /** Grava o negócio ativo (cookie he_negocio). */
  definirNegocioAtivo(negocioId: string): Promise<void>;
};

/** Consultar o CNPJ e sugerir o enquadramento (5.1, passos 2 e 3). */
export async function consultarCnpj(campos: Record<string, string>, deps: DependenciasDoNegocio): Promise<EstadoDaConsulta> {
  if (!deps.usuarioId) return { status: "erro", mensagem: MENSAGENS_FLUXO.semSessao };
  const cnpj = normalizarCnpj(campos.cnpj ?? "");
  if (!cnpj || !cnpjValido(cnpj)) {
    return { status: "erro", erros: { cnpj: campos.cnpj?.trim() ? MENSAGENS_NEGOCIO.cnpjInvalido : MENSAGENS_NEGOCIO.cnpjObrigatorio }, cnpj: campos.cnpj };
  }
  if (await deps.negocios.cnpjCadastrado(cnpj)) {
    return { status: "erro", erros: { cnpj: MENSAGENS_FLUXO.cnpjJaCadastrado }, cnpj };
  }

  const r = await deps.consulta.consultar(cnpj);
  if (!r.ok) {
    return { status: "manual", cnpj, mensagem: r.erro === "NaoEncontrado" ? MENSAGENS_FLUXO.naoEncontrado : MENSAGENS_FLUXO.consultaIndisponivel };
  }

  const anexo = r.dados.cnae ? await deps.anexoDoCnae(r.dados.cnae) : null;
  const s = sugerirEnquadramento(r.dados, anexo);
  return s.ok ? { status: "sugerido", cnpj, sugestao: s.sugestao } : { status: "bloqueado", cnpj, mensagem: s.mensagem };
}

/** Cadastrar o negócio (5.1, passos 5 e 6; 5.2). O novo negócio vira o ativo. */
export async function cadastrarNegocio(
  campos: Record<string, string>,
  deps: DependenciasDoNegocio,
): Promise<EstadoDoFormularioDeNegocio> {
  if (!deps.usuarioId) return { status: "erro", mensagem: MENSAGENS_FLUXO.semSessao };
  const v = validarNegocio(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };

  if (v.dados.cnpj && (await deps.negocios.cnpjCadastrado(v.dados.cnpj))) {
    return { status: "erro", erros: { cnpj: MENSAGENS_FLUXO.cnpjJaCadastrado } };
  }
  try {
    const negocioId = await deps.negocios.criarComDono(deps.usuarioId, v.dados);
    await deps.definirNegocioAtivo(negocioId);
    return { status: "salvo", negocioId };
  } catch (e) {
    if (e instanceof CnpjJaCadastrado) return { status: "erro", erros: { cnpj: MENSAGENS_FLUXO.cnpjJaCadastrado } };
    console.error("[negocio] falha ao cadastrar:", e instanceof Error ? e.name : "erro");
    return { status: "erro", mensagem: MENSAGENS_FLUXO.falhaInterna };
  }
}

/** Trocar o negócio ativo (5.4, UC2): só para negócio do qual o usuário é membro (INV-006). */
export async function trocarNegocio(negocioId: string, deps: DependenciasDoNegocio): Promise<{ ok: boolean }> {
  if (!deps.usuarioId || !negocioId) return { ok: false };
  if ((await deps.negocios.papel(deps.usuarioId, negocioId)) === null) return { ok: false };
  await deps.definirNegocioAtivo(negocioId);
  return { ok: true };
}

/**
 * Editar os dados fiscais (5.5): só o Dono (INV-007). O CNPJ não muda depois de
 * cadastrado; um negócio sem CNPJ (Autônomo) pode informá-lo ao virar MEI ou Simples.
 */
export async function editarNegocio(
  negocioId: string,
  campos: Record<string, string>,
  deps: DependenciasDoNegocio,
): Promise<EstadoDoFormularioDeNegocio> {
  if (!deps.usuarioId) return { status: "erro", mensagem: MENSAGENS_FLUXO.semSessao };
  if ((await deps.negocios.papel(deps.usuarioId, negocioId)) !== "DONO") {
    return { status: "erro", mensagem: MENSAGENS_FLUXO.somenteDono };
  }
  const atual = await deps.negocios.dadosFiscais(negocioId);
  if (!atual) return { status: "erro", mensagem: MENSAGENS_FLUXO.naoMembro };

  // Autônomo é o regime de quem não tem CNPJ: um negócio com CNPJ não volta para ele.
  if (atual.cnpj && campos.regime === "AUTONOMO") {
    return { status: "erro", erros: { regime: "Um negócio com CNPJ não pode ser autônomo. Escolha MEI ou Simples Nacional." } };
  }
  const entrada = { ...campos };
  if (atual.cnpj) entrada.cnpj = atual.cnpj;
  const v = validarNegocio(entrada);
  if (!v.ok) return { status: "erro", erros: v.erros };

  if (v.dados.cnpj && v.dados.cnpj !== atual.cnpj && (await deps.negocios.cnpjCadastrado(v.dados.cnpj))) {
    return { status: "erro", erros: { cnpj: MENSAGENS_FLUXO.cnpjJaCadastrado } };
  }
  try {
    await deps.negocios.atualizarDadosFiscais(negocioId, v.dados);
    return { status: "salvo", negocioId };
  } catch (e) {
    if (e instanceof CnpjJaCadastrado) return { status: "erro", erros: { cnpj: MENSAGENS_FLUXO.cnpjJaCadastrado } };
    console.error("[negocio] falha ao editar:", e instanceof Error ? e.name : "erro");
    return { status: "erro", mensagem: MENSAGENS_FLUXO.falhaInterna };
  }
}
