-- SPEC-024 — Código interno dos itens (RF87, RN40).

-- AlterTable: opcional; os itens existentes ficam sem código (seção 7).
ALTER TABLE "Item"
ADD COLUMN     "codigo" VARCHAR(20),
ADD COLUMN     "codigoChave" VARCHAR(20);

-- Único entre os itens ativos do negócio (INV-001): a chave é nula quando o item está arquivado.
CREATE UNIQUE INDEX "Item_negocioId_codigoChave_key" ON "Item"("negocioId", "codigoChave");

-- Formato (INV-002): de 1 a 20 caracteres, maiúsculas sem acento, números, hífen, ponto, barra e sublinhado.
ALTER TABLE "Item" ADD CONSTRAINT "Item_codigo_formato" CHECK ("codigo" IS NULL OR "codigo" ~ '^[A-Z0-9._/-]{1,20}$');
-- A chave é o próprio código enquanto o item está ativo, e nula quando arquivado (INV-006).
ALTER TABLE "Item" ADD CONSTRAINT "Item_codigo_chave" CHECK (
  ("arquivadoEm" IS NULL AND "codigoChave" IS NOT DISTINCT FROM "codigo")
  OR ("arquivadoEm" IS NOT NULL AND "codigoChave" IS NULL)
);
