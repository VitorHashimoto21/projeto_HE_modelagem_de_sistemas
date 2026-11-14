# prisma_base

> **O schema do banco mudou de lugar.** A partir da SPEC-001, a fonte da verdade é
> [`prisma/schema.prisma`](../../prisma/schema.prisma) (decisão OPEN-30 do Mapa de Specs),
> e as migrações ficam em [`prisma/migrations/`](../../prisma/migrations).

Esta pasta guarda apenas:

- [`parametros_fiscais_seed.json`](parametros_fiscais_seed.json) — parâmetros fiscais oficiais (faixas do Simples, CNAE → Anexo, MEI, Fator R e margens padrão), carregados pela SPEC-003.
- [`tabela_ncm.json`](tabela_ncm.json) — tabela NCM oficial em vigor, no JSON do Classif (Portal Único Siscomex), sem edição manual: vigente em 21/10/2026, Resolução Gecex nº 926/2026, 10.516 códigos de 8 dígitos. Validada no CI (`npm run ncm:validar`) e carregada no CI e no workflow Migrações (`npm run ncm:carregar`), pela SPEC-021.

Para atualizar um parâmetro, veja a seção **Parâmetros fiscais** do [README principal](../../README.md#parâmetros-fiscais). Para atualizar a tabela NCM, troque o arquivo pelo JSON novo do Classif num PR; a carga não apaga códigos (o que sai do arquivo recebe data de fim) e não muda nenhum item (SPEC-021, 5.1).
