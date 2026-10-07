/**
 * Matriz de permissões módulo × ação (SPEC-005, seção 5.1; RF05, RF06). Pura: sem
 * framework nem banco. As specs dos módulos importam daqui os nomes de módulo e ação.
 */

export const MODULOS = ["catalogo", "estoque", "vendas", "calculadora", "financeiro", "dashboard"] as const;
export const ACOES = ["ver", "criar", "editar", "excluir"] as const;

export type Modulo = (typeof MODULOS)[number];
export type Acao = (typeof ACOES)[number];
export type Papel = "DONO" | "GERENTE" | "COLABORADOR";
export type Matriz = Record<Modulo, Record<Acao, boolean>>;

export const ROTULO_PAPEL: Record<Papel, string> = { DONO: "Dono", GERENTE: "Gerente", COLABORADOR: "Colaborador" };

export const ROTULO_MODULO: Record<Modulo, string> = {
  catalogo: "Catálogo",
  estoque: "Estoque",
  vendas: "Vendas",
  calculadora: "Calculadora",
  financeiro: "Financeiro",
  dashboard: "Dashboard",
};

export const ROTULO_ACAO: Record<Acao, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir/cancelar",
};

function matriz(preencher: (modulo: Modulo, acao: Acao) => boolean): Matriz {
  return Object.fromEntries(
    MODULOS.map((m) => [m, Object.fromEntries(ACOES.map((a) => [a, preencher(m, a)]))]),
  ) as Matriz;
}

export const MATRIZ_COMPLETA: Matriz = matriz(() => true);
export const MATRIZ_VAZIA: Matriz = matriz(() => false);

/** Colaborador padrão (OPEN-001): jornada 2.3 e RF65 (cancelar venda só com permissão granular). */
const COLABORADOR: Partial<Record<Modulo, Acao[]>> = {
  catalogo: ["ver"],
  estoque: ["ver", "criar"],
  vendas: ["ver", "criar"],
  dashboard: ["ver"],
};

/** Predefinições dos papéis (RF05). O Dono tem tudo e ainda as Configurações (fora da matriz). */
export const PREDEFINICOES: Record<Papel, Matriz> = {
  DONO: MATRIZ_COMPLETA,
  GERENTE: MATRIZ_COMPLETA,
  COLABORADOR: matriz((m, a) => COLABORADOR[m]?.includes(a) ?? false),
};

export type ValidacaoDaMatriz = { ok: true; matriz: Matriz } | { ok: false; erro: string };

/**
 * Valida uma matriz informada (INV-008): os 6 módulos e as 4 ações, todos booleanos,
 * nada além disso; "editar" e "excluir/cancelar" exigem "ver" no mesmo módulo.
 */
export function validarMatriz(entrada: unknown): ValidacaoDaMatriz {
  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    return { ok: false, erro: "As permissões precisam informar todos os módulos." };
  }
  const obj = entrada as Record<string, unknown>;
  const desconhecido = Object.keys(obj).find((k) => !(MODULOS as readonly string[]).includes(k));
  if (desconhecido) return { ok: false, erro: `Módulo desconhecido: ${desconhecido}.` };

  for (const m of MODULOS) {
    const linha = obj[m];
    if (typeof linha !== "object" || linha === null || Array.isArray(linha)) {
      return { ok: false, erro: `Faltam as permissões de ${ROTULO_MODULO[m]}.` };
    }
    const acoes = linha as Record<string, unknown>;
    const extra = Object.keys(acoes).find((k) => !(ACOES as readonly string[]).includes(k));
    if (extra) return { ok: false, erro: `Ação desconhecida em ${ROTULO_MODULO[m]}: ${extra}.` };
    for (const a of ACOES) {
      if (typeof acoes[a] !== "boolean") return { ok: false, erro: `Falta a permissão "${ROTULO_ACAO[a]}" de ${ROTULO_MODULO[m]}.` };
    }
    if ((acoes.editar || acoes.excluir) && !acoes.ver) {
      return { ok: false, erro: `Em ${ROTULO_MODULO[m]}, editar e excluir/cancelar exigem também "Ver".` };
    }
  }
  return { ok: true, matriz: matriz((m, a) => (obj[m] as Record<Acao, boolean>)[a]) };
}

/**
 * Permissões efetivas (5.1): o Dono sempre tem tudo; sem matriz customizada, vale a
 * predefinição do papel. Uma matriz gravada inválida não concede nada (falha fechada).
 */
export function permissoesEfetivas(papel: Papel, custom: unknown): Matriz {
  if (papel === "DONO") return MATRIZ_COMPLETA;
  if (custom === null || custom === undefined) return PREDEFINICOES[papel];
  const v = validarMatriz(custom);
  return v.ok ? v.matriz : MATRIZ_VAZIA;
}

export function pode(m: Matriz, modulo: Modulo, acao: Acao): boolean {
  return m[modulo][acao];
}

/** Dashboard completo (OPEN-003): as partes financeiras exigem também "Financeiro: ver". */
export function veDashboardCompleto(m: Matriz): boolean {
  return m.dashboard.ver && m.financeiro.ver;
}

export function matrizesIguais(a: Matriz, b: Matriz): boolean {
  return MODULOS.every((m) => ACOES.every((x) => a[m][x] === b[m][x]));
}

/**
 * Matriz a gravar para um membro: null quando é igual à predefinição do papel, para
 * que a predefinição continue valendo (o membro não aparece como "customizado").
 */
export function matrizParaGravar(papel: Exclude<Papel, "DONO">, m: Matriz): Matriz | null {
  return matrizesIguais(m, PREDEFINICOES[papel]) ? null : m;
}

/** Nome do campo de formulário de cada permissão (ex.: "perm.financeiro.criar"). */
export const campoDaPermissao = (modulo: Modulo, acao: Acao) => `perm.${modulo}.${acao}`;

/** Lê a matriz das caixas de seleção de um formulário (marcada = "on"). */
export function matrizDoFormulario(campos: Record<string, string>): Matriz {
  return matriz((m, a) => campos[campoDaPermissao(m, a)] === "on");
}

/** Resumo legível, um módulo por linha (e-mail do convite e telas). */
export function resumoDaMatriz(m: Matriz): string[] {
  return MODULOS.map((mod) => {
    const acoes = ACOES.filter((a) => m[mod][a]).map((a) => ROTULO_ACAO[a].toLowerCase());
    return `${ROTULO_MODULO[mod]}: ${acoes.length ? acoes.join(", ") : "sem acesso"}`;
  });
}
