# SPEC-013 — Plano gratuito × pago

> **Status:** ✅ **Implementada e verificada na homologação em 11/10/2026** (PR #68) — questões em aberto decididas pela equipe (seção 13), todas pela opção recomendada; testes T01–T12 no CI, telas em build de produção com login (T13) e fluxo na homologação (T14) — [evidências](evidencias/SPEC-013/README.md). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-005](SPEC-005.md) (equipe, permissões e limite de colaboradores), [SPEC-008](SPEC-008.md) (vendas com custo gravado), [SPEC-009](SPEC-009.md) (fluxo de caixa e contas) e [SPEC-012](SPEC-012.md) (Dashboard) · **Próximas que dependem desta:** SPEC-015 (cobrança real, que substitui só o ponto de troca de plano).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-013 |
| **Nome** | Plano gratuito × pago |
| **Objetivo** | Diferenciar as funcionalidades por plano, nunca por volume: entregar os relatórios avançados do plano pago (rentabilidade por item, exportação de vendas, fluxo de caixa e contas em CSV e PDF, histórico acima de 12 meses), bloqueá-los no gratuito com a oferta de upgrade, e permitir ao Dono trocar o plano (simulado, sem cobrança) por um único ponto de troca (`alterarPlano`), registrando quem trocou e quando e suspendendo, na volta ao gratuito, os colaboradores além do limite. |
| **Valor entregue** | Viabiliza o modelo freemium sem afastar quem é sensível a preço: tudo o que é essencial (inclusive a Calculadora completa) continua gratuito e sem limite de registros; o plano pago acrescenta análise e trabalho em equipe. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF45 | Lista única das funcionalidades exclusivas do plano pago, consultada no servidor. |
| | RF46 | Nenhuma trava por quantidade de produtos, vendas ou lançamentos. |
| | RF47 | Exclusivos do pago: relatórios avançados (RF70, RF71), histórico acima de 12 meses e mais de 1 colaborador (o limite já existe desde a SPEC-005). |
| | RF70 | Relatório de rentabilidade por item: quantidade, faturamento, custo gravado na venda e margem real no período. |
| | RF71 | Exportação de vendas, fluxo de caixa e contas por período, em CSV e PDF. |
| | RF73 | Troca de plano pelo Dono, simulada, com registro de quem e quando; na volta ao gratuito, nada é apagado e os colaboradores além do limite perdem o acesso até um novo upgrade. |
| **RN** | RN18 | Limitação por funcionalidade, nunca por volume; no gratuito, listas e filtros mostram até os últimos 12 meses, sem apagar nada. |
| | RN01, RN02 | Membro suspenso perde o acesso na requisição seguinte; só o Dono troca o plano. |
| **RNF** | RNF10 | Ponto único de troca de plano (`alterarPlano`), que a SPEC-015 substitui pelo gateway sem mexer no resto. |
| | RNF02 | Guarda de plano no servidor, junto da guarda de permissão. |
| **Caso de uso / fluxo** | UC15 Gerenciar Plano do Negócio | — |
| **Entidades** | Negocio (`plano`, `planoAlteradoEm`, `planoAlteradoPorId`), MembroNegocio, Convite, Venda/ItemVenda, LancamentoFinanceiro, ContaPagarReceber | Ver seção 7. |
| **Drivers** | AD-QA05 | Guardas de acesso por plano no backend, sem contagem de registros. |
| **ADRs** | ADR-003 | Autorização no servidor; ADR-007 (proposta) fica para a SPEC-015. |

---

## 3. Escopo

### Incluído

1. **Funcionalidades por plano (RF45):** uma lista única no domínio (`relatorios`, `historicoCompleto`, `multiplosColaboradores`) e a guarda `exigirPlano` no servidor.
2. **Página "Plano"** (só o Dono): plano atual, o que cada plano inclui, a troca simulada com confirmação e o registro da última troca.
3. **Troca de plano (RF73):** `alterarPlano(negocio, novoPlano, dono)` — único ponto de troca, numa transação, com registro (OPEN-007). Na volta ao gratuito, escolha de quem continua com acesso e o destino dos convites pendentes (OPEN-001).
4. **Membro suspenso:** perde o acesso ao negócio (guarda da filiação, SPEC-002/005), vê o negócio em "Meus negócios" marcado "Acesso suspenso" e volta a ter acesso no upgrade.
5. **Relatórios** (só no pago): rentabilidade por item (RF70) e exportações (RF71) em CSV e PDF, por período livre; permissões conforme o OPEN-003.
6. **Oferta de upgrade** onde a funcionalidade está bloqueada (OPEN-004).
7. **Histórico de 12 meses no gratuito (RN18):** nas listas e filtros definidos no OPEN-005, com o aviso "No plano gratuito, até 12 meses" e o link para o plano.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cobrança real, checkout, portal, webhooks, inadimplência | SPEC-015 (opcional, ADR-007) |
| Limites por quantidade de registros | Nunca (RN18) |
| Relatórios agendados ou enviados por e-mail | Evolução futura |
| Planos além de gratuito e pago, ou preços na tela | Fora do MVP (a página mostra "simulado") |
| Exportação completa dos dados do titular (LGPD) | SPEC-014 |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-002/005: filiação lida a cada requisição, papel Dono, matriz de permissões, limite de colaboradores do gratuito (`LIMITE_DO_PLANO_GRATUITO`, convites pendentes contam).
  - SPEC-008/011: `ItemVenda.precoUnitario`, `custoUnitario` (inclui materiais), vendas canceladas fora.
  - SPEC-009: lançamentos com origem e categoria; contas com vencimento, situação e valor pago.
  - SPEC-012: o gráfico de 12 meses do Dashboard já respeita o limite.
- **Decisões arquiteturais:** ADR-003.
- **Pré-requisitos externos:** nenhum (com a OPEN-002 (a), uma dependência nova para gerar PDF).

---

## 5. Comportamento esperado

### 5.1 Página "Plano" e troca (UC15, RF73)

1. Em "Configurações → Plano" (só o Dono), a página mostra o plano atual, a comparação (o que os dois têm e o que só o pago tem) e a última troca ("Plano pago desde 11/10/2026, por Gisele").
2. **Gratuito → pago:** confirmação com o aviso "Simulação: nenhuma cobrança é feita nesta versão". Ao confirmar, `alterarPlano` grava o plano, `planoAlteradoEm`, `planoAlteradoPorId` e o registro do OPEN-007, e reativa os membros suspensos.
3. **Pago → gratuito:** a confirmação lista o que deixa de estar disponível (relatórios, histórico acima de 12 meses) e, se houver mais de 1 colaborador (membros + convites pendentes), aplica o OPEN-001. Nada é apagado (RN18).
4. Trocar para o mesmo plano é recusado ("O negócio já está no plano X") — protege o envio duplicado.

| Situação | Comportamento |
|---|---|
| Quem não é Dono abre a página ou chama a ação | Recusado (guarda de Dono, RN02). |
| Duas trocas simultâneas | A linha do negócio é travada (`FOR UPDATE`); a segunda vê o plano já trocado e é recusada. |
| Negócio encerrado | Recusado. |

### 5.2 Membro suspenso

1. A guarda de filiação recusa membro com `suspensoEm` preenchido, como se não fosse membro (RN01), na requisição seguinte.
2. Em "Meus negócios", o negócio aparece com o selo "Acesso suspenso — o negócio voltou ao plano gratuito" e sem o botão de entrar.
3. Na Equipe, o Dono vê os suspensos à parte; com vaga livre no gratuito, pode **trocar quem tem acesso** (suspender um e reativar outro) — conforme o OPEN-001.
4. Remover um membro suspenso continua possível.

### 5.3 Rentabilidade por item (RF70)

1. Período livre (padrão: mês atual; atalhos "mês passado", "últimos 3 meses", "últimos 12 meses"), em dias locais de São Paulo.
2. Para cada item vendido no período, só vendas `CONCLUIDA`: quantidade, **faturamento** = Σ(preço unitário × quantidade), **custo** = Σ(custo unitário gravado × quantidade), **margem** = faturamento − custo e **margem %** = margem ÷ faturamento.
3. Totais do período no rodapé; ordenação por margem (padrão), faturamento ou quantidade; item arquivado continua aparecendo com o selo "arquivado".
4. Item com custo zero gravado aparece com o aviso "custo não informado na venda" (a margem fica superestimada).

### 5.4 Exportações (RF71)

| Relatório | Linhas | Período por |
|---|---|---|
| Vendas | uma por venda: número, data, situação, total, formas de pagamento, itens resumidos, quem registrou | data da venda |
| Fluxo de caixa | um por lançamento: data, tipo, origem, categoria, descrição, valor com sinal, estornado | data do lançamento |
| Contas | uma por conta: tipo, descrição, categoria, vencimento, situação, total, pago, restante | vencimento |
| Rentabilidade | uma por item (5.3) | data da venda |

- **CSV** no formato do OPEN-006; **PDF** conforme o OPEN-002, com o nome do negócio, o período, a data de geração e os totais.
- Período máximo de uma exportação: 5 anos; o arquivo se chama `he-<relatorio>-<de>-a-<ate>.<csv|pdf>`.
- Valores em reais com 2 casas; datas em DD/MM/AAAA (São Paulo).

### 5.5 Gratuito: bloqueio, oferta e 12 meses (RN18, OPEN-004, OPEN-005)

1. Funcionalidade do pago chamada no gratuito — página ou rota de exportação — é recusada no servidor e mostra a oferta de upgrade conforme o OPEN-004.
2. Nas listas do OPEN-005, o gratuito só mostra os últimos 12 meses (do dia 1º do mês atual − 11 até hoje); datas anteriores no filtro são ajustadas para o limite, com o aviso "No plano gratuito, o histórico mostra os últimos 12 meses. Os registros mais antigos continuam guardados." e o link para o plano.
3. Cálculos não mudam: RBT12, CMV%, Fator R, saldo e projeção usam todos os dados, em qualquer plano.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhuma trava por volume: criar produto, venda, lançamento ou conta nunca consulta o plano. | Varredura: só `exigirPlano`/`podeNoPlano` leem o plano, e nenhuma escrita desses módulos os chama. |
| **INV-002** | Toda funcionalidade do pago é recusada no servidor no gratuito (página, ação e rota de exportação), não só escondida. | Testes chamando as rotas e ações direto. |
| **INV-003** | `alterarPlano` é o único lugar que escreve `Negocio.plano`, numa transação que grava também o registro da troca e as suspensões/reativações. | Varredura e teste de falha simulada. |
| **INV-004** | No gratuito, colaboradores com acesso + convites pendentes ≤ 1, depois de qualquer troca, convite, aceite ou reativação. | Testes com corrida (troca × aceite de convite). |
| **INV-005** | Voltar ao gratuito não apaga nem altera dados de negócio; o upgrade seguinte devolve tudo (membros e histórico). | Teste de ida e volta. |
| **INV-006** | Membro suspenso não acessa nada do negócio (páginas, ações, exportações) a partir da requisição seguinte. | Teste com a filiação e as guardas. |
| **INV-007** | Rentabilidade e exportações batem com as fontes: soma do faturamento da rentabilidade = faturamento do período (RN21); fluxo exportado = lançamentos do Financeiro; vendas canceladas fora da rentabilidade e marcadas na exportação de vendas. | Testes de integração. |
| **INV-008** | Isolamento: relatórios e exportações só do negócio ativo. | Teste com dois negócios. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Negocio` | `plano`, `planoAlteradoEm`, `planoAlteradoPorId` | Escrito só por `alterarPlano`. |
| `MembroNegocio` | **novo** `suspensoEm` | Suspenso não passa na filiação. |
| `Convite` | `status` | Conforme o OPEN-001 na volta ao gratuito. |
| `ItemVenda`, `Venda` | preço, custo, quantidade, status, data | Rentabilidade e exportação. |
| `LancamentoFinanceiro`, `ContaPagarReceber` | os da SPEC-009 | Exportação. |

**Mudanças previstas no schema:**

- `MembroNegocio.suspensoEm DateTime?` (com `CHECK` de que o Dono nunca é suspenso).
- Conforme o OPEN-007, tabela `HistoricoPlano` (negócio, de, para, usuário, data), somente inserção (gatilho `he_somente_insercao`).

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/planos.ts` — funcionalidades por plano, limite de histórico, regras de suspensão (puras);
  - `src/lib/db/planos.ts` — `alterarPlano`, suspender/reativar; `src/lib/db/relatorios.ts` — rentabilidade e as consultas de exportação;
  - `src/lib/auth/` — `exigirPlano` e a filiação sem suspensos;
  - `src/lib/relatorios/` — montagem de CSV e PDF;
  - `src/app/(app)/negocio/plano/`, `src/app/(app)/relatorios/` e as rotas de download (`route.ts`) das exportações;
  - ajustes nas listas do OPEN-005, em "Meus negócios" e na Equipe.
- **Fronteiras:** a SPEC-015 troca só o corpo de `alterarPlano` (que passará a ser chamado pelo webhook do gateway); o resto lê o plano por `podeNoPlano`.
- **Integrações:** nenhuma.
- **Identidade visual:** selo "Plano pago" com ícone e texto; a oferta de upgrade usa o cartão de destaque do tema; tabelas responsivas.

**Implementação (11/10/2026):**
- regras puras em `src/lib/dominio/planos.ts` (funcionalidades, limite do histórico, volta ao gratuito) e `src/lib/dominio/relatorios.ts` (período, rentabilidade, CSV);
- `alterarPlano` e `trocarAcesso` em `src/lib/db/planos.ts`; leituras dos relatórios em `src/lib/db/relatorios.ts`;
- tabelas, CSV e PDF (`pdf-lib` 1.17.1) em `src/lib/relatorios/`; fluxos e Server Actions do plano em `src/lib/planos/`;
- páginas `src/app/(app)/negocio/plano` e `src/app/(app)/relatorios`, e a rota de download `relatorios/exportar`;
- ajustes na filiação, em "Meus negócios", na Equipe, no menu e nas quatro listas do OPEN-005;
- migração `20261012100000_planos`.

**Divergências registradas na implementação:**

- **Banco:** além de `suspensoEm` e da tabela `HistoricoPlano`, entraram os CHECKs "o Dono nunca é suspenso" e "a troca registrada muda de fato o plano", e o RLS ligado na tabela nova (como em todas as outras — o teste de isolamento exige).
- **Aceite de convite trava o negócio antes do convite**, na mesma ordem de `alterarPlano`: aceite e volta ao gratuito simultâneos se enfileiram, sem impasse, e o limite nunca é ultrapassado (INV-004, teste com 5 rodadas).
- **Seletor de negócio** no topo não lista os negócios em que o membro está suspenso; "Meus negócios" mostra o negócio marcado.
- **Recusa da exportação:** no gratuito, volta à página dos relatórios (oferta de upgrade); sem a permissão, vai para "Sem acesso".
- **Rentabilidade:** o faturamento de cada linha é arredondado ao centavo, como o total da venda (SPEC-008), para a soma bater com o faturamento do período.
- **PDF com as fontes padrão** (sem fonte embutida): caracteres fora do alfabeto latino são trocados (ex.: "−" vira "-"); acentos do português saem normalmente.
- **Movimentações do estoque** limitadas pela data da ocorrência; o saldo e o consumo continuam usando tudo.
- **Rentabilidade no celular** em lista (cada item com todas as colunas), em vez da tabela com rolagem lateral.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Pode no plano** | plano, funcionalidade | sim/não | — |
| **Alterar plano** | negócio, novo plano, Dono, (quem continua — OPEN-001) | plano novo, suspensos, reativados, convites cancelados | `MesmoPlano`, `NaoEhDono`, `NegocioIndisponivel`, `EscolhaInvalida` |
| **Trocar quem tem acesso** | negócio, membro a reativar (e a suspender) | membros atualizados | `LimiteDoPlano`, `MembroNaoEncontrado` |
| **Rentabilidade** | negócio, período, ordenação | itens e totais | `PeriodoInvalido`, `PlanoGratuito`, `SemPermissao` |
| **Exportar** | negócio, relatório, período, formato | arquivo | os de cima |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF10** | `alterarPlano` como ponto único de troca. | INV-003 e revisão. |
| **RNF02** | Guardas de plano, Dono e permissão no servidor; suspensos fora. | INV-002, INV-006. |
| **RNF01** | Página do plano, relatórios e oferta responsivos; tabela da rentabilidade legível no celular. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF06** | Rentabilidade de 12 meses com 10 mil vendas e exportação de 10 mil linhas em menos de 3 s. | Teste de integração. |

---

## 11. Critérios de aceitação

**CA-01 — Sem trava de volume.** Dado um negócio gratuito, quando cadastra o 500º produto, a 10.000ª venda ou o 5.000º lançamento, então nada é bloqueado.

**CA-02 — Upgrade.** Dado um negócio gratuito, quando o Dono confirma a troca para o pago, então o plano muda na hora, a página mostra "Plano pago desde DD/MM/AAAA, por <Dono>" e os relatórios ficam disponíveis.

**CA-03 — Só o Dono.** Dado um Gerente, então ele não vê a página do plano e a ação chamada diretamente é recusada, sem mudar nada.

**CA-04 — Volta ao gratuito.** Dado um negócio pago com 3 colaboradores e 1 convite pendente, quando o Dono volta ao gratuito, então fica 1 colaborador com acesso (conforme o OPEN-001), os outros 2 ficam suspensos, o convite segue o OPEN-001 e nenhum dado é apagado.

**CA-05 — Suspenso.** Dado um colaborador suspenso, então na requisição seguinte ele não abre nenhuma página nem chama nenhuma ação do negócio, e em "Meus negócios" vê "Acesso suspenso".

**CA-06 — Upgrade de novo.** Dado o negócio do CA-04, quando volta ao pago, então os suspensos voltam a ter acesso com o mesmo papel e as mesmas permissões, e o histórico acima de 12 meses volta a aparecer.

**CA-07 — Limite mantido.** Dado um negócio gratuito com 1 colaborador com acesso, quando o Dono tenta reativar um suspenso sem suspender o atual, então é recusado; trocando um pelo outro, funciona.

**CA-08 — Rentabilidade.** Dadas no período 3 vendas de "Manicure" (R$ 50, custo gravado R$ 12) e 2 de "Esmalte" (R$ 18, custo R$ 8), mais 1 Manicure cancelada, então a Manicure mostra 3 un., R$ 150,00, custo R$ 36,00, margem R$ 114,00 (76%) e o Esmalte 2 un., R$ 36,00, custo R$ 16,00, margem R$ 20,00 (55,56%); o total de faturamento bate com o faturamento do período.

**CA-09 — Exportações.** Dado um período com vendas, lançamentos e contas, quando o Dono exporta cada relatório em CSV e em PDF, então os arquivos têm as linhas e os totais das telas (vendas canceladas marcadas, estornos com sinal), abrem no Excel/LibreOffice (CSV) e em qualquer leitor (PDF).

**CA-10 — Bloqueio no gratuito.** Dado um negócio gratuito, quando alguém abre os relatórios ou chama uma rota de exportação direto, então é recusado no servidor e vê a oferta de upgrade conforme o OPEN-004.

**CA-11 — 12 meses no gratuito.** Dado um negócio gratuito com vendas de 14 meses atrás, então o histórico de vendas (e as demais listas do OPEN-005) não mostra essas vendas e avisa o limite; o RBT12 e o CMV% da Calculadora continuam usando todo o histórico necessário; no pago, as vendas aparecem.

**CA-12 — Permissões dos relatórios.** Dado um membro sem as permissões do OPEN-003, então os relatórios correspondentes não aparecem e as rotas são recusadas.

**CA-13 — Corrida.** Dados a volta ao gratuito e o aceite de um convite ao mesmo tempo, então ao final o negócio tem no máximo 1 colaborador com acesso + pendentes.

**CA-14 — Visual.** Dadas as telas desta Spec, em 390, 768 e 1440 px, claro e escuro, então seguem os tokens, sem rolagem horizontal da página.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Funcionalidades por plano, limite do histórico (início do mês − 11), escolha de quem fica | Unitário | RF45, RN18 |
| T02 | Rentabilidade: somas, margem %, custo zero, ordenação | Unitário | CA-08 |
| T03 | CSV (separador, decimais, BOM, aspas, quebras de linha) e PDF (cabeçalho, totais, várias páginas) | Unitário | CA-09 |
| T04 | Varredura: nenhuma escrita de produto, venda, lançamento ou conta consulta o plano; `Negocio.plano` só escrito por `alterarPlano` | Unitário | CA-01, INV-001, INV-003 |
| T05 | Upgrade, registro da troca, mesmo plano recusado, só o Dono, troca simultânea | Integração | CA-02, CA-03 |
| T06 | Volta ao gratuito: suspensões, convites, nada apagado; upgrade devolve tudo | Integração | CA-04, CA-06, INV-005 |
| T07 | Suspenso: filiação, páginas, ações e exportações recusadas; "Meus negócios" | Integração | CA-05, INV-006 |
| T08 | Trocar quem tem acesso; corrida volta ao gratuito × aceite de convite | Integração | CA-07, CA-13, INV-004 |
| T09 | Rentabilidade e exportações batendo com as fontes; isolamento | Integração | CA-08, CA-09, INV-007, INV-008 |
| T10 | Bloqueio no gratuito (páginas, ações e rotas); permissões dos relatórios | Integração | CA-10, CA-12, INV-002 |
| T11 | 12 meses no gratuito nas listas; cálculos inalterados | Integração | CA-11 |
| T12 | Rentabilidade com 10 mil vendas e exportação de 10 mil linhas em menos de 3 s | Integração | RNF06 |
| T13 | Telas em 390/768/1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-14 |
| T14 | Fluxo completo na homologação | Manual (uma vez) | CA-01 a CA-13 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 11/10/2026, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Quem continua com acesso na volta ao gratuito | **O Dono escolhe na confirmação qual colaborador continua**; os outros ficam **suspensos** (vínculo, papel e permissões mantidos) e os **convites pendentes são cancelados**; com vaga livre, o Dono pode trocar quem tem acesso. |
| **OPEN-002** — Como gerar o PDF | **Arquivo PDF gerado no servidor** com `pdf-lib`, baixado como o CSV. |
| **OPEN-003** — Permissões dos relatórios | **Reaproveitar os módulos:** rentabilidade = Vendas — ver e Financeiro — ver; exportar vendas = Vendas — ver; fluxo de caixa e contas = Financeiro — ver. |
| **OPEN-004** — O que o gratuito vê | **"Relatórios" no menu com o selo "Plano pago"**; a página explica e oferece o upgrade (Dono → página do plano; demais → "Peça ao Dono do negócio"). |
| **OPEN-005** — Onde vale o limite de 12 meses | **Histórico de vendas, meses do fluxo de caixa, contas quitadas/canceladas e movimentações do estoque**; contas em aberto sempre; registro antigo abre pelo link. |
| **OPEN-006** — Formato do CSV | **Ponto e vírgula, vírgula decimal e UTF-8 com BOM.** |
| **OPEN-007** — Registro da troca de plano | **Tabela `HistoricoPlano` somente inserção**, além dos campos da última troca. |

Opções consideradas:

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Quem continua com acesso na volta ao gratuito | Com mais de 1 colaborador (membros + pendentes), o que acontece? | (a) **O Dono escolhe na confirmação qual colaborador continua** (já marcado o primeiro da lista); os outros ficam **suspensos** (o vínculo, o papel e as permissões são mantidos) e os **convites pendentes são cancelados** (podem ser reenviados depois); com vaga livre, o Dono pode trocar quem tem acesso; (b) todos os colaboradores ficam suspensos e o Dono reativa 1 depois | **(a)** — o negócio não fica parado no dia seguinte e o Dono decide quem é essencial; cancelar os pendentes evita que um aceite tardio passe do limite. |
| **OPEN-002** — Como gerar o PDF | Arquivo ou impressão? | (a) **Arquivo PDF gerado no servidor** (biblioteca `pdf-lib`, sem navegador), baixado como o CSV; (b) página própria para impressão com "Salvar como PDF" do navegador | **(a)** — o resultado é o mesmo em qualquer aparelho (inclusive celular), o nome do arquivo e o conteúdo são controlados e o teste automatizado confere o arquivo; `pdf-lib` é JavaScript puro e roda na Vercel. |
| **OPEN-003** — Permissões dos relatórios | Que permissão cada relatório exige? | (a) **Reaproveitar os módulos:** rentabilidade = Vendas — ver **e** Financeiro — ver (custo e margem são informação financeira); exportar vendas = Vendas — ver; fluxo de caixa e contas = Financeiro — ver; (b) um módulo novo "Relatórios" na matriz | **(a)** — não muda a matriz da SPEC-005 (nem as matrizes customizadas já gravadas) e segue o mesmo raciocínio do Dashboard completo. |
| **OPEN-004** — O que o gratuito vê | Esconder ou mostrar os recursos do pago? | (a) **Mostrar "Relatórios" no menu com o selo "Plano pago"**; a página explica o que o relatório faz e oferece o upgrade — o botão leva o Dono à página do plano; os demais veem "Peça ao Dono do negócio"; (b) esconder no gratuito | **(a)** — é a forma de o usuário descobrir o plano pago (RF47) sem bloquear nada do que ele já usa. |
| **OPEN-005** — Onde vale o limite de 12 meses | Quais listas ficam limitadas no gratuito? | (a) **Histórico de vendas, meses do fluxo de caixa, contas quitadas/canceladas e movimentações do estoque**; contas em aberto aparecem sempre, e abrir um registro antigo pelo link continua possível; (b) só o histórico de vendas e o fluxo de caixa | **(a)** — cobre todas as listas com histórico, de forma consistente; contas em aberto continuam visíveis porque ainda vão afetar o caixa. |
| **OPEN-006** — Formato do CSV | Separador e decimais | (a) **Ponto e vírgula, vírgula decimal e UTF-8 com BOM** (abre direto no Excel em português, com acentos); (b) vírgula e ponto decimal (padrão internacional) | **(a)** — o público usa Excel/LibreOffice em português; no formato (b) os valores e os acentos chegam quebrados. |
| **OPEN-007** — Registro da troca de plano | Só a última troca ou o histórico? | (a) **Tabela `HistoricoPlano` somente inserção** (de, para, quem, quando), além dos campos da última troca já existentes; (b) só os campos da última troca | **(a)** — auditoria completa por pouco esforço, e a SPEC-015 continuará registrando as trocas feitas pelo gateway no mesmo lugar. |

---

## 14. Definition of Done da Spec

A SPEC-013 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-14) estiverem implementados — por testes, em build de produção com login e na homologação (11/10/2026);
- [x] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [x] os testes derivados (T01 a T14) estiverem aprovados, com o CI verde no PR — T01 a T12 no CI do PR #68; T13 com capturas; T14 na homologação;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF06, RNF10) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-007 tiverem sido decididas e registradas;
- [x] não existir divergência conhecida entre a implementação e esta Spec;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 8).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
