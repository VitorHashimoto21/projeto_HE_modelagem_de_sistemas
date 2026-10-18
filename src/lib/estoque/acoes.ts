"use server";

import { revalidatePath } from "next/cache";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { estoque } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import * as servicos from "./servicos";
import type { EstadoDoEstoque } from "./servicos";

// Server Actions do estoque (SPEC-007). A fábrica exige a permissão do módulo Estoque
// (SPEC-005, OPEN-001): criar → entrada e saída; editar → mínimo manual. O negócio vem do
// contexto validado e "hoje" do relógio do servidor, nunca do formulário.

const deps = (m: ContextoDoMembro): servicos.DependenciasDoEstoque => {
  const agora = new Date();
  return {
    estoque: estoque({ negocioId: m.negocioId, usuarioId: m.usuarioId }),
    usuarioId: m.usuarioId,
    hoje: hoje(agora),
    agora,
  };
};

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

async function atualizar<T>(fluxo: Promise<T>): Promise<T> {
  const r = await fluxo;
  revalidatePath("/estoque", "layout");
  revalidatePath("/painel");
  return r;
}

export const acaoRegistrarEntrada = acaoComPermissao("estoque", "criar", async (membro, _: EstadoDoEstoque, form: FormData) =>
  atualizar(servicos.registrarMovimentacao(texto(form, "itemId"), "entrada", camposDoFormulario(form), deps(membro))),
);

export const acaoRegistrarSaida = acaoComPermissao("estoque", "criar", async (membro, _: EstadoDoEstoque, form: FormData) =>
  atualizar(servicos.registrarMovimentacao(texto(form, "itemId"), "saida", camposDoFormulario(form), deps(membro))),
);

export const acaoDefinirMinimo = acaoComPermissao("estoque", "editar", async (membro, _: EstadoDoEstoque, form: FormData) =>
  atualizar(servicos.definirMinimo(texto(form, "itemId"), camposDoFormulario(form), deps(membro))),
);
