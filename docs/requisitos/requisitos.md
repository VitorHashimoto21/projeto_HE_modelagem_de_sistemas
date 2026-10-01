# Requisitos Funcionais, Não Funcionais e Regras de Negócio

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

*Documento complementar à Visão de Negócio — Agosto de 2026*

---

## Sumário

- [1. Autenticação, Multiempresa e Permissões](#1-autenticação-multiempresa-e-permissões)
- [2. Cadastro de Produto](#2-cadastro-de-produto)
- [3. Estoque](#3-estoque)
- [4. Venda](#4-venda)
- [5. Financeiro](#5-financeiro)
- [6. Calculadora de Precificação](#6-calculadora-de-precificação)
- [7. Dashboard](#7-dashboard)
- [8. Modelo Freemium](#8-modelo-freemium)
- [9. Requisitos Não Funcionais](#9-requisitos-não-funcionais)
- [10. Regras de Negócio Consolidadas](#10-regras-de-negócio-consolidadas)

---

## 1. Autenticação, Multiempresa e Permissões

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF01 | O sistema deve permitir cadastro e login via e-mail e senha. |
| RF02 | Um usuário deve poder cadastrar mais de um negócio (empresa) na mesma conta. |
| RF03 | O usuário deve poder alternar entre negócios sem precisar realizar novo login (sessão única). |
| RF04 | O dono do negócio deve poder convidar colaboradores para acessar o sistema. |
| RF05 | O sistema deve oferecer 3 papéis fixos de acesso: **Dono** (acesso total), **Gerente** (acesso total exceto configurações) e **Colaborador** (acesso restrito a Vendas e Estoque, sem Financeiro). |
| RF06 | O dono deve poder configurar permissões granulares customizadas por módulo para um colaborador, além dos 3 papéis fixos (ex.: liberar a um Colaborador apenas o lançamento de despesas operacionais no Financeiro, sem acesso a saldo, relatórios, custos fixos ou margens). |

### Regras de Negócio

- **RN01** — Todos os dados (produtos, estoque, vendas, financeiro) são isolados por negócio; um colaborador só acessa os dados do(s) negócio(s) ao qual foi convidado.
- **RN02** — Apenas o papel Dono pode convidar/remover colaboradores e alterar permissões.

---

## 2. Cadastro de Produto

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF07 | O sistema deve permitir cadastrar itens de dois tipos: **Produto Físico** ou **Serviço**. |
| RF08 | O cadastro de Produto Físico deve exigir: nome, custo, unidade de medida e categoria. O estoque mínimo é opcional no cadastro (sugerido automaticamente após o 1º ciclo — RN07/RN08). A quantidade em estoque **não** faz parte do cadastro (RF14/RN03). |
| RF09 | O cadastro de Serviço deve exigir: nome, custo, categoria, e deve perguntar se há materiais/insumos associados. |
| RF10 | Todo produto/serviço deve ter uma unidade de medida obrigatória (ex: unidade, kg, litro, hora, caixa). |
| RF11 | Todo produto/serviço deve ter uma categoria obrigatória, escolhida de uma lista fixa do sistema: Serviços, Produtos, Alimentação, Vestuário, Beleza, Saúde, Casa, Tecnologia, Outros. |
| RF12 | Um Serviço deve poder ter múltiplos materiais vinculados, sendo cada material um Produto Físico já cadastrado no Estoque. |
| RF13 | Ao vincular um material a um Serviço, o sistema deve sugerir automaticamente a quantidade padrão de **1 unidade** por execução, permitindo edição posterior pelo usuário. |
| RF14 | O cadastro do Produto Físico não deve incluir a quantidade em estoque no mesmo formulário de criação; a quantidade é definida em uma operação separada de entrada de estoque. |

### Regras de Negócio

- **RN03** — Todo Produto Físico é criado com estoque inicial igual a zero.
- **RN04** — O tipo do item (Físico/Serviço) determina se ele participa do controle de Estoque e se pode receber materiais vinculados.
- **RN05** — Um Serviço com materiais vinculados consome (dá baixa) automaticamente do estoque desses materiais quando o serviço é vendido.

---

## 3. Estoque

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF15 | O sistema deve permitir registrar entrada manual de estoque, informando quantidade e data. |
| RF16 | O sistema deve dar baixa automática de estoque quando uma venda é registrada. |
| RF17 | O sistema deve permitir baixa manual de estoque (ajuste/perda), exigindo motivo obrigatório: Perda, Quebra, Uso interno, Doação ou Outro. |
| RF18 | O sistema deve bloquear o registro de uma venda quando não houver estoque suficiente para os produtos físicos e/ou materiais envolvidos, interrompendo o fluxo antes do pagamento. |
| RF19 | O sistema deve exibir um alerta visual quando o estoque atual de um produto estiver igual ou abaixo do estoque mínimo. |
| RF20 | O sistema deve sugerir automaticamente um valor de estoque mínimo com base em percentual do histórico de estoque do produto, permitindo que o usuário sobrescreva com um valor fixo. |
| RF21 | O alerta de estoque baixo deve ser exibido tanto em notificação no sistema (dashboard/lista) quanto em indicador visual no cadastro do produto. |

### Regras de Negócio

- **RN06** — Vendas com estoque insuficiente são estritamente proibidas; o sistema bloqueia a operação e deve validar a disponibilidade de cada item no carrinho antes de processar a transação.
- **RN07** — O alerta de estoque baixo permanece **desativado** para um produto até que ele complete pelo menos 1 ciclo de entrada e saída registrado no sistema — antes disso, não há histórico suficiente para comparação.
- **RN08** — Após o primeiro ciclo completo, o sistema passa a sugerir o estoque mínimo automaticamente; o valor sugerido pode ser sobrescrito manualmente pelo usuário a qualquer momento.

---

## 4. Venda

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF22 | O sistema deve permitir registrar uma venda com ou sem cliente identificado (campo opcional). |
| RF23 | Uma venda deve poder conter múltiplos itens, combinando produtos físicos e/ou serviços. |
| RF24 | O sistema deve suportar as formas de pagamento: Dinheiro, PIX, Cartão de Débito e Cartão de Crédito. |
| RF25 | O sistema deve permitir pagamento misto em uma mesma venda (ex: parte em PIX + parte em Cartão de Crédito parcelado). |
| RF26 | O sistema deve validar que a soma dos valores informados nas formas de pagamento é igual ao valor total da venda, bloqueando o registro caso não bata. |
| RF27 | O sistema deve permitir parcelamento no Cartão de Crédito em até 12 vezes. |
| RF28 | As datas de vencimento das parcelas devem ser geradas automaticamente de forma mensal, a partir da data da venda. |

### Regras de Negócio

- **RN09** — Pagamentos em Dinheiro, PIX ou Cartão de Débito geram lançamento imediato no fluxo de caixa (Financeiro).
- **RN10** — Pagamentos em Cartão de Crédito (à vista ou parcelado) geram uma ou mais contas a receber com vencimento futuro, em vez de lançamento imediato.
- **RN11** — O valor de cada parcela é o valor total dividido igualmente pelo número de parcelas, sem desconto de taxa de maquininha no MVP.
- **RN12** — Toda venda registrada dispara automaticamente: (1) baixa de estoque dos itens/materiais envolvidos e (2) lançamento(s) no Financeiro, conforme a(s) forma(s) de pagamento.

---

## 5. Financeiro

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF29 | O sistema deve manter um fluxo de caixa com entradas, saídas e saldo atualizado. |
| RF30 | O sistema deve permitir o cadastro de contas a pagar e contas a receber, com data de vencimento. |
| RF31 | Contas a pagar/receber devem poder ser marcadas como pagas/recebidas parcialmente, mantendo o valor restante em aberto. |
| RF32 | Lançamentos financeiros devem ser classificados em categorias fixas do sistema: Vendas, Fornecedores, Impostos, Salário, Outros. |
| RF33 | Toda venda registrada deve gerar lançamento automático no Financeiro, sem necessidade de lançamento manual duplicado. |

### Regras de Negócio

- **RN13** — Lançamentos gerados automaticamente por vendas usam a categoria "Vendas" por padrão.
- **RN14** — O saldo do fluxo de caixa deve refletir apenas valores efetivamente recebidos/pagos (contas a receber futuras de cartão de crédito não entram no saldo até a data de vencimento/recebimento).

---

## 6. Calculadora de Precificação

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF34 | O sistema deve calcular o preço de venda sugerido usando a fórmula de markup completo: **Preço = Custo Total ÷ (1 − (Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem%))**. |
| RF35 | Para Serviços com materiais vinculados, o custo utilizado no cálculo deve ser a soma do custo do serviço com o custo dos materiais vinculados (considerando a quantidade de cada material). |
| RF36 | O sistema deve sugerir uma margem de lucro padrão de acordo com a categoria do produto/serviço, permitindo edição pelo usuário. |
| RF37 | O sistema deve perguntar ao usuário o regime tributário (MEI ou Simples Nacional) para o cálculo de imposto embutido no preço. |
| RF38 | O sistema deve calcular a alíquota de imposto aplicável com base em faixas de faturamento (RBT12 — Receita Bruta dos últimos 12 meses). |
| RF39 | O RBT12 deve ser calculado automaticamente pelo sistema, somando o valor total de **todas** as vendas registradas nos últimos 12 meses (data da venda), independentemente da forma de pagamento ou de já terem sido recebidas (RN21). |
| RF40 | O resultado do cálculo (preço sugerido) deve ser exibido ao usuário, que deve confirmar explicitamente antes de o valor ser salvo como preço de venda oficial do produto/serviço. |
| RF41 | O sistema deve manter histórico de alterações de preço de cada produto/serviço. |
| RF48 | O sistema deve permitir cadastrar as despesas fixas mensais do negócio (descrição e valor mensal — ex.: aluguel, energia, licenças de software, pró-labore). |
| RF49 | O sistema deve calcular o percentual de despesas fixas como **Desp. Fixas% = Total de despesas fixas mensais ÷ Faturamento médio mensal**, em que o faturamento médio mensal = RBT12 ÷ número de meses com vendas registradas (até 12). |
| RF50 | Quando o negócio não possuir histórico de vendas, o sistema deve solicitar a capacidade mensal (horas, atendimentos ou unidades por mês) e o ticket médio esperado, recomendar um faturamento mensal estimado = capacidade × ticket médio e permitir que o usuário edite esse valor, que passa a ser usado no RF49. |
| RF51 | O sistema deve permitir informar a taxa média de cartão/maquininha (%) do negócio, utilizada como despesa variável no cálculo de preço. |
| RF52 | O sistema deve permitir informar, de forma **opcional**, um percentual de comissão por produto/serviço (padrão 0%), utilizado como despesa variável no cálculo de preço daquele item. |
| RF53 | A Calculadora deve exibir um aviso explícito de que a Margem% representa o ganho líquido do dono em cada venda (após custos, despesas fixas, despesas variáveis e impostos), e não o lucro total do negócio. |
| RF54 | A Calculadora deve exibir o ponto de equilíbrio mensal do negócio (RF55) e alertar o usuário quando o faturamento estimado (RF50) estiver abaixo dele. |

### Regras de Negócio

- **RN15** — O preço de venda usado nas vendas do sistema é sempre o último preço confirmado pelo usuário via Calculadora (ou cadastro manual), nunca um valor calculado e não confirmado.
- **RN16** — Cada nova confirmação de preço gera um novo registro no histórico, preservando os valores anteriores.
- **RN17** — A alíquota de imposto (MEI/Simples) deve ser parametrizável no sistema, permitindo atualização das faixas/percentuais sem alteração de código, já que a legislação pode mudar.
- **RN19** — A soma Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem% deve ser menor que 100%; caso contrário, o sistema bloqueia o cálculo e informa ao usuário que o preço é inviável com os parâmetros atuais.
- **RN20** — Despesas Variáveis% = taxa média de cartão do negócio (RF51) + comissão do item (RF52). Esses percentuais são usados **apenas** na formação do preço: no MVP não geram desconto nos lançamentos/contas a receber (RN11 permanece válida) nem repasse automático de comissão.
- **RN21** — O RBT12 e o faturamento bruto são apurados por **regime de competência**: somam o valor total de todas as vendas registradas no período (`Venda.valorTotal`), inclusive vendas no cartão de crédito com parcelas ainda não recebidas. Diferente do saldo de caixa (RN14), que considera apenas valores efetivamente recebidos.

---

## 7. Dashboard

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF42 | O sistema deve exibir na tela inicial um resumo do dia: vendas do dia, saldo em caixa e alertas de estoque baixo. |
| RF43 | O sistema deve exibir um gráfico simples de vendas dos últimos dias/mês. |
| RF44 | A estrutura do Dashboard deve ser pensada para comportar novos indicadores/widgets no futuro, sem redesenho completo da tela. |
| RF55 | O sistema deve calcular e exibir o ponto de equilíbrio mensal: **PE = Total de despesas fixas mensais ÷ (1 − Imposto% − Taxa média de cartão%)**. |
| RF56 | O sistema deve calcular o faturamento meta mensal: **Meta = Total de despesas fixas mensais ÷ (1 − Imposto% − Taxa média de cartão% − Margem meta%)**, em que a margem meta é a margem de lucro desejada informada para o negócio. |
| RF57 | O Dashboard deve exibir um semáforo de saúde financeira comparando o faturamento bruto do mês corrente (soma de todas as vendas registradas no mês, conforme RN21) com o PE e a Meta: **Vermelho** (faturamento < PE — déficit), **Amarelo** (PE ≤ faturamento < Meta — alerta), **Verde** (faturamento ≥ Meta — saudável). |

---

## 8. Modelo Freemium

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF45 | O sistema deve diferenciar funcionalidades disponíveis no plano gratuito das disponíveis apenas no plano pago. |
| RF46 | O plano gratuito não deve impor limite de quantidade de produtos, vendas ou lançamentos financeiros. |
| RF47 | Funcionalidades como relatórios avançados e gestão de múltiplos colaboradores devem ser exclusivas do plano pago. |

### Regras de Negócio

- **RN18** — A limitação do plano Freemium é sempre por **funcionalidade disponível**, nunca por volume de uso (quantidade de produtos, vendas ou registros).

---

## 9. Requisitos Não Funcionais

| ID | Descrição |
|---|---|
| RNF01 | A aplicação deve ser web, acessível via navegador, com layout responsivo para desktop e mobile. |
| RNF02 | Os dados de cada negócio devem ser isolados logicamente dos demais (arquitetura multi-tenant), impedindo acesso cruzado entre contas. |
| RNF03 | Senhas de usuário devem ser armazenadas com hash seguro, nunca em texto plano. |
| RNF04 | O sistema deve estar em conformidade com a LGPD, incluindo política de privacidade, consentimento explícito e mecanismos de exportação/exclusão de dados pessoais. |
| RNF05 | Alterações em estoque (entrada, saída manual) e em preço devem manter registro auditável (data, usuário responsável, motivo quando aplicável). |
| RNF06 | O cálculo de precificação e do RBT12 deve responder de forma performática, mesmo com histórico extenso de vendas. |
| RNF07 | A sessão do usuário deve persistir ao alternar entre negócios, sem exigir novo login. |
| RNF08 | Os percentuais/faixas de alíquota de MEI e Simples Nacional devem ser mantidos de forma parametrizável (configuração, não código), para facilitar atualização conforme mudanças na legislação. |
| RNF09 | O sistema deve manter rotina de backup dos dados financeiros e de estoque. |
| RNF10 | A arquitetura do Dashboard e dos módulos deve ser extensível, suportando a adição de novos indicadores e integrações (Nota Fiscal, PIX) sem necessidade de reestruturação do core. |

---

## 10. Regras de Negócio Consolidadas

| ID | Regra |
|---|---|
| RN01 | Dados isolados por negócio; colaborador só acessa negócios aos quais foi convidado. |
| RN02 | Apenas o Dono pode convidar/remover colaboradores e alterar permissões. |
| RN03 | Produto Físico é criado com estoque inicial zero. |
| RN04 | Tipo do item (Físico/Serviço) determina participação no Estoque e possibilidade de materiais vinculados. |
| RN05 | Serviço com materiais vinculados dá baixa automática desses materiais no estoque ao ser vendido. |
| RN06 | Vendas com estoque insuficiente não são permitidas; o sistema bloqueia a operação. |
| RN07 | Alerta de estoque baixo fica desativado até o produto completar 1 ciclo de entrada/saída. |
| RN08 | Estoque mínimo sugerido automaticamente após o 1º ciclo; sobrescrevível manualmente a qualquer momento. |
| RN09 | Dinheiro/PIX/Débito geram lançamento imediato no caixa. |
| RN10 | Cartão de Crédito (à vista ou parcelado) gera conta(s) a receber com vencimento futuro. |
| RN11 | Valor da parcela é o total dividido igualmente, sem desconto de taxa de maquininha no MVP. |
| RN12 | Toda venda dispara baixa de estoque + lançamento financeiro automaticamente. |
| RN13 | Lançamentos automáticos de venda usam a categoria "Vendas". |
| RN14 | Saldo de caixa reflete apenas valores já recebidos/pagos, não contas a receber futuras. |
| RN15 | Preço de venda oficial é sempre o último preço confirmado pelo usuário. |
| RN16 | Toda confirmação de novo preço gera registro em histórico. |
| RN17 | Alíquotas de MEI/Simples são parametrizáveis, não fixas em código. |
| RN18 | Limitação do plano Freemium é por funcionalidade, nunca por volume de uso. |
| RN19 | Soma de Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem% deve ser < 100%; senão o cálculo é bloqueado. |
| RN20 | Taxa de cartão e comissão entram só na formação do preço; não descontam lançamentos nem geram repasse no MVP. |
| RN21 | RBT12 e faturamento bruto somam todas as vendas registradas no período (competência), inclusive as ainda não recebidas. |

---

## Próximos Passos Técnicos

- [ ] Modelar o esquema de dados (entidades: Negócio, Usuário, Produto, Material, Estoque/Movimentação, Venda, ItemVenda, Pagamento, Parcela, LançamentoFinanceiro, HistóricoPreço, DespesaFixa, FaixaTributaria).
- [ ] Especificar as faixas de alíquota vigentes do MEI e do Simples Nacional para parametrização inicial (RNF08 / RN17).
- [ ] Detalhar wireframes das telas de: cadastro de produto/serviço, registro de venda (com pagamento misto), calculadora de precificação e dashboard.
- [ ] Definir a matriz de permissões granulares por módulo (RF06) para o papel customizado.
- [ ] Validar com o time de negócio a lista de categorias e margens padrão sugeridas por categoria (RF36).
