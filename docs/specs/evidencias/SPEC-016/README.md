# SPEC-016 — Evidências (15/10/2026)

Redesign completo na Direção "Balcão": as 40 telas migradas em 6 etapas, num único PR (OPEN-006). Cada etapa é um commit, com a suíte verde.

| Etapa | Commit | Entrega |
|---|---|---|
| 1 — Fundação | `75950ad` | Tokens v2, Manrope, componentes de interface, estrutura do app (menu, trilho, barra inferior), faixa do caixa, avisos flutuantes |
| 2 — Gráficos + Painel | `b13f526` | Componentes de gráfico e o Painel completo |
| 3 — Vendas | `b364bc8` | Nova venda (lista da A no estilo B), histórico, detalhe, cancelar, trocar; momento-assinatura |
| 4 — Estoque, Catálogo e Calculadora | `f6c1bee` | 8 telas; entrada/saída de estoque em gaveta com URL própria |
| 5 — Financeiro e Relatórios | `d742087` | 8 telas; "Fluxo do mês", projeção no Financeiro, lançamento e nova conta em gaveta |
| 6 — Configurações, conta e área pública | `81784dc` | 18 telas; convite em gaveta; teste de varredura (T02) |
| Verificação final | `51ec61c`, `d08f8ef` | Achados do axe corrigidos; JavaScript por tela dentro do limite |

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/tokens.test.ts`: as cores de `globals.css` são idênticas às de `docs/design/identidade/tokens/tokens.css` | INV-003, INV-004 |
| T02 | `test/unit/design-system.test.ts`: varre `src/app` e `src/components` (fora de `ui/`) — nenhum hex, `rgb()` ou `rgba()` (só o `themeColor`, que é a cor da estrutura), nenhum cartão antigo com borda e sombra, nenhum rótulo em maiúsculas espaçadas nem a fonte antiga. Conferido que o teste falha quando um arquivo viola a regra | CA-01, INV-003 |
| T03 | `test/unit/graficos.test.ts`: escala amigável, proporções, posições do medidor, participações (somam 100), saudação | CA-05 |
| T04 | `test/unit/dashboard.test.ts`: cartões por permissão e plano (formas e rentabilidade novos); `test/unit/fronteira-cliente.test.ts` para os arquivos de cliente novos | CA-04, INV-002 |
| T05 | `test/integracao/financeiro.test.ts` (fluxo diário: todos os dias do mês, somas iguais aos totais do caixa, só o negócio) e `test/integracao/dashboard.test.ts` (formas do mês, ano anterior, saldo diário igual ao "Saldo atual", movimentos de hoje só do negócio) | CA-05, CA-06 |
| — | `test/unit/relatorios-formas.test.ts`: "Como os clientes pagam" nos Relatórios — só concluídas, sem crédito de troca, ordem fixa das cores | 5.5 |
| T06 | Suíte completa sem mudança de asserção de regra | CA-02, INV-001 |

**Suíte:** lint e tipos limpos; **396 testes unitários** e **194 de integração**, todos passando.

## Build de produção com login (T07, T08)

`next build` + `next start`, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth. Roteiros no navegador (Edge, Puppeteer):

**Regressão dos fluxos das SPECs 002–014 nas telas novas — 42 verificações, todas OK.** O roteiro cria os próprios dados e compara antes e depois, sem depender do estado da base:

- **Acesso:** sem sessão leva ao login; senha errada mostra o erro; login e escolha do negócio.
- **Catálogo:** cadastrar produto com preço, definir o preço oficial, buscar.
- **Estoque:** entrada pela página e saída pela gaveta (saldo 5 → 4).
- **Vendas:** crédito em 2x baixa o estoque; cancelamento devolve; venda no PIX com valor automático; troca (cancela e vende numa vez).
- **Financeiro:** lançamento e estorno; conta com pagamento parcial e quitação; despesa fixa criada e desativada.
- **Calculadora:** preço sugerido confirmado chega ao catálogo.
- **Plano, relatórios e conta:** oferta do plano pago no gratuito; exportação dos dados (.zip).
- **Colaborador sem Financeiro (Ateliê Colab):** nenhuma faixa nem saldo no HTML; Financeiro, Equipe e Plano levam a "Sem acesso" (**CA-04, INV-002**).
- **Movimento reduzido:** gaveta sem animação (**CA-07, INV-007**). **Teclado:** foco visível em 8 de 8 paradas.
- **Nenhuma resposta 5xx e nenhum erro de JavaScript** em todo o percurso.

**Roteiros das etapas — 99 verificações, todas OK:** Nova venda (19: lista, quantidades, pagamento automático e dividido, troco, venda registrada, momento-assinatura na faixa — **CA-09**), estoque (10: gaveta com URL própria, Esc, link direto em página), financeiro (15: gráficos com balão pelo teclado, gavetas de lançamento e nova conta), etapa 6 (50: telas públicas, tema mantido, gaveta do convite) e o "Mais" do celular (5: carrega ao abrir, Esc devolve o foco).

**Telas (INV-005, CA-03):** 28 telas da área autenticada em **1440, 768 e 390 px**, nos temas **claro e escuro** (168 capturas), e as 7 públicas nas três larguras — **nenhuma com rolagem horizontal**. O tema escuro das públicas foi conferido na varredura de acessibilidade e no roteiro da etapa 6. Seleção em [`telas/`](telas/).

## Acessibilidade (CA-08, INV-006)

Varredura **axe-core 4.10.2** (WCAG 2.1 A/AA) em todas as telas, nos dois temas, e com a gaveta aberta: **73 varreduras, nenhuma violação grave ou crítica.** A primeira rodada achou dois problemas, corrigidos em `51ec61c`: um rótulo com contraste 3,76:1 no detalhe do estoque e um `<p>` dentro de `<dl>` na Calculadora (este, anterior ao redesign). Contraste dos tokens: **48 pares, todos OK** (`validar_contraste.py`).

## Desempenho (seção 10)

JavaScript comprimido baixado por tela, cache desligado, DEVELOP (`339c4c1`) × redesign:

| Tela | DEVELOP | Redesign | Diferença |
|---|---|---|---|
| /entrar | 245,8 KB | 247,8 KB | +1,9 KB |
| /painel | 143,7 KB | 160,7 KB | +17,0 KB |
| /vendas | 143,7 KB | 159,7 KB | +16,1 KB |
| /vendas/nova | 160,8 KB | 167,3 KB | +6,5 KB |
| /estoque, /catalogo, /financeiro/contas | 143,7 KB | 157,7 KB | +14,0 KB |
| /calculadora | 248,4 KB | 253,4 KB | +5,0 KB |
| /financeiro | 251,1 KB | 257,9 KB | +6,9 KB |
| /conta | 155,3 KB | 160,5 KB | +5,2 KB |

**Maior aumento: +17 KB (limite: 30 KB).** A primeira medição deu +39,3 KB; em `d08f8ef`, a gaveta do "Mais" e a biblioteca de avisos passaram a ser baixadas só quando usadas, e as versões em gaveta dos formulários foram para arquivos próprios.

## Verificação na homologação (T10)

Feita em 15/10/2026 em https://he-homol.vercel.app, com o negócio de teste "HE Testing" (estúdio de beleza: produtos, serviços com materiais, 14 vendas com as quatro formas de pagamento, cancelamento, despesas fixas e meta do mês). As fotos estão em [`homologacao/`](homologacao/).

| Foto | Tela | Comprova |
|---|---|---|
| [01](homologacao/homol_01_financeiro_gaveta_390_claro.png) | Novo lançamento em gaveta, 390 px | Gaveta com a própria URL (OPEN-003), fundo sólido |
| [02](homologacao/homol_02_financeiro_gaveta_1440_claro.png) | Novo lançamento em gaveta, 1440 px | Gaveta lateral sobre o Financeiro, faixa compacta (OPEN-005) |
| [03](homologacao/homol_03_painel_390_claro.png) | Painel, 390 px | Barra inferior com "Vender" (CA-03), faixa do caixa (CA-04) |
| [04](homologacao/homol_04_painel_768_claro.png) | Painel, 768 px | Trilho só com ícones (CA-03) |
| [05](homologacao/homol_05_painel_1440_claro.png) | Painel, 1440 px | Menu lateral, medidor da meta, gráficos e saldo igual ao do Financeiro (CA-03, CA-04, CA-05) |
| [06](homologacao/homol_06_painel_1440_escuro.png) | Painel, 1440 px, escuro | Tema escuro (CA-11) |
| [07](homologacao/homol_07_painel_390_plano_gratuito.png) | Painel, plano gratuito | "O que mais deixa lucro" mostra só a oferta, sem valores (CA-06) |
| [08](homologacao/homol_08_painel_colaborador_390.png) | Painel do Colaborador, 390 px | Sem faixa do caixa nem saldo; "Estoque" no lugar de "Caixa" (CA-04) |
| [09](homologacao/homol_09_painel_1440_ver_os_valores.png) | Painel com "Ver os valores" aberto | Tabela de valores do gráfico (CA-05) |
| [10](homologacao/homol_10_painel_390_escuro.png) | Painel, 390 px, escuro | Tema escuro no celular (CA-11) |
| [11](homologacao/homol_11_painel_390_plano_pago.png) | Painel, plano pago | Rentabilidade com valores e destaque dos 3 primeiros (CA-06) |
| [12](homologacao/homol_12_relatorios_1440.png) | Relatórios, 1440 px | Rentabilidade, formas de pagamento, tabela e exportação |
| [13](homologacao/homol_13_venda_registrada_1440.png) | Venda nº 14 registrada | Confirmação com o verbo do botão e o saldo da faixa atualizado (CA-09, CA-10) |

**Problemas encontrados e corrigidos** (o fluxo da homologação seguiu; as correções vêm em PRs próprios):

| Problema | Correção |
|---|---|
| Painel do Colaborador em 1440 px com os cartões presos à direita (a coluna principal vazia ocupava espaço); no celular, um espaço extra no topo | PR #74 |
| Projeção de caixa: o rótulo "menor saldo" ficava por cima do nome de fevereiro e da linha | PR #75 |
| Extrato: as duas linhas de um pagamento misto apareciam iguais ("Venda nº 5") | PR #75: a forma vai na descrição ("Venda nº 5 — PIX"); vale para as vendas novas, porque os lançamentos são imutáveis |
| Gráfico de vendas sem vendas repetia "R$ 0" no eixo | PR #75: escala mínima de R$ 3 |

**Não eram problemas:** nas capturas de página inteira (Chrome, "Capture full size screenshot") a barra inferior aparece no meio da página e a gaveta aparece semitransparente quando a foto é tirada durante a animação de abertura; na tela, ambas estão corretas (fotos 01–03). A diferença de saldo entre duas fotos antigas (R$ 90) era uma venda registrada entre elas; nas fotos finais, Painel e Financeiro mostram o mesmo saldo (R$ 1.812,21).

## N8 — Menu lateral recolhível e dica (19/10/2026)

Build de produção local (dados de exemplo), Chromium, roteiro automatizado com 34 verificações — todas aprovadas. Capturas em [`n8/`](n8/).

| Verificação | Resultado | Captura |
|---|---|---|
| 1440 px, sem escolha guardada: menu **expandido** (256 px), botão "Recolher menu" (`aria-expanded=true`) ao lado do logo | ✅ | `n8_expandido_1440_claro.png` |
| Recolher: 80 px, "Expandir menu" (`aria-expanded=false`), foco continua no botão, escolha guardada (`he-menu=recolhido`), conteúdo se alarga (1184 → 1280 px), rótulos só para leitor de tela | ✅ | `n8_recolhido_1440_escuro.png` |
| Recarregar: o menu já está com 80 px no `DOMContentLoaded` (sem piscar); navegar mantém recolhido | ✅ | — |
| Mouse em "Estoque": dica "Estoque"; some ao sair | ✅ | `n8_recolhido_dica_1440_claro.png` |
| Teclado numa página nova (dica ainda não baixada): Tab no menu → dica com o nome do item focado, foco preservado ao carregar a dica; Esc fecha | ✅ | — |
| 1024 px recolhido e expandido, claro e escuro; expandido sem dica | ✅ | `n8_recolhido_1024_claro.png`, `n8_expandido_1024_escuro.png` |
| 768 px: trilho sem botão (N8.3), dica no mouse | ✅ | `n8_trilho_dica_768_escuro.png` |
| 390 px: sem menu lateral, cabeçalho do celular (nada muda) | ✅ | `n8_celular_390_claro.png` |
| "Reduzir movimento": largura final logo após o clique; sem a preferência, transição suave | ✅ | — |
| Modo suporte (SPEC-018): recolhe igual e a faixa do modo suporte continua | ✅ | `n8_modo_suporte_recolhido_1440_claro.png` |
| axe-core 4.10.2 (WCAG 2.1 A/AA), recolhido 1440 claro e expandido 1024 escuro | ✅ sem violação grave ou crítica | — |
| Sem rolagem horizontal em todas as capturas | ✅ | — |

**Desempenho (seção 10):** JavaScript comprimido baixado ao abrir cada tela, cache desligado.

| Tela | Antes da N8 | Com a N8 (1440 e 800 px) |
|---|---|---|
| /painel | 160,8 KB | 162,5 KB (+1,7) |
| /vendas | 160,0 KB | 161,6 KB (+1,6) |
| /estoque | 158,0 KB | 159,6 KB (+1,6) |

A dica (Radix Tooltip, cerca de 22 KB) só é baixada quando o menu mostra só ícones e a pessoa chega nele; importada direto, somaria +23,8 KB a cada tela.

Pendente: **N8-T6** — recolher na homologação, recarregar e conferir as dicas (depois do merge).

