-- SPEC-008 — Venda: número sequencial por negócio (OPEN-007), quem registrou (OPEN-006),
-- índice de lançamentos por período e regras de integridade no banco.
-- Ainda não há vendas em nenhum ambiente: as colunas NOT NULL novas não precisam de dados.

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "proximoNumeroVenda" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "numero" INTEGER NOT NULL,
ADD COLUMN     "registradaPorId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_negocioId_data_idx" ON "LancamentoFinanceiro"("negocioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_negocioId_numero_key" ON "Venda"("negocioId", "numero");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridade (seção 7): valores sempre positivos e parcelas só no crédito, de 1 a 12.
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_valorTotal_positivo" CHECK ("valorTotal" > 0);
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_numero_positivo" CHECK ("numero" > 0);
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_quantidade_positiva" CHECK ("quantidade" > 0);
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_valores_nao_negativos" CHECK ("precoUnitario" >= 0 AND "custoUnitario" >= 0);
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_valor_positivo" CHECK ("valor" > 0);
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_parcelas_validas"
  CHECK ("parcelas" BETWEEN 1 AND 12 AND ("forma" = 'CREDITO' OR "parcelas" = 1));
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_valor_positivo" CHECK ("valor" > 0);
