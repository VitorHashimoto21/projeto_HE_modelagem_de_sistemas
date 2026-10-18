# SPEC-012 — Evidências (11/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/dashboard.test.ts`: série diária de 30 dias atravessando o mês (dias vazios com zero, venda de 31 dias atrás fora), 29/02 em ano bissexto, série mensal de 12 meses atravessando o ano | CA-04, CA-05 |
| T02 | idem: PE R$ 5.000 e meta R$ 8.000 → R$ 4.000 vermelho, R$ 5.000 amarelo, R$ 8.000 verde; sem meta (vermelho ou PE atingido); ritmo "o mês fecha em" (média por dia × dias do mês), sem mudar a cor, ausente no último dia e sem vendas | CA-06, CA-07, OPEN-003 |
| T03 | idem: mês atual + 5; o cenário do CA-09 (saldos R$ 500 · 100 · −300 · −1.000 · −1.500 · −2.000); conta vencida no mês passado no mês atual como atrasada; conta depois do 6º mês fora; competência com conta gerada não usa a despesa; `geraDesde`; DAS com valor por competência | CA-09, CA-10, INV-005 |
| T04 | `test/integracao/dashboard.test.ts`: 3 vendas hoje (R$ 50, 30, 20) → 3 vendas, R$ 100,00, ticket R$ 33,33, com cancelada, de ontem e do outro negócio fora; 23h30 de São Paulo no próprio dia e no próprio mês | CA-01, CA-02, INV-002, INV-003, INV-006 |
| T05 | idem: saldo do Dashboard = "Saldo atual" do Financeiro (PIX, crédito parcelado e saldo inicial) | CA-03, INV-001 |
| T06 | idem: série mensal = histórico da Calculadora; crédito 3x inteiro no mês da venda; canceladas e 13 meses atrás fora | CA-04, CA-05, INV-001 |
| T07 | idem: PE e meta iguais aos da Calculadora (R$ 1.639,34 e R$ 1.960,78); faturamento = mês atual do gráfico; sem histórico nem estimativa → indisponível com a mensagem da Calculadora; sem CMV → indisponível; sem meta → só o PE | CA-06 a CA-08, INV-001 |
| T08 | idem: saldo, conta gerada do aluguel, despesas estimadas nos meses seguintes, contas manuais, atrasada e outro negócio fora; MEI com o DAS dos meses futuros pelo parâmetro vigente e parcela paga pela metade pelo restante | CA-09, CA-10, INV-005, INV-006 |
| T09 | `test/unit/dashboard.test.ts`: cartões do Dono, do Gerente, do Colaborador, do Gerente sem Financeiro — ver e sem Dashboard — ver; a página só chama os carregadores financeiros para os cartões permitidos | CA-11, CA-12, INV-004 |
| T10 | Isolamento coberto em T04 e T08 (dois negócios) | INV-006 |
| T11 | `test/integracao/dashboard.test.ts`: 10 mil vendas em 12 meses e 500 contas → todos os cartões do Dashboard completo em menos de 2 s | CA-13, RNF06 |

São 23 testes novos (14 unitários e 9 de integração). Toda a suíte passa: lint, tipos e 523 testes.

## Build de produção local com login (T12)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiro no navegador com **32 verificações, todas OK, sem erro no log do servidor**:

- **Dono (Studio Gisele, MEI, margem de 20%):**
  - os seis cartões, sem cartão com falha, e a linha do enquadramento fiscal com o link para os dados do negócio;
  - saldo igual ao "Saldo atual" do Financeiro e PE igual ao da Calculadora (R$ 2.114,36);
  - semáforo vermelho com "Faltam R$ X para cobrir as despesas do mês", meta, barra com a marca do PE e o ritmo do mês;
  - gráfico com 30 barras; "12 meses" troca pela URL (`?grafico=meses`), com 12 barras e a tabela acessível com o mês atual "até agora";
  - depois de uma venda nova, as vendas de hoje sobem (+1 e o valor) e o faturamento do mês acompanha; o mês atual do gráfico é igual ao faturamento do semáforo;
  - projeção com 6 meses, despesas fixas estimadas, caixa negativo destacado e as contas atrasadas no mês atual.
- **Outro negócio (Clínica Bem Estar, Simples Nacional):** os cartões abrem sem erro.
- **Colaboradora (Ateliê Colab, predefinição):** só "Vendas de hoje" e "Estoque", e **nada financeiro no HTML** (saldo, semáforo, PE, projeção, faturamento, gráfico).
- **Sem "Dashboard: ver"** (matriz customizada): o nome do negócio e os atalhos, sem indicadores.
- **Telas:** Dashboard do Dono em 390, 768 e 1440 px, nos temas claro e escuro; gráfico por mês no celular; Colaborador em 390 e 1440 px — **sem rolagem horizontal**. Capturas em [`telas/`](telas/).

## Verificação na homologação (T13) — 11/10/2026

- **Merge do PR #66:** os workflows **CI** e **Migrações** ficaram verdes (sem migração nova).
- **Publicação:** a Vercel publicou <https://he-homol.vercel.app> com o commit do merge; `/api/saude` responde ok (aplicação e banco) e `/painel` sem sessão leva ao login.

**Teste pela equipe, com a própria conta:**
- Dashboard completo com os seis cartões;
- saldo igual ao do Financeiro e PE e meta iguais aos da Calculadora;
- gráfico de 30 dias e de 12 meses;
- venda nova refletida nas vendas de hoje e no faturamento do mês;
- projeção de caixa;
- telas no celular.

**Tudo funcionando.**
