import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye, Lock, LogIn, OctagonPause, Siren } from "lucide-react";
import { CartaoDoPedido } from "@/components/plataforma/pedido";
import { RegistrarResultado } from "@/components/plataforma/registrar-resultado";
import { SolicitarEmergencia } from "@/components/plataforma/solicitar-emergencia";
import { ReativarNegocio, SuspenderNegocio } from "@/components/plataforma/suspender-negocio";
import { TrocarPlano } from "@/components/plataforma/trocar-plano";
import { SeloDaEmergencia } from "@/components/suporte/selo-da-emergencia";
import { SeloDaSuspensao } from "@/components/suporte/selo-da-suspensao";
import { ROTULO_REGIME } from "@/components/negocio/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDaSuperficie, classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { EntrarEmModoSuporte } from "@/components/suporte/entrar-em-modo-suporte";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { plataforma, suporte } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { MENSAGENS_DA_EMERGENCIA, ROTULO_MOTIVO_DA_EMERGENCIA } from "@/lib/dominio/emergencia";
import { MENSAGENS_DA_PLATAFORMA } from "@/lib/dominio/plataforma";
import { dataHoraCompleta, dataHoraCurta, listaDeModulos, MENSAGENS_SUPORTE } from "@/lib/dominio/suporte";
import { MENSAGENS_DA_SUSPENSAO, ROTULO_MOTIVO_DA_SUSPENSAO } from "@/lib/dominio/suspensao";
import { acaoEntrarEmEmergencia } from "@/lib/plataforma/acoes";
import { autenticadoresDaSessao } from "@/lib/plataforma/servidor";

export const metadata: Metadata = { title: "Negócio — administração" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ficha do negócio no painel (SPEC-018, 5.3): os mesmos metadados, a liberação ativa do Dono
// e a entrada em modo suporte — habilitada só com liberação ativa, conferida de novo no servidor.
// SPEC-019 (5.9, item 5): "Trocar plano", com o pedido pendente e os anteriores deste negócio; e o acesso de
// emergência (5.6): solicitar só sem liberação ativa, o pedido pendente, "Entrar" só para quem pediu, e o
// resultado que essa conta ainda deve. A suspensão (5.7): "Suspender" ou "Reativar", com o histórico.
export default async function NegocioNoPainel({ params, searchParams }: PageProps<"/admin/negocios/[id]">) {
  const { usuarioId } = await exigirAdministrador();
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const agora = new Date();
  const n = await suporte().negocioNoPainel(id, agora);
  if (!n) notFound();
  const comCorrecao = (n.liberacao?.modulosComCorrecao.length ?? 0) > 0;
  // SPEC-019 (OPEN-003): entrar para corrigir e pedir, aprovar ou recusar pedem o código de novo; o
  // diálogo lista os autenticadores.
  const [autenticadores, pedidos, administradores, semResultado, suspensoes] = await Promise.all([
    autenticadoresDaSessao(),
    plataforma().pedidosDoNegocio(n.id, agora),
    plataforma().administradores(),
    suporte().emergencias({ semResultadoDe: usuarioId }),
    plataforma().suspensoesDoNegocio(n.id),
  ]);
  const pedidosDePlano = pedidos.filter((p) => p.tipo === "PLANO");
  const pendente = pedidosDePlano.find((p) => p.situacao === "PENDENTE");
  const anteriores = pedidosDePlano.filter((p) => p.situacao !== "PENDENTE").slice(0, 5);
  const emergenciaPendente = pedidos.find((p) => p.tipo === "EMERGENCIA" && p.situacao === "PENDENTE");
  const emergencia = n.emergencia;
  // O resultado só se registra depois do fim (saída, expiração ou encerramento).
  const resultadoDevido = semResultado.filter((e) => e.negocioId === n.id && (e.encerradoEm !== null || e.expiraEm.getTime() <= agora.getTime()));
  const devoResultado = semResultado.some((e) => e.encerradoEm !== null || e.expiraEm.getTime() <= agora.getTime());
  const podeSolicitar = !n.encerrado && !n.liberacao && !emergencia && !emergenciaPendente && !devoResultado;
  const porQueNao = n.encerrado
    ? "Negócio encerrado: não há acesso de emergência."
    : n.liberacao
      ? "O Dono liberou o acesso: use a liberação. A emergência é só para quando não há liberação."
      : devoResultado
        ? MENSAGENS_DA_EMERGENCIA.resultadoPendente
        : null;

  const dados: [string, React.ReactNode][] = [
    ["Regime", ROTULO_REGIME[n.regime]],
    ["Plano", ROTULO_PLANO[n.plano]],
    ["Criado em", dataBrasileira(n.criadoEm)],
    ["Membros", String(n.membros)],
    ["Situação", n.encerrado ? "Encerrado" : n.suspensao ? `Suspenso desde ${dataBrasileira(n.suspensao.desde)}` : "Ativo"],
    ["Dono", n.dono ? `${n.dono.nome} (${n.dono.email})` : "—"],
  ];

  return (
    <div className="space-y-6">
      <CabecalhoDePagina voltar={{ href: "/admin", rotulo: "Negócios" }} titulo={n.nome} descricao="Dados de cadastro do negócio. Nada de vendas, valores, clientes ou estoque." />

      {typeof busca.erro === "string" && <AvisoDaPagina tom="erro">{busca.erro}</AvisoDaPagina>}
      {emergencia && (
        <AvisoDaPagina tom="erro">
          Acesso de emergência em andamento até {dataHoraCurta(emergencia.expiraEm)}, pedido por {emergencia.solicitadoPor}. O Dono e a equipe veem a faixa vermelha.
        </AvisoDaPagina>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Superficie aria-labelledby="titulo-cadastro">
          <TituloDaSuperficie id="titulo-cadastro" titulo="Cadastro" />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
            {dados.map(([rotulo, valor]) => (
              <div key={rotulo} className="contents">
                <dt className="text-muted-foreground">{rotulo}</dt>
                <dd className="font-medium break-words text-foreground">{valor}</dd>
              </div>
            ))}
          </dl>
        </Superficie>

        <Superficie tom={n.liberacao ? "atencao" : "cartao"} aria-labelledby="titulo-suporte">
          <TituloDaSuperficie id="titulo-suporte" titulo="Acesso de suporte" />
          {n.liberacao ? (
            <div className="space-y-4">
              <Selo tom="atencao">Liberado até {dataHoraCompleta(n.liberacao.expiraEm)}</Selo>
              <p className="text-sm break-words">
                <span className="font-semibold">Motivo:</span> {n.liberacao.motivo}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Ver:</span> {listaDeModulos(n.liberacao.modulos)}.
              </p>
              {comCorrecao && (
                <p className="text-sm">
                  <span className="font-semibold">Corrigir:</span> {listaDeModulos(n.liberacao.modulosComCorrecao)}, só as ações da lista.
                  {n.suspensao && ` ${MENSAGENS_DA_SUSPENSAO.correcoes}`}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Ao entrar, cada tela aberta fica registrada e o Dono acompanha tudo. Clientes e e-mails da equipe aparecem mascarados.
                {comCorrecao && " Cada correção aparece para o Dono na hora, com o antes e o depois. Para entrar, o código do autenticador é pedido de novo."}
              </p>
              <EntrarEmModoSuporte negocioId={n.id} autenticadores={autenticadores} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-sm">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {n.encerrado ? "Negócio encerrado: não há acesso de suporte." : MENSAGENS_SUPORTE.semLiberacao}
              </p>
              <button type="button" disabled className={classeDoBotao("principal")}>
                <Eye aria-hidden="true" />
                Entrar em modo suporte
              </button>
            </div>
          )}
        </Superficie>
      </div>

      <Superficie tom={n.suspensao ? "perigo" : "cartao"} aria-labelledby="titulo-suspensao">
        <TituloDaSuperficie
          id="titulo-suspensao"
          titulo={
            <span className="flex items-center gap-2">
              <OctagonPause className="size-5 shrink-0 text-status-danger" aria-hidden="true" />
              Suspensão
            </span>
          }
          descricao="Uma conta de Administrador suspende, com o motivo e a descrição. O negócio fica somente leitura até a reativação, e o Dono é avisado."
          acoes={
            n.suspensao ? (
              <ReativarNegocio negocioId={n.id} negocio={n.nome} autenticadores={autenticadores} disponivel />
            ) : (
              <SuspenderNegocio negocioId={n.id} negocio={n.nome} autenticadores={autenticadores} disponivel={!n.encerrado} />
            )
          }
        />
        <div className="space-y-4">
          {n.encerrado && <p className="text-sm text-muted-foreground">{MENSAGENS_DA_SUSPENSAO.encerrado}</p>}
          {n.suspensao && (
            <div className="space-y-3">
              <SeloDaSuspensao>Suspenso desde {dataHoraCompleta(n.suspensao.desde)}</SeloDaSuspensao>
              <p className="text-sm break-words">
                <span className="font-semibold">{ROTULO_MOTIVO_DA_SUSPENSAO[n.suspensao.motivo]}</span> · por {n.suspensao.por}
              </p>
              <p className="text-sm break-words whitespace-pre-line">{n.suspensao.descricao}</p>
            </div>
          )}
          {!n.encerrado && !n.suspensao && <p className="text-sm text-muted-foreground">O negócio está ativo.</p>}
          {suspensoes.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                Histórico de suspensões ({suspensoes.length})
              </summary>
              <ul className="mt-3 divide-y">
                {suspensoes.map((r) => (
                  <li key={r.id} className="space-y-1 py-3 text-sm first:pt-0 last:pb-0">
                    <p>
                      <span className="font-semibold">{r.evento === "SUSPENSAO" ? "Suspenso" : "Reativado"}</span> em {dataHoraCompleta(r.criadoEm)} por {r.autor}
                      {r.motivo && ` · ${ROTULO_MOTIVO_DA_SUSPENSAO[r.motivo]}`}
                    </p>
                    <p className="break-words text-muted-foreground">{r.descricao}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Superficie>

      <Superficie aria-labelledby="titulo-plano">
        <TituloDaSuperficie
          id="titulo-plano"
          titulo="Plano"
          descricao="A troca pela plataforma só vale com a aprovação de outra conta de Administrador, em até 12 horas. O Dono é avisado."
          acoes={
            <TrocarPlano
              negocioId={n.id}
              negocio={n.nome}
              planoAtual={n.plano}
              autenticadores={autenticadores}
              umaContaSo={administradores.length < 2}
              disponivel={!n.encerrado && !pendente}
            />
          }
        />
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-semibold">Plano atual:</span> {ROTULO_PLANO[n.plano]}.
          </p>
          {n.encerrado && <p className="text-sm text-muted-foreground">{MENSAGENS_DA_PLATAFORMA.negocioEncerrado}</p>}
          {pendente && (
            <div className={classeDaSuperficie("recuo", "p-4")}>
              <CartaoDoPedido pedido={pendente} administradorId={usuarioId} autenticadores={autenticadores} comNegocio={false} />
            </div>
          )}
          {anteriores.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                Pedidos anteriores ({anteriores.length})
              </summary>
              <ul className="mt-3 divide-y">
                {anteriores.map((p) => (
                  <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                    <CartaoDoPedido pedido={p} administradorId={usuarioId} autenticadores={autenticadores} comNegocio={false} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Superficie>

      <Superficie tom={emergencia ? "perigo" : "cartao"} aria-labelledby="titulo-emergencia">
        <TituloDaSuperficie
          id="titulo-emergencia"
          titulo={
            <span className="flex items-center gap-2">
              <Siren className="size-5 shrink-0 text-status-danger" aria-hidden="true" />
              Acesso de emergência
            </span>
          }
          descricao="Só sem a liberação do Dono, com a aprovação de outra conta de Administrador. Somente leitura, por até 4 horas, e o Dono vê tudo desde o pedido."
          acoes={
            !emergencia && !emergenciaPendente ? (
              <SolicitarEmergencia negocioId={n.id} negocio={n.nome} autenticadores={autenticadores} umaContaSo={administradores.length < 2} disponivel={podeSolicitar} />
            ) : undefined
          }
        />
        <div className="space-y-4">
          {!emergencia && !emergenciaPendente && porQueNao && <p className="text-sm text-muted-foreground">{porQueNao}</p>}
          {emergencia && (
            <div className="space-y-3">
              <SeloDaEmergencia>Em andamento até {dataHoraCompleta(emergencia.expiraEm)}</SeloDaEmergencia>
              <p className="text-sm break-words">
                <span className="font-semibold">{ROTULO_MOTIVO_DA_EMERGENCIA[emergencia.motivo]}</span> · referência {emergencia.referencia}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Ver:</span> {listaDeModulos(emergencia.modulos)} (somente leitura). Pedido por {emergencia.solicitadoPor}.
              </p>
              {emergencia.solicitadoPorId === usuarioId ? (
                <form action={acaoEntrarEmEmergencia}>
                  <input type="hidden" name="negocioId" value={n.id} />
                  <button type="submit" className={classeDoBotao("perigo")}>
                    <LogIn aria-hidden="true" />
                    Entrar (somente leitura)
                  </button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">{MENSAGENS_DA_EMERGENCIA.soQuemPediuEntra}</p>
              )}
            </div>
          )}
          {emergenciaPendente && (
            <div className={classeDaSuperficie("recuo", "p-4")}>
              <CartaoDoPedido pedido={emergenciaPendente} administradorId={usuarioId} autenticadores={autenticadores} comNegocio={false} />
            </div>
          )}
          {resultadoDevido.map((e) => (
            <div key={e.id} className={classeDaSuperficie("recuo", "space-y-3 p-4")}>
              <p className="text-sm">
                <span className="font-semibold">Registre o resultado</span> do acesso de emergência de {dataHoraCurta(e.aprovadoEm)} ({e.referencia}), que terminou em{" "}
                {dataHoraCurta(e.encerradoEm ?? e.expiraEm)}.
              </p>
              <RegistrarResultado acessoId={e.id} />
            </div>
          ))}
        </div>
      </Superficie>
    </div>
  );
}
