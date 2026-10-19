-- SPEC-020 — Subcategorias do negócio e nova categoria Acessórios.

-- AlterEnum (OPEN-001): Acessórios entra logo depois de Vestuário, na ordem da lista fixa.
-- O valor novo não é usado nesta migração (o PostgreSQL não deixa usá-lo na mesma transação);
-- a margem padrão chega pela carga dos parâmetros fiscais, que roda depois das migrações.
ALTER TYPE "CategoriaItem" ADD VALUE 'ACESSORIOS' AFTER 'VESTUARIO';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "subcategoriaId" UUID;

-- CreateTable
CREATE TABLE "Subcategoria" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "categoria" "CategoriaItem" NOT NULL,
    "nome" VARCHAR(40) NOT NULL,
    "nomeChave" VARCHAR(40) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subcategoria_negocioId_idx" ON "Subcategoria"("negocioId");

-- CreateIndex (INV-003): nome único por negócio e categoria, inclusive em criações simultâneas.
CREATE UNIQUE INDEX "Subcategoria_negocioId_categoria_nomeChave_key" ON "Subcategoria"("negocioId", "categoria", "nomeChave");

-- CreateIndex
CREATE INDEX "Item_subcategoriaId_idx" ON "Item"("subcategoriaId");

-- AddForeignKey (OPEN-004): excluir a subcategoria deixa os itens sem ela, na mesma operação.
ALTER TABLE "Item" ADD CONSTRAINT "Item_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategoria" ADD CONSTRAINT "Subcategoria_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 5.5: nome com texto (o tamanho já é limitado pela coluna) e chave preenchida.
ALTER TABLE "Subcategoria" ADD CONSTRAINT "Subcategoria_nome" CHECK (length(btrim("nome")) > 0 AND length(btrim("nomeChave")) > 0);

-- 5.5: a categoria da subcategoria não muda depois de criada.
CREATE OR REPLACE FUNCTION he_subcategoria_categoria_fixa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."categoria" IS DISTINCT FROM OLD."categoria" THEN
    RAISE EXCEPTION 'he_subcategoria_categoria_fixa: a categoria de uma subcategoria não pode ser alterada' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER he_subcategoria_categoria_fixa BEFORE UPDATE OF "categoria" ON "Subcategoria"
  FOR EACH ROW EXECUTE FUNCTION he_subcategoria_categoria_fixa();

-- INV-002: a subcategoria do item é da mesma categoria do item (o mesmo negócio é conferido
-- pelo gatilho de isolamento abaixo). Trocar a categoria sem limpar a subcategoria é recusado.
CREATE OR REPLACE FUNCTION he_item_subcategoria_da_categoria() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  categoria_da_subcategoria "CategoriaItem";
BEGIN
  IF NEW."subcategoriaId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "categoria" INTO categoria_da_subcategoria FROM "Subcategoria" WHERE id = NEW."subcategoriaId";
  -- Subcategoria inexistente: a chave estrangeira recusa a operação com o erro próprio.
  IF categoria_da_subcategoria IS NOT NULL AND categoria_da_subcategoria IS DISTINCT FROM NEW."categoria" THEN
    RAISE EXCEPTION 'he_subcategoria_divergente: a subcategoria do item é de outra categoria' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER he_subcategoria_da_categoria BEFORE INSERT OR UPDATE OF "categoria", "subcategoriaId" ON "Item"
  FOR EACH ROW EXECUTE FUNCTION he_item_subcategoria_da_categoria();

-- Isolamento (SPEC-001): o negocioId não muda e o item só aponta para uma subcategoria do mesmo negócio.
CREATE TRIGGER he_negocio_imutavel BEFORE UPDATE OF "negocioId" ON "Subcategoria"
  FOR EACH ROW EXECUTE FUNCTION he_negocio_imutavel();
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "Item"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Subcategoria', 'subcategoriaId');

-- RLS ligado sem policy, como todas as tabelas do schema public (SPEC-001, OPEN-13).
ALTER TABLE "Subcategoria" ENABLE ROW LEVEL SECURITY;
