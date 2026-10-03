-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('DONO', 'GERENTE', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "RegimeTributario" AS ENUM ('MEI', 'SIMPLES_NACIONAL', 'AUTONOMO');

-- CreateEnum
CREATE TYPE "PlanoNegocio" AS ENUM ('GRATUITO', 'PAGO');

-- CreateEnum
CREATE TYPE "StatusConvite" AS ENUM ('PENDENTE', 'ACEITO', 'EXPIRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('PRODUTO_FISICO', 'SERVICO');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA_VENDA', 'SAIDA_MANUAL', 'ENTRADA_ESTORNO');

-- CreateEnum
CREATE TYPE "MotivoSaidaManual" AS ENUM ('PERDA', 'QUEBRA', 'USO_INTERNO', 'DOACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'CREDITO_TROCA');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrigemDespesaFixa" AS ENUM ('MANUAL', 'DAS_MEI');

-- CreateEnum
CREATE TYPE "AnexoSimples" AS ENUM ('I', 'II', 'III', 'IV', 'V');

-- CreateEnum
CREATE TYPE "AtividadeMei" AS ENUM ('COMERCIO_INDUSTRIA', 'SERVICOS', 'COMERCIO_E_SERVICOS');

-- CreateEnum
CREATE TYPE "OrigemPreco" AS ENUM ('CALCULADORA', 'MANUAL');

-- CreateEnum
CREATE TYPE "CategoriaItem" AS ENUM ('SERVICOS', 'PRODUTOS', 'ALIMENTACAO', 'VESTUARIO', 'BELEZA', 'SAUDE', 'CASA', 'TECNOLOGIA', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "CategoriaLancamento" AS ENUM ('VENDAS', 'FORNECEDORES', 'IMPOSTOS', 'SALARIO', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('PAGAR', 'RECEBER');

-- CreateEnum
CREATE TYPE "StatusConta" AS ENUM ('ABERTA', 'PARCIAL', 'QUITADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentimentoLgpdEm" TIMESTAMP(3),
    "excluidoEm" TIMESTAMP(3),
    "anonimizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negocio" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "regimeTributario" "RegimeTributario" NOT NULL DEFAULT 'MEI',
    "plano" "PlanoNegocio" NOT NULL DEFAULT 'GRATUITO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planoAlteradoEm" TIMESTAMP(3),
    "planoAlteradoPorId" UUID,
    "cnpj" TEXT,
    "razaoSocial" TEXT,
    "cnaePrincipal" TEXT,
    "anexoSimples" "AnexoSimples",
    "sujeitoFatorR" BOOLEAN NOT NULL DEFAULT false,
    "atividadeMei" "AtividadeMei",
    "impostoPercentualManual" DECIMAL(5,2),
    "taxaCartaoMedia" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "margemLucroMeta" DECIMAL(5,2),
    "capacidadeMensal" DECIMAL(10,2),
    "ticketMedioEstimado" DECIMAL(10,2),
    "faturamentoMensalEstimado" DECIMAL(12,2),
    "cmvEstimado" DECIMAL(5,2),
    "diasCoberturaEstoque" INTEGER NOT NULL DEFAULT 7,
    "encerradoEm" TIMESTAMP(3),

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroNegocio" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'COLABORADOR',
    "permissoesCustom" JSONB,

    CONSTRAINT "MembroNegocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'COLABORADOR',
    "permissoesCustom" JSONB,
    "tokenHash" TEXT NOT NULL,
    "status" "StatusConvite" NOT NULL DEFAULT 'PENDENTE',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "convidadoPorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "contato" TEXT,
    "anonimizadoEm" TIMESTAMP(3),

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "tipo" "TipoItem" NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaItem" NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "custoBase" DECIMAL(10,2) NOT NULL,
    "precoAtual" DECIMAL(10,2),
    "quantidadeEstoque" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "estoqueMinimo" DECIMAL(10,3),
    "comissaoPercentual" DECIMAL(5,2),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialServico" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "servicoId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL DEFAULT 1,

    CONSTRAINT "MaterialServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "vendaId" UUID,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "saldoAnterior" DECIMAL(10,3) NOT NULL,
    "saldoPosterior" DECIMAL(10,3) NOT NULL,
    "motivo" "MotivoSaidaManual",
    "usuarioId" UUID NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoPreco" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "origem" "OrigemPreco" NOT NULL DEFAULT 'CALCULADORA',
    "margemAplicada" DECIMAL(5,2),
    "custoConsiderado" DECIMAL(10,2),
    "despesasFixasPercentual" DECIMAL(5,2),
    "despesasVariaveisPercentual" DECIMAL(5,2),
    "regimeTributario" "RegimeTributario",
    "impostoAplicado" DECIMAL(5,2),
    "dataConfirmacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespesaFixa" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorMensal" DECIMAL(10,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "categoria" "CategoriaLancamento" NOT NULL DEFAULT 'OUTROS',
    "origem" "OrigemDespesaFixa" NOT NULL DEFAULT 'MANUAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DespesaFixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaixaTributaria" (
    "id" UUID NOT NULL,
    "anexo" "AnexoSimples" NOT NULL,
    "faixaOrdem" INTEGER NOT NULL,
    "rbt12De" DECIMAL(12,2) NOT NULL,
    "rbt12Ate" DECIMAL(12,2),
    "aliquota" DECIMAL(5,2) NOT NULL,
    "parcelaDeduzir" DECIMAL(12,2) NOT NULL,
    "fonteLegal" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FaixaTributaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CnaeAnexo" (
    "cnae" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "anexo" "AnexoSimples" NOT NULL,
    "sujeitoFatorR" BOOLEAN NOT NULL DEFAULT false,
    "fonteLegal" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CnaeAnexo_pkey" PRIMARY KEY ("cnae")
);

-- CreateTable
CREATE TABLE "ParametroMei" (
    "id" UUID NOT NULL,
    "atividade" "AtividadeMei" NOT NULL,
    "valorDasMensal" DECIMAL(10,2) NOT NULL,
    "limiteFaturamentoAnual" DECIMAL(12,2) NOT NULL,
    "fonteLegal" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParametroMei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroFatorR" (
    "id" UUID NOT NULL,
    "limiteMinimo" DECIMAL(5,2) NOT NULL,
    "anexoSeAtingir" "AnexoSimples" NOT NULL,
    "anexoSeNaoAtingir" "AnexoSimples" NOT NULL,
    "fonteLegal" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParametroFatorR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MargemPadraoCategoria" (
    "categoria" "CategoriaItem" NOT NULL,
    "margemPadrao" DECIMAL(5,2) NOT NULL,
    "fonteLegal" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MargemPadraoCategoria_pkey" PRIMARY KEY ("categoria")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "clienteId" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "status" "StatusVenda" NOT NULL DEFAULT 'CONCLUIDA',
    "canceladaEm" TIMESTAMP(3),
    "canceladaPorId" UUID,
    "motivoCancelamento" TEXT,
    "vendaOrigemId" UUID,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "vendaId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "custoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "vendaId" UUID NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcela" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "pagamentoId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoFinanceiro" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "vendaId" UUID,
    "contaId" UUID,
    "tipo" "TipoLancamento" NOT NULL,
    "categoria" "CategoriaLancamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "estorno" BOOLEAN NOT NULL DEFAULT false,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LancamentoFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaPagarReceber" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "parcelaId" UUID,
    "despesaFixaId" UUID,
    "competencia" TIMESTAMP(3),
    "tipo" "TipoConta" NOT NULL,
    "categoria" "CategoriaLancamento" NOT NULL,
    "descricao" TEXT,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "valorPago" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusConta" NOT NULL DEFAULT 'ABERTA',

    CONSTRAINT "ContaPagarReceber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_cnpj_key" ON "Negocio"("cnpj");

-- CreateIndex
CREATE INDEX "Negocio_id_idx" ON "Negocio"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MembroNegocio_usuarioId_negocioId_key" ON "MembroNegocio"("usuarioId", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_tokenHash_key" ON "Convite"("tokenHash");

-- CreateIndex
CREATE INDEX "Convite_negocioId_status_idx" ON "Convite"("negocioId", "status");

-- CreateIndex
CREATE INDEX "Convite_email_idx" ON "Convite"("email");

-- CreateIndex
CREATE INDEX "Cliente_negocioId_idx" ON "Cliente"("negocioId");

-- CreateIndex
CREATE INDEX "Item_negocioId_idx" ON "Item"("negocioId");

-- CreateIndex
CREATE INDEX "MaterialServico_negocioId_idx" ON "MaterialServico"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialServico_servicoId_materialId_key" ON "MaterialServico"("servicoId", "materialId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_negocioId_idx" ON "MovimentacaoEstoque"("negocioId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_itemId_idx" ON "MovimentacaoEstoque"("itemId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_vendaId_idx" ON "MovimentacaoEstoque"("vendaId");

-- CreateIndex
CREATE INDEX "HistoricoPreco_negocioId_idx" ON "HistoricoPreco"("negocioId");

-- CreateIndex
CREATE INDEX "HistoricoPreco_itemId_idx" ON "HistoricoPreco"("itemId");

-- CreateIndex
CREATE INDEX "DespesaFixa_negocioId_idx" ON "DespesaFixa"("negocioId");

-- CreateIndex
CREATE INDEX "FaixaTributaria_anexo_ativo_idx" ON "FaixaTributaria"("anexo", "ativo");

-- CreateIndex
CREATE INDEX "ParametroMei_atividade_ativo_idx" ON "ParametroMei"("atividade", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_vendaOrigemId_key" ON "Venda"("vendaOrigemId");

-- CreateIndex
CREATE INDEX "Venda_negocioId_idx" ON "Venda"("negocioId");

-- CreateIndex
CREATE INDEX "Venda_negocioId_data_status_idx" ON "Venda"("negocioId", "data", "status");

-- CreateIndex
CREATE INDEX "ItemVenda_negocioId_idx" ON "ItemVenda"("negocioId");

-- CreateIndex
CREATE INDEX "ItemVenda_vendaId_idx" ON "ItemVenda"("vendaId");

-- CreateIndex
CREATE INDEX "Pagamento_negocioId_idx" ON "Pagamento"("negocioId");

-- CreateIndex
CREATE INDEX "Pagamento_vendaId_idx" ON "Pagamento"("vendaId");

-- CreateIndex
CREATE INDEX "Parcela_negocioId_idx" ON "Parcela"("negocioId");

-- CreateIndex
CREATE INDEX "Parcela_pagamentoId_idx" ON "Parcela"("pagamentoId");

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_negocioId_idx" ON "LancamentoFinanceiro"("negocioId");

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_contaId_idx" ON "LancamentoFinanceiro"("contaId");

-- CreateIndex
CREATE UNIQUE INDEX "ContaPagarReceber_parcelaId_key" ON "ContaPagarReceber"("parcelaId");

-- CreateIndex
CREATE INDEX "ContaPagarReceber_negocioId_idx" ON "ContaPagarReceber"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "ContaPagarReceber_despesaFixaId_competencia_key" ON "ContaPagarReceber"("despesaFixaId", "competencia");

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_planoAlteradoPorId_fkey" FOREIGN KEY ("planoAlteradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroNegocio" ADD CONSTRAINT "MembroNegocio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroNegocio" ADD CONSTRAINT "MembroNegocio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_convidadoPorId_fkey" FOREIGN KEY ("convidadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialServico" ADD CONSTRAINT "MaterialServico_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialServico" ADD CONSTRAINT "MaterialServico_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialServico" ADD CONSTRAINT "MaterialServico_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPreco" ADD CONSTRAINT "HistoricoPreco_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPreco" ADD CONSTRAINT "HistoricoPreco_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPreco" ADD CONSTRAINT "HistoricoPreco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaFixa" ADD CONSTRAINT "DespesaFixa_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_vendaOrigemId_fkey" FOREIGN KEY ("vendaOrigemId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaPagarReceber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "Parcela"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_despesaFixaId_fkey" FOREIGN KEY ("despesaFixaId") REFERENCES "DespesaFixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

