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

## Pendente — verificação na homologação (depois do merge e da configuração do Supabase Auth)

Fluxos que dependem do envio real de e-mail: CA-01 e CA-05 (link de confirmação), CA-04 (aviso de conta existente), CA-09 (logout e voltar no navegador), CA-10 (link de recuperação e encerramento das outras sessões) e CA-12 (recarregar a página).
