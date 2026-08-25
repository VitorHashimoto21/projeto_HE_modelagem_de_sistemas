# Fluxogramas — Documento para Leitura por IA

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

Este arquivo reúne, em texto puro (sintaxe Mermaid), todos os fluxogramas do projeto: as 3 jornadas de usuário (tela a tela, por papel de acesso) e o diagrama de caso de uso. O objetivo é permitir que qualquer IA ou ferramenta leia e interprete os fluxos sem depender de imagem — bastando processar os blocos de código abaixo.

Cada bloco é independente e pode ser renderizado isoladamente em qualquer visualizador Mermaid (ex.: [mermaid.live](https://mermaid.live), GitHub, VS Code com extensão Mermaid).

---

## Jornada do Dono (acesso total)

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

---

## Jornada do Gerente (acesso total, exceto configurações)

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

---

## Jornada do Colaborador (Vendas e Estoque, sem Financeiro)

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

---

## Diagrama de Caso de Uso

```mermaid
flowchart LR
    Dono(["👤 Dono"])
    Gerente(["👤 Gerente"])
    Colaborador(["👤 Colaborador"])

    subgraph Sistema["Sistema: ERP + Calculadora de Precificacao"]
        direction TB
        UC1("Autenticar-se")
        UC2("Alternar entre Negocios")
        UC3("Convidar Colaborador")
        UC4("Definir Permissoes")
        UC5("Cadastrar Produto Fisico")
        UC6("Cadastrar Servico")
        UC6a("Vincular Materiais ao Servico")
        UC7("Registrar Entrada de Estoque")
        UC8("Registrar Saida Manual de Estoque")
        UC9("Consultar Alertas de Estoque Baixo")
        UC10("Calcular Preco de Venda")
        UC10a("Confirmar Preco de Venda")
        UC10b("Consultar Historico de Precos")
        UC11("Registrar Venda")
        UC11a("Registrar Pagamento")
        UC11b("Parcelar no Cartao de Credito")
        UC11c("Dar Baixa Automatica no Estoque")
        UC11d("Gerar Lancamento Financeiro")
        UC12("Consultar Fluxo de Caixa")
        UC13("Gerenciar Contas a Pagar e Receber")
        UC14("Consultar Dashboard")
        UC15("Gerenciar Plano do Negocio")
    end

    Dono --- UC1
    Dono --- UC2
    Dono --- UC3
    Dono --- UC4
    Dono --- UC5
    Dono --- UC6
    Dono --- UC7
    Dono --- UC8
    Dono --- UC9
    Dono --- UC10
    Dono --- UC11
    Dono --- UC12
    Dono --- UC13
    Dono --- UC14
    Dono --- UC15

    Gerente --- UC1
    Gerente --- UC2
    Gerente --- UC5
    Gerente --- UC6
    Gerente --- UC7
    Gerente --- UC8
    Gerente --- UC9
    Gerente --- UC10
    Gerente --- UC11
    Gerente --- UC12
    Gerente --- UC13
    Gerente --- UC14

    Colaborador --- UC1
    Colaborador --- UC2
    Colaborador --- UC7
    Colaborador --- UC8
    Colaborador --- UC9
    Colaborador --- UC11
    Colaborador --- UC14
    Colaborador -.->|extend via permissao customizada| UC10

    UC6 -.->|include| UC6a
    UC11 -.->|include| UC11a
    UC11 -.->|include| UC11c
    UC11 -.->|include| UC11d
    UC11a -.->|extend se Credito| UC11b
    UC10 -.->|extend| UC10a
    UC10a -.->|include| UC10b
```

---

