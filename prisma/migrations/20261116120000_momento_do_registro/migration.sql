-- SPEC-028, etapa 4 (OPEN-009): o momento em que cada lançamento foi gravado.
-- O estorno de pagamento de conta passa a ter a data do pagamento original, e esta coluna guarda quando
-- ele foi feito. Os lançamentos existentes ficam com a coluna vazia (OPEN-010: nenhum lançamento é
-- alterado; vazio = a própria data). A coluna é criada sem padrão e o padrão vem depois, para o Postgres
-- não preencher as linhas existentes com o momento da migração.
ALTER TABLE "LancamentoFinanceiro" ADD COLUMN "registradoEm" TIMESTAMP(3);
ALTER TABLE "LancamentoFinanceiro" ALTER COLUMN "registradoEm" SET DEFAULT CURRENT_TIMESTAMP;
