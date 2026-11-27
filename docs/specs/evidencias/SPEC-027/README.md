# Evidências — SPEC-027 (Compras de fornecedores integradas ao estoque e ao financeiro)

A SPEC-027 é implementada em etapas (seção 14 da Spec). Cada etapa registra aqui o que foi verificado. As etapas 1a (o banco) e 1b (regras e gravação) não mudaram telas; os testes delas estão nos PRs #154 e #155.

## Etapa 1c — tela "Registrar compra" (26/11/2026)

Verificação em build de produção local (`next build` + `next start`), com Postgres e um Supabase Auth falso. Negócio de teste **HE Testing**, com dados fictícios: a fornecedora "Embalagens Exemplo Ltda", a Embalagem P (20 em estoque, custo R$ 1,00) e a Embalagem G (sem estoque, custo R$ 2,00), como no exemplo da seção 1 da Spec.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| CA-13 (parte) | Quem pode registrar: Estoque — criar e Financeiro — criar; o Colaborador padrão e o suporte não | `test/unit/compras.test.ts` | ✅ |
| T02 (parte) | Fluxo da tela: revisar devolve o resumo sem gravar; confirmar grava e diz quais custos mudaram | `test/integracao/compras.test.ts` | ✅ |
| CA-06, CA-14 (parte) | Mensagens da tela: compra ilegível, fornecedor, documento repetido e produto indisponível | idem | ✅ |
| OPEN-003 | Produtos da tela: só os físicos ativos, com o saldo e o custo | idem | ✅ |

**Suíte completa:** 746 testes unitários e 465 de integração, além de lint e tipos.

### Roteiro no navegador

50 verificações, todas aprovadas:
- **atalho:** o botão "Registrar compra" aparece no topo do Estoque para o Dono e abre a tela;
- **preenchimento:** a fornecedora, o nº 1234, a Embalagem P pela busca do nome e a G pelo código exato com Enter. Adicionar a P de novo leva à linha que já existe, sem repetir o produto. O total fica em R$ 220,00, a prazo em 1 parcela com o vencimento trocado para 28 dias;
- **resumo:** "+100 Embalagem P", com "Saldo: 20 → 120", e os três custos: médio R$ 1,17 (marcado), desta compra R$ 1,20 e atual R$ 1,00. A Embalagem G, sem saldo, mostra um só custo. A conta a pagar é de R$ 220,00. Revisar não grava nada e leva o foco ao resumo. Mudar um campo tira o resumo da tela até revisar de novo; voltando ao valor revisado, o resumo volta, sem tirar o foco do campo;
- **confirmação:** "Compra nº 1 registrada.", com "O custo de Embalagem P mudou. Revise o preço na Calculadora." e o link para a Calculadora do item. No banco: o estoque da P foi de 20 para 120 e o da G de 0 para 50, o custo da P passou a R$ 1,17, nasceu uma conta a pagar de R$ 220,00 ligada à compra, e o caixa não mudou;
- **Financeiro:** o filtro de origem "Compra" encontra a conta. O detalhe não tem editar, cancelar nem corrigir, e o "Registrar pagamento" continua lá;
- **documento repetido e sem nota:** o mesmo nº (com espaços) é recusado com a mensagem da seção 5.11. Marcando "Compra sem nota fiscal", à vista, a compra nº 2 é gravada sem o nº, com a conta vencendo na data da compra. "Registrar outra compra" começa do zero;
- **permissão:** um membro com Estoque — criar e sem Financeiro — criar não vê o botão no Estoque, e a tela leva a "Sem acesso";
- **telas** em 1440, 768 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações na tela vazia e com o resumo.

| Captura | O que mostra |
|---|---|
| [`s27c_01_estoque_1440_claro.png`](s27c_01_estoque_1440_claro.png) | O atalho "Registrar compra" no topo do Estoque |
| [`s27c_02_preenchida_390_claro.png`](s27c_02_preenchida_390_claro.png) | A compra preenchida no celular |
| [`s27c_03_resumo_1440_claro.png`](s27c_03_resumo_1440_claro.png) | O resumo com o saldo novo, os três custos e a conta a pagar |
| [`s27c_03_resumo_1440_escuro.png`](s27c_03_resumo_1440_escuro.png) | O mesmo resumo no tema escuro |
| [`s27c_03_resumo_390_claro.png`](s27c_03_resumo_390_claro.png) | O resumo no celular |
| [`s27c_04_registrada_1440_claro.png`](s27c_04_registrada_1440_claro.png) | "Compra nº 1 registrada." com o aviso do custo |
| [`s27c_04_registrada_390_escuro.png`](s27c_04_registrada_390_escuro.png) | A mesma confirmação no celular, tema escuro |
| [`s27c_05_contas_1440_claro.png`](s27c_05_contas_1440_claro.png) | A conta da compra no filtro de origem "Compra" |
| [`s27c_06_repetido_1440_claro.png`](s27c_06_repetido_1440_claro.png) | O documento repetido recusado |

## Etapa 1d — "Novo produto" sem sair da compra (26/11/2026)

Mesmo ambiente da etapa 1c.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| OPEN-003 | O produto novo é sempre físico, com o custo da linha, sem estoque e sem preço, com o início do histórico de custo; o resto do formulário é ignorado | `test/integracao/compras.test.ts` | ✅ |
| OPEN-003 | As regras do Catálogo valem: nome e código únicos, NCM obrigatório quando o negócio emite nota | idem | ✅ |

### Roteiro no navegador

21 verificações, todas aprovadas:
- **cadastro:** a busca por "Fita adesiva" não acha nada, e "Novo produto" abre o cadastro já com esse nome. Sem a categoria e o custo, aparecem as mensagens do Catálogo, que somem quando o campo é corrigido. Com a categoria, o custo de R$ 3,50 e o código "fita-1", "Cadastrar e adicionar" grava o produto (físico, custo R$ 3,50, código FITA-1, sem estoque), fecha o cadastro e adiciona a linha com o custo informado;
- **compra:** com 10 unidades, o resumo mostra "Saldo: 0 → 10" e um só custo (R$ 3,50). Depois de confirmar, o estoque da Fita adesiva é 10;
- **permissão:** um membro com Estoque e Financeiro — criar, mas sem Catálogo — criar, registra compras sem o botão "Novo produto";
- **telas** em 1440 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações com o cadastro aberto.

| Captura | O que mostra |
|---|---|
| [`s27d_01_novo_produto_1440_claro.png`](s27d_01_novo_produto_1440_claro.png) | O cadastro do produto novo dentro da compra |
| [`s27d_01_novo_produto_390_escuro.png`](s27d_01_novo_produto_390_escuro.png) | O mesmo cadastro no celular, tema escuro |
| [`s27d_02_linha_do_produto_novo_1440_claro.png`](s27d_02_linha_do_produto_novo_1440_claro.png) | O produto novo na compra, com o custo informado |


## Homologação da etapa 1 (27/11/2026)

Feita pela equipe em <https://he-homol.vercel.app> (DEVELOP, depois do merge dos PRs #154 a #157), com o Dono do negócio de teste que a equipe criou para apresentar o sistema ao professor, um salão de beleza fictício. É uma homologação parcial: a homologação completa (T14) fica para depois da etapa 4. As capturas estão em [`homologacao/`](homologacao). Os nomes das pessoas da equipe do negócio e o nome do fornecedor foram cobertos. O nome do negócio ficou visível, porque o negócio é de teste e não tem dado pessoal. Nas capturas de página inteira, o menu lateral aparece fora do lugar: é um efeito da ferramenta de captura, porque o menu fica fixo na tela.

| Passo | Resultado | Captura |
|---|---|---|
| Antes da compra: Máscara de Hidratação 250 g com 9 unidades | ✅ | [`t14e1_01_estoque_antes.png`](homologacao/t14e1_01_estoque_antes.png) |
| Compra nº 1 preenchida: fornecedor, nº 1234, 2 Máscaras a R$ 20,00 e o Condicionador, criado pelo "Novo produto" com R$ 45,00; a prazo, 1 parcela em 27/12/2026; total de R$ 85,00 | ✅ | [`t14e1_02_compra_preenchida.png`](homologacao/t14e1_02_compra_preenchida.png) |
| Resumo: "+2 Máscara", saldo 9 → 11, com os três custos (médio R$ 21,64, marcado; desta compra R$ 20,00; atual R$ 22,00). O Condicionador mostra saldo 0 → 1 e um só custo. A parcela de R$ 85,00 vence em 27/12/2026, e o aviso diz que o caixa não muda agora | ✅ | [`t14e1_03_resumo_custo_medio.png`](homologacao/t14e1_03_resumo_custo_medio.png) |
| A equipe escolheu o custo desta compra (R$ 20,00) para a Máscara | ✅ | [`t14e1_04_resumo_custo_desta_compra.png`](homologacao/t14e1_04_resumo_custo_desta_compra.png) |
| "Compra nº 1 registrada.", com o aviso de que o custo da Máscara mudou e o link da Calculadora | ✅ | [`t14e1_05_compra_registrada.png`](homologacao/t14e1_05_compra_registrada.png) |
| Calculadora da Máscara com o custo novo de R$ 20,00 | ✅ | [`t14e1_06_calculadora_custo_novo.png`](homologacao/t14e1_06_calculadora_custo_novo.png) |
| O mesmo fornecedor com o documento 1234 de novo: recusado, com a mensagem no aviso e no campo | ✅ | [`t14e1_07_documento_repetido.png`](homologacao/t14e1_07_documento_repetido.png) |
| Depois da compra: Máscara com 11 unidades; o Condicionador (código CONPHIL) com 1 | ✅ | [`t14e1_08_estoque_depois.png`](homologacao/t14e1_08_estoque_depois.png) |
| Contas a pagar com a origem "Compra": "Compra nº 1 — parcela 1/1", R$ 85,00, vence em 27/12/2026, com o fornecedor e o Doc. 1234 | ✅ | [`t14e1_09_conta_a_pagar_da_compra.png`](homologacao/t14e1_09_conta_a_pagar_da_compra.png) |
| O caixa não mudou com a compra a prazo: saldo de R$ 749,50, sem lançamento da compra | ✅ | [`t14e1_10_caixa_sem_mudanca.png`](homologacao/t14e1_10_caixa_sem_mudanca.png) |
| Compra nº 2, à vista, paga no Financeiro: o lançamento "Compra nº 2 — à vista" de −R$ 135,00 em 27/11/2026 leva o saldo de R$ 749,50 a R$ 614,50 | ✅ | [`t14e1_11_compra_a_vista_paga.png`](homologacao/t14e1_11_compra_a_vista_paga.png) |

Sem divergência com a Spec. A mensagem do documento repetido aparece no aviso do topo e no campo, como os erros de campo da Nova venda. O campo de data segue o idioma do navegador, como os outros campos de data do HE (decisão da equipe na SPEC-025).

## Etapa 2a — lista de compras (27/11/2026)

Verificação em build de produção local (`next build` + `next start`), com Postgres e um Supabase Auth falso. Negócio de teste **HE Testing**, com dados fictícios: as fornecedoras "Embalagens Exemplo Ltda" e "Papelaria Ficticia ME" e cinco compras gravadas direto no banco:
- a nº 1, a prazo, com uma das duas contas paga;
- a nº 2, à vista e paga;
- a nº 3, sem nota e a pagar;
- a nº 4, cancelada;
- a nº 5, a prazo em 3 parcelas, a pagar.

A Joana ficou com as permissões padrão do Colaborador.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T05, CA-10 | Fornecedor e período filtrados; total de todas as páginas, sem as canceladas; mais recentes primeiro | `test/integracao/lista-de-compras.test.ts` | ✅ |
| T05 | Busca pelo nome (ou nome fantasia) do fornecedor, pelo nº do documento e pelo nº da compra | idem | ✅ |
| T05 | Situação das contas: a pagar, paga em parte e paga; a cancelada sem situação | idem | ✅ |
| T05 | Várias páginas (100 por página) e a página fora do intervalo | idem | ✅ |
| T05, CA-10 | Plano gratuito: compras anteriores ao histórico fora, com o aviso | idem | ✅ |
| 5.9 | Modo suporte: o nome do fornecedor mascarado e fora da busca | idem | ✅ |
| INV-010 | As compras de outro negócio ficam fora | idem | ✅ |
| CA-13, OPEN-007, OPEN-008 | Quem vê as compras; "Compras" logo abaixo de "Vendas" no menu; no suporte, só com o Estoque e o Financeiro liberados | `test/unit/lista-de-compras.test.ts` | ✅ |
| 5.6 | Filtros do endereço, nº da compra na busca e a situação das contas | idem | ✅ |

**Suíte completa:** 756 testes unitários e 475 de integração, além de lint e tipos.

### Roteiro no navegador

38 verificações, todas aprovadas:
- **menu:** "Compras" aparece logo abaixo de "Vendas" para o Dono e, no celular, no "Mais";
- **lista:** as cinco compras, das mais recentes para as mais antigas, com a data, a fornecedora, o "Doc. 1001" ou o "Sem nota", a condição com a situação das contas e a cancelada riscada. Os totais mostram 4 compras e R$ 750,00, com o aviso da cancelada fora dos totais;
- **filtros (CA-10):** a Embalagens Exemplo em outubro mostra as compras nº 2 e nº 1, com R$ 370,00. A busca acha pelo nome da fornecedora, pelo nº do documento ("a-77") e pelo nº da compra ("nº 4"). O botão "Canceladas" mantém a busca e mostra só a nº 4, que não soma. O período invertido mostra a mensagem e não filtra. Sem resultado, a tela oferece "Limpar filtros";
- **atalho:** "Registrar compra" no topo abre a tela de registrar;
- **permissão (CA-13):** a Colaboradora padrão não vê "Compras" no menu, e `/compras` leva a "Sem acesso";
- **plano gratuito:** com uma compra de junho de 2025, a lista mostra o aviso do plano, esconde essa compra e não a soma;
- **telas** em 1440, 768 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações.

| Captura | O que mostra |
|---|---|
| [`s27e_01_lista_1440_claro.png`](s27e_01_lista_1440_claro.png) | A lista com as cinco compras, os totais e o item "Compras" no menu |
| [`s27e_01_lista_1440_escuro.png`](s27e_01_lista_1440_escuro.png) | A mesma lista no tema escuro |
| [`s27e_01_lista_390_escuro.png`](s27e_01_lista_390_escuro.png) | A lista no celular, tema escuro |
| [`s27e_02_filtrada_1440_claro.png`](s27e_02_filtrada_1440_claro.png) | A Embalagens Exemplo em outubro, com o total do filtro |
| [`s27e_03_sem_resultado_390_claro.png`](s27e_03_sem_resultado_390_claro.png) | Nenhuma compra com a busca, no celular |
| [`s27e_04_plano_gratuito_1440_claro.png`](s27e_04_plano_gratuito_1440_claro.png) | O aviso do plano gratuito, sem a compra antiga |
