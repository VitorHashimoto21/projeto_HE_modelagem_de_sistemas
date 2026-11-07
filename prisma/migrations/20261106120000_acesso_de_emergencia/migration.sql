-- SPEC-019, etapa 3b (acesso de emergência). Só acrescenta: as liberações que já existem ficam com
-- tipo = LIBERACAO e nenhum registro antigo muda. Por decisão da equipe (06/11/2026), o cancelamento de
-- um pedido não vai para o registro: não há o evento EMERGENCIA_CANCELADA.

-- CreateEnum
CREATE TYPE "TipoAcessoSuporte" AS ENUM ('LIBERACAO', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "MotivoEmergencia" AS ENUM ('ORDEM_JUDICIAL', 'INCIDENTE', 'DONO_SEM_ACESSO');

-- AlterEnum
ALTER TYPE "EventoSuporte" ADD VALUE 'EMERGENCIA_SOLICITADA';
ALTER TYPE "EventoSuporte" ADD VALUE 'EMERGENCIA_APROVADA';
ALTER TYPE "EventoSuporte" ADD VALUE 'EMERGENCIA_RECUSADA';
ALTER TYPE "EventoSuporte" ADD VALUE 'EMERGENCIA_ENCERRADA';
ALTER TYPE "EventoSuporte" ADD VALUE 'EMERGENCIA_RESULTADO';

-- AlterTable
ALTER TABLE "AcessoSuporte" ADD COLUMN     "justificativa" VARCHAR(500),
ADD COLUMN     "motivoEmergencia" "MotivoEmergencia",
ADD COLUMN     "pedidoId" UUID,
ADD COLUMN     "referencia" VARCHAR(120),
ADD COLUMN     "resultado" VARCHAR(1000),
ADD COLUMN     "resultadoEm" TIMESTAMP(3),
ADD COLUMN     "tipo" "TipoAcessoSuporte" NOT NULL DEFAULT 'LIBERACAO',
ALTER COLUMN "liberadoPorId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AcessoSuporte_pedidoId_key" ON "AcessoSuporte"("pedidoId");

-- AddForeignKey
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoPlataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5.6 e seção 7: os campos de cada tipo. A liberação tem o Dono e nada da emergência. A emergência não
-- tem Dono, tem o motivo da lista, a referência, a justificativa e o pedido; nunca corrige (INV-003) e
-- dura até 4 h; o resultado vem com a hora. COALESCE: um CHECK que dá NULL passaria.
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_por_tipo" CHECK (
  COALESCE(
    CASE "tipo"::text
      WHEN 'LIBERACAO' THEN "liberadoPorId" IS NOT NULL AND "motivoEmergencia" IS NULL AND "referencia" IS NULL
        AND "justificativa" IS NULL AND "pedidoId" IS NULL AND "resultado" IS NULL AND "resultadoEm" IS NULL
      WHEN 'EMERGENCIA' THEN "liberadoPorId" IS NULL AND "motivoEmergencia" IS NOT NULL AND length(btrim("referencia")) > 0
        AND length(btrim("justificativa")) > 0 AND "pedidoId" IS NOT NULL AND cardinality("modulosComCorrecao") = 0
        AND "expiraEm" - "criadoEm" <= interval '4 hours'
        AND ("resultado" IS NULL) = ("resultadoEm" IS NULL) AND ("resultado" IS NULL OR length(btrim("resultado")) > 0)
    END,
    false
  )
);

-- O tipo e o pedido não mudam, e o resultado, uma vez registrado, também não.
CREATE OR REPLACE FUNCTION he_acesso_de_emergencia() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."tipo" IS DISTINCT FROM OLD."tipo" OR NEW."pedidoId" IS DISTINCT FROM OLD."pedidoId" THEN
    RAISE EXCEPTION 'he_acesso_de_emergencia: o tipo e o pedido do acesso não mudam';
  END IF;
  IF OLD."resultado" IS NOT NULL AND (NEW."resultado" IS DISTINCT FROM OLD."resultado" OR NEW."resultadoEm" IS DISTINCT FROM OLD."resultadoEm") THEN
    RAISE EXCEPTION 'he_acesso_de_emergencia: o resultado já foi registrado';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER he_acesso_de_emergencia BEFORE UPDATE ON "AcessoSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_acesso_de_emergencia();

-- 5.6: o pedido de emergência guarda o motivo da lista, a referência (até 120), a justificativa (até 500),
-- os módulos (ao menos um) e o prazo (1 h, 2 h ou 4 h). O pedido de plano continua como na etapa 3a.
ALTER TABLE "PedidoPlataforma" DROP CONSTRAINT "PedidoPlataforma_dados";
ALTER TABLE "PedidoPlataforma" ADD CONSTRAINT "PedidoPlataforma_dados" CHECK (
  jsonb_typeof("dados") = 'object'
  AND COALESCE(
    CASE "tipo"::text
      WHEN 'PLANO' THEN "dados"->>'para' IN ('GRATUITO', 'PAGO')
        AND "dados"->>'motivo' IN ('CORTESIA', 'CORRECAO', 'TESTE')
        AND length(btrim("dados"->>'descricao')) BETWEEN 1 AND 300
      WHEN 'EMERGENCIA' THEN "dados"->>'motivo' IN ('ORDEM_JUDICIAL', 'INCIDENTE', 'DONO_SEM_ACESSO')
        AND length(btrim("dados"->>'referencia')) BETWEEN 1 AND 120
        AND length(btrim("dados"->>'justificativa')) BETWEEN 1 AND 500
        AND "dados"->>'prazo' IN ('1h', '2h', '4h')
        AND jsonb_typeof("dados"->'modulos') = 'array'
        AND jsonb_array_length("dados"->'modulos') BETWEEN 1 AND 6
    END,
    false
  )
);

-- Os eventos de pedido apontam o pedido; a aprovação, o encerramento e o resultado da emergência apontam
-- o acesso. Comparação em texto: os valores novos do enum não podem ser usados na mesma transação.
ALTER TABLE "RegistroSuporte" DROP CONSTRAINT "RegistroSuporte_evento_do_pedido";
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_evento_do_pedido" CHECK (
  ("evento"::text IN ('PLANO_SOLICITADO', 'PLANO_APROVADO', 'PLANO_RECUSADO', 'EMERGENCIA_SOLICITADA', 'EMERGENCIA_APROVADA', 'EMERGENCIA_RECUSADA'))
    = ("pedidoId" IS NOT NULL)
);
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_evento_do_acesso" CHECK (
  "evento"::text NOT IN ('EMERGENCIA_APROVADA', 'EMERGENCIA_ENCERRADA', 'EMERGENCIA_RESULTADO') OR "acessoId" IS NOT NULL
);

-- Isolamento (SPEC-001): o acesso de emergência aponta um pedido do mesmo negócio.
DROP TRIGGER IF EXISTS he_mesmo_negocio ON "AcessoSuporte";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "AcessoSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('PedidoPlataforma', 'pedidoId');
