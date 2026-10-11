import { exigirSessao } from "@/lib/auth/servidor";
import { exportar } from "@/lib/lgpd/servicos";
import { dependenciasDaLgpd } from "@/lib/lgpd/servidor";

// Exportação dos dados do titular (SPEC-014, RNF04): só o usuário da sessão (INV-004).
export async function GET() {
  const contexto = await exigirSessao();
  const arquivo = await exportar(dependenciasDaLgpd(contexto.usuarioId));
  if (!arquivo) return new Response("Conta indisponível.", { status: 404 });
  return new Response(Buffer.from(arquivo.corpo), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${arquivo.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
