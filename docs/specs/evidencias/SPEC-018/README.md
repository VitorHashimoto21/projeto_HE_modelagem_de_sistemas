# Evidências — SPEC-018 (Administrador da plataforma e acesso de suporte)

Verificação em build de produção local (`next build` + `next start`), com Postgres e Supabase Auth falso (o JWT traz o `amr` com o momento da entrada, como o Supabase), em 17/10/2026. Contas de teste: **Rafael Leader** (Dono do negócio "HE Testing"), **Joana Colaboradora** e **Vitor Suporte** (conta exclusiva, com o papel concedido pelo script `npm run admin:conceder`). A última venda do negócio recebeu a cliente fictícia "Maria Silva" para conferir a máscara.

Roteiro automatizado no navegador: **47 verificações, todas aprovadas**. As capturas mostram 1440 px no tema claro e 390 px no tema escuro.

## Roteiro no navegador (T12)

| Passo | Resultado | Captura |
|---|---|---|
| Dono com a versão anterior dos termos entra → "Atualizamos nossos termos", com o resumo do que mudou | ✅ | `aceite_1440_claro.png`, `aceite_390_escuro.png` |
| Até aceitar: módulos levam de volta ao aceite; Minha conta abre, com o aviso; sem marcar a caixa, não aceita | ✅ | — |
| Aceite → volta ao app | ✅ | — |
| *Configurações → Acesso do suporte* (item novo no menu do Dono), vazio | ✅ | `suporte_vazio_1440_claro.png` |
| Liberar sem motivo e sem módulo → "Conte ao suporte o que precisa ser visto." e "Marque ao menos um módulo." | ✅ | `gaveta_erros_1440_claro.png` |
| Liberar Vendas e Estoque por 24 h → liberação ativa com o registro; faixa para a equipe, com "Ver acessos do suporte" para o Dono | ✅ | `gaveta_liberar_1440_claro.png`, `suporte_liberado_*` |
| Colaboradora vê a faixa sem o atalho; não abre a tela do Dono nem `/admin` (Sem acesso) | ✅ | `faixa_colaboradora_1440_claro.png` |
| Conta de Administrador entra → painel do administrador, só com metadados (nada de clientes nem valores) | ✅ | `admin_painel_1440_claro.png`, `admin_painel_390_escuro.png` |
| Sem modo suporte: "Meus negócios" e os módulos levam ao painel | ✅ | — |
| Ficha do negócio com a liberação (motivo e módulos) e "Entrar em modo suporte" | ✅ | `admin_ficha_1440_claro.png` |
| Modo suporte: entra pelo primeiro módulo liberado; faixa âmbar "Modo suporte · HE Testing · somente leitura · até …"; menu só com Estoque, Vendas e Relatórios | ✅ | `modo_suporte_vendas_1440_claro.png`, `modo_suporte_vendas_390_escuro.png` |
| Cliente mascarada no histórico e no detalhe ("M\*\*\* S\*\*\*"); detalhe sem "Cancelar venda" nem "Trocar" | ✅ | `modo_suporte_detalhe_1440_claro.png` |
| Financeiro (não liberado), Nova venda e Equipe → Sem acesso; Estoque (liberado) abre | ✅ | — |
| "Sair do modo suporte" → volta à ficha do negócio | ✅ | — |
| Registro para o Dono: liberação, entrada, cada tela vista ("Vendas — histórico (últimos 7 dias)", "Vendas — venda nº 5", "Estoque") e saída; telas recusadas não aparecem | ✅ | `registro_1440_claro.png` |
| Dono revoga (diálogo de confirmação) com o Administrador dentro → a próxima tela leva o Administrador ao painel com "O Dono revogou o acesso do suporte."; entrada desabilitada | ✅ | `revogar_dialogo_1440_claro.png` |
| Sem rolagem horizontal em todas as telas capturadas | ✅ | — |

## Homologação (T13) — 18/10/2026

Feita pela equipe em <https://he-homol.vercel.app> (DEVELOP, depois dos PRs #85 e #87), com a conta exclusiva do suporte (papel concedido pelo workflow **Administradores**, ambiente `homologacao`) e o Dono do negócio **HE Testing**, em dois navegadores. Capturas em [`homologacao/`](homologacao/); nelas, os e-mails pessoais foram ocultados.

| Passo | Resultado | Captura |
|---|---|---|
| Dono que aceitou a versão anterior entra e vê "Atualizamos nossos termos", com o resumo do que mudou, a caixa de aceite e os atalhos "Exportar meus dados ou excluir a conta" e "Sair"; depois do aceite, volta ao app (CA-10) | ✅ | `homol_01_aceite_1440_claro.png`, `homol_02_aceite_1440_escuro.png`, `homol_03_meus_negocios_apos_aceite_1440_claro.png` |
| Dono libera o acesso: motivo "as vendas de ontem não aparecem no caixa", **Estoque e Vendas**, 24 horas (CA-03) | ✅ | `homol_04_liberar_acesso_1440_claro.png` |
| Liberação ativa até 19/10, 17:50, com o registro "Rafael Leader liberou o acesso" e a faixa do Dono com "Ver acessos do suporte" (CA-03) | ✅ | `homol_05_acesso_liberado_1440_claro.png` |
| Painel do administrador: 4 negócios só com os dados de cadastro (nome, regime, plano, criação, membros, Dono) e a situação do acesso (CA-01) | ✅ | `homol_06_admin_painel_1365_claro.png`, `homol_07_admin_painel_1365_escuro.png` |
| Ficha do HE Testing: cadastro sem vendas, valores, clientes ou estoque; liberação com motivo, módulos e "Entrar em modo suporte". É também a tela a que o suporte volta ao sair do modo suporte (CA-01, CA-03) | ✅ | `homol_08_admin_ficha_1365_escuro.png` |
| Negócio sem liberação (RafaEletroServices): "O Dono ainda não liberou o acesso" e o botão de entrada desabilitado (CA-02) | ✅ | `homol_09_admin_sem_liberacao_1365_escuro.png` |
| Primeira rodada: o item **"Relatórios"** apareceu no menu do suporte com só Vendas e Estoque liberados (regra da SPEC-013). Decisão da equipe: Relatórios fora do modo suporte — corrigido no PR #87 (seção 9 da Spec) | ❌ → ✅ | — |
| Modo suporte (depois do PR #87), Vendas de ontem: faixa âmbar "Modo suporte · HE Testing · somente leitura", menu só com **Estoque e Vendas**, sem "Nova venda", clientes como "V*** F***" (CA-04, CA-05) | ✅ | `homol_10_modo_suporte_vendas_1365_escuro.png` |
| Venda nº 19: "cliente V*** F***", sem "Cancelar venda" nem outras ações de escrita (CA-04, CA-05) | ✅ | `homol_11_modo_suporte_venda_19_1365_escuro.png` |
| Registro para o Dono: "liberou o acesso", "entrou em modo suporte", cada tela vista ("Vendas — histórico (ontem)", "Vendas — venda nº 19"…) e "saiu do modo suporte", com data, hora e nome; as liberações anteriores aparecem como revogadas (CA-06) | ✅ | `homol_12_registro_1440_escuro.png` |
| Dono revoga com o suporte dentro: a próxima tela leva o suporte ao painel com "O Dono revogou o acesso do suporte." e o negócio passa a "Sem liberação" (CA-07) | ✅ | `homol_13_admin_revogado_1365_escuro.png` |
| Celular (390 px), ao rolar o Estoque e as Vendas em modo suporte: a faixa âmbar passava **por cima** do cabeçalho fixo (nome do negócio e perfil). Corrigido no PR #89: no celular, a faixa rola por baixo do cabeçalho; a partir de 768 px continua fixa no topo (verificado em build local) | ❌ → ✅ | — |

Não verificado na homologação: o **e-mail ao Dono** (liberação e primeira entrada), que depende do domínio próprio no Resend ([ADR-009](../../../definicoes_arquitetura/adrs-he.md)); o aviso no sistema (faixa e registro) cobre, como previsto na seção 5.6.

## Testes automatizados

- `test/unit/suporte.test.ts` (T01–T03 e a autorização): máscara, validação da liberação, prazos, situação, matriz só de leitura, menu do suporte, descrição das telas, sessão de 8 h pelo `amr`, contexto do Administrador (com e sem liberação, expirada, revogada, de negócio encerrado), Server Actions recusadas no modo suporte, conta de Administrador sem criar negócio nem aceitar convite, termos pendentes.
- `test/integracao/suporte.test.ts` (T04–T11): script conceder/retirar, painel com a lista fechada de campos e a busca, leitura sem liberação ativa, cliente do negócio só de leitura no modo suporte, vendas com o cliente mascarado, liberar/revogar (só o Dono, substituição, negócio encerrado, restrições do banco), registro imutável (gatilho) e ligado à liberação do mesmo negócio, exportação e exclusão de conta (LGPD), novo aceite dos termos.
- Testes existentes ajustados: `test/unit/acoes.test.ts` (fábricas novas `acaoDaConta` e `acaoDoAdministrador`) e `test/unit/equipe.test.ts` (item "Acesso do suporte" no menu do Dono).

## Pendente

- A sessão de 8 h do Administrador está coberta pelos testes unitários; não foi exercitada no navegador (exigiria esperar 8 h ou forjar o horário da entrada).
