# SPEC-013 — Evidências (11/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/planos.test.ts`: relatórios, histórico completo e equipe maior só no pago; limite do histórico (dia 1º do mês atual − 11; virada de ano); ajuste de datas e competências; volta ao gratuito com o colaborador escolhido, escolha de fora recusada | RF45, RN18, OPEN-001 |
| T02 | idem: rentabilidade do CA-08 (Manicure R$ 114 / 76%, Esmalte R$ 20 / 55,56%), item sem faturamento, totais, ordenações; períodos (atalhos, datas, futuras viram hoje, inválidas e acima de 5 anos recusadas) | CA-08 |
| T03 | idem: CSV com BOM, ponto e vírgula, vírgula decimal, aspas, CRLF e proteção contra fórmula; tabela de vendas com canceladas marcadas e fora do total; PDF válido com várias páginas, caracteres fora da fonte trocados, PDF vazio | CA-09, OPEN-002, OPEN-006 |
| T04 | idem: catálogo, estoque, vendas e financeiro nunca consultam o plano; `Negocio.plano` e o `HistoricoPlano` só escritos em `src/lib/db/planos.ts` | CA-01, INV-001, INV-003 |
| — | idem: permissões dos relatórios (OPEN-003), recusa pelo plano antes da permissão, menu com o selo "Plano pago" no gratuito e "Plano" só para o Dono | CA-12, OPEN-003, OPEN-004 |
| T05 | `test/integracao/planos.test.ts`: upgrade com quem e quando; não-Dono recusado; duas trocas simultâneas → uma ("já está neste plano"); `HistoricoPlano` somente inserção; isolamento | CA-02, CA-03, INV-003 |
| T06 | idem: pago com 3 colaboradores e 1 convite → gratuito mantendo a escolhida: 2 suspensos, convite cancelado, nada apagado; upgrade devolve todos com o mesmo papel e a mesma matriz; o banco recusa suspender o Dono | CA-04, CA-06, INV-005 |
| T07 | idem: suspenso fora da filiação e da troca de negócio, marcado em "Meus negócios"; suspenso não ocupa vaga no limite de convites | CA-05, INV-006 |
| T08 | idem: trocar quem tem acesso respeita o limite (sem suspender o atual → recusado e nada muda); volta ao gratuito × aceite de convite simultâneos (5 rodadas) → nunca mais de 1 colaborador com acesso + pendentes | CA-07, CA-13, INV-004 |
| T09 | idem: rentabilidade com cancelada e outro negócio fora; total = faturamento das vendas concluídas; exportações de vendas (cancelada marcada, totais), fluxo (uma linha por lançamento, descrição com ";" entre aspas) e contas em PDF | CA-08, CA-09, INV-007, INV-008 |
| T10 | idem: exportação no gratuito recusada pelo plano; sem Financeiro — ver recusada pela permissão; relatório inválido recusado | CA-10, CA-12, INV-002 |
| T11 | idem: contas quitadas antigas fora no gratuito (as abertas ficam) e de volta no pago; movimentações do estoque antigas fora no gratuito | CA-11 |
| T12 | idem: rentabilidade de 12 meses com 10 mil vendas e exportação de 10 mil vendas em CSV, cada uma em menos de 3 s | RNF06 |

São 23 testes novos (14 unitários e 9 de integração). Toda a suíte passa: lint, tipos e 547 testes. O teste de isolamento confirmou o RLS ligado na tabela nova.

## Build de produção local com login (T13)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiro no navegador com **37 verificações, todas OK, sem erro no log do servidor**:

- **Gratuito (Studio Gisele):**
  - menu com "Relatórios ★ Plano pago" e "Plano";
  - `/relatorios` mostra a oferta, sem relatórios; a rota de exportação chamada direto volta à oferta, sem arquivo;
  - histórico de vendas pedido desde 2020 ajustado para 01/11/2025, com o aviso; fluxo de caixa limitado, com o aviso.
- **Upgrade:** página do plano com a comparação e o aviso de simulação → confirmação → "Plano pago ativado", plano atual Pago, "por Dona Teste"; `HistoricoPlano` gravou gratuito → pago.
- **Pago:**
  - o selo sai do menu; rentabilidade de 12 meses com tabela e totais; 4 relatórios × CSV e PDF;
  - CSV de vendas com BOM, ponto e vírgula, cabeçalho e `he-vendas-….csv`; CSV de rentabilidade;
  - PDF válido de vendas, fluxo, contas e rentabilidade;
  - histórico de vendas sem limite.
- **Suspenso** (Ateliê Colab, simulado no banco): "Acesso suspenso" em "Meus negócios", sem o botão de entrar e fora do seletor de negócio.
- **Volta ao gratuito pela tela:** confirmação ("Nenhum dado é apagado") → "Plano gratuito ativado", plano atual Gratuito.
- **Telas:** plano (pago) e oferta em 390 e 1440 px, relatórios em 390, 768 e 1440 px, nos temas claro e escuro; "Meus negócios" com suspenso no celular — **sem rolagem horizontal**. No celular, a rentabilidade vira uma lista com todas as colunas. Capturas em [`telas/`](telas/) e um PDF de exemplo em [`exemplo-vendas.pdf`](exemplo-vendas.pdf).

## Pendente

- **T14:** fluxo completo na homologação depois do merge (migração `20261012100000_planos`).
