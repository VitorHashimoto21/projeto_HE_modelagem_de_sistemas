# Modelo de Domínio e Jornadas de Usuário

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

*Documento complementar — construído a partir dos RF, RNF e Regras de Negócio*

> Este arquivo usa a sintaxe [Mermaid](https://mermaid.js.org/). O GitHub renderiza os diagramas automaticamente ao visualizar o `.md`. Para editar, basta alterar os blocos de código dentro de \`\`\`mermaid \`\`\` — ferramentas como o [Mermaid Live Editor](https://mermaid.live) também permitem visualizar e ajustar antes de commitar.

---

## 1. Diagrama de Domínio

Representa os conceitos centrais do negócio, seus atributos, relacionamentos e cardinalidades — sem qualquer referência a banco de dados, framework ou arquitetura.

```mermaid
classDiagram
    class Negocio {
        +nome
        +regimeTributario  MEI | Simples
        +plano  Gratuito | Pago
    }

    class Usuario {
        +nome
        +email
        +senha
    }

    class MembroNegocio {
        +papel  Dono | Gerente | Colaborador
        +permissoesCustomizadas
    }

    class Categoria {
        <<lista fixa>>
        Servicos
        Produtos
        Alimentacao
        Vestuario
        Beleza
        Saude
        Casa
        Tecnologia
        Outros
    }

    class Item {
        <<abstrato>>
        +nome
        +custo
        +precoAtual
    }

    class ProdutoFisico {
        +quantidadeEstoque
        +estoqueMinimo
        +unidadeMedida
    }

    class Servico {
        +unidadeMedida
    }

    class MaterialServico {
        +quantidade  padrao = 1, editavel
    }

    class MovimentacaoEstoque {
        +tipo  Entrada | SaidaVenda | SaidaManual
        +quantidade
        +data
        +motivo  obrigatorio se SaidaManual
    }

    class HistoricoPreco {
        +preco
        +margemAplicada
        +impostoAplicado
        +dataConfirmacao
    }

    class Cliente {
        +nome
        +contato
    }

    class Venda {
        +data
        +valorTotal
    }

    class ItemVenda {
        +quantidade
        +precoUnitarioNaVenda
    }

    class Pagamento {
        +formaPagamento  Dinheiro | PIX | Debito | Credito
        +valor
        +numeroParcelas  1 a 12, so Credito
    }

    class Parcela {
        +numero
        +valor
        +vencimento
        +status  Pendente | Pago | Parcial
    }

    class LancamentoFinanceiro {
        +tipo  Entrada | Saida
        +categoria  Vendas | Fornecedores | Impostos | Salario | Outros
        +valor
        +data
        +origem  Venda | Manual
    }

    class ContaPagarReceber {
        +tipo  Pagar | Receber
        +valorTotal
        +valorPago
        +vencimento
        +status  Aberta | Parcial | Quitada
    }

    Negocio "1" --> "N" MembroNegocio : possui
    Usuario "1" --> "N" MembroNegocio : participa como
    Negocio "1" --> "N" Item : cadastra
    Negocio "1" --> "N" Venda : registra
    Negocio "1" --> "N" LancamentoFinanceiro : mantem
    Negocio "1" --> "N" ContaPagarReceber : mantem

    Item <|-- ProdutoFisico
    Item <|-- Servico
    Item "1" --> "N" Categoria : pertence a
    Item "1" --> "N" HistoricoPreco : acumula

    Servico "1" --> "N" MaterialServico : consome
    MaterialServico "N" --> "1" ProdutoFisico : referencia

    ProdutoFisico "1" --> "N" MovimentacaoEstoque : sofre

    Venda "0..1" --> "1" Cliente : associada a
    Venda "1" --> "N" ItemVenda : contem
    ItemVenda "N" --> "1" Item : refere-se a
    Venda "1" --> "N" Pagamento : e paga por
    Pagamento "1" --> "N" Parcela : gera quando Credito

    Venda "1" --> "1" LancamentoFinanceiro : dispara
    Parcela "1" --> "1" ContaPagarReceber : origina
```

### Notas de regras de negócio ligadas ao modelo

| Classe | Regra |
|---|---|
| `ProdutoFisico` | Nasce com `quantidadeEstoque = 0`; a quantidade só é alterada via `MovimentacaoEstoque` (RN03). |
| `MovimentacaoEstoque` | Alerta de estoque baixo só é calculado após o item completar 1 ciclo de Entrada + Saída (RN07). |
| `MaterialServico` | Quantidade sugerida automaticamente como 1, editável pelo usuário (RF13). |
| `HistoricoPreco` | Cada novo registro representa uma confirmação explícita do usuário; o mais recente é o `precoAtual` do `Item` (RN15, RN16). |
| `Pagamento` | Dinheiro/PIX/Débito geram `LancamentoFinanceiro` imediato; Cartão de Crédito gera `Parcela(s)` → `ContaPagarReceber` (RN09, RN10). |
| `Parcela` | Vencimentos gerados mensalmente a partir da data da `Venda`, limitado a 12 parcelas (RF27, RF28). |
| `MembroNegocio` | Isola o acesso: um `Usuario` só enxerga dados dos `Negocio`s onde tem `MembroNegocio` (RN01). |

---

## 2. Jornadas de Usuário (Tela a Tela)

Fluxos de navegação por papel de usuário, com base nas permissões definidas em RF05/RF06.

### 2.1 Jornada — Dono (acesso total)

```mermaid
flowchart TD
    A[Tela de Login] -->|e-mail + senha| B[Selecionar Negocio]
    B --> C[Dashboard]

    C --> D[Cadastro de Produto/Servico]
    D --> D1{Tipo do item?}
    D1 -->|Fisico| D2[Formulario Produto Fisico]
    D1 -->|Servico| D3[Formulario Servico]
    D3 --> D4{Possui materiais?}
    D4 -->|Sim| D5[Vincular materiais do Estoque]
    D4 -->|Nao| D6[Salvar Servico]
    D2 --> D7[Salvar Produto]

    C --> E[Estoque]
    E --> E1[Lista de Produtos]
    E1 --> E2[Entrada de Estoque]
    E1 --> E3[Saida Manual - motivo obrigatorio]
    E1 --> E4[Alerta de Estoque Baixo]

    C --> F[Calculadora de Precificacao]
    F --> F1[Selecionar Item]
    F1 --> F2[Definir Margem - sugerida por categoria]
    F2 --> F3[Selecionar Regime Tributario]
    F3 --> F4[Ver Preco Sugerido]
    F4 --> F5{Confirmar preco?}
    F5 -->|Sim| F6[Salvar como Preco Oficial + Historico]
    F5 -->|Nao| F1

    C --> G[Nova Venda]
    G --> G1[Adicionar Itens]
    G1 --> G2{Informar Cliente?}
    G2 -->|Sim| G3[Buscar/Cadastrar Cliente]
    G2 -->|Nao| G4[Selecionar Pagamento]
    G3 --> G4
    G4 --> G5{Multiplas formas?}
    G5 -->|Sim| G6[Dividir valores entre formas]
    G5 -->|Nao| G7[Forma unica]
    G6 --> G8{Soma bate com total?}
    G8 -->|Nao| G6
    G8 -->|Sim| G9[Confirmar Venda]
    G7 --> G9
    G9 --> G10[Baixa de Estoque + Lancamento Financeiro automaticos]

    C --> H[Financeiro]
    H --> H1[Fluxo de Caixa]
    H --> H2[Contas a Pagar/Receber]
    H2 --> H3[Marcar como Pago/Recebido - total ou parcial]

    C --> I[Configuracoes do Negocio]
    I --> I1[Convidar Colaborador]
    I1 --> I2[Definir Papel: Gerente/Colaborador]
    I2 --> I3[Customizar Permissoes por Modulo]
    I --> I4[Gerenciar Plano - Gratuito/Pago]
```

### 2.2 Jornada — Gerente (acesso total, exceto configurações)

```mermaid
flowchart TD
    A[Tela de Login] --> B[Selecionar Negocio]
    B --> C[Dashboard]
    C --> D[Cadastro de Produto/Servico]
    C --> E[Estoque]
    C --> F[Calculadora de Precificacao]
    C --> G[Nova Venda]
    C --> H[Financeiro]
    C -.-> I[[Configuracoes - acesso bloqueado]]
```

### 2.3 Jornada — Colaborador (Vendas e Estoque, sem Financeiro)

```mermaid
flowchart TD
    A[Tela de Login] --> B[Selecionar Negocio]
    B --> C[Dashboard restrito]
    C --> D[Estoque]
    D --> D1[Consultar Produtos]
    D --> D2[Registrar Entrada/Saida]

    C --> E[Nova Venda]
    E --> E1[Adicionar Itens]
    E1 --> E2[Selecionar Pagamento]
    E2 --> E3[Confirmar Venda]
    E3 --> E4[Baixa de Estoque automatica]

    C -.-> F[[Financeiro - acesso bloqueado]]
    C -.-> G[[Calculadora de Precificacao - conforme permissao granular]]
    C -.-> H[[Configuracoes - acesso bloqueado]]
```

> A Calculadora aparece como bloqueada por padrão para o Colaborador no papel fixo, mas pode ser liberada via permissão granular customizada (RF06).

---

## Próximos ajustes sugeridos

- [ ] Validar se `Cliente` deveria ter campos adicionais (histórico de compras, contato via WhatsApp) para uma futura fase.
- [ ] Confirmar se `LancamentoFinanceiro` deve se relacionar 1:1 ou 1:N com `Venda` (ex.: venda com pagamento misto pode gerar mais de um lançamento imediato).
- [ ] Ajustar a jornada do Colaborador conforme as permissões granulares reais forem desenhadas nas telas.
- [ ] Adicionar jornada de "primeiro acesso" (onboarding) separada, já que ela provavelmente difere do fluxo recorrente mostrado acima.
