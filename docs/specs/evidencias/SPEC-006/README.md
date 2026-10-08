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

## T16 / CA-14 — Telas em 390, 768 e 1440 px, claro e escuro (08/10/2026)

Build de produção local (`next build` + `next start`), PostgreSQL local com dados de exemplo e o dublê do Supabase Auth usado na SPEC-005. Roteiro automatizado no Chromium. São 10 telas × 3 larguras × 2 temas = 60 capturas em [`telas/`](telas/), **sem rolagem horizontal em nenhuma combinação**.

| Tela | Arquivos (`telas/<nome>_<largura>_<tema>.png`) |
|---|---|
| Lista (Dono) | `catalogo_lista` |
| Itens arquivados | `catalogo_arquivados` |
| Novo item: escolha do tipo | `catalogo_novo_escolha` |
| Novo produto físico | `catalogo_novo_produto` |
| Novo serviço com material | `catalogo_novo_servico` |
| Detalhe do serviço: preço, materiais, custo total e histórico | `catalogo_detalhe_servico` |
| Editar serviço | `catalogo_editar_servico` |
| Detalhe de item arquivado | `catalogo_detalhe_arquivado` |
| Lista do Colaborador (sem "Novo item") | `catalogo_lista_colaborador` |
| Detalhe do Colaborador (sem editar, preço e arquivar) | `catalogo_detalhe_colaborador` |

O roteiro também confirmou: o Colaborador que abre `/catalogo/novo` cai em "Sem acesso" (CA-12).

## T17 — Fluxo na homologação (08/10/2026)

Feito pela equipe em <https://he-homol.vercel.app>, com o Dono e um Colaborador.

| Passo | Resultado | Captura |
|---|---|---|
| Cadastrar Produto Físico (Esmalte, custo R$ 5,00) → estoque zero, sem preço (CA-01) | ✅ | `homol_produto_cadastrado_1920_{claro,escuro}.png` |
| Serviço com material (Colorir unhas, custo próprio R$ 0,00 informado no teste + 1 Esmalte) → custo total R$ 5,00 (CA-03) | ✅ | `homol_servico_com_material_salvo_1920_{claro,escuro}.png` |
| Arquivar um produto usado como material → aviso com o serviço que o usa; vínculo mantido (CA-10, OPEN-006) | ✅ | `homol_material_arquivado_em_uso_1920_{claro,escuro}.png` |
| Colaborador vê o catálogo sem "Novo item" (CA-12) | ✅ | `homol_catalogo_colaborador_1920_{claro,escuro}.png` |
| Preço abaixo do custo total → aviso; histórico com valor anterior, origem e usuário (CA-06 a CA-08) | ✅ | `homol_servico_preco_abaixo_do_custo_1920_{claro,escuro}.png` |

## Observações da verificação

- **Custo na lista:** a lista do catálogo mostra o custo próprio do item (`custoBase`). No serviço de teste, isso foi R$ 0,00, enquanto o custo total com materiais era R$ 5,00. O detalhe e o aviso de preço abaixo do custo usam o custo total. Ver a proposta de correção no PR de evidências.
- **Nome do material no celular:** em 390 px, no formulário de serviço, o nome do material é cortado (`telas/catalogo_novo_servico_390_*.png`).
