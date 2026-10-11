import type { Metadata } from "next";
import Link from "next/link";
import { FormularioConta } from "@/components/financeiro/formularios";
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
      <div className="space-y-2">
        {pode(membro.permissoes, "financeiro", "ver") && (
          <p className="text-sm">
            <Link href="/financeiro/contas" className="font-medium text-primary underline-offset-2 hover:underline">
              ← Contas
            </Link>
          </p>
        )}
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Financeiro</p>
        <h1 className="font-display text-3xl font-semibold text-foreground">Nova conta</h1>
        <p className="text-sm text-muted-foreground">
          Um compromisso com vencimento, como um boleto de fornecedor. As parcelas do cartão e as despesas fixas geram as próprias contas.
        </p>
      </div>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <FormularioConta hoje={hoje()} tipoPadrao={tipo === "RECEBER" ? "RECEBER" : "PAGAR"} />
      </section>
    </div>
  );
}
