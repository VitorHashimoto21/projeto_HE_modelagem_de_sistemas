# Guia de Issues para o GitHub (Versão Atualizada com Requisitos Oficiais) — HE (HealthEnterprise)

Este documento apresenta o mapeamento exato e completo dos requisitos oficiais do repositório (`requisitos.md` e `requisitos_ears.md`) para o formato de **Issues do GitHub**. 

Para atender ao rigor acadêmico e técnico da disciplina, as issues estão divididas em **Issues de Funcionalidade (User Stories - Tipo Feature)** e **Issues Técnicas/Arquiteturais (Tipo Technical/Task)**. Todas as features contam com seus respectivos critérios de aceitação escritos em **Notação EARS**.

---

## 🛠️ Bloco 1: Setup Técnico e Arquitetural (Início do Projeto)

### Issue #01 [Technical]: Setup Inicial do Projeto Next.js, Prisma ORM e Banco Relacional
*   **Título:** `[SETUP] Setup do Projeto Next.js (App Router), Prisma e Banco de Dados (Supabase)`
*   **Tipo/Label:** `technical`, `enhancement`
*   **Responsável sugerido:** Integrante responsável por DevOps/Infraestrutura.
*   **Descrição:**
    ```text
    Realizar o setup inicial da aplicação utilizando Next.js com App Router e TypeScript. Configurar o Prisma ORM para comunicação com o banco de dados PostgreSQL.

    Tarefas:
    - [ ] Inicializar projeto Next.js (npx create-next-app@latest) com TS, Tailwind e ESLint.
    - [ ] Configurar Prisma ORM e conectar ao banco de dados (Supabase) via variáveis de ambiente.
    - [ ] Estruturar as pastas do repositório:
      ├── src/
      │   ├── app/ (Routes/Pages/Server Actions)
      │   ├── components/ (shadcn/ui e componentes reutilizáveis)
      │   ├── lib/ (Configurações Prisma/Supabase)
      │   └── hooks/ (Custom hooks para o front)
      ├── prisma/ (Schema e Migrations)
      └── docs/ (Documentação e ADRs)
    - [ ] Criar o schema.prisma inicial com as entidades de Usuário e Negócio (Multi-tenant).
    - [ ] Garantir que o professor (niltonmack@mackenzie.br) esteja como colaborador.
    - [ ] Subir o primeiro PR funcional com o setup inicial para a branch main.
    ```
*   **Critérios de Aceitação (EARS Notation) [RNF02, RNF03, RNF09]:**
    *   **Ubíquo:** *THE SYSTEM SHALL*  isolar logicamente todos os dados de negócio a nível de banco de dados, utilizando filtros de ID de Negócio em todas as queries do Prisma.
    *   **Ubíquo:** *THE SYSTEM SHALL* salvar as senhas dos usuários utilizando criptografia via Supabase Auth ou biblioteca de hash segura (Argon2/Bcrypt).

---

### Issue #02 [Technical]: Pipeline de CI e Validação de Schema Prisma
*   **Título:** `Configurar GitHub Actions para Linting e Validação do Prisma Schema`
*   **Tipo/Label:** `technical`, `CI`
*   **Descrição:**
    ```text
    Configurar workflow automatizado que valide a integridade do código e do banco a cada Pull Request.

    Tarefas:
    - [ ] Criar arquivo `.github/workflows/ci.yml`.
    - [ ] Configurar execução de `npm install`, `npm run lint` e `npx prisma validate`.
    - [ ] Implementar um teste unitário simples (ex: Vitest ou Jest) para validar o setup de CI.
    - [ ] Bloquear merges caso o pipeline falhe ou o schema Prisma esteja inconsistente.
    ```
*   **Critérios de Aceitação:**
    *   **Orientado a Evento:** *WHEN* um novo Pull Request for aberto para as branches `main` ou `develop`, *THE SYSTEM SHALL* disparar automaticamente o pipeline de CI do GitHub Actions e exibir o status de sucesso/falha na tela do PR.

---

### Issue #03 [Technical]: Registro de Decisões Arquiteturais (ADRs Oficiais)
*   **Título:** `[DOCS] Registrar Decisões Arquiteturais Iniciais do Projeto via ADRs`
*   **Tipo/Label:** `documentation`
*   **Descrição:**
    ```text
    Escrever e versionar em `/docs/adr/` as primeiras decisões técnicas estruturais do projeto HealthEnterprise. De acordo com as especificações da disciplina, cada ADR deve conter obrigatoriamente as seções de Contexto, Decisão e Consequências.

    ADRs a serem criados:
    1. ADR-01: Escolha do Framework Django e do Stack de Banco de Dados.
    2. ADR-02: Abordagem de arquitetura Multi-tenant para isolamento das empresas (RN01).
    3. ADR-03: Estratégia de segurança, hashing de senhas e conformidade de privacidade (LGPD).
    ```
*   **Critérios de Aceitação:**
    *   **Ubíquo:** *THE SYSTEM SHALL* disponibilizar a documentação de arquitetura na pasta `/docs` em formato Markdown perfeitamente versionado.

---

## 📦 Bloco 2: Módulos e Funcionalidades Core (User Stories)

### Issue #04 [Feature]: Autenticação, Multiempresa e Middleware de Acesso
*   **Título:** `[US01] Autenticação via Supabase Auth, Seleção de Negócio e Middleware de Proteção`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF01, RF02, RF03, RF04, RF05, RF06, RN01, RN02, RNF07
*   **Descrição:**
    ```text
    Como empreendedor ou colaborador do HE,
    Eu quero me cadastrar, criar ou alternar entre meus negócios, e convidar minha equipe com permissões controladas,
    Para gerenciar com segurança o acesso aos dados operacionais e financeiros.

    Tarefas:
    - [ ] Configurar Supabase Auth (ou Auth.js) para login social e e-mail/senha.
    - [ ] Implementar Middleware do Next.js para proteger rotas e garantir o isolamento por Negócio (RN01.
    - [ ] Desenvolver o seletor de Negócio no Header da aplicação (RF03).
    - [ ] Implementar lógica de convite de colaboradores via e-mail.
    - [ ] Implementar controle de permissões customizadas (RF06).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Orientado a Evento (RF03):** *WHEN* o usuário selecionar outro negócio vinculado à sua conta, *THE SYSTEM SHALL* alternar o contexto ativo mantendo a sessão de login corrente.
    *   **Feature Opcional (RF06):** *WHERE* o Dono configurar permissões granulares customizadas para um colaborador, *THE SYSTEM SHALL* aplicar essas permissões em vez do papel fixo padrão.
    *   **Comportamento Indesejado (RN02):** *IF* um usuário sem o papel de Dono tentar convidar/remover colaboradores ou alterar permissões, *THEN* *THE SYSTEM SHALL* impedir a ação e manter as permissões inalteradas.

---

### Issue #05 [Feature]: Cadastro Unificado de Itens com shadcn/ui e Server Actions
*   **Título:** `[US02]  Cadastro de Produtos e Serviços com Associação de Materiais (Client + Server Actions)`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF07, RF08, RF09, RF10, RF11, RF12, RF13, RF14, RN03, RN04
*   **Descrição:**
    ```text
    Como gestor do negócio,
    Eu quero cadastrar meus produtos físicos e meus serviços de maneira isolada (com categorias e unidades de medida obrigatórias) e vincular produtos físicos como materiais consumíveis do meu serviço,
    Para que meu custo seja calculado com exatidão no módulo de Precificação.

    Tarefas:
    - [ ] Criar formulários responsivos usando Tailwind e componentes shadcn/ui (RF08, RF09).
    - [ ] Implementar Server Actions para salvar dados no PostgreSQL via Prisma.
    - [ ] Criar componente de "Seleção de Materiais" para serviços, consumindo dados do estoque em tempo real (RF12).
    - [ ] Garantir que o Prisma inicialize a quantidade de novos produtos como zero (aplicar RN03).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Estado + Evento (RF08):** *WHILE* o tipo do item selecionado for Produto Físico, *WHEN* o usuário submeter o formulário de cadastro, *THE SYSTEM SHALL* exigir o preenchimento de nome, custo, estoque mínimo, unidade de medida e categoria.
    *   **Estado + Evento (RF09):** *WHILE* o tipo do item selecionado for Serviço, *WHEN* o usuário submeter o formulário de cadastro, *THE SYSTEM SHALL* exigir o preenchimento de nome, custo e categoria, e deve perguntar se há materiais/insumos associados.
    *   **Orientado a Evento (RF13):** *WHEN* um material for vinculado a um Serviço, *THE SYSTEM SHALL* preencher automaticamente a quantidade padrão de 1 unidade por execução, permitindo que o usuário edite esse valor.
    *   **Orientado a Evento (RN03):** *WHEN* um Produto Físico for criado, *THE SYSTEM SHALL* inicializar seu estoque com quantidade igual a zero.

---

### Issue #06 [Feature]: Gestão e Movimentações de Estoque com Alerta de Estoque Mínimo
*   **Título:** `[US03] Entrada e Saída de Estoque, Baixa Manual com Motivo e Alerta Visual de Estoque Baixo`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF15, RF16, RF17, RF18, RF19, RF20, RF21, RN05, RN06, RN07, RN08, RNF05
*   **Descrição:**
    ```text
    Como gestor ou colaborador com acesso ao estoque,
    Eu quero registrar entradas manuais, baixas por vendas e ajustes por perdas com motivo obrigatório,
    Para que eu receba alertas visuais caso os produtos fiquem abaixo do limite seguro e evite rupturas de estoque.

    Tarefas:
    - [ ] Implementar tela de lançamento de entrada de estoque (informando quantidade e data) (RF15).
    - [ ] Implementar formulário de baixa manual de ajuste de estoque (perda, quebra, uso interno, etc.) com motivo obrigatório (RF17).
    - [ ] Criar gatilho (Trigger/Signal) no Django para dar baixa automática em itens de vendas físicas e insumos de serviços (RF16, RN05).
    - [ ] Implementar o cálculo dinâmico de sugestão de estoque mínimo após o 1º ciclo completo (RF20, RN08).
    - [ ] Adicionar indicadores visuais de estoque baixo no dashboard e no cadastro de produtos (RF19, RF21).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Comportamento Indesejado (RF18 / RN06):** *IF* o estoque de um produto for insuficiente no momento de uma venda, *THEN* *THE SYSTEM SHALL* concluir a venda normalmente e sinalizar o estoque resultante como negativo.
    *   **Orientado a Estado (RF19):** *WHILE* o estoque atual de um produto estiver igual ou abaixo do estoque mínimo, *THE SYSTEM SHALL* exibir um alerta visual associado ao produto.
    *   **Orientado a Estado (RN07):** *WHILE* um produto não tiver completado ao menos 1 ciclo de entrada e saída registrado, *THE SYSTEM SHALL* manter o alerta de estoque baixo desativado para esse produto.
    *   **Orientado a Evento (RN05):** *WHEN* um Serviço com materiais vinculados for vendido, *THE SYSTEM SHALL* dar baixa automática no estoque desses materiais, na quantidade configurada.

---

### Issue #07 [Feature]: Fluxo de Vendas (Registros, Formas de Pagamento e Parcelamento)
*   **Título:** `[US04] Registro de Vendas Multi-itens, Pagamentos Mistos e Agendamento de Parcelas`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF22, RF22b, RF23, RF24, RF25, RF26, RF27, RF28, RN09, RN10, RN11, RN12
*   **Descrição:**
    ```text
    Como operador do caixa (Dono ou Colaborador),
    Eu quero registrar vendas multi-itens com pagamento à vista ou parcelado, aceitando pagamentos múltiplos na mesma transação,
    Para flexibilizar o atendimento ao cliente e automatizar os recebimentos.

    Tarefas:
    - [ ] Desenvolver carrinho de vendas capaz de suportar múltiplos produtos e serviços em um único registro (RF23).
    - [ ] Criar campos opcionais de identificação do cliente (RF22).
    - [ ] Implementar módulo de pagamentos mistos (Dinheiro, PIX, Débito e Crédito) (RF25).
    - [ ] Implementar motor matemático de parcelamento para cartão de crédito (limite de 12 parcelas, gerando vencimentos mensais futuros) (RF27, RF28).
    - [ ] Configurar lógica que impede a finalização se a soma dos pagamentos não bater com o total da venda (RF26).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Comportamento Indesejado (RF26):** *IF* a soma dos valores informados nas formas de pagamento for diferente do valor total da venda, *THEN* *THE SYSTEM SHALL* impedir a conclusão do registro da venda.
    *   **Estado + Evento (RF27/RF28):** *WHILE* a forma de pagamento selecionada for Cartão de Crédito, *WHEN* o usuário definir o parcelamento (em até 12 vezes), *THE SYSTEM SHALL* gerar automaticamente as datas de vencimento das parcelas de forma mensal, a partir da data da venda.
    *   **Orientado a Evento (RN09):** *WHEN* uma venda for paga em Dinheiro, PIX ou Cartão de Débito, *THE SYSTEM SHALL* gerar lançamento imediato no fluxo de caixa.
    *   **Orientado a Evento (RN10):** *WHEN* uma venda for paga (total ou parcialmente) em Cartão de Crédito, *THE SYSTEM SHALL* gerar uma ou mais contas a receber com vencimento futuro.

---

### Issue #08 [Feature]: Módulo Financeiro e Fluxo de Caixa (Lançamentos e Contas a Pagar/Receber)
*   **Título:** `[US05] Gestão Financeira, Fluxo de Caixa Consolidado e Controle de Contas a Pagar/Receber`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF29, RF30, RF31, RF32, RF33, RN13, RN14
*   **Descrição:**
    ```text
    Como gestor financeiro,
    Eu quero visualizar meu fluxo de caixa atualizado, cadastrar contas a pagar/receber e registrar quitações parciais,
    Para que eu tenha um controle real do saldo líquido da minha empresa.

    Tarefas:
    - [ ] Implementar módulo de fluxo de caixa mostrando Entradas, Saídas e Saldo Operacional consolidado (RF29).
    - [ ] Desenvolver CRUD para Contas a Pagar e Contas a Receber com datas de vencimento e categorias (RF30).
    - [ ] Adicionar funcionalidade para registrar pagamentos ou recebimentos parciais em contas (RF31).
    - [ ] Vincular a gravação automática de lançamentos financeiros de categoria "Vendas" ao fechar uma venda (RF33, RN13).
    - [ ] Aplicar a regra de que transações de cartão de crédito só entram no caixa operacional na data do recebimento (RN14).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Orientado a Evento (RF31):** *WHEN* o usuário registrar um pagamento ou recebimento parcial de uma conta, *THE SYSTEM SHALL* manter o valor restante em aberto.
    *   **Orientado a Evento (RF33):** *WHEN* uma venda for registrada, *THE SYSTEM SHALL* gerar automaticamente o(s) lançamento(s) correspondente(s) no módulo Financeiro, na categoria Vendas.
    *   **Orientado a Estado (RN14):** *WHILE* uma conta a receber de cartão de crédito não tiver sido recebida, *THE SYSTEM SHALL* manter esse valor fora do saldo de caixa atual.

---

### Issue #09 [Feature]: Calculadora de Precificação Inteligente (Motor TypeScript)
*   **Título:** `[US06] Calculadora de Precificação, Margem por Categoria e Cálculo Tributário por RBT12`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF34, RF35, RF36, RF37, RF38, RF39, RF40, RF41, RN15, RN16, RN17, RNF06, RNF08
*   **Descrição:**
    ```text
    Como gestor do negócio,
    Eu quero calcular meus preços sugeridos de venda com base em custos reais, impostos federais configuráveis e margem de lucro por categoria,
    Para precificar meus produtos de forma matematicamente viável e sem perdas financeiras.

    Tarefas:
    - [ ] Implementar função auxiliar em TS para a fórmula Markup (Preço = Custo / (1 - Margem)) (RF34).
    - [ ] Desenvolver lógica no Prisma para somar custos de materiais vinculados ao serviço (RF35).
    - [ ] Desenvolver interface que solicita o regime de tributação (MEI ou Simples Nacional) (RF37).
    - [ ] Criar motor que lê o histórico financeiro, calcula o RBT12 e determina a alíquota de imposto proporcional (RF38, RF39).
    - [ ] Implementar tela de histórico de preços para auditoria técnica (RF41, RN16).
    - [ ] Configurar tabela de parâmetros tributários editável no banco para evitar hard-coding (RN17, RNF08).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Orientado a Evento (RF34):** *WHEN* o usuário solicitar o cálculo de preço de um item, *THE SYSTEM SHALL* calcular o preço de venda sugerido utilizando a fórmula `Preço = Custo ÷ (1 − Margem%)`.
    *   **Orientado a Estado (RF35):** *WHILE* o item calculado for um Serviço com materiais vinculados, *THE SYSTEM SHALL* somar ao custo base o custo dos materiais vinculados, considerando a quantidade configurada de cada material.
    *   **Orientado a Evento (RF40):** *WHEN* o cálculo de preço for concluído, *THE SYSTEM SHALL* exibir o resultado ao usuário e aguardar confirmação explícita antes de salvar o valor como preço de venda oficial.
    *   **Orientado a Evento (RF41):** *WHEN* um novo preço for confirmado pelo usuário, *THE SYSTEM SHALL* registrar essa alteração no histórico de preços do produto/serviço.

---

### Issue #10 [Feature]: Dashboard de Vendas, Resumo de Caixa e Alertas Visuais do Negócio
*   **Título:** `[US07] Dashboard Inicial, Gráficos de Histórico de Vendas e Resumo Consolidado do Dia`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF42, RF43, RF44, RNF10
*   **Descrição:**
    ```text
    Como proprietário do negócio,
    Eu quero visualizar na tela inicial o resumo de desempenho diário de caixa, faturamento e alertas do estoque,
    Para obter insights rápidos sobre a saúde do meu negócio.

    Tarefas:
    - [ ] Implementar tela inicial com widgets rápidos: Faturamento do Dia, Saldo em Caixa e Cards de Alertas de Estoque Baixo (RF42).
    - [ ] Integrar biblioteca de gráficos (ex: Chart.js ou Plotly) para renderizar o faturamento consolidado diário/mensal (RF43).
    - [ ] Estruturar a arquitetura do Dashboard como uma malha modular que suporte expansão futura para novos componentes de inteligência artificial (RF44, RNF10).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Ubíquo (RF42):** *THE SYSTEM SHALL* exibir na tela inicial um resumo do dia contendo vendas do dia, saldo em caixa e alertas de estoque baixo.

---

### Issue #11 [Feature]: Limitações e Regras de Bloqueio do Plano Freemium vs. Plano Pago
*   **Título:** `[US08] Controle do Plano Freemium (Gratuito) versus Funcionalidades Pagas`
*   **Tipo/Label:** `feature`
*   **Requisitos Mapeados:** RF45, RF46, RF47, RN18
*   **Descrição:**
    ```text
    Como gestor do produto,
    Eu quero que o sistema limite acessos específicos (como geração de relatórios de comissão e controle multiusuários) apenas aos assinantes do plano pago,
    Para rentabilizar a ferramenta sem limitar o volume de registros dos microempreendedores no plano gratuito.

    Tarefas:
    - [ ] Adicionar flag `plano_pago` ao modelo do Negócio.
    - [ ] Implementar decorações e Middleware de autorização para bloquear as rotas de Multi-Colaboradores e Relatórios Avançados para contas gratuitas (RF47).
    - [ ] Garantir que o plano gratuito continue com registros de vendas, produtos e lançamentos sem nenhuma limitação de volume (RF46, RN18).
    - [ ] Adicionar tela de convite para upgrade de plano quando o usuário tentar usar recursos restritos.
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Feature Opcional (RF47):** *WHERE* o negócio estiver no plano pago, *THE SYSTEM SHALL* disponibilizar relatórios avançados e gestão de múltiplos colaboradores.
    *   **Ubíquo (RN18):** *THE SYSTEM SHALL* limitar o plano Freemium apenas por funcionalidades disponíveis, nunca bloqueando o volume de uso (quantidade de produtos cadastrados ou vendas inseridas).

---

## 🔒 Bloco 3: Segurança, Auditoria e LGPD

### Issue #12 [Technical]: Log de Auditoria via Prisma Middleware e LGPD
*   **Título:** `Auditoria de Estoque/Preços e Exportação de Dados LGPD`
*   **Tipo/Label:** `security`, `technical`
*   **Requisitos Mapeados:** RNF04, RNF05
*   **Descrição:**
    ```text
    Implementar os logs de segurança para auditoria e os processos técnicos necessários para garantir que o sistema respeite integralmente os requisitos de privacidade da LGPD.

    Tarefas:
    - [ ] Implementar Prisma Middleware (ou Extension) para interceptar updates em Itens e Estoque e salvar logs na tabela de Auditoria (RNF05)
    - [ ] Implementar o termo de consentimento explícito de uso de dados no cadastro inicial.
    - [ ] Desenvolver rota exclusiva para que o usuário possa realizar o download de seus dados cadastrais (Mecanismo de Exportação de Dados em formato JSON/CSV).
    - [ ] Desenvolver o botão de encerramento de conta, que realize a deleção lógica ou anonimização de dados pessoais identificáveis (Mecanismo de Exclusão).
    ```
*   **Critérios de Aceitação (EARS Notation):**
    *   **Orientado a Evento (RNF05):** *WHEN* houver alteração em estoque ou em preço, *THE SYSTEM SHALL* registrar um log auditável contendo data, usuário responsável e motivo (quando aplicável).
    *   **Ubíquo (RNF04):** *THE SYSTEM SHALL* solicitar o consentimento de dados e permitir a exclusão/anonimização permanente de dados pessoais sob demanda, em conformidade com a LGPD.
