# Health Enterprise
> Vitor Hashimoto, Rafael Katahira, Rafael Di Santi

## Sobre

Projeto que busca ajudar aos diferentes níveis de empresários a manterem a saúde de sua empresa, calculando o valor necessário para que sua empresa esteja saudável e rendendo lucros, gerir a empresa e entender de maneira mais visual como está o rendimento da empresa.

O produto é um **ERP simplificado + Calculadora de Precificação**, voltado para microempreendedores e autônomos, que integra três módulos no MVP — **Financeiro**, **Estoque** e **Calculadora de Precificação** — de forma que o custo cadastrado no Estoque alimenta automaticamente o cálculo de preço de venda, incluindo impostos de MEI e Simples Nacional.

## Tecnologias

* **Next.js** (App Router) + **TypeScript** — frontend e backend na mesma aplicação
* **Prisma** — ORM, schema-first a partir do modelo de domínio
* **PostgreSQL** (via Supabase ou Neon) — banco de dados relacional
* **Supabase Auth** (ou Auth.js) — autenticação e multiempresa
* **TailwindCSS + shadcn/ui** — estilização e componentes
* **Vercel** — hospedagem do frontend/backend
* **Supabase / Neon** — hospedagem do banco de dados

## Documentação do Projeto

Toda a especificação do produto está documentada na pasta [`docs/`](./docs), organizada em quatro áreas:

| Pasta | Documento | Conteúdo |
|---|---|---|
| [`visao_negocio/`](./docs/visao_negocio) | [`VISAO_DE_NEGOCIO.md`](./docs/visao_negocio/VISAO_DE_NEGOCIO.md) | Problema, proposta de valor, público-alvo, validação de mercado, análise competitiva, modelo de negócio e cronograma do MVP (6 meses) |
| [`personas/`](./docs/personas) | `persona-camila-silva-v2.md`, `persona-gisele-mendes-v2.md`, `persona-lucas-ramos-v2.md`, `persona-thiago-rocha-v2.md` | Personas representativas do público-alvo (microempreendedores e autônomos) |
| [`requisitos/`](./docs/requisitos) | [`requisitos.md`](./docs/requisitos/requisitos.md) | Requisitos Funcionais (RF), Não Funcionais (RNF) e Regras de Negócio (RN), organizados por módulo |
| [`requisitos/`](./docs/requisitos) | [`requisitos_ears.md`](./docs/requisitos/requisitos_ears.md) | Os mesmos requisitos reescritos na notação EARS (Easy Approach to Requirements Syntax) |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`MODELO_DOMINIO_E_JORNADAS.md`](./docs/dominio_fluxogramas/MODELO_DOMINIO_E_JORNADAS.md) | Diagrama de domínio (classes, atributos, relacionamentos) e jornadas de usuário tela a tela, por papel de acesso |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`DIAGRAMA_CASO_DE_USO.md`](./docs/dominio_fluxogramas/DIAGRAMA_CASO_DE_USO.md) | Diagrama de caso de uso (atores, casos de uso, relações `include`/`extend`) |
| [`dominio_fluxogramas/`](./docs/dominio_fluxogramas) | [`FLUXOGRAMAS.md`](./docs/dominio_fluxogramas/FLUXOGRAMAS.md) | Todos os fluxogramas do projeto em texto puro (Mermaid), reunidos em um único arquivo para leitura por ferramentas/IA sem depender de imagem |

As imagens renderizadas de cada diagrama (domínio, jornadas e caso de uso) ficam em [`docs/dominio_fluxogramas/img/`](./docs/dominio_fluxogramas/img), e a versão editável do diagrama de domínio em [`docs/dominio_fluxogramas/modelo_dominio.drawio`](./docs/dominio_fluxogramas/modelo_dominio.drawio) (abrir em [app.diagrams.net](https://app.diagrams.net)).

## Instalação
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
├── app/                          # Rotas, páginas e API routes (Next.js App Router)
├── prisma/
│   └── schema.prisma             # Modelo de domínio traduzido em schema do banco
├── components/
├── lib/
├── src/
├── test/
├── docs/
│   ├── visao_negocio/
│   │   ├── VISAO_DE_NEGOCIO.md
│   │   └── visao_draft.md
│   ├── personas/
│   │   ├── persona-camila-silva-v2.md
│   │   ├── persona-gisele-mendes-v2.md
│   │   ├── persona-lucas-ramos-v2.md
│   │   └── persona-thiago-rocha-v2.md
│   ├── requisitos/
│   │   ├── requisitos.md
│   │   └── requisitos_ears.md
│   └── dominio_fluxogramas/
│       ├── DIAGRAMA_CASO_DE_USO.md
│       ├── FLUXOGRAMAS.md
│       ├── MODELO_DOMINIO_E_JORNADAS.md
│       ├── modelo_dominio.drawio
│       └── img/
│           ├── diagrama_caso_uso.png
│           ├── diagrama_dominio.png
│           ├── jornada_colaborador.png
│           ├── jornada_dono.png
│           └── jornada_gerente.png
├── README.md
└── ...
```

## Contribuição
Contribuições são bem-vindas. Para contribuir:
1. Faça um fork do projeto.
2. Crie uma branch para sua alteração.
3. Faça suas alterações e commits.
4. Abra um Pull Request.

## Licença
Este projeto está sob a licença `<LICENÇA>`.
