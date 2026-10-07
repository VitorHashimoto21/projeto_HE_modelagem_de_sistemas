# SPEC-005 — Evidências (07/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01, T02 | `test/unit/permissoes.test.ts`: predefinições, resolução (Dono sempre tudo, matriz inválida não concede nada), coerência, matriz parcial, chaves desconhecidas, leitura do formulário | CA-10, CA-11, INV-008 |
| T03, T04 | `test/unit/equipe.test.ts`: validação do convite, e-mail mascarado, token (base64url, SHA-256, formato), validade de 7 dias, texto do e-mail | CA-01, CA-14, INV-002, INV-007 |
| Guardas | `test/unit/equipe.test.ts`: decisão de autorização por nível (pública, sessão, Dono, módulo × ação) e menu | CA-09, CA-10, INV-001 |
| T05–T16, T20, T21 | `test/integracao/equipe.test.ts` (26 testes): convite, limite do plano com 8 pedidos simultâneos × 5 rodadas, cancelar/reenviar, aceitar (link e "Convites para você"), aceitação dupla, link inválido, e-mail diferente, RN02 com Gerente/Colaborador/não membro, isolamento entre negócios, papel lido do banco, trocar papel/remover, Dono intocável, papel por negócio, e-mail indisponível, sair do negócio | CA-01 a CA-15, CA-17, CA-18, INV-001 a INV-010 |
| T17 | `test/unit/acoes.test.ts`: toda exportação de arquivo `"use server"` é criada pela fábrica | INV-005 |
| Rotas | `test/unit/rotas.test.ts`: `/convite/...` aberta com e sem sessão; Equipe exige sessão | 5.3 |

**Verificação do teste de concorrência:** sem o `FOR UPDATE` na transação do convite, o T06 falhou 4 de 4 vezes; com a trava, passou 5 de 5.

## Verificação no navegador (build de produção local)

Build de produção (`next build` + `next start`) com o PostgreSQL local e um dublê do Supabase Auth (login por senha e `/auth/v1/user`), roteiro automatizado com o Chromium:

| Passo | Resultado |
|---|---|
| Dono abre Equipe; menu mostra Painel, Equipe e Dados do negócio | ✅ |
| Convidar Colaboradora com "Financeiro: criar"; marcar editar marca "Ver"; desmarcar "Ver" desmarca editar | ✅ |
| Sem Resend: convite criado, aviso âmbar e link copiável (CA-17) | ✅ `convite_criado_1440_claro.png` |
| Link sem sessão → página do convite; "Já tenho conta" com o e-mail preenchido; depois do login volta ao convite; "Aceitar" → Painel | ✅ `convite_sem_sessao_1440_escuro.png` |
| Menu da Colaboradora só com Painel; Equipe e Dados do negócio → "Sem acesso" | ✅ `sem_acesso_390_claro.png` |
| Link já usado → "Este convite não vale mais" (CA-06) | ✅ |
| Limite do plano gratuito: aviso, botão escondido e recusa no servidor (CA-02) | ✅ |
| Gerenciar: matriz personalizada carregada; promover a Gerente → matriz completa | ✅ `membro_390_claro.png` |
| Plano pago (trocado no banco — SPEC-013): convite para conta existente aparece em "Convites para você"; aceitar → Painel | ✅ `convites_para_voce_768_escuro.png` |
| Reenviar gera link novo; o anterior para de valer (INV-007) | ✅ `equipe_com_convite_1440_claro.png` |
| Conta com outro e-mail → e-mail mascarado e "Sair e entrar com outra conta" (CA-08) | ✅ `convite_outro_email_390_claro.png` |
| "Sair deste negócio" → confirmação → sai; o painel do negócio deixa de abrir (CA-18) | ✅ `meus_negocios_membro_390_claro.png` |
| **T18:** convidar, convite criado, convite sem e com sessão, Equipe, membro, convites para você, "Sem acesso" e "Meus negócios" em 390, 768 e 1440 px, claro e escuro — **sem rolagem horizontal em nenhuma combinação** | ✅ `convidar_390_escuro.png` e as demais |

## Pendente

- **T19** — fluxo completo na homologação com e-mail real: depende de configurar o Resend (`RESEND_API_KEY` e `EMAIL_REMETENTE`) com domínio verificado. Até lá, o convite funciona pelo link copiável, que pode ser verificado no preview da Vercel.
