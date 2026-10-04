# SPEC-003 — Evidências (04/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01, T02 | `test/unit/fiscal.test.ts`: arquivo conferido válido; 13 tipos de erro recusados com a mensagem certa | INV-002, INV-003, INV-007, INV-008, CA-04 |
| T03 | `test/unit/fiscal.test.ts`: `aliquotaEfetiva` (Anexo III, faixa 2, R$ 240 mil → 7,30%) e fronteiras | CA-08, INV-003 |
| T04 | `test/unit/fiscal.test.ts`: CNAE em 5 formatos | CA-09 |
| T05–T09 | `test/integracao/fiscal.test.ts`: carga inicial, idempotência, nova vigência, conflito e `--corrigir`, falha no meio desfeita | CA-01, CA-02, CA-03, CA-05, CA-06, INV-004, INV-005 |
| T10, T11 | `test/integracao/fiscal.test.ts`: faixa nas fronteiras, RBT12 inválido e acima do teto; CNAE, MEI, Fator R e margens | CA-07, CA-09 |
| T12, T13 | `test/unit/fiscal.test.ts`: nenhum valor do seed fixo em `src/`; nenhuma escrita nas tabelas fiscais em `src/` | INV-001, INV-006 |
| CA-11 | `.github/workflows/ci.yml`: carga num PostgreSQL descartável, rodada duas vezes (a segunda tem que ser "Nada a mudar") | CA-11, INV-005 |

## Carga no banco local de desenvolvimento

```
1ª carga — Carga concluída: faixaTributaria 30 criados · cnaeAnexo 12 · parametroMei 3 · parametroFatorR 1 · margemPadraoCategoria 9
2ª carga — Nada a mudar: todos inalterados
```

## Pendente — verificação na homologação (T14, CA-10)

Depois do merge na `DEVELOP`: o workflow **Migrações** aplica `20261004130000_parametros_fiscais` e, em seguida, a carga; o resumo deve aparecer no log, e o backup diário seguinte deve trazer as tabelas fiscais preenchidas (RNF09).
