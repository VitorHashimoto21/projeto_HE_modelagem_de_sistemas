## Resumo

<!-- O que muda e por quê, em poucas linhas. Uma mudança por PR: o que não pertence a ela vira outro PR. -->

## Spec e rastreabilidade

<!-- Spec (ex.: SPEC-027) ou o problema corrigido. Para cada critério de aceitação ou invariante, onde está no código e qual teste o verifica. -->

| CA / INV | Onde está no código | Teste que verifica |
|---|---|---|
|  |  |  |

## Como foi verificado

- [ ] Lint e tipos (`npx eslint .`, `npx next typegen && npx tsc --noEmit`)
- [ ] Testes de unidade e de integração
- [ ] Build de produção
- [ ] Roteiro no navegador, quando muda tela (capturas sem dados pessoais)
- [ ] Correção de defeito: o defeito foi reproduzido antes (teste falhando) e passa depois

## Checklist de revisão

Quem abre o PR responde pelo código, mesmo sem tê-lo digitado. Teste verde não prova correção.

- [ ] O diff foi lido inteiro, com a Spec aberta
- [ ] Nada fora do escopo
- [ ] Nenhuma dependência nova sem justificativa, e o pacote existe
- [ ] Os testes verificam o requisito, e não repetem a implementação; nenhum teste foi alterado só para passar
- [ ] Nenhuma lógica que já existe no projeto foi duplicada
- [ ] Nenhum segredo ou dado pessoal em código, testes, logs ou capturas
- [ ] Divergência com a Spec ou com a baseline registrada (corrigir a implementação ou propor a mudança à equipe)
- [ ] Dívida técnica nova registrada em [`docs/qualidade/DIVIDAS_TECNICAS.md`](../docs/qualidade/DIVIDAS_TECNICAS.md)

## Depois do merge

<!-- O que a equipe precisa conferir ou fazer na homologação, se houver. -->
