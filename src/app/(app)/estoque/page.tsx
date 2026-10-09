import type { Metadata } from "next";
import Link from "next/link";
import { ROTULO_CATEGORIA, rotuloUnidade } from "@/components/catalogo/rotulos";
import { quantidade, SeloDeSituacao } from "@/components/estoque/situacao";
import { classeDoCampo } from "@/components/ui/classes";
import type { CategoriaItem } from "@/generated/prisma/enums";
import { exigirPermissao } from "@/lib/auth/servidor";
import { CATEGORIAS } from "@/lib/catalogo/validacao";
import { estoque } from "@/lib/db";
import { hoje } from "@/lib/dominio/datas";
import { emAlerta } from "@/lib/dominio/estoque";

export const metadata: Metadata = { title: "Estoque" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// Lista do estoque (SPEC-007, escopo 1): Estoque — ver. Só Produtos Físicos ativos.
export default async function Estoque({ searchParams }: PageProps<"/estoque">) {
  const membro = await exigirPermissao("estoque", "ver");
  const p = await searchParams;
  const busca = texto(p.busca);
  const categoria = CATEGORIAS.find((c) => c === p.categoria) as CategoriaItem | undefined;
  const situacao = p.situacao === "baixo" || p.situacao === "sem-estoque" ? p.situacao : undefined;
  const dia = hoje();
  const c = estoque(membro);
  const [produtos, alertas] = await Promise.all([c.listar({ busca, categoria, situacao }, dia), c.contarAlertas(dia)]);
  const totalAlertas = alertas.baixo + alertas.semEstoque;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold text-foreground">Estoque</h1>

      {totalAlertas > 0 && situacao !== "baixo" && (
        <p role="status" className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          <span aria-hidden="true">▲ </span>
          {totalAlertas === 1 ? "1 produto está" : `${totalAlertas} produtos estão`} com estoque baixo ou zerado.{" "}
          <Link href="/estoque?situacao=baixo" className="font-semibold underline underline-offset-2">
            Ver quais
          </Link>
        </p>
      )}

      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <label className="sr-only" htmlFor="busca">
          Buscar por nome
        </label>
        <input id="busca" name="busca" defaultValue={busca} placeholder="Buscar produto…" className={classeDoCampo()} />
        <label className="sr-only" htmlFor="categoria">
          Categoria
        </label>
        <select id="categoria" name="categoria" defaultValue={categoria ?? ""} className={classeDoCampo()}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((cat) => (
            <option key={cat} value={cat}>
              {ROTULO_CATEGORIA[cat]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="situacao">
          Situação
        </label>
        <select id="situacao" name="situacao" defaultValue={situacao ?? ""} className={classeDoCampo()}>
          <option value="">Todos</option>
          <option value="baixo">Estoque baixo</option>
          <option value="sem-estoque">Sem estoque</option>
        </select>
        <button type="submit" className="rounded-xl border border-input px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted">
          Filtrar
        </button>
      </form>

      {produtos.length === 0 ? (
        <section className="rounded-2xl border bg-card px-6 py-12 text-center shadow-sm">
          <h2 className="mb-2 font-display text-2xl font-semibold text-card-foreground">
            {busca || categoria || situacao ? "Nenhum produto encontrado" : "Nenhum produto físico ainda"}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {busca || categoria || situacao ? (
              "Tente outra busca ou limpe os filtros."
            ) : (
              <>
                O estoque mostra os produtos físicos do{" "}
                <Link href="/catalogo" className="font-medium text-primary underline-offset-2 hover:underline">
                  Catálogo
                </Link>
                . Serviços não têm estoque: eles consomem os materiais.
              </>
            )}
          </p>
        </section>
      ) : (
        <ul className="grid gap-3" aria-label="Produtos em estoque">
          {produtos.map((pr) => (
            <li key={pr.id}>
              <Link
                href={`/estoque/${pr.id}`}
                className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary ${
                  emAlerta(pr.situacao) ? "border-status-warn/40" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">{pr.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_CATEGORIA[pr.categoria]} · mínimo{" "}
                    {pr.minimo ? `${quantidade(pr.minimo.valor)} (${pr.minimo.origem})` : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="font-semibold text-foreground">
                    {quantidade(pr.saldo)} <span className="text-xs font-normal text-muted-foreground">{rotuloUnidade(pr.unidadeMedida)}</span>
                  </span>
                  <SeloDeSituacao situacao={pr.situacao} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
