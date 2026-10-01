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
| RF05 | Ubíquo | O sistema deve disponibilizar três papéis de acesso para atribuição a colaboradores: Dono (acesso total), Gerente (acesso total exceto configurações) e Colaborador (acesso restrito a Vendas, Estoque e Dashboard restrito). |
| RF06 | Feature opcional | **ONDE** o Dono configurar permissões granulares customizadas para um colaborador (ex.: liberar apenas o lançamento de despesas operacionais), o sistema deve aplicar essas permissões em vez do papel fixo padrão. |
| RN01 | Ubíquo | O sistema deve restringir o acesso de cada colaborador exclusivamente aos negócios aos quais ele foi convidado. |
| RN02 | Comportamento indesejado | **SE** um usuário sem o papel de Dono tentar convidar/remover colaboradores ou alterar permissões, **ENTÃO** o sistema deve impedir a ação e manter as permissões inalteradas. |
| RF58 | Orientado a evento | **QUANDO** o usuário informar o CNPJ no cadastro de um negócio, o sistema deve consultar a base pública de CNPJ da Receita Federal e preencher razão social, CNAE principal e regime tributário (Simples Nacional/MEI). |
| RF59 | Complexo (Evento + resposta condicional) | **QUANDO** o CNAE principal for obtido, o sistema deve sugerir o Anexo do Simples (ou o tipo de atividade, para MEI) e permitir edição; **SE** o usuário não possuir CNPJ ou a consulta estiver indisponível, **ENTÃO** o sistema deve permitir o preenchimento manual desses dados. |
| RN24 | Ubíquo | O sistema deve aplicar um único Anexo do Simples por negócio sobre todo o faturamento (RBT12) do negócio. |

---

## 2. Cadastro de Produto

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF07 | Ubíquo | O sistema deve permitir o cadastro de itens dos tipos Produto Físico ou Serviço. |
| RF08 | Complexo (Estado + Evento) | **ENQUANTO** o tipo do item selecionado for Produto Físico, **QUANDO** o usuário submeter o formulário de cadastro, o sistema deve exigir o preenchimento de nome, custo, unidade de medida e categoria, aceitando estoque mínimo como campo opcional e sem solicitar quantidade em estoque. |
| RF09 | Complexo (Estado + Evento) | **ENQUANTO** o tipo do item selecionado for Serviço, **QUANDO** o usuário submeter o formulário de cadastro, o sistema deve exigir o preenchimento de nome, custo e categoria, e deve perguntar se há materiais/insumos associados. |
| RF10 | Ubíquo | O sistema deve exigir que todo produto/serviço tenha uma unidade de medida definida (ex.: unidade, kg, litro, hora, caixa). |
| RF11 | Ubíquo | O sistema deve exigir que todo produto/serviço seja associado a uma categoria da lista fixa: Serviços, Produtos, Alimentação, Vestuário, Beleza, Saúde, Casa, Tecnologia, Outros. |
| RF12 | Orientado a evento | **QUANDO** o usuário indicar que um Serviço possui materiais, o sistema deve permitir vincular múltiplos Produtos Físicos já cadastrados no Estoque como materiais desse serviço. |
| RF13 | Orientado a evento | **QUANDO** um material for vinculado a um Serviço, o sistema deve preencher automaticamente a quantidade padrão de 1 unidade por execução, permitindo que o usuário edite esse valor. |
| RF14 | Ubíquo | O sistema deve tratar o registro da quantidade em estoque de um Produto Físico como uma operação separada, disponível somente após a conclusão do cadastro do produto. |
| RN03 | Orientado a evento | **QUANDO** um Produto Físico for criado, o sistema deve inicializar seu estoque com quantidade igual a zero. |
| RN04 | Orientado a estado | **ENQUANTO** o item for do tipo Serviço, o sistema deve excluí-lo do controle de estoque e permitir vincular materiais; **ENQUANTO** for Produto Físico, deve incluí-lo no controle de estoque. |
| RF64 | Feature opcional | **ONDE** o usuário informar manualmente o preço de venda de um item, o sistema deve salvá-lo como preço oficial e registrar no histórico a origem Manual. |
| RN23 | Comportamento indesejado | **SE** o usuário tentar adicionar a uma venda um item sem preço oficial confirmado, **ENTÃO** o sistema deve impedir a inclusão e orientar a definição do preço. |
| RN05 | Orientado a evento | **QUANDO** um Serviço com materiais vinculados for vendido, o sistema deve dar baixa automática no estoque desses materiais, na quantidade configurada. |

---

## 3. Estoque

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF15 | Orientado a evento | **QUANDO** o usuário registrar uma entrada de estoque, **O SISTEMA DEVE** armazenar a quantidade informada e a data da movimentação. |
| RF16 | Orientado a evento | **QUANDO** uma venda for registrada, **O SISTEMA DEVE** dar baixa automática no estoque dos itens e materiais envolvidos. |
| RF17 | Orientado a evento | **QUANDO** o usuário registrar uma baixa manual de estoque, **O SISTEMA DEVE** exigir a seleção de um motivo dentre: Perda, Quebra, Uso interno, Doação ou Outro. |
| RF18 | Orientado a evento | **QUANDO** o usuário tentar finalizar uma venda com itens cujas quantidades excedam o saldo em estoque, **O SISTEMA DEVE** bloquear a finalização e exibir um alerta de 'Estoque Insuficiente' para os itens específicos. |
| RF19 | Orientado a estado | **ENQUANTO** o estoque atual de um produto estiver igual ou abaixo do estoque mínimo, o sistema deve exibir um alerta visual associado ao produto. |
| RF20 | Complexo (Evento + resposta condicional) | **QUANDO** um produto completar seu primeiro ciclo (ao menos uma entrada e uma saída), o sistema deve sugerir o estoque mínimo como ⌈consumo médio diário dos últimos 90 dias × dias de cobertura do negócio (padrão 7)⌉, e deve permitir que o usuário sobrescreva esse valor manualmente a qualquer momento. |
| RF21 | Ubíquo | O sistema deve exibir o alerta de estoque baixo tanto na notificação do sistema (dashboard/lista) quanto no indicador visual do cadastro do produto. |
| RN06 | Orientado a evento | **QUANDO** o estoque de um produto for insuficiente para a venda, **O SISTEMA DEVE** impedir a operação e não registrar a venda. |
| RN07 | Orientado a estado | **ENQUANTO** um produto não tiver completado ao menos 1 ciclo de entrada e saída registrado, **O SISTEMA DEVE** deve manter o alerta de estoque baixo desativado para esse produto. |
| RN08 | Complexo (Evento + Opcional) | **QUANDO** um produto completar o primeiro ciclo de entrada e saída, o sistema deve sugerir o estoque mínimo automaticamente; **ONDE** o usuário informar um valor manual, o sistema deve utilizá-lo no lugar do sugerido. |

---

## 4. Venda

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF22 | Feature opcional | **ONDE** o usuário informar um cliente na venda, o sistema deve associar a venda a esse cliente. |
| RF22b | Ubíquo | O sistema deve permitir o registro de uma venda sem cliente identificado. |
| RF23 | Ubíquo | O sistema deve permitir que uma venda contenha múltiplos itens, combinando produtos físicos e/ou serviços. |
| RF24 | Ubíquo | O sistema deve suportar as formas de pagamento Dinheiro, PIX, Cartão de Débito e Cartão de Crédito. |
| RF25 | Feature opcional | **ONDE** o usuário utilizar mais de uma forma de pagamento na mesma venda, o sistema deve permitir o registro do pagamento misto entre elas. |
| RF26 | Comportamento indesejado | **SE** a soma dos valores informados nas formas de pagamento for diferente do valor total da venda, **ENTÃO** o sistema deve impedir a conclusão do registro da venda, validando tanto na interface quanto no servidor. |
| RF27+RF28 | Complexo (Estado + Evento) | **ENQUANTO** a forma de pagamento selecionada for Cartão de Crédito, **QUANDO** o usuário definir o parcelamento (em até 12 vezes), o sistema deve gerar automaticamente as datas de vencimento das parcelas de forma mensal, a partir da data da venda. |
| RN09 | Orientado a evento | **QUANDO** uma venda for paga em Dinheiro, PIX ou Cartão de Débito, o sistema deve gerar lançamento imediato no fluxo de caixa. |
| RN10 | Orientado a evento | **QUANDO** uma venda for paga (total ou parcialmente) em Cartão de Crédito, o sistema deve gerar uma ou mais contas a receber com vencimento futuro. |
| RN12 | Orientado a evento | **QUANDO** uma venda for registrada, o sistema deve disparar a baixa de estoque dos itens envolvidos e o(s) lançamento(s) correspondente(s) no Financeiro. |
| RF65 | Comportamento indesejado | **SE** um usuário sem papel de Dono ou Gerente (e sem permissão granular) tentar cancelar uma venda, **ENTÃO** o sistema deve impedir a ação; **QUANDO** um usuário autorizado cancelar uma venda, o sistema deve exigir o motivo e registrar quem cancelou e quando. |
| RN25 | Orientado a evento | **QUANDO** uma venda for cancelada, o sistema deve, em uma única transação, marcá-la como Cancelada, devolver o estoque dos produtos e materiais, cancelar as contas a receber abertas e estornar os valores já recebidos (exceto o crédito de troca), removendo-a do RBT12, do faturamento e do CMV%. |
| RF66 | Feature opcional | **ONDE** o operador optar por troca no cancelamento, o sistema deve registrar uma nova venda vinculada à original com itens de valor total menor ou igual ao original e reembolsar a diferença na forma escolhida. |
| RN26 | Comportamento indesejado | **SE** o crédito de troca solicitado for maior que o valor da venda original já recebido no caixa, **ENTÃO** o sistema deve limitar o crédito a esse valor e exigir que o restante da nova venda seja pago por outra forma. |
| RN11 | Orientado a evento | **QUANDO** um pagamento em cartão de crédito for parcelado, o sistema deve dividir o valor igualmente entre as parcelas, arredondando em centavos e somando a diferença à 1ª parcela, sem descontar taxa de maquininha. |

---

## 5. Financeiro

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF29 | Ubíquo | O sistema deve manter um fluxo de caixa com registro de entradas, saídas e saldo atualizado. |
| RF30 | Ubíquo | O sistema deve permitir o cadastro de contas a pagar e contas a receber, com data de vencimento e categoria. |
| RF31 | Orientado a evento | **QUANDO** o usuário registrar um pagamento ou recebimento parcial de uma conta, o sistema deve manter o valor restante em aberto. |
| RF32 | Ubíquo | O sistema deve classificar todo lançamento financeiro em uma das categorias fixas: Vendas, Fornecedores, Impostos, Salário, Outros. |
| RF33 | Orientado a evento | **QUANDO** uma venda for registrada, o sistema deve gerar automaticamente o(s) lançamento(s) correspondente(s) no módulo Financeiro, na categoria Vendas. |
| RN14 | Orientado a estado | **ENQUANTO** uma conta a receber de cartão de crédito não tiver sido recebida, o sistema deve manter esse valor fora do saldo de caixa atual. |
| RN13 | Orientado a evento | **QUANDO** um lançamento ou conta a receber for gerado automaticamente por uma venda, o sistema deve classificá-lo na categoria Vendas. |
| RN22 | Orientado a evento | **QUANDO** o usuário registrar um pagamento ou recebimento (total ou parcial) de uma conta, o sistema deve gerar um lançamento no fluxo de caixa vinculado à conta, com a categoria da conta, e atualizar o status da conta. |
| RF67 | Orientado a evento | **QUANDO** um novo mês iniciar, o sistema deve gerar uma conta a pagar para cada despesa fixa ativa (e para o DAS, se MEI), com vencimento e categoria definidos na despesa, sem duplicar contas do mesmo mês. |

---

## 6. Calculadora de Precificação

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF34 | Orientado a evento | **QUANDO** o usuário solicitar o cálculo de preço de um item, o sistema deve calcular o preço de venda sugerido utilizando a fórmula Preço = Custo Total ÷ (1 − (Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem%)). |
| RF35 | Orientado a estado | **ENQUANTO** o item calculado for um Serviço com materiais vinculados, o sistema deve somar ao custo base o custo dos materiais vinculados, considerando a quantidade configurada de cada material. |
| RF36 | Orientado a evento | **QUANDO** o usuário iniciar o cálculo de preço de um item, o sistema deve sugerir a margem padrão da categoria do item (tabela parametrizável inicializada com os percentuais de presunção da Lei 9.249/1995), permitindo edição pelo usuário. |
| RF37 | Orientado a evento | **QUANDO** o usuário utilizar a Calculadora de Precificação, o sistema deve exibir o regime tributário do negócio (obtido no cadastro) para conferência. |
| RF38 | Complexo (Estado + Evento) | **ENQUANTO** o negócio for do Simples Nacional, **QUANDO** o cálculo de preço for solicitado, o sistema deve calcular a alíquota efetiva pelo Anexo do negócio e pelo RBT12: (RBT12 × Alíquota nominal − Parcela a deduzir) ÷ RBT12. |
| RF39 | Ubíquo | O sistema deve calcular automaticamente o RBT12 somando o valor total de todas as vendas não canceladas registradas nos últimos 12 meses, independentemente da forma de pagamento ou do recebimento. |
| RF40 | Orientado a evento | **QUANDO** o cálculo de preço for concluído, o sistema deve exibir o resultado ao usuário e aguardar confirmação explícita antes de salvar o valor como preço de venda oficial. |
| RF41 | Orientado a evento | **QUANDO** um novo preço for confirmado pelo usuário, o sistema deve registrar essa alteração no histórico de preços do produto/serviço. |
| RN16 | Orientado a evento | **QUANDO** um novo preço for confirmado, o sistema deve criar um novo registro de histórico, preservando todos os registros anteriores. |
| RF60 | Orientado a estado | **ENQUANTO** o negócio for MEI, o sistema deve somar o valor mensal do DAS às despesas fixas e utilizar Imposto% = 0 no markup e no ponto de equilíbrio. |
| RF61 | Comportamento indesejado | **SE** o RBT12 de um negócio MEI ultrapassar o limite anual de faturamento do MEI, **ENTÃO** o sistema deve exibir um alerta ao usuário. |
| RF48 | Ubíquo | O sistema deve permitir o cadastro das despesas fixas mensais do negócio, com descrição e valor mensal. |
| RF49 | Orientado a evento | **QUANDO** o usuário solicitar o cálculo de preço, o sistema deve calcular Desp. Fixas% dividindo o total de despesas fixas mensais pelo faturamento médio mensal (RBT12 ÷ meses com vendas, até 12). |
| RF50 | Orientado a estado | **ENQUANTO** o negócio não possuir histórico de vendas, o sistema deve solicitar capacidade mensal e ticket médio, recomendar faturamento estimado = capacidade × ticket médio e permitir que o usuário edite esse valor. |
| RF51 | Ubíquo | O sistema deve permitir que o usuário informe a taxa média de cartão/maquininha (%) do negócio para uso no cálculo de preço. |
| RF52 | Feature opcional | **ONDE** o usuário informar um percentual de comissão para um produto/serviço, o sistema deve somá-lo às despesas variáveis no cálculo de preço desse item. |
| RF53 | Orientado a evento | **QUANDO** a Calculadora exibir a margem de lucro, o sistema deve informar que a Margem% é o ganho líquido do dono por venda, e não o lucro total do negócio. |
| RF54 | Comportamento indesejado | **SE** o faturamento estimado for menor que o ponto de equilíbrio mensal, **ENTÃO** o sistema deve exibir um alerta na Calculadora. |
| RN19 | Comportamento indesejado | **SE** a soma de Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem% for maior ou igual a 100%, **ENTÃO** o sistema deve bloquear o cálculo e informar que o preço é inviável com os parâmetros atuais. |
| RN20 | Ubíquo | O sistema deve utilizar taxa de cartão e comissão somente na formação do preço, sem descontá-las dos lançamentos financeiros nem gerar repasse automático no MVP. |
| RN21 | Orientado a evento | **QUANDO** uma venda for registrada, inclusive com pagamento em cartão de crédito ainda não recebido, o sistema deve considerar seu valor total no RBT12 e no faturamento bruto do mês da venda. |
| RN15 | Ubíquo | O sistema deve utilizar sempre o último preço confirmado pelo usuário como preço de venda oficial do produto/serviço nas vendas. |
| RN17 | Ubíquo | O sistema deve manter as faixas e percentuais de alíquota de MEI e Simples Nacional como configuração parametrizável, permitindo atualização sem alteração de código. |

---

## 7. Dashboard

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF42 | Orientado a estado | **ENQUANTO** o usuário for Dono ou Gerente, o sistema deve exibir na tela inicial um resumo do dia contendo vendas do dia, saldo em caixa e alertas de estoque baixo. |
| RF43 | Ubíquo | O sistema deve exibir um gráfico com o histórico de vendas dos últimos dias/mês. |
| RF44 | Ubíquo | O sistema deve estruturar o dashboard de forma extensível, permitindo a adição de novos indicadores sem redesenho completo da tela. |
| RF55 | Ubíquo | O sistema deve calcular e exibir o ponto de equilíbrio mensal PE = Despesas fixas ÷ (1 − CMV% − Imposto% − Taxa média de cartão%). |
| RF56 | Ubíquo | O sistema deve calcular o faturamento meta mensal = Despesas fixas ÷ (1 − CMV% − Imposto% − Taxa média de cartão% − Margem meta%). |
| RF57 | Orientado a estado | **ENQUANTO** o faturamento bruto do mês for menor que o PE, o sistema deve exibir o semáforo em Vermelho; **ENQUANTO** estiver entre o PE e a Meta, em Amarelo; **ENQUANTO** for maior ou igual à Meta, em Verde. Sem margem meta configurada, o sistema deve indicar apenas a posição em relação ao PE e solicitar a configuração da meta. |
| RF62 | Complexo (Evento + Estado) | **QUANDO** uma venda for registrada, o sistema deve gravar o custo unitário de cada item vendido; **ENQUANTO** o negócio não possuir histórico de vendas, o sistema deve usar o CMV% estimado informado pelo usuário no lugar do CMV% apurado. |
| RF63 | Orientado a estado | **ENQUANTO** o usuário for Colaborador, o sistema deve exibir no Dashboard apenas vendas do dia e alertas de estoque baixo, ocultando saldo em caixa, semáforo, ponto de equilíbrio e gráficos de faturamento. |
| RF68 | Orientado a estado | **ENQUANTO** o usuário for Dono ou Gerente, o sistema deve exibir a projeção de caixa dos próximos 6 meses: saldo atual + contas a receber abertas − contas a pagar abertas por mês, usando as despesas fixas ativas para meses sem contas geradas. |

---

## 8. Modelo Freemium

| ID | Padrão | Requisito EARS |
|---|---|---|
| RF45 | Ubíquo | O sistema deve diferenciar as funcionalidades disponíveis no plano gratuito das disponíveis exclusivamente no plano pago. |
| RF46 | Ubíquo | O sistema deve permitir uso ilimitado de produtos, vendas e lançamentos financeiros para negócios no plano gratuito. |
| RF47 | Complexo (Opcional + Indesejado) | **ONDE** o negócio estiver no plano pago, o sistema deve disponibilizar relatórios avançados e gestão de múltiplos colaboradores; **SE** um negócio do plano gratuito tentar convidar um segundo colaborador, **ENTÃO** o sistema deve exigir o upgrade para o plano pago. |
| RN18 | Comportamento indesejado | **SE** um negócio do plano gratuito atingir qualquer volume de produtos, vendas ou lançamentos, **ENTÃO** o sistema não deve bloquear novos registros por esse motivo, restringindo apenas funcionalidades exclusivas do plano pago. |

---

## 9. Requisitos Não Funcionais

| ID | Padrão | Requisito EARS |
|---|---|---|
| RNF01 | Ubíquo | O sistema deve ser uma aplicação web acessível via navegador, com layout responsivo para desktop e mobile. |
| RNF02 | Ubíquo | O sistema deve isolar logicamente os dados de cada negócio, impedindo acesso cruzado entre contas (arquitetura multi-tenant). |
| RNF03 | Ubíquo | O sistema deve armazenar as senhas dos usuários utilizando hash seguro. |
| RNF04 | Ubíquo | O sistema deve estar em conformidade com a LGPD, incluindo política de privacidade, consentimento explícito e mecanismos de exportação/exclusão de dados pessoais. |
| RN27 | Orientado a evento | **QUANDO** o usuário solicitar a exclusão da conta, o sistema deve bloquear o acesso, anonimizar seus dados pessoais e os dos clientes dos negócios em que for o único Dono, e manter por 5 anos os registros fiscais e financeiros sem identificação pessoal. |
| RNF05 | Orientado a evento | **QUANDO** houver alteração em estoque ou em preço, o sistema deve registrar um log auditável contendo data, usuário responsável e motivo (quando aplicável). |
| RNF06 | Ubíquo | O sistema deve responder ao cálculo de precificação e do RBT12 em tempo adequado, mesmo com histórico extenso de vendas. |
| RNF07 | Orientado a evento | **QUANDO** o usuário alternar entre negócios vinculados à sua conta, o sistema deve manter a sessão ativa. |
| RNF08 | Ubíquo | O sistema deve manter as faixas e percentuais de alíquota de MEI e Simples Nacional como configuração parametrizável. |
| RNF09 | Ubíquo | O sistema deve executar rotina de backup dos dados financeiros e de estoque. |
| RNF10 | Ubíquo | O sistema deve manter uma arquitetura extensível nos módulos e no dashboard, suportando novos indicadores e integrações (Nota Fiscal, PIX) sem reestruturação do core. |
