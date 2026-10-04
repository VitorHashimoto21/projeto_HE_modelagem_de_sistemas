import { bancoDisponivel } from "@/lib/db";

// Verificação de saúde (SPEC-001, CA-10): diz se a aplicação e o banco respondem, sem detalhes internos.
export const dynamic = "force-dynamic";

export async function GET() {
  const banco = (await bancoDisponivel()) ? "ok" : "indisponivel";
  return Response.json(
    { aplicacao: "ok", banco },
    { status: banco === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
