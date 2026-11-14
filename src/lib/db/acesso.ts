import type { PrismaClient } from "@/generated/prisma/client";
import type { Filiacao } from "@/lib/auth/contexto";

/**
 * Consultas do controle de acesso (SPEC-002). Ficam aqui, e não no cliente do
 * negócio, porque rodam antes de existir um negócio no contexto: o Usuario é
 * global (ADR-002) e a filiação é o que valida o negócio ativo (INV-006).
 */
export function criarConsultasDeAcesso(cliente: PrismaClient) {
  /**
   * Filiação do usuário no negócio não encerrado (INV-006; SPEC-004), com o papel e a
   * matriz customizada (SPEC-005, INV-004): null se não for membro ou se estiver suspenso
   * pela volta ao plano gratuito (SPEC-013, INV-006).
   */
  // SPEC-019 (5.7): na mesma consulta, a suspensão do negócio pela plataforma (a faixa e as recusas).
  const filiacao = async (usuarioId: string, negocioId: string): Promise<Filiacao | null> => {
    const m = await cliente.membroNegocio.findFirst({
      where: { usuarioId, negocioId, suspensoEm: null, negocio: { encerradoEm: null } },
      select: { papel: true, permissoesCustom: true, negocio: { select: { suspensoEm: true, motivoSuspensao: true } } },
    });
    if (!m) return null;
    const { suspensoEm, motivoSuspensao } = m.negocio;
    return { papel: m.papel, permissoesCustom: m.permissoesCustom, suspensao: suspensoEm && motivoSuspensao ? { desde: suspensoEm, motivo: motivoSuspensao } : null };
  };

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

    /** SPEC-018: papel de Administrador e versão dos termos aceita, lidos a cada requisição. */
    async estadoDaConta(usuarioId: string): Promise<{ administradorEm: Date | null; versaoTermosAceita: string | null; segundoFatorRedefinidoEm: Date | null } | null> {
      return cliente.usuario.findUnique({ where: { id: usuarioId }, select: { administradorEm: true, versaoTermosAceita: true, segundoFatorRedefinidoEm: true } });
    },

    /** SPEC-018 (RF78): registra o novo aceite da versão vigente da política e dos termos. */
    async aceitarTermos(usuarioId: string, versao: string, agora: Date): Promise<void> {
      await cliente.usuario.update({ where: { id: usuarioId }, data: { versaoTermosAceita: versao, termosAceitosEm: agora } });
    },

    /** Dados exibidos no cabeçalho da área autenticada. */
    async perfil(usuarioId: string): Promise<{ nome: string; email: string } | null> {
      return cliente.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true, email: true } });
    },
  };
}

export type ConsultasDeAcesso = ReturnType<typeof criarConsultasDeAcesso>;
