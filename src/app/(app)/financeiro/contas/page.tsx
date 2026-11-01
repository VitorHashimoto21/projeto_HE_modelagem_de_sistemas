import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Receipt, Search } from "lucide-react";
import { CabecalhoDoFinanceiro, reais, ROTULO_CATEGORIA, SeloDaConta } from "@/components/financeiro/exibicao";
import { PainelDeFiltros } from "@/components/financeiro/painel-de-filtros";
import { AvisoDoHistorico } from "@/components/planos/avisos";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { classeDoCampo } from "@/components/ui/classes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Segmentos } from "@/components/ui/segmentos";
import { Superficie } from "@/components/ui/superficie";
import { exigirPermissao } from "@/lib/auth/servidor";
import { financeiro, fornecedores } from "@/lib/db";
import type { SituacaoFiltrada } from "@/lib/db/financeiro";
import { FILTRO_SEM_FORMA, FORMA_NAO_INFORMADA, FORMAS_DO_PAGAMENTO, lerFiltrosDasContas, ORIGENS_DA_CONTA, parametrosDosFiltros, quantidadeDeFiltros, ROTULO_FORMA, ROTULO_ORIGEM } from "@/lib/dominio/contas";
import { hoje } from "@/lib/dominio/datas";
import { CATEGORIAS } from "@/lib/dominio/financeiro";
import { pode } from "@/lib/dominio/permissoes";
import { inicioDoHistorico } from "@/lib/dominio/planos";
import { planoDoMembro } from "@/lib/planos/servidor";
import { conferirFinanceiro } from "@/lib/financeiro/conferencia";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contas a pagar e a receber" };

const SITUACOES: [SituacaoFiltrada, string][] = [
  ["abertas", "Em aberto"],
  ["atrasadas", "Atrasadas"],
  ["quitadas", "Quitadas"],
  ["canceladas", "Canceladas"],
  ["todas", "Todas"],
];

const ORIGEM = { venda: "Venda no cartão", despesa: "Despesa fixa", manual: "Manual" } as const;
const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

function Total({ rotulo: r, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{r}</dt>
      <dd className={cn("mt-0.5 text-lg font-extrabold tabular-nums", destaque ? "text-foreground" : "text-foreground/90")}>{valor}</dd>
    </div>
  );
}

// Contas a pagar e a receber (SPEC-009, 5.3): Financeiro — ver; nova conta com "criar". SPEC-026 (5.6):
// busca, filtros e os totais da lista filtrada, todos no endereço da página.
export default async function Contas({ searchParams }: PageProps<"/financeiro/contas">) {
  const membro = await exigirPermissao("financeiro", "ver");
  const busca = await searchParams;
  const tipo = busca.tipo === "RECEBER" ? "RECEBER" : "PAGAR";
  const situacao = SITUACOES.some(([s]) => s === busca.situacao) ? (busca.situacao as SituacaoFiltrada) : "abertas";
  const pagina = Number(typeof busca.pagina === "string" ? busca.pagina : "1") || 1;
  const { filtros, erros } = lerFiltrosDasContas(busca);
  const dia = hoje();
  const receber = tipo === "RECEBER";

  await conferirFinanceiro(membro);
  // Plano gratuito: quitadas e canceladas só dos últimos 12 meses (SPEC-013, OPEN-005).
  const desde = inicioDoHistorico(await planoDoMembro(membro), dia);
  const [r, pessoas] = await Promise.all([
    financeiro(membro).listarContas({ tipo, situacao, pagina, desde, filtros }, dia),
    receber ? financeiro(membro).opcoesDeClientes() : fornecedores(membro).opcoes(),
  ]);
  const ativos = quantidadeDeFiltros(filtros);
  const extras = parametrosDosFiltros(filtros);
  const link = (mudar: Record<string, string | number | null>) => {
    const p = new URLSearchParams({ tipo, situacao, ...extras });
    for (const [k, v] of Object.entries(mudar)) {
      if (v === null) p.delete(k);
      else p.set(k, String(v));
    }
    return `/financeiro/contas?${p}`;
  };
  // Trocar entre a pagar e a receber tira o fornecedor ou o cliente escolhido (são listas diferentes).
  const linkDoTipo = (t: "PAGAR" | "RECEBER") => link({ tipo: t, pessoa: null, pagina: null });
  const limpar = `/financeiro/contas?tipo=${tipo}&situacao=${situacao}`;
  const pessoaFiltrada = filtros.pessoaId ? pessoas.find((p) => p.id === filtros.pessoaId) : null;

  return (
    <div className="space-y-6">
      <CabecalhoDoFinanceiro
        atual="contas"
        titulo="Contas"
        acoes={
          pode(membro.permissoes, "financeiro", "criar") && (
            <Link href={`/financeiro/contas/nova?tipo=${tipo}`} scroll={false} className={classeDoBotao("principal")}>
              <Plus aria-hidden="true" />
              Nova conta
            </Link>
          )
        }
      />

      {r.ocultasPeloPlano > 0 && <AvisoDoHistorico ehDono={membro.papel === "DONO"} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmentos rotulo="Tipo de conta" itens={(["PAGAR", "RECEBER"] as const).map((t) => ({ href: linkDoTipo(t), rotulo: t === "PAGAR" ? "A pagar" : "A receber", ativo: t === tipo }))} />
        <Segmentos
          rotulo="Situação"
          itens={SITUACOES.map(([s, rotuloDaSituacao]) => ({
            href: link({ situacao: s, pagina: null }),
            rotulo: s === "atrasadas" && r.atrasadas > 0 ? `${rotuloDaSituacao} (${r.atrasadas})` : rotuloDaSituacao,
            ativo: s === situacao,
          }))}
        />
      </div>

      <PainelDeFiltros ativos={ativos}>
        <Superficie espaco="compacto" aria-label="Filtros das contas">
          <form method="get" role="search" className="space-y-4">
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="situacao" value={situacao} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2">
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
                    placeholder="Descrição ou nº do documento"
                    className={cn(classeDoCampo(), "pl-10")}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="filtro-pessoa" className={rotulo}>
                  {receber ? "Cliente" : "Fornecedor"}
                </label>
                <select id="filtro-pessoa" name="pessoa" defaultValue={filtros.pessoaId ?? ""} className={classeDoCampo()}>
                  <option value="">Todos</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filtro-forma" className={rotulo}>
                  Forma do {receber ? "recebimento" : "pagamento"}
                </label>
                <select id="filtro-forma" name="forma" defaultValue={filtros.forma ?? ""} className={classeDoCampo()}>
                  <option value="">Todas</option>
                  {FORMAS_DO_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_FORMA[f]}
                    </option>
                  ))}
                  <option value={FILTRO_SEM_FORMA}>{FORMA_NAO_INFORMADA}</option>
                </select>
              </div>
              <fieldset className="min-w-0">
                <legend className={rotulo}>Vencimento</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Vencimento de" name="vencimentoDe" type="date" defaultValue={filtros.vencimentoDe ?? ""} aria-invalid={erros.vencimento ? true : undefined} className={classeDoCampo(erros.vencimento)} />
                  <input aria-label="Vencimento até" name="vencimentoAte" type="date" defaultValue={filtros.vencimentoAte ?? ""} aria-invalid={erros.vencimento ? true : undefined} className={classeDoCampo(erros.vencimento)} />
                </div>
                {erros.vencimento && <p className="mt-1 text-xs font-medium text-status-danger">{erros.vencimento}</p>}
              </fieldset>
              <fieldset className="min-w-0">
                <legend className={rotulo}>Data do {receber ? "recebimento" : "pagamento"}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label={`${receber ? "Recebimento" : "Pagamento"} de`} name="pagamentoDe" type="date" defaultValue={filtros.pagamentoDe ?? ""} aria-invalid={erros.pagamento ? true : undefined} className={classeDoCampo(erros.pagamento)} />
                  <input aria-label={`${receber ? "Recebimento" : "Pagamento"} até`} name="pagamentoAte" type="date" defaultValue={filtros.pagamentoAte ?? ""} aria-invalid={erros.pagamento ? true : undefined} className={classeDoCampo(erros.pagamento)} />
                </div>
                {erros.pagamento && <p className="mt-1 text-xs font-medium text-status-danger">{erros.pagamento}</p>}
              </fieldset>
              <div>
                <label htmlFor="filtro-categoria" className={rotulo}>
                  Categoria
                </label>
                <select id="filtro-categoria" name="categoria" defaultValue={filtros.categoria ?? ""} className={classeDoCampo()}>
                  <option value="">Todas</option>
                  {Object.entries(CATEGORIAS).map(([v, rotuloDaCategoria]) => (
                    <option key={v} value={v}>
                      {rotuloDaCategoria}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filtro-origem" className={rotulo}>
                  Origem
                </label>
                <select id="filtro-origem" name="origem" defaultValue={filtros.origem ?? ""} className={classeDoCampo()}>
                  <option value="">Todas</option>
                  {ORIGENS_DA_CONTA.map((o) => (
                    <option key={o} value={o}>
                      {ROTULO_ORIGEM[o]}
                    </option>
                  ))}
                </select>
              </div>
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

      {r.atrasadas > 0 && situacao !== "atrasadas" && (
        <AvisoDaPagina tom="erro">
          {r.atrasadas} {r.atrasadas === 1 ? "conta atrasada" : "contas atrasadas"} {receber ? "a receber" : "a pagar"}. <Link href={link({ situacao: "atrasadas", pagina: null })}>Ver quais</Link>
        </AvisoDaPagina>
      )}

      {/* SPEC-026 (5.6, item 4): os totais de todas as páginas, com os mesmos filtros e o limite do plano. */}
      <Superficie espaco="compacto" aria-labelledby="titulo-totais">
        <h2 id="titulo-totais" className="sr-only">
          Totais da lista
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Total rotulo={r.totais.quantidade === 1 ? "Conta" : "Contas"} valor={String(r.totais.quantidade)} />
          <Total rotulo="Total" valor={reais(r.totais.totalCentavos)} />
          <Total rotulo={receber ? "Recebido" : "Pago"} valor={reais(r.totais.pagoCentavos)} />
          <Total rotulo="Em aberto" valor={reais(r.totais.emAbertoCentavos)} destaque />
        </dl>
        {ativos > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {pessoaFiltrada ? `${pessoaFiltrada.nome}. ` : ""}
            Os totais somam as contas filtradas, sem as canceladas
            {filtros.pagamentoDe || filtros.pagamentoAte || filtros.forma ? `; o ${receber ? "recebido" : "pago"} soma só os ${receber ? "recebimentos" : "pagamentos"} do filtro` : ""}.
          </p>
        )}
      </Superficie>

      {r.contas.length === 0 ? (
        <Superficie>
          {ativos > 0 ? (
            <EstadoVazio
              Icone={Receipt}
              titulo="Nenhuma conta com estes filtros."
              acao={
                <Link href={limpar} className={classeDoLink()}>
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <EstadoVazio Icone={Receipt} titulo="Nenhuma conta nesta situação">
              {situacao === "abertas" ? `Nada ${receber ? "a receber" : "a pagar"} em aberto.` : "Escolha outra situação acima."}
            </EstadoVazio>
          )}
        </Superficie>
      ) : (
        <Superficie espaco="nenhum" aria-label="Lista de contas" className="overflow-hidden">
          <ul className="divide-y">
            {r.contas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/financeiro/contas/${c.id}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:gap-4 sm:px-5",
                    c.atrasada && "shadow-[inset_3px_0_0_var(--status-danger)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold break-words text-foreground">{c.descricao ?? "Conta"}</p>
                    <p className="text-xs break-words text-muted-foreground">
                      Vence em {dataBr(c.vencimento)}, {ROTULO_CATEGORIA[c.categoria].toLowerCase()}, {ORIGEM[c.origem].toLowerCase()}
                    </p>
                    {(c.pessoa || c.numeroDocumento) && (
                      <p className="text-xs break-words text-muted-foreground">
                        {c.pessoa?.nome}
                        {c.pessoa && c.numeroDocumento && " · "}
                        {c.numeroDocumento && `Doc. ${c.numeroDocumento}`}
                      </p>
                    )}
                    <div className="mt-1.5">
                      <SeloDaConta tipo={c.tipo} status={c.status} atrasada={c.atrasada} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-extrabold text-foreground tabular-nums">{reais(c.totalCentavos)}</p>
                    {c.status === "PARCIAL" && <p className="text-xs text-muted-foreground tabular-nums">Restam {reais(c.restanteCentavos)}</p>}
                  </div>
                  <ChevronRight aria-hidden="true" className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Superficie>
      )}

      {r.paginas > 1 && (
        <nav aria-label="Páginas das contas" className="flex items-center justify-between gap-2 text-sm">
          {r.pagina > 1 ? (
            <Link href={link({ pagina: r.pagina - 1 })} className={classeDoBotao("fantasma", "sm")}>
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
            <Link href={link({ pagina: r.pagina + 1 })} className={classeDoBotao("fantasma", "sm")}>
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
