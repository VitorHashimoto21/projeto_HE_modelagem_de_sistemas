# Modelo Lógico de Banco de Dados (DER) — HE (HealthEnterprise)

Este documento especifica a estrutura relacional do banco de dados (Modelo Lógico) do sistema **HealthEnterprise (HE)**, derivado do Modelo de Domínio Conceitual e preparado para a implementação no Prisma ORM (PostgreSQL).

---

## 📊 Diagrama Entidade-Relacionamento (ER)

> **Dica de Renderização:** O GitHub renderiza o bloco abaixo automaticamente nas páginas do repositório.

```mermaid
erDiagram
    USUARIO ||--o{ MEMBRO_NEGOCIO : "participa_como"
    NEGOCIO ||--o{ MEMBRO_NEGOCIO : "possui"
    NEGOCIO ||--o{ ITEM : "cadastra"
    NEGOCIO ||--o{ VENDA : "registra"
    NEGOCIO ||--o{ LANCAMENTO_FINANCEIRO : "mantem"
    NEGOCIO ||--o{ CONTA_PAGAR_RECEBER : "mantem"

    ITEM ||--o| PRODUTO_FISICO : "especializacao"
    ITEM ||--o| SERVICO : "especializacao"
    CATEGORIA ||--o{ ITEM : "classifica"
    ITEM ||--o{ HISTORICO_PRECO : "acumula"

    SERVICO ||--o{ MATERIAL_SERVICO : "consome"
    PRODUTO_FISICO ||--o{ MATERIAL_SERVICO : "eh_utilizado_em"
    PRODUTO_FISICO ||--o{ MOVIMENTACAO_ESTOQUE : "registra"

    CLIENTE ||--o{ VENDA : "associa"
    VENDA ||--|{ ITEM_VENDA : "contem"
    ITEM ||--o{ ITEM_VENDA : "compoe"
    VENDA ||--|{ PAGAMENTO : "recebe"
    VENDA ||--|| LANCAMENTO_FINANCEIRO : "gera"
    PAGAMENTO ||--o{ PARCELA : "gera_se_credito"
    PARCELA ||--|| CONTA_PAGAR_RECEBER : "origina"

    NEGOCIO {
        uuid id PK
        string nome
        string regime_tributario
        string plano
        datetime criado_em
    }

    USUARIO {
        uuid id PK
        string nome
        string email UK
        string senha_hash
    }

    MEMBRO_NEGOCIO {
        uuid id PK
        uuid usuario_id FK
        uuid negocio_id FK
        string papel
        string permissoes_customizadas
    }

    CATEGORIA {
        uuid id PK
        string nome
    }

    ITEM {
        uuid id PK
        uuid negocio_id FK
        uuid categoria_id FK
        string tipo_item
        string nome
        decimal custo
        decimal preco_atual
    }

    PRODUTO_FISICO {
        uuid item_id PK, FK
        decimal quantidade_estoque
        decimal estoque_minimo
        string unidade_medida
    }

    SERVICO {
        uuid item_id PK, FK
        string unidade_medida
    }

    MATERIAL_SERVICO {
        uuid id PK
        uuid servico_id FK
        uuid produto_fisico_id FK
        decimal quantidade
    }

    MOVIMENTACAO_ESTOQUE {
        uuid id PK
        uuid produto_fisico_id FK
        string tipo
        decimal quantidade
        string motivo
        datetime data
    }

    VENDA {
        uuid id PK
        uuid negocio_id FK
        uuid cliente_id FK
        decimal valor_total
        datetime data
    }

    ITEM_VENDA {
        uuid id PK
        uuid venda_id FK
        uuid item_id FK
        decimal quantidade
        decimal preco_unitario_na_venda
    }

    PAGAMENTO {
        uuid id PK
        uuid venda_id FK
        string forma_pagamento
        decimal valor
        int numero_parcelas
    }

    PARCELA {
        uuid id PK
        uuid pagamento_id FK
        int numero
        decimal valor
        datetime vencimento
        string status
    }

    LANCAMENTO_FINANCEIRO {
        uuid id PK
        uuid negocio_id FK
        uuid venda_id FK
        string tipo
        string categoria
        decimal valor
        datetime data
    }

    CONTA_PAGAR_RECEBER {
        uuid id PK
        uuid negocio_id FK
        string tipo
        decimal valor_total
        decimal valor_pago
        datetime vencimento
        string status
    }
```

---

## 🖼️ Imagem Exportada
![Modelo Lógico de Banco de Dados](./img/modelo_logico.png)
