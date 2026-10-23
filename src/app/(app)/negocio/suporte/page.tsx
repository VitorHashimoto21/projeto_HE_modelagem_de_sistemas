import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { LiberarAcesso } from "@/components/suporte/liberar-acesso";
import { RevogarAcesso } from "@/components/suporte/revogar-acesso";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirDono } from "@/lib/auth/servidor";
import { suporte, type EventoDoRegistro } from "@/lib/db";
import { dataHoraCompleta, dataHoraCurta, listaDeModulos, situacaoDaLiberacao, type SituacaoDaLiberacao } from "@/lib/dominio/suporte";

export const metadata: Metadata = { title: "Acesso do suporte" };

const SITUACAO: Record<SituacaoDaLiberacao, { rotulo: string; tom: TomDoSelo }> = {
  ATIVA: { rotulo: "Ativa", tom: "atencao" },
  EXPIRADA: { rotulo: "Expirada", tom: "neutro" },
  REVOGADA: { rotulo: "Revogada", tom: "neutro" },
};

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
    default:
      return e.descricao;
  }
}

// Acesso do suporte (SPEC-018, 5.4 e 5.6 — RF75, RF77): só o Dono (Configurações). Liberar,
// revogar e acompanhar cada entrada, tela aberta e saída do suporte, com data, hora e nome.
export default async function AcessoDoSuporte({ searchParams }: PageProps<"/negocio/suporte">) {
  const { negocioId } = await exigirDono();
  const agora = new Date();
  const [liberacoes, { revogado, erro }] = await Promise.all([suporte().liberacoesDoNegocio(negocioId), searchParams]);
  const ativa = liberacoes.find((l) => situacaoDaLiberacao(l, agora) === "ATIVA");

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Acesso do suporte"
        descricao="Quando precisar de ajuda, libere o suporte do HE para ver (sem alterar) os módulos que você escolher, por um prazo. O suporte nunca entra sem a sua liberação."
        acoes={<LiberarAcesso substitui={Boolean(ativa)} />}
      />

      {revogado && <AvisoDaPagina tom="sucesso">Acesso do suporte revogado.</AvisoDaPagina>}
      {erro && <AvisoDaPagina tom="erro">Este acesso já tinha terminado. Atualize a página.</AvisoDaPagina>}

      {liberacoes.length === 0 ? (
        <Superficie>
          <EstadoVazio Icone={LifeBuoy} titulo="Nenhum acesso liberado ainda">
            Os dados dos seus clientes (nome, documento, contato e endereço) e os e-mails da equipe aparecem mascarados para o suporte, e cada tela aberta fica registrada aqui.
          </EstadoVazio>
        </Superficie>
      ) : (
        <ul className="space-y-4" aria-label="Liberações do suporte">
          {liberacoes.map((l) => {
            const situacao = situacaoDaLiberacao(l, agora);
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
                        {listaDeModulos(l.modulos)} · liberado por {l.liberadoPor} em {dataHoraCompleta(l.criadoEm)}
                      </p>
                    </div>
                    {situacao === "ATIVA" && <RevogarAcesso acessoId={l.id} />}
                  </div>
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
