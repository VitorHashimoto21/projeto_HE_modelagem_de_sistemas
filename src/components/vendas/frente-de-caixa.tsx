"use client";

import { useActionState, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Minus, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
import { codigoExatoPrimeiro, itemPeloCodigo, lerNumero, normalizarCodigo } from "@/lib/dominio/catalogo";
import { somarDias } from "@/lib/dominio/estoque";
import {
  acertoDoCancelamento,
  DIAS_RETROATIVOS,
  dividirEmParcelas,
  FORMAS_DE_PAGAMENTO,
  FORMAS_DE_REEMBOLSO,
  MOTIVOS_CANCELAMENTO,
  MAX_PARCELAS,
  paraCentavos,
  reaisDeCentavos,
  subtotalEmCentavos,
  troco,
  type FormaDePagamento,
} from "@/lib/dominio/venda";
import { cn } from "@/lib/utils";
import type { ClienteDaVenda } from "@/lib/db/vendas";
import { acaoRegistrarVenda, acaoTrocarVenda } from "@/lib/vendas/acoes";
import { VENDA_INICIAL } from "@/lib/vendas/servicos";
import { GavetaDeMateriais, GavetaDePreco, type MaterialDaLinha } from "./ajustes-da-linha";

export type ItemDaFrente = {
  id: string;
  nome: string;
  /** SPEC-024: código interno (busca e Enter com o código exato). */
  codigo: string | null;
  tipo: "PRODUTO_FISICO" | "SERVICO";
  unidade: string;
  preco: number;
  saldo: number | null;
  materiais: MaterialDaLinha[];
  /** Custo próprio (só para quem ajusta preço: aviso de preço abaixo do custo — SPEC-017, OPEN-007). */
  custoBase?: number | null;
};
/** SPEC-017: materiais usados na linha (total, OPEN-002) e preço cobrado com motivo; null = padrão do catálogo. */
type Linha = { itemId: string; quantidade: string; materiais?: Record<string, string> | null; ajuste?: { preco: string; motivo: string } | null };
/** `auto`: com um só pagamento, o valor acompanha o total até a pessoa editar o campo. */
type Pagamento = { chave: number; forma: FormaDePagamento; valor: string; parcelas: number; auto?: boolean };

/** Modo troca (SPEC-011, OPEN-004): a venda original, o limite e o que já foi recebido. */
export type TrocaDaFrente = { vendaId: string; numero: number; limiteCentavos: number; recebidoCentavos: number };

// SPEC-022 (5.10): o formulário completo do cliente só é baixado quando a pessoa abre "Novo cliente".
const FormularioCliente = dynamic(() => import("@/components/clientes/formulario-cliente").then((m) => m.FormularioCliente), { ssr: false });

const MAX_NA_LISTA = 30;
const reaisCampo = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
const numeroCampo = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3, useGrouping: false });
const quantos = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const rotulo = "mb-1.5 block text-sm font-medium text-foreground";

/**
 * Frente de caixa (SPEC-008, 5.1): monta a venda; o servidor recalcula e valida tudo (5.2).
 * SPEC-016: lista de itens sempre à vista (toque para adicionar), carrinho com botões de
 * quantidade, forma de pagamento em segmentos e o resumo escuro com "Finalizar venda".
 */
export function FrenteDeCaixa({
  itens,
  clientes: clientesIniciais,
  hoje,
  troca,
  podeAjustarPreco = false,
  emiteNotaDeProduto = false,
  podeEditarClientes = false,
  clienteInicial = null,
}: {
  itens: ItemDaFrente[];
  clientes: ClienteDaVenda[];
  hoje: string;
  troca?: TrocaDaFrente;
  /** SPEC-017 (OPEN-005): Vendas — editar. Na troca não há ajustes (OPEN-008). */
  podeAjustarPreco?: boolean;
  /** SPEC-022 (5.4, item 4): com a nota fiscal de produtos ligada, avisa quando o cliente está incompleto. */
  emiteNotaDeProduto?: boolean;
  /** Vendas — editar: o aviso traz o link "Completar". */
  podeEditarClientes?: boolean;
  /** Na troca, o cliente da venda original (SPEC-022, 5.10, item 4); ainda pode ser trocado. */
  clienteInicial?: string | null;
}) {
  // Na troca, a ação é a de cancelar e trocar; os estados de erro têm a mesma forma e o sucesso redireciona.
  const [estado, executar, enviando] = useActionState(troca ? (acaoTrocarVenda as unknown as typeof acaoRegistrarVenda) : acaoRegistrarVenda, VENDA_INICIAL);
  // Identificador do carrinho = id da venda: reenviar o mesmo carrinho não cria outra venda (INV-009).
  const [carrinhoId] = useState(() => crypto.randomUUID());
  const [busca, setBusca] = useState("");
  /** SPEC-024 (5.4): o código digitado com Enter que não é de nenhum item à venda. */
  const [codigoSemItem, setCodigoSemItem] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [clientes, setClientes] = useState(clientesIniciais);
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [novoCliente, setNovoCliente] = useState(false);
  const faltando = emiteNotaDeProduto ? (clientes.find((c) => c.id === clienteId)?.faltando ?? []) : [];
  const [dia, setDia] = useState(hoje);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(troca ? [] : [{ chave: 1, forma: "PIX", valor: "", parcelas: 1, auto: true }]);
  const [recebido, setRecebido] = useState("");
  const [motivo, setMotivo] = useState("TROCA");
  const [detalhe, setDetalhe] = useState("");
  const [formaReembolso, setFormaReembolso] = useState("");
  const [editando, setEditando] = useState<{ tipo: "materiais" | "preco"; itemId: string } | null>(null);
  const ajustaMateriais = !troca;
  const ajustaPreco = podeAjustarPreco && !troca;

  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const termo = busca.trim().toLowerCase();
  // SPEC-024 (5.4): pelo nome ou pelo código interno, com o código exato primeiro.
  const filtrados = termo
    ? codigoExatoPrimeiro(
        itens.filter((i) => i.nome.toLowerCase().includes(termo) || !!i.codigo?.toLowerCase().includes(termo)),
        busca,
      )
    : itens;
  const naLista = filtrados.slice(0, MAX_NA_LISTA);

  const linhasCalc = linhas.map((l) => {
    const item = porId.get(l.itemId)!;
    const q = lerNumero(l.quantidade);
    const valida = q !== null && q > 0;
    const oficial = paraCentavos(item.preco);
    const preco = l.ajuste ? paraCentavos(lerNumero(l.ajuste.preco) ?? 0) : oficial;
    // Materiais usados na linha: os informados (SPEC-017) ou o padrão do catálogo × quantidade.
    const usados = item.materiais.map((m) => ({
      ...m,
      usado: l.materiais ? (lerNumero(l.materiais[m.materialId]) ?? 0) : Math.round((valida ? q : 0) * m.quantidade * 1000) / 1000,
    }));
    const custoUnitario =
      item.custoBase === undefined || item.custoBase === null || !valida
        ? null
        : paraCentavos(item.custoBase + usados.reduce((s, m) => s + (m.custo ?? 0) * m.usado, 0) / q);
    return { ...l, item, q: valida ? q : 0, valida, oficial, preco, usados, custoUnitario, subtotal: valida ? subtotalEmCentavos(preco, q) : 0 };
  });
  const noCarrinho = new Map(linhasCalc.map((l) => [l.itemId, l.q]));
  const total = linhasCalc.reduce((s, l) => s + l.subtotal, 0);
  // Troca (RN26): o crédito cobre até o recebido; os pagamentos são só o restante.
  const acerto = troca ? acertoDoCancelamento(troca.recebidoCentavos, total) : null;
  const credito = acerto?.creditoCentavos ?? 0;
  const reembolso = acerto?.reembolsoCentavos ?? 0;
  // O pagamento automático fica com o que os outros não cobrem; os demais valem o que foi digitado.
  const digitado = (p: Pagamento) => paraCentavos(lerNumero(p.valor) ?? 0);
  const manuais = pagamentos.reduce((s, p) => s + (p.auto ? 0 : digitado(p)), 0);
  const efetivos = pagamentos.map((p) => (p.auto ? { ...p, valor: reaisCampo(Math.max(0, total - credito - manuais)) } : p));
  const pago = efetivos.reduce((s, p) => s + digitado(p), 0);
  const acimaDoLimite = troca ? total > troca.limiteCentavos : false;
  const falta = total - credito - pago;
  const erroDe = (campo: string) => (estado.status === "erro" ? estado.erros?.[campo] : undefined);

  // Aviso de estoque (a decisão final é do servidor): soma o consumo direto e o dos materiais.
  const consumo = new Map<string, { nome: string; pedido: number; saldo: number }>();
  for (const l of linhasCalc) {
    const somar = (id: string, nome: string, q: number, saldo: number) => {
      const atual = consumo.get(id) ?? { nome, pedido: 0, saldo };
      consumo.set(id, { ...atual, pedido: atual.pedido + q });
    };
    if (l.item.tipo === "PRODUTO_FISICO") somar(l.item.id, l.item.nome, l.q, l.item.saldo ?? 0);
    else for (const m of l.usados) somar(m.materialId, m.nome, m.usado, m.saldo);
  }
  const semEstoque = [...consumo.values()].filter((c) => c.pedido > c.saldo + 1e-9);

  const cancelamentoOk = !troca || ((motivo !== "OUTRO" || detalhe.trim().length > 0) && (reembolso === 0 || formaReembolso !== ""));
  const podeFinalizar =
    linhas.length > 0 &&
    linhasCalc.every((l) => l.valida) &&
    total > 0 &&
    falta === 0 &&
    efetivos.every((p) => (lerNumero(p.valor) ?? 0) > 0) &&
    semEstoque.length === 0 &&
    !acimaDoLimite &&
    cancelamentoOk;

  const dinheiro = efetivos.find((p) => p.forma === "DINHEIRO");
  const trocoCentavos = dinheiro && recebido ? troco(paraCentavos(lerNumero(recebido) ?? 0), digitado(dinheiro)) : null;

  function adicionar(id: string) {
    setLinhas((ls) =>
      ls.some((l) => l.itemId === id)
        ? ls.map((l) => (l.itemId === id ? { ...l, quantidade: numeroCampo((lerNumero(l.quantidade) ?? 0) + 1) } : l))
        : [...ls, { itemId: id, quantidade: "1" }],
    );
    setBusca("");
    setCodigoSemItem(null);
  }
  /**
   * Enter na busca (SPEC-024, 5.4, INV-005): o código exato de um item à venda o adiciona, como o toque
   * (também com o leitor de código de barras, que digita o código e o Enter). Nunca envia a venda.
   * Sem item com o código, o texto fica selecionado: a próxima leitura o substitui, em vez de se juntar a ele.
   */
  function enterNaBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const item = itemPeloCodigo(busca, itens);
    if (item) return adicionar(item.id);
    setCodigoSemItem(normalizarCodigo(busca) || null);
    e.currentTarget.select();
  }
  function mudarQuantidade(idx: number, passo: number) {
    const atual = lerNumero(linhas[idx].quantidade) ?? 0;
    const nova = Math.round((atual + passo) * 1000) / 1000;
    setLinhas(nova <= 0 ? linhas.filter((_, j) => j !== idx) : linhas.map((x, j) => (j === idx ? { ...x, quantidade: numeroCampo(nova) } : x)));
  }
  function mudarPagamento(chave: number, mudanca: Partial<Pagamento>) {
    setPagamentos((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...mudanca } : p)));
  }
  function preencherRestante(chave: number) {
    setPagamentos((ps) => {
      const outros = ps.filter((p) => p.chave !== chave).reduce((s, p) => s + digitado(p), 0);
      return ps.map((p) => (p.chave === chave ? { ...p, auto: false, valor: reaisCampo(Math.max(0, total - credito - outros)) } : p));
    });
  }
  function outraForma() {
    // Ao dividir, o valor automático fica fixo no que estava na tela e a pessoa ajusta cada parte.
    const proxima = Math.max(0, ...pagamentos.map((p) => p.chave)) + 1;
    setPagamentos([...efetivos.map((p) => ({ ...p, auto: false })), { chave: proxima, forma: troca ? "PIX" : "DINHEIRO", valor: "", parcelas: 1 }]);
  }

  const carrinhoJson = JSON.stringify({
    id: carrinhoId,
    dia,
    clienteId: clienteId || null,
    linhas: linhasCalc.map((l) => ({
      itemId: l.itemId,
      quantidade: l.quantidade,
      precoVisto: l.item.preco,
      ...(l.materiais ? { materiais: Object.entries(l.materiais).map(([materialId, quantidade]) => ({ materialId, quantidade })) } : {}),
      ...(l.ajuste ? { precoAjustado: l.ajuste.preco, motivoAjuste: l.ajuste.motivo } : {}),
    })),
    pagamentos: efetivos.map((p) => ({ forma: p.forma, valor: p.valor, parcelas: p.forma === "CREDITO" ? p.parcelas : 1 })),
  });
  const unidades = linhasCalc.reduce((s, l) => s + l.q, 0);
  const situacao =
    total === 0
      ? "Adicione itens à venda."
      : falta === 0
        ? troca && pago === 0
          ? "Coberto pelo crédito de troca."
          : "Pagamento completo."
        : falta > 0
          ? `Falta ${reaisDeCentavos(falta)}`
          : `Pagamento passou ${reaisDeCentavos(-falta)} do total`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      {(() => {
        // Gavetas dos ajustes da linha (SPEC-017). A chave recria o formulário a cada abertura.
        const l = editando && linhasCalc.find((x) => x.itemId === editando.itemId);
        if (!editando || !l) return null;
        const atualizar = (mudanca: Partial<Linha>) => setLinhas((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, ...mudanca } : x)));
        return editando.tipo === "materiais" ? (
          <GavetaDeMateriais
            key={`materiais-${l.itemId}`}
            aberta
            aoFechar={() => setEditando(null)}
            nome={l.item.nome}
            quantidadeDaLinha={l.q}
            materiais={l.item.materiais}
            valores={l.materiais ?? null}
            aoAplicar={(valores) => atualizar({ materiais: valores })}
          />
        ) : (
          <GavetaDePreco
            key={`preco-${l.itemId}`}
            aberta
            aoFechar={() => setEditando(null)}
            nome={l.item.nome}
            precoOficialCentavos={l.oficial}
            custoUnitarioCentavos={l.custoUnitario}
            valor={l.ajuste ?? null}
            aoAplicar={(ajuste) => atualizar({ ajuste })}
          />
        );
      })()}
      <div className="min-w-0 space-y-6">
        {estado.status === "erro" && (estado.mensagem || estado.erros) && (
          <Aviso tipo="erro">{estado.mensagem ?? Object.values(estado.erros ?? {}).filter(Boolean)[0]}</Aviso>
        )}

        <Superficie espaco="nenhum" aria-labelledby="titulo-itens" className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <h2 id="titulo-itens" className="sr-only">
              Itens
            </h2>
            <label htmlFor="busca-item" className={rotulo}>
              Buscar produto ou serviço
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground" />
              <input
                id="busca-item"
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setCodigoSemItem(null);
                }}
                onKeyDown={enterNaBusca}
                placeholder={itens.length ? "Nome ou código, ex.: manicure" : "Nenhum item com preço oficial no catálogo"}
                disabled={!itens.length}
                autoComplete="off"
                className={cn(classeDoCampo(), "h-12 rounded-full pl-11 text-base sm:text-sm")}
              />
            </div>
          </div>
          {naLista.length > 0 && (
            <ul className="max-h-[26rem] divide-y overflow-y-auto border-t" aria-label="Resultados da busca">
              {naLista.map((i) => {
                const q = noCarrinho.get(i.id);
                const semSaldo = i.saldo !== null && i.saldo <= 0;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => adicionar(i.id)}
                      aria-label={`Adicionar ${i.nome}${q ? `, já tem ${quantos(q)} na venda` : ""}`}
                      className="flex w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left transition-colors duration-(--duracao-estado) hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:pl-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-foreground">{i.nome}</span>
                        <span className={cn("block text-xs font-semibold", semSaldo ? "text-status-warn" : "text-muted-foreground")}>
                          {i.codigo && `${i.codigo} · `}
                          {i.saldo === null ? "Serviço" : semSaldo ? "Sem estoque" : `${quantos(i.saldo)} em estoque`}
                        </span>
                      </span>
                      <span className="shrink-0 text-[15px] font-extrabold text-foreground tabular-nums">{reaisDeCentavos(paraCentavos(i.preco))}</span>
                      <span aria-hidden="true" className="relative grid size-11 shrink-0 place-items-center rounded-full bg-muted text-primary">
                        <Plus className="size-5" strokeWidth={2.6} />
                        {q ? (
                          <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-primary-foreground tabular-nums">
                            {quantos(q)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {codigoSemItem ? (
            <p role="status" className="border-t px-5 py-4 text-sm text-muted-foreground">
              Nenhum item à venda com o código {codigoSemItem}.
            </p>
          ) : (
            termo &&
            filtrados.length === 0 && <p className="border-t px-5 py-4 text-sm text-muted-foreground">Nenhum item encontrado. Só aparecem itens com preço oficial.</p>
          )}
          {filtrados.length > MAX_NA_LISTA && (
            <p className="border-t px-5 py-3 text-xs text-muted-foreground">
              Mostrando {MAX_NA_LISTA} de {filtrados.length}. Busque pelo nome ou pelo código para achar os outros.
            </p>
          )}
        </Superficie>

        <section aria-labelledby="titulo-carrinho">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 id="titulo-carrinho" className="text-[17px] font-bold text-foreground">
              Na venda
            </h2>
            {unidades > 0 && (
              <span className="text-sm text-muted-foreground">
                {quantos(unidades)} {unidades === 1 ? "item" : "itens"}
              </span>
            )}
          </div>
          {linhasCalc.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-input px-4 py-4 text-sm text-muted-foreground">Toque em um item da lista para adicionar.</p>
          ) : (
            <ul className="space-y-2" aria-label="Carrinho">
              {linhasCalc.map((l, idx) => (
                <li key={l.itemId} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card py-2.5 pr-2 pl-4 sm:gap-x-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-foreground">{l.item.nome}</p>
                    <p className="text-[13px] text-muted-foreground tabular-nums">
                      {l.valida ? `${quantos(l.q)} × ` : ""}
                      {reaisDeCentavos(l.preco)}
                      {l.ajuste && (
                        <>
                          {" "}
                          <s className="opacity-70">{reaisDeCentavos(l.oficial)}</s>
                          <span className="sr-only"> (preço do catálogo)</span>
                        </>
                      )}
                      <span className="sr-only"> por {l.item.unidade.toLowerCase()}</span>
                      {l.valida && (
                        <>
                          {" = "}
                          <span className="font-semibold text-foreground">{reaisDeCentavos(l.subtotal)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div role="group" aria-label={`Quantidade de ${l.item.nome}`} className="flex items-center gap-0.5 rounded-full bg-muted p-[3px]">
                    <button type="button" aria-label="Diminuir" onClick={() => mudarQuantidade(idx, -1)} className={classeDoBotao("fantasma", "icone-sm", "bg-card text-foreground hover:bg-card")}>
                      <Minus aria-hidden="true" />
                    </button>
                    <input
                      inputMode="decimal"
                      aria-label={`Quantidade de ${l.item.nome}`}
                      value={l.quantidade}
                      aria-invalid={l.valida ? undefined : true}
                      onChange={(e) => setLinhas(linhas.map((x, j) => (j === idx ? { ...x, quantidade: e.target.value } : x)))}
                      className="w-10 bg-transparent text-center sm:w-12 text-sm font-extrabold text-foreground tabular-nums outline-none aria-invalid:text-status-danger"
                    />
                    <button type="button" aria-label="Aumentar" onClick={() => mudarQuantidade(idx, 1)} className={classeDoBotao("fantasma", "icone-sm", "bg-card text-foreground hover:bg-card")}>
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover ${l.item.nome}`}
                    onClick={() => setLinhas(linhas.filter((_, j) => j !== idx))}
                    className={classeDoBotao("fantasma", "icone-sm", "text-status-danger hover:bg-status-danger-bg")}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                  {/* SPEC-017: observações e botões dos ajustes, numa linha própria (cabe no celular) */}
                  <div className="basis-full space-y-0.5 empty:hidden">
                    {l.ajuste && <p className="text-xs font-semibold text-status-warn">Preço ajustado: {l.ajuste.motivo}</p>}
                    {l.materiais && (
                      <p className="text-xs font-semibold text-status-warn">
                        Materiais ajustados: {l.usados.map((m) => `${quantos(m.usado)} ${m.nome}`).join(", ")}
                      </p>
                    )}
                    {((ajustaMateriais && l.item.tipo === "SERVICO" && l.item.materiais.length > 0) || ajustaPreco) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {ajustaMateriais && l.item.tipo === "SERVICO" && l.item.materiais.length > 0 && (
                          <button type="button" onClick={() => setEditando({ tipo: "materiais", itemId: l.itemId })} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
                            Editar materiais<span className="sr-only"> de {l.item.nome}</span>
                          </button>
                        )}
                        {ajustaPreco && (
                          <button type="button" onClick={() => setEditando({ tipo: "preco", itemId: l.itemId })} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
                            Editar preço<span className="sr-only"> de {l.item.nome}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {semEstoque.length > 0 && (
            <p role="alert" className="mt-3 rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
              <span aria-hidden="true">▲ </span>
              Estoque insuficiente: {semEstoque.map((s) => `${s.nome} (há ${quantos(s.saldo)})`).join(", ")}.
            </p>
          )}
        </section>

        <Superficie aria-labelledby="titulo-cliente">
          <TituloDaSuperficie id="titulo-cliente" titulo="Cliente" descricao="Opcional." />
          {!novoCliente ? (
            <div className="flex flex-wrap gap-3">
              <label htmlFor="cliente" className="sr-only">
                Cliente
              </label>
              <select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`${classeDoCampo()} min-w-0 flex-1 basis-48`}>
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setNovoCliente(true)} className={classeDoBotao("secundario")}>
                <UserPlus aria-hidden="true" />
                Novo cliente
              </button>
              {faltando.length > 0 && (
                <p role="status" className="w-full rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
                  <span aria-hidden="true">▲ </span>
                  Faltam dados para a nota fiscal deste cliente: {faltando.join(", ")}.
                  {podeEditarClientes && (
                    <>
                      {" "}
                      <Link
                        href={`/vendas/clientes/${clienteId}/editar`}
                        target="_blank"
                        rel="noopener"
                        aria-label="Completar o cadastro do cliente (abre em outra aba)"
                        className={classeDoLink("text-status-warn underline")}
                      >
                        Completar
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          ) : (
            <FormularioCliente
              modo="venda"
              aoCriar={(c) => {
                setClientes((cs) => [...cs, c].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
                setClienteId(c.id);
                setNovoCliente(false);
              }}
              aoCancelar={() => setNovoCliente(false)}
            />
          )}
        </Superficie>
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Superficie aria-labelledby="titulo-pagamento">
          <TituloDaSuperficie id="titulo-pagamento" titulo={troca ? "Pagamento da diferença" : "Como vai pagar?"} />

          {acimaDoLimite && troca && (
            <p role="alert" className="mb-3 rounded-lg bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
              A troca precisa ter valor menor ou igual a {reaisDeCentavos(troca.limiteCentavos)}.
            </p>
          )}

          {pagamentos.length > 0 && (
            <ul className="space-y-4" aria-label="Formas de pagamento">
              {efetivos.map((p, n) => {
                const valor = digitado(p);
                return (
                  <li key={p.chave} className={cn("space-y-2.5", n > 0 && "border-t pt-4")}>
                    <fieldset>
                      <legend className="sr-only">Forma de pagamento{pagamentos.length > 1 ? ` ${n + 1}` : ""}</legend>
                      <div className="flex items-center gap-2">
                        <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-full bg-muted p-1">
                          {Object.entries(FORMAS_DE_PAGAMENTO).map(([v, r]) => (
                            <label
                              key={v}
                              className="relative grid h-10 cursor-pointer place-items-center rounded-full px-1 text-[13px] font-bold text-foreground transition-colors duration-(--duracao-estado) hover:bg-accent has-checked:bg-estrutura has-checked:text-estrutura-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring sm:text-sm"
                            >
                              <input
                                type="radio"
                                name={`forma-${p.chave}`}
                                value={v}
                                checked={p.forma === v}
                                onChange={() => mudarPagamento(p.chave, { forma: v as FormaDePagamento, parcelas: 1 })}
                                className="sr-only"
                              />
                              {r}
                            </label>
                          ))}
                        </div>
                        {(pagamentos.length > 1 || troca) && (
                          <button
                            type="button"
                            aria-label="Remover forma de pagamento"
                            onClick={() => setPagamentos(pagamentos.filter((x) => x.chave !== p.chave))}
                            className={classeDoBotao("fantasma", "icone-sm", "text-status-danger hover:bg-status-danger-bg")}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </fieldset>
                    <div className="flex gap-2">
                      <label className="sr-only" htmlFor={`valor-${p.chave}`}>
                        Valor
                      </label>
                      <input
                        id={`valor-${p.chave}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={p.valor}
                        onChange={(e) => mudarPagamento(p.chave, { valor: e.target.value, auto: false })}
                        onFocus={(e) => p.auto && e.currentTarget.select()}
                        className={`${classeDoCampo()} min-w-0 flex-1 tabular-nums`}
                      />
                      <button type="button" onClick={() => preencherRestante(p.chave)} disabled={total === 0} className={classeDoBotao("secundario")}>
                        Restante
                      </button>
                    </div>
                    {p.forma === "CREDITO" && (
                      <div>
                        <label className="sr-only" htmlFor={`parcelas-${p.chave}`}>
                          Parcelas
                        </label>
                        <select
                          id={`parcelas-${p.chave}`}
                          value={p.parcelas}
                          onChange={(e) => mudarPagamento(p.chave, { parcelas: Number(e.target.value) })}
                          className={classeDoCampo()}
                        >
                          {Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1).map((k) => (
                            <option key={k} value={k}>
                              {k}x{valor > 0 ? ` de ${reaisDeCentavos(dividirEmParcelas(valor, k)[k - 1])}${valor % k ? " (1ª com centavos a mais)" : ""}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={outraForma}
            className={classeDoBotao("fantasma", "sm", cn("w-full", pagamentos.length > 0 && "mt-3"))}
          >
            <Plus aria-hidden="true" />
            {troca && pagamentos.length === 0 ? "Pagar a diferença" : "Outra forma de pagamento"}
          </button>

          {dinheiro && (
            <div className="mt-4">
              <label htmlFor="recebido" className={rotulo}>
                Valor recebido em dinheiro <span className="font-normal text-muted-foreground">(para o troco)</span>
              </label>
              <input id="recebido" inputMode="decimal" value={recebido} onChange={(e) => setRecebido(e.target.value)} className={`${classeDoCampo()} tabular-nums`} />
              {trocoCentavos !== null && trocoCentavos > 0 && <p className="mt-1.5 text-sm font-semibold text-foreground">Troco: {reaisDeCentavos(trocoCentavos)}</p>}
            </div>
          )}

          {troca ? (
            <div className="mt-5 space-y-3 border-t pt-4">
              <p className="text-sm font-bold text-foreground">Cancelamento da venda nº {troca.numero}</p>
              <div>
                <label htmlFor="motivo" className={rotulo}>
                  Motivo
                </label>
                <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeDoCampo(erroDe("motivo"))}>
                  {Object.entries(MOTIVOS_CANCELAMENTO).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="detalhe" className={rotulo}>
                  Detalhe {motivo === "OUTRO" ? "(obrigatório)" : "(opcional)"}
                </label>
                <input id="detalhe" maxLength={200} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} className={classeDoCampo(erroDe("detalhe"))} />
                <MensagemDeCampo id="detalhe-erro" erro={erroDe("detalhe")} />
              </div>
              {reembolso > 0 && (
                <div>
                  <label htmlFor="formaReembolso" className={rotulo}>
                    Devolver {reaisDeCentavos(reembolso)} em
                  </label>
                  <select id="formaReembolso" value={formaReembolso} onChange={(e) => setFormaReembolso(e.target.value)} className={classeDoCampo(erroDe("formaReembolso"))}>
                    <option value="">Selecione…</option>
                    {Object.entries(FORMAS_DE_REEMBOLSO).map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <MensagemDeCampo id="formaReembolso-erro" erro={erroDe("formaReembolso")} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 border-t pt-4">
              <label htmlFor="dia" className={rotulo}>
                Data da venda
              </label>
              <input
                id="dia"
                type="date"
                value={dia}
                max={hoje}
                min={somarDias(hoje, -DIAS_RETROATIVOS)}
                onChange={(e) => setDia(e.target.value)}
                className={classeDoCampo()}
              />
            </div>
          )}
        </Superficie>

        <Superficie tom="estrutura" aria-label="Resumo da venda">
          {troca && (
            <dl className="mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-estrutura-suave">Limite (venda nº {troca.numero})</dt>
                <dd className="font-semibold tabular-nums">{reaisDeCentavos(troca.limiteCentavos)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-estrutura-suave">Crédito de troca</dt>
                <dd className="font-semibold tabular-nums">− {reaisDeCentavos(credito)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-estrutura-suave">A pagar agora</dt>
                <dd className="font-bold tabular-nums">{reaisDeCentavos(Math.max(0, total - credito))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-estrutura-suave">A devolver</dt>
                <dd className="font-bold tabular-nums">{reaisDeCentavos(reembolso)}</dd>
              </div>
              <p className="pt-1 text-xs text-estrutura-suave">
                Já recebido na venda original: {reaisDeCentavos(troca.recebidoCentavos)}. O crédito usa até esse valor; o que sobrar é devolvido.
              </p>
            </dl>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-estrutura-suave">Total</span>
            <span className="text-[30px] leading-none font-extrabold tracking-tight tabular-nums">{reaisDeCentavos(total)}</span>
          </div>
          <p className={cn("mt-2 text-right text-sm font-semibold", falta === 0 && total > 0 ? "text-ambar" : "text-estrutura-suave")} aria-live="polite">
            {situacao}
          </p>

          <form action={executar} className="mt-4">
            <input type="hidden" name="carrinho" value={carrinhoJson} />
            {troca && (
              <>
                <input type="hidden" name="vendaId" value={troca.vendaId} />
                <input type="hidden" name="motivo" value={motivo} />
                <input type="hidden" name="detalhe" value={detalhe} />
                <input type="hidden" name="formaReembolso" value={reembolso > 0 ? formaReembolso : ""} />
              </>
            )}
            <button
              type="submit"
              disabled={!podeFinalizar || enviando}
              className={classeDoBotao("ambar", "lg", "h-auto min-h-13 w-full py-3 font-extrabold whitespace-normal disabled:bg-estrutura-foreground/15 disabled:text-estrutura-suave disabled:opacity-100")}
            >
              {enviando ? "Registrando…" : troca ? `Cancelar a venda nº ${troca.numero} e registrar a troca` : "Finalizar venda"}
            </button>
          </form>
        </Superficie>
      </aside>
    </div>
  );
}
