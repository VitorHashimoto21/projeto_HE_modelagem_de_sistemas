import type { AnexoSimples, AtividadeMei, PapelUsuario, RegimeTributario } from "@/generated/prisma/enums";

// Textos de exibição dos valores fiscais (SPEC-004).

export const ROTULO_REGIME: Record<RegimeTributario, string> = {
  MEI: "MEI",
  SIMPLES_NACIONAL: "Simples Nacional",
  AUTONOMO: "Autônomo (sem CNPJ)",
};

export const ROTULO_ATIVIDADE_MEI: Record<AtividadeMei, string> = {
  COMERCIO_INDUSTRIA: "Comércio ou indústria",
  SERVICOS: "Serviços",
  COMERCIO_E_SERVICOS: "Comércio e serviços",
};

export const ROTULO_ANEXO: Record<AnexoSimples, string> = {
  I: "Anexo I — comércio",
  II: "Anexo II — indústria",
  III: "Anexo III — serviços (ex.: beleza, manutenção)",
  IV: "Anexo IV — serviços (ex.: limpeza, advocacia)",
  V: "Anexo V — serviços intelectuais (ex.: tecnologia, consultoria)",
};

export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  DONO: "Dono",
  GERENTE: "Gerente",
  COLABORADOR: "Colaborador",
};
