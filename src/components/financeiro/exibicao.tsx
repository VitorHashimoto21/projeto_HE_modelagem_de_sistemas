import type { CategoriaLancamento, OrigemLancamento, StatusConta, TipoConta, TipoLancamento } from "@/generated/prisma/enums";
import { CATEGORIAS } from "@/lib/dominio/financeiro";
import { reaisDeCentavos } from "@/lib/dominio/venda";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
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
    <span className={cn("font-bold whitespace-nowrap tabular-nums", entrada ? "text-status-ok" : "text-status-danger", className)}>
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

const SITUACOES: Record<StatusConta, TomDoSelo> = { ABERTA: "neutro", PARCIAL: "atencao", QUITADA: "ok", CANCELADA: "neutro" };

/** Situação da conta com ícone e texto; "Atrasada" em destaque (5.3). */
export function SeloDaConta({ tipo, status, atrasada }: { tipo: TipoConta; status: StatusConta; atrasada: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Selo tom={SITUACOES[status]} className={status === "CANCELADA" ? "line-through" : undefined}>
        {ROTULO_STATUS[tipo][status]}
      </Selo>
      {atrasada && <Selo tom="perigo">Atrasada</Selo>}
    </span>
  );
}

const ABAS = [
  { chave: "caixa", rotulo: "Caixa", href: "/financeiro" },
  { chave: "contas", rotulo: "Contas", href: "/financeiro/contas" },
  { chave: "despesas", rotulo: "Despesas fixas", href: "/financeiro/despesas-fixas" },
] as const;

/** Cabeçalho comum das telas do Financeiro, com as seções em segmentos (só para quem tem Financeiro — ver). */
export function CabecalhoDoFinanceiro({ atual, titulo, descricao, acoes }: { atual: (typeof ABAS)[number]["chave"]; titulo: string; descricao?: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <CabecalhoDePagina titulo={titulo} descricao={descricao} acoes={acoes} />
      <Segmentos rotulo="Seções do Financeiro" itens={ABAS.map((a) => ({ href: a.href, rotulo: a.rotulo, ativo: a.chave === atual }))} />
    </div>
  );
}

export const botaoPrimario = classeDoBotao("principal");
export const botaoSecundario = classeDoBotao("secundario");
