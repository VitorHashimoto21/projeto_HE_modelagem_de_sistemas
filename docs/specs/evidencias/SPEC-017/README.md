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

## Pendente

- **T10** — fluxo do eletricista na homologação, depois do merge.
