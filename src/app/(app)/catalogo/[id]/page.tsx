import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Calculator, Pencil } from "lucide-react";
import { FormularioPreco } from "@/components/catalogo/formularios";
import { numero, reais, ROTULO_CATEGORIA, ROTULO_ORIGEM, ROTULO_TIPO, rotuloUnidade } from "@/components/catalogo/rotulos";
import { SeloDeSituacao } from "@/components/estoque/situacao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Selo } from "@/components/ui/selo";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { acaoArquivarItem } from "@/lib/catalogo/acoes";
import { MENSAGENS_DO_ARQUIVAMENTO } from "@/lib/catalogo/servicos";
import { catalogo, estoque } from "@/lib/db";
import { ItemNaoEncontrado } from "@/lib/db/catalogo";
import { hoje } from "@/lib/dominio/datas";
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

const TOM_DA_MENSAGEM = { ok: "sucesso", erro: "erro", aviso: "atencao" } as const;

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
  // Situação do estoque (SPEC-007, RF21) para quem também pode ver o Estoque.
  const verEstoque = pode(membro.permissoes, "estoque", "ver");
  const situacao = item.tipo === "PRODUTO_FISICO" && verEstoque ? await estoque(membro).situacaoDoProduto(item.id, hoje()) : null;

  const voltar = item.arquivado ? "/catalogo?arquivados=1" : "/catalogo";

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        voltar={{ href: voltar, rotulo: item.arquivado ? "Itens arquivados" : "Catálogo" }}
        titulo={
          <span className="inline-flex flex-wrap items-center gap-3 break-words">
            {item.nome}
            {item.arquivado && <Selo tom="neutro">Arquivado</Selo>}
          </span>
        }
        descricao={`${ROTULO_TIPO[item.tipo]}, ${ROTULO_CATEGORIA[item.categoria].toLowerCase()}`}
        acoes={
          podeEditar &&
          !item.arquivado && (
            <Link href={`/catalogo/${item.id}/editar`} className={classeDoBotao("secundario", "sm")}>
              <Pencil aria-hidden="true" />
              Editar item
            </Link>
          )
        }
      />

      {busca.criado && <AvisoDaPagina tom="sucesso">Item cadastrado.</AvisoDaPagina>}
      {busca.salvo && <AvisoDaPagina tom="sucesso">Alterações salvas.</AvisoDaPagina>}
      {resultado && <AvisoDaPagina tom={TOM_DA_MENSAGEM[resultado.tipo]}>{resultado.texto}</AvisoDaPagina>}
      {item.arquivado && item.usadoEm.length > 0 && (
        <AvisoDaPagina tom="atencao">
          Este produto arquivado continua como material de: {item.usadoEm.map((s) => s.nome).join(", ")}. Revise esses serviços se ele saiu de linha.
        </AvisoDaPagina>
      )}

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
        <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-6 lg:w-96" aria-label="Preço">
          <Superficie tom="estrutura" aria-labelledby="titulo-preco">
            <h2 id="titulo-preco" className="text-sm text-estrutura-suave">
              Preço oficial
            </h2>
            {item.precoAtual === null ? (
              <p className="mt-2 text-lg font-bold">Sem preço: ainda não pode ser vendido</p>
            ) : (
              <p className="mt-1 text-[40px] leading-none font-extrabold tracking-tight tabular-nums">{reais(item.precoAtual)}</p>
            )}
            <p className="mt-2 text-sm text-estrutura-suave tabular-nums">
              Custo {item.tipo === "SERVICO" && item.materiaisDoServico.length > 0 ? "com materiais " : ""}
              {reais(item.custoTotal)}
            </p>
            {/* Atalho da Calculadora (SPEC-010, OPEN-001) para quem tem Calculadora — ver. */}
            {!item.arquivado && pode(membro.permissoes, "calculadora", "ver") && (
              <Link href={`/calculadora?item=${item.id}`} className={classeDoBotao("na-estrutura", "md", "mt-5 w-full")}>
                <Calculator aria-hidden="true" />
                Calcular preço
              </Link>
            )}
          </Superficie>
          {podeEditar && !item.arquivado && (
            <Superficie aria-labelledby="titulo-novo-preco">
              <TituloDaSuperficie id="titulo-novo-preco" titulo="Definir o preço" />
              <FormularioPreco itemId={item.id} />
            </Superficie>
          )}
          {podeArquivar && (
            <form action={acaoArquivarItem} className="px-1 text-sm">
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="arquivar" value={item.arquivado ? "0" : "1"} />
              <button type="submit" className={classeDoBotao("fantasma", "sm", item.arquivado ? "-ml-4" : "-ml-4 text-status-danger hover:bg-status-danger-bg")}>
                {item.arquivado ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                {item.arquivado ? "Reativar item" : "Arquivar item"}
              </button>
              <p className="mt-1 text-muted-foreground">
                {item.arquivado ? "Volta para o catálogo e para as escolhas." : "Sai da lista e das escolhas; o histórico é mantido."}
              </p>
            </form>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Superficie aria-labelledby="titulo-dados">
            <TituloDaSuperficie id="titulo-dados" titulo="Dados do item" />
            <dl>
              <Linha rotulo="Categoria" valor={ROTULO_CATEGORIA[item.categoria]} />
              <Linha rotulo="Unidade de medida" valor={rotuloUnidade(item.unidadeMedida)} />
              <Linha rotulo={item.tipo === "SERVICO" ? "Custo próprio" : "Custo"} valor={reais(item.custoBase)} />
              {item.tipo === "SERVICO" && item.materiaisDoServico.length > 0 && <Linha rotulo="Custo total (com materiais)" valor={reais(item.custoTotal)} />}
              <Linha rotulo="Comissão" valor={`${numero(item.comissaoPercentual ?? 0)}%`} />
              {item.tipo === "PRODUTO_FISICO" && (
                <>
                  <Linha rotulo="Em estoque" valor={`${numero(item.quantidadeEstoque)} ${rotuloUnidade(item.unidadeMedida)}`} />
                  <Linha
                    rotulo="Estoque mínimo"
                    valor={
                      situacao?.minimo
                        ? `${numero(situacao.minimo.valor)} (${situacao.minimo.origem})`
                        : item.estoqueMinimo === null
                          ? "Ainda não definido"
                          : numero(item.estoqueMinimo)
                    }
                  />
                  {situacao && (
                    <Linha
                      rotulo="Situação do estoque"
                      valor={
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <SeloDeSituacao situacao={situacao.situacao} />
                          <Link href={`/estoque/${item.id}`} className={classeDoLink()}>
                            Ver estoque
                          </Link>
                        </span>
                      }
                    />
                  )}
                </>
              )}
            </dl>
          </Superficie>

          {item.tipo === "SERVICO" && (
            <Superficie aria-labelledby="titulo-materiais">
              <TituloDaSuperficie id="titulo-materiais" titulo="Materiais por execução" />
              {item.materiaisDoServico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este serviço não usa materiais.</p>
              ) : (
                <ul className="divide-y">
                  {item.materiaisDoServico.map((m) => (
                    <li key={m.materialId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/catalogo/${m.materialId}`} className={classeDoLink("text-foreground")}>
                          {m.nome}
                        </Link>
                        {m.arquivado && (
                          <Selo tom="atencao" semIcone>
                            arquivado
                          </Selo>
                        )}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {numero(m.quantidade)} {rotuloUnidade(m.unidadeMedida).toLowerCase()} × {reais(m.custo)} ={" "}
                        <span className="font-semibold text-foreground">{reais(Math.round(m.quantidade * m.custo * 100) / 100)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Superficie>
          )}

          <Superficie aria-labelledby="titulo-historico">
            <TituloDaSuperficie id="titulo-historico" titulo="Histórico de preços" />
            {item.historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum preço definido ainda.</p>
            ) : (
              <ol className="divide-y">
                {item.historico.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                    <div className="tabular-nums">
                      <span className="font-bold text-foreground">{reais(h.preco)}</span>
                      {h.anterior !== null && <span className="ml-2 text-muted-foreground">antes {reais(h.anterior)}</span>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {ROTULO_ORIGEM[h.origem]}, {h.usuario}, {quando.format(h.data)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Superficie>
        </div>
      </div>
    </div>
  );
}
