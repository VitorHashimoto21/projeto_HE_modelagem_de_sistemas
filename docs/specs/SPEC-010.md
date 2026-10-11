# SPEC-010 — Calculadora de precificação

> **Status:** 📝 **Rascunho** — aguardando as decisões da equipe nas questões em aberto (seção 13). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-003](SPEC-003.md) (parâmetros fiscais), [SPEC-004](SPEC-004.md) (regime e Anexo), [SPEC-006](SPEC-006.md) (catálogo e preço oficial), [SPEC-008](SPEC-008.md) (vendas com custo unitário) e [SPEC-009](SPEC-009.md) (despesas fixas, DAS e lançamentos de salário) · **Próximas que dependem desta:** SPEC-012 (ponto de equilíbrio e meta no dashboard).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-010 |
| **Nome** | Calculadora de precificação |
| **Objetivo** | Sugerir o preço de venda de um item pelo **markup completo** (RF34): custo total com materiais, despesas fixas %, despesas variáveis % (taxa de cartão e comissão), imposto % pelo regime (alíquota efetiva do Simples por RBT12 e Anexo efetivo com Fator R; 0% no MEI; informado no Autônomo) e margem. Mostrar a memória do cálculo, o **ponto de equilíbrio** e o **faturamento meta**, e gravar o preço oficial só depois da confirmação, com histórico auditável. |
| **Valor entregue** | O diferencial do produto: o empreendedor sabe por quanto vender sem prejuízo, entende de onde vem cada parte do preço e vê quanto precisa faturar por mês para cobrir as despesas (ponto de equilíbrio) e para ter o lucro desejado (meta). |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF34 | Preço = Custo Total ÷ (1 − (Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem%)). |
| | RF35 | Custo do serviço + Σ (custo do material × quantidade). |
| | RF36 | Margem sugerida pela `MargemPadraoCategoria` da categoria do item, editável. |
| | RF37 | Regime tributário exibido na Calculadora. |
| | RF38 | Alíquota efetiva do Simples pela faixa do RBT12; 0% no MEI; percentual informado no Autônomo. |
| | RF39 | RBT12 automático: vendas não canceladas dos 12 meses anteriores ao mês do cálculo, proporcional com menos histórico (RN21). |
| | RF40, RF41 | Preço exibido, confirmado explicitamente e registrado no histórico (origem Calculadora). |
| | RF49 | Desp. Fixas% = despesas fixas mensais ÷ faturamento médio mensal. |
| | RF50 | Sem histórico: capacidade × ticket médio → faturamento estimado editável. |
| | RF51, RF52 | Taxa média de cartão (negócio) e comissão (item) como despesas variáveis. |
| | RF53 | Aviso de que a Margem% é o ganho líquido do dono por venda. |
| | RF54, RF55, RF56 | Ponto de equilíbrio, alerta se o faturamento estiver abaixo dele, e faturamento meta. |
| | RF60, RF61 | MEI: DAS nas despesas fixas, Imposto% = 0; alerta de limite anual do MEI. |
| | RF62 | CMV% apurado pelas vendas (custo unitário gravado) ou estimado sem histórico. |
| | RF69 | Fator R = folha (Salário) ÷ receita, no período do RBT12; Anexo III se ≥ 28%, senão V; aviso de mudança do anexo efetivo. |
| **RN** | RN15, RN16 | Preço oficial = último confirmado; toda confirmação gera histórico. |
| | RN19 | Soma dos percentuais ≥ 100% bloqueia o cálculo. |
| | RN20 | Taxa de cartão e comissão só formam o preço; não mexem no caixa. |
| | RN21 | RBT12 por competência, inclusive vendas não recebidas; proporcional com histórico menor. |
| | RN28 | Sujeito ao Fator R sem RBT12 real → Anexo V. |
| | RN29 | Meses e competências no fuso de São Paulo. |
| **RNF** | RNF05 | Histórico do preço com quem confirmou e a memória completa do cálculo (valores e fontes legais). |
| | RNF06 | Cálculo em menos de 2 s, com milhares de vendas. |
| | RNF08 | Valores fiscais lidos das tabelas parametrizadas (SPEC-003), nunca fixos no código. |
| **Caso de uso / fluxo** | UC10 Calcular Preço de Venda, UC10a Confirmar Preço, UC10b Consultar Histórico, UC16 (parâmetros de precificação) | Diagrama 1 (sequência da calculadora) de `DIAGRAMAS_COMPORTAMENTAIS.md`. |
| **Entidades** | Item, MaterialServico, HistoricoPreco, Negocio (parâmetros), DespesaFixa, LancamentoFinanceiro, Venda/ItemVenda, FaixaTributaria, ParametroMei, ParametroFatorR, MargemPadraoCategoria | — |
| **Drivers** | AD-RF04, AD-QA01 | Precificação correta e auditável. |
| **ADRs** | ADR-004, ADR-005 | Parâmetros fiscais em tabela; cálculo como função de domínio pura. |

---

## 3. Escopo

### Incluído

1. **Calculadora** (OPEN-001): escolher um item com custo e ver o preço sugerido, com a **memória do cálculo** — cada componente com o valor, a origem e, nos fiscais, a fonte legal e a vigência.
2. **Custo total** (RF35) e **margem sugerida** pela categoria (RF36), editável para simular.
3. **Despesas fixas %** (RF49, RF60, OPEN-006) sobre o **faturamento médio mensal** (RBT12 ÷ 12, proporcional; sem histórico, o faturamento estimado — RF50).
4. **Despesas variáveis %**: taxa média de cartão do negócio + comissão do item (RF51, RF52).
5. **Imposto %** pelo regime (RF38, RF60, RF59) e, no Simples, **Anexo efetivo** com Fator R (RF69, RN28, OPEN-007, OPEN-008).
6. **RBT12** (RF39, RN21, OPEN-005) e **CMV%** (RF62).
7. **Bloqueio** quando a soma dos percentuais ≥ 100% (RN19) e quando o Simples passa do limite (R$ 4,8 milhões — SPEC-003); **alerta** de limite do MEI (RF61).
8. **Confirmar preço** (RF40, RF41, OPEN-004): grava o preço oficial e o histórico (origem Calculadora) na mesma transação, com os percentuais e a memória do cálculo.
9. **Ponto de equilíbrio e faturamento meta** do negócio (RF54–RF56), com alerta quando o faturamento estiver abaixo do ponto de equilíbrio.
10. **Parâmetros de precificação** (UC16, OPEN-002): taxa média de cartão, capacidade mensal, ticket médio, faturamento estimado (sugerido = capacidade × ticket, editável), CMV% estimado e margem meta.
11. **Permissões** do módulo Calculadora (OPEN-003) e item "Calculadora" no menu; atalho "Calcular preço" no detalhe do item do Catálogo.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Preço manual (sem cálculo) | Já existe (SPEC-006) |
| Ponto de equilíbrio, meta e projeções no dashboard | SPEC-012 (reaproveita as funções desta Spec) |
| Recalcular todos os preços em lote quando um parâmetro muda | Evolução futura |
| Simulação de cenários salvos / comparação de regimes tributários | Evolução futura |
| Atualizar os parâmetros fiscais (faixas, DAS, Fator R, margens) | SPEC-003 (carga por arquivo) |
| Desconto da taxa de cartão no caixa | Fora do MVP (RN20) |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-003: `FaixaTributaria`, `ParametroMei`, `ParametroFatorR`, `MargemPadraoCategoria` e a função pura `aliquotaEfetiva`.
  - SPEC-004: regime, Anexo, sujeição ao Fator R, atividade do MEI e Imposto% do Autônomo.
  - SPEC-006: item, custo, materiais, comissão e a função de definir preço com histórico.
  - SPEC-008: `Venda.valorTotal` e `ItemVenda.custoUnitario`.
  - SPEC-009: despesas fixas ativas, DAS do MEI e lançamentos da categoria Salário.
- **Decisões arquiteturais:** ADR-004 (parâmetros fiscais em tabela), ADR-005 (domínio puro).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Fórmulas (Diagrama 1)

```text
Preço sugerido     = Custo Total ÷ (1 − (DF% + DV% + Imp% + M%))         (RF34)
Custo Total        = custoBase + Σ (custo do material × quantidade)       (RF35)

RBT12 real         = Σ Venda.valorTotal (não canceladas) das competências dos 12 meses anteriores ao mês do cálculo (RF39, RN21)
RBT12              = 12 meses de histórico → RBT12 real
                     1 a 11 meses de histórico → (RBT12 real ÷ meses considerados) × 12 (OPEN-005)
                     nenhum mês anterior com vendas → faturamento estimado × 12 (RF50)
Faturamento médio  = RBT12 ÷ 12
DF%                = (Σ despesas fixas mensais + DAS se MEI) ÷ faturamento médio (RF49, RF60, OPEN-006)
DV%                = taxa média de cartão + comissão do item (RF51, RF52)
Imp%               = Simples: alíquota efetiva da faixa do Anexo efetivo para o RBT12 (RF38)
                     MEI: 0 (RF60) · Autônomo: percentual do cadastro (RF59)
M%                 = margem da categoria (sugerida) ou a informada (RF36)
CMV%               = Σ (custoUnitario × quantidade) ÷ RBT12 real, no mesmo período (RF62); sem histórico: CMV% estimado
PE                 = Despesas fixas ÷ (1 − CMV% − Imp% − taxa de cartão%) (RF55)
Meta               = Despesas fixas ÷ (1 − CMV% − Imp% − taxa de cartão% − margem meta%) (RF56)
```

- Os cálculos usam precisão total; o preço sugerido é arredondado **para cima** ao centavo (nunca reduz a margem) e os percentuais são exibidos com 2 casas.
- O "mês do cálculo" é o mês atual em São Paulo; as vendas do mês corrente não entram no RBT12 (RN21).

### 5.2 Calcular (UC10)

1. Quem tem permissão (OPEN-003) abre a Calculadora e escolhe um item ativo (ou chega pelo atalho do detalhe do item).
2. O servidor monta o cálculo: custo, margem sugerida, RBT12, faturamento médio, DF%, DV%, regime e Imp% (com Anexo efetivo e Fator R, se houver), CMV%, PE e Meta.
3. A tela mostra o **preço sugerido**, o preço atual (se houver) e a diferença, e a **memória do cálculo**, linha a linha, com fontes legais e vigências (RN17).
4. A pessoa pode alterar a **margem** (e, só para simular, a comissão) e recalcular; nada é gravado.
5. Mensagem fixa (RF53): "A margem é o que sobra para você em cada venda, depois de custos, despesas e impostos — não é o lucro total do negócio."

| Situação | Comportamento |
|---|---|
| DF% + DV% + Imp% + M% ≥ 100% | Cálculo bloqueado: "Com esses parâmetros o preço é inviável: os percentuais somam X%." Mostra qual parcela pesa mais e sugere revisar despesas fixas, faturamento estimado ou margem (RN19). |
| Sem histórico de vendas e sem faturamento estimado | Pede os parâmetros (capacidade × ticket médio, RF50) antes de calcular; quem não pode editá-los vê o aviso para pedir ao responsável. |
| Simples com RBT12 acima de R$ 4,8 milhões | Bloqueado: "Faturamento acima do limite do Simples Nacional." |
| MEI com RBT12 acima do limite anual (RF61) | Alerta visível (não bloqueia o cálculo). |
| Autônomo sem Imposto% informado | Pede para completar os dados do negócio (Dono). |
| Item sem custo (custo total = 0) | Bloqueado: "Informe o custo do item no Catálogo para calcular o preço." |
| Parâmetro fiscal ausente | Bloqueado com a mensagem da SPEC-003 (rodar a carga). |
| Anexo efetivo diferente do anterior (RF69) | Aviso: "O Anexo efetivo mudou de V para III (Fator R = 31,2%)" (OPEN-008). |

### 5.3 Confirmar o preço (UC10a, RF40, RF41)

1. "Confirmar R$ X como preço oficial" (OPEN-004).
2. O servidor **recalcula** com os dados atuais (nunca usa valores vindos do navegador, só a margem e a escolha de arredondamento) e confere se o resultado é o mesmo que a pessoa viu; se mudou (custo, despesas, vendas novas), mostra o novo valor e pede nova confirmação.
3. Numa transação, pela mesma função de preço da SPEC-006: grava o `HistoricoPreco` (origem Calculadora, usuário, preço, margem, custo considerado, DF%, DV%, regime, Imp% e a memória completa) e atualiza `Item.precoAtual` (RN15, RN16).
4. Preço igual ao atual também é registrado (a confirmação documenta que o preço foi revisado com os parâmetros do dia).

### 5.4 Ponto de equilíbrio e meta (RF54–RF56)

- Exibidos na Calculadora (seção do negócio), com a memória: despesas fixas, CMV% (apurado ou estimado), Imp% do negócio (o do regime, sem item), taxa de cartão e margem meta.
- Alerta quando o faturamento médio (ou o estimado, sem histórico) for menor que o PE (RF54).
- Se o denominador for ≤ 0, mostra "Não é possível atingir o equilíbrio com estes percentuais" em vez de um valor.

### 5.5 Parâmetros de precificação (UC16, RF50, RF51, OPEN-002)

| Campo | Regra |
|---|---|
| Taxa média de cartão (%) | 0 a 30, 2 casas. |
| Capacidade mensal | > 0, até 3 casas, com a unidade livre (horas, atendimentos, unidades). |
| Ticket médio estimado (R$) | > 0, 2 casas. |
| Faturamento mensal estimado (R$) | Sugerido = capacidade × ticket; editável; > 0. |
| CMV% estimado | 0 a 95, 2 casas. |
| Margem meta (%) | 0 a 95, 2 casas. |

Usados só enquanto não houver histórico (faturamento e CMV%) ou sempre (taxa de cartão e margem meta).

### 5.6 Fator R e Anexo efetivo (RF69, RN28)

- Só para negócio do Simples cujo CNAE seja sujeito ao Fator R (SPEC-004).
- Fator R = folha de salários ÷ receita bruta, ambas no período do RBT12 real (OPEN-007).
- Fator R ≥ `ParametroFatorR.limiteMinimo` → `anexoSeAtingir` (III); senão `anexoSeNaoAtingir` (V). Sem RBT12 real → Anexo V (RN28).

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | O preço sugerido satisfaz `preço × (1 − Σ%) ≥ custo total` (arredondamento só para cima). | Teste de propriedade com combinações aleatórias. |
| **INV-002** | Nenhum preço é calculado nem confirmado com Σ% ≥ 100% (RN19). | Testes unitário e de integração. |
| **INV-003** | O preço confirmado é sempre recalculado no servidor com os dados do momento; valor divergente do visto não é gravado sem nova confirmação. | Teste com custo alterado entre a simulação e a confirmação. |
| **INV-004** | `Item.precoAtual` = preço do histórico mais recente (herdado da SPEC-006), e todo registro de origem Calculadora traz os percentuais e a memória do cálculo (RNF05). | Teste de integração. |
| **INV-005** | RBT12, CMV% e Fator R usam o mesmo período (12 competências anteriores ao mês atual, em São Paulo) e ignoram vendas canceladas. | Testes com vendas na virada do mês e canceladas. |
| **INV-006** | Valores fiscais vêm sempre das tabelas vigentes na data do cálculo, com fonte legal registrada (RN17, RNF08). | Teste trocando a vigência. |
| **INV-007** | Toda leitura e escrita passa pelo cliente do negócio e pela permissão da Calculadora (e a confirmação, pela permissão definida no OPEN-003). | Varredura da SPEC-005 e testes. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Item` | `custoBase`, `categoria`, `comissaoPercentual`, `precoAtual`, materiais | Só itens ativos. |
| `HistoricoPreco` | campos do cálculo já existentes (`margemAplicada`, `custoConsiderado`, `despesasFixasPercentual`, `despesasVariaveisPercentual`, `regimeTributario`, `impostoAplicado`) | Origem Calculadora. |
| `Negocio` | regime, Anexo, Fator R, atividade MEI, Imposto% manual, `taxaCartaoMedia`, `capacidadeMensal`, `ticketMedioEstimado`, `faturamentoMensalEstimado`, `cmvEstimado`, `margemLucroMeta` | Parâmetros de precificação. |
| `DespesaFixa` | `valorMensal`, `ativo`, `origem` | DAS pelo `ParametroMei` vigente. |
| `Venda`, `ItemVenda` | `valorTotal`, `data`, `status`, `custoUnitario`, `quantidade` | RBT12 e CMV%. |
| `LancamentoFinanceiro` | categoria Salário, tipo, estornos | Folha do Fator R. |
| Parâmetros fiscais | faixas, DAS, limite do MEI, Fator R, margens | Somente leitura. |

**Mudanças previstas no schema:**

- `HistoricoPreco.memoriaCalculo Json?` — memória completa do cálculo (RBT12, meses considerados, faturamento médio, despesas fixas, DAS, CMV%, Anexo efetivo, Fator R, taxa de cartão, comissão, fontes legais e vigências), para auditoria (RNF05) e para o aviso de mudança de anexo (OPEN-008).
- `HistoricoPreco.precoSugerido Decimal?` — o valor exato calculado, quando o confirmado for arredondado (OPEN-004).
- `Negocio.unidadeCapacidade String?` — unidade da capacidade mensal (ex.: "atendimentos"), só para exibição.
- `CHECK` nos parâmetros: taxa de cartão 0–30, CMV% estimado e margem meta 0–95, capacidade/ticket/faturamento estimado > 0.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/precificacao.ts` — funções puras: RBT12 proporcional, DF%, DV%, Anexo efetivo, alíquota (reusa `aliquotaEfetiva` da SPEC-003), preço, PE, Meta, arredondamento e a memória do cálculo;
  - `src/lib/db/precificacao.ts` — agregados (vendas e custos por competência, folha, despesas fixas) pelo cliente do negócio, numa ida ao banco por agregado;
  - `src/lib/calculadora/` — validação, fluxos (calcular, confirmar, parâmetros) e Server Actions com `acaoComPermissao("calculadora", …)`;
  - `src/app/(app)/calculadora/` — calculadora e parâmetros; atalho no detalhe do item do Catálogo;
  - `src/lib/equipe/menu.ts` — "Calculadora".
- **Fronteiras:** a confirmação reutiliza a função de definir preço da SPEC-006 (mesma transação e o mesmo histórico), mudando só a origem e os campos do cálculo.
- **Integrações:** nenhuma.
- **Identidade visual:** tokens e componentes existentes; a memória do cálculo como lista de linhas com valor e explicação; percentuais sempre com o símbolo e texto (nunca só cor).

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Calcular preço** | item, margem (opcional), comissão para simular (opcional) | preço sugerido, componentes, memória, avisos | `ItemNaoEncontrado`, `SemCusto`, `PrecoInviavel` (Σ% ≥ 100), `SemFaturamento`, `AcimaDoLimiteDoSimples`, `ImpostoNaoInformado`, `ParametroAusente`, `SemPermissao` |
| **Confirmar preço** | item, margem, arredondamento, preço visto | registro do histórico | os de cima + `PrecoMudou` (com o novo valor) |
| **Ponto de equilíbrio e meta** | — (negócio ativo) | PE, Meta, componentes, alerta | `SemFaturamento`, `SemPermissao` |
| **Parâmetros de precificação** | taxa de cartão, capacidade, unidade, ticket, faturamento estimado, CMV% estimado, margem meta | parâmetros | `CampoInvalido`, `SemPermissao` |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Calculadora e parâmetros responsivos; memória legível no celular. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF02** | Isolamento e permissões da Calculadora. | INV-007. |
| **RNF05** | Histórico com quem confirmou e a memória do cálculo. | INV-004. |
| **RNF06** | Cálculo em menos de 2 s com 10.000 vendas e 30.000 itens vendidos no período. | Teste de integração. |
| **RNF08** | Valores fiscais das tabelas vigentes. | INV-006. |

---

## 11. Critérios de aceitação

**CA-01 — Markup completo.** Dado um serviço com custo R$ 20 + materiais R$ 3, DF% 15%, taxa de cartão 3%, comissão 2%, Imp% 6% e margem 32%, então o preço sugerido é 23 ÷ (1 − 0,58) = R$ 54,77 (arredondado para cima), e a memória mostra cada parcela.

**CA-02 — RBT12 e proporcionalidade.** Dados 4 meses anteriores com R$ 40.000 em vendas (e vendas no mês atual), então o RBT12 é R$ 120.000 (conforme o OPEN-005) e as vendas do mês atual e as canceladas não entram.

**CA-03 — Sem histórico.** Dado um negócio sem vendas anteriores, quando abre a Calculadora sem faturamento estimado, então ela pede capacidade e ticket; com 100 atendimentos × R$ 50, o faturamento estimado sugerido é R$ 5.000 e o RBT12, R$ 60.000.

**CA-04 — Simples.** Dado um negócio do Anexo III com RBT12 de R$ 300.000, então Imp% = (300.000 × 11,2% − 9.360) ÷ 300.000 = 8,08% (2ª faixa), com a fonte legal e a vigência.

**CA-05 — Fator R.** Dado um negócio sujeito ao Fator R com folha de R$ 90.000 e receita de R$ 300.000 no período (30%), então o Anexo efetivo é III; com folha de R$ 60.000 (20%), é V; sem histórico de vendas, é V; quando muda em relação ao anterior, aparece o aviso.

**CA-06 — MEI.** Dado um MEI de serviços, então Imp% = 0, o DAS vigente (R$ 86,05) entra nas despesas fixas e, com RBT12 acima de R$ 81.000, aparece o alerta de limite.

**CA-07 — Autônomo.** Dado um autônomo com Imposto% de 11%, então Imp% = 11%.

**CA-08 — Inviável.** Dados percentuais que somam 100% ou mais, então o cálculo é bloqueado com a explicação e nada pode ser confirmado.

**CA-09 — Confirmação.** Dado o preço sugerido, quando é confirmado, então `precoAtual` muda, o histórico ganha um registro de origem Calculadora com usuário, percentuais e memória; se o custo mudou entre a simulação e a confirmação, o novo valor é mostrado e nada é gravado sem nova confirmação.

**CA-10 — Ponto de equilíbrio e meta.** Dadas despesas fixas de R$ 3.000, CMV% 30%, Imp% 6%, taxa de cartão 4% e margem meta 20%, então PE = R$ 5.000 e Meta = R$ 7.500; com faturamento médio de R$ 4.000, aparece o alerta de abaixo do equilíbrio.

**CA-11 — Parâmetros.** Dados os parâmetros válidos, quando salvos, então passam a valer no cálculo; valores fora das faixas são recusados com mensagem por campo.

**CA-12 — Permissões.** Dado um membro sem a permissão da Calculadora, então ele não vê o item no menu nem abre a tela; as ações chamadas diretamente são recusadas (OPEN-003).

**CA-13 — Visual.** Dadas as telas desta Spec, em 390, 768 e 1440 px, claro e escuro, então seguem os tokens, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Preço, arredondamento para cima, INV-001 com valores aleatórios, Σ% ≥ 100% | Unitário | CA-01, CA-08, INV-001, INV-002 |
| T02 | RBT12 proporcional (0, 1, 4, 12 meses; meses sem venda), faturamento médio, DF% com DAS | Unitário | CA-02, CA-03, CA-06 |
| T03 | Imposto por regime, faixas (limites contínuos), Anexo efetivo e Fator R, PE e Meta (denominador ≤ 0) | Unitário | CA-04 a CA-07, CA-10 |
| T04 | Validação dos parâmetros e da margem | Unitário | CA-11 |
| T05 | Agregados no banco: vendas por competência na virada do mês (fuso), canceladas fora, CMV% com custo gravado, folha com estornos | Integração | CA-02, INV-005 |
| T06 | Cálculo completo por regime com os parâmetros fiscais carregados (fonte e vigência na memória) | Integração | CA-04 a CA-07, INV-006 |
| T07 | Confirmação: histórico com memória, `precoAtual`, preço mudou entre simular e confirmar, inviável recusado | Integração | CA-08, CA-09, INV-003, INV-004 |
| T08 | Aviso de mudança do Anexo efetivo | Integração | CA-05 |
| T09 | Parâmetros de precificação gravados e usados; isolamento entre negócios | Integração | CA-11, INV-007 |
| T10 | Permissões (ações direto, menu, páginas) | Unitário + integração | CA-12, INV-007 |
| T11 | Cálculo com 10.000 vendas / 30.000 itens vendidos em menos de 2 s | Integração | RNF06 |
| T12 | Telas em 390/768/1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-13 |
| T13 | Fluxo completo na homologação | Manual (uma vez) | CA-01 a CA-12 |

---

## 13. Questões em aberto

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Onde fica a Calculadora | Tela própria ou só a partir do item? | (a) **`/calculadora`** com a escolha do item + atalho "Calcular preço" no detalhe do item; (b) só no detalhe do item do Catálogo | **(a)** — a tela própria também abriga o ponto de equilíbrio, a meta e os parâmetros; o atalho leva direto ao item. |
| **OPEN-002** — Parâmetros de precificação | Onde e por quem são editados? | (a) **Tela da Calculadora**, com permissão da Calculadora (Dono e Gerente, UC16); (b) em "Dados do negócio", só o Dono | **(a)** — o UC16 inclui o Gerente, e os parâmetros ficam perto de onde são usados. |
| **OPEN-003** — Permissões | Como dividir ver/criar/editar? | (a) ***ver***: calcular, simular, ver PE e meta; ***criar***: confirmar preço; ***editar***: parâmetros; (b) ***ver***: calcular; ***editar***: confirmar preço e parâmetros | **(a)** — confirmar um preço cria um registro de histórico; separar permite um Colaborador que simula sem mudar preços. |
| **OPEN-004** — Ajuste do preço confirmado | Confirmar só o valor exato? | (a) **Exato (arredondado para cima ao centavo) ou "arredondar para cima"** ao próximo real inteiro — nunca abaixo do sugerido; o exato fica no histórico; (b) só o exato; outro valor vai pelo preço manual do Catálogo | **(a)** — preço "redondo" é comum no pequeno negócio, e arredondar para cima nunca reduz a margem. |
| **OPEN-005** — RBT12 com menos de 12 meses | Quais meses entram na média? | (a) **Meses desde a primeira venda** (dentro dos 12), contando os meses sem venda como zero; (b) só os meses com venda registrada (texto literal do RF49) | **(a)** — um mês parado é faturamento zero de verdade; contar só os meses com venda superestima o faturamento e subestima as despesas fixas % (preço baixo demais). Registrar a divergência do texto do RF49. |
| **OPEN-006** — Despesas fixas no cálculo | Qual total usar? | (a) **Cadastro atual**: soma das despesas fixas ativas + DAS vigente (MEI); (b) média das contas de despesas fixas dos últimos 12 meses | **(a)** — reflete o custo de hoje (aluguel reajustado vale já), é simples de explicar e de conferir na tela de Despesas fixas. |
| **OPEN-007** — Folha do Fator R | O que conta como folha? | (a) **Saídas da categoria Salário** (líquidas de estornos) no período do RBT12 real; sem vendas no período → Anexo V; (b) permitir informar uma folha estimada quando não houver lançamentos | **(a)** — segue o RF69 e o RN28 com dados reais; uma folha estimada abriria margem para enquadramento errado. |
| **OPEN-008** — Aviso de mudança do Anexo | Comparar com o quê? | (a) **Com o Anexo efetivo usado no último preço confirmado** (guardado na memória do cálculo); (b) com o Anexo do cadastro | **(a)** — avisa exatamente quando os preços confirmados antes foram feitos com outro Anexo e talvez precisem ser revistos. |

---

## 14. Definition of Done da Spec

A SPEC-010 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-13) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-007) estiverem preservados;
- [ ] os testes derivados (T01 a T13) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06, RNF08) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-008 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
