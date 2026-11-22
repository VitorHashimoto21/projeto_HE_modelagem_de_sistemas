-- SPEC-027 (etapa 1): compras de fornecedores. Tabelas Compra e ItemCompra, ligação da compra com as
-- entradas do estoque, o histórico de custo e as contas a pagar, e o contador do número da compra.
-- Nada do que existe vira compra (seção 7).

CREATE TYPE "CondicaoCompra" AS ENUM ('A_VISTA', 'A_PRAZO');

CREATE TYPE "SituacaoCompra" AS ENUM ('REGISTRADA', 'CANCELADA');

CREATE TYPE "EscolhaCustoCompra" AS ENUM ('MEDIO', 'COMPRA', 'ATUAL');

ALTER TABLE "ContaPagarReceber" ADD COLUMN     "compraId" UUID;

ALTER TABLE "HistoricoCusto" ADD COLUMN     "compraId" UUID;

ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "compraId" UUID;

ALTER TABLE "Negocio" ADD COLUMN     "proximoNumeroCompra" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "Compra" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "numeroDocumento" VARCHAR(40),
    "documentoChave" TEXT,
    "semNotaFiscal" BOOLEAN NOT NULL DEFAULT false,
    "data" DATE NOT NULL,
    "observacao" VARCHAR(200),
    "valorProdutos" DECIMAL(10,2) NOT NULL,
    "frete" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outrasDespesas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "condicao" "CondicaoCompra" NOT NULL,
    "valorEntrada" DECIMAL(10,2),
    "situacao" "SituacaoCompra" NOT NULL DEFAULT 'REGISTRADA',
    "registradaPorId" UUID NOT NULL,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaPorId" UUID,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" VARCHAR(200),

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemCompra" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "compraId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "custoUnitario" DECIMAL(10,2) NOT NULL,
    "totalLinha" DECIMAL(10,2) NOT NULL,
    "custoComRateio" DECIMAL(10,2) NOT NULL,
    "escolhaCusto" "EscolhaCustoCompra" NOT NULL,
    "custoAnterior" DECIMAL(10,2) NOT NULL,
    "custoNovo" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ItemCompra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Compra_negocioId_data_idx" ON "Compra"("negocioId", "data");

CREATE INDEX "Compra_fornecedorId_idx" ON "Compra"("fornecedorId");

CREATE UNIQUE INDEX "Compra_negocioId_numero_key" ON "Compra"("negocioId", "numero");

CREATE UNIQUE INDEX "Compra_negocioId_fornecedorId_documentoChave_key" ON "Compra"("negocioId", "fornecedorId", "documentoChave");

CREATE INDEX "ItemCompra_negocioId_idx" ON "ItemCompra"("negocioId");

CREATE INDEX "ItemCompra_itemId_idx" ON "ItemCompra"("itemId");

CREATE UNIQUE INDEX "ItemCompra_compraId_itemId_key" ON "ItemCompra"("compraId", "itemId");

CREATE INDEX "ContaPagarReceber_compraId_idx" ON "ContaPagarReceber"("compraId");

CREATE INDEX "HistoricoCusto_compraId_idx" ON "HistoricoCusto"("compraId");

CREATE INDEX "MovimentacaoEstoque_compraId_idx" ON "MovimentacaoEstoque"("compraId");

ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HistoricoCusto" ADD CONSTRAINT "HistoricoCusto_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Compra" ADD CONSTRAINT "Compra_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Compra" ADD CONSTRAINT "Compra_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Compra" ADD CONSTRAINT "Compra_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------- Regras da compra (SPEC-027, seções 5 e 6) ----------
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_numero" CHECK ("numero" > 0);
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_valores_nao_negativos"
  CHECK ("valorProdutos" >= 0 AND "frete" >= 0 AND "outrasDespesas" >= 0 AND "desconto" >= 0);
-- OPEN-005: o desconto não passa do valor dos produtos; total = produtos + frete + outras − desconto, maior que zero (INV-002).
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_desconto" CHECK ("desconto" <= "valorProdutos");
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_total"
  CHECK ("total" = "valorProdutos" + "frete" + "outrasDespesas" - "desconto" AND "total" > 0);
-- OPEN-002: o nº do documento é obrigatório, salvo na compra sem nota fiscal, que não tem nº.
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_documento" CHECK (
  ("semNotaFiscal" AND "numeroDocumento" IS NULL)
  OR (NOT "semNotaFiscal" AND "numeroDocumento" IS NOT NULL AND btrim("numeroDocumento") <> '')
);
-- INV-011: a chave existe só na compra registrada com nº; a cancelada libera o nº.
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_documento_chave"
  CHECK (("situacao" = 'REGISTRADA' AND "numeroDocumento" IS NOT NULL) = ("documentoChave" IS NOT NULL));
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_observacao" CHECK ("observacao" IS NULL OR btrim("observacao") <> '');
-- OPEN-004: a entrada só existe a prazo, maior que zero e menor que o total.
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_entrada"
  CHECK ("valorEntrada" IS NULL OR ("condicao" = 'A_PRAZO' AND "valorEntrada" > 0 AND "valorEntrada" < "total"));
-- OPEN-006: a cancelada tem quem, quando e o motivo; a registrada não tem nenhum dos três.
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_cancelamento" CHECK (
  ("situacao" = 'REGISTRADA' AND num_nonnulls("canceladaPorId", "canceladaEm", "motivoCancelamento") = 0)
  OR ("situacao" = 'CANCELADA' AND num_nonnulls("canceladaPorId", "canceladaEm", "motivoCancelamento") = 3
      AND btrim("motivoCancelamento") <> '')
);

ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_quantidade" CHECK ("quantidade" > 0);
ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_custos_nao_negativos" CHECK (
  "custoUnitario" >= 0 AND "totalLinha" >= 0 AND "custoComRateio" >= 0 AND "custoAnterior" >= 0 AND "custoNovo" >= 0
);
-- OPEN-001: "Manter o atual" não muda o custo.
ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_manter_o_atual"
  CHECK ("escolhaCusto" <> 'ATUAL' OR "custoNovo" = "custoAnterior");

-- As ligações com a compra: só a entrada no estoque (o estorno do cancelamento vem na etapa 3) e só conta a pagar.
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_compra"
  CHECK ("compraId" IS NULL OR ("tipo" = 'ENTRADA' AND "vendaId" IS NULL));
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_compra_a_pagar"
  CHECK ("compraId" IS NULL OR ("tipo" = 'PAGAR' AND "parcelaId" IS NULL AND "despesaFixaId" IS NULL));

-- ---------- INV-004: só produto físico ativo na compra ----------
CREATE OR REPLACE FUNCTION he_produto_da_compra() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Item" WHERE "id" = NEW."itemId" AND "tipo" = 'PRODUTO_FISICO' AND "arquivadoEm" IS NULL
  ) THEN
    RAISE EXCEPTION 'he_produto_da_compra: a compra só aceita produto físico ativo'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER he_produto_da_compra BEFORE INSERT ON "ItemCompra"
  FOR EACH ROW EXECUTE FUNCTION he_produto_da_compra();

-- RNF05: os produtos da compra nunca mudam; a compra nunca é apagada (INV-008).
CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "ItemCompra"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();
CREATE TRIGGER he_sem_exclusao BEFORE DELETE ON "Compra"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();

-- ---------- Isolamento (SPEC-001, INV-004, INV-010) ----------
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "Compra"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Fornecedor', 'fornecedorId');
CREATE TRIGGER he_negocio_imutavel BEFORE UPDATE OF "negocioId" ON "Compra"
  FOR EACH ROW EXECUTE FUNCTION he_negocio_imutavel();
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT ON "ItemCompra"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Compra', 'compraId', 'Item', 'itemId');
DROP TRIGGER he_mesmo_negocio ON "MovimentacaoEstoque";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "MovimentacaoEstoque"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Item', 'itemId', 'Venda', 'vendaId', 'Compra', 'compraId');
DROP TRIGGER he_mesmo_negocio ON "HistoricoCusto";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT ON "HistoricoCusto"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Item', 'itemId', 'Compra', 'compraId');
DROP TRIGGER he_mesmo_negocio ON "ContaPagarReceber";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "ContaPagarReceber"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Parcela', 'parcelaId', 'DespesaFixa', 'despesaFixaId', 'Fornecedor', 'fornecedorId', 'Cliente', 'clienteId', 'Compra', 'compraId');

-- ---------- Negócio suspenso (SPEC-019, RN39): somente leitura ----------
-- O mesmo laço da migração 20261107120000, com as tabelas novas (a lista completa é a referência do teste).
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'Cliente', 'Fornecedor', 'Item', 'Subcategoria', 'MaterialServico', 'MovimentacaoEstoque', 'HistoricoPreco',
    'HistoricoCusto', 'DespesaFixa', 'Venda', 'ItemVenda', 'Pagamento', 'Parcela', 'LancamentoFinanceiro', 'ContaPagarReceber',
    'Compra', 'ItemCompra'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS he_negocio_suspenso ON %I', tabela);
    EXECUTE format('CREATE TRIGGER he_negocio_suspenso BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION he_recusar_no_negocio_suspenso()', tabela);
  END LOOP;
END;
$$;

-- RLS ligado sem policy, como nas demais tabelas: só o servidor (papel do Prisma) acessa.
ALTER TABLE "Compra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemCompra" ENABLE ROW LEVEL SECURITY;
