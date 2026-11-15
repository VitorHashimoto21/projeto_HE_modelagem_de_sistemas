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
