import { strToU8, zipSync } from "fflate";
import type { ResultadoDaRemocao } from "@/lib/auth/credencial";
import type { ConsultasDaLgpd } from "@/lib/db/lgpd";
import { arquivosDaExportacao, conferirConfirmacao, MENSAGENS_LGPD, nomeDoZip } from "@/lib/dominio/lgpd";

/**
 * Fluxos da LGPD (SPEC-014, 5.2 e 5.3). O usuário vem sempre da sessão (INV-004); a remoção
 * da credencial e o "sair" são injetados para os testes.
 */

export type DependenciasDaLgpd = {
  lgpd: ConsultasDaLgpd;
  usuarioId: string;
  agora: Date;
  hoje: string;
  removerCredencial: (usuarioId: string) => Promise<ResultadoDaRemocao>;
  sair: () => Promise<void>;
};

export type EstadoDaExclusao =
  | { status: "ocioso" }
  | { status: "erro"; erros?: Partial<Record<"email" | "ciencia", string>>; mensagem?: string }
  | { status: "excluida"; credencial: ResultadoDaRemocao };

export const EXCLUSAO_INICIAL: EstadoDaExclusao = { status: "ocioso" };

/** Exportação (RNF04): .zip com dados.json, LEIA-ME.txt e um CSV por tabela. */
export async function exportar(deps: Pick<DependenciasDaLgpd, "lgpd" | "usuarioId" | "agora" | "hoje">): Promise<{ nome: string; corpo: Uint8Array } | null> {
  const dados = await deps.lgpd.dadosDoTitular(deps.usuarioId, deps.agora);
  if (!dados) return null;
  const arquivos = arquivosDaExportacao(dados);
  const corpo = zipSync(Object.fromEntries(Object.entries(arquivos).map(([nome, texto]) => [nome, strToU8(texto)])), { level: 6 });
  return { nome: nomeDoZip(deps.hoje), corpo };
}

/** Exclusão (RN27): confirmação (OPEN-002), transação, credencial (OPEN-001) e sessão. */
export async function excluirConta(campos: Record<string, string>, deps: DependenciasDaLgpd): Promise<EstadoDaExclusao> {
  const resumo = await deps.lgpd.resumoDaExclusao(deps.usuarioId);
  if (!resumo) return { status: "erro", mensagem: MENSAGENS_LGPD.jaExcluida };
  const c = conferirConfirmacao(campos, resumo.email);
  if (!c.ok) return { status: "erro", erros: c.erros };
  try {
    const r = await deps.lgpd.excluirConta(deps.usuarioId, deps.agora);
    if (!r.ok) return { status: "erro", mensagem: MENSAGENS_LGPD.jaExcluida };
  } catch (e) {
    console.error("[lgpd] falha na exclusão:", e instanceof Error ? e.name : "erro");
    return { status: "erro", mensagem: MENSAGENS_LGPD.falhaInterna };
  }
  // A conta já está bloqueada e anonimizada; a credencial e a sessão vêm depois (5.3).
  const credencial = await deps.removerCredencial(deps.usuarioId);
  if (credencial === "removida") await deps.lgpd.marcarCredencialRemovida(deps.usuarioId, deps.agora);
  await deps.sair().catch(() => undefined);
  return { status: "excluida", credencial };
}

/** Rotina diária (OPEN-001): tenta de novo remover as credenciais pendentes. */
export async function removerCredenciaisPendentes(
  deps: Pick<DependenciasDaLgpd, "lgpd" | "agora" | "removerCredencial">,
): Promise<{ removidas: number; pendentes: number }> {
  const ids = await deps.lgpd.credenciaisPendentes();
  let removidas = 0;
  for (const id of ids) {
    if ((await deps.removerCredencial(id)) === "removida") {
      await deps.lgpd.marcarCredencialRemovida(id, deps.agora);
      removidas++;
    }
  }
  return { removidas, pendentes: ids.length - removidas };
}
