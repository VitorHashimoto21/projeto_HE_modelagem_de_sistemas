"use server";

import { revalidatePath } from "next/cache";
import { acaoCritica, acaoDoAdministrador } from "@/lib/auth/acao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { dependenciasDaPlataforma } from "./servidor";
import * as servicos from "./servicos";

// Server Actions dos pedidos da plataforma (SPEC-019, 5.8 e 5.9). Pedir, aprovar e recusar são ações
// críticas (OPEN-003): sem o código dos últimos 10 min, respondem "reconfirmar", e a tela pede o código e
// repete. Cancelar o próprio pedido só reduz o que pode acontecer: basta a conta de Administrador.

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
