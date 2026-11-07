"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoCritica, acaoDoAdministrador } from "@/lib/auth/acao";
import { ROTA_ADMIN } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { telaInicialDoSuporte } from "@/lib/suporte/servicos";
import { gravarModoSuporte } from "@/lib/suporte/servidor";
import { dependenciasDaPlataforma } from "./servidor";
import * as servicos from "./servicos";

// Server Actions dos pedidos da plataforma (SPEC-019, 5.6, 5.8 e 5.9). Pedir (plano ou emergência),
// aprovar e recusar são ações críticas (OPEN-003): sem o código dos últimos 10 min, respondem "reconfirmar",
// e a tela pede o código e repete. Cancelar o próprio pedido, entrar na emergência aprovada e registrar o
// resultado não ampliam nada: basta a conta de Administrador.

const atualizar = () => revalidatePath("/admin", "layout");

/** Administrador A: pedir a troca de plano de um negócio. */
export const acaoPedirTrocaDePlano = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDoPedido> => {
  const estado = await servicos.pedirTrocaDePlano(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  if (estado.status === "ok") atualizar();
  return estado;
});

/** Administrador B: aprovar o pedido de outra conta (INV-006). */
export const acaoAprovarPedido = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaDecisao> => {
  const estado = await servicos.aprovar(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  atualizar();
  return estado;
});

/** Administrador B: recusar o pedido de outra conta, com o motivo. */
export const acaoRecusarPedido = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaDecisao> => {
  const estado = await servicos.recusar(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  atualizar();
  return estado;
});

/** Administrador A: cancelar o próprio pedido pendente. */
export const acaoCancelarPedido = acaoDoAdministrador(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaDecisao> => {
  const estado = await servicos.cancelar(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  atualizar();
  return estado;
});

/** Administrador A: pedir acesso de emergência a um negócio sem liberação ativa (5.6). */
export const acaoPedirEmergencia = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaEmergencia> => {
  const estado = await servicos.pedirEmergencia(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  if (estado.status === "ok") atualizar();
  return estado;
});

/** Administrador A: entrar no acesso de emergência aprovado, somente leitura (5.6; INV-010). */
export const acaoEntrarEmEmergencia = acaoDoAdministrador(async (contexto, form: FormData) => {
  const negocioId = String(form.get("negocioId") ?? "");
  const r = await servicos.entrarNaEmergencia(negocioId, await dependenciasDaPlataforma(contexto.usuarioId));
  if (!r.ok) redirect(`${ROTA_ADMIN}/negocios/${encodeURIComponent(negocioId)}?erro=${encodeURIComponent(r.mensagem)}`);
  await gravarModoSuporte(r.acessoId, r.expiraEm);
  redirect(telaInicialDoSuporte(r.modulos));
});

/** Administrador A: registrar o resultado do acesso de emergência, depois do fim (5.6). */
export const acaoRegistrarResultado = acaoDoAdministrador(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaDecisao> => {
  const estado = await servicos.registrarResultado(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  atualizar();
  return estado;
});

/**
 * SPEC-019 (5.7, OPEN-012): suspender o negócio — um Administrador, com o código reconfirmado, o motivo e a
 * descrição. O negócio fica somente leitura até a reativação.
 */
export const acaoSuspenderNegocio = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaSuspensao> => {
  const estado = await servicos.suspender(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  if (estado.status === "ok") atualizar();
  return estado;
});

/** SPEC-019 (5.7): reativar o negócio suspenso — um Administrador, com o código reconfirmado e a descrição. */
export const acaoReativarNegocio = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<servicos.EstadoDaSuspensao> => {
  const estado = await servicos.reativar(camposDoFormulario(form), await dependenciasDaPlataforma(contexto.usuarioId));
  if (estado.status === "ok") atualizar();
  return estado;
});
