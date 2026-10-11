import type { ResultadoDaTroca, ResultadoDoAcesso } from "@/lib/db/planos";

/**
 * Fluxos do plano (SPEC-013, 5.1 e 5.2). A ação já exigiu o Dono; `alterarPlano` confere de
 * novo dentro da transação (RN02). Aqui só a leitura do formulário e as mensagens.
 */

export type DependenciasDoPlano = {
  alterarPlano: (para: "GRATUITO" | "PAGO", usuarioId: string, manterId: string | null, agora: Date) => Promise<ResultadoDaTroca>;
  trocarAcesso: (reativarId: string, suspenderId: string | null, agora: Date) => Promise<ResultadoDoAcesso>;
  usuarioId: string;
  agora: Date;
};

export type ResultadoDoPlano = { ok: true; aviso: string } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (v: string | undefined) => (v && UUID.test(v) ? v : null);

export const MENSAGENS_PLANO = {
  pagoAtivado: "Plano pago ativado. Simulação: nenhuma cobrança foi feita.",
  gratuitoAtivado: (suspensos: number, convites: number) =>
    ["Plano gratuito ativado. Nenhum dado foi apagado.", suspensos ? `${suspensos} ${suspensos === 1 ? "colaborador ficou" : "colaboradores ficaram"} sem acesso até um novo upgrade.` : "", convites ? `${convites} ${convites === 1 ? "convite pendente foi cancelado" : "convites pendentes foram cancelados"}.` : ""]
      .filter(Boolean)
      .join(" "),
  reativados: (n: number) => (n ? ` ${n} ${n === 1 ? "colaborador voltou" : "colaboradores voltaram"} a ter acesso.` : ""),
  mesmoPlano: "O negócio já está neste plano.",
  naoEhDono: "Só o Dono do negócio pode trocar o plano.",
  indisponivel: "Este negócio não está mais disponível.",
  escolhaInvalida: "Escolha um colaborador da lista para continuar com acesso.",
  planoInvalido: "Escolha o plano.",
  acessoTrocado: "Acesso atualizado.",
  limite: "No plano gratuito, só 1 colaborador pode ter acesso. Escolha quem deixa de ter acesso para liberar a vaga.",
  membroNaoEncontrado: "Colaborador não encontrado. Atualize a página e tente de novo.",
  planoPago: "No plano pago não há limite de colaboradores.",
} as const;
const M = MENSAGENS_PLANO;

/** Gratuito ↔ pago (RF73); na volta ao gratuito, `manter` é o colaborador que continua (OPEN-001). */
export async function alterarPlano(campos: Record<string, string>, deps: DependenciasDoPlano): Promise<ResultadoDoPlano> {
  const para = campos.para;
  if (para !== "GRATUITO" && para !== "PAGO") return { ok: false, erro: M.planoInvalido };
  const r = await deps.alterarPlano(para, deps.usuarioId, para === "GRATUITO" ? id(campos.manter) : null, deps.agora);
  if (!r.ok) {
    const erro = { MesmoPlano: M.mesmoPlano, NaoEhDono: M.naoEhDono, NegocioIndisponivel: M.indisponivel, EscolhaInvalida: M.escolhaInvalida }[r.erro];
    return { ok: false, erro };
  }
  return { ok: true, aviso: para === "PAGO" ? M.pagoAtivado + M.reativados(r.reativados) : M.gratuitoAtivado(r.suspensos, r.convitesCancelados) };
}

/** Trocar quem tem acesso no gratuito (OPEN-001, 5.2). */
export async function trocarAcesso(campos: Record<string, string>, deps: DependenciasDoPlano): Promise<ResultadoDoPlano> {
  const reativar = id(campos.reativar);
  if (!reativar) return { ok: false, erro: M.membroNaoEncontrado };
  const r = await deps.trocarAcesso(reativar, id(campos.suspender), deps.agora);
  if (r.ok) return { ok: true, aviso: M.acessoTrocado };
  return { ok: false, erro: { LimiteDoPlano: M.limite, MembroNaoEncontrado: M.membroNaoEncontrado, PlanoPago: M.planoPago, NegocioIndisponivel: M.indisponivel }[r.erro] };
}
