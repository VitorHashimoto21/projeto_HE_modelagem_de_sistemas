import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Package, Plus, Search } from "lucide-react";
import { FiltroDeCategoria } from "@/components/catalogo/filtro-de-categoria";
import { ROTULO_CATEGORIA, rotuloUnidade } from "@/components/catalogo/rotulos";
import { quantidade, SeloDeSituacao } from "@/components/estoque/situacao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Superficie } from "@/components/ui/superficie";
import type { CategoriaItem } from "@/generated/prisma/enums";
import { exigirPermissao } from "@/lib/auth/servidor";
import { CATEGORIAS } from "@/lib/catalogo/validacao";
import { estoque } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { emAlerta } from "@/lib/dominio/estoque";
import { comRetorno } from "@/lib/estrutura/retorno";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estoque" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// Lista do estoque (SPEC-007, escopo 1): Estoque — ver. Só Produtos Físicos ativos. Filtro e busca
// por subcategoria (SPEC-020, 5.4).
export default async function Estoque({ searchParams }: PageProps<"/estoque">) {
  const membro = await exigirPermissao("estoque", "ver");
  const p = await searchParams;
  const busca = texto(p.busca);
  const categoria = CATEGORIAS.find((c) => c === p.categoria) as CategoriaItem | undefined;
  const subcategoria = categoria ? texto(p.subcategoria) || undefined : undefined;
  const situacao = p.situacao === "baixo" || p.situacao === "sem-estoque" ? p.situacao : undefined;
  const dia = hoje();
  const c = estoque(membro);
  const [produtos, alertas, subcategorias] = await Promise.all([
    c.listar({ busca, categoria, subcategoria, situacao }, dia),
    c.contarAlertas(dia),
    c.subcategoriasDosProdutos(),
  ]);
  const totalAlertas = alertas.baixo + alertas.semEstoque;

  const filtrado = Boolean(busca || categoria || situacao);
  const link = (sit?: string) => {
    const q = new URLSearchParams();
    if (busca) q.set("busca", busca);
    if (categoria) q.set("categoria", categoria);
    if (subcategoria) q.set("subcategoria", subcategoria);
    if (sit) q.set("situacao", sit);
    const t = q.toString();
    return t ? `/estoque?${t}` : "/estoque";
  };
  // O detalhe volta para esta lista, com os filtros (SPEC-020, correção da homologação T12).
  const aqui = link(situacao);
  const retorno = aqui === "/estoque" ? null : aqui;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina titulo="Estoque" descricao="Os produtos físicos do catálogo, com o saldo e o mínimo de cada um." />

      {totalAlertas > 0 && situacao !== "baixo" && (
        <AvisoDaPagina tom="atencao">
          {totalAlertas === 1 ? "1 produto está" : `${totalAlertas} produtos estão`} com estoque baixo ou zerado. <Link href="/estoque?situacao=baixo">Ver quais</Link>
        </AvisoDaPagina>
      )}

      {/* Busca e filtros numa linha própria: com a subcategoria, não cabem ao lado dos segmentos (T12). */}
      <div className="flex flex-col gap-3">
        <Segmentos
          rotulo="Situação"
          itens={[
            { href: link(), rotulo: "Todos", ativo: !situacao },
            { href: link("baixo"), rotulo: alertas.baixo + alertas.semEstoque > 0 ? `Baixo ou zerado (${totalAlertas})` : "Baixo ou zerado", ativo: situacao === "baixo" },
            { href: link("sem-estoque"), rotulo: "Sem estoque", ativo: situacao === "sem-estoque" },
          ]}
        />
        <form method="get" className="flex flex-wrap gap-2" role="search">
          {situacao && <input type="hidden" name="situacao" value={situacao} />}
          <label className="sr-only" htmlFor="busca">
            Buscar por nome, código, subcategoria ou NCM
          </label>
          <div className="relative min-w-0 flex-1 basis-52">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id="busca" name="busca" type="search" defaultValue={busca} placeholder="Buscar produto" className={cn(classeDoCampo(), "h-11 rounded-full py-0 pl-10")} />
          </div>
          <FiltroDeCategoria key={`${categoria ?? ""}:${subcategoria ?? ""}`} categoria={categoria} subcategoria={subcategoria} subcategorias={subcategorias} />
          <button type="submit" className={classeDoBotao("secundario")}>
            Filtrar
          </button>
        </form>
      </div>

      {produtos.length === 0 ? (
        <Superficie>
          <EstadoVazio
            Icone={Package}
            titulo={filtrado ? "Nenhum produto encontrado" : "Nenhum produto físico ainda"}
            acao={
              filtrado ? (
                <Link href="/estoque" className={classeDoBotao("secundario")}>
                  Limpar filtros
                </Link>
              ) : (
                <Link href="/catalogo/novo" className={classeDoBotao("principal")}>
                  <Plus aria-hidden="true" />
                  Cadastrar produto
                </Link>
              )
            }
          >
            {filtrado ? "Tente outra busca ou outra situação." : "O estoque mostra os produtos físicos do Catálogo. Serviços não têm estoque: eles consomem os materiais."}
          </EstadoVazio>
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" className="overflow-hidden">
          <ul className="divide-y" aria-label="Produtos em estoque">
            {produtos.map((pr) => (
              <li key={pr.id}>
                <Link
                  href={comRetorno(`/estoque/${pr.id}`, retorno)}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-5",
                    emAlerta(pr.situacao) && "shadow-[inset_3px_0_0_var(--status-warn)]",
                  )}
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-[15px] font-bold text-foreground">{pr.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {pr.codigo && `${pr.codigo} · `}
                      {ROTULO_CATEGORIA[pr.categoria]}
                      {pr.subcategoria && ` › ${pr.subcategoria.nome}`}, mínimo {pr.minimo ? `${quantidade(pr.minimo.valor)} (${pr.minimo.origem})` : "não definido"}
                    </p>
                  </div>
                  <span className="text-right text-lg font-extrabold text-foreground tabular-nums">
                    {quantidade(pr.saldo)} <span className="text-xs font-medium text-muted-foreground">{rotuloUnidade(pr.unidadeMedida)}</span>
                  </span>
                  <SeloDeSituacao situacao={pr.situacao} className="w-32 justify-center" />
                  <ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Superficie>
      )}
    </div>
  );
}
