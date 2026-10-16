-- SPEC-017: ajustes de preço e de materiais por linha da venda.
ALTER TABLE "ItemVenda" ADD COLUMN "precoOficial" DECIMAL(10,2);
ALTER TABLE "ItemVenda" ADD COLUMN "motivoAjustePreco" VARCHAR(120);
ALTER TABLE "ItemVenda" ADD COLUMN "materiaisAjustados" BOOLEAN NOT NULL DEFAULT false;

-- Preço ajustado sempre com o preço oficial do momento e o motivo (INV-002).
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_ajuste_de_preco_completo"
  CHECK (("precoOficial" IS NULL) = ("motivoAjustePreco" IS NULL));
