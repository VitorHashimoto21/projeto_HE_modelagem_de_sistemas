import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, ShoppingBag } from "lucide-react";
import { reais } from "@/components/financeiro/exibicao";
import { PainelDeFiltros } from "@/components/financeiro/painel-de-filtros";
import { AvisoDoHistorico } from "@/components/planos/avisos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo, type TomDoSelo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { ROTA_SEM_ACESSO } from "@/lib/auth/rotas";
import { exigirPermissao } from "@/lib/auth/servidor";
import { compras, fornecedores } from "@/lib/db";
import type { CompraDaLista } from "@/lib/db/compras";
import { CONDICOES_DE_COMPRA, podeRegistrarCompra, podeVerCompras } from "@/lib/dominio/compras";
import { hoje } from "@/lib/dominio/datas";
import {
  lerFiltrosDasCompras,
  PAGAMENTOS_DA_COMPRA,
  parametrosDosFiltrosDaCompra,
  quantidadeDeFiltrosDaCompra,
  SITUACOES_DA_COMPRA,
  type PagamentoDaCompra,
} from "@/lib/dominio/lista-de-compras";
import { inicioDoHistorico } from "@/lib/dominio/planos";
import { planoDoMembro } from "@/lib/planos/servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compras" };

const rotulo = "mb-1.5 block text-sm font-medium text-foreground";
const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const TOM_DO_PAGAMENTO: Record<PagamentoDaCompra, TomDoSelo> = { A_PAGAR: "atencao", PARCIAL: "info", PAGA: "ok" };

/** Nº do documento ou "Sem nota" (CA-14). */
const documento = (c: CompraDaLista) => (c.semNotaFiscal ? "Sem nota" : `Doc. ${c.numeroDocumento}`);

/** Condição e situação das contas, ou "Cancelada" (5.6). */
function Situacao({ c }: { c: CompraDaLista }) {
  if (c.situacao === "CANCELADA") return <Selo tom="neutro">{SITUACOES_DA_COMPRA.CANCELADA}</Selo>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">{CONDICOES_DE_COMPRA[c.condicao]}</span>
      <Selo tom={TOM_DO_PAGAMENTO[c.pagamento!]}>{PAGAMENTOS_DA_COMPRA[c.pagamento!]}</Selo>
    </span>
  );
}

// Lista de compras (SPEC-027, 5.6): Estoque — ver e Financeiro — ver (OPEN-007). Busca e filtros no
// endereço da página, o total de todas as páginas sem as canceladas e o limite do plano gratuito.
export default async function Compras({ searchParams }: PageProps<"/compras">) {
  const membro = await exigirPermissao("estoque", "ver");
  if (!podeVerCompras(membro)) redirect(ROTA_SEM_ACESSO);
  const busca = await searchParams;
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;
  const { filtros, erro } = lerFiltrosDasCompras(busca);
  // Plano gratuito: só os últimos 12 meses (SPEC-013, OPEN-005).
  const desde = inicioDoHistorico(await planoDoMembro(membro), hoje());
  const [r, opcoes] = await Promise.all([compras(membro).listar({ filtros, pagina, desde }), fornecedores(membro).opcoes()]);
  const ativos = quantidadeDeFiltrosDaCompra(filtros);
  const extras = parametrosDosFiltrosDaCompra(filtros);
  const link = (p: number) => `/compras?${new URLSearchParams({ ...extras, pagina: String(p) })}`;
  // A situação fica nos botões acima dos filtros, como nas contas; trocar mantém os outros filtros.
  const semSituacao = parametrosDosFiltrosDaCompra({ ...filtros, situacao: null });
  const linkDaSituacao = (s: string | null) => `/compras${s || Object.keys(semSituacao).length ? `?${new URLSearchParams({ ...semSituacao, ...(s ? { situacao: s } : {}) })}` : ""}`;
  const limpar = filtros.situacao ? `/compras?situacao=${filtros.situacao}` : "/compras";
  const podeRegistrar = podeRegistrarCompra(membro);
  const registrar = podeRegistrar && (
    <Link href="/compras/nova" className={classeDoBotao("principal")}>
      <ShoppingBag aria-hidden="true" />
      Registrar compra
    </Link>
  );

  return (
    <div className="space-y-6">
      <CabecalhoDePagina titulo="Compras" descricao="As compras de fornecedores, com as entradas no estoque e as contas a pagar." acoes={registrar} />

      {r.ocultasPeloPlano > 0 && <AvisoDoHistorico ehDono={membro.papel === "DONO"} />}

      <Segmentos
        rotulo="Situação"
        itens={[
          { href: linkDaSituacao(null), rotulo: "Todas", ativo: !filtros.situacao },
          { href: linkDaSituacao("REGISTRADA"), rotulo: "Registradas", ativo: filtros.situacao === "REGISTRADA" },
          { href: linkDaSituacao("CANCELADA"), rotulo: "Canceladas", ativo: filtros.situacao === "CANCELADA" },
        ]}
      />

      <PainelDeFiltros ativos={ativos}>
        <Superficie espaco="compacto" aria-label="Filtros das compras">
          <form method="get" role="search" className="space-y-4">
            {filtros.situacao && <input type="hidden" name="situacao" value={filtros.situacao} />}
            {/* Três pares de colunas no computador, para a busca, o fornecedor e as datas caberem inteiros. */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label htmlFor="filtro-busca" className={rotulo}>
                  Buscar
                </label>
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="filtro-busca"
                    name="busca"
                    type="search"
                    defaultValue={filtros.busca ?? ""}
                    maxLength={100}
                    placeholder={membro.modoSuporte ? "Nº da compra ou do documento" : "Fornecedor, compra ou documento"}
                    className={cn(classeDoCampo(), "pl-10")}
                  />
                </div>
              </div>
              <div className="xl:col-span-2">
                <label htmlFor="filtro-fornecedor" className={rotulo}>
                  Fornecedor
                </label>
                <select id="filtro-fornecedor" name="fornecedor" defaultValue={filtros.fornecedorId ?? ""} className={classeDoCampo()}>
                  <option value="">Todos</option>
                  {opcoes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="min-w-0 xl:col-span-2">
                <legend className={rotulo}>Data da compra</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Data da compra de" name="de" type="date" defaultValue={filtros.de ?? ""} min={desde ?? undefined} aria-invalid={erro ? true : undefined} className={classeDoCampo(erro ?? undefined)} />
                  <input aria-label="Data da compra até" name="ate" type="date" defaultValue={filtros.ate ?? ""} min={desde ?? undefined} aria-invalid={erro ? true : undefined} className={classeDoCampo(erro ?? undefined)} />
                </div>
                {erro && <p className="mt-1 text-xs font-medium text-status-danger">{erro}</p>}
              </fieldset>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={classeDoBotao("principal")}>
                Filtrar
              </button>
              {ativos > 0 && (
                <Link href={limpar} className={classeDoBotao("fantasma")}>
                  Limpar filtros
                </Link>
              )}
            </div>
          </form>
        </Superficie>
      </PainelDeFiltros>

      {/* 5.6: o total de todas as páginas, com os mesmos filtros e o limite do plano, sem as canceladas. */}
      <Superficie espaco="compacto" aria-labelledby="titulo-totais">
        <h2 id="titulo-totais" className="sr-only">
          Totais da lista
        </h2>
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="text-xs text-muted-foreground">{r.quantidade === 1 ? "Compra" : "Compras"}</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{r.quantidade}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total comprado</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{reais(r.totalCentavos)}</dd>
          </div>
        </dl>
        {r.canceladas > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {r.canceladas} {r.canceladas === 1 ? "compra cancelada fica" : "compras canceladas ficam"} na lista, fora dos totais.
          </p>
        )}
      </Superficie>

      {r.compras.length === 0 ? (
        <Superficie>
          {ativos > 0 ? (
            <EstadoVazio
              Icone={ShoppingBag}
              titulo="Nenhuma compra com estes filtros."
              acao={
                <Link href={limpar} className={classeDoLink()}>
                  Limpar filtros
                </Link>
              }
            />
          ) : filtros.situacao ? (
            <EstadoVazio Icone={ShoppingBag} titulo={filtros.situacao === "CANCELADA" ? "Nenhuma compra cancelada" : "Nenhuma compra registrada"}>
              Escolha outra situação acima.
            </EstadoVazio>
          ) : (
            <EstadoVazio Icone={ShoppingBag} titulo="Nenhuma compra registrada" acao={registrar}>
              Cada compra registrada leva os produtos ao estoque e cria as contas a pagar.
            </EstadoVazio>
          )}
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" aria-label="Lista de compras" className="overflow-hidden">
          {/* Computador: tabela; celular: lista. As mesmas informações nos dois. */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-medium">Compra</th>
                <th scope="col" className="px-3 py-3 font-medium">Data</th>
                <th scope="col" className="px-3 py-3 font-medium">Fornecedor</th>
                <th scope="col" className="px-3 py-3 font-medium">Pagamento</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {r.compras.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="px-6 py-3">
                    <span className="font-semibold text-foreground">Compra nº {c.numero}</span>
                    <span className="block text-xs text-muted-foreground">{documento(c)}</span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{dataBr(c.data)}</td>
                  <td className="px-3 py-3 break-words">{c.fornecedor}</td>
                  <td className="px-3 py-3">
                    <Situacao c={c} />
                  </td>
                  <td className={cn("px-6 py-3 text-right font-bold tabular-nums", c.situacao === "CANCELADA" && "text-muted-foreground line-through")}>{reais(c.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y md:hidden">
            {r.compras.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Compra nº {c.numero}</p>
                  <p className="text-xs break-words text-muted-foreground">
                    {dataBr(c.data)}, {c.fornecedor}
                  </p>
                  <p className="text-xs text-muted-foreground">{documento(c)}</p>
                  <div className="mt-1.5 text-xs">
                    <Situacao c={c} />
                  </div>
                </div>
                <p className={cn("font-bold tabular-nums", c.situacao === "CANCELADA" && "text-muted-foreground line-through")}>{reais(c.totalCentavos)}</p>
              </li>
            ))}
          </ul>
        </Superficie>
      )}

      {r.paginas > 1 && (
        <nav aria-label="Páginas das compras" className="flex items-center justify-between gap-2 text-sm">
          {r.pagina > 1 ? (
            <Link href={link(r.pagina - 1)} className={classeDoBotao("fantasma", "sm")}>
              <ChevronLeft aria-hidden="true" />
              Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {r.pagina} de {r.paginas}
          </span>
          {r.pagina < r.paginas ? (
            <Link href={link(r.pagina + 1)} className={classeDoBotao("fantasma", "sm")}>
              Próximas
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
