# Health Enterprise (HE)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/design/identidade/logo/he-logo-horizontal-negativo.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/design/identidade/logo/he-logo-horizontal.svg">
  <img src="docs/design/identidade/logo/he-logo-horizontal.svg" alt="Health Enterprise" height="48">
</picture>

> Vitor Hashimoto, Rafael Katahira, Rafael Di Santi

*A saúde da sua empresa de maneira visual e sob controle.*

## Sobre

Projeto que busca ajudar aos diferentes níveis de empresários a manterem a saúde de sua empresa, calculando o valor necessário para que sua empresa esteja saudável e rendendo lucros, gerir a empresa e entender de maneira mais visual como está o rendimento da empresa.

O produto é um **ERP simplificado + Calculadora de Precificação**, voltado para microempreendedores (MEI) e autônomos, que integra três módulos no MVP — **Financeiro**, **Estoque** e **Calculadora de Precificação** — e um **Dashboard** com semáforo de saúde financeira e ponto de equilíbrio.

O diferencial é a precificação integrada: o produto é cadastrado uma vez e a calculadora sugere o preço de venda pelo markup completo, usando o custo real (inclusive insumos de serviços), o rateio das despesas fixas, taxas de cartão, comissão, o imposto do Simples Nacional/MEI (a partir do faturamento dos últimos 12 meses) e a margem desejada.

Projeto acadêmico desenvolvido com **Spec-Driven Development (SDD)**: requisitos em notação EARS, modelagem versionada em Markdown/Mermaid e implementação incremental, spec a spec.

## Tecnologias

* **Next.js** (App Router) + **TypeScript** — frontend e backend (Server Actions) na mesma aplicação (ADR-001)
* **Prisma** — ORM, schema-first a partir do modelo de domínio (ADR-002); isolamento por negócio aplicado por uma extensão do Prisma Client
* **PostgreSQL** (Supabase) — banco relacional, multi-tenant lógico por `negocioId` em todas as tabelas operacionais, com RLS ligado para bloquear a API pública (ADR-002) e dump diário automatizado (RNF09)
* **Supabase Auth** (definitivo) — autenticação e guarda da senha; `Usuario.id` = id do Supabase Auth, com autorização por papel validada no servidor (ADR-003)
* **TailwindCSS + shadcn/ui** — estilização e componentes
* **BrasilAPI** (dados abertos de CNPJ da Receita Federal) — enquadramento fiscal do negócio (ADR-006)
* **Vitest** — testes automatizados
* **Vercel** — hospedagem do frontend/backend e rotinas agendadas (Vercel Cron)
* **Supabase** — hospedagem do banco de dados e da autenticação
* **Stripe** (planejado — ADR-007, proposta) — cobrança real do plano pago; no MVP a troca de plano é simulada

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
| [`prisma_base/`](./docs/prisma_base) | [`parametros_fiscais_seed.json`](./docs/prisma_base/parametros_fiscais_seed.json) | Parâmetros fiscais iniciais (o schema do banco está em [`prisma/schema.prisma`](./prisma/schema.prisma)) |
| [`definicoes_arquitetura/`](./docs/definicoes_arquitetura) | `drivers-arquiteturais-he.md`, `adrs-he.md` | Drivers arquiteturais e ADRs (ADR-001 a ADR-006) |
| [`design/`](./docs/design) | [`IDENTIDADE_VISUAL.md`](./docs/design/IDENTIDADE_VISUAL.md) | Identidade visual: logo, favicon, cores (tokens claro/escuro com contraste verificado), tipografia, semáforo, componentes base e login revisado |
| [`docs/`](./docs) | [`MAPA_DE_SPECS.md`](./docs/MAPA_DE_SPECS.md), [`Prompt_SDD_Specs.pdf`](./docs/Prompt_SDD_Specs.pdf) | Mapa ordenado das Specs (com as decisões da baseline) e prompt de apoio do SDD |
| [`specs/`](./docs/specs) | `SPEC-001.md`, … | Specs individuais aprovadas para implementação, uma por arquivo |
| [`legal/`](./docs/legal) | [`politica-de-privacidade.md`](./docs/legal/politica-de-privacidade.md), [`termos-de-uso.md`](./docs/legal/termos-de-uso.md) | Rascunhos da política de privacidade e dos termos de uso (revisão do grupo pendente) |
| [`guia_issues/`](./docs/guia_issues) | [`issues_guide.md`](./docs/guia_issues/issues_guide.md) | Issues do GitHub com critérios de aceitação em EARS e testes |

As imagens renderizadas dos diagramas ficam em [`docs/img/`](./docs/img) e são geradas a partir dos blocos Mermaid; ao alterar um diagrama, gere a imagem novamente (ex.: `npx @mermaid-js/mermaid-cli -i diagrama.mmd -o docs/img/nome.png`). A versão editável do diagrama de domínio está em [`docs/dominio_fluxogramas/modelo_dominio.drawio`](./docs/dominio_fluxogramas/modelo_dominio.drawio) (abrir em [app.diagrams.net](https://app.diagrams.net)).

## Instalação

**Pré-requisitos:** [Node.js 24 LTS](https://nodejs.org) (no Windows: `winget install OpenJS.NodeJS.LTS`) e um PostgreSQL local — o jeito mais simples é o [Docker](https://www.docker.com/products/docker-desktop/) com o `docker-compose.yml` do projeto.

```bash
git clone https://github.com/VitorHashimoto21/projeto_HE_modelagem_de_sistemas.git
cd projeto_HE_modelagem_de_sistemas

# 1. Dependências (o postinstall já gera o Prisma Client em src/generated/)
npm install

# 2. Variáveis de ambiente
cp .env.example .env

# 3. PostgreSQL local com os bancos he_dev, he_shadow e he_test
docker compose up -d

# 4. Migrações (cria as tabelas, os gatilhos de isolamento e liga o RLS)
npx prisma migrate deploy
```

> O npm 11 só executa scripts de instalação de pacotes aprovados. Os do Prisma e do ESLint já estão aprovados em `allowScripts` no `package.json`; se o npm avisar de um pacote novo, revise e aprove com `npm approve-scripts <pacote>`.

## Uso

| Comando | O que faz |
|---|---|
| `npm run dev` | Aplicação em desenvolvimento em http://localhost:3000 |
| `npm run lint` | ESLint, incluindo as regras de fronteira entre camadas |
| `npm run typecheck` | Gera os tipos de rotas do Next.js e roda o TypeScript |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:integracao` | Testes de integração contra o banco de `TEST_DATABASE_URL` (só aceita PostgreSQL local com "test" no nome) |
| `npm run db:migrate` | Cria uma migração nova a partir do `prisma/schema.prisma` (desenvolvimento) |
| `npm run db:deploy` | Aplica as migrações pendentes |
| `npm run build` / `npm run start` | Build e servidor de produção |

A rota `GET /api/saude` responde `{ "aplicacao": "ok", "banco": "ok" }` — ou `"indisponivel"` com status 503 quando o banco não responde. Sem `DATABASE_URL`, a aplicação não sobe e informa a variável ausente.

### Regras do código (SPEC-001)

- **Acesso a dados só pelo cliente do negócio:** `clienteDoNegocio({ negocioId })` de `@/lib/db`. Ele filtra toda consulta pelo negócio, grava o `negocioId` nas criações (inclusive aninhadas) e recusa operações sem contexto. Páginas e componentes não podem importar o Prisma bruto (o lint bloqueia).
- **Toda tabela nova** precisa: `negocioId` se for operacional, entrada em `src/lib/db/modelos.ts`, RLS ligado na migração e, se tiver FK para outra tabela operacional, o gatilho `he_mesmo_negocio`. Os testes falham se faltar algo.
- **Datas:** gravadas em UTC; dia, mês e competência sempre por `@/lib/dominio/datas` (America/Sao_Paulo).
- **Domínio puro:** `src/lib/dominio/` não importa Next.js, React nem banco.

## Ambientes

| Ambiente | Onde roda | Banco | Atualiza quando |
|---|---|---|---|
| **Desenvolvimento** | Máquina de cada integrante (`npm run dev`) | PostgreSQL local (`docker compose`) | A cada alteração |
| **Preview** | Vercel, link temporário por Pull Request | Banco de homologação | A cada push no PR (sem migrações) |
| **Homologação** | Vercel, endereço fixo | Projeto Supabase de homologação (dados fictícios) | A cada merge na `DEVELOP` |
| **Produção** | Vercel, domínio final | Projeto Supabase de produção (dados reais) | A cada merge na `main` |

Cada ambiente tem variáveis e credenciais próprias (RNF11); chaves de serviços externos ficam em modo de teste fora de produção. As migrações rodam pelo workflow **Migrações** (`.github/workflows/migracoes.yml`): homologação a cada push na `DEVELOP`, produção a cada push na `main`.

### Configurar a homologação (uma vez)

1. **Supabase:** criar o projeto `he-homol` (plano gratuito). Em *Connect*, copiar a string do **Transaction pooler** (porta 6543) e a **Direct connection** (porta 5432).
2. **Vercel:** importar o repositório; em *Settings → Git*, definir `DEVELOP` como branch de produção do projeto de homologação (ou usar um projeto Vercel só para homologação). Em *Environment Variables*, cadastrar `DATABASE_URL` (string do Transaction pooler) para *Production* e *Preview*.
3. **GitHub:** em *Settings → Environments*, criar `homologacao` com o segredo `DIRECT_URL` (conexão direta). Em *Settings → Secrets → Actions*, criar `BACKUP_HOMOL_DATABASE_URL` (conexão direta) para o backup.
4. **Proteção de branch:** exigir o check **CI** verde antes do merge em `DEVELOP` e `main`.

### Checklist de produção (quando for publicar)

- [ ] Projeto Supabase `he-prod` (plano pago, com backup diário nativo e sem pausa por inatividade)
- [ ] Vercel com a `main` como produção e o plano Pro (uso comercial)
- [ ] Ambiente `producao` no GitHub com o segredo `DIRECT_URL`; segredo `BACKUP_PROD_DATABASE_URL`
- [ ] Domínio próprio e variáveis de *Production* na Vercel apontando só para o `he-prod`
- [ ] Revisão do RLS e dos segredos: nenhuma credencial de produção fora do ambiente de produção

## Backup

O workflow **Backup diário** (`.github/workflows/backup.yml`) roda às 03:00 (Brasília), faz `pg_dump` do schema `public` (dados da aplicação) de cada ambiente configurado e guarda o arquivo como **artefato privado** do GitHub Actions por 90 dias. Também pode ser disparado manualmente em *Actions → Backup diário → Run workflow*.

**Restaurar** (num PostgreSQL vazio, nunca direto em produção sem revisão):

```bash
# baixar o artefato em Actions → execução → Artifacts, depois:
pg_restore --no-owner --no-privileges --dbname "postgresql://postgres:postgres@localhost:5432/he_restaurado" he-homologacao-AAAAMMDDTHHMMSSZ.dump
```

> As contas de login ficam no schema `auth` do Supabase Auth e não entram nesse dump. Em produção, o backup nativo do plano pago do Supabase cobre o banco inteiro.

## Estrutura
```text
.
├── src/
│   ├── app/                      # Rotas, páginas e Server Actions (Next.js App Router)
│   ├── components/               # Componentes shadcn/ui e reutilizáveis
│   ├── lib/                      # Prisma/Supabase, cliente do negócio e regras de domínio
│   ├── hooks/                    # Custom hooks do front (a partir da SPEC-002)
│   └── generated/                # Prisma Client gerado (fora do Git)
├── prisma/                       # schema.prisma (fonte da verdade), migrations e, a partir da SPEC-003, o seed
├── test/                         # Testes unitários e de integração (Vitest)
├── .github/workflows/            # CI, migrações por ambiente e backup diário
├── docs/                         # Documentação de modelagem (fonte das specs)
│   ├── specs/
│   ├── legal/
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
