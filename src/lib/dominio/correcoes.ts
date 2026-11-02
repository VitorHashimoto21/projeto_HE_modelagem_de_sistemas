/**
 * Correções em modo suporte (SPEC-019, 5.2 a 5.5; OPEN-004 a OPEN-006; RN37). Regras puras, sem
 * framework. A lista fechada vive só aqui (5.4 ↔ CORRECOES_PERMITIDAS): toda ação que não está nela
 * nasce proibida no modo suporte, mesmo com o módulo em "ver e corrigir".
 */

import type { Modulo } from "./permissoes";

/**
 * Módulos que têm correções na lista; Vendas e Dashboard ficam só em "ver". A Calculadora e o
 * Financeiro entram com as correções deles, na etapa 2b: até lá, a gaveta não os oferece.
 */
export const MODULOS_CORRIGIVEIS = ["catalogo", "estoque"] as const satisfies readonly Modulo[];
export type ModuloCorrigivel = (typeof MODULOS_CORRIGIVEIS)[number];
export const ehCorrigivel = (m: string): m is ModuloCorrigivel => (MODULOS_CORRIGIVEIS as readonly string[]).includes(m);

/** Prazos da liberação com correção (OPEN-004, ajuste da equipe): 1 h, o padrão, ou 12 h. */
export const PRAZOS_COM_CORRECAO = ["1h", "12h"] as const;
export type PrazoComCorrecao = (typeof PRAZOS_COM_CORRECAO)[number];

/** O Dono desfaz uma correção em até 30 dias (OPEN-006). */
export const DIAS_PARA_DESFAZER = 30;

/**
 * A lista fechada (5.4). Cada entrada diz o módulo, o que o Dono vê e como a correção é desfeita.
 * As da etapa 2a são do Catálogo e do Estoque; as da Calculadora e do Financeiro chegam na 2b.
 */
export const CORRECOES_PERMITIDAS = {
  "catalogo.editarItem": { modulo: "catalogo", rotulo: "Editar item", desfazer: "Volta os campos anteriores do item" },
  "catalogo.definirPreco": { modulo: "catalogo", rotulo: "Definir preço", desfazer: "Novo registro de preço com o valor anterior" },
  "catalogo.arquivarItem": { modulo: "catalogo", rotulo: "Arquivar ou reativar item", desfazer: "A operação inversa" },
  "catalogo.criarSubcategoria": { modulo: "catalogo", rotulo: "Criar subcategoria", desfazer: "Exclui a subcategoria, se nenhum item a usa" },
  "catalogo.renomearSubcategoria": { modulo: "catalogo", rotulo: "Renomear subcategoria", desfazer: "Volta o nome anterior" },
  "estoque.registrarEntrada": { modulo: "estoque", rotulo: "Registrar entrada", desfazer: "Saída manual da mesma quantidade" },
  "estoque.registrarSaida": { modulo: "estoque", rotulo: "Registrar saída manual", desfazer: "Entrada da mesma quantidade" },
  "estoque.definirMinimo": { modulo: "estoque", rotulo: "Definir estoque mínimo", desfazer: "Volta o valor anterior" },
} as const satisfies Record<string, { modulo: ModuloCorrigivel; rotulo: string; desfazer: string }>;

export type IdDaCorrecao = keyof typeof CORRECOES_PERMITIDAS;
export const ehCorrecao = (id: string): id is IdDaCorrecao => Object.hasOwn(CORRECOES_PERMITIDAS, id);
export const moduloDaCorrecao = (id: IdDaCorrecao): ModuloCorrigivel => CORRECOES_PERMITIDAS[id].modulo;

/** O que o suporte pode alterar em cada módulo, para a gaveta da liberação (5.2, item 2). */
export function correcoesDoModulo(modulo: ModuloCorrigivel): string[] {
  return Object.values(CORRECOES_PERMITIDAS)
    .filter((c) => c.modulo === modulo)
    .map((c) => c.rotulo);
}

/**
 * A correção é aceita no contexto de suporte (INV-003): está na lista e o módulo dela está em
 * "ver e corrigir" na liberação ativa.
 */
export function correcaoPermitida(id: string | undefined, modulosComCorrecao: readonly string[]): id is IdDaCorrecao {
  return id !== undefined && ehCorrecao(id) && modulosComCorrecao.includes(moduloDaCorrecao(id));
}

/**
 * O botão da correção aparece na tela do modo suporte (5.3, item 2): só as ações da lista, nos módulos
 * em "ver e corrigir". Para os membros, as telas continuam olhando as permissões.
 */
export const corrige = (membro: { suporte?: { modulosComCorrecao: readonly string[] } | null }, id: IdDaCorrecao): boolean =>
  correcaoPermitida(id, membro.suporte?.modulosComCorrecao ?? []);

/** Até 30 dias depois da correção (5.5). */
export function dentroDoPrazoDeDesfazer(corrigidaEm: Date, agora: Date): boolean {
  return agora.getTime() - corrigidaEm.getTime() <= DIAS_PARA_DESFAZER * 86_400_000;
}

export const MENSAGENS_DAS_CORRECOES = {
  foraDaLista: "Esta ação não está entre as correções que o suporte pode fazer.",
  moduloSemCorrecao: "O Dono liberou este módulo só para ver.",
  prazoComCorrecao: "Com correção, o prazo é de 1 hora ou 12 horas.",
  correcaoForaDosModulos: "Marque o módulo para ver antes de permitir a correção.",
  naoPodeMaisDesfazer: "Esta correção não pode mais ser desfeita.",
  somenteDono: "Só o Dono desfaz uma correção do suporte.",
  desfeita: "Correção desfeita.",
  textoDaGaveta: "Cada correção aparece em Acessos do suporte na hora, com o antes e o depois, e você pode desfazê-la em até 30 dias.",
  /** "{Item} mudou depois da correção. Ajuste direto em {módulo}." */
  registroMudou: (registro: string, modulo: string) => `${registro} mudou depois da correção. Ajuste direto em ${modulo}.`,
  saldoInsuficiente: (saldo: string) => `O estoque atual não permite desfazer: saldo ${saldo}.`,
} as const;
