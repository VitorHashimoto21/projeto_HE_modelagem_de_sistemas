-- SPEC-021 — NCM nos produtos.

-- AlterTable (RF80): NCM opcional do item; não é chave estrangeira, porque o código fica no item
-- mesmo depois de sair da tabela vigente (OPEN-002). Itens existentes ficam sem NCM (INV-008).
ALTER TABLE "Item" ADD COLUMN     "ncm" VARCHAR(8);

-- AlterTable (OPEN-005, RN35): "Emito nota fiscal de produtos", desligada em todos os negócios.
ALTER TABLE "Negocio" ADD COLUMN     "emiteNotaDeProduto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable (OPEN-001): tabela NCM oficial, global, carregada do arquivo do Classif (ADR-004).
CREATE TABLE "Ncm" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(8) NOT NULL,
    "descricao" TEXT NOT NULL,
    "caminho" TEXT[],
    "textoBusca" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteAte" DATE,
    "ato" TEXT NOT NULL,

    CONSTRAINT "Ncm_pkey" PRIMARY KEY ("id")
);

-- CreateTable: versão da tabela carregada (uma linha), para o rodapé da busca.
CREATE TABLE "TabelaNcm" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "atualizadaEm" DATE NOT NULL,
    "ato" TEXT NOT NULL,
    "carregadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TabelaNcm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ncm_codigo_idx" ON "Ncm"("codigo");

-- CreateIndex (INV-006): a carga identifica cada código pela vigência; rodar de novo não duplica.
CREATE UNIQUE INDEX "Ncm_codigo_vigenteDesde_key" ON "Ncm"("codigo", "vigenteDesde");


-- INV-001: o NCM do item tem 8 dígitos e só existe em produto físico.
ALTER TABLE "Item" ADD CONSTRAINT "Item_ncm_formato" CHECK ("ncm" IS NULL OR "ncm" ~ '^[0-9]{8}$');
ALTER TABLE "Item" ADD CONSTRAINT "Item_ncm_so_produto" CHECK ("ncm" IS NULL OR "tipo" = 'PRODUTO_FISICO');

-- A tabela NCM só aceita códigos de 8 dígitos e vigência coerente.
ALTER TABLE "Ncm" ADD CONSTRAINT "Ncm_codigo_formato" CHECK ("codigo" ~ '^[0-9]{8}$');
ALTER TABLE "Ncm" ADD CONSTRAINT "Ncm_vigencia" CHECK ("vigenteAte" IS NULL OR "vigenteAte" >= "vigenteDesde");

-- RLS ligado sem policy, como todas as tabelas do schema public (SPEC-001, OPEN-13): só o servidor lê.
ALTER TABLE "Ncm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TabelaNcm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TabelaNcm" ADD CONSTRAINT "TabelaNcm_uma_linha" CHECK ("id" = 1);
