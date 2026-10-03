-- SPEC-001 — Isolamento multi-tenant no banco (ADR-002, OPEN-12, OPEN-13).
-- O Prisma não gerencia gatilhos nem RLS: esta migração é escrita à mão.
-- Toda migração futura que criar tabela deve ligar o RLS nela (teste INV-011)
-- e, se a tabela for operacional e tiver FK para outra operacional, criar o gatilho
-- he_mesmo_negocio (teste INV-005 compara a lista com o schema).

-- 1) Ligações entre registros operacionais só dentro do mesmo negócio (INV-005).
--    Argumentos do gatilho: pares (tabela de destino, coluna FK).
CREATE OR REPLACE FUNCTION he_verificar_mesmo_negocio() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  i integer;
  tabela text;
  coluna text;
  referencia uuid;
  negocio_destino uuid;
BEGIN
  FOR i IN 0 .. (TG_NARGS / 2) - 1 LOOP
    tabela := TG_ARGV[i * 2];
    coluna := TG_ARGV[i * 2 + 1];
    referencia := (to_jsonb(NEW) ->> coluna)::uuid;
    IF referencia IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT "negocioId" FROM %I WHERE id = $1', tabela) INTO negocio_destino USING referencia;
    -- Destino inexistente: a chave estrangeira recusa a operação com o erro próprio.
    IF negocio_destino IS NOT NULL AND negocio_destino IS DISTINCT FROM NEW."negocioId" THEN
      RAISE EXCEPTION 'he_negocio_divergente: %.% aponta para um registro de outro negócio', TG_TABLE_NAME, coluna;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "MaterialServico"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Item', 'servicoId', 'Item', 'materialId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "MovimentacaoEstoque"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Item', 'itemId', 'Venda', 'vendaId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "HistoricoPreco"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Item', 'itemId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "Venda"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Cliente', 'clienteId', 'Venda', 'vendaOrigemId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "ItemVenda"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Venda', 'vendaId', 'Item', 'itemId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "Pagamento"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Venda', 'vendaId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "Parcela"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Pagamento', 'pagamentoId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "LancamentoFinanceiro"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Venda', 'vendaId', 'ContaPagarReceber', 'contaId');
CREATE TRIGGER he_mesmo_negocio BEFORE INSERT OR UPDATE ON "ContaPagarReceber"
  FOR EACH ROW EXECUTE FUNCTION he_verificar_mesmo_negocio('Parcela', 'parcelaId', 'DespesaFixa', 'despesaFixaId');

-- 2) O negocioId de um registro operacional nunca muda.
CREATE OR REPLACE FUNCTION he_negocio_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."negocioId" IS DISTINCT FROM OLD."negocioId" THEN
    RAISE EXCEPTION 'he_negocio_imutavel: o negocioId de % não pode ser alterado', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'MembroNegocio', 'Convite', 'Cliente', 'Item', 'MaterialServico', 'MovimentacaoEstoque',
    'HistoricoPreco', 'DespesaFixa', 'Venda', 'ItemVenda', 'Pagamento', 'Parcela',
    'LancamentoFinanceiro', 'ContaPagarReceber'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER he_negocio_imutavel BEFORE UPDATE OF "negocioId" ON %I FOR EACH ROW EXECUTE FUNCTION he_negocio_imutavel()',
      tabela
    );
  END LOOP;
END;
$$;

-- 3) RLS ligado em todas as tabelas do schema public, sem nenhuma policy (OPEN-13):
--    a API REST automática do Supabase (chave pública) não lê nem grava nada;
--    o Prisma conecta com o papel dono das tabelas e segue funcionando.
DO $$
DECLARE
  tabela record;
BEGIN
  FOR tabela IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela.tablename);
  END LOOP;
END;
$$;
