# Health Enterprise (HE)

<img src="docs/design/identidade/logo/he-logo-horizontal.svg" alt="Health Enterprise" height="48">
> Vitor Hashimoto, Rafael Katahira, Rafael Di Santi

*A saúde da sua empresa de maneira visual e sob controle.*

## Sobre

Projeto que busca ajudar aos diferentes níveis de empresários a manterem a saúde de sua empresa, calculando o valor necessário para que sua empresa esteja saudável e rendendo lucros, gerir a empresa e entender de maneira mais visual como está o rendimento da empresa.

O produto é um **ERP simplificado + Calculadora de Precificação**, voltado para microempreendedores (MEI) e autônomos, que integra três módulos no MVP — **Financeiro**, **Estoque** e **Calculadora de Precificação** — e um **Dashboard** com semáforo de saúde financeira e ponto de equilíbrio.

O diferencial é a precificação integrada: o produto é cadastrado uma vez e a calculadora sugere o preço de venda pelo markup completo, usando o custo real (inclusive insumos de serviços), o rateio das despesas fixas, taxas de cartão, comissão, o imposto do Simples Nacional/MEI (a partir do faturamento dos últimos 12 meses) e a margem desejada.

Projeto acadêmico desenvolvido com **Spec-Driven Development (SDD)**: requisitos em notação EARS, modelagem versionada em Markdown/Mermaid e implementação incremental, spec a spec.

## Tecnologias

* **Next.js** (App Router) + **TypeScript** — frontend e backend (Server Actions) na mesma aplicação (ADR-001)
* **Prisma** — ORM, schema-first a partir do modelo de domínio (ADR-002)
* **PostgreSQL** (Supabase) — banco relacional, multi-tenant lógico por `negocioId` (ADR-002), com backup diário automático e cópia semanal (RNF09)
* **Supabase Auth** (definitivo) — autenticação, com autorização por papel validada no servidor (ADR-003)
* **TailwindCSS + shadcn/ui** — estilização e componentes
* **BrasilAPI** (dados abertos de CNPJ da Receita Federal) — enquadramento fiscal do negócio (ADR-006)
* **Vercel** — hospedagem do frontend/backend e rotinas agendadas (Vercel Cron)
* **Supabase** — hospedagem do banco de dados e da autenticação

## Documentação do Projeto

Toda a especificação do produto está documentada na pasta [`docs/`](./docs):

| Pasta | Documento | Conteúdo |
|---|---|---|
| [`visao_negocio/`](./docs/visao_negocio) | [`VISAO_DE_NEGOCIO.md`](./docs/visao_negocio/VISAO_DE_NEGOCIO.md) | Problema, proposta de valor, público-alvo, validação de mercado, análise competitiva, modelo de negócio e cronograma do MVP (entrega ao final do semestre) |
| [`personas/`](./docs/personas) | `persona-camila-silva-v2.md`, `persona-gisele-mendes-v2.md`, `persona-lucas-ramos-v2.md`, `persona-thiago-rocha-v2.md` | Personas representativas do público-alvo |
| [`requisitos/`](./docs/requisitos) | [`requisitos.md`](./docs/requisitos/requisitos.md) | Requisitos Funcionais (RF), Não Funcionais (RNF) e Regras de Negócio (RN), organizados por módulo |
| [`requisitos/`](./docs/requisitos) | [`requisitos_ears.md`](./docs/requisitos/requisitos_ears.md) | Os mesmos requisitos reescritos na notação EARS |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`MODELO_DOMINIO_E_JORNADAS.md`](./docs/dominio_fluxogramas/MODELO_DOMINIO_E_JORNADAS.md) | Diagrama de domínio e jornadas de usuário tela a tela, por papel de acesso |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`DIAGRAMA_CASO_DE_USO.md`](./docs/dominio_fluxogramas/DIAGRAMA_CASO_DE_USO.md) | Diagrama de caso de uso (atores, casos de uso, `include`/`extend`) |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`FLUXOGRAMAS.md`](./docs/dominio_fluxogramas/FLUXOGRAMAS.md) | Todos os fluxogramas em texto puro (Mermaid), para leitura por ferramentas/IA sem depender de imagem |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`DIAGRAMAS_COMPORTAMENTAIS.md`](./docs/dominio_fluxogramas/DIAGRAMAS_COMPORTAMENTAIS.md) | Diagramas de sequência (calculadora, venda, cancelamento/troca) e de estados das contas |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`MODELO_LOGICO_BANCO.md`](./docs/dominio_fluxogramas/MODELO_LOGICO_BANCO.md) | Modelo lógico do banco (diagrama ER) |
| [`prisma_base/`](./docs/prisma_base) | [`schema.prisma`](./docs/prisma_base/schema.prisma), [`parametros_fiscais_seed.json`](./docs/prisma_base/parametros_fiscais_seed.json) | Schema Prisma (fonte da verdade do banco) e parâmetros fiscais iniciais |
| [`definicoes_arquitetura/`](./docs/definicoes_arquitetura) | `drivers-arquiteturais-he.md`, `adrs-he.md` | Drivers arquiteturais e ADRs (ADR-001 a ADR-006) |
| [`design/`](./docs/design) | [`IDENTIDADE_VISUAL.md`](./docs/design/IDENTIDADE_VISUAL.md) | Identidade visual: logo, favicon, cores (tokens claro/escuro com contraste verificado), tipografia, semáforo, componentes base e login revisado |
| [`docs/`](./docs) | [`MAPA_DE_SPECS.md`](./docs/MAPA_DE_SPECS.md), [`Prompt_SDD_Specs.pdf`](./docs/Prompt_SDD_Specs.pdf) | Mapa ordenado das Specs e prompt de apoio do SDD |
| [`guia_issues/`](./docs/guia_issues) | [`issues_guide.md`](./docs/guia_issues/issues_guide.md) | Issues do GitHub com critérios de aceitação em EARS e testes |

As imagens renderizadas dos diagramas ficam em [`docs/img/`](./docs/img) e são geradas a partir dos blocos Mermaid; ao alterar um diagrama, gere a imagem novamente (ex.: `npx @mermaid-js/mermaid-cli -i diagrama.mmd -o docs/img/nome.png`). A versão editável do diagrama de domínio está em [`docs/dominio_fluxogramas/modelo_dominio.drawio`](./docs/dominio_fluxogramas/modelo_dominio.drawio) (abrir em [app.diagrams.net](https://app.diagrams.net)).

## Instalação

> A aplicação ainda não foi iniciada — por enquanto o repositório contém a documentação de modelagem. Os comandos abaixo valerão após a spec de fundação (Issue #01 do guia de issues).

```bash
git clone <url-do-repositorio>
cd health-enterprise

# instalar dependências
npm install

# configurar variáveis de ambiente (banco de dados, auth)
cp .env.example .env

# rodar as migrations do Prisma
npx prisma migrate dev
```

## Uso
```bash
# ambiente de desenvolvimento
npm run dev

# build de produção
npm run build
npm run start
```

## Estrutura
```text
.
├── app/                          # (planejado) Rotas, páginas e Server Actions (Next.js App Router)
├── components/                   # (planejado) Componentes shadcn/ui e reutilizáveis
├── lib/                          # (planejado) Configurações Prisma/Supabase e regras de domínio
├── prisma/                       # (planejado) schema.prisma e migrations
├── test/                         # (planejado) Testes automatizados
├── docs/                         # Documentação de modelagem (fonte das specs)
│   ├── visao_negocio/
│   ├── personas/
│   ├── requisitos/
│   ├── dominio_fluxogramas/
│   ├── definicoes_arquitetura/
│   ├── guia_issues/
│   ├── prisma_base/
│   └── img/
└── README.md
```

## Contribuição

1. Cada spec/issue é desenvolvida em uma branch própria, criada a partir da `DEVELOP`.
2. Commits referenciam a spec ou issue correspondente.
3. Pull Requests são abertos para a `DEVELOP`; a `main` recebe apenas versões estáveis vindas da `DEVELOP`.
4. Alterações em requisitos, drivers ou ADRs exigem revisão do grupo.

## Licença

A definir pelo grupo.
