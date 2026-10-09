import "server-only";
import { comNegocio, type ContextoDeNegocio } from "./cliente-do-negocio";
import { criarConsultasDeAcesso } from "./acesso";
import { criarConsultasDoCatalogo } from "./catalogo";
import { criarConsultasDoEstoque } from "./estoque";
import { criarConsultasDeEquipe } from "./equipe";
import { criarConsultasDeNegocios } from "./negocios";
import { criarConsultasFiscais } from "./parametros-fiscais";
import { prismaBase } from "./prisma";

export type { ConsultasDeAcesso } from "./acesso";
export type { ConsultasDoEstoque, DetalheDoEstoque, ProdutoEmEstoque } from "./estoque";
export type { ConsultasDoCatalogo, DetalheDoItem, ItemResumido, OpcaoDeMaterial } from "./catalogo";
export { LIMITE_DO_PLANO_GRATUITO } from "./equipe";
export type { ConsultasDeEquipe, ConvitePendente, EquipeDoNegocio, MembroDaEquipe } from "./equipe";
export { CnpjJaCadastrado } from "./negocios";
export type { ConsultasDeNegocios, ResumoDoNegocio } from "./negocios";
export { AcimaDoLimiteDoSimples, ParametroAusente } from "./parametros-fiscais";
export type { ConsultasFiscais, Origem } from "./parametros-fiscais";
export { ContextoDeNegocioAusente, NegocioDivergente, OperacaoForaDoContexto } from "./erros";
export type { ClienteDoNegocio, ContextoDeNegocio } from "./cliente-do-negocio";

/**
 * Acesso aos dados de um negócio (SPEC-001, seção 9). Toda operação fica restrita
 * ao negocioId do contexto; sem contexto, lança ContextoDeNegocioAusente.
 * A partir da SPEC-002, o contexto vem da sessão autenticada.
 */
export function clienteDoNegocio(contexto: ContextoDeNegocio | null | undefined) {
  return comNegocio(prismaBase(), contexto);
}

/** Catálogo do negócio ativo (SPEC-006): sempre pelo cliente do negócio. */
export function catalogo(contexto: ContextoDeNegocio) {
  return criarConsultasDoCatalogo(clienteDoNegocio(contexto), contexto.negocioId);
}

/** Estoque do negócio ativo (SPEC-007): sempre pelo cliente do negócio. */
export function estoque(contexto: ContextoDeNegocio) {
  return criarConsultasDoEstoque(clienteDoNegocio(contexto), contexto.negocioId);
}

/** Consultas do controle de acesso (SPEC-002): conta bloqueada, filiação e perfil. */
export function consultasDeAcesso() {
  return criarConsultasDeAcesso(prismaBase());
}

/** Negócios do usuário (SPEC-004): criação com o Dono, lista, papel e dados fiscais. */
export function negocios() {
  return criarConsultasDeNegocios(prismaBase());
}

/** Equipe e convites (SPEC-005): operações do Dono restritas ao negócio e aceitação de convites. */
export function equipe() {
  return criarConsultasDeEquipe(prismaBase());
}

/** Parâmetros fiscais oficiais (SPEC-003): somente leitura, com a versão vigente na data. */
export function parametrosFiscais() {
  return criarConsultasFiscais(prismaBase());
}

/** Verificação de saúde do banco (CA-10): true se o banco responde. */
export async function bancoDisponivel(): Promise<boolean> {
  try {
    await prismaBase().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
