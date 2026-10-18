import { removerCredencial } from "@/lib/auth/credencial";
import { financeiro, lgpd, negociosAtivos } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { removerCredenciaisPendentes } from "@/lib/lgpd/servicos";
import { autorizacaoConfere, executarRotinaDiaria } from "@/lib/rotinas/diaria";

// Rotina diária da Vercel Cron (SPEC-009, 5.5): contas das despesas fixas e parcelas do
// cartão vencidas, em todos os negócios; e a LGPD (SPEC-014): e-mail dos convites antigos
// anonimizado e credenciais pendentes removidas. Só roda com "Authorization: Bearer <CRON_SECRET>".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const semCache = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!autorizacaoConfere(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ erro: "não autorizado" }, { status: 401, headers: semCache });
  }
  const dia = hoje();
  const resultado = await executarRotinaDiaria(await negociosAtivos(), (negocioId) => financeiro({ negocioId }).conferir(dia));
  const agora = new Date();
  const consultas = lgpd();
  const convitesAnonimizados = await consultas.anonimizarConvitesAntigos(agora).catch(() => -1);
  const credenciais = await removerCredenciaisPendentes({ lgpd: consultas, agora, removerCredencial }).catch(() => ({ removidas: 0, pendentes: -1 }));
  return Response.json({ dia, ...resultado, convitesAnonimizados, credenciais }, { headers: semCache });
}
