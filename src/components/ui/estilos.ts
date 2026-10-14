import { cn } from "@/lib/utils";

/**
 * Classes do design system (SPEC-016, 5.4). Ficam num módulo sem "use client" para que
 * páginas do servidor também possam usá-las em <Link> e <a>. Toda cor, raio e duração vem
 * de token (INV-003): nada de hex aqui.
 */

export type VarianteDoBotao = "principal" | "secundario" | "perigo" | "fantasma" | "ambar" | "na-estrutura";
export type TamanhoDoBotao = "md" | "sm" | "lg" | "icone" | "icone-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,color,transform,box-shadow] duration-(--duracao-estado) ease-(--ease-saida) " +
  "active:scale-[0.96] active:duration-(--duracao-toque) disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:shrink-0";

const variantes: Record<VarianteDoBotao, string> = {
  principal: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secundario: "border border-input bg-card text-foreground hover:bg-accent",
  perigo: "bg-destructive text-destructive-foreground hover:opacity-90",
  fantasma: "text-primary hover:bg-accent",
  ambar: "bg-ambar text-ambar-foreground hover:brightness-105",
  "na-estrutura": "border border-estrutura-foreground/35 text-estrutura-foreground hover:bg-estrutura-foreground/10",
};

const tamanhos: Record<TamanhoDoBotao, string> = {
  sm: "h-9 px-4 text-sm [&_svg]:size-4",
  md: "h-11 px-5 text-sm [&_svg]:size-4",
  lg: "h-13 px-6 text-base [&_svg]:size-5",
  icone: "size-11 [&_svg]:size-5",
  "icone-sm": "size-9 [&_svg]:size-4",
};

export const classeDoBotao = (variante: VarianteDoBotao = "principal", tamanho: TamanhoDoBotao = "md", extra?: string) =>
  cn(base, variantes[variante], tamanhos[tamanho], extra);

/** Superfícies por hierarquia: cartão (20), destaque na estrutura (24), recuo (16). */
export type TomDaSuperficie = "cartao" | "estrutura" | "recuo" | "atencao" | "perigo";

const tons: Record<TomDaSuperficie, string> = {
  cartao: "rounded-2xl bg-card text-card-foreground",
  estrutura: "rounded-3xl bg-estrutura text-estrutura-foreground",
  recuo: "rounded-lg bg-muted text-foreground",
  atencao: "rounded-2xl bg-status-warn-bg text-foreground",
  perigo: "rounded-2xl bg-status-danger-bg text-foreground",
};

export const classeDaSuperficie = (tom: TomDaSuperficie = "cartao", extra?: string) => cn(tons[tom], extra);

/** Link de texto (ação secundária dentro de um cartão). */
export const classeDoLink = (extra?: string) =>
  cn("font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring rounded-sm", extra);

/** Item de um grupo de segmentos (filtros, abas, visões). */
export const classeDoSegmento = (ativo: boolean, extra?: string) =>
  cn(
    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
    "transition-colors duration-(--duracao-estado) ease-(--ease-saida) focus-visible:outline-2 focus-visible:outline-ring",
    ativo ? "bg-estrutura text-estrutura-foreground" : "text-foreground hover:bg-accent",
    extra,
  );
