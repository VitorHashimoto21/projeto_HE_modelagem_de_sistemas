# SPEC-001 — Fundação técnica e isolamento multi-tenant

> **Status:** ✅ **Aprovada e implementada em 03/10/2026** (PR #36, CI verde). Revisão 2, com as decisões OPEN-12 a OPEN-31 do Mapa de Specs (seção 1.8). CA-14, CA-15 e CA-16 verificados na homologação em 03/10/2026 ([evidências](evidencias/SPEC-001/homologacao.md)).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Próxima:** SPEC-002 (depende desta).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-001 |
| **Nome** | Fundação técnica e isolamento multi-tenant |
| **Objetivo** | Estabelecer o projeto Next.js (App Router) + TypeScript, o Prisma conectado ao PostgreSQL (Supabase) com o schema da baseline, o mecanismo **obrigatório** de isolamento de dados por negócio (no código e no banco), o utilitário de datas (UTC × America/Sao_Paulo), a base visual (tokens, fontes e ícones da identidade), os ambientes de desenvolvimento, preview e homologação (com produção pronta para ativar), o backup diário e o pipeline de CI. |
| **Valor entregue** | Uma base única, tipada e testada sobre a qual todas as outras Specs são construídas. O vazamento de dados entre negócios fica impedido **por construção**: o código das Specs seguintes não consegue consultar dados operacionais sem um contexto de negócio, e a API pública do provedor do banco não dá acesso a nenhuma tabela. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RN** | RN01 | Mecanismo que restringe toda consulta operacional ao negócio do contexto. (A parte "colaborador só acessa negócios aos quais foi convidado" depende de `MembroNegocio` e é concluída na SPEC-005.) |
| | RN29 | Utilitário único de datas: armazenamento em UTC; dia, mês e competência em America/Sao_Paulo. |
| **RNF** | RNF01 | Aplicação web responsiva (estrutura base, tokens e layout raiz). |
| | RNF02 | Isolamento lógico multi-tenant no código (cliente do negócio) e no banco (RLS ligado, sem policies). |
| | RNF09 | Dump diário automatizado do banco via GitHub Actions, guardado de forma privada. |
| | RNF10 | Estrutura de pastas por camada e por módulo, com domínio separado da interface. |
| | RNF11 | Ambientes separados: desenvolvimento, preview por PR, homologação (`DEVELOP`) e produção (`main`) documentada e pronta para ativar. |
| **Caso de uso / fluxo** | — | Spec técnica; corresponde às issues #01 e #02 do guia de issues. |
| **Entidades** | Negocio | Âncora do tenant. As demais entidades entram como schema e migração inicial. |
| **Drivers** | AD-C01 | Stack Next.js + TypeScript + Prisma + PostgreSQL. |
| | AD-C02 | Multi-tenancy lógico com `negocioId` em todas as tabelas operacionais e filtro obrigatório. |
| | AD-C03 | Entrega web responsiva. |
| | AD-C05 | Ambientes separados com credenciais próprias. |
| | AD-QA06 | Isolamento validado no servidor em toda requisição (a parte de papéis é da SPEC-005). |
| **ADRs** | ADR-001 | Next.js App Router + TypeScript; regras de negócio fora de páginas/componentes. |
| | ADR-002 | Prisma + PostgreSQL; `negocioId` em todas as tabelas operacionais; extensão do Prisma Client; RLS sem policies; connection pooling. |
| | ADR-003 | `Usuario.id` = `auth.users.id`, sem senha local (o schema já nasce assim; o cadastro é da SPEC-002). |
| **Decisões do mapa** | OPEN-12, 13, 14, 15, 27, 28, 29, 30, 31 | Ver seção 13. |
| **Outros artefatos** | `docs/prisma_base/schema.prisma` (v7), `docs/design/IDENTIDADE_VISUAL.md` (seção 9 — "Aplicação nas Specs"), `docs/design/identidade/tokens/tokens.css`, `docs/design/identidade/favicon/` | |

---

## 3. Escopo

### Incluído

1. **Projeto base:** Next.js (App Router) com TypeScript em modo estrito, ESLint, TailwindCSS v4 e shadcn/ui inicializado.
2. **Estrutura de pastas** (OPEN-15, ver seção 8): `src/{app,components,lib,hooks}`, `prisma/`, `test/`, com a regra de domínio fora de `src/app/` (ADR-001).
3. **Banco:**
   - Prisma configurado para PostgreSQL no Supabase (string de conexão com pooling para a aplicação e conexão direta para migrações);
   - o schema v7 da baseline levado para `prisma/schema.prisma`, que passa a ser a **fonte da verdade** (OPEN-30); `docs/prisma_base/schema.prisma` é removido, com um aviso no `docs/prisma_base/` apontando o novo local;
   - a **migração inicial** criando todas as tabelas.
4. **Isolamento no código (OPEN-28):** uma **extensão do Prisma Client** (o "cliente do negócio") que exige um contexto de negócio (`negocioId`) e aplica o filtro em toda leitura, criação, alteração e exclusão dos modelos operacionais (seções 6 e 9).
5. **Isolamento no banco (OPEN-13):** migração que liga o **Row Level Security em todas as tabelas, sem nenhuma policy**, para que a API REST automática do Supabase não leia nem grave nada.
6. **Classificação dos modelos** em operacionais (todos com `negocioId`) e globais (seção 7), registrada no código e coberta por teste.
7. **Utilitário de datas (RN29):** conversão e cálculo de dia, intervalo do mês e competência no fuso America/Sao_Paulo.
8. **Base visual:**
   - `tokens.css` da identidade visual aplicado como CSS global (`src/app/globals.css`);
   - Fraunces e Outfit carregadas com `next/font/google`;
   - favicon, ícones e `site.webmanifest` publicados;
   - metadados com nome "Health Enterprise" e `theme-color` `#163028`;
   - suporte ao tema escuro pela classe `.dark`.
9. **Verificação de saúde:** uma rota que informa se a aplicação está no ar e se o banco responde, sem expor dados.
10. **Configuração de ambiente:** `.env.example` documentado, `.env` fora do controle de versão e validação das variáveis obrigatórias na inicialização.
11. **Ambientes (OPEN-27):**
    - desenvolvimento local com PostgreSQL local;
    - projeto na Vercel com **preview automático por Pull Request** e **homologação** publicada a cada merge na `DEVELOP`, ligada a um projeto Supabase de homologação;
    - **produção documentada e pronta para ativar** (variáveis por ambiente e checklist de criação do projeto Supabase de produção), sem criar recursos pagos agora.
12. **CI (GitHub Actions):** em todo Pull Request para `DEVELOP` ou `main`, rodar instalação, lint, checagem de tipos, `prisma validate` e testes (Vitest — OPEN-31); status visível no PR.
13. **Backup (OPEN-29):** workflow agendado no GitHub Actions que faz o dump diário do banco de homologação (e, quando existir, do de produção) e o guarda como artefato privado; procedimento de restauração documentado.
14. **README atualizado** com os comandos reais de instalação, uso, testes e ambientes.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cadastro, login, sessão, criação do `Usuario` com o id do Supabase Auth e consentimento LGPD | SPEC-002 |
| Carga dos parâmetros fiscais (seed) | SPEC-003 |
| Criação de negócio, consulta de CNPJ e troca de negócio ativo | SPEC-004 |
| Papéis, convites e matriz de permissões (parte "por perfil" do AD-QA06) | SPEC-005 |
| Telas de negócio (catálogo, estoque, vendas etc.) | SPEC-006 em diante |
| Rotinas agendadas da aplicação (Vercel Cron) | SPEC-009 |
| Ativação da produção (projeto Supabase de produção, domínio, plano pago da Vercel e do Supabase) | Publicação do projeto, após o MVP |
| Gateway de pagamento | SPEC-015 (opcional) |
| Policies de RLS por negócio usando o usuário do Supabase | Evolução futura (ADR-002) |
| Adicionar o professor como colaborador do repositório | Tarefa administrativa, não é comportamento do sistema |

---

## 4. Dependências

- **Specs anteriores:** nenhuma (Spec raiz).
- **Decisões arquiteturais:** ADR-001, ADR-002, ADR-003 (Supabase como provedor) e OPEN-12 a OPEN-15 e OPEN-27 a OPEN-31 do mapa.
- **Pré-requisitos externos:**
  - projeto Supabase de **homologação** criado (plano gratuito), com as strings de conexão disponíveis para a equipe;
  - projeto na Vercel ligado ao repositório (plano gratuito), com a `DEVELOP` como branch de homologação;
  - permissão de administrador no repositório GitHub para configurar a proteção de branch (exigir CI verde antes do merge) e os segredos do CI e do backup.

---

## 5. Comportamento esperado

### 5.1 Acesso a dados operacionais com contexto de negócio

- **Pré-condições:** existe um `negocioId` válido no contexto da requisição. Nesta Spec o contexto é recebido como parâmetro; a SPEC-002 passará a obtê-lo da sessão autenticada.
- **Fluxo principal:**
  1. O código do servidor obtém o acesso aos dados **a partir do contexto** ("cliente do negócio").
  2. Toda leitura em modelo operacional recebe automaticamente a condição `negocioId = contexto`.
  3. Toda criação recebe o `negocioId` do contexto.
  4. Toda alteração ou exclusão só afeta registros desse negócio.
  5. Registros filhos (ex.: itens de uma venda) também têm `negocioId`, sempre igual ao do registro pai.
- **Pós-condições:** o resultado contém somente dados do negócio do contexto.

### 5.2 Fluxos de exceção

| Situação | Comportamento |
|---|---|
| Acesso a modelo operacional **sem** contexto de negócio | A operação é recusada com erro de programação explícito ("contexto de negócio ausente"); nada é lido nem gravado. |
| Leitura, alteração ou exclusão de um registro de **outro** negócio (por id) | Tratado como **inexistente**: mesmo resultado de um id que não existe, sem revelar que o registro existe. |
| Criação informando um `negocioId` diferente do contexto | A operação é recusada. |
| Criação de registro filho ligado a um pai de outro negócio | A operação é recusada (o pai não é encontrado no contexto). |
| Requisição direta à API REST do Supabase com a chave pública | Nenhuma linha é retornada nem gravada (RLS sem policies). |
| Banco indisponível | A rota de saúde responde "banco indisponível" com status de erro; páginas mostram mensagem genérica, sem detalhes técnicos. |
| Variável de ambiente obrigatória ausente | A aplicação não inicia e informa qual variável falta (sem exibir valores). |

### 5.3 Datas (RN29)

- Toda data é gravada em UTC.
- "Hoje", "mês" e "competência" são calculados no fuso America/Sao_Paulo.
- **Exemplo:** o instante `2026-10-01T02:30:00Z` pertence ao **dia 30/09/2026** e à **competência 09/2026** no horário de Brasília.

### 5.4 CI

- **Gatilho:** abertura ou atualização de Pull Request para `DEVELOP` ou `main`.
- **Passos:** instalar dependências, lint, checagem de tipos, `prisma validate` e testes (Vitest, com PostgreSQL de serviço do GitHub Actions).
- **Resultado:** status de sucesso ou falha exibido no PR. Com a proteção de branch configurada, o merge fica bloqueado enquanto o CI falhar.

### 5.5 Ambientes

| Ambiente | Publicação | Banco | Variáveis |
|---|---|---|---|
| Desenvolvimento | `npm run dev` na máquina | PostgreSQL local | `.env` local (a partir do `.env.example`) |
| Preview | Vercel, a cada push em PR | Supabase de homologação | Variáveis de "Preview" na Vercel |
| Homologação | Vercel, a cada merge na `DEVELOP` | Supabase de homologação | Variáveis de homologação na Vercel |
| Produção (pronta para ativar) | Vercel, a cada merge na `main` | Supabase de produção (a criar) | Variáveis de "Production" na Vercel |

- As migrações são aplicadas em homologação antes de qualquer aplicação em produção.
- Credenciais de um ambiente nunca são usadas em outro; dados reais só existem em produção.

### 5.6 Backup

- Todo dia, um workflow agendado faz o dump do banco de homologação e o guarda como artefato privado do GitHub Actions.
- O procedimento de restauração (do artefato para um PostgreSQL vazio) está documentado no README.
- Quando a produção for ativada, o mesmo workflow passa a incluir o banco de produção, e o backup nativo do plano pago do Supabase entra como cópia principal (RNF09).

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhuma operação em modelo operacional (seção 7) é executada sem contexto de negócio. | Teste: chamar sem contexto → erro; nenhuma consulta enviada ao banco. |
| **INV-002** | Toda leitura em modelo operacional retorna apenas registros com `negocioId` = contexto. | Teste com dois negócios e dados em ambos: cada contexto vê só os seus. |
| **INV-003** | Registro de outro negócio é indistinguível de registro inexistente (leitura, alteração e exclusão). | Teste: id do negócio B no contexto A → "não encontrado"; o registro de B continua intacto. |
| **INV-004** | Toda criação em modelo operacional grava o `negocioId` do contexto; um valor diferente é recusado. | Teste de criação com e sem `negocioId` divergente. |
| **INV-005** | O `negocioId` de todo registro filho é igual ao do seu registro pai. | Teste: criação de filho com pai de outro negócio → recusada; consulta de consistência pai × filho sem divergências. |
| **INV-006** | Todo modelo do schema está classificado (operacional ou global); todo modelo operacional tem `negocioId`; um modelo novo sem classificação faz o teste falhar. | Teste que compara a lista de modelos do Prisma com a classificação e com a presença do campo. |
| **INV-007** | Datas gravadas em UTC; dia, mês e competência calculados em America/Sao_Paulo. | Testes de fronteira (meia-noite UTC × Brasília; virada de mês). |
| **INV-008** | Nenhum segredo no repositório: `.env` ignorado pelo Git, apenas `.env.example` sem valores reais. | Checagem no CI. |
| **INV-009** | Os tokens de cor da aplicação são os da identidade visual, sem alteração; qualquer mudança passa por `validar_contraste.py`. | Comparação do CSS global com `docs/design/identidade/tokens/tokens.css` no CI. |
| **INV-010** | O schema em `prisma/schema.prisma` é válido e a migração inicial o reproduz por completo. | `prisma validate` e `prisma migrate diff` sem diferenças no CI. |
| **INV-011** | Toda tabela do schema `public` tem RLS ligado. | Teste de integração que consulta o catálogo do PostgreSQL (`pg_class.relrowsecurity`) após as migrações. |
| **INV-012** | Cada ambiente usa banco e credenciais próprios; nenhuma credencial de produção existe fora do ambiente de produção. | Revisão da configuração da Vercel e do `.env.example` (checklist no PR). |

---

## 7. Modelo de domínio envolvido

Esta Spec leva o schema v7 da baseline para o projeto e classifica os modelos para o isolamento:

| Classe | Modelos | Regra |
|---|---|---|
| **Operacionais** (todos com `negocioId`) | `Item`, `MaterialServico`, `MovimentacaoEstoque`, `HistoricoPreco`, `Cliente`, `Venda`, `ItemVenda`, `Pagamento`, `Parcela`, `LancamentoFinanceiro`, `ContaPagarReceber`, `DespesaFixa`, `MembroNegocio`, `Convite` | Filtro automático por `negocioId` do contexto; filhos com `negocioId` igual ao do pai (INV-005). |
| **Âncora do tenant** | `Negocio` | Acessado pelo próprio id do contexto. |
| **Globais** (sem tenant) | `Usuario`, `FaixaTributaria`, `CnaeAnexo`, `ParametroMei`, `ParametroFatorR`, `MargemPadraoCategoria` | Fora do filtro de negócio. Os parâmetros fiscais são somente leitura para a aplicação (carga pela SPEC-003). `Usuario.id` = `auth.users.id` (ADR-003). |

Restrições já presentes no schema e mantidas: chaves estrangeiras para `Negocio`, índices por `negocioId` em todas as tabelas operacionais e `(negocioId, data, status)` em `Venda` (AD-QA01), e unicidade `(despesaFixaId, competencia)`.

---

## 8. Impacto arquitetural

- **Módulos e fronteiras (ADR-001):**

  | Camada | Local | Conteúdo | Pode importar |
  |---|---|---|---|
  | Rotas | `src/app/` | Rotas, páginas, layouts, Server Actions e Route Handlers | camada de dados e domínio |
  | Dados | `src/lib/` (ex.: `src/lib/db/`) | Cliente Prisma, extensão "cliente do negócio" e classificação dos modelos | — |
  | Domínio | `src/lib/` (ex.: `src/lib/dominio/`) | Regras puras (datas; depois o motor de precificação do ADR-005) | **nada** de framework nem de banco |
  | Interface | `src/components/`, `src/hooks/` | Componentes (shadcn/ui) e hooks do front | — |
  | Banco | `prisma/` | `schema.prisma`, migrações (incluindo a de RLS) e, a partir da SPEC-003, o seed | — |
  | Testes | `test/` | Testes unitários e de integração (Vitest) | tudo |

  Regra de importação: páginas e componentes **não** importam o cliente Prisma bruto, só o cliente do negócio. Essa regra deve ser verificada por lint.
- **Backend × frontend:**
  - Toda consulta acontece no servidor (Server Components, Server Actions, Route Handlers).
  - O navegador nunca recebe o cliente de banco nem a string de conexão.
- **Integrações:**
  - Supabase (PostgreSQL): conexão com pooling para a aplicação e conexão direta para migrações, conforme as consequências do ADR-002; RLS ligado em todas as tabelas.
  - Vercel: preview por PR e homologação pela `DEVELOP`.
  - GitHub Actions: CI e backup diário.
- **ADRs que restringem:**
  - ADR-001: regra de negócio fora de páginas e componentes.
  - ADR-002: `negocioId` em toda tabela operacional, extensão do Prisma Client, RLS sem policies, pooling.
  - ADR-003: o isolamento é validado no servidor; o contexto virá da sessão na SPEC-002.
- **Identidade visual:** tokens, fontes, favicon e metadados aplicados conforme `IDENTIDADE_VISUAL.md` §9.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Cliente do negócio** (extensão do Prisma Client) | contexto `{ negocioId, usuarioId? }` | acesso aos modelos operacionais já restrito ao negócio | `ContextoDeNegocioAusente`; `NegocioDivergente` (criação com outro `negocioId`); "não encontrado" para registro de outro negócio |
| **Utilitário de datas** | instante (UTC) ou data local | início e fim do dia local (em UTC); intervalo do mês local; competência (`AAAA-MM`) | data inválida |
| **Verificação de saúde** | — | `{ aplicacao: "ok", banco: "ok" \| "indisponivel" }` | status de erro quando o banco não responde; sem detalhes internos |
| **Configuração** | variáveis de ambiente | configuração validada | aplicação não inicia e informa a variável ausente |
| **Backup** | agendamento diário; segredo com a conexão do banco | arquivo de dump guardado como artefato privado | falha do workflow visível no GitHub Actions |

Os nomes exatos de funções, arquivos e da rota de saúde são decididos na implementação, respeitando estes contratos.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Layout raiz responsivo, tokens e fontes; `viewport` correto. | Página inicial de verificação renderiza sem rolagem horizontal em 390px e em 1440px, nos temas claro e escuro. |
| **RNF02** | Cliente do negócio, `negocioId` em todas as tabelas operacionais e RLS ligado. | INV-001 a INV-006 e INV-011 cobertos por testes de integração com banco real (PostgreSQL de teste); chamada à API REST do Supabase de homologação com a chave pública retornando vazio (manual, uma vez). |
| **RNF09** | Dump diário via GitHub Actions. | Workflow executado com sucesso e um dump restaurado num PostgreSQL vazio, com o resultado registrado no README. |
| **RNF10** | Pastas por camada e por módulo; domínio isolado. | Regra de lint de importação; revisão da estrutura no PR. |
| **RNF11** | Preview por PR, homologação pela `DEVELOP`, produção documentada. | PR de teste ganha link de preview; merge na `DEVELOP` atualiza a homologação; checklist de produção presente no README. |

---

## 11. Critérios de aceitação

**CA-01 — Projeto executa.**
Dado o repositório recém-clonado e um `.env` preenchido a partir do `.env.example`,
quando a equipe executa a instalação, a migração e o comando de desenvolvimento,
então a aplicação abre no navegador com o nome "Health Enterprise", o favicon da marca e as fontes Fraunces e Outfit.

**CA-02 — Migração inicial.**
Dado um banco PostgreSQL vazio,
quando as migrações são aplicadas,
então todas as tabelas, relações, índices e restrições do schema v7 existem, o RLS está ligado em todas as tabelas e `prisma validate` passa.

**CA-03 — Isolamento na leitura.**
Dados os negócios A e B, cada um com seus itens,
quando o código lista itens com o contexto do negócio A,
então só aparecem itens de A.

**CA-04 — Registro de outro negócio.**
Dado um item que pertence ao negócio B,
quando o código busca, altera ou exclui esse item pelo id com o contexto do negócio A,
então o resultado é "não encontrado" e o item de B permanece inalterado.

**CA-05 — Sem contexto.**
Dado qualquer modelo operacional,
quando o código tenta acessá-lo sem contexto de negócio,
então a operação é recusada com "contexto de negócio ausente" e nenhuma consulta chega ao banco.

**CA-06 — Criação.**
Dado o contexto do negócio A,
quando um item é criado sem informar o negócio,
então ele é gravado com o `negocioId` de A;
e quando é criado informando o negócio B, então a criação é recusada.

**CA-07 — Registros filhos.**
Dada uma venda do negócio B com itens e pagamentos,
quando o código, no contexto do negócio A, tenta ler esses itens ou pagamentos, ou criar um item ligado a essa venda,
então nada é retornado e a criação é recusada;
e todo item ou pagamento criado no contexto de B tem o `negocioId` de B.

**CA-08 — Classificação completa.**
Dado um novo modelo adicionado ao schema sem classificação, ou um modelo operacional sem `negocioId`,
quando os testes rodam,
então o teste de classificação falha indicando o modelo.

**CA-09 — Datas.**
Dado o instante `2026-10-01T02:30:00Z`,
quando o utilitário calcula o dia e a competência,
então retorna 30/09/2026 e `2026-09`;
e o intervalo do mês de setembro/2026 vai de `2026-09-01T03:00:00Z` (inclusivo) a `2026-10-01T03:00:00Z` (exclusivo).

**CA-10 — Saúde.**
Dado o banco disponível, quando a rota de saúde é chamada, então responde "ok" para aplicação e banco;
e dado o banco indisponível, então responde "indisponível" com status de erro, sem mensagens internas.

**CA-11 — Configuração.**
Dada a ausência de uma variável obrigatória,
quando a aplicação inicia,
então ela não sobe e informa o nome da variável ausente.

**CA-12 — CI.**
Dado um Pull Request para `DEVELOP` ou `main`,
quando ele é aberto ou atualizado,
então o CI executa lint, tipos, `prisma validate` e testes, e o status aparece no PR;
e um PR com teste falhando fica com status de falha.

**CA-13 — Visual.**
Dada a página inicial de verificação,
quando exibida nos temas claro e escuro, em 390px e 1440px de largura,
então usa os tokens da identidade sem alteração e não tem rolagem horizontal.

**CA-14 — Backup.**
Dado o banco de homologação,
quando o workflow diário de backup roda,
então um dump é guardado como artefato privado e pode ser restaurado num PostgreSQL vazio seguindo o README.

**CA-15 — API pública bloqueada.**
Dado o banco de homologação com dados,
quando alguém chama a API REST do Supabase com a chave pública,
então nenhuma linha de nenhuma tabela é retornada e nenhuma escrita é aceita.

**CA-16 — Ambientes.**
Dado um Pull Request aberto,
quando a Vercel o processa,
então o PR exibe um link de preview funcionando;
e quando um PR é integrado na `DEVELOP`, então a homologação passa a exibir a nova versão, usando o banco de homologação.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Lista de itens com contexto A × B (dados nos dois) | Integração (banco de teste) | CA-03, INV-002 |
| T02 | Buscar, alterar e excluir item de B no contexto A | Integração | CA-04, INV-003 |
| T03 | Acesso sem contexto em cada modelo operacional | Unitário/integração | CA-05, INV-001 |
| T04 | Criação sem `negocioId` e com `negocioId` divergente | Integração | CA-06, INV-004 |
| T05 | Itens e pagamentos de venda de B no contexto A; criação de filho com pai de outro negócio | Integração | CA-07, INV-005 |
| T06 | Todos os modelos do Prisma estão classificados e os operacionais têm `negocioId` | Unitário | CA-08, INV-006 |
| T07 | Fronteiras de dia e mês: 02:30Z, 03:00Z, virada de mês e de ano | Unitário | CA-09, INV-007 |
| T08 | Rota de saúde com banco disponível e indisponível | Integração | CA-10 |
| T09 | Inicialização com variável ausente | Unitário | CA-11 |
| T10 | `.env` ignorado e `.env.example` sem segredos | CI | INV-008 |
| T11 | CSS global igual aos tokens da identidade | CI | INV-009, CA-13 |
| T12 | `prisma validate` e diff da migração inicial sem diferenças | CI | CA-02, INV-010 |
| T13 | Regra de lint: páginas e componentes não importam o Prisma bruto | Lint | RNF10, ADR-001 |
| T14 | PR de teste com falha proposital fica vermelho | Manual (uma vez) | CA-12 |
| T15 | Página de verificação em 390/1440px, claro e escuro | Manual com captura | CA-01, CA-13 |
| T16 | Todas as tabelas do `public` com `relrowsecurity = true` após as migrações | Integração | CA-02, INV-011 |
| T17 | Chamada à API REST do Supabase de homologação com a chave pública retorna vazio e recusa escrita | Manual (uma vez) | CA-15, RNF02 |
| T18 | Execução do workflow de backup e restauração do dump num PostgreSQL vazio | Manual (uma vez) | CA-14, RNF09 |
| T19 | Link de preview num PR e atualização da homologação após merge na `DEVELOP` | Manual (uma vez) | CA-16, RNF11, INV-012 |

Os testes de integração usam um PostgreSQL próprio para testes (no CI, um serviço PostgreSQL do GitHub Actions), nunca os bancos do Supabase.

---

## 13. Questões em aberto

As questões da revisão 1 foram decididas pela equipe e registradas no Mapa de Specs (seção 1.8):

| Questão da revisão 1 | Decisão | ID no mapa |
|---|---|---|
| OPEN-001 — `negocioId` nas tabelas filhas | Adicionado em todas as tabelas operacionais | OPEN-12 |
| OPEN-002 — Mecanismo do cliente do negócio | Extensão do Prisma Client | OPEN-28 |
| OPEN-003 — Plano do Supabase e backup diário | Plano gratuito + dump diário via GitHub Actions | OPEN-29 |
| OPEN-004 — Estrutura de pastas | `src/{app,components,lib,hooks}`, `prisma/`, `test/` | OPEN-15 |
| OPEN-005 — Fonte da verdade do schema | `prisma/schema.prisma`; a cópia em `docs/` é removida | OPEN-30 |
| OPEN-006 — Ferramenta de testes | Vitest | OPEN-31 |
| OPEN-007 — Primeiro deploy | Preview e homologação nesta Spec; produção pronta para ativar | OPEN-27 |
| (novo) API pública do Supabase | RLS ligado em todas as tabelas, sem policies | OPEN-13 |
| (novo) Senha local × Supabase Auth | Sem senha local; `Usuario.id` = `auth.users.id` | OPEN-14 |

Questões ainda abertas:

- **OPEN-008 — Retenção do backup.** Artefatos do GitHub Actions expiram (até 90 dias, configurável). Confirmar se 90 dias bastam enquanto não houver produção, ou se o dump deve ir para um armazenamento externo.
- **OPEN-009 — Nomes e endereços.** Nome do projeto na Vercel e dos projetos Supabase (`he-homol`, `he-prod`), e se haverá domínio próprio para a homologação.

Nenhuma das duas impede o início da implementação.

---

## 14. Definition of Done da Spec

A SPEC-001 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-16) estiverem implementados — **CA-01 a CA-16 ✅** (CA-14 a CA-16 na homologação, ver [`evidencias/SPEC-001/homologacao.md`](evidencias/SPEC-001/homologacao.md));
- [x] todos os invariantes (INV-001 a INV-012) estiverem preservados — INV-012 revisado na configuração da Vercel (projeto `he-homol` só com credenciais de homologação);
- [x] os testes derivados (T01 a T19) estiverem aprovados, com o CI verde no PR — **T01 a T16 ✅** (38 testes automatizados no CI do PR #36, capturas em `evidencias/SPEC-001/`); T17 a T19 ✅ na homologação;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF09, RNF10, RNF11) tiverem sido verificados como descrito na seção 10 — RNF01, RNF02 (código e banco) e RNF10 ✅; RNF09 ✅ (backup restaurado na homologação); RNF11 ✅ (preview por PR e homologação pela `DEVELOP`; checklist de produção no README);
- [x] não existir divergência conhecida entre a implementação e esta Spec;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (descrição do PR #36).

**Notas da implementação (PR #36):** Prisma 7.10 (URL no `prisma.config.ts`, adaptador `pg`); no Next.js 16 um erro na instrumentação não derruba o servidor, por isso a validação do ambiente encerra o processo; o `prisma migrate reset` é bloqueado para agentes de IA, e os testes de integração usam `migrate deploy`; o backup cobre o schema `public` (as contas ficam no schema `auth` do Supabase), o que se soma ao OPEN-008.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
