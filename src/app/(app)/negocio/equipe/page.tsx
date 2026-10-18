import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserPlus } from "lucide-react";
import { AcoesDoConvite } from "@/components/equipe/acoes-do-convite";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirDono } from "@/lib/auth/servidor";
import { equipe, LIMITE_DO_PLANO_GRATUITO } from "@/lib/db";
import { acaoTrocarAcesso } from "@/lib/planos/acoes";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PAPEL } from "@/lib/dominio/permissoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipe" };

// Equipe (SPEC-005, escopo 4): só o Dono (Configurações — OPEN-002).
export default async function Equipe({ searchParams }: PageProps<"/negocio/equipe">) {
  const { negocioId } = await exigirDono();
  const doNegocio = equipe().doNegocio(negocioId);
  const [resumo, { membros: todos, convites }, { removido, erro, aviso }] = await Promise.all([doNegocio.resumo(), doNegocio.listar(new Date()), searchParams]);
  // SPEC-013: suspensos (volta ao plano gratuito) não ocupam vaga e aparecem à parte.
  const membros = todos.filter((m) => !m.suspensoEm);
  const suspensos = todos.filter((m) => m.suspensoEm);
  const ativosColab = membros.filter((m) => m.papel !== "DONO");
  const ocupadas = ativosColab.length + convites.length;
  const noLimite = resumo?.plano === "GRATUITO" && ocupadas >= LIMITE_DO_PLANO_GRATUITO;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Equipe"
        descricao={
          resumo?.plano === "GRATUITO"
            ? `Plano gratuito: ${Math.min(ocupadas, LIMITE_DO_PLANO_GRATUITO)} de ${LIMITE_DO_PLANO_GRATUITO} vaga de colaborador ocupada.`
            : "Quem trabalha com você e o que cada pessoa pode ver e fazer."
        }
        acoes={
          !noLimite && (
            <Link href="/negocio/equipe/convidar" scroll={false} className={classeDoBotao("principal")}>
              <UserPlus aria-hidden="true" />
              Convidar pessoa
            </Link>
          )
        }
      />

      {removido && <AvisoDaPagina tom="sucesso">Pessoa removida da equipe.</AvisoDaPagina>}
      {typeof aviso === "string" && <AvisoDaPagina tom="sucesso">{aviso}</AvisoDaPagina>}
      {erro && <AvisoDaPagina tom="erro">{typeof erro === "string" && erro !== "1" ? erro : "Não foi possível concluir. Atualize a página e tente de novo."}</AvisoDaPagina>}
      {noLimite && (
        <AvisoDaPagina tom="atencao">
          No plano gratuito, o negócio pode ter 1 colaborador (membro ou convite pendente). Para convidar mais pessoas, é preciso o plano pago. Cancelar um convite pendente ou
          remover alguém libera a vaga.
        </AvisoDaPagina>
      )}

      <Superficie espaco="nenhum" aria-labelledby="titulo-membros" className="overflow-hidden">
        <h2 id="titulo-membros" className="px-5 pt-5 pb-3 text-[17px] font-bold text-card-foreground sm:px-6 sm:pt-6">
          Membros
        </h2>
        <ul className="divide-y border-t">
          {membros.map((m) => {
            const conteudo = (
              <>
                <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-extrabold", m.papel === "DONO" ? "bg-estrutura text-estrutura-foreground" : "bg-muted text-foreground")}>
                  {m.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-card-foreground">{m.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                </span>
                <Selo tom={m.papel === "DONO" ? "info" : "neutro"} semIcone>
                  {ROTULO_PAPEL[m.papel]}
                  {m.permissoesCustom ? ", personalizado" : ""}
                </Selo>
              </>
            );
            return (
              <li key={m.id}>
                {m.papel === "DONO" ? (
                  <div className="flex items-center gap-3 px-5 py-3.5 sm:px-6">{conteudo}</div>
                ) : (
                  <Link
                    href={`/negocio/equipe/${m.id}`}
                    aria-label={`Gerenciar ${m.nome}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-6"
                  >
                    {conteudo}
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Superficie>

      {suspensos.length > 0 && (
        <Superficie aria-labelledby="titulo-suspensos">
          <TituloDaSuperficie
            id="titulo-suspensos"
            titulo="Sem acesso pelo plano gratuito"
            descricao="Continuam na equipe, com o mesmo papel e as mesmas permissões, e voltam a ter acesso no plano pago. No gratuito, só 1 colaborador tem acesso."
          />
          <ul className="divide-y">
            {suspensos.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-muted-foreground">{m.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROTULO_PAPEL[m.papel]}, {m.email}
                  </p>
                </div>
                {resumo?.plano === "GRATUITO" && (
                  <form action={acaoTrocarAcesso} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="reativar" value={m.id} />
                    {ocupadas >= LIMITE_DO_PLANO_GRATUITO && ativosColab.length > 0 && (
                      <>
                        <label htmlFor={`suspender-${m.id}`} className="sr-only">
                          No lugar de
                        </label>
                        <select id={`suspender-${m.id}`} name="suspender" className={cn(classeDoCampo(), "h-9 w-auto rounded-full py-0")}>
                          {ativosColab.map((a) => (
                            <option key={a.id} value={a.id}>
                              no lugar de {a.nome}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <button type="submit" className={classeDoBotao("secundario", "sm")}>
                      Dar acesso
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Superficie>
      )}

      <Superficie aria-labelledby="titulo-convites">
        <TituloDaSuperficie id="titulo-convites" titulo="Convites pendentes" />
        {convites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
        ) : (
          <ul className="divide-y">
            {convites.map((c) => (
              <li key={c.id} className="space-y-3 py-3.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="truncate text-sm font-bold text-card-foreground">{c.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_PAPEL[c.papel]}
                    {c.permissoesCustom ? ", personalizado" : ""}, vale até {dataBrasileira(c.expiraEm)}
                  </p>
                </div>
                <AcoesDoConvite conviteId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Superficie>
    </div>
  );
}
