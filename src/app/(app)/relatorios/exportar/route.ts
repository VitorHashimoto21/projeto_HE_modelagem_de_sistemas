import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { exigirMembro } from "@/lib/auth/servidor";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { planoDoMembro } from "@/lib/planos/servidor";
import { exportar } from "@/lib/relatorios/servicos";
import { dependenciasDosRelatorios } from "@/lib/relatorios/servidor";

// Exportação dos relatórios (SPEC-013, RF71): plano pago + permissão do relatório, sempre
// conferidos aqui (INV-002); a recusa leva à página dos relatórios (oferta de upgrade) ou ao
// "sem acesso".
export async function GET(req: NextRequest) {
  const membro = await exigirMembro();
  // SPEC-018 (5.5): no modo suporte, nenhum arquivo é baixado.
  if (membro.modoSuporte) redirect(ROTA_SEM_ACESSO);
  const busca = Object.fromEntries(req.nextUrl.searchParams);
  const r = await exportar(busca, { plano: await planoDoMembro(membro), permissoes: membro.permissoes }, await dependenciasDosRelatorios(membro));
  if (!r.ok) {
    if (r.recusa.motivo === "permissao") redirect(ROTA_SEM_ACESSO);
    redirect(`/relatorios?${new URLSearchParams({ erro: r.recusa.mensagem })}`);
  }
  const corpo = typeof r.arquivo.corpo === "string" ? r.arquivo.corpo : Buffer.from(r.arquivo.corpo);
  return new Response(corpo, {
    headers: {
      "Content-Type": r.arquivo.tipo,
      "Content-Disposition": `attachment; filename="${r.arquivo.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
