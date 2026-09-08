## Diagrama 1: Diagrama de Sequência da Calculadora de Precificação

Este diagrama descreve como a interface, a camada de regras de negócio (Server Actions) e o banco de dados via Prisma trabalham juntos no Next.js para calcular e gravar um preço. Ele engloba a soma dinâmica de insumos se for um serviço e o cálculo da alíquota do Simples Nacional com base no faturamento acumulado (RBT12).

```mermaid
sequenceDiagram
    autonumber
    actor Empreendedor as 👤 Empreendedor
    participant UI as 📱 UI (Next.js React Client)
    participant Action as ⚙️ Server Action (Next.js)
    participant ORM as ⛓️ Prisma Client
    participant DB as 🗄️ Banco de Dados (PostgreSQL)

    Empreendedor->>UI: Solicita cálculo de preço de um Item
    UI->>Action: getDadosCalculo(itemId, regimeTributario)
    
    rect rgb(240, 240, 255)
        note right of Action: Se o item for um Serviço, busca insumos vinculados
        Action->>ORM: Item.findUnique(include: MaterialServico)
        ORM->>DB: SELECT * FROM Item WHERE id = itemId ...
        DB-->>ORM: Dados do Item + lista de materiais
        ORM-->>Action: Objeto Item completo
    end

    rect rgb(255, 240, 240)
        note right of Action: Se regime for Simples Nacional, calcula faturamento acumulado (RBT12)
        Action->>ORM: LancamentoFinanceiro.aggregate(_sum: valor, categoria: 'Vendas', últimos 12 meses)
        ORM->>DB: SELECT SUM(valor) FROM LancamentoFinanceiro WHERE ...
        DB-->>ORM: Valor consolidado do RBT12
        ORM-->>Action: RBT12 (R$)
    end

    Action->>Action: Executa cálculo da Alíquota do Imposto
    Action->>Action: Aplica fórmula: PreçoSugerido = CustoProduto x Markup, em que *Markup = 1/(1 - (Desp fixas + Desp variáveis + Margem))
    Action-->>UI: Retorna Preço Sugerido e detalhes do cálculo
    UI-->>Empreendedor: Exibe preço sugerido e aguarda confirmação

    Empreendedor->>UI: Clica em "Confirmar Preço Oficial"
    UI->>Action: confirmarNovoPreco(itemId, precoFinal, margemAplicada)
    
    rect rgb(240, 255, 240)
        note right of Action: Transação para atualizar o preço atual e gravar histórico
        Action->>ORM: transaction(Item.update, HistoricoPreco.create)
        ORM->>DB: UPDATE Item SET precoAtual, INSERT INTO HistoricoPreco
        DB-->>ORM: Confirmação da gravação
    end
    
    ORM-->>Action: Transação Concluída com Sucesso
    Action-->>UI: Retorna sucesso e preço atualizado
    UI-->>Empreendedor: Exibe feedback visual de sucesso
```

## Diagrama 2: Diagrama de Sequência de Registro de Venda (Integração ERP)

Este diagrama detalha a complexa interação transacional exigida pelas regras de negócio: dar baixa automática em estoque físico, calcular repasse de comissões e dividir pagamentos de cartão de crédito em parcelas a receber futuras.

```mermaid
sequenceDiagram
    autonumber
    actor Operador as 👤 Operador (Dono/Gerente/Colaborador)
    participant UI as 📱 UI (Frente de Caixa - Next.js)
    participant Action as ⚙️ Server Action (Next.js)
    participant ORM as ⛓️ Prisma Client
    participant DB as 🗄️ Banco de Dados (PostgreSQL)

    Operador->>UI: Adiciona produtos, escolhe forma de pagamento e clica em "Finalizar Venda"
    UI->>Action: registrarVenda(negocioId, itensCarrinho, pagamentos)
    
    rect rgb(255, 245, 230)
        note right of Action: Inicia transação ACID de Venda no Banco de Dados
        Action->>ORM: Iniciar Transação (prisma.$ transaction)
        
        Action->>ORM: Venda.create(dados da venda)
        ORM->>DB: INSERT INTO Venda ...
        DB-->>ORM: vendaId gerado

        loop Para cada Item do carrinho
            note right of Action: Baixa automática de estoque
            Action->>ORM: MovimentacaoEstoque.create(tipo: SaidaVenda)
            ORM->>DB: INSERT INTO MovimentacaoEstoque, UPDATE ProdutoFisico SET quantidadeEstoque
            
            note right of Action: Se o item for Serviço, busca e baixa seus materiais de consumo
            Action->>ORM: Materiais do Serviço
            ORM->>DB: SELECT materiais ... UPDATE estoque materiais
        end

        loop Para cada método de pagamento da venda
            alt Se pagamento for imediato (Dinheiro, PIX ou Débito)
                Action->>ORM: LancamentoFinanceiro.create(tipo: Entrada, categoria: Vendas)
                ORM->>DB: INSERT INTO LancamentoFinanceiro (disponível no caixa imediato)
            else Se pagamento for parcelado (Cartão de Crédito)
                Action->>ORM: ContaPagarReceber.create(tipo: Receber, parcelado)
                ORM->>DB: INSERT INTO ContaPagarReceber (fora do caixa imediato até conciliação)
                loop Para cada parcela (1 a N)
                    Action->>ORM: Parcela.create(vencimento_mensal, status: Pendente)
                    ORM->>DB: INSERT INTO Parcela
                end
            end
        end

        Action->>ORM: Finalizar e Commitar Transação
        ORM->>DB: COMMIT
        DB-->>ORM: Transação persistida com sucesso
    end

    ORM-->>Action: Sucesso na venda e atualizações
    Action-->>UI: Retorna venda finalizada + novos saldos
    UI-->>Operador: Limpa o carrinho e exibe tela de venda concluída
```

## Diagrama 3: Diagrama de Transição de Estados da Conta (Pagar/Receber)

Uma das regras de negócio é o suporte a pagamentos parciais. Se uma conta não for quitada inteiramente, ela deve permanecer em aberto exibindo o valor restante. Este diagrama mapeia rigorosamente as transições de estado para orientar os testes unitários no back-end.

```mermaid
stateDiagram-v2
    [*] --> Pendente : Lançamento criado (vencimento futuro)
    
    Pendente --> Quitado : Registrar Pagamento Total (valorPago == valorTotal)
    Pendente --> PagoParcialmente : Registrar Pagamento Parcial (valorPago < valorTotal)
    
    PagoParcialmente --> PagoParcialmente : Registrar novo pagamento parcial (soma_pagamentos < valorTotal)
    PagoParcialmente --> Quitado : Registrar pagamento do saldo restante (soma_pagamentos == valorTotal)
    
    Pendente --> Atrasado : Data atual ultrapassa Vencimento (saldo_aberto > 0)
    PagoParcialmente --> Atrasado : Data atual ultrapassa Vencimento (saldo_aberto > 0)
    
    Atrasado --> Quitado : Registrar quitação do saldo em atraso
    Atrasado --> PagoParcialmente : Registrar pagamento parcial de conta atrasada

    Quitado --> [*] : Conta arquivada no histórico financeiro
```
