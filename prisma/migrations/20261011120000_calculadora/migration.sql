-- SPEC-010 — Calculadora de precificação: memória do cálculo no histórico de preços (RNF05,
-- OPEN-004, OPEN-008) e parâmetros de precificação do negócio com faixas válidas (5.5).

-- AlterTable
ALTER TABLE "HistoricoPreco" ADD COLUMN     "memoriaCalculo" JSONB,
ADD COLUMN     "precoSugerido" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "unidadeCapacidade" VARCHAR(30);

-- Parâmetros de precificação (5.5): valores fora das faixas são recusados também pelo banco.
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_parametros_precificacao" CHECK (
  "taxaCartaoMedia" BETWEEN 0 AND 30
  AND ("cmvEstimado" IS NULL OR "cmvEstimado" BETWEEN 0 AND 95)
  AND ("margemLucroMeta" IS NULL OR "margemLucroMeta" BETWEEN 0 AND 95)
  AND ("capacidadeMensal" IS NULL OR "capacidadeMensal" > 0)
  AND ("ticketMedioEstimado" IS NULL OR "ticketMedioEstimado" > 0)
  AND ("faturamentoMensalEstimado" IS NULL OR "faturamentoMensalEstimado" > 0)
);
