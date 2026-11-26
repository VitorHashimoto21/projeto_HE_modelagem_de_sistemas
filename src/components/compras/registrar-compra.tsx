"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Search, Trash2 } from "lucide-react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao } from "@/components/ui/estilos";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { acaoRegistrarCompra, acaoRevisarCompra } from "@/lib/compras/acoes";
import { COMPRA_INICIAL, MENSAGENS_FLUXO_COMPRA, type EstadoDaCompra } from "@/lib/compras/servicos";
import type { LinhaDoResumo, ResumoDaCompra } from "@/lib/db/compras";
import type { OpcaoDePessoa } from "@/lib/db/fornecedores";
import { codigoExatoPrimeiro, itemPeloCodigo, lerNumero, normalizarCodigo } from "@/lib/dominio/catalogo";
import {
  DIAS_RETROATIVOS_COMPRA,
  ESCOLHAS_DE_CUSTO,
  MAX_DOCUMENTO,
  MAX_OBSERVACAO,
  MAX_PARCELAS_COMPRA,
  vencimentosSugeridos,
  type ContaDaCompra,
  type EscolhaDeCusto,
} from "@/lib/dominio/compras";
import { somarDias } from "@/lib/dominio/estoque";
import { dividirEmParcelas, paraCentavos, reaisDeCentavos, subtotalEmCentavos } from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";

// SPEC-026: o mesmo cadastro do fornecedor da conta, baixado só quando a pessoa abre "Novo fornecedor".
const FormularioCliente = dynamic(() => import("@/components/clientes/formulario-cliente").then((m) => m.FormularioCliente), { ssr: false });

export type ProdutoNaCompra = { id: string; nome: string; codigo: string | null; unidade: string; custoCentavos: number; saldo: number };
type Linha = { itemId: string; quantidade: string; custo: string };

const MAX_NA_LISTA = 30;
const rotulo = "mb-1.5 block text-sm font-medium text-foreground";
const reaisCampo = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
const quantos = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const centavosDe = (texto: string) => {
  const v = lerNumero(texto);
  return v === null || v < 0 ? 0 : paraCentavos(v);
};
const descricaoDaConta = (c: ContaDaCompra) => (c.tipo === "A_VISTA" ? "À vista" : c.tipo === "ENTRADA" ? "Entrada" : `Parcela ${c.parcela}/${c.deParcelas}`);

/**
 * Registrar compra (SPEC-027, 5.1): fornecedor, documento, produtos, frete e forma de pagar; "Revisar"
 * mostra o resumo do servidor (saldo novo, contas e os três custos, com o médio marcado) e "Confirmar
 * compra" grava tudo numa transação. O servidor valida tudo de novo (5.4).
 */
type PropsDaCompra = {
  hoje: string;
  produtos: ProdutoNaCompra[];
  fornecedores: OpcaoDePessoa[];
  podeCriarFornecedor: boolean;
  fornecedorInicial?: string;
};

export function RegistrarCompra(props: PropsDaCompra) {
  // "Registrar outra compra" recria o formulário (outro identificador) e atualiza saldos e custos.
  const [rodada, setRodada] = useState(0);
  const router = useRouter();
  return (
    <FormularioDaCompra
      key={rodada}
      {...props}
      aoRecomecar={() => {
        setRodada((r) => r + 1);
        router.refresh();
      }}
    />
  );
}

function FormularioDaCompra({ hoje, produtos, fornecedores: fornecedoresIniciais, podeCriarFornecedor, fornecedorInicial = "", aoRecomecar }: PropsDaCompra & { aoRecomecar: () => void }) {
  const [revisao, revisar, revisando] = useActionState(acaoRevisarCompra, COMPRA_INICIAL);
  const [registro, registrar, registrando] = useActionState(acaoRegistrarCompra, COMPRA_INICIAL);
  // Identificador da compra = id gravado: confirmar de novo a mesma compra não cria outra.
  const [compraId] = useState(() => crypto.randomUUID());
  const [ultima, setUltima] = useState<"revisar" | "registrar" | null>(null);
  const [revisado, setRevisado] = useState<string | null>(null);

  const [fornecedores, setFornecedores] = useState(fornecedoresIniciais);
  const [fornecedorId, setFornecedorId] = useState(fornecedorInicial);
  const [novoFornecedor, setNovoFornecedor] = useState(false);
  const [documento, setDocumento] = useState("");
  const [semNota, setSemNota] = useState(false);
  const [dia, setDia] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [codigoSemItem, setCodigoSemItem] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [frete, setFrete] = useState("");
  const [outras, setOutras] = useState("");
  const [desconto, setDesconto] = useState("");
  const [condicao, setCondicao] = useState<"A_VISTA" | "A_PRAZO">("A_PRAZO");
  const [entrada, setEntrada] = useState("");
  const [vencimentos, setVencimentos] = useState<string[]>(() => vencimentosSugeridos(hoje, 1));
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaDeCusto>>({});
  const resumoRef = useRef<HTMLHeadingElement>(null);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? codigoExatoPrimeiro(produtos.filter((p) => p.nome.toLowerCase().includes(termo) || !!p.codigo?.toLowerCase().includes(termo)), busca) : [];

  const calc = linhas.map((l) => {
    const q = lerNumero(l.quantidade);
    const c = lerNumero(l.custo);
    const total = q !== null && q > 0 && c !== null && c >= 0 ? subtotalEmCentavos(paraCentavos(c), q) : 0;
    return { ...l, produto: porId.get(l.itemId)!, total };
  });
  const valorProdutos = calc.reduce((s, l) => s + l.total, 0);
  const total = valorProdutos + centavosDe(frete) + centavosDe(outras) - centavosDe(desconto);
  const entradaCentavos = condicao === "A_PRAZO" ? centavosDe(entrada) : 0;
  const parcelas = condicao === "A_PRAZO" && total - entradaCentavos > 0 ? dividirEmParcelas(total - entradaCentavos, vencimentos.length) : [];

  const dados = {
    id: compraId,
    fornecedorId,
    numeroDocumento: semNota ? "" : documento,
    semNotaFiscal: semNota,
    dia,
    observacao,
    linhas: linhas.map((l) => ({ itemId: l.itemId, quantidade: l.quantidade, custoUnitario: l.custo })),
    frete,
    outrasDespesas: outras,
    desconto,
    condicao,
    entrada: condicao === "A_PRAZO" ? entrada : "",
    parcelas: condicao === "A_PRAZO" ? vencimentos.map((vencimento) => ({ vencimento })) : [],
  };
  const json = JSON.stringify(dados);
  // A revisão vale só para os dados revisados: mudou alguma coisa, é preciso revisar de novo.
  const resumo = revisao.status === "revisada" && revisado === json ? revisao.resumo : null;
  const comEscolhas = JSON.stringify({
    ...dados,
    linhas: dados.linhas.map((l) => ({ ...l, escolhaCusto: escolhas[l.itemId] ?? "MEDIO" })),
  });

  const estado: EstadoDaCompra = ultima === "registrar" ? registro : ultima === "revisar" ? revisao : COMPRA_INICIAL;
  const erros = estado.status === "erro" ? (estado.erros ?? {}) : {};
  const mensagemGeral = estado.status === "erro" ? (estado.mensagem ?? Object.values(erros).filter(Boolean)[0]) : undefined;

  // O foco vai ao resumo só quando chega uma revisão nova, nunca no meio da digitação.
  const revisaoFocada = useRef<EstadoDaCompra | null>(null);
  useEffect(() => {
    if (revisao.status === "revisada" && revisaoFocada.current !== revisao) {
      revisaoFocada.current = revisao;
      resumoRef.current?.focus();
    }
  }, [revisao]);

  function adicionar(id: string) {
    setBusca("");
    setCodigoSemItem(null);
    // O mesmo produto não entra em duas linhas: leva à linha que já existe (5.2).
    if (linhas.some((l) => l.itemId === id)) {
      document.getElementById(`quantidade-${id}`)?.focus();
      return;
    }
    setLinhas((ls) => [...ls, { itemId: id, quantidade: "1", custo: reaisCampo(porId.get(id)!.custoCentavos) }]);
  }
  /** Código exato + Enter, como na Nova venda (SPEC-024): adiciona o produto; nunca envia a compra. */
  function enterNaBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const p = itemPeloCodigo(busca, produtos);
    if (p) return adicionar(p.id);
    setCodigoSemItem(normalizarCodigo(busca) || null);
    e.currentTarget.select();
  }
  function mudarLinha(itemId: string, mudanca: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, ...mudanca } : l)));
  }
  function mudarDia(novo: string) {
    setDia(novo);
    if (/^\d{4}-\d{2}-\d{2}$/.test(novo)) setVencimentos(vencimentosSugeridos(novo, vencimentos.length));
  }
  function mudarParcelas(n: number) {
    const sugeridos = vencimentosSugeridos(dia, n);
    setVencimentos(sugeridos.map((s, k) => vencimentos[k] ?? s));
  }

  if (registro.status === "registrada" && ultima === "registrar") return <CompraRegistrada estado={registro} aoRecomecar={aoRecomecar} />;

  return (
    <div className="space-y-6">
      {mensagemGeral && <Aviso tipo="erro">{mensagemGeral}</Aviso>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Superficie aria-labelledby="titulo-fornecedor">
            <TituloDaSuperficie id="titulo-fornecedor" titulo="Fornecedor e documento" />
            {novoFornecedor ? (
              <section aria-label="Novo fornecedor" className="space-y-4">
                <p className="text-sm font-bold text-foreground">Novo fornecedor</p>
                <FormularioCliente
                  modo="gaveta"
                  pessoa="fornecedor"
                  aoCriar={(f) => {
                    setFornecedores((fs) => [...fs, { id: f.id, nome: f.nome }].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
                    setFornecedorId(f.id);
                    setNovoFornecedor(false);
                  }}
                  aoCancelar={() => setNovoFornecedor(false)}
                />
              </section>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="fornecedor" className={rotulo}>
                    Fornecedor
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="fornecedor"
                      value={fornecedorId}
                      onChange={(e) => setFornecedorId(e.target.value)}
                      aria-invalid={erros.fornecedor ? true : undefined}
                      aria-describedby={erros.fornecedor ? "fornecedor-erro" : undefined}
                      className={`${classeDoCampo(erros.fornecedor)} min-w-0 flex-1 basis-48`}
                    >
                      <option value="">Escolha o fornecedor</option>
                      {fornecedores.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                    {podeCriarFornecedor && (
                      <button type="button" onClick={() => setNovoFornecedor(true)} className={classeDoBotao("secundario")}>
                        <Plus aria-hidden="true" />
                        Novo fornecedor
                      </button>
                    )}
                  </div>
                  <MensagemDeCampo id="fornecedor-erro" erro={erros.fornecedor} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="documento" className={rotulo}>
                      Nº do documento
                    </label>
                    {semNota ? (
                      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Sem nota</p>
                    ) : (
                      <input
                        id="documento"
                        value={documento}
                        maxLength={MAX_DOCUMENTO}
                        autoComplete="off"
                        onChange={(e) => setDocumento(e.target.value)}
                        aria-invalid={erros.documento ? true : undefined}
                        aria-describedby={erros.documento ? "documento-erro" : undefined}
                        className={classeDoCampo(erros.documento)}
                      />
                    )}
                    <MensagemDeCampo id="documento-erro" erro={erros.documento} />
                    <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={semNota} onChange={(e) => setSemNota(e.target.checked)} className="size-4 accent-primary" />
                      Compra sem nota fiscal
                    </label>
                  </div>
                  <div>
                    <label htmlFor="dia" className={rotulo}>
                      Data da compra
                    </label>
                    <input
                      id="dia"
                      type="date"
                      value={dia}
                      max={hoje}
                      min={somarDias(hoje, -DIAS_RETROATIVOS_COMPRA)}
                      onChange={(e) => mudarDia(e.target.value)}
                      aria-invalid={erros.dia ? true : undefined}
                      aria-describedby={erros.dia ? "dia-erro" : undefined}
                      className={classeDoCampo(erros.dia)}
                    />
                    <MensagemDeCampo id="dia-erro" erro={erros.dia} />
                  </div>
                </div>
                <div>
                  <label htmlFor="observacao" className={rotulo}>
                    Observação <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <input id="observacao" value={observacao} maxLength={MAX_OBSERVACAO} onChange={(e) => setObservacao(e.target.value)} className={classeDoCampo(erros.observacao)} />
                  <MensagemDeCampo id="observacao-erro" erro={erros.observacao} />
                </div>
              </div>
            )}
          </Superficie>

          <Superficie aria-labelledby="titulo-produtos">
            <TituloDaSuperficie id="titulo-produtos" titulo="Produtos" descricao="Só produtos físicos ativos do catálogo." />
            <label htmlFor="busca-produto" className={rotulo}>
              Buscar produto
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground" />
              <input
                id="busca-produto"
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setCodigoSemItem(null);
                }}
                onKeyDown={enterNaBusca}
                placeholder="Nome ou código"
                disabled={!produtos.length}
                autoComplete="off"
                className={cn(classeDoCampo(), "h-12 rounded-full pl-11")}
              />
            </div>
            {filtrados.length > 0 && (
              <ul className="mt-2 max-h-72 divide-y overflow-y-auto rounded-xl border" aria-label="Resultados da busca">
                {filtrados.slice(0, MAX_NA_LISTA).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => adicionar(p.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-foreground">{p.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.codigo && `${p.codigo} · `}
                          {quantos(p.saldo)} em estoque · custo {reaisDeCentavos(p.custoCentavos)}
                        </span>
                      </span>
                      <Plus aria-hidden="true" className="size-5 shrink-0 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {codigoSemItem ? (
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                Nenhum produto ativo com o código {codigoSemItem}.
              </p>
            ) : (
              termo && filtrados.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum produto encontrado. Só aparecem produtos físicos ativos.</p>
            )}

            <MensagemDeCampo id="itens-erro" erro={erros.itens} />
            {calc.length === 0 ? (
              <p className="mt-4 rounded-2xl border-2 border-dashed border-input px-4 py-4 text-sm text-muted-foreground">Busque e toque num produto para adicionar.</p>
            ) : (
              <ul className="mt-4 space-y-3" aria-label="Produtos da compra">
                {calc.map((l) => (
                  <li key={l.itemId} className="rounded-2xl bg-muted/60 p-3">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-sm font-bold break-words text-foreground">{l.produto.nome}</p>
                      <button
                        type="button"
                        aria-label={`Remover ${l.produto.nome}`}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.itemId !== l.itemId))}
                        className={classeDoBotao("fantasma", "icone-sm", "text-status-danger hover:bg-status-danger-bg")}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <label htmlFor={`quantidade-${l.itemId}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                          Quantidade ({l.produto.unidade.toLowerCase()})
                        </label>
                        <input
                          id={`quantidade-${l.itemId}`}
                          inputMode="decimal"
                          value={l.quantidade}
                          onChange={(e) => mudarLinha(l.itemId, { quantidade: e.target.value })}
                          aria-invalid={erros[`quantidade_${l.itemId}`] ? true : undefined}
                          className={cn(classeDoCampo(erros[`quantidade_${l.itemId}`]), "tabular-nums")}
                        />
                      </div>
                      <div>
                        <label htmlFor={`custo-${l.itemId}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                          Custo unitário
                        </label>
                        <input
                          id={`custo-${l.itemId}`}
                          inputMode="decimal"
                          value={l.custo}
                          onChange={(e) => mudarLinha(l.itemId, { custo: e.target.value })}
                          aria-invalid={erros[`custo_${l.itemId}`] ? true : undefined}
                          className={cn(classeDoCampo(erros[`custo_${l.itemId}`]), "tabular-nums")}
                        />
                      </div>
                      <p className="col-span-2 self-end text-sm text-muted-foreground sm:col-span-1 sm:pb-3 sm:text-right">
                        Total <span className="font-bold text-foreground tabular-nums">{reaisDeCentavos(l.total)}</span>
                      </p>
                    </div>
                    <MensagemDeCampo id={`quantidade-${l.itemId}-erro`} erro={erros[`quantidade_${l.itemId}`]} />
                    <MensagemDeCampo id={`custo-${l.itemId}-erro`} erro={erros[`custo_${l.itemId}`]} />
                  </li>
                ))}
              </ul>
            )}
          </Superficie>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Superficie aria-labelledby="titulo-valores">
            <TituloDaSuperficie id="titulo-valores" titulo="Frete e desconto" descricao="Entram no custo dos produtos, em proporção ao valor de cada um." />
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["frete", "Frete", frete, setFrete],
                  ["outrasDespesas", "Outras despesas", outras, setOutras],
                  ["desconto", "Desconto", desconto, setDesconto],
                ] as const
              ).map(([campo, nome, valor, mudar]) => (
                <div key={campo} className="min-w-0">
                  <label htmlFor={campo} className="mb-1 block text-xs font-medium text-muted-foreground">
                    {nome}
                  </label>
                  <input
                    id={campo}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => mudar(e.target.value)}
                    aria-invalid={erros[campo] ? true : undefined}
                    className={cn(classeDoCampo(erros[campo]), "px-3 tabular-nums")}
                  />
                </div>
              ))}
            </div>
            <MensagemDeCampo id="valores-erro" erro={erros.frete ?? erros.outrasDespesas ?? erros.desconto} />
          </Superficie>

          <Superficie aria-labelledby="titulo-pagar">
            <TituloDaSuperficie id="titulo-pagar" titulo="Como vai pagar?" descricao="Toda compra vira conta a pagar. O caixa só muda quando você confirma o pagamento no Financeiro." />
            <fieldset>
              <legend className="sr-only">Condição</legend>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {(["A_VISTA", "A_PRAZO"] as const).map((c) => (
                  <label
                    key={c}
                    className="relative grid h-10 cursor-pointer place-items-center rounded-full text-sm font-bold text-foreground hover:bg-accent has-checked:bg-estrutura has-checked:text-estrutura-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                  >
                    <input type="radio" name="condicao" value={c} checked={condicao === c} onChange={() => setCondicao(c)} className="sr-only" />
                    {c === "A_VISTA" ? "À vista" : "A prazo"}
                  </label>
                ))}
              </div>
            </fieldset>
            {condicao === "A_VISTA" ? (
              <p className="mt-3 text-sm text-muted-foreground">Uma conta a pagar com o total, vencendo na data da compra.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">Cartão de crédito do negócio: use &quot;A prazo&quot;, com o vencimento na fatura. O caixa sai no dia em que a fatura é paga.</p>
                <div>
                  <label htmlFor="entrada" className={rotulo}>
                    Entrada <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    id="entrada"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    aria-invalid={erros.entrada ? true : undefined}
                    aria-describedby={erros.entrada ? "entrada-erro" : undefined}
                    className={cn(classeDoCampo(erros.entrada), "tabular-nums")}
                  />
                  <MensagemDeCampo id="entrada-erro" erro={erros.entrada} />
                </div>
                <div>
                  <label htmlFor="parcelas" className={rotulo}>
                    Parcelas
                  </label>
                  <select id="parcelas" value={vencimentos.length} onChange={(e) => mudarParcelas(Number(e.target.value))} className={classeDoCampo(erros.parcelas)}>
                    {Array.from({ length: MAX_PARCELAS_COMPRA }, (_, i) => i + 1).map((k) => (
                      <option key={k} value={k}>
                        {k}x
                      </option>
                    ))}
                  </select>
                  <MensagemDeCampo id="parcelas-erro" erro={erros.parcelas} />
                </div>
                <ol className="space-y-2" aria-label="Vencimentos das parcelas">
                  {vencimentos.map((v, k) => (
                    <li key={k}>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`vencimento-${k}`} className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
                          {k + 1}ª{parcelas[k] !== undefined ? ` · ${reaisDeCentavos(parcelas[k])}` : ""}
                        </label>
                        <input
                          id={`vencimento-${k}`}
                          type="date"
                          value={v}
                          min={dia}
                          onChange={(e) => setVencimentos((vs) => vs.map((x, j) => (j === k ? e.target.value : x)))}
                          aria-invalid={erros[`vencimento_${k}`] ? true : undefined}
                          className={cn(classeDoCampo(erros[`vencimento_${k}`]), "min-w-0 py-2")}
                        />
                      </div>
                      <MensagemDeCampo id={`vencimento-${k}-erro`} erro={erros[`vencimento_${k}`]} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Superficie>

          <Superficie tom="estrutura" aria-label="Total da compra">
            <dl className="space-y-1.5 text-sm">
              <ValorDoTotal rotulo="Produtos" centavos={valorProdutos} />
              {centavosDe(frete) > 0 && <ValorDoTotal rotulo="Frete" centavos={centavosDe(frete)} />}
              {centavosDe(outras) > 0 && <ValorDoTotal rotulo="Outras despesas" centavos={centavosDe(outras)} />}
              {centavosDe(desconto) > 0 && <ValorDoTotal rotulo="Desconto" centavos={-centavosDe(desconto)} />}
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-estrutura-foreground/15 pt-3">
              <span className="text-sm text-estrutura-suave">Total</span>
              <span className="text-[28px] leading-none font-extrabold tabular-nums">{reaisDeCentavos(total)}</span>
            </div>
            <MensagemDeCampo id="total-erro" erro={erros.total} />
            <form
              action={revisar}
              onSubmit={() => {
                setRevisado(json);
                setUltima("revisar");
              }}
              className="mt-4"
            >
              <input type="hidden" name="compra" value={json} />
              <button
                type="submit"
                disabled={revisando || linhas.length === 0}
                className={classeDoBotao("ambar", "lg", "w-full font-extrabold disabled:bg-estrutura-foreground/15 disabled:text-estrutura-suave disabled:opacity-100")}
              >
                {revisando ? "Revisando…" : resumo ? "Revisar de novo" : "Revisar"}
              </button>
            </form>
          </Superficie>
        </aside>
      </div>

      {resumo && (
        <Superficie aria-labelledby="titulo-resumo">
          <h2 id="titulo-resumo" ref={resumoRef} tabIndex={-1} className="text-lg font-bold text-foreground outline-none">
            Resumo da compra
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Confira o que vai acontecer no estoque, no financeiro e no custo de cada produto.</p>
          <ResumoDaTela resumo={resumo} escolhas={escolhas} aoEscolher={(itemId, e) => setEscolhas((es) => ({ ...es, [itemId]: e }))} />
          <form
            action={registrar}
            onSubmit={() => setUltima("registrar")}
            className="mt-5 flex flex-wrap justify-end gap-2"
          >
            <input type="hidden" name="compra" value={comEscolhas} />
            <button type="submit" disabled={registrando} className={classeDoBotao("principal", "lg")}>
              {registrando ? "Registrando…" : "Confirmar compra"}
            </button>
          </form>
        </Superficie>
      )}
    </div>
  );
}

function ValorDoTotal({ rotulo, centavos }: { rotulo: string; centavos: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-estrutura-suave">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{centavos < 0 ? `− ${reaisDeCentavos(-centavos)}` : reaisDeCentavos(centavos)}</dd>
    </div>
  );
}

/** 5.1, item 4: entradas com o saldo atual e o novo, as contas e os três custos (o médio marcado). */
function ResumoDaTela({ resumo, escolhas, aoEscolher }: { resumo: ResumoDaCompra; escolhas: Record<string, EscolhaDeCusto>; aoEscolher: (itemId: string, e: EscolhaDeCusto) => void }) {
  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="titulo-entradas">
        <h3 id="titulo-entradas" className="mb-2 text-sm font-bold text-foreground">
          Estoque e custo
        </h3>
        <ul className="space-y-3">
          {resumo.linhas.map((l) => (
            <LinhaDoResumoNaTela key={l.itemId} linha={l} escolha={escolhas[l.itemId] ?? "MEDIO"} aoEscolher={(e) => aoEscolher(l.itemId, e)} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="titulo-contas">
        <h3 id="titulo-contas" className="mb-2 text-sm font-bold text-foreground">
          Contas a pagar
        </h3>
        <ul className="divide-y rounded-xl border">
          {resumo.contas.map((c, k) => (
            <li key={k} className="flex flex-wrap justify-between gap-x-3 px-4 py-2.5 text-sm">
              <span className="text-foreground">
                {descricaoDaConta(c)} <span className="text-muted-foreground">· vence em {dataBr(c.vencimento)}</span>
              </span>
              <span className="font-bold text-foreground tabular-nums">{reaisDeCentavos(c.valorCentavos)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total da compra</dt>
            <dd className="font-bold text-foreground tabular-nums">{reaisDeCentavos(resumo.totalCentavos)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">O caixa não muda agora: cada conta sai do caixa quando o pagamento é confirmado no Financeiro.</p>
      </section>
    </div>
  );
}

function LinhaDoResumoNaTela({ linha: l, escolha, aoEscolher }: { linha: LinhaDoResumo; escolha: EscolhaDeCusto; aoEscolher: (e: EscolhaDeCusto) => void }) {
  const { atualCentavos, compraCentavos, medioCentavos } = l.custos;
  const iguais = atualCentavos === compraCentavos && compraCentavos === medioCentavos;
  const valor: Record<EscolhaDeCusto, number> = { MEDIO: medioCentavos, COMPRA: compraCentavos, ATUAL: atualCentavos };
  return (
    <li className="rounded-xl bg-muted/60 p-3">
      <p className="text-sm font-bold break-words text-foreground">
        +{quantos(l.quantidade)} {l.nome}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        Saldo: {quantos(l.saldoAtual)} → {quantos(l.saldoNovo)} {l.unidadeMedida.toLowerCase()}
      </p>
      {iguais ? (
        <p className="mt-2 text-xs text-muted-foreground">Custo: {reaisDeCentavos(atualCentavos)} (não muda)</p>
      ) : (
        <fieldset className="mt-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Custo de {l.nome} depois da compra</legend>
          <div className="space-y-1">
            {(Object.keys(ESCOLHAS_DE_CUSTO) as EscolhaDeCusto[]).map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm text-foreground">
                <input type="radio" name={`custo-${l.itemId}`} checked={escolha === e} onChange={() => aoEscolher(e)} className="size-4 accent-primary" />
                <span className="flex-1">{ESCOLHAS_DE_CUSTO[e]}</span>
                <span className="font-semibold tabular-nums">{reaisDeCentavos(valor[e])}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </li>
  );
}

/** 5.1, itens 5 e 6: o número da compra e o aviso para revisar o preço dos produtos cujo custo mudou. */
function CompraRegistrada({ estado, aoRecomecar }: { estado: Extract<EstadoDaCompra, { status: "registrada" }>; aoRecomecar: () => void }) {
  return (
    <Superficie aria-labelledby="titulo-registrada">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-status-ok" />
        <div className="min-w-0 space-y-3">
          <h2 id="titulo-registrada" className="text-lg font-bold text-foreground">
            {estado.jaExistia ? MENSAGENS_FLUXO_COMPRA.jaRegistrada(estado.numero) : MENSAGENS_FLUXO_COMPRA.registrada(estado.numero)}
          </h2>
          <p className="text-sm text-muted-foreground">As entradas já estão no estoque, e as contas a pagar estão no Financeiro.</p>
          {estado.custosNovos.length > 0 && (
            <ul className="space-y-1 text-sm">
              {estado.custosNovos.map((p) => (
                <li key={p.itemId}>
                  O custo de <span className="font-semibold">{p.nome}</span> mudou. Revise o preço na{" "}
                  <Link href={`/calculadora?item=${p.itemId}`} className="font-semibold text-primary underline underline-offset-2">
                    Calculadora
                  </Link>
                  .
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={aoRecomecar} className={classeDoBotao("principal")}>
              Registrar outra compra
            </button>
            <Link href="/financeiro/contas?tipo=PAGAR" className={classeDoBotao("secundario")}>
              Ver as contas a pagar
            </Link>
            <Link href="/estoque" className={classeDoBotao("secundario")}>
              Ver o estoque
            </Link>
          </div>
        </div>
      </div>
    </Superficie>
  );
}
