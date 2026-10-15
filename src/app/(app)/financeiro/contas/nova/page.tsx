import type { Metadata } from "next";
import { TEXTO_DA_CONTA } from "@/components/financeiro/em-gaveta";
import { FormularioConta } from "@/components/financeiro/formularios";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Nova conta" };

// Nova conta manual (SPEC-009, 5.3): Financeiro — criar.
export default async function NovaConta({ searchParams }: PageProps<"/financeiro/contas/nova">) {
  const membro = await exigirPermissao("financeiro", "criar");
  const { tipo } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina voltar={pode(membro.permissoes, "financeiro", "ver") ? { href: "/financeiro/contas", rotulo: "Contas" } : undefined} titulo="Nova conta" descricao={TEXTO_DA_CONTA} />
      <Superficie>
        <FormularioConta hoje={hoje()} tipoPadrao={tipo === "RECEBER" ? "RECEBER" : "PAGAR"} />
      </Superficie>
    </div>
  );
}
