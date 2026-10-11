"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { lerNumero } from "@/lib/dominio/catalogo";
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
import { acaoCadastrarCliente, acaoRegistrarVenda, acaoTrocarVenda } from "@/lib/vendas/acoes";
import { VENDA_INICIAL, type EstadoDoCliente } from "@/lib/vendas/servicos";

export type ItemDaFrente = {
  id: string;
  nome: string;
  tipo: "PRODUTO_FISICO" | "SERVICO";
  unidade: string;
  preco: number;
  saldo: number | null;
  materiais: { materialId: string; nome: string; quantidade: number; saldo: number }[];
};
type Cliente = { id: string; nome: string; contato: string | null };
type Linha = { itemId: string; quantidade: string };
type Pagamento = { chave: number; forma: FormaDePagamento; valor: string; parcelas: number };

/** Modo troca (SPEC-011, OPEN-004): a venda original, o limite e o que já foi recebido. */
export type TrocaDaFrente = { vendaId: string; numero: number; limiteCentavos: number; recebidoCentavos: number };

const botao =
  "rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";
const secundario = "rounded-xl border border-input px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50";
const cartao = "rounded-2xl border bg-card p-5 shadow-sm";
const reaisCampo = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

/** Frente de caixa (SPEC-008, 5.1): monta a venda; o servidor recalcula e valida tudo (5.2). */
export function FrenteDeCaixa({ itens, clientes: clientesIniciais, hoje, troca }: { itens: ItemDaFrente[]; clientes: Cliente[]; hoje: string; troca?: TrocaDaFrente }) {
  // Na troca, a ação é a de cancelar e trocar; os estados de erro têm a mesma forma e o sucesso redireciona.
  const [estado, executar, enviando] = useActionState(troca ? (acaoTrocarVenda as unknown as typeof acaoRegistrarVenda) : acaoRegistrarVenda, VENDA_INICIAL);
  // Identificador do carrinho = id da venda: reenviar o mesmo carrinho não cria outra venda (INV-009).
  const [carrinhoId] = useState(() => crypto.randomUUID());
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [clientes, setClientes] = useState(clientesIniciais);
  const [clienteId, setClienteId] = useState("");
  const [novoCliente, setNovoCliente] = useState(false);
  const [dia, setDia] = useState(hoje);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(troca ? [] : [{ chave: 1, forma: "PIX", valor: "", parcelas: 1 }]);
  const [recebido, setRecebido] = useState("");
  const [motivo, setMotivo] = useState("TROCA");
  const [detalhe, setDetalhe] = useState("");
  const [formaReembolso, setFormaReembolso] = useState("");

  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const encontrados = busca.trim()
    ? itens.filter((i) => i.nome.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 8)
    : [];

  const linhasCalc = linhas.map((l) => {
    const item = porId.get(l.itemId)!;
    const q = lerNumero(l.quantidade);
    const valida = q !== null && q > 0;
    return { ...l, item, q: valida ? q : 0, valida, subtotal: valida ? subtotalEmCentavos(paraCentavos(item.preco), q) : 0 };
  });
  const total = linhasCalc.reduce((s, l) => s + l.subtotal, 0);
  const pago = pagamentos.reduce((s, p) => s + paraCentavos(lerNumero(p.valor) ?? 0), 0);
  // Troca (RN26): o crédito cobre até o recebido; os pagamentos são só o restante.
  const acerto = troca ? acertoDoCancelamento(troca.recebidoCentavos, total) : null;
  const credito = acerto?.creditoCentavos ?? 0;
  const reembolso = acerto?.reembolsoCentavos ?? 0;
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
    else for (const m of l.item.materiais) somar(m.materialId, m.nome, l.q * m.quantidade, m.saldo);
  }
  const semEstoque = [...consumo.values()].filter((c) => c.pedido > c.saldo + 1e-9);

  const cancelamentoOk = !troca || ((motivo !== "OUTRO" || detalhe.trim().length > 0) && (reembolso === 0 || formaReembolso !== ""));
  const podeFinalizar =
    linhas.length > 0 &&
    linhasCalc.every((l) => l.valida) &&
    total > 0 &&
    falta === 0 &&
    pagamentos.every((p) => (lerNumero(p.valor) ?? 0) > 0) &&
    semEstoque.length === 0 &&
    !acimaDoLimite &&
    cancelamentoOk;

  const dinheiro = pagamentos.find((p) => p.forma === "DINHEIRO");
  const trocoCentavos = dinheiro && recebido ? troco(paraCentavos(lerNumero(recebido) ?? 0), paraCentavos(lerNumero(dinheiro.valor) ?? 0)) : null;

  function adicionar(id: string) {
    setLinhas((ls) => (ls.some((l) => l.itemId === id) ? ls : [...ls, { itemId: id, quantidade: "1" }]));
    setBusca("");
  }
  function preencherRestante(chave: number) {
    setPagamentos((ps) => {
      const outros = ps.filter((p) => p.chave !== chave).reduce((s, p) => s + paraCentavos(lerNumero(p.valor) ?? 0), 0);
      return ps.map((p) => (p.chave === chave ? { ...p, valor: reaisCampo(Math.max(0, total - credito - outros)) } : p));
    });
  }

  const carrinhoJson = JSON.stringify({
    id: carrinhoId,
    dia,
    clienteId: clienteId || null,
    linhas: linhasCalc.map((l) => ({ itemId: l.itemId, quantidade: l.quantidade, precoVisto: l.item.preco })),
    pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: p.valor, parcelas: p.forma === "CREDITO" ? p.parcelas : 1 })),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {estado.status === "erro" && (estado.mensagem || estado.erros) && (
          <Aviso tipo="erro">{estado.mensagem ?? Object.values(estado.erros ?? {}).filter(Boolean)[0]}</Aviso>
        )}

        <section className={cartao} aria-labelledby="titulo-itens">
          <h2 id="titulo-itens" className="mb-3 font-display text-xl font-semibold text-card-foreground">
            Itens
          </h2>
          <label htmlFor="busca-item" className="sr-only">
            Buscar item
          </label>
          <input
            id="busca-item"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={itens.length ? "Buscar produto ou serviço…" : "Nenhum item com preço oficial no catálogo"}
            disabled={!itens.length}
            autoComplete="off"
            className={classeDoCampo()}
          />
          {encontrados.length > 0 && (
            <ul className="mt-2 divide-y rounded-xl border" aria-label="Resultados da busca">
              {encontrados.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => adicionar(i.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted">
                    <span className="min-w-0 truncate font-medium text-foreground">{i.nome}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {reaisDeCentavos(paraCentavos(i.preco))}
                      {i.saldo !== null && ` · ${i.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} em estoque`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busca.trim() && encontrados.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum item encontrado. Só aparecem itens com preço oficial.</p>}

          {linhasCalc.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Carrinho">
              {linhasCalc.map((l, idx) => (
                <li key={l.itemId} className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-medium text-foreground">{l.item.nome}</p>
                    <p className="text-xs text-muted-foreground">{reaisDeCentavos(paraCentavos(l.item.preco))} / {l.item.unidade}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="sr-only">Quantidade de {l.item.nome}</span>
                    <input
                      inputMode="decimal"
                      value={l.quantidade}
                      aria-invalid={l.valida ? undefined : true}
                      onChange={(e) => setLinhas(linhas.map((x, j) => (j === idx ? { ...x, quantidade: e.target.value } : x)))}
                      className="w-20 rounded-lg border border-input bg-card px-2 py-1.5 text-right text-sm text-foreground"
                    />
                  </label>
                  <span className="w-24 text-right text-sm font-semibold text-foreground">{reaisDeCentavos(l.subtotal)}</span>
                  <button type="button" onClick={() => setLinhas(linhas.filter((_, j) => j !== idx))} className="text-sm font-medium text-destructive underline-offset-2 hover:underline">
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
          {semEstoque.length > 0 && (
            <p role="alert" className="mt-3 rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
              <span aria-hidden="true">▲ </span>
              Estoque insuficiente:{" "}
              {semEstoque.map((s) => `${s.nome} (há ${s.saldo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })})`).join(", ")}.
            </p>
          )}
        </section>

        <section className={cartao} aria-labelledby="titulo-cliente">
          <h2 id="titulo-cliente" className="mb-3 font-display text-xl font-semibold text-card-foreground">
            Cliente <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
          </h2>
          {!novoCliente ? (
            <div className="flex flex-wrap gap-3">
              <label htmlFor="cliente" className="sr-only">
                Cliente
              </label>
              <select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`${classeDoCampo()} min-w-0 flex-1`}>
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.contato ? ` · ${c.contato}` : ""}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setNovoCliente(true)} className={secundario}>
                Novo cliente
              </button>
            </div>
          ) : (
            <NovoCliente
              aoCriar={(c) => {
                setClientes((cs) => [...cs, c].sort((a, b) => a.nome.localeCompare(b.nome)));
                setClienteId(c.id);
                setNovoCliente(false);
              }}
              aoCancelar={() => setNovoCliente(false)}
            />
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <section className={cartao} aria-labelledby="titulo-pagamento">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="titulo-pagamento" className="font-display text-xl font-semibold text-card-foreground">
              Total
            </h2>
            <p className="text-2xl font-semibold text-foreground">{reaisDeCentavos(total)}</p>
          </div>

          {troca && (
            <dl className="mb-4 space-y-1 rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Limite (venda nº {troca.numero})</dt>
                <dd className="font-medium text-foreground">{reaisDeCentavos(troca.limiteCentavos)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Crédito de troca</dt>
                <dd className="font-medium text-foreground">− {reaisDeCentavos(credito)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">A pagar agora</dt>
                <dd className="font-semibold text-foreground">{reaisDeCentavos(Math.max(0, total - credito))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">A devolver</dt>
                <dd className="font-semibold text-foreground">{reaisDeCentavos(reembolso)}</dd>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Já recebido na venda original: {reaisDeCentavos(troca.recebidoCentavos)}. O crédito usa até esse valor; o que sobrar é devolvido.
              </p>
            </dl>
          )}
          {acimaDoLimite && troca && (
            <p role="alert" className="mb-3 rounded-xl border border-status-danger/30 bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
              A troca precisa ter valor menor ou igual a {reaisDeCentavos(troca.limiteCentavos)}.
            </p>
          )}

          <ul className="space-y-3" aria-label="Formas de pagamento">
            {pagamentos.map((p) => {
              const valor = paraCentavos(lerNumero(p.valor) ?? 0);
              return (
                <li key={p.chave} className="space-y-2 rounded-xl border p-3">
                  <div className="flex gap-2">
                    <label className="sr-only" htmlFor={`forma-${p.chave}`}>
                      Forma de pagamento
                    </label>
                    <select
                      id={`forma-${p.chave}`}
                      value={p.forma}
                      onChange={(e) => setPagamentos(pagamentos.map((x) => (x.chave === p.chave ? { ...x, forma: e.target.value as FormaDePagamento, parcelas: 1 } : x)))}
                      className={`${classeDoCampo()} min-w-0 flex-1`}
                    >
                      {Object.entries(FORMAS_DE_PAGAMENTO).map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {(pagamentos.length > 1 || troca) && (
                      <button
                        type="button"
                        aria-label="Remover forma de pagamento"
                        onClick={() => setPagamentos(pagamentos.filter((x) => x.chave !== p.chave))}
                        className="px-2 text-sm font-medium text-destructive"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <label className="sr-only" htmlFor={`valor-${p.chave}`}>
                      Valor
                    </label>
                    <input
                      id={`valor-${p.chave}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={p.valor}
                      onChange={(e) => setPagamentos(pagamentos.map((x) => (x.chave === p.chave ? { ...x, valor: e.target.value } : x)))}
                      className={`${classeDoCampo()} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={() => preencherRestante(p.chave)} disabled={total === 0} className={secundario}>
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
                        onChange={(e) => setPagamentos(pagamentos.map((x) => (x.chave === p.chave ? { ...x, parcelas: Number(e.target.value) } : x)))}
                        className={classeDoCampo()}
                      >
                        {Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}x{valor > 0 ? ` de ${reaisDeCentavos(dividirEmParcelas(valor, n)[n - 1])}${valor % n ? " (1ª com centavos a mais)" : ""}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setPagamentos([...pagamentos, { chave: Math.max(0, ...pagamentos.map((p) => p.chave)) + 1, forma: troca ? "PIX" : "DINHEIRO", valor: "", parcelas: 1 }])}
            className={`${secundario} mt-3 w-full`}
          >
            {troca && pagamentos.length === 0 ? "+ Pagar a diferença" : "+ Outra forma de pagamento"}
          </button>

          <p className={`mt-4 text-sm font-medium ${falta === 0 && total > 0 ? "text-status-ok" : "text-muted-foreground"}`} aria-live="polite">
            {total === 0
              ? "Adicione itens ao carrinho."
              : falta === 0
                ? troca && pago === 0
                  ? "Coberto pelo crédito de troca."
                  : "Pagamento completo."
                : falta > 0
                  ? `Falta ${reaisDeCentavos(falta)}`
                  : `Pagamento passou ${reaisDeCentavos(-falta)} do total`}
          </p>

          {dinheiro && (
            <div className="mt-3">
              <label htmlFor="recebido" className="text-sm font-medium text-foreground">
                Valor recebido em dinheiro <span className="font-normal text-muted-foreground">(para o troco)</span>
              </label>
              <input id="recebido" inputMode="decimal" value={recebido} onChange={(e) => setRecebido(e.target.value)} className={`${classeDoCampo()} mt-1.5`} />
              {trocoCentavos !== null && trocoCentavos > 0 && <p className="mt-1.5 text-sm font-semibold text-foreground">Troco: {reaisDeCentavos(trocoCentavos)}</p>}
            </div>
          )}

          {troca ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              <p className="text-sm font-semibold text-foreground">Cancelamento da venda nº {troca.numero}</p>
              <div>
                <label htmlFor="motivo" className="text-sm font-medium text-foreground">
                  Motivo
                </label>
                <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${classeDoCampo(erroDe("motivo"))} mt-1.5`}>
                  {Object.entries(MOTIVOS_CANCELAMENTO).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="detalhe" className="text-sm font-medium text-foreground">
                  Detalhe {motivo === "OUTRO" ? "(obrigatório)" : "(opcional)"}
                </label>
                <input id="detalhe" maxLength={200} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} className={`${classeDoCampo(erroDe("detalhe"))} mt-1.5`} />
                <MensagemDeCampo id="detalhe-erro" erro={erroDe("detalhe")} />
              </div>
              {reembolso > 0 && (
                <div>
                  <label htmlFor="formaReembolso" className="text-sm font-medium text-foreground">
                    Devolver {reaisDeCentavos(reembolso)} em
                  </label>
                  <select id="formaReembolso" value={formaReembolso} onChange={(e) => setFormaReembolso(e.target.value)} className={`${classeDoCampo(erroDe("formaReembolso"))} mt-1.5`}>
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
            <div className="mt-4">
              <label htmlFor="dia" className="text-sm font-medium text-foreground">
                Data da venda
              </label>
              <input
                id="dia"
                type="date"
                value={dia}
                max={hoje}
                min={somarDias(hoje, -DIAS_RETROATIVOS)}
                onChange={(e) => setDia(e.target.value)}
                className={`${classeDoCampo()} mt-1.5`}
              />
            </div>
          )}

          <form action={executar} className="mt-5">
            <input type="hidden" name="carrinho" value={carrinhoJson} />
            {troca && (
              <>
                <input type="hidden" name="vendaId" value={troca.vendaId} />
                <input type="hidden" name="motivo" value={motivo} />
                <input type="hidden" name="detalhe" value={detalhe} />
                <input type="hidden" name="formaReembolso" value={reembolso > 0 ? formaReembolso : ""} />
              </>
            )}
            <button type="submit" disabled={!podeFinalizar || enviando} className={`${botao} w-full py-3.5`}>
              {enviando
                ? "Registrando…"
                : troca
                  ? `Cancelar a venda nº ${troca.numero} e registrar a troca`
                  : `Finalizar venda${total ? ` · ${reaisDeCentavos(total)}` : ""}`}
            </button>
          </form>
        </section>
      </aside>
    </div>
  );
}

function NovoCliente({ aoCriar, aoCancelar }: { aoCriar: (c: Cliente) => void; aoCancelar: () => void }) {
  const [estado, executar, enviando] = useActionState<EstadoDoCliente, FormData>(acaoCadastrarCliente, { status: "ocioso" });
  useEffect(() => {
    if (estado.status === "criado") aoCriar(estado.cliente);
    // aoCriar muda a cada renderização do pai; o efeito só deve rodar quando o estado muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  const erros = estado.status === "erro" ? estado.erros : {};
  return (
    <form action={executar} className="space-y-3">
      <div>
        <label htmlFor="nome-cliente" className="text-sm font-medium text-foreground">
          Nome
        </label>
        <input
          id="nome-cliente"
          name="nome"
          maxLength={120}
          aria-invalid={erros.nome ? true : undefined}
          aria-describedby={erros.nome ? "nome-cliente-erro" : undefined}
          className={`${classeDoCampo(erros.nome)} mt-1.5`}
        />
        <MensagemDeCampo id="nome-cliente-erro" erro={erros.nome} />
      </div>
      <div>
        <label htmlFor="contato-cliente" className="text-sm font-medium text-foreground">
          Contato <span className="font-normal text-muted-foreground">(opcional — telefone ou e-mail)</span>
        </label>
        <input id="contato-cliente" name="contato" maxLength={120} className={`${classeDoCampo(erros.contato)} mt-1.5`} />
        <MensagemDeCampo id="contato-cliente-erro" erro={erros.contato} />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={enviando} className={botao}>
          Cadastrar cliente
        </button>
        <button type="button" onClick={aoCancelar} className={secundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
