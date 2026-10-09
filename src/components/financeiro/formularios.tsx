"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Aviso, MensagemDeCampo } from "@/components/acesso/campos";
import { classeDoCampo } from "@/components/ui/classes";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { somarDias } from "@/lib/dominio/estoque";
import { CATEGORIAS, DIAS_RETROATIVOS_FINANCEIRO } from "@/lib/dominio/financeiro";
import {
  acaoCancelarConta,
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
import { validarConta, validarDespesa, validarDiaVencimento, validarLancamento, validarPagamento, validarSaldoInicial } from "@/lib/financeiro/validacao";
import { botaoPrimario, botaoSecundario } from "./exibicao";

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
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    if (!validar) return;
    const v = validar(camposDoFormulario(new FormData(e.currentTarget)));
    if (!v.ok) {
      e.preventDefault();
      setLocais(v.erros ?? {});
    } else setLocais({});
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
function Alternativa({ nome, opcoes, padrao, erro, rotulo }: { nome: string; opcoes: [string, string][]; padrao: string; erro?: string; rotulo: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-foreground">{rotulo}</legend>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map(([valor, texto]) => (
          <label key={valor} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
            <input type="radio" name={nome} value={valor} defaultChecked={valor === padrao} className="accent-[var(--color-primary)]" />
            {texto}
          </label>
        ))}
      </div>
      <MensagemDeCampo id={`${nome}-erro`} erro={erro} />
    </fieldset>
  );
}

/** Lançamento avulso (UC12a): saída por padrão — o caso mais comum é a despesa operacional. */
export function FormularioLancamento({ hoje }: { hoje: string }) {
  const f = useFormulario(acaoLancarAvulso, (c) => validarLancamento(c, hoje), true);
  return (
    <div className="space-y-4">
      <Avisos estado={f.estado} />
      <form key={f.chave} action={f.executar} onSubmit={f.aoEnviar} noValidate className="space-y-4">
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
      <form action={f.executar} onSubmit={f.aoEnviar} noValidate className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
  if (f.estado.status === "salvo") return <span className="text-xs text-status-ok">Estornado</span>;
  return (
    <form
      action={f.executar}
      onSubmit={(e) => {
        if (!window.confirm(`Estornar "${descricao}"? Será gravado um lançamento contrário de mesmo valor.`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="lancamentoId" value={lancamentoId} />
      <button type="submit" disabled={f.enviando} className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60">
        {f.enviando ? "Estornando…" : "Estornar"}
      </button>
      {f.estado.status === "erro" && <span className="ml-2 text-xs text-status-danger">{f.estado.mensagem}</span>}
    </form>
  );
}

export type ContaEditavel = { id: string; tipo: "PAGAR" | "RECEBER"; descricao: string; categoria: string; totalCentavos: number; vencimento: string };

/** Nova conta manual ou edição de conta manual sem pagamento (5.3, OPEN-003). */
export function FormularioConta({ hoje, conta, tipoPadrao = "PAGAR" }: { hoje: string; conta?: ContaEditavel; tipoPadrao?: "PAGAR" | "RECEBER" }) {
  const f = useFormulario(conta ? acaoEditarConta : acaoCriarConta, (c) => validarConta(c, hoje));
  return (
    <div className="space-y-4">
      <Avisos estado={f.estado} />
      <form action={f.executar} onSubmit={f.aoEnviar} noValidate className="space-y-4">
        {conta && <input type="hidden" name="contaId" value={conta.id} />}
        <Alternativa nome="tipo" rotulo="Tipo" padrao={conta?.tipo ?? tipoPadrao} erro={f.erros.tipo} opcoes={[["PAGAR", "A pagar"], ["RECEBER", "A receber"]]} />
        <CampoDescricao id="conta-descricao" erro={f.erros.descricao} limpar={f.limpar} padrao={conta?.descricao} exemplo="Ex.: Fornecedor de cosméticos" />
        <div className="grid gap-4 sm:grid-cols-3">
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
        <button type="submit" disabled={f.enviando} className={botaoPrimario}>
          {f.enviando ? "Salvando…" : conta ? "Salvar alterações" : "Cadastrar conta"}
        </button>
      </form>
    </div>
  );
}

/** Cancelar conta manual sem pagamento (OPEN-003): nada é apagado. */
export function BotaoCancelarConta({ contaId }: { contaId: string }) {
  const f = useFormulario(acaoCancelarConta);
  return (
    <form
      action={f.executar}
      onSubmit={(e) => {
        if (!window.confirm("Cancelar esta conta? Ela continua no histórico como cancelada.")) e.preventDefault();
      }}
      className="space-y-2"
    >
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
      <form key={f.chave} action={f.executar} onSubmit={f.aoEnviar} noValidate className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <input type="hidden" name="contaId" value={contaId} />
        <CampoValor id="pag-valor" rotulo={`Valor ${receber ? "recebido" : "pago"} (R$)`} erro={f.erros.valor} limpar={f.limpar} padrao={valorBr(restanteCentavos)} />
        <CampoData id="pag-data" hoje={hoje} erro={f.erros.data} limpar={f.limpar} />
        <button type="submit" disabled={f.enviando} className={`${botaoPrimario} sm:mt-7`}>
          {f.enviando ? "Registrando…" : receber ? "Registrar recebimento" : "Registrar pagamento"}
        </button>
      </form>
    </div>
  );
}

export type DespesaEditavel = { id: string; descricao: string; valorCentavos: number | null; diaVencimento: number; categoria: string; das: boolean };

/** Despesa fixa (5.5): nova ou edição; o DAS do MEI só mostra o dia de vencimento (5.6). */
export function FormularioDespesa({ despesa }: { despesa?: DespesaEditavel }) {
  const das = despesa?.das ?? false;
  const f = useFormulario(despesa ? acaoEditarDespesa : acaoCriarDespesa, das ? validarDiaVencimento : validarDespesa, !despesa);
  return (
    <div className="space-y-4">
      <Avisos estado={f.estado} />
      <form key={f.chave} action={f.executar} onSubmit={f.aoEnviar} noValidate className="space-y-4">
        {despesa && <input type="hidden" name="despesaId" value={despesa.id} />}
        {!das && <CampoDescricao id="desp-descricao" erro={f.erros.descricao} limpar={f.limpar} padrao={despesa?.descricao} exemplo="Ex.: Aluguel" />}
        <div className={das ? "sm:max-w-xs" : "grid gap-4 sm:grid-cols-3"}>
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
