# Evidências — SPEC-028 (Desconto e acréscimo nos pagamentos das contas)

A SPEC-028 é implementada em três etapas. Cada etapa registra aqui o que foi verificado.

## Etapa 1 — schema, regras e pagamento com desconto e acréscimo (15/11/2026)

Verificação em build de produção local (`next build` + `next start`), com Postgres e um Supabase Auth falso. Negócio de teste **HE Testing**, com dados fictícios: uma conta a receber de R$ 200,00, um boleto a pagar de R$ 100,00 já vencido e uma conta a pagar de R$ 300,00. O banco recebeu todas as migrações, inclusive a `20261115120000_desconto_e_acrescimo`, que não grava dados novos.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T01 (parte) | Validação do pagamento: desconto e acréscimo com motivo, "Outro" com observação, valores negativos ou inválidos, o pagamento sempre abate mais que zero; abatido, restante e atraso | `test/unit/desconto-acrescimo.test.ts` | ✅ |
| T02 (parte) | Pagamento no banco: taxa da maquininha quita a conta e o caixa recebe o valor real; valor exato; boleto com juros (recusado sem acréscimo); desconto num pagamento parcial; totais da lista, Painel e fornecedor pelo restante; observação; pagamentos simultâneos; outro negócio fora | `test/integracao/desconto-acrescimo.test.ts` | ✅ |
| T09 (parte) | O banco recusa: desconto ou acréscimo sem motivo, "Outro" sem observação, valores negativos, acréscimo maior que o abatido, desconto fora do pagamento de conta, conta que abate mais que o total | idem | ✅ |

**Suíte completa:** 718 testes unitários e 428 de integração, além de lint, tipos e a checagem do schema (`migrate diff` sem diferença). Um teste antigo mudou só no formato esperado: o pagamento validado traz também o desconto e o acréscimo, zerados quando ausentes (`test/unit/fornecedores.test.ts`).

### Roteiro no navegador (T10, parte)

40 verificações, todas aprovadas:
- **recebimento com a taxa:** o valor vem com o restante (R$ 200,00); ao digitar o desconto de R$ 6,00, o valor passa a R$ 194,00, o motivo aparece e o resumo mostra "Abate da conta: R$ 200,00" e "Restante depois: R$ 0,00". Sem motivo, a mensagem aparece no campo. Com "Taxa da maquininha", a conta fica recebida, o detalhe mostra "Descontos R$ 6,00", "Desconto de R$ 6,00 · Taxa da maquininha" e "100% abatido", e o banco tem o lançamento de R$ 194,00;
- **boleto com juros:** R$ 102,50 sem acréscimo é recusado pelo servidor com "O valor passa do restante da conta (R$ 100,00). Se houve juros ou multa, informe o acréscimo.", e o valor digitado continua no campo. Com o acréscimo de R$ 2,50, "Juros ou multa", a conta fica paga com "Acréscimos R$ 2,50";
- **validações e parcial:** "Outro" sem observação e desconto negativo mostram as mensagens; R$ 150,00 com R$ 30,00 de desconto deixam "Restam R$ 120,00", e o próximo pagamento já vem com R$ 120,00. A lista de contas a pagar mostra os R$ 120,00 em aberto;
- **telas** em 1440 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações no formulário e no detalhe.

| Captura | O que mostra |
|---|---|
| [`s28a_01_formulario_desconto_1440_claro.png`](s28a_01_formulario_desconto_1440_claro.png) | Recebimento com o desconto da taxa, o motivo e o resumo |
| [`s28a_01_formulario_desconto_390_claro.png`](s28a_01_formulario_desconto_390_claro.png) | O mesmo formulário no celular |
| [`s28a_02_conta_quitada_com_desconto_1440_claro.png`](s28a_02_conta_quitada_com_desconto_1440_claro.png) | Conta recebida com R$ 194,00 e R$ 6,00 de desconto |
| [`s28a_02_conta_quitada_com_desconto_390_escuro.png`](s28a_02_conta_quitada_com_desconto_390_escuro.png) | O mesmo detalhe no celular, tema escuro |
| [`s28a_03_boleto_com_juros_1440_claro.png`](s28a_03_boleto_com_juros_1440_claro.png) | Boleto pago com R$ 2,50 de juros |

## Etapa 2 — taxa sugerida, recebimento automático com a taxa e estorno do pagamento (15/11/2026)

Mesmo ambiente da etapa 1. O negócio de teste ganhou a taxa média da maquininha de 3% e duas vendas fictícias no cartão de crédito, de R$ 200,00 cada: uma a vencer e outra vencida ontem.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T01 (parte) | Desconto da taxa: restante × taxa, arredondado ao centavo; zero sem taxa, sem restante ou sem valor a receber | `test/unit/desconto-acrescimo.test.ts` | ✅ |
| T03 | Taxa sugerida só na conta de venda no cartão; recebimento automático com a taxa e, sem taxa, pelo valor cheio; a conta com pagamento estornado fica fora do automático | `test/integracao/desconto-acrescimo.test.ts` | ✅ |
| T04 | Estorno: lançamento contrário ligado ao original e à conta, conta reaberta sem o desconto, segundo estorno recusado, conta manual editável e cancelável de novo, estorno de um de dois pagamentos (parcial), estornos simultâneos, a conta antiga parcial corrigida, venda cancelada (reembolso sem o desconto e estorno recusado), pagamento estornado fora dos filtros de forma e de data, outro negócio fora | idem | ✅ |
| T07 e T08 | O estorno continua com *Financeiro: excluir* (guarda já existente da ação) e recusado no modo suporte (teste existente "fora da lista: estorno…", em `test/integracao/correcoes-financeiro.test.ts`) | os testes existentes | ✅ |

**Suíte completa:** 720 testes unitários e 439 de integração, além de lint, tipos e build.

### Roteiro no navegador (T10, parte)

29 verificações, todas aprovadas:
- **Calculadora:** a dica da taxa média diz que ela também é o desconto sugerido ao receber as vendas no cartão;
- **taxa sugerida:** na conta da venda a vencer, o recebimento já vem com R$ 194,00, o desconto de R$ 6,00 e o motivo "Taxa da maquininha", com o texto que explica a sugestão; recebida, a conta fica com R$ 194,00 no caixa e R$ 6,00 de desconto;
- **estorno pelo detalhe:** o diálogo diz que o valor e o desconto serão desfeitos e que o restante passa a R$ 200,00. Depois do estorno, a conta volta a ficar a receber, o recebimento aparece riscado com "Estornado em … por …", o banco tem o estorno de R$ 194,00 ligado à conta, e o formulário sugere a taxa de novo;
- **recebimento automático:** ao abrir o Financeiro, a venda vencida é recebida com R$ 194,00, "Recebido automaticamente" e "Desconto de R$ 6,00 · Taxa da maquininha";
- **estorno pelo fluxo de caixa:** o diálogo explica o efeito na conta. Depois do estorno, abrir o Financeiro de novo não recebe a conta sozinha;
- telas em 1440 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações no detalhe com o pagamento estornado.

| Captura | O que mostra |
|---|---|
| [`s28b_01_taxa_sugerida_1440_claro.png`](s28b_01_taxa_sugerida_1440_claro.png) | Recebimento da venda no cartão com a taxa sugerida |
| [`s28b_02_pagamento_estornado_1440_claro.png`](s28b_02_pagamento_estornado_1440_claro.png) | Conta depois do estorno: recebimento riscado e o restante de volta |
| [`s28b_02_pagamento_estornado_390_escuro.png`](s28b_02_pagamento_estornado_390_escuro.png) | O mesmo detalhe no celular, tema escuro |
| [`s28b_03_recebido_automaticamente_1440_claro.png`](s28b_03_recebido_automaticamente_1440_claro.png) | Parcela recebida no vencimento, com o desconto da taxa |

## Etapa 3 — totais da lista, relatório de Contas e roteiro final (15/11/2026)

Mesmo ambiente das etapas anteriores. O negócio de teste passou ao plano pago, porque o relatório de Contas é do plano pago, e a conta de R$ 300,00 venceu há 2 dias, para entrar no período do relatório. Além das contas fictícias da SPEC-028, o negócio tem as da semente da SPEC-019: uma a receber de R$ 300,00 em aberto, uma a pagar de R$ 900,00 paga e outra a pagar de R$ 150,00 em aberto.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T05 | Totais da lista com descontos e acréscimos; com filtro de forma, só os pagamentos do filtro, sem o estornado | `test/integracao/desconto-acrescimo.test.ts` | ✅ |
| T06 | Relatório de Contas: colunas Descontos e Acréscimos; cada pagamento com o desconto, o acréscimo e o motivo, e o estornado marcado; os estornos fora da lista; CSV; no PDF, os pagamentos quebram em linhas e as linhas altas passam para a página seguinte | `test/unit/desconto-acrescimo.test.ts` e `test/integracao/desconto-acrescimo.test.ts` | ✅ |

**Suíte completa:** 723 testes unitários e 441 de integração, além de lint, tipos, a checagem do schema e o build. Os testes da SPEC-026 que conferem o relatório de Contas e os totais da lista mudaram só no formato esperado: 13 colunas no relatório e os campos de descontos e acréscimos nos totais (`test/unit/fornecedores.test.ts` e `test/integracao/fornecedores.test.ts`).

**Desempenho (RNF06):** num banco à parte, com 5.000 contas, 10.000 pagamentos (um terço com desconto e um quinto com acréscimo) e 50 fornecedores, a lista com os totais levou de 19 a 80 ms, sem filtro e com os filtros de forma, de data do pagamento, de busca e de categoria. A meta é até 1 s.

### Roteiro no navegador (T10 e T11)

63 verificações, todas aprovadas:
- **pagamentos pelas telas:** a venda no cartão recebida com a taxa sugerida (R$ 194,00 e R$ 6,00 de desconto); no boleto, um Pix de R$ 40,00 estornado e o pagamento de R$ 102,50 com R$ 2,50 de juros; a conta de R$ 300,00 com R$ 150,00 pagos e R$ 30,00 de desconto combinado; a venda vencida recebida automaticamente com a taxa;
- **totais da lista:** a receber, Descontos R$ 12,00, Acréscimos R$ 0,00 e Em aberto R$ 500,00 (900 − 388 − 12); a pagar, Descontos R$ 30,00, Acréscimos R$ 2,50 e Em aberto R$ 270,00 (1.450 − 1.152,50 − 30 + 2,50). Com o filtro Pix, só a conta parcial entra (o Pix estornado do boleto fica de fora), com Pago R$ 150,00 e Descontos R$ 30,00, e a nota explica que o pago soma só os pagamentos do filtro;
- **relatório de Contas:** o link da página de Relatórios leva à exportação. O CSV tem as colunas Descontos e Acréscimos, e cada pagamento traz o desconto ou o acréscimo com o motivo, como "15/11/2026 Pix 40,00 [estornado em 15/11/2026] + 15/11/2026 Boleto 102,50, acréscimo 2,50 (Juros ou multa)". O PDF traz os mesmos valores, e os pagamentos aparecem inteiros, em várias linhas;
- **Painel:** "1 conta atrasada entra no mês atual, R$ 120,00 a pagar", o restante da conta parcial já com o desconto;
- **telas:** a lista em 1440, 768 e 390 px; o detalhe e o formulário com desconto em 768 px; o diálogo do estorno em 390, 768 e 1440 px; claro e escuro, sem rolagem horizontal e com o axe sem violações. Com as etapas 1 e 2, o formulário, o detalhe e o diálogo ficam verificados nas três larguras (CA-15). "Voltar" no diálogo não estorna.

| Captura | O que mostra |
|---|---|
| [`s28c_01_totais_a_receber_1440_claro.png`](s28c_01_totais_a_receber_1440_claro.png) | Contas a receber com os totais de descontos e acréscimos |
| [`s28c_01_totais_a_receber_390_escuro.png`](s28c_01_totais_a_receber_390_escuro.png) | Os mesmos totais no celular, tema escuro |
| [`s28c_02_totais_a_pagar_1440_claro.png`](s28c_02_totais_a_pagar_1440_claro.png) | Contas a pagar: descontos, juros e o em aberto pelo restante |
| [`s28c_03_relatorio_contas_pdf.png`](s28c_03_relatorio_contas_pdf.png) | PDF do relatório de Contas, com os pagamentos em várias linhas |
| [`s28c_05_boleto_estornado_e_juros_768_claro.png`](s28c_05_boleto_estornado_e_juros_768_claro.png) | Boleto com o Pix estornado e o pagamento com juros, em 768 px |
| [`s28c_07_dialogo_do_estorno_390_claro.png`](s28c_07_dialogo_do_estorno_390_claro.png) | Diálogo do estorno no celular |
| [`s28c_07_dialogo_do_estorno_768_escuro.png`](s28c_07_dialogo_do_estorno_768_escuro.png) | O mesmo diálogo em 768 px, tema escuro |

## Homologação (T12) — 15/11/2026

Feita pela equipe no ambiente de homologação, com o negócio de teste **HE Testing** e o código da DEVELOP depois das três etapas. As capturas e os relatórios estão em [`homologacao/`](homologacao). Os nomes de pessoas (o Dono e o cliente) e o nome do fornecedor foram cobertos. Os PDFs viraram imagens, e no CSV os nomes foram trocados por "[nome coberto]" e "[fornecedor coberto]".

| Passo | O que foi conferido | Captura | Resultado |
|---|---|---|---|
| 1. Taxa da maquininha | Calculadora com a taxa média de 3%, e a dica diz que ela é o desconto sugerido ao receber as vendas no cartão | [`t12_01`](homologacao/t12_01_taxa_da_maquininha.png) | ✅ |
| 2. Venda no cartão | Venda nº 25, de R$ 200,00, no crédito à vista; a parcela 1/1 vence em 15/12/2026 e fica a receber | [`t12_02`](homologacao/t12_02_venda_no_cartao.png) | ✅ |
| 3. Recebimento com a taxa | A conta da venda fica Recebida: R$ 194,00 recebidos, Descontos R$ 6,00, "Desconto de R$ 6,00 · Taxa da maquininha" e 100% abatido | [`t12_03`](homologacao/t12_03_venda_recebida_com_a_taxa.png) | ✅ |
| 3. Caixa com o valor real | Entrada de R$ 194,00 da venda nº 25, e não de R$ 200,00. As vendas nº 3 e nº 10, vencidas no dia, foram recebidas automaticamente com a taxa ("automático") | [`t12_04`](homologacao/t12_04_caixa_com_o_valor_real.png) | ✅ |
| 4. Conta parcial "antiga" | Conta manual de R$ 200,00 com R$ 194,00 recebidos sem desconto: "Recebida em parte", restam R$ 6,00, como ficavam as contas antes da SPEC-028 | [`t12_05`](homologacao/t12_05_conta_recebida_em_parte.png) | ✅ |
| 4. Diálogo do estorno | "Será gravado no caixa um lançamento contrário… O restante passa a R$ 200,00." | [`t12_06`](homologacao/t12_06_dialogo_do_estorno.png) | ✅ |
| 4. Conta estornada | A conta volta a "A receber", com R$ 200,00 de restante, e o recebimento aparece riscado com "Estornado em 15/11/2026 por …" | [`t12_07`](homologacao/t12_07_conta_estornada.png) | ✅ |
| 4. Caixa com o estorno | Saída de R$ 194,00 com a origem estorno, e o recebimento original riscado e marcado "estornado" | [`t12_08`](homologacao/t12_08_caixa_com_o_estorno.png) | ✅ |
| 4. Conta corrigida | Novo recebimento de R$ 194,00 com R$ 6,00 de desconto, "Taxa da maquininha": a conta fica Recebida, restante R$ 0,00, com os dois recebimentos no histórico | [`t12_09`](homologacao/t12_09_conta_corrigida.png) | ✅ |
| 5. Totais da lista | A receber, todas: Recebido R$ 388,00, Descontos R$ 12,00 (6 + 6), Acréscimos R$ 0,00 e Em aberto R$ 2.902,89 (3.302,89 − 388 − 12) | [`t12_10`](homologacao/t12_10_totais_a_receber.png) | ✅ |
| 5. Relatório de Contas (PDF) | Colunas Descontos e Acréscimos; os pagamentos em várias linhas, com o desconto, o motivo e "[estornado em …]" | [`t12_11`](homologacao/t12_11_relatorio_contas_pdf.png) | ✅ |
| Opcional: juros | Conta recebida com R$ 208,00 e acréscimo de R$ 8,00, "Juros ou multa", no relatório de 01/09 a 15/11 | [`t12_12`](homologacao/t12_12_relatorio_contas_com_juros_pdf.png) | ✅ |
| 5. Relatório de Contas (CSV) | As mesmas colunas e os mesmos textos dos pagamentos | [`t12_13`](homologacao/t12_13_relatorio_contas.csv) | ✅ |

**Além do roteiro:**
- as vendas nº 3 e nº 10 foram recebidas automaticamente no vencimento com o desconto da taxa (R$ 41,78 + R$ 1,52 e R$ 43,42 + R$ 1,58, que correspondem a 3,5%, a taxa da Calculadora naquele momento). Depois, a equipe estornou esses recebimentos, e as contas continuaram a receber, sem um novo recebimento automático (CA-08). O relatório mostra os dois recebimentos marcados como estornados;
- o pagamento antigo da conta de internet de outubro aparece como "Não informada" (SPEC-026), sem desconto nem acréscimo.

**Resultado:** a homologação foi aprovada nos passos do roteiro.

**Observação da equipe (depois das capturas):** ao corrigir uma conta real do mesmo jeito do passo 4, recebida em 09/11 e estornada em 15/11, o caixa do dia 15/11 mostrou uma saída do valor do recebimento sem entrada nenhuma. O saldo total estava certo, mas o caixa do dia não batia com o banco. O estorno seguia a regra da Spec, que mandava usar a data de hoje. A equipe decidiu que o estorno de pagamento de conta passa a ter a data do pagamento original (OPEN-009, etapa 4); os estornos já feitos ficam como estão (OPEN-010).

## Etapa 4 — data do estorno pelo pagamento original (16/11/2026)

Ajuste decidido depois da homologação (OPEN-009 e OPEN-010). Mesmo ambiente das etapas anteriores.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T04 (parte) | Um recebimento de 6 dias atrás é estornado hoje. O estorno fica com a data do recebimento, e o momento em que foi feito fica registrado. O detalhe e o relatório mostram esse momento. O teste foi escrito antes da mudança e falhava (o estorno saía com a data de hoje) | `test/integracao/desconto-acrescimo.test.ts` | ✅ |

**Suíte completa:** 723 testes unitários e 442 de integração, além de lint, tipos, a checagem do schema (`migrate diff` sem diferença) e o build.

### Roteiro no navegador

13 verificações, todas aprovadas:
- um recebimento de R$ 194,00 registrado com a data de 6 dias atrás não muda o "Hoje" da faixa do caixa;
- o estorno feito hoje fica, no banco, com a data do recebimento e o momento do registro de hoje;
- o detalhe mostra "Estornado em {hoje} por …", e a conta volta a ficar a receber;
- o "Hoje" da faixa continua sem saída;
- no fluxo de caixa, o recebimento (riscado) e o estorno aparecem no mesmo dia, e nenhum estorno aparece hoje;
- telas em 1440 e 390 px, sem rolagem horizontal; axe sem violações no fluxo de caixa, claro e escuro.

| Captura | O que mostra |
|---|---|
| [`s28d_01_estornado_hoje_1440_claro.png`](s28d_01_estornado_hoje_1440_claro.png) | Detalhe da conta: recebimento de dias atrás estornado hoje |
| [`s28d_02_fluxo_mesmo_dia_1440_claro.png`](s28d_02_fluxo_mesmo_dia_1440_claro.png) | Fluxo de caixa: o recebimento e o estorno no mesmo dia, com a faixa de hoje zerada |

### Homologação da etapa 4 (15/11/2026)

Feita pela equipe no ambiente de homologação, no mesmo negócio de teste. A venda nº 28, no cartão, foi recebida em 10/11 com R$ 775,99 e R$ 24,00 de desconto da taxa, e o recebimento foi estornado em 15/11. Nas capturas, o nome do Dono está coberto.

| Passo | O que foi conferido | Captura | Resultado |
|---|---|---|---|
| Antes | Saldo R$ 5.402,19; no mês, entrou R$ 2.769,19 e saiu R$ 823,19; resultado R$ 1.946,00; hoje, + R$ 875,20 e − R$ 279,20 | [`t12e4_01`](homologacao/t12e4_01_antes_do_recebimento.png) | ✅ |
| Recebimento em 10/11 | A entrada de R$ 775,99 aparece em 10/11. O saldo vai a R$ 6.178,18, e o "Hoje" não muda | [`t12e4_02`](homologacao/t12e4_02_recebido_em_10_11.png) | ✅ |
| Estorno hoje | O estorno de − R$ 775,99 aparece **em 10/11**, logo abaixo do recebimento riscado. O saldo e o resultado do mês voltam a R$ 5.402,19 e R$ 1.946,00, e o "Hoje" continua + R$ 875,20 e − R$ 279,20 | [`t12e4_03`](homologacao/t12e4_03_estornado_hoje_caixa.png) | ✅ |
| Detalhe da conta | O recebimento aparece riscado com "Estornado em 15/11/2026 por …", e a conta volta a "A receber" (R$ 799,99). O formulário sugere de novo o desconto de R$ 24,00 (3%) | [`t12e4_04`](homologacao/t12e4_04_estornado_hoje_detalhe.png) | ✅ |

**Também conferido:**
- a venda nº 27 também teve o recebimento de 09/11 estornado, e os dois lançamentos ficaram em 09/11;
- o estorno feito antes da etapa 4 (a "Venda Manual (exemplo)") continua em 15/11, como a OPEN-010 decidiu.

**Resultado:** a homologação foi aprovada.

**Observações sem defeito:**
- os totais "Entrou" e "Saiu" do mês somam o pagamento estornado e o estorno, como no estorno avulso desde a SPEC-009, e o resultado do mês fica certo;
- nas capturas 2 e 4, o menu lateral aparece no meio da página por causa da ferramenta de captura de página inteira, e não da tela do HE.
