# SPEC-014 — Evidências (11/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/lgpd.test.ts`: e-mail anônimo, data de eliminação (encerramento + 5 anos; 29/02 → 28/02), confirmação (e-mail sem diferenciar maiúsculas + ciência), CSV por tabela (união de colunas, vírgula decimal, booleanos, aspas) e os arquivos da exportação | CA-01, CA-06, OPEN-002, OPEN-005 |
| T02 | idem: o .zip abre, com os mesmos arquivos e o BOM preservado nos CSVs | CA-01 |
| — | idem: fluxo com dublês — confirmação errada não chama nada; certa exclui, remove a credencial, marca e sai, nessa ordem; sem a chave ou com falha, a credencial fica pendente e a rotina tenta de novo | OPEN-001 |
| T03 | `test/integracao/lgpd.test.ts`: a Dona leva tudo do negócio dela (vendas, clientes…); da clínica de outro Dono, só a venda que ela registrou; a exportação do outro Dono não traz nada do negócio dela | CA-01, CA-02, CA-10, INV-004, INV-006 |
| T04/T05 | idem: exclusão — usuária anonimizada, credencial marcada, negócio encerrado com a data de eliminação, cliente anonimizado, convites (do negócio e para o e-mail dela) cancelados e anonimizados; vendas, itens, pagamentos, lançamentos, contas e movimentações **idênticos**; colaborador sem acesso; vínculo na clínica removido e a venda que ela registrou lá mantida | CA-03, CA-04, INV-002, INV-005 |
| T06 | idem: varredura de todas as colunas de texto do banco — o nome e o e-mail originais não aparecem em lugar nenhum | CA-05, INV-001 |
| T07 | idem: confirmação errada não muda nada; falha simulada no meio da transação desfaz tudo; dois pedidos simultâneos → um ("já excluída") | CA-06, INV-003 |
| T08 | idem: conta bloqueada na requisição seguinte; novo cadastro com o mesmo e-mail (pelo gatilho do Auth) nasce sem nenhum dado | CA-07, CA-08 |
| T09 | idem: falha ao remover a credencial deixa a pendência; a rotina sem a chave não marca; com a remoção, marca | OPEN-001 |
| T10 | idem: convites expirados/cancelados há mais de 90 dias (e pendentes vencidos há 90 dias) anonimizados; recentes e aceitos não; idempotente | CA-09, OPEN-006 |
| T11 | idem: exportação com 10 mil vendas e exclusão, cada uma em menos de 5 s | RNF06 |

São 15 testes novos (7 unitários e 8 de integração). Toda a suíte passa: lint, tipos e 564 testes. O teste da rotina diária (SPEC-009) passou a esperar também os números da LGPD.

## Build de produção local com login (T12)

`next build` + `next start` com `SUPABASE_SECRET_KEY` local, PostgreSQL local com dados de exemplo e o dublê do Supabase Auth (que agora aceita a remoção administrativa). Roteiro no navegador com **27 verificações, todas OK**:

- **Minha conta:** dados e consentimento; resumo com os 2 negócios a encerrar (Dona) e o Ateliê a deixar (colaboradora); link no topo.
- **Exportação:** `.zip` com o nome do dia, 24 arquivos (LEIA-ME, `dados.json`, CSVs); os 2 negócios da Dona com todas as 17 vendas; do Ateliê, só os registros dela; CSV com BOM e ponto e vírgula.
- **Confirmação:** botão desabilitado sem confirmação e com o e-mail errado; habilitado com o e-mail certo (maiúsculas não importam) e a ciência.
- **Exclusão:** volta para "Entrar" com "Sua conta foi excluída"; o dublê do Auth recebeu `DELETE /auth/v1/admin/users/<id>`; no banco, usuária anonimizada com a credencial marcada, os 2 negócios encerrados com a data de eliminação, vínculo no Ateliê removido, clientes anonimizados e as vendas mantidas.
- **Depois:** a área autenticada leva ao login e o login com a conta excluída é recusado.
- **Telas:** "Minha conta" em 390, 768 e 1440 px, nos temas claro e escuro — **sem rolagem horizontal**. Capturas em [`telas/`](telas/).

## Verificação na homologação (T13) — 11/10/2026

- **Merge do PR #70:** o workflow **Migrações** aplicou `20261012150000_lgpd` sem erro; o CI ficou verde.
- **Publicação:** a Vercel publicou <https://he-homol.vercel.app> com o commit do merge; `/api/saude` responde ok (aplicação e banco) e `/conta` e `/conta/exportar` levam ao login sem sessão.
- **Chave:** `SUPABASE_SECRET_KEY` cadastrada na Vercel como variável secreta (o valor nunca passou pelo repositório nem pelo chat).

**Teste pela equipe:**
- exportação com a própria conta;
- exclusão de uma **conta de teste descartável**: negócio encerrado, volta à tela de entrar com o aviso, login recusado depois e a conta **removida do Supabase Auth** (confirmado em *Authentication → Users*) — a remoção pela API administrativa funcionou.

**Tudo funcionando.**
