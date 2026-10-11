import Link from "next/link";
import { ROTULO_FUNCIONALIDADE, type FuncionalidadeDoPago } from "@/lib/dominio/planos";

// Avisos do plano (SPEC-013). Sem "use client": usados por páginas do servidor.

/** Oferta de upgrade onde a funcionalidade do pago está bloqueada (OPEN-004). */
export function OfertaDoPlanoPago({ funcionalidade, ehDono, descricao }: { funcionalidade: FuncionalidadeDoPago; ehDono: boolean; descricao: React.ReactNode }) {
  return (
    <section aria-labelledby="titulo-oferta" className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm ring-1 ring-primary/15">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-amber/15 px-3 py-1 text-xs font-semibold text-foreground">
        <span aria-hidden="true">★</span> Plano pago
      </p>
      <h2 id="titulo-oferta" className="mt-3 font-display text-2xl font-semibold text-card-foreground">
        {ROTULO_FUNCIONALIDADE[funcionalidade]}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-foreground">{descricao}</div>
      <p className="mt-4 text-sm">
        {ehDono ? (
          <Link
            href="/negocio/plano"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Conhecer o plano pago
          </Link>
        ) : (
          <span className="text-muted-foreground">Peça ao Dono do negócio para mudar para o plano pago.</span>
        )}
      </p>
    </section>
  );
}

/** Aviso do limite de 12 meses do gratuito nas listas (RN18, OPEN-005). */
export function AvisoDoHistorico({ ehDono }: { ehDono: boolean }) {
  return (
    <p role="note" className="rounded-xl border border-status-warn/40 bg-status-warn-bg px-4 py-2 text-sm text-status-warn">
      <span aria-hidden="true">▲ </span>
      No plano gratuito, o histórico mostra os últimos 12 meses. Os registros mais antigos continuam guardados.{" "}
      {ehDono ? (
        <Link href="/negocio/plano" className="font-semibold underline underline-offset-2">
          Ver o plano pago
        </Link>
      ) : (
        "Para vê-los, o Dono precisa mudar para o plano pago."
      )}
    </p>
  );
}
