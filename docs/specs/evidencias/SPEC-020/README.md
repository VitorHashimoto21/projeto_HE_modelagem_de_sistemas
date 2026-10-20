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
| Catálogo: o filtro de subcategoria aparece ao escolher Acessórios, sem recarregar a página; Brincos mostra só os brincos; "Sem subcategoria" mostra só a pulseira | ✅ | `s20_08_catalogo_filtrado_*` (1440 claro, 768 escuro, 390 claro e escuro), com o layout dos filtros anterior à correção do T12 |
| Busca "brinc" encontra "Argola prata", que está em Brincos mas não tem "brinco" no nome | ✅ | — |
| Os segmentos de tipo (Todos, Produtos físicos, Serviços) mantêm a subcategoria escolhida | ✅ | — |
| Estoque: o filtro lista só subcategorias com produto ativo (Colares, sem produto, fica fora); linha "Acessórios › Brincos, mínimo…"; busca pela subcategoria; detalhe com a subcategoria no subtítulo | ✅ | `s20_09_estoque_filtrado_*` (1440 escuro, 390 claro), também com o layout anterior |
| Calculadora: item de Acessórios sugere 8,00% (Lei 9.249/1995, art. 15, 8% comércio, vigente desde 01/01/2018) | ✅ | `s20_14_calculadora_acessorios_1440_claro.png` |
| Renomear "Anéis" para "Anéis e alianças": aviso, e o item passa a mostrar o novo nome | ✅ | `s20_10_subcategorias_*` (1440 claro, 390 escuro) |
| Excluir "Brincos": confirmação "2 itens ficarão sem subcategoria. Preços, estoque e vendas não mudam." (OPEN-004); depois, o item fica "Subcategoria: —" com o mesmo preço | ✅ | `s20_11_confirmar_exclusao_1440_claro.png` |
| Colaborador com a predefinição (Catálogo: ver) vê a lista, sem criar, renomear, excluir nem "Novo item" (OPEN-005) | ✅ | `s20_12_colaborador_1440_claro.png` |
| Modo suporte com o Catálogo liberado: vê a tela, sem nenhum botão de escrita (SPEC-018) | ✅ | `s20_13_modo_suporte_1440_claro.png` |
| Sem rolagem horizontal em todas as capturas (390, 768 e 1440 px, claro e escuro) | ✅ | — |
| axe-core 4.10.2 (WCAG 2.1 A/AA) em 8 estados: tela vazia e com lista (390 escuro), gaveta no cadastro, cadastro com subcategoria, Catálogo e Estoque filtrados no celular, confirmação da exclusão | ✅ nenhuma violação | — |

## Homologação (T12) — 20/10/2026

Feita pela equipe em <https://he-homol.vercel.app> (DEVELOP, depois do PR #97 e da migração), com o Dono do negócio **HE Testing**. Capturas em [`homologacao/`](homologacao/); nenhuma mostra e-mail.

| Passo | Resultado | Captura |
|---|---|---|
| Tela Subcategorias com Brincos e Colares em Acessórios, cada uma com "Ver itens", "Novo item", "Renomear" e "Excluir" (CA-03, CA-06) | ✅ | `homol_01_subcategorias_1440_claro.png` |
| "Brincos" de novo em Acessórios → "Já existe “Brincos” em Acessórios." (CA-04) | ✅ | `homol_02_nome_repetido_1440_claro.png` |
| "+ Nova subcategoria" no cadastro de "Anel de Adamantium": gaveta com a categoria fixa e o resto do formulário preenchido (CA-02) | ✅ | `homol_03_nova_subcategoria_no_cadastro_1440_claro.png` |
| Renomear para "Rings": aviso "Subcategoria renomeada para “Rings”." e a contagem de itens mantida (CA-06) | ✅ | `homol_04_renomeada_1440_claro.png` |
| "Novo item" em Brincos: "Brincos de Ouro" cadastrado com "Produto físico, acessórios › brincos" (CA-03) | ✅ | `homol_05_item_criado_na_subcategoria_1440_claro.png` |
| Busca "brinc" com Acessórios e Brincos nos filtros: só "Brincos de Ouro" (CA-08) | ✅ | `homol_06_busca_e_filtros_1440_claro.png` |
| Excluir "Brincos": "1 item ficará sem subcategoria. Preços, estoque e vendas não mudam."; depois, o item fica com "Subcategoria —" e o mesmo preço (CA-07) | ✅ | `homol_07_confirmar_exclusao_1440_claro.png`, `homol_08_item_sem_subcategoria_1440_claro.png` |
| Calculadora com "Anel de Adamantium": margem sugerida de 8,00% (Lei 9.249/1995, art. 15), vigente desde 01/01/2018 (CA-01) | ✅ | `homol_09_calculadora_acessorios_1440_claro.png` |
| Filtros: o texto "Todas as categorias" e "Todas as subcategorias" aparecia cortado dentro dos campos. Corrigido no PR #98 (abaixo) | ❌ → ✅ | `homol_10_filtro_categoria_cortado.png`, `homol_11_filtro_subcategoria_cortado.png` |
| "Voltar" do detalhe: ao abrir um item a partir da lista filtrada (por exemplo, Acessórios › Brincos), o link "Catálogo" levava ao início do Catálogo, sem os filtros. Corrigido no PR #98 (abaixo) | ❌ → ✅ | — |

### Correções da homologação — PR #98 (verificadas em build local, 20/10/2026)

Roteiro no navegador com **47 verificações**, todas aprovadas.

| Correção | Verificação | Captura |
|---|---|---|
| **Filtros em linha própria.** Busca, categoria e subcategoria ficam numa linha abaixo dos segmentos de tipo, e não mais espremidos ao lado deles. Os campos de categoria e subcategoria têm 240 px a partir de 640 px de largura; no celular, ocupam a linha inteira | Em 1440, 1280, 1024, 768 e 390 px, no Catálogo e no Estoque, cada campo é mais largo que o texto "Todas as subcategorias" mais as margens e a seta (~209 px); sem rolagem horizontal | `s20_15_filtros_em_linha_propria_*` (1440 e 390 claro), `s20_16_filtros_do_estoque_*` (1440 escuro, 768 claro) |
| **"Voltar" para a lista de origem.** A lista do Catálogo e a do Estoque mandam o próprio endereço, com os filtros, ao abrir um item. O "voltar" do detalhe leva de volta a ela | Lista Acessórios › Brincos → item → "Catálogo" volta à mesma lista, com o filtro marcado | — |
| O retorno continua depois de **editar e salvar**, **arquivar** e **reativar** o item | Os três casos voltam à lista filtrada | — |
| **Novo item** aberto pela lista filtrada volta para ela. Aberto pela tela Subcategorias, o "voltar", o "Cancelar" e o item criado voltam para Subcategorias | Os três casos | — |
| **Estoque:** o produto aberto pela lista filtrada volta para ela. Entre o Estoque e o Catálogo ("Ver no Catálogo", "Ver estoque"), e do serviço para o material, o link vira "Voltar" e leva à tela anterior | Idas e voltas nos dois sentidos | — |
| **Segurança:** só vale endereço interno do Catálogo ou do Estoque. Endereço externo (`https://…`, `//…`), outra área do app ou `javascript:` é ignorado e o link volta ao início da lista | 4 endereços maliciosos no Catálogo e 1 no Estoque; 24 testes unitários (`test/unit/retorno.test.ts`) | — |

### Conferência das correções na homologação — 20/10/2026

Feita pela equipe em <https://he-homol.vercel.app> depois do merge do PR #98: **as duas correções foram aprovadas**. Capturas em [`homologacao/`](homologacao/).

| Passo | Resultado | Captura |
|---|---|---|
| "Novo item" na subcategoria Rings, pela tela Subcategorias: "Anel de Plástico" cadastrado ("Produto físico, acessórios › rings") e o link do topo é "Subcategorias", que leva de volta a essa tela | ✅ | `homol_12_voltar_para_subcategorias_1440_claro.webp` |
| Catálogo: busca e filtros na linha abaixo de "Todos / Produtos físicos / Serviços"; "Todas as categorias" inteiro | ✅ | `homol_13_filtros_catalogo_1440_claro.webp` |
| Catálogo com Acessórios escolhido (antes de tocar em "Filtrar"): o filtro de subcategoria aparece com "Todas as subcategorias" inteiro | ✅ | `homol_14_filtros_catalogo_acessorios_1440_claro.webp` |
| Estoque: o mesmo layout, com "Todas as categorias" inteiro | ✅ | `homol_15_filtros_estoque_1440_claro.webp` |
| Estoque com Acessórios escolhido: "Todas as subcategorias" inteiro | ✅ | `homol_16_filtros_estoque_acessorios_1440_claro.webp` |

## Desempenho (SPEC-016, seção 10)

JavaScript comprimido baixado ao abrir cada tela, com o cache desligado (iguais em 1440 e 800 px).

| Tela | Antes da SPEC-020 | Com a SPEC-020 | Com a correção do T12 |
|---|---|---|---|
| /catalogo | 159,6 KB | 163,5 KB (+3,9) | 163,5 KB |
| /estoque | 159,6 KB | 163,5 KB (+3,9) | 163,5 KB |
| /catalogo/novo, detalhe e edição do item | 256,9 KB | 258,6 KB (+1,7) | 258,7 KB (+0,1) |
| /painel | 162,5 KB | 163,3 KB (+0,8) | 163,3 KB |
| /catalogo/subcategorias (nova) | — | 186,7 KB | 186,8 KB (+0,1) |

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
- `test/unit/retorno.test.ts` (correção do T12): endereços de retorno aceitos e recusados, o parâmetro `voltar` nos links e o texto do "voltar" conforme o destino.

## Pendente

Nada. A SPEC-020 foi concluída em 20/10/2026.
