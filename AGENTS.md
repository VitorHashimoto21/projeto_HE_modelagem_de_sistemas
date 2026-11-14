<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Health Enterprise (HE): regras do projeto

Valem para qualquer pessoa ou agente que trabalhe neste repositório. O bloco acima é do Next.js e é reescrito pelo `next dev`; estas regras ficam fora dele.

## Idioma

Documentação, Specs, commits, PRs e textos da interface em português do Brasil.

## Fluxo: Spec-Driven Development

- A baseline é a fonte de verdade: [`docs/requisitos/`](docs/requisitos), [`docs/definicoes_arquitetura/`](docs/definicoes_arquitetura), o modelo de domínio e o [Mapa de Specs](docs/MAPA_DE_SPECS.md). Antes de implementar, existe uma Spec aprovada em `docs/specs/SPEC-XXX.md`, no formato do [prompt SDD](docs/Prompt_SDD_Specs.pdf).
- Uma Spec por pedido. Escrever a Spec e implementá-la nunca acontecem no mesmo pedido.
- Uma decisão que a baseline não define vira `OPEN-XX` e é decidida pela equipe. Não inventar requisitos, entidades, tecnologias ou decisões de arquitetura.
- **Regra fundamental:** conflito entre código, Spec e baseline nunca é resolvido em silêncio. Registrar a divergência e propor (1) corrigir a implementação ou (2) mudar a baseline, com aprovação da equipe.

## Branches, PRs e merge

- Branches `feat/`, `fix/` e `docs/` saem da `DEVELOP` e voltam por PR para a `DEVELOP`. Versões estáveis vão para a `main` por um branch `release/…`.
- Usar merge. Nunca rebase, amend ou force-push em branch compartilhado.
- **O merge é sempre de uma pessoa da equipe.** Quem abre o PR responde pelo código, mesmo sem tê-lo digitado.
- O CI "Lint, tipos, schema, testes e build" precisa passar.
- A descrição segue o [modelo de PR](.github/pull_request_template.md), com a rastreabilidade de cada CA e INV até o teste.
- PRs pequenos (referência: até cerca de 400 linhas de código por revisão). Tarefa grande vira etapas, cada uma com o seu PR.

## Testes e verificação

- Testes de unidade e de integração (Vitest), build de produção e roteiro no navegador quando muda tela.
- Correção de defeito: reproduzir antes (um teste que falha) e mostrar passando depois.
- Nunca pular, desativar ou alterar um teste só para passar. Teste verde não prova correção: revisar contra a Spec.

## Segurança e dados pessoais

- Nenhuma chave, senha ou segredo no repositório, em logs ou em mensagens.
- Capturas e evidências sem dados pessoais reais: e-mails, nomes, CNPJ, telefone, QR code e códigos do 2º fator.
- Logs públicos (GitHub Actions) sem nenhuma parte de e-mail.
- Dependência nova só com justificativa. `npm audit --omit=dev` sem vulnerabilidade alta ou crítica.

## Dívida técnica e refatoração

- Toda dívida conhecida fica no [registro de dívidas técnicas](docs/qualidade/DIVIDAS_TECNICAS.md), com o quadrante e a prioridade.
- Refatorar não muda o comportamento: só com testes cobrindo antes, em passos pequenos, separado de correções e de funcionalidades novas.
