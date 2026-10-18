-- SPEC-011 — Cancelamento e troca de venda: auditoria do cancelamento (RF65, RNF05).
-- Os campos de cancelamento, a ligação da troca e a forma "Crédito de troca" já existem.

-- Venda cancelada se e somente se quem, quando e por quê estiverem preenchidos.
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_cancelamento_completo" CHECK (
  ("status" = 'CANCELADA') = ("canceladaEm" IS NOT NULL AND "canceladaPorId" IS NOT NULL AND "motivoCancelamento" IS NOT NULL)
);

-- Uma venda cancelada não é mais alterada (o próprio cancelamento é a última alteração).
CREATE OR REPLACE FUNCTION he_venda_cancelada_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'he_venda_cancelada_imutavel: a venda % já foi cancelada e não pode ser alterada', OLD.numero
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER he_venda_cancelada_imutavel BEFORE UPDATE ON "Venda"
  FOR EACH ROW WHEN (OLD."status" = 'CANCELADA') EXECUTE FUNCTION he_venda_cancelada_imutavel();
