"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { CategoriaItem, TipoItem } from "@/generated/prisma/enums";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { avisar } from "@/components/ui/avisar";
import { Package, Plus, Sparkles } from "lucide-react";
import { classeDoCampo } from "@/components/ui/classes";
import { classeDoBotao, classeDoLink } from "@/components/ui/estilos";
import { Superficie } from "@/components/ui/superficie";
import { acaoCriarItem, acaoDefinirPreco, acaoEditarItem } from "@/lib/catalogo/acoes";
import { ITEM_INICIAL, PRECO_INICIAL, type EstadoDoItem } from "@/lib/catalogo/servicos";
import { CATEGORIAS, validarItem, validarPreco } from "@/lib/catalogo/validacao";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { custoTotal, lerNumero, MAX_CODIGO, UNIDADES } from "@/lib/dominio/catalogo";
import { comRetorno } from "@/lib/estrutura/retorno";
import { cn } from "@/lib/utils";
import { CampoNcm, type NcmConhecido } from "./campo-ncm";
import { numero, reais, ROTULO_CATEGORIA, ROTULO_TIPO, rotuloUnidade } from "./rotulos";
import type { OpcaoDeSubcategoria } from "./subcategorias";

// A gaveta "Nova subcategoria" (Radix Dialog) só é baixada no primeiro toque no botão: o cadastro
// do item não paga por ela à toa (SPEC-016, seção 10; mesmo padrão da dica da N8).
const GavetaNovaSubcategoria = dynamic(() => import("./subcategorias").then((m) => m.GavetaNovaSubcategoria), { ssr: false });

export type OpcaoDeMaterial = { id: string; nome: string; unidadeMedida: string; custo: number };

export type ValoresDoItem = {
  id?: string;
  tipo?: TipoItem;
  nome?: string;
  /** SPEC-024: o código interno gravado. */
  codigo?: string | null;
  categoria?: string;
  subcategoriaId?: string | null;
  /** SPEC-021: o NCM gravado, com a descrição e se ainda está na tabela vigente. */
  ncm?: NcmConhecido | null;
  unidadeMedida?: string;
  custoBase?: number;
  comissaoPercentual?: number | null;
  estoqueMinimo?: number | null;
  materiais?: { materialId: string; quantidade: number }[];
};

type Linha = { materialId: string; quantidade: string };

function Rotulo({ htmlFor, children, ajuda }: { htmlFor: string; children: React.ReactNode; ajuda?: string }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {children}
      </label>
      {ajuda && <p className="mt-0.5 text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

function CampoTexto({
  nome,
  rotulo,
  ajuda,
  erro,
  limpar,
  ...props
}: Omit<React.ComponentProps<"input">, "id" | "name"> & { nome: string; rotulo: string; ajuda?: string; erro?: string; limpar: (c: string) => void }) {
  return (
    <div>
      <Rotulo htmlFor={nome} ajuda={ajuda}>
        {rotulo}
      </Rotulo>
      <input
        id={nome}
        name={nome}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${nome}-erro` : undefined}
        onChange={() => limpar(nome)}
        className={classeDoCampo(erro)}
        {...props}
      />
      <MensagemDeCampo id={`${nome}-erro`} erro={erro} />
    </div>
  );
}

function Materiais({
  linhas,
  setLinhas,
  opcoes,
  erro,
}: {
  linhas: Linha[];
  setLinhas: (l: Linha[]) => void;
  opcoes: OpcaoDeMaterial[];
  erro?: string;
}) {
  const [escolhido, setEscolhido] = useState("");
  const disponiveis = opcoes.filter((o) => !linhas.some((l) => l.materialId === o.id));
  const porId = new Map(opcoes.map((o) => [o.id, o]));

  if (opcoes.length === 0 && linhas.length === 0) {
    return (
      <p className="rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
        Para vincular materiais, cadastre-os antes como <strong>Produto físico</strong> no catálogo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {linhas.length > 0 && (
        <ul className="space-y-2" aria-label="Materiais do serviço">
          {linhas.map((l, i) => {
            const m = porId.get(l.materialId);
            return (
              <li key={l.materialId} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-4 py-3">
                <span className="min-w-0 basis-full truncate text-sm font-medium text-foreground sm:basis-auto sm:flex-1">{m?.nome ?? "Material arquivado"}</span>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="sr-only">Quantidade de {m?.nome}</span>
                  <input
                    inputMode="decimal"
                    value={l.quantidade}
                    onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, quantidade: e.target.value } : x)))}
                    className="w-20 rounded-lg border border-input bg-card px-2 py-1.5 text-right text-sm text-foreground"
                  />
                  {m ? rotuloUnidade(m.unidadeMedida) : ""} por execução
                </label>
                <button
                  type="button"
                  onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
                  className="text-sm font-medium text-destructive underline-offset-2 hover:underline"
                >
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {disponiveis.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <label htmlFor="novo-material" className="sr-only">
            Adicionar material
          </label>
          <select
            id="novo-material"
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
            className={`${classeDoCampo()} min-w-0 flex-1`}
          >
            <option value="">Escolha um produto físico…</option>
            {disponiveis.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome} ({reais(o.custo)} / {rotuloUnidade(o.unidadeMedida)})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!escolhido}
            onClick={() => {
              setLinhas([...linhas, { materialId: escolhido, quantidade: "1" }]); // RF13: sugestão de 1
              setEscolhido("");
            }}
            className={classeDoBotao("secundario")}
          >
            <Plus aria-hidden="true" />
            Adicionar
          </button>
        </div>
      )}
      <MensagemDeCampo id="materiais-erro" erro={erro} />
    </div>
  );
}

export type SugestoesDeNcm = Record<string, { ncm: string; descricao: string; itens: number }>;

/**
 * Cadastro e edição do item (SPEC-006, 5.1–5.3). Na edição o tipo é fixo (INV-002). A subcategoria
 * (SPEC-020, 5.2) lista só as da categoria escolhida e volta a "Sem subcategoria" quando ela muda.
 * O produto físico tem o NCM (SPEC-021), obrigatório quando o negócio emite nota fiscal de produtos.
 */
export function FormularioItem({
  valores,
  opcoes,
  subcategorias,
  voltar = null,
  exigeNcm = false,
  sugestoesNcm = {},
}: {
  valores?: ValoresDoItem;
  opcoes: OpcaoDeMaterial[];
  subcategorias: OpcaoDeSubcategoria[];
  /** Para onde voltar depois (a lista filtrada de origem); segue para o detalhe ao salvar. */
  voltar?: string | null;
  /** SPEC-021 (RN35): o negócio emite nota fiscal de produtos. */
  exigeNcm?: boolean;
  /** SPEC-021 (OPEN-004): por subcategoria, o NCM mais usado pelos outros itens dela. */
  sugestoesNcm?: SugestoesDeNcm;
}) {
  const editando = !!valores?.id;
  const [categoria, setCategoria] = useState(valores?.categoria ?? "");
  const [subcategoriaId, setSubcategoriaId] = useState(valores?.subcategoriaId ?? "");
  // Criadas aqui pela gaveta: aparecem na hora, antes (ou além) da lista que vem do servidor.
  const [criadas, setCriadas] = useState<OpcaoDeSubcategoria[]>([]);
  const [criandoSubcategoria, setCriandoSubcategoria] = useState(false);
  const [gavetaPedida, setGavetaPedida] = useState(false);
  const campoDaSubcategoria = useRef<HTMLSelectElement>(null);
  const daCategoria = [...subcategorias, ...criadas.filter((c) => !subcategorias.some((s) => s.id === c.id))]
    .filter((s) => s.categoria === categoria)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const [estado, executar, enviando] = useActionState<EstadoDoItem, FormData>(editando ? acaoEditarItem : acaoCriarItem, ITEM_INICIAL);
  const [tipo, setTipo] = useState<TipoItem | null>(valores?.tipo ?? null);
  const [usaMateriais, setUsaMateriais] = useState((valores?.materiais?.length ?? 0) > 0);
  const [linhas, setLinhas] = useState<Linha[]>(
    (valores?.materiais ?? []).map((m) => ({ materialId: m.materialId, quantidade: numero(m.quantidade) })),
  );
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  const limpar = (campo: string) => erros[campo] && setLocais({ ...erros, [campo]: undefined });

  const materiaisJson = JSON.stringify(
    tipo === "SERVICO" && usaMateriais ? linhas.map((l) => ({ materialId: l.materialId, quantidade: l.quantidade })) : [],
  );
  const porId = new Map(opcoes.map((o) => [o.id, o]));
  const [custoDigitado, setCustoDigitado] = useState(valores?.custoBase !== undefined ? numero(valores.custoBase) : "");
  // SPEC-024: controlado, para passar para maiúsculas enquanto a pessoa digita (é como fica gravado).
  const [codigoDigitado, setCodigoDigitado] = useState(valores?.codigo ?? "");
  const custoDosMateriais = custoTotal(
    lerNumero(custoDigitado) ?? 0,
    tipo === "SERVICO" && usaMateriais
      ? linhas.map((l) => ({ custo: porId.get(l.materialId)?.custo ?? 0, quantidade: lerNumero(l.quantidade) ?? 0 }))
      : [],
  );

  /**
   * Envio pela transição, e não pelo `action` do formulário: assim o React não volta os campos ao valor
   * inicial quando o servidor recusa (ex.: nome ou código em uso), e a pessoa não perde o que digitou.
   * Mesmo padrão do formulário de clientes (SPEC-022).
   */
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const v = validarItem(camposDoFormulario(dados), editando ? { tipo: "editar", tipoDoItem: valores!.tipo! } : { tipo: "criar" }, { exigeNcm });
    if (!v.ok) return setLocais(v.erros);
    setLocais({});
    startTransition(() => executar(dados));
  }

  if (!tipo) {
    const opcao =
      "flex w-full items-start gap-4 rounded-2xl bg-card p-5 text-left ring-1 ring-transparent transition-[box-shadow,transform] duration-(--duracao-estado) hover:ring-primary active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
    const icone = "grid size-11 shrink-0 place-items-center rounded-full bg-muted text-primary";
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" className={opcao} onClick={() => setTipo("PRODUTO_FISICO")}>
          <span aria-hidden="true" className={icone}>
            <Package className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-bold text-card-foreground">Produto físico</span>
            <span className="mt-1 block text-sm text-muted-foreground">Algo que você vende ou usa e controla no estoque.</span>
          </span>
        </button>
        <button type="button" className={opcao} onClick={() => setTipo("SERVICO")}>
          <span aria-hidden="true" className={icone}>
            <Sparkles className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-bold text-card-foreground">Serviço</span>
            <span className="mt-1 block text-sm text-muted-foreground">Algo que você executa, com ou sem materiais.</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <Superficie as="div">
      <form onSubmit={aoEnviar} noValidate className="space-y-5">
        {editando && <input type="hidden" name="itemId" value={valores!.id} />}
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="materiais" value={materiaisJson} />
        {voltar && <input type="hidden" name="voltar" value={voltar} />}

        <p className="text-sm text-muted-foreground">
          Tipo: <span className="font-medium text-foreground">{ROTULO_TIPO[tipo]}</span>
          {!editando && (
            <>
              {". "}
              <button type="button" onClick={() => setTipo(null)} className={classeDoLink()}>
                Trocar o tipo
              </button>
            </>
          )}
          {editando && " (não muda depois do cadastro)"}
        </p>
        <MensagemDeCampo id="tipo-erro" erro={erros.tipo} />

        <CampoTexto nome="nome" rotulo="Nome" defaultValue={valores?.nome} maxLength={120} erro={erros.nome} limpar={limpar} />

        {/* SPEC-024 (5.1): opcional, digitado pelo negócio; aparece em maiúsculas, como é gravado (5.2). */}
        <CampoTexto
          nome="codigo"
          rotulo="Código (opcional)"
          ajuda={`Um código seu para achar o item, como o da etiqueta. Até ${MAX_CODIGO} caracteres.`}
          value={codigoDigitado}
          maxLength={MAX_CODIGO}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) => {
            const campo = e.currentTarget;
            const posicao = campo.selectionStart;
            setCodigoDigitado(campo.value.toUpperCase());
            limpar("codigo");
            // Mantém o cursor onde estava ao passar para maiúsculas.
            requestAnimationFrame(() => posicao !== null && campo.setSelectionRange(posicao, posicao));
          }}
          className={cn(classeDoCampo(erros.codigo), "sm:max-w-64")}
          erro={erros.codigo}
          limpar={limpar}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="categoria">Categoria</Rotulo>
            <select
              id="categoria"
              name="categoria"
              value={categoria}
              aria-invalid={erros.categoria ? true : undefined}
              aria-describedby={erros.categoria ? "categoria-erro" : undefined}
              onChange={(e) => {
                setCategoria(e.target.value);
                setSubcategoriaId("");
                if (erros.categoria || erros.subcategoriaId) setLocais({ ...erros, categoria: undefined, subcategoriaId: undefined });
              }}
              className={classeDoCampo(erros.categoria)}
            >
              <option value="">Selecione…</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CATEGORIA[c]}
                </option>
              ))}
            </select>
            <MensagemDeCampo id="categoria-erro" erro={erros.categoria} />
          </div>
          <div>
            <Rotulo htmlFor="unidadeMedida">Unidade de medida</Rotulo>
            <select
              id="unidadeMedida"
              name="unidadeMedida"
              defaultValue={valores?.unidadeMedida ?? (tipo === "SERVICO" ? "atend" : "")}
              aria-invalid={erros.unidadeMedida ? true : undefined}
              aria-describedby={erros.unidadeMedida ? "unidadeMedida-erro" : undefined}
              onChange={() => limpar("unidadeMedida")}
              className={classeDoCampo(erros.unidadeMedida)}
            >
              <option value="">Selecione…</option>
              {Object.entries(UNIDADES).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <MensagemDeCampo id="unidadeMedida-erro" erro={erros.unidadeMedida} />
          </div>
        </div>

        <div>
          <Rotulo htmlFor="subcategoriaId" ajuda="Opcional. Organiza o catálogo; a margem sugerida continua a da categoria.">
            Subcategoria
          </Rotulo>
          <div className="flex flex-wrap gap-2">
            <select
              ref={campoDaSubcategoria}
              id="subcategoriaId"
              name="subcategoriaId"
              value={subcategoriaId}
              disabled={!categoria}
              aria-invalid={erros.subcategoriaId ? true : undefined}
              aria-describedby={erros.subcategoriaId ? "subcategoriaId-erro" : undefined}
              onChange={(e) => {
                setSubcategoriaId(e.target.value);
                limpar("subcategoriaId");
              }}
              className={`${classeDoCampo(erros.subcategoriaId)} min-w-0 flex-1 basis-56`}
            >
              <option value="">{categoria ? "Sem subcategoria" : "Escolha a categoria antes"}</option>
              {daCategoria.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!categoria}
              onClick={() => {
                setGavetaPedida(true);
                setCriandoSubcategoria(true);
              }}
              className={classeDoBotao("secundario")}
            >
              <Plus aria-hidden="true" />
              Nova subcategoria
            </button>
          </div>
          <MensagemDeCampo id="subcategoriaId-erro" erro={erros.subcategoriaId} />
        </div>

        {tipo === "PRODUTO_FISICO" && (
          <CampoNcm
            gravado={valores?.ncm ?? null}
            obrigatorio={exigeNcm}
            sugestao={
              subcategoriaId && sugestoesNcm[subcategoriaId]
                ? { ...sugestoesNcm[subcategoriaId], subcategoria: daCategoria.find((s) => s.id === subcategoriaId)?.nome ?? "esta subcategoria" }
                : null
            }
            erro={erros.ncm}
            limpar={() => limpar("ncm")}
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <CampoTexto
            nome="custoBase"
            rotulo="Custo (R$)"
            ajuda={tipo === "SERVICO" ? "Seu custo para executar, sem os materiais." : "Quanto você paga por unidade."}
            inputMode="decimal"
            placeholder="0,00"
            value={custoDigitado}
            onInput={(e) => setCustoDigitado(e.currentTarget.value)}
            erro={erros.custoBase}
            limpar={limpar}
          />
          <CampoTexto
            nome="comissaoPercentual"
            rotulo="Comissão (%)"
            ajuda="Opcional. Paga a quem vende ou executa."
            inputMode="decimal"
            placeholder="0"
            defaultValue={numero(valores?.comissaoPercentual ?? null)}
            erro={erros.comissaoPercentual}
            limpar={limpar}
          />
        </div>

        {/* Na edição, o mínimo manual fica no Estoque (SPEC-007, OPEN-001). */}
        {tipo === "PRODUTO_FISICO" && !editando && (
          <CampoTexto
            nome="estoqueMinimo"
            rotulo="Estoque mínimo"
            ajuda="Opcional. Depois do primeiro ciclo de entrada e saída, o sistema sugere um valor."
            inputMode="decimal"
            defaultValue={numero(valores?.estoqueMinimo ?? null)}
            erro={erros.estoqueMinimo}
            limpar={limpar}
          />
        )}

        {tipo === "SERVICO" && (
          <fieldset className="space-y-3">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Este serviço usa materiais?</legend>
            <div className="flex gap-6 text-sm text-foreground">
              <label className="flex items-center gap-2">
                <input type="radio" name="usaMateriais" checked={!usaMateriais} onChange={() => setUsaMateriais(false)} className="accent-primary" />
                Não
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="usaMateriais" checked={usaMateriais} onChange={() => setUsaMateriais(true)} className="accent-primary" />
                Sim
              </label>
            </div>
            {usaMateriais && <Materiais linhas={linhas} setLinhas={setLinhas} opcoes={opcoes} erro={erros.materiais} />}
            {usaMateriais && linhas.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Custo total por execução: <span className="font-semibold text-foreground">{reais(custoDosMateriais)}</span>
              </p>
            )}
          </fieldset>
        )}

        {!editando && (
          <CampoTexto
            nome="preco"
            rotulo="Preço de venda (R$)"
            ajuda="Opcional. Sem preço, o item ainda não pode ser vendido; você pode definir depois ou usar a calculadora."
            inputMode="decimal"
            placeholder="0,00"
            erro={erros.preco}
            limpar={limpar}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 border-t pt-5">
          <button type="submit" disabled={enviando} className={classeDoBotao("principal", "lg")}>
            {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar item"}
          </button>
          <Link href={editando ? comRetorno(`/catalogo/${valores!.id}`, voltar) : (voltar ?? "/catalogo")} className={classeDoBotao("fantasma")}>
            Cancelar
          </Link>
        </div>
      </form>
      </Superficie>
      {gavetaPedida && categoria && (
        <GavetaNovaSubcategoria
          aberta={criandoSubcategoria}
          aoMudar={setCriandoSubcategoria}
          categoria={categoria as CategoriaItem}
          categoriaFixa
          focoAoFechar={campoDaSubcategoria}
          aoSalvar={(s) => {
            setCriadas((lista) => [...lista, s]);
            setSubcategoriaId(s.id);
            limpar("subcategoriaId");
            setCriandoSubcategoria(false);
            avisar(`Subcategoria “${s.nome}” criada e escolhida.`);
          }}
        />
      )}
    </div>
  );
}

/** Preço oficial manual (5.4). */
export function FormularioPreco({ itemId }: { itemId: string }) {
  const [estado, executar, enviando] = useActionState(acaoDefinirPreco, PRECO_INICIAL);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  // O campo só é limpo quando o preço foi gravado; recusado, o valor digitado fica (envio pela transição).
  useEffect(() => {
    if (estado.status === "salvo") formulario.current?.reset();
  }, [estado]);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setErroLocal(null);
  }
  const erro = erroLocal ?? (estado.status === "erro" ? (estado.erros?.preco ?? estado.mensagem) : undefined);

  return (
    <div className="space-y-3">
      {estado.status === "salvo" && <Aviso tipo="sucesso">Preço atualizado.</Aviso>}
      {estado.status === "salvo" && estado.aviso && (
        <p role="note" className="rounded-lg bg-status-warn-bg px-4 py-3 text-sm text-status-warn">
          {estado.aviso}
        </p>
      )}
      <form
        ref={formulario}
        onSubmit={(e) => {
          e.preventDefault();
          const dados = new FormData(e.currentTarget);
          const v = validarPreco(camposDoFormulario(dados));
          if (!v.ok) return setErroLocal(v.erros.preco ?? null);
          startTransition(() => executar(dados));
        }}
        noValidate
        className="flex flex-wrap items-start gap-3"
      >
        <input type="hidden" name="itemId" value={itemId} />
        <div className="min-w-0 flex-1">
          <label htmlFor="preco" className="sr-only">
            Novo preço (R$)
          </label>
          <input
            id="preco"
            name="preco"
            inputMode="decimal"
            placeholder="Novo preço (R$)"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "preco-erro" : undefined}
            onChange={() => setErroLocal(null)}
            className={classeDoCampo(erro)}
          />
          <MensagemDeCampo id="preco-erro" erro={erro} />
        </div>
        <button type="submit" disabled={enviando} className={classeDoBotao("principal")}>
          {enviando ? "Salvando…" : "Definir preço"}
        </button>
      </form>
    </div>
  );
}
