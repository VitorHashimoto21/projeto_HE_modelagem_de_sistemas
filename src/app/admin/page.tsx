import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search, Store } from "lucide-react";
import { ROTULO_REGIME } from "@/components/negocio/rotulos";
import { NavegacaoDoPainel } from "@/components/plataforma/navegacao";
import { SeloDaEmergencia } from "@/components/suporte/selo-da-emergencia";
import { SeloDaSuspensao } from "@/components/suporte/selo-da-suspensao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { plataforma, suporte, type NegocioNoPainel } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { dataHoraCurta, MENSAGENS_SUPORTE } from "@/lib/dominio/suporte";

export const metadata: Metadata = { title: "Painel do administrador" };

function AcessoDoSuporte({ n }: { n: NegocioNoPainel }) {
  // SPEC-019 (5.6): a emergência em andamento aparece antes da liberação.
  if (n.emergencia) return <SeloDaEmergencia>Emergência até {dataHoraCurta(n.emergencia.expiraEm)}</SeloDaEmergencia>;
  if (n.liberacao) return <Selo tom="atencao">Liberado até {dataHoraCurta(n.liberacao.expiraEm)}</Selo>;
  return <span className="text-muted-foreground">Sem liberação</span>;
}

/** SPEC-019 (5.9): a situação do negócio — encerrado, suspenso (com o acesso do suporte ao lado) ou só o acesso. */
function SituacaoDoSuporte({ n }: { n: NegocioNoPainel }) {
  if (n.encerrado) return <Selo tom="neutro">Encerrado</Selo>;
  if (!n.suspensao) return <AcessoDoSuporte n={n} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <SeloDaSuspensao>Suspenso desde {dataBrasileira(n.suspensao.desde)}</SeloDaSuspensao>
      {(n.emergencia || n.liberacao) && <AcessoDoSuporte n={n} />}
    </span>
  );
}

// Painel do Administrador da plataforma (SPEC-018, 5.3 — RF74, INV-009): os negócios só pelos
// metadados. Nenhum dado de vendas, valores, clientes ou estoque aparece aqui: para ver um
// negócio, só com a liberação do Dono e em modo suporte.
export default async function PainelDoAdministrador({ searchParams }: PageProps<"/admin">) {
  const { usuarioId } = await exigirAdministrador();
  const busca = await searchParams;
  const termo = typeof busca.busca === "string" ? busca.busca : "";
  // SPEC-019 (5.9): o filtro da situação "Suspenso".
  const situacao = busca.situacao === "suspensos" ? "suspensos" : "todos";
  const pagina = Math.max(1, Number.parseInt(typeof busca.pagina === "string" ? busca.pagina : "1", 10) || 1);
  const agora = new Date();
  const [{ negocios, total, paginas }, pendentes] = await Promise.all([suporte().listarNegocios(termo, pagina, agora, situacao), plataforma().pedidosPendentes(agora)]);
  // SPEC-019 (5.9): os pedidos de outras contas aguardam uma decisão desta.
  const aguardando = pendentes.filter((p) => p.solicitadoPorId !== usuarioId).length;
  const filtros = (s: "todos" | "suspensos") => ({ ...(termo ? { busca: termo } : {}), ...(s === "suspensos" ? { situacao: s } : {}) });
  const link = (p: number) => `/admin?${new URLSearchParams({ ...filtros(situacao), pagina: String(p) })}`;
  const linkDaSituacao = (s: "todos" | "suspensos") => `/admin${Object.keys(filtros(s)).length ? `?${new URLSearchParams(filtros(s))}` : ""}`;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Negócios da plataforma"
        descricao={`${total} ${total === 1 ? "negócio" : "negócios"}${situacao === "suspensos" ? (total === 1 ? " suspenso" : " suspensos") : ""}. Só os dados de cadastro: para ver um negócio por dentro, o Dono precisa liberar o acesso do suporte.`}
      />

      <NavegacaoDoPainel atual="negocios" aguardando={aguardando} />

      {aguardando > 0 && (
        <AvisoDaPagina tom="atencao">
          {aguardando === 1 ? "1 pedido de outra conta aguarda" : `${aguardando} pedidos de outras contas aguardam`} a sua decisão.{" "}
          <Link href="/admin/pedidos">Ver os pedidos</Link>
        </AvisoDaPagina>
      )}
      {busca.suporte === "revogado" && <AvisoDaPagina tom="atencao">{MENSAGENS_SUPORTE.revogadoPeloDono}</AvisoDaPagina>}
      {busca.suporte === "expirou" && <AvisoDaPagina tom="atencao">{MENSAGENS_SUPORTE.expirou}</AvisoDaPagina>}
      {busca.suporte === "emergencia" && (
        <AvisoDaPagina tom="atencao">
          O Dono encerrou o acesso de emergência. <Link href="/admin/emergencias">Registre o resultado em Emergências</Link>.
        </AvisoDaPagina>
      )}

      <form role="search" action="/admin" className="flex flex-wrap gap-2">
        {situacao === "suspensos" && <input type="hidden" name="situacao" value="suspensos" />}
        <label htmlFor="busca" className="sr-only">
          Buscar por nome do negócio ou e-mail do Dono
        </label>
        <input id="busca" name="busca" type="search" defaultValue={termo} placeholder="Nome do negócio ou e-mail do Dono" className={`${classeDoCampo()} max-w-md flex-1`} />
        <button type="submit" className={classeDoBotao("secundario")}>
          <Search aria-hidden="true" />
          Buscar
        </button>
      </form>

      <Segmentos
        rotulo="Situação dos negócios"
        itens={[
          { href: linkDaSituacao("todos"), rotulo: "Todos", ativo: situacao === "todos" },
          { href: linkDaSituacao("suspensos"), rotulo: "Suspensos", ativo: situacao === "suspensos" },
        ]}
      />

      {negocios.length === 0 ? (
        <Superficie>
          <EstadoVazio Icone={Store} titulo={termo ? "Nenhum negócio encontrado" : situacao === "suspensos" ? "Nenhum negócio suspenso" : "Nenhum negócio cadastrado"}>
            {termo ? "Confira o nome ou o e-mail e tente de novo." : situacao === "suspensos" ? "Os negócios suspensos pela plataforma aparecem aqui." : "Os negócios aparecem aqui quando alguém se cadastra."}
          </EstadoVazio>
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" aria-label="Negócios">
          <table className="hidden w-full text-left text-sm lg:table">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-medium">Negócio</th>
                <th scope="col" className="px-3 py-3 font-medium">Plano</th>
                <th scope="col" className="px-3 py-3 font-medium">Criado em</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Membros</th>
                <th scope="col" className="px-3 py-3 font-medium">Dono</th>
                <th scope="col" className="px-6 py-3 font-medium">Situação e acesso de suporte</th>
              </tr>
            </thead>
            <tbody>
              {negocios.map((n) => (
                <tr key={n.id} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="px-6 py-3">
                    <Link href={`/admin/negocios/${n.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                      {n.nome}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{ROTULO_REGIME[n.regime]}</span>
                  </td>
                  <td className="px-3 py-3">{ROTULO_PLANO[n.plano]}</td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{dataBrasileira(n.criadoEm)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{n.membros}</td>
                  <td className="px-3 py-3">
                    {n.dono ? (
                      <>
                        {n.dono.nome}
                        <span className="block text-xs text-muted-foreground">{n.dono.email}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <SituacaoDoSuporte n={n} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y lg:hidden">
            {negocios.map((n) => (
              <li key={n.id}>
                <Link href={`/admin/negocios/${n.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold break-words text-foreground">{n.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROTULO_REGIME[n.regime]} · plano {ROTULO_PLANO[n.plano].toLowerCase()} · {n.membros} {n.membros === 1 ? "membro" : "membros"} · desde {dataBrasileira(n.criadoEm)}
                    </p>
                    {n.dono && <p className="truncate text-xs text-muted-foreground">Dono: {n.dono.nome} ({n.dono.email})</p>}
                    <div className="text-xs">
                      <SituacaoDoSuporte n={n} />
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Superficie>
      )}

      {paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
          {pagina > 1 ? (
            <Link href={link(pagina - 1)} className={classeDoBotao("secundario", "sm")}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={link(pagina + 1)} className={classeDoBotao("secundario", "sm")}>
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
