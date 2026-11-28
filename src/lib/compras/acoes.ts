"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acaoComPermissao } from "@/lib/auth/acao";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { camposDoFormulario } from "@/lib/auth/validacao";
import { catalogo, compras } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";
import * as servicos from "./servicos";
import type { EstadoDoItem } from "@/lib/catalogo/servicos";
import type { EstadoDaCompra, EstadoDaCorrecao } from "./servicos";

// Server Actions da compra (SPEC-027, OPEN-007): registrar exige Estoque — criar e Financeiro — criar.
// A fábrica confere o Estoque (e recusa o suporte e o negócio suspenso, SPEC-019); o Financeiro é
// conferido aqui. O negócio vem do contexto validado e "hoje" do relógio do servidor.

const deps = (m: ContextoDoMembro): servicos.DependenciasDaCompra => {
  const agora = new Date();
  return { compras: compras({ negocioId: m.negocioId, usuarioId: m.usuarioId }), usuarioId: m.usuarioId, hoje: hoje(agora), agora };
};

const comFinanceiro = (m: ContextoDoMembro) => {
  if (!pode(m.permissoes, "financeiro", "criar")) redirect(ROTA_SEM_ACESSO);
};

export const acaoRevisarCompra = acaoComPermissao("estoque", "criar", async (membro, _: EstadoDaCompra, form: FormData) => {
  comFinanceiro(membro);
  return servicos.revisarCompra(camposDoFormulario(form), deps(membro));
});

export const acaoRegistrarCompra = acaoComPermissao("estoque", "criar", async (membro, _: EstadoDaCompra, form: FormData) => {
  comFinanceiro(membro);
  const estado = await servicos.registrarCompra(camposDoFormulario(form), deps(membro));
  if (estado.status === "registrada") {
    revalidatePath("/compras", "layout");
    revalidatePath("/estoque", "layout");
    revalidatePath("/catalogo", "layout");
    revalidatePath("/financeiro", "layout");
    revalidatePath("/painel");
  }
  return estado;
});

// OPEN-003: "Novo produto" sem sair da compra, para quem tem Catálogo — criar. Não sai da tela: o produto
// criado volta para a compra, que o adiciona com o custo informado.
export const acaoNovoProdutoDaCompra = acaoComPermissao("catalogo", "criar", async (membro, _: EstadoDoItem, form: FormData) => {
  const estado = await servicos.criarProdutoDaCompra(camposDoFormulario(form), { catalogo: catalogo({ negocioId: membro.negocioId, usuarioId: membro.usuarioId }), usuarioId: membro.usuarioId });
  if (estado.status === "salvo") revalidatePath("/catalogo", "layout");
  return estado;
});

// 5.7 (OPEN-007): corrigir o fornecedor e o nº do documento exige Financeiro — editar. A compra fica fora
// da lista fechada de correções (RN37): no modo suporte, a fábrica recusa, mesmo com "ver e corrigir".
export const acaoCorrigirCompra = acaoComPermissao("financeiro", "editar", async (membro, _: EstadoDaCorrecao, form: FormData) => {
  const campos = camposDoFormulario(form);
  const estado = await servicos.corrigirCompra(campos.compraId ?? "", campos, { compras: compras({ negocioId: membro.negocioId, usuarioId: membro.usuarioId }) });
  if (estado.status === "salvo") {
    revalidatePath("/compras", "layout");
    revalidatePath("/financeiro", "layout");
  }
  return estado;
});
