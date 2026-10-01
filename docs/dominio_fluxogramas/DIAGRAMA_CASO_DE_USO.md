# Diagrama de Caso de Uso

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

*Documento complementar — construído a partir dos RF, RNF e Regras de Negócio*

---

```mermaid
flowchart LR
    Dono(["👤 Dono"])
    Gerente(["👤 Gerente"])
    Colaborador(["👤 Colaborador"])

    subgraph Sistema["Sistema: ERP + Calculadora de Precificacao"]
        direction TB
        UC0("Cadastrar Negocio - consulta CNPJ")
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
        UC12a("Registrar Despesa Operacional")
        UC13("Gerenciar Contas a Pagar e Receber")
        UC14("Consultar Dashboard")
        UC15("Gerenciar Plano do Negocio")
        UC16("Gerenciar Despesas Fixas e Parametros de Precificacao")
        UC17("Ver Semaforo e Ponto de Equilibrio")
    end

    Dono --- UC0
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
    Dono --- UC12a
    Dono --- UC16
    Dono --- UC17

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
    Gerente --- UC12a
    Gerente --- UC16
    Gerente --- UC17

    Colaborador --- UC1
    Colaborador --- UC2
    Colaborador --- UC7
    Colaborador --- UC8
    Colaborador --- UC9
    Colaborador --- UC11
    Colaborador --- UC14
    Colaborador -.->|extend via permissao customizada| UC10
    Colaborador -.->|extend via permissao customizada| UC12a

    UC6 -.->|include| UC6a
    UC11 -.->|include| UC11a
    UC11 -.->|include| UC11c
    UC11 -.->|include| UC11d
    UC11a -.->|extend se Credito| UC11b
    UC10 -.->|extend| UC10a
    UC10a -.->|include| UC10b
```

## Legenda

| Elemento | Significado |
|---|---|
| Linha contínua (`---`) | Associação direta entre ator e caso de uso |
| `-.->\|include\|` | O caso de uso de origem sempre executa o caso de uso de destino como parte do seu fluxo |
| `-.->\|extend\|` | O caso de uso de destino só ocorre condicionalmente, estendendo o fluxo do caso de uso de origem |

## Casos de uso por ator

| Ator | Casos de uso |
|---|---|
| **Dono** | Todos os casos de uso principais, incluindo Cadastrar Negócio (consulta CNPJ), Convidar Colaborador, Definir Permissões e Gerenciar Plano do Negócio (exclusivos do Dono). |
| **Gerente** | Todos, exceto Cadastrar Negócio, Convidar Colaborador, Definir Permissões e Gerenciar Plano do Negócio. |
| **Colaborador** | Autenticar-se, Alternar entre Negócios, Registrar Entrada/Saída de Estoque, Consultar Alertas de Estoque Baixo, Registrar Venda, Consultar Dashboard (restrito a vendas do dia e alertas de estoque — RF63; sem semáforo). Acesso a Calcular Preço de Venda e a Registrar Despesa Operacional apenas via permissão customizada (RF06). |
