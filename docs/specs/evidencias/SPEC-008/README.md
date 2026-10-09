# SPEC-008 — Evidências (09/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/vendas.test.ts`: subtotal em centavos (sem perder precisão), parcelas do RN11, vencimentos (fim de mês, ano bissexto), troco | CA-04, INV-003, INV-004 |
| T02 | idem: validação do carrinho (14 casos de recusa), linhas somadas, 12x, 7 dias, cliente rápido | CA-05 |
| T03 | `test/integracao/vendas.test.ts`: venda à vista — venda nº 1, item com preço e custo, baixa `SAIDA_VENDA`, lançamento de entrada | CA-01, INV-005, INV-006 |
| T04 | idem: serviço com materiais — baixas por material, custo unitário com materiais, custo posterior não altera a venda | CA-02, INV-007 |
| T05 | idem: estoque insuficiente (produto e material); **6 vendas simultâneas** disputando o estoque → só as que cabem; números sem buracos | CA-03, INV-006 |
| T06 | idem: misto + crédito 3x → 66,68 + 66,66 + 66,66, contas a receber "Venda nº 1 — parcela k/3" | CA-04, INV-004, INV-005 |
| T07 | idem: soma divergente; preço adulterado/alterado | CA-05, CA-06, INV-002 |
| T08 | idem: sem preço, arquivado, de outro negócio | CA-07 |
| T09 | idem: **o mesmo carrinho 3 vezes (2 em paralelo) → 1 venda** | CA-08, INV-009 |
| T10 | idem: falha no fim da transação (última conta a receber) desfaz tudo, inclusive o número | CA-09, INV-001 |
| T11 | idem: cliente cadastrado na hora, sem cliente, cliente de outro negócio | CA-10 |
| T12 | idem: data retroativa (7 dias), histórico por período, detalhe, isolamento | CA-11 |
| T13 | `test/unit/vendas.test.ts`: ações com Vendas — criar; Colaborador; menu | CA-12, INV-008 |
| T14 | `test/integracao/vendas.test.ts`: venda com 20 linhas e histórico com 1.000 vendas em menos de 2 s | RNF06 |

## Build de produção local com login (T15)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiro no navegador, **24 verificações, todas OK, sem erro no log do servidor**:

- venda à vista pela frente de caixa (2 lixas em PIX) → "Venda nº 1 registrada", baixa 50 → 48;
- serviço com materiais, cliente da lista, R$ 10,00 em dinheiro + crédito em 3x → troco calculado na tela, "Crédito em 3x", parcelas "A receber", materiais baixados;
- carrinho acima do estoque → aviso com o material e "Finalizar" desabilitado;
- histórico de hoje: 2 vendas, R$ 45,00; Painel ok;
- frente de caixa e histórico em 390, 768 e 1440 px, claro e escuro, **sem rolagem horizontal** — capturas em [`telas/`](telas/).

## Pendente

- **T16:** fluxo completo na homologação, depois do merge (migração `20261009150000_vendas`).
