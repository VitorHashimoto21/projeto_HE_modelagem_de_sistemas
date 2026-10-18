/**
 * Acesso de suporte (SPEC-018). Regras puras, sem framework nem banco: prazos da liberação,
 * situação, matriz só de leitura, máscara de dados pessoais, sessão do Administrador e a
 * descrição das telas para o registro de auditoria.
 */

import { FUSO_NEGOCIO } from "./datas";
import { ACOES, MODULOS, ROTULO_MODULO, type Matriz, type Modulo } from "./permissoes";

/** OPEN-006: prazos que o Dono escolhe; 24 h é o padrão. */
export const PRAZOS = {
  "1h": { rotulo: "1 hora", horas: 1 },
  "24h": { rotulo: "24 horas", horas: 24 },
  "3d": { rotulo: "3 dias", horas: 72 },
  "7d": { rotulo: "7 dias", horas: 168 },
} as const;
export type Prazo = keyof typeof PRAZOS;
export const PRAZO_PADRAO: Prazo = "24h";

export const MAX_MOTIVO_SUPORTE = 300;
/** RNF12 (OPEN-002): a sessão do Administrador vale 8 h desde a entrada; o 2º fator vem na SPEC-019. */
export const HORAS_DA_SESSAO_DO_ADMINISTRADOR = 8;

export const MENSAGENS_SUPORTE = {
  motivoObrigatorio: "Conte ao suporte o que precisa ser visto.",
  motivoLongo: `Use no máximo ${MAX_MOTIVO_SUPORTE} caracteres.`,
  modulosObrigatorios: "Marque ao menos um módulo.",
  prazoInvalido: "Escolha um dos prazos.",
  negocioEncerrado: "Este negócio está encerrado e não pode liberar o acesso do suporte.",
  liberado: "Acesso do suporte liberado.",
  revogado: "Acesso do suporte revogado.",
  semLiberacao: "O Dono ainda não liberou o acesso. Peça a ele em Configurações → Acesso do suporte.",
  expirou: "O acesso do suporte a este negócio expirou.",
  revogadoPeloDono: "O Dono revogou o acesso do suporte.",
  somenteLeitura: "No modo suporte, nada pode ser alterado.",
} as const;

export type DadosDaLiberacao = { motivo: string; modulos: Modulo[]; prazo: Prazo };
export type ValidacaoDaLiberacao =
  | { ok: true; dados: DadosDaLiberacao }
  | { ok: false; erros: Partial<Record<"motivo" | "modulos" | "prazo", string>> };

/** Campo de formulário de cada módulo liberado (ex.: "modulo.vendas"). */
export const campoDoModulo = (m: Modulo) => `modulo.${m}`;

/** Valida a liberação pedida pelo Dono (RF75, 5.4). */
export function validarLiberacao(campos: Record<string, string | undefined>): ValidacaoDaLiberacao {
  const erros: Partial<Record<"motivo" | "modulos" | "prazo", string>> = {};
  const motivo = (campos.motivo ?? "").trim().replace(/\s+/g, " ");
  if (!motivo) erros.motivo = MENSAGENS_SUPORTE.motivoObrigatorio;
  else if (motivo.length > MAX_MOTIVO_SUPORTE) erros.motivo = MENSAGENS_SUPORTE.motivoLongo;
  const modulos = MODULOS.filter((m) => campos[campoDoModulo(m)] === "on");
  if (modulos.length === 0) erros.modulos = MENSAGENS_SUPORTE.modulosObrigatorios;
  const prazo = campos.prazo ?? "";
  if (!(prazo in PRAZOS)) erros.prazo = MENSAGENS_SUPORTE.prazoInvalido;
  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { motivo, modulos, prazo: prazo as Prazo } };
}

export function expiraEm(agora: Date, prazo: Prazo): Date {
  return new Date(agora.getTime() + PRAZOS[prazo].horas * 3_600_000);
}

export type SituacaoDaLiberacao = "ATIVA" | "EXPIRADA" | "REVOGADA";

export function situacaoDaLiberacao(l: { expiraEm: Date; revogadoEm: Date | null }, agora: Date): SituacaoDaLiberacao {
  if (l.revogadoEm) return "REVOGADA";
  return l.expiraEm.getTime() > agora.getTime() ? "ATIVA" : "EXPIRADA";
}

/** Só os módulos válidos da matriz, na ordem dela (o banco pode ter qualquer texto). */
export function modulosValidos(lista: readonly string[]): Modulo[] {
  return MODULOS.filter((m) => lista.includes(m));
}

/** Matriz do modo suporte (INV-003): só "ver" nos módulos liberados; o resto, negado. */
export function matrizDoSuporte(modulos: readonly string[]): Matriz {
  const liberados = modulosValidos(modulos);
  return Object.fromEntries(
    MODULOS.map((m) => [m, Object.fromEntries(ACOES.map((a) => [a, a === "ver" && liberados.includes(m)]))]),
  ) as Matriz;
}


export const listaDeModulos = (modulos: readonly string[]) => modulosValidos(modulos).map((m) => ROTULO_MODULO[m]).join(", ");

// ---------------------------------------------------------------------------------------
// Máscara de dados pessoais (OPEN-007, INV-006): aplicada no servidor, antes da tela.

/** "Maria Silva" → "M*** S***". */
export function mascararNome(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "***";
  return palavras.map((p) => `${p[0]!.toUpperCase()}***`).join(" ");
}

/** Telefone ou e-mail de contato: "•••" + os 2 últimos caracteres. */
export function mascararContato(contato: string): string {
  const limpo = contato.trim();
  return limpo.length <= 2 ? "•••" : `•••${limpo.slice(-2)}`;
}

/** "rafael@exemplo.com" → "r***@exemplo.com". */
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!local || !dominio) return "***";
  return `${local[0]}***@${dominio}`;
}

// ---------------------------------------------------------------------------------------
// Sessão do Administrador (RNF12, INV-010).

/**
 * A sessão de uma conta de Administrador vale 8 h desde a entrada (autenticação com senha).
 * Sem o horário da entrada, a sessão não é aceita (falha fechada).
 */
export function sessaoDoAdministradorValida(autenticadoEm: Date | null, agora: Date): boolean {
  if (!autenticadoEm || Number.isNaN(autenticadoEm.getTime())) return false;
  const decorrido = agora.getTime() - autenticadoEm.getTime();
  return decorrido >= -60_000 && decorrido < HORAS_DA_SESSAO_DO_ADMINISTRADOR * 3_600_000;
}

/**
 * Horário da entrada a partir das claims do JWT do Supabase: o `amr` (métodos de
 * autenticação) guarda o momento do login e não muda quando a sessão é renovada.
 */
export function autenticadoEmDasClaims(claims: Record<string, unknown> | null | undefined): Date | null {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return null;
  const instantes = amr
    .map((a) => (typeof a === "object" && a !== null ? (a as { timestamp?: unknown }).timestamp : undefined))
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  return instantes.length ? new Date(Math.max(...instantes) * 1000) : null;
}

// ---------------------------------------------------------------------------------------
// Datas exibidas nos avisos (fuso do negócio, RN29).

const formatoCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_NEGOCIO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatoCompleto = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_NEGOCIO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "18/10, 14:30" */
export const dataHoraCurta = (d: Date) => formatoCurto.format(d);
/** "18/10/2026, 14:30" */
export const dataHoraCompleta = (d: Date) => formatoCompleto.format(d);

// ---------------------------------------------------------------------------------------
// Descrição das telas no registro (OPEN-008, 5.5): módulo e um texto curto, a partir do caminho.

export type TelaDoSuporte = { modulo: Modulo | null; descricao: string; detalhe?: { tipo: "venda" | "item" | "conta"; id: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGINAS: { prefixo: string; modulo: Modulo | null; descricao: string }[] = [
  { prefixo: "/painel", modulo: "dashboard", descricao: "Painel" },
  { prefixo: "/catalogo", modulo: "catalogo", descricao: "Catálogo" },
  { prefixo: "/estoque", modulo: "estoque", descricao: "Estoque" },
  { prefixo: "/vendas", modulo: "vendas", descricao: "Vendas — histórico" },
  { prefixo: "/calculadora", modulo: "calculadora", descricao: "Calculadora" },
  { prefixo: "/financeiro/contas", modulo: "financeiro", descricao: "Financeiro — contas" },
  { prefixo: "/financeiro/despesas-fixas", modulo: "financeiro", descricao: "Financeiro — despesas fixas" },
  { prefixo: "/financeiro", modulo: "financeiro", descricao: "Financeiro — caixa" },
  { prefixo: "/relatorios", modulo: null, descricao: "Relatórios" },
];

const PERIODOS: Record<string, string> = { hoje: "hoje", ontem: "ontem", "7dias": "últimos 7 dias", mes: "este mês" };

function periodo(busca: URLSearchParams): string {
  const rotulo = PERIODOS[busca.get("periodo") ?? ""];
  if (rotulo) return ` (${rotulo})`;
  const de = busca.get("de");
  const ate = busca.get("ate");
  const br = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : null);
  const [a, b] = [br(de), br(ate)];
  return a && b ? (a === b ? ` (${a})` : ` (${a} a ${b})`) : "";
}

/**
 * Descreve a tela aberta em modo suporte a partir do caminho e da busca. Telas de detalhe
 * (venda, item, conta) trazem o id para quem chama completar com o número ou o nome.
 */
export function descreverTela(caminhoComBusca: string): TelaDoSuporte {
  const url = new URL(caminhoComBusca || "/", "http://interno.invalid");
  const caminho = url.pathname.replace(/\/+$/, "") || "/";
  const partes = caminho.split("/").filter(Boolean);
  const pagina = PAGINAS.find((p) => caminho === p.prefixo || caminho.startsWith(`${p.prefixo}/`));
  if (!pagina) return { modulo: null, descricao: caminho.slice(0, 120) };

  const id = partes.find((p) => UUID.test(p));
  if (id && pagina.prefixo === "/vendas") return { modulo: "vendas", descricao: "Vendas — detalhe de venda", detalhe: { tipo: "venda", id } };
  if (id && (pagina.prefixo === "/catalogo" || pagina.prefixo === "/estoque")) {
    return { modulo: pagina.modulo, descricao: `${pagina.descricao} — item`, detalhe: { tipo: "item", id } };
  }
  if (id && pagina.prefixo === "/financeiro/contas") return { modulo: "financeiro", descricao: "Financeiro — conta", detalhe: { tipo: "conta", id } };
  return { modulo: pagina.modulo, descricao: `${pagina.descricao}${periodo(url.searchParams)}` };
}
