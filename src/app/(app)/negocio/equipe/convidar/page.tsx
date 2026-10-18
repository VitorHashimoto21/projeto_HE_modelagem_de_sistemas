import type { Metadata } from "next";
import { FormularioConvite } from "@/components/equipe/formulario-convite";
import { TEXTO_DO_CONVITE } from "@/components/equipe/em-gaveta";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirDono } from "@/lib/auth/servidor";

export const metadata: Metadata = { title: "Convidar pessoa" };

// Convidar (SPEC-005, 5.2 — UC3 e UC4): só o Dono. Pela Equipe abre na gaveta (SPEC-016, OPEN-003).
export default async function Convidar() {
  await exigirDono();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina voltar={{ href: "/negocio/equipe", rotulo: "Equipe" }} titulo="Convidar pessoa" descricao={TEXTO_DO_CONVITE} />
      <Superficie>
        <FormularioConvite />
      </Superficie>
    </div>
  );
}
