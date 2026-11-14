-- SPEC-019 etapa 4a (5.7, RN39, INV-008): suspender e reativar o negócio pela plataforma.
-- O negócio suspenso fica somente leitura: os membros veem tudo, nada é gravado nos módulos nem em
-- Configurações, e nada é apagado. O histórico das suspensões fica no registro do suporte.

-- CreateEnum
CREATE TYPE "MotivoSuspensao" AS ENUM ('PEDIDO_DO_DONO', 'USO_INDEVIDO', 'INCIDENTE_SEGURANCA', 'ORDEM_JUDICIAL');

-- AlterEnum
ALTER TYPE "EventoSuporte" ADD VALUE 'SUSPENSAO';
ALTER TYPE "EventoSuporte" ADD VALUE 'REATIVACAO';

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "descricaoSuspensao" VARCHAR(500),
ADD COLUMN     "motivoSuspensao" "MotivoSuspensao",
ADD COLUMN     "suspensoEm" TIMESTAMP(3),
ADD COLUMN     "suspensoPorId" UUID;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_suspensoPorId_fkey" FOREIGN KEY ("suspensoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A suspensão tem tudo junto (quando, quem, o motivo e a descrição) ou nada.
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_suspensao" CHECK (
  ("suspensoEm" IS NULL) = ("suspensoPorId" IS NULL)
  AND ("suspensoEm" IS NULL) = ("motivoSuspensao" IS NULL)
  AND ("suspensoEm" IS NULL) = ("descricaoSuspensao" IS NULL)
  AND ("descricaoSuspensao" IS NULL OR length(btrim("descricaoSuspensao")) > 0)
);
-- Negócio encerrado não fica suspenso (5.7). Ao encerrar, a suspensão termina junto.
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_encerrado_nao_suspenso" CHECK ("encerradoEm" IS NULL OR "suspensoEm" IS NULL);

-- A suspensão e a reativação são do negócio, sem acesso nem pedido, e guardam o motivo e a descrição
-- completa nos dados (a descrição do registro tem só 200 caracteres). Comparação em texto: os valores
-- novos do enum não podem ser usados na mesma transação.
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_evento_da_suspensao" CHECK (
  "evento"::text NOT IN ('SUSPENSAO', 'REATIVACAO')
  OR ("negocioId" IS NOT NULL AND "acessoId" IS NULL AND "pedidoId" IS NULL AND "dados" IS NOT NULL)
);

-- INV-008 (segunda barreira, no banco): com o negócio suspenso, as tabelas dos módulos não aceitam
-- inclusão, alteração nem exclusão, venha a gravação de onde vier (membros, suporte, rotina). Ficam
-- de fora só as tabelas que a suspensão não trava (o mapa GRAVAM_NA_SUSPENSAO de src/lib/db/modelos.ts):
-- equipe e convites (troca de plano pela plataforma, exclusão de conta e LGPD), histórico de planos,
-- acessos e registro do suporte e pedidos da plataforma.
CREATE OR REPLACE FUNCTION he_recusar_no_negocio_suspenso() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  alvo uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN alvo := OLD."negocioId"; ELSE alvo := NEW."negocioId"; END IF;
  IF EXISTS (SELECT 1 FROM "Negocio" WHERE "id" = alvo AND "suspensoEm" IS NOT NULL) THEN
    RAISE EXCEPTION 'he_negocio_suspenso: o negócio está suspenso pela plataforma (somente leitura)';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'Cliente', 'Fornecedor', 'Item', 'Subcategoria', 'MaterialServico', 'MovimentacaoEstoque', 'HistoricoPreco',
    'HistoricoCusto', 'DespesaFixa', 'Venda', 'ItemVenda', 'Pagamento', 'Parcela', 'LancamentoFinanceiro', 'ContaPagarReceber'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS he_negocio_suspenso ON %I', tabela);
    EXECUTE format('CREATE TRIGGER he_negocio_suspenso BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION he_recusar_no_negocio_suspenso()', tabela);
  END LOOP;
END;
$$;

-- No próprio negócio (Configurações: dados, regime, parâmetros, número da venda…), enquanto ele
-- continua suspenso, só mudam o plano (troca pela plataforma) e os campos da suspensão. Qualquer
-- coluna nova fica travada sem precisar mexer aqui. Encerrar e reativar tiram a suspensão e passam.
CREATE OR REPLACE FUNCTION he_recusar_negocio_suspenso() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  livres text[] := ARRAY['plano', 'planoAlteradoEm', 'planoAlteradoPorId', 'suspensoEm', 'suspensoPorId', 'motivoSuspensao', 'descricaoSuspensao'];
BEGIN
  IF OLD."suspensoEm" IS NOT NULL AND NEW."suspensoEm" IS NOT NULL
     AND (to_jsonb(NEW) - livres) IS DISTINCT FROM (to_jsonb(OLD) - livres) THEN
    RAISE EXCEPTION 'he_negocio_suspenso: o negócio está suspenso pela plataforma (somente leitura)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS he_negocio_suspenso ON "Negocio";
CREATE TRIGGER he_negocio_suspenso BEFORE UPDATE ON "Negocio"
  FOR EACH ROW EXECUTE FUNCTION he_recusar_negocio_suspenso();
