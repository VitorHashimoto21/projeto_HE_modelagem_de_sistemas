# SPEC-010 — Evidências (11/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/calculadora.test.ts`: 23 ÷ (1 − 0,58) = R$ 54,77 e R$ 55,00 arredondado; **2.000 combinações aleatórias** com preço × (1 − soma) ≥ custo; soma = 100% inviável e 99,99% viável; maior parcela | CA-01, CA-08, INV-001, INV-002 |
| T02 | idem: janela de 12 competências, RBT12 real, proporcional desde a 1ª venda (mês parado conta zero), venda antiga fora da janela, estimado, sem dados; despesas fixas % | CA-02, CA-03 |
| T03 | idem: Fator R ≥ 28% (inclusive exatamente 28%) → III, abaixo → V, sem receita → V, não sujeito → cadastro; PE R$ 5.000, meta R$ 7.500, denominador ≤ 0 | CA-05, CA-10 |
| T04 | idem: validação de margem, comissão, confirmação e parâmetros (faturamento sugerido = capacidade × ticket) | CA-11 |
| T05 | `test/integracao/calculadora.test.ts`: venda às 23:30 do último dia entra no mês anterior e a de 00:30 do dia 1º fica fora; canceladas e de outro negócio fora; CMV pelo custo gravado; folha com estorno | CA-02, INV-005 |
| T06 | idem, com os parâmetros fiscais oficiais carregados: MEI (DAS R$ 86,05, alerta de limite), Simples Anexo III com RBT12 R$ 300.000 → 8,08% (2ª faixa, fonte e vigência), Fator R 30% → III e 20% → V, Autônomo 11%, acima de R$ 4,8 milhões bloqueado | CA-04 a CA-07, INV-006 |
| T07 | idem: cálculo completo do CA-01, memória gravada no histórico, confirmação exata e arredondada (com o exato guardado), mesmo preço registrado, **custo alterado entre simular e confirmar → nada gravado**, inviável recusado; item sem custo, arquivado e de outro negócio | CA-01, CA-08, CA-09, INV-003, INV-004 |
| T08 | idem: aviso "O Anexo efetivo mudou de III para V (Fator R = 15,00%)" em relação ao último preço confirmado | CA-05 |
| T09 | idem: parâmetros salvos e usados; isolamento entre negócios | CA-11, INV-007 |
| T10 | `test/unit/calculadora.test.ts`: ações com Calculadora — criar/editar; páginas com ver; atalho do Catálogo; menu | CA-12, INV-007 |
| T11 | `test/integracao/calculadora.test.ts`: cálculo com 10.000 vendas e 30.000 itens vendidos em menos de 2 s | RNF06 |

São 28 testes novos (16 unitários e 12 de integração). Toda a suíte passa: lint, tipos e 476 testes.

## Build de produção local com login (T12)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiro no navegador com **37 verificações, todas OK, sem erro no log do servidor**:

- **MEI (Studio Gisele):**
  - regime exibido;
  - RBT12 proporcional de 4 meses (faturamento médio de R$ 4.575,00);
  - despesas fixas de R$ 1.406,05 com o DAS;
  - ponto de equilíbrio e meta.
- **Manicure:**
  - custo de R$ 22,00 (esmalte 0,25 × R$ 8,00);
  - margem de 32% com a fonte legal;
  - despesas variáveis de 13,50%;
  - imposto 0;
  - aviso da margem;
  - preço sugerido de **R$ 92,57** (igual à conta feita à mão);
  - confirmado **arredondado para R$ 93,00**, com o preço oficial e o histórico (origem Calculadora) no Catálogo e o atalho "Calcular preço".
- **Bloqueios:**
  - margem de 80% → "os percentuais somam 124,23%", sem botão de confirmar;
  - comissão simulada → aviso, sem confirmar.
- **Parâmetros:** CMV% de 96 recusado no navegador; taxa de 4% salva e aplicada no cálculo.
- **Simples com Fator R (Clínica Bem Estar):** Anexo III, imposto de 8,08% ("Anexo III, 2ª faixa; Fator R 30,00%", com a fonte legal), RBT12 real de 12 meses, preço confirmado.
- **Colaboradora só com *Calculadora: ver*:** vê o menu, o bloqueio explicado e os parâmetros só para leitura.
- **Telas:** calculadora e parâmetros em 390, 768 e 1440 px, nos temas claro e escuro, **sem rolagem horizontal**. Capturas em [`telas/`](telas/).

## Pendente

- **T13:** fluxo completo na homologação depois do merge (migração `20261011120000_calculadora`).
