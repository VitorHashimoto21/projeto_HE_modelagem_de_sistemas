"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { suporte } from "@/lib/db";
import { emissorDoAmbiente } from "@/lib/dominio/segundo-fator";
import { ambiente } from "@/lib/env";
import type { ContextoComPapel } from "./contexto";
import { acaoCritica, acaoDoSegundoFator } from "./acao";
import { ROTA_ADMIN, ROTA_SEGUNDO_FATOR } from "./rotas";
import * as fluxos from "./segundo-fator";
import type { DependenciasDoSegundoFator, EstadoDaRemocao, EstadoDoCadastroDoFator, EstadoDoCodigo } from "./segundo-fator";
import { adaptadorDoServidor } from "./servidor";
import { camposDoFormulario } from "./validacao";

// Server Actions do 2º fator do Administrador (SPEC-019, 5.1). As telas do 2º fator usam a fábrica
// própria (a conta de Administrador, com ou sem o código); remover um autenticador é ação crítica.

async function dependencias(contexto: ContextoComPapel): Promise<DependenciasDoSegundoFator> {
  return {
    auth: await adaptadorDoServidor(),
    registrar: (evento, descricao) => suporte().registrarSegundoFator(contexto.usuarioId, evento, descricao, new Date()),
    emissor: emissorDoAmbiente(ambiente().EMISSOR_DO_AUTENTICADOR),
  };
}

/** Cadastro de um autenticador: o nome gera o QR code; o código o ativa (CA-01). */
export const acaoCadastrarAutenticador = acaoDoSegundoFator(async (contexto, estado: EstadoDoCadastroDoFator, form: FormData) => {
  const campos = camposDoFormulario(form);
  const deps = await dependencias(contexto);
  if (estado.status !== "qr" || !campos.fator) return fluxos.iniciarCadastro(campos, deps);
  const r = await fluxos.concluirCadastro(campos, { qrCode: estado.qrCode, segredo: estado.segredo, nome: estado.nome }, deps);
  if (r.status !== "concluido") return r;
  revalidatePath("/conta");
  // O primeiro autenticador leva à sugestão do segundo; os seguintes voltam a Minha conta.
  redirect(r.primeiro ? `${ROTA_SEGUNDO_FATOR}?outro=1` : "/conta?autenticador=cadastrado");
});

/** "Digite o código do autenticador" no login (5.1): com o código, a sessão sobe para aal2. */
export const acaoEntrarComCodigo = acaoDoSegundoFator(async (contexto, _: EstadoDoCodigo, form: FormData) => {
  const r = await fluxos.verificarCodigo(camposDoFormulario(form), await dependencias(contexto));
  if (r.status !== "verificado") return r;
  redirect(ROTA_ADMIN);
});

/** Reconfirmação das ações críticas (OPEN-003): o código renova os 10 min, e a tela repete a ação. */
export const acaoReconfirmarCodigo = acaoDoSegundoFator(async (contexto, _: EstadoDoCodigo, form: FormData) =>
  fluxos.verificarCodigo(camposDoFormulario(form), await dependencias(contexto)),
);

/** Remover um autenticador em Minha conta (5.1): crítica, e nunca o último. */
export const acaoRemoverAutenticador = acaoCritica(async (contexto, _: unknown, form: FormData): Promise<EstadoDaRemocao> => {
  const r = await fluxos.removerAutenticador(String(form.get("fator") ?? ""), await dependencias(contexto));
  if (r.status === "removido") revalidatePath("/conta");
  return r;
});
