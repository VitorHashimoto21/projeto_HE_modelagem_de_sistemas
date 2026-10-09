import type { FormaPagamento, StatusConta } from "@/generated/prisma/enums";

// Textos de exibição da venda (SPEC-008). Sem "use client": usado também pelo servidor.

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  CREDITO_TROCA: "Crédito de troca",
};

export const ROTULO_CONTA: Record<StatusConta, string> = {
  ABERTA: "A receber",
  PARCIAL: "Recebida em parte",
  QUITADA: "Recebida",
  CANCELADA: "Cancelada",
};

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
