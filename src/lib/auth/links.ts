import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { TipoDeLink } from "./adaptador";
import { ROTA_INICIAL, ROTA_LINK_INVALIDO, ROTA_NOVA_SENHA } from "./rotas";
import { adaptadorDoServidor } from "./servidor";

/**
 * Links recebidos por e-mail (SPEC-002, 5.1 e 5.4). Aceita o modelo recomendado
 * (`token_hash`, funciona em qualquer aparelho) e o padrão do Supabase (`code`, PKCE).
 * Sucesso: a sessão é aberta e a pessoa segue; falha: tela de link expirado.
 */
export async function tratarLinkDeEmail(request: NextRequest, tipo: TipoDeLink): Promise<NextResponse> {
  const busca = request.nextUrl.searchParams;
  const auth = await adaptadorDoServidor();
  const { ok } = await auth.confirmarLink({
    tokenHash: busca.get("token_hash") ?? undefined,
    codigo: busca.get("code") ?? undefined,
    tipo,
  });

  const destino = ok
    ? tipo === "recovery"
      ? ROTA_NOVA_SENHA
      : ROTA_INICIAL
    : `${ROTA_LINK_INVALIDO}?tipo=${tipo === "recovery" ? "recuperacao" : "confirmacao"}`;
  return NextResponse.redirect(new URL(destino, request.url));
}
