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

## Homologação da etapa 2a (28/11/2026)

Feita pela equipe em <https://he-homol.vercel.app> (DEVELOP, depois do merge do PR #159), com o Dono do negócio de teste criado para a apresentação do sistema e as compras nº 1 e nº 2 registradas na homologação da etapa 1. As capturas estão em [`homologacao/`](homologacao). Os nomes do Dono e do fornecedor foram cobertos; o nome do negócio ficou visível, porque o negócio é de teste.

| Passo | Resultado | Captura |
|---|---|---|
| A lista com as duas compras, das mais recentes para as mais antigas: a nº 2, sem nota, à vista e paga (R$ 135,00), e a nº 1, Doc. 1234, a prazo e a pagar (R$ 85,00). Os totais: 2 compras, R$ 220,00 | ✅ | [`t14e2a_01_lista.png`](homologacao/t14e2a_01_lista.png) |
| Busca "1234" com o fornecedor e a data inicial: só a compra nº 1, com "1 Compra" e R$ 85,00 | ✅ | [`t14e2a_02_filtrada.png`](homologacao/t14e2a_02_filtrada.png) |
| "Canceladas": nenhuma compra cancelada, totais zerados e "Escolha outra situação acima." | ✅, com o defeito abaixo | [`t14e2a_03_canceladas.png`](homologacao/t14e2a_03_canceladas.png) |

**Defeito encontrado:** na terceira captura, o seletor mostra o fornecedor, mas a lista não está filtrada por ele. Não há "Limpar filtros", e a tela vazia é a da situação, não a dos filtros.

A causa: depois de "Limpar filtros", a página muda sem recarregar, e o seletor (ao contrário dos campos de texto) mantinha a escolha anterior. Assim, ele mostrava um filtro que não estava valendo, e um novo "Filtrar" voltaria a aplicá-lo. O mesmo acontecia nos seletores da lista de Contas desde a SPEC-026.

**Correção:** o formulário dos filtros recomeça sempre que os filtros do endereço mudam, como o filtro de categoria do Catálogo e do Estoque (SPEC-020).

| Verificação no navegador (build local) | Antes | Depois |
|---|---|---|
| Compras: filtrar pelo fornecedor e "Limpar filtros"; o seletor volta para "Todos" | ✗ (o fornecedor continuava escolhido) | ✅ |
| Compras: depois de limpar, "Canceladas" deixa o seletor em "Todos"; voltar no navegador mostra o fornecedor do endereço | — | ✅ |
| Contas: filtrar pelo fornecedor e "Limpar filtros"; o seletor volta para "Todos" | ✗ (o fornecedor continuava escolhido) | ✅ |
| Contas: trocar de "A pagar" para "A receber" deixa o seletor de cliente em "Todos" | — | ✅ |

O roteiro da etapa 2a foi rodado de novo depois da correção, e as 38 verificações continuaram aprovadas.

**Correção conferida na homologação (28/11/2026)**, depois do merge do PR #160: em Compras e em Contas, "Limpar filtros" volta o seletor para "Todos", e trocar de "A pagar" para "A receber" começa o cliente em "Todos".

## Etapa 2b — detalhe da compra (28/11/2026)

Verificação em build de produção local, com Postgres e um Supabase Auth falso. Negócio de teste **HE Testing**, com dados fictícios. A compra nº 1 foi registrada pela própria consulta do HE, como faz a tela:
- a Embalagem P (20 em estoque, custo R$ 1,00): 100 unidades a R$ 1,20;
- a Embalagem G (sem estoque): 50 unidades a R$ 2,00;
- frete de R$ 20,00 e desconto de R$ 10,00, num total de R$ 230,00;
- a prazo, com entrada de R$ 30,00 paga em Pix e 2 parcelas.

A Joana ficou com as permissões padrão do Colaborador.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| 5.6, CA-04 | O detalhe: dados, produtos com os custos (anterior, novo e a escolha), o custo com o rateio, as contas com os pagamentos, as entradas, quem registrou, o pago e o em aberto | `test/integracao/detalhe-da-compra.test.ts` | ✅ |
| 5.6 | A compra cancelada: quem cancelou, quando e o motivo, sem a situação das contas | idem | ✅ |
| 5.9 | Modo suporte: o fornecedor mascarado e sem o link do cadastro | idem | ✅ |
| RN42 | Fornecedor anonimizado: o nome anonimizado, sem o link | idem | ✅ |
| INV-010 | Compra inexistente, id inválido e compra de outro negócio: não encontrada | idem | ✅ |
| 5.9 | O detalhe entra no registro do suporte com o nº da compra | `test/unit/lista-de-compras.test.ts` | ✅ |

**Suíte completa:** 756 testes unitários e 480 de integração, além de lint e tipos.

### Roteiro no navegador

29 verificações, todas aprovadas:
- **da lista ao detalhe:** a linha "Compra nº 1" abre o detalhe, com a data, a fornecedora e o "Doc. NF 77" no cabeçalho;
- **produtos e custos (CA-04):**
  - cada produto mostra a quantidade, o custo unitário e o total, e o custo com o frete menos o desconto;
  - a Embalagem P passou de R$ 1,00 para o custo médio;
  - a Embalagem G, sem estoque antes, ficou com R$ 2,09, o custo da compra com o rateio;
  - o aviso leva à Calculadora de cada produto, porque o preço não muda sozinho;
- **contas:** a entrada aparece "Paga", com "Pago em …, R$ 30,00, pix", e as duas parcelas, "A pagar". Cada conta abre o detalhe no Financeiro;
- **entradas:** "+100, 20 → 120" e "+50, 0 → 50", cada uma com o link do produto no Estoque;
- **resumo, valores e registro:**
  - o resumo: R$ 230,00, "a prazo com entrada de R$ 30,00" e "Paga em parte";
  - os valores: produtos R$ 220,00, frete R$ 20,00, desconto − R$ 10,00, pago R$ 30,00 e em aberto R$ 200,00;
  - o registro: a fornecedora, com o link do cadastro, o documento, quem registrou e quando, e a observação;
- **"Ver a compra":** depois de registrar pela tela uma compra sem nota e à vista, o botão abre o detalhe da compra nº 2;
- **endereço e permissão:** uma compra inexistente dá "não encontrada" (404), e a Colaboradora padrão vai para "Sem acesso";
- **telas** em 1440, 768 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações.

O roteiro da etapa 2a também foi rodado de novo, com as linhas da lista abrindo o detalhe, e as 38 verificações continuaram aprovadas.

| Captura | O que mostra |
|---|---|
| [`s27f_01_detalhe_1440_claro.png`](s27f_01_detalhe_1440_claro.png) | O detalhe da compra nº 1: produtos e custos, contas, entradas, valores e registro |
| [`s27f_01_detalhe_1440_escuro.png`](s27f_01_detalhe_1440_escuro.png) | O mesmo detalhe no tema escuro |
| [`s27f_01_detalhe_390_claro.png`](s27f_01_detalhe_390_claro.png) | O detalhe no celular |
| [`s27f_02_a_vista_sem_nota_390_claro.png`](s27f_02_a_vista_sem_nota_390_claro.png) | A compra nº 2, sem nota e à vista, aberta pelo "Ver a compra" |

## Homologação da etapa 2b (28/11/2026)

Feita pela equipe em <https://he-homol.vercel.app> (DEVELOP, depois do merge do PR #161), com o Dono do negócio de teste. Foram usadas as compras nº 1 e nº 2 da etapa 1 e uma compra nova, a nº 3, de outro fornecedor, com frete. As capturas estão em [`homologacao/`](homologacao). Os nomes do Dono e dos fornecedores foram cobertos.

| Passo | Resultado | Captura |
|---|---|---|
| Compra nº 1, a prazo: o Condicionador (1 × R$ 45,00, custo sem mudança) e a Máscara (2 × R$ 20,00, custo de R$ 22,00 para R$ 20,00, o custo desta compra). Também a parcela 1/1 de R$ 85,00 a pagar, as entradas (0 → 1 e 9 → 11), os valores (pago R$ 0,00, em aberto R$ 85,00), o documento 1234, quem registrou e a observação. O aviso leva à Calculadora da Máscara | ✅ | [`t14e2b_01_compra_1_a_prazo.png`](homologacao/t14e2b_01_compra_1_a_prazo.png) |
| Compra nº 3, à vista, com frete de R$ 5,00: o rateio pelo valor de cada linha (R$ 46,88 e R$ 15,63 por unidade) e o custo mantido. Também a conta à vista de R$ 125,00 a pagar e as entradas (4 → 6 e 3 → 5). Sem aviso da Calculadora, porque nenhum custo mudou | ✅ | [`t14e2b_02_compra_3_com_frete.png`](homologacao/t14e2b_02_compra_3_com_frete.png) |
| Compra nº 2, sem nota fiscal e à vista: a conta paga, com "Pago em 27/11/2026, R$ 135,00, pix", o selo "Paga" e a entrada (1 → 4) | ✅ | [`t14e2b_03_compra_2_paga.png`](homologacao/t14e2b_03_compra_2_paga.png) |
| "Compra nº 3 registrada." com o botão "Ver a compra" | ✅ | [`t14e2b_04_ver_a_compra.png`](homologacao/t14e2b_04_ver_a_compra.png) |

Sem divergência com a Spec. O rateio do frete confere com a OPEN-005: R$ 5,00 divididos em proporção ao valor das linhas, R$ 90,00 e R$ 30,00, dão R$ 3,75 e R$ 1,25. Por unidade, são R$ 1,875 e R$ 0,625, arredondados ao centavo na tela.

## Etapa 2c — ligações com a compra (28/11/2026)

Mesmo ambiente e mesma compra nº 1 da etapa 2b: a Embalagem P e a G, com frete, desconto, entrada paga em Pix e 2 parcelas.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| CA-09 | O histórico do produto traz a compra (nº e id) na entrada da compra; as outras movimentações, não | `test/integracao/ligacoes-da-compra.test.ts` | ✅ |
| CA-09 | A conta da compra traz a compra na lista e no detalhe; a conta manual, não; o filtro de origem "Compra" a encontra | idem | ✅ |
| CA-09 | As compras do fornecedor, das mais recentes para as mais antigas, e o total comprado sem as canceladas; nada de outro fornecedor | idem | ✅ |
| 5.6, INV-010 | Até 50 compras, com a quantidade de todas; id inválido e outro negócio não trazem nada | idem | ✅ |

**Suíte completa:** 756 testes unitários e 484 de integração, além de lint e tipos.

### Roteiro no navegador

25 verificações, todas aprovadas:
- **Estoque:** o histórico da Embalagem P mostra "+100 Entrada — Compra nº 1, 20 → 120", e o nº da compra abre o detalhe dela;
- **contas:**
  - o detalhe da conta mostra a origem "Compra nº 1", com o link para a compra. Até a 2c, a origem dessas contas aparecia como "Manual";
  - o filtro de origem "Compra" encontra as contas da compra;
- **fornecedor:**
  - o detalhe da fornecedora mostra "Compras", com o total comprado (R$ 230,00, sem as canceladas) e a compra nº 1, que abre o detalhe;
  - "Registrar compra" abre a compra já com a fornecedora escolhida;
- **permissões:**
  - a Colaboradora padrão (Estoque, sem Financeiro) vê "Entrada — Compra nº 1" sem o link, porque não vê as compras;
  - um membro só com *Financeiro: ver* vê a origem "Compra nº 1" na conta, sem o link, e o fornecedor sem a seção "Compras" e sem o atalho;
- **telas** em 1440 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações no histórico do produto e no detalhe do fornecedor.

| Captura | O que mostra |
|---|---|
| [`s27g_01_historico_do_produto_1440_claro.png`](s27g_01_historico_do_produto_1440_claro.png) | "Entrada — Compra nº 1" no histórico da Embalagem P |
| [`s27g_02_conta_da_compra_1440_claro.png`](s27g_02_conta_da_compra_1440_claro.png) | A origem "Compra nº 1" no detalhe da conta |
| [`s27g_03_fornecedor_1440_claro.png`](s27g_03_fornecedor_1440_claro.png) | O fornecedor com as compras, o total comprado e o atalho "Registrar compra" |
| [`s27g_03_fornecedor_1440_escuro.png`](s27g_03_fornecedor_1440_escuro.png) | O mesmo detalhe no tema escuro |
| [`s27g_03_fornecedor_390_claro.png`](s27g_03_fornecedor_390_claro.png) | O detalhe do fornecedor no celular |

## Homologação da etapa 2c (28/11/2026)

Feita pela equipe em <https://he-homol.vercel.app> (DEVELOP, depois do merge do PR #163), com o Dono do negócio de teste e as compras nº 1 a nº 3. As capturas estão em [`homologacao/`](homologacao). Foram cobertos:
- o nome do Dono;
- os nomes dos fornecedores, também na observação de uma entrada antiga;
- o nome do contato, o e-mail e o CNPJ do cadastro do fornecedor.

| Passo | Resultado | Captura |
|---|---|---|
| "Registrar compra" no detalhe do fornecedor abre a compra com ele já escolhido | ✅ | [`t14e2c_01_registrar_compra_do_fornecedor.png`](homologacao/t14e2c_01_registrar_compra_do_fornecedor.png) |
| O histórico da Máscara de Hidratação mostra "+2 Entrada — Compra nº 1, 9 → 11", com o link. As movimentações antigas (a venda e a entrada manual) continuam iguais | ✅ | [`t14e2c_02_historico_do_produto.png`](homologacao/t14e2c_02_historico_do_produto.png) |
| A conta "Compra nº 1 — parcela 1/1" mostra a origem "Compra nº 1", com o link, e não mais "Manual" | ✅ | [`t14e2c_03_conta_da_compra.png`](homologacao/t14e2c_03_conta_da_compra.png) |
| O fornecedor das compras nº 1 e nº 2 mostra "Compras", com o total comprado de R$ 220,00 sem as canceladas, as duas compras e o atalho. As contas a pagar dele seguem iguais, inclusive uma conta manual | ✅ | [`t14e2c_04_fornecedor_fio_reto.png`](homologacao/t14e2c_04_fornecedor_fio_reto.png) |
| O fornecedor da compra nº 3 mostra a compra e o total de R$ 125,00 | ✅ | [`t14e2c_05_fornecedor_da_compra_3.png`](homologacao/t14e2c_05_fornecedor_da_compra_3.png) |

Sem divergência com a Spec. Com a homologação da 2c, a **etapa 2 está homologada** (lista, detalhe e ligações).
