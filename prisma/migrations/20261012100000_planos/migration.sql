-- SPEC-013 — Plano gratuito x pago.

-- OPEN-001: membro suspenso na volta ao plano gratuito (vinculo, papel e permissoes mantidos).
ALTER TABLE "MembroNegocio" ADD COLUMN "suspensoEm" TIMESTAMP(3);
ALTER TABLE "MembroNegocio" ADD CONSTRAINT "MembroNegocio_dono_nunca_suspenso"
  CHECK ("papel" <> 'DONO' OR "suspensoEm" IS NULL);

-- OPEN-007: historico das trocas de plano, somente insercao.
CREATE TABLE "HistoricoPlano" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "de" "PlanoNegocio" NOT NULL,
    "para" "PlanoNegocio" NOT NULL,
    "usuarioId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPlano_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HistoricoPlano_troca_real" CHECK ("de" <> "para")
);

CREATE INDEX "HistoricoPlano_negocioId_createdAt_idx" ON "HistoricoPlano"("negocioId", "createdAt");

ALTER TABLE "HistoricoPlano" ADD CONSTRAINT "HistoricoPlano_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoricoPlano" ADD CONSTRAINT "HistoricoPlano_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "HistoricoPlano"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();

-- RLS ligado sem policy, como todas as tabelas do schema public (SPEC-001, OPEN-13): a API
-- REST do Supabase nao le nem grava; o Prisma (dono das tabelas) segue funcionando.
ALTER TABLE "HistoricoPlano" ENABLE ROW LEVEL SECURITY;
