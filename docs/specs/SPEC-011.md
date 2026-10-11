# SPEC-011 — Cancelamento e troca de venda

> **Status:** 🚧 **Aprovada e implementada em 11/10/2026; verificação na homologação pendente** — questões em aberto decididas pela equipe (seção 13), todas pela opção recomendada; testes T01–T12 automatizados e telas verificadas em build de produção com login (T13) — [evidências](evidencias/SPEC-011/README.md). Falta o T14 (fluxo na homologação). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-007](SPEC-007.md) (primitiva de estoque), [SPEC-008](SPEC-008.md) (venda, pagamentos, parcelas e baixas ligadas à venda) e [SPEC-009](SPEC-009.md) (contas, recebimentos e lançamentos) · **Próximas que dependem desta:** SPEC-012 (dashboard sem vendas canceladas).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-011 |
| **Nome** | Cancelamento e troca de venda |
| **Objetivo** | Cancelar uma venda inteira com motivo, numa única transação: a venda fica `CANCELADA` (nunca é apagada), o estoque volta exatamente pelas baixas da venda, as contas a receber ainda abertas são canceladas e o que já foi recebido é estornado. Opcionalmente, fazer a **troca** por itens de valor menor ou igual, com **crédito de troca** limitado ao que já foi recebido, reembolsando só a diferença. |
| **Valor entregue** | O empreendedor corrige erros e atende devoluções sem bagunçar estoque, caixa ou faturamento: tudo o que a venda movimentou é desfeito de forma rastreável, e a venda cancelada sai do RBT12, do faturamento e do CMV%. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF65 | Cancelar a venda inteira, com motivo obrigatório e registro de quem, quando e por quê; venda nunca apagada. |
| | RF66 | Troca opcional por itens de valor total ≤ ao da venda original; nova venda vinculada, com crédito de troca e reembolso da diferença na forma escolhida. Troca por valor maior fica fora do MVP. |
| **RN** | RN25 | Transação única: estoque devolvido, contas abertas canceladas, recebidos estornados; a venda cancelada sai do RBT12, do faturamento e do CMV%. |
| | RN26 | Crédito de troca ≤ valor já recebido; não gera lançamento; reembolso = recebido − crédito usado. |
| | RN06, RN09, RN10 | Itens da troca validam e baixam estoque; o restante da troca é pago como numa venda comum. |
| **RNF** | RNF05 | Cancelamento auditável: usuário, data, motivo, movimentações de estorno e lançamento de reembolso ligados à venda. |
| | RNF02 | Permissão de Vendas (OPEN-005) e isolamento por negócio. |
| **Caso de uso / fluxo** | UC18 Cancelar ou Trocar Venda | Diagrama 4 (sequência de cancelamento e troca) de `DIAGRAMAS_COMPORTAMENTAIS.md`. |
| **Entidades** | Venda, ItemVenda, Pagamento, Parcela, ContaPagarReceber, MovimentacaoEstoque, LancamentoFinanceiro, Usuario | Campos de cancelamento e troca já existem no schema. |
| **Drivers** | AD-CEN03, AD-RF03 | Integridade entre venda, estoque e financeiro. |
| **ADRs** | ADR-002, ADR-003 | Isolamento; autorização no servidor. |

---

## 3. Escopo

### Incluído

1. **Cancelar venda** a partir do detalhe da venda, com motivo (OPEN-002); sem limite de prazo, conforme o OPEN-001.
2. **Estorno de estoque:** uma `ENTRADA_ESTORNO` para cada `SAIDA_VENDA` da venda (produtos e materiais de serviços), com a mesma quantidade, pela primitiva da SPEC-007 — inclusive de itens arquivados depois.
3. **Contas a receber** da venda (parcelas do cartão) ainda `ABERTA` ou `PARCIAL` → `CANCELADA`.
4. **Recebido** = entradas imediatas da venda (Dinheiro, PIX, Débito) + o já recebido nas contas da venda (parcelas recebidas automaticamente ou antecipadas) [+ o crédito de troca usado, se a própria venda for uma troca — OPEN-006].
5. **Reembolso** = recebido − crédito de troca usado; gera **um** lançamento de saída "Vendas", ligado à venda, com a forma escolhida (OPEN-003).
6. **Troca** (RF66, RN26, OPEN-004): itens de substituição com valor total ≤ ao da venda original; nova venda vinculada (`vendaOrigemId`), paga com crédito de troca até o recebido e, se faltar, pelo restante em formas normais.
7. **Exibição:** a venda cancelada aparece marcada no histórico (fora do total, como já previsto na SPEC-008) e o detalhe mostra quem cancelou, quando, o motivo, o reembolso, os estornos de estoque e o link para a venda de troca (e vice-versa).
8. **Permissões** de Vendas (OPEN-005).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cancelamento parcial (só alguns itens) | Evolução futura — no MVP, cancela-se a venda inteira e, se for o caso, registra-se a troca ou uma nova venda |
| Troca por itens de valor maior que o da venda original | Fora do MVP (RF66) |
| Desconto da taxa de cartão no estorno | Fora do MVP (RN20) |
| Nota fiscal / devolução fiscal | Fora do sistema |
| Reabrir uma venda cancelada | Não permitido (a correção é uma nova venda) |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-007: `movimentar` (entrada com `exigirAtivo: false`) e a ligação `MovimentacaoEstoque.vendaId`.
  - SPEC-008: registro da venda em transação (reutilizado na troca), numeração sequencial, pagamentos, parcelas e contas a receber, formas de pagamento (`CREDITO_TROCA` reservado para esta Spec).
  - SPEC-009: `pagarConta`, status das contas, lançamentos imutáveis com origem, rotina que recebe parcelas no vencimento.
  - SPEC-005: matriz de permissões (Vendas — excluir/cancelar).
- **Decisões arquiteturais:** ADR-002, ADR-003.
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Cancelar (UC18, RF65, RN25)

1. No detalhe de uma venda `CONCLUIDA`, quem tem permissão (OPEN-005) clica em "Cancelar venda", informa o motivo e, se houver algo a reembolsar, a forma do reembolso. A tela mostra antes o que vai acontecer: itens que voltam ao estoque, contas que serão canceladas e o valor a reembolsar.
2. Numa transação:
   1. a venda passa a `CANCELADA` com `canceladaEm`, `canceladaPorId` e `motivoCancelamento` — por atualização condicional (`status = CONCLUIDA`), então dois cancelamentos simultâneos nunca acontecem;
   2. cada `SAIDA_VENDA` da venda vira uma `ENTRADA_ESTORNO` de mesma quantidade, ligada à venda;
   3. as contas a receber da venda em `ABERTA`/`PARCIAL` passam a `CANCELADA` (o já recebido nelas é mantido e entra no recebido);
   4. o reembolso, se > 0, vira um lançamento de saída (categoria Vendas, origem Estorno, `estorno = true`, `vendaId`, descrição "Reembolso da venda nº N — <forma>", usuário).
3. A venda cancelada deixa de contar no RBT12, no faturamento e no CMV% (as consultas da SPEC-010 já ignoram `CANCELADA`) e no total do histórico.

| Situação | Comportamento |
|---|---|
| Venda já cancelada | Recusado: "Esta venda já foi cancelada." |
| Motivo ausente ou inválido | Recusado, com mensagem no campo. |
| Recebido > 0 sem forma de reembolso | Recusado: "Escolha como o valor será devolvido." |
| Parcela sendo recebida pela rotina ao mesmo tempo | A conta fica travada pela transação que chegar primeiro; o recebido é lido depois de cancelar as contas, então nada é perdido nem contado duas vezes. |
| Item arquivado depois da venda | O estoque volta mesmo assim (`exigirAtivo: false`). |

### 5.2 Trocar (RF66, RN26)

1. Ao cancelar, a pessoa escolhe "Cancelar e trocar" e monta o carrinho da troca (OPEN-004). A tela mostra o valor da venda original, o recebido, o crédito disponível e o limite (valor da troca ≤ valor da venda original).
2. Na **mesma transação** do cancelamento:
   - crédito de troca = min(valor da troca, recebido) — pagamento `CREDITO_TROCA`, **sem lançamento** (o dinheiro já está no caixa desde a venda original);
   - se o crédito não cobrir a troca, o restante é pago em formas normais (Dinheiro, PIX, Débito, Crédito), com os efeitos da SPEC-008 (lançamento imediato ou contas a receber);
   - a nova venda recebe o próximo número, `vendaOrigemId` = venda original, itens com preço e custo oficiais do momento e as baixas de estoque (falta de estoque recusa a operação inteira);
   - reembolso = recebido − crédito usado (pode ser zero).
3. Exemplo do Diagrama 4: venda de R$ 100 no PIX trocada por item de R$ 70 → crédito R$ 70 (sem lançamento), reembolso R$ 30 (saída). Caixa da operação: + 100 − 30 = R$ 70.

| Situação | Comportamento |
|---|---|
| Valor da troca > valor da venda original | Recusado: "A troca precisa ter valor menor ou igual a R$ X (fora do MVP: troca por valor maior)." |
| Venda original no crédito sem nada recebido | Crédito de troca = 0; a troca é paga inteira em formas normais e as parcelas originais são canceladas. |
| Itens sem estoque ou sem preço | Recusado como na venda (SPEC-008); nada é cancelado. |
| Envio duplicado | O identificador do carrinho da troca torna a operação idempotente, como na SPEC-008. |

### 5.3 Validação

| Campo | Regra |
|---|---|
| Motivo | Conforme o OPEN-002; texto até 200 caracteres. |
| Forma do reembolso | Conforme o OPEN-003; obrigatória quando o reembolso > 0. |
| Carrinho da troca | Mesmas regras do carrinho da SPEC-008, sem data retroativa (a troca é registrada hoje) e com a soma ≤ valor da venda original. |

### 5.4 Datas

O cancelamento, os estornos de estoque, o reembolso e a venda de troca têm a data de **hoje**; a venda original mantém a sua data e sai do faturamento da competência dela (RN21, RN25).

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Cancelamento (e troca) é tudo ou nada: venda, estoque, contas, lançamento e nova venda numa transação. | Teste com falha simulada no último passo. |
| **INV-002** | Para cada item, Σ `ENTRADA_ESTORNO` da venda = Σ `SAIDA_VENDA` da venda; o saldo final do item volta ao que seria sem a venda. | Teste de integração com produto e serviço com materiais (receita alterada depois da venda). |
| **INV-003** | Após o cancelamento, nenhuma conta da venda fica `ABERTA` ou `PARCIAL`, e a rotina da SPEC-009 não recebe mais parcelas dela. | Teste + rotina executada depois. |
| **INV-004** | Recebido = entradas da venda + Σ valor pago nas contas da venda (+ crédito de troca, conforme o OPEN-006); reembolso = recebido − crédito usado ≥ 0; crédito ≤ recebido (RN26). | Testes com todas as combinações de forma de pagamento. |
| **INV-005** | O efeito líquido no caixa de "venda + cancelamento" é zero; de "venda + troca" é igual ao que a troca reteve. | Teste de integração com o saldo antes e depois. |
| **INV-006** | Uma venda é cancelada no máximo uma vez; a venda de troca aponta para uma única original (`vendaOrigemId` único). | Atualização condicional, restrição única existente e teste de concorrência. |
| **INV-007** | Vendas canceladas não entram no RBT12, no faturamento, no CMV% nem no total do histórico. | Testes das consultas das SPECs 008 e 010. |
| **INV-008** | Toda escrita passa pelo cliente do negócio e pela permissão de Vendas definida no OPEN-005. | Varredura da SPEC-005 e testes. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Venda` | `status`, `canceladaEm`, `canceladaPorId`, `motivoCancelamento`, `vendaOrigemId`, `valorTotal`, `numero` | Nunca apagada; cancelada uma vez. |
| `MovimentacaoEstoque` | `ENTRADA_ESTORNO`, `vendaId`, quantidades e saldos | Somente inserção (SPEC-007). |
| `ContaPagarReceber` | contas das parcelas da venda | `CANCELADA` sem novos recebimentos. |
| `Pagamento` | `CREDITO_TROCA` na venda de troca | Sem lançamento (RN26). |
| `LancamentoFinanceiro` | saída de reembolso com `estorno = true`, origem `ESTORNO`, `vendaId` | Somente inserção (SPEC-009). |

**Mudanças previstas no schema:** nenhuma obrigatória — os campos de cancelamento, `vendaOrigemId`, `CREDITO_TROCA`, `ENTRADA_ESTORNO` e `estorno` já existem. Previstos:

- `CHECK` em `Venda`: `status = 'CANCELADA'` ⇔ `canceladaEm`, `canceladaPorId` e `motivoCancelamento` preenchidos.
- Gatilho que recusa alterar uma venda já `CANCELADA` (fora o próprio cancelamento), para a auditoria (RNF05).

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/venda.ts` — recebido, crédito de troca e reembolso (funções puras);
  - `src/lib/db/vendas.ts` — `cancelar` (transação única) e a extração do núcleo do registro da venda para ser reutilizado dentro da transação da troca;
  - `src/lib/vendas/` — validação, fluxos e Server Actions de cancelamento e troca;
  - `src/app/(app)/vendas/[id]/` — botão e tela de cancelamento/troca; detalhe com o comprovante;
  - frente de caixa (SPEC-008) em modo troca, conforme o OPEN-004.
- **Fronteiras:** reutiliza `movimentar` (SPEC-007) e o registro da venda (SPEC-008) dentro da mesma transação; não usa `pagarConta` (o cancelamento não paga contas, só as encerra).
- **Integrações:** nenhuma.
- **Identidade visual:** venda cancelada com selo (ícone + texto, nunca só cor); valores de reembolso com sinal, como no Financeiro.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Prévia do cancelamento** | venda | itens a devolver, contas a cancelar, recebido, crédito máximo | `NaoEncontrada`, `JaCancelada`, `SemPermissao` |
| **Cancelar** | venda, motivo, forma do reembolso | venda cancelada, reembolso | `JaCancelada`, `MotivoInvalido`, `FormaDeReembolsoAusente`, `SemPermissao` |
| **Cancelar e trocar** | venda, motivo, carrinho da troca (id, itens, pagamentos do restante), forma do reembolso | venda cancelada, nova venda, crédito usado, reembolso | os de cima + `TrocaAcimaDoOriginal`, os da venda (estoque, preço, soma) |

**Implementação (11/10/2026):**
- regras puras (`acertoDoCancelamento`, motivos e formas de reembolso) em `src/lib/dominio/venda.ts`;
- `cancelar` e `previaDoCancelamento` em `src/lib/db/vendas.ts`, com o registro da venda dividido em `prepararVenda` e `gravarVenda` para a troca gravar a nova venda dentro da transação do cancelamento;
- validação, fluxos e Server Actions em `src/lib/vendas/`;
- telas `src/app/(app)/vendas/[id]/cancelar` e `trocar`, o detalhe da venda com o comprovante e a frente de caixa em modo troca;
- migração `20261011150000_cancelamento`.

**Divergências registradas na implementação:**

- **CHECK e gatilho em `Venda`:** "cancelada se e somente se quem, quando e motivo estiverem preenchidos", e uma venda cancelada não pode mais ser alterada (`he_venda_cancelada_imutavel`). Um teste da SPEC-010 que criava venda cancelada sem esses campos foi ajustado.
- **Ordem na transação:** primeiro o status (atualização condicional), depois o estorno do estoque, as contas e só então o recebido. Assim, a troca do **mesmo item** usa o estoque devolvido, e a tela de troca já soma as devoluções ao saldo exibido.
- **Reenvio da troca:** o id do carrinho da troca é o id da nova venda. Se dois envios correm juntos, o segundo encontra a venda já cancelada ou o id já usado e devolve a troca gravada pelo primeiro (falha encontrada pelo teste de concorrência e corrigida).
- **Reembolso no extrato do caixa:** o lançamento tem origem `ESTORNO`, `estorno = true` e `vendaId`, e a lista do Financeiro passou a mostrar a descrição dele ("Reembolso da venda nº N — forma"), com o link para a venda, em vez de "Venda nº N".
- **"Troca" fica fora da lista do "Só cancelar"**: o motivo "Troca" é o padrão na tela de troca.
- **Venda no crédito sem nada recebido:** cancela sem pedir a forma de reembolso (não há o que devolver).

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Tela de cancelamento/troca e detalhe responsivos; selo de cancelada com ícone e texto. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF02** | Permissão de Vendas no servidor; isolamento. | INV-008. |
| **RNF05** | Quem, quando, motivo, estornos e reembolso ligados à venda. | Testes e detalhe da venda. |
| **RNF06** | Cancelar uma venda de 20 linhas com materiais em menos de 2 s. | Teste de integração. |

---

## 11. Critérios de aceitação

**CA-01 — Cancelar à vista.** Dada uma venda de R$ 36 no PIX com 2 esmaltes, quando cancelada com motivo, então a venda fica Cancelada (com quem, quando e o motivo), o estoque volta 2, há uma saída de R$ 36 "Reembolso da venda nº N" e o saldo do caixa volta ao anterior.

**CA-02 — Serviço com materiais.** Dado um serviço vendido que baixou 0,25 de esmalte e 1 algodão, mesmo que a receita do serviço tenha mudado depois, quando a venda é cancelada, então voltam exatamente 0,25 e 1.

**CA-03 — Crédito parcelado.** Dada uma venda de R$ 300 no crédito em 3x com a 1ª parcela já recebida, quando cancelada, então as 2 contas abertas ficam Canceladas, o reembolso é R$ 100 e a rotina diária não recebe mais as parcelas.

**CA-04 — Troca menor.** Dada uma venda de R$ 100 no PIX, quando trocada por um item de R$ 70, então há uma nova venda nº N+1 vinculada, paga com R$ 70 de crédito de troca (sem lançamento), e um reembolso de R$ 30; o caixa da operação fica em R$ 70.

**CA-05 — Crédito limitado ao recebido.** Dada uma venda de R$ 300 no crédito em 3x com só a 1ª parcela recebida (R$ 100), quando trocada por itens de R$ 250, então o crédito de troca é R$ 100 e os R$ 150 restantes são pagos em outra forma; reembolso R$ 0.

**CA-06 — Troca maior recusada.** Dada uma venda de R$ 100, quando a troca soma R$ 120, então é recusada e nada é cancelado.

**CA-07 — Tudo ou nada.** Dada uma troca com um item sem estoque (ou uma falha simulada no último passo), então nada muda: a venda continua Concluída, sem estornos nem lançamentos.

**CA-08 — Uma vez só.** Dados dois cancelamentos simultâneos da mesma venda, então só um acontece; cancelar de novo é recusado.

**CA-09 — Fora dos números.** Dada uma venda cancelada, então ela aparece marcada no histórico, fora do total do período, e não conta no RBT12, no faturamento nem no CMV% da Calculadora.

**CA-10 — Permissões.** Dado um Colaborador predefinido (Vendas: ver e criar), então ele não vê "Cancelar venda" e a ação chamada diretamente é recusada; com a permissão do OPEN-005, consegue.

**CA-11 — Visual.** Dadas as telas desta Spec, em 390, 768 e 1440 px, claro e escuro, então seguem os tokens, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Recebido, crédito de troca e reembolso para todas as combinações de formas | Unitário | INV-004 |
| T02 | Validação do motivo, da forma do reembolso e do carrinho da troca | Unitário | — |
| T03 | Cancelar à vista: status, auditoria, estorno de estoque, reembolso, saldo | Integração | CA-01, INV-005 |
| T04 | Serviço com materiais e receita alterada; item arquivado | Integração | CA-02, INV-002 |
| T05 | Crédito parcelado com parcela recebida; rotina depois do cancelamento | Integração | CA-03, INV-003 |
| T06 | Troca menor, crédito limitado ao recebido, troca maior recusada | Integração | CA-04 a CA-06 |
| T07 | Tudo ou nada (sem estoque na troca, falha simulada) | Integração | CA-07, INV-001 |
| T08 | Cancelamentos simultâneos; troca duplicada (idempotência) | Integração | CA-08, INV-006 |
| T09 | Vendas canceladas fora do histórico, do RBT12 e do CMV% | Integração | CA-09, INV-007 |
| T10 | Cancelar venda de troca (OPEN-006) | Integração | INV-004 |
| T11 | Permissões (ações direto, botão, Colaborador) | Unitário + integração | CA-10, INV-008 |
| T12 | Cancelar venda de 20 linhas com materiais em menos de 2 s | Integração | RNF06 |
| T13 | Telas em 390/768/1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-11 |
| T14 | Fluxo completo na homologação | Manual (uma vez) | CA-01 a CA-10 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 11/10/2026, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Prazo para cancelar | **Sem prazo**: qualquer venda concluída pode ser cancelada; os efeitos têm a data de hoje. |
| **OPEN-002** — Motivo | **Lista** (Erro no registro, Devolução, Troca, Desistência do cliente, Outro) **+ detalhe** opcional, obrigatório em "Outro". |
| **OPEN-003** — Forma do reembolso | **Um lançamento de saída** com a forma escolhida (Dinheiro, PIX, Débito ou Estorno no cartão) registrada na descrição. |
| **OPEN-004** — Como montar a troca | **Frente de caixa da SPEC-008 em modo troca**, com o crédito já aplicado e o limite do valor original. |
| **OPEN-005** — Permissões | **Cancelar: Vendas — excluir/cancelar; trocar: excluir/cancelar + criar.** |
| **OPEN-006** — Cancelar uma venda de troca | **Pode**, e o crédito de troca usado entra no recebido (é reembolsado). O RN25 ("exceto crédito de troca") é entendido como "o crédito não gera lançamento de entrada". |

---|---|---|---|
| **OPEN-001** — Prazo para cancelar | Há limite de tempo? | (a) **Sem prazo**: qualquer venda concluída pode ser cancelada; os efeitos têm a data de hoje; (b) até 90 dias depois da venda (como a data retroativa do Financeiro) | **(a)** — erros e devoluções podem aparecer tarde; a auditoria (quem, quando, motivo) e a data de hoje nos estornos mantêm o histórico correto. |
| **OPEN-002** — Motivo | Livre ou de uma lista? | (a) **Lista** (Erro no registro, Devolução, Troca, Desistência do cliente, Outro) + detalhe opcional, obrigatório em "Outro"; (b) texto livre obrigatório | **(a)** — padroniza os relatórios futuros (ex.: quantas devoluções) e é mais rápido no balcão; o detalhe cobre os casos raros. |
| **OPEN-003** — Forma do reembolso | Como registrar a devolução do dinheiro? | (a) **Um lançamento de saída** com a forma escolhida (Dinheiro, PIX, Débito ou Estorno no cartão) registrada na descrição; (b) estornar cada recebimento automaticamente na forma original | **(a)** — reflete o que acontece no balcão (devolve-se de uma vez, muitas vezes em outra forma) e mantém um único lançamento auditável. |
| **OPEN-004** — Como montar a troca | Onde escolher os itens de substituição? | (a) **Na frente de caixa da SPEC-008, em modo troca**, com o crédito já aplicado e o limite do valor original; (b) uma lista simples de itens e quantidades no formulário de cancelamento | **(a)** — reaproveita a busca, o aviso de estoque e o pagamento misto já testados; a troca é uma venda. |
| **OPEN-005** — Permissões | Quais ações exigem? | (a) **Cancelar: Vendas — excluir/cancelar; trocar: excluir/cancelar + criar**; (b) as duas só com excluir/cancelar | **(a)** — a troca registra uma venda nova, então também exige poder vender; o Colaborador predefinido continua sem cancelar (RF65). |
| **OPEN-006** — Cancelar uma venda de troca | O crédito de troca volta? | (a) **Pode cancelar, e o crédito de troca usado entra no recebido (é reembolsado)** — esse dinheiro ficou no caixa desde a venda original; (b) a venda de troca não pode ser cancelada | **(a)** — sem isso o cliente perderia o valor; o RN25 ("exceto crédito de troca") é entendido como "o crédito não gera lançamento de entrada", não como "o crédito não é devolvido". Registrar a interpretação. |

---

## 14. Definition of Done da Spec

A SPEC-011 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-11) estiverem implementados — por testes e em build de produção com login; falta conferir na homologação (T14);
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T14) estiverem aprovados, com o CI verde no PR — T01 a T12 automatizados; T13 com capturas; T14 pendente;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
