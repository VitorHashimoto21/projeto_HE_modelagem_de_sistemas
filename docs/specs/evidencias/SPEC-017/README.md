# Evidências — SPEC-017 (ajustes na venda)

Verificação em build de desenvolvimento local (Postgres e Supabase Auth falso, contas de teste), em 16/10/2026, com o caso do eletricista: **Lâmpada LED** (custo R$ 10,00, 20 em estoque) e o serviço **Troca de lâmpadas** (custo próprio R$ 30,00, 2 lâmpadas por execução, preço R$ 80,00).

## Roteiro no navegador (Dono em 1440 px claro e 390 px escuro; Colaborador em 1440 px)

| Passo | Resultado | Captura |
|---|---|---|
| Dono adiciona o serviço: aparecem "Editar materiais" e "Editar preço" | ✅ | `carrinho_ajustado_*` |
| "Editar materiais" → 6 lâmpadas (padrão 2; aviso de estoque quando passa do saldo) | ✅ | `gaveta_materiais_1440_claro.png`, `gaveta_materiais_390_escuro.png` |
| A linha mostra "Materiais ajustados: 6 Lâmpada LED" | ✅ | `carrinho_ajustado_*` |
| "Editar preço" sem motivo → "Informe o motivo do ajuste de preço" (OPEN-006) | ✅ | — |
| Preço R$ 70,00 → "Abaixo do custo (R$ 90,00)", com o custo das 6 lâmpadas, sem bloquear (OPEN-007) | ✅ | `gaveta_preco_abaixo_*` |
| Preço R$ 150,00 com motivo → linha com o preço do catálogo riscado, total e pagamento automático em R$ 150,00 | ✅ | `carrinho_ajustado_*` |
| Finalizar → detalhe com "Preço ajustado (catálogo: R$ 80,00). Motivo: …", "Materiais ajustados" e a baixa de 6 lâmpadas (20 → 14) | ✅ | `detalhe_1440_claro.png` |
| Histórico com o selo "Preço ajustado" | ✅ | `historico_1440_claro.png` |
| Colaborador (predefinição, sem *Vendas: editar*): vê "Editar materiais", não vê "Editar preço" (OPEN-005) | ✅ | `colaborador_1440.png` |
| Sem rolagem horizontal em 1440 e 390 px | ✅ | — |

## Testes automatizados

- `test/unit/ajustes-venda.test.ts` (T01, T02): materiais padrão, custo da linha, validação do carrinho com ajustes, linhas não somadas, troca recusada.
- `test/integracao/ajustes-venda.test.ts` (T03–T08): baixa e custo pelo ajuste com o catálogo intacto, venda sem ajuste igual à SPEC-008, material fora do serviço, estoque insuficiente, preço com e sem permissão e com o oficial mudando, restrição do banco, cancelamento devolvendo as 6 lâmpadas e rentabilidade com preço e custo ajustados.

## Homologação (T10) — 17/10/2026

Fluxo do eletricista na he-homol (DEVELOP, depois do merge da PR #82), com o Dono em 1440 px claro: **Lâmpada LED** (15 em estoque) e o serviço **Troca de Lâmpadas** (2 lâmpadas por execução, preço R$ 50,00). Capturas em [`homologacao/`](homologacao/).

| Passo | Resultado | Captura |
|---|---|---|
| Serviço no carrinho: aparecem "Editar materiais" e "Editar preço"; sem ajuste, a linha fica no preço do catálogo | ✅ | `homol_01_carrinho_servico_1440_claro.png` |
| "Editar materiais" abre com o padrão do catálogo (2) e o saldo (15 em estoque) | ✅ | `homol_02_gaveta_materiais_padrao_1440_claro.png` |
| Quantidade ajustada para 6 | ✅ | `homol_03_gaveta_materiais_6_1440_claro.png` |
| A linha mostra "Materiais ajustados: 6 Lâmpada LED"; "Editar preço" abre com o preço do catálogo e o motivo vazio | ✅ | `homol_04_carrinho_materiais_ajustados_1440_claro.png` |
| Preço R$ 59,99 com o motivo "4 Lâmpadas a mais": linha com o preço do catálogo riscado, "Preço ajustado: …" e "Voltar ao preço do catálogo" | ✅ | `homol_05_gaveta_preco_com_motivo_1440_claro.png` |
| Venda nº 15 registrada: "Preço ajustado (catálogo: R$ 50,00). Motivo: 4 Lâmpadas a mais.", "Materiais ajustados nesta venda" e a baixa de 6 lâmpadas (15 → 9) | ✅ | `homol_06_detalhe_venda_15_1440_claro.png` |
| Histórico com o selo "Preço ajustado" | ✅ | `homol_07_historico_selo_1440_claro.png` |

A migração `20261016180000_ajustes_venda` foi aplicada pelo workflow de migrações; as vendas anteriores continuam iguais no histórico.
