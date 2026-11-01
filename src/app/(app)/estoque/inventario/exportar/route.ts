import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { exigirMembroForaDoSuporte } from "@/lib/auth/servidor";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { consultasDeAcesso, estoque, negocios } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { arquivoDoInventario, podeVerInventario } from "@/lib/estoque/inventario";

// Arquivos do inventário (SPEC-025, 5.5): Estoque e Catálogo — ver, nos dois planos (OPEN-004), e
// nunca no modo suporte (5.6). A recusa da data volta para a tela com a mensagem.
export async function GET(req: NextRequest) {
  const membro = await exigirMembroForaDoSuporte();
  if (!podeVerInventario(membro.permissoes)) redirect(ROTA_SEM_ACESSO);
  const busca = Object.fromEntries(req.nextUrl.searchParams);
  const [negocio, perfil] = await Promise.all([negocios().dadosFiscais(membro.negocioId), consultasDeAcesso().perfil(membro.usuarioId)]);
  const r = await arquivoDoInventario(busca, {
    estoque: estoque(membro),
    hoje: hoje(),
    negocio: negocio?.nome ?? "Negócio",
    cnpj: negocio?.cnpj ?? null,
    autor: perfil?.nome ?? "—",
    agora: new Date(),
  });
  if (!r.ok) redirect(`/estoque/inventario?${new URLSearchParams({ ...(busca.data ? { data: busca.data } : {}), erro: r.erro })}`);
  const corpo = typeof r.arquivo.corpo === "string" ? r.arquivo.corpo : Buffer.from(r.arquivo.corpo);
  return new Response(corpo, {
    headers: {
      "Content-Type": r.arquivo.tipo,
      "Content-Disposition": `attachment; filename="${r.arquivo.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
