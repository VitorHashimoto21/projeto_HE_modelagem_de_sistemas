import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search, Store } from "lucide-react";
import { ROTULO_REGIME } from "@/components/negocio/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { suporte, type NegocioNoPainel } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { ROTULO_PLANO } from "@/lib/dominio/planos";
import { dataHoraCurta, MENSAGENS_SUPORTE } from "@/lib/dominio/suporte";

export const metadata: Metadata = { title: "Painel do administrador" };

function SituacaoDoSuporte({ n }: { n: NegocioNoPainel }) {
  if (n.encerrado) return <Selo tom="neutro">Encerrado</Selo>;
  if (n.liberacao) return <Selo tom="atencao">Liberado até {dataHoraCurta(n.liberacao.expiraEm)}</Selo>;
  return <span className="text-muted-foreground">Sem liberação</span>;
}

// Painel do Administrador da plataforma (SPEC-018, 5.3 — RF74, INV-009): os negócios só pelos
// metadados. Nenhum dado de vendas, valores, clientes ou estoque aparece aqui: para ver um
// negócio, só com a liberação do Dono e em modo suporte.
export default async function PainelDoAdministrador({ searchParams }: PageProps<"/admin">) {
  await exigirAdministrador();
  const busca = await searchParams;
  const termo = typeof busca.busca === "string" ? busca.busca : "";
  const pagina = Math.max(1, Number.parseInt(typeof busca.pagina === "string" ? busca.pagina : "1", 10) || 1);
  const { negocios, total, paginas } = await suporte().listarNegocios(termo, pagina, new Date());
  const link = (p: number) => `/admin?${new URLSearchParams({ ...(termo ? { busca: termo } : {}), pagina: String(p) })}`;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Negócios da plataforma"
        descricao={`${total} ${total === 1 ? "negócio" : "negócios"}. Só os dados de cadastro: para ver um negócio por dentro, o Dono precisa liberar o acesso do suporte.`}
      />

      {busca.suporte === "revogado" && <AvisoDaPagina tom="atencao">{MENSAGENS_SUPORTE.revogadoPeloDono}</AvisoDaPagina>}
      {busca.suporte === "expirou" && <AvisoDaPagina tom="atencao">{MENSAGENS_SUPORTE.expirou}</AvisoDaPagina>}

      <form role="search" action="/admin" className="flex flex-wrap gap-2">
        <label htmlFor="busca" className="sr-only">
          Buscar por nome do negócio ou e-mail do Dono
        </label>
        <input id="busca" name="busca" type="search" defaultValue={termo} placeholder="Nome do negócio ou e-mail do Dono" className={`${classeDoCampo()} max-w-md flex-1`} />
        <button type="submit" className={classeDoBotao("secundario")}>
          <Search aria-hidden="true" />
          Buscar
        </button>
      </form>

      {negocios.length === 0 ? (
        <Superficie>
          <EstadoVazio Icone={Store} titulo={termo ? "Nenhum negócio encontrado" : "Nenhum negócio cadastrado"}>
            {termo ? "Confira o nome ou o e-mail e tente de novo." : "Os negócios aparecem aqui quando alguém se cadastra."}
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
                <th scope="col" className="px-6 py-3 font-medium">Acesso de suporte</th>
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
