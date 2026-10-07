# SPEC-002 — Evidências (04/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/validacao.test.ts` | CA-03 |
| T02, T03, T04, T05 | `test/integracao/acesso.test.ts` — cadastro com o gatilho real no PostgreSQL | CA-01, CA-02, CA-04, INV-002, INV-003, INV-004 |
| T06, T07, T14 | `test/integracao/acesso.test.ts` — login | CA-05, CA-06, CA-07, CA-13, INV-008 |
| T08, T09 | `test/unit/rotas.test.ts` (proxy e destino) e `acesso.test.ts` | CA-08, INV-005, INV-007 |
| T11 | `test/integracao/acesso.test.ts` — recuperação | CA-10 |
| T12, T13 | `test/integracao/acesso.test.ts` — contexto com filiação real | CA-11, CA-12, INV-006 |
| T15 | `test/unit/acesso.test.ts` — schema sem senha e logs sem senha/e-mail | INV-001 |

Os testes de integração usam um dublê do Supabase Auth que grava em `auth.users` do banco local, disparando o gatilho `he_criar_usuario` de verdade (seção 12 da Spec). Fora do Supabase, a migração cria um `auth.users` mínimo só para isso.

## Verificação no navegador (build de produção local)

- **CA-03:** cadastro enviado vazio → nada vai ao servidor; cada campo com `aria-invalid` e `aria-describedby` apontando para a mensagem (nome, e-mail, senha, confirmação e aceite).
- **CA-07:** login com conta inexistente contra o **Supabase Auth de homologação** → "E-mail ou senha incorretos" (`entrar_credenciais_invalidas_1440.png`).
- **CA-08:** `/negocios` sem sessão → `307` para `/entrar?proximo=%2Fnegocios`; `/nova-senha` sem o link → `/link-invalido?tipo=recuperacao`.
- **CA-14 / T16:** login, cadastro e recuperação em 390, 768 e 1440 px, claro e escuro — **sem rolagem horizontal nas 18 combinações**; capturas representativas nesta pasta. Política de privacidade em 390 px sem rolagem horizontal (tabelas com rolagem própria).

## Verificação na homologação (04/10/2026)

Depois do merge do PR #41: workflow **Migrações** aplicou `20261004120000_acesso` no Supabase de homologação (o gatilho em `auth.users` foi aceito) e a Vercel publicou <https://he-homol.vercel.app> automaticamente (`/api/saude` → `{"aplicacao":"ok","banco":"ok"}`; `/` → `/entrar`).

Teste manual com um e-mail real da equipe, no mesmo navegador, com o SMTP padrão do Supabase:

| Passo | Critério | Resultado |
|---|---|---|
| Cadastro com aceite → "Enviamos um link para seu e-mail" | CA-01 | ✅ |
| Login antes de confirmar → "Confirme seu e-mail para entrar" | CA-05 | ✅ |
| Link de confirmação → entra em "Meus negócios" com o nome no topo | CA-05, INV-002 | ✅ |
| Recarregar a página → continua autenticado | CA-12 | ✅ |
| Sair → login; "Voltar" no navegador não mostra página autenticada | CA-09 | ✅ |
| Login com a conta confirmada | CA-06 | ✅ |
| "Esqueci a senha" → link → nova senha → entra; senha antiga recusada, nova aceita | CA-10 | ✅ |
| Novo cadastro com o mesmo e-mail → mesma mensagem de sucesso | CA-04 | ✅ |

**Configuração ainda pendente (sem mudança de código):**

- **Resend como SMTP** do Supabase Auth: libera a edição dos modelos de e-mail (link com `token_hash`, que funciona em outro aparelho — hoje o link do modelo padrão funciona no mesmo navegador do pedido) e o volume de envio além da equipe do projeto.
- **`RESEND_API_KEY` e `EMAIL_REMETENTE`** na Vercel: ativam o aviso "você já tem conta" ao dono do e-mail (CA-04).
