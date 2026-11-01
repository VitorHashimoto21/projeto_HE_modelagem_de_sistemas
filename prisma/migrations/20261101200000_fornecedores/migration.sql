-- SPEC-026 — Fornecedores, vínculo nas contas e filtros (RF89, RF90, RN42; RF30, RF31, RF67, RN22 alterados).

-- CreateEnum
CREATE TYPE "FormaPagamentoConta" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRA');

-- AlterTable
ALTER TABLE "ContaPagarReceber" ADD COLUMN     "clienteId" UUID,
ADD COLUMN     "fornecedorId" UUID,
ADD COLUMN     "numeroDocumento" VARCHAR(40);

-- AlterTable
ALTER TABLE "DespesaFixa" ADD COLUMN     "fornecedorId" UUID;

-- AlterTable
ALTER TABLE "LancamentoFinanceiro" ADD COLUMN     "formaPagamento" "FormaPagamentoConta";

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'PESSOA_JURIDICA',
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "documento" VARCHAR(14),
    "situacaoIe" "SituacaoIe",
    "inscricaoEstadual" VARCHAR(14),
    "inscricaoMunicipal" VARCHAR(20),
    "nomeContato" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cep" VARCHAR(8),
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "uf" VARCHAR(2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonimizadoEm" TIMESTAMP(3),

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fornecedor_negocioId_idx" ON "Fornecedor"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_negocioId_documento_key" ON "Fornecedor"("negocioId", "documento");

-- CreateIndex
CREATE INDEX "ContaPagarReceber_fornecedorId_idx" ON "ContaPagarReceber"("fornecedorId");

-- CreateIndex
CREATE INDEX "ContaPagarReceber_clienteId_idx" ON "ContaPagarReceber"("clienteId");

-- CreateIndex
CREATE INDEX "DespesaFixa_fornecedorId_idx" ON "DespesaFixa"("fornecedorId");

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaFixa" ADD CONSTRAINT "DespesaFixa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------- Fornecedor: as mesmas regras do cliente (SPEC-022, migração 20261023120000) ----------

-- CPF de 11 dígitos só em pessoa física; CNPJ de 14 posições (com letras) só em empresa.
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_documento_formato" CHECK (
  "documento" IS NULL
  OR ("tipo" = 'PESSOA_FISICA' AND "documento" ~ '^[0-9]{11}$')
  OR ("tipo" = 'PESSOA_JURIDICA' AND "documento" ~ '^[0-9A-Z]{12}[0-9]{2}$')
);

-- Nome fantasia, inscrições e nome do contato só em empresa.
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_campos_de_empresa" CHECK (
  "tipo" = 'PESSOA_JURIDICA'
  OR ("nomeFantasia" IS NULL AND "situacaoIe" IS NULL AND "inscricaoEstadual" IS NULL
      AND "inscricaoMunicipal" IS NULL AND "nomeContato" IS NULL)
);

-- "Contribuinte do ICMS" exige o número da inscrição; "Isenta" e "Não contribuinte" não têm número.
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_inscricao_estadual" CHECK (
  ("situacaoIe" = 'CONTRIBUINTE' AND "inscricaoEstadual" IS NOT NULL AND "inscricaoEstadual" ~ '^[0-9A-Z]{1,14}$')
  OR ("situacaoIe" IS DISTINCT FROM 'CONTRIBUINTE' AND "inscricaoEstadual" IS NULL)
);

ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_inscricao_municipal" CHECK (
  "inscricaoMunicipal" IS NULL OR "inscricaoMunicipal" ~ '^[0-9A-Z]{1,20}$'
);

ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_cep_formato" CHECK ("cep" IS NULL OR "cep" ~ '^[0-9]{8}$');

ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_uf" CHECK (
  "uf" IS NULL OR "uf" IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
                           'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
);

-- INV-006: fornecedor anonimizado não guarda nenhum dado pessoal além do nome genérico.
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_anonimizado_sem_dados" CHECK (
  "anonimizadoEm" IS NULL
  OR ("documento" IS NULL AND "nomeFantasia" IS NULL AND "situacaoIe" IS NULL AND "inscricaoEstadual" IS NULL
      AND "inscricaoMunicipal" IS NULL AND "nomeContato" IS NULL AND "email" IS NULL AND "telefone" IS NULL
      AND "cep" IS NULL AND "logradouro" IS NULL AND "numero" IS NULL AND "complemento" IS NULL
      AND "bairro" IS NULL AND "municipio" IS NULL AND "uf" IS NULL)
);

-- RLS ligado sem policy, como todas as tabelas do schema public (SPEC-001, OPEN-13).
ALTER TABLE "Fornecedor" ENABLE ROW LEVEL SECURITY;

-- ---------- Vínculos das contas e das despesas fixas (INV-001) ----------

-- O fornecedor só entra na conta a pagar; o cliente, só na conta a receber manual (a de venda
-- no cartão usa o cliente da venda).
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_fornecedor_a_pagar"
  CHECK ("fornecedorId" IS NULL OR "tipo" = 'PAGAR');
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_cliente_a_receber_manual"
  CHECK ("clienteId" IS NULL OR ("tipo" = 'RECEBER' AND "parcelaId" IS NULL));
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_numero_documento"
  CHECK ("numeroDocumento" IS NULL OR btrim("numeroDocumento") <> '');

-- O DAS do MEI não tem fornecedor.
ALTER TABLE "DespesaFixa" ADD CONSTRAINT "DespesaFixa_fornecedor_so_manual"
  CHECK ("fornecedorId" IS NULL OR "origem" = 'MANUAL');

-- A forma só existe no pagamento ou recebimento de conta (RN22).
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_forma_so_de_conta"
  CHECK ("formaPagamento" IS NULL OR "origem" = 'CONTA');

-- Isolamento (SPEC-001): o fornecedor e o cliente da conta, e o fornecedor da despesa fixa, são do
-- mesmo negócio.
DROP TRIGGER he_mesmo_negocio ON "ContaPagarReceber";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "ContaPagarReceber"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Parcela', 'parcelaId', 'DespesaFixa', 'despesaFixaId', 'Fornecedor', 'fornecedorId', 'Cliente', 'clienteId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "DespesaFixa"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Fornecedor', 'fornecedorId');

-- Os pagamentos anteriores ficam sem forma ("Não informada"): nenhuma linha é alterada.
