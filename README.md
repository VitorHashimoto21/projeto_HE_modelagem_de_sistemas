# HealthEnterprise (HE)

> A saúde da sua empresa de maneira visual e sob controle.

## Sobre

ERP web simplificado para microempreendedores (MEI) e autônomos, que integra três módulos — **Estoque**, **Calculadora de Precificação** e **Financeiro** — e um **Dashboard** com semáforo de saúde financeira e ponto de equilíbrio.

O diferencial é a precificação integrada: o produto é cadastrado uma vez e a calculadora sugere o preço de venda pelo markup completo, usando o custo real (inclusive insumos de serviços), o rateio das despesas fixas, taxas de cartão, comissão, o imposto do Simples Nacional/MEI (a partir do faturamento dos últimos 12 meses) e a margem desejada.

Projeto acadêmico desenvolvido com **Spec-Driven Development (SDD)**: requisitos em notação EARS, modelagem versionada em Markdown/Mermaid e implementação incremental, spec a spec.

## Tecnologias (definidas nos ADRs)

* **Next.js (App Router) + TypeScript** — interface e Server Actions no mesmo projeto (ADR-001)
* **PostgreSQL + Prisma ORM** — multi-tenant lógico por `negocioId` (ADR-002)
* **Supabase Auth** — autenticação, com autorização por papel validada no servidor (ADR-003)
* **TailwindCSS + shadcn/ui** — interface responsiva
* **Consulta pública de CNPJ** (dados abertos da Receita Federal) — enquadramento fiscal do negócio (ADR-006)

## Documentação

| Assunto | Arquivo |
|---|---|
| Visão de negócio | [`docs/visao_negocio/VISAO_DE_NEGOCIO.md`](docs/visao_negocio/VISAO_DE_NEGOCIO.md) |
| Requisitos (RF, RN, RNF) | [`docs/requisitos/requisitos.md`](docs/requisitos/requisitos.md) |
| Requisitos em EARS | [`docs/requisitos/requisitos_ears.md`](docs/requisitos/requisitos_ears.md) |
| Personas | [`docs/personas/`](docs/personas/) |
| Domínio, jornadas e casos de uso | [`docs/dominio_fluxogramas/`](docs/dominio_fluxogramas/) |
| Diagramas de sequência e de estados | [`docs/dominio_fluxogramas/DIAGRAMAS_COMPORTAMENTAIS.md`](docs/dominio_fluxogramas/DIAGRAMAS_COMPORTAMENTAIS.md) |
| Modelo lógico do banco | [`docs/dominio_fluxogramas/MODELO_LOGICO_BANCO.md`](docs/dominio_fluxogramas/MODELO_LOGICO_BANCO.md) |
| Schema Prisma (fonte da verdade do banco) | [`docs/prisma_base/schema.prisma`](docs/prisma_base/schema.prisma) |
| Drivers arquiteturais e ADRs | [`docs/definicoes_arquitetura/`](docs/definicoes_arquitetura/) |
| Guia de issues | [`docs/guia_issues/issues_guide.md`](docs/guia_issues/issues_guide.md) |

As imagens em `docs/img/` são geradas a partir dos blocos Mermaid; ao alterar um diagrama, gere a imagem novamente (ex.: `npx @mermaid-js/mermaid-cli -i diagrama.mmd -o docs/img/nome.png`).

## Estrutura

```text
.
├── docs/                  # Documentação de modelagem (fonte das specs)
│   ├── visao_negocio/
│   ├── requisitos/
│   ├── personas/
│   ├── dominio_fluxogramas/
│   ├── definicoes_arquitetura/
│   ├── guia_issues/
│   ├── prisma_base/
│   └── img/
└── README.md
```

A estrutura da aplicação (`src/`, `prisma/`, `.github/workflows/`) será criada na spec de fundação, conforme a Issue #01 do guia de issues.

## Instalação e uso

A aplicação ainda não foi iniciada — o repositório contém, por enquanto, a documentação de modelagem. Os comandos de instalação e execução serão adicionados junto com o setup do Next.js.

## Fluxo de contribuição

1. Cada spec/issue é desenvolvida em uma branch própria, criada a partir da `DEVELOP`.
2. Commits referenciam a spec ou issue correspondente.
3. Pull Requests são abertos para a `DEVELOP`; a `main` recebe apenas versões estáveis.
4. Alterações em requisitos, drivers ou ADRs exigem revisão do grupo.

## Licença

A definir pelo grupo.
