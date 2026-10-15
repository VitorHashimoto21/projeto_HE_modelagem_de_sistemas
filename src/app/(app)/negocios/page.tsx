import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail, Plus, Store } from "lucide-react";
import { AceitarConvite } from "@/components/equipe/aceitar-convite";
import { SairDoNegocio } from "@/components/equipe/sair-do-negocio";
import { ROTULO_PAPEL, ROTULO_REGIME } from "@/components/negocio/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirSessao } from "@/lib/auth/servidor";
import { negocios } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { convitesParaVoce } from "@/lib/equipe/servicos";
import { dependenciasDaEquipe } from "@/lib/equipe/servidor";
import { acaoTrocarNegocio } from "@/lib/negocio/acoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meus negócios" };

// "Meus negócios" (SPEC-004, escopo 1): negócios em que o usuário é membro; escolher um
// o torna o negócio ativo (UC2). SPEC-005: "Convites para você" (OPEN-006) e "Sair deste
// negócio" para quem não é Dono (OPEN-007).
export default async function MeusNegocios({ searchParams }: PageProps<"/negocios">) {
  const contexto = await exigirSessao();
  const [lista, convites, { saiu }] = await Promise.all([
    negocios().listarDoUsuario(contexto.usuarioId),
    dependenciasDaEquipe().then(convitesParaVoce),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Meus negócios"
        descricao="Escolha o negócio para abrir. Cada um tem o próprio caixa, estoque e equipe."
        acoes={
          lista.length > 0 && (
            <Link href="/negocios/novo" className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Cadastrar negócio
            </Link>
          )
        }
      />

      {contexto.negocioRecusado && <AvisoDaPagina tom="atencao">O negócio que estava aberto não está disponível para a sua conta. Escolha um negócio abaixo.</AvisoDaPagina>}
      {saiu && <AvisoDaPagina tom="sucesso">Você saiu do negócio.</AvisoDaPagina>}

      {convites.length > 0 && (
        <section aria-labelledby="titulo-convites" className="space-y-3">
          <h2 id="titulo-convites" className="px-1 text-[17px] font-bold text-foreground">
            Convites para você
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {convites.map((c) => (
              <li key={c.id} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-ambar/50">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-ambar text-ambar-foreground">
                    <Mail className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-card-foreground">{c.negocio}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.convidadoPor} convidou você como {ROTULO_PAPEL[c.papel]}, vale até {dataBrasileira(c.expiraEm)}
                    </p>
                  </div>
                </div>
                <AceitarConvite conviteId={c.id} compacto />
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.length === 0 ? (
        <Superficie>
          <EstadoVazio
            Icone={Store}
            titulo="Você ainda não tem um negócio"
            acao={
              <Link href="/negocios/novo" className={classeDoBotao("principal")}>
                <Plus aria-hidden="true" />
                Cadastrar meu negócio
              </Link>
            }
          >
            Cadastre seu negócio para controlar o estoque, precificar e acompanhar o caixa. Se alguém convidou você para uma equipe, use o link do convite recebido ou aguarde o
            convite aparecer aqui.
          </EstadoVazio>
        </Superficie>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Seus negócios">
          {lista.map((n) => {
            const ativo = n.id === contexto.negocioId;
            const inicial = n.nome.trim().charAt(0).toUpperCase();
            return (
              <li key={n.id}>
                {n.suspenso ? (
                  // SPEC-013 (5.2): membro suspenso pela volta ao plano gratuito — sem entrar.
                  <div className="flex w-full items-start gap-4 rounded-2xl border-2 border-dashed border-input p-5">
                    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted text-lg font-extrabold text-muted-foreground">
                      {inicial}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold text-muted-foreground">{n.nome}</span>
                      <span className="mt-1 block text-sm text-status-warn">Acesso suspenso: o negócio voltou ao plano gratuito. Fale com o Dono.</span>
                    </span>
                  </div>
                ) : (
                  <form action={acaoTrocarNegocio}>
                    <input type="hidden" name="negocioId" value={n.id} />
                    <button
                      type="submit"
                      aria-current={ativo ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-2xl bg-card p-5 text-left ring-1 transition-[box-shadow,transform] duration-(--duracao-estado) hover:ring-primary active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        ativo ? "ring-primary" : "ring-transparent",
                      )}
                    >
                      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-estrutura text-lg font-extrabold text-estrutura-foreground">
                        {inicial}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold text-card-foreground">{n.nome}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {ROTULO_REGIME[n.regime]}, {ROTULO_PAPEL[n.papel].toLowerCase()}
                        </span>
                      </span>
                      {ativo ? (
                        <Selo tom="ok">Aberto agora</Selo>
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </form>
                )}
                {n.papel !== "DONO" && (
                  <div className="mt-2 px-1">
                    <SairDoNegocio negocioId={n.id} nome={n.nome} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
