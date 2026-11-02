-- SPEC-019, etapa 2 (correções do suporte e desfazer pelo Dono). Só acrescenta: as liberações que já
-- existem ficam só de leitura (modulosComCorrecao vazio) e nenhum registro antigo muda.

-- AlterEnum
ALTER TYPE "EventoSuporte" ADD VALUE 'CORRECAO';
ALTER TYPE "EventoSuporte" ADD VALUE 'CORRECAO_DESFEITA';

-- AlterTable
ALTER TABLE "AcessoSuporte" ADD COLUMN     "modulosComCorrecao" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RegistroSuporte" ADD COLUMN     "correcaoId" UUID,
ADD COLUMN     "dados" JSONB;

-- AddForeignKey
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_correcaoId_fkey" FOREIGN KEY ("correcaoId") REFERENCES "RegistroSuporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OPEN-004: "ver e corrigir" só nos módulos liberados que têm correções, e o prazo com correção é de até 12 h.
ALTER TABLE "AcessoSuporte" ADD CONSTRAINT "AcessoSuporte_modulos_com_correcao" CHECK (
  "modulosComCorrecao" IS NOT NULL
  AND "modulosComCorrecao" <@ "modulos"
  AND "modulosComCorrecao" <@ ARRAY['catalogo', 'estoque', 'calculadora', 'financeiro']::text[]
  AND (cardinality("modulosComCorrecao") = 0 OR "expiraEm" - "criadoEm" <= interval '12 hours')
);

-- INV-004: a correção sempre guarda o antes e o depois e pertence a uma liberação; o desfazer aponta a
-- correção, no máximo uma vez (INV-005). Comparação em texto: os valores novos do enum não podem ser
-- usados na mesma transação em que foram criados.
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_dados_da_correcao" CHECK (
  "evento"::text <> 'CORRECAO' OR ("dados" IS NOT NULL AND "acessoId" IS NOT NULL AND "negocioId" IS NOT NULL)
);
ALTER TABLE "RegistroSuporte" ADD CONSTRAINT "RegistroSuporte_desfazer_aponta_correcao" CHECK (
  ("evento"::text = 'CORRECAO_DESFEITA') = ("correcaoId" IS NOT NULL)
);
CREATE UNIQUE INDEX "RegistroSuporte_correcao_desfeita_uma_vez" ON "RegistroSuporte"("correcaoId") WHERE "correcaoId" IS NOT NULL;

-- Isolamento (SPEC-001): o registro aponta uma liberação e o desfazer uma correção, ambas do mesmo negócio.
DROP TRIGGER he_mesmo_negocio ON "RegistroSuporte";
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "RegistroSuporte"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('AcessoSuporte', 'acessoId', 'RegistroSuporte', 'correcaoId');
