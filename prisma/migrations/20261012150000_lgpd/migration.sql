-- SPEC-014 — LGPD: exportação e exclusão de conta.

-- OPEN-001: credencial removida no Supabase Auth (nula com excluidoEm = pendência da rotina diária).
ALTER TABLE "Usuario" ADD COLUMN "credencialRemovidaEm" TIMESTAMP(3);

-- OPEN-005: data prevista de eliminação dos registros do negócio encerrado (encerramento + 5 anos).
ALTER TABLE "Negocio" ADD COLUMN "eliminarApos" DATE;

-- RN27: anonimizada só depois de excluída; credencial removida só de conta excluída;
-- negócio com data de eliminação só se encerrado.
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_anonimizado_so_excluido" CHECK ("anonimizadoEm" IS NULL OR "excluidoEm" IS NOT NULL);
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_credencial_so_excluido" CHECK ("credencialRemovidaEm" IS NULL OR "excluidoEm" IS NOT NULL);
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_eliminacao_so_encerrado" CHECK ("eliminarApos" IS NULL OR "encerradoEm" IS NOT NULL);
