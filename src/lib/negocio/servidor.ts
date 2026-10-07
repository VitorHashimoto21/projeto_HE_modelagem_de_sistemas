import "server-only";
import { cookies } from "next/headers";
import { COOKIE_NEGOCIO_ATIVO } from "@/lib/auth/contexto";
import { obterContexto } from "@/lib/auth/servidor";
import { negocios, parametrosFiscais } from "@/lib/db";
import { criarConsultaBrasilApi } from "@/lib/integracoes/consulta-cnpj";
import type { DependenciasDoNegocio } from "./servicos";

/** Cookie do negócio ativo (5.4): httpOnly, SameSite=Lax, 1 ano. O valor só vale com filiação (INV-006). */
export async function gravarNegocioAtivo(negocioId: string) {
  (await cookies()).set(COOKIE_NEGOCIO_ATIVO, negocioId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Limpa o negócio ativo (ao sair dele — SPEC-005, OPEN-007). */
export async function limparNegocioAtivo() {
  (await cookies()).delete(COOKIE_NEGOCIO_ATIVO);
}

export async function dependenciasDoNegocio(): Promise<DependenciasDoNegocio> {
  const contexto = await obterContexto();
  const fiscais = parametrosFiscais();
  return {
    usuarioId: contexto?.usuarioId ?? null,
    consulta: criarConsultaBrasilApi(),
    anexoDoCnae: async (cnae) => {
      const r = await fiscais.anexoDoCnae(cnae);
      return r ? { anexo: r.anexo, sujeitoFatorR: r.sujeitoFatorR } : null;
    },
    negocios: negocios(),
    definirNegocioAtivo: gravarNegocioAtivo,
  };
}
