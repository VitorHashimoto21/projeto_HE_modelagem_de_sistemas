#!/usr/bin/env bash
# Restaura um dump num PostgreSQL vazio e confere se tudo voltou (SPEC-001, CA-14).
# Uso: verificar-backup.sh <arquivo.dump>   (conexão pelas variáveis PGHOST, PGUSER, PGPASSWORD, PGDATABASE)
set -euo pipefail

arquivo="$1"

# O dump recria o schema public; o banco novo já tem um, então ele é removido antes.
psql -q -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE'
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$PGDATABASE" "$arquivo"

esperadas=$(pg_restore --list "$arquivo" | grep -c ' TABLE public ' || true)
restauradas=$(psql -tA -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
sem_rls=$(psql -tA -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity")
migracoes=$(psql -tA -c 'SELECT count(*) FROM "_prisma_migrations"')

echo "Tabelas no dump: $esperadas | restauradas: $restauradas | sem RLS: $sem_rls | migrações registradas: $migracoes"

if [ "$esperadas" -eq 0 ] || [ "$restauradas" -ne "$esperadas" ] || [ "$migracoes" -eq 0 ] || [ "$sem_rls" -ne 0 ]; then
  echo "::error::Restauração do backup incompleta ou sem RLS."
  exit 1
fi
echo "Restauração verificada com sucesso."
