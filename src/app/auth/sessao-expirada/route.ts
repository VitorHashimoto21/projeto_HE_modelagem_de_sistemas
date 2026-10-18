import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SUPORTE } from "@/lib/auth/contexto";
import { ROTA_ENTRAR } from "@/lib/auth/rotas";
import { adaptadorDoServidor } from "@/lib/auth/servidor";

// Sessão do Administrador vencida (SPEC-018, RNF12 — 8 h desde a entrada): encerra a sessão,
// apaga o cookie do modo suporte e volta ao login com o aviso. Para outras contas, só sai.
export async function GET(request: NextRequest) {
  await (await adaptadorDoServidor()).sair("local");
  const resposta = NextResponse.redirect(new URL(`${ROTA_ENTRAR}?sessao=expirada`, request.url));
  resposta.cookies.delete(COOKIE_SUPORTE);
  return resposta;
}
