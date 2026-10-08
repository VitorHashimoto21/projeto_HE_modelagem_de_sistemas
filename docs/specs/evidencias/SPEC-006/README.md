# SPEC-006 — Evidências (07/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/catalogo.test.ts`: validação (16 casos de recusa), valores em reais com vírgula, edição sem tipo nem preço, preço manual | CA-05, INV-002 |
| T02, T03 | `test/unit/catalogo.test.ts`: custo total do serviço, preço abaixo do custo, normalização do nome | CA-03, CA-07, INV-008 |
| T04–T05 | `test/integracao/catalogo.test.ts`: produto com estoque zero, com e sem preço; serviço com materiais e custo total | CA-01, CA-02, CA-03, INV-001, INV-004 |
| T06 | idem: materiais inválidos (serviço, outro negócio, arquivado, inexistente, repetido, ele mesmo) | CA-04, INV-003 |
| T07 | idem: nome duplicado ao criar, editar e reativar; mesmo nome em outro negócio permitido | CA-05, INV-008 |
| T08–T10 | idem: histórico com anterior, origem e usuário; preço igual recusado; falha desfaz tudo; `UPDATE`/`DELETE` no histórico recusados pelo banco | CA-06, CA-08, CA-09, INV-004 a INV-006 |
| T11, T12 | idem: arquivar material em uso (aviso, vínculo mantido, some das escolhas), reativar; tipo imutável | CA-10, CA-11 |
| T13 | `test/unit/catalogo.test.ts`: cada ação exige a permissão certa do Catálogo; Colaborador predefinido só vê; menu | CA-12, INV-007 |
| T14 | `test/integracao/catalogo.test.ts`: item de outro negócio é "não encontrado" em toda operação | CA-13 |
| T15 | idem: lista com 500 itens em menos de 2 s | RNF06 |

## Pendente

- **T16 / CA-14:** capturas das telas em 390, 768 e 1440 px, claro e escuro.
- **T17:** fluxo completo na homologação, depois do merge (a migração `20261007120000_catalogo` roda no workflow **Migrações**).
