import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Consultas do controle de acesso (SPEC-002). Ficam aqui, e não no cliente do
 * negócio, porque rodam antes de existir um negócio no contexto: o Usuario é
 * global (ADR-002) e a filiação é o que valida o negócio ativo (INV-006).
 */
export function criarConsultasDeAcesso(cliente: PrismaClient) {
  return {
    /**
     * Conta que não pode entrar (INV-008): com `excluidoEm` preenchido ou, por
     * segurança, sem o registro em Usuario (o gatilho garante que ele exista).
     */
    async usuarioBloqueado(usuarioId: string): Promise<boolean> {
      const usuario = await cliente.usuario.findUnique({ where: { id: usuarioId }, select: { excluidoEm: true } });
      return !usuario || usuario.excluidoEm !== null;
    },

    /** O usuário é membro do negócio? (INV-006) */
    async ehMembro(usuarioId: string, negocioId: string): Promise<boolean> {
      const membro = await cliente.membroNegocio.findUnique({
        where: { usuarioId_negocioId: { usuarioId, negocioId } },
        select: { id: true },
      });
      return membro !== null;
    },

    /** Dados exibidos no cabeçalho da área autenticada. */
    async perfil(usuarioId: string): Promise<{ nome: string; email: string } | null> {
      return cliente.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true, email: true } });
    },
  };
}

export type ConsultasDeAcesso = ReturnType<typeof criarConsultasDeAcesso>;
