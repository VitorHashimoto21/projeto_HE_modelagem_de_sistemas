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
| RF05 | O sistema deve oferecer 3 papéis fixos de acesso: **Dono** (acesso total), **Gerente** (acesso total exceto configurações) e **Colaborador** (acesso restrito a Vendas, Estoque e Dashboard restrito — RF63 —, sem Financeiro). |
| RF06 | O dono deve poder configurar permissões granulares customizadas por módulo para um colaborador, além dos 3 papéis fixos (ex.: liberar a um Colaborador apenas o lançamento de despesas operacionais no Financeiro, sem acesso a saldo, relatórios, custos fixos ou margens). A granularidade é **módulo × ação**: para cada módulo (Catálogo, Estoque, Vendas, Calculadora, Financeiro, Dashboard), as ações ver, criar, editar e excluir/cancelar; os 3 papéis fixos são predefinições dessa matriz. |
| RF72 | O convite de colaborador (RF04) deve ser enviado por e-mail com link de uso único e prazo de validade, informando o papel (e as permissões customizadas, se houver) que o convidado receberá. O convidado pode ainda não ter conta: ao aceitar, cadastra-se (ou entra) e passa a ser membro do negócio. O Dono pode cancelar um convite pendente; convites pendentes contam no limite de colaboradores do plano gratuito (RF47). |
| RF58 | Ao cadastrar um negócio, o sistema deve solicitar o CNPJ e consultar a base pública de CNPJ da Receita Federal para preencher automaticamente razão social, CNAE principal e opção pelo Simples Nacional/MEI (regime tributário). O CNPJ pode ser numérico ou no formato com letras (IN RFB nº 2.229/2024, SPEC-022). |
| RF69 | Para negócios do Simples Nacional cujo CNAE seja sujeito ao **Fator R**, o sistema deve calcular Fator R = folha de salários (lançamentos da categoria Salário) ÷ receita bruta, ambas no mesmo período usado no RBT12 (RN21), e aplicar o Anexo III quando Fator R ≥ 28% ou o Anexo V caso contrário (limite e anexos parametrizáveis — RN17), avisando o usuário quando o anexo efetivo mudar. |
| RF59 | A partir do CNAE principal, o sistema deve sugerir o **Anexo do Simples Nacional** do negócio (tabela oficial CNAE → Anexo) ou, para MEI, o tipo de atividade (comércio/indústria, serviços ou ambos), permitindo edição. Quando a consulta estiver indisponível, esses dados devem ser preenchidos manualmente. Para **autônomos sem CNPJ**, o regime do negócio é **Autônomo** e o usuário informa o percentual de imposto que paga (ex.: ISS e IR estimados), usado como Imposto% na Calculadora (RF38). |
| RF74 | O sistema deve ter o papel de **Administrador da plataforma**, concedido e retirado apenas por script da equipe (nunca por tela), numa conta **exclusiva** que não é membro de nenhum negócio. O Administrador vê um painel com os negócios da plataforma **somente por metadados** (nome, regime, plano, data de criação, número de membros, situação, nome e e-mail do Dono e situação do acesso de suporte), sem dados operacionais (SPEC-018). A conta de Administrador só funciona com o **2º fator** verificado (RF82), e o painel também mostra os pedidos pendentes de outras contas de Administrador, o histórico das emergências e as ações de plataforma (SPEC-019). |
| RF75 | O Dono deve poder **liberar o acesso do suporte** ao seu negócio, informando o motivo, os módulos liberados e o prazo (1 h, 24 h, 3 dias ou 7 dias), e **revogar** a liberação a qualquer momento (SPEC-018). Cada módulo liberado fica em "ver" ou, nos módulos com correções (RN37), "ver e corrigir"; com correção, o prazo é de 1 h ou 12 h (SPEC-019). |
| RF76 | Com uma liberação ativa, o Administrador deve poder entrar no negócio em **modo suporte**, vendo apenas os módulos liberados, **somente leitura**, exceto nos módulos que o Dono marcou para correção, onde faz só as correções da lista fechada (RN37, RF83, SPEC-019), com faixa de aviso e com os dados pessoais de clientes (nome, documento, e-mail, telefone e endereço) e os e-mails de membros mascarados (SPEC-018, SPEC-022). |
| RF77 | O sistema deve registrar cada liberação, revogação, entrada, tela aberta e saída do modo suporte, com data, hora e autor, e mostrar esse registro ao Dono na tela "Acessos do suporte"; os membros veem uma faixa enquanto a liberação estiver ativa, e o Dono recebe e-mail ao liberar e na primeira entrada do suporte (SPEC-018). O registro também guarda as correções (com o antes e o depois), os desfazimentos, os pedidos e acessos de emergência, as suspensões, as trocas de plano pela plataforma e os eventos do 2º fator (SPEC-019). |
| RF78 | Quando a Política de Privacidade ou os Termos de Uso mudarem de versão, o sistema deve exigir o **novo aceite** de cada usuário no próximo acesso, mostrando o resumo das mudanças e registrando a versão e a data do aceite; até aceitar, o usuário só acessa Minha conta e Sair (SPEC-018). |
| RF82 | A conta de Administrador deve usar um **2º fator obrigatório** (código TOTP de um aplicativo autenticador), cadastrado no primeiro login, sem o qual nenhuma tela ou ação de Administrador funciona. O sistema pede um segundo autenticador, pede o código de novo (válido por 10 min) antes das ações críticas e permite redefinir o 2º fator só pelo workflow da equipe, rodado por outra pessoa (SPEC-019). |
| RF83 | Nos módulos marcados pelo Dono para correção, o Administrador deve poder fazer as correções da lista fechada (RN37), com o **antes e o depois** registrados na mesma transação e mostrados ao Dono na hora. O Dono deve poder **desfazer** cada correção em até 30 dias, por uma operação de compensação em seu nome, recusada se o registro mudou depois (SPEC-019). |
| RF84 | Sem liberação do Dono, um Administrador deve poder **pedir acesso de emergência** a um negócio (motivo de lista fechada, referência, justificativa, módulos e prazo de até 4 h), que só vale com a **aprovação de outra conta de Administrador** em até 12 h. O acesso é somente leitura, com máscara, sem exportação, e o Dono vê o pedido e o acesso na hora e pode encerrá-lo (RN38, SPEC-019). |
| RF85 | Um Administrador deve poder **suspender** e **reativar** um negócio, com motivo de lista fechada e descrição; o negócio suspenso fica somente leitura para os membros (RN39), e o Dono é avisado na hora (SPEC-019). |

### Regras de Negócio

- **RN01** — Todos os dados (produtos, estoque, vendas, financeiro) são isolados por negócio; um colaborador só acessa os dados do(s) negócio(s) ao qual foi convidado. As únicas exceções são o acesso de suporte liberado pelo Dono (RN30, RN31) e o acesso de emergência aprovado por duas contas de Administrador e visível ao Dono (RN38).
- **RN02** — Apenas o papel Dono pode convidar/remover colaboradores e alterar permissões.
- **RN24** — O Anexo do Simples é definido **por negócio** e aplicado a todo o faturamento (RBT12) do negócio. A separação do imposto por atividade (negócios com produto e serviço em anexos diferentes) fica fora do MVP, e o sistema exibe um aviso sobre essa simplificação.
- **RN28** — O anexo efetivo de um negócio sujeito ao Fator R é recalculado a cada cálculo de preço; sem RBT12 (negócio sem vendas), usa-se o Anexo V até haver histórico.
- **RN30** — O Administrador da plataforma não acessa nenhum dado operacional de um negócio sem uma liberação ativa do Dono; com ela, acessa só os módulos liberados, para leitura e, nos módulos marcados pelo Dono, para as correções da lista fechada (RN37). Sem liberação, só pelo acesso de emergência (RN38). Sempre em seu próprio nome, nunca "entrando como" o usuário (SPEC-018, SPEC-019).
- **RN31** — Apenas o Dono libera e revoga o acesso do suporte; o prazo é de 1 h, 24 h, 3 dias ou 7 dias, e de 1 h ou 12 h quando algum módulo está em correção (SPEC-019); existe no máximo uma liberação ativa por negócio (uma nova substitui a anterior); negócio encerrado não pode ser liberado.
- **RN32** — O registro de auditoria do suporte nunca é alterado nem apagado e é guardado por 5 anos, inclusive depois da exclusão da conta do Dono (já sem identificação pessoal). Vale também para as correções, os desfazimentos, a emergência, as ações de plataforma e os eventos do 2º fator (SPEC-019).
- **RN37** — O suporte só corrige as ações de uma **lista fechada**, todas com compensação para o Dono desfazer (SPEC-019, 5.4); toda ação nova nasce proibida no modo suporte. Em nenhum modo o suporte registra, cancela, troca ou ajusta vendas, altera ou consulta dados de clientes, mexe em equipe e permissões, configurações e dados do negócio, plano pelo Dono, acesso do suporte, LGPD ou exportações.
- **RN38** — O acesso de emergência exige duas contas de Administrador diferentes (quem pede não aprova) e só existe quando o negócio não tem liberação ativa e não está encerrado. É somente leitura, com máscara, sem exportação, por até 4 h, sem renovação; o pedido expira em 12 h. O Dono vê o pedido e o acesso desde o pedido e pode encerrá-lo: não existe acesso secreto. Ao fim, quem pediu registra o resultado antes de pedir outro.
- **RN39** — Negócio suspenso pela plataforma fica somente leitura: nenhuma escrita de membros nem do suporte nos módulos e em Configurações (exceto liberar e revogar o suporte), e a rotina diária o pula. Leitura, exportação dos dados e exclusão de conta continuam disponíveis, e nada é apagado.

---

## 2. Cadastro de Produto

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF07 | O sistema deve permitir cadastrar itens de dois tipos: **Produto Físico** ou **Serviço**. |
| RF08 | O cadastro de Produto Físico deve exigir: nome, custo, unidade de medida e categoria. O estoque mínimo é opcional no cadastro (sugerido automaticamente após o 1º ciclo — RN07/RN08), assim como o **NCM**, que passa a ser obrigatório quando o negócio informa que emite nota fiscal de produtos (RF80, RN35, SPEC-021). A quantidade em estoque **não** faz parte do cadastro (RF14/RN03). |
| RF09 | O cadastro de Serviço deve exigir: nome, custo, categoria, e deve perguntar se há materiais/insumos associados. |
| RF64 | O preço de venda é **opcional** no cadastro do item. O preço oficial é definido por confirmação na Calculadora (RF40) ou por informação manual do usuário; ambos geram registro no histórico de preços, indicando a origem (Calculadora ou Manual). |
| RF10 | Todo produto/serviço deve ter uma unidade de medida obrigatória (ex: unidade, kg, litro, hora, caixa). |
| RF11 | Todo produto/serviço deve ter uma categoria obrigatória, escolhida de uma lista fixa do sistema: Serviços, Produtos, Alimentação, Vestuário, Acessórios, Beleza, Saúde, Casa, Tecnologia, Outros (Acessórios incluída pela SPEC-020). |
| RF79 | O negócio deve poder criar **subcategorias livres** dentro de cada categoria fixa (ex.: Brincos, Colares e Anéis em Acessórios), com nome único na categoria, e associar no máximo uma, **opcional**, a cada produto/serviço da mesma categoria. As subcategorias são criadas no cadastro do item ou numa tela própria do Catálogo, onde também podem ser renomeadas e excluídas (os itens ficam sem subcategoria), e servem de filtro e busca no Catálogo e no Estoque (SPEC-020). |
| RF80 | O Produto Físico deve poder ter um **NCM** (Nomenclatura Comum do Mercosul, 8 dígitos), **opcional**, conferido na tabela oficial vigente, carregada de arquivo versionado com fonte e vigência. O código é buscado por código ou por palavras. Quando o código deixa de estar vigente, ele é mantido no item com aviso de revisão. O Catálogo mostra os produtos sem NCM e os que precisam de revisão, a busca encontra pelo código, e o cadastro sugere o NCM já usado por outros itens da mesma subcategoria, com aviso de que a responsabilidade pela classificação é do negócio. O NCM é obrigatório quando o Dono liga a opção "Emito nota fiscal de produtos" nos Dados do negócio (RN35). Serviços não têm NCM (SPEC-021). |
| RF12 | Um Serviço deve poder ter múltiplos materiais vinculados, sendo cada material um Produto Físico já cadastrado no Estoque. |
| RF13 | Ao vincular um material a um Serviço, o sistema deve sugerir automaticamente a quantidade padrão de **1 unidade** por execução, permitindo edição posterior pelo usuário. |
| RF14 | O cadastro do Produto Físico não deve incluir a quantidade em estoque no mesmo formulário de criação; a quantidade é definida em uma operação separada de entrada de estoque. |

### Regras de Negócio

- **RN03** — Todo Produto Físico é criado com estoque inicial igual a zero.
- **RN04** — O tipo do item (Físico/Serviço) determina se ele participa do controle de Estoque e se pode receber materiais vinculados.
- **RN05** — Um Serviço com materiais vinculados consome (dá baixa) automaticamente do estoque desses materiais quando o serviço é vendido, nas quantidades do catálogo; na venda, a quantidade de cada material pode ser ajustada para o que foi de fato usado (SPEC-017), sem alterar o catálogo.
- **RN23** — Um item sem preço oficial confirmado não pode ser adicionado a uma venda.
- **RN33** — A subcategoria só organiza o catálogo: não altera a margem padrão sugerida (que continua por categoria, RF36), o preço, o custo, o estoque nem as regras fiscais do item (SPEC-020).
- **RN34** — O NCM é informado e conferido pelo negócio: o sistema só confere que o código existe na tabela vigente e sugere, sem nunca preencher sem a confirmação do usuário. O NCM não altera preço, margem, custo, estoque nem impostos calculados (SPEC-021).
- **RN35** — Com a opção "Emito nota fiscal de produtos" ligada pelo Dono, o NCM é obrigatório no cadastro e na edição de produto físico, e produto físico sem NCM não pode ser vendido, nem em troca (como o item sem preço, RN23). Um NCM fora da tabela vigente não bloqueia a venda; os materiais consumidos por serviços não entram nessa regra (SPEC-021).

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
| RF20 | O sistema deve sugerir automaticamente o estoque mínimo de cada produto como **⌈consumo médio diário × dias de cobertura⌉**, em que o consumo médio diário = soma das saídas (por venda e manuais, exceto estornos) dos últimos 90 dias ÷ número de dias com histórico nessa janela, e os dias de cobertura são configuráveis por negócio (padrão 7). O usuário pode sobrescrever com um valor fixo. |
| RF21 | O alerta de estoque baixo deve ser exibido tanto em notificação no sistema (dashboard/lista) quanto em indicador visual no cadastro do produto. |

### Regras de Negócio

- **RN06** — Vendas com estoque insuficiente são estritamente proibidas; o sistema bloqueia a operação e deve validar a disponibilidade de cada item no carrinho antes de processar a transação.
- **RN07** — O alerta de estoque baixo **baseado no mínimo sugerido** permanece **desativado** para um produto até que ele complete pelo menos 1 ciclo — ao menos uma entrada e uma saída registradas no sistema; antes disso, não há histórico suficiente para comparação. Se o usuário informar um estoque mínimo manual, o alerta vale desde já (SPEC-007, OPEN-003).
- **RN08** — Após o primeiro ciclo completo, o sistema passa a sugerir o estoque mínimo automaticamente; o valor sugerido pode ser sobrescrito manualmente pelo usuário a qualquer momento.

---

## 4. Venda

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF22 | O sistema deve permitir registrar uma venda com ou sem cliente identificado (campo opcional). O cliente pode ser cadastrado na própria venda ou na tela de Clientes, com todos os dados além do nome opcionais (RF81, SPEC-022). |
| RF23 | Uma venda deve poder conter múltiplos itens, combinando produtos físicos e/ou serviços. |
| RF24 | O sistema deve suportar as formas de pagamento: Dinheiro, PIX, Cartão de Débito e Cartão de Crédito. |
| RF25 | O sistema deve permitir pagamento misto em uma mesma venda (ex: parte em PIX + parte em Cartão de Crédito parcelado). |
| RF26 | O sistema deve validar, na interface e novamente no servidor, que a soma dos valores informados nas formas de pagamento é igual ao valor total da venda, bloqueando o registro caso não bata. |
| RF27 | O sistema deve permitir parcelamento no Cartão de Crédito em até 12 vezes. |
| RF28 | As datas de vencimento das parcelas devem ser geradas automaticamente de forma mensal, a partir da data da venda. |
| RF65 | O sistema deve permitir que Dono e Gerente (ou Colaborador com permissão granular — RF06) cancelem uma venda inteira, informando motivo obrigatório. A venda cancelada nunca é apagada: fica com status Cancelada e registro auditável de quem cancelou, quando e por quê. |
| RF81 | O negócio deve poder manter um **cadastro de clientes**, pessoa física (nome e CPF) ou empresa (razão social, nome fantasia, CNPJ, situação na inscrição estadual, inscrição municipal e nome de quem compra), com e-mail, telefone e endereço, todos **opcionais** além do nome. O endereço é preenchido pelo CEP, e os dados da empresa (inclusive telefone e e-mail públicos) pelo CNPJ, em base pública com preenchimento manual quando a consulta falha. A tela de Clientes fica dentro de Vendas, com as permissões de Vendas, e tem busca, o selo "completo para nota" (que não bloqueia a venda), o detalhe com as compras do cliente, a edição e a exclusão (RN27, RN36, SPEC-022). |
| RF66 | Ao cancelar uma venda, o operador pode opcionalmente realizar uma **troca**: escolher itens de substituição de valor total menor ou igual ao da venda original. O sistema registra uma nova venda vinculada à original, abatendo o valor com crédito de troca, e reembolsa a diferença na forma escolhida. Troca por itens de valor maior fica fora do MVP. |

### Regras de Negócio

- **RN09** — Pagamentos em Dinheiro, PIX ou Cartão de Débito geram lançamento imediato no fluxo de caixa (Financeiro).
- **RN10** — Pagamentos em Cartão de Crédito (à vista ou parcelado) geram uma ou mais contas a receber com vencimento futuro, em vez de lançamento imediato.
- **RN11** — O valor de cada parcela é o valor pago no crédito dividido igualmente pelo número de parcelas, arredondado em centavos, com a diferença de arredondamento somada à **1ª parcela** (ex.: R$ 100,00 em 3x = R$ 33,34 + R$ 33,33 + R$ 33,33), sem desconto de taxa de maquininha no MVP.
- **RN12** — Toda venda registrada dispara automaticamente: (1) baixa de estoque dos itens/materiais envolvidos e (2) lançamento(s) no Financeiro, conforme a(s) forma(s) de pagamento.
- **RN25** — O cancelamento de venda ocorre em uma única transação: (1) a venda passa a Cancelada; (2) o estoque dos produtos e materiais é devolvido por movimentação de entrada de estorno; (3) as contas a receber ainda abertas da venda são canceladas (estorno feito na maquininha); (4) os valores já recebidos no caixa são estornados por lançamento de saída — exceto a parte usada como crédito de troca (RN26). Vendas canceladas não entram no RBT12, no faturamento nem no CMV%.
- **RN36** — Os dados do cliente pertencem ao negócio, e só o nome é obrigatório. O CPF ou CNPJ é validado pelos dígitos verificadores, aceita o CNPJ com letras e é único entre os clientes ativos do negócio. O documento, o e-mail, o telefone e o endereço completos só chegam a quem pode editar clientes (*Vendas: editar*); os demais veem esses dados mascarados, e o suporte vê inclusive o nome mascarado. O CPF nunca é enviado a serviço externo. O selo "completo para nota" é calculado pelos dados e nunca bloqueia a venda (SPEC-022).
- **RN26** — O crédito de troca é limitado ao valor da venda original que já entrou no caixa. Ele é registrado como forma de pagamento "Crédito de troca" da nova venda e não gera novo lançamento (o dinheiro já está no caixa). O reembolso ao cliente é o valor recebido menos o crédito usado. Se o crédito não cobrir a nova venda (ex.: original no cartão ainda não recebido), o restante é pago normalmente.

---

## 5. Financeiro

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF29 | O sistema deve manter um fluxo de caixa com entradas, saídas e saldo atualizado. |
| RF30 | O sistema deve permitir o cadastro de contas a pagar e contas a receber, com data de vencimento e categoria (RF32). Contas a receber geradas por vendas usam a categoria Vendas. |
| RF31 | Contas a pagar/receber devem poder ser marcadas como pagas/recebidas parcialmente, mantendo o valor restante em aberto. |
| RF32 | Lançamentos financeiros devem ser classificados em categorias fixas do sistema: Vendas, Fornecedores, Impostos, Salário, Outros. |
| RF33 | Toda venda registrada deve gerar lançamento automático no Financeiro, sem necessidade de lançamento manual duplicado. |
| RF67 | Cada despesa fixa ativa (RF48), incluindo o DAS para MEI (RF60), deve gerar automaticamente uma conta a pagar por mês, com o dia de vencimento e a categoria definidos na despesa, sem duplicar a conta de um mesmo mês. A geração ocorre por rotina agendada diária e é conferida novamente ao acessar o Financeiro ou o Dashboard. O usuário apenas registra o pagamento (RN22). |

### Regras de Negócio

- **RN13** — Lançamentos gerados automaticamente por vendas usam a categoria "Vendas" por padrão.
- **RN14** — O saldo do fluxo de caixa deve refletir apenas valores efetivamente recebidos/pagos (contas a receber futuras de cartão de crédito não entram no saldo até a data de vencimento/recebimento).
- **RN22** — Todo pagamento ou recebimento registrado em uma conta (total ou parcial) gera um lançamento no fluxo de caixa (Entrada para conta a receber, Saída para conta a pagar), vinculado à conta e com a categoria dela. O status da conta (Aberta, Parcial, Quitada) é a única fonte de verdade sobre a situação de pagamento das parcelas de cartão.

---

## 6. Calculadora de Precificação

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF34 | O sistema deve calcular o preço de venda sugerido usando a fórmula de markup completo: **Preço = Custo Total ÷ (1 − (Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem%))**. |
| RF35 | Para Serviços com materiais vinculados, o custo utilizado no cálculo deve ser a soma do custo do serviço com o custo dos materiais vinculados (considerando a quantidade de cada material). |
| RF36 | O sistema deve sugerir uma margem de lucro padrão de acordo com a categoria do produto/serviço, permitindo edição pelo usuário. As margens padrão ficam em tabela parametrizável por categoria, com valores iniciais baseados nos percentuais de presunção de lucro definidos pela legislação federal (Lei 9.249/1995, art. 15 — ex.: 8% comércio/indústria, 32% serviços em geral). |
| RF37 | O sistema deve utilizar o regime tributário do negócio (MEI, Simples Nacional ou Autônomo), obtido no cadastro (RF58/RF59), exibindo-o na Calculadora para conferência do usuário. |
| RF38 | Para o Simples Nacional, o sistema deve calcular a alíquota efetiva com base no Anexo do negócio e na faixa de faturamento (RBT12 — RN21): **Alíquota efetiva = (RBT12 × Alíquota nominal − Parcela a deduzir) ÷ RBT12**. A faixa aplicável é aquela em que **limite inicial < RBT12 ≤ limite final** (limites contínuos entre faixas). Para o MEI, Imposto% = 0 no markup (RF60). Para o Autônomo, Imposto% = percentual informado no cadastro (RF59). |
| RF39 | O RBT12 deve ser calculado automaticamente pelo sistema, somando o valor total de **todas** as vendas registradas nos **12 meses anteriores ao mês do cálculo** (competência da data da venda), independentemente da forma de pagamento ou de já terem sido recebidas (RN21), exceto vendas canceladas (RN25). Com menos de 12 meses de histórico, aplica-se a proporcionalização do RN21. |
| RF40 | O resultado do cálculo (preço sugerido) deve ser exibido ao usuário, que deve confirmar explicitamente antes de o valor ser salvo como preço de venda oficial do produto/serviço. |
| RF41 | O sistema deve manter histórico de alterações de preço de cada produto/serviço. |
| RF48 | O sistema deve permitir cadastrar as despesas fixas mensais do negócio (descrição e valor mensal — ex.: aluguel, energia, licenças de software, pró-labore). |
| RF49 | O sistema deve calcular o percentual de despesas fixas como **Desp. Fixas% = Total de despesas fixas mensais ÷ Faturamento médio mensal**, em que o faturamento médio mensal = RBT12 ÷ número de meses com vendas registradas (até 12). |
| RF50 | Quando o negócio não possuir histórico de vendas, o sistema deve solicitar a capacidade mensal (horas, atendimentos ou unidades por mês) e o ticket médio esperado, recomendar um faturamento mensal estimado = capacidade × ticket médio e permitir que o usuário edite esse valor, que passa a ser usado no RF49. |
| RF51 | O sistema deve permitir informar a taxa média de cartão/maquininha (%) do negócio, utilizada como despesa variável no cálculo de preço. |
| RF52 | O sistema deve permitir informar, de forma **opcional**, um percentual de comissão por produto/serviço (padrão 0%), utilizado como despesa variável no cálculo de preço daquele item. A comissão é sempre um **percentual sobre o preço**, sem comissão fixa em reais. A Calculadora mostra a comissão **separada da taxa da maquininha**, com o valor em reais no preço sugerido, e o detalhe do item mostra o valor em reais no preço oficial (SPEC-023). |
| RF53 | A Calculadora deve exibir um aviso explícito de que a Margem% representa o ganho líquido do dono em cada venda (após custos, despesas fixas, despesas variáveis e impostos), e não o lucro total do negócio. |
| RF54 | A Calculadora deve exibir o ponto de equilíbrio mensal do negócio (RF55) e alertar o usuário quando o faturamento estimado (RF50) estiver abaixo dele. |
| RF60 | Para negócios MEI, o sistema deve incluir automaticamente o valor mensal do DAS (parametrizável conforme o tipo de atividade do MEI) no total de despesas fixas, e usar Imposto% = 0 no markup e no ponto de equilíbrio. |
| RF61 | Para negócios MEI, o sistema deve alertar o usuário quando o RBT12 ultrapassar o limite anual de faturamento do MEI (valor parametrizável). |

### Regras de Negócio

- **RN15** — O preço de venda usado nas vendas do sistema é sempre o último preço confirmado pelo usuário via Calculadora (ou cadastro manual), nunca um valor calculado e não confirmado. Numa venda, quem tem permissão (*Vendas: editar*) pode ajustar o preço de uma linha, com motivo obrigatório; o ajuste fica registrado na linha (preço oficial do momento, quem ajustou e motivo) e não altera o preço oficial nem o histórico (SPEC-017).
- **RN16** — Cada nova confirmação de preço gera um novo registro no histórico, preservando os valores anteriores.
- **RN17** — Os parâmetros fiscais devem ser parametrizáveis no sistema, permitindo atualização sem alteração de código, já que a legislação pode mudar: faixas, alíquotas e parcelas a deduzir por Anexo do Simples, tabela CNAE → Anexo, valores do DAS e limite anual do MEI e margens padrão por categoria. Cada parâmetro registra sua fonte legal e data de vigência.
- **RN19** — A soma Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem% deve ser menor que 100%; caso contrário, o sistema bloqueia o cálculo e informa ao usuário que o preço é inviável com os parâmetros atuais.
- **RN20** — Despesas Variáveis% = taxa média de cartão do negócio (RF51) + comissão do item (RF52). Esses percentuais são usados **apenas** na formação do preço: no MVP não geram desconto nos lançamentos/contas a receber (RN11 permanece válida) nem repasse automático de comissão.
- **RN21** — O RBT12 e o faturamento bruto são apurados por **regime de competência**: somam o valor total de todas as vendas registradas e não canceladas no período (`Venda.valorTotal`), inclusive vendas no cartão de crédito com parcelas ainda não recebidas. Diferente do saldo de caixa (RN14), que considera apenas valores efetivamente recebidos. O período do RBT12 são os **12 meses anteriores ao mês do cálculo** (o mês corrente não entra), em America/Sao_Paulo (RN29). Com histórico menor (início de atividade, LC 123/2006, art. 18, § 2º): com 1 a 11 meses anteriores com vendas, RBT12 = média mensal desses meses × 12; sem nenhum mês anterior com vendas, RBT12 = faturamento mensal estimado (RF50) × 12. Assim, o RBT12 usado no cálculo do imposto é sempre maior que zero.

---

## 7. Dashboard

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF42 | O sistema deve exibir na tela inicial, para Dono e Gerente, um resumo do dia: vendas do dia, saldo em caixa e alertas de estoque baixo. |
| RF43 | O sistema deve exibir um gráfico simples de vendas: por padrão, vendas por dia dos últimos 30 dias, com opção de vendas por mês dos últimos 12 meses. |
| RF44 | A estrutura do Dashboard deve ser pensada para comportar novos indicadores/widgets no futuro, sem redesenho completo da tela. |
| RF55 | O sistema deve calcular e exibir o ponto de equilíbrio mensal: **PE = Total de despesas fixas mensais ÷ (1 − CMV% − Imposto% − Taxa média de cartão%)**. |
| RF62 | O sistema deve calcular o **CMV%** (custo das mercadorias/insumos vendidos sobre o faturamento) como Σ (custo unitário registrado no item da venda × quantidade) ÷ faturamento bruto, ambos no mesmo período usado no RBT12 (RN21). O custo unitário de cada item (incluindo materiais de serviços) deve ser gravado no momento da venda. Sem histórico de vendas, usa-se um CMV% estimado informado pelo usuário junto da capacidade e do ticket médio (RF50). |
| RF56 | O sistema deve calcular o faturamento meta mensal: **Meta = Total de despesas fixas mensais ÷ (1 − CMV% − Imposto% − Taxa média de cartão% − Margem meta%)**, em que a margem meta é a margem de lucro desejada informada para o negócio. |
| RF57 | O Dashboard deve exibir um semáforo de saúde financeira comparando o faturamento bruto do mês corrente (soma de todas as vendas registradas no mês, conforme RN21) com o PE e a Meta: **Vermelho** (faturamento < PE — déficit), **Amarelo** (PE ≤ faturamento < Meta — alerta), **Verde** (faturamento ≥ Meta — saudável). Sem margem meta configurada, o semáforo indica apenas se o faturamento está abaixo ou acima do PE e solicita a configuração da meta. O semáforo é exibido apenas para Dono e Gerente. |
| RF68 | O sistema deve exibir, para Dono e Gerente, a **projeção de caixa** dos próximos 6 meses: saldo atual + contas a receber abertas − contas a pagar abertas, agrupadas por mês de vencimento; para meses cujas contas de despesas fixas ainda não foram geradas, usa as despesas fixas ativas. |
| RF63 | Para o papel Colaborador, o Dashboard deve ser restrito a: vendas do dia e alertas de estoque baixo — sem saldo em caixa, semáforo, ponto de equilíbrio ou gráficos de faturamento. |

---

## 8. Modelo Freemium

### Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF45 | O sistema deve diferenciar funcionalidades disponíveis no plano gratuito das disponíveis apenas no plano pago. |
| RF46 | O plano gratuito não deve impor limite de quantidade de produtos, vendas ou lançamentos financeiros. |
| RF47 | Funcionalidades como relatórios avançados (RF70, RF71 e histórico acima de 12 meses) e gestão de múltiplos colaboradores devem ser exclusivas do plano pago. O plano gratuito permite o Dono e **1 colaborador** (membro ou convite pendente — RF72); a partir do segundo, é necessário o plano pago. Todos os demais módulos, inclusive a Calculadora completa, estão disponíveis no plano gratuito. |
| RF73 | O Dono deve poder trocar o plano do negócio (gratuito ↔ pago), com registro de quem trocou e quando. No MVP a troca é **simulada**, sem cobrança; a cobrança real (gateway de pagamento) é uma evolução planejada (SPEC-015, ADR-007) que substitui apenas o ponto de troca de plano. Ao voltar para o gratuito, nenhum dado é apagado (RN18) e os colaboradores além do limite perdem o acesso até um novo upgrade. O plano também pode ser trocado pela plataforma (RF86). |
| RF86 | O plano de um negócio também deve poder ser trocado **pela plataforma** (gratuito ↔ pago), com motivo (cortesia, correção ou teste), pedido por uma conta de Administrador e **aprovado por outra** em até 12 h, com as mesmas regras do RF73, registro no histórico de planos como "pela plataforma" e aviso ao Dono (SPEC-019). |
| RF70 | No plano pago, o sistema deve oferecer o relatório de **rentabilidade por item**: para cada produto/serviço, faturamento, custo (custo unitário gravado nas vendas) e margem real no período. |
| RF71 | No plano pago, o sistema deve permitir **exportar relatórios** de vendas, fluxo de caixa e contas por período, em CSV e PDF. |

### Regras de Negócio

- **RN18** — A limitação do plano Freemium é sempre por **funcionalidade disponível**, nunca por volume de uso (quantidade de produtos, vendas ou registros). O número de usuários do negócio (RF47) é tratado como funcionalidade de multiusuário, não como volume de dados. No plano gratuito, gráficos e filtros mostram até os últimos 12 meses; os dados mais antigos nunca são apagados e voltam a ficar visíveis no plano pago.

---

## 9. Requisitos Não Funcionais

| ID | Descrição |
|---|---|
| RNF01 | A aplicação deve ser web, acessível via navegador, com layout responsivo para desktop e mobile. |
| RNF02 | Os dados de cada negócio devem ser isolados logicamente dos demais (arquitetura multi-tenant), impedindo acesso cruzado entre contas — inclusive por acesso direto à API pública do provedor do banco. As únicas exceções são o acesso de suporte liberado pelo Dono (RN30, RN31) e o acesso de emergência (RN38), ambos conferidos no servidor a cada requisição. |
| RNF03 | Senhas de usuário devem ser armazenadas com hash seguro, nunca em texto plano. |
| RNF04 | O sistema deve estar em conformidade com a LGPD, incluindo política de privacidade, consentimento explícito e mecanismos de exportação/exclusão de dados pessoais. A exportação gera um arquivo .zip com os dados do titular em JSON (completo) e CSV (por tabela). A exclusão de conta segue a RN27. |
| RNF05 | Alterações em estoque (entrada, saída manual) e em preço devem manter registro auditável (data, usuário responsável, valor anterior e novo, motivo quando aplicável). Os próprios registros de movimentação de estoque e de histórico de preço são o log: nunca são alterados nem apagados. |
| RNF06 | O cálculo de precificação e do RBT12 deve responder de forma performática, mesmo com histórico extenso de vendas. |
| RNF07 | A sessão do usuário deve persistir ao alternar entre negócios, sem exigir novo login. |
| RNF08 | Os percentuais/faixas de alíquota de MEI e Simples Nacional devem ser mantidos de forma parametrizável (configuração, não código), para facilitar atualização conforme mudanças na legislação. |
| RNF09 | O sistema deve manter rotina de backup diário dos dados: enquanto o banco estiver no plano gratuito do Supabase, um dump diário automatizado (GitHub Actions) guardado de forma privada; em produção, o backup diário nativo do plano pago do Supabase, mantendo o dump como cópia externa. |
| RNF10 | A arquitetura do Dashboard e dos módulos deve ser extensível, suportando a adição de novos indicadores e integrações (Nota Fiscal, PIX, gateway de pagamento) sem necessidade de reestruturação do core. |
| RNF11 | O sistema deve ter ambientes separados de **desenvolvimento**, **homologação** e **produção**, cada um com banco e credenciais próprios: homologação atualizada a cada integração na branch `DEVELOP` e produção a cada versão estável na `main`. Dados reais de clientes existem somente em produção. |
| RNF12 | A sessão de uma conta de Administrador da plataforma deve expirar 8 h após a entrada com senha, exigindo novo login. O segundo fator de autenticação (TOTP) do Administrador é obrigatório, e as ações críticas exigem o código verificado nos últimos 10 min (SPEC-019). |

---

### Regras de Negócio

- **RN29** — Datas são armazenadas em UTC; "dia", "mês" e "competência" (vendas do dia, RBT12, faturamento do mês, semáforo, contas mensais, gráficos) são sempre calculados no fuso **America/Sao_Paulo**.
- **RN27** — A exclusão de conta (LGPD) bloqueia o acesso e **anonimiza** os dados pessoais (nome, e-mail e senha do usuário; todos os dados pessoais dos clientes dos negócios em que ele é o único Dono: nome, documento, e-mail, telefone e endereço). Os registros fiscais e financeiros desses negócios (vendas, lançamentos, contas, movimentações) são mantidos por 5 anos, sem identificação pessoal, para cumprimento de obrigações legais, e os negócios ficam encerrados. Um cliente também pode ser excluído sozinho, a pedido: sem vendas, o cadastro é apagado; com vendas, é anonimizado, e as vendas são mantidas sem identificação e com os mesmos valores (SPEC-022).

---

## 10. Regras de Negócio Consolidadas

| ID | Regra |
|---|---|
| RN01 | Dados isolados por negócio; colaborador só acessa negócios aos quais foi convidado; exceções: acesso de suporte liberado pelo Dono (RN30, RN31) e acesso de emergência (RN38). |
| RN02 | Apenas o Dono pode convidar/remover colaboradores e alterar permissões. |
| RN03 | Produto Físico é criado com estoque inicial zero. |
| RN04 | Tipo do item (Físico/Serviço) determina participação no Estoque e possibilidade de materiais vinculados. |
| RN05 | Serviço com materiais vinculados dá baixa automática desses materiais no estoque ao ser vendido; quantidades ajustáveis na venda (SPEC-017). |
| RN06 | Vendas com estoque insuficiente não são permitidas; o sistema bloqueia a operação. |
| RN07 | Alerta pelo mínimo sugerido fica desativado até o produto completar 1 ciclo (ao menos 1 entrada e 1 saída); com mínimo manual, alerta desde já. |
| RN08 | Estoque mínimo sugerido automaticamente após o 1º ciclo; sobrescrevível manualmente a qualquer momento. |
| RN09 | Dinheiro/PIX/Débito geram lançamento imediato no caixa. |
| RN10 | Cartão de Crédito (à vista ou parcelado) gera conta(s) a receber com vencimento futuro. |
| RN11 | Valor da parcela é o total dividido igualmente; diferença de centavos na 1ª parcela; sem desconto de taxa de maquininha no MVP. |
| RN12 | Toda venda dispara baixa de estoque + lançamento financeiro automaticamente. |
| RN13 | Lançamentos automáticos de venda usam a categoria "Vendas". |
| RN14 | Saldo de caixa reflete apenas valores já recebidos/pagos, não contas a receber futuras. |
| RN15 | Preço de venda oficial é sempre o último preço confirmado pelo usuário; ajuste por linha na venda, com permissão e motivo, sem mudar o oficial (SPEC-017). |
| RN16 | Toda confirmação de novo preço gera registro em histórico. |
| RN17 | Parâmetros fiscais (faixas por Anexo, CNAE → Anexo, DAS e limite do MEI, margens padrão) são parametrizáveis, com fonte legal e vigência. |
| RN18 | Limitação do plano Freemium é por funcionalidade, nunca por volume de uso. |
| RN19 | Soma de Desp. Fixas% + Desp. Variáveis% + Imposto% + Margem% deve ser < 100%; senão o cálculo é bloqueado. |
| RN20 | Taxa de cartão e comissão entram só na formação do preço; não descontam lançamentos nem geram repasse no MVP. |
| RN21 | RBT12 e faturamento bruto somam todas as vendas registradas no período (competência), inclusive as ainda não recebidas. RBT12 = 12 meses anteriores ao mês do cálculo; proporcional (média × 12 ou estimado × 12) com histórico menor. |
| RN22 | Todo pagamento/recebimento de conta (total ou parcial) gera lançamento no caixa; o status da conta é a fonte única de verdade. |
| RN23 | Item sem preço oficial confirmado não pode ser vendido. |
| RN24 | O Anexo do Simples é definido por negócio e aplicado a todo o faturamento; separação por atividade fora do MVP. |
| RN25 | Cancelamento de venda em transação única: estoque devolvido, contas abertas canceladas, recebidos estornados (exceto crédito de troca); venda cancelada sai do RBT12, faturamento e CMV%. |
| RN26 | Crédito de troca limitado ao já recebido; não gera novo lançamento; reembolso = recebido − crédito usado. |
| RN27 | Exclusão de conta anonimiza dados pessoais e mantém registros fiscais/financeiros por 5 anos sem identificação. Um cliente também pode ser excluído sozinho: sem vendas, é apagado; com vendas, é anonimizado. |
| RN28 | Anexo efetivo sujeito ao Fator R recalculado a cada cálculo; sem RBT12, usa o Anexo V. |
| RN29 | Datas em UTC; dia, mês e competência calculados em America/Sao_Paulo. |
| RN30 | Administrador sem liberação ativa do Dono não acessa dados operacionais, exceto pela emergência (RN38); com ela, só os módulos liberados, para leitura e as correções permitidas pelo Dono, em nome próprio. |
| RN31 | Só o Dono libera e revoga o suporte; prazo de 1 h, 24 h, 3 dias ou 7 dias (1 h ou 12 h com correção); uma liberação ativa por negócio. |
| RN32 | Registro de auditoria do suporte imutável, guardado por 5 anos. |
| RN33 | Subcategoria só organiza: não altera margem, preço, custo, estoque nem regras fiscais. |
| RN34 | NCM é responsabilidade do negócio: o sistema confere na tabela vigente e sugere, sem preencher sozinho; não entra em cálculo. |
| RN35 | Negócio que emite nota fiscal de produtos: NCM obrigatório no produto físico e produto sem NCM fora da venda. |
| RN36 | Dados do cliente: só o nome obrigatório; documento validado e único no negócio; dados completos só para quem edita clientes; CPF nunca enviado a serviço externo; selo "completo para nota" não bloqueia a venda. |
| RN37 | Suporte só corrige a lista fechada, desfazível pelo Dono; nunca vendas, clientes, equipe, configurações, plano, acesso do suporte ou LGPD. |
| RN38 | Emergência: duas contas de Administrador, só leitura, até 4 h, pedido expira em 12 h, visível ao Dono desde o pedido. |
| RN39 | Negócio suspenso: somente leitura, exportação e exclusão mantidas, nada apagado. |

---

## Próximos Passos Técnicos

- [x] ~~Decisões da revisão de consistência da baseline~~ — OPEN-12 a OPEN-31 registradas no Mapa de Specs (seção 1.8).
- [x] ~~Conferir nas fontes oficiais os parâmetros fiscais de `docs/prisma_base/parametros_fiscais_seed.json` (faixas dos Anexos I–V, DAS e limite do MEI do ano vigente, amostra CNAE → Anexo, margens padrão) antes da SPEC-003.~~ — conferido em 03/10/2026: faixas corretas; DAS atualizado para o salário mínimo de 2026 (R$ 82,05 / R$ 86,05 / R$ 87,05); limite do MEI mantido em R$ 81.000,00.
- [x] ~~Tratamento do Fator R e de negócios multi-anexo~~ — Fator R automático (RF69, RN28); anexo único por negócio no MVP, com aviso (RN24).
- [ ] Detalhar wireframes das telas de: cadastro de produto/serviço, registro de venda (com pagamento misto), calculadora de precificação e dashboard.
- [x] ~~Definir a matriz de permissões granulares (RF06)~~ — módulo × ação; a tabela completa é detalhada na SPEC-005.
- [x] ~~Validar o mapeamento categoria → presunção (RF36)~~ — Serviços, Beleza, Saúde e Tecnologia: 32%; Produtos, Alimentação, Vestuário, Casa e Outros: 8%. Acessórios (SPEC-020, 19/10/2026): 8%, comércio.
