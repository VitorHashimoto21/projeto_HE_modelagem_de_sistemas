-- SPEC-007 — Estoque: ordem de registro com microssegundos e observação nas movimentações
-- (OPEN-005, OPEN-007), regras de integridade no banco e auditoria imutável (RNF05).

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "observacao" VARCHAR(200),
ADD COLUMN     "registradoEm" TIMESTAMP(6) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_itemId_data_idx" ON "MovimentacaoEstoque"("itemId", "data");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_itemId_registradoEm_idx" ON "MovimentacaoEstoque"("itemId", "registradoEm");

-- O saldo nunca fica negativo (INV-002, OPEN-006) — além da saída condicional da aplicação.
ALTER TABLE "Item" ADD CONSTRAINT "Item_quantidadeEstoque_nao_negativa" CHECK ("quantidadeEstoque" >= 0);

-- Toda movimentação tem quantidade positiva; o sinal vem do tipo (INV-003).
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_quantidade_positiva" CHECK ("quantidade" > 0);

-- Só a saída manual tem motivo, e ela sempre tem (INV-006, RF17).
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_motivo_so_na_saida_manual"
  CHECK (("tipo" = 'SAIDA_MANUAL') = ("motivo" IS NOT NULL));

-- Movimentações são o registro de auditoria: nunca alteradas nem apagadas (INV-004),
-- com a mesma função do histórico de preços (SPEC-006, OPEN-007).
CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "MovimentacaoEstoque"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();
