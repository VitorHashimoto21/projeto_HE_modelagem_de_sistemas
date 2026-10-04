# SPEC-001 — Evidências na homologação (03/10/2026)

Projeto Supabase de homologação (`he-homol`, região São Paulo), com as migrações `init` e `isolamento` aplicadas pelo workflow **Migrações**.

## T18 / CA-14 — Backup e restauração

Workflow **Backup diário** ([execução 37170336584](https://github.com/VitorHashimoto21/projeto_HE_modelagem_de_sistemas/actions/runs/37170336584)): `pg_dump` do schema `public` pelo Session pooler, restauração num PostgreSQL 17 vazio (`scripts/verificar-backup.sh`) e artefato privado guardado por 90 dias.

```
Tabelas no dump: 22 | restauradas: 22 | sem RLS: 0 | migrações registradas: 2
Restauração verificada com sucesso.
```

## T17 / CA-15 — API pública bloqueada

Chamadas à API REST do Supabase (`/rest/v1`) com a chave pública (Publishable key), sem sessão de usuário:

| Operação | Alvo | Resultado |
|---|---|---|
| `GET ?select=*` | as 21 tabelas da aplicação e `_prisma_migrations` | `200`, 0 linhas em todas |
| `POST` | `Negocio`, `FaixaTributaria` | `401` — `42501 new row violates row-level security policy` |
| `PATCH ?id=not.is.null` | `Negocio`, `FaixaTributaria` | `200`, 0 linhas alteradas |
| `DELETE ?id=not.is.null` | `Negocio`, `FaixaTributaria` | `200`, 0 linhas apagadas |

A tabela `_prisma_migrations` tem 2 linhas (confirmado pelo backup acima) e a API devolveu 0: o bloqueio vem do RLS sem policies (INV-011), não de tabelas vazias.
