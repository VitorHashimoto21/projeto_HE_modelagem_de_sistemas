-- SPEC-019, etapa 3a (pedidos com duas pessoas e troca de plano pela plataforma). Só acrescenta: nenhum
-- dado existente muda. As trocas de plano antigas ficam sem motivo e sem pedido (feitas pelo Dono).

-- CreateEnum
CREATE TYPE "TipoPedidoPlataforma" AS ENUM ('EMERGENCIA', 'PLANO');

-- CreateEnum
CREATE TYPE "SituacaoPedidoPlataforma" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO', 'EXPIRADO');

-- AlterEnum
ALTER TYPE "EventoSuporte" ADD VALUE 'PLANO_SOLICITADO';
ALTER TYPE "EventoSuporte" ADD VALUE 'PLANO_APROVADO';
ALTER TYPE "EventoSuporte" ADD VALUE 'PLANO_RECUSADO';

-- AlterTable
ALTER TABLE "HistoricoPlano" ADD COLUMN     "motivo" VARCHAR(300),
ADD COLUMN     "pedidoId" UUID;

-- AlterTable
ALTER TABLE "RegistroSuporte" ADD COLUMN     "pedidoId" UUID;

-- CreateTable
CREATE TABLE "PedidoPlataforma" (
    "id" UUID NOT NULL,
    "tipo" "TipoPedidoPlataforma" NOT NULL,
    "negocioId" UUID NOT NULL,
    "solicitadoPorId" UUID NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "situacao" "SituacaoPedidoPlataforma" NOT NULL DEFAULT 'PENDENTE',
    "decididoPorId" UUID,
    "decididoEm" TIMESTAMP(3),
    "motivoDaRecusa" VARCHAR(300),

    CONSTRAINT "PedidoPlataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoPlataforma_negocioId_criadoEm_idx" ON "PedidoPlataforma"("negocioId", "criadoEm");

-- CreateIndex
CREATE INDEX "PedidoPlataforma_situacao_expiraEm_idx" ON "PedidoPlataforma"("situacao", "expiraEm");

-- AddForeignKey
ALTER TABLE "HistoricoPlano" ADD CONSTRAINT "HistoricoPlano_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoPlataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoPlataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- INV-006: quem decide nunca é quem pediu. O pedido vale por até 12 h.
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_duas_pessoas" CHECK ("decididoPorId" IS NULL OR "decididoPorId" <> "solicitadoPorId");
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_prazo" CHECK ("expiraEm" > "criadoEm" AND "expiraEm" - "criadoEm" <= interval '12 hours');

-- Cada situação com os seus campos: aprovado e recusado têm quem decidiu (a recusa, o motivo);
-- cancelado (por quem pediu) e expirado têm só a hora. COALESCE: um CHECK que dá NULL passaria.
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_decisao" CHECK (
  COALESCE(
    CASE "situacao"::text
      WHEN 'PENDENTE' THEN "decididoPorId" IS NULL AND "decididoEm" IS NULL AND "motivoDaRecusa" IS NULL
      WHEN 'APROVADO' THEN "decididoPorId" IS NOT NULL AND "decididoEm" IS NOT NULL AND "motivoDaRecusa" IS NULL
      WHEN 'RECUSADO' THEN "decididoPorId" IS NOT NULL AND "decididoEm" IS NOT NULL AND length(btrim("motivoDaRecusa")) > 0
      ELSE "decididoPorId" IS NULL AND "decididoEm" IS NOT NULL AND "motivoDaRecusa" IS NULL
    END,
    false
  )
);

-- 5.8: o pedido de plano guarda o plano de destino, o motivo da lista e a descrição (até 300). Sem uma
-- das chaves, a comparação dá NULL: o COALESCE a recusa.
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_dados" CHECK (
  jsonb_typeof("dados") = 'object'
  AND (
    "tipo"::text <> 'PLANO'
    OR COALESCE(
      "dados"->>'para' IN ('GRATUITO', 'PAGO')
      AND "dados"->>'motivo' IN ('CORTESIA', 'CORRECAO', 'TESTE')
      AND length(btrim("dados"->>'descricao')) BETWEEN 1 AND 300,
      false
    )
  )
);

-- No máximo um pedido pendente por negócio e tipo.
CREATE UNIQUE INDEX "PedidoPlataforma_um_pendente" ON "PedidoPlataforma"("negocioId", "tipo") WHERE "situacao" = 'PENDENTE';

-- O pedido nunca é apagado, e só a decisão muda, uma vez: depois de decidido, nada mais muda.
CREATE OR REPLACE FUNCTION he_pedido_plataforma() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'he_pedido_plataforma: pedidos da plataforma não são apagados';
  END IF;
  IF OLD."situacao"::text <> 'PENDENTE' THEN
    RAISE EXCEPTION 'he_pedido_plataforma: o pedido já foi decidido';
  END IF;
  IF NEW."tipo" IS DISTINCT FROM OLD."tipo" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
     OR NEW."solicitadoPorId" IS DISTINCT FROM OLD."solicitadoPorId" OR NEW."dados" IS DISTINCT FROM OLD."dados"
     OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" OR NEW."expiraEm" IS DISTINCT FROM OLD."expiraEm" THEN
    RAISE EXCEPTION 'he_pedido_plataforma: só a decisão do pedido muda';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER he_pedido_plataforma BEFORE UPDATE OR DELETE ON "PedidoPlataforma"
  FOR EACH ROW EXECUTE FUNCTION he_pedido_plataforma();

-- A troca pela plataforma sempre tem o pedido e a descrição; a do Dono, nenhum dos dois. Um pedido troca
-- o plano no máximo uma vez.
ALTER TABLE "HistoricoPlano" ADD CONSTRAINT "HistoricoPlano_pela_plataforma" CHECK (("pedidoId" IS NULL) = ("motivo" IS NULL));
CREATE UNIQUE INDEX "HistoricoPlano_um_por_pedido" ON "HistoricoPlano"("pedidoId") WHERE "pedidoId" IS NOT NULL;

-- Os eventos do pedido de plano apontam o pedido. Comparação em texto: os valores novos do enum não podem
-- ser usados na mesma transação em que foram criados.
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_evento_do_pedido" CHECK (
  ("evento"::text IN ('PLANO_SOLICITADO', 'PLANO_APROVADO', 'PLANO_RECUSADO')) = ("pedidoId" IS NOT NULL)
);

-- Isolamento (SPEC-001): o histórico do plano e o registro apontam pedidos do mesmo negócio.
DROP TRIGGER IF EXISTS he_mesmo_negocio ON "HistoricoPlano";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "HistoricoPlano"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('PedidoPlataforma', 'pedidoId');
DROP TRIGGER he_mesmo_negocio ON "RegistroSuporte";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "RegistroSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('AcessoSuporte', 'acessoId', 'RegistroSuporte', 'correcaoId', 'PedidoPlataforma', 'pedidoId');

-- Só o servidor lê e grava os pedidos (regra da SPEC-001): RLS ligado, sem política.
ALTER TABLE "PedidoPlataforma" ENABLE ROW LEVEL SECURITY;

-- 5.9: o painel conta os autenticadores de cada conta de Administrador em auth.mfa_factors (Supabase
-- Auth; nenhum segredo nas tabelas do HE). Fora do Supabase (desenvolvimento local, CI e testes) não
-- existe essa tabela: cria um substituto mínimo, com as colunas que a contagem usa. No Supabase, nada muda.
DO $$
BEGIN
  IF to_regclass('auth.mfa_factors') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.mfa_factors (
      id            uuid PRIMARY KEY,
      user_id       uuid NOT NULL,
      friendly_name text,
      factor_type   text NOT NULL DEFAULT 'totp',
      status        text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;
