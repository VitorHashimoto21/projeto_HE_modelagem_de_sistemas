-- SPEC-018 — Administrador da plataforma e acesso de suporte (somente leitura).
-- CreateEnum
CREATE TYPE "EventoSuporte" AS ENUM ('PAPEL_CONCEDIDO', 'PAPEL_RETIRADO', 'LIBERACAO', 'REVOGACAO', 'ENTRADA', 'TELA', 'SAIDA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "administradorEm" TIMESTAMP(3),
ADD COLUMN     "termosAceitosEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AcessoSuporte" (
    "id" UUID NOT NULL,
    "negocioId" UUID NOT NULL,
    "liberadoPorId" UUID NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "modulos" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "revogadoPorId" UUID,
    "primeiraEntradaEm" TIMESTAMP(3),

    CONSTRAINT "AcessoSuporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroSuporte" (
    "id" UUID NOT NULL,
    "negocioId" UUID,
    "acessoId" UUID,
    "usuarioId" UUID NOT NULL,
    "evento" "EventoSuporte" NOT NULL,
    "modulo" VARCHAR(20),
    "descricao" VARCHAR(200) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroSuporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcessoSuporte_negocioId_criadoEm_idx" ON "AcessoSuporte"("negocioId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroSuporte_negocioId_criadoEm_idx" ON "RegistroSuporte"("negocioId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroSuporte_acessoId_criadoEm_idx" ON "RegistroSuporte"("acessoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_liberadoPorId_fkey" FOREIGN KEY ("liberadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_acessoId_fkey" FOREIGN KEY ("acessoId") REFERENCES "AcessoSuporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RF78 (OPEN-011): data do último aceite; quem já aceitou no cadastro fica com a data do consentimento.
UPDATE "Usuario" SET "termosAceitosEm" = "consentimentoLgpdEm" WHERE "versaoTermosAceita" IS NOT NULL;

-- RF74 (INV-004): conta excluída nunca é administradora.
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_administrador_nao_excluido" CHECK ("administradorEm" IS NULL OR "excluidoEm" IS NULL);

-- RF75 / RN31: motivo, módulos da matriz (ao menos um), prazo depois da liberação e revogação completa.
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_motivo" CHECK (length(btrim("motivo")) > 0);
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_modulos" CHECK (
  "modulos" IS NOT NULL
  AND cardinality("modulos") BETWEEN 1 AND 6
  AND "modulos" <@ ARRAY['catalogo', 'estoque', 'vendas', 'calculadora', 'financeiro', 'dashboard']::text[]
);
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_prazo" CHECK ("expiraEm" > "criadoEm" AND "expiraEm" <= "criadoEm" + interval '7 days');
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_revogacao_completa" CHECK (("revogadoEm" IS NULL) = ("revogadoPorId" IS NULL));

-- RN32: os eventos de papel não têm negócio; os demais sempre têm.
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_negocio_do_evento" CHECK (
  ("evento" IN ('PAPEL_CONCEDIDO', 'PAPEL_RETIRADO')) = ("negocioId" IS NULL)
);

-- Isolamento (SPEC-001): o negocioId não muda e o registro só aponta para uma liberação do mesmo negócio.
CREATE TRIGGER he_negocio_imutavel BEFORE UPDATE OF "negocioId" ON "AcessoSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_negocio_imutavel();
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "RegistroSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('AcessoSuporte', 'acessoId');

-- RN32 (INV-005): o registro de auditoria só recebe inserção.
CREATE TRIGGER he_somente_insercao BEFORE UPDATE OR DELETE ON "RegistroSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_somente_insercao();

-- RLS ligado sem policy, como todas as tabelas do schema public (SPEC-001, OPEN-13).
ALTER TABLE "AcessoSuporte" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RegistroSuporte" ENABLE ROW LEVEL SECURITY;

-- RF78: o cadastro grava também a data do aceite (mesma regra do gatilho da SPEC-002).
CREATE OR REPLACE FUNCTION public.he_criar_usuario() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta   jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  nome   text  := nullif(btrim(meta ->> 'nome'), '');
  versao text  := nullif(btrim(meta ->> 'versaoTermosAceita'), '');
BEGIN
  IF nome IS NULL OR length(nome) > 120 THEN
    RAISE EXCEPTION 'he_cadastro_invalido: nome ausente ou longo demais' USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(meta ->> 'aceiteTermos', '') <> 'true' OR versao IS NULL OR length(versao) > 20 THEN
    RAISE EXCEPTION 'he_cadastro_invalido: aceite da política e dos termos ausente' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public."Usuario" (id, nome, email, "consentimentoLgpdEm", "versaoTermosAceita", "termosAceitosEm")
  -- As colunas DateTime do Prisma são timestamp sem fuso, em UTC.
  VALUES (NEW.id, nome, lower(NEW.email), now() AT TIME ZONE 'UTC', versao, now() AT TIME ZONE 'UTC');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.he_criar_usuario() FROM PUBLIC;
