### ADRs — Registros de Decisões Arquiteturais — HealthEnterprise (HE)

Este documento reúne o conjunto inicial de **ADRs (Architecture Decision Records) do projeto HealthEnterprise (HE)**, elaborados em estrita conformidade com as diretrizes metodológicas da disciplina. Uma **ADR** documenta uma decisão técnica estrutural e de difícil reversibilidade tomada durante o projeto.

## Quando escrever um ADR?

* **Decisão Técnica (DT):** É a escolha de implementação ou estrutura adotada para responder aos *drivers* e restrições do projeto.
* **ADR:** É o registro documental da Decisão Técnica, detalhando **o que** foi escolhido, **por que** foi escolhido, **quais alternativas** foram consideradas e **quais consequências** a escolha traz.
* **Critério de Reversibilidade:** Escreve-se um ADR quando uma decisão técnica exige o registro de uma ADR apenas quando sua alteração posterior for cara ou implicar na reescrita substancial da estrutura da aplicação, das APIs, do modelo de dados persistido ou da estratégia de segurança. Escolhas locais e baratas de substituir (como bibliotecas secundárias de UI) não possuem ADR.

\---

#### Resumo das Decisões Aceitas

|ID|Decisão|Impacto de Reversão / Por que é cara|Status|
|-|-|-|-|
|**ADR-001**|Framework Fullstack Next.js (App Router) + TypeScript|Reescrever a apresentação e as rotas da aplicação em caso de troca de framework.|**Aceita**|
|**ADR-002**|Camada de Persistência com Prisma ORM e PostgreSQL Multi-tenant|Reestruturar todos os schemas de dados, migrations e queries de isolamento.|**Aceita**|
|**ADR-003**|Autenticação via Supabase Auth com Autorização no Backend|Alterar o mecanismo de gerenciamento de sessões e migrar credenciais registradas.|**Aceita**|
|**ADR-004**|Parametrização Tributária em Banco de Dados e Motor de RBT12|Reescrever a lógica de cálculo de impostos e a integração do módulo financeiro.|**Aceita**|

\---

#### O que Deliberadamente Não Tem ADR

|Tema|Motivo para Não Ter ADR|
|-|-|
|**TailwindCSS / shadcn/ui**|Escolha de estilização visual; pode ser substituída sem alterar os contratos da API ou a lógica de domínio do ERP.|
|**Provedor de Hospedagem (Vercel / Supabase / Neon)**|A conexão com o banco ocorre via string de conexão padrão do PostgreSQL tratada pelo Prisma, permitindo migração de infraestrutura sem reescrever código.|
|**Biblioteca de Gráficos do Dashboard**|Componente visual que pode ser trocado na camada de apresentação sem impacto nos dados financeiros.|

\---

#### ADR-001 — Adção do Framework Fullstack Next.js (App Router) com TypeScript

##### Decisão

A aplicação web ERP + Calculadora utilizará o framework **Next.js (App Router)** com **TypeScript**. O desenvolvimento unificará a interface gráfica e os endpoints de API (Server Actions e Route Handlers) no mesmo repositório.

##### Contexto e Problema

O sistema HealthEnterprise (HE) necessita de uma arquitetura web reativa, responsiva e de alta performance para atender microempreendedores e autônomos. A equipe é composta por 3 desenvolvedores com prazos definidos para a entrega do MVP. O projeto exige desenvolvimento incremental em fatias verticais, sendo necessário manter rápida integração entre o frontend e a lógica de negócios sem a complexidade de manter dois repositórios totalmente separados com contratos REST avulsos.

##### Por que foi tomada

1. **Produtividade do time pequeno:** Permite utilizar TypeScript do banco até a interface, gerando tipos automáticos com o Prisma ORM e evitando desacertos de contrato de dados.
2. **Desempenho e SSR (RNF01):** O Next.js App Router otimiza a renderização de componentes no servidor (Server Components), garantindo carregamento rápido em dispositivos móveis e desktop.
3. **Simplicidade do MVP:** Centraliza o deploy em uma infraestrutura unificada.

##### Alternativas Consideradas

* **Django Fullstack (Templates):** Mencionado no planejamento inicial, mas descartado a favor do ecossistema TypeScript/React para alinhar a equipe de desenvolvimento e obter maior reatividade nos formulários da Calculadora e Vendas.
* **SPA React (Vite) + Backend Isolado (Node/Express):** Rejeitado por exigir a configuração manual de duas estruturas independentes, aumentando o overhead de integração do time de 3 pessoas.

##### Consequências

* **Positivas:** Redução de código redundante de integração; tipagem de ponta a ponta; reatividade para simulações da calculadora sem recarregar a tela; Server Actions eliminam a necessidade de escrever rotas REST genéricas para operações simples de formulário; Suporte nativo a deploy contínuo em plataformas serverless (Vercel) com tempo de resposta reduzido.
* **Negativas:** Forte acoplamento ao ecossistema Next.js; necessidade de manter rigor arquitetural para não misturar regras de negócio complexas dentro dos arquivos de página/componente.

**Drivers Relacionados:** AD-C01, AD-QA04, RNF01, RNF07.

\---

#### ADR-002 — Camada de Persistência com Prisma ORM e Banco PostgreSQL Multi-tenant Lógico

##### Decisão

A persistência de dados utilizará um banco de dados relacional **PostgreSQL**, acessado através do **Prisma ORM**. O isolamento entre diferentes empresas (*multi-tenancy*) será feito de forma lógica, incluindo a coluna `negocio\\\_id` em todas as tabelas operacionais do sistema.

##### Contexto e Problema

O ERP lida com dados financeiros, registros de vendas e movimentações de estoque que exigem consistência transacional e integridade relacional. O sistema deve impedir vazamento de dados entre empresas (RN01, RNF02).

##### Por que foi tomada

1. **Garantia de Integridade e Transações:** O PostgreSQL oferece suporte a transações complexas (`ACID`), essenciais para garantir que uma venda só seja gravada se a baixa no estoque e o lançamento financeiro ocorrerem com sucesso (RN12).
2. **Isolamento por Negócio (RN01):** O uso da chave `negocio\\\_id` tratada na camada de aplicação via filtros do ORM é a abordagem mais simples e eficiente para o público-alvo de microempreendedores.
3. **Modelagem de Domínio Tipada:** O Prisma traduz o modelo de domínio para o banco de dados e gera tipos TypeScript atualizados a cada migration.

##### Alternativas Consideradas

* **Bancos NoSQL (MongoDB):** Rejeitados por não oferecerem o suporte relacional nativo exigido para o fluxo de caixa, estoque e agrupamento de parcelas.
* **PostgreSQL com Schemas Separados por Tenant:** Rejeitado para o MVP devido à complexidade de gerenciar centenas de migrations individuais a cada novo microempreendedor cadastrado.

##### Consequências

* **Positivas:** Schema fortemente tipado; suporte seguro a migrations; garantia transacional em vendas e parcelamentos, com integridade referencial estrita por chaves estrangeiras entre `Negocio`, `Venda`, `ItemVenda`, `MovimentacaoEstoque` e `LancamentoFinanceiro`.
* **Negativas:** Todas as consultas no backend devem ter a garantia de conter o filtro do `negocio\\\_id` para evitar acesso indevido; necessidade de configurar Connection Pooling (pgBouncer) para evitar estourar o limite de conexões simultâneas do PostgreSQL durante picos de requisições serverless.

**Drivers Relacionados:** AD-C02, AD-RF03, RN01, RNF02, RNF09.

\---

#### ADR-003 — Autenticação e Autorização Centralizada no Backend

##### Decisão

A autenticação será gerenciada via serviço de identidade (**Supabase Auth** ou solução similar de sessão segura), e a autorização baseada em papéis -  (RBAC - Role-Based Access Control) - (Dono, Gerente, Colaborador) e permissões customizadas será validada exclusivamente no servidor em cada requisição de API ou Server Action, utilizando uma tabela intermediária `MembroNegocio`. Toda e qualquer consulta ao banco de dados deverá obrigatoriamente incluir a cláusula de filtro `where: { negocioId }` validada pelo middleware de sessão.

##### Contexto e Problema

O sistema precisa proteger operações estratégicas (como alterar preços, visualizar relatórios financeiros ou convidar usuários) para que colaboradores com perfil restrito não executem ações não autorizadas (RF05, RF06, RN02).

##### Por que foi tomada

1. **Segurança de Borda (RNF03, RNF05):** Omitir botões na interface reativa (React) não garante segurança; a requisição HTTP pode ser forjada se não houver verificação no servidor.
2. **Sessão Única Multi-empresa (RF03, RNF07):** O usuário deve poder alternar de empresa sem precisar logar novamente, bastando alterar o token/contexto de negócio ativo no servidor.
3. **Conformidade LGPD (RNF04):** Garante hashing de senhas e invalidação de acessos não autorizados.

##### Alternativas Consideradas

* **Validação de Permissão Apenas na Interface (Frontend):** Rejeitada por violar os requisitos de segurança e permitir contorno das regras de acesso.
* **NextAuth.js (Auth.js) customizado do zero:** Descartado pela necessidade de implementar e manter manualmente tabelas de gerenciamento de tokens, fluxos de recuperação de senha e hash de credenciais

##### Consequências

* **Positivas:** Impossibilidade de burlar permissões pela interface; gerenciamento centralizado dos papéis; criptografia e segurança de credenciais gerenciadas por uma infraestrutura auditada, reduzindo riscos de vazamento; isolamento estrito de dados entre empresas, impedindo vazamento de informações confidenciais para colaboradores não autorizados.
* **Negativas:** Necessidade de injetar a verificação do perfil do usuário em todas as rotas operacionais do backend; acoplamento ao SDK do Supabase Auth para a gestão de tokens de sessão no Next.js.

**Drivers Relacionados:** AD-RF02, AD-QA02, RF05, RF06, RN02, RNF03, RNF05.

\---

#### ADR-004 — Parametrização Tributária e Agregação Dinâmica do RBT12

##### Decisão

As faixas tributárias do MEI e do Simples Nacional serão armazenadas em tabela de parâmetros no banco de dados (`TabelaAliquota`), e o faturamento bruto dos últimos 12 meses (RBT12) será calculado via consultas agregadas temporais na tabela de vendas.

##### Contexto e Problema

A legislação tributária brasileira passa por alterações frequentes nas faixas e alíquotas do Simples Nacional. O sistema não pode depender de alterações de código-fonte para atualizar tributos (RN17, RNF08) e deve calcular a taxa embutida no preço automaticamente a partir do histórico de vendas do cliente (RF38, RF39).

##### Por que foi tomada

1. **Facilidade de Manutenção Legais (RN17, RNF08):** Permite atualizar alíquotas no banco de dados sem necessidade de novo deploy da aplicação.
2. **Eliminação de Erros do Usuário:** Automatiza a busca da receita bruta passada para definir a alíquota exata, entregando a proposta de valor central do produto (precificação simples e correta).

##### Alternativas Consideradas

* **Alíquotas e Faixas Gravadas Diretamente em Código (Hardcoded):** Rejeitadas por violar explicitamente o RNF08 e exigir publicação de novas versões a cada mudança de lei.

##### Consequências

* **Positivas:** Sistema flexível a mudanças fiscais; precificação precisa e automática baseada no histórico real do empreendedor´.
* **Negativas:** Exige a criação de rotinas de agregação performáticas para que o cálculo do RBT12 responda dentro do SLA do sistema (< 2 segundos).

**Drivers Relacionados:** AD-RF04, AD-QA01, RF38, RF39, RN17, RNF06, RNF08.

