import type { Metadata } from "next";
import { ArrowLeftRight, LifeBuoy, OctagonPause, Play, Siren } from "lucide-react";
import { CorrecoesDoSuporte } from "@/components/suporte/correcoes-do-suporte";
import { EncerrarEmergencia } from "@/components/suporte/encerrar-emergencia";
import { SeloDaEmergencia } from "@/components/suporte/selo-da-emergencia";
import { SeloDaSuspensao } from "@/components/suporte/selo-da-suspensao";
import { LiberarAcesso } from "@/components/suporte/liberar-acesso";
import { RevogarAcesso } from "@/components/suporte/revogar-acesso";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirDono } from "@/lib/auth/servidor";
import {
  correcoes as correcoesDoSuporte,
  plataforma,
  suporte,
  type CorrecaoDoNegocio,
  type EventoDoRegistro,
  type LiberacaoDoNegocio,
  type PedidoDaPlataforma,
  type SuspensaoNoRegistro,
} from "@/lib/db";
import { ROTULO_MOTIVO_DA_EMERGENCIA } from "@/lib/dominio/emergencia";
import { ROTULO_MOTIVO_DA_TROCA, type SituacaoDoPedido } from "@/lib/dominio/plataforma";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { dataHoraCompleta, dataHoraCurta, listaDeModulos, PRAZOS, situacaoDaLiberacao, type SituacaoDaLiberacao } from "@/lib/dominio/suporte";
import { ROTULO_MOTIVO_DA_SUSPENSAO } from "@/lib/dominio/suspensao";

export const metadata: Metadata = { title: "Acesso do suporte" };

const SITUACAO: Record<SituacaoDaLiberacao, { rotulo: string; tom: TomDoSelo }> = {
  ATIVA: { rotulo: "Ativa", tom: "atencao" },
  EXPIRADA: { rotulo: "Expirada", tom: "neutro" },
  REVOGADA: { rotulo: "Revogada", tom: "neutro" },
};

const SITUACAO_DO_PEDIDO: Record<SituacaoDoPedido, { rotulo: string; tom: TomDoSelo }> = {
  PENDENTE: { rotulo: "Aguardando aprovação", tom: "atencao" },
  APROVADO: { rotulo: "Plano trocado", tom: "ok" },
  RECUSADO: { rotulo: "Recusado", tom: "neutro" },
  CANCELADO: { rotulo: "Cancelado", tom: "neutro" },
  EXPIRADO: { rotulo: "Expirado", tom: "neutro" },
};

/** Como terminou o pedido da plataforma, para o Dono (SPEC-019, 5.10): o plano não mudou, ou o suporte não entrou. */
function desfechoParaODono(p: PedidoDaPlataforma): string {
  const quando = p.decididoEm ? dataHoraCurta(p.decididoEm) : "";
  const semEfeito = p.tipo === "EMERGENCIA" ? "O suporte não entrou." : "O plano não mudou.";
  switch (p.situacao) {
    case "PENDENTE":
      return p.tipo === "EMERGENCIA"
        ? `Aguarda a aprovação de outra pessoa da equipe do HE até ${dataHoraCurta(p.expiraEm)}. O suporte não entra antes disso, e você é avisado se for aprovado.`
        : `Aguarda a aprovação de outra pessoa da equipe do HE até ${dataHoraCurta(p.expiraEm)}. Nada muda antes disso.`;
    case "APROVADO":
      return `Aprovado por ${p.decididoPor ?? "outra pessoa"} (suporte do HE) em ${quando}: o plano mudou.`;
    case "RECUSADO":
      return `Recusado por ${p.decididoPor ?? "outra pessoa"} (suporte do HE) em ${quando}: ${(p.motivoDaRecusa ?? "").replace(/[.!]+$/, "")}. ${semEfeito}`;
    case "CANCELADO":
      return `Cancelado por quem pediu em ${quando}. ${semEfeito}`;
    case "EXPIRADO":
      return `Expirou sem aprovação em ${quando}. ${semEfeito}`;
  }
}

/**
 * Um pedido da plataforma na linha do tempo do Dono (SPEC-019, 5.10): a troca de plano (5.8) e o pedido de
 * emergência, visível desde o pedido (5.6, item 4; INV-007). A emergência aprovada aparece como o acesso.
 */
function PedidoParaODono({ p }: { p: PedidoDaPlataforma }) {
  const situacao = SITUACAO_DO_PEDIDO[p.situacao];
  const e = p.emergencia;
  return (
    <Superficie tom={p.situacao === "PENDENTE" ? (e ? "perigo" : "atencao") : "cartao"} aria-labelledby={`pedido-${p.id}`}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {e && <SeloDaEmergencia>Emergência</SeloDaEmergencia>}
          <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
          <h2 id={`pedido-${p.id}`} className="flex items-center gap-1.5 text-[15px] font-bold text-current">
            {e ? <Siren className="size-4 shrink-0" aria-hidden="true" /> : <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />}
            {e ? "Pedido de acesso de emergência" : `Troca de plano pela plataforma${p.plano ? `: para o ${ROTULO_PLANO[p.plano.para].toLowerCase()}` : ""}`}
          </h2>
        </div>
        {p.plano && (
          <p className="text-sm break-words">
            <span className="font-semibold">Motivo:</span> {ROTULO_MOTIVO_DA_TROCA[p.plano.motivo]} — {p.plano.descricao}
          </p>
        )}
        {e && (
          <>
            <p className="text-sm break-words">
              <span className="font-semibold">Motivo:</span> {ROTULO_MOTIVO_DA_EMERGENCIA[e.motivo]}, {e.referencia}
            </p>
            <p className="text-sm break-words">
              <span className="font-semibold">Justificativa:</span> {e.justificativa}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Pedido:</span> ver {listaDeModulos(e.modulos)}, somente leitura, por {PRAZOS[e.prazo].rotulo}
            </p>
          </>
        )}
        <p className="text-sm text-muted-foreground">
          Pedido por {p.solicitadoPor} (suporte do HE) em {dataHoraCompleta(p.criadoEm)}
        </p>
        <p className="text-sm break-words">{desfechoParaODono(p)}</p>
      </div>
    </Superficie>
  );
}

/**
 * SPEC-019 (5.7, 5.10): a suspensão ou a reativação do negócio pela plataforma, com o motivo e a descrição
 * completa, na linha do tempo do Dono.
 */
function SuspensaoParaODono({ r, vigente }: { r: SuspensaoNoRegistro; vigente: boolean }) {
  const suspensao = r.evento === "SUSPENSAO";
  return (
    <Superficie tom={vigente ? "perigo" : "cartao"} aria-labelledby={`suspensao-${r.id}`}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {suspensao ? <SeloDaSuspensao>{vigente ? "Em vigor" : "Suspensão"}</SeloDaSuspensao> : <Selo tom="ok">Reativado</Selo>}
          <h2 id={`suspensao-${r.id}`} className="flex items-center gap-1.5 text-[15px] font-bold text-current">
            {suspensao ? <OctagonPause className="size-4 shrink-0" aria-hidden="true" /> : <Play className="size-4 shrink-0" aria-hidden="true" />}
            {suspensao ? "Negócio suspenso pela plataforma" : "Negócio reativado pela plataforma"}
          </h2>
        </div>
        {suspensao && r.motivo && (
          <p className="text-sm break-words">
            <span className="font-semibold">Motivo:</span> {ROTULO_MOTIVO_DA_SUSPENSAO[r.motivo]}
          </p>
        )}
        <p className="text-sm break-words whitespace-pre-line">
          <span className="font-semibold">Descrição:</span> {r.descricao}
        </p>
        <p className="text-sm text-muted-foreground">
          {suspensao ? "Suspenso" : "Reativado"} por {r.autor} (suporte do HE) em {dataHoraCompleta(r.criadoEm)}
        </p>
        {vigente && (
          <p className="text-sm break-words">
            Enquanto durar, você e a equipe veem tudo e exportam os dados, mas nada é gravado. Você continua podendo liberar o suporte para pedir ajuda.
          </p>
        )}
      </div>
    </Superficie>
  );
}

/** Texto de cada evento do registro, do ponto de vista do Dono. */
function textoDoEvento(e: EventoDoRegistro): string {
  switch (e.evento) {
    case "EMERGENCIA_APROVADA":
      return `Suporte HE — ${e.autor} aprovou o acesso de emergência`;
    case "EMERGENCIA_ENCERRADA":
      return `${e.autor}: ${e.descricao.toLowerCase()}`;
    case "EMERGENCIA_RESULTADO":
      return `Suporte HE — ${e.autor} registrou o resultado`;
    case "LIBERACAO":
      return `${e.autor} liberou o acesso`;
    case "REVOGACAO":
      return `${e.autor}: ${e.descricao.toLowerCase()}`;
    case "ENTRADA":
      return `Suporte HE — ${e.autor} ${e.descricao.startsWith("Entrou no acesso de emergência") ? "entrou no acesso de emergência" : "entrou em modo suporte"}`;
    case "TELA":
      return `Viu: ${e.descricao}`;
    case "SAIDA":
      return `Suporte HE — ${e.autor} saiu do modo suporte`;
    case "CORRECAO":
      return `Suporte HE — ${e.autor} corrigiu: ${e.descricao}`;
    case "CORRECAO_DESFEITA":
      return `${e.autor}: ${e.descricao}`;
    default:
      return e.descricao;
  }
}

// Acesso do suporte (SPEC-018, 5.4 e 5.6 — RF75, RF77): só o Dono (Configurações). Liberar,
// revogar e acompanhar cada entrada, tela aberta e saída do suporte, com data, hora e nome.
// SPEC-019 (5.10): o nível de cada módulo e as correções, com o antes, o depois e o "Desfazer".
export default async function AcessoDoSuporte({ searchParams }: PageProps<"/negocio/suporte">) {
  const { negocioId, negocioSuspenso } = await exigirDono();
  const agora = new Date();
  const [liberacoes, correcoes, pedidos, suspensoes, { revogado, erro }] = await Promise.all([
    suporte().liberacoesDoNegocio(negocioId),
    correcoesDoSuporte().correcoesDoNegocio(negocioId, agora),
    plataforma().pedidosDoNegocio(negocioId, agora),
    plataforma().suspensoesDoNegocio(negocioId),
    searchParams,
  ]);
  // SPEC-019 (5.10): liberações, acessos de emergência, pedidos da plataforma, suspensões e reativações numa só
  // linha do tempo, da mais nova à mais antiga. O pedido de emergência aprovado aparece como o acesso que ele criou.
  type ItemDaLinha = { tipo: "liberacao"; l: LiberacaoDoNegocio } | { tipo: "pedido"; p: PedidoDaPlataforma } | { tipo: "suspensao"; r: SuspensaoNoRegistro };
  const quando = (i: ItemDaLinha) => (i.tipo === "liberacao" ? i.l.criadoEm : i.tipo === "pedido" ? i.p.criadoEm : i.r.criadoEm).getTime();
  const linha: ItemDaLinha[] = [
    ...liberacoes.map((l) => ({ tipo: "liberacao" as const, l })),
    ...pedidos.filter((p) => !(p.tipo === "EMERGENCIA" && p.situacao === "APROVADO")).map((p) => ({ tipo: "pedido" as const, p })),
    ...suspensoes.map((r) => ({ tipo: "suspensao" as const, r })),
  ].sort((a, b) => quando(b) - quando(a));
  // A suspensão em vigor é a mais recente, enquanto o negócio continua suspenso.
  const suspensaoVigente = negocioSuspenso ? suspensoes.find((r) => r.evento === "SUSPENSAO")?.id : undefined;
  const ativa = liberacoes.find((l) => l.tipo === "LIBERACAO" && situacaoDaLiberacao(l, agora) === "ATIVA");
  const porLiberacao = new Map<string, CorrecaoDoNegocio[]>();
  for (const c of correcoes) if (c.acessoId) porLiberacao.set(c.acessoId, [...(porLiberacao.get(c.acessoId) ?? []), c]);

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Acesso do suporte"
        descricao="Quando precisar de ajuda, libere o suporte do HE para ver os módulos que você escolher, por um prazo, e, se quiser, corrigir alguns deles. Sem a sua liberação, o suporte só entra numa emergência aprovada por duas pessoas da equipe, somente leitura, e você vê tudo aqui desde o pedido. As trocas de plano, as suspensões e as reativações feitas pela plataforma também aparecem aqui."
        acoes={<LiberarAcesso substitui={Boolean(ativa)} />}
      />

      {revogado && <AvisoDaPagina tom="sucesso">Acesso do suporte revogado.</AvisoDaPagina>}
      {erro && <AvisoDaPagina tom="erro">Este acesso já tinha terminado. Atualize a página.</AvisoDaPagina>}

      {linha.length === 0 ? (
        <Superficie>
          <EstadoVazio Icone={LifeBuoy} titulo="Nenhum acesso liberado ainda">
            Os dados dos seus clientes (nome, documento, contato e endereço) e os e-mails da equipe aparecem mascarados para o suporte, e cada tela aberta fica registrada aqui.
          </EstadoVazio>
        </Superficie>
      ) : (
        <ul className="space-y-4" aria-label="Liberações, acessos de emergência, pedidos e suspensões da plataforma">
          {linha.map((item) => {
            if (item.tipo === "pedido")
              return (
                <li key={item.p.id}>
                  <PedidoParaODono p={item.p} />
                </li>
              );
            if (item.tipo === "suspensao")
              return (
                <li key={item.r.id}>
                  <SuspensaoParaODono r={item.r} vigente={item.r.id === suspensaoVigente} />
                </li>
              );
            const l = item.l;
            const situacao = situacaoDaLiberacao(l, agora);
            const dela = porLiberacao.get(l.id) ?? [];
            const e = l.emergencia;
            return (
              <li key={l.id}>
                <Superficie tom={situacao === "ATIVA" ? (e ? "perigo" : "atencao") : "cartao"} aria-labelledby={`liberacao-${l.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {e && <SeloDaEmergencia>Emergência</SeloDaEmergencia>}
                        <Selo tom={SITUACAO[situacao].tom}>{e && situacao === "REVOGADA" ? "Encerrada" : SITUACAO[situacao].rotulo}</Selo>
                        <h2 id={`liberacao-${l.id}`} className="text-[15px] font-bold text-current">
                          {situacao === "ATIVA"
                            ? `Até ${dataHoraCurta(l.expiraEm)}`
                            : situacao === "REVOGADA"
                              ? `${e ? "Encerrada" : "Revogada"} em ${dataHoraCurta(l.revogadoEm!)}${e && l.revogadoPor ? ` por ${l.revogadoPor}` : ""}`
                              : `Expirou em ${dataHoraCurta(l.expiraEm)}`}
                        </h2>
                      </div>
                      {e ? (
                        <>
                          <p className="text-sm break-words">
                            <span className="font-semibold">Motivo:</span> {ROTULO_MOTIVO_DA_EMERGENCIA[e.motivo]}, {e.referencia}
                          </p>
                          <p className="text-sm break-words">
                            <span className="font-semibold">Justificativa:</span> {e.justificativa}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Ver: {listaDeModulos(l.modulos)} (somente leitura) · pedido por {e.solicitadoPor} e aprovado por {e.aprovadoPor ?? "outra pessoa"} (suporte do HE) em{" "}
                            {dataHoraCompleta(l.criadoEm)}
                          </p>
                          <p className="text-sm break-words">
                            <span className="font-semibold">Resultado:</span>{" "}
                            {e.resultado ?? (situacao === "ATIVA" ? "registrado por quem pediu depois do fim do acesso." : `ainda não registrado por ${e.solicitadoPor}.`)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm break-words">
                            <span className="font-semibold">Motivo:</span> {l.motivo}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Ver: {listaDeModulos(l.modulos)}
                            {l.modulosComCorrecao.length > 0 && <> · corrigir: {listaDeModulos(l.modulosComCorrecao)}</>} · liberado por {l.liberadoPor} em{" "}
                            {dataHoraCompleta(l.criadoEm)}
                          </p>
                        </>
                      )}
                    </div>
                    {situacao === "ATIVA" && (e ? <EncerrarEmergencia acessoId={l.id} /> : <RevogarAcesso acessoId={l.id} />)}
                  </div>
                  {dela.length > 0 && <CorrecoesDoSuporte correcoes={dela} id={`correcoes-${l.id}`} />}
                  <details className="group mt-4" open={situacao === "ATIVA"}>
                    <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                      Registro ({l.eventos.length} {l.eventos.length === 1 ? "evento" : "eventos"})
                    </summary>
                    <ol className="mt-3 space-y-2 border-l-2 border-border pl-4">
                      {l.eventos.map((e) => (
                        <li key={e.id} className="text-sm">
                          <time dateTime={e.criadoEm.toISOString()} className="mr-2 font-semibold tabular-nums">
                            {dataHoraCurta(e.criadoEm)}
                          </time>
                          <span className="break-words">{textoDoEvento(e)}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </Superficie>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
