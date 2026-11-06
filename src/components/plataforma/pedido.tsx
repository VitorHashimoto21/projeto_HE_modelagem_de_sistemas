import Link from "next/link";
import type { Autenticador } from "@/components/segundo-fator/codigo";
import { classeDoLink } from "@/components/ui/estilos";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import type { PedidoDaPlataforma } from "@/lib/db";
import { ROTULO_MOTIVO_DA_TROCA, ROTULO_SITUACAO_DO_PEDIDO, type SituacaoDoPedido } from "@/lib/dominio/plataforma";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { dataHoraCurta } from "@/lib/dominio/suporte";
import { DecisaoDoPedido } from "./decisao-do-pedido";

const TOM: Record<SituacaoDoPedido, TomDoSelo> = { PENDENTE: "atencao", APROVADO: "ok", RECUSADO: "neutro", CANCELADO: "neutro", EXPIRADO: "neutro" };

export function SeloDoPedido({ pedido }: { pedido: Pick<PedidoDaPlataforma, "situacao" | "expiraEm"> }) {
  return (
    <Selo tom={TOM[pedido.situacao]}>
      {pedido.situacao === "PENDENTE" ? `Pendente até ${dataHoraCurta(pedido.expiraEm)}` : ROTULO_SITUACAO_DO_PEDIDO[pedido.situacao]}
    </Selo>
  );
}

/** "Troca para o plano Pago" — o título do pedido. */
export const tituloDoPedido = (p: PedidoDaPlataforma) => (p.plano ? `Troca para o plano ${ROTULO_PLANO[p.plano.para]}` : "Pedido da plataforma");

/** Quem decidiu e como terminou (o que aparece depois do pedido). */
export function desfechoDoPedido(p: PedidoDaPlataforma): string | null {
  const quando = p.decididoEm ? dataHoraCurta(p.decididoEm) : "";
  switch (p.situacao) {
    case "APROVADO":
      return `Aprovado por ${p.decididoPor ?? "outra conta"} em ${quando}.`;
    case "RECUSADO":
      return `Recusado por ${p.decididoPor ?? "outra conta"} em ${quando}: ${p.motivoDaRecusa ?? ""}`;
    case "CANCELADO":
      return `Cancelado por quem pediu em ${quando}.`;
    case "EXPIRADO":
      return `Expirou sem resposta em ${quando}.`;
    default:
      return null;
  }
}

function efeitoDaAprovacao(p: PedidoDaPlataforma): string {
  if (p.plano?.para === "PAGO") return "os recursos do pago ficam disponíveis e quem estava sem acesso pelo limite do gratuito volta";
  return "nada é apagado; com mais de um colaborador com acesso, todos ficam sem acesso até o Dono escolher quem continua, e os convites pendentes são cancelados";
}

/**
 * Um pedido da plataforma no painel (SPEC-019, 5.9, item 2): o negócio, o plano de destino, o motivo, a
 * descrição, quem pediu e o prazo; pendente, com os botões de quem pode decidir.
 */
export function CartaoDoPedido({
  pedido: p,
  administradorId,
  autenticadores,
  comNegocio = true,
}: {
  pedido: PedidoDaPlataforma;
  administradorId: string;
  autenticadores: Autenticador[];
  /** Na ficha do negócio, o nome do negócio já está no título da página. */
  comNegocio?: boolean;
}) {
  const desfecho = desfechoDoPedido(p);
  const plano = p.plano;
  return (
    <article aria-labelledby={`pedido-${p.id}`} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SeloDoPedido pedido={p} />
        <h3 id={`pedido-${p.id}`} className="text-[15px] font-bold text-foreground">
          {tituloDoPedido(p)}
          {comNegocio && (
            <>
              {" · "}
              <Link href={`/admin/negocios/${p.negocioId}`} className={classeDoLink("underline")}>
                {p.negocio}
              </Link>
            </>
          )}
        </h3>
      </div>
      {plano && (
        <p className="text-sm break-words">
          <span className="font-semibold">{ROTULO_MOTIVO_DA_TROCA[plano.motivo]}:</span> {plano.descricao}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Pedido por {p.solicitadoPor} em {dataHoraCurta(p.criadoEm)}
        {p.situacao === "PENDENTE" && ` · expira em ${dataHoraCurta(p.expiraEm)}`}
      </p>
      {desfecho && <p className="text-sm break-words text-muted-foreground">{desfecho}</p>}
      {p.situacao === "PENDENTE" && plano && (
        <DecisaoDoPedido
          pedidoId={p.id}
          proprio={p.solicitadoPorId === administradorId}
          autenticadores={autenticadores}
          confirmacao={{
            titulo: `Aprovar a troca do ${p.negocio} para o plano ${ROTULO_PLANO[plano.para]}?`,
            descricao: `O plano muda na hora, pela mesma regra da troca feita pelo Dono: ${efeitoDaAprovacao(p)}. O Dono é avisado. Pedido de ${p.solicitadoPor}: ${plano.descricao}`,
            resumo: `Pedido de ${p.solicitadoPor}: troca do ${p.negocio} para o plano ${ROTULO_PLANO[plano.para]} (${ROTULO_MOTIVO_DA_TROCA[plano.motivo].toLowerCase()}).`,
          }}
        />
      )}
    </article>
  );
}
