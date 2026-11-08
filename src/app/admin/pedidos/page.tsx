import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { NavegacaoDoPainel } from "@/components/plataforma/navegacao";
import { CartaoDoPedido } from "@/components/plataforma/pedido";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { plataforma } from "@/lib/db";
import { MENSAGENS_DA_PLATAFORMA } from "@/lib/dominio/plataforma";
import { autenticadoresDaSessao } from "@/lib/plataforma/servidor";

export const metadata: Metadata = { title: "Pedidos da plataforma" };

// Pedidos da plataforma (SPEC-019, 5.9, item 2 — INV-006): os pendentes de todas as contas de
// Administrador, com "Aprovar" e "Recusar" nos das outras contas e "Aguardando outra pessoa" e
// "Cancelar" nos próprios; e os decididos recentemente (quem pediu vê o motivo da recusa).
export default async function PedidosDaPlataforma() {
  const { usuarioId } = await exigirAdministrador();
  const agora = new Date();
  const p = plataforma();
  const [pendentes, decididos, administradores, autenticadores] = await Promise.all([p.pedidosPendentes(agora), p.pedidosDecididos(agora), p.administradores(), autenticadoresDaSessao()]);
  const aguardando = pendentes.filter((x) => x.solicitadoPorId !== usuarioId).length;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Pedidos da plataforma"
        descricao="A troca de plano pela plataforma e o acesso de emergência só valem com a aprovação de outra conta de Administrador, em até 12 horas. Ninguém aprova o próprio pedido, e o código do autenticador é pedido de novo para pedir, aprovar e recusar."
      />
      <NavegacaoDoPainel atual="pedidos" aguardando={aguardando} />

      {administradores.length < 2 && <AvisoDaPagina tom="atencao">{MENSAGENS_DA_PLATAFORMA.semOutraConta}</AvisoDaPagina>}

      <Superficie aria-labelledby="titulo-pendentes">
        <TituloDaSuperficie id="titulo-pendentes" titulo={`Pendentes (${pendentes.length})`} />
        {pendentes.length === 0 ? (
          <EstadoVazio Icone={Inbox} titulo="Nenhum pedido pendente">
            Os pedidos de troca de plano e de acesso de emergência aparecem aqui até alguém decidir, cancelar ou o prazo de 12 horas acabar.
          </EstadoVazio>
        ) : (
          <ul className="divide-y">
            {pendentes.map((pedido) => (
              <li key={pedido.id} className="py-4 first:pt-0 last:pb-0">
                <CartaoDoPedido pedido={pedido} administradorId={usuarioId} autenticadores={autenticadores} />
              </li>
            ))}
          </ul>
        )}
      </Superficie>

      {decididos.length > 0 && (
        <Superficie aria-labelledby="titulo-decididos">
          <TituloDaSuperficie id="titulo-decididos" titulo="Decididos recentemente" />
          <ul className="divide-y">
            {decididos.map((pedido) => (
              <li key={pedido.id} className="py-4 first:pt-0 last:pb-0">
                <CartaoDoPedido pedido={pedido} administradorId={usuarioId} autenticadores={autenticadores} />
              </li>
            ))}
          </ul>
        </Superficie>
      )}
    </div>
  );
}
