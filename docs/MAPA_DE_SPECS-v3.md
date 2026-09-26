# Mapa de Specs (v3) — HealthEnterprise (HE)

> **Documento de Governança de Desenvolvimento Assistido por IA (SDD — Semana 06)**  
> **Projeto:** HealthEnterprise (HE) — Gestão Financeira, Precificação e ERP para Autônomos e Microempresários  
> **Repositório:** `VitorHashimoto21/projeto_HE_modelagem_de_sistemas`  
> **Metodologia:** Spec-Driven Development (SDD)  
> **Atualização v3:** Atualização estrita da regra de negócio e requisitos funcionais de estoque (`RF18` e `RN06` de `requisitos-corrigidos.md` e `requisitos_ears-corrigidos.md`), bloqueando qualquer venda com estoque insuficiente/negativo.

---

## 📌 Visão Geral do Mapa de Specs

O **Mapa de Specs** é o primeiro produto do fluxo de Spec-Driven Development (SDD). Ele organiza a implementação do sistema em unidades comportamentais ordenadas, rastreáveis e verificáveis, derivadas diretamente da **baseline de modelagem** (Requisitos EARS corrigidos, Modelo de Domínio, Diagramas Lógicos/Sequência, Personas, Drivers Arquiteturais e ADRs).

Cada Spec representa uma capacidade observável do sistema ou uma fundação técnica necessária, garantindo a evolução incremental sem "saltos de fé" ou dependências circulares.

---

## 🗺️ Tabela do Mapa de Specs Integrado (Revisado)

| ID Spec | Nome da Spec | Base Principal & Drivers Arquiteturais (Rastreabilidade) | Dependências |
| :--- | :--- | :--- | :--- |
| **SPEC-001** | **Fundação Arquitetural & Multi-tenant Base** | **ADR-001**, **ADR-002**, **AD-C01**, **AD-C02**, `RNF-01`, `RNF-04`, Entidades: `Negocio`, `Usuario` | *Nenhuma (Raiz)* |
| **SPEC-002** | **Autenticação, Perfis & Controle de Acesso (RBAC)** | **ADR-003**, **AD-RF02**, **AD-QA02**, `RF-01`, `RF-02`, `RF-05`, `RF-06`, `RB-01`, `RB-02`, `RNF-02`, `RNF-03`, `UC-01` | `SPEC-001` |
| **SPEC-003** | **Cadastro Unificado de Itens (Produtos, Serviços & Insumos)** | **AD-RF01**, **AD-CEN01**, `RF-03`, `RF-04`, `RF-12`, `RB-03`, `UC-02`, Entidades: `Categoria`, `Item`, `ProdutoFisico`, `Servico`, `MaterialServico` | `SPEC-001`, `SPEC-002` |
| **SPEC-004** | **Motor de Precificação Inteligente (Calculadora & Tributos)** | **ADR-004**, **AD-RF04**, **AD-QA01**, `RF-08`, `RF-34..41`, `RB-07`, `RB-08`, `RNF-06`, `RNF-08`, `UC-03`, Entidades: `Item`, `MaterialServico`, `HistoricoPreco`, `TabelaAliquota` | `SPEC-003` |
| **SPEC-005** | **Controle e Movimentação de Estoque Físico & Alertas** | **AD-QA02**, `RF-05`, `RF-15`, `RF-17`, `RF-19..21`, `RB-04`, `RNF-01`, `RNF-05`, `UC-04`, Entidades: `ProdutoFisico`, `MovimentacaoEstoque` | `SPEC-003` |
| **SPEC-006** | **Registro e Processamento de Vendas (PDV Multi-itens & Validação Estrita de Estoque)** | **AD-RF03**, **AD-CEN01**, `RF-06`, **`RF-18`**, `RF-23`, `RF-25`, `RF-27`, `RF-28`, `RB-05`, `RB-06`, **`RN-06`**, `RB-09..12`, `UC-05` | `SPEC-003`, `SPEC-005` |
| **SPEC-007** | **Gestão do Fluxo de Caixa e Lançamentos Financeiros** | **AD-RF01**, **AD-RF03**, `RF-07`, `RB-06`, `UC-06`, Entidades: `LancamentoFinanceiro`, `Venda` | `SPEC-006` |
| **SPEC-008** | **Contas a Pagar/Receber, Parcelamento & Pagamentos Parciais** | **AD-RF03**, `RF-07`, `RB-06`, `UC-07`, Entidades: `ContaPagarReceber`, `Parcela`, `Pagamento` | `SPEC-007` |
| **SPEC-009** | **Dashboard Analítico da Saúde Financeira (Semáforo & Break-Even)** | **AD-QA01**, **AD-QA04**, `RF-09`, `RF-42..44`, `RB-08`, `RNF-01`, `UC-08`, Entidades: `LancamentoFinanceiro`, `ContaPagarReceber`, `Negocio` | `SPEC-007`, `SPEC-008` |
| **SPEC-010** | **Governança do Plano Freemium vs. Pago & Conformidade LGPD** | **ADR-003**, **AD-QA03**, **AD-QA05**, `RF-10`, `RF-45..47`, `RB-01`, `RB-18`, `RNF-03..05`, Entidades: `Negocio`, `Usuario`, `MembroNegocio` | `SPEC-002`, `SPEC-009` |

---

## 🔍 Detalhamento das Specs (Com Regra Estrita de Estoque)

### SPEC-001: Fundação Arquitetural & Multi-tenant Base
* **Objetivo:** Estabelecer a infraestrutura inicial do Next.js com App Router, TypeScript, banco relacional PostgreSQL (Supabase/Neon) via Prisma ORM, e suporte ao conceito isolado de `Negocio` (tenant) com a coluna `negocio_id` em todas as tabelas operacionais.
* **Rastreabilidade de Arquitetura:** **ADR-001**, **ADR-002**, **AD-C01** (Stack unificada Next.js/Prisma/Postgres), **AD-C02** (Multi-tenancy com isolamento estrito - `RN01`, `RNF02`).
* **Comportamento Verificável:** Conexão bem-sucedida ao banco, execução de migrations iniciais e injeção do filtro obrigatório `where: { negocioId }` na camada do Prisma.
* **Justificativa de Encadeamento:** É a dependência raiz de todas as demais funcionalidades do sistema.

### SPEC-002: Autenticação, Perfis & Controle de Acesso (RBAC)
* **Objetivo:** Permitir cadastro/login seguro via Supabase Auth e gerenciar permissões por papéis (Dono, Gerente, Colaborador/Assistente), validando a autorização no servidor em cada requisição de API ou Server Action para ocultar dados sensíveis conforme a persona (ex: Lucas Ramos).
* **Rastreabilidade de Arquitetura:** **ADR-003** (Supabase Auth & Autorização no Backend), **AD-RF02** (Controle por papel e permissão granular - `RF05`, `RF06`), **AD-QA02** (Proteção contra vazamento de dados), Personas: Gisele Mendes, Lucas Ramos.
* **Comportamento Verificável:** Login funcional, sessão mantida e redirecionamento HTTP 403 / ocultação de menus/endpoints quando o perfil Colaborador tenta acessar dados confidenciais de lucros e custos fixos.
* **Justificativa de Encadeamento:** Necessário para garantir a segurança e o contexto do usuário autenticado antes de manipular dados de negócio.

### SPEC-003: Cadastro Unificado de Itens (Produtos, Serviços & Insumos)
* **Objetivo:** Cadastrar produtos físicos (com estoque e custo) e serviços (com vínculo dinâmico de materiais/insumos consumidos).
* **Rastreabilidade de Arquitetura:** **AD-RF01** (Integração Estoque -> Calculadora -> Financeiro), **AD-CEN01** (Venda de serviço composto por múltiplos materiais de estoque - `RF12`, `RN05`), Personas: Camila Silva, Thiago Rocha, Gisele Mendes.
* **Comportamento Verificável:** Inserção de produtos e serviços, associação N:N de materiais a um serviço com cálculo automático do custo base de insumos.
* **Justificativa de Encadeamento:** Base de catálogo requerida tanto pela Calculadora quanto pelo PDV/Vendas.

### SPEC-004: Motor de Precificação Inteligente (Calculadora & Tributos)
* **Objetivo:** Calcular o valor-hora ideal e a recomendação de preço de venda com base em custos fixos, pró-labore, materiais consumidos, margem de lucro % e alíquota tributária real do Simples Nacional/MEI obtida a partir da agregação dinâmica do RBT12 (faturamento bruto dos últimos 12 meses), com salvamento no histórico do ERP.
* **Rastreabilidade de Arquitetura:** **ADR-004** (Parametrização Tributária & RBT12), **AD-RF04** (Precificação com RBT12 dinâmico - `RF34..41`, `RN17`), **AD-QA01** (Desempenho performático com índices temporais), Personas: Camila Silva, Thiago Rocha.
* **Comportamento Verificável:** Cálculo determinístico exato da fórmula `Preço = Custo Base / (1 - Margem% - Imposto%)`, agregação temporal correta do RBT12 e atualização do preço oficial do item no catálogo ao confirmar.
* **Justificativa de Encadeamento:** Depende do catálogo de itens (SPEC-003) e serve para definir os preços praticados nas vendas.

### SPEC-005: Controle e Movimentação de Estoque Físico & Alertas
* **Objetivo:** Gerenciar entradas de produtos, saídas manuais (com motivo obrigatório), manter logs auditáveis imutáveis e disparar alertas visuais em tela para itens com quantidade abaixo do estoque mínimo.
* **Rastreabilidade de Arquitetura:** **AD-QA02** (Auditoria imutável de estoque - `RNF05`), `RF-05`, `RF-15`, `RF-17`, `RF-19..21`, `RB-04`, `RNF-01`, `RNF-05`, `UC-04`, Persona: Gisele Mendes.
* **Comportamento Verificável:** Atualização correta do saldo físico, criação irrestrita de registro em `MovimentacaoEstoque` e marcação de status "Estoque Crítico" quando `quantidadeEstoque <= estoqueMinimo`.
* **Justificativa de Encadeamento:** Prepara a infraestrutura de estoque para ser consumida e validada no registro de vendas (SPEC-006).

### SPEC-006: Registro e Processamento de Vendas (PDV Multi-itens & Validação Estrita de Estoque)
* **Objetivo:** Registrar vendas multi-itens no balcão, suportar pagamentos mistos (Dinheiro, PIX, Cartão), **validar previamente a disponibilidade física de estoque** e dar baixa automática imediata em transação ACID no estoque de produtos físicos e materiais de consumo do serviço.
* **Regra de Negócio Crucial (Atualizada - RF18 / RN06):** O sistema **bloqueia o registro de uma venda** se a quantidade solicitada de qualquer produto físico ou material associado a serviço for superior ao saldo atual em estoque (`quantidadeSolicitada > quantidadeEstoque`). Vendas com estoque insuficiente ou negativo são estritamente proibidas e abortadas.
* **Rastreabilidade de Arquitetura:** **AD-RF03** (Automação do fluxo de vendas e baixa de estoque - `RN05`, `RN09..12`), **AD-CEN01** (Baixa iterativa de múltiplos materiais), **`RF-18`** e **`RN-06`** (Bloqueio estrito de venda com estoque insuficiente), Personas: Lucas Ramos, Gisele Mendes.
* **Comportamento Verificável (EARS Unwanted Behavior):**
  * **Cenário de Erro:** `SE` o estoque de qualquer produto ou material envolvido for insuficiente, `ENTÃO` o sistema deve impedir a conclusão da venda, exibir a mensagem de erro *"Estoque insuficiente para o item [Nome do Item]"* e rollback integral da transação (nenhuma baixa de estoque e nenhum lançamento financeiro é criado).
  * **Cenário de Sucesso:** `QUANDO` todos os itens possuírem estoque suficiente, o sistema executa a dedução transacional no estoque, registra os lançamentos/parcelas financeiras correspondentes e conclui a venda.
* **Justificativa de Encadeamento:** Conecta o catálogo e o estoque às operações financeiras do negócio, garantindo a integridade dos saldos do ERP.

### SPEC-007: Gestão do Fluxo de Caixa e Lançamentos Financeiros
* **Objetivo:** Registrar entradas e saídas operacionais no caixa (oriundas das vendas confirmadas ou lançamentos manuais) e manter o saldo consolidado atualizado em tempo real.
* **Rastreabilidade de Arquitetura:** **AD-RF01** (Integração nativa dos módulos), **AD-RF03** (Automação financeira do caixa), `RF-07`, `RB-06`, `UC-06`, Personas: Camila Silva, Thiago Rocha, Gisele Mendes.
* **Comportamento Verificável:** Inserção de lançamentos do tipo Entrada/Saída e cálculo correto do saldo líquido de caixa do dia e do mês.
* **Justificativa de Encadeamento:** Alimenta a camada financeira do ERP a partir dos recebimentos efetuados.

### SPEC-008: Contas a Pagar/Receber, Parcelamento e Pagamentos Parciais
* **Objetivo:** Gerenciar receitas e despesas futuras, recebíveis parcelados de cartão de crédito e pagamentos parciais de contas com controle estrito de transição de estado (`ABERTA` -> `PARCIAL` -> `QUITADA`).
* **Rastreabilidade de Arquitetura:** **AD-RF03** (Divisão de parcelamentos e contas a receber), `RF-07`, `RB-06`, `UC-07`, Personas: Thiago Rocha, Gisele Mendes.
* **Comportamento Verificável:** Transição correta de status da conta ao registrar baixas parciais e geração das parcelas futuras com vencimento mensal.
* **Justificativa de Encadeamento:** Completa o módulo financeiro transacional necessário para o cálculo do Ponto de Equilíbrio.

### SPEC-009: Dashboard Analítico da Saúde Financeira (Semáforo & Break-Even)
* **Objetivo:** Exibir o painel geral de indicadores com gráficos de tendência e indicador do Ponto de Equilíbrio (Break-Even) em semáforo (Verde = Saudável, Amarelo = Alerta, Vermelho = Déficit), responsivo para múltiplos dispositivos.
* **Rastreabilidade de Arquitetura:** **AD-QA01** (Desempenho de consultas agregadas temporais), **AD-QA04** (Interface web responsiva - TailwindCSS/shadcn/ui - `RNF01`), `RF-09`, `RF-42..44`, `RB-08`, Personas: Camila Silva, Gisele Mendes.
* **Comportamento Verificável:** Mudança dinâmica da cor e status do painel conforme o faturamento real vs. custos fixos e metas de lucro do mês.
* **Justificativa de Encadeamento:** Depende do fluxo de caixa e contas a pagar/receber consolidados para calcular os indicadores.

### SPEC-010: Governança do Plano Freemium vs. Pago & Conformidade LGPD
* **Objetivo:** Restringir funcionalidades avançadas para contas no plano gratuito sem travas de volume de banco, e disponibilizar ferramentas de exportação de dados (JSON/CSV) e exclusão/anonimização em cumprimento à LGPD.
* **Rastreabilidade de Arquitetura:** **ADR-003**, **AD-QA03** (Conformidade LGPD para retenção/exportação/exclusão - `RNF04`), **AD-QA05** (Modelo Freemium por funcionalidade sem trava de volume - `RF45..47`, `RN18`).
* **Comportamento Verificável:** Bloqueio de funcionalidade PRO para contas gratuitas e geração bem-sucedida da exportação dos dados do titular da conta.
* **Justificativa de Encadeamento:** Camada de governança, conformidade e fechamento de ciclo de vida do produto.

---

## ❓ Lista de Questões em Aberto Atualizada (`OPEN-XX`)

O SDD exige o registro explícito de decisões pendentes para evitar que o agente de IA tome decisões de negócio arbitrárias sem consulta humana:

* **`OPEN-01` (Notificação de Estoque Baixo):** Definir se no MVP o alerta de estoque crítico será exibido apenas como um badge/banner no Dashboard e PDV ou se haverá envio automatizado de e-mail ao proprietário. *(Decisão sugerida: Exibir apenas em tela no MVP para manter o escopo enxuto)*.
* **`OPEN-02` (Conciliação de Taxa de Cartão de Crédito):** Definir se a taxa da operadora de cartão será descontada imediatamente na venda ou registrada como uma despesa financeira separada no momento do crédito das parcelas. *(Decisão sugerida: Registrar a taxa líquida no momento da parcela)*.
* **`OPEN-03` (Fluxo de Entrada de Estoque de Emergência na Venda):** Como o sistema bloqueia rigorosamente vendas com estoque insuficiente (RF18/RN06), quando o operador tentar vender um item sem estoque suficiente, o PDV exibirá uma opção rápida para redirecionar à tela de "Entrada de Estoque" ou a entrada deve ser realizada exclusivamente navegando pelo módulo de Estoque? *(Decisão sugerida: Exibir link direto no modal de erro "Adicionar Estoque" para agilizar a operação de caixa).*

---

## 🛡️ Governança e Camadas de Segurança do Agente de IA

Para garantir o controle de alterações e a integridade da *baseline*:
1. **Regra da Baseline:** Nenhuma Spec pode alterar requisitos (RF/RB/RNF), drivers (`AD-XX`) ou ADRs sem revisão e aprovação do grupo.
2. **Gates de Segurança:**
   * **Camada 1 (Instruções do Repositório):** Instruções em `.specify/` e prompt de controle SDD.
   * **Camada 2 (Git Hooks Locais):** Bloqueio de commits sem mensagens associadas a uma Spec/Issue.
   * **Camada 3 (CI / GitHub Actions):** Execução obrigatória de testes automatizados a cada Pull Request aberto na branch `main`.

---

*Mapa de Specs v3 aprovado para o projeto HealthEnterprise (HE) em cumprimento aos entregáveis da Semana 06.*
