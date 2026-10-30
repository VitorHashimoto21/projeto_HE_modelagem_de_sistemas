# SPEC-024 — Código interno dos itens

> **Status:** ✅ **Aprovada e implementada em 30/10/2026**, verificada em build local: testes T01 a T08 automatizados e o roteiro no navegador (T09 e T10) com 111 verificações ([evidências](evidencias/SPEC-024/README.md)). Falta a homologação (T11). As notas da implementação estão depois da seção 9. As questões em aberto foram decididas pela equipe em entrevista (seção 13):
> - o código é **opcional**, em **produtos e serviços**, e o Catálogo mostra os **itens sem código** (OPEN-001 e OPEN-004, pela opção recomendada);
> - o código é **digitado pelo negócio**: o sistema não gera nem sugere (OPEN-002; a equipe preferiu esta opção à recomendada, que sugeria o próximo código da subcategoria);
> - tem até **20 caracteres**, fica em **maiúsculas** e é **único entre os itens ativos** do negócio (OPEN-003, pela opção recomendada);
> - aparece e é buscado no **Catálogo**, no **Estoque** e na **Nova venda** e na troca, onde o código exato seguido de Enter adiciona o item. Também aparece no **detalhe da venda** e no relatório de **rentabilidade por item** (OPEN-005; a equipe incluiu o detalhe da venda e o relatório, além da opção recomendada);
> - o código de barras oficial (**GTIN**) fica para a Spec da nota fiscal (OPEN-006, pela opção recomendada).
>
> A baseline foi ajustada: RF87 e RN40 novos. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir de uma ideia da equipe (29/10/2026), ligada à revisão da loja de semijoias.
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-006](SPEC-006.md) (cadastro, edição, lista, busca, detalhe e reativação do item), [SPEC-007](SPEC-007.md) (lista, busca e detalhe do estoque), [SPEC-008](SPEC-008.md) e [SPEC-011](SPEC-011.md) (busca da Nova venda e da troca, e detalhe da venda), [SPEC-013](SPEC-013.md) (rentabilidade por item), [SPEC-014](SPEC-014.md) (exportação) e [SPEC-019](SPEC-019.md) (o código entra na correção "Editar item").
> - **Usa:** [SPEC-001](SPEC-001.md) (isolamento), [SPEC-005](SPEC-005.md) (permissões), [SPEC-016](SPEC-016.md) (componentes), [SPEC-018](SPEC-018.md) (modo suporte), [SPEC-020](SPEC-020.md) (filtros e "voltar") e [SPEC-021](SPEC-021.md) (o mesmo padrão da lista "Produtos sem NCM").

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-024 |
| **Nome** | Código interno dos itens |
| **Objetivo** | Permitir que o negócio dê a cada produto ou serviço um **código próprio**, diferente do NCM, para **encontrar o item pelo código** no Catálogo, no Estoque e na Nova venda e para identificá-lo no detalhe da venda e na rentabilidade por item. Na Nova venda, o código exato com Enter adiciona o item, o que já funciona com um leitor de código de barras e etiquetas próprias. |
| **Valor entregue** | A loja que etiqueta as peças com um código (BR-015, CO-007) acha o item certo digitando o código, sem rolar nomes parecidos ("Brinco argola dourado P", "M", "G"). No balcão, a venda fica mais rápida: código e Enter, ou o leitor de código de barras. O código já fica pronto para o campo "código do produto" da futura nota fiscal. |

### O que é o código interno

O código interno é **do próprio negócio**: cada um escolhe o seu padrão, e cada item tem o seu. Ele não se confunde com os outros dois códigos que um produto pode ter:

| Código | Quem define | Um por… | Nesta Spec |
|---|---|---|---|
| **Código interno** (ex.: BR-015) | O próprio negócio | Item | ✅ Novo campo |
| **NCM** (ex.: 7117.19.00) | Tabela oficial; o negócio classifica | Tipo de mercadoria: vários itens têm o mesmo | Já existe (SPEC-021) |
| **GTIN/EAN** (código de barras da embalagem) | Quem registra o produto na GS1 (em geral, o fabricante) | Produto do fabricante | Fora (OPEN-006) |

- Na NF-e, o código interno vai no campo **"código do produto"** (`cProd`), que aceita até 60 caracteres; o GTIN vai em outro campo, e o produto sem GTIN vai como "SEM GTIN". Por isso os dois não se misturam.
- O código interno pode ser impresso pelo negócio numa **etiqueta com código de barras**. Um leitor de código de barras USB ou Bluetooth funciona como um teclado: "digita" o código e aperta Enter. Por isso, o Enter da Nova venda (5.4) já atende quem usa leitor, sem nada específico para ele.
- O código **não tem efeito em cálculo nem em regra fiscal** (RN40): só identifica e encontra o item.

### Exemplo que originou a Spec

A loja de semijoias tem dezenas de brincos e colares com nomes parecidos e etiqueta as peças com um código próprio.
- **Hoje:** não há onde guardar o código. No balcão, a vendedora digita parte do nome e escolhe entre vários "Brinco argola…" parecidos.
- **Com esta Spec:**
  - no cadastro do "Brinco argola dourado M", a loja digita o código "br-015", que fica "BR-015";
  - no Catálogo, a linha do item mostra "BR-015 · Produto físico, Acessórios › Brincos, unidade", e a busca por "015" encontra o item;
  - na Nova venda, a vendedora digita "br-015" e aperta Enter (ou passa o leitor na etiqueta), e o brinco entra na venda;
  - no relatório de rentabilidade, a coluna "Código" ajuda a conferir as peças com a etiqueta;
  - o link "Itens sem código (12)" mostra o que falta etiquetar.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF87** (novo) | Código interno do item: opcional, digitado pelo negócio, em produtos e serviços, até 20 caracteres, em maiúsculas e único entre os itens ativos. Aparece e é buscado no Catálogo, no Estoque e na Nova venda e na troca (código exato + Enter adiciona o item). Aparece no detalhe da venda, na rentabilidade por item e na exportação. O Catálogo mostra os itens sem código. |
| | RF07, RF08, RF09 | Mantidos: o código é opcional nos dois tipos e não muda o que é obrigatório no cadastro. |
| | RF23 | Mantido: a venda continua com múltiplos itens; o código é mais um jeito de adicioná-los. |
| | RF70 | A rentabilidade por item ganha a coluna "Código" (tela, CSV e PDF). |
| | RF79, RF80 | Usados como padrão: filtros, busca compartilhada pelo Catálogo e pelo Estoque e a lista "Produtos sem NCM". |
| **RN** | **RN40** (nova) | O código é do negócio: opcional, digitado pelo usuário (o sistema não gera nem sugere), único entre os itens ativos do negócio sem diferenciar maiúsculas. O item arquivado libera o código, e a reativação com o código em uso é recusada. O código não altera preço, custo, margem, estoque, permissões nem regras fiscais. |
| | RN23, RN35 | Mantidas: o Enter só adiciona item vendável (com preço e, com a nota fiscal de produtos ligada, com NCM). |
| | RN37 | A correção "Editar item" do suporte (SPEC-019) passa a incluir o código. |
| **RNF** | RNF01 | Campo, listas, busca, Enter e relatório em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | A unicidade e a busca valem só dentro do negócio: negócios diferentes podem usar o mesmo código. |
| | RNF04 | O código entra na exportação dos itens. |
| | RNF10 | Prepara o campo "código do produto" da nota fiscal sem mudar o núcleo. |
| **Decisões anteriores** | SPEC-006, OPEN-003 | Mesmo padrão do nome: único entre os itens ativos; o arquivado não ocupa. |
| | SPEC-021, seção 3 | O GTIN e os outros campos da nota continuam fora, com a Spec da nota fiscal. |
| **Caso de uso / fluxo** | Cadastro e edição de item (SPEC-006); listas do Catálogo e do Estoque; Nova venda e troca (SPEC-008, SPEC-011); detalhe da venda; Relatórios (SPEC-013); exportação (SPEC-014) | Ver seção 5. |
| **Entidades** | `Item` (campo novo) | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Campo "Código"** no cadastro e na edição de **produtos físicos e serviços**, inclusive os materiais, **opcional** e **digitado pelo negócio** (OPEN-001, OPEN-002, OPEN-004).
2. **Formato e unicidade** (OPEN-003):
   - até 20 caracteres: letras sem acento, números, hífen, ponto, barra e sublinhado, sem espaço;
   - guardado em maiúsculas;
   - único entre os itens ativos do negócio, conferido também no banco;
   - o item arquivado libera o código, e a reativação com o código em uso é recusada.
3. **Onde o código aparece** (OPEN-005):
   - lista e detalhe do Catálogo;
   - lista e detalhe do Estoque;
   - resultados da busca na Nova venda e na troca;
   - detalhe da venda;
   - rentabilidade por item (tela, CSV e PDF);
   - exportação dos dados.
4. **Busca pelo código** (OPEN-005) no Catálogo e no Estoque (a mesma função) e na Nova venda e na troca. O item com o código exato aparece primeiro.
5. **Código exato + Enter** na Nova venda e na troca: adiciona o item vendável com esse código, sem enviar a venda. Funciona com leitor de código de barras que digita o código.
6. **Link "Itens sem código"** no Catálogo (OPEN-001), quando o negócio já usa códigos.
7. **Permissões:** gravar o código segue as do item (*Catálogo: criar* no cadastro, *Catálogo: editar* na edição). Ver o código segue as telas onde ele aparece. Tudo é conferido no servidor.
8. **Modo suporte:** vê o código, sem escrever (SPEC-018). Com a SPEC-019, a correção "Editar item" inclui o código.
9. **Planos:** o campo, as listas, a busca e o Enter valem nos dois planos; a rentabilidade por item continua do plano pago (RF70).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| **Código de barras oficial (GTIN/EAN)** e os outros campos da nota | Spec da nota fiscal (OPEN-006). |
| Gerar o código automaticamente ou sugerir o próximo (ex.: "Usar BR-015") | Fora (OPEN-002): o código é sempre digitado pelo negócio. |
| Gerar ou preencher códigos de vários itens de uma vez | Fora: os itens recebem o código um a um; o link "Itens sem código" ajuda a encontrá-los. |
| Código obrigatório (para todos ou por opção do negócio) | Fora (OPEN-001). |
| Imprimir etiquetas com código de barras | Fora: o negócio usa o programa da própria impressora de etiquetas. |
| Leitura de código de barras pela câmera do celular | Fora: o leitor USB ou Bluetooth funciona como teclado e é atendido pelo Enter (5.4). |
| Código no Painel, na Calculadora, nas movimentações do estoque e nos outros relatórios | Fora (OPEN-005): o código aparece só nos lugares da seção 5.3. |
| Guardar o código do momento na venda | Fora: a venda mostra o código atual do item, como já faz com o nome (o `ItemVenda` não guarda cópia). |
| Histórico das trocas de código | Fora: o código pode ser trocado a qualquer momento, sem registro próprio. Com a SPEC-019, a correção do suporte guarda o antes e o depois. |

---

## 4. Dependências

- **Specs:**
  - SPEC-006: cadastro, edição, lista, busca, detalhe, arquivamento e reativação do item; a regra do nome único entre os ativos;
  - SPEC-007: lista, busca e detalhe do estoque (a busca é a mesma do Catálogo);
  - SPEC-008 e SPEC-011: Nova venda, troca (o mesmo componente da frente de caixa) e detalhe da venda; regras de item vendável (RN23, RN35);
  - SPEC-013: relatório de rentabilidade por item (plano pago);
  - SPEC-014: exportação;
  - SPEC-020 e SPEC-021: filtros, "voltar" para a lista de origem e o padrão do link "Produtos sem NCM";
  - SPEC-005: matriz módulo × ação;
  - SPEC-001: isolamento, `modelos.ts` e RLS;
  - SPEC-016: campos, listas, aviso da página e estados vazios;
  - SPEC-018 e SPEC-019: contexto de suporte e lista fechada de correções.
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-003 (autorização no servidor).
- **Pré-requisitos externos:** nenhum. O leitor de código de barras é opcional e não precisa de configuração no sistema.

---

## 5. Comportamento esperado

### 5.1 Campo "Código" no cadastro e na edição (OPEN-001, OPEN-002, OPEN-004)

1. O formulário do item (produto físico e serviço) ganha o campo **"Código (opcional)"**, logo depois do nome, com a dica: "Um código seu para achar o item, como o da etiqueta. Até 20 caracteres."
2. O campo é **digitado pelo negócio**: o sistema não gera nem sugere código (OPEN-002).
3. Vazio = item sem código. O código pode ser incluído, trocado ou apagado a qualquer momento, na edição do item.
4. Vale também para os produtos usados como materiais dos serviços, que são produtos físicos.

### 5.2 Formato e unicidade (OPEN-003)

1. **Normalização** antes de conferir e gravar: os espaços do começo e do fim são retirados, e as letras minúsculas viram maiúsculas ("br-015 " → "BR-015").
2. **Formato:** de 1 a 20 caracteres, só letras de A a Z (sem acento), números, hífen (-), ponto (.), barra (/) e sublinhado (_). Fora disso, a gravação é recusada com a mensagem: "Use até 20 caracteres: letras sem acento, números, hífen (-), ponto (.), barra (/) ou sublinhado (_), sem espaços."
3. **Unicidade:** o código não se repete entre os **itens ativos do mesmo negócio**. Se outro item ativo já usa o código, a gravação é recusada com o nome dele: "O código BR-015 já é usado por “Brinco argola dourado M”. Use outro código." A regra também é garantida no banco (INV-001).
4. **Negócios diferentes** podem usar o mesmo código (RNF02).
5. **Arquivar:** o item arquivado **mantém** o código (no detalhe e nos relatórios, com "(arquivado)"), mas não o ocupa: outro item ativo pode usá-lo, como acontece com o nome (SPEC-006, OPEN-003).
6. **Reativar:** se outro item ativo já usa o código do item arquivado, a reativação é recusada: "Já existe um item ativo com o código BR-015. Troque o código de um deles antes de reativar." O nome continua sendo conferido como hoje.

### 5.3 Onde o código aparece (OPEN-005)

| Tela | Como aparece |
|---|---|
| **Catálogo — lista** | No começo da linha de baixo: "BR-015 · Produto físico, Acessórios › Brincos, unidade". Sem código, a linha fica como hoje. |
| **Catálogo — detalhe** | Linha "Código" no começo de "Dados do item"; sem código, "—". |
| **Estoque — lista** | No começo da linha de baixo: "BR-015 · Acessórios › Brincos, mínimo 2". |
| **Estoque — detalhe** | No começo da descrição, abaixo do nome: "BR-015 · Acessórios › Brincos". |
| **Nova venda e troca — resultados da busca** | No começo da linha de baixo: "BR-015 · 3 em estoque" ou "MAN-01 · Serviço". |
| **Detalhe da venda** | Junto do nome de cada item: "BR-015 · Brinco argola dourado M". |
| **Relatórios — rentabilidade por item** | Coluna "Código" na tabela (tela, CSV e PDF) e no começo da linha de baixo na lista do celular. O gráfico de ranking continua só com o nome. |
| **Exportação (SPEC-014)** | Campo `codigo` dos itens, no `dados.json` e no `itens.csv`. |

- O código mostrado é sempre o **atual** do item, também nas vendas antigas e nos relatórios, como já acontece com o nome.
- O código aparece sempre em texto (não em código de barras) e com a mesma cor do texto ao lado (sem destaque de cor).

### 5.4 Busca e Enter (OPEN-005)

1. **Catálogo e Estoque:** a busca por texto, que é a mesma função nas duas telas, passa a encontrar também os itens cujo código **contém** o texto, sem diferenciar maiúsculas ("015" encontra BR-015). As buscas por nome, subcategoria e NCM continuam. O item com o **código exato** aparece primeiro; os outros seguem a ordem atual.
2. **Nova venda e troca:** a busca filtra os itens vendáveis pelo nome **ou** pelo código, e o item com o código exato aparece primeiro.
3. **Enter no campo de busca da Nova venda e da troca:**
   - se o texto, normalizado como em 5.2, é **exatamente** o código de um item vendável, o item entra na venda com 1 unidade (ou mais 1, se já estiver nela), como no toque. A busca é limpa e o foco continua no campo, pronto para o próximo código;
   - se não há item vendável com esse código exato, nada é adicionado, e aparece "Nenhum item à venda com o código BR-015." Isso vale também para o item sem preço oficial ou, com a nota fiscal de produtos ligada, sem NCM (RN23, RN35);
   - o Enter **nunca** envia a venda nem adiciona por correspondência parcial (INV-005).
4. As regras de adicionar continuam as mesmas: aviso de estoque, quantidade e conferência no servidor ao registrar (SPEC-008).
5. **Leitor de código de barras:** o leitor que funciona como teclado digita o código e aperta Enter, então cai no item 3. Nada precisa ser configurado.

### 5.5 Itens sem código (OPEN-001)

1. No rodapé da lista do Catálogo, junto de "Ver itens arquivados" e "Produtos sem NCM", aparece o link **"Itens sem código (12)"**.
2. O link só aparece quando o negócio **já usa códigos** (ao menos um item ativo com código) e há itens ativos sem código. Assim, quem não usa códigos não vê o lembrete.
3. O link abre a lista com o filtro "sem código" (produtos e serviços ativos), que pode ser combinado com o tipo, a categoria e a busca, como o "Produtos sem NCM".
4. Nunca é um aviso no topo: o código é opcional.

### 5.6 Permissões, planos e suporte

1. Gravar o código: *Catálogo: criar* no cadastro e *Catálogo: editar* na edição, conferidas no servidor. Quem não pode editar não vê o campo editável.
2. Ver o código: segue a permissão de cada tela (Catálogo, Estoque, Vendas e Relatórios).
3. **Planos:** campo, listas, busca e Enter nos dois planos; a rentabilidade por item continua só no plano pago (RF70).
4. **Modo suporte (SPEC-018):** o Administrador vê o código, sem escrever. O código não é dado pessoal e não é mascarado.
5. **Correções (SPEC-019, a implementar):** a correção "Editar item" passa a incluir o código, e o desfazer volta o código anterior. Se o código anterior estiver em uso por outro item ativo, o desfazer é recusado com a mensagem de 5.2.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Dois itens **ativos** do mesmo negócio nunca têm o mesmo código, garantido também no banco. | Teste de integração com gravação direta no banco e com duas gravações ao mesmo tempo. |
| **INV-002** | Todo código gravado tem de 1 a 20 caracteres do conjunto permitido, em maiúsculas; o campo vazio é gravado como nulo. | Teste unitário da normalização e da validação; teste de integração da gravação. |
| **INV-003** | O código não altera preço, custo, margem, estoque, permissões nem regras fiscais (RN40). | Testes existentes do Catálogo, da Calculadora e da venda sem alteração, com itens com e sem código. |
| **INV-004** | A unicidade e a busca valem só dentro do negócio: o mesmo código em dois negócios é aceito, e a busca de um nunca traz item do outro. | Teste de integração com dois negócios. |
| **INV-005** | O Enter só adiciona um item quando o texto normalizado é exatamente o código de um item vendável; nunca por correspondência parcial e nunca enviando a venda. | Teste unitário da função que acha o item pelo código exato; roteiro no navegador. |
| **INV-006** | O item arquivado não ocupa o código, e a reativação com o código em uso por outro item ativo é recusada. | Teste de integração. |

---

## 7. Modelo de domínio envolvido

| Entidade | Uso | Mudança |
|---|---|---|
| `Item` | código, nome, tipo, arquivamento | **Campo novo:** `codigo` (texto de até 20 caracteres, opcional) e a garantia de unicidade só entre os itens ativos do negócio |
| `ItemVenda` | detalhe da venda e rentabilidade | Nenhuma: o código vem do item (seção 3, fora do escopo) |

**Mudanças previstas no schema:**
- `Item.codigo` (`VarChar(20)`, opcional), gravado já normalizado;
- unicidade de `(negocioId, codigo)` só entre os itens ativos, garantida no banco. Pode ser feita com uma chave nula quando o item é arquivado, como `nomeChave` (SPEC-006), ou com um índice único parcial;
- migração sem preenchimento: todos os itens existentes ficam sem código.

---

## 8. Impacto arquitetural

- `prisma/schema.prisma` e uma migração: campo e unicidade (seção 7).
- `src/lib/catalogo/validacao.ts`: normalização e validação do código (5.2).
- `src/lib/dominio/`: função pura que acha o item vendável pelo código exato (5.4, INV-005).
- `src/lib/db/catalogo.ts`:
  - gravar o código no cadastro e na edição, com o erro de código em uso trazendo o nome do item;
  - recusar a reativação com o código em uso;
  - `condicaoDaBusca` também pelo código, com o código exato primeiro;
  - filtro "sem código" e a contagem do link (5.5);
  - lista e detalhe com o código.
- `src/lib/db/estoque.ts`: lista e detalhe com o código (a busca vem de `condicaoDaBusca`).
- `src/lib/db/vendas.ts`: itens vendáveis e detalhe da venda com o código.
- `src/components/vendas/frente-de-caixa.tsx`: filtro pelo código, código exato primeiro e o Enter (5.4), na Nova venda e na troca.
- `src/components/catalogo/formularios.tsx`: o campo.
- Telas: lista e detalhe do Catálogo e do Estoque, detalhe da venda e Relatórios.
- `src/lib/relatorios/`: o código na rentabilidade por item e a coluna "Código" na tabela do CSV e do PDF.
- Exportação (SPEC-014): os itens já são exportados com todos os campos; conferir que o `codigo` entra no `dados.json` e no `itens.csv`.
- SPEC-019 (quando implementada): o código em `CORRECOES_PERMITIDAS`, na ação "Editar item".
- Sem permissão nova, sem ação nova e sem integração externa.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Cadastrar / editar item** (SPEC-006) | + código (opcional) | item com o código normalizado | + `CodigoInvalido` (formato); + `CodigoEmUso` (com o nome do item que usa) |
| **Arquivar / reativar item** (SPEC-006) | Sem mudança | Sem mudança | + `CodigoEmUsoAoReativar` |
| **Listar itens do Catálogo / do Estoque** | + busca também pelo código; + filtro "sem código" (Catálogo) | itens com o código, o exato primeiro; contagem dos itens sem código | — |
| **Itens vendáveis** (SPEC-008) | Sem mudança | + código de cada item | — |
| **Item pelo código exato** (domínio, função pura) | texto digitado, itens vendáveis | o item com o código exato, ou nenhum | — |
| **Detalhe da venda** (SPEC-008) | Sem mudança | + código atual de cada item | — |
| **Rentabilidade por item** (SPEC-013) | Sem mudança | + código atual de cada item; coluna "Código" no CSV e no PDF | — |
| **Exportação** (SPEC-014) | Sem mudança | + `codigo` nos itens | — |

**Implementação (30/10/2026):**
- **Banco** (migração `20261030160000_codigo_interno`):
  - `Item.codigo` e `Item.codigoChave`, de até 20 caracteres, com a unicidade em `(negocioId, codigoChave)`. A chave é o próprio código enquanto o item está ativo e fica nula quando ele é arquivado, como o `nomeChave` (SPEC-006);
  - CHECKs do formato (`Item_codigo_formato`) e da chave coerente com o arquivamento (`Item_codigo_chave`).
- **Domínio** (`src/lib/dominio/catalogo.ts`): `normalizarCodigo`, `codigoValido`, `itemPeloCodigo` (o Enter, INV-005) e `codigoExatoPrimeiro`.
- **Validação e dados:**
  - `validarItem` lê e confere o código;
  - o Catálogo grava, confere o código em uso (com o nome do outro item) e recusa a reativação com o código em uso;
  - `condicaoDaBusca` (Catálogo e Estoque) encontra pelo código, o filtro "sem código" e a contagem do link;
  - itens vendáveis, detalhe da venda e rentabilidade trazem o código.
- **Telas:**
  - campo no formulário do item;
  - código nas listas e nos detalhes do Catálogo e do Estoque, nos resultados da busca e no detalhe da venda;
  - link "Itens sem código";
  - Enter na Nova venda e na troca (`FrenteDeCaixa`);
  - coluna "Código" na rentabilidade (tela, CSV e PDF).
- **Testes:** `test/unit/codigo-interno.test.ts` (T01, T02 e T07) e `test/integracao/codigo-interno.test.ts` (T03 a T06 e T08).
- Sem ação nova, permissão nova ou integração externa. A exportação traz o código sem mudança no código dela, porque exporta todos os campos do item. Ela traz também a coluna interna `codigoChave`, como já trazia o `nomeChave`.

**Decisões de implementação (sem mudar o comportamento da Spec):**
- **Unicidade por coluna de chave:** a garantia "só entre os ativos" usa a coluna `codigoChave` e um índice único comum, e não um índice parcial. Um índice parcial não é representado no schema do Prisma e quebraria a checagem de divergência do CI (`migrate diff`).
- **Código sem item:** depois de um Enter sem item com o código, o texto fica **selecionado**, e a mensagem aparece. A leitura seguinte do leitor substitui o texto em vez de se juntar a ele. Encontrado no roteiro.
- **Campo controlado:** o campo do código é controlado (como o custo). Assim, o código recusado pelo servidor continua no campo, porque o React 19 reinicia os campos não controlados depois de cada envio. Encontrado no roteiro.
- **Rentabilidade no celular:** o cartão do item não tem linha de baixo. O código aparece numa linha própria, "Código BR-015", abaixo do nome.
- **Busca da Nova venda:** o exemplo do campo passou a "Nome ou código, ex.: manicure".

**Observação encontrada no roteiro, fora desta Spec (SPEC-006):** o reinício dos campos depois de uma recusa do servidor também afeta o **nome** e os outros campos não controlados do formulário do item. Com o nome em uso, a edição volta ao nome original, e o cadastro perde o nome, a categoria e a unidade. Propostas: (1) corrigir a implementação; (2) manter. Registrada no Mapa para decisão da equipe ([evidências](evidencias/SPEC-024/README.md#encontrado-no-roteiro)).

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Campo, listas com o código, busca, Enter e a tabela da rentabilidade legíveis no celular, sem rolagem horizontal. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login; axe sem violações. |
| **RNF02** | Unicidade e busca só dentro do negócio, com o isolamento atual (RLS). | INV-004. |
| **RNF04** | O código entra na exportação. | Teste da exportação. |
| **RNF06** | A busca pelo código não deixa as listas lentas: o código fica no mesmo item, e a busca da Nova venda continua no navegador. | Tempo das listas com 1.000 itens igual ao de antes, no roteiro. |
| **RNF10** | O código fica pronto para o campo "código do produto" da futura nota fiscal, sem mudar o núcleo. | Revisão da Spec da nota fiscal. |

---

## 11. Critérios de aceitação

**CA-01 — Cadastro com código.** Dado um Dono no cadastro de produto, quando informa o código "br-015 ", então o item é gravado com "BR-015", que aparece no detalhe e na lista do Catálogo.

**CA-02 — Sem código.** Dado um item cadastrado sem código, então ele funciona como antes: aparece na lista sem código, o detalhe mostra "Código: —", e ele pode ser vendido normalmente.

**CA-03 — Formato inválido.** Dados os códigos "BR 015" (espaço), "BRÍ-1" (acento) e um de 21 caracteres, quando a pessoa tenta gravar, então a gravação é recusada com a mensagem de formato, e nada é gravado.

**CA-04 — Código em uso.** Dado um item ativo com o código BR-015, quando outra pessoa grava outro item com "br-015", então a gravação é recusada com "O código BR-015 já é usado por “Brinco argola dourado M”…". Em outro negócio, o mesmo código é aceito.

**CA-05 — Arquivar e reativar.** Dado o item A com BR-015, quando A é arquivado, então o item B pode usar BR-015. Depois disso, quando alguém tenta reativar A, então a reativação é recusada com a mensagem de código em uso.

**CA-06 — Busca no Catálogo e no Estoque.** Dados os itens com os códigos BR-015 e BR-0150 e o item sem código "Colar 015 cm", quando a pessoa busca "br-015", então aparecem BR-015 (primeiro) e BR-0150. Quando busca "015", aparecem os três (o colar pelo nome). No Estoque, aparecem só os produtos físicos.

**CA-07 — Enter na Nova venda.** Dado o item vendável BR-015, quando a vendedora digita "br-015" e aperta Enter, então o item entra com 1 unidade e a busca é limpa. Repetindo, a quantidade vai a 2. Com "br-01" (parcial) e Enter, nada é adicionado. Com o código de um item sem preço oficial, aparece "Nenhum item à venda com o código…", e nada é adicionado. Em nenhum caso a venda é enviada.

**CA-08 — Troca.** Dada uma troca, quando a pessoa digita o código exato de um item vendável e aperta Enter na busca dos itens novos, então o item entra como na Nova venda.

**CA-09 — Itens sem código.** Dado um negócio com 1 item com código e 12 sem, então o Catálogo mostra "Itens sem código (12)", que abre a lista filtrada. Num negócio sem nenhum código, ou com todos os itens com código, o link não aparece.

**CA-10 — Venda e relatório.** Dada uma venda com o item BR-015, então o detalhe da venda mostra "BR-015 · Brinco argola dourado M". No plano pago, a rentabilidade por item mostra a coluna "Código", inclusive no CSV e no PDF, e o item arquivado aparece com o código e "(arquivado)".

**CA-11 — Exportação.** Dado um negócio com itens com código, quando o Dono exporta os dados, então o `codigo` aparece nos itens do `dados.json` e do `itens.csv`.

**CA-12 — Permissões e suporte.** Dado um Colaborador sem *Catálogo: editar*, quando tenta gravar o código (inclusive pela ação direta), então o servidor recusa. Dado o Administrador em modo suporte, então ele vê o código, sem editar.

**CA-13 — Visual.** Dadas as telas da seção 5.3, em 390, 768 e 1440 px, claro e escuro, então o código aparece sem quebrar as linhas, não há rolagem horizontal, e o axe não aponta violações.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Normalização e validação do código: espaços nas pontas, maiúsculas, conjunto permitido, limite de 20 e vazio como nulo | Unitário | CA-01, CA-03, INV-002 |
| T02 | Item pelo código exato: exato com maiúsculas e minúsculas, parcial não encontra, item não vendável não encontra | Unitário | CA-07, INV-005 |
| T03 | Cadastro e edição com código, código em uso com o nome do item, gravação direta e concorrente recusada pelo banco, mesmo código em dois negócios | Integração | CA-01, CA-04, INV-001, INV-004 |
| T04 | Arquivar libera o código; reativar com o código em uso é recusado | Integração | CA-05, INV-006 |
| T05 | Busca do Catálogo e do Estoque pelo código, com o exato primeiro; filtro "sem código" e a contagem do link | Integração | CA-06, CA-09 |
| T06 | Itens vendáveis, detalhe da venda, rentabilidade por item e exportação com o código | Integração | CA-10, CA-11 |
| T07 | Tabela da rentabilidade com a coluna "Código" no CSV e no PDF | Unitário | CA-10 |
| T08 | Permissões: gravar exige *Catálogo: criar* ou *editar*; suporte só lê | Integração | CA-12 |
| T09 | Roteiro no navegador: cadastro, lista, busca, Enter na Nova venda (inclusive com a digitação rápida de um leitor), troca, detalhe da venda, relatório e itens sem código | Manual com captura | CA-01 a CA-12 |
| T10 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção com login, e axe | Manual com captura | CA-13 |
| T11 | Fluxo na homologação, com itens da loja de semijoias e, se a equipe tiver, um leitor de código de barras com etiqueta própria | Manual (uma vez) | CA-01 a CA-10 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 30/10/2026, em entrevista:

| ID | Decisão |
|---|---|
| **OPEN-001** — O código é obrigatório? | **Opcional, com a lista dos itens sem código** (recomendada): os itens que já existem continuam funcionando sem código, e o link "Itens sem código" ajuda a preencher aos poucos. Descartadas: opcional sem a lista; obrigatório nos itens novos e editados; obrigatório por uma opção do negócio. |
| **OPEN-002** — Digitado ou gerado? | **Digitado pelo negócio, sem sugestão.** A equipe preferiu esta opção à recomendada ("livre, com o botão 'Usar BR-015', o próximo código da subcategoria"). O sistema só confere o formato e a repetição. Descartada também: código gerado pelo sistema em sequência, sem edição, que não aceitaria os códigos que a loja já usa. |
| **OPEN-003** — Formato e repetição | **Único entre os itens ativos** (recomendada): até 20 caracteres (letras sem acento, números, hífen, ponto, barra e sublinhado, sem espaço), guardado em maiúsculas; o item arquivado libera o código, como o nome. Cabe no "código do produto" da NF-e (até 60). Descartadas: único para sempre, sem reaproveitar o código de um item arquivado; sem conferir repetição. |
| **OPEN-004** — Serviços também? | **Produtos e serviços** (recomendada): o código é do negócio e serve para achar o item (ex.: "MAN-01" para a manicure). Na futura nota fiscal de produtos, só o código dos produtos é usado. Descartado: só produtos físicos. |
| **OPEN-005** — Onde aparece | **Catálogo, Estoque, Nova venda e troca, mais o detalhe da venda e a rentabilidade por item.** É a opção recomendada (listas, detalhes, busca nas três telas, Enter com o código exato e exportação) com o acréscimo, escolhido pela equipe, do relatório de rentabilidade (tela, CSV e PDF) e do detalhe da venda. Descartadas: sem o Enter; só no Catálogo e no Estoque. |
| **OPEN-006** — Código de barras oficial (GTIN) | **Depois, com a Spec da nota fiscal** (recomendada): o GTIN é registrado na GS1 por quem define o produto, e a nota fiscal o confere; muitas peças de semijoia não têm. Enquanto isso, um leitor de código de barras já lê o código interno impresso numa etiqueta (5.4). Descartadas: campo GTIN próprio nesta Spec; guardar o GTIN no próprio campo do código interno, o que misturaria os dois códigos que a nota pede separados. |

**Decisões derivadas do pedido e da baseline (sem questão nova):**
- o código é **guardado em maiúsculas**, para a busca, a unicidade e o leitor não dependerem de como foi digitado;
- o link "Itens sem código" só aparece para quem **já usa** códigos, para não lembrar quem não usa;
- o código mostrado nas vendas e nos relatórios é o **atual** do item, como o nome;
- o item com o **código exato** aparece primeiro nas buscas;
- o Enter **nunca envia a venda**: só adiciona o item com o código exato;
- com a SPEC-019, a correção "Editar item" do suporte inclui o código.

---

## 14. Definition of Done da Spec

A SPEC-024 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-13) estiverem implementados — por testes e no navegador (build local, 30/10/2026);
- [x] todos os invariantes (INV-001 a INV-006) estiverem preservados — testes T01 a T08 e o roteiro;
- [ ] os testes derivados (T01 a T11) estiverem aprovados, com o CI verde no PR — T01 a T10 aprovados; falta a homologação (T11);
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF06, RNF10) tiverem sido verificados como descrito na seção 10 — capturas em 390, 768 e 1440 px nos dois temas, axe, isolamento (T03, T05) e exportação (T06);
- [x] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas (30/10/2026), com o RF87 e a RN40 incluídos na baseline;
- [x] não existir divergência conhecida entre a implementação e esta Spec — as decisões de implementação (seção 9) não mudam o comportamento;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos — a observação da SPEC-006, encontrada no roteiro, está no Mapa.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
