-- SPEC-009 — Financeiro: origem, descrição e autor dos lançamentos; estorno ligado ao
-- original (OPEN-003); DAS do MEI sem valor próprio (OPEN-005); integridade e auditoria.

-- CreateEnum
CREATE TYPE "OrigemLancamento" AS ENUM ('VENDA', 'CONTA', 'AVULSO', 'SALDO_INICIAL', 'ESTORNO');

-- AlterTable
ALTER TABLE "ContaPagarReceber" ADD COLUMN     "criadaPorId" UUID;

-- AlterTable: valor nulo no DAS do MEI; "geraDesde" = primeira competência a gerar (OPEN-004),
-- preenchida nas despesas existentes com o mês do cadastro (fuso de São Paulo).
ALTER TABLE "DespesaFixa" ALTER COLUMN "valorMensal" DROP NOT NULL,
ADD COLUMN     "geraDesde" DATE;

UPDATE "DespesaFixa"
SET "geraDesde" = date_trunc('month', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date;

ALTER TABLE "DespesaFixa" ALTER COLUMN "geraDesde" SET NOT NULL;

-- AlterTable: a origem nasce nula, é preenchida nos lançamentos já existentes (vendas da
-- homologação) e só então passa a ser obrigatória.
ALTER TABLE "LancamentoFinanceiro" ADD COLUMN     "descricao" VARCHAR(120),
ADD COLUMN     "estornoDeId" UUID,
ADD COLUMN     "origem" "OrigemLancamento",
ADD COLUMN     "usuarioId" UUID;

UPDATE "LancamentoFinanceiro" l
SET "origem" = CASE WHEN l."vendaId" IS NOT NULL THEN 'VENDA'::"OrigemLancamento"
                    WHEN l."contaId" IS NOT NULL THEN 'CONTA'::"OrigemLancamento"
                    ELSE 'AVULSO'::"OrigemLancamento" END,
    "usuarioId" = (SELECT v."registradaPorId" FROM "Venda" v WHERE v.id = l."vendaId");

ALTER TABLE "LancamentoFinanceiro" ALTER COLUMN "origem" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ContaPagarReceber_negocioId_vencimento_status_idx" ON "ContaPagarReceber"("negocioId", "vencimento", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LancamentoFinanceiro_estornoDeId_key" ON "LancamentoFinanceiro"("estornoDeId");

-- AddForeignKey
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_estornoDeId_fkey" FOREIGN KEY ("estornoDeId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O estorno só aponta para um lançamento do mesmo negócio (INV-005 da SPEC-001).
DROP TRIGGER he_mesmo_negocio ON "LancamentoFinanceiro";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "LancamentoFinanceiro"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Venda', 'vendaId', 'ContaPagarReceber', 'contaId', 'LancamentoFinanceiro', 'estornoDeId');

-- Integridade (seção 7).
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_valor_positivo" CHECK ("valor" > 0);
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_valores_validos"
  CHECK ("valorTotal" > 0 AND "valorPago" >= 0 AND "valorPago" <= "valorTotal");
ALTER TABLE "DespesaFixa" ADD CONSTRAINT "DespesaFixa_dia_valido" CHECK ("diaVencimento" BETWEEN 1 AND 31);
-- O DAS do MEI não tem valor próprio; as demais despesas têm valor positivo (OPEN-005).
ALTER TABLE "DespesaFixa" ADD CONSTRAINT "DespesaFixa_valor_conforme_origem"
  CHECK (("origem" = 'DAS_MEI' AND "valorMensal" IS NULL) OR ("origem" = 'MANUAL' AND "valorMensal" > 0));

-- Lançamentos são o registro do caixa: nunca alterados nem apagados; correção por estorno
-- (OPEN-003), com a mesma função de auditoria do estoque e do histórico de preços.
CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "LancamentoFinanceiro"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();
