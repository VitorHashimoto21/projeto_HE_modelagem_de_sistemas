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

## Testes automatizados

- `test/unit/suporte.test.ts` (T01–T03 e a autorização): máscara, validação da liberação, prazos, situação, matriz só de leitura, menu do suporte, descrição das telas, sessão de 8 h pelo `amr`, contexto do Administrador (com e sem liberação, expirada, revogada, de negócio encerrado), Server Actions recusadas no modo suporte, conta de Administrador sem criar negócio nem aceitar convite, termos pendentes.
- `test/integracao/suporte.test.ts` (T04–T11): script conceder/retirar, painel com a lista fechada de campos e a busca, leitura sem liberação ativa, cliente do negócio só de leitura no modo suporte, vendas com o cliente mascarado, liberar/revogar (só o Dono, substituição, negócio encerrado, restrições do banco), registro imutável (gatilho) e ligado à liberação do mesmo negócio, exportação e exclusão de conta (LGPD), novo aceite dos termos.
- Testes existentes ajustados: `test/unit/acoes.test.ts` (fábricas novas `acaoDaConta` e `acaoDoAdministrador`) e `test/unit/equipe.test.ts` (item "Acesso do suporte" no menu do Dono).

## Pendente

- **T13** — fluxo completo na homologação, depois do merge: criar a conta exclusiva do suporte, conceder o papel pelo workflow **Administradores** (GitHub Actions, ambiente `homologacao`), liberar, entrar, navegar, revogar e conferir o registro.
- A sessão de 8 h do Administrador está coberta pelos testes unitários; não foi exercitada no navegador (exigiria esperar 8 h ou forjar o horário da entrada).
