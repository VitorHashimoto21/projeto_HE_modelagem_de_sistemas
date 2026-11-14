import "server-only";
import { createHash } from "node:crypto";
import type { ContextoComPapel } from "@/lib/auth/contexto";
import { planos, suporte, type EmergenciaAtiva } from "@/lib/db";
import type { PlanoNegocio } from "@/generated/prisma/enums";
import { chaveDasFaixas } from "@/lib/dominio/faixas";
import type { Modulo } from "@/lib/dominio/permissoes";

/** As leituras das faixas (injetáveis nos testes de integração). */
export type ConsultasDasFaixas = {
  plano: (negocioId: string) => Promise<PlanoNegocio | null>;
  liberacao: (negocioId: string, agora: Date) => Promise<{ id: string; modulos: Modulo[]; modulosComCorrecao: Modulo[]; expiraEm: Date } | null>;
  emergencia: (negocioId: string, agora: Date) => Promise<EmergenciaAtiva | null>;
};

/**
 * O que as faixas e o menu da área do negócio mostram, e a assinatura desse estado (correção da homologação
 * da SPEC-019, T17). O layout usa os dados para desenhar as faixas; a rota `/api/faixas` devolve só a
 * assinatura, que o navegador compara com a da tela para saber se precisa atualizar o layout. Só leitura:
 * nada é registrado, nem no modo suporte.
 */
export async function estadoDasFaixas(contexto: ContextoComPapel, agora: Date, consultas: ConsultasDasFaixas) {
  const modoSuporte = contexto.suporte ?? null;
  // A mesma condição do layout: as faixas da equipe só para quem é membro e não está no modo suporte.
  const membroDoNegocio = Boolean(contexto.negocioId && contexto.permissoes && (contexto.papel || modoSuporte));
  const negocioDaEquipe = membroDoNegocio && !modoSuporte ? contexto.negocioId : null;

  const [plano, liberacao, emergencia] = await Promise.all([
    contexto.negocioId ? consultas.plano(contexto.negocioId) : Promise.resolve(null),
    negocioDaEquipe ? consultas.liberacao(negocioDaEquipe, agora) : Promise.resolve(null),
    // SPEC-019 (5.6, INV-007): todos os membros veem a faixa vermelha enquanto houver acesso de emergência.
    negocioDaEquipe ? consultas.emergencia(negocioDaEquipe, agora) : Promise.resolve(null),
  ]);

  const chave = chaveDasFaixas({
    negocioId: contexto.negocioId ?? null,
    papel: contexto.papel ?? null,
    permissoes: contexto.permissoes ?? null,
    plano,
    modoSuporte: modoSuporte && {
      acessoId: modoSuporte.acessoId,
      expiraEm: modoSuporte.expiraEm,
      modulos: modoSuporte.modulos,
      modulosComCorrecao: modoSuporte.modulosComCorrecao,
      correcaoPendente: Boolean(modoSuporte.correcaoPendente),
      emergencia: Boolean(modoSuporte.emergencia),
    },
    suspensao: membroDoNegocio && contexto.negocioSuspenso ? contexto.negocioSuspenso : null,
    liberacao,
    emergencia,
  });

  return { plano, liberacao, emergencia, assinatura: createHash("sha256").update(chave).digest("base64url").slice(0, 22) };
}

/** No layout e na rota: as leituras do banco da aplicação. */
export function carregarFaixas(contexto: ContextoComPapel, agora: Date) {
  const s = suporte();
  const p = planos();
  return estadoDasFaixas(contexto, agora, {
    plano: (negocioId) => p.planoDoNegocio(negocioId),
    liberacao: (negocioId, quando) => s.liberacaoAtiva(negocioId, quando),
    emergencia: (negocioId, quando) => s.emergenciaAtiva(negocioId, quando),
  });
}
