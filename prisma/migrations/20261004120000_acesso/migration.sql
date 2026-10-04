-- SPEC-002 — Acesso: versão dos termos aceita (OPEN-005) e criação do Usuario
-- pelo gatilho em auth.users (OPEN-001). O Prisma não gerencia funções nem
-- gatilhos: a parte depois do ALTER TABLE é escrita à mão.

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "versaoTermosAceita" TEXT;

-- 1) Fora do Supabase (desenvolvimento local, CI, testes e banco de sombra) não existe
--    o schema auth. Cria um substituto mínimo, com as colunas que o gatilho usa.
--    No Supabase a tabela já existe e nada é criado.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id                 uuid PRIMARY KEY,
      email              text,
      raw_user_meta_data jsonb,
      email_confirmed_at timestamptz,
      created_at         timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

-- 2) Cria o Usuario na mesma transação da conta (INV-002): se o gatilho falhar,
--    a conta também não é criada. Sem nome ou sem aceite dos termos, recusa (INV-003).
--    A data do consentimento é a do servidor do banco, não um valor enviado pelo cliente.
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

  INSERT INTO public."Usuario" (id, nome, email, "consentimentoLgpdEm", "versaoTermosAceita")
  -- As colunas DateTime do Prisma são timestamp sem fuso, em UTC.
  VALUES (NEW.id, nome, lower(NEW.email), now() AT TIME ZONE 'UTC', versao);
  RETURN NEW;
END;
$$;

-- 3) Mantém o e-mail do Usuario igual ao da conta, se ele mudar no Supabase Auth.
CREATE OR REPLACE FUNCTION public.he_sincronizar_email_usuario() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public."Usuario" SET email = lower(NEW.email) WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Funções de gatilho não devem ser chamadas pela API pública.
REVOKE ALL ON FUNCTION public.he_criar_usuario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.he_sincronizar_email_usuario() FROM PUBLIC;

DROP TRIGGER IF EXISTS he_criar_usuario ON auth.users;
CREATE TRIGGER he_criar_usuario AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.he_criar_usuario();

DROP TRIGGER IF EXISTS he_sincronizar_email_usuario ON auth.users;
CREATE TRIGGER he_sincronizar_email_usuario AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.he_sincronizar_email_usuario();
