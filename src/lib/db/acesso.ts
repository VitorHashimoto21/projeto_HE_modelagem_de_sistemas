import type { PrismaClient } from "@/generated/prisma/client";
import type { PapelUsuario } from "@/generated/prisma/enums";

/**
 * Consultas do controle de acesso (SPEC-002). Ficam aqui, e não no cliente do
 * negócio, porque rodam antes de existir um negócio no contexto: o Usuario é
 * global (ADR-002) e a filiação é o que valida o negócio ativo (INV-006).
 */
export function criarConsultasDeAcesso(cliente: PrismaClient) {
  /**
   * Filiação do usuário no negócio não encerrado (INV-006; SPEC-004), com o papel e a
   * matriz customizada (SPEC-005, INV-004): null se não for membro.
   */
  const filiacao = (usuarioId: string, negocioId: string): Promise<{ papel: PapelUsuario; permissoesCustom: unknown } | null> =>
    cliente.membroNegocio.findFirst({
      where: { usuarioId, negocioId, negocio: { encerradoEm: null } },
      select: { papel: true, permissoesCustom: true },
    });

  return {
    /**
     * Conta que não pode entrar (INV-008): com `excluidoEm` preenchido ou, por
     * segurança, sem o registro em Usuario (o gatilho garante que ele exista).
     */
    async usuarioBloqueado(usuarioId: string): Promise<boolean> {
      const usuario = await cliente.usuario.findUnique({ where: { id: usuarioId }, select: { excluidoEm: true } });
      return !usuario || usuario.excluidoEm !== null;
    },

    filiacao,

    /** O usuário é membro do negócio, e o negócio não está encerrado? (INV-006; SPEC-004) */
    async ehMembro(usuarioId: string, negocioId: string): Promise<boolean> {
      return (await filiacao(usuarioId, negocioId)) !== null;
    },

    /** Dados exibidos no cabeçalho da área autenticada. */
    async perfil(usuarioId: string): Promise<{ nome: string; email: string } | null> {
      return cliente.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true, email: true } });
    },
  };
}

export type ConsultasDeAcesso = ReturnType<typeof criarConsultasDeAcesso>;
