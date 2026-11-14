# Dívidas técnicas — registro

Lista das dívidas técnicas conhecidas do HE: o que foi deixado com qualidade abaixo do ideal, por decisão ou sem querer, e que cobra "juros" (manutenção mais cara, mais risco, mais retrabalho) até ser pago. Criada em 14/11/2026. Quem encontrar uma dívida nova registra aqui, no mesmo PR em que ela aparece ou num PR de `docs/`.

## Como registrar

Cada item tem:

- **Tipo:** design (arquitetura, acoplamento), implementação (duplicação, nomes, testes faltando, complexidade), documentação, infraestrutura (CI, ambientes) ou segurança (dependências).
- **Quadrante** ([Fowler](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)): *deliberada* ou *inadvertida* × *prudente* ou *imprudente*. A dívida deliberada e prudente ("vamos lidar com as consequências") é aceitável quando registrada. A imprudente ("não temos tempo para projetar", "o que são camadas?") é a que mais cobra juros.
- **Prioridade:** **alta**, **média** ou **baixa**, pelo **risco** (segurança, perda de dados, quebra em produção) e pela **frequência de mudança** da área (código que muda muito cobra mais juros).
- **Como pagar:** o que fazer e como verificar.
- **Situação:** aberta, em andamento (com o PR) ou paga (com o PR e a data).

## Como pagar

- **Refatoração contínua:** limpar o código que se está modificando, sem misturar com correção de defeito ou funcionalidade nova no mesmo commit.
- **Testes antes:** refatorar só com testes automatizados cobrindo o comportamento. As asserções não mudam: se uma asserção precisa mudar, o comportamento mudou e não é refatoração.
- **Passos pequenos:** um passo de refatoração por commit, com a suíte rodando entre os passos.
- **Equilíbrio:** a cada Spec, avaliar se alguma dívida de prioridade alta ou média da mesma área entra junto, como etapa própria.

## Abertas

| ID | Dívida | Tipo | Quadrante | Prioridade | Como pagar |
|---|---|---|---|---|---|
| DT-01 | **Actions em Node 20.** `actions/checkout@v4`, `actions/setup-node@v4` e `actions/upload-artifact@v4` rodam forçadas no Node 24, e todo workflow mostra o aviso "Node.js 20 is deprecated". Quando o GitHub retirar o Node 20, os workflows de CI, Migrações, Backup e Administradores podem parar. | Infraestrutura | Inadvertida, prudente | Média | Atualizar cada action para a versão principal mais recente que rode no Node 24 e rodar os quatro workflows (o de Administradores com `conceder` numa conta que já é administradora). |
| DT-02 | **Vulnerabilidades moderadas na cadeia do lint** (`minimatch` via `typescript-eslint` e `eslint-config-next`): 8 moderadas, só em desenvolvimento. O `npm audit` só as corrige rebaixando o `eslint-config-next` para a 15, o que quebraria o projeto. | Segurança | Inadvertida, prudente | Baixa | A cada versão nova do `eslint-config-next` ou do `typescript-eslint`, rodar `npm audit` e atualizar. As dependências de produção ficam com 0 vulnerabilidades desde o PR #141. |
| DT-03 | **Imagem do modelo lógico desatualizada:** `docs/img/modelo_logico_bd.png` ainda é a da SPEC-013. O bloco Mermaid de [`MODELO_LOGICO_BANCO.md`](../dominio_fluxogramas/MODELO_LOGICO_BANCO.md) está atualizado até a SPEC-019 e é a referência. | Documentação | Deliberada, prudente | Baixa | Regerar a imagem a partir do bloco Mermaid (comando no próprio documento) e conferir no GitHub. |
| DT-04 | **Comissão não gravada na venda:** a rentabilidade por item mostra margem = faturamento − custo, maior que a real para quem paga comissão; o ponto de equilíbrio e a meta não consideram a comissão média. Decidido na SPEC-023 (OPEN-005 e OPEN-006). | Design | Deliberada, prudente | Média | Spec própria: gravar a comissão do momento em cada linha da venda (pendência 7 do [Mapa](../MAPA_DE_SPECS.md)). |
| DT-05 | **Nenhuma verificação local antes do commit:** lint, tipos e testes só rodam no CI, depois do push. Um erro simples custa um ciclo de CI. | Infraestrutura (prevenção) | Inadvertida, prudente | Baixa | Avaliar com a equipe um hook de *pre-commit* (por exemplo, lint e testes de unidade dos arquivos alterados). Ele traz uma dependência nova e deixa o commit mais lento, então a decisão é da equipe. |

## Pagas

| ID | Dívida | Como foi paga |
|---|---|---|
| DT-P1 | **Código morto:** o componente `SeletorDeNegocio` (`src/components/negocio/seletor-negocio.tsx`) não era usado e repetia o defeito do seletor corrigido no PR #137. | Removido no PR #139 (12/11/2026), com o "Remover Código Morto" do catálogo de refatorações. |
| DT-P2 | **Dependências de produção vulneráveis:** Next.js 16.3.8 com duas críticas (execução remota de código na otimização de imagens com SVG, que o logo usa; e em `use cache`, que o projeto não usa) e uma alta (negação de serviço em Server Actions), além de Prisma, zod e fflate. | Atualizadas no PR #141 (14/11/2026), sem trocar a versão principal. |
