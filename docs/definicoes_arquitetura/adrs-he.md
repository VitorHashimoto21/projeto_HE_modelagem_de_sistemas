### ADRs — Registros de Decisões Arquiteturais — HealthEnterprise (HE)

Este documento reúne o conjunto inicial de **ADRs (Architecture Decision Records) do projeto HealthEnterprise (HE)**, elaborados em estrita conformidade com as diretrizes metodológicas da disciplina. Uma **ADR** documenta uma decisão técnica estrutural e de difícil reversibilidade tomada durante o projeto.

## Quando escrever um ADR?

* **Decisão Técnica (DT):** É a escolha de implementação ou estrutura adotada para responder aos *drivers* e restrições do projeto.
* **ADR:** É o registro documental da Decisão Técnica, detalhando **o que** foi escolhido, **por que** foi escolhido, **quais alternativas** foram consideradas e **quais consequências** a escolha traz.
* **Critério de Reversibilidade:** Escreve-se um ADR quando uma decisão técnica exige o registro de uma ADR apenas quando sua alteração posterior for cara ou implicar na reescrita substancial da estrutura da aplicação, das APIs, do modelo de dados persistido ou da estratégia de segurança. Escolhas locais e baratas de substituir (como bibliotecas secundárias de UI) não possuem ADR.

---

#### Resumo das Decisões Aceitas

|ID|Decisão|Impacto de Reversão / Por que é cara|Status|
|-|-|-|-|
|**ADR-001**|Framework Fullstack Next.js (App Router) + TypeScript|Reescrever a apresentação e as rotas da aplicação em caso de troca de framework.|**Aceita**|
|**ADR-002**|Camada de Persistência com Prisma ORM e PostgreSQL Multi-tenant|Reestruturar todos os schemas de dados, migrations e queries de isolamento.|**Aceita**|
|**ADR-003**|Autenticação via Supabase Auth com Autorização no Backend|Alterar o mecanismo de gerenciamento de sessões e migrar credenciais registradas.|**Aceita**|
|**ADR-004**|Parametrização Tributária em Banco de Dados e Motor de RBT12|Reescrever a lógica de cálculo de impostos e a integração do módulo financeiro.|**Aceita**|
|**ADR-005**|Motor de Precificação Determinístico (Markup Completo) em TypeScript Puro|Reescrever o motor de cálculo, seus testes e o formato do histórico de preços.|**Aceita**|
|**ADR-006**|Consulta de CNPJ em Base Pública da Receita via Adaptador com Fallback Manual|Trocar o provedor afeta o cadastro de negócios e a origem dos dados fiscais (CNAE, regime, anexo).|**Aceita**|

---

#### O que Deliberadamente Não Tem ADR

|Tema|Motivo para Não Ter ADR|
|-|-|
|**TailwindCSS / shadcn/ui**|Escolha de estilização visual; pode ser substituída sem alterar os contratos da API ou a lógica de domínio do ERP.|
|**Provedor de Hospedagem (Vercel / Supabase / Neon)**|A conexão com o banco ocorre via string de conexão padrão do PostgreSQL tratada pelo Prisma, permitindo migração de infraestrutura sem reescrever código.|
|**Biblioteca de Gráficos do Dashboard**|Componente visual que pode ser trocado na camada de apresentação sem impacto nos dados financeiros.|

---

#### ADR-001 — Adoção do Framework Fullstack Next.js (App Router) com TypeScript

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

---

#### ADR-002 — Camada de Persistência com Prisma ORM e Banco PostgreSQL Multi-tenant Lógico

##### Decisão

A persistência de dados utilizará um banco de dados relacional **PostgreSQL**, acessado através do **Prisma ORM**. O isolamento entre diferentes empresas (*multi-tenancy*) será feito de forma lógica, incluindo a coluna `negocio_id` em todas as tabelas operacionais do sistema.

##### Contexto e Problema

O ERP lida com dados financeiros, registros de vendas e movimentações de estoque que exigem consistência transacional e integridade relacional. O sistema deve impedir vazamento de dados entre empresas (RN01, RNF02).

##### Por que foi tomada

1. **Garantia de Integridade e Transações:** O PostgreSQL oferece suporte a transações complexas (`ACID`), essenciais para garantir que uma venda só seja gravada se a baixa no estoque e o lançamento financeiro ocorrerem com sucesso (RN12).
2. **Isolamento por Negócio (RN01):** O uso da chave `negocio_id` tratada na camada de aplicação via filtros do ORM é a abordagem mais simples e eficiente para o público-alvo de microempreendedores.
3. **Modelagem de Domínio Tipada:** O Prisma traduz o modelo de domínio para o banco de dados e gera tipos TypeScript atualizados a cada migration.

##### Alternativas Consideradas

* **Bancos NoSQL (MongoDB):** Rejeitados por não oferecerem o suporte relacional nativo exigido para o fluxo de caixa, estoque e agrupamento de parcelas.
* **PostgreSQL com Schemas Separados por Tenant:** Rejeitado para o MVP devido à complexidade de gerenciar centenas de migrations individuais a cada novo microempreendedor cadastrado.

##### Consequências

* **Positivas:** Schema fortemente tipado; suporte seguro a migrations; garantia transacional em vendas e parcelamentos, com integridade referencial estrita por chaves estrangeiras entre `Negocio`, `Venda`, `ItemVenda`, `MovimentacaoEstoque` e `LancamentoFinanceiro`.
* **Negativas:** Todas as consultas no backend devem ter a garantia de conter o filtro do `negocio_id` para evitar acesso indevido; necessidade de configurar Connection Pooling (pgBouncer) para evitar estourar o limite de conexões simultâneas do PostgreSQL durante picos de requisições serverless.

**Drivers Relacionados:** AD-C02, AD-RF03, RN01, RNF02, RNF09.

---

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

---

#### ADR-004 — Parametrização Tributária e Agregação Dinâmica do RBT12

##### Decisão

Os parâmetros fiscais oficiais serão armazenados em tabelas de parâmetros no banco de dados, cada registro com fonte legal e data de vigência: faixas, alíquotas nominais e parcelas a deduzir por Anexo do Simples Nacional (`FaixaTributaria`), tabela CNAE → Anexo (`CnaeAnexo`), valor do DAS e limite anual do MEI (`ParametroMei`) e margens padrão por categoria baseadas nos percentuais de presunção (`MargemPadraoCategoria`). O faturamento bruto dos últimos 12 meses (RBT12) será calculado por competência, via consultas agregadas temporais na tabela `Venda` (todas as vendas, inclusive as ainda não recebidas — RN21). No Simples, a alíquota efetiva é `(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12`, usando o Anexo do negócio (RN24); no MEI, o imposto entra como despesa fixa (DAS) e não como percentual (RF60).

##### Contexto e Problema

A legislação tributária brasileira passa por alterações frequentes nas faixas e alíquotas do Simples Nacional. O sistema não pode depender de alterações de código-fonte para atualizar tributos (RN17, RNF08) e deve calcular a taxa embutida no preço automaticamente a partir do histórico de vendas do cliente (RF38, RF39).

##### Por que foi tomada

1. **Facilidade de Manutenção Legais (RN17, RNF08):** Permite atualizar alíquotas no banco de dados sem necessidade de novo deploy da aplicação.
2. **Eliminação de Erros do Usuário:** Automatiza a busca da receita bruta passada para definir a alíquota exata, entregando a proposta de valor central do produto (precificação simples e correta).

##### Alternativas Consideradas

* **Alíquotas e Faixas Gravadas Diretamente em Código (Hardcoded):** Rejeitadas por violar explicitamente o RNF08 e exigir publicação de novas versões a cada mudança de lei.

##### Consequências

* **Positivas:** Sistema flexível a mudanças fiscais; precificação precisa e automática baseada no histórico real do empreendedor.
* **Negativas:** Exige a criação de rotinas de agregação performáticas para que o cálculo do RBT12 responda dentro do SLA do sistema (< 2 segundos).

**Drivers Relacionados:** AD-RF04, AD-QA01, RF36, RF38, RF39, RF59, RF60, RF61, RN17, RN21, RN24, RNF06, RNF08.

---

#### ADR-005 — Motor de Precificação Determinístico (Markup Completo) em TypeScript Puro

##### Decisão

O cálculo do preço sugerido será implementado como **funções matemáticas determinísticas puras em TypeScript**, isoladas na camada de domínio (sem acesso a banco, rede ou estado global), aplicando a fórmula de markup completo:

`Preço = Custo Total ÷ (1 − (Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem%))`

A função recebe todos os insumos já resolvidos como parâmetros — custo total (custo base + materiais, RF35), percentual de despesas fixas (RF49), despesas variáveis (taxa média de cartão + comissão opcional do item, RN20), alíquota de imposto e margem. A alíquota é obtida previamente pela camada de dados a partir da tabela `FaixaTributaria` e do RBT12 (ADR-004). Nenhum cálculo numérico de preço é delegado a IA/LLM.

##### Contexto e Problema

A Calculadora de Precificação é o diferencial central do HE. O sistema precisa sugerir o preço de venda ideal considerando custos do item, rateio das despesas fixas do negócio, despesas variáveis, tributação (MEI/Simples Nacional) e margem desejada (RF34–RF41, RF48–RF54). Um erro nesse cálculo compromete diretamente a saúde financeira do usuário.

##### Por que foi tomada

1. **Previsibilidade e auditabilidade:** mesmas entradas sempre produzem a mesma saída; cada componente é gravado no `HistoricoPreco` (RNF05).
2. **Testabilidade:** permite uma suíte de testes unitários rápida e independente de banco ou APIs externas, cobrindo inclusive a restrição RN19 (soma dos percentuais < 100%).
3. **Separação de responsabilidades:** a parametrização (faixas tributárias, despesas fixas, taxas) fica no banco; a matemática fica no domínio.

##### Alternativas Consideradas

* **Uso de LLM/IA para cálculo de preços:** rejeitado. Sistemas financeiros não devem depender de modelos de linguagem para cálculos numéricos devido ao não-determinismo e ao risco de respostas inconsistentes ("alucinações").
* **Cálculo dentro das Server Actions/componentes:** rejeitado por misturar regra de negócio com a camada de apresentação (ver consequência negativa do ADR-001) e dificultar testes.

##### Consequências

* **Positivas:** 100% de previsibilidade matemática; precisão auditável; testes unitários velozes; atualização de alíquotas sem deploy, pois as faixas vêm de `FaixaTributaria` (RN17, RNF08).
* **Negativas:** a camada de dados precisa resolver corretamente todos os insumos (RBT12, faturamento médio ou estimado, despesas fixas) antes de chamar o motor; mudanças na *estrutura* da fórmula (não nos valores) exigem alteração de código e de testes.

**Drivers Relacionados:** AD-RF04, AD-QA01, AD-QA02, RF34, RF35, RF49, RN17, RN19, RN20, RNF08.

---

#### ADR-006 — Consulta de CNPJ em Base Pública da Receita via Adaptador com Fallback Manual

##### Decisão

No cadastro do negócio, o sistema consultará o CNPJ em uma base pública derivada dos **dados abertos de CNPJ da Receita Federal** (ex.: BrasilAPI), obtendo razão social, CNAE principal e opção pelo Simples Nacional/MEI (RF58). A consulta ficará atrás de uma interface própria (adaptador `ConsultaCnpj`), de modo que o provedor possa ser trocado sem afetar o domínio. A partir do CNAE, o Anexo do Simples é sugerido pela tabela `CnaeAnexo` (ADR-004). Se a consulta falhar, ou se o usuário for autônomo sem CNPJ, os dados são preenchidos manualmente (RF59).

##### Contexto e Problema

O imposto embutido no preço depende do regime tributário e do Anexo do Simples do negócio, que o público-alvo (MEI e autônomos) normalmente não sabe informar. Pedir esses dados manualmente aumenta a chance de erro na precificação, que é a proposta de valor central do produto.

##### Por que foi tomada

1. **Precisão fiscal:** CNAE e opção pelo Simples/MEI vêm do cadastro oficial, reduzindo erro de enquadramento.
2. **Simplicidade para o usuário:** o cadastro do negócio exige apenas o CNPJ.
3. **Baixo custo:** os dados abertos de CNPJ são gratuitos, adequados ao modelo freemium.

##### Alternativas Consideradas

* **Serpro Consulta CNPJ (API oficial paga):** dados oficiais em tempo real, mas com custo por consulta e contratação; pode substituir o provedor no futuro pelo mesmo adaptador.
* **Somente preenchimento manual:** rejeitado como caminho principal por depender de conhecimento fiscal que o público-alvo não tem; mantido como fallback.

##### Consequências

* **Positivas:** cadastro rápido e enquadramento fiscal mais confiável; provedor substituível.
* **Negativas:** dependência de serviço externo (disponibilidade e defasagem dos dados abertos); necessidade de tratar falhas e permitir edição manual; a tabela CNAE → Anexo precisa ser mantida atualizada (RN17).

**Drivers Relacionados:** AD-RF04, AD-RF05, RF58, RF59, RN17, RN24.
