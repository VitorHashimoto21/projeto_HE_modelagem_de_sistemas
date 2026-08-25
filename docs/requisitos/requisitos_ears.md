# Requisitos em Notação EARS

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

*Documento complementar — conversão dos Requisitos Funcionais e Não Funcionais para o padrão EARS (Easy Approach to Requirements Syntax)*

---

## 1. Autenticação, Multiempresa e Permissões

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF01 | Ubíquo | O sistema deve permitir que o usuário realize cadastro e login utilizando e-mail e senha. |
| RF02 | Ubíquo | O sistema deve permitir que um usuário cadastre mais de um negócio associado à mesma conta. |
| RF03 | Orientado a evento | **QUANDO** o usuário selecionar outro negócio vinculado à sua conta, o sistema deve alternar o contexto ativo mantendo a sessão de login corrente. |
| RF04 | Ubíquo | O sistema deve permitir que o Dono do negócio convide colaboradores para acessar o sistema. |
| RF05 | Ubíquo | O sistema deve disponibilizar três papéis de acesso para atribuição a colaboradores: Dono (acesso total), Gerente (acesso total exceto configurações) e Colaborador (acesso restrito a Vendas e Estoque). |
| RF06 | Feature opcional | **ONDE** o Dono configurar permissões granulares customizadas para um colaborador, o sistema deve aplicar essas permissões em vez do papel fixo padrão. |
| RN01 | Ubíquo | O sistema deve restringir o acesso de cada colaborador exclusivamente aos negócios aos quais ele foi convidado. |
| RN02 | Comportamento indesejado | **SE** um usuário sem o papel de Dono tentar convidar/remover colaboradores ou alterar permissões, **ENTÃO** o sistema deve impedir a ação e manter as permissões inalteradas. |

---

## 2. Cadastro de Produto

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF07 | Ubíquo | O sistema deve permitir o cadastro de itens dos tipos Produto Físico ou Serviço. |
| RF08 | Complexo (Estado + Evento) | **ENQUANTO** o tipo do item selecionado for Produto Físico, **QUANDO** o usuário submeter o formulário de cadastro, o sistema deve exigir o preenchimento de nome, custo, quantidade em estoque, estoque mínimo, unidade de medida e categoria. |
| RF09 | Complexo (Estado + Evento) | **ENQUANTO** o tipo do item selecionado for Serviço, **QUANDO** o usuário submeter o formulário de cadastro, o sistema deve exigir o preenchimento de nome, custo e categoria, e deve perguntar se há materiais/insumos associados. |
| RF10 | Ubíquo | O sistema deve exigir que todo produto/serviço tenha uma unidade de medida definida (ex.: unidade, kg, litro, hora, caixa). |
| RF11 | Ubíquo | O sistema deve exigir que todo produto/serviço seja associado a uma categoria da lista fixa: Serviços, Produtos, Alimentação, Vestuário, Beleza, Saúde, Casa, Tecnologia, Outros. |
| RF12 | Orientado a evento | **QUANDO** o usuário indicar que um Serviço possui materiais, o sistema deve permitir vincular múltiplos Produtos Físicos já cadastrados no Estoque como materiais desse serviço. |
| RF13 | Orientado a evento | **QUANDO** um material for vinculado a um Serviço, o sistema deve preencher automaticamente a quantidade padrão de 1 unidade por execução, permitindo que o usuário edite esse valor. |
| RF14 | Ubíquo | O sistema deve tratar o registro da quantidade em estoque de um Produto Físico como uma operação separada, disponível somente após a conclusão do cadastro do produto. |
| RN03 | Orientado a evento | **QUANDO** um Produto Físico for criado, o sistema deve inicializar seu estoque com quantidade igual a zero. |
| RN05 | Orientado a evento | **QUANDO** um Serviço com materiais vinculados for vendido, o sistema deve dar baixa automática no estoque desses materiais, na quantidade configurada. |

---

## 3. Estoque

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF15 | Orientado a evento | **QUANDO** o usuário registrar uma entrada de estoque, o sistema deve armazenar a quantidade informada e a data da movimentação. |
| RF16 | Orientado a evento | **QUANDO** uma venda for registrada, o sistema deve dar baixa automática no estoque dos itens e materiais envolvidos. |
| RF17 | Orientado a evento | **QUANDO** o usuário registrar uma baixa manual de estoque, o sistema deve exigir a seleção de um motivo dentre: Perda, Quebra, Uso interno, Doação ou Outro. |
| RF18 | Comportamento indesejado | **SE** o estoque de um produto for insuficiente no momento de uma venda, **ENTÃO** o sistema deve concluir a venda normalmente e sinalizar o estoque resultante como negativo. |
| RF19 | Orientado a estado | **ENQUANTO** o estoque atual de um produto estiver igual ou abaixo do estoque mínimo, o sistema deve exibir um alerta visual associado ao produto. |
| RF20 | Complexo (Evento + resposta condicional) | **QUANDO** um produto completar seu primeiro ciclo de entrada e saída de estoque, o sistema deve sugerir automaticamente um valor de estoque mínimo com base em percentual do histórico, e deve permitir que o usuário sobrescreva esse valor manualmente a qualquer momento. |
| RF21 | Ubíquo | O sistema deve exibir o alerta de estoque baixo tanto na notificação do sistema (dashboard/lista) quanto no indicador visual do cadastro do produto. |
| RN07 | Orientado a estado | **ENQUANTO** um produto não tiver completado ao menos 1 ciclo de entrada e saída registrado, o sistema deve manter o alerta de estoque baixo desativado para esse produto. |

---

## 4. Venda

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF22 | Feature opcional | **ONDE** o usuário informar um cliente na venda, o sistema deve associar a venda a esse cliente. |
| RF22b | Ubíquo | O sistema deve permitir o registro de uma venda sem cliente identificado. |
| RF23 | Ubíquo | O sistema deve permitir que uma venda contenha múltiplos itens, combinando produtos físicos e/ou serviços. |
| RF24 | Ubíquo | O sistema deve suportar as formas de pagamento Dinheiro, PIX, Cartão de Débito e Cartão de Crédito. |
| RF25 | Feature opcional | **ONDE** o usuário utilizar mais de uma forma de pagamento na mesma venda, o sistema deve permitir o registro do pagamento misto entre elas. |
| RF26 | Comportamento indesejado | **SE** a soma dos valores informados nas formas de pagamento for diferente do valor total da venda, **ENTÃO** o sistema deve impedir a conclusão do registro da venda. |
| RF27+RF28 | Complexo (Estado + Evento) | **ENQUANTO** a forma de pagamento selecionada for Cartão de Crédito, **QUANDO** o usuário definir o parcelamento (em até 12 vezes), o sistema deve gerar automaticamente as datas de vencimento das parcelas de forma mensal, a partir da data da venda. |
| RN09 | Orientado a evento | **QUANDO** uma venda for paga em Dinheiro, PIX ou Cartão de Débito, o sistema deve gerar lançamento imediato no fluxo de caixa. |
| RN10 | Orientado a evento | **QUANDO** uma venda for paga (total ou parcialmente) em Cartão de Crédito, o sistema deve gerar uma ou mais contas a receber com vencimento futuro. |
| RN12 | Orientado a evento | **QUANDO** uma venda for registrada, o sistema deve disparar a baixa de estoque dos itens envolvidos e o(s) lançamento(s) correspondente(s) no Financeiro. |

---

## 5. Financeiro

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF29 | Ubíquo | O sistema deve manter um fluxo de caixa com registro de entradas, saídas e saldo atualizado. |
| RF30 | Ubíquo | O sistema deve permitir o cadastro de contas a pagar e contas a receber, com data de vencimento. |
| RF31 | Orientado a evento | **QUANDO** o usuário registrar um pagamento ou recebimento parcial de uma conta, o sistema deve manter o valor restante em aberto. |
| RF32 | Ubíquo | O sistema deve classificar todo lançamento financeiro em uma das categorias fixas: Vendas, Fornecedores, Impostos, Salário, Outros. |
| RF33 | Orientado a evento | **QUANDO** uma venda for registrada, o sistema deve gerar automaticamente o(s) lançamento(s) correspondente(s) no módulo Financeiro, na categoria Vendas. |
| RN14 | Orientado a estado | **ENQUANTO** uma conta a receber de cartão de crédito não tiver sido recebida, o sistema deve manter esse valor fora do saldo de caixa atual. |

---

## 6. Calculadora de Precificação

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF34 | Orientado a evento | **QUANDO** o usuário solicitar o cálculo de preço de um item, o sistema deve calcular o preço de venda sugerido utilizando a fórmula Preço = Custo ÷ (1 − Margem%). |
| RF35 | Orientado a estado | **ENQUANTO** o item calculado for um Serviço com materiais vinculados, o sistema deve somar ao custo base o custo dos materiais vinculados, considerando a quantidade configurada de cada material. |
| RF36 | Orientado a evento | **QUANDO** o usuário iniciar o cálculo de preço de um item, o sistema deve sugerir uma margem de lucro padrão de acordo com a categoria do item, permitindo edição pelo usuário. |
| RF37 | Orientado a evento | **QUANDO** o usuário utilizar a Calculadora de Precificação, o sistema deve solicitar o regime tributário (MEI ou Simples Nacional) para o cálculo do imposto embutido no preço. |
| RF38 | Orientado a evento | **QUANDO** o regime tributário informado exigir cálculo por faixa, o sistema deve determinar a alíquota aplicável com base no RBT12 (Receita Bruta dos últimos 12 meses). |
| RF39 | Ubíquo | O sistema deve calcular automaticamente o RBT12 somando as vendas registradas no módulo Financeiro. |
| RF40 | Orientado a evento | **QUANDO** o cálculo de preço for concluído, o sistema deve exibir o resultado ao usuário e aguardar confirmação explícita antes de salvar o valor como preço de venda oficial. |
| RF41 | Orientado a evento | **QUANDO** um novo preço for confirmado pelo usuário, o sistema deve registrar essa alteração no histórico de preços do produto/serviço. |
| RN15 | Ubíquo | O sistema deve utilizar sempre o último preço confirmado pelo usuário como preço de venda oficial do produto/serviço nas vendas. |
| RN17 | Ubíquo | O sistema deve manter as faixas e percentuais de alíquota de MEI e Simples Nacional como configuração parametrizável, permitindo atualização sem alteração de código. |

---

## 7. Dashboard

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF42 | Ubíquo | O sistema deve exibir na tela inicial um resumo do dia contendo vendas do dia, saldo em caixa e alertas de estoque baixo. |
| RF43 | Ubíquo | O sistema deve exibir um gráfico com o histórico de vendas dos últimos dias/mês. |
| RF44 | Ubíquo | O sistema deve estruturar o dashboard de forma extensível, permitindo a adição de novos indicadores sem redesenho completo da tela. |

---

## 8. Modelo Freemium

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF45 | Ubíquo | O sistema deve diferenciar as funcionalidades disponíveis no plano gratuito das disponíveis exclusivamente no plano pago. |
| RF46 | Ubíquo | O sistema deve permitir uso ilimitado de produtos, vendas e lançamentos financeiros para negócios no plano gratuito. |
| RF47 | Feature opcional | **ONDE** o negócio estiver no plano pago, o sistema deve disponibilizar relatórios avançados e gestão de múltiplos colaboradores. |

---

## 9. Requisitos Não Funcionais

| ID | Padrão | Requisito EARS |
|---|---|---|
| RNF01 | Ubíquo | O sistema deve ser uma aplicação web acessível via navegador, com layout responsivo para desktop e mobile. |
| RNF02 | Ubíquo | O sistema deve isolar logicamente os dados de cada negócio, impedindo acesso cruzado entre contas (arquitetura multi-tenant). |
| RNF03 | Ubíquo | O sistema deve armazenar as senhas dos usuários utilizando hash seguro. |
| RNF04 | Ubíquo | O sistema deve estar em conformidade com a LGPD, incluindo política de privacidade, consentimento explícito e mecanismos de exportação/exclusão de dados pessoais. |
| RNF05 | Orientado a evento | **QUANDO** houver alteração em estoque ou em preço, o sistema deve registrar um log auditável contendo data, usuário responsável e motivo (quando aplicável). |
| RNF06 | Ubíquo | O sistema deve responder ao cálculo de precificação e do RBT12 em tempo adequado, mesmo com histórico extenso de vendas. |
| RNF07 | Orientado a evento | **QUANDO** o usuário alternar entre negócios vinculados à sua conta, o sistema deve manter a sessão ativa. |
| RNF08 | Ubíquo | O sistema deve manter as faixas e percentuais de alíquota de MEI e Simples Nacional como configuração parametrizável. |
| RNF09 | Ubíquo | O sistema deve executar rotina de backup dos dados financeiros e de estoque. |
| RNF10 | Ubíquo | O sistema deve manter uma arquitetura extensível nos módulos e no dashboard, suportando novos indicadores e integrações (Nota Fiscal, PIX) sem reestruturação do core. |