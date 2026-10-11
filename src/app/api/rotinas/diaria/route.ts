import { financeiro, negociosAtivos } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { autorizacaoConfere, executarRotinaDiaria } from "@/lib/rotinas/diaria";

// Rotina diária da Vercel Cron (SPEC-009, 5.5): contas das despesas fixas e parcelas do
// cartão vencidas, em todos os negócios. Só roda com "Authorization: Bearer <CRON_SECRET>".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const semCache = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!autorizacaoConfere(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ erro: "não autorizado" }, { status: 401, headers: semCache });
  }
  const dia = hoje();
  const resultado = await executarRotinaDiaria(await negociosAtivos(), (negocioId) => financeiro({ negocioId }).conferir(dia));
  return Response.json({ dia, ...resultado }, { headers: semCache });
}
