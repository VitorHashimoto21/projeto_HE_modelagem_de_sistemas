import type { ErrosDeCampo } from "@/lib/auth/validacao";
import {
  ContaEncerrada,
  ContaNaoEditavel,
  ContaNaoEncontrada,
  DasNaoEditavel,
  DespesaNaoEncontrada,
  JaEstornado,
  LancamentoNaoEncontrado,
  NaoEstornavel,
  SaldoInicialJaInformado,
  ValorAcimaDoRestante,
  type ConsultasFinanceiras,
} from "@/lib/db/financeiro";
import { ClienteNaoEncontrado } from "@/lib/db/clientes";
import { instanteDaOcorrencia } from "@/lib/db/estoque";
import { FornecedorNaoEncontrado } from "@/lib/db/fornecedores";
import { MENSAGENS_DAS_CORRECOES } from "@/lib/dominio/correcoes";
import { reaisDeCentavos } from "@/lib/dominio/venda";
import { validarConta, validarDespesa, validarDiaVencimento, validarLancamento, validarPagamento, validarSaldoInicial, validarVinculo } from "./validacao";

/**
 * Fluxos do Financeiro (SPEC-009, seção 5), independentes do Next.js: as Server Actions (com
 * a guarda de permissão da SPEC-005) só leem o formulário e chamam estas funções.
 */

export const MENSAGENS_FLUXO_FINANCEIRO = {
  lancado: (tipo: "ENTRADA" | "SAIDA", centavos: number) => `${tipo === "ENTRADA" ? "Entrada" : "Saída"} de ${reaisDeCentavos(centavos)} registrada.`,
  saldoInicial: (centavos: number) => `Saldo inicial de ${reaisDeCentavos(centavos)} registrado.`,
  saldoInicialJaInformado: "O saldo inicial já foi informado. Para corrigi-lo, estorne o lançamento de saldo inicial.",
  estornado: "Lançamento estornado.",
  jaEstornado: "Este lançamento já foi estornado.",
  naoEstornavel: "Só lançamentos avulsos e o saldo inicial podem ser estornados. Vendas e pagamentos de contas são corrigidos na origem.",
  lancamentoNaoEncontrado: "Lançamento não encontrado.",
  contaCriada: "Conta cadastrada.",
  contaEditada: "Conta atualizada.",
  contaCancelada: "Conta cancelada.",
  contaNaoEncontrada: "Conta não encontrada.",
  contaNaoEditavel: {
    venda: "Contas geradas por uma venda não podem ser alteradas aqui.",
    despesa: "Contas geradas por uma despesa fixa não podem ser alteradas. Altere a despesa fixa para os próximos meses.",
    "com-pagamento": "Esta conta já tem pagamento registrado e não pode mais ser alterada nem cancelada.",
    encerrada: "Esta conta já está quitada ou cancelada.",
  },
  contaEncerrada: "Esta conta já está quitada ou cancelada.",
  acimaDoRestante: (centavos: number) => `O restante desta conta é ${reaisDeCentavos(centavos)}.`,
  pago: (receber: boolean, quitada: boolean, restante: number) =>
    `${receber ? "Recebimento" : "Pagamento"} registrado.${quitada ? ` Conta ${receber ? "recebida" : "paga"} por completo.` : ` Restam ${reaisDeCentavos(restante)}.`}`,
  despesaCriada: "Despesa fixa cadastrada.",
  despesaEditada: "Despesa fixa atualizada. O novo valor vale para os próximos meses.",
  despesaAtivada: "Despesa fixa reativada.",
  despesaDesativada: "Despesa fixa desativada: não gera mais contas. As já geradas continuam.",
  despesaNaoEncontrada: "Despesa fixa não encontrada.",
  dasNaoEditavel: "O DAS do MEI só permite alterar o dia de vencimento.",
  // SPEC-026
  vinculoCorrigido: "Dados da conta atualizados.",
  fornecedorNaoEncontrado: "Fornecedor não encontrado. Escolha outro da lista.",
  clienteNaoEncontrado: "Cliente não encontrado. Escolha outro da lista.",
  falhaInterna: "Não foi possível concluir agora. Tente novamente.",
} as const;

export type EstadoDoFinanceiro =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: ErrosDeCampo }
  | { status: "salvo"; mensagem: string; id?: string };

export const FINANCEIRO_INICIAL: EstadoDoFinanceiro = { status: "ocioso" };

export type DependenciasDoFinanceiro = {
  financeiro: ConsultasFinanceiras;
  usuarioId: string;
  /** Dia local de hoje (São Paulo) e o relógio — injetáveis nos testes. */
  hoje: string;
  agora: Date;
};

const M = MENSAGENS_FLUXO_FINANCEIRO;

function traduzir(e: unknown, campoDaPessoa = "pessoa"): { mensagem?: string; erros?: ErrosDeCampo } {
  if (e instanceof FornecedorNaoEncontrado) return { erros: { [campoDaPessoa]: M.fornecedorNaoEncontrado } };
  if (e instanceof ClienteNaoEncontrado) return { erros: { [campoDaPessoa]: M.clienteNaoEncontrado } };
  if (e instanceof ValorAcimaDoRestante) return { erros: { valor: M.acimaDoRestante(e.restanteCentavos) } };
  if (e instanceof ContaEncerrada) return { mensagem: M.contaEncerrada };
  if (e instanceof ContaNaoEncontrada) return { mensagem: M.contaNaoEncontrada };
  if (e instanceof ContaNaoEditavel) return { mensagem: M.contaNaoEditavel[e.motivo] };
  if (e instanceof JaEstornado) return { mensagem: M.jaEstornado };
  if (e instanceof NaoEstornavel) return { mensagem: M.naoEstornavel };
  if (e instanceof LancamentoNaoEncontrado) return { mensagem: M.lancamentoNaoEncontrado };
  if (e instanceof SaldoInicialJaInformado) return { mensagem: M.saldoInicialJaInformado };
  if (e instanceof DespesaNaoEncontrada) return { mensagem: M.despesaNaoEncontrada };
  if (e instanceof DasNaoEditavel) return { mensagem: M.dasNaoEditavel };
  console.error("[financeiro] falha:", e instanceof Error ? e.name : "erro");
  return { mensagem: M.falhaInterna };
}

/**
 * SPEC-019 (5.4, "Vínculo como está"): no modo suporte, o fornecedor ou o cliente e o nº do documento
 * não vêm do formulário. Na criação, a conta e a despesa nascem sem eles; na edição, ficam os atuais.
 */
export type OpcoesDoVinculo = { vinculoComoEsta?: boolean };
const semVinculo = (campos: Record<string, string>): Record<string, string> => {
  const resto = { ...campos };
  delete resto.pessoa;
  delete resto.numeroDocumento;
  delete resto.fornecedor;
  return resto;
};

async function executar(fluxo: () => Promise<EstadoDoFinanceiro>, campoDaPessoa?: string): Promise<EstadoDoFinanceiro> {
  try {
    return await fluxo();
  } catch (e) {
    return { status: "erro", ...traduzir(e, campoDaPessoa) };
  }
}

/** Lançamento avulso (UC12a, 5.2). */
export async function lancarAvulso(campos: Record<string, string>, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  const v = validarLancamento(campos, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    const { id } = await deps.financeiro.lancar({ ...v.dados, data: instanteDaOcorrencia(v.dados.dia, deps.agora), usuarioId: deps.usuarioId });
    return { status: "salvo", mensagem: M.lancado(v.dados.tipo, v.dados.valorCentavos), id };
  });
}

/** Saldo inicial (OPEN-001). */
export async function informarSaldoInicial(campos: Record<string, string>, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  const v = validarSaldoInicial(campos, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    const { id } = await deps.financeiro.informarSaldoInicial(v.dados.valorCentavos, instanteDaOcorrencia(v.dados.dia, deps.agora), deps.usuarioId);
    return { status: "salvo", mensagem: M.saldoInicial(v.dados.valorCentavos), id };
  });
}

/** Estorno de avulso ou saldo inicial (OPEN-003). */
export async function estornar(lancamentoId: string, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  return executar(async () => {
    const { id } = await deps.financeiro.estornar(lancamentoId, deps.usuarioId, deps.agora);
    return { status: "salvo", mensagem: M.estornado, id };
  });
}

/** Nova conta manual (5.3). */
export async function criarConta(campos: Record<string, string>, deps: DependenciasDoFinanceiro, opcoes: OpcoesDoVinculo = {}): Promise<EstadoDoFinanceiro> {
  const v = validarConta(opcoes.vinculoComoEsta ? semVinculo(campos) : campos, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    const { id } = await deps.financeiro.criarConta(v.dados, deps.usuarioId);
    return { status: "salvo", mensagem: M.contaCriada, id };
  });
}

/**
 * Editar conta manual sem pagamento (OPEN-003). No modo suporte (SPEC-019, OPEN-016), o vínculo fica
 * como está e, numa conta com fornecedor ou cliente, a troca entre "a pagar" e "a receber" é recusada.
 */
export async function editarConta(contaId: string, campos: Record<string, string>, deps: DependenciasDoFinanceiro, opcoes: OpcoesDoVinculo = {}): Promise<EstadoDoFinanceiro> {
  const v = validarConta(opcoes.vinculoComoEsta ? semVinculo(campos) : campos, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    let dados = v.dados;
    if (opcoes.vinculoComoEsta) {
      const atual = await deps.financeiro.vinculoDaConta(contaId);
      if (atual.pessoa && atual.tipo !== dados.tipo) return { status: "erro", erros: { tipo: MENSAGENS_DAS_CORRECOES.tipoComVinculo(atual.pessoa) } };
      dados = { ...dados, pessoaId: atual.pessoaId, numeroDocumento: atual.numeroDocumento };
    }
    await deps.financeiro.editarConta(contaId, dados);
    return { status: "salvo", mensagem: M.contaEditada, id: contaId };
  });
}

/**
 * Correção do fornecedor ou cliente e do nº do documento (SPEC-026, 5.4, item 5): em qualquer
 * conta, mesmo paga, sem mudar valores.
 */
export async function corrigirVinculo(contaId: string, campos: Record<string, string>, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  const v = validarVinculo(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    await deps.financeiro.corrigirVinculo(contaId, v.dados);
    return { status: "salvo", mensagem: M.vinculoCorrigido, id: contaId };
  });
}

/** Cancelar conta manual sem pagamento (OPEN-003). */
export async function cancelarConta(contaId: string, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  return executar(async () => {
    await deps.financeiro.cancelarConta(contaId);
    return { status: "salvo", mensagem: M.contaCancelada, id: contaId };
  });
}

/** Registrar pagamento ou recebimento, total ou parcial (5.3). */
export async function registrarPagamento(contaId: string, campos: Record<string, string>, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  const v = validarPagamento(campos, deps.hoje);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    const r = await deps.financeiro.pagar({
      contaId,
      valorCentavos: v.dados.valorCentavos,
      data: instanteDaOcorrencia(v.dados.dia, deps.agora),
      usuarioId: deps.usuarioId,
      forma: v.dados.forma,
    });
    return { status: "salvo", mensagem: M.pago(r.tipo === "RECEBER", r.status === "QUITADA", r.restanteCentavos), id: contaId };
  });
}

/** Nova despesa fixa (5.5): a conta do mês (OPEN-004) é gerada na hora. */
export async function criarDespesa(campos: Record<string, string>, deps: DependenciasDoFinanceiro, opcoes: OpcoesDoVinculo = {}): Promise<EstadoDoFinanceiro> {
  const v = validarDespesa(opcoes.vinculoComoEsta ? semVinculo(campos) : campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  return executar(async () => {
    const { id } = await deps.financeiro.criarDespesa(v.dados, deps.hoje);
    await deps.financeiro.conferir(deps.hoje);
    return { status: "salvo", mensagem: M.despesaCriada, id };
  }, "fornecedor");
}

/** Editar despesa fixa: a manual, todos os campos; o DAS do MEI, só o dia (5.6). No modo suporte, o fornecedor fica. */
export async function editarDespesa(despesaId: string, campos: Record<string, string>, deps: DependenciasDoFinanceiro, opcoes: OpcoesDoVinculo = {}): Promise<EstadoDoFinanceiro> {
  return executar(async () => {
    const atual = await deps.financeiro.detalharDespesa(despesaId);
    if (atual.origem === "DAS_MEI") {
      const dia = validarDiaVencimento(campos);
      if (!dia.ok) return { status: "erro", erros: dia.erros };
      await deps.financeiro.definirDiaVencimento(despesaId, dia.dados);
      return { status: "salvo", mensagem: "Dia de vencimento do DAS atualizado.", id: despesaId };
    }
    const v = validarDespesa(opcoes.vinculoComoEsta ? semVinculo(campos) : campos);
    if (!v.ok) return { status: "erro", erros: v.erros };
    await deps.financeiro.editarDespesa(despesaId, opcoes.vinculoComoEsta ? { ...v.dados, fornecedorId: atual.fornecedor?.id ?? null } : v.dados);
    return { status: "salvo", mensagem: M.despesaEditada, id: despesaId };
  }, "fornecedor");
}

/** Ativar/desativar despesa fixa manual (5.5). */
export async function definirAtivo(despesaId: string, ativo: boolean, deps: DependenciasDoFinanceiro): Promise<EstadoDoFinanceiro> {
  return executar(async () => {
    await deps.financeiro.definirAtivo(despesaId, ativo, deps.hoje);
    if (ativo) await deps.financeiro.conferir(deps.hoje);
    return { status: "salvo", mensagem: ativo ? M.despesaAtivada : M.despesaDesativada, id: despesaId };
  });
}
