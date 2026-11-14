# SPEC-020 — Subcategorias do negócio e nova categoria Acessórios

> **Status:** ✅ **Concluída em 20/10/2026** — implementada (PR #97), homologada (T12) e com as duas correções da homologação conferidas (PR #98). **Aprovada em 19/10/2026.** As questões em aberto foram decididas pela equipe em entrevista (seção 13), todas pela opção recomendada, com dois complementos:
> - "Acessórios" entra logo depois de Vestuário, e não no fim da lista;
> - a tela de Subcategorias também tem o botão "Nova subcategoria" e permite cadastrar itens direto numa subcategoria.
>
> A baseline foi ajustada: RF11 alterado, RF79 e RN33 novos. **Implementada em 19/10/2026** e verificada em build local: testes T01–T10 automatizados e o roteiro T11 no navegador, com 70 verificações ([evidências](evidencias/SPEC-020/README.md)). **Homologação (T12) em 20/10/2026:** o fluxo foi aprovado, com dois problemas de tela — o texto cortado nos filtros e o "voltar" do detalhe, que levava ao início do Catálogo. Os dois foram corrigidos no PR #98 e conferidos pela equipe na homologação no mesmo dia. As notas da implementação e da homologação estão depois da seção 9. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir da revisão de uma profissional da área financeira e contábil que está montando uma loja de semijoias (19/10/2026).
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-006](SPEC-006.md) (cadastro e lista do catálogo), [SPEC-007](SPEC-007.md) (lista do estoque), [SPEC-003](SPEC-003.md) (arquivo fiscal: margem da categoria nova) e [SPEC-014](SPEC-014.md) (exportação).
> - **Usa:** [SPEC-001](SPEC-001.md) (isolamento), [SPEC-005](SPEC-005.md) (permissões), [SPEC-010](SPEC-010.md) (margem sugerida), [SPEC-016](SPEC-016.md) (componentes) e [SPEC-018](SPEC-018.md) (modo suporte).
> - **Usada por:** [SPEC-021](SPEC-021.md) (aprovada em 21/10/2026): o cadastro sugere o NCM já usado por outros itens da mesma subcategoria, sempre confirmado pelo dono — a subcategoria continua sem efeito fiscal (RN33).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-020 |
| **Nome** | Subcategorias do negócio e nova categoria Acessórios |
| **Objetivo** | Permitir que cada negócio crie **subcategorias livres** dentro das categorias fixas, para organizar o catálogo e o estoque **sem mexer na margem padrão** da categoria. Acrescentar a categoria fixa **Acessórios**, com a sua margem padrão no arquivo de parâmetros fiscais. |
| **Valor entregue** | A loja de semijoias separa Brincos, Colares e Anéis; o salão separa Cabelo, Unhas e Estética. Cada negócio encontra os itens pela própria organização, e a margem sugerida continua vindo da categoria, com base legal. Semijoias, bijuterias e bolsas deixam de ficar em "Vestuário" ou "Outros". |

### Exemplo que originou a Spec

Uma loja de semijoias quer separar os produtos em Brincos, Colares e Anéis.
- **Hoje:** a lista fixa não tem uma categoria adequada, e a loja precisa usar "Vestuário" ou "Outros". Também não há como separar os tipos de peça; o único jeito é pôr o tipo no nome do item.
- **Com esta Spec:** os produtos ficam em **Acessórios**, com margem sugerida de 8% (comércio). A loja cria as subcategorias **Brincos**, **Colares** e **Anéis** e filtra o Catálogo e o Estoque por elas. A margem sugerida na Calculadora continua sendo a de Acessórios para todas as peças.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF11** | **Alterado:** a lista fixa ganha **Acessórios**, logo depois de Vestuário. |
| | **RF79** (novo) | Subcategorias livres do negócio dentro de cada categoria fixa. São opcionais no item, ficam no cadastro e numa tela própria e entram nos filtros e na busca do Catálogo e do Estoque. |
| | RF36 | Mantido: a margem sugerida continua por **categoria**. Acessórios = 8% (comércio, Lei 9.249/1995, art. 15). |
| | RF08, RF09 | O cadastro de produto e de serviço ganha o campo opcional "Subcategoria". |
| **RN** | **RN33** (nova) | A subcategoria só organiza: não altera margem, preço, custo, estoque nem regras fiscais. |
| | RN17 | Mantida: a margem de Acessórios entra no arquivo de parâmetros fiscais, com fonte legal e vigência, e não no código. |
| **RNF** | RNF01 | Campo, tela, filtros e diálogos em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | Subcategorias isoladas por negócio (`negocioId`, RLS). |
| | RNF04 | Subcategorias incluídas na exportação de dados. |
| **Caso de uso / fluxo** | Cadastro de item (SPEC-006); listas do Catálogo e do Estoque; Calculadora (SPEC-010, só leitura da margem) | Ver seção 5. |
| **Entidades** | `Subcategoria` (nova), `Item` (campo novo), `MargemPadraoCategoria` (registro novo), enum `CategoriaItem` (valor novo) | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor), ADR-004 (parâmetros fiscais versionados) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Categoria fixa "Acessórios"** (OPEN-001):
   - entra na lista **logo depois de Vestuário**, em todos os lugares onde as categorias aparecem;
   - tem margem padrão de **8%** (comércio) no arquivo fiscal, com a mesma fonte legal e a mesma vigência das outras categorias de comércio.
2. **Subcategorias do negócio** (OPEN-002):
   - cada uma pertence a **uma** categoria fixa;
   - o nome tem até 40 caracteres e não se repete dentro da mesma categoria do negócio;
   - são **opcionais** no item e valem para produtos e serviços, nos dois planos.
3. **No cadastro e na edição do item** (OPEN-003):
   - campo "Subcategoria (opcional)" com as subcategorias da categoria escolhida;
   - botão **"+ Nova subcategoria"**, que cria na hora sem perder o que já foi digitado;
   - trocar a categoria do item limpa a subcategoria.
4. **Tela "Subcategorias"**, dentro do Catálogo (OPEN-003). Ela permite:
   - listar as subcategorias por categoria, com o número de itens;
   - **"Nova subcategoria"** (categoria + nome);
   - **"Novo item"**, que abre o cadastro com a categoria e a subcategoria preenchidas;
   - **"Ver itens"**, que abre o Catálogo filtrado;
   - **renomear** e **excluir**. Ao excluir, uma confirmação mostra quantos itens usam a subcategoria, e esses itens ficam "sem subcategoria" (OPEN-004).
5. **Catálogo e Estoque** (OPEN-006):
   - a subcategoria aparece na linha e no detalhe do item;
   - novo filtro de subcategoria, com "Todas", cada subcategoria e "Sem subcategoria", que aparece quando há uma categoria escolhida;
   - a busca por texto também encontra pela subcategoria.
6. **Permissões** (OPEN-005), conferidas no servidor:
   - criar exige *Catálogo: criar* ou *Catálogo: editar*;
   - renomear exige *Catálogo: editar*;
   - excluir exige *Catálogo: excluir*;
   - a tela abre com *Catálogo: ver*.
7. **Modo suporte (SPEC-018):** a tela e os campos aparecem só para leitura quando o Catálogo está liberado. Toda escrita é recusada.
8. **Exportação (SPEC-014):** o arquivo exportado inclui as subcategorias (JSON e CSV).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Margem própria por subcategoria, ou margem padrão editada pelo negócio | Fora: a margem sugerida continua por categoria (RF36, RN33). Na Calculadora, a margem continua editável item a item. |
| Subcategoria na **Nova venda** (busca ou filtro) e nos **Relatórios** (rentabilidade por categoria ou subcategoria) | Evolução futura (OPEN-006) |
| Outras categorias fixas novas (Artesanato, Educação, Pet…) | Fora (OPEN-001): as subcategorias cobrem esses casos |
| Mover uma subcategoria para outra categoria | Fora: basta criar a subcategoria na outra categoria e trocar a categoria dos itens |
| Subcategoria obrigatória, ou subcategorias de subcategorias | Fora: um nível só, sempre opcional |
| Arquivar subcategoria | Fora (OPEN-004): a subcategoria é excluída e os itens ficam sem ela |
| Categorias de lançamento financeiro (RF32) | Fora: esta Spec trata só das categorias de produtos e serviços (RF11) |

---

## 4. Dependências

- **Specs:**
  - SPEC-006: cadastro, edição, lista e detalhe do item; regra de nome único (OPEN-003 dela); arquivamento;
  - SPEC-007: lista e detalhe do estoque, com o filtro de categoria;
  - SPEC-003: arquivo fiscal e carga (`fiscal:validar`, `fiscal:carregar`);
  - SPEC-010: margem sugerida por categoria;
  - SPEC-005: matriz módulo × ação;
  - SPEC-001: isolamento, `modelos.ts` e RLS;
  - SPEC-014: exportação;
  - SPEC-016: diálogo, campos e estados vazios;
  - SPEC-018: contexto de suporte só leitura.
- **Decisões arquiteturais:**
  - ADR-002: todo dado operacional tem `negocioId` e RLS;
  - ADR-003: autorização no servidor;
  - ADR-004: parâmetros fiscais em arquivo versionado, carregados no workflow Migrações.
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Categoria Acessórios

1. A lista fixa passa a ser: Serviços, Produtos, Alimentação, Vestuário, **Acessórios**, Beleza, Saúde, Casa, Tecnologia, Outros. Essa ordem vale no cadastro, nos filtros e em qualquer outra lista de categorias.
2. O arquivo `docs/prisma_base/parametros_fiscais_seed.json` ganha o registro de margem de `ACESSORIOS`:
   - margem de 8%;
   - fonte "Lei 9.249/1995, art. 15 (percentual de presunção: 8% comércio e indústria)";
   - vigência a partir de 2018-01-01, igual às demais.

   O `fiscal:validar` continua exigindo uma margem para toda categoria. Na homologação e na produção, a carga roda no workflow Migrações, depois da migração que cria o valor novo.
3. Na Calculadora, um item de Acessórios recebe a sugestão de 8%, com a fonte legal, como as demais categorias (SPEC-010).
4. Itens já cadastrados **não mudam de categoria sozinhos**: quem quiser usa a edição do item.

### 5.2 Subcategoria no cadastro e na edição do item

1. O formulário tem, abaixo de "Categoria", o campo **"Subcategoria (opcional)"**. Ele fica desabilitado até a categoria ser escolhida e lista só as subcategorias daquela categoria, mais a opção "Sem subcategoria".
2. Ao trocar a categoria, a subcategoria volta para "Sem subcategoria".
3. O botão **"+ Nova subcategoria"**, ao lado do campo, abre um diálogo pedindo só o nome, porque a categoria é a do formulário. Ao confirmar:
   - a subcategoria é criada;
   - ela já fica escolhida no campo;
   - o resto do formulário continua como estava.

   Se o nome já existir na categoria, o diálogo mostra o erro (5.5).
4. Ao salvar o item, o servidor confere a subcategoria (5.5). Item sem subcategoria continua válido.
5. Ao abrir o cadastro a partir de "Novo item" na tela Subcategorias, a categoria e a subcategoria já vêm preenchidas, e a pessoa ainda pode trocá-las.

### 5.3 Tela Subcategorias

1. Acesso pelo Catálogo, com o link "Subcategorias" no cabeçalho da lista. Exige *Catálogo: ver*.
2. As subcategorias aparecem agrupadas por categoria, na ordem da lista fixa, e em ordem alfabética dentro de cada categoria. Cada uma mostra:
   - o nome;
   - o número de itens ativos;
   - as ações **"Ver itens"**, **"Novo item"** (só com *Catálogo: criar*), **"Renomear"** (só com *Catálogo: editar*) e **"Excluir"** (só com *Catálogo: excluir*).
3. O botão **"Nova subcategoria"** abre um diálogo com a categoria e o nome. Ele aparece com *Catálogo: criar* ou *Catálogo: editar*.
4. **Renomear:** abre um diálogo com o nome atual. O novo nome passa a aparecer em todos os itens que usam a subcategoria.
5. **Excluir:** um diálogo de confirmação mostra quantos itens usam a subcategoria, contando ativos e arquivados ("3 itens ficarão sem subcategoria. Preços, estoque e vendas não mudam."). Ao confirmar, a subcategoria é excluída, e os itens ficam sem subcategoria na mesma operação.
6. **Estado vazio:** a tela explica para que servem as subcategorias (ex.: "Brincos, Colares e Anéis em Acessórios") e mostra o botão "Nova subcategoria".

### 5.4 Catálogo e Estoque: exibição, filtros e busca

1. **Linha do item:** mostra a categoria e, quando houver, a subcategoria (ex.: "Produto físico, acessórios › brincos, unidade"). No Estoque, o mesmo formato vale para a categoria.
2. **Detalhe do item:**
   - no Catálogo, linha "Subcategoria", ou "—" quando não houver;
   - no Estoque, a subcategoria aparece no subtítulo, depois da categoria (ex.: "Acessórios › Brincos"), porque essa tela não tem lista de dados (decisão da equipe em 20/10/2026, seção 9).
3. **Filtro:** com uma categoria escolhida que tenha subcategorias, aparece o filtro "Subcategoria", com "Todas as subcategorias", as subcategorias daquela categoria e "Sem subcategoria". O filtro não aparece quando a categoria não tem subcategorias, porque não haveria o que escolher. Ao trocar a categoria, o filtro volta para "Todas". O filtro entra na URL, como os demais, e no "Limpar filtros".
   - No Catálogo, a lista traz todas as subcategorias da categoria.
   - No Estoque, a lista traz só as que têm pelo menos um produto físico ativo. Uma subcategoria vazia ou só com serviços sempre daria "Nenhum produto encontrado". Ela passa a aparecer no Estoque quando recebe o primeiro produto.
   - As regras de quando o filtro aparece e do Estoque são decisões da equipe de 20/10/2026 (seção 9).
   - Busca, categoria e subcategoria ficam numa linha própria, abaixo dos segmentos de tipo, com espaço para o texto inteiro ("Todas as subcategorias") — correção da homologação T12 (seção 9).
4. **Voltar para a lista de origem:** o item aberto a partir de uma lista filtrada (por exemplo, Acessórios › Brincos) volta para ela, com os filtros, e não para o início do Catálogo. O mesmo vale depois de editar, arquivar ou reativar o item, no cadastro aberto pela lista ou pela tela Subcategorias, no Estoque e entre o Estoque e o Catálogo — correção da homologação T12 (seção 9).
5. **Busca por texto:** encontra itens cujo nome **ou** cuja subcategoria contém o texto, sem diferenciar maiúsculas e minúsculas. Por exemplo, "brinc" encontra os itens da subcategoria Brincos.
6. **Arquivados** (SPEC-006): mantêm a subcategoria e aparecem com ela no filtro de arquivados.

### 5.5 Validação e gravação no servidor

| Regra | Comportamento |
|---|---|
| Nome da subcategoria | Obrigatório, com 1 a 40 caracteres depois de tirar os espaços das pontas e juntar os espaços repetidos. Fora disso → `CampoInvalido`. |
| Nome repetido | O nome é único por negócio e categoria, comparado como o nome do item (SPEC-006: sem diferenciar maiúsculas e minúsculas nem espaços extras). Repetido → `NomeRepetido` ("Já existe 'Brincos' em Acessórios"). O mesmo nome em outra categoria é permitido. A regra também é garantida por restrição única no banco, que cobre duas criações simultâneas. |
| Categoria da subcategoria | Precisa ser uma das categorias fixas, senão `CampoInvalido`. Não muda depois de criada. |
| Subcategoria do item | Se informada, precisa ser do **mesmo negócio** e da **mesma categoria** do item, senão `SubcategoriaInvalida` ("Escolha uma subcategoria de Acessórios"). Vazia → item sem subcategoria. |
| Permissões | Criar: *Catálogo: criar* ou *editar*. Renomear: *editar*. Excluir: *excluir*. Sem a permissão → `SemPermissao`. No modo suporte, toda escrita é recusada. |
| Excluir | Na mesma transação, os itens do negócio que usam a subcategoria ficam sem ela, e a subcategoria é apagada. Nenhum outro campo do item muda. |
| Subcategoria inexistente ou de outro negócio | `NaoEncontrada`; o isolamento (RLS e cliente do negócio) não deixa vê-la. |

### 5.6 Modo suporte, exportação e planos

- **Modo suporte (SPEC-018):** com o Catálogo liberado, o suporte vê a tela Subcategorias e os campos, sem os botões de criar, renomear, excluir e "Novo item". A tela entra no registro de telas abertas como as demais do Catálogo. Subcategorias não são dados pessoais, então não são mascaradas.
- **Exportação (SPEC-014):** o arquivo ganha `subcategorias` (id, categoria, nome, criação) e, nos itens, a referência à subcategoria.
- **Exclusão de conta (SPEC-014):** nada a anonimizar. As subcategorias seguem o negócio encerrado, como os itens.
- **Planos (SPEC-013):** disponível nos dois planos. Organizar o catálogo não é uma das funcionalidades limitadas no plano gratuito (SPEC-013, RN18).

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | A subcategoria não altera a margem sugerida: dois itens da mesma categoria, com e sem subcategoria, recebem a mesma sugestão na Calculadora (RN33). | Teste de integração da Calculadora. |
| **INV-002** | A subcategoria de um item é sempre do mesmo negócio e da mesma categoria do item. | Teste chamando a ação direto com subcategoria de outra categoria e de outro negócio. Restrição no banco, se a implementação permitir (seção 7). |
| **INV-003** | Não existem duas subcategorias com o mesmo nome normalizado na mesma categoria de um negócio. | Teste de integração, inclusive com duas criações simultâneas. Restrição única no banco. |
| **INV-004** | Excluir uma subcategoria deixa os itens que a usavam sem subcategoria. Nada mais muda: preço, custo, estoque, histórico de preços e vendas ficam iguais. | Teste de integração antes e depois. |
| **INV-005** | Criar, renomear e excluir só com a permissão da seção 5.5. O modo suporte nunca escreve. | Teste chamando as ações direto com cada papel e no contexto de suporte. |
| **INV-006** | `Subcategoria` é dado operacional: tem `negocioId`, RLS ligado e classificação em `modelos.ts`, e um negócio nunca vê nem usa a subcategoria de outro. | `test/unit/modelos.test.ts` (INV-006 da SPEC-001) e teste de isolamento. |
| **INV-007** | Toda categoria fixa, inclusive Acessórios, tem margem padrão vigente no arquivo fiscal, e as listas mostram Acessórios logo depois de Vestuário. | `fiscal:validar` no CI e teste unitário da lista. |
| **INV-008** | A migração não muda nenhum item existente: mesma categoria e sem subcategoria. | Teste de integração e conferência na homologação. |

---

## 7. Modelo de domínio envolvido

| Entidade | Mudança |
|---|---|
| enum `CategoriaItem` | Novo valor `ACESSORIOS`, criado **depois de `VESTUARIO`** (`ALTER TYPE … ADD VALUE 'ACESSORIOS' AFTER 'VESTUARIO'`). |
| `Subcategoria` (nova) | `id`, `negocioId`, `categoria CategoriaItem`, `nome` (até 40), `nomeChave` (nome normalizado), `criadaEm`. Restrição única `(negocioId, categoria, nomeChave)`; índice por `negocioId`; RLS. |
| `Item` | Novo campo opcional `subcategoriaId` → `Subcategoria`. A exclusão da subcategoria deixa o campo nulo (`ON DELETE SET NULL`), conforme a OPEN-004. Itens existentes ficam com o campo nulo. |
| `MargemPadraoCategoria` | Novo registro `ACESSORIOS`, de 8%, carregado do arquivo fiscal (sem mudança de estrutura). |

**Coerência entre item e subcategoria (INV-002):** é garantida no servidor (5.5). No banco, a implementação pode reforçá-la com uma chave estrangeira composta (`subcategoriaId`, `categoria`, `negocioId`) ou com uma restrição equivalente, desde que a exclusão continue deixando só `subcategoriaId` nulo. Se o Prisma não suportar a opção escolhida, a divergência é registrada na implementação.

**Documentos de modelo a atualizar na implementação:**
- `MODELO_DOMINIO_E_JORNADAS.md`: lista de categorias e entidade Subcategoria;
- `MODELO_LOGICO_BANCO.md`: tabela `SUBCATEGORIA` e coluna `ITEM.subcategoria_id`.

---

## 8. Impacto arquitetural

- **Banco:**
  - migração com o valor novo do enum, a tabela `Subcategoria` (com RLS) e a coluna `Item.subcategoriaId`;
  - classificação em `src/lib/db/modelos.ts`.
- **Parâmetros fiscais:** registro novo em `docs/prisma_base/parametros_fiscais_seed.json`. O `src/lib/fiscal/arquivo.ts` já exige uma margem para todo valor do enum.
- **Domínio e validação:**
  - `src/lib/catalogo/validacao.ts`: lista `CATEGORIAS` na ordem nova, validação do nome da subcategoria e `subcategoriaId` no item;
  - rótulos em `src/components/catalogo/rotulos.ts` ("Acessórios").
- **Dados:**
  - `src/lib/db/catalogo.ts`: criar, renomear, excluir, listar e contar o uso das subcategorias; gravar a subcategoria do item; filtro e busca;
  - `src/lib/db/estoque.ts`: filtro e busca;
  - `src/lib/db/lgpd.ts`: exportação.
- **Ações:** `src/lib/catalogo/acoes.ts`, com `acaoComPermissao` do Catálogo, recusando escrita no contexto de suporte.
- **Telas:**
  - `src/app/(app)/catalogo/subcategorias/` (nova);
  - formulário do item em `src/components/catalogo/formularios.tsx` (campo e diálogo);
  - listas e detalhes em `src/app/(app)/catalogo/` e `src/app/(app)/estoque/`.
- **Sem mudança:** Nova venda, Calculadora (só passa a ter a margem de Acessórios), Relatórios, Dashboard e Financeiro.
- **ADRs que restringem:** ADR-002, ADR-003 e ADR-004.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Listar subcategorias** | categoria? | [{id, categoria, nome, itensAtivos, itensArquivados}] | — |
| **Criar subcategoria** | categoria, nome | {id, categoria, nome} | `CampoInvalido`, `NomeRepetido`, `SemPermissao` |
| **Renomear subcategoria** | id, nome | {id, categoria, nome} | `CampoInvalido`, `NomeRepetido`, `NaoEncontrada`, `SemPermissao` |
| **Uso da subcategoria** | id | {itensAtivos, itensArquivados} | `NaoEncontrada` |
| **Excluir subcategoria** | id | {itensAfetados} | `NaoEncontrada`, `SemPermissao` |
| **Salvar item** (estendido, SPEC-006) | + `subcategoriaId?` | item | os da SPEC-006 + `SubcategoriaInvalida` |
| **Listar catálogo / estoque** (estendido) | + `subcategoria?` (id ou "sem"); a busca inclui o nome da subcategoria | itens, com a subcategoria | — |
| **Margem padrão** (SPEC-003, sem mudança) | categoria (inclusive `ACESSORIOS`), dia | margem, fonte, vigência | `ParametroAusente` |

**Implementação (19/10/2026):**

- **Banco:** migração `20261019180000_subcategorias`.
  - `ACESSORIOS` entra no enum com `ADD VALUE … AFTER 'VESTUARIO'`.
  - Tabela `Subcategoria` com RLS, restrição única `(negocioId, categoria, nomeChave)` e `CHECK` do nome.
  - `Item.subcategoriaId` com `ON DELETE SET NULL`.
  - Gatilhos: `he_subcategoria_categoria_fixa` (a categoria não muda), `he_item_subcategoria_da_categoria` (INV-002), `he_negocio_imutavel` e `he_mesmo_negocio` (isolamento).
  - Classificação em `src/lib/db/modelos.ts`.
- **Arquivo fiscal:** margem de `ACESSORIOS` de 8%, com a fonte e a vigência das demais categorias de comércio.
- **Domínio e validação:** `src/lib/catalogo/validacao.ts` reúne:
  - a lista `CATEGORIAS` na ordem nova e `ROTULO_CATEGORIA` (antes em `components/catalogo/rotulos.ts`, que agora o reexporta, porque as mensagens do servidor também o usam);
  - `validarNomeDaSubcategoria`, `validarSubcategoria` e `subcategoriaId` em `validarItem`;
  - `podeCriarSubcategoria` (OPEN-005).
- **Dados:** em `src/lib/db/catalogo.ts`:
  - `subcategorias`, `criarSubcategoria`, `renomearSubcategoria`, `usoDaSubcategoria` e `excluirSubcategoria`;
  - a subcategoria do item, conferida no servidor;
  - `condicaoDaSubcategoria` e `condicaoDaBusca`, também usadas em `src/lib/db/estoque.ts`, que ganha `subcategoriasDosProdutos`;
  - em `src/lib/db/lgpd.ts`, a tabela `subcategorias` na exportação.
- **Ações:** em `src/lib/catalogo/acoes.ts`, `acaoCriarSubcategoria`, `acaoRenomearSubcategoria` e `acaoExcluirSubcategoria`.
- **Telas:**
  - `src/components/catalogo/subcategorias.tsx`: formulário e gaveta;
  - `src/components/catalogo/gestao-de-subcategorias.tsx`: a tela;
  - `src/components/catalogo/filtro-de-categoria.tsx`: o filtro do Catálogo e do Estoque;
  - o campo de subcategoria em `formularios.tsx`;
  - a página nova `src/app/(app)/catalogo/subcategorias`;
  - linhas, detalhes e filtros em `catalogo/` e `estoque/`.
- **Testes:** `test/unit/subcategorias.test.ts` e `test/integracao/subcategorias.test.ts`.

**Decisões de implementação (dentro do que a Spec pede):**

- **"Diálogo" = gaveta do design system.** Os formulários curtos (nova subcategoria, renomear) abrem na gaveta da SPEC-016 (OPEN-003), que é um diálogo acessível do Radix. A exclusão usa o diálogo de confirmação (N3 da SPEC-016).
- **Permissão de criar:** a fábrica de Server Actions declara uma ação por vez, então a ação de criar exige *Catálogo: ver* na guarda e confere *criar ou editar* no corpo, antes de gravar. O teste T04 cobre os dois passos.
- **Coerência no banco (seção 7):** gatilho em vez de chave estrangeira composta. O Prisma não representa o `ON DELETE SET NULL` só da coluna da subcategoria numa chave composta, e o CI compara o banco com o `schema.prisma`.
- **A gaveta do cadastro do item é baixada no primeiro toque** em "+ Nova subcategoria", como a dica da N8. As telas do item sobem 1,7 KB em vez de cerca de 19 KB.
- **A lista da tela Subcategorias mostra também os itens arquivados** ("1 item, mais 1 arquivado"), os mesmos que a confirmação da exclusão conta.
- **Mensagem de nome repetido** com aspas tipográficas: "Já existe “Brincos” em Acessórios."
- **Busca:** o texto de exemplo ficou curto ("Buscar item", "Buscar produto") para não cortar quando aparecem os dois filtros. O rótulo para leitor de tela diz "Buscar por nome ou subcategoria".

**Divergências registradas na implementação:** as três foram **aceitas pela equipe em 20/10/2026** pela opção (2), ajustar a baseline. A seção 5.4 (itens 2 e 3) já traz o texto novo.

1. **Filtro sem subcategorias (5.4, item 3):** quando a categoria escolhida não tem nenhuma subcategoria, o filtro "Subcategoria" não aparece, porque não haveria o que escolher.
2. **Filtro do Estoque (5.4, item 3):** lista só as subcategorias com algum produto físico ativo, porque as que só têm serviços dariam lista vazia no Estoque. No Catálogo, o filtro lista todas.
3. **Detalhe do Estoque (5.4, item 2):** a tela não tem lista de dados. A subcategoria aparece no subtítulo ("Acessórios › Brincos"), e não numa linha "Subcategoria". No detalhe do Catálogo, a linha existe.

**Homologação (T12, 20/10/2026) — correções:** a equipe aprovou o fluxo em <https://he-homol.vercel.app> e encontrou dois problemas de tela. Os dois foram corrigidos no PR #98, sem mudar regra de negócio, e a seção 5.4 (itens 3 e 4) já traz o comportamento novo. Depois do merge, a equipe conferiu as duas correções na homologação e aprovou (20/10/2026) ([evidências](evidencias/SPEC-020/README.md#homologação-t12--20102026)).

1. **Texto cortado nos filtros:** "Todas as categorias" e "Todas as subcategorias" não cabiam nos campos, espremidos na mesma linha dos segmentos de tipo. Agora busca e filtros ficam numa linha própria, e os dois campos têm 240 px (o texto pede cerca de 209 px); no celular, ocupam a linha inteira.
2. **"Voltar" para o início do Catálogo:** o detalhe sempre voltava para `/catalogo`, perdendo os filtros. Agora as listas do Catálogo e do Estoque mandam o próprio endereço no parâmetro `voltar` ao abrir um item, e o detalhe, a edição, o arquivamento e o cadastro o repassam. O link mostra o nome do destino ("Catálogo", "Itens arquivados", "Subcategorias", "Estoque") ou "Voltar", quando o destino é outro item. Por segurança, só vale endereço interno do Catálogo ou do Estoque; qualquer outro valor cai no início da lista (`src/lib/estrutura/retorno.ts`, com 24 testes em `test/unit/retorno.test.ts`).

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação | Verificação |
|---|---|---|
| RNF01 | Campo, diálogo, tela Subcategorias e filtros em 390, 768 e 1440 px, claro e escuro, sem rolagem horizontal. A tela continua dentro do orçamento de JavaScript da SPEC-016, seção 10 (+30 KB). | Capturas, axe-core e medição de JS. |
| RNF02 | `negocioId`, RLS e cliente do negócio na tabela nova. | INV-006 e teste de isolamento. |
| RNF04 | A exportação inclui as subcategorias. | Teste de integração da exportação. |

---

## 11. Critérios de aceitação

**CA-01 — Acessórios.** Dado o cadastro de um item, quando a pessoa abre a lista de categorias, então "Acessórios" aparece logo depois de "Vestuário". Com um item de Acessórios, a Calculadora sugere 8%, com a fonte legal.

**CA-02 — Criar no cadastro do item.** Dado o Dono cadastrando "Brinco argola dourado" em Acessórios, quando toca em "+ Nova subcategoria" e informa "Brincos", então a subcategoria é criada e já fica escolhida, o resto do formulário continua preenchido, e o item é salvo com ela.

**CA-03 — Criar na tela e cadastrar dentro dela.** Dada a tela Subcategorias, quando o Dono cria "Colares" em Acessórios e toca em "Novo item" nela, então o cadastro abre com Acessórios e Colares já escolhidos.

**CA-04 — Nome repetido.** Dada a subcategoria "Brincos" em Acessórios, quando alguém tenta criar " brincos " em Acessórios, então recebe "Já existe 'Brincos' em Acessórios". Criar "Brincos" em Vestuário é permitido.

**CA-05 — Categoria do item.** Dado um item de Acessórios com a subcategoria Brincos, quando a pessoa troca a categoria para Vestuário, então a subcategoria volta para "Sem subcategoria". Uma chamada direta com uma subcategoria de outra categoria, ou de outro negócio, é recusada.

**CA-06 — Renomear.** Dada "Aneis" com 4 itens, quando o Dono renomeia para "Anéis", então os 4 itens passam a mostrar "Anéis".

**CA-07 — Excluir em uso.** Dada "Colares" com 3 itens, quando o Dono exclui, então a confirmação avisa que 3 itens ficarão sem subcategoria. Ao confirmar, os itens ficam sem subcategoria, e preço, custo, estoque, histórico e vendas deles não mudam.

**CA-08 — Filtros e busca.** Dados itens em Brincos, em Colares e sem subcategoria:
- no Catálogo e no Estoque, o filtro Acessórios › Brincos mostra só os brincos;
- "Sem subcategoria" mostra só os sem subcategoria;
- buscar "brinc" encontra os itens da subcategoria Brincos mesmo sem "brinco" no nome.

**CA-09 — Permissões.** Dado um Colaborador com a predefinição (*Catálogo: ver*), quando abre a tela Subcategorias, então vê a lista sem os botões de criar, renomear, excluir e "Novo item", e uma chamada direta é recusada. Um Gerente com a predefinição cria, renomeia e exclui.

**CA-10 — Margem.** Dados dois itens de Acessórios, um em Brincos e outro sem subcategoria, quando a Calculadora sugere a margem, então a sugestão é a mesma: 8%.

**CA-11 — Modo suporte.** Dado o suporte com o Catálogo liberado, quando abre a tela Subcategorias, então vê a lista sem botões de escrita, e qualquer escrita é recusada no servidor.

**CA-12 — Isolamento.** Dados os negócios A e B, então B não vê nem consegue usar as subcategorias de A.

**CA-13 — Exportação.** Dado um negócio com subcategorias, quando o Dono exporta os dados, então o arquivo traz as subcategorias e a referência nos itens.

**CA-14 — Itens existentes.** Dados os itens cadastrados antes da migração, então continuam com a mesma categoria e sem subcategoria.

**CA-15 — Visual.** Dadas as telas alteradas em 390, 768 e 1440 px, claro e escuro, então seguem o design system, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação do nome da subcategoria (vazio, 41 caracteres, espaços) e chave normalizada | Unitário | 5.5, INV-003 |
| T02 | Validação do item com subcategoria (vazia, de outra categoria) | Unitário | 5.5, INV-002 |
| T03 | Lista de categorias na ordem nova, rótulo de Acessórios e arquivo fiscal com a margem de `ACESSORIOS` | Unitário + `fiscal:validar` no CI | CA-01, INV-007 |
| T04 | Criar, renomear e excluir com Dono, Gerente, Colaborador predefinido e suporte | Integração | CA-09, CA-11, INV-005 |
| T05 | Nome repetido por categoria, inclusive com duas criações simultâneas; mesmo nome em outra categoria | Integração | CA-04, INV-003 |
| T06 | Salvar item com subcategoria de outra categoria ou de outro negócio; troca de categoria | Integração | CA-05, CA-12, INV-002, INV-006 |
| T07 | Excluir subcategoria em uso: itens sem subcategoria e todo o resto igual | Integração | CA-07, INV-004 |
| T08 | Filtros ("Todas", subcategoria, "Sem subcategoria") e busca no Catálogo e no Estoque | Integração | CA-08 |
| T09 | Margem sugerida igual com e sem subcategoria; Acessórios = 8% | Integração | CA-01, CA-10, INV-001 |
| T10 | Exportação com subcategorias; migração sem mudar itens existentes | Integração | CA-13, CA-14, INV-008 |
| T11 | Fluxo da loja de semijoias no navegador (build local): criar no item e na tela, "Novo item", renomear, excluir, filtros e busca; capturas em 390, 768 e 1440 px, claro e escuro; axe; medição de JS | Navegador + manual com captura | CA-02, CA-03, CA-06, CA-15 |
| T12 | Fluxo na homologação, depois do merge | Manual (uma vez) | CA-01 a CA-08 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 19/10/2026, em entrevista, pela opção recomendada, com os complementos indicados:

| ID | Decisão |
|---|---|
| **OPEN-001** — Categorias fixas novas | **Só Acessórios** (semijoias, bijuterias, bolsas, cintos, óculos), com margem de 8% (comércio). **Complemento da equipe:** entra **logo depois de Vestuário**, e não no fim da lista. Os outros casos (Artesanato, Educação, Pet…) ficam com as subcategorias. Altera o RF11. |
| **OPEN-002** — Vínculo com a categoria | **Dentro de uma categoria:** cada subcategoria pertence a uma categoria fixa, e o campo mostra só as da categoria escolhida. O nome tem até 40 caracteres e não se repete na categoria. Trocar a categoria do item limpa a subcategoria. |
| **OPEN-003** — Onde criar e gerenciar | **No cadastro do item ("+ Nova subcategoria") e numa tela "Subcategorias" no Catálogo**, para renomear e excluir. **Complemento da equipe:** a tela também tem o botão **"Nova subcategoria"** e permite cadastrar itens direto numa subcategoria ("Novo item", com categoria e subcategoria preenchidas). Assim, o Dono pode montar as subcategorias antes e cadastrar dentro delas, ou criá-las na hora de cadastrar o item. |
| **OPEN-004** — Excluir em uso | **Exclui, e os itens ficam sem subcategoria**, depois de uma confirmação com o número de itens afetados. Vendas, preços e estoque não mudam. |
| **OPEN-005** — Permissões | **As do Catálogo:** criar com *Catálogo: criar* ou *editar*, renomear com *editar* e excluir com *excluir*. Dono e Gerente podem tudo por padrão; o Colaborador predefinido só vê. Tudo é conferido no servidor. |
| **OPEN-006** — Onde aparece | **Catálogo e Estoque:** na linha e no detalhe do item, no filtro (que aparece com a categoria escolhida) e na busca por texto. Nova venda e Relatórios ficam para depois. |

**Decisões derivadas da baseline (sem questão nova):**
- a subcategoria é **opcional**, porque os itens existentes não têm uma;
- vale para **produtos e serviços**;
- está nos **dois planos**, porque não é uma das funcionalidades limitadas do gratuito (SPEC-013, RN18);
- o modo suporte só **lê** (RN30);
- a exportação **inclui** as subcategorias (RNF04);
- a margem de Acessórios segue o percentual de presunção do comércio (RF36, Lei 9.249/1995, art. 15), como Produtos, Vestuário e Casa.

---

## 14. Definition of Done da Spec

A SPEC-020 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-15) estiverem implementados, por testes, no navegador (build local) e na homologação (T12) — implementados e verificados por testes e no navegador em 19/10/2026; homologados em 20/10/2026 (CA-01 a CA-08), com as duas correções do PR #98 conferidas no mesmo dia;
- [x] todos os invariantes (INV-001 a INV-008) estiverem preservados — testes T01–T10;
- [x] os testes derivados (T01 a T12) estiverem aprovados, com o CI verde no PR — T01 a T11 aprovados (T11 com 70 verificações); T12 aprovado em 20/10/2026, com as correções do PR #98 verificadas em build local (47 verificações) e conferidas na homologação;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04) tiverem sido verificados como descrito na seção 10 — capturas em 390/768/1440 px nos dois temas, axe-core sem violação, JavaScript dentro do orçamento, RLS e isolamento testados, exportação testada;
- [x] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas (19/10/2026), com o RF11 alterado e o RF79 e a RN33 incluídos na baseline;
- [x] os documentos de modelo (seção 7) e o arquivo fiscal estiverem atualizados;
- [x] não existir divergência conhecida entre a implementação e esta Spec — as três divergências registradas depois da seção 9 foram aceitas pela equipe em 20/10/2026 (opção 2, baseline ajustada na seção 5.4);
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada (depois da seção 9).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
