"use client";

import dynamic from "next/dynamic";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { DialogoDeConfirmacao, useConfirmacaoDoEnvio } from "@/components/ui/confirmacao";
import { enviarSemReiniciar } from "@/components/ui/envio";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { FORMAS_DO_PAGAMENTO, MAX_NUMERO_DOCUMENTO, ROTULO_FORMA, SEM_OPCOES, type OpcaoDePessoa, type OpcoesDoVinculo } from "@/lib/dominio/contas";
import { MENSAGENS_DAS_CORRECOES } from "@/lib/dominio/correcoes";
import { somarDias } from "@/lib/dominio/estoque";
import { CATEGORIAS, DIAS_RETROATIVOS_FINANCEIRO } from "@/lib/dominio/financeiro";
import {
  acaoCancelarConta,
  acaoCorrigirVinculo,
  acaoCriarConta,
  acaoCriarDespesa,
  acaoDefinirAtivo,
  acaoEditarConta,
  acaoEditarDespesa,
  acaoEstornar,
  acaoInformarSaldoInicial,
  acaoLancarAvulso,
  acaoRegistrarPagamento,
} from "@/lib/financeiro/acoes";
import { FINANCEIRO_INICIAL, type EstadoDoFinanceiro } from "@/lib/financeiro/servicos";
import { validarConta, validarDespesa, validarDiaVencimento, validarLancamento, validarPagamento, validarSaldoInicial, validarVinculo } from "@/lib/financeiro/validacao";
import { botaoPrimario, botaoSecundario } from "./exibicao";

// SPEC-026 (5.4, item 7): o formulário do fornecedor ou do cliente só é baixado quando a pessoa abre "Novo".
const FormularioCliente = dynamic(() => import("@/components/clientes/formulario-cliente").then((m) => m.FormularioCliente), { ssr: false });

const ordenar = (lista: OpcaoDePessoa[]) => [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

type Acao = (anterior: EstadoDoFinanceiro, form: FormData) => Promise<EstadoDoFinanceiro>;
type Validador = (campos: Record<string, string>) => { ok: boolean; erros?: ErrosDeCampo };

/** Estado + validação dupla (navegador e servidor) + limpeza depois de salvar, como nas outras telas. */
function useFormulario(acao: Acao, validar?: Validador, limparAoSalvar = false) {
  const [estado, executar, enviando] = useActionState(acao, FINANCEIRO_INICIAL);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  const [chave, setChave] = useState(0);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
    if (limparAoSalvar && estado.status === "salvo") setChave((k) => k + 1);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  /** Envio pela transição, para não perder o que foi digitado quando o servidor recusa. */
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    enviarSemReiniciar(e, executar, (dados) => {
      const v: ReturnType<Validador> = validar ? validar(camposDoFormulario(dados)) : { ok: true };
      setLocais(v.ok ? {} : (v.erros ?? {}));
      return v.ok;
    });
  }
  const limpar = (campo: string) => erros[campo] && setLocais({ ...erros, [campo]: undefined });
  return { estado, executar, enviando, erros, aoEnviar, limpar, chave };
}

function Avisos({ estado }: { estado: EstadoDoFinanceiro }) {
  if (estado.status === "salvo") return <Aviso tipo="sucesso">{estado.mensagem}</Aviso>;
  if (estado.status === "erro" && estado.mensagem) return <Aviso tipo="erro">{estado.mensagem}</Aviso>;
  return null;
}

function Campo({ id, rotulo, erro, dica, children }: { id: string; rotulo: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {rotulo}
      </label>
      {children}
      {dica && !erro && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
      <MensagemDeCampo id={`${id}-erro`} erro={erro} />
    </div>
  );
}

/** Atributos de acessibilidade do campo com erro. */
const aria = (id: string, erro?: string) => ({ "aria-invalid": erro ? true : undefined, "aria-describedby": erro ? `${id}-erro` : undefined });

const valorBr = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CampoValor({ id, erro, limpar, padrao, rotulo = "Valor (R$)" }: { id: string; erro?: string; limpar: (c: string) => void; padrao?: string; rotulo?: string }) {
  return (
    <Campo id={id} rotulo={rotulo} erro={erro}>
      <input id={id} name="valor" inputMode="decimal" placeholder="Ex.: 80 ou 1.234,56" defaultValue={padrao} {...aria(id, erro)} onChange={() => limpar("valor")} className={classeDoCampo(erro)} />
    </Campo>
  );
}

function CampoData({ id, hoje, erro, limpar }: { id: string; hoje: string; erro?: string; limpar: (c: string) => void }) {
  return (
    <Campo id={id} rotulo="Data" erro={erro}>
      <input
        id={id}
        name="data"
        type="date"
        defaultValue={hoje}
        max={hoje}
        min={somarDias(hoje, -DIAS_RETROATIVOS_FINANCEIRO)}
        {...aria(id, erro)}
        onChange={() => limpar("data")}
        className={classeDoCampo(erro)}
      />
    </Campo>
  );
}

function CampoCategoria({ id, erro, limpar, padrao }: { id: string; erro?: string; limpar: (c: string) => void; padrao?: string }) {
  return (
    <Campo id={id} rotulo="Categoria" erro={erro}>
      <select id={id} name="categoria" defaultValue={padrao ?? ""} {...aria(id, erro)} onChange={() => limpar("categoria")} className={classeDoCampo(erro)}>
        <option value="">Selecione…</option>
        {Object.entries(CATEGORIAS).map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function CampoDescricao({ id, erro, limpar, padrao, exemplo }: { id: string; erro?: string; limpar: (c: string) => void; padrao?: string; exemplo: string }) {
  return (
    <Campo id={id} rotulo="Descrição" erro={erro}>
      <input id={id} name="descricao" maxLength={120} placeholder={exemplo} defaultValue={padrao} {...aria(id, erro)} onChange={() => limpar("descricao")} className={classeDoCampo(erro)} />
    </Campo>
  );
}

/** Escolha entre duas opções (entrada/saída, a pagar/a receber), como botões de rádio. */
function Alternativa({ nome, opcoes, padrao, erro, rotulo, aoMudar }: { nome: string; opcoes: [string, string][]; padrao: string; erro?: string; rotulo: string; aoMudar?: (valor: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-foreground">{rotulo}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {opcoes.map(([valor, texto]) => (
          <label
            key={valor}
            className="grid h-10 cursor-pointer place-items-center rounded-full px-3 text-center text-sm font-bold text-foreground transition-colors duration-(--duracao-estado) hover:bg-accent has-checked:bg-estrutura has-checked:text-estrutura-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input type="radio" name={nome} value={valor} defaultChecked={valor === padrao} onChange={() => aoMudar?.(valor)} className="sr-only" />
            {texto}
          </label>
        ))}
      </div>
      <MensagemDeCampo id={`${nome}-erro`} erro={erro} />
    </fieldset>
  );
}

/** Lançamento avulso (UC12a): saída por padrão — o caso mais comum é a despesa operacional. */
export function FormularioLancamento({ hoje, aoSalvar }: { hoje: string; aoSalvar?: (mensagem: string) => void }) {
  const f = useFormulario(acaoLancarAvulso, (c) => validarLancamento(c, hoje), true);
  useEffect(() => {
    if (f.estado.status === "salvo") aoSalvar?.(f.estado.mensagem);
    // aoSalvar muda a cada renderização do pai; só o resultado da ação importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.estado]);
  return (
    <div className="space-y-4">
      {!(aoSalvar && f.estado.status === "salvo") && <Avisos estado={f.estado} />}
      <form key={f.chave} onSubmit={f.aoEnviar} noValidate className="space-y-4">
        <Alternativa nome="tipo" rotulo="Tipo" padrao="SAIDA" erro={f.erros.tipo} opcoes={[["SAIDA", "Saída (despesa)"], ["ENTRADA", "Entrada"]]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoValor id="lanc-valor" erro={f.erros.valor} limpar={f.limpar} />
          <CampoCategoria id="lanc-categoria" erro={f.erros.categoria} limpar={f.limpar} />
        </div>
        <CampoDescricao id="lanc-descricao" erro={f.erros.descricao} limpar={f.limpar} exemplo="Ex.: Compra de esmaltes" />
        <div className="sm:max-w-xs">
          <CampoData id="lanc-data" hoje={hoje} erro={f.erros.data} limpar={f.limpar} />
        </div>
        <button type="submit" disabled={f.enviando} className={botaoPrimario}>
          {f.enviando ? "Registrando…" : "Registrar lançamento"}
        </button>
      </form>
    </div>
  );
}

/** Saldo inicial do caixa (OPEN-001), informado uma vez. */
export function FormularioSaldoInicial({ hoje }: { hoje: string }) {
  const f = useFormulario(acaoInformarSaldoInicial, (c) => validarSaldoInicial(c, hoje));
  if (f.estado.status === "salvo") return <Avisos estado={f.estado} />;
  return (
    <div className="space-y-3">
      <Avisos estado={f.estado} />
      <form onSubmit={f.aoEnviar} noValidate className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <CampoValor id="saldo-valor" rotulo="Dinheiro em caixa (R$)" erro={f.erros.valor} limpar={f.limpar} />
        <CampoData id="saldo-data" hoje={hoje} erro={f.erros.data} limpar={f.limpar} />
        <button type="submit" disabled={f.enviando} className={`${botaoPrimario} sm:mb-[1px]`}>
          Informar saldo
        </button>
      </form>
    </div>
  );
}

/** Estorno (OPEN-003): pede confirmação; o original fica marcado como estornado. */
export function BotaoEstornar({ lancamentoId, descricao }: { lancamentoId: string; descricao: string }) {
  const f = useFormulario(acaoEstornar);
  const confirmacao = useConfirmacaoDoEnvio();
  if (f.estado.status === "salvo") return <span className="text-xs text-status-ok">Estornado</span>;
  return (
    <form action={f.executar} onSubmit={confirmacao.aoEnviar} className="inline">
      <DialogoDeConfirmacao
        aberto={confirmacao.aberto}
        aoMudar={confirmacao.setAberto}
        titulo={`Estornar "${descricao}"?`}
        descricao="Será gravado um lançamento contrário de mesmo valor."
        confirmar="Estornar"
        aoConfirmar={confirmacao.confirmar}
      />
      <input type="hidden" name="lancamentoId" value={lancamentoId} />
      <button type="submit" disabled={f.enviando} className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60">
        {f.enviando ? "Estornando…" : "Estornar"}
      </button>
      {f.estado.status === "erro" && <span className="ml-2 text-xs text-status-danger">{f.estado.mensagem}</span>}
    </form>
  );
}

export type ContaEditavel = {
  id: string;
  tipo: "PAGAR" | "RECEBER";
  descricao: string;
  categoria: string;
  totalCentavos: number;
  vencimento: string;
  /** SPEC-026: fornecedor (a pagar) ou cliente (a receber) e nº do documento. */
  pessoa: OpcaoDePessoa | null;
  numeroDocumento: string | null;
};

/** A lista do seletor com a pessoa atual da conta, mesmo que ela não esteja mais entre os ativos. */
const comAtual = (lista: OpcaoDePessoa[], atual: OpcaoDePessoa | null) => (atual && !lista.some((o) => o.id === atual.id) ? ordenar([...lista, atual]) : lista);

/**
 * Fornecedor (a pagar) ou cliente (a receber) com o "Novo" ao lado, e o nº do documento (SPEC-026,
 * 5.4). O seletor é controlado: ao trocar entre a pagar e a receber, a escolha volta para "Sem".
 */
function CamposDoVinculo({
  prefixo,
  tipo,
  pessoaId,
  setPessoaId,
  listas,
  numeroDocumento,
  erros,
  limpar,
  aoNovo,
  podeNovo,
}: {
  prefixo: string;
  tipo: "PAGAR" | "RECEBER";
  pessoaId: string;
  setPessoaId: (id: string) => void;
  listas: { fornecedores: OpcaoDePessoa[]; clientes: OpcaoDePessoa[] };
  numeroDocumento?: string | null;
  erros: ErrosDeCampo;
  limpar: (campo: string) => void;
  aoNovo?: () => void;
  podeNovo: boolean;
}) {
  const fornecedor = tipo === "PAGAR";
  const lista = fornecedor ? listas.fornecedores : listas.clientes;
  const id = `${prefixo}-pessoa`;
  return (
    // Empilhado: cabe na gaveta da nova conta e no cartão da correção sem quebrar os rótulos.
    <div className="space-y-4">
      <Campo id={id} rotulo={fornecedor ? "Fornecedor (opcional)" : "Cliente (opcional)"} erro={erros.pessoa}>
        <div className="flex flex-wrap gap-2">
          <select
            id={id}
            name="pessoa"
            value={pessoaId}
            onChange={(e) => {
              setPessoaId(e.target.value);
              limpar("pessoa");
            }}
            {...aria(id, erros.pessoa)}
            className={`${classeDoCampo(erros.pessoa)} min-w-0 flex-1 basis-48`}
          >
            <option value="">{fornecedor ? "Sem fornecedor" : "Sem cliente"}</option>
            {lista.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
          {podeNovo && aoNovo && (
            <button type="button" onClick={aoNovo} className={botaoSecundario}>
              <Plus aria-hidden="true" />
              {fornecedor ? "Novo fornecedor" : "Novo cliente"}
            </button>
          )}
        </div>
      </Campo>
      <Campo id={`${prefixo}-documento`} rotulo="Nº do documento (opcional)" erro={erros.numeroDocumento} dica="Nota fiscal, boleto…">
        <input
          id={`${prefixo}-documento`}
          name="numeroDocumento"
          maxLength={MAX_NUMERO_DOCUMENTO}
          defaultValue={numeroDocumento ?? ""}
          autoComplete="off"
          {...aria(`${prefixo}-documento`, erros.numeroDocumento)}
          onChange={() => limpar("numeroDocumento")}
          className={`${classeDoCampo(erros.numeroDocumento)} sm:max-w-xs`}
        />
      </Campo>
    </div>
  );
}

/** Cadastro do fornecedor ou do cliente sem sair do formulário (5.4, item 7): ao salvar, já fica escolhido. */
function NovoCadastro({ pessoa, aoCriar, aoCancelar }: { pessoa: "fornecedor" | "cliente"; aoCriar: (o: OpcaoDePessoa) => void; aoCancelar: () => void }) {
  return (
    <section aria-label={pessoa === "fornecedor" ? "Novo fornecedor" : "Novo cliente"} className="space-y-4">
      <p className="text-sm font-bold text-foreground">{pessoa === "fornecedor" ? "Novo fornecedor" : "Novo cliente"}</p>
      <FormularioCliente modo="gaveta" pessoa={pessoa} aoCriar={(c) => aoCriar({ id: c.id, nome: c.nome })} aoCancelar={aoCancelar} />
    </section>
  );
}

/** SPEC-019 (5.4, "Vínculo como está"): no modo suporte, o formulário não mostra nem envia o vínculo. */
function VinculoComoEsta() {
  return <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{MENSAGENS_DAS_CORRECOES.vinculoComoEsta}</p>;
}

/**
 * Nova conta manual ou edição de conta manual sem pagamento (5.3, OPEN-003), com o vínculo (SPEC-026).
 * `vinculoComoEsta`: correção do suporte (SPEC-019), sem o fornecedor ou o cliente e o nº do documento.
 */
export function FormularioConta({
  hoje,
  conta,
  tipoPadrao = "PAGAR",
  opcoes = SEM_OPCOES,
  vinculoComoEsta = false,
}: {
  hoje: string;
  conta?: ContaEditavel;
  tipoPadrao?: "PAGAR" | "RECEBER";
  opcoes?: OpcoesDoVinculo;
  vinculoComoEsta?: boolean;
}) {
  const f = useFormulario(conta ? acaoEditarConta : acaoCriarConta, (c) => validarConta(c, hoje), !conta);
  const [tipo, setTipo] = useState<"PAGAR" | "RECEBER">(conta?.tipo ?? tipoPadrao);
  const [pessoaId, setPessoaId] = useState(conta?.pessoa?.id ?? "");
  const [listas, setListas] = useState(() => ({
    fornecedores: comAtual(opcoes.fornecedores, conta?.tipo === "PAGAR" ? conta.pessoa : null),
    clientes: comAtual(opcoes.clientes, conta?.tipo === "RECEBER" ? conta.pessoa : null),
  }));
  const [novo, setNovo] = useState(false);
  // Depois de salvar, o formulário é recriado (chave nova): a escolha volta ao início também.
  const [chaveVista, setChaveVista] = useState(f.chave);
  if (f.chave !== chaveVista) {
    setChaveVista(f.chave);
    setTipo(conta?.tipo ?? tipoPadrao);
    setPessoaId(conta?.pessoa?.id ?? "");
  }
  const fornecedor = tipo === "PAGAR";
  return (
    <div className="space-y-4">
      <Avisos estado={f.estado} />
      {/* O formulário da conta fica escondido (e com o que foi digitado) enquanto o "Novo" está aberto. */}
      <div hidden={novo}>
        <form key={f.chave} onSubmit={f.aoEnviar} noValidate className="space-y-4">
          {conta && <input type="hidden" name="contaId" value={conta.id} />}
          <Alternativa
            nome="tipo"
            rotulo="Tipo"
            padrao={conta?.tipo ?? tipoPadrao}
            erro={f.erros.tipo}
            opcoes={[["PAGAR", "A pagar"], ["RECEBER", "A receber"]]}
            aoMudar={(v) => {
              setTipo(v as "PAGAR" | "RECEBER");
              setPessoaId("");
            }}
          />
          <CampoDescricao id="conta-descricao" erro={f.erros.descricao} limpar={f.limpar} padrao={conta?.descricao} exemplo="Ex.: Compra de embalagens" />
          {/* Duas colunas, como no lançamento: em três, a gaveta cortava a categoria e a data. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor id="conta-valor" erro={f.erros.valor} limpar={f.limpar} padrao={conta ? valorBr(conta.totalCentavos) : undefined} />
            <CampoCategoria id="conta-categoria" erro={f.erros.categoria} limpar={f.limpar} padrao={conta?.categoria} />
            <Campo id="conta-vencimento" rotulo="Vencimento" erro={f.erros.vencimento}>
              <input
                id="conta-vencimento"
                name="vencimento"
                type="date"
                defaultValue={conta?.vencimento ?? hoje}
                {...aria("conta-vencimento", f.erros.vencimento)}
                onChange={() => f.limpar("vencimento")}
                className={classeDoCampo(f.erros.vencimento)}
              />
            </Campo>
          </div>
          {vinculoComoEsta ? (
            <VinculoComoEsta />
          ) : (
            <CamposDoVinculo
              prefixo="conta"
              tipo={tipo}
              pessoaId={pessoaId}
              setPessoaId={setPessoaId}
              listas={listas}
              numeroDocumento={conta?.numeroDocumento}
              erros={f.erros}
              limpar={f.limpar}
              podeNovo={fornecedor ? opcoes.podeCriarFornecedor : opcoes.podeCriarCliente}
              aoNovo={() => setNovo(true)}
            />
          )}
          <button type="submit" disabled={f.enviando} className={botaoPrimario}>
            {f.enviando ? "Salvando…" : conta ? "Salvar alterações" : "Cadastrar conta"}
          </button>
        </form>
      </div>
      {novo && (
        <NovoCadastro
          pessoa={fornecedor ? "fornecedor" : "cliente"}
          aoCriar={(o) => {
            setListas((l) => (fornecedor ? { ...l, fornecedores: ordenar([...l.fornecedores, o]) } : { ...l, clientes: ordenar([...l.clientes, o]) }));
            setPessoaId(o.id);
            setNovo(false);
          }}
          aoCancelar={() => setNovo(false)}
        />
      )}
    </div>
  );
}

/**
 * Correção do fornecedor ou cliente e do nº do documento (SPEC-026, 5.4, item 5): em qualquer conta,
 * mesmo paga. Na conta de venda no cartão, o cliente é o da venda e só o documento muda.
 */
export function FormularioVinculo({
  conta,
  opcoes,
}: {
  conta: { id: string; tipo: "PAGAR" | "RECEBER"; pessoa: OpcaoDePessoa | null; daVenda: boolean; numeroDocumento: string | null };
  opcoes: OpcoesDoVinculo;
}) {
  const f = useFormulario(acaoCorrigirVinculo, validarVinculo);
  const [pessoaId, setPessoaId] = useState(conta.pessoa?.id ?? "");
  const listas = {
    fornecedores: comAtual(opcoes.fornecedores, conta.tipo === "PAGAR" ? conta.pessoa : null),
    clientes: comAtual(opcoes.clientes, conta.tipo === "RECEBER" ? conta.pessoa : null),
  };
  return (
    <div className="space-y-4">
      <Avisos estado={f.estado} />
      <form onSubmit={f.aoEnviar} noValidate className="space-y-4">
        <input type="hidden" name="contaId" value={conta.id} />
        {conta.daVenda ? (
          <Campo id="vinculo-documento" rotulo="Nº do documento (opcional)" erro={f.erros.numeroDocumento} dica="O cliente desta conta é o da venda.">
            <input
              id="vinculo-documento"
              name="numeroDocumento"
              maxLength={MAX_NUMERO_DOCUMENTO}
              defaultValue={conta.numeroDocumento ?? ""}
              autoComplete="off"
              {...aria("vinculo-documento", f.erros.numeroDocumento)}
              onChange={() => f.limpar("numeroDocumento")}
              className={classeDoCampo(f.erros.numeroDocumento)}
            />
          </Campo>
        ) : (
          <CamposDoVinculo
            prefixo="vinculo"
            tipo={conta.tipo}
            pessoaId={pessoaId}
            setPessoaId={setPessoaId}
            listas={listas}
            numeroDocumento={conta.numeroDocumento}
            erros={f.erros}
            limpar={f.limpar}
            podeNovo={false}
          />
        )}
        <button type="submit" disabled={f.enviando} className={botaoSecundario}>
          {f.enviando ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </div>
  );
}

/** Cancelar conta a pagar ou a receber manual, sem pagamento (OPEN-003): nada é apagado. */
export function BotaoCancelarConta({ contaId }: { contaId: string }) {
  const f = useFormulario(acaoCancelarConta);
  const confirmacao = useConfirmacaoDoEnvio();
  return (
    <form action={f.executar} onSubmit={confirmacao.aoEnviar} className="space-y-2">
      <DialogoDeConfirmacao
        aberto={confirmacao.aberto}
        aoMudar={confirmacao.setAberto}
        titulo="Cancelar esta conta?"
        descricao="Ela continua no histórico como cancelada."
        confirmar="Cancelar conta"
        aoConfirmar={confirmacao.confirmar}
      />
      <input type="hidden" name="contaId" value={contaId} />
      {f.estado.status === "erro" && <Aviso tipo="erro">{f.estado.mensagem}</Aviso>}
      <button type="submit" disabled={f.enviando} className={`${botaoSecundario} text-status-danger`}>
        {f.enviando ? "Cancelando…" : "Cancelar conta"}
      </button>
    </form>
  );
}

/** Pagamento ou recebimento, total ou parcial (5.3). O valor sugerido é o restante. */
export function FormularioPagamento({ contaId, tipo, restanteCentavos, hoje }: { contaId: string; tipo: "PAGAR" | "RECEBER"; restanteCentavos: number; hoje: string }) {
  const f = useFormulario(acaoRegistrarPagamento, (c) => validarPagamento(c, hoje), true);
  const receber = tipo === "RECEBER";
  return (
    <div className="space-y-3">
      <Avisos estado={f.estado} />
      <form key={f.chave} onSubmit={f.aoEnviar} noValidate className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <input type="hidden" name="contaId" value={contaId} />
        <CampoValor id="pag-valor" rotulo={`Valor ${receber ? "recebido" : "pago"} (R$)`} erro={f.erros.valor} limpar={f.limpar} padrao={valorBr(restanteCentavos)} />
        <CampoData id="pag-data" hoje={hoje} erro={f.erros.data} limpar={f.limpar} />
        {/* SPEC-026 (OPEN-008): a forma é obrigatória, sem opção pré-escolhida. */}
        <Campo id="pag-forma" rotulo={`Forma do ${receber ? "recebimento" : "pagamento"}`} erro={f.erros.forma}>
          <select id="pag-forma" name="forma" defaultValue="" {...aria("pag-forma", f.erros.forma)} onChange={() => f.limpar("forma")} className={classeDoCampo(f.erros.forma)}>
            <option value="">Selecione…</option>
            {FORMAS_DO_PAGAMENTO.map((forma) => (
              <option key={forma} value={forma}>
                {ROTULO_FORMA[forma]}
              </option>
            ))}
          </select>
        </Campo>
        <button type="submit" disabled={f.enviando} className={`${botaoPrimario} sm:col-span-2 sm:justify-self-start`}>
          {f.enviando ? "Registrando…" : receber ? "Registrar recebimento" : "Registrar pagamento"}
        </button>
      </form>
    </div>
  );
}

export type DespesaEditavel = {
  id: string;
  descricao: string;
  valorCentavos: number | null;
  diaVencimento: number;
  categoria: string;
  das: boolean;
  /** SPEC-026 (5.4, item 4): repassado às próximas contas; o DAS não tem. */
  fornecedor: OpcaoDePessoa | null;
};

/**
 * Despesa fixa (5.5): nova ou edição; o DAS do MEI só mostra o dia de vencimento (5.6). `vinculoComoEsta`:
 * correção do suporte (SPEC-019), sem o fornecedor.
 */
export function FormularioDespesa({ despesa, opcoes = SEM_OPCOES, vinculoComoEsta = false }: { despesa?: DespesaEditavel; opcoes?: OpcoesDoVinculo; vinculoComoEsta?: boolean }) {
  const das = despesa?.das ?? false;
  const f = useFormulario(despesa ? acaoEditarDespesa : acaoCriarDespesa, das ? validarDiaVencimento : validarDespesa, !despesa);
  const [fornecedorId, setFornecedorId] = useState(despesa?.fornecedor?.id ?? "");
  const [fornecedores, setFornecedores] = useState(() => comAtual(opcoes.fornecedores, despesa?.fornecedor ?? null));
  const [novo, setNovo] = useState(false);
  // Depois de salvar a nova despesa, o formulário é recriado: o fornecedor escolhido volta ao início.
  const [chaveVista, setChaveVista] = useState(f.chave);
  if (f.chave !== chaveVista) {
    setChaveVista(f.chave);
    setFornecedorId(despesa?.fornecedor?.id ?? "");
  }
  return (
    <div className="space-y-4">
      <Avisos estado={f.estado} />
      {novo && (
        <NovoCadastro
          pessoa="fornecedor"
          aoCriar={(o) => {
            setFornecedores((l) => ordenar([...l, o]));
            setFornecedorId(o.id);
            setNovo(false);
          }}
          aoCancelar={() => setNovo(false)}
        />
      )}
      <form key={f.chave} onSubmit={f.aoEnviar} noValidate className="space-y-4" hidden={novo}>
        {despesa && <input type="hidden" name="despesaId" value={despesa.id} />}
        {!das && <CampoDescricao id="desp-descricao" erro={f.erros.descricao} limpar={f.limpar} padrao={despesa?.descricao} exemplo="Ex.: Aluguel" />}
        <div className={das ? "sm:max-w-xs" : "grid gap-4 sm:grid-cols-2"}>
          {!das && <CampoValor id="desp-valor" rotulo="Valor mensal (R$)" erro={f.erros.valor} limpar={f.limpar} padrao={despesa?.valorCentavos ? valorBr(despesa.valorCentavos) : undefined} />}
          <Campo id="desp-dia" rotulo="Dia de vencimento" erro={f.erros.diaVencimento} dica="1 a 31; em meses mais curtos, o último dia.">
            <input
              id="desp-dia"
              name="diaVencimento"
              inputMode="numeric"
              defaultValue={despesa?.diaVencimento ?? ""}
              placeholder="Ex.: 5"
              {...aria("desp-dia", f.erros.diaVencimento)}
              onChange={() => f.limpar("diaVencimento")}
              className={classeDoCampo(f.erros.diaVencimento)}
            />
          </Campo>
          {!das && <CampoCategoria id="desp-categoria" erro={f.erros.categoria} limpar={f.limpar} padrao={despesa?.categoria ?? "OUTROS"} />}
        </div>
        {!das && vinculoComoEsta && <VinculoComoEsta />}
        {!das && !vinculoComoEsta && (
          <Campo id="desp-fornecedor" rotulo="Fornecedor (opcional)" erro={f.erros.fornecedor} dica="As próximas contas desta despesa já nascem com ele.">
            <div className="flex flex-wrap gap-2">
              <select
                id="desp-fornecedor"
                name="fornecedor"
                value={fornecedorId}
                onChange={(e) => {
                  setFornecedorId(e.target.value);
                  f.limpar("fornecedor");
                }}
                {...aria("desp-fornecedor", f.erros.fornecedor)}
                className={`${classeDoCampo(f.erros.fornecedor)} min-w-0 flex-1 basis-48`}
              >
                <option value="">Sem fornecedor</option>
                {fornecedores.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
              {opcoes.podeCriarFornecedor && (
                <button type="button" onClick={() => setNovo(true)} className={botaoSecundario}>
                  <Plus aria-hidden="true" />
                  Novo fornecedor
                </button>
              )}
            </div>
          </Campo>
        )}
        <button type="submit" disabled={f.enviando} className={botaoPrimario}>
          {f.enviando ? "Salvando…" : despesa ? "Salvar alterações" : "Cadastrar despesa fixa"}
        </button>
      </form>
    </div>
  );
}

/** Ativar/desativar despesa fixa manual (5.5). */
export function BotaoAtivo({ despesaId, ativo }: { despesaId: string; ativo: boolean }) {
  const f = useFormulario(acaoDefinirAtivo);
  return (
    <form action={f.executar} className="space-y-2">
      <input type="hidden" name="despesaId" value={despesaId} />
      <input type="hidden" name="ativo" value={ativo ? "false" : "true"} />
      <Avisos estado={f.estado} />
      <button type="submit" disabled={f.enviando} className={botaoSecundario}>
        {ativo ? "Desativar" : "Reativar"}
      </button>
    </form>
  );
}
