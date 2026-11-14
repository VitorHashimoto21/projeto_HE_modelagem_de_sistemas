import type { Metadata } from "next";
import Link from "next/link";
import { Siren } from "lucide-react";
import { NavegacaoDoPainel } from "@/components/plataforma/navegacao";
import { RegistrarResultado } from "@/components/plataforma/registrar-resultado";
import { SeloDaEmergencia } from "@/components/suporte/selo-da-emergencia";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDaSuperficie, classeDoLink } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { plataforma, suporte, type EmergenciaNoPainel } from "@/lib/db";
import { ROTULO_MOTIVO_DA_EMERGENCIA } from "@/lib/dominio/emergencia";
import { dataHoraCurta, listaDeModulos } from "@/lib/dominio/suporte";

export const metadata: Metadata = { title: "Emergências" };

function Situacao({ e, agora }: { e: EmergenciaNoPainel; agora: Date }) {
  if (e.encerradoEm) return <Selo tom="neutro">Encerrada em {dataHoraCurta(e.encerradoEm)}</Selo>;
  if (e.expiraEm.getTime() <= agora.getTime()) return <Selo tom="neutro">Expirou em {dataHoraCurta(e.expiraEm)}</Selo>;
  return <SeloDaEmergencia>Em andamento até {dataHoraCurta(e.expiraEm)}</SeloDaEmergencia>;
}

// Emergências (SPEC-019, 5.9, item 3): o histórico de todas as contas de Administrador, com o motivo, a
// referência, quem pediu, quem aprovou, os horários e o resultado. Quem pediu registra o resultado aqui,
// depois do fim; sem ele, não faz um novo pedido.
export default async function Emergencias() {
  const { usuarioId } = await exigirAdministrador();
  const agora = new Date();
  const [lista, pendentes] = await Promise.all([suporte().emergencias(), plataforma().pedidosPendentes(agora)]);
  const aguardando = pendentes.filter((x) => x.solicitadoPorId !== usuarioId).length;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Emergências"
        descricao="Os acessos de emergência de todas as contas, do mais novo ao mais antigo. Os pedidos ainda sem decisão ficam em Pedidos."
      />
      <NavegacaoDoPainel atual="emergencias" aguardando={aguardando} />

      {lista.length === 0 ? (
        <Superficie>
          <EstadoVazio Icone={Siren} titulo="Nenhum acesso de emergência">
            Um acesso de emergência só existe sem a liberação do Dono e com a aprovação de outra conta de Administrador.
          </EstadoVazio>
        </Superficie>
      ) : (
        <ul className="space-y-4" aria-label="Acessos de emergência">
          {lista.map((e) => {
            const terminou = e.encerradoEm !== null || e.expiraEm.getTime() <= agora.getTime();
            const devo = terminou && e.resultado === null && e.solicitadoPorId === usuarioId;
            return (
              <li key={e.id}>
                <Superficie aria-labelledby={`emergencia-${e.id}`} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Situacao e={e} agora={agora} />
                    <h2 id={`emergencia-${e.id}`} className="text-[15px] font-bold text-foreground">
                      <Link href={`/admin/negocios/${e.negocioId}`} className={classeDoLink("underline")}>
                        {e.negocio}
                      </Link>
                    </h2>
                  </div>
                  <p className="text-sm break-words">
                    <span className="font-semibold">{ROTULO_MOTIVO_DA_EMERGENCIA[e.motivo]}</span> · referência {e.referencia}
                  </p>
                  <p className="text-sm break-words">{e.justificativa}</p>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">Módulos</dt>
                    <dd>{listaDeModulos(e.modulos)} (somente leitura)</dd>
                    <dt className="text-muted-foreground">Pedido</dt>
                    <dd>
                      {e.solicitadoPor} em {dataHoraCurta(e.pedidoEm)}
                    </dd>
                    <dt className="text-muted-foreground">Aprovado</dt>
                    <dd>
                      {e.aprovadoPor ?? "—"} em {dataHoraCurta(e.aprovadoEm)}, até {dataHoraCurta(e.expiraEm)}
                    </dd>
                    {e.encerradoEm && (
                      <>
                        <dt className="text-muted-foreground">Encerrado</dt>
                        <dd>
                          {e.encerradoPor ?? "—"} em {dataHoraCurta(e.encerradoEm)}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Resultado</dt>
                    <dd className="break-words">
                      {e.resultado ? (
                        <>
                          {e.resultado} <span className="text-muted-foreground">({dataHoraCurta(e.resultadoEm!)})</span>
                        </>
                      ) : terminou ? (
                        <span className="font-semibold text-status-warn">Pendente: {e.solicitadoPor} ainda não registrou</span>
                      ) : (
                        <span className="text-muted-foreground">Depois do fim do acesso</span>
                      )}
                    </dd>
                  </dl>
                  {devo && (
                    <div className={classeDaSuperficie("recuo", "p-4")}>
                      <RegistrarResultado acessoId={e.id} />
                    </div>
                  )}
                </Superficie>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
