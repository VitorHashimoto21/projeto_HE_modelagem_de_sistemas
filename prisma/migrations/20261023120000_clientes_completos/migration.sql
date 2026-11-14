-- SPEC-022 — Cliente com dados completos.

-- CreateEnum (OPEN-003): pessoa física ou empresa; situação na inscrição estadual (indIEDest da NF-e).
CREATE TYPE "TipoCliente" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');
CREATE TYPE "SituacaoIe" AS ENUM ('CONTRIBUINTE', 'ISENTO', 'NAO_CONTRIBUINTE');

-- AlterTable (RF81): todos opcionais além do nome. Os clientes existentes viram pessoa física (5.9).
ALTER TABLE "Cliente"
ADD COLUMN     "tipo" "TipoCliente" NOT NULL DEFAULT 'PESSOA_FISICA',
ADD COLUMN     "nomeFantasia" TEXT,
ADD COLUMN     "documento" VARCHAR(14),
ADD COLUMN     "situacaoIe" "SituacaoIe",
ADD COLUMN     "inscricaoEstadual" VARCHAR(14),
ADD COLUMN     "inscricaoMunicipal" VARCHAR(20),
ADD COLUMN     "nomeContato" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "cep" VARCHAR(8),
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "uf" VARCHAR(2),
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migração do contato livre (5.9, INV-008), sem perda: com "@" vai para o e-mail; com 10 ou 11
-- dígitos, para o telefone (só os dígitos); qualquer outro texto, para o telefone como estava.
-- Os anonimizados continuam com tudo vazio (5.9, item 3; Cliente_anonimizado_sem_dados, abaixo).
UPDATE "Cliente" SET "email" = btrim("contato")
 WHERE "anonimizadoEm" IS NULL AND "contato" LIKE '%@%';
UPDATE "Cliente" SET "telefone" = regexp_replace("contato", '\D', '', 'g')
 WHERE "anonimizadoEm" IS NULL AND "email" IS NULL AND length(regexp_replace(coalesce("contato", ''), '\D', '', 'g')) IN (10, 11);
UPDATE "Cliente" SET "telefone" = btrim("contato")
 WHERE "anonimizadoEm" IS NULL AND "email" IS NULL AND "telefone" IS NULL AND btrim(coalesce("contato", '')) <> '';
ALTER TABLE "Cliente" DROP COLUMN "contato";

-- CreateIndex (5.2, item 9; INV-002): documento único no negócio. Ao anonimizar, o documento fica
-- vazio, e o Postgres aceita vários nulos: a unicidade vale só entre os clientes ativos.
CREATE UNIQUE INDEX "Cliente_negocioId_documento_key" ON "Cliente"("negocioId", "documento");

-- INV-001: CPF de 11 dígitos só em pessoa física; CNPJ de 14 posições (12 letras ou dígitos e
-- 2 dígitos verificadores, IN RFB nº 2.229/2024) só em empresa.
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_documento_formato" CHECK (
  "documento" IS NULL
  OR ("tipo" = 'PESSOA_FISICA' AND "documento" ~ '^[0-9]{11}$')
  OR ("tipo" = 'PESSOA_JURIDICA' AND "documento" ~ '^[0-9A-Z]{12}[0-9]{2}$')
);

-- 5.2, item 3: nome fantasia, inscrições e nome de quem compra só em empresa.
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_campos_de_empresa" CHECK (
  "tipo" = 'PESSOA_JURIDICA'
  OR ("nomeFantasia" IS NULL AND "situacaoIe" IS NULL AND "inscricaoEstadual" IS NULL
      AND "inscricaoMunicipal" IS NULL AND "nomeContato" IS NULL)
);

-- 5.8: "Contribuinte do ICMS" exige o número da inscrição; "Isenta" e "Não contribuinte" não têm número.
-- O IS NOT NULL é necessário: sem ele, NULL ~ '...' dá NULL e o CHECK aceitaria o contribuinte sem número.
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_inscricao_estadual" CHECK (
  ("situacaoIe" = 'CONTRIBUINTE' AND "inscricaoEstadual" IS NOT NULL AND "inscricaoEstadual" ~ '^[0-9A-Z]{1,14}$')
  OR ("situacaoIe" IS DISTINCT FROM 'CONTRIBUINTE' AND "inscricaoEstadual" IS NULL)
);

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_inscricao_municipal" CHECK (
  "inscricaoMunicipal" IS NULL OR "inscricaoMunicipal" ~ '^[0-9A-Z]{1,20}$'
);

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_cep_formato" CHECK ("cep" IS NULL OR "cep" ~ '^[0-9]{8}$');

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_uf" CHECK (
  "uf" IS NULL OR "uf" IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
                           'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
);

-- INV-005 e INV-006: cliente anonimizado não guarda nenhum dado pessoal além do nome genérico.
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_anonimizado_sem_dados" CHECK (
  "anonimizadoEm" IS NULL
  OR ("documento" IS NULL AND "nomeFantasia" IS NULL AND "situacaoIe" IS NULL AND "inscricaoEstadual" IS NULL
      AND "inscricaoMunicipal" IS NULL AND "nomeContato" IS NULL AND "email" IS NULL AND "telefone" IS NULL
      AND "cep" IS NULL AND "logradouro" IS NULL AND "numero" IS NULL AND "complemento" IS NULL
      AND "bairro" IS NULL AND "municipio" IS NULL AND "uf" IS NULL)
);
