-- SPEC-006 — Catálogo: arquivamento (OPEN-001), nome único entre os itens ativos do
-- negócio (OPEN-003) e histórico de preços imutável (OPEN-007).

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "arquivadoEm" TIMESTAMP(3),
ADD COLUMN     "nomeChave" TEXT;

-- Itens já existentes: nome normalizado igual ao da aplicação (minúsculas, espaços únicos).
UPDATE "Item" SET "nomeChave" = lower(regexp_replace(btrim("nome"), '\s+', ' ', 'g')) WHERE "arquivadoEm" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Item_negocioId_nomeChave_key" ON "Item"("negocioId", "nomeChave");

-- Registros de auditoria só recebem inserções (RNF05): alterar ou apagar é recusado
-- pelo próprio banco. A mesma função servirá às movimentações de estoque (SPEC-007).
CREATE OR REPLACE FUNCTION he_somente_insercao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'he_somente_insercao: registros de % não podem ser alterados nem apagados', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "HistoricoPreco"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();
