import "server-only";
import { adaptadorDoServidor } from "@/lib/auth/servidor";
import { removerCredencial } from "@/lib/auth/credencial";
import { lgpd } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import type { DependenciasDaLgpd } from "./servicos";

/** Dependências reais da LGPD para o usuário da sessão (SPEC-014). */
export function dependenciasDaLgpd(usuarioId: string): DependenciasDaLgpd {
  return {
    lgpd: lgpd(),
    usuarioId,
    agora: new Date(),
    hoje: hoje(),
    removerCredencial,
    sair: async () => (await adaptadorDoServidor()).sair("local"),
  };
}
