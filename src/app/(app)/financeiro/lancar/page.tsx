import type { Metadata } from "next";
import Link from "next/link";
import { FormularioLancamento } from "@/components/financeiro/formularios";
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
      <div className="space-y-2">
        {podeVer && (
          <p className="text-sm">
            <Link href="/financeiro" className="font-medium text-primary underline-offset-2 hover:underline">
              ← Fluxo de caixa
            </Link>
          </p>
        )}
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Financeiro</p>
        <h1 className="font-display text-3xl font-semibold text-foreground">{podeVer ? "Novo lançamento" : "Lançar despesa"}</h1>
        <p className="text-sm text-muted-foreground">
          Para despesas e receitas fora das vendas e das contas, como uma compra de material. Vendas e pagamentos de contas entram no caixa sozinhos.
        </p>
      </div>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <FormularioLancamento hoje={hoje()} />
      </section>
    </div>
  );
}
