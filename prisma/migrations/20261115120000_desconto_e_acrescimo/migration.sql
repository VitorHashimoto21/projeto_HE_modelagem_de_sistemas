-- SPEC-028: desconto e acréscimo nos pagamentos das contas (RN44).

-- OPEN-005: motivo de uma lista curta.
CREATE TYPE "MotivoDesconto" AS ENUM ('TAXA_MAQUININHA', 'DESCONTO_COMBINADO', 'OUTRO');
CREATE TYPE "MotivoAcrescimo" AS ENUM ('JUROS_MULTA', 'OUTRO');

-- OPEN-001 e OPEN-002: o lançamento do pagamento guarda o valor real (o que entrou ou saiu do caixa)
-- e, ao lado, o desconto e o acréscimo, que não geram lançamento próprio.
ALTER TABLE "LancamentoFinanceiro"
  ADD COLUMN "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "acrescimo" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "motivoDesconto" "MotivoDesconto",
  ADD COLUMN "motivoAcrescimo" "MotivoAcrescimo",
  ADD COLUMN "observacaoPagamento" VARCHAR(120);

-- Totais da conta, atualizados na mesma transação do pagamento (INV-001).
ALTER TABLE "ContaPagarReceber"
  ADD COLUMN "valorDesconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "valorAcrescimo" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- INV-001: o pago (dinheiro) pode passar do total quando há acréscimo; o que a conta abate
-- (pago + descontos − acréscimos) nunca passa do total nem fica negativo.
ALTER TABLE "ContaPagarReceber" DROP CONSTRAINT "ContaPagarReceber_valores_validos";
ALTER TABLE "ContaPagarReceber" ADD CONSTRAINT "ContaPagarReceber_valores_validos" CHECK (
  "valorTotal" > 0 AND "valorPago" >= 0 AND "valorDesconto" >= 0 AND "valorAcrescimo" >= 0
  AND "valorPago" + "valorDesconto" - "valorAcrescimo" >= 0
  AND "valorPago" + "valorDesconto" - "valorAcrescimo" <= "valorTotal"
);

-- INV-004: desconto e acréscimo não negativos, só no pagamento de conta, sempre com motivo;
-- o motivo "Outro" pede a observação; cada pagamento abate mais que zero da conta. O valor
-- positivo continua com a sua própria regra (LancamentoFinanceiro_valor_positivo).
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_desconto_acrescimo_validos"
  CHECK ("desconto" >= 0 AND "acrescimo" >= 0 AND ("valor" <= 0 OR "valor" + "desconto" - "acrescimo" > 0));
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_ajuste_so_de_conta" CHECK (
  "origem" = 'CONTA'
  OR ("desconto" = 0 AND "acrescimo" = 0 AND "motivoDesconto" IS NULL AND "motivoAcrescimo" IS NULL AND "observacaoPagamento" IS NULL)
);
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_motivo_do_desconto"
  CHECK (("desconto" > 0) = ("motivoDesconto" IS NOT NULL));
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_motivo_do_acrescimo"
  CHECK (("acrescimo" > 0) = ("motivoAcrescimo" IS NOT NULL));
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_observacao_do_pagamento" CHECK (
  ("observacaoPagamento" IS NULL OR btrim("observacaoPagamento") <> '')
  AND (("motivoDesconto" IS DISTINCT FROM 'OUTRO' AND "motivoAcrescimo" IS DISTINCT FROM 'OUTRO') OR "observacaoPagamento" IS NOT NULL)
);
