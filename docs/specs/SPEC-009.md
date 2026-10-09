# SPEC-009 — Financeiro: caixa, contas e despesas fixas

> **Status:** 📝 **Rascunho para aprovação (09/10/2026)** — gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar). As questões em aberto da seção 13 trazem uma **recomendação**, mas a decisão é da equipe. Nenhuma implementação antes da aprovação.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-005](SPEC-005.md) (permissões) e [SPEC-008](SPEC-008.md) (vendas, que já geram lançamentos e contas a receber) · **Próximas que dependem desta:** SPEC-010 (despesas fixas na calculadora), SPEC-011 (estorno de recebidos) e SPEC-012 (saldo e projeção no dashboard).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-009 |
| **Nome** | Financeiro: caixa, contas e despesas fixas |
| **Objetivo** | Mostrar o **fluxo de caixa** com entradas, saídas e saldo real (só o que foi efetivamente recebido ou pago — RN14); permitir lançar entradas e saídas avulsas (ex.: despesa operacional — UC12a); cadastrar **contas a pagar e a receber** e registrar pagamentos e recebimentos, inclusive parciais, cada um gerando um lançamento (RN22); e cadastrar as **despesas fixas** mensais — incluindo o DAS do MEI —, que geram uma conta a pagar por mês automaticamente (RF67). |
| **Valor entregue** | O empreendedor vê o saldo real do caixa e os compromissos futuros (contas a vencer e atrasadas), sem lançar nada duas vezes: vendas e contas alimentam o caixa sozinhas. As despesas fixas passam a existir para a calculadora (SPEC-010) e o dashboard (SPEC-012). |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF29 | Fluxo de caixa com entradas, saídas e saldo. |
| | RF30 | Contas a pagar e a receber com vencimento e categoria; as das vendas usam "Vendas". |
| | RF31 | Pagamento e recebimento parciais, mantendo o restante em aberto. |
| | RF32 | Categorias fixas: Vendas, Fornecedores, Impostos, Salário, Outros. |
| | RF33 | Vendas já geram lançamentos (SPEC-008); aqui eles aparecem no caixa, sem duplicar. |
| | RF48 | Cadastro das despesas fixas mensais (descrição e valor). |
| | RF60 | DAS do MEI como despesa fixa automática, com o valor do parâmetro oficial (SPEC-003) (OPEN-005). |
| | RF67 | Uma conta a pagar por mês para cada despesa fixa ativa, sem duplicar, por rotina diária e conferência ao acessar (OPEN-08 do Mapa). |
| | RF06 | Permissões granulares do módulo Financeiro (ex.: Colaborador que só lança despesa operacional, sem ver o saldo) (OPEN-006). |
| **RN** | RN14 | Saldo = só valores efetivamente recebidos ou pagos. |
| | RN22 | Todo pagamento/recebimento de conta gera um lançamento vinculado, com a categoria da conta; o status da conta é a única verdade sobre parcelas de cartão. |
| | RN13 | Lançamentos e contas de venda usam "Vendas". |
| | RN29 | Datas em UTC; dia e competência em America/Sao_Paulo. |
| **RNF** | RNF02 | Isolamento e permissões do módulo **Financeiro** (SPEC-005). |
| | RNF05 | Lançamentos auditáveis (quem, quando, descrição) e imutáveis, com correção por estorno (OPEN-003). |
| | RNF01, RNF06 | Telas responsivas; caixa e contas rápidos com milhares de registros. |
| **Caso de uso / fluxo** | UC12 Consultar Fluxo de Caixa, UC12a Registrar Despesa Operacional, UC13 Gerenciar Contas a Pagar e Receber, UC16 Gerenciar Despesas Fixas | Diagrama 3 (estados da conta) de `DIAGRAMAS_COMPORTAMENTAIS.md`. |
| **Entidades** | LancamentoFinanceiro, ContaPagarReceber, Parcela, DespesaFixa, ParametroMei | Operacionais (exceto ParametroMei, global — SPEC-003). |
| **Drivers** | AD-RF01, AD-RF03 | Gestão integrada; venda → financeiro. |
| **ADRs** | ADR-002, ADR-004 | Isolamento; parâmetro do DAS pela tabela fiscal. |

---

## 3. Escopo

### Incluído

1. **Fluxo de caixa** (`/financeiro`):
   - lançamentos do período (padrão: este mês, no fuso de São Paulo), com data, descrição, categoria, origem (venda, conta, avulso, saldo inicial, estorno) e valor com sinal;
   - totais do período: entradas, saídas e resultado;
   - **saldo atual** (todos os lançamentos até hoje — RN14) e saldo no início do período;
   - filtros por categoria e por tipo (entradas/saídas).
2. **Saldo inicial** do caixa, informado uma vez (OPEN-001).
3. **Lançamento avulso** (UC12a): entrada ou saída com valor, categoria, descrição e data (OPEN-002, OPEN-007). Lançamentos nunca são alterados nem apagados; um lançamento avulso errado é corrigido por **estorno** (OPEN-003).
4. **Contas a pagar e a receber** (`/financeiro/contas`):
   - lista com abas *A pagar* / *A receber*, situação (aberta, parcial, quitada, cancelada) e "atrasada" (derivada: vencimento < hoje e valor pago < total);
   - nova conta manual: tipo, descrição, categoria, valor, vencimento;
   - **registrar pagamento/recebimento**, total ou parcial (valor ≤ restante, data — OPEN-007), que gera o lançamento e atualiza a situação (Diagrama 3);
   - editar ou cancelar uma conta **manual** ainda sem pagamento (OPEN-003); contas de venda e de despesa fixa não são editadas aqui.
5. **Parcelas do cartão** (contas a receber geradas pela venda): recebidas conforme o OPEN-008.
6. **Despesas fixas** (`/financeiro/despesas-fixas`): descrição, valor mensal, dia de vencimento (1 a 31; em meses mais curtos, o último dia), categoria; ativar/desativar. Alterar o valor vale para as contas dos próximos meses.
7. **DAS do MEI** como despesa fixa automática (OPEN-005).
8. **Geração das contas mensais** (RF67): rotina diária (Vercel Cron, protegida por segredo) + conferência ao abrir o Financeiro e o Painel; no máximo uma conta por despesa e competência (restrição única já existente).
9. **Permissões** do módulo Financeiro (OPEN-006) e itens "Financeiro" no menu.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Parâmetros de precificação (taxa de cartão, margem meta, capacidade, ticket médio) e Desp. Fixas% | SPEC-010 (usa o total das despesas fixas desta Spec) |
| Estorno dos recebidos de uma venda cancelada e cancelamento das contas a receber dela (RN25) | SPEC-011 |
| Saldo, projeção de caixa e gráficos no dashboard | SPEC-012 (reaproveita as consultas desta Spec) |
| Conciliação bancária, importação de extrato (OFX), várias contas bancárias/carteiras | Evolução futura |
| Taxa de maquininha descontada do recebimento | Fora do MVP (RN11, RN20) |
| Relatórios avançados e exportação | SPEC-013 (plano pago) |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-003: `ParametroMei` (DAS por atividade e vigência).
  - SPEC-004: regime e atividade do MEI do negócio.
  - SPEC-005: matriz módulo × ação, guardas, fábrica de ações, menu.
  - SPEC-008: lançamentos de venda (entrada imediata) e parcelas com contas a receber.
- **Decisões arquiteturais:** ADR-002, ADR-004, OPEN-08 do Mapa (rotina diária + conferência ao acessar).
- **Pré-requisitos externos:** Vercel Cron (plano gratuito permite uma execução diária) e o segredo `CRON_SECRET` na Vercel.

---

## 5. Comportamento esperado

### 5.1 Fluxo de caixa (UC12, RF29, RN14)

- O **saldo atual** é Σ entradas − Σ saídas de todos os lançamentos com data até hoje. Contas a receber ainda não recebidas (inclusive as parcelas do cartão antes do recebimento) nunca entram no saldo.
- O período mostra o saldo no início, as entradas, as saídas, o resultado e o saldo no fim.
- Cada lançamento mostra a origem com link: venda (nº), conta (descrição), avulso, saldo inicial ou estorno.

### 5.2 Lançamento avulso (UC12a) e estorno

1. Quem tem permissão (OPEN-006) informa tipo (entrada/saída), valor, categoria, descrição e data.
2. O lançamento é gravado com o usuário que registrou.
3. Para corrigir um avulso errado, "Estornar" grava um lançamento contrário, de mesmo valor e categoria, com a descrição "Estorno de: …" e o vínculo com o original; o original fica marcado como estornado e não pode ser estornado de novo (OPEN-003).

### 5.3 Contas a pagar e a receber (UC13, RF30, RF31, RN22)

- **Nova conta manual:** tipo, descrição, categoria, valor (> 0), vencimento.
- **Registrar pagamento/recebimento:** valor (> 0 e ≤ restante) e data. Numa transação:
  - grava o lançamento (Entrada para a receber, Saída para a pagar), com a categoria da conta e o vínculo `contaId`;
  - soma ao `valorPago` e atualiza o status: `PARCIAL` se ainda falta, `QUITADA` se completou (Diagrama 3);
  - pagamentos simultâneos nunca ultrapassam o total (atualização condicional, como no estoque).
- **Editar/cancelar** (OPEN-003): só contas manuais sem nenhum pagamento; cancelar muda o status para `CANCELADA` (nada é apagado).
- **Atrasada:** exibida quando vencimento < hoje e valor pago < total, em `ABERTA` ou `PARCIAL`.

| Situação | Comportamento |
|---|---|
| Valor maior que o restante | Recusado: "O restante desta conta é R$ X". |
| Conta quitada ou cancelada | Não aceita novo pagamento. |
| Editar/cancelar conta de venda, de despesa fixa ou já com pagamento | Recusado, com a explicação. |
| Pagamentos simultâneos que somam mais que o total | Só os que cabem são gravados. |

### 5.4 Parcelas do cartão (RN10, RN14, RN22)

Conforme o OPEN-008 (recomendação: recebidas **automaticamente** no vencimento pela rotina diária e pela conferência ao acessar — a maquininha deposita sem ação do usuário): na data de vencimento, a conta a receber da parcela é quitada e gera o lançamento de entrada com a data do vencimento. O usuário pode registrar o recebimento antes (antecipação), pelo fluxo normal de 5.3.

### 5.5 Despesas fixas e geração mensal (UC16, RF48, RF67)

- **Cadastro:** descrição, valor mensal (> 0), dia de vencimento (1–31), categoria (padrão Outros). Desativar interrompe as próximas contas; as já geradas continuam.
- **Geração:** para cada despesa ativa e cada competência a partir da primeira (OPEN-004) até o mês atual, existe no máximo uma conta a pagar com o valor da despesa (ou do DAS vigente), a categoria e o vencimento no dia escolhido (último dia do mês se ele não existir), com descrição "<despesa> — MM/AAAA".
- **Quando roda:** rotina diária (`/api/rotinas/diaria`, protegida por `CRON_SECRET`) para todos os negócios, e conferência do negócio ativo ao abrir o Financeiro e o Painel. A restrição única (despesa, competência) impede duplicar, mesmo com as duas rodando juntas.
- **Mudança de valor:** vale para as competências ainda não geradas; contas já geradas não mudam.

### 5.6 DAS do MEI (RF60, OPEN-005)

- Negócio MEI tem uma despesa fixa automática "DAS do MEI" (origem `DAS_MEI`, categoria Impostos, vencimento dia 20), sem valor próprio: cada conta usa o DAS vigente na competência para a atividade do MEI (`ParametroMei`, SPEC-003).
- Ela é criada na primeira conferência; deixa de gerar contas se o negócio deixar de ser MEI; não pode ser editada nem excluída, só o dia de vencimento.

### 5.7 Validação

| Campo | Regra |
|---|---|
| Valor (lançamento, conta, pagamento, despesa) | > 0, até R$ 9.999.999,99, 2 casas. Aceita "1.234,56". |
| Categoria | Uma das 5 (RF32). |
| Descrição | Obrigatória no avulso, na conta e na despesa; até 120 caracteres. |
| Data do lançamento / pagamento | Conforme o OPEN-007. |
| Vencimento da conta | Data válida (pode ser passada ou futura). |
| Dia de vencimento da despesa | Inteiro de 1 a 31. |
| Saldo inicial | Valor ≥ 0 (positivo = dinheiro em caixa) e data; uma vez por negócio (OPEN-001). |

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Saldo = Σ entradas − Σ saídas dos lançamentos até hoje; contas a receber não recebidas nunca entram (RN14). | Testes com vendas no crédito e contas abertas. |
| **INV-002** | Todo pagamento/recebimento de conta gera exatamente um lançamento com a categoria da conta e o `contaId`, na mesma transação que atualiza `valorPago` e o status (RN22). | Teste de integração e falha simulada. |
| **INV-003** | `0 ≤ valorPago ≤ valorTotal`; status coerente: `ABERTA` (0), `PARCIAL` (entre), `QUITADA` (= total), `CANCELADA` (sem novos pagamentos). | Restrição `CHECK` no banco e testes, inclusive de concorrência. |
| **INV-004** | Para cada conta, `valorPago` = Σ dos lançamentos vinculados a ela (líquidos de estornos). | Teste de integração após sequência de pagamentos. |
| **INV-005** | No máximo uma conta por despesa fixa e competência, mesmo com a rotina e a conferência simultâneas. | Restrição única existente e teste com execuções em paralelo. |
| **INV-006** | Lançamentos nunca são alterados nem apagados; correção só por estorno, e cada lançamento é estornado no máximo uma vez (OPEN-003). | Gatilho no banco e teste direto. |
| **INV-007** | Toda leitura e escrita passa pelo cliente do negócio e pela permissão do Financeiro correspondente; a rotina diária só roda com o segredo correto. | Varredura da SPEC-005, testes e teste da rota sem segredo. |
| **INV-008** | Contas geradas pela venda (parcelas) e por despesa fixa não são editadas nem canceladas por esta Spec. | Teste de integração. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `LancamentoFinanceiro` | `tipo`, `categoria`, `valor`, `data`, `vendaId`, `contaId`, `estorno`, novos campos abaixo | Somente inserção (INV-006). |
| `ContaPagarReceber` | `tipo`, `categoria`, `descricao`, `valorTotal`, `valorPago`, `vencimento`, `status`, `parcelaId`, `despesaFixaId`, `competencia` | Status pelo Diagrama 3. |
| `DespesaFixa` | `descricao`, `valorMensal`, `diaVencimento`, `categoria`, `origem` (MANUAL/DAS_MEI), `ativo` | Uma conta por competência. |
| `ParametroMei` | DAS por atividade e vigência | Valor das contas do DAS (OPEN-005). |

**Mudanças previstas no schema (dependem das decisões da seção 13):**

- `LancamentoFinanceiro`: `descricao String?` (até 120), `usuarioId String?` (quem registrou; nulo só nos automáticos da rotina), `origem` (enum: VENDA, CONTA, AVULSO, SALDO_INICIAL, ESTORNO) e `estornoDeId String? @unique` (vínculo do estorno com o original — OPEN-003).
- `ContaPagarReceber`: `criadaPorId String?` (contas manuais).
- `DespesaFixa.valorMensal` passa a aceitar nulo para o DAS do MEI (valor vem do parâmetro) — ou um valor de referência atualizado na geração (decisão de implementação, registrada).
- `CHECK` no banco: `LancamentoFinanceiro.valor > 0`, `ContaPagarReceber.valorTotal > 0`, `0 <= valorPago <= valorTotal`, `DespesaFixa.diaVencimento BETWEEN 1 AND 31`.
- Gatilho `he_somente_insercao` em `LancamentoFinanceiro` (OPEN-003).
- Índices `(negocioId, vencimento, status)` em `ContaPagarReceber`.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/financeiro.ts` — saldo, situação e "atrasada", competências e vencimentos das despesas, validação de valores — puras;
  - `src/lib/financeiro/` — validação, fluxos (lançar, estornar, contas, pagar, despesas) e Server Actions com `acaoComPermissao("financeiro", …)`;
  - `src/lib/db/financeiro.ts` — consultas pelo cliente do negócio, pagamento condicional de conta, geração mensal idempotente;
  - `src/lib/rotinas/` e `src/app/api/rotinas/diaria/route.ts` — rotina diária (todos os negócios) protegida por `CRON_SECRET`; `vercel.json` com o agendamento;
  - `src/app/(app)/financeiro/` — caixa, contas, despesas fixas e lançamento avulso;
  - Painel: conferência das contas mensais ao abrir;
  - `src/lib/equipe/menu.ts` — "Financeiro";
  - migração da seção 7.
- **Fronteiras:**
  - A rotina diária é a única parte que roda **fora** do contexto de um negócio: ela percorre os negócios e, para cada um, usa as mesmas funções da conferência (com o cliente do negócio daquele negócio).
  - Atualização condicional do `valorPago` (como a baixa do estoque) para pagamentos simultâneos.
- **Integrações:** Vercel Cron.
- **Identidade visual:** sem protótipo; tokens e componentes já usados; valores de entrada em verde e de saída em vermelho, sempre com sinal e texto (nunca só cor — RNF01).

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Fluxo de caixa** | período, filtros | lançamentos, totais, saldo inicial e final do período, saldo atual | `SemPermissao` |
| **Lançar avulso** | tipo, valor, categoria, descrição, data | lançamento | `CampoInvalido`, `SemPermissao` |
| **Estornar** | id do lançamento avulso | lançamento de estorno | `JaEstornado`, `NaoEstornavel` (venda/conta), `NaoEncontrado`, `SemPermissao` |
| **Saldo inicial** | valor, data | lançamento | `JaInformado`, `CampoInvalido`, `SemPermissao` |
| **Listar contas** | tipo, situação, período de vencimento | contas com restante e "atrasada" | `SemPermissao` |
| **Criar / editar / cancelar conta manual** | dados | conta | `CampoInvalido`, `ContaNaoEditavel`, `NaoEncontrado`, `SemPermissao` |
| **Registrar pagamento** | conta, valor, data | lançamento, conta atualizada | `ValorAcimaDoRestante`, `ContaEncerrada`, `NaoEncontrado`, `SemPermissao` |
| **Despesas fixas** | dados / ativo | despesa | `CampoInvalido`, `DasNaoEditavel`, `SemPermissao` |
| **Conferir contas do mês** (negócio ativo) / **rotina diária** (todos) | hoje | contas criadas, parcelas recebidas | `SegredoInvalido` (rota) |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Caixa, contas e despesas responsivos; entrada/saída com sinal e texto. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF02** | Isolamento e permissões do Financeiro; rotina protegida. | INV-007 por testes. |
| **RNF05** | Lançamentos com usuário e descrição, imutáveis, com estorno. | INV-006. |
| **RNF06** | Caixa de um mês com 5.000 lançamentos e lista de 2.000 contas em menos de 2 s; rotina diária com 100 negócios em menos de 30 s. | Testes de integração. |

---

## 11. Critérios de aceitação

**CA-01 — Saldo real.** Dadas uma venda de R$ 50 em PIX e outra de R$ 300 no crédito em 3x, então o saldo atual é R$ 50 (as parcelas não entram) e as três contas a receber aparecem em *A receber*.

**CA-02 — Saldo inicial.** Dado o saldo inicial de R$ 1.000 informado, então o saldo passa a R$ 1.050 e o saldo inicial não pode ser informado de novo.

**CA-03 — Despesa operacional.** Dada uma saída avulsa de R$ 80 em "Fornecedores", "Compra de esmaltes", então o saldo cai R$ 80 e o lançamento mostra a descrição e quem registrou.

**CA-04 — Estorno.** Dado um avulso errado, quando é estornado, então um lançamento contrário de mesmo valor é gravado, o saldo volta ao anterior e um segundo estorno é recusado. O banco recusa alterar ou apagar lançamentos.

**CA-05 — Pagamento parcial.** Dada uma conta a pagar de R$ 300, quando são pagos R$ 100, então ela fica `PARCIAL` com R$ 200 restantes e há uma saída de R$ 100 com a categoria da conta; pagando R$ 200, fica `QUITADA`. Um pagamento acima do restante é recusado.

**CA-06 — Concorrência.** Dados dois pagamentos simultâneos de R$ 200 numa conta de R$ 300, então só um é gravado.

**CA-07 — Atrasada.** Dada uma conta aberta com vencimento ontem, então ela aparece como atrasada; quitada, deixa de aparecer como atrasada.

**CA-08 — Despesa fixa.** Dada a despesa "Aluguel", R$ 1.200, dia 5, cadastrada hoje, então existe a conta a pagar "Aluguel — MM/AAAA" do mês conforme o OPEN-004; rodar a rotina e a conferência de novo (inclusive juntas) não cria outra.

**CA-09 — DAS do MEI.** Dado um negócio MEI de serviços, então existe a despesa "DAS do MEI" e a conta do mês tem o valor do DAS vigente (R$ 86,05 em 2026); um negócio do Simples não tem essa despesa.

**CA-10 — Parcelas do cartão.** Dada uma parcela com vencimento hoje, quando a rotina (ou a conferência) roda, então ela fica `QUITADA` e há uma entrada na data do vencimento (OPEN-008); uma parcela futura continua a receber.

**CA-11 — Contas protegidas.** Dada uma conta de venda, de despesa fixa ou com pagamento, quando se tenta editá-la ou cancelá-la, então é recusado.

**CA-12 — Rotina protegida.** Dada uma chamada à rotina diária sem o segredo (ou com o errado), então responde 401 e nada é gerado.

**CA-13 — Permissões.** Dado um Colaborador com só *Financeiro: criar* (RF06), então ele lança uma despesa operacional, mas não vê o caixa, o saldo nem as contas; sem *Financeiro: ver*, o menu não mostra "Financeiro" (só "Lançar despesa").

**CA-14 — Visual.** Dadas as telas desta Spec, quando exibidas em 390, 768 e 1440 px, nos temas claro e escuro, então seguem os tokens da identidade, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Saldo, resultado do período, situação e "atrasada", competências, dia de vencimento em meses curtos | Unitário | CA-01, CA-07 |
| T02 | Validação (valores, categorias, descrição, datas, dia 1–31) | Unitário | — |
| T03 | Saldo com vendas à vista e a prazo e com saldo inicial | Integração | CA-01, CA-02, INV-001 |
| T04 | Avulso, estorno, segundo estorno recusado, imutabilidade no banco | Integração | CA-03, CA-04, INV-006 |
| T05 | Pagamento parcial e total; acima do restante; conta quitada/cancelada | Integração | CA-05, INV-002 a INV-004 |
| T06 | Pagamentos simultâneos | Integração | CA-06, INV-003 |
| T07 | Despesa fixa: geração idempotente (rotina + conferência em paralelo), mudança de valor, desativação | Integração | CA-08, INV-005 |
| T08 | DAS do MEI: criação, valor vigente, troca de regime | Integração | CA-09 |
| T09 | Parcelas do cartão recebidas no vencimento; futuras continuam abertas | Integração | CA-10 |
| T10 | Contas protegidas (venda, despesa fixa, com pagamento) | Integração | CA-11, INV-008 |
| T11 | Rota da rotina sem segredo → 401 | Integração | CA-12 |
| T12 | Permissões (Colaborador só criar, sem ver; ações chamadas direto; menu) | Unitário + integração | CA-13, INV-007 |
| T13 | 5.000 lançamentos, 2.000 contas e rotina com 100 negócios nos tempos da seção 10 | Integração | RNF06 |
| T14 | Telas em 390/768/1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-14 |
| T15 | Fluxo completo na homologação, incluindo a rotina agendada na Vercel | Manual (uma vez) | CA-01 a CA-13 |

---

## 13. Questões em aberto

Cada questão traz a **recomendação** de quem gerou a Spec; a decisão é da equipe.

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Saldo inicial | Um negócio que já existe tem dinheiro em caixa antes de usar o sistema. | (a) **informar uma vez um lançamento "Saldo inicial"** (data e valor); (b) campo no negócio; (c) começar do zero. | **(a)**: aparece no extrato, entra no saldo como qualquer lançamento e fica auditável. |
| **OPEN-002** — Lançamentos avulsos | UC12a fala em despesa operacional; RF29 em entradas e saídas. | (a) **entradas e saídas avulsas**, com categoria e descrição; (b) só saídas (despesa operacional). | **(a)**: há entradas fora de venda (aporte do dono, reembolso). |
| **OPEN-003** — Corrigir erros | Lançamento ou conta registrados errado. | (a) **lançamentos imutáveis com estorno** (gatilho no banco, como estoque e preço); contas manuais sem pagamento podem ser editadas ou canceladas; (b) permitir editar/excluir lançamentos manuais. | **(a)**: mantém o caixa auditável (RNF05) e coerente com as outras specs. |
| **OPEN-004** — Primeira conta da despesa fixa | Despesa cadastrada no meio do mês. | (a) **mês do cadastro se o dia de vencimento ainda não passou; senão, o próximo mês**; (b) sempre o mês do cadastro; (c) sempre o próximo. | **(a)**: não cria conta "atrasada" logo ao cadastrar e não pula um vencimento que ainda vai acontecer. |
| **OPEN-005** — DAS do MEI | O DAS muda todo janeiro (SPEC-003). | (a) **despesa automática para negócio MEI, valor do parâmetro vigente na competência**, só o dia é editável; (b) o usuário cadastra como despesa comum. | **(a)**: é o que o RF60 pede e acompanha o salário mínimo sem o usuário fazer nada. |
| **OPEN-006** — Permissões do Financeiro | Como as 4 ações da matriz (SPEC-005) se aplicam. | (a) ***ver***: caixa, saldo, contas e despesas fixas; ***criar***: avulso, nova conta, registrar pagamento, nova despesa fixa; ***editar***: editar despesa fixa e conta manual; ***excluir***: estornar avulso e cancelar conta manual; (b) outra divisão. | **(a)**: permite o caso do RF06 (Colaborador que só lança despesa, sem ver saldo). |
| **OPEN-007** — Data do lançamento e do pagamento | Lançar depois o que aconteceu antes. | (a) **hoje por padrão, retroativa até 90 dias**, nunca futura (como o estoque); (b) só hoje; (c) até 7 dias (como a venda). | **(a)**: contas costumam ser registradas com atraso (boleto pago na semana passada). |
| **OPEN-008** — Recebimento das parcelas do cartão | RN14 diz que entram no saldo "na data de vencimento/recebimento". | (a) **automático no vencimento** (rotina diária e conferência), com opção de registrar antes; (b) sempre manual. | **(a)**: a maquininha deposita sozinha; exigir o registro manual de cada parcela deixaria o saldo sempre errado. |

---

## 14. Definition of Done da Spec

A SPEC-009 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-14) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T15) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-008 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
