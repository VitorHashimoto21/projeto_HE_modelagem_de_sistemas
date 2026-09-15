### Drivers Arquiteturais (ADs) — ERP + Calculadora de Precificação

Drivers arquiteturais são os requisitos, restrições e cenários que mais impactam e direcionam as decisões de arquitetura de um software. Eles não representam a totalidade dos Requisitos Funcionais (RF), Não Funcionais (RNF) e Regras de Negócio (RN), mas selecionam os itens de maior peso que forçam escolhas de estrutura, isolamento de dados, modelos de persistência, integração e tratamento de falhas.

Este documento foi elaborado a partir do levantamento de requisitos, regras em EARS, visão de negócio, modelos de domínio e fluxogramas, guia de caso de uso e orientações metodológicas de arquitetura.

\---

#### 1\. Critério de Seleção

Um requisito, regra ou restrição entra neste documento quando atende a pelo menos um dos seguintes testes arquiteturais:

1. **Obriga uma fronteira de isolamento ou integração** — como o isolamento estrito de dados entre diferentes empresas (multi-tenancy).
2. **Define um invariante de domínio crítico** — como a garantia de que a venda dispara simultaneamente a baixa de estoque e o lançamento financeiro.
3. **Impõe medidas de qualidade mensuráveis** — como tempo de resposta performático no cálculo do RBT12 e logs auditáveis.
4. **Cria tensão estrutural entre dois objetivos** — como permitir vendas sem estoque suficiente sem corromper a integridade financeira e de auditoria.

\---

#### 2\. Mapa Priorizado de Drivers

|ID|Tipo|Driver|Impacto na Arquitetura|Prioridade|
|-|-|-|-|-|
|**AD-C01**|Restrição|Framework Fullstack Next.js (App Router/TS), Prisma ORM e PostgreSQL|Definição da stack unificada, rotas de API/Server Actions e camada de ORM.|Alta|
|**AD-C02**|Restrição|Arquitetura Multi-tenant com isolamento estrito por negócio (RN01, RNF02)|Estruturação de filtros globais de consulta e segurança de banco.|Alta|
|**AD-RF01**|Requisito|Integração nativa dos três módulos: Estoque → Calculadora → Financeiro|Encadeamento de chamadas transacionais e atualização em cascata de dados.|Alta|
|**AD-RF02**|Requisito|Controle de acesso por papéis (Dono, Gerente, Colaborador) e permissões granulares (RF05, RF06)|Middleware de autorização centralizado e guardas de execução em nível de API/Server Actions.|Alta|
|**AD-RF03**|Requisito|Automação do fluxo de vendas: pagamentos mistos, parcelamento e baixa de estoque (RN05, RN09, RN10, RN12)|Transações distribuídas no banco de dados para estoque, contas a receber e fluxo de caixa.|Alta|
|**AD-RF04**|Requisito|Precificação inteligente com RBT12 dinâmico e parametrização tributária (RF34-RF39, RN17, RNF08)|Motor de cálculo desacoplado do código, alimentado por agregações de histórico e tabelas dinâmicas.|Alta|
|**AD-QA01**|Qualidade|Desempenho performático no cálculo de preços e RBT12 (RNF06)|Otimização de consultas agregadas no PostgreSQL com índices em dados temporais e de negócio.|Alta|
|**AD-QA02**|Qualidade|Registro auditável imutável de movimentações de estoque e alterações de preço (RNF05)|Middleware de auditoria via Prisma/PostgreSQL para gravação automática de histórico sem permissão de exclusão.|Alta|
|**AD-QA03**|Qualidade|Conformidade com LGPD para retenção, exportação e exclusão de dados (RNF04)|Serviços de exportação estruturada (JSON/CSV) e anonimização/deleção lógica de contas.|Alta|
|**AD-QA04**|Qualidade|Interface web única e responsiva para múltiplos dispositivos (RNF01)|Construção de interface em componentes reativos (TailwindCSS/shadcn/ui) adaptáveis a mobile e desktop.|Média|
|**AD-QA05**|Negócio|Modelo Freemium limitado por funcionalidade sem restrição de volume (RF45-RF47, RN18)|Guardas de acesso por plano no backend sem travas de contagem de registros no banco.|Média|
|**AD-CEN01**|Cenário|Venda de serviço composto por múltiplos materiais de estoque (RF12, RN05)|Baixa iterativa transacional de múltiplos itens no estoque ao fechar uma venda.|Alta|
|**AD-CEN02**|Cenário|Venda realizada com quantidade de estoque insuficiente (RF18, RN06)|Liberação da venda pelo sistema permitindo saldo negativo de estoque, registrando alerta sem bloquear o caixa.|Alta|

\---

#### 3\. Requisitos Arquiteturalmente Significativos

##### 3.1 AD-C02 — Multi-tenancy e Isolamento Estrito de Dados

O sistema atende a múltiplos microempreendedores que não podem ter seus dados visualizados ou alterados por terceiros.

* **Entidades Afetadas:** `Negocio`, `Usuario`, `MembroNegocio`, `Item`, `Venda`, `LancamentoFinanceiro`.
* **Regras Vinculadas:** RN01 e RNF02.
* **Decisão que o driver força:** Todas as tabelas operacionais do banco relacional devem conter uma chave estrangeira de relacionamento obrigatória com `NegocioID`. Todas as queries executadas pelo Prisma ORM devem incluir o contexto ativo de `NegocioID` obtido da sessão autenticada.

##### 3.2 AD-RF03 — Automação Transacional da Venda

O ato de registrar uma venda envolve múltiplos subsistemas (Estoque, Contas a Receber e Fluxo de Caixa).

* **Impacto Operacional:** Ao confirmar uma venda:

  1. Se contiver produtos físicos ou serviços com materiais, realiza baixa no estoque (RN05, RN12).
  2. Se paga à vista (Dinheiro, PIX, Débito), gera lançamento no caixa operacional (RN09).
  3. Se paga no Crédito, gera contas a receber futuras e parcelas mensais (RN10, RN11).
* **Decisão que o driver força:** O encadeamento do registro de venda precisa ser tratado dentro de uma única transação de banco de dados (`prisma.$transaction`) para evitar inconsistência de saldo de estoque ou financeiro em caso de falha no meio do processo.

##### 3.3 AD-RF04 — Motor de Precificação e Parametrização Tributária

A Calculadora de Precificação não pode utilizar valores fixos de alíquotas (*hardcoded*) nem exigir que o usuário conheça os percentuais do Simples Nacional ou MEI.

* **Entidades Afetadas:** `Item`, `MaterialServico`, `HistoricoPreco`, `TabelaAliquota`.
* **Regras Vinculadas:** RF34 ao RF41, RN15, RN17 e RNF08.
* **Decisão que o driver força:** As faixas e alíquotas de imposto devem ser armazenadas em tabelas de configuração editáveis no banco de dados. O cálculo do RBT12 deve realizar agregação dinâmica da receita bruta dos últimos 12 meses filtrada por `NegocioID`.

\---

#### 4\. Restrições do Sistema

* **AD-C01 (Next.js + Prisma + TypeScript):** O sistema deve ser estruturado em Next.js (App Router) utilizando TypeScript em todo o ciclo, utilizando o Prisma ORM para acesso tipado ao banco PostgreSQL.
* **AD-C02 (Multi-tenancy Lógico):** O isolamento entre empresas é lógico, operando em um único banco relacional compartilhado onde todas as consultas são filtradas pela chave da empresa (`NegocioID`).
* **AD-C03 (Entrega Web Responsiva):** A aplicação deve ser acessada via navegador web, sem necessidade de instalação local, com layout adaptável tanto para telas de desktop quanto dispositivos móveis.
* **AD-C04 (Invariantes de Dados do Domínio):**

  * Todo Produto Físico é cadastrado com quantidade em estoque inicial zerada (RN03).
  * O preço de venda oficial utilizado na transação é sempre o último valor confirmado pelo usuário na calculadora (RN15).
  * O saldo do fluxo de caixa considera exclusivamente valores recebidos/pagos efetivamente (RN14).

\---

#### 5\. Atributos de Qualidade (Cenários)

##### AD-QA01 — Desempenho do Cálculo de Precificação e RBT12 (RNF06)

* **Fonte:** Dono ou Gerente do negócio.
* **Estímulo:** Solicitado o cálculo de preço de um item com histórico longo de vendas.
* **Artefato:** Motor da Calculadora e banco de dados PostgreSQL.
* **Ambiente:** Operação normal com faturamento ativo.
* **Resposta:** O sistema agrega o faturamento dos últimos 12 meses (RBT12), identifica a alíquota aplicável e retorna o preço sugerido.
* **Medida:** Tempo de resposta exibido na interface em menos de 2 segundos.

##### AD-QA02 — Isolamento e Proteção de Dados por Perfil (RNF02, RNF05, RN01, RN02)

* **Fonte:** Colaborador autenticado.
* **Estímulo:** Tentativa de acessar relatórios financeiros, configurações da empresa ou dados de outros negócios.
* **Artefato:** Middleware de roteamento e Server Actions de dados.
* **Ambiente:** Operação regular do sistema.
* **Resposta:** A requisição é negada no backend e o acesso é bloqueado.
* **Medida:** Nenhuma informação financeira ou de terceiros vaza no payload da API ou na interface.

##### AD-QA03 — Auditoria Imutável de Estoque e Preços (RNF05)

* **Fonte:** Qualquer usuário com permissão de escrita.
* **Estímulo:** Lançamento de ajuste manual de estoque ou confirmação de novo preço.
* **Artefato:** Módulo de Auditoria (`MovimentacaoEstoque` / `HistoricoPreco`).
* **Ambiente:** Alteração de dados cadastrais/operacionais.
* **Resposta:** Registro gravado com data, hora, ID do usuário, valor anterior, valor novo e motivo.
* **Medida:** Logs persistidos de forma permanente, sem permissão de alteração ou exclusão.

\---

#### 6\. Tensões Arquiteturais

|Tensão|Polo A|Polo B|Direção Sugerida pelos Drivers|
|-|-|-|-|
|**Agilidade na Venda vs. Rigo do Estoque**|Exigir estoque positivo para liberar venda.|Permitir venda rápida mesmo sem estoque prévio (RN06).|Permitir a venda, registrando o saldo negativo e acionando o alerta visual.|
|**Agregação em Tempo Real vs. Performance**|Recalcular o RBT12 do zero em toda simulação da calculadora.|Resposta performática da interface (< 2s) (RNF06).|Criar índices compostos em `(negocio\_id, data)` na tabela de vendas para consultas agregadas rápidas.|
|**Flexibilidade de Acesso vs. Segurança LGPD**|Dar acesso amplo a colaboradores para agilizar tarefas.|Garantir isolamento estrito de relatórios estratégicos (RN01, RN02).|Impor validação de papéis obrigatoriamente no servidor/API.|

\---

#### 7\. Matriz de Rastreabilidade

|Driver|Requisitos Mapeados|Regras Vinculadas|Artefatos Afetados|
|-|-|-|-|
|**AD-C01**|RNF01, RNF07, RNF10|—|Repositório Next.js, Schema Prisma.|
|**AD-C02**|RF02, RF03, RNF02|RN01|Schema Prisma (`NegocioID`), Middleware.|
|**AD-RF01**|RF08, RF09, RF33, RF35|RN05, RN12, RN13|Módulos Estoque, Precificação e Financeiro.|
|**AD-RF02**|RF01, RF04, RF05, RF06|RN02|Tabela `MembroNegocio`, Guardas de Acesso.|
|**AD-RF03**|RF23, RF25, RF27, RF28|RN09, RN10, RN11, RN12|Motor de Vendas e Transações Financeiras.|
|**AD-RF04**|RF34, RF37, RF38, RF39, RF40|RN15, RN16, RN17|Calculadora de Precificação e Tabela Tributária.|
|**AD-QA01**|RNF06|—|Consultas do Prisma / Banco PostgreSQL.|
|**AD-QA02**|RNF05|—|Tabelas `MovimentacaoEstoque` e `HistoricoPreco`.|
|**AD-QA03**|RNF04|—|Endpoints de Exportação e Deleção de Conta.|

\---

