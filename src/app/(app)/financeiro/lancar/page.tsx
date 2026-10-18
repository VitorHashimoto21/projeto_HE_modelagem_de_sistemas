import type { Metadata } from "next";
import { TEXTO_DO_LANCAMENTO } from "@/components/financeiro/em-gaveta";
import { FormularioLancamento } from "@/components/financeiro/formularios";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { hoje } from "@/lib/dominio/datas";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Novo lançamento" };

// Lançamento avulso (SPEC-009, 5.2; UC12a): Financeiro — criar. Quem não tem "ver" (RF06,
// CA-13) lança a despesa operacional sem enxergar o caixa, o saldo nem as contas.
export default async function Lancar() {
  const membro = await exigirPermissao("financeiro", "criar");
  const podeVer = pode(membro.permissoes, "financeiro", "ver");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina voltar={podeVer ? { href: "/financeiro", rotulo: "Fluxo de caixa" } : undefined} titulo={podeVer ? "Novo lançamento" : "Lançar despesa"} descricao={TEXTO_DO_LANCAMENTO} />
      <Superficie>
        <FormularioLancamento hoje={hoje()} />
      </Superficie>
    </div>
  );
}
