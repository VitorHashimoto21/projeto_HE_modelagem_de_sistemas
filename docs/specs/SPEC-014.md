# SPEC-014 — LGPD: exportação e exclusão de conta

> **Status:** 📝 **Rascunho** — aguardando as decisões da equipe nas questões em aberto (seção 13). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-002](SPEC-002.md) (conta, consentimento e bloqueio de conta excluída), [SPEC-004](SPEC-004.md) (negócios e o Dono), [SPEC-005](SPEC-005.md) (equipe e convites), [SPEC-008](SPEC-008.md) (clientes nas vendas) e [SPEC-013](SPEC-013.md) (CSV e arquivos de exportação) · **Próximas que dependem desta:** nenhuma.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-014 |
| **Nome** | LGPD: exportação e exclusão de conta |
| **Objetivo** | Permitir ao titular **exportar** os seus dados (.zip com JSON completo e CSV por tabela) e **excluir** a conta por anonimização (RN27): bloquear o acesso, anonimizar nome, e-mail e credencial do usuário e os clientes dos negócios em que ele é o único Dono, encerrar esses negócios e manter os registros fiscais e financeiros por 5 anos sem identificação. Inclui a limpeza dos e-mails de convites antigos (SPEC-005, OPEN-009). |
| **Valor entregue** | Conformidade com a LGPD (portabilidade e eliminação) e confiança: o titular leva os seus dados e sai quando quiser, como prometem a política de privacidade e os termos de uso. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RN** | RN27 | Exclusão: acesso bloqueado; nome, e-mail e senha anonimizados; clientes dos negócios em que é o único Dono anonimizados; registros fiscais e financeiros desses negócios mantidos 5 anos sem identificação; negócios encerrados. |
| **RNF** | RNF04 | Política de privacidade e consentimento (já existentes, SPEC-002) + exportação em .zip (JSON completo e CSV por tabela) + exclusão pela RN27. |
| | RNF02 | Só o próprio titular exporta ou exclui a sua conta, conferido no servidor. |
| **Caso de uso / fluxo** | — (Issue #14) | Política de privacidade, seções 6 e 7 (`docs/legal/politica-de-privacidade.md`). |
| **Entidades** | Usuario (`excluidoEm`, `anonimizadoEm`), Cliente (`anonimizadoEm`), Negocio (`encerradoEm`), MembroNegocio, Convite | Campos já existentes desde o schema inicial. |
| **Drivers** | AD-QA03 | Exportação estruturada e anonimização com retenção fiscal. |
| **ADRs** | ADR-003 | Autenticação no Supabase Auth e autorização no servidor. |

---

## 3. Escopo

### Incluído

1. **Página "Minha conta"** (todo usuário autenticado, com ou sem negócio): nome, e-mail, data do consentimento e a versão dos termos aceita, "Exportar meus dados" e "Excluir minha conta".
2. **Exportação (RNF04):** um .zip gerado na hora, com `dados.json` (completo) e um CSV por tabela, conforme o escopo do OPEN-004.
3. **Exclusão (RN27)**, com a confirmação do OPEN-002 e o tratamento dos negócios do OPEN-003:
   - `Usuario`: `excluidoEm`, `anonimizadoEm`, nome "Usuário excluído" e e-mail substituído por um endereço anônimo único;
   - negócios em que é o único Dono: `encerradoEm`, clientes anonimizados, convites pendentes cancelados;
   - negócios em que é membro: o vínculo é removido (os registros que ele fez continuam, ligados ao usuário anonimizado);
   - convites pendentes para o e-mail dele: cancelados e com o e-mail anonimizado;
   - credencial no Supabase Auth removida, conforme o OPEN-001;
   - sessão encerrada.
4. **Retenção de 5 anos** dos registros fiscais e financeiros dos negócios encerrados, conforme o OPEN-005.
5. **Convites antigos (SPEC-005, OPEN-009):** a rotina diária anonimiza o e-mail dos convites expirados ou cancelados há mais de 90 dias (OPEN-006).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Correção de dados pessoais (nome, e-mail) | Já existe pelo Supabase Auth (e-mail) e fica para evolução (nome) |
| Exclusão de um negócio sem excluir a conta | Evolução futura |
| Transferir a posse (Dono) de um negócio | Evolução futura |
| Atendimento ao titular por canal externo (e-mail do encarregado) | Política de privacidade, fora do sistema |
| Eliminação física após os 5 anos | Conforme o OPEN-005 |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-002: `Usuario` criado pelo gatilho de `auth.users`; `usuarioBloqueado` (conta com `excluidoEm` não entra, conferido em toda requisição); consentimento e versão dos termos.
  - SPEC-004/005: Dono único por negócio (convites nunca dão o papel de Dono), membros, convites, `encerradoEm` já respeitado na filiação e nas listas.
  - SPEC-008: `Cliente` (nome e contato) com `anonimizadoEm` já respeitado nas vendas.
  - SPEC-013: geração de CSV no padrão brasileiro.
  - SPEC-009: rotina diária (para o OPEN-006 e, se for o caso, o OPEN-001).
- **Decisões arquiteturais:** ADR-003.
- **Pré-requisitos externos:** conforme o OPEN-001 (a): uma **chave secreta do Supabase** cadastrada como variável secreta na Vercel; uma dependência para gerar o .zip.

---

## 5. Comportamento esperado

### 5.1 Minha conta

Link "Minha conta" no topo (pelo nome do usuário), também em "Meus negócios" para quem ainda não tem negócio. A página mostra os dados do titular e as duas ações; nunca mostra dados de outros usuários.

### 5.2 Exportar meus dados (RNF04)

1. "Exportar meus dados" baixa `he-meus-dados-AAAA-MM-DD.zip`, gerado na hora, só para o próprio usuário da sessão.
2. Conteúdo conforme o OPEN-004:
   - `dados.json`: um objeto com `geradoEm`, `titular` (perfil, consentimento, versão dos termos), `negocios` (cada um com o papel e, conforme o OPEN-004, os dados do negócio) e `convites`;
   - um CSV por tabela (`usuario.csv`, `negocios.csv`, `vendas.csv`, `itens-venda.csv`, `clientes.csv`, `lancamentos.csv`, `contas.csv`, `movimentacoes.csv`, `itens.csv`, …), no padrão da SPEC-013 (ponto e vírgula, vírgula decimal, UTF-8 com BOM);
   - `LEIA-ME.txt` explicando cada arquivo.
3. Valores em reais com 2 casas; datas em ISO 8601 no JSON e DD/MM/AAAA no CSV.

| Situação | Comportamento |
|---|---|
| Sem sessão | Login. |
| Conta excluída | Bloqueada antes (SPEC-002). |
| Negócio encerrado (de exclusão anterior) | Não aparece — a conta dona dele já foi excluída. |

### 5.3 Excluir minha conta (RN27)

1. A página explica o que acontece e lista os negócios afetados: os que serão **encerrados** (onde é o Dono), com quantos membros perderão o acesso, e os que ele vai **deixar** (onde é membro). Sugere exportar os dados antes.
2. Confirmação conforme o OPEN-002.
3. Numa transação:
   1. `Usuario`: `excluidoEm = agora`, `anonimizadoEm = agora`, `nome = "Usuário excluído"`, `email = excluido-<id>@anonimo.invalid` (único, nunca entregue);
   2. para cada negócio em que é o Dono: `encerradoEm = agora`; `Cliente.nome = "Cliente anonimizado"`, `contato = null`, `anonimizadoEm = agora`; convites pendentes cancelados;
   3. vínculos em negócios de outros Donos: removidos;
   4. convites pendentes para o e-mail dele: cancelados, com o e-mail anonimizado.
4. Remoção da credencial no Supabase Auth (OPEN-001), encerramento da sessão e ida para a página inicial com "Sua conta foi excluída."
5. Vendas, lançamentos, contas, movimentações e históricos dos negócios encerrados ficam intactos (5 anos — OPEN-005), sem identificação: o usuário e os clientes já estão anonimizados.

| Situação | Comportamento |
|---|---|
| Confirmação errada | Recusado, nada muda. |
| Pedido duplicado | A marcação é condicional (`excluidoEm IS NULL`): o segundo não faz nada. |
| Falha ao remover a credencial | Conforme o OPEN-001; o acesso já está bloqueado pela marcação (SPEC-002). |
| Novo cadastro com o mesmo e-mail depois | Permitido: é uma conta nova, sem nenhum dado da anterior. |

### 5.4 Convites antigos (OPEN-006)

A rotina diária (SPEC-009) anonimiza o e-mail dos convites `EXPIRADO` ou `CANCELADO` com `respondidoEm` (ou `expiraEm`) há mais de 90 dias. Os pendentes e os aceitos não mudam.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Depois da exclusão, nenhum dado pessoal identificável do titular fica no banco: nome e e-mail do `Usuario` anonimizados, credencial removida (OPEN-001), clientes dos negócios dele anonimizados, convites para o e-mail dele anonimizados. | Teste que procura o nome e o e-mail originais em todas as tabelas de texto. |
| **INV-002** | Registros fiscais e financeiros dos negócios encerrados ficam intactos: mesma quantidade e mesmos valores de vendas, itens, pagamentos, lançamentos, contas e movimentações. | Teste com contagens e somas antes e depois. |
| **INV-003** | A exclusão é tudo ou nada no banco (transação); a conta fica bloqueada na requisição seguinte. | Teste com falha simulada e com a guarda da SPEC-002. |
| **INV-004** | Só o titular exporta ou exclui a própria conta; a exportação traz apenas os dados do escopo do OPEN-004. | Testes com dois usuários e dois negócios. |
| **INV-005** | Membros de um negócio encerrado perdem o acesso a ele na requisição seguinte (filiação ignora encerrados — SPEC-004). | Teste de filiação. |
| **INV-006** | Dados de outros titulares não entram na exportação além do necessário para entender o registro (ex.: o nome de quem registrou uma venda do negócio dele, conforme o OPEN-004). | Revisão do escopo e teste. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Usuario` | `nome`, `email`, `excluidoEm`, `anonimizadoEm`, consentimento | Anonimizado, nunca apagado (registros apontam para ele). |
| `Negocio` | `encerradoEm` | Encerrado quando o Dono exclui a conta. |
| `Cliente` | `nome`, `contato`, `anonimizadoEm` | Anonimizado nos negócios encerrados. |
| `MembroNegocio` | vínculos | Removidos nos negócios de outros Donos. |
| `Convite` | `email`, `status` | Cancelados/anonimizados. |
| Registros fiscais | vendas, itens, pagamentos, parcelas, lançamentos, contas, movimentações, históricos | Mantidos sem mudança. |

**Mudanças previstas no schema:** conforme o OPEN-001 (pendência de remoção da credencial) e o OPEN-005 (data prevista de eliminação). Sem elas, nenhuma — os campos de anonimização já existem.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/lgpd.ts` — valores anônimos, resumo do que a exclusão afeta, montagem do conteúdo exportado (puras);
  - `src/lib/db/lgpd.ts` — leitura dos dados do titular e a transação de exclusão (fora do cliente do negócio: atravessa negócios, como as consultas de acesso);
  - `src/lib/auth/` — adaptador para remover a credencial (OPEN-001) e encerrar a sessão;
  - `src/lib/lgpd/` — fluxos, .zip e Server Action;
  - `src/app/(app)/conta/` e a rota de download da exportação;
  - rotina diária: limpeza de convites (OPEN-006).
- **Integrações:** Supabase Auth (OPEN-001).
- **Identidade visual:** a exclusão fica numa "zona de perigo" com cor de alerta, ícone e texto; o botão final só habilita com a confirmação.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Resumo da exclusão** | usuário | negócios a encerrar (com membros afetados), negócios a deixar | — |
| **Exportar meus dados** | usuário | arquivo .zip | `SemSessao` |
| **Excluir minha conta** | usuário, confirmação | conta excluída | `ConfirmacaoInvalida`, `JaExcluida`, `FalhaNaCredencial` (OPEN-001) |
| **Anonimizar convites antigos** | hoje | quantidade | — |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF04** | Exportação .zip (JSON + CSV) e exclusão pela RN27, como descritas na política de privacidade. | INV-001, INV-002 e conferência da política. |
| **RNF02** | Só o titular, conferido no servidor pela sessão (nada vem do navegador). | INV-004. |
| **RNF01** | Página "Minha conta" responsiva; zona de perigo com ícone e texto. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF06** | Exportação de um Dono com 10 mil vendas em menos de 5 s; exclusão em menos de 5 s. | Teste de integração. |

---

## 11. Critérios de aceitação

**CA-01 — Exportar.** Dado um Dono com um negócio com vendas, clientes, lançamentos e contas, quando exporta, então baixa um .zip com `dados.json`, `LEIA-ME.txt` e os CSVs do OPEN-004, com os mesmos registros e valores das telas.

**CA-02 — Exportação de membro.** Dado um colaborador, quando exporta, então o .zip traz o perfil, os vínculos e o escopo do OPEN-004 para negócios de outros, nunca dados de outros negócios.

**CA-03 — Excluir Dono.** Dado um Dono de 1 negócio com 2 clientes e 1 colaborador, quando confirma a exclusão, então o usuário fica anonimizado e bloqueado, o negócio encerrado, os clientes anonimizados, o colaborador perde o acesso e as vendas e lançamentos continuam intactos.

**CA-04 — Excluir membro.** Dado um colaborador de um negócio de outro Dono, quando exclui a conta, então o vínculo some, as vendas que ele registrou continuam (com "Usuário excluído") e o negócio segue ativo.

**CA-05 — Sem dado pessoal.** Dada uma conta excluída, então o nome e o e-mail originais não aparecem em nenhuma tabela do banco e a credencial não existe mais no Supabase Auth (OPEN-001).

**CA-06 — Confirmação.** Dada a confirmação errada (OPEN-002), então nada muda.

**CA-07 — Acesso bloqueado.** Dada uma conta recém-excluída com a sessão ainda aberta em outro aparelho, então a requisição seguinte é recusada e leva ao login.

**CA-08 — Mesmo e-mail depois.** Dada uma conta excluída, quando alguém se cadastra com o mesmo e-mail, então nasce uma conta nova, sem nenhum negócio nem dado da anterior.

**CA-09 — Convites antigos.** Dados convites expirado e cancelado há 91 dias e outro cancelado há 10 dias, quando a rotina diária roda, então só os dois primeiros têm o e-mail anonimizado.

**CA-10 — Isolamento.** Dados dois usuários, então um nunca exporta nem exclui os dados do outro.

**CA-11 — Visual.** Dada a página "Minha conta", em 390, 768 e 1440 px, claro e escuro, então segue os tokens, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Valores anônimos, resumo da exclusão, montagem do JSON e dos CSVs | Unitário | CA-01, CA-03 |
| T02 | .zip válido com os arquivos esperados e CSVs no padrão | Unitário | CA-01 |
| T03 | Exportação do Dono e do membro batendo com o banco; isolamento | Integração | CA-01, CA-02, CA-10, INV-004, INV-006 |
| T04 | Exclusão do Dono: usuário, negócio, clientes, convites, membros; registros intactos | Integração | CA-03, INV-002, INV-005 |
| T05 | Exclusão de membro | Integração | CA-04 |
| T06 | Varredura de dado pessoal depois da exclusão | Integração | CA-05, INV-001 |
| T07 | Confirmação errada, pedido duplicado, falha simulada (tudo ou nada) | Integração | CA-06, INV-003 |
| T08 | Bloqueio na requisição seguinte; novo cadastro com o mesmo e-mail | Integração | CA-07, CA-08 |
| T09 | Remoção da credencial (OPEN-001), com dublê do Supabase Auth | Integração | CA-05 |
| T10 | Rotina: convites antigos | Integração | CA-09 |
| T11 | Exportação com 10 mil vendas e exclusão em menos de 5 s | Integração | RNF06 |
| T12 | Telas em 390/768/1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-11 |
| T13 | Fluxo completo na homologação, com uma conta de teste criada para isso | Manual (uma vez) | CA-01 a CA-09 |

---

## 13. Questões em aberto

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Como remover a credencial do Supabase Auth | O usuário do Auth precisa deixar de existir. | (a) **API administrativa do Supabase** (`auth.admin.deleteUser`) com uma **chave secreta nova** (`SUPABASE_SECRET_KEY`, variável secreta na Vercel), chamada logo depois da transação; se falhar, a pendência fica registrada e a rotina diária tenta de novo — o acesso já está bloqueado pela marcação; (b) função no banco que apaga a linha de `auth.users` dentro da mesma transação, sem chave nova | **(a)** — é o caminho documentado e suportado pelo Supabase; apagar direto no schema `auth` depende de permissões que o Supabase não garante entre versões. O bloqueio pela marcação (SPEC-002) cobre o intervalo até a remoção. |
| **OPEN-002** — Confirmação da exclusão | Como evitar a exclusão por engano? | (a) **Digitar o e-mail da conta e marcar "Entendo que a exclusão é definitiva"**, com o resumo do que acontece na mesma tela; (b) confirmação por link enviado por e-mail | **(a)** — funciona para quem entra com Google (sem senha) e não depende do envio de e-mails, que ainda não está configurado (Resend). |
| **OPEN-003** — Dono de negócio com outros membros | O que fazer com a equipe? | (a) **Permitir**: os negócios são encerrados e os membros perdem o acesso; a confirmação lista os negócios e quantos membros serão afetados; (b) bloquear a exclusão enquanto houver outros membros | **(a)** — segue a RN27 e a política de privacidade; o titular não pode ser impedido de exercer o direito de exclusão por depender de terceiros, e o aviso deixa a consequência clara. |
| **OPEN-004** — O que entra na exportação | Escopo dos dados | (a) **Perfil, consentimento e vínculos; dos negócios em que é o Dono, todos os dados do negócio** (cadastro, catálogo, estoque, vendas, clientes, financeiro, histórico de preços e de plano); **dos negócios de outros Donos, só os registros feitos por ele** (vendas registradas, movimentações e lançamentos); (b) só perfil, consentimento e vínculos | **(a)** — o Dono, muitas vezes pessoa física (MEI), precisa levar os dados do próprio negócio antes de encerrá-lo (portabilidade); dos negócios de outros, só o que ele mesmo fez, sem expor o resto. |
| **OPEN-005** — Depois dos 5 anos | Como tratar o fim da retenção? | (a) **Registrar no negócio encerrado a data prevista de eliminação** (encerramento + 5 anos) e deixar a eliminação física para uma spec própria, antes da primeira data chegar; (b) implementar já uma rotina que apaga os negócios encerrados há mais de 5 anos | **(a)** — nenhum negócio chega aos 5 anos no projeto; apagar tabelas protegidas por gatilhos de auditoria exige um caminho especial que merece revisão própria. A data fica visível e documentada. |
| **OPEN-006** — Convites antigos (SPEC-005, OPEN-009) | Como limpar o e-mail? | (a) **Trocar o e-mail por um endereço anônimo**, mantendo o registro do convite (quem convidou, quando, situação); (b) apagar o registro do convite | **(a)** — o histórico da equipe continua coerente e o dado pessoal some. |

---

## 14. Definition of Done da Spec

A SPEC-014 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-11) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-006) estiverem preservados;
- [ ] os testes derivados (T01 a T13) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF06) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
