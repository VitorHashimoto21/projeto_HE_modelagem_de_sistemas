import type { Metadata } from "next";
import { ArrowLeftRight, LifeBuoy } from "lucide-react";
import { CorrecoesDoSuporte } from "@/components/suporte/correcoes-do-suporte";
import { LiberarAcesso } from "@/components/suporte/liberar-acesso";
import { RevogarAcesso } from "@/components/suporte/revogar-acesso";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirDono } from "@/lib/auth/servidor";
import { correcoes as correcoesDoSuporte, plataforma, suporte, type CorrecaoDoNegocio, type EventoDoRegistro, type LiberacaoDoNegocio, type PedidoDaPlataforma } from "@/lib/db";
import { ROTULO_MOTIVO_DA_TROCA, type SituacaoDoPedido } from "@/lib/dominio/plataforma";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { dataHoraCompleta, dataHoraCurta, listaDeModulos, situacaoDaLiberacao, type SituacaoDaLiberacao } from "@/lib/dominio/suporte";

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

/** Como terminou o pedido de troca de plano, para o Dono (SPEC-019, 5.10). */
function desfechoParaODono(p: PedidoDaPlataforma): string {
  const quando = p.decididoEm ? dataHoraCurta(p.decididoEm) : "";
  switch (p.situacao) {
    case "PENDENTE":
      return `Aguarda a aprovação de outra pessoa da equipe do HE até ${dataHoraCurta(p.expiraEm)}. Nada muda antes disso.`;
    case "APROVADO":
      return `Aprovado por ${p.decididoPor ?? "outra pessoa"} (suporte do HE) em ${quando}: o plano mudou.`;
    case "RECUSADO":
      return `Recusado por ${p.decididoPor ?? "outra pessoa"} (suporte do HE) em ${quando}: ${(p.motivoDaRecusa ?? "").replace(/[.!]+$/, "")}. O plano não mudou.`;
    case "CANCELADO":
      return `Cancelado por quem pediu em ${quando}. O plano não mudou.`;
    case "EXPIRADO":
      return `Expirou sem aprovação em ${quando}. O plano não mudou.`;
  }
}

/** Uma troca de plano pedida pela plataforma (SPEC-019, 5.8 e 5.10), na linha do tempo do Dono. */
function PedidoDePlano({ p }: { p: PedidoDaPlataforma }) {
  const situacao = SITUACAO_DO_PEDIDO[p.situacao];
  return (
    <Superficie tom={p.situacao === "PENDENTE" ? "atencao" : "cartao"} aria-labelledby={`pedido-${p.id}`}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
          <h2 id={`pedido-${p.id}`} className="flex items-center gap-1.5 text-[15px] font-bold text-current">
            <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
            Troca de plano pela plataforma{p.plano ? `: para o ${ROTULO_PLANO[p.plano.para].toLowerCase()}` : ""}
          </h2>
        </div>
        {p.plano && (
          <p className="text-sm break-words">
            <span className="font-semibold">Motivo:</span> {ROTULO_MOTIVO_DA_TROCA[p.plano.motivo]} — {p.plano.descricao}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Pedido por {p.solicitadoPor} (suporte do HE) em {dataHoraCompleta(p.criadoEm)}
        </p>
        <p className="text-sm break-words">{desfechoParaODono(p)}</p>
      </div>
    </Superficie>
  );
}

/** Texto de cada evento do registro, do ponto de vista do Dono. */
function textoDoEvento(e: EventoDoRegistro): string {
  switch (e.evento) {
    case "LIBERACAO":
      return `${e.autor} liberou o acesso`;
    case "REVOGACAO":
      return `${e.autor}: ${e.descricao.toLowerCase()}`;
    case "ENTRADA":
      return `Suporte HE — ${e.autor} entrou em modo suporte`;
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
  const { negocioId } = await exigirDono();
  const agora = new Date();
  const [liberacoes, correcoes, pedidos, { revogado, erro }] = await Promise.all([
    suporte().liberacoesDoNegocio(negocioId),
    correcoesDoSuporte().correcoesDoNegocio(negocioId, agora),
    plataforma().pedidosDoNegocio(negocioId, agora),
    searchParams,
  ]);
  // SPEC-019 (5.10): liberações e trocas de plano pela plataforma numa só linha do tempo, da mais nova à mais antiga.
  const linha: ({ tipo: "liberacao"; l: LiberacaoDoNegocio } | { tipo: "plano"; p: PedidoDaPlataforma })[] = [
    ...liberacoes.map((l) => ({ tipo: "liberacao" as const, l })),
    ...pedidos.filter((p) => p.tipo === "PLANO").map((p) => ({ tipo: "plano" as const, p })),
  ].sort((a, b) => (b.tipo === "liberacao" ? b.l.criadoEm : b.p.criadoEm).getTime() - (a.tipo === "liberacao" ? a.l.criadoEm : a.p.criadoEm).getTime());
  const ativa = liberacoes.find((l) => situacaoDaLiberacao(l, agora) === "ATIVA");
  const porLiberacao = new Map<string, CorrecaoDoNegocio[]>();
  for (const c of correcoes) if (c.acessoId) porLiberacao.set(c.acessoId, [...(porLiberacao.get(c.acessoId) ?? []), c]);

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Acesso do suporte"
        descricao="Quando precisar de ajuda, libere o suporte do HE para ver os módulos que você escolher, por um prazo, e, se quiser, corrigir alguns deles. O suporte nunca entra sem a sua liberação, e você pode desfazer cada correção. As trocas de plano feitas pela plataforma também aparecem aqui."
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
        <ul className="space-y-4" aria-label="Liberações do suporte e trocas de plano pela plataforma">
          {linha.map((item) => {
            if (item.tipo === "plano")
              return (
                <li key={item.p.id}>
                  <PedidoDePlano p={item.p} />
                </li>
              );
            const l = item.l;
            const situacao = situacaoDaLiberacao(l, agora);
            const dela = porLiberacao.get(l.id) ?? [];
            return (
              <li key={l.id}>
                <Superficie tom={situacao === "ATIVA" ? "atencao" : "cartao"} aria-labelledby={`liberacao-${l.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Selo tom={SITUACAO[situacao].tom}>{SITUACAO[situacao].rotulo}</Selo>
                        <h2 id={`liberacao-${l.id}`} className="text-[15px] font-bold text-current">
                          {situacao === "ATIVA"
                            ? `Até ${dataHoraCurta(l.expiraEm)}`
                            : situacao === "REVOGADA"
                              ? `Revogada em ${dataHoraCurta(l.revogadoEm!)}`
                              : `Expirou em ${dataHoraCurta(l.expiraEm)}`}
                        </h2>
                      </div>
                      <p className="text-sm break-words">
                        <span className="font-semibold">Motivo:</span> {l.motivo}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ver: {listaDeModulos(l.modulos)}
                        {l.modulosComCorrecao.length > 0 && <> · corrigir: {listaDeModulos(l.modulosComCorrecao)}</>} · liberado por {l.liberadoPor} em{" "}
                        {dataHoraCompleta(l.criadoEm)}
                      </p>
                    </div>
                    {situacao === "ATIVA" && <RevogarAcesso acessoId={l.id} />}
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
