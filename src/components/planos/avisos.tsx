import Link from "next/link";
import { Star } from "lucide-react";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { classeDoBotao } from "@/components/ui/estilos";
import { ROTULO_FUNCIONALIDADE, type FuncionalidadeDoPago } from "@/lib/dominio/planos";

// Avisos do plano (SPEC-013). Sem "use client": usados por páginas do servidor.

/** Oferta de upgrade onde a funcionalidade do pago está bloqueada (OPEN-004). */
export function OfertaDoPlanoPago({ funcionalidade, ehDono, descricao }: { funcionalidade: FuncionalidadeDoPago; ehDono: boolean; descricao: React.ReactNode }) {
  return (
    <section aria-labelledby="titulo-oferta" className="rounded-2xl bg-card p-5 ring-1 ring-ambar/40 sm:p-6">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-ambar px-3 py-1 text-xs font-bold text-ambar-foreground">
        <Star className="size-3.5" aria-hidden="true" fill="currentColor" /> Plano pago
      </p>
      <h2 id="titulo-oferta" className="mt-3 text-xl font-extrabold text-card-foreground">
        {ROTULO_FUNCIONALIDADE[funcionalidade]}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-foreground">{descricao}</div>
      <p className="mt-4 text-sm">
        {ehDono ? (
          <Link href="/negocio/plano" className={classeDoBotao("principal")}>
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
    <AvisoDaPagina tom="atencao">
      No plano gratuito, o histórico mostra os últimos 12 meses. Os registros mais antigos continuam guardados.{" "}
      {ehDono ? (
        <Link href="/negocio/plano">
          Ver o plano pago
        </Link>
      ) : (
        "Para vê-los, o Dono precisa mudar para o plano pago."
      )}
    </AvisoDaPagina>
  );
}
