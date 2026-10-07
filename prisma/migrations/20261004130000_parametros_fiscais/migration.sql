-- SPEC-003 — Parâmetros fiscais com vigência por data e histórico nas cinco tabelas
-- (OPEN-001, OPEN-002, OPEN-003). Gerada pelo prisma migrate diff.
-- As tabelas fiscais ainda estão vazias em todos os ambientes (a carga chega nesta Spec),
-- por isso as novas colunas NOT NULL e as trocas de chave não precisam migrar dados.
-- DropIndex
DROP INDEX "FaixaTributaria_anexo_ativo_idx";

-- DropIndex
DROP INDEX "ParametroMei_atividade_ativo_idx";

-- AlterTable
ALTER TABLE "CnaeAnexo" DROP CONSTRAINT "CnaeAnexo_pkey",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "vigenteDesde" DROP DEFAULT,
ALTER COLUMN "vigenteDesde" SET DATA TYPE DATE,
ADD CONSTRAINT "CnaeAnexo_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FaixaTributaria" DROP COLUMN "ativo",
ALTER COLUMN "rbt12Ate" SET NOT NULL,
ALTER COLUMN "vigenteDesde" DROP DEFAULT,
ALTER COLUMN "vigenteDesde" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "MargemPadraoCategoria" DROP CONSTRAINT "MargemPadraoCategoria_pkey",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "vigenteDesde" DROP DEFAULT,
ALTER COLUMN "vigenteDesde" SET DATA TYPE DATE,
ADD CONSTRAINT "MargemPadraoCategoria_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ParametroFatorR" DROP COLUMN "ativo",
ALTER COLUMN "vigenteDesde" DROP DEFAULT,
ALTER COLUMN "vigenteDesde" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "ParametroMei" DROP COLUMN "ativo",
ALTER COLUMN "vigenteDesde" DROP DEFAULT,
ALTER COLUMN "vigenteDesde" SET DATA TYPE DATE;

-- CreateIndex
CREATE UNIQUE INDEX "CnaeAnexo_cnae_vigenteDesde_key" ON "CnaeAnexo"("cnae", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "FaixaTributaria_anexo_faixaOrdem_vigenteDesde_key" ON "FaixaTributaria"("anexo", "faixaOrdem", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "MargemPadraoCategoria_categoria_vigenteDesde_key" ON "MargemPadraoCategoria"("categoria", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroFatorR_vigenteDesde_key" ON "ParametroFatorR"("vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroMei_atividade_vigenteDesde_key" ON "ParametroMei"("atividade", "vigenteDesde");
