# SPEC-012 — Dashboard e saúde financeira

> **Status:** ✅ **Implementada e verificada na homologação em 11/10/2026** (PR #66) — questões em aberto decididas pela equipe (seção 13), todas pela opção recomendada; testes T01–T11 no CI, telas em build de produção com login (T12) e fluxo na homologação (T13) — [evidências](evidencias/SPEC-012/README.md). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-005](SPEC-005.md) (Dashboard completo × restrito), [SPEC-007](SPEC-007.md) (alertas de estoque), [SPEC-008](SPEC-008.md) (vendas), [SPEC-009](SPEC-009.md) (saldo, contas e despesas fixas), [SPEC-010](SPEC-010.md) (ponto de equilíbrio e meta) e [SPEC-011](SPEC-011.md) (vendas canceladas fora dos números) · **Próximas que dependem desta:** SPEC-013 (relatórios avançados do plano pago).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-012 |
| **Nome** | Dashboard e saúde financeira |
| **Objetivo** | Transformar a página inicial do negócio no Dashboard: resumo do dia (vendas do dia, saldo em caixa, alertas de estoque baixo), gráfico de vendas (30 dias por dia ou 12 meses por mês), semáforo de saúde financeira (faturamento do mês × ponto de equilíbrio × meta) e projeção de caixa dos próximos meses — completo para quem tem Financeiro, restrito (vendas do dia e alertas) para o Colaborador. |
| **Valor entregue** | Visão imediata da saúde do negócio ao abrir o sistema — a proposta "visual e sob controle": quanto vendeu hoje, quanto tem no caixa, se o mês está pagando as contas e se o caixa aguenta os próximos meses. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF42 | Resumo do dia para Dono e Gerente: vendas do dia, saldo em caixa e alertas de estoque baixo. |
| | RF43 | Gráfico de vendas por dia dos últimos 30 dias, com opção por mês dos últimos 12 meses. |
| | RF44 | Dashboard montado por cartões independentes, cada um com sua exigência de permissão e sua consulta; um indicador novo é um cartão novo, sem redesenhar a tela. |
| | RF56 | Faturamento meta mensal, reaproveitado da SPEC-010 (`analisarNegocio`). |
| | RF57 | Semáforo: Vermelho (faturamento do mês < PE), Amarelo (PE ≤ faturamento < Meta), Verde (≥ Meta); sem margem meta, só abaixo/acima do PE e o convite para configurar a meta. Só para quem vê o Dashboard completo. |
| | RF63 | Dashboard restrito: vendas do dia e alertas de estoque baixo, sem saldo, semáforo, PE, gráficos nem projeção. |
| | RF68 | Projeção de caixa: saldo atual + contas a receber abertas − contas a pagar abertas, por mês de vencimento; nos meses sem contas de despesas fixas geradas, usa as despesas fixas ativas. |
| **RN** | RN21 | Faturamento por competência: soma de `Venda.valorTotal` das vendas não canceladas, inclusive crédito ainda não recebido. |
| | RN25 (consumo) | Vendas canceladas fora das vendas do dia, do gráfico e do semáforo. |
| | RN29 | Dia e mês sempre em America/Sao_Paulo. |
| | RN14 | Saldo em caixa = o mesmo saldo real do Financeiro (só o recebido/pago de fato). |
| **RNF** | RNF01 | Dashboard responsivo; semáforo com ícone e texto, nunca só cor; gráfico com alternativa em texto. |
| | RNF06 | Consultas agregadas no banco (índices `Venda(negocioId, data, status)` e `ContaPagarReceber(negocioId, vencimento, status)`), rápidas mesmo com histórico extenso. |
| | RNF10 | Cartões independentes e extensíveis (RF44). |
| | RNF02 | Partes financeiras calculadas e enviadas só para quem tem a permissão (SPEC-005, OPEN-003). |
| **Caso de uso / fluxo** | UC14 Consultar Dashboard · UC17 Ver Semáforo e Ponto de Equilíbrio · UC19 Consultar Projeção de Caixa | Jornadas do Dono/Gerente ("Dashboard — resumo do dia, saldo e semáforo") e do Colaborador ("Dashboard restrito — vendas do dia + alertas de estoque") em `MODELO_DOMINIO_E_JORNADAS.md`. |
| **Entidades** | Venda, LancamentoFinanceiro, ContaPagarReceber, DespesaFixa, Negocio (margem meta), Item (alertas) | Somente leitura. |
| **Drivers** | AD-QA01, AD-QA04 | Desempenho das agregações; interface responsiva. |
| **ADRs** | ADR-001, ADR-005 | Monólito Next.js (Server Components); PE e meta pelo motor puro da SPEC-010. A biblioteca de gráficos é decisão da camada de apresentação (sem ADR — OPEN-002). |

---

## 3. Escopo

### Incluído

1. **Dashboard como página inicial do negócio**, conforme o OPEN-001.
2. **Vendas do dia** (completo e restrito): quantidade e total das vendas concluídas de hoje, conforme o OPEN-006, com link para o histórico de hoje.
3. **Saldo em caixa** (completo): o saldo atual do Financeiro (RN14), com link para o fluxo de caixa.
4. **Alertas de estoque baixo** (completo e restrito): o cartão da SPEC-007 (produtos com estoque baixo e sem estoque), para quem tem Estoque — ver.
5. **Gráfico de vendas** (completo): por dia nos últimos 30 dias (padrão) ou por mês nos últimos 12 meses, com o mês atual marcado como parcial; forma conforme o OPEN-002.
6. **Semáforo de saúde financeira** (completo): faturamento do mês atual × PE e meta da SPEC-010, com as regras do RF57 e a leitura do início do mês conforme o OPEN-003.
7. **Projeção de caixa** (completo): mês a mês, entradas previstas, saídas previstas e saldo projetado acumulado, conforme o OPEN-004; meses com saldo negativo destacados.
8. **Acesso:** "Dashboard: ver" mostra a parte restrita; as partes financeiras exigem também "Financeiro: ver" (SPEC-005, OPEN-003). Membro sem "Dashboard: ver" conforme o OPEN-005.
9. **Extensibilidade (RF44):** cada cartão é um componente com a sua exigência e a sua consulta, listado numa configuração única do Dashboard.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Rentabilidade por item, exportação CSV/PDF, histórico acima de 12 meses | SPEC-013 (plano pago) |
| Filtros de período livres, comparação entre períodos, metas por item | Evolução futura |
| Personalizar a ordem ou esconder cartões | Evolução futura (a estrutura de cartões permite) |
| Notificações (e-mail/push) de semáforo vermelho ou caixa negativo | Evolução futura |
| Atualização em tempo real sem recarregar | Fora do MVP — os números são recalculados a cada abertura e depois de cada venda, movimentação ou lançamento (`revalidatePath("/painel")` já existe) |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-005: `veDashboardCompleto` e a matriz de permissões.
  - SPEC-007: `contarAlertas` (estoque baixo e sem estoque).
  - SPEC-008/011: vendas com `status`, `data` e `valorTotal`; canceladas fora.
  - SPEC-009: saldo atual (`fluxo`), contas a pagar/receber com `vencimento`, `status` e valor pago; despesas fixas ativas com `geraDesde`; DAS do MEI pelo parâmetro vigente; `conferirFinanceiro` (gera as contas do mês e recebe as parcelas vencidas).
  - SPEC-010: `analisarNegocio` (PE, meta, margem meta, motivos de bloqueio).
- **Decisões arquiteturais:** ADR-001, ADR-005.
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Abertura do Dashboard (UC14)

1. Ao abrir a página inicial do negócio, o servidor lê a filiação e as permissões (SPEC-005) e monta só os cartões permitidos:

| Cartão | Exige |
|---|---|
| Vendas do dia | Dashboard — ver |
| Alertas de estoque | Dashboard — ver + Estoque — ver |
| Saldo em caixa, gráfico de vendas, semáforo, projeção de caixa | Dashboard — ver + Financeiro — ver |

2. Para quem vê as partes financeiras, a conferência do Financeiro (SPEC-009) roda **antes** de ler os números — o saldo e a projeção já incluem as parcelas vencidas recebidas e as contas do mês geradas. Para o restrito, continua depois da resposta (`after`), como hoje.
3. Os cartões carregam em paralelo; a falha de um cartão mostra "Não foi possível carregar este indicador agora" só nele, sem derrubar a página.
4. Nada do que o membro não pode ver é calculado nem enviado ao navegador (INV-004).

### 5.2 Resumo do dia (RF42, RF63)

- **Vendas do dia:** vendas `CONCLUIDA` com data no dia de hoje em São Paulo — conforme o OPEN-006. Sem vendas: "Nenhuma venda hoje" e, se puder vender, o atalho "Nova venda".
- **Saldo em caixa:** igual ao "Saldo atual" do Financeiro; negativo com sinal e destaque (ícone + texto).
- **Alertas de estoque:** o cartão atual do Painel (SPEC-007, OPEN-009), sem mudança de regra.

### 5.3 Gráfico de vendas (RF43)

1. **Padrão — por dia, últimos 30 dias:** de hoje − 29 até hoje (São Paulo), um valor por dia (dias sem venda = R$ 0,00), soma de `valorTotal` das vendas `CONCLUIDA` (RN21).
2. **Por mês, últimos 12 meses:** do mês atual − 11 até o mês atual; o mês atual aparece como "até hoje".
3. A troca de visão é um link (`?grafico=meses`), funciona sem JavaScript e preserva a URL para compartilhar.
4. Acessibilidade: título, total do período e maior valor em texto; os valores ficam disponíveis numa tabela (visível ao expandir "Ver os valores") e cada barra tem rótulo para leitor de tela.

### 5.4 Semáforo de saúde financeira (RF56, RF57, UC17)

1. **Faturamento do mês:** soma de `valorTotal` das vendas `CONCLUIDA` do mês atual em São Paulo (RN21) — o mesmo valor do mês atual no gráfico mensal.
2. **PE e meta:** os da SPEC-010 (`analisarNegocio`), com as mesmas despesas fixas, CMV%, imposto e taxa média de cartão da Calculadora — o Dashboard nunca recalcula por conta própria (INV-001).
3. **Cores** (sempre com ícone e texto):

| Situação | Semáforo | Texto |
|---|---|---|
| Faturamento < PE | 🔴 Vermelho — Déficit | "Faltam R$ X para cobrir as despesas do mês." |
| PE ≤ faturamento < Meta | 🟡 Amarelo — Alerta | "Despesas cobertas. Faltam R$ Y para a meta de Z% de lucro." |
| Faturamento ≥ Meta | 🟢 Verde — Saudável | "Meta do mês atingida." |
| Sem margem meta | Só abaixo/acima do PE (vermelho ou "PE atingido") | "Configure a margem de lucro desejada para ver a meta." + link para os parâmetros (se puder editar a Calculadora) |
| PE não calculável (sem histórico nem estimativa, parâmetros fiscais ausentes, percentuais ≥ 100%) | ⚪ Indisponível | A mensagem da SPEC-010 para o motivo + link para os parâmetros |

4. A leitura no início do mês (faturamento parcial × PE do mês inteiro) segue o OPEN-003.
5. Barra de progresso do faturamento até a meta (ou até o PE, sem meta), com as marcas do PE e da meta.

### 5.5 Projeção de caixa (RF68, UC19)

1. **Período:** conforme o OPEN-004.
2. **Para cada mês:**
   - **Entradas previstas** = Σ (valor total − valor pago) das contas a **receber** `ABERTA`/`PARCIAL` com vencimento no mês;
   - **Saídas previstas** = Σ (valor total − valor pago) das contas a **pagar** `ABERTA`/`PARCIAL` com vencimento no mês + o valor mensal de cada **despesa fixa ativa sem conta gerada naquela competência** (respeitando `geraDesde`; o DAS do MEI pelo parâmetro vigente no vencimento);
   - **Saldo projetado** = saldo atual + Σ (entradas − saídas) do primeiro mês até ele.
3. Contas vencidas e ainda abertas conforme o OPEN-004.
4. Mês com saldo projetado negativo: destaque com ícone e o texto "Caixa negativo previsto".
5. Rodapé fixo: "Projeção a partir das contas registradas e das despesas fixas ativas; não inclui vendas futuras."

### 5.6 Datas

Hoje, os 30 dias, os 12 meses e as competências da projeção são calculados em America/Sao_Paulo (RN29), com as funções de `src/lib/dominio/datas.ts` e `financeiro.ts`; as consultas agregam com `AT TIME ZONE 'America/Sao_Paulo'`, como a SPEC-010.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Números consistentes entre telas: faturamento do mês no semáforo = mês atual do gráfico mensal = total do mês no histórico de vendas; saldo = "Saldo atual" do Financeiro; PE e meta = os da Calculadora. | Teste de integração comparando as fontes. |
| **INV-002** | Vendas canceladas não entram nas vendas do dia, no gráfico nem no semáforo. | Teste com venda cancelada no dia e no mês. |
| **INV-003** | Dia e mês em São Paulo: venda às 23h30 de São Paulo (02h30 UTC do dia seguinte) conta no dia de São Paulo. | Teste nas bordas do dia e do mês. |
| **INV-004** | Sem "Financeiro: ver", as consultas financeiras nem rodam e nenhum valor financeiro chega ao HTML. | Teste dos cartões por permissão + verificação no build. |
| **INV-005** | A projeção não conta nada duas vezes: competência com conta gerada usa só a conta; contas quitadas e canceladas ficam fora; parciais entram pelo restante. | Testes unitários da montagem da projeção + integração. |
| **INV-006** | Isolamento: toda consulta passa pelo cliente do negócio; SQL direto filtra `negocioId` à mão. | Teste com dois negócios. |
| **INV-007** | O Dashboard só lê: a única escrita é a conferência do Financeiro já existente (SPEC-009). | Revisão e testes. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Venda` | `data`, `status`, `valorTotal` | Só `CONCLUIDA` (RN21, RN25). |
| `LancamentoFinanceiro` | saldo (via `fluxo` da SPEC-009) | RN14. |
| `ContaPagarReceber` | `tipo`, `status`, `vencimento`, `valorTotal`, valor pago, `despesaFixaId`, `competencia` | Só `ABERTA`/`PARCIAL`, pelo restante. |
| `DespesaFixa` | `ativo`, `valorMensal`, `diaVencimento`, `geraDesde`, `origem` (DAS) | Só nos meses sem conta gerada. |
| `Negocio` | `margemLucroMeta` e os parâmetros da Calculadora | Via SPEC-010. |
| `Item` | estoque mínimo e saldo (via SPEC-007) | Alertas. |

**Mudanças previstas no schema:** nenhuma. Os índices necessários já existem.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/dashboard.ts` — funções puras: série diária e mensal (preenche dias/meses vazios), cor e textos do semáforo, montagem da projeção (contas + despesas sem conta gerada, saldo acumulado);
  - `src/lib/db/dashboard.ts` — consultas agregadas (vendas por dia/mês, contas abertas por mês de vencimento, competências com conta gerada por despesa);
  - `src/lib/dashboard/` — lista de cartões (exigência + carregador), orquestração e tratamento de falha por cartão;
  - `src/app/(app)/painel/page.tsx` (ou a rota do OPEN-001) e `src/components/dashboard/` — cartões, gráfico e semáforo.
- **Fronteiras:** reutiliza `analisarNegocio` (SPEC-010), `fluxo` e `conferirFinanceiro` (SPEC-009), `contarAlertas` (SPEC-007) e `veDashboardCompleto` (SPEC-005); não duplica fórmulas.
- **Integrações:** nenhuma.
- **Identidade visual:** cores de status do tema (`status-ok`, `status-warn`, `status-danger`) com ícone e texto; números com sinal como no Financeiro; gráfico com a cor primária e contraste nos dois temas.

**Implementação (11/10/2026):**
- funções puras (séries, semáforo, projeção e a lista de cartões com o que cada um exige) em `src/lib/dominio/dashboard.ts`;
- consultas agregadas em `src/lib/db/dashboard.ts` e `saldoAtual` em `src/lib/db/financeiro.ts` (a mesma soma do "Saldo atual" do fluxo de caixa);
- carregadores dos cartões, com a falha isolada por cartão, em `src/lib/dashboard/`;
- página `src/app/(app)/painel/page.tsx` e cartões em `src/components/dashboard/cartoes.tsx`;
- sem migração.

**Divergências registradas na implementação:**

- **PE não calculável, em três casos:** os bloqueios da Calculadora (mensagem dela), "sem CMV" (sem histórico nem CMV estimado) e "inviável" (percentuais somam 100% ou mais). Nos três o semáforo fica "Indisponível", com link para os parâmetros (ou para os dados do negócio, quando falta regime, Anexo ou atividade).
- **Sem meta e PE atingido:** selo verde "Ponto de equilíbrio atingido" e o convite para configurar a meta.
- **Gráfico e projeção empilhados** em todas as larguras: lado a lado, a projeção ficava apertada na tela larga.
- **Barra do dia de hoje (ou do mês atual) mais clara**, marcada "até agora" na tabela e no rótulo da barra.
- **Atalhos (OPEN-005):** os mesmos itens do menu do membro, sem o "Painel".
- **Contas atrasadas:** aviso abaixo da projeção, com link para as contas atrasadas no Financeiro.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Vendas do dia** | negócio, hoje | quantidade, total (e o que o OPEN-006 definir) | — |
| **Série de vendas** | negócio, visão (dias/meses), hoje | lista de {período, total}, total do período, maior valor | — |
| **Semáforo** | negócio, hoje | faturamento do mês, PE, meta, cor, textos, progresso — ou indisponível com o motivo | os bloqueios da SPEC-010 viram "indisponível" |
| **Projeção de caixa** | negócio, hoje | saldo atual e, por mês, entradas, saídas, saldo projetado, atrasadas, negativo | — |
| **Cartões do Dashboard** | membro | lista dos cartões permitidos, na ordem | falha de um cartão isolada |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Cartões em grade responsiva; semáforo com ícone e texto; gráfico legível no celular, com alternativa em texto. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login (Dono e Colaborador). |
| **RNF02** | Cartões financeiros só com Financeiro — ver, decidido no servidor. | INV-004. |
| **RNF06** | Dados do Dashboard completo em menos de 2 s com 10 mil vendas em 12 meses e 500 contas. | Teste de integração. |
| **RNF10** | Novo indicador = novo cartão na lista, sem mexer nos outros. | Revisão da estrutura e teste da lista de cartões. |

---

## 11. Critérios de aceitação

**CA-01 — Vendas do dia.** Dadas 3 vendas concluídas hoje (R$ 50, R$ 30 e R$ 20), 1 cancelada hoje e 1 de ontem, então o cartão mostra 3 vendas e R$ 100,00.

**CA-02 — Fuso.** Dada uma venda às 23h30 de São Paulo do último dia do mês, então ela conta nesse dia e nesse mês, no cartão do dia, no gráfico e no semáforo.

**CA-03 — Saldo.** Dado o Financeiro com saldo atual de R$ 1.234,56, então o Dashboard mostra o mesmo valor; com uma parcela do cartão vencida hoje ainda não conferida, o saldo já a inclui ao abrir o Dashboard.

**CA-04 — Gráfico por dia.** Dadas vendas em 5 dos últimos 30 dias e uma venda de 31 dias atrás, então o gráfico tem 30 dias, os outros 25 com zero, a venda antiga fica fora e o total do período bate com a soma.

**CA-05 — Gráfico por mês.** Dada uma venda de R$ 300 no crédito em 3x feita no mês passado, então ela conta inteira no mês passado (RN21); o mês atual aparece como "até hoje".

**CA-06 — Semáforo.** Dados PE = R$ 5.000 e meta = R$ 8.000, então: faturamento R$ 4.000 → Vermelho ("Faltam R$ 1.000,00 para cobrir as despesas do mês"); R$ 5.000 → Amarelo; R$ 8.000 → Verde.

**CA-07 — Sem meta.** Dado um negócio sem margem meta, então o semáforo indica só abaixo/acima do PE e convida a configurar a meta, com link para os parâmetros apenas para quem pode editar a Calculadora.

**CA-08 — Indisponível.** Dado um negócio sem vendas anteriores e sem faturamento estimado, então o semáforo aparece como indisponível com a mensagem da SPEC-010 e o link para os parâmetros.

**CA-09 — Projeção.** Dados saldo de R$ 1.000, uma venda no crédito com 2 parcelas de R$ 100 a receber nos próximos 2 meses, o aluguel de R$ 500 como despesa fixa (conta do mês atual gerada e aberta) e uma conta avulsa a pagar de R$ 200 daqui a 3 meses, então a projeção mostra (mês atual → +5): saldo projetado R$ 500 · R$ 100 · −R$ 300 (caixa negativo previsto) · −R$ 1.000 · −R$ 1.500 · −R$ 2.000; o aluguel dos meses futuros vem da despesa fixa, sem duplicar o do mês atual.

**CA-10 — Contas atrasadas.** Dada uma conta a pagar de R$ 80 vencida no mês passado e ainda aberta, então ela entra na projeção conforme o OPEN-004.

**CA-11 — Restrito.** Dado um Colaborador predefinido, então ele vê vendas do dia e alertas de estoque, e o HTML não contém saldo, semáforo, PE, gráfico nem projeção; um Gerente com "Financeiro: ver" desmarcado vê o mesmo restrito.

**CA-12 — Sem Dashboard.** Dado um membro sem "Dashboard: ver", então a página inicial segue o OPEN-005.

**CA-13 — Desempenho.** Dado um negócio com 10 mil vendas em 12 meses e 500 contas, então os dados do Dashboard completo carregam em menos de 2 s.

**CA-14 — Visual.** Dado o Dashboard completo e o restrito, em 390, 768 e 1440 px, claro e escuro, então seguem os tokens, sem rolagem horizontal, e o semáforo e os valores negativos nunca dependem só de cor.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Séries diária e mensal: dias/meses vazios, bordas do mês, ano bissexto | Unitário | CA-04, CA-05 |
| T02 | Semáforo: cores, textos, sem meta, indisponível, progresso; leitura do início do mês (OPEN-003) | Unitário | CA-06 a CA-08 |
| T03 | Montagem da projeção: contas, despesas sem conta gerada, `geraDesde`, DAS, parciais, atrasadas, saldo acumulado | Unitário | CA-09, CA-10, INV-005 |
| T04 | Vendas do dia com cancelada e de ontem; fuso nas bordas | Integração | CA-01, CA-02, INV-002, INV-003 |
| T05 | Saldo igual ao do Financeiro, com conferência antes da leitura | Integração | CA-03, INV-001 |
| T06 | Série de vendas no banco igual ao histórico; crédito parcelado no mês da venda | Integração | CA-04, CA-05, INV-001 |
| T07 | Semáforo com PE e meta iguais aos da Calculadora | Integração | CA-06, INV-001 |
| T08 | Projeção no banco com contas, despesas fixas e DAS | Integração | CA-09, CA-10 |
| T09 | Cartões por permissão (Dono, Gerente, Colaborador, Gerente sem Financeiro, sem Dashboard); consultas financeiras não executadas | Unitário + integração | CA-11, CA-12, INV-004 |
| T10 | Isolamento entre dois negócios | Integração | INV-006 |
| T11 | 10 mil vendas e 500 contas em menos de 2 s | Integração | CA-13, RNF06 |
| T12 | Telas em 390/768/1440 px, claro e escuro, Dono e Colaborador, em build de produção com login | Manual com captura | CA-14 |
| T13 | Fluxo completo na homologação | Manual (uma vez) | CA-01 a CA-12 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 11/10/2026, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Onde fica o Dashboard | **Substitui o conteúdo de `/painel`**, que continua a página inicial (menu "Painel"); o "Enquadramento fiscal" vira uma linha compacta com link para os dados do negócio. |
| **OPEN-002** — Como desenhar o gráfico | **SVG próprio, desenhado no servidor** (barras), com tabela de valores acessível; sem biblioteca nova. |
| **OPEN-003** — Semáforo no começo do mês | **Comparação literal do RF57 + linha informativa "No ritmo atual, o mês fecha em R$ X"** (média por dia × dias do mês), marcada como estimativa; a cor não muda por ela. |
| **OPEN-004** — Período da projeção e contas atrasadas | **Mês atual + 5 seguintes**; contas vencidas e ainda abertas entram no mês atual, destacadas como "atrasadas". |
| **OPEN-005** — Membro sem "Dashboard: ver" | **Nome do negócio e atalhos** para os módulos que ele pode usar, sem indicadores. |
| **OPEN-006** — Vendas do dia | **Quantidade, total e ticket médio de hoje** + link "Ver as vendas de hoje", igual no completo e no restrito. |

Opções consideradas:

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Onde fica o Dashboard | Rota e o que acontece com o Painel atual | (a) **O Dashboard substitui o conteúdo de `/painel`** (continua a página inicial, menu "Painel"); o bloco "Enquadramento fiscal" vira uma linha compacta com link para os dados do negócio; (b) nova rota `/dashboard` como inicial e o Painel atual continua como página de dados do negócio | **(a)** — o Painel foi feito provisório justamente para ser substituído (SPEC-004); mantém a rota inicial, os links e o `revalidatePath` existentes. |
| **OPEN-002** — Como desenhar o gráfico | Biblioteca ou desenho próprio? | (a) **SVG próprio, desenhado no servidor** (barras simples), com tabela de valores acessível; (b) biblioteca de gráficos no navegador (ex.: Recharts) | **(a)** — o gráfico é simples (uma série de barras), sem dependência nova nem JavaScript extra no celular, e segue os tokens nos dois temas; uma biblioteca pode entrar depois só na camada de apresentação. |
| **OPEN-003** — Semáforo no começo do mês | O faturamento do mês é parcial; o PE é do mês inteiro | (a) Comparação literal do RF57 (acumulado do mês × PE e meta do mês) com barra de progresso; (b) comparar com o PE proporcional aos dias já passados (diverge do RF57); (c) **literal do RF57 + uma linha informativa "No ritmo atual, o mês fecha em R$ X"** (média por dia × dias do mês), sem mudar a cor | **(c)** — segue a baseline (a cor só muda pelo faturamento real) e evita a leitura de "vermelho" no dia 3 sem contexto; a estimativa é claramente marcada como estimativa. |
| **OPEN-004** — Período da projeção e contas atrasadas | "Próximos 6 meses" e o que fazer com contas vencidas abertas | (a) **Mês atual + 5 seguintes; contas vencidas e ainda abertas entram no mês atual, destacadas como "atrasadas"**; (b) os 6 meses seguintes ao atual, sem as atrasadas | **(a)** — o mês atual é o que mais importa para o caixa, e uma conta atrasada ainda vai sair (ou entrar) do caixa; ignorá-la deixaria a projeção otimista. |
| **OPEN-005** — Membro sem "Dashboard: ver" | O que a página inicial mostra? | (a) **O nome do negócio e atalhos para os módulos que ele pode usar**, sem indicadores; (b) a tela de "sem acesso" | **(a)** — a página inicial é o destino depois do login e da troca de negócio; mandar para "sem acesso" pareceria erro. |
| **OPEN-006** — Vendas do dia | O que o cartão mostra? | (a) **Quantidade, total e ticket médio de hoje** + link "Ver as vendas de hoje", igual no completo e no restrito; (b) o mesmo + as últimas 5 vendas do dia | **(a)** — é o que o RF42/RF63 pedem e cabe num cartão no celular; a lista já existe no histórico de vendas, a um clique. |

---

## 14. Definition of Done da Spec

A SPEC-012 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-14) estiverem implementados — por testes, em build de produção com login e na homologação (11/10/2026);
- [x] todos os invariantes (INV-001 a INV-007) estiverem preservados;
- [x] os testes derivados (T01 a T13) estiverem aprovados, com o CI verde no PR — T01 a T11 no CI do PR #66; T12 com capturas; T13 na homologação;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF06, RNF10) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas (seção 13, 11/10/2026);
- [x] não existir divergência conhecida entre a implementação e esta Spec;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 8).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
