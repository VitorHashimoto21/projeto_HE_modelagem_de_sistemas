# SPEC-023 — Comissão em reais na Calculadora

> **Status:** ✅ **Aprovada em 26/10/2026 e implementada em 29/10/2026**, verificada em build local: testes T01 a T05 automatizados e o roteiro no navegador (T06 e T07) com 41 verificações ([evidências](evidencias/SPEC-023/README.md)). Falta a homologação (T08). As notas da implementação estão depois da seção 9. Gerada como SPEC-024 e renumerada para SPEC-023 em 29/10/2026, por decisão da equipe (o 024 ficou para o código interno dos itens e o 025 para a proposta de fornecedores; os commits e a branch do PR #110 ainda usam o número antigo). As questões em aberto foram decididas pela equipe em entrevista (seção 13), todas pela opção recomendada:
> - a comissão **não é somada ao custo do item**: aparece como despesa variável própria, **separada da maquininha**;
> - a barra "Para onde vai cada venda" ganha as partes **"Maquininha" e "Comissão"**, com uma 6ª cor na paleta;
> - "Como o preço foi calculado" mostra o **valor em reais em todas as parcelas**, com maquininha e comissão em linhas próprias;
> - o detalhe do item no Catálogo mostra a **comissão em reais no preço atual**;
> - a comissão na **rentabilidade por item** e no **ponto de equilíbrio** fica registrada como evolução.
>
> A comissão continua **só percentual**: a revisora informou que esse é o padrão na maioria dos setores, e a comissão fixa em reais ficou fora (26/10/2026). A baseline foi ajustada: RF52 alterado e, na identidade visual, o limite de séries dos gráficos passou de 5 para 6. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir da revisão de uma profissional da área financeira e contábil que está montando uma loja de semijoias (26/10/2026).
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-010](SPEC-010.md) (tela da Calculadora) e [SPEC-006](SPEC-006.md) (detalhe do item).
> - **Corrige:** uma divergência da [SPEC-016](SPEC-016.md) (5.5): a barra devia ter taxa e comissão como parcelas separadas, e a implementação as juntou.
> - **Usa:** [SPEC-005](SPEC-005.md) (permissões, sem mudança).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-023 |
| **Nome** | Comissão em reais na Calculadora |
| **Objetivo** | Mostrar a comissão do item **separada da taxa da maquininha** e com o **valor em reais**, sem mudar a fórmula do preço: na barra "Para onde vai cada venda", em "Como o preço foi calculado" (com reais em todas as parcelas) e no detalhe do item do Catálogo. |
| **Valor entregue** | Quem paga comissão (a vendedora da loja, a manicure, o cabeleireiro) vê quanto de cada venda vai para ela, sem confundir com o que fica com a maquininha, e confere em reais cada parte do preço sugerido. Hoje a comissão aparece só em percentual e somada à taxa da maquininha. |

### Exemplo que originou a Spec

Semijoia com custo de R$ 40,00 num negócio MEI (imposto 0%), com despesas fixas de 15%, maquininha de 3%, comissão de 10% e margem informada de 30%. O preço sugerido é 40,00 ÷ (1 − 0,58) = **R$ 95,24**.

- **Hoje:**
  - a barra mostra "Maquininha e comissão: 13%, R$ 12,38";
  - a memória mostra "Despesas variáveis: 13,00%", com o detalhe "Taxa da maquininha 3,00% + comissão 10,00%";
  - o Catálogo mostra "Comissão: 10%".
- **Com esta Spec:**
  - a barra mostra "Maquininha: 3%, R$ 2,86" e "Comissão: 10%, R$ 9,52", em partes separadas;
  - a memória mostra cada parcela com o percentual e os reais, por exemplo "Comissão do item: 10,00%, R$ 9,52";
  - o Catálogo mostra "Comissão: 10% (R$ 9,52 no preço atual)".

A revisora pediu para ver "o valor da comissão no custo". A comissão **não** é somada ao custo (OPEN-001): a fórmula já a aplica como percentual sobre o preço, e somá-la ao custo a contaria duas vezes, subindo o preço sem motivo. Em contabilidade, ela também é **despesa com vendas**, e não custo da mercadoria. Por isso aparece ao lado do custo, separada e em reais.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF52** | **Alterado (texto ajustado na baseline):** a comissão é sempre um **percentual sobre o preço** (sem comissão fixa em reais). A Calculadora a mostra **separada da taxa da maquininha** e com o valor em reais no preço sugerido, e o detalhe do item mostra o valor em reais no preço oficial. |
| | RF34 | Mantido: a fórmula do preço não muda (INV-001). |
| | RF51 | A taxa da maquininha ganha linha e parte próprias, com o valor em reais. |
| | RF53 | Mantido: o aviso de que a margem é o ganho do dono por venda continua. |
| **RN** | RN20 | Mantida: taxa e comissão só formam o preço. O valor em reais é informativo: não gera lançamento, conta, desconto nem repasse. |
| | RN19 | Mantida: a soma dos percentuais ≥ 100% continua bloqueando o cálculo, e nenhum valor em reais é mostrado. |
| **RNF** | RNF01 | Barra com seis partes e memória legíveis em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF05, RNF06 | Sem mudança no que é gravado nem nas consultas: os reais são calculados na exibição. |
| **Decisões anteriores** | SPEC-016, 5.5 | A barra "Para onde vai cada venda" listava taxa e comissão como parcelas separadas, mas a implementação as juntou em "Maquininha e comissão". **Divergência corrigida por esta Spec** (opção 1, corrigir a implementação). |
| | SPEC-010, seção 9 | Mantida: uma simulação com outra comissão não pode ser confirmada; a confirmação usa a comissão do item. |
| | `IDENTIDADE_VISUAL.md`, 5.2 | **Alterada (texto ajustado na baseline):** "no máximo 5 séries" passa a "no máximo 6 séries", com a série 6 escolhida e validada na implementação (OPEN-002). |
| **Caso de uso / fluxo** | UC10 Calcular Preço de Venda; UC6 (consultar item) | Só a apresentação muda. |
| **Entidades** | Item (só leitura: `comissaoPercentual`, `precoAtual`), HistoricoPreco (sem mudança) | Ver seção 7. |

---

## 3. Escopo

### Incluído

1. **Barra "Para onde vai cada venda"** (OPEN-002): as partes "Maquininha" e "Comissão" ficam separadas, cada uma com o percentual e o valor em reais. A paleta dos gráficos ganha uma **6ª cor** (`--chart-6`), conferida nos temas claro e escuro.
2. **"Como o preço foi calculado"** (OPEN-003):
   - linhas próprias para "Taxa da maquininha" e "Comissão do item", no lugar da linha única "Despesas variáveis";
   - o **valor em reais**, sobre o preço sugerido, em todas as parcelas: despesas fixas, maquininha, comissão, imposto e margem.
3. **Detalhe do item no Catálogo** (OPEN-004): a linha "Comissão" mostra o valor em reais no preço oficial, por exemplo "10% (R$ 9,52 no preço atual)".
4. **Simulação com outra comissão:** os reais da barra e da memória acompanham a comissão simulada, e o aviso de simulação continua (SPEC-010).
5. **Uma única função de domínio** calcula os reais das parcelas, usada pela barra e pela memória (INV-003).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| **Comissão fixa em reais** por venda | Fora: a comissão é percentual na maioria dos setores (informação da revisora, 26/10/2026) |
| Somar a comissão ao custo do item | Fora (OPEN-001): a comissão já incide sobre o preço e seria contada duas vezes |
| Comissão na **rentabilidade por item** (RF70) | Evolução registrada no Mapa (OPEN-005): exige gravar a comissão em cada venda |
| Comissão no **ponto de equilíbrio** e na **meta** (RF55, RF56) | Evolução registrada no Mapa (OPEN-006): exige a comissão média das vendas |
| Gravar a comissão na venda, comissões a pagar por vendedor e repasse | Evolução futura; no MVP não há repasse (RN20) |
| Comissão por membro da equipe (cada vendedor com o seu percentual) | Evolução futura |
| Comissão em reais na Nova venda ou no formulário do item | Fora (OPEN-004) |
| Mudar a fórmula do preço ou o que é gravado no histórico | Fora: RF34 e RNF05 sem mudança (INV-001, INV-005) |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-010: cálculo, resultado (`comissao`, `despesasVariaveis`, `precoCentavos`) e a tela da Calculadora;
  - SPEC-006: comissão do item e o detalhe do item no Catálogo;
  - SPEC-016: barra empilhada (`BarraEmpilhada`), paleta dos gráficos e regras da seção 5.5;
  - SPEC-005: permissões (nenhuma mudança).
- **Decisões arquiteturais:** ADR-005 (cálculo como função de domínio pura).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Valores em reais das parcelas (domínio)

```text
parte(p)        = arredondar(preço sugerido × p ÷ 100) ao centavo
Despesas fixas  = parte(DF%)
Maquininha      = parte(taxa de cartão%)
Comissão        = parte(comissão%)            (a do item, ou a simulada)
Imposto         = parte(Imp%)
Margem          = parte(M%)
Custo do item   = preço sugerido − (despesas fixas + maquininha + comissão + imposto + margem)
```

- O preço usado é o **preço sugerido** exibido (arredondado para cima ao centavo, SPEC-010), e não o "arredondar para cima ao real" da confirmação.
- A diferença de arredondamento, de poucos centavos, fica no "Custo do item" da barra, como hoje.
- A mesma função alimenta a barra e a memória (INV-003).

### 5.2 Barra "Para onde vai cada venda" (OPEN-002)

| Parte | Valor |
|---|---|
| Custo do item | preço − parcelas |
| Despesas fixas | parte(DF%) |
| Maquininha | parte(taxa de cartão%) |
| Comissão | parte(comissão%) |
| Imposto | parte(Imp%) |
| Margem (fica para você) | parte(M%) |

- Partes com valor zero continuam escondidas, como hoje: o imposto do MEI, a comissão de item sem comissão e a maquininha de negócio sem taxa.
- As partes seguem a ordem da paleta, de `--chart-1` a `--chart-6`. A nova cor `--chart-6` entra nos dois temas e passa pelo validador da paleta (`validate_palette`) e pelo contraste mínimo de 3:1 com o fundo (SPEC-016, INV-004). A ordem das cores pode ser ajustada para que as seis fiquem distintas entre si.
- A legenda continua com o nome escrito de cada parte, o percentual e os reais; a cor não é a única pista.
- A descrição para leitores de tela lista as seis partes com os valores.
- A `BarraEmpilhada` é compartilhada. Os outros gráficos que a usam ("Como os clientes pagam", no Painel e nos Relatórios) só mudam quando tiverem seis partes: a sexta passa a ter cor própria, em vez de repetir a primeira.

### 5.3 "Como o preço foi calculado" (OPEN-003)

| Linha | Valor | Detalhe |
|---|---|---|
| Custo total | R$, como hoje | Materiais, como hoje. |
| Linhas do negócio | Como hoje | Como hoje. |
| Despesas fixas | 15,00%, R$ 14,29 | Despesas fixas por mês ÷ faturamento médio mensal. |
| Taxa da maquininha | 3,00%, R$ 2,86 | Taxa média dos parâmetros de precificação; despesa variável, sobre o preço. |
| Comissão do item | 10,00%, R$ 9,52 | Comissão cadastrada no item; despesa variável, sobre o preço. |
| Imposto | 0,00%, R$ 0,00 | Como hoje (MEI, Autônomo ou alíquota do Simples). |
| Margem | 30,00%, R$ 28,57 | Sugerida para a categoria, como hoje. |
| Soma dos percentuais | 58,00% | Precisa ficar abaixo de 100%. |
| Preço = custo ÷ (1 − soma) | R$ 95,24 | Arredondado para cima ao centavo. |

- A linha única "Despesas variáveis" deixa de existir. A expressão continua no detalhe das duas linhas, para ligar à fórmula do RF34.
- **Comissão 0%:** a linha aparece com "0,00%, R$ 0,00" e o detalhe "Este item não paga comissão."
- **Comissão simulada:** o detalhe diz "Comissão simulada; a do item é 2,00%.", e o aviso da SPEC-010 continua acima da barra.
- O valor e os reais aparecem juntos na coluna do valor, sem rolagem horizontal no celular.

### 5.4 Detalhe do item no Catálogo (OPEN-004)

| Situação | Linha "Comissão" |
|---|---|
| Com preço oficial e comissão maior que 0 | "10% (R$ 9,52 no preço atual)" |
| Sem preço oficial | "10%", como hoje |
| Comissão 0 ou vazia | "0%", como hoje |

- Valor = arredondar(preço oficial × comissão ÷ 100) ao centavo.
- Vale também para o item arquivado e no modo suporte, que já veem o detalhe. A comissão não é dado pessoal.

### 5.5 Simulação e confirmação

- A simulação com outra comissão mostra os reais da comissão simulada na barra e na memória.
- A confirmação continua igual: recalcula no servidor com a comissão do item (SPEC-010, INV-003), sem receber valores em reais do navegador.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | A fórmula do preço não muda: para os mesmos dados, o preço sugerido é igual ao de antes desta Spec (RF34; INV-001 da SPEC-010). | Testes da SPEC-010 sem alteração, mais um teste com o exemplo da seção 1. |
| **INV-002** | A soma das partes da barra é igual ao preço sugerido, ao centavo, e nenhuma parte é negativa. | Teste de propriedade com combinações aleatórias de custo e percentuais. |
| **INV-003** | A barra e a memória mostram o mesmo valor em reais para cada parcela, vindo da mesma função. | Teste unitário da função e teste de tela comparando os dois. |
| **INV-004** | A comissão nunca entra no custo: o custo total do item no cálculo e no Catálogo continua sendo custo próprio + materiais. | Teste com comissão 0% e 10% e o mesmo custo. |
| **INV-005** | Nada novo é gravado: o `HistoricoPreco` e a memória do cálculo mantêm o formato atual (versão 1); os reais são calculados na exibição. | Teste de integração da confirmação, sem mudança no registro. |
| **INV-006** | No Catálogo, o valor da comissão aparece só com preço oficial e comissão maior que 0, e é igual a arredondar(preço oficial × comissão ÷ 100). | Teste unitário. |

---

## 7. Modelo de domínio envolvido

| Entidade | Uso | Mudança |
|---|---|---|
| `Item` | `comissaoPercentual`, `precoAtual`, `custoBase`, materiais | Só leitura |
| `HistoricoPreco` | memória do cálculo com a comissão em percentual | Nenhuma (INV-005) |

**Mudanças previstas no schema:** nenhuma.

---

## 8. Impacto arquitetural

- `src/lib/dominio/precificacao.ts`:
  - função pura com as partes do preço em reais (seção 5.1);
  - função pura com a comissão em reais no preço oficial (seção 5.4).
- `src/app/(app)/calculadora/page.tsx`: barra com as seis partes e memória com as linhas separadas e os reais. A página passa a usar a função do domínio no lugar do cálculo local.
- `src/components/graficos/barras-de-parte.tsx`: seis cores na `BarraEmpilhada`.
- `src/app/globals.css`: `--chart-6` nos temas claro e escuro e `--color-chart-6`.
- `docs/design/IDENTIDADE_VISUAL.md` (5.1): a cor da série 6 na tabela da paleta.
- `src/app/(app)/catalogo/[id]/page.tsx`: linha "Comissão" com os reais.
- Sem mudança em Server Actions, permissões, consultas, banco, exportação ou relatórios.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Partes do preço em reais** (domínio) | preço sugerido (centavos), DF%, taxa de cartão%, comissão%, Imp%, M% | custo do item, despesas fixas, maquininha, comissão, imposto e margem (centavos) | — |
| **Comissão no preço oficial** (domínio) | preço oficial (centavos, ou nenhum), comissão% | centavos, ou nada sem preço ou com comissão 0 | — |
| **Calcular preço** (SPEC-010) | Sem mudança | Sem mudança; a tela usa o contrato acima | Sem mudança |

**Implementação (29/10/2026):**
- **Domínio** (`src/lib/dominio/precificacao.ts`): `partesDoPrecoEmReais` (5.1) e `comissaoNoPreco` (5.4), funções puras.
- **Calculadora** (`src/app/(app)/calculadora/page.tsx`): a barra e a memória usam a mesma `partesDoPrecoEmReais` (INV-003); a barra tem as seis partes; a memória tem "Taxa da maquininha" e "Comissão do item" no lugar de "Despesas variáveis", com os reais em todas as parcelas.
- **Catálogo** (`src/app/(app)/catalogo/[id]/page.tsx`): a linha "Comissão" com os reais no preço oficial.
- **Paleta:** `--chart-6` (`#8e0374` no claro, `#9c43b9` no escuro) em `src/app/globals.css` e em `docs/design/identidade/tokens/tokens.css`, a série 6 na tabela da identidade visual (5.1) e a sexta cor na `BarraEmpilhada`.
- **Testes:** `test/unit/comissao-em-reais.test.ts` (T01, T02, T03 e T05) e a conferência dos campos da memória gravada no T07 da SPEC-010 (`test/integracao/calculadora.test.ts`, T04).
- Sem mudança no banco, nas ações, nas permissões ou nas consultas.

**Decisões de implementação (sem mudar o comportamento da Spec):**
- **Formato na memória:** o percentual e os reais aparecem separados por um ponto, "10,00% · R$ 9,52", em vez da vírgula usada nos exemplos ("10,00%, R$ 9,52"). Com números que já têm vírgula decimal, a vírgula entre eles confundia a leitura.
- **Custo de poucos centavos:** a regra da 5.1 (cada parcela arredondada; o custo do item é o que sobra) pode, em tese, passar do preço por um ou dois centavos quando o custo é de poucos centavos. Nesse caso, a maior parcela devolve a diferença, e a soma continua sendo o preço sem nenhuma parte negativa (INV-002). Nos valores reais, nada muda.
- **6ª cor:** escolhida com o validador da paleta e medida contra cada uma das outras cinco, porque as partes zeradas somem da barra e a Margem pode encostar em qualquer outra parte. Os números estão nas evidências e na identidade visual.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Barra com seis partes, legenda e memória legíveis no celular, sem rolagem horizontal. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF05** | O histórico do preço não muda. | INV-005. |
| **RNF06** | Nenhuma consulta nova: o cálculo continua abaixo de 2 s. | Teste de desempenho da SPEC-010 sem alteração. |

---

## 11. Critérios de aceitação

**CA-01 — Barra separada.** Dado o exemplo da seção 1, quando a pessoa calcula o preço, então a barra mostra "Maquininha: 3%, R$ 2,86" e "Comissão: 10%, R$ 9,52" em partes separadas, e a soma das partes é R$ 95,24.

**CA-02 — Memória em reais.** Dado o mesmo exemplo, então "Como o preço foi calculado" mostra despesas fixas R$ 14,29, maquininha R$ 2,86, comissão R$ 9,52, imposto R$ 0,00 e margem R$ 28,57, com os mesmos valores da barra.

**CA-03 — Preço igual.** Dados quaisquer custo e percentuais válidos, então o preço sugerido é o mesmo de antes desta Spec, e o custo total do item não inclui a comissão.

**CA-04 — Sem comissão.** Dado um item com comissão 0%, então a barra não mostra a parte "Comissão", e a memória mostra "0,00%, R$ 0,00" com "Este item não paga comissão."

**CA-05 — Simulação.** Dado um item com comissão de 2%, quando a pessoa simula 10%, então a barra e a memória mostram os reais dos 10%, o aviso de simulação aparece e a confirmação continua indisponível.

**CA-06 — Catálogo.** Dado um item com preço oficial de R$ 95,24 e comissão de 10%, então o detalhe mostra "10% (R$ 9,52 no preço atual)"; sem preço oficial, mostra só "10%"; com comissão 0, "0%".

**CA-07 — Visual.** Dadas a Calculadora e o detalhe do item, em 390, 768 e 1440 px, claro e escuro, então as seis cores da barra são distintas, a paleta passa no validador e não há rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Partes do preço em reais: exemplo da seção 1, comissão 0, imposto 0, arredondamentos; soma igual ao preço e nenhuma parte negativa com valores aleatórios | Unitário | CA-01, CA-02, INV-002, INV-003 |
| T02 | Preço sugerido igual ao de antes e custo total sem a comissão | Unitário | CA-03, INV-001, INV-004 |
| T03 | Comissão no preço oficial: com preço, sem preço, comissão 0 e arredondamento | Unitário | CA-06, INV-006 |
| T04 | Confirmação com o histórico no mesmo formato | Integração | INV-005 |
| T05 | Validação da paleta com seis cores nos dois temas | Unitário ou script | CA-07 |
| T06 | Roteiro no navegador: exemplo da seção 1, item sem comissão, simulação e detalhe do Catálogo | Manual com captura | CA-01 a CA-06 |
| T07 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-07 |
| T08 | Fluxo na homologação, com um item da loja de semijoias | Manual (uma vez) | CA-01 a CA-06 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 26/10/2026, em entrevista, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — A comissão entra no custo do item? | **Não somar** (recomendada): a comissão aparece em reais como despesa variável própria, **separada da maquininha**, para facilitar a visualização do valor que vai para a comissão. Hoje ela aparece junto da maquininha em "Despesas variáveis" e em "Maquininha e comissão". Descartado: uma linha só informativa de "custo com comissão". |
| **OPEN-002** — Barra "Para onde vai cada venda" | **Partes separadas** (recomendada): "Maquininha" e "Comissão" viram duas partes, com o valor em reais e uma 6ª cor na paleta, conferida nos dois temas. Descartado: manter uma parte só, com a divisão escrita na legenda. |
| **OPEN-003** — "Como o preço foi calculado" | **Reais em todas as parcelas** (recomendada): despesas fixas, maquininha, comissão, imposto e margem com o percentual e o valor em reais, e maquininha e comissão em linhas próprias, como na barra. Descartadas: reais só na comissão; manter a linha "Despesas variáveis" com os reais no detalhe. |
| **OPEN-004** — Fora da Calculadora | **Detalhe do item no Catálogo** (recomendada): "Comissão: 10% (R$ 9,52 no preço atual)"; sem preço oficial, só o percentual. Descartadas: também no formulário do item; só na Calculadora. |
| **OPEN-005** — Comissão na rentabilidade por item | **Fora, registrada como evolução** (recomendada): para descontar a comissão, cada venda precisa gravar a comissão do momento, porque a do item pode mudar depois; as vendas antigas não têm o dado, e no MVP não há repasse (RN20). Combina com uma futura Spec de comissões. Descartado: gravar a comissão na venda nesta Spec. |
| **OPEN-006** — Comissão no ponto de equilíbrio e na meta | **Fora, registrada como evolução** (recomendada): a comissão é de cada item, e o ponto de equilíbrio é do negócio; seria preciso a comissão média das vendas, que hoje não é gravada. Descartado: um parâmetro "comissão média das vendas" informado à mão. |

**Decisões derivadas do pedido e da baseline (sem questão nova):**
- a comissão continua **só percentual**: a revisora informou que esse é o padrão na maioria dos setores, e a comissão fixa em reais ficou fora (26/10/2026);
- a **fórmula do preço não muda**, e nada novo é gravado: os reais são calculados na exibição;
- **partes com valor zero** continuam fora da barra, e a memória mostra a comissão 0% com a explicação;
- a **simulação** mostra os reais da comissão simulada, e a confirmação continua com a comissão do item (SPEC-010);
- está nos **dois planos**, como a Calculadora (RF47);
- a **divergência da SPEC-016** (5.5) é corrigida por esta Spec: a barra volta a ter taxa e comissão separadas.

---

## 14. Definition of Done da Spec

A SPEC-023 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-07) estiverem implementados — por testes e no navegador (build local, 29/10/2026);
- [x] todos os invariantes (INV-001 a INV-006) estiverem preservados — testes T01 a T05;
- [ ] os testes derivados (T01 a T08) estiverem aprovados, com o CI verde no PR — T01 a T07 aprovados; falta a homologação (T08);
- [x] os RNFs aplicáveis (RNF01, RNF05, RNF06) tiverem sido verificados como descrito na seção 10 — capturas em 390, 768 e 1440 px nos dois temas, memória gravada sem mudança e nenhuma consulta nova;
- [x] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas (26/10/2026), com o RF52 e a regra de séries da identidade visual ajustados na baseline;
- [x] não existir divergência conhecida entre a implementação e esta Spec — as decisões de implementação (seção 9) não mudam o comportamento;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 9).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
