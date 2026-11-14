# SPEC-028 — Desconto e acréscimo nos pagamentos das contas

> **Status:** ✅ **Aprovada em 14/11/2026**, a implementar. As questões em aberto foram decididas pela equipe em entrevista (seção 13), todas pela opção recomendada:
> - o desconto e o acréscimo são informados **no pagamento** ou no recebimento de cada conta; o valor original da conta não muda (OPEN-001);
> - o caixa recebe **só o valor real** que entrou ou saiu; o desconto e o acréscimo ficam registrados no pagamento (OPEN-002);
> - nas contas de venda no cartão de crédito, a **taxa da maquininha** vem sugerida pela taxa média da Calculadora, e o recebimento automático no vencimento desconta a mesma taxa (OPEN-003);
> - a taxa das vendas no **débito** fica para a SPEC-029, quando toda venda passar a gerar conta a receber (OPEN-004);
> - o desconto e o acréscimo têm **motivo de uma lista curta** (OPEN-005);
> - **juros e multa** são digitados, sem cálculo automático (OPEN-006);
> - um pagamento de conta passa a poder ser **estornado** (OPEN-007);
> - a **permissão** é a mesma do pagamento (OPEN-008).
>
> A baseline foi ajustada: RN44 nova; RF31, RF71, RF90, RN11, RN20 e RN22 alterados. O RF91 e a RN43 ficam reservados para a SPEC-027 (proposta). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a pedido da equipe. Origem: recomendações de uma usuária com CNPJ que usa o HE no dia a dia (14/11/2026). É a primeira de duas Specs dessas recomendações; a SPEC-029 (recebimento das vendas pelo contas a receber) vem depois e usa o desconto desta Spec.
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:**
>   - [SPEC-009](SPEC-009.md): pagamento com desconto e acréscimo; estorno do pagamento de conta; recebimento automático das parcelas do cartão com a taxa da maquininha;
>   - [SPEC-026](SPEC-026.md): os totais da lista de contas e o relatório de Contas ganham o desconto e o acréscimo;
>   - [SPEC-012](SPEC-012.md): as contas em aberto e a projeção de caixa usam o restante já com desconto e acréscimo;
>   - [SPEC-010](SPEC-010.md): a taxa média da maquininha também passa a ser usada no recebimento das contas de venda no cartão.
> - **Usa:** [SPEC-005](SPEC-005.md) (permissões), [SPEC-008](SPEC-008.md) (parcelas do cartão), [SPEC-011](SPEC-011.md) (cancelamento de venda), [SPEC-013](SPEC-013.md) (relatórios), [SPEC-014](SPEC-014.md) (exportação), [SPEC-016](SPEC-016.md) (componentes) e [SPEC-018](SPEC-018.md) e [SPEC-019](SPEC-019.md) (modo suporte e negócio suspenso).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-028 |
| **Nome** | Desconto e acréscimo nos pagamentos das contas |
| **Objetivo** | Permitir pagar ou receber uma conta com **desconto** (taxa da maquininha, desconto combinado) ou **acréscimo** (juros ou multa), quitando a conta sem deixar um resto que nunca vai ser pago. O caixa recebe só o valor real. Nas vendas no cartão de crédito, a taxa da maquininha é sugerida e descontada sozinha no recebimento automático. Um pagamento registrado errado pode ser estornado. |
| **Valor entregue** | O contas a receber para de mostrar valores "pendentes" que a maquininha já descontou, e o contas a pagar fecha certo quando o boleto é pago com juros. O caixa bate com o banco, e o relatório de Contas mostra quanto foi de taxa e quanto foi de juros no período. |

### O que muda nos pagamentos

Hoje o pagamento de uma conta tem o valor, a data e a forma (SPEC-026). A conta só fica quitada quando a soma dos pagamentos chega ao valor total. Pagar menos deixa o resto em aberto para sempre, e pagar mais é recusado. As parcelas do cartão são recebidas sozinhas no vencimento, pelo valor cheio. Um pagamento de conta registrado errado não pode ser desfeito.

Com esta Spec:
- **Pagamento ou recebimento:** ganha o **desconto** e o **acréscimo**, cada um com o motivo. A conta abate o valor pago mais o desconto, menos o acréscimo.
- **Caixa:** o lançamento é do valor que realmente entrou ou saiu.
- **Conta de venda no cartão:** o desconto vem sugerido pela taxa média da maquininha (RF51), e o recebimento automático no vencimento já desconta a taxa.
- **Estorno do pagamento:** desfaz um pagamento de conta, com o lançamento contrário no caixa.
- **Lista, relatório e Painel:** mostram o desconto e o acréscimo, e o "em aberto" já considera os dois.

### Exemplo que originou a Spec

Uma loja vende R$ 200,00 no cartão de crédito à vista, numa maquininha que cobra 3%. A loja informou a taxa média de 3,00% na Calculadora. Ela também tem um boleto de R$ 100,00 de um fornecedor, pago com atraso por R$ 102,50. Os valores são fictícios.
- **Hoje:**
  - a maquininha deposita R$ 194,00. A dona registra o recebimento de R$ 194,00, e a conta fica parcial, com R$ 6,00 "a receber" que nunca vão entrar. No vencimento, o HE recebe sozinho os R$ 6,00, e o caixa fica R$ 6,00 acima do real;
  - no boleto, ela não consegue registrar R$ 102,50, porque passa do valor da conta. Registra R$ 100,00 e lança os R$ 2,50 de juros como uma saída avulsa, sem ligação com a conta.
- **Com esta Spec:**
  - ao receber a conta do cartão, o desconto já vem com **R$ 6,00, "Taxa da maquininha"**, e o valor com R$ 194,00. Ela confirma, a conta fica quitada, e o caixa ganha R$ 194,00. Se ela não registrar, o recebimento automático do vencimento faz o mesmo;
  - no boleto, ela informa o valor pago de R$ 102,50 e o **acréscimo de R$ 2,50, "Juros ou multa"**. A conta fica quitada, e o caixa ganha a saída de R$ 102,50;
  - no relatório de Contas do mês, aparecem os R$ 6,00 de taxa e os R$ 2,50 de juros;
  - se ela registrar um pagamento errado, estorna no detalhe da conta e registra de novo.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | RF31 | **Alterado:** o pagamento ou recebimento de uma conta registra também o desconto e o acréscimo, com o motivo. A conta abate o valor pago mais o desconto, menos o acréscimo. Um pagamento de conta pode ser estornado. |
| | RF71 | **Alterado:** o relatório de Contas traz o desconto e o acréscimo de cada pagamento, com o motivo, e os totais da conta. |
| | RF90 | **Alterado:** os totais da lista filtrada ganham os descontos e os acréscimos, e o "em aberto" considera os dois. |
| | RF29, RF32 | Usados: o fluxo de caixa recebe só o valor real, na categoria da conta; nenhuma categoria nova. |
| | RF51 | Usado: a taxa média da maquininha, informada na Calculadora, é a taxa sugerida no recebimento das contas de venda no cartão. |
| | RF67, RF68 | Usados: as contas geradas por despesa fixa aceitam desconto e acréscimo como as outras; a projeção de caixa usa o restante já com os dois. |
| **RN** | **RN44** (nova) | Desconto e acréscimo no pagamento de conta: o caixa recebe o valor real; a conta abate valor + desconto − acréscimo, sem passar do restante; cada um com motivo; a taxa da maquininha é sugerida e aplicada no recebimento automático das contas de venda no cartão; o estorno desfaz o pagamento inteiro. |
| | RN11 | **Alterada:** a parcela continua dividida igualmente, com os centavos na 1ª; a taxa da maquininha deixa de ser ignorada e é descontada no recebimento da conta (RN44). |
| | RN20 | **Alterada:** a taxa média de cartão continua na formação do preço e passa também a ser o desconto sugerido no recebimento das contas de venda no cartão. A comissão continua só no preço, sem repasse. |
| | RN22 | **Alterada:** o lançamento do pagamento é do valor real; o desconto e o acréscimo ficam no pagamento. Um pagamento estornado ganha o lançamento contrário. |
| | RN14 | Usada: o saldo do caixa reflete só o que entrou ou saiu de verdade. |
| | RN21 | Usada: o faturamento e o RBT12 continuam pelo valor da venda; a taxa da maquininha não reduz a receita bruta. |
| | RN25 | Usada: no cancelamento da venda, o reembolso é do valor recebido em dinheiro, sem o desconto; depois dele, os pagamentos das contas da venda não são estornados. |
| | RN37, RN39 | Mantidas: registrar pagamento e estornar pagamento ficam fora das correções do suporte; o negócio suspenso não registra nem estorna. |
| **RNF** | RNF01 | Pagamento e detalhe da conta em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | Pagamentos, descontos e estornos isolados por negócio. |
| | RNF05 | Desconto, acréscimo e estorno auditáveis: quem, quando, valores e motivo, nunca alterados nem apagados. |
| | RNF06 | Totais da lista calculados no banco. |
| **Decisões anteriores** | SPEC-009, OPEN-003 | Lançamentos imutáveis, corrigidos por estorno; até aqui, só o avulso e o saldo inicial. Esta Spec estende o estorno ao pagamento de conta (OPEN-007). |
| | SPEC-009, OPEN-008 | Recebimento automático das parcelas do cartão no vencimento. Passa a descontar a taxa (OPEN-003). |
| | SPEC-016, nota N5 | A taxa média da maquininha aparece no Painel e nos Relatórios só para quem vê o Financeiro. |
| | SPEC-026, OPEN-008 a OPEN-010 | Forma obrigatória no pagamento; filtros e totais das contas; relatório de Contas com os pagamentos. |
| | SPEC-019, OPEN-005 | Lista fechada de correções do suporte; ação nova nasce proibida. |
| **Caso de uso / fluxo** | Financeiro (SPEC-009) | Ver seção 5. |
| **Entidades** | `LancamentoFinanceiro`, `ContaPagarReceber`, `Negocio` (taxa média) | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor), ADR-005 (regras puras em TypeScript) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Desconto e acréscimo no pagamento e no recebimento** de qualquer conta (manual, de despesa fixa e de venda no cartão), cada um com o motivo:
   - desconto: Taxa da maquininha, Desconto combinado ou Outro;
   - acréscimo: Juros ou multa, ou Outro;
   - com "Outro", uma observação obrigatória.
2. **Caixa com o valor real:** um lançamento do valor pago ou recebido, na categoria da conta, com a forma.
3. **Taxa da maquininha nas contas de venda no cartão:** desconto sugerido pela taxa média da Calculadora; o recebimento automático no vencimento desconta a mesma taxa.
4. **Estorno do pagamento de conta:** lançamento contrário no caixa; a conta volta a ficar aberta ou parcial.
5. **Detalhe da conta:** total, pago, descontos, acréscimos e restante; cada pagamento com o desconto, o acréscimo, o motivo e, se for o caso, o estorno.
6. **Lista de contas:** os totais ganham descontos e acréscimos; o "em aberto" já considera os dois.
7. **Relatório de Contas** (Relatórios, plano pago): o desconto e o acréscimo de cada pagamento, com o motivo, e os totais da conta.
8. **Painel:** as contas em aberto e a projeção de caixa pelo restante já com desconto e acréscimo.
9. **Permissões:** as do pagamento (*Financeiro: criar*) e as do estorno (*Financeiro: excluir*).
10. **Modo suporte e negócio suspenso:** registrar e estornar pagamento continuam fora das correções do suporte e são recusados em negócio suspenso.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Taxa nas vendas no débito, no Pix e nas outras formas que hoje entram direto no caixa | **SPEC-029** (OPEN-004): quando toda venda gerar conta a receber, essas contas ganham a mesma taxa. |
| Desconto ou acréscimo na própria conta, antes do pagamento | Fora (OPEN-001). A conta manual sem pagamento continua editável (SPEC-009). |
| Juros e multa calculados sozinhos pelo atraso | Fora (OPEN-006): o acréscimo é digitado. |
| Taxas diferentes por modalidade (crédito à vista, parcelado, débito) | Fora (OPEN-003): vale a taxa média da Calculadora. Pode voltar como evolução. |
| Categoria nova para taxas e juros, ou lançamento separado do desconto | Fora (OPEN-002): o caixa recebe só o valor real. |
| Desconto na venda (no preço da venda) | Fora: a venda já tem o ajuste de preço por linha (SPEC-017). |
| Mudar o vencimento da conta de venda | **SPEC-029**. |
| Antecipação de recebíveis do cartão | Fora. |
| Conciliação com o extrato do banco ou da maquininha | Fora: o HE tem um caixa só. |

---

## 4. Dependências

- **Specs:**
  - SPEC-009: contas, pagamentos, recebimento automático das parcelas, estorno e o fluxo de caixa;
  - SPEC-026: forma do pagamento, filtros e totais das contas e o relatório de Contas;
  - SPEC-008 e SPEC-011: parcelas do cartão e cancelamento de venda;
  - SPEC-010: a taxa média da maquininha (RF51);
  - SPEC-012: contas em aberto e projeção de caixa no Painel;
  - SPEC-013: relatórios e o limite do plano gratuito;
  - SPEC-005: matriz módulo × ação;
  - SPEC-014: exportação dos dados;
  - SPEC-016: campos, gavetas, avisos e diálogos de confirmação;
  - SPEC-018 e SPEC-019: modo suporte, lista fechada de correções e negócio suspenso.
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-003 (autorização no servidor), ADR-005 (regras puras em TypeScript, como no estoque e na precificação).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Registrar pagamento ou recebimento (OPEN-001, OPEN-005, OPEN-006)

1. Quem tem *Financeiro: criar* abre a conta e escolhe **Registrar pagamento** (ou **Registrar recebimento**).
2. O formulário tem:
   - **valor pago** (ou recebido): o dinheiro que saiu ou entrou;
   - **data** e **forma**, como hoje (SPEC-026);
   - **desconto** (opcional), com o motivo: Taxa da maquininha, Desconto combinado ou Outro;
   - **acréscimo** (opcional), com o motivo: Juros ou multa, ou Outro;
   - **observação** (até 120 caracteres), obrigatória quando o motivo é Outro.
3. Abaixo dos campos, a tela mostra "Abate da conta: {valor + desconto − acréscimo}" e "Restante depois: {restante − abatido}".
4. O valor vem preenchido com o restante. Ao informar o desconto ou o acréscimo, o valor se ajusta para quitar a conta (restante − desconto + acréscimo), enquanto a pessoa não tiver mudado o valor à mão.
5. Regras:
   - o valor é maior que zero; o desconto e o acréscimo são maiores ou iguais a zero;
   - o abatido (valor + desconto − acréscimo) é maior que zero e não passa do restante;
   - com abatido igual ao restante, a conta fica **quitada**; com menos, **parcial**.
6. O servidor confere tudo de novo e grava, numa transação, o lançamento no caixa (5.3) e os totais da conta.

### 5.2 Taxa da maquininha nas contas de venda no cartão (OPEN-003, OPEN-004)

- **Sugestão:** ao receber uma conta de venda no cartão de crédito, com a taxa média da maquininha informada na Calculadora (RF51) maior que zero:
  - o desconto vem preenchido com o restante × a taxa, arredondado ao centavo, e o motivo com "Taxa da maquininha";
  - o valor vem com o restante menos esse desconto;
  - a pessoa troca os dois pelo valor exato que a maquininha depositou.
- **Recebimento automático** (rotina diária e abertura do Financeiro e do Painel, SPEC-009): a parcela vencida é recebida com o mesmo desconto, o motivo "Taxa da maquininha" e a forma Cartão de crédito, na data do vencimento. O detalhe mostra "Recebido automaticamente".
- **Sem taxa informada** (zero), nada muda: o recebimento é pelo valor cheio, como hoje.
- Vale a **taxa em vigor no dia do recebimento**. Uma mudança da taxa na Calculadora não mexe nos recebimentos já registrados.
- A conta de venda no cartão com **algum pagamento estornado** sai do recebimento automático. Quem estornou registra o recebimento certo à mão (5.5).
- As vendas no **débito**, no Pix e em dinheiro continuam entrando direto no caixa pelo valor cheio; a taxa delas fica para a SPEC-029.
- A tela de parâmetros da Calculadora avisa, junto da taxa média, que ela também é sugerida no recebimento das vendas no cartão.

### 5.3 Caixa (OPEN-002)

- O lançamento do pagamento é do **valor pago**, na categoria da conta e com a forma, como hoje. O desconto e o acréscimo não geram lançamento.
- O saldo do caixa (RN14) e o fluxo de caixa mostram só o que entrou ou saiu.
- O lançamento continua levando à conta, onde aparecem o desconto, o acréscimo e o motivo.
- O faturamento, o RBT12 e a receita bruta continuam pelo valor da venda (RN21). A taxa da maquininha não reduz a receita.

### 5.4 Detalhe da conta

- **Resumo:** total, pago, descontos, acréscimos e restante (total − pago − descontos + acréscimos).
- **Pagamentos:** cada um com data, forma, valor, desconto (e motivo), acréscimo (e motivo), observação e quem registrou ("Recebido automaticamente" no automático). O pagamento estornado aparece riscado, com "Estornado em {data} por {nome}".
- O detalhe também mostra os pagamentos de antes desta Spec, com desconto e acréscimo zero.

### 5.5 Estorno do pagamento (OPEN-007)

1. Quem tem *Financeiro: excluir* escolhe **Estornar** num pagamento, no detalhe da conta ou no fluxo de caixa.
2. O diálogo de confirmação mostra o valor, o desconto e o acréscimo que serão desfeitos e o restante da conta depois.
3. Ao confirmar, numa transação:
   - o caixa ganha o lançamento contrário, do mesmo valor, na mesma categoria, com a forma do original, a data de hoje e a descrição "Estorno de: {descrição}", ligado ao original;
   - a conta perde o valor, o desconto e o acréscimo daquele pagamento e volta a ficar **aberta** (sem pagamentos válidos) ou **parcial**;
   - nada é apagado, e o pagamento original fica marcado como estornado.
4. Recusas:
   - pagamento já estornado: "Este pagamento já foi estornado.";
   - conta cancelada, ou conta de uma venda cancelada, mesmo quitada (o cancelamento já devolveu o valor recebido, RN25): "Esta conta foi cancelada ou é de uma venda cancelada; o pagamento não pode ser estornado.".
5. Pagamentos de antes desta Spec também podem ser estornados.
6. A conta manual com todos os pagamentos estornados volta a ser editável e cancelável, como uma conta sem pagamento (SPEC-009, OPEN-003).
7. O pagamento estornado não conta nos filtros de data do pagamento e de forma, nem no total pago (SPEC-026).

### 5.6 Lista, relatório e Painel

- **Lista de contas** (SPEC-026): os totais da lista filtrada passam a ser quantidade, total, pago, **descontos**, **acréscimos** e em aberto. O "em aberto" é a soma dos restantes.
- **Relatório de Contas** (Relatórios, plano pago): colunas novas "Descontos" e "Acréscimos" por conta. Na coluna "Pagamentos", cada pagamento traz data, forma, valor, desconto e acréscimo com o motivo, e os estornados aparecem marcados.
- **Painel** (SPEC-012): as contas a receber e a pagar em aberto e a projeção de caixa (RF68) usam o restante já com desconto e acréscimo.
- **Fluxo de caixa:** nenhuma coluna nova; o lançamento leva à conta.

### 5.7 Permissões, plano, suporte e suspensão (OPEN-008)

- **Permissões:** registrar pagamento com desconto ou acréscimo exige *Financeiro: criar*, como hoje. Estornar um pagamento exige *Financeiro: excluir*, como o estorno do lançamento avulso. Sem mudar a matriz.
- **Plano:** nos dois planos. O relatório de Contas continua no plano pago.
- **Modo suporte:** o Administrador vê o desconto, o acréscimo e os estornos nos módulos liberados. Registrar e estornar pagamento não estão na lista fechada de correções (RN37) e continuam recusados, mesmo com o Financeiro em "ver e corrigir".
- **Taxa corrigida pelo suporte:** a correção "Salvar parâmetros de precificação" (SPEC-019) pode mudar a taxa média. A taxa nova passa a valer nos próximos recebimentos, e o Dono pode desfazer a correção como hoje.
- **Negócio suspenso:** registrar e estornar pagamento são recusados (RN39). O recebimento automático, como as outras rotinas, não roda em negócio suspenso (SPEC-019).

### 5.8 Cancelamento de venda (SPEC-011)

- O cancelamento continua igual (RN25): as contas abertas e parciais da venda são canceladas, as quitadas ficam como estão, e o reembolso é do valor recebido em dinheiro, que o cancelamento já soma pelo pago das contas.
- Numa conta de cartão recebida com desconto, o reembolso é do valor recebido, sem o desconto, que nunca entrou no caixa.
- Depois do cancelamento, nenhum pagamento das contas da venda pode ser estornado (5.5), para o valor não ser devolvido duas vezes.

### 5.9 Migração

- Os pagamentos existentes ficam com desconto e acréscimo zero, e as contas, com os totais zerados.
- Uma conta que hoje está parcial só por causa da taxa (como no exemplo da seção 1) é corrigida em dois passos: estornar o recebimento e registrar de novo com o desconto.

### 5.10 Mensagens

| Situação | Mensagem |
|---|---|
| Valor zero ou negativo | "Informe um valor maior que zero." |
| Desconto ou acréscimo negativo | "O desconto e o acréscimo não podem ser negativos." |
| Abatido passa do restante, sem acréscimo | "O valor passa do restante da conta ({restante}). Se houve juros ou multa, informe o acréscimo." |
| Abatido passa do restante, com acréscimo | "Valor, desconto e acréscimo passam do restante da conta ({restante})." |
| Abatido zero ou negativo | "O acréscimo não pode ser maior que o valor pago mais o desconto." |
| Desconto ou acréscimo sem motivo | "Escolha o motivo do desconto." / "Escolha o motivo do acréscimo." |
| Motivo Outro sem observação | "Descreva o motivo." |
| Pagamento já estornado | "Este pagamento já foi estornado." |
| Estorno em conta cancelada ou de venda cancelada | "Esta conta foi cancelada ou é de uma venda cancelada; o pagamento não pode ser estornado." |
| Suporte ou negócio suspenso | As mensagens da SPEC-019. |

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Para cada conta: pago = Σ dos valores dos pagamentos não estornados; descontos e acréscimos = Σ dos pagamentos não estornados; restante = total − pago − descontos + acréscimos, nunca negativo; quitada se e somente se o restante é zero (fora as canceladas). Substitui a INV-004 da SPEC-009. | Teste de integração depois de pagamentos, descontos, acréscimos e estornos. |
| **INV-002** | O caixa só recebe valor real: a soma dos lançamentos ligados à conta, com os estornos, é igual ao pago. O desconto e o acréscimo nunca geram lançamento. | Teste de integração. |
| **INV-003** | Pagamentos simultâneos nunca passam do restante. | Teste de integração com pagamentos simultâneos. |
| **INV-004** | Todo desconto ou acréscimo maior que zero tem motivo; o motivo Outro tem observação. O banco recusa o contrário. | Teste unitário da validação; teste de integração com gravação direta. |
| **INV-005** | No recebimento automático, o desconto é o restante × a taxa média em vigor, arredondado ao centavo; com taxa zero, o desconto é zero; a conta com pagamento estornado não é recebida sozinha. | Teste de integração da conferência. |
| **INV-006** | O estorno grava o lançamento contrário de mesmo valor e categoria, ligado ao original; um pagamento só é estornado uma vez, e nunca o de uma conta cancelada ou de venda cancelada; nada é alterado nem apagado. | Teste de integração, inclusive com estornos simultâneos. |
| **INV-007** | O suporte nunca registra nem estorna pagamentos; o negócio suspenso também não. | Teste de integração no contexto de suporte e com o negócio suspenso. |
| **INV-008** | Pagamentos, descontos, estornos e totais só trazem dados do próprio negócio. | Teste de integração com dois negócios. |

---

## 7. Modelo de domínio envolvido

| Entidade | Uso | Mudança |
|---|---|---|
| `LancamentoFinanceiro` | Lançamento de cada pagamento de conta e do estorno | **+ `desconto`** e **+ `acrescimo`** (valores, padrão zero), **+ motivo do desconto**, **+ motivo do acréscimo** e **+ observação** (até 120 caracteres), só nos lançamentos de pagamento de conta |
| `ContaPagarReceber` | Contas a pagar e a receber | **+ `valorDesconto`** e **+ `valorAcrescimo`** (totais da conta, padrão zero), atualizados na mesma transação do pagamento e do estorno |
| `Negocio` | Taxa média da maquininha (RF51) | Nenhuma: passa a ser lida também no recebimento |
| `Venda`, `Parcela` | Parcelas do cartão | Nenhuma |

**Mudanças previstas no schema:**
- enums do motivo do desconto (Taxa da maquininha, Desconto combinado, Outro) e do motivo do acréscimo (Juros ou multa, Outro);
- colunas novas em `LancamentoFinanceiro` e `ContaPagarReceber`;
- CHECKs:
  - desconto e acréscimo maiores ou iguais a zero;
  - motivo presente quando o valor é maior que zero, e só em lançamento de pagamento de conta;
  - observação presente com o motivo Outro;
  - na conta, pago + descontos − acréscimos ≤ total;
- o estorno do pagamento usa a origem de estorno e o vínculo com o original que já existem (SPEC-009) e fica ligado à mesma conta;
- migração sem dados novos: tudo começa em zero.

---

## 8. Impacto arquitetural

- `prisma/schema.prisma` e uma migração (seção 7).
- `src/lib/dominio/financeiro.ts`: validação do pagamento com desconto e acréscimo, cálculo do abatido e do restante, sugestão da taxa e rótulos dos motivos, sem framework nem banco (ADR-005).
- `src/lib/db/financeiro.ts`:
  - `pagarConta`: a atualização condicional passa a considerar o desconto e o acréscimo e grava os totais da conta;
  - recebimento automático com a taxa média e sem as contas com pagamento estornado;
  - estorno do pagamento de conta (hoje recusado com `NaoEstornavel`);
  - totais, filtros e detalhe com o desconto e o acréscimo; o "em aberto" pelo restante.
- `src/lib/db/dashboard.ts`: contas em aberto e projeção pelo restante (hoje `valorTotal − valorPago`).
- `src/lib/db/relatorios.ts` e `src/lib/relatorios/tabelas.ts`: colunas novas no relatório de Contas.
- `src/lib/db/lgpd.ts`: as colunas novas entram na exportação.
- **Ações e telas:**
  - formulário de pagamento com desconto, acréscimo, motivo, observação e o resumo "Abate da conta";
  - detalhe da conta com os totais, os pagamentos e o botão Estornar;
  - Estornar no fluxo de caixa também para os lançamentos de conta;
  - totais da lista de contas;
  - aviso nos parâmetros da Calculadora.
- SPEC-019: nenhuma correção nova; `correcoes.ts` não muda.
- Sem integração externa nova e sem dependência nova.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Registrar pagamento** (SPEC-009, SPEC-026) | contaId, valor, data, forma, + desconto?, motivoDesconto?, acrescimo?, motivoAcrescimo?, observacao? | {status, restante} | `CampoInvalido` (valor, desconto, acréscimo, motivo, observação), `ValorAcimaDoRestante`, `ContaEncerrada`, `ContaNaoEncontrada`, `SemPermissao`, `ForaDaListaDeCorrecoes`, `NegocioSuspenso` |
| **Sugerir taxa** | contaId | {descontoSugerido, taxa} ou nada (sem taxa ou conta que não é de venda no cartão) | `ContaNaoEncontrada`, `SemPermissao` |
| **Estornar pagamento** | lancamentoId | {conta: status e restante} | `LancamentoNaoEncontrado`, `JaEstornado`, `ContaEncerrada` (cancelada ou de venda cancelada), `SemPermissao`, `ForaDaListaDeCorrecoes`, `NegocioSuspenso` |
| **Detalhar conta** (SPEC-009) | id | + descontos, acréscimos e restante; pagamentos com desconto, acréscimo, motivo, observação e estorno | Sem mudança |
| **Listar contas** (SPEC-026) | os filtros de hoje | + totais de descontos e acréscimos; "em aberto" pelo restante | Sem mudança |
| **Conferir** (rotina, SPEC-009) | hoje | {contasCriadas, parcelasRecebidas} | Sem mudança |
| **Relatório de Contas** (SPEC-013, SPEC-026) | período | + colunas Descontos e Acréscimos; pagamentos com desconto, acréscimo, motivo e estorno | Sem mudança |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Formulário de pagamento, detalhe da conta e diálogo do estorno legíveis no celular, sem rolagem horizontal. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login; axe sem violações. |
| **RNF02** | Pagamentos e estornos isolados por negócio. | INV-008. |
| **RNF05** | Desconto, acréscimo, motivo e estorno com quem e quando, nunca alterados nem apagados. | INV-004, INV-006. |
| **RNF06** | Totais da lista com descontos e acréscimos calculados no banco. | Lista filtrada com 5.000 contas e 10.000 pagamentos em até 1 s no build local, como na SPEC-026. |

---

## 11. Critérios de aceitação

**CA-01 — Recebimento com taxa.** Dada uma conta a receber de venda no cartão de R$ 200,00 e a taxa média de 3,00%, quando alguém abre "Registrar recebimento", então o desconto vem com R$ 6,00 e "Taxa da maquininha" e o valor com R$ 194,00. Ao confirmar, a conta fica quitada, e o caixa ganha a entrada de R$ 194,00.

**CA-02 — Valor exato.** Dado o CA-01, quando a pessoa troca o valor para R$ 193,80 e o desconto para R$ 6,20, então a conta fica quitada com esses valores.

**CA-03 — Recebimento automático.** Dada a conta do CA-01 vencida e sem recebimento, quando a conferência roda, então a conta fica quitada com R$ 194,00 no caixa, desconto de R$ 6,00, "Taxa da maquininha", forma Cartão de crédito, e o detalhe mostra "Recebido automaticamente". Com a taxa zero, o recebimento é de R$ 200,00, como hoje.

**CA-04 — Acréscimo.** Dada uma conta a pagar de R$ 100,00, quando alguém paga R$ 102,50 com acréscimo de R$ 2,50, "Juros ou multa", então a conta fica quitada, e o caixa ganha a saída de R$ 102,50. Sem o acréscimo, aparece "O valor passa do restante da conta (R$ 100,00). Se houve juros ou multa, informe o acréscimo.", e nada é gravado.

**CA-05 — Desconto combinado e parcial.** Dada uma conta a pagar de R$ 300,00, quando alguém paga R$ 150,00 com desconto de R$ 30,00, "Desconto combinado", então a conta fica parcial com restante de R$ 120,00.

**CA-06 — Motivo.** Quando alguém informa um desconto sem motivo, ou o motivo Outro sem observação, então aparece a mensagem da seção 5.10, e nada é gravado.

**CA-07 — Estorno.** Dada a conta do CA-01 quitada, quando alguém com *Financeiro: excluir* estorna o recebimento, então o caixa ganha a saída de R$ 194,00, "Estorno de: …", a conta volta a ficar aberta com restante de R$ 200,00, e o pagamento aparece riscado como estornado. Um segundo estorno do mesmo pagamento é recusado.

**CA-08 — Depois do estorno.** Dada a conta do CA-07, já vencida, quando a conferência roda, então ela não é recebida sozinha. Quando a pessoa registra o recebimento certo, então a conta fica quitada.

**CA-09 — Conta parcial antiga.** Dada uma conta de R$ 200,00 com um recebimento de antes desta Spec de R$ 194,00, quando alguém estorna esse recebimento e registra R$ 194,00 com desconto de R$ 6,00, então a conta fica quitada, e o caixa termina com R$ 194,00 líquidos dessa conta.

**CA-10 — Lista e relatório.** Dadas as contas dos CA-01 e CA-04, então os totais da lista mostram os descontos de R$ 6,00 e os acréscimos de R$ 2,50. No plano pago, o relatório de Contas traz as colunas Descontos e Acréscimos e, em cada pagamento, o motivo.

**CA-11 — Painel.** Dada uma conta a receber de R$ 300,00 com R$ 150,00 recebidos e R$ 30,00 de desconto, então o Painel e a projeção de caixa contam R$ 120,00 em aberto.

**CA-12 — Cancelamento de venda.** Dada uma venda no cartão de R$ 200,00 cuja conta foi recebida com R$ 194,00 e R$ 6,00 de desconto, quando a venda é cancelada, então o reembolso é de R$ 194,00, e o estorno do pagamento dessa conta é recusado.

**CA-13 — Permissões.** Dado um membro com *Financeiro: criar* sem *Financeiro: excluir*, então ele registra pagamento com desconto, mas não vê o botão Estornar, e a ação é recusada no servidor.

**CA-14 — Suporte e suspensão.** Dado o Administrador em modo suporte com o Financeiro em "ver e corrigir", então ele vê os descontos e os estornos, mas não registra nem estorna pagamentos. Dado um negócio suspenso, então registrar e estornar pagamento são recusados.

**CA-15 — Visual.** Dadas as telas de pagamento, detalhe da conta e diálogo do estorno, em 390, 768 e 1440 px, claro e escuro, então nada rola na horizontal, e o axe não aponta violações.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação do pagamento (valor, desconto, acréscimo, abatido, motivo, observação), sugestão da taxa e arredondamento | Unitário | CA-01, CA-02, CA-04, CA-05, CA-06, INV-004 |
| T02 | Pagamento no banco com desconto e acréscimo: totais da conta, status, lançamento do valor real, pagamentos simultâneos | Integração | CA-01, CA-02, CA-04, CA-05, INV-001, INV-002, INV-003 |
| T03 | Recebimento automático com taxa, sem taxa e com pagamento estornado | Integração | CA-03, CA-08, INV-005 |
| T04 | Estorno do pagamento: lançamento contrário, conta reaberta, estorno repetido e simultâneo, conta cancelada, conta manual editável de novo | Integração | CA-07, CA-09, CA-12, INV-001, INV-006 |
| T05 | Totais da lista, filtros de pagamento sem os estornados, Painel e projeção pelo restante | Integração | CA-10, CA-11, INV-008 |
| T06 | Relatório de Contas com as colunas novas (CSV e PDF) | Unitário + integração | CA-10 |
| T07 | Permissões: pagamento com *criar*, estorno com *excluir* | Integração | CA-13 |
| T08 | Suporte e negócio suspenso: leitura, ações recusadas | Integração | CA-14, INV-007 |
| T09 | Gravação direta: motivo faltando, valores negativos, pago + descontos − acréscimos acima do total (o banco recusa) | Integração | INV-001, INV-004 |
| T10 | Roteiro no navegador: recebimento com a taxa sugerida, pagamento com juros, desconto parcial, estorno pelo detalhe e pelo fluxo, recebimento automático, lista, Painel, relatório | Manual com captura | CA-01 a CA-14 |
| T11 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção com login, e axe | Manual com captura | CA-15 |
| T12 | Homologação: uma venda real no cartão recebida com a taxa da maquininha e uma conta parcial antiga corrigida pelo estorno | Manual (uma vez) | CA-01, CA-07, CA-09 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 14/11/2026, em entrevista, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Onde informar o desconto e o acréscimo | **No pagamento** (recomendada): em cada pagamento ou recebimento, com o valor, a data e a forma. O valor original da conta não muda. Cobre a taxa da maquininha, os juros por atraso e o desconto por pagar antes. Descartadas: campos na própria conta, como no ERP da usuária; nos dois lugares. |
| **OPEN-002** — Como aparecem no caixa | **Só o valor real** (recomendada): um lançamento com o que entrou ou saiu. O desconto e o acréscimo ficam no pagamento e aparecem no detalhe, nos totais e no relatório de Contas. O caixa bate com o banco, sem categoria nova. Descartado: o lançamento do valor da conta e outro do desconto ou do acréscimo, que pediria uma categoria nova. |
| **OPEN-003** — Taxa da maquininha | **Sugerida e automática** (recomendada): o desconto vem preenchido pela taxa média da Calculadora (RF51) nas contas de venda no cartão, e o recebimento automático desconta a mesma taxa; sem taxa, nada muda. Descartadas: só digitada, com o recebimento automático pelo valor cheio; taxas por modalidade configuradas no negócio. |
| **OPEN-004** — Taxa das vendas no débito | **Na SPEC-029** (recomendada). A equipe confirmou que a maquininha passa vendas no crédito e no débito. Hoje o débito entra direto no caixa, sem conta a receber; quando a SPEC-029 fizer toda venda gerar conta a receber, o débito ganha a mesma taxa sugerida e automática. Até lá, o débito entra pelo valor cheio. Descartado: lançar o débito já com a taxa descontada nesta Spec, mexendo na venda. |
| **OPEN-005** — Motivo | **Lista curta** (recomendada): desconto com Taxa da maquininha, Desconto combinado ou Outro; acréscimo com Juros ou multa, ou Outro; Outro pede uma observação. O relatório mostra quanto foi de taxa e quanto foi de juros. Descartadas: observação livre; sem motivo. |
| **OPEN-006** — Juros e multa | **Só digitados** (recomendada): o acréscimo é o valor que veio no boleto. Descartado: multa e juros ao dia configurados na conta, com cálculo automático no atraso. |
| **OPEN-007** — Corrigir um pagamento errado | **Estornar o pagamento** (recomendada): quem tem *Financeiro: excluir* estorna um pagamento de conta; o caixa ganha o lançamento contrário, e a conta volta a ficar aberta ou parcial, sem o desconto e o acréscimo daquele pagamento. Nada é apagado. Descartado: manter o pagamento de conta sem estorno, como hoje. |
| **OPEN-008** — Permissão | **A do pagamento** (recomendada): quem registra pagamento (*Financeiro: criar*) informa o desconto e o acréscimo. Descartado: exigir *Financeiro: editar* para o desconto. |

**Decisões derivadas do pedido e da baseline (sem questão nova):**
- o desconto sugerido é o **restante × a taxa**, arredondado ao centavo, só nas contas de venda no cartão de crédito;
- vale a **taxa em vigor no dia do recebimento**; mudar a taxa não mexe nos recebimentos já feitos;
- a conta de cartão com **pagamento estornado** sai do recebimento automático, para que o recebimento certo seja registrado à mão;
- o **estorno** tem a data de hoje e repete a categoria e a forma do pagamento, como o estorno do lançamento avulso (SPEC-009);
- o pagamento estornado **não conta** nos filtros de data do pagamento e de forma, nem no total pago (SPEC-026);
- a conta manual com todos os pagamentos estornados volta a ser **editável e cancelável**;
- o **faturamento e o RBT12** continuam pelo valor da venda (RN21);
- **nos dois planos**; o relatório de Contas continua no plano pago;
- **suporte:** vê, nunca registra nem estorna (RN37); **negócio suspenso** recusa (RN39);
- **sem dado pessoal novo:** a Política de Privacidade não muda; as colunas novas entram na exportação dos dados (SPEC-014).

---

## 14. Definition of Done da Spec

A SPEC-028 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-15) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T12) estiverem aprovados, com o CI verde em cada PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-008 tiverem sido decididas e registradas (14/11/2026):
  - na baseline, RN44 incluída;
  - RF31, RF71, RF90, RN11, RN20 e RN22 alterados;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Implementação por etapas** (referência: até cerca de 400 linhas por revisão): (1) schema, domínio e pagamento com desconto e acréscimo; (2) taxa sugerida, recebimento automático e estorno; (3) lista, relatório, Painel, roteiro e evidências.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio. A divergência é registrada com duas propostas, (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
