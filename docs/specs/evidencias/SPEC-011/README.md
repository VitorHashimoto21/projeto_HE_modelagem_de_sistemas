# SPEC-011 — Evidências (11/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/cancelamento.test.ts`: crédito de troca, reembolso e restante em 6 combinações (sem troca, troca menor, igual, maior que o recebido, crédito sem nada recebido); crédito ≤ recebido e crédito + reembolso = recebido | INV-004 |
| T02 | idem: motivo da lista + detalhe ("Outro" exige detalhe, até 200), forma do reembolso; carrinho da troca com data de hoje e pagamentos vazios; "Crédito de troca" nunca vem do navegador | — |
| T03 | `test/integracao/cancelamento.test.ts`: venda PIX R$ 36 cancelada — status, quem, quando, motivo; `ENTRADA_ESTORNO` 8 → 10; reembolso "Reembolso da venda nº 1 — PIX" (Estorno, `estorno = true`); caixa volta a 0; sem forma de reembolso → recusado e **nada muda** (falha no último passo da transação); cancelar de novo recusado; banco recusa alterar a cancelada; isolamento | CA-01, INV-001, INV-005 |
| T04 | idem: serviço com materiais — volta exatamente o baixado, com a receita alterada depois e o material arquivado | CA-02, INV-002 |
| T05 | idem: crédito 3x com a 1ª recebida pela rotina → 2 contas canceladas, reembolso R$ 100 ("Estorno no cartão"), rotina não recebe mais; crédito sem nada recebido → sem reembolso | CA-03, INV-003 |
| T06 | idem: R$ 100 trocado por R$ 70 → venda nº 2 ligada, crédito R$ 70 sem lançamento, reembolso R$ 30, caixa R$ 70; crédito limitado ao recebido (R$ 100 + R$ 150 no PIX, restante errado recusado); troca maior recusada | CA-04 a CA-06 |
| T07 | idem: troca com item sem estoque → nada muda (status, estornos, lançamentos e numeração); troca do mesmo item usa o estoque devolvido | CA-07, INV-001 |
| T08 | idem: **dois cancelamentos simultâneos → um**; **a mesma troca três vezes em paralelo → uma venda** | CA-08, INV-006 |
| T09 | idem: canceladas fora do total do histórico, do RBT12 e do custo vendido | CA-09, INV-007 |
| T10 | idem: cancelar a venda de troca devolve também o crédito de troca (OPEN-006) | INV-004 |
| T11 | `test/unit/cancelamento.test.ts`: cancelar com Vendas — excluir; trocar com excluir + criar; páginas e botão; Colaborador predefinido sem cancelar | CA-10, INV-008 |
| T12 | `test/integracao/cancelamento.test.ts`: venda de 20 linhas com materiais cancelada em menos de 2 s | RNF06 |

São 23 testes novos (11 unitários e 12 de integração). Toda a suíte passa: lint, tipos e 500 testes. Os testes de vendas e da calculadora seguem verdes depois da refatoração do registro da venda.

## Build de produção local com login (T13)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiro no navegador com **35 verificações, todas OK, sem erro no log do servidor**:

- **Cancelar uma venda à vista** (2 esmaltes no PIX):
  - a prévia mostra "Esmalte vermelho: +2 unidade", nenhuma parcela e R$ 36,00 a devolver;
  - sem motivo, o cancelamento é recusado;
  - com "Devolução: Cor errada" e PIX: aviso de cancelada, selo, bloco com quem, motivo e "− R$ 36,00 · PIX";
  - "+2 (estorno)" nas movimentações, estoque de volta a 10 e reembolso no caixa como estorno de Vendas.
- **Trocar uma venda no crédito 3x** (1ª parcela recebida pela conferência):
  - a prévia mostra 2 parcelas abertas (R$ 200) e R$ 100 recebidos;
  - na frente de caixa em modo troca, uma manicure de R$ 50 dá crédito de R$ 50, nada a pagar e R$ 50 a devolver; sem a forma de devolução, o botão fica desabilitado;
  - confirmada: a troca é ligada à venda original, paga com crédito de troca (sem entrar de novo no caixa), e a original fica com motivo "Troca", o link para a troca, o reembolso no cartão e as parcelas canceladas.
- **Histórico:** as vendas canceladas aparecem marcadas.
- **Telas:** cancelar, detalhe da cancelada, detalhe da troca e troca no celular, em 390, 768 e 1440 px, nos temas claro e escuro, **sem rolagem horizontal**. Capturas em [`telas/`](telas/).

## Verificação na homologação (T14) — 11/10/2026

- **Merge do PR #64:** o workflow **Migrações** aplicou `20261011150000_cancelamento` sem erro ("All migrations have been successfully applied"). O CI ficou verde.
- **Publicação:** a Vercel publicou <https://he-homol.vercel.app> com o commit do merge; a página de login responde.

**Teste pela equipe, com a própria conta:** cancelamento de venda à vista (prévia, motivo obrigatório, estoque de volta, reembolso no caixa) e troca (crédito de troca, diferença devolvida, vendas ligadas).

**Tudo funcionando.**
