import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, Package, Plus, Search, Sparkles, Tag, Tags } from "lucide-react";
import { FiltroDeCategoria } from "@/components/catalogo/filtro-de-categoria";
import { reais, ROTULO_CATEGORIA, ROTULO_TIPO, rotuloUnidade } from "@/components/catalogo/rotulos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import type { CategoriaItem, TipoItem } from "@/generated/prisma/enums";
import { exigirPermissao } from "@/lib/auth/servidor";
import { CATEGORIAS } from "@/lib/catalogo/validacao";
import { catalogo } from "@/lib/db";
import { FILTROS_DE_NCM } from "@/lib/db/catalogo";
import { pode } from "@/lib/dominio/permissoes";
import { comRetorno } from "@/lib/estrutura/retorno";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catálogo" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** "Produto físico, acessórios › brincos, unidade" (SPEC-020, 5.4). */
const categoriaDoItem = (i: { categoria: CategoriaItem; subcategoria: { nome: string } | null }) =>
  ROTULO_CATEGORIA[i.categoria].toLowerCase() + (i.subcategoria ? ` › ${i.subcategoria.nome.toLowerCase()}` : "");

const produtos = (n: number) => `${n} ${n === 1 ? "produto" : "produtos"}`;

// Lista do catálogo (SPEC-006, escopo 1): Catálogo — ver. Filtro e busca por subcategoria (SPEC-020, 5.4).
// NCM (SPEC-021, 5.5): busca pelo começo do código, produtos sem NCM e com NCM fora da tabela vigente.
// Código interno (SPEC-024, 5.3 a 5.5): na linha do item, na busca e no link "Itens sem código".
export default async function Catalogo({ searchParams }: PageProps<"/catalogo">) {
  const membro = await exigirPermissao("catalogo", "ver");
  const p = await searchParams;
  const busca = texto(p.busca);
  const tipo = (["PRODUTO_FISICO", "SERVICO"] as TipoItem[]).find((t) => t === p.tipo);
  const categoria = CATEGORIAS.find((c) => c === p.categoria) as CategoriaItem | undefined;
  const subcategoria = categoria ? texto(p.subcategoria) || undefined : undefined;
  const arquivados = p.arquivados === "1";
  const ncm = arquivados ? undefined : FILTROS_DE_NCM.find((f) => f === p.ncm);
  const codigo = !arquivados && p.codigo === "sem" ? ("sem" as const) : undefined;
  const c = catalogo(membro);
  const [itens, subcategorias, contagens, contagensDoCodigo, emiteNota] = await Promise.all([
    c.listar({ busca, tipo, categoria, subcategoria, arquivados, ncm, codigo }),
    c.subcategorias(),
    arquivados ? null : c.contagensDoNcm(),
    arquivados ? null : c.contagensDoCodigo(),
    c.emiteNotaDeProduto(),
  ]);
  const filtrando = !!(busca || tipo || categoria || ncm || codigo);
  // SPEC-024 (5.5): o lembrete só para quem já usa códigos e tem itens sem código.
  const semCodigo = contagensDoCodigo && contagensDoCodigo.comCodigo > 0 ? contagensDoCodigo.semCodigo : 0;

  const link = (mudanca: { tipo?: TipoItem | null; semNcm?: boolean; semFiltroDeCodigo?: boolean }) => {
    const q = new URLSearchParams();
    if (busca) q.set("busca", busca);
    const t = mudanca.tipo === undefined ? tipo : mudanca.tipo;
    if (t) q.set("tipo", t);
    if (categoria) q.set("categoria", categoria);
    if (subcategoria) q.set("subcategoria", subcategoria);
    if (arquivados) q.set("arquivados", "1");
    if (ncm && !mudanca.semNcm) q.set("ncm", ncm);
    if (codigo && !mudanca.semFiltroDeCodigo) q.set("codigo", codigo);
    const texto = q.toString();
    return texto ? `/catalogo?${texto}` : "/catalogo";
  };
  // O detalhe e o cadastro voltam para esta lista, com os filtros (SPEC-020, correção da homologação T12).
  const aqui = link({});
  const retorno = aqui === "/catalogo" ? null : aqui;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={arquivados ? { href: "/catalogo", rotulo: "Catálogo" } : undefined}
        titulo={arquivados ? "Itens arquivados" : "Catálogo"}
        descricao={arquivados ? "Itens fora da lista e das escolhas. O histórico continua guardado." : "Os produtos que você vende ou usa e os serviços que executa."}
        acoes={
          !arquivados && (
            <>
              <Link href="/catalogo/subcategorias" className={classeDoBotao("secundario")}>
                <Tags aria-hidden="true" />
                Subcategorias
              </Link>
              {pode(membro.permissoes, "catalogo", "criar") && (
                <Link href={comRetorno("/catalogo/novo", retorno)} className={classeDoBotao("principal")}>
                  <Plus aria-hidden="true" />
                  Novo item
                </Link>
              )}
            </>
          )
        }
      />

      {ncm && (
        <AvisoDaPagina tom="info">
          {ncm === "sem" ? "Mostrando produtos sem NCM." : "Mostrando produtos com NCM fora da tabela vigente."}{" "}
          <Link href={link({ semNcm: true })}>Ver todos os itens</Link>
        </AvisoDaPagina>
      )}
      {codigo && (
        <AvisoDaPagina tom="info">
          Mostrando itens sem código. <Link href={link({ semFiltroDeCodigo: true })}>Ver todos os itens</Link>
        </AvisoDaPagina>
      )}
      {!ncm && contagens && contagens.foraDaTabela > 0 && (
        <AvisoDaPagina tom="atencao">
          {produtos(contagens.foraDaTabela)} {contagens.foraDaTabela === 1 ? "tem" : "têm"} NCM fora da tabela vigente.{" "}
          <Link href="/catalogo?ncm=revisar">Ver quais</Link>
        </AvisoDaPagina>
      )}
      {!ncm && emiteNota && contagens && contagens.semNcm > 0 && (
        <AvisoDaPagina tom="atencao">
          {produtos(contagens.semNcm)} sem NCM {contagens.semNcm === 1 ? "não pode ser vendido" : "não podem ser vendidos"}.{" "}
          <Link href="/catalogo?ncm=sem">Completar</Link>
        </AvisoDaPagina>
      )}

      {/* Busca e filtros numa linha própria: com a subcategoria, não cabem ao lado dos segmentos (T12). */}
      <div className="flex flex-col gap-3">
        <Segmentos
          rotulo="Tipo"
          itens={[
            { href: link({ tipo: null }), rotulo: "Todos", ativo: !tipo },
            { href: link({ tipo: "PRODUTO_FISICO" }), rotulo: "Produtos físicos", ativo: tipo === "PRODUTO_FISICO" },
            { href: link({ tipo: "SERVICO" }), rotulo: "Serviços", ativo: tipo === "SERVICO" },
          ]}
        />
        <form method="get" className="flex flex-wrap gap-2" role="search">
          {arquivados && <input type="hidden" name="arquivados" value="1" />}
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          {ncm && <input type="hidden" name="ncm" value={ncm} />}
          {codigo && <input type="hidden" name="codigo" value={codigo} />}
          <label className="sr-only" htmlFor="busca">
            Buscar por nome, código, subcategoria ou NCM
          </label>
          <div className="relative min-w-0 flex-1 basis-52">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id="busca" name="busca" type="search" defaultValue={busca} placeholder="Buscar item" className={cn(classeDoCampo(), "h-11 rounded-full py-0 pl-10")} />
          </div>
          <FiltroDeCategoria key={`${categoria ?? ""}:${subcategoria ?? ""}`} categoria={categoria} subcategoria={subcategoria} subcategorias={subcategorias} />
          <button type="submit" className={classeDoBotao("secundario")}>
            Filtrar
          </button>
        </form>
      </div>

      {itens.length === 0 ? (
        <Superficie>
          <EstadoVazio
            Icone={arquivados ? Archive : Tag}
            titulo={filtrando ? "Nenhum item encontrado" : arquivados ? "Nenhum item arquivado" : "Seu catálogo está vazio"}
            acao={
              filtrando ? (
                <Link href={arquivados ? "/catalogo?arquivados=1" : "/catalogo"} className={classeDoBotao("secundario")}>
                  Limpar filtros
                </Link>
              ) : (
                !arquivados &&
                pode(membro.permissoes, "catalogo", "criar") && (
                  <Link href="/catalogo/novo" className={classeDoBotao("principal")}>
                    <Plus aria-hidden="true" />
                    Cadastrar o primeiro item
                  </Link>
                )
              )
            }
          >
            {filtrando
              ? "Tente outra busca ou outro tipo."
              : arquivados
                ? "Itens arquivados aparecem aqui e podem ser reativados."
                : "Cadastre os produtos que você vende ou usa e os serviços que executa."}
          </EstadoVazio>
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" className="overflow-hidden">
          <ul className="divide-y" aria-label="Itens do catálogo">
            {itens.map((i) => {
              const Icone = i.tipo === "SERVICO" ? Sparkles : Package;
              return (
                <li key={i.id}>
                  <Link
                    href={comRetorno(`/catalogo/${i.id}`, retorno)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:gap-4 sm:px-5"
                  >
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-primary">
                      <Icone className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-foreground">{i.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {i.codigo && `${i.codigo} · `}
                        {ROTULO_TIPO[i.tipo]}, {categoriaDoItem(i)}, {rotuloUnidade(i.unidadeMedida).toLowerCase()}
                        {i.tipo === "SERVICO" && i.materiais > 0 && `, ${i.materiais} ${i.materiais === 1 ? "material" : "materiais"}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {i.precoAtual === null ? (
                        <Selo tom="atencao">Sem preço</Selo>
                      ) : (
                        <p className="text-[15px] font-extrabold text-foreground tabular-nums">{reais(i.precoAtual)}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">custo {reais(i.custoTotal)}</p>
                    </div>
                    <ChevronRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Superficie>
      )}

      {!arquivados && (
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/catalogo?arquivados=1" className={classeDoLink()}>
            Ver itens arquivados
          </Link>
          {/* SPEC-021 (5.5): com a nota fiscal de produtos ligada, o aviso do topo faz esse papel. */}
          {!ncm && !emiteNota && contagens && contagens.semNcm > 0 && (
            <Link href="/catalogo?ncm=sem" className={classeDoLink()}>
              Produtos sem NCM ({contagens.semNcm})
            </Link>
          )}
          {!codigo && semCodigo > 0 && (
            <Link href="/catalogo?codigo=sem" className={classeDoLink()}>
              Itens sem código ({semCodigo})
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
