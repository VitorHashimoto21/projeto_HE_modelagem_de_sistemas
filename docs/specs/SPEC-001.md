# SPEC-001 — Fundação técnica e isolamento multi-tenant

> **Status:** proposta — aguardando aprovação da equipe. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar). Nenhum código foi escrito.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Próxima:** SPEC-002 (depende desta).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-001 |
| **Nome** | Fundação técnica e isolamento multi-tenant |
| **Objetivo** | Estabelecer o projeto Next.js (App Router) + TypeScript, o Prisma conectado ao PostgreSQL (Supabase) com o schema da baseline, o mecanismo **obrigatório** de isolamento de dados por negócio, o utilitário de datas (UTC × America/Sao_Paulo), a base visual (tokens, fontes e ícones da identidade) e o pipeline de CI. |
| **Valor entregue** | Uma base única, tipada e testada sobre a qual todas as outras Specs são construídas. O vazamento de dados entre negócios fica impedido **por construção**: o código das Specs seguintes não consegue consultar dados operacionais sem um contexto de negócio. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RN** | RN01 | Mecanismo que restringe toda consulta operacional ao negócio do contexto. (A parte "colaborador só acessa negócios aos quais foi convidado" depende de `MembroNegocio` e é concluída na SPEC-005.) |
| | RN29 | Utilitário único de datas: armazenamento em UTC; dia, mês e competência em America/Sao_Paulo. |
| **RNF** | RNF01 | Aplicação web responsiva (estrutura base, tokens e layout raiz). |
| | RNF02 | Isolamento lógico multi-tenant (ver seções 6 e 8). |
| | RNF09 | Backup: diário automático do Supabase + dump semanal exportado pela equipe. |
| | RNF10 | Estrutura de pastas por módulo e camada de domínio separada da interface, permitindo novos módulos e integrações sem reestruturar o core. |
| **Caso de uso / fluxo** | — | Spec técnica; corresponde às Issues #01 e #02 do guia de issues. |
| **Entidades** | Negocio | Âncora do tenant. As demais entidades entram apenas como schema e migração inicial. |
| **Drivers** | AD-C01 | Stack Next.js + TypeScript + Prisma + PostgreSQL. |
| | AD-C02 | Multi-tenancy lógico com filtro obrigatório por `negocioId`. |
| | AD-C03 | Entrega web responsiva. |
| | AD-QA06 | Isolamento validado no servidor em toda requisição (a parte de papéis é da SPEC-005). |
| **ADRs** | ADR-001 | Next.js App Router + TypeScript; regras de negócio fora de páginas/componentes. |
| | ADR-002 | Prisma + PostgreSQL; filtro de `negocio_id` em toda consulta; connection pooling. |
| **Outros artefatos** | `docs/prisma_base/schema.prisma`, `docs/design/IDENTIDADE_VISUAL.md` (seção 9 — "Aplicação nas Specs"), `docs/design/identidade/tokens/tokens.css`, `docs/design/identidade/favicon/` | |

---

## 3. Escopo

### Incluído

1. **Projeto base:** Next.js (App Router) com TypeScript em modo estrito, ESLint, TailwindCSS v4 e shadcn/ui inicializado.
2. **Estrutura de pastas por camada e por módulo** (ver seção 8), com a regra de domínio fora de `app/` (ADR-001).
3. **Banco:** Prisma configurado para PostgreSQL no Supabase (string de conexão com pooling para a aplicação e conexão direta para migrações), o schema da baseline levado para `prisma/schema.prisma` e a **migração inicial** criando todas as tabelas.
4. **Isolamento multi-tenant:** um ponto único de acesso aos dados operacionais que exige um **contexto de negócio** (`negocioId`) e aplica o filtro em toda leitura, criação, alteração e exclusão (seções 6 e 9).
5. **Classificação dos modelos** em: com tenant direto, com tenant pelo "pai" e globais (seção 7), registrada no código e coberta por teste.
6. **Utilitário de datas (RN29):** conversão e cálculo de dia, intervalo do mês e competência no fuso America/Sao_Paulo.
7. **Base visual:**
   - `tokens.css` da identidade visual aplicado como CSS global;
   - Fraunces e Outfit carregadas com `next/font/google`;
   - favicon, ícones e `site.webmanifest` publicados;
   - metadados com nome "Health Enterprise" e `theme-color` `#163028`;
   - suporte ao tema escuro pela classe `.dark`.
8. **Verificação de saúde:** uma rota que informa se a aplicação está no ar e se o banco responde, sem expor dados.
9. **Configuração de ambiente:** `.env.example` documentado, `.env` fora do controle de versão e validação das variáveis obrigatórias na inicialização.
10. **CI (GitHub Actions):** em todo Pull Request para `DEVELOP` ou `main`, rodar instalação, lint, checagem de tipos, `prisma validate` e testes; status visível no PR.
11. **Backup (RNF09):** documentar o backup diário do Supabase e criar o procedimento (script + instrução) do dump semanal.
12. **README atualizado** com os comandos reais de instalação, uso e testes.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cadastro, login, sessão e consentimento LGPD | SPEC-002 |
| Carga dos parâmetros fiscais (seed) | SPEC-003 |
| Criação de negócio, consulta de CNPJ e troca de negócio ativo | SPEC-004 |
| Papéis, convites e matriz de permissões (parte "por perfil" do AD-QA06) | SPEC-005 |
| Telas de negócio (catálogo, estoque, vendas etc.) | SPEC-006 em diante |
| Rotinas agendadas (Vercel Cron) | SPEC-009 |
| Adicionar o professor como colaborador do repositório | Tarefa administrativa da Issue #01, não é comportamento do sistema |

---

## 4. Dependências

- **Specs anteriores:** nenhuma (Spec raiz).
- **Decisões arquiteturais:** ADR-001, ADR-002, ADR-003 (Supabase como provedor) e OPEN-04 do mapa (banco e backup no Supabase).
- **Pré-requisitos externos:**
  - projeto criado no Supabase, com as strings de conexão disponíveis para a equipe;
  - permissão de administrador no repositório GitHub para configurar a proteção de branch (exigir CI verde antes do merge).

---

## 5. Comportamento esperado

### 5.1 Acesso a dados operacionais com contexto de negócio

- **Pré-condições:** existe um `negocioId` válido no contexto da requisição. Nesta Spec o contexto é recebido como parâmetro; a SPEC-002 passará a obtê-lo da sessão autenticada.
- **Fluxo principal:**
  1. O código do servidor obtém o acesso aos dados **a partir do contexto** ("cliente do negócio").
  2. Toda leitura em modelos com tenant direto recebe automaticamente a condição `negocioId = contexto`.
  3. Toda criação recebe o `negocioId` do contexto.
  4. Toda alteração ou exclusão só afeta registros desse negócio.
  5. Modelos com tenant pelo "pai" só são acessados através do registro pai já filtrado (ex.: itens de uma venda via a venda do negócio).
- **Pós-condições:** o resultado contém somente dados do negócio do contexto.

### 5.2 Fluxos de exceção

| Situação | Comportamento |
|---|---|
| Acesso a modelo operacional **sem** contexto de negócio | A operação é recusada com erro de programação explícito ("contexto de negócio ausente"); nada é lido nem gravado. |
| Leitura, alteração ou exclusão de um registro de **outro** negócio (por id) | Tratado como **inexistente**: mesmo resultado de um id que não existe, sem revelar que o registro existe. |
| Criação informando um `negocioId` diferente do contexto | A operação é recusada. |
| Banco indisponível | A rota de saúde responde "banco indisponível" com status de erro; páginas mostram mensagem genérica, sem detalhes técnicos. |
| Variável de ambiente obrigatória ausente | A aplicação não inicia e informa qual variável falta (sem exibir valores). |

### 5.3 Datas (RN29)

- Toda data é gravada em UTC.
- "Hoje", "mês" e "competência" são calculados no fuso America/Sao_Paulo.
- **Exemplo:** o instante `2026-10-01T02:30:00Z` pertence ao **dia 30/09/2026** e à **competência 09/2026** no horário de Brasília.

### 5.4 CI

- **Gatilho:** abertura ou atualização de Pull Request para `DEVELOP` ou `main`.
- **Passos:** instalar dependências, lint, checagem de tipos, `prisma validate` e testes.
- **Resultado:** status de sucesso ou falha exibido no PR. Com a proteção de branch configurada, o merge fica bloqueado enquanto o CI falhar.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhuma operação em modelo operacional (seção 7) é executada sem contexto de negócio. | Teste: chamar sem contexto → erro; nenhuma consulta enviada ao banco. |
| **INV-002** | Toda leitura em modelo com tenant direto retorna apenas registros com `negocioId` = contexto. | Teste com dois negócios e dados em ambos: cada contexto vê só os seus. |
| **INV-003** | Registro de outro negócio é indistinguível de registro inexistente (leitura, alteração e exclusão). | Teste: id do negócio B no contexto A → "não encontrado"; o registro de B continua intacto. |
| **INV-004** | Toda criação em modelo com tenant direto grava o `negocioId` do contexto; um valor diferente é recusado. | Teste de criação com e sem `negocioId` divergente. |
| **INV-005** | Modelos com tenant pelo "pai" não têm acesso direto pelo cliente do negócio; só são alcançados pela relação com o pai filtrado. | Teste: tentativa de acesso direto → recusada; acesso via pai → só dados do negócio. |
| **INV-006** | Todo modelo do schema está classificado (tenant direto, pelo pai ou global); um modelo novo sem classificação faz o teste falhar. | Teste que compara a lista de modelos do Prisma com a classificação. |
| **INV-007** | Datas gravadas em UTC; dia, mês e competência calculados em America/Sao_Paulo. | Testes de fronteira (meia-noite UTC × Brasília; virada de mês). |
| **INV-008** | Nenhum segredo no repositório: `.env` ignorado pelo Git, apenas `.env.example` sem valores reais. | Checagem no CI. |
| **INV-009** | Os tokens de cor da aplicação são os da identidade visual, sem alteração; qualquer mudança passa por `validar_contraste.py`. | Comparação do CSS global com `docs/design/identidade/tokens/tokens.css` no CI. |
| **INV-010** | O schema em `prisma/schema.prisma` é válido e a migração inicial o reproduz por completo. | `prisma validate` e `prisma migrate diff` sem diferenças no CI. |

---

## 7. Modelo de domínio envolvido

Esta Spec **não altera** o modelo; ela leva o schema da baseline para o projeto e classifica os modelos para o isolamento:

| Classe | Modelos | Regra |
|---|---|---|
| **Tenant direto** (têm `negocioId`) | `Item`, `Cliente`, `Venda`, `LancamentoFinanceiro`, `ContaPagarReceber`, `DespesaFixa`, `MembroNegocio` | Filtro automático por `negocioId` do contexto. |
| **Tenant pelo pai** (sem `negocioId`) | `MaterialServico`, `MovimentacaoEstoque`, `HistoricoPreco` (pai: `Item`); `ItemVenda`, `Pagamento` (pai: `Venda`); `Parcela` (pai: `Pagamento`) | Acesso apenas pela relação com o pai filtrado. **Ver OPEN-001.** |
| **Âncora do tenant** | `Negocio` | Acessado pelo próprio id do contexto. |
| **Globais** (sem tenant) | `Usuario`, `FaixaTributaria`, `CnaeAnexo`, `ParametroMei`, `MargemPadraoCategoria` | Fora do filtro de negócio. Os parâmetros fiscais são somente leitura para a aplicação (carga pela SPEC-003). |

Restrições já presentes no schema e mantidas: chaves estrangeiras para `Negocio`, índices por `negocioId` e `(negocioId, data, status)` em `Venda` (AD-QA01), e unicidade `(despesaFixaId, competencia)`.

---

## 8. Impacto arquitetural

- **Módulos e fronteiras (ADR-001):**

  | Camada | Conteúdo | Pode importar |
  |---|---|---|
  | `app/` | Rotas, páginas, layouts e Server Actions | camada de dados e domínio |
  | camada de dados | Cliente Prisma, cliente do negócio (isolamento) e classificação dos modelos | — |
  | camada de domínio | Regras puras (datas; depois o motor de precificação do ADR-005) | **nada** de framework nem de banco |
  | `components/` | Componentes de interface (shadcn/ui) | — |

  Regra de importação: páginas e componentes **não** importam o cliente Prisma bruto, só o cliente do negócio. Essa regra deve ser verificada por lint.
- **Backend × frontend:**
  - Toda consulta acontece no servidor (Server Components, Server Actions, Route Handlers).
  - O navegador nunca recebe o cliente de banco nem a string de conexão.
- **Integrações:**
  - Supabase (PostgreSQL): conexão com pooling para a aplicação e conexão direta para migrações, conforme as consequências do ADR-002.
  - GitHub Actions (CI).
- **ADRs que restringem:**
  - ADR-001: regra de negócio fora de páginas e componentes.
  - ADR-002: filtro de `negocio_id` em toda consulta, mais o pooling.
  - ADR-003: o isolamento é validado no servidor; o contexto virá da sessão na SPEC-002.
- **Identidade visual:** tokens, fontes, favicon e metadados aplicados conforme `IDENTIDADE_VISUAL.md` §9.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Cliente do negócio** | contexto `{ negocioId, usuarioId? }` | acesso aos modelos operacionais já restrito ao negócio | `ContextoDeNegocioAusente`; `NegocioDivergente` (criação com outro `negocioId`); "não encontrado" para registro de outro negócio |
| **Utilitário de datas** | instante (UTC) ou data local | início e fim do dia local (em UTC); intervalo do mês local; competência (`AAAA-MM`) | data inválida |
| **Verificação de saúde** | — | `{ aplicacao: "ok", banco: "ok" \| "indisponivel" }` | status de erro quando o banco não responde; sem detalhes internos |
| **Configuração** | variáveis de ambiente | configuração validada | aplicação não inicia e informa a variável ausente |

Os nomes exatos de funções, arquivos e a rota de saúde são decididos na implementação, respeitando estes contratos. **Ver OPEN-002.**

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Layout raiz responsivo, tokens e fontes; `viewport` correto. | Página inicial de verificação renderiza sem rolagem horizontal em 390px e em 1440px, nos temas claro e escuro. |
| **RNF02** | Cliente do negócio e classificação dos modelos. | INV-001 a INV-006 cobertos por testes de integração com banco real (PostgreSQL de teste). |
| **RNF09** | Backup diário do Supabase e dump semanal. | Checklist: backup diário confirmado no painel do Supabase (ver OPEN-003) e script de dump executado uma vez com sucesso, com o resultado registrado no README. |
| **RNF10** | Pastas por camada e por módulo; domínio isolado. | Regra de lint de importação; revisão da estrutura no PR. |

---

## 11. Critérios de aceitação

**CA-01 — Projeto executa.**
Dado o repositório recém-clonado e um `.env` preenchido a partir do `.env.example`,
quando a equipe executa a instalação, a migração e o comando de desenvolvimento,
então a aplicação abre no navegador com o nome "Health Enterprise", o favicon da marca e as fontes Fraunces e Outfit.

**CA-02 — Migração inicial.**
Dado um banco PostgreSQL vazio,
quando a migração inicial é aplicada,
então todas as tabelas, relações, índices e restrições do schema da baseline existem e `prisma validate` passa.

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

**CA-07 — Tenant pelo pai.**
Dada uma venda do negócio B com itens e pagamentos,
quando o código, no contexto do negócio A, tenta ler esses itens ou pagamentos,
então nada é retornado.

**CA-08 — Classificação completa.**
Dado um novo modelo adicionado ao schema sem classificação,
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
Dado o projeto no Supabase,
quando a equipe executa o procedimento de dump semanal,
então obtém um arquivo de backup restaurável, e o README descreve onde fica o backup diário e como fazer o semanal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Lista de itens com contexto A × B (dados nos dois) | Integração (banco de teste) | CA-03, INV-002 |
| T02 | Buscar, alterar e excluir item de B no contexto A | Integração | CA-04, INV-003 |
| T03 | Acesso sem contexto em cada modelo operacional | Unitário/integração | CA-05, INV-001 |
| T04 | Criação sem `negocioId` e com `negocioId` divergente | Integração | CA-06, INV-004 |
| T05 | Itens e pagamentos de venda de B no contexto A | Integração | CA-07, INV-005 |
| T06 | Todos os modelos do Prisma estão classificados | Unitário | CA-08, INV-006 |
| T07 | Fronteiras de dia e mês: 02:30Z, 03:00Z, virada de mês e de ano | Unitário | CA-09, INV-007 |
| T08 | Rota de saúde com banco disponível e indisponível | Integração | CA-10 |
| T09 | Inicialização com variável ausente | Unitário | CA-11 |
| T10 | `.env` ignorado e `.env.example` sem segredos | CI | INV-008 |
| T11 | CSS global igual aos tokens da identidade | CI | INV-009, CA-13 |
| T12 | `prisma validate` e diff da migração inicial sem diferenças | CI | CA-02, INV-010 |
| T13 | Regra de lint: páginas e componentes não importam o Prisma bruto | Lint | RNF10, ADR-001 |
| T14 | PR de teste com falha proposital fica vermelho | Manual (uma vez) | CA-12 |
| T15 | Página de verificação em 390/1440px, claro e escuro | Manual com captura | CA-01, CA-13 |

Os testes de integração usam um PostgreSQL próprio para testes (no CI, um serviço PostgreSQL do GitHub Actions), nunca o banco do Supabase.

---

## 13. Questões em aberto

- **OPEN-001 — `negocioId` nas tabelas filhas (divergência na baseline).**
  - **O conflito:** o driver AD-C02 diz que *todas* as tabelas operacionais devem ter `negocioId`, mas o schema não o tem em `MaterialServico`, `MovimentacaoEstoque`, `HistoricoPreco`, `ItemVenda`, `Pagamento` e `Parcela`.
  - **Opção (a) — adicionar `negocioId` a essas 6 tabelas:** aumenta a defesa e simplifica as consultas, mas exige garantir que o valor sempre seja igual ao do pai.
  - **Opção (b) — manter como está:** isolamento pelo pai (como nesta Spec), corrigindo o texto do AD-C02.
  - **Decisão:** cabe à equipe; esta Spec funciona com as duas opções, mas a classificação da seção 7 muda.
- **OPEN-002 — Mecanismo do "cliente do negócio".** Opções: extensão do Prisma Client que injeta o filtro automaticamente, ou funções de repositório por módulo. A baseline exige o filtro, mas não o mecanismo. Recomendação a validar: extensão do Prisma Client, que cobre todas as consultas sem depender da disciplina de cada desenvolvedor.
- **OPEN-003 — Plano do Supabase e backup diário.** Confirmar se o plano usado pelo projeto inclui o backup diário automático exigido pelo RNF09. Se não incluir, o dump passa a ser diário via GitHub Actions ou o plano é revisto.
- **OPEN-004 — Estrutura de pastas.** A Issue #01 usa `src/app`, `src/components`, `src/lib` e `src/hooks`, mas o README da `main` mostra `app/`, `components/`, `lib/` e `test/` na raiz. É preciso escolher uma das duas e atualizar o documento perdedor.
- **OPEN-005 — Fonte da verdade do schema.** Depois desta Spec, o schema passa a viver em `prisma/schema.prisma`. Decidir se `docs/prisma_base/schema.prisma` é removido (com um aviso apontando o novo local) ou mantido sincronizado por uma verificação no CI.
- **OPEN-006 — Ferramenta de testes.** A Issue #02 deixa em aberto Vitest ou Jest. Recomendação a validar: Vitest, mais simples com TypeScript e ESM.
- **OPEN-007 — Primeiro deploy.** Nenhuma Spec define quando a aplicação é publicada na Vercel, que a SPEC-009 vai precisar para as rotinas agendadas. Decidir se o deploy de pré-visualização entra nesta Spec.

---

## 14. Definition of Done da Spec

A SPEC-001 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-14) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-010) estiverem preservados;
- [ ] os testes derivados (T01 a T15) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF09, RNF10) tiverem sido verificados como descrito na seção 10;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline (incluindo OPEN-001, OPEN-004 e OPEN-005) tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
