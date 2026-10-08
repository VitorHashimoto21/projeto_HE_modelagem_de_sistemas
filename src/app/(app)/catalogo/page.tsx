import type { Metadata } from "next";
import Link from "next/link";
import { reais, ROTULO_CATEGORIA, ROTULO_TIPO, rotuloUnidade } from "@/components/catalogo/rotulos";
import { classeDoCampo } from "@/components/ui/classes";
import type { CategoriaItem, TipoItem } from "@/generated/prisma/enums";
import { exigirPermissao } from "@/lib/auth/servidor";
import { CATEGORIAS } from "@/lib/catalogo/validacao";
import { catalogo } from "@/lib/db";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Catálogo" };

const botaoPrincipal =
  "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover";

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// Lista do catálogo (SPEC-006, escopo 1): Catálogo — ver.
export default async function Catalogo({ searchParams }: PageProps<"/catalogo">) {
  const membro = await exigirPermissao("catalogo", "ver");
  const p = await searchParams;
  const busca = texto(p.busca);
  const tipo = (["PRODUTO_FISICO", "SERVICO"] as TipoItem[]).find((t) => t === p.tipo);
  const categoria = CATEGORIAS.find((c) => c === p.categoria) as CategoriaItem | undefined;
  const arquivados = p.arquivados === "1";
  const itens = await catalogo(membro).listar({ busca, tipo, categoria, arquivados });
  const filtrando = !!(busca || tipo || categoria);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">{arquivados ? "Itens arquivados" : "Catálogo"}</h1>
        {pode(membro.permissoes, "catalogo", "criar") && !arquivados && (
          <Link href="/catalogo/novo" className={botaoPrincipal}>
            Novo item
          </Link>
        )}
      </div>

      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        {arquivados && <input type="hidden" name="arquivados" value="1" />}
        <label className="sr-only" htmlFor="busca">
          Buscar por nome
        </label>
        <input id="busca" name="busca" defaultValue={busca} placeholder="Buscar por nome…" className={classeDoCampo()} />
        <label className="sr-only" htmlFor="tipo">
          Tipo
        </label>
        <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className={classeDoCampo()}>
          <option value="">Todos os tipos</option>
          <option value="PRODUTO_FISICO">Produtos físicos</option>
          <option value="SERVICO">Serviços</option>
        </select>
        <label className="sr-only" htmlFor="categoria">
          Categoria
        </label>
        <select id="categoria" name="categoria" defaultValue={categoria ?? ""} className={classeDoCampo()}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl border border-input px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted">
          Filtrar
        </button>
      </form>

      {itens.length === 0 ? (
        <section className="rounded-2xl border bg-card px-6 py-12 text-center shadow-sm">
          <h2 className="mb-2 font-display text-2xl font-semibold text-card-foreground">
            {filtrando ? "Nenhum item encontrado" : arquivados ? "Nenhum item arquivado" : "Seu catálogo está vazio"}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {filtrando
              ? "Tente outra busca ou limpe os filtros."
              : arquivados
                ? "Itens arquivados aparecem aqui e podem ser reativados."
                : "Cadastre os produtos que você vende ou usa e os serviços que executa."}
          </p>
        </section>
      ) : (
        <ul className="grid gap-3" aria-label="Itens do catálogo">
          {itens.map((i) => (
            <li key={i.id}>
              <Link
                href={`/catalogo/${i.id}`}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">{i.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_TIPO[i.tipo]} · {ROTULO_CATEGORIA[i.categoria]} · {rotuloUnidade(i.unidadeMedida)}
                    {i.tipo === "SERVICO" && i.materiais > 0 && ` · ${i.materiais} ${i.materiais === 1 ? "material" : "materiais"}`}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {i.precoAtual === null ? (
                    <span className="rounded-full bg-status-warn-bg px-2.5 py-1 text-xs font-medium text-status-warn">Sem preço</span>
                  ) : (
                    <span className="font-semibold text-foreground">{reais(i.precoAtual)}</span>
                  )}
                  <p className="text-xs text-muted-foreground">custo {reais(i.custoTotal)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm">
        <Link
          href={arquivados ? "/catalogo" : "/catalogo?arquivados=1"}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {arquivados ? "← Voltar ao catálogo" : "Ver itens arquivados"}
        </Link>
      </p>
    </div>
  );
}
