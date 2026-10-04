import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decidirRota } from "@/lib/auth/rotas";

/**
 * Proxy do Next.js 16 (antigo middleware — SPEC-002, 5.5): renova os cookies de sessão
 * do Supabase e protege as páginas autenticadas (INV-005, CA-08). É a primeira
 * barreira; páginas e Server Actions validam a sessão de novo no servidor.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  // Link de e-mail que caiu na URL do site (fallback do Supabase): encaminha para a confirmação.
  if (pathname === "/" && searchParams.has("token_hash")) {
    const destino = searchParams.get("type") === "recovery" ? "/auth/recuperar" : "/auth/confirmar";
    return NextResponse.redirect(new URL(`${destino}${search}`, request.url));
  }

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista, cabecalhos) => {
          for (const { name, value } of lista) request.cookies.set(name, value);
          resposta = NextResponse.next({ request });
          for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
          for (const [nome, valor] of Object.entries(cabecalhos ?? {})) resposta.headers.set(nome, valor);
        },
      },
    },
  );

  // Valida o JWT e, se preciso, renova a sessão (grava os novos cookies na resposta).
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims?.sub);

  const decisao = decidirRota(pathname, search, autenticado);
  if (decisao.tipo === "redirecionar") {
    const redirecionamento = NextResponse.redirect(new URL(decisao.para, request.url));
    // Mantém os cookies renovados no redirecionamento.
    for (const cookie of resposta.cookies.getAll()) redirecionamento.cookies.set(cookie);
    return redirecionamento;
  }

  return resposta;
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos, imagens e ícones.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|site.webmanifest|marca/|icon-|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
