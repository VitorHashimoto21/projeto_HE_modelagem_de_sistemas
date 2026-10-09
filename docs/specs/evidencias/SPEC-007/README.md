# SPEC-007 — Evidências (09/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/estoque.test.ts`: validação (13 casos de recusa), vírgula, 90 dias, motivo, "Outro" com observação, mínimo e dias de cobertura | CA-03, CA-14 |
| T02, T03 | idem: consumo, ⌈⌉, estornos, janela de 90 dias, primeiro dia; mínimo em vigor e situações | CA-07 a CA-10, INV-007 |
| T04, T05 | `test/integracao/estoque.test.ts`: entrada e saída manual com motivo e observação | CA-01 a CA-03, INV-006 |
| T06 | idem: saída maior que o saldo; **8 saídas simultâneas** de 6 com saldo 10 → só 1 gravada, saldo 4 | CA-04, INV-002 |
| T07 | idem: cadeia de saldos após sequência e após 12 movimentações simultâneas | CA-06, INV-003 |
| T08 | idem: falha depois do UPDATE do saldo desfaz tudo | INV-001 |
| T09 | idem: `UPDATE`/`DELETE` em movimentações, saldo negativo, motivo fora da saída manual e quantidade 0 recusados pelo banco | CA-05, INV-002, INV-004, INV-006 |
| T10 | idem: Serviço, arquivado, outro negócio e id inválido recusados; Serviço fora da lista | CA-12, INV-005 |
| T11, T12 | idem: sugestão a partir de movimentações reais, mínimo manual (antes do ciclo também), filtros, contagem, dias de cobertura | CA-07 a CA-11 |
| T13 | `test/unit/estoque.test.ts`: cada ação exige a permissão certa; dias de cobertura só pelo Dono; Colaborador predefinido; menu | CA-13, INV-008 |
| T14 | `test/integracao/estoque.test.ts`: data retroativa no consumo e na ordem de registro | CA-14 |
| T15 | idem: 500 produtos e 10.000 movimentações em menos de 2 s | RNF06 |
| — | `test/integracao/catalogo.test.ts`: editar no Catálogo não apaga o mínimo manual | OPEN-001 |

## Build de produção local com login (T16)

`next build` + `next start`, PostgreSQL local com dados de exemplo e um dublê do Supabase Auth (login por senha e `/auth/v1/user`). Roteiro automatizado no navegador, **29 verificações, todas OK, sem erro no log do servidor**:

- login, escolha do negócio, Painel com "3 produtos com estoque baixo";
- `/estoque` (200): Serviço fora da lista; situações baixo, sem estoque e mínimo manual antes do ciclo; filtro "Sem estoque";
- `/estoque/[id]` (200): "Sugerido: 8 = consumo de 32 em 30 dias × 7 dias de cobertura"; observação da movimentação;
- entrada pelo formulário (saldo 13); saída maior que o saldo recusada; "Outro" sem observação recusado; mínimo manual 20 em uso;
- `/catalogo/[id]` mostra a situação do estoque; edição do Catálogo sem o campo de mínimo; "Dados do negócio" com os dias de cobertura;
- lista e detalhe em 390, 768 e 1440 px, claro e escuro, **sem rolagem horizontal** — capturas em [`telas/`](telas/).

## Pendente

- **T17:** fluxo completo na homologação, depois do merge (a migração `20261009120000_estoque` roda no workflow **Migrações**).
