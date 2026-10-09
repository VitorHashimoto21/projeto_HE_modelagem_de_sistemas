import Link from "next/link";
import type { CategoriaLancamento, OrigemLancamento, StatusConta, TipoConta, TipoLancamento } from "@/generated/prisma/enums";
import { CATEGORIAS } from "@/lib/dominio/financeiro";
import { reaisDeCentavos } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// Exibição do Financeiro (SPEC-009). Sem "use client": usado por páginas do servidor.

export const ROTULO_CATEGORIA: Record<CategoriaLancamento, string> = CATEGORIAS;

export const ROTULO_ORIGEM: Record<OrigemLancamento, string> = {
  VENDA: "Venda",
  CONTA: "Conta",
  AVULSO: "Avulso",
  SALDO_INICIAL: "Saldo inicial",
  ESTORNO: "Estorno",
};

export const ROTULO_STATUS: Record<TipoConta, Record<StatusConta, string>> = {
  PAGAR: { ABERTA: "A pagar", PARCIAL: "Paga em parte", QUITADA: "Paga", CANCELADA: "Cancelada" },
  RECEBER: { ABERTA: "A receber", PARCIAL: "Recebida em parte", QUITADA: "Recebida", CANCELADA: "Cancelada" },
};

export const reais = reaisDeCentavos;

/** Valor com sinal e texto, nunca só cor (RNF01): "+ R$ 50,00" em verde, "− R$ 80,00" em vermelho. */
export function ValorComSinal({ tipo, centavos, className }: { tipo: TipoLancamento; centavos: number; className?: string }) {
  const entrada = tipo === "ENTRADA";
  return (
    <span className={cn("font-semibold whitespace-nowrap tabular-nums", entrada ? "text-status-ok" : "text-status-danger", className)}>
      <span className="sr-only">{entrada ? "Entrada de " : "Saída de "}</span>
      <span aria-hidden="true">{entrada ? "+ " : "− "}</span>
      {reais(centavos)}
    </span>
  );
}

/** Saldo: negativo em vermelho com o sinal de menos; positivo ou zero na cor do texto. */
export function Saldo({ centavos, className }: { centavos: number; className?: string }) {
  return <span className={cn("tabular-nums", centavos < 0 ? "text-status-danger" : "text-foreground", className)}>{reais(centavos)}</span>;
}

const SITUACOES: Record<StatusConta, { icone: string; classes: string }> = {
  ABERTA: { icone: "○", classes: "bg-muted text-muted-foreground" },
  PARCIAL: { icone: "◐", classes: "bg-status-warn-bg text-status-warn" },
  QUITADA: { icone: "●", classes: "bg-status-ok-bg text-status-ok" },
  CANCELADA: { icone: "✕", classes: "bg-muted text-muted-foreground line-through" },
};

/** Situação da conta com ícone e texto; "Atrasada" em destaque (5.3). */
export function SeloDaConta({ tipo, status, atrasada }: { tipo: TipoConta; status: StatusConta; atrasada: boolean }) {
  const s = SITUACOES[status];
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", s.classes)}>
        <span aria-hidden="true">{s.icone}</span>
        {ROTULO_STATUS[tipo][status]}
      </span>
      {atrasada && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger-bg px-2.5 py-1 text-xs font-medium whitespace-nowrap text-status-danger">
          <span aria-hidden="true">▲</span>
          Atrasada
        </span>
      )}
    </span>
  );
}

const ABAS = [
  { chave: "caixa", rotulo: "Caixa", href: "/financeiro" },
  { chave: "contas", rotulo: "Contas", href: "/financeiro/contas" },
  { chave: "despesas", rotulo: "Despesas fixas", href: "/financeiro/despesas-fixas" },
] as const;

/** Cabeçalho comum das telas do Financeiro, com as abas (só para quem tem Financeiro — ver). */
export function CabecalhoDoFinanceiro({ atual, titulo, acoes }: { atual: (typeof ABAS)[number]["chave"]; titulo: string; acoes?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Financeiro</p>
          <h1 className="font-display text-3xl font-semibold break-words text-foreground">{titulo}</h1>
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
      <nav aria-label="Seções do Financeiro" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1">
        {ABAS.map((a) => (
          <Link
            key={a.chave}
            href={a.href}
            aria-current={a.chave === atual ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              a.chave === atual ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export const botaoPrimario =
  "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70";
export const botaoSecundario =
  "inline-flex items-center justify-center rounded-xl border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70";
