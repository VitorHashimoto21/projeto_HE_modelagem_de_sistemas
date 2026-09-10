# 📑 Registros de Decisão Arquitetural (ADRs) — HealthEnterprise (HE)

Este documento reúne o conjunto inicial de **ADRs (Architecture Decision Records)** do projeto **HealthEnterprise (HE)**, elaborados em estrita conformidade com as diretrizes da **Semana 5** e os critérios de avaliação do **Projeto Final** de Modelagem e Desenvolvimento de Software.

---

## 🎯 O que é um ADR e Quando Escrever?
Conforme estabelecido nos slides da Semana 5:
* **Decisão Técnica (DT):** É a escolha de implementação ou estrutura adotada para responder aos *drivers* e restrições do projeto [cite: 102].
* **ADR:** É o registro documental da Decisão Técnica, detalhando **o que** foi escolhido, **por que** foi escolhido, **quais alternativas** foram consideradas e **quais consequências** a escolha traz [cite: 105].
* **Critério de Reversibilidade:** Escreve-se um ADR quando a decisão é cara/difícil de desfazer (ex: mudei o banco de dados ou a arquitetura e preciso reescrever camadas ou migrar dados) [cite: 106]. Decisões baratas de reverter não exigem ADR [cite: 106].

---

## 📌 Sumário dos ADRs Criados
* **ADR-01:** Adoção do Next.js (App Router) com TypeScript como Framework Principal
* **ADR-02:** Persistência Relacional com PostgreSQL (Supabase/Neon) e Prisma ORM
* **ADR-03:** Autenticação e Isolamento Multi-tenant via Supabase Auth e RBAC
* **ADR-04:** Arquitetura Determinística da Calculadora de Precificação (Markup Matemático)

---

### 📄 ADR-01: Adoção do Next.js (App Router) com TypeScript como Framework Principal

* **Status:** Aceito
* **Data:** 2026-09-10
* **Autores:** Equipe HealthEnterprise (Vitor Hashimoto, Rafael Katahira, Rafael Di Santi)

#### 1. Contexto e Problema
O sistema **HealthEnterprise (HE)** necessita de uma arquitetura web reativa, responsiva e de alta performance para atender microempreendedores e autônomos [cite: 138, 142]. O projeto exige desenvolvimento incremental em fatias verticais, com facilidade de integração entre a camada de apresentação (dashboards e formulários) e a camada de serviços (regras de negócio de estoque, vendas e precificação) [cite: 114, 123].

#### 2. Decisão
Adotar o **Next.js (com App Router)** na linguagem **TypeScript** como framework full-stack principal [cite: 4, 13, 23]. A aplicação utilizará *React Server Components* e *Server Actions* para comunicação direta e segura com o banco de dados.

#### 3. Alternativas Consideradas
* **Django (Python) Monolítico:** Considerado inicialmente pelo grupo, mas descartado devido à maior verbosidade na criação de interfaces dinâmicas e dashboards interativos sem a necessidade de um framework frontend adicional [cite: 146, 147].
* **React SPA (Vite) + API REST em Node.js/Express:** Descartado para evitar a duplicação de contratos de API e aumentar a complexidade de manutenção de dois repositórios/projetos separados.

#### 4. Consequências e Impactos
* **Positivas:**
  * Desenvolvimento tipo-seguro (*Type-Safety*) de ponta a ponta entre o banco de dados e a interface.
  * *Server Actions* eliminam a necessidade de escrever rotas REST genéricas para operações simples de formulário [cite: 4].
  * Suporte nativo a deploy contínuo em plataformas serverless (Vercel) com tempo de resposta reduzido [cite: 15, 35].
* **Negativas / Limitações:**
  * Necessidade de gerenciar cuidadosamente o tempo de execução e o estado das funções serverless para evitar encerramento prematuro em operações longas.
  * Curva de aprendizado da equipe no modelo mental do App Router e *Server Components* do Next.js.

---

### 📄 ADR-02: Persistência Relacional com PostgreSQL (Supabase/Neon) e Prisma ORM

* **Status:** Aceito
* **Data:** 2026-09-10
* **Autores:** Equipe HealthEnterprise

#### 1. Contexto e Problema
O **HE** lida com transações financeiras críticas que exigem garantia de consistência ACID (Atomacidade, Consistência, Isolamento e Durabilidade) [cite: 115, 125]. Operações como o registro de uma venda exigem a atualização simultânea de saldo de estoque, criação de lançamento no fluxo de caixa e geração de parcelas a receber [cite: 139, 143].

#### 2. Decisão
Adotar o banco de dados relacional **PostgreSQL** hospedado em ambiente gerenciado (Supabase/Neon), utilizando o **Prisma ORM** como camada de abstração de dados e migrações [cite: 15, 125].

#### 3. Alternativas Consideradas
* **MongoDB (NoSQL):** Descartado pois a ausência de um esquema relacional estrito facilitaria a introdução de dados inconsistentes em vendas e lançamentos parciais [cite: 139].
* **SQLite:** Descartado para produção por ser um banco de dados baseado em arquivo local, incompatível com deploys serverless multi-região.

#### 4. Consequências e Impactos
* **Positivas:**
  * Garantia de integridade referencial estrita por chaves estrangeiras entre `Negocio`, `Venda`, `ItemVenda`, `MovimentacaoEstoque` e `LancamentoFinanceiro` [cite: 136, 137].
  * O Prisma gera tipos TypeScript automaticamente a partir do arquivo `schema.prisma`, prevenindo erros de tipagem em tempo de compilação [cite: 15, 125].
  * Histórico de migrações rastreável e versionado no Git via `prisma migrate` [cite: 19, 22].
* **Negativas / Limitações:**
  * Necessidade de configurar *Connection Pooling* (pgBouncer) para evitar estourar o limite de conexões simultâneas do PostgreSQL durante picos de requisições serverless.

---

### 📄 ADR-03: Autenticação e Isolamento Multi-tenant via Supabase Auth e RBAC

* **Status:** Aceito
* **Data:** 2026-09-10
* **Autores:** Equipe HealthEnterprise

#### 1. Contexto e Problema
O sistema atende múltiplos negócios de forma compartilhada [cite: 138, 142]. Conforme os Requisitos `RF02`, `RF05`, `RN01` e `RN02`, um usuário pode ter acesso a várias empresas e cada empresa possui diferentes papéis de acesso (Dono, Gerente, Colaborador) com restrições severas de visualização de dados financeiros [cite: 138, 142].

#### 2. Decisão
Utilizar o **Supabase Auth** para a gestão de autenticação de usuários (e-mail/senha e tokens de sessão), associado a um modelo de autorização baseado em papéis (**RBAC - Role-Based Access Control**) com a tabela intermediária `MembroNegocio` [cite: 138, 142]. Toda e qualquer consulta ao banco de dados deverá obrigatoriamente incluir a cláusula de filtro `where: { negocioId }` validada pelo middleware de sessão [cite: 138, 142].

#### 3. Alternativas Consideradas
* **NextAuth.js (Auth.js) customizado do zero:** Descartado pela necessidade de implementar e manter manualmente tabelas de gerenciamento de tokens, fluxos de recuperação de senha e hash de credenciais [cite: 150].
* **Autenticação por Sessão Manual no Django:** Descartado em razão da mudança de stack para Next.js.

#### 4. Consequências e Impactos
* **Positivas:**
  * Criptografia e segurança de credenciais gerenciadas por uma infraestrutura auditada, reduzindo riscos de vazamento (atendendo às diretrizes de SSDLC) [cite: 46, 122].
  * Isolamento estrito de dados entre empresas, impedindo vazamento de informações confidenciais para colaboradores não autorizados [cite: 138, 142].
* **Negativas / Limitações:**
  * Acoplamento ao SDK do Supabase Auth para a gestão de tokens de sessão no Next.js.

---

### 📄 ADR-04: Lógica Determinística da Calculadora de Precificação (Markup Matemático)

* **Status:** Aceito
* **Data:** 2026-09-10
* **Autores:** Equipe HealthEnterprise

#### 1. Contexto e Problema
O módulo **Calculadora de Precificação** é a funcionalidade central do HE [cite: 11, 17]. O sistema precisa sugerir o preço de venda ideal com base em custos fixos, custos variáveis de insumos, margem de lucro e tributação (MEI/Simples Nacional) [cite: 152].

#### 2. Decisão
Implementar o motor de cálculo da calculadora através de funções matemáticas determinísticas puras escritas em **TypeScript isolado na camada de domínio**, utilizando a fórmula do Markup `Preço = Custo ÷ (1 - Margem% - Imposto%)` [cite: 104, 152]. Nenhuma decisão ou cálculo numérico de preços será terceirizado para chamadas de IA ou modelos de linguagem (LLM) [cite: 129, 130].

#### 3. Alternativas Consideradas
* **Uso de LLM/IA para cálculo de preços:** Avaliado e rejeitado [cite: 129, 130]. Conforme as regras da disciplina (Seção 6.5 da especificação), sistemas financeiros não devem depender de LLMs para cálculos numéricos devido ao risco indesejado de não-determinismo e "alucinações" [cite: 129, 130].

#### 4. Consequências e Impactos
* **Positivas:**
  * 100% de previsibilidade matemática, precisão auditável e zero risco de respostas inconsistentes [cite: 104, 130].
  * Permite a criação de uma suíte de testes unitários extremamente veloz e independente de banco de dados ou APIs externas [cite: 104].
* **Negativas / Limitações:**
  * Exige atualização manual das tabelas e faixas tributárias do Simples Nacional (RBT12) no código sempre que a legislação fiscal sofrer alterações [cite: 152].

---

## 🛠️ Como Incluir no Repositório GitHub
1. Crie a pasta `docs/adr/` no repositório [cite: 23].
2. Salve cada ADR em seu arquivo individual:
   * `docs/adr/ADR-01-nextjs-typescript.md`
   * `docs/adr/ADR-02-postgresql-prisma.md`
   * `docs/adr/ADR-03-supabase-auth-rbac.md`
   * `docs/adr/ADR-04-calculadora-markup-deterministico.md`
3. Vincule a entrega de cada ADR ao Pull Request correspondente da sprint, garantindo a rastreabilidade exigida na disciplina [cite: 39, 40].
