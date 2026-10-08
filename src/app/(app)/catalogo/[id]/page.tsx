import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioPreco } from "@/components/catalogo/formularios";
import { numero, reais, ROTULO_CATEGORIA, ROTULO_ORIGEM, ROTULO_TIPO, rotuloUnidade } from "@/components/catalogo/rotulos";
import { exigirPermissao } from "@/lib/auth/servidor";
import { acaoArquivarItem } from "@/lib/catalogo/acoes";
import { MENSAGENS_DO_ARQUIVAMENTO } from "@/lib/catalogo/servicos";
import { catalogo } from "@/lib/db";
import { ItemNaoEncontrado } from "@/lib/db/catalogo";
import { pode } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Item do catálogo" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium break-words text-foreground sm:text-right">{valor}</dd>
    </div>
  );
}

function Mensagem({ tipo, children }: { tipo: "ok" | "erro" | "aviso"; children: React.ReactNode }) {
  const cores = {
    ok: "border-status-ok/30 bg-status-ok-bg text-status-ok",
    erro: "border-destructive/30 bg-status-danger-bg text-status-danger",
    aviso: "border-status-warn/30 bg-status-warn-bg text-status-warn",
  };
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cores[tipo]}`}>
      {children}
    </p>
  );
}

// Detalhe do item (SPEC-006, 5.3–5.5): Catálogo — ver; preço com "editar"; arquivar com "excluir".
export default async function DetalheDoItem({ params, searchParams }: PageProps<"/catalogo/[id]">) {
  const membro = await exigirPermissao("catalogo", "ver");
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const item = await catalogo(membro).detalhar(id).catch((e) => {
    if (e instanceof ItemNaoEncontrado) notFound();
    throw e;
  });
  const podeEditar = pode(membro.permissoes, "catalogo", "editar");
  const podeArquivar = pode(membro.permissoes, "catalogo", "excluir");
  const resultado = typeof busca.resultado === "string" ? MENSAGENS_DO_ARQUIVAMENTO[busca.resultado] : undefined;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href={item.arquivado ? "/catalogo?arquivados=1" : "/catalogo"} className="font-medium text-primary underline-offset-2 hover:underline">
            ← Catálogo
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {ROTULO_TIPO[item.tipo]}
              {item.arquivado && " · arquivado"}
            </p>
            <h1 className="font-display text-3xl font-semibold break-words text-foreground">{item.nome}</h1>
          </div>
          {podeEditar && !item.arquivado && (
            <Link href={`/catalogo/${item.id}/editar`} className="rounded-xl border border-input px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
              Editar item
            </Link>
          )}
        </div>
      </div>

      {busca.criado && <Mensagem tipo="ok">Item cadastrado.</Mensagem>}
      {busca.salvo && <Mensagem tipo="ok">Alterações salvas.</Mensagem>}
      {resultado && <Mensagem tipo={resultado.tipo}>{resultado.texto}</Mensagem>}
      {item.arquivado && item.usadoEm.length > 0 && (
        <Mensagem tipo="aviso">
          Este produto arquivado continua como material de: {item.usadoEm.map((s) => s.nome).join(", ")}. Revise esses serviços se ele saiu de linha.
        </Mensagem>
      )}

      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-preco">
        <h2 id="titulo-preco" className="mb-1 font-display text-xl font-semibold text-card-foreground">
          Preço oficial
        </h2>
        <p className="mb-4 text-3xl font-semibold text-foreground">
          {item.precoAtual === null ? <span className="text-base font-medium text-status-warn">Sem preço — ainda não pode ser vendido</span> : reais(item.precoAtual)}
        </p>
        {podeEditar && !item.arquivado && <FormularioPreco itemId={item.id} />}
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-dados">
        <h2 id="titulo-dados" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          Dados do item
        </h2>
        <dl>
          <Linha rotulo="Categoria" valor={ROTULO_CATEGORIA[item.categoria]} />
          <Linha rotulo="Unidade de medida" valor={rotuloUnidade(item.unidadeMedida)} />
          <Linha rotulo={item.tipo === "SERVICO" ? "Custo próprio" : "Custo"} valor={reais(item.custoBase)} />
          {item.tipo === "SERVICO" && item.materiaisDoServico.length > 0 && <Linha rotulo="Custo total (com materiais)" valor={reais(item.custoTotal)} />}
          <Linha rotulo="Comissão" valor={`${numero(item.comissaoPercentual ?? 0)}%`} />
          {item.tipo === "PRODUTO_FISICO" && (
            <>
              <Linha rotulo="Em estoque" valor={`${numero(item.quantidadeEstoque)} ${rotuloUnidade(item.unidadeMedida)}`} />
              <Linha rotulo="Estoque mínimo" valor={item.estoqueMinimo === null ? "Ainda não definido" : numero(item.estoqueMinimo)} />
            </>
          )}
        </dl>
      </section>

      {item.tipo === "SERVICO" && (
        <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-materiais">
          <h2 id="titulo-materiais" className="mb-2 font-display text-xl font-semibold text-card-foreground">
            Materiais por execução
          </h2>
          {item.materiaisDoServico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este serviço não usa materiais.</p>
          ) : (
            <ul className="divide-y">
              {item.materiaisDoServico.map((m) => (
                <li key={m.materialId} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                  <Link href={`/catalogo/${m.materialId}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                    {m.nome}
                    {m.arquivado && <span className="ml-2 text-xs text-status-warn">arquivado</span>}
                  </Link>
                  <span className="text-muted-foreground">
                    {numero(m.quantidade)} {rotuloUnidade(m.unidadeMedida)} × {reais(m.custo)} = {reais(Math.round(m.quantidade * m.custo * 100) / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="titulo-historico">
        <h2 id="titulo-historico" className="mb-2 font-display text-xl font-semibold text-card-foreground">
          Histórico de preços
        </h2>
        {item.historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum preço definido ainda.</p>
        ) : (
          <ol className="divide-y">
            {item.historico.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-semibold text-foreground">{reais(h.preco)}</span>
                  {h.anterior !== null && <span className="ml-2 text-muted-foreground">antes {reais(h.anterior)}</span>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {ROTULO_ORIGEM[h.origem]} · {h.usuario} · {quando.format(h.data)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {podeArquivar && (
        <form action={acaoArquivarItem} className="text-sm">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="arquivar" value={item.arquivado ? "0" : "1"} />
          <button type="submit" className="font-medium text-destructive underline-offset-2 hover:underline">
            {item.arquivado ? "Reativar item" : "Arquivar item"}
          </button>
          <span className="ml-2 text-muted-foreground">
            {item.arquivado ? "Volta para o catálogo e para as escolhas." : "Sai da lista e das escolhas; o histórico é mantido."}
          </span>
        </form>
      )}
    </div>
  );
}
