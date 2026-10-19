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
|**ADR-003**|Autenticação via Supabase Auth (definitivo) com Autorização no Backend|Alterar o mecanismo de gerenciamento de sessões e migrar credenciais registradas.|**Aceita**|
|**ADR-004**|Parametrização Tributária em Banco de Dados e Motor de RBT12|Reescrever a lógica de cálculo de impostos e a integração do módulo financeiro.|**Aceita**|
|**ADR-005**|Motor de Precificação Determinístico (Markup Completo) em TypeScript Puro|Reescrever o motor de cálculo, seus testes e o formato do histórico de preços.|**Aceita**|
|**ADR-006**|Consulta de CNPJ em Base Pública da Receita via Adaptador com Fallback Manual|Trocar o provedor afeta o cadastro de negócios e a origem dos dados fiscais (CNAE, regime, anexo).|**Aceita**|
|**ADR-007**|Cobrança do Plano Pago via Adaptador de Gateway de Pagamento (Stripe)|Trocar o gateway afeta assinaturas ativas, webhooks e dados de cobrança dos clientes.|**Proposta**|
|**ADR-008**|Administrador da Plataforma com Acesso de Suporte Liberado pelo Dono|Mudar o modelo de acesso altera a Política de Privacidade (novo aceite de todos os usuários), o contexto de autorização e o registro de auditoria.|**Aceita**|
|**ADR-009**|Domínio Próprio `.com.br` e Envio de E-mails pelo Resend (API e SMTP do Supabase Auth)|O domínio vira a identidade do produto (remetente, links dos e-mails, endereço do app e reputação de envio); trocá-lo depois de lançado afeta usuários, configurações de autenticação e entregabilidade.|**Aceita**|

---

#### O que Deliberadamente Não Tem ADR

|Tema|Motivo para Não Ter ADR|
|-|-|
|**TailwindCSS / shadcn/ui**|Escolha de estilização visual; pode ser substituída sem alterar os contratos da API ou a lógica de domínio do ERP.|
|**Provedor de Hospedagem (Vercel + Supabase)**|Escolhido para o MVP (Vercel para a aplicação e rotinas agendadas; Supabase para banco e autenticação), com ambientes separados de desenvolvimento, homologação (`DEVELOP`) e produção (`main`), cada um com banco e credenciais próprios (RNF11). Não tem ADR porque a conexão com o banco é uma string PostgreSQL padrão tratada pelo Prisma, permitindo migrar de infraestrutura sem reescrever código.|
|**Ferramenta de Testes (Vitest)**|Escolha local e barata de trocar; não altera contratos, dados nem segurança.|
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

A persistência de dados utilizará um banco de dados relacional **PostgreSQL**, acessado através do **Prisma ORM**. O isolamento entre diferentes empresas (*multi-tenancy*) será feito de forma lógica, incluindo a coluna `negocio_id` em **todas** as tabelas operacionais do sistema — inclusive as tabelas filhas (`MaterialServico`, `MovimentacaoEstoque`, `HistoricoPreco`, `ItemVenda`, `Pagamento`, `Parcela`), cujo valor é sempre igual ao do registro pai.

O filtro é aplicado por uma **extensão do Prisma Client** (o "cliente do negócio"), que injeta `negocioId` em toda leitura, criação, alteração e exclusão e recusa operações sem contexto de negócio. Como o Supabase publica automaticamente uma API REST sobre o schema `public`, o **Row Level Security (RLS) fica ligado em todas as tabelas, sem nenhuma policy**: a API pública não lê nem grava nada, enquanto o Prisma, conectado com o papel privilegiado do banco, continua operando normalmente.

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
* **Negativas:** Todas as consultas no backend devem passar pelo cliente do negócio para conter o filtro do `negocio_id`; a coluna redundante nas tabelas filhas precisa ser preenchida (e testada) igual à do pai; toda tabela nova precisa nascer com RLS ligado (verificado em teste); necessidade de configurar Connection Pooling (pgBouncer) para evitar estourar o limite de conexões simultâneas do PostgreSQL durante picos de requisições serverless.

##### Alternativas Consideradas (isolamento das tabelas filhas)

* **Isolar as tabelas filhas apenas pela relação com o pai:** rejeitado — exige disciplina em cada consulta, impede um filtro uniforme na extensão e impede RLS por negócio no futuro.
* **Policies de RLS por negócio usando o usuário do Supabase:** adiado — defesa em profundidade, mas o Prisma não usa o JWT do usuário por padrão; pode ser adotado depois sem mudar o modelo, já que todas as tabelas têm `negocio_id`.

**Drivers Relacionados:** AD-C02, AD-RF03, RN01, RNF02, RNF09.

---

#### ADR-003 — Autenticação e Autorização Centralizada no Backend

##### Decisão

A autenticação será gerenciada pelo **Supabase Auth** (decisão definitiva; Auth.js permanece como alternativa rejeitada). A credencial (senha com hash seguro — RNF03) fica **somente** no Supabase Auth: a tabela `Usuario` da aplicação não tem campo de senha, e `Usuario.id` recebe o mesmo UUID de `auth.users.id`, gravado no cadastro. A autorização baseada em papéis -  (RBAC - Role-Based Access Control) - (Dono, Gerente, Colaborador) e permissões customizadas será validada exclusivamente no servidor em cada requisição de API ou Server Action, utilizando uma tabela intermediária `MembroNegocio`. Toda e qualquer consulta ao banco de dados deverá obrigatoriamente incluir a cláusula de filtro `where: { negocioId }` validada pelo middleware de sessão.

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

Os parâmetros fiscais oficiais serão armazenados em tabelas de parâmetros no banco de dados, cada registro com fonte legal e data de vigência: faixas, alíquotas nominais e parcelas a deduzir por Anexo do Simples Nacional (`FaixaTributaria`, com limites contínuos e regra `rbt12De < RBT12 ≤ rbt12Ate`), tabela CNAE → Anexo (`CnaeAnexo`), valor do DAS e limite anual do MEI (`ParametroMei`), limite e anexos do Fator R (`ParametroFatorR`) e margens padrão por categoria baseadas nos percentuais de presunção (`MargemPadraoCategoria`). Os valores iniciais ficam em um arquivo de dados versionado no repositório (`docs/prisma_base/parametros_fiscais_seed.json`) e são carregados no banco por um comando de carga: atualizar um parâmetro exige editar o arquivo e rodar a carga, sem alterar código nem fazer deploy da aplicação. Uma tela de administração fica para depois do MVP. Para CNAEs sujeitos ao Fator R, o anexo efetivo (III ou V) é calculado pela folha de salários ÷ RBT12 (RF69, RN28). O RBT12 será calculado por competência, via consultas agregadas temporais na tabela `Venda` (todas as vendas não canceladas, inclusive as ainda não recebidas — RN21), sobre os **12 meses anteriores ao mês do cálculo**; com histórico menor, é proporcionalizado (média mensal × 12, ou faturamento estimado × 12 sem histórico), de modo que nunca é zero. No Simples, a alíquota efetiva é `(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12`, usando o Anexo do negócio (RN24); no MEI, o imposto entra como despesa fixa (DAS) e não como percentual (RF60); no regime Autônomo (sem CNPJ), o Imposto% é o percentual informado pelo usuário no cadastro (RF59).

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

No cadastro do negócio, o sistema consultará o CNPJ na **BrasilAPI**, base pública derivada dos dados abertos de CNPJ da Receita Federal (gratuita e sem cadastro), com tempo limite e fallback manual, obtendo razão social, CNAE principal e opção pelo Simples Nacional/MEI (RF58). A consulta ficará atrás de uma interface própria (adaptador `ConsultaCnpj`), de modo que o provedor possa ser trocado sem afetar o domínio. A partir do CNAE, o Anexo do Simples é sugerido pela tabela `CnaeAnexo` (ADR-004). Se a consulta falhar, ou se o usuário for autônomo sem CNPJ, os dados são preenchidos manualmente (RF59).

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

---

#### ADR-007 — Cobrança do Plano Pago via Adaptador de Gateway de Pagamento (Stripe)

> **Status: Proposta.** Fora do caminho crítico do MVP. Implementação na SPEC-015 (opcional), se houver tempo no semestre ou na continuação do projeto rumo à produção.

##### Decisão

No MVP, a troca de plano é **simulada** (RF73): uma única função de domínio (`alterarPlano(negocioId, plano, origem)`) muda `Negocio.plano` e registra quem e quando. A cobrança real será feita pelo **Stripe**, atrás de uma interface própria (adaptador `GatewayPagamento`), usando o checkout hospedado, o portal do cliente e webhooks. O webhook é a única fonte que muda o plano quando a cobrança real estiver ativa, chamando a mesma função `alterarPlano` com `origem = GATEWAY`. Os ambientes de desenvolvimento e homologação usam sempre as chaves de **modo de teste**; somente produção usa chaves reais (RNF11).

##### Contexto e Problema

O modelo freemium (RF45–RF47) precisa de um caminho para o negócio passar ao plano pago. Integrar cobrança real exige assinatura, webhooks, inadimplência e cancelamento — escopo que compete com as 14 Specs do MVP. Ao mesmo tempo, o projeto deve seguir para homologação e produção depois do semestre, e a troca do mecanismo não pode exigir retrabalho nas regras de plano.

##### Por que foi tomada

1. **Prazo do MVP protegido:** a troca simulada custa horas; a cobrança real fica isolada numa Spec opcional.
2. **Extensibilidade (RNF10):** um único ponto de troca de plano e um adaptador permitem trocar simulação por gateway (ou um gateway por outro) sem tocar nas guardas de plano.
3. **Testabilidade:** o Stripe oferece modo de teste gratuito, cartões de teste, CLI para webhooks locais e simulação de tempo para renovações.

##### Alternativas Consideradas

* **Mercado Pago (assinaturas):** marca conhecida pelo MEI e Pix forte, mas API de assinaturas e sandbox menos estáveis; possível segunda implementação do mesmo adaptador.
* **Asaas:** focado no Brasil (boleto e Pix recorrentes), comunidade e SDK menores.
* **Integrar o gateway direto no MVP:** rejeitado por custo de prazo (~5–6 dias de uma pessoa, mais testes).

##### Consequências

* **Positivas:** MVP entrega a diferença entre planos sem risco; caminho claro para cobrança real; custo zero em teste.
* **Negativas:** quando ativada, exige campos de assinatura no `Negocio` (id do cliente e da assinatura no gateway, status e validade), tratamento de inadimplência com período de tolerância, rota de webhook com verificação de assinatura e idempotência, e conta verificada (CNPJ) para cobrar em produção. Taxas por transação a confirmar na tabela oficial do gateway na época da ativação.

**Drivers Relacionados:** AD-QA05, RF45, RF46, RF47, RF73, RN18, RNF10, RNF11.

---

#### ADR-008 — Administrador da Plataforma com Acesso de Suporte Liberado pelo Dono

> **Status: Aceita em 17/10/2026.** Implementação na SPEC-018 (somente leitura) e na SPEC-019 (edição, emergência, ações de plataforma e 2º fator).

##### Decisão

O HE terá um **Administrador da plataforma**: um atributo da conta (`Usuario.administradorEm`), concedido e retirado só por script, numa conta **exclusiva** que nunca é membro de negócio. Sem nenhuma liberação, o Administrador vê apenas os **metadados** dos negócios. Para ver dados de um negócio, precisa de uma **liberação do Dono** (`AcessoSuporte`), com motivo, módulos e prazo, revogável a qualquer momento. Com ela, entra em **modo suporte**: um contexto de autorização próprio, montado no servidor a cada requisição a partir da liberação, com a matriz módulo × ação restrita ao que foi liberado (só *ver* na SPEC-018), dados pessoais mascarados e cada passo gravado num **registro de auditoria só de inclusão** (`RegistroSuporte`), visível ao Dono.

##### Contexto e Problema

A equipe precisa atender pedidos dos usuários (entender um problema, conferir e, na SPEC-019, corrigir registros) sem pedir senhas. Ao mesmo tempo, a Política de Privacidade define o HE como **operador** dos dados do negócio: o acesso só é legítimo por instrução do Dono (controlador). O isolamento entre negócios é garantido no código (`comNegocio`, autorização no servidor — ADR-003) e no banco (gatilhos e RLS — ADR-002); o Prisma conecta como dono das tabelas, então um caminho de acesso mal desenhado exporia todos os negócios.

##### Por que foi tomada

1. **LGPD:** o acesso acontece por liberação do controlador, com finalidade (motivo), escopo, prazo e registro — princípios de finalidade, necessidade e transparência.
2. **Isolamento preservado:** a exceção é estreita e conferida no servidor a cada requisição; sem liberação ativa, nada muda em relação ao ADR-002.
3. **Responsabilização:** o Administrador age em nome próprio e tudo fica num log imutável que o Dono consulta.
4. **Entrega em etapas:** somente leitura primeiro (SPEC-018); escrita, emergência e 2º fator depois (SPEC-019).

##### Alternativas Consideradas

* **Superusuário com acesso livre a todos os negócios:** rejeitado — contraria o papel de operador, a promessa de isolamento da Política e o RNF02.
* **"Entrar como o usuário" (impersonation):** rejeitado — as ações apareceriam como se fossem do usuário, sem responsabilização real.
* **Pedir a senha do usuário:** rejeitado — viola o RNF03 e qualquer prática de segurança.
* **Administrador como membro do negócio (convite):** rejeitado — misturaria o suporte com a equipe, contaria no limite do plano gratuito e não teria prazo nem registro próprio.

##### Consequências

* **Positivas:** suporte possível sem senha; Dono no controle; trilha de auditoria completa; base pronta para a edição da SPEC-019.
* **Negativas:** nova versão da Política e dos Termos, com novo aceite de todos os usuários; um segundo tipo de contexto de autorização a manter em todas as ações; até a SPEC-019, a conta de Administrador fica sem 2º fator (risco mitigado por somente leitura, liberação do Dono, sessão de 8 h e registro).

**Drivers Relacionados:** RF74–RF78, RN01, RN30–RN32, RNF02, RNF03, RNF04, RNF05, RNF12.

---

#### ADR-009 — Domínio Próprio `.com.br` e Envio de E-mails pelo Resend

> **Status: Aceita em 18/10/2026** (decisão da equipe durante a homologação da SPEC-018). Só configuração: o código de envio já existe. Aguarda a compra do domínio.

##### Decisão

O HE terá um **domínio próprio `.com.br`, registrado no Registro.br** (titular com CPF ou CNPJ de um responsável da equipe). O domínio será **verificado no Resend** (registros SPF e DKIM no DNS, e DMARC), que continua sendo o serviço de envio:

1. **E-mails do app pela API do Resend** (`enviarEmail`, já integrado): aviso de "você já tem conta" (SPEC-002), convites da equipe (SPEC-005) e avisos do acesso de suporte ao Dono (SPEC-018). Basta trocar `EMAIL_REMETENTE` na Vercel para um endereço do domínio (ex.: `Health Enterprise <nao-responda@dominio.com.br>`).
2. **E-mails da autenticação pelo Resend como SMTP do Supabase Auth** (confirmação de conta e recuperação de senha), com os modelos de e-mail editados para o link com `token_hash`, que funciona em qualquer navegador ou aparelho.

Começa no **plano gratuito do Resend** (3.000 e-mails por mês, 100 por dia, 1 domínio); o plano pago entra quando o volume passar disso. Cada ambiente (RNF11) usa a própria chave do Resend. O mesmo domínio poderá depois ser o endereço do app (produção no domínio principal; homologação num subdomínio).

##### Contexto e Problema

Sem domínio próprio, o remetente é o de teste do Resend (`onboarding@resend.dev`), que **só entrega ao e-mail da conta Resend**: convites e avisos do suporte a qualquer outra pessoa falham (o sistema mostra o link copiável, OPEN-004 da SPEC-005). Os e-mails da autenticação saem pelo serviço padrão do Supabase, que não permite editar os modelos: o link de confirmação só funciona no mesmo navegador em que a conta foi criada, e abrir em outro (ou um leitor de links do provedor de e-mail) mostra "Este link expirou" (visto na homologação da SPEC-018). O Resend não oferece domínio compartilhado para enviar a qualquer destinatário: o domínio verificado é pré-requisito.

##### Por que foi tomada

1. **Destrava o que já existe:** o Resend já está integrado; com o domínio, convites, avisos e confirmação de conta chegam a qualquer e-mail, sem mudar código.
2. **Corrige a confirmação de conta:** o SMTP próprio libera a edição dos modelos (`token_hash`).
3. **Custo baixo:** cerca de R$ 40 por ano pelo `.com.br` e plano gratuito do Resend no início.
4. **Identidade:** remetente e links com o nome do produto aumentam a confiança e a entregabilidade (menos e-mails no spam).

##### Alternativas Consideradas

* **Seguir sem domínio:** rejeitado — convites e avisos não chegam a terceiros e o link de confirmação continua falhando em outro navegador; inviável para produção.
* **Domínio próprio com outro provedor de envio (Brevo, Amazon SES):** rejeitado — exige refazer a integração e a configuração sem ganho no volume do MVP; o envio fica numa única função (`enviarEmail`), então a troca futura continua possível (o SES fica mais barato em grande volume).
* **Domínio `.com` em registrador internacional:** rejeitado como primeira opção — preço em dólar; o `.com.br` combina com o público (MEI e autônomos no Brasil). Fica como alternativa se o nome desejado não estiver livre em `.com.br`.

##### Consequências

* **Positivas:** e-mails a qualquer endereço; confirmação de conta funcionando em qualquer navegador; remetente com a marca do HE; nenhuma mudança de código.
* **Negativas:** custo anual e **responsabilidade pela renovação** (domínio vencido derruba e-mails e, depois, o endereço do app); cuidar do DNS (SPF, DKIM, DMARC) e da reputação de envio; limite de 100 e-mails por dia no plano gratuito, a acompanhar. O Resend só **envia**: um e-mail de contato que **receba** mensagens (ex.: o contato dos textos legais) precisa de caixa ou redirecionamento, a decidir na configuração.

**Passos de configuração (quando o domínio for comprado):** registrar o domínio no Registro.br → adicionar e verificar o domínio no Resend (registros DNS) → trocar `EMAIL_REMETENTE` na Vercel (homologação e, depois, produção) → no Supabase Auth, ativar o SMTP próprio com o Resend e editar os modelos de confirmação e recuperação para o link com `token_hash` → refazer o teste de convite (SPEC-005, T19) e de confirmação de conta (SPEC-002) com um e-mail de fora da equipe.

**Drivers Relacionados:** RF01, RF72, RF75, RF76, RNF11.
