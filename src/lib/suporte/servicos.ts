import type { LiberacaoDoContexto } from "@/lib/auth/contexto";
import type { ContextoDoMembro } from "@/lib/auth/autorizacao";
import type { MensagemDeEmail } from "@/lib/integracoes/email";
import type { Modulo } from "@/lib/dominio/permissoes";
import {
  dataHoraCompleta,
  listaDeModulos,
  MENSAGENS_SUPORTE,
  PRAZOS,
  validarLiberacao,
  type DadosDaLiberacao,
} from "@/lib/dominio/suporte";

/**
 * Fluxos do acesso de suporte (SPEC-018), sem framework: as Server Actions só leem o
 * formulário e chamam estes fluxos, que validam tudo de novo. Dependências injetadas,
 * para os testes exercitarem o fluxo direto.
 */

export type EstadoDaLiberacao =
  | { status: "ocioso" }
  | { status: "erro"; mensagem?: string; erros?: Partial<Record<"motivo" | "modulos" | "prazo", string>> }
  | { status: "ok"; mensagem: string };

export const LIBERACAO_INICIAL: EstadoDaLiberacao = { status: "ocioso" };

export type DependenciasDoDono = {
  membro: ContextoDoMembro;
  agora: () => Date;
  liberar: (negocioId: string, donoId: string, dados: DadosDaLiberacao, agora: Date) => Promise<{ id: string; expiraEm: Date } | null>;
  revogar: (negocioId: string, acessoId: string, donoId: string, agora: Date) => Promise<boolean>;
  dono: (negocioId: string) => Promise<{ nome: string; email: string; negocio: string } | null>;
  /** Envio depois da resposta (OPEN-009): falha no e-mail nunca bloqueia a liberação. */
  avisar: (m: MensagemDeEmail) => void;
  origem: string;
};

/** Liberar o acesso do suporte (RF75, 5.4): só o Dono (a fábrica e o papel conferem). */
export async function liberar(campos: Record<string, string | undefined>, deps: DependenciasDoDono): Promise<EstadoDaLiberacao> {
  if (deps.membro.papel !== "DONO") return { status: "erro", mensagem: "Só o Dono libera o acesso do suporte." };
  const v = validarLiberacao(campos);
  if (!v.ok) return { status: "erro", erros: v.erros };
  const agora = deps.agora();
  const criada = await deps.liberar(deps.membro.negocioId, deps.membro.usuarioId, v.dados, agora);
  if (!criada) return { status: "erro", mensagem: MENSAGENS_SUPORTE.negocioEncerrado };
  const dono = await deps.dono(deps.membro.negocioId);
  if (dono) deps.avisar(emailDeLiberacao(dono, v.dados.modulos, criada.expiraEm, PRAZOS[v.dados.prazo].rotulo, deps.origem));
  return { status: "ok", mensagem: `${MENSAGENS_SUPORTE.liberado} Vale até ${dataHoraCompleta(criada.expiraEm)}.` };
}

export async function revogar(acessoId: string, deps: DependenciasDoDono): Promise<EstadoDaLiberacao> {
  if (deps.membro.papel !== "DONO") return { status: "erro", mensagem: "Só o Dono revoga o acesso do suporte." };
  const ok = await deps.revogar(deps.membro.negocioId, acessoId, deps.membro.usuarioId, deps.agora());
  return ok ? { status: "ok", mensagem: MENSAGENS_SUPORTE.revogado } : { status: "erro", mensagem: "Este acesso já tinha terminado." };
}

// ---------------------------------------------------------------- Administrador (5.5)

export type DependenciasDoAdministrador = {
  administradorId: string;
  agora: () => Date;
  liberacaoAtiva: (negocioId: string) => Promise<{ id: string } | null>;
  entrar: (acessoId: string, administradorId: string, agora: Date) => Promise<{ ok: true; primeira: boolean; negocioId: string } | { ok: false; erro: string }>;
  liberacao: (acessoId: string) => Promise<LiberacaoDoContexto | null>;
  sair: (negocioId: string, acessoId: string, administradorId: string) => Promise<void>;
  dono: (negocioId: string) => Promise<{ nome: string; email: string; negocio: string } | null>;
  avisar: (m: MensagemDeEmail) => void;
  origem: string;
};

export type ResultadoDaEntrada = { ok: true; acessoId: string; expiraEm: Date; destino: string } | { ok: false; mensagem: string };

/** Primeira tela do modo suporte: o primeiro módulo liberado, na ordem da matriz. */
const TELA_INICIAL: Record<Modulo, string> = {
  dashboard: "/painel",
  vendas: "/vendas",
  estoque: "/estoque",
  catalogo: "/catalogo",
  financeiro: "/financeiro",
  calculadora: "/calculadora",
};
const ORDEM_DE_ENTRADA: Modulo[] = ["dashboard", "vendas", "estoque", "catalogo", "financeiro", "calculadora"];

/** Entrar em modo suporte (5.5): só com liberação ativa, conferida e registrada no banco. */
export async function entrar(negocioId: string, deps: DependenciasDoAdministrador): Promise<ResultadoDaEntrada> {
  const ativa = await deps.liberacaoAtiva(negocioId);
  if (!ativa) return { ok: false, mensagem: MENSAGENS_SUPORTE.semLiberacao };
  const agora = deps.agora();
  const r = await deps.entrar(ativa.id, deps.administradorId, agora);
  if (!r.ok) return { ok: false, mensagem: MENSAGENS_SUPORTE.expirou };
  const lida = await deps.liberacao(ativa.id);
  if (!lida) return { ok: false, mensagem: MENSAGENS_SUPORTE.expirou };
  if (r.primeira) {
    const dono = await deps.dono(negocioId);
    if (dono) deps.avisar(emailDeEntrada(dono, agora, deps.origem));
  }
  const primeiro = ORDEM_DE_ENTRADA.find((m) => lida.modulos.includes(m)) ?? "dashboard";
  return { ok: true, acessoId: ativa.id, expiraEm: lida.expiraEm, destino: TELA_INICIAL[primeiro] };
}

/** Sair do modo suporte (5.5): registra a saída se a liberação ainda existir. */
export async function sair(acessoId: string | null, deps: DependenciasDoAdministrador): Promise<string | null> {
  if (!acessoId) return null;
  const lida = await deps.liberacao(acessoId);
  if (!lida) return null;
  await deps.sair(lida.negocioId, acessoId, deps.administradorId);
  return lida.negocioId;
}

// ---------------------------------------------------------------- e-mails ao Dono (OPEN-009)

function emailDeLiberacao(dono: { nome: string; email: string; negocio: string }, modulos: Modulo[], expira: Date, prazo: string, origem: string): MensagemDeEmail {
  return {
    para: dono.email,
    assunto: `Você liberou o acesso do suporte ao ${dono.negocio}`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `Você liberou o suporte do Health Enterprise para ver (sem alterar) ${listaDeModulos(modulos)} do negócio ${dono.negocio}, por ${prazo}: até ${dataHoraCompleta(expira)}.`,
      "Nomes e contatos dos seus clientes e e-mails da equipe aparecem mascarados para o suporte.",
      `Você acompanha cada tela aberta e pode revogar quando quiser em ${origem}/negocio/suporte.`,
      "",
      "Se não foi você, revogue o acesso e troque a sua senha.",
    ].join("\n"),
  };
}

function emailDeEntrada(dono: { nome: string; email: string; negocio: string }, quando: Date, origem: string): MensagemDeEmail {
  return {
    para: dono.email,
    assunto: `O suporte do HE entrou no ${dono.negocio}`,
    texto: [
      `Olá, ${dono.nome}!`,
      "",
      `O suporte do Health Enterprise entrou no negócio ${dono.negocio} em ${dataHoraCompleta(quando)}, em modo somente leitura, usando o acesso que você liberou.`,
      `Veja cada tela aberta ou revogue o acesso em ${origem}/negocio/suporte.`,
    ].join("\n"),
  };
}

