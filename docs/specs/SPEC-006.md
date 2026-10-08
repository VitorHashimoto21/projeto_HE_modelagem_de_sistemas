# SPEC-006 — Catálogo de itens e preço oficial

> **Status:** 📝 **Rascunho para aprovação (07/10/2026)** — gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar). As questões em aberto da seção 13 trazem uma **recomendação**, mas a decisão é da equipe. Nenhuma implementação antes da aprovação.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anterior:** [SPEC-005](SPEC-005.md) (papéis e permissões) · **Próximas que dependem desta:** SPEC-007 (estoque), SPEC-008 (vendas) e SPEC-010 (calculadora).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-006 |
| **Nome** | Catálogo de itens e preço oficial |
| **Objetivo** | Permitir cadastrar, consultar, editar e arquivar os itens do negócio — **Produtos Físicos** e **Serviços** (com materiais vinculados) —, com categoria, unidade de medida, custo e comissão opcional, e definir o **preço oficial manualmente**, sempre registrando o histórico de preços (quem, quando, valor anterior e novo, origem). |
| **Valor entregue** | O negócio passa a ter um catálogo único, base do estoque (SPEC-007), das vendas (SPEC-008) e da calculadora (SPEC-010). Com o preço manual (RF64), já é possível vender antes de a calculadora existir. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF07 | Dois tipos de item: Produto Físico e Serviço. |
| | RF08 | Produto Físico: nome, custo, unidade e categoria obrigatórios; estoque mínimo opcional; sem quantidade em estoque no cadastro. |
| | RF09 | Serviço: nome, custo e categoria obrigatórios; pergunta se há materiais. |
| | RF10, RF11 | Unidade de medida obrigatória; categoria obrigatória da lista fixa (as 9 do enum `CategoriaItem`). |
| | RF12, RF13 | Vários materiais por serviço, cada um um Produto Físico do negócio, com quantidade sugerida de 1 por execução, editável. |
| | RF14 | A quantidade em estoque não aparece no formulário de criação (entrada de estoque é da SPEC-007). |
| | RF41 | Histórico de preços de cada item. |
| | RF52 | Comissão opcional por item (padrão 0%). |
| | RF64 | Preço opcional no cadastro; preço oficial definido manualmente aqui (a confirmação pela Calculadora é da SPEC-010); ambos registram a origem. |
| **RN** | RN03 | Produto Físico nasce com estoque zero. |
| | RN04 | O tipo define se o item entra no estoque e se recebe materiais. |
| | RN15, RN16 | O preço usado nas vendas é sempre o último confirmado; cada confirmação gera um novo registro, preservando os anteriores. |
| | RN23 | Item sem preço oficial fica marcado como "sem preço" (a recusa na venda é da SPEC-008). |
| **RNF** | RNF05 | Histórico de preço auditável e imutável (data, usuário, valor anterior e novo, origem). |
| | RNF01, RNF02 | Telas responsivas; tudo restrito ao negócio ativo e às permissões do módulo **Catálogo** (SPEC-005). |
| **Caso de uso / fluxo** | UC5 Cadastrar Produto Físico, UC6 Cadastrar Serviço, UC6a Vincular Materiais, UC10b Consultar Histórico de Preços | Jornada do Dono, passos D1–D8 de `FLUXOGRAMAS.md` (Cadastro → tipo → formulário → materiais → salvar → preço oficial opcional). |
| **Entidades** | Item, MaterialServico, HistoricoPreco | Todas operacionais, com `negocioId` e o isolamento da SPEC-001. |
| **Drivers** | AD-RF01, AD-CEN01, AD-QA02 | Catálogo único; cenário de cadastro; registro auditável imutável de preço. |
| **ADRs** | ADR-002 | Isolamento por negócio (cliente do negócio e gatilho `he_mesmo_negocio` em MaterialServico e HistoricoPreco). |

---

## 3. Escopo

### Incluído

1. **Lista do catálogo** (`/catalogo`): itens do negócio ativo, com busca por nome e filtros por tipo e categoria; mostra unidade, custo, preço oficial (ou "sem preço") e, para serviços, a quantidade de materiais.
2. **Cadastro de Produto Físico:** nome, categoria, unidade de medida, custo, comissão (opcional), estoque mínimo (opcional) e preço de venda (opcional). Nasce com estoque zero (RN03).
3. **Cadastro de Serviço:** nome, categoria, unidade de medida (padrão "hora" ou "atendimento" — ver OPEN-002), custo, comissão (opcional), preço (opcional) e a pergunta "Este serviço usa materiais?". Se sim, a pessoa escolhe Produtos Físicos do catálogo e a quantidade por execução (sugestão 1, editável — RF13).
4. **Detalhe e edição do item:** todos os campos do cadastro, menos o tipo (OPEN-005). Para serviços, adicionar, alterar a quantidade e remover materiais.
5. **Preço oficial manual:** a partir do detalhe do item, "Definir preço" grava o novo preço e um registro no histórico (origem **Manual**, usuário, data) na mesma transação. Se o preço ficar abaixo do custo do item (custo próprio + materiais), aparece um aviso, sem bloquear.
6. **Histórico de preços** (UC10b): no detalhe do item, a lista de registros com data, valor, valor anterior, origem (Manual ou Calculadora) e quem confirmou.
7. **Arquivar e reativar** (OPEN-001): o item sai da lista principal e das escolhas (materiais, vendas), sem perder o histórico; pode ser reativado.
8. **Imutabilidade do histórico** (OPEN-007): o banco recusa alterar ou apagar registros de `HistoricoPreco`.
9. **Permissões** (SPEC-005, módulo **Catálogo**): *ver* → lista, detalhe e histórico; *criar* → novo item; *editar* → editar item e materiais e definir o preço manual (OPEN-004); *excluir* → arquivar e reativar. O item "Catálogo" entra no menu para quem tem *ver*.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Entrada, saída e quantidade em estoque; sugestão do estoque mínimo e alertas | SPEC-007 |
| Venda (inclusive a recusa de item sem preço — RN23) e baixa dos materiais | SPEC-008 |
| Preço sugerido pela Calculadora e sua confirmação (origem Calculadora) | SPEC-010 |
| Exclusão definitiva de itens | Fora do MVP (OPEN-001) — o arquivamento preserva o histórico |
| Histórico de alterações de custo | Fora do MVP — o RNF05 pede auditoria de preço e de estoque; o custo usado em cada preço fica registrado no histórico da SPEC-010 (`custoConsiderado`) |
| Fotos, código de barras, variações (tamanho/cor) | Evolução futura |

---

## 4. Dependências

- **Specs anteriores:** SPEC-001 (schema com `Item`, `MaterialServico`, `HistoricoPreco`; cliente do negócio; gatilho `he_mesmo_negocio`), SPEC-004 (negócio ativo), SPEC-005 (matriz módulo × ação, guardas `exigirPermissao` e fábrica `acaoComPermissao`, menu por permissões).
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-001 (regras fora das páginas).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Cadastrar Produto Físico (UC5)

- **Pré-condições:** membro do negócio ativo com *Catálogo: criar*.
- **Fluxo principal:**
  1. Em "Catálogo", a pessoa clica em "Novo item" e escolhe **Produto físico**.
  2. Informa nome, categoria, unidade, custo e, se quiser, comissão, estoque mínimo e preço de venda.
  3. O servidor valida (5.6) e cria o item com estoque zero; se o preço foi informado, grava também o primeiro registro do histórico (origem Manual), na mesma transação.
  4. A pessoa vai para o detalhe do item.
- **Pós-condições:** o item existe no negócio ativo, com `quantidadeEstoque = 0`; se houve preço, `precoAtual` é igual ao último registro do histórico.

### 5.2 Cadastrar Serviço (UC6, UC6a)

1. Escolhe **Serviço**; informa nome, categoria, unidade, custo e, se quiser, comissão e preço.
2. Responde "Este serviço usa materiais?". Se sim, escolhe Produtos Físicos (não arquivados) do catálogo; cada um entra com quantidade 1, editável (aceita decimais, ex.: 0,05 L).
3. O servidor valida e cria o serviço e os vínculos numa transação.

| Situação | Comportamento |
|---|---|
| Material que não é Produto Físico, de outro negócio, arquivado ou o próprio serviço | Recusado (INV-003). |
| Mesmo material duas vezes | Recusado ("este material já está no serviço"). |
| Quantidade ≤ 0 | Mensagem no campo. |
| Nenhum Produto Físico cadastrado | A pergunta explica que é preciso cadastrar os materiais como Produto Físico antes, com um atalho. |

### 5.3 Editar, arquivar e reativar

- *Catálogo: editar* altera todos os campos menos o tipo (OPEN-005) e o preço (que tem o próprio fluxo, 5.4). Mudar o custo não altera o preço oficial.
- *Catálogo: excluir* arquiva ou reativa. Arquivado: some da lista principal (aparece no filtro "Arquivados"), não pode ser escolhido como material nem (na SPEC-008) vendido; o histórico e as movimentações ficam.
- Arquivar um Produto Físico usado como material em serviços ativos mostra o aviso com os serviços afetados; o vínculo é mantido (OPEN-006).
- Nome duplicado (OPEN-003): recusado ao criar, editar ou reativar se já houver outro item não arquivado com o mesmo nome no negócio.

### 5.4 Definir o preço oficial manualmente (RF64)

1. No detalhe do item, a pessoa com *Catálogo: editar* clica em "Definir preço" e informa o novo valor.
2. O servidor valida (preço > 0, até R$ 9.999.999,99, diferente do preço atual) e, numa transação: grava um `HistoricoPreco` (origem Manual, usuário da sessão, data, preço) e atualiza `Item.precoAtual`.
3. Se o preço for menor que o custo do item (custo próprio + Σ custo do material × quantidade), a tela avisa "Este preço está abaixo do custo (R$ X)", sem bloquear.
4. Os campos de cálculo do histórico (margem, despesas, imposto) ficam vazios na origem Manual.

| Situação | Comportamento |
|---|---|
| Preço igual ao atual | "Esse já é o preço atual" — nada é gravado. |
| Preço ≤ 0 ou acima do limite | Mensagem no campo. |
| Falha ao gravar | Transação desfeita: nem o histórico nem o preço mudam (INV-005). |

### 5.5 Histórico de preços (UC10b)

No detalhe do item, quem tem *Catálogo: ver* vê os registros do mais novo para o mais antigo: data e hora (fuso de São Paulo), preço, preço anterior, variação, origem e quem confirmou. Registros nunca mudam (INV-006).

### 5.6 Validação

| Campo | Regra |
|---|---|
| Nome | Obrigatório, até 120 caracteres; único entre os itens não arquivados do negócio, sem diferenciar maiúsculas, minúsculas e espaços extras (OPEN-003). |
| Categoria | Obrigatória, uma das 9 do sistema (RF11). |
| Unidade de medida | Obrigatória, da lista do OPEN-002. |
| Custo | Obrigatório, ≥ 0, até R$ 9.999.999,99, duas casas. Aceita "12,50". |
| Comissão | Opcional, 0 a 99,99%. Vazio = 0% (RF52). |
| Estoque mínimo | Só para Produto Físico; opcional, ≥ 0, até 3 casas decimais. |
| Preço | Opcional no cadastro; quando informado, > 0, até R$ 9.999.999,99. |
| Materiais | Só para Serviço; Produtos Físicos não arquivados do mesmo negócio, sem repetição, quantidade > 0 com até 3 casas. |

A validação roda no navegador e de novo no servidor, como nas specs anteriores.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Todo Produto Físico nasce com `quantidadeEstoque = 0`, e nenhuma ação desta Spec altera esse campo (RN03, RF14). | Teste de integração; a validação ignora/recusa o campo. |
| **INV-002** | O tipo do item não muda depois de criado (OPEN-005). | Teste chamando o servidor direto com outro tipo. |
| **INV-003** | Material de serviço é sempre um Produto Físico não arquivado do mesmo negócio, diferente do próprio serviço, sem repetição. | Testes de integração (inclusive de outro negócio — gatilho `he_mesmo_negocio`). |
| **INV-004** | `Item.precoAtual` é sempre igual ao preço do registro mais recente do histórico do item (ou nulo, se não houver histórico). | Teste após cadastro com preço, preço manual e falha simulada. |
| **INV-005** | Novo preço e registro no histórico são gravados na mesma transação. | Teste com falha simulada. |
| **INV-006** | Registros de `HistoricoPreco` nunca são alterados nem apagados (RNF05) — garantido no banco (OPEN-007). | Teste de integração: `UPDATE`/`DELETE` direto no banco são recusados. |
| **INV-007** | Toda leitura e escrita do catálogo passa pelo cliente do negócio e pela permissão do módulo Catálogo correspondente. | Teste das ações sem permissão (SPEC-005, teste que percorre as ações exportadas). |
| **INV-008** | Não há dois itens não arquivados com o mesmo nome normalizado no mesmo negócio (OPEN-003). | Restrição no banco e teste de concorrência simples. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Item` | `tipo`, `nome`, `categoria`, `unidadeMedida`, `custoBase`, `precoAtual`, `comissaoPercentual`, `estoqueMinimo`, `quantidadeEstoque` (só leitura) | Operacional (negocioId). `precoAtual` só muda pelo fluxo de preço (INV-004). |
| `MaterialServico` | `servicoId`, `materialId`, `quantidade` | Único por (serviço, material); mesmo negócio (gatilho existente). |
| `HistoricoPreco` | `itemId`, `usuarioId`, `preco`, `origem`, `dataConfirmacao` | Só inserção (INV-006). Campos de cálculo vazios na origem Manual. |

**Mudanças previstas no schema (dependem das decisões da seção 13):**

- `Item.arquivadoEm DateTime?` (OPEN-001).
- `Item.nomeChave String?` — nome normalizado (minúsculas, espaços únicos) preenchido nos itens ativos e vazio nos arquivados, com `@@unique([negocioId, nomeChave])` (OPEN-003). Assim a unicidade fica no banco sem índice especial fora do Prisma.
- Migração com o gatilho que recusa `UPDATE` e `DELETE` em `HistoricoPreco` (OPEN-007).
- Unidade de medida continua `String` no banco; a lista (OPEN-002) fica na validação, para poder crescer sem migração.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/catalogo.ts` — custo total do serviço, normalização do nome, unidades de medida, leitura de valores em reais ("12,50") — puras;
  - `src/lib/catalogo/` — validação, fluxos (criar, editar, arquivar, definir preço) e Server Actions com `acaoComPermissao("catalogo", …)`;
  - `src/lib/db/catalogo.ts` — consultas pelo cliente do negócio (`clienteDoNegocio(exigirNegocio())`);
  - `src/app/(app)/catalogo/` — lista, novo item, detalhe/edição e histórico;
  - `src/lib/equipe/menu.ts` — item "Catálogo" para quem tem *Catálogo: ver*;
  - migração com `arquivadoEm`, `nomeChave` e o gatilho do histórico.
- **Fronteiras:**
  - Tudo pelo cliente do negócio (SPEC-001): nenhum acesso por id sem o filtro do negócio ativo.
  - As páginas usam `exigirPermissao("catalogo", ação)`; as ações, a fábrica `acaoComPermissao`. O teste da SPEC-005 que percorre as ações exportadas passa a cobrir as novas.
  - A SPEC-010 grava preços pela mesma função de domínio/serviço de preço desta Spec, só mudando a origem e os campos do cálculo.
- **Integrações:** nenhuma externa.
- **Identidade visual:** sem protótipo para estas telas; seguem os tokens e componentes já usados (como nas SPECs 004 e 005).

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Listar itens** | busca, tipo, categoria, arquivados (sim/não) | lista resumida | `SemPermissao` |
| **Detalhar item** | id | item, materiais (com custo), custo total, histórico | `NaoEncontrado` (inclusive de outro negócio), `SemPermissao` |
| **Criar item** | dados do item (+ materiais, + preço opcional) | id do item | `CampoInvalido`, `NomeDuplicado`, `MaterialInvalido`, `SemPermissao` |
| **Editar item** | id, dados (sem tipo e sem preço), materiais | item atualizado | `CampoInvalido`, `NomeDuplicado`, `MaterialInvalido`, `TipoImutavel`, `NaoEncontrado`, `SemPermissao` |
| **Arquivar / reativar** | id | estado novo + avisos (serviços que usam o material) | `NomeDuplicado` (ao reativar), `NaoEncontrado`, `SemPermissao` |
| **Definir preço** | id, preço, origem (Manual aqui; Calculadora na SPEC-010), dados do cálculo opcionais | registro do histórico + aviso de preço abaixo do custo | `CampoInvalido`, `PrecoIgualAoAtual`, `NaoEncontrado`, `SemPermissao` |
| **Custo total do serviço** (domínio) | custo próprio, materiais (custo × quantidade) | custo total | — |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Lista, cadastro, detalhe e histórico responsivos. | Capturas em 390, 768 e 1440 px, claro e escuro. |
| **RNF02** | Isolamento por negócio e permissões do Catálogo. | INV-003, INV-007 por testes de integração. |
| **RNF05** | Histórico de preço auditável e imutável. | INV-004, INV-005, INV-006. |
| **RNF06** | Lista do catálogo responde rápido com centenas de itens (índice por negócio já existe). | Teste de integração com 500 itens (< 2 s). |

---

## 11. Critérios de aceitação

**CA-01 — Produto Físico.** Dado um membro com *Catálogo: criar*, quando cadastra um Produto Físico com nome, categoria, unidade e custo, então o item é criado no negócio ativo com estoque zero e sem preço ("sem preço" na lista).

**CA-02 — Preço no cadastro.** Dado o mesmo cadastro com preço de venda, então o item tem esse preço oficial e o histórico tem um registro (Manual, com o usuário e a data).

**CA-03 — Serviço com materiais.** Dado um Serviço que usa dois Produtos Físicos, quando a pessoa os escolhe, então cada um entra com quantidade 1 editável, e o detalhe mostra o custo total (custo próprio + materiais).

**CA-04 — Material inválido.** Dado um material que é Serviço, de outro negócio, arquivado, repetido ou o próprio serviço, quando a pessoa tenta vinculá-lo (inclusive chamando o servidor direto), então é recusado e nada é gravado.

**CA-05 — Validação.** Dados campos obrigatórios vazios, custo negativo, comissão ≥ 100, unidade fora da lista ou nome duplicado, quando a pessoa envia, então as mensagens aparecem nos campos (`aria-invalid`/`aria-describedby`) e o servidor recusa os mesmos dados.

**CA-06 — Preço manual.** Dado um item com preço R$ 50,00, quando a pessoa com *Catálogo: editar* define R$ 55,00, então `precoAtual` passa a 55,00 e o histórico ganha um registro com 55,00, anterior 50,00, origem Manual, o usuário e a data.

**CA-07 — Preço abaixo do custo.** Dado um item com custo total R$ 30,00, quando o preço definido é R$ 25,00, então o preço é gravado e a tela mostra o aviso de preço abaixo do custo.

**CA-08 — Histórico.** Dado um item com três preços definidos, quando o detalhe é aberto por quem tem *Catálogo: ver*, então os três aparecem do mais novo ao mais antigo, com origem e responsável.

**CA-09 — Histórico imutável.** Dado um registro de histórico, quando alguém tenta alterá-lo ou apagá-lo direto no banco, então o banco recusa.

**CA-10 — Arquivar.** Dado um Produto Físico usado como material, quando é arquivado, então sai da lista principal e das escolhas de material, o aviso lista os serviços que o usam, e o histórico continua consultável; reativar o traz de volta.

**CA-11 — Tipo imutável.** Dado um Produto Físico, quando se tenta mudar o tipo para Serviço (inclusive chamando o servidor direto), então é recusado.

**CA-12 — Permissões.** Dado um Colaborador com a predefinição (Catálogo só *ver*), quando ele abre o catálogo, então vê a lista, o detalhe e o histórico, mas não vê os botões de criar, editar, definir preço e arquivar, e as ações correspondentes chamadas direto são recusadas.

**CA-13 — Isolamento.** Dado o id de um item de outro negócio, quando qualquer tela ou ação o usa, então responde como "não encontrado", sem dados.

**CA-14 — Visual.** Dadas as telas desta Spec, quando exibidas em 390, 768 e 1440 px, nos temas claro e escuro, então seguem os tokens da identidade, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação dos campos (obrigatórios, números em reais com vírgula, limites, unidade, comissão) | Unitário | CA-05 |
| T02 | Custo total do serviço e aviso de preço abaixo do custo | Unitário | CA-03, CA-07 |
| T03 | Normalização do nome (maiúsculas, acentos mantidos, espaços) | Unitário | INV-008 |
| T04 | Cadastro de Produto Físico com estoque zero, sem e com preço | Integração | CA-01, CA-02, INV-001, INV-004 |
| T05 | Serviço com materiais; quantidades; custo total | Integração | CA-03 |
| T06 | Materiais inválidos (serviço, outro negócio, arquivado, repetido, ele mesmo) | Integração | CA-04, INV-003 |
| T07 | Nome duplicado ao criar, editar e reativar | Integração | CA-05, INV-008 |
| T08 | Preço manual: histórico com anterior, origem e usuário; preço igual recusado | Integração | CA-06, INV-004 |
| T09 | Falha simulada ao gravar o preço desfaz tudo | Integração | INV-005 |
| T10 | `UPDATE`/`DELETE` em `HistoricoPreco` recusados pelo banco | Integração | CA-09, INV-006 |
| T11 | Arquivar/reativar, aviso dos serviços afetados e filtros | Integração | CA-10 |
| T12 | Tipo imutável | Integração | CA-11, INV-002 |
| T13 | Permissões: Colaborador predefinido e permissões customizadas; ações chamadas direto | Integração | CA-12, INV-007 |
| T14 | Item de outro negócio → não encontrado | Integração | CA-13 |
| T15 | Lista com 500 itens em menos de 2 s | Integração | RNF06 |
| T16 | Telas em 390/768/1440 px, claro e escuro | Manual com captura | CA-14 |
| T17 | Fluxo completo no preview da Vercel | Manual (uma vez) | CA-01 a CA-12 |

---

## 13. Questões em aberto

Cada questão traz a **recomendação** de quem gerou a Spec; a decisão é da equipe.

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Remover um item | Itens têm histórico de preço, estoque e vendas que precisam ficar (RNF05, RN27 — 5 anos). O schema não tem campo de arquivamento. | (a) **arquivar sempre** (novo `arquivadoEm`), com reativação; (b) excluir de verdade se nunca foi usado, arquivar se já foi; (c) só excluir quando nunca usado, sem arquivamento. | **(a)**: uma regra só, nada se perde e é reversível. "Excluir" na matriz da SPEC-005 passa a significar arquivar. |
| **OPEN-002** — Unidade de medida | RF10 dá exemplos (unidade, kg, litro, hora, caixa). | (a) **lista fixa**: unidade, par, dúzia, caixa, pacote, kg, g, litro, mL, metro, cm, m², hora, atendimento, sessão; (b) texto livre. | **(a)**: evita "un", "UN" e "unid." misturados e permite tratar quantidades decimais no estoque (kg, litro) na SPEC-007. A lista fica no código de validação e cresce sem migração. |
| **OPEN-003** — Nome repetido | Dois itens com o mesmo nome confundem a venda e a busca. | (a) **bloquear** nome igual entre itens não arquivados (sem diferenciar maiúsculas e espaços extras); (b) só avisar; (c) permitir. | **(a)**, com a unicidade no banco (`nomeChave`). Variações viram nomes diferentes ("Corte feminino", "Corte masculino"). |
| **OPEN-004** — Quem define o preço manual | O preço é dado do catálogo, mas também resultado da Calculadora. | (a) ***Catálogo: editar***; (b) uma ação da Calculadora (*Calculadora: criar*). | **(a)**: o preço manual existe justamente para quem ainda não usa a Calculadora (RF64). A confirmação pela Calculadora (SPEC-010) continua exigindo a permissão da Calculadora. |
| **OPEN-005** — Trocar o tipo depois | Um item cadastrado como Produto Físico pode virar Serviço? | (a) **não**: o tipo é fixo (arquiva e cadastra de novo); (b) sim, se nunca teve estoque nem venda. | **(a)**: o tipo decide estoque e materiais (RN04); trocá-lo depois cria casos difíceis (estoque com saldo, serviço que é material). |
| **OPEN-006** — Arquivar material em uso | Um Produto Físico usado como material em serviços ativos. | (a) **permitir com aviso**, mantendo o vínculo (o custo do serviço continua considerando o material); (b) bloquear até tirar o material dos serviços. | **(a)**: o produto pode sair de linha sem quebrar o serviço; o aviso lista os serviços para a pessoa decidir. |
| **OPEN-007** — Histórico imutável no banco | O RNF05 diz que o histórico de preço nunca é alterado nem apagado; hoje só a aplicação respeita isso. | (a) **gatilho no banco** que recusa `UPDATE`/`DELETE` em `HistoricoPreco` (o mesmo modelo servirá às movimentações de estoque na SPEC-007); (b) só na aplicação. | **(a)**: protege contra erro de código e contra acesso direto, no mesmo espírito do isolamento da SPEC-001. |

---

## 14. Definition of Done da Spec

A SPEC-006 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-14) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T17) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-007 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
