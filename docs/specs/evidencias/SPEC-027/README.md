# Evidências — SPEC-027 (Compras de fornecedores integradas ao estoque e ao financeiro)

A SPEC-027 é implementada em etapas (seção 14 da Spec). Cada etapa registra aqui o que foi verificado. As etapas 1a (o banco) e 1b (regras e gravação) não mudaram telas; os testes delas estão nos PRs #154 e #155.

## Etapa 1c — tela "Registrar compra" (26/11/2026)

Verificação em build de produção local (`next build` + `next start`), com Postgres e um Supabase Auth falso. Negócio de teste **HE Testing**, com dados fictícios: a fornecedora "Embalagens Exemplo Ltda", a Embalagem P (20 em estoque, custo R$ 1,00) e a Embalagem G (sem estoque, custo R$ 2,00), como no exemplo da seção 1 da Spec.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| CA-13 (parte) | Quem pode registrar: Estoque — criar e Financeiro — criar; o Colaborador padrão e o suporte não | `test/unit/compras.test.ts` | ✅ |
| T02 (parte) | Fluxo da tela: revisar devolve o resumo sem gravar; confirmar grava e diz quais custos mudaram | `test/integracao/compras.test.ts` | ✅ |
| CA-06, CA-14 (parte) | Mensagens da tela: compra ilegível, fornecedor, documento repetido e produto indisponível | idem | ✅ |
| OPEN-003 | Produtos da tela: só os físicos ativos, com o saldo e o custo | idem | ✅ |

**Suíte completa:** 746 testes unitários e 465 de integração, além de lint e tipos.

### Roteiro no navegador

50 verificações, todas aprovadas:
- **atalho:** o botão "Registrar compra" aparece no topo do Estoque para o Dono e abre a tela;
- **preenchimento:** a fornecedora, o nº 1234, a Embalagem P pela busca do nome e a G pelo código exato com Enter. Adicionar a P de novo leva à linha que já existe, sem repetir o produto. O total fica em R$ 220,00, a prazo em 1 parcela com o vencimento trocado para 28 dias;
- **resumo:** "+100 Embalagem P", com "Saldo: 20 → 120", e os três custos: médio R$ 1,17 (marcado), desta compra R$ 1,20 e atual R$ 1,00. A Embalagem G, sem saldo, mostra um só custo. A conta a pagar é de R$ 220,00. Revisar não grava nada e leva o foco ao resumo. Mudar um campo tira o resumo da tela até revisar de novo; voltando ao valor revisado, o resumo volta, sem tirar o foco do campo;
- **confirmação:** "Compra nº 1 registrada.", com "O custo de Embalagem P mudou. Revise o preço na Calculadora." e o link para a Calculadora do item. No banco: o estoque da P foi de 20 para 120 e o da G de 0 para 50, o custo da P passou a R$ 1,17, nasceu uma conta a pagar de R$ 220,00 ligada à compra, e o caixa não mudou;
- **Financeiro:** o filtro de origem "Compra" encontra a conta. O detalhe não tem editar, cancelar nem corrigir, e o "Registrar pagamento" continua lá;
- **documento repetido e sem nota:** o mesmo nº (com espaços) é recusado com a mensagem da seção 5.11. Marcando "Compra sem nota fiscal", à vista, a compra nº 2 é gravada sem o nº, com a conta vencendo na data da compra. "Registrar outra compra" começa do zero;
- **permissão:** um membro com Estoque — criar e sem Financeiro — criar não vê o botão no Estoque, e a tela leva a "Sem acesso";
- **telas** em 1440, 768 e 390 px, claro e escuro, sem rolagem horizontal; axe sem violações na tela vazia e com o resumo.

| Captura | O que mostra |
|---|---|
| [`s27c_01_estoque_1440_claro.png`](s27c_01_estoque_1440_claro.png) | O atalho "Registrar compra" no topo do Estoque |
| [`s27c_02_preenchida_390_claro.png`](s27c_02_preenchida_390_claro.png) | A compra preenchida no celular |
| [`s27c_03_resumo_1440_claro.png`](s27c_03_resumo_1440_claro.png) | O resumo com o saldo novo, os três custos e a conta a pagar |
| [`s27c_03_resumo_1440_escuro.png`](s27c_03_resumo_1440_escuro.png) | O mesmo resumo no tema escuro |
| [`s27c_03_resumo_390_claro.png`](s27c_03_resumo_390_claro.png) | O resumo no celular |
| [`s27c_04_registrada_1440_claro.png`](s27c_04_registrada_1440_claro.png) | "Compra nº 1 registrada." com o aviso do custo |
| [`s27c_04_registrada_390_escuro.png`](s27c_04_registrada_390_escuro.png) | A mesma confirmação no celular, tema escuro |
| [`s27c_05_contas_1440_claro.png`](s27c_05_contas_1440_claro.png) | A conta da compra no filtro de origem "Compra" |
| [`s27c_06_repetido_1440_claro.png`](s27c_06_repetido_1440_claro.png) | O documento repetido recusado |
