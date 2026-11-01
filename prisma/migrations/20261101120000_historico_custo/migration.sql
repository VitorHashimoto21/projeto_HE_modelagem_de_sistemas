-- SPEC-025 — Inventário do estoque numa data: histórico de custo dos itens (RN41, RNF05).

-- CreateTable
CREATE TABLE "HistoricoCusto" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "custo" DECIMAL(10,2) NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" UUID,

    CONSTRAINT "HistoricoCusto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoCusto_negocioId_idx" ON "HistoricoCusto"("negocioId");

-- CreateIndex
CREATE INDEX "HistoricoCusto_itemId_vigenteDesde_idx" ON "HistoricoCusto"("itemId", "vigenteDesde");

-- AddForeignKey
ALTER TABLE "HistoricoCusto" ADD CONSTRAINT "HistoricoCusto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoCusto" ADD CONSTRAINT "HistoricoCusto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoCusto" ADD CONSTRAINT "HistoricoCusto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- O custo nunca é negativo, como o custo do item.
ALTER TABLE "HistoricoCusto" ADD CONSTRAINT "HistoricoCusto_custo" CHECK ("custo" >= 0);

-- INV-004 (RNF05): o histórico só recebe inserções; alterar ou apagar é recusado pelo banco.
CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "HistoricoCusto"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();

-- Isolamento (SPEC-001): o registro só aponta para um item do mesmo negócio.
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT ON "HistoricoCusto"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Item', 'itemId');

-- RLS ligado sem policy, como todas as tabelas do schema public (SPEC-001, OPEN-13).
ALTER TABLE "HistoricoCusto" ENABLE ROW LEVEL SECURITY;

-- Início do histórico (5.1): cada item que já existe recebe o custo atual, sem autor. Para datas
-- anteriores a este registro, o inventário usa este custo e avisa (OPEN-001).
INSERT INTO "HistoricoCusto" ("id", "negocioId", "itemId", "custo", "vigenteDesde", "usuarioId")
SELECT gen_random_uuid(), "negocioId", "id", "custoBase", (now() AT TIME ZONE 'UTC'), NULL
FROM "Item";
