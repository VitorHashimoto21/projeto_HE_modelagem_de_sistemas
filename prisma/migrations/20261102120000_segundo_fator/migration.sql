-- SPEC-019, etapa 1 (2º fator do Administrador). Só acrescenta: nenhum dado existente muda.
-- Os fatores ficam no Supabase Auth (auth.mfa_factors), nunca nas tabelas do HE (RNF03).

-- AlterEnum
ALTER TYPE "EventoSuporte" ADD VALUE 'SEGUNDO_FATOR_CADASTRADO';
ALTER TYPE "EventoSuporte" ADD VALUE 'SEGUNDO_FATOR_REMOVIDO';
ALTER TYPE "EventoSuporte" ADD VALUE 'SEGUNDO_FATOR_REDEFINIDO';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "segundoFatorRedefinidoEm" TIMESTAMP(3);

-- Os eventos do 2º fator são da conta, sem negócio, como os de papel (SPEC-018). A comparação é em
-- texto porque um valor novo de enum não pode ser usado na mesma transação em que foi criado.
ALTER TABLE "RegistroSuporte" DROP CONSTRAINT "RegistroSuporte_negocio_do_evento";
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_negocio_do_evento" CHECK (
  ("evento"::text IN ('PAPEL_CONCEDIDO', 'PAPEL_RETIRADO', 'SEGUNDO_FATOR_CADASTRADO', 'SEGUNDO_FATOR_REMOVIDO', 'SEGUNDO_FATOR_REDEFINIDO')) = ("negocioId" IS NULL)
);
