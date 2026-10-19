# Evidências — SPEC-020 (subcategorias e categoria Acessórios)

Verificação em 19/10/2026, em build de produção local: PostgreSQL, Supabase Auth falso e as contas de teste. O caso usado é o da loja de semijoias: subcategorias **Brincos**, **Colares** e **Anéis** em **Acessórios**.

O roteiro automatizado no navegador (Chromium) fez **70 verificações**, todas aprovadas. Capturas nesta pasta.

## Roteiro no navegador (T11)

| Passo | Resultado | Captura |
|---|---|---|
| Catálogo com o atalho "Subcategorias"; tela vazia explica para que servem (Brincos, Colares e Anéis em Acessórios) | ✅ | `s20_01_subcategorias_vazia_1440_claro.png` |
| "Nova subcategoria" na tela, com categoria e nome: Brincos e Colares em Acessórios, com aviso de criação | ✅ | — |
| " brincos " de novo em Acessórios → "Já existe “brincos” em Acessórios." na gaveta (OPEN-002) | ✅ | `s20_02_nome_repetido_1440_claro.png` |
| "Novo item" em Brincos abre o cadastro já com Acessórios e Brincos escolhidos (OPEN-003, complemento da equipe) | ✅ | `s20_03_novo_item_na_subcategoria_1440_claro.png` |
| Acessórios aparece logo depois de Vestuário na lista de categorias (OPEN-001) | ✅ | `s20_03_…` |
| Detalhe do item: "Produto físico, acessórios › brincos" e a linha "Subcategoria: Brincos" | ✅ | `s20_04_detalhe_do_item_1440_escuro.png` |
| Cadastro: subcategoria desabilitada até escolher a categoria; depois lista só as de Acessórios | ✅ | — |
| "+ Nova subcategoria" no cadastro: gaveta com a categoria fixa ("Em Acessórios… a margem sugerida continua a da categoria") | ✅ | `s20_05_gaveta_no_cadastro_1440_claro.png` |
| Ao criar "Anéis", ela já fica escolhida, o resto do formulário continua preenchido e o foco volta ao campo | ✅ | `s20_06_subcategoria_escolhida_390_claro.png` |
| Edição: abre com a subcategoria do item; trocar a categoria volta para "Sem subcategoria" | ✅ | `s20_07_edicao_768_escuro.png` |
| Catálogo: o filtro de subcategoria aparece ao escolher Acessórios, sem recarregar a página; Brincos mostra só os brincos; "Sem subcategoria" mostra só a pulseira | ✅ | `s20_08_catalogo_filtrado_*` (1440 claro, 768 escuro, 390 claro e escuro) |
| Busca "brinc" encontra "Argola prata", que está em Brincos mas não tem "brinco" no nome | ✅ | — |
| Os segmentos de tipo (Todos, Produtos físicos, Serviços) mantêm a subcategoria escolhida | ✅ | — |
| Estoque: o filtro lista só subcategorias com produto ativo (Colares, sem produto, fica fora); linha "Acessórios › Brincos, mínimo…"; busca pela subcategoria; detalhe com a subcategoria no subtítulo | ✅ | `s20_09_estoque_filtrado_*` (1440 escuro, 390 claro) |
| Calculadora: item de Acessórios sugere 8,00% (Lei 9.249/1995, art. 15, 8% comércio, vigente desde 01/01/2018) | ✅ | `s20_14_calculadora_acessorios_1440_claro.png` |
| Renomear "Anéis" para "Anéis e alianças": aviso, e o item passa a mostrar o novo nome | ✅ | `s20_10_subcategorias_*` (1440 claro, 390 escuro) |
| Excluir "Brincos": confirmação "2 itens ficarão sem subcategoria. Preços, estoque e vendas não mudam." (OPEN-004); depois, o item fica "Subcategoria: —" com o mesmo preço | ✅ | `s20_11_confirmar_exclusao_1440_claro.png` |
| Colaborador com a predefinição (Catálogo: ver) vê a lista, sem criar, renomear, excluir nem "Novo item" (OPEN-005) | ✅ | `s20_12_colaborador_1440_claro.png` |
| Modo suporte com o Catálogo liberado: vê a tela, sem nenhum botão de escrita (SPEC-018) | ✅ | `s20_13_modo_suporte_1440_claro.png` |
| Sem rolagem horizontal em todas as capturas (390, 768 e 1440 px, claro e escuro) | ✅ | — |
| axe-core 4.10.2 (WCAG 2.1 A/AA) em 8 estados: tela vazia e com lista (390 escuro), gaveta no cadastro, cadastro com subcategoria, Catálogo e Estoque filtrados no celular, confirmação da exclusão | ✅ nenhuma violação | — |

## Desempenho (SPEC-016, seção 10)

JavaScript comprimido baixado ao abrir cada tela, com o cache desligado (iguais em 1440 e 800 px).

| Tela | Antes da SPEC-020 | Com a SPEC-020 |
|---|---|---|
| /catalogo | 159,6 KB | 163,5 KB (+3,9) |
| /estoque | 159,6 KB | 163,5 KB (+3,9) |
| /catalogo/novo, detalhe e edição do item | 256,9 KB | 258,6 KB (+1,7) |
| /painel | 162,5 KB | 163,3 KB (+0,8) |
| /catalogo/subcategorias (nova) | — | 186,7 KB |

A gaveta "Nova subcategoria" do cadastro só é baixada no primeiro toque no botão. Importada direto, somaria cerca de 19 KB às telas do item.

## Testes automatizados

- `test/unit/subcategorias.test.ts`:
  - T01: nome da subcategoria;
  - T02: subcategoria no item, filtro e busca;
  - T03: lista com Acessórios logo depois de Vestuário, rótulos e margem no arquivo fiscal;
  - T04: a permissão que cada Server Action pede à guarda (criar com criar ou editar, renomear com editar, excluir com excluir).
- `test/integracao/subcategorias.test.ts`:
  - ordem do enum no banco e a coluna nova sem valor padrão (T03, T10);
  - nome único por categoria, inclusive com duas criações simultâneas, e renomear (T05);
  - subcategoria de outra categoria ou de outro negócio recusada no servidor e nos gatilhos do banco (T06);
  - isolamento entre negócios e modo suporte só leitura (T04);
  - exclusão com os itens ativos e arquivados sem subcategoria e o resto igual (T07);
  - filtros e busca no Catálogo e no Estoque (T08);
  - margem de 8% igual com e sem subcategoria (T09);
  - exportação (T10).
- `test/unit/fiscal.test.ts` e `test/integracao/fiscal.test.ts`: contagem das margens atualizada de 9 para 10.

## Pendente

**T12**: fluxo na homologação, depois do merge.
