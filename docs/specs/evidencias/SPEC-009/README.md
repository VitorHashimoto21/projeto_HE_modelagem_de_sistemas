# SPEC-009 — Evidências (09/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/financeiro.test.ts`: saldo, situação pelo valor pago, "atrasada", vencimento em meses curtos (fevereiro, bissexto), primeira competência pelo OPEN-004, limite de 24 competências, descrições até 120 caracteres | CA-01, CA-07 |
| T02 | idem: validação do avulso (12 casos de recusa, "1.234,56", 90 dias aceitos), saldo inicial, pagamento, conta (vencimento passado aceito) e despesa (dia 1–31) | — |
| T03 | `test/integracao/financeiro.test.ts`: PIX R$ 50 + crédito R$ 300 em 3x → saldo R$ 50 e 3 contas a receber; **2 saldos iniciais simultâneos → 1**; estornado, pode ser informado de novo | CA-01, CA-02, INV-001 |
| T04 | idem: saída avulsa R$ 80 com descrição e autor; **2 estornos simultâneos → 1**; estorno de estorno e de venda recusados; banco recusa `UPDATE`/`DELETE` (`he_somente_insercao`) e valor zero | CA-03, CA-04, INV-006 |
| T05 | idem: conta de R$ 300 → R$ 100 (PARCIAL, saída com a categoria), R$ 250 recusado ("O restante desta conta é R$ 200,00"), R$ 200 (QUITADA); Σ lançamentos = valor pago; conta quitada/cancelada recusa pagamento; `CHECK` do valor pago; isolamento | CA-05, INV-002 a INV-004 |
| T06 | idem: **2 pagamentos simultâneos de R$ 200 numa conta de R$ 300 → só 1** | CA-06, INV-003 |
| CA-07 | idem: conta vencida ontem aparece como atrasada; quitada, deixa de aparecer | CA-07 |
| T07 | idem: "Aluguel" dia 5 cadastrado em 09/10 → primeira conta em 11/2026; **rotina + 2 conferências em paralelo → 1 conta**; novo valor só nos meses seguintes; dia 31 → 28/02; desativada não gera; reativada recomeça sem meses retroativos | CA-08, INV-005 |
| T08 | idem: MEI de serviços → "DAS do MEI" (Impostos, dia 20) com R$ 86,05; Simples sem DAS; só o dia é editável; ao deixar de ser MEI, para de gerar | CA-09 |
| T09 | idem: parcela vencida quitada pela conferência, com entrada na data do vencimento e sem autor; futuras continuam a receber; segunda conferência não duplica | CA-10 |
| T10 | idem: contas de venda, de despesa fixa e com pagamento não são editadas nem canceladas; conta manual sem pagamento é editada | CA-11, INV-008 |
| T11 | idem: rota `/api/rotinas/diaria` sem segredo ou com o errado → 401 e nada gerado; com o segredo → confere os 2 negócios | CA-12, INV-007 |
| T12 | `test/unit/financeiro.test.ts`: as 10 ações com a permissão do OPEN-006; menu "Financeiro" × "Lançar despesa"; páginas com `ver`/`criar`; rota fora da sessão, com segredo de tamanho mínimo | CA-13, INV-007 |
| T13 | `test/integracao/financeiro.test.ts`: caixa de um mês com 5.000 lançamentos e lista de 2.000 contas em menos de 2 s; rotina com 100 negócios em menos de 30 s | RNF06 |

São 49 testes novos (37 unitários e 12 de integração). Toda a suíte passa: lint, tipos, 307 testes unitários e os de integração.

## Build de produção local com login (T14)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiro no navegador com **65 verificações, todas OK, sem erro no log do servidor**:

- **Caixa:** saldo de R$ 70,00 (venda PIX R$ 50 + parcela 1/3 recebida sozinha R$ 100 − compra de esmaltes R$ 80); as parcelas futuras não entram; a despesa avulsa mostra a descrição e quem registrou.
- **Saldo inicial:** R$ 1.000,00 informado, com confirmação → saldo R$ 1.070,00, e o formulário some.
- **Avulso e estorno:** saída de R$ 35,00 → estornada; o saldo volta, aparece "Estorno de: Café e água", o original fica marcado e não pode ser estornado de novo.
- **Contas:**
  - 2 atrasadas (boleto e aluguel);
  - contas geradas do aluguel, da internet e do DAS;
  - pagamento parcial de R$ 200,00 → "Restam R$ 250,00", conta parcial e ainda atrasada, sem edição;
  - R$ 300,00 recusado;
  - nova conta a receber cadastrada, ainda editável.
- **Despesas fixas:** DAS do MEI automático com R$ 86,05; total mensal de R$ 1.406,05; "Contador" cadastrado → conta de 10/2026 gerada na hora.
- **Rotina:** com o segredo, responde com os 2 negócios e 0 falhas; sem segredo, responde 401. O Painel abre normalmente.
- **Colaboradora só com *Financeiro: criar*:**
  - o menu mostra só "Lançar despesa";
  - `/financeiro` e as contas levam a "Sem acesso";
  - ela lança uma despesa de R$ 12,50 sem ver o saldo.
- **Telas** (caixa, lançar, contas, conta, nova conta e despesas fixas): verificadas em 390, 768 e 1440 px, nos temas claro e escuro, **sem rolagem horizontal**. Capturas selecionadas em [`telas/`](telas/).

## Verificação na homologação (T15) — 11/10/2026

- **Merge do PR #60:** o workflow **Migrações** aplicou `20261009180000_financeiro` sem erro, com a carga fiscal em seguida. O CI ficou verde.
- **Publicação:** a Vercel publicou <https://he-homol.vercel.app>:
  - `/api/saude` responde ok;
  - `/api/rotinas/diaria` sem o segredo responde 401;
  - `/financeiro` sem sessão leva ao login.
- **`CRON_SECRET`:** cadastrado na Vercel; a rotina aparece em *Settings → Cron Jobs*.

**Teste pela equipe, com a própria conta:**
- caixa com as vendas já registradas;
- saldo inicial;
- lançamento avulso e estorno;
- conta a pagar com pagamento parcial e depois total, com o valor acima do restante recusado;
- despesa fixa gerando a conta do mês;
- execução da rotina agendada;
- telas no celular.

**Tudo funcionando.**
