# SPEC-021 — NCM nos produtos

> **Status:** 🟢 **Aprovada em 21/10/2026.** As questões em aberto foram decididas pela equipe em entrevista (seção 13):
> - OPEN-001 e OPEN-002 pela opção recomendada (tabela oficial no sistema; código que sai da tabela fica no item, com aviso);
> - OPEN-003 com a lista de produtos **"Sem NCM"**, além do item e da busca;
> - OPEN-004 com a **sugestão pela subcategoria**, mais um complemento: ao lado da sugestão fica um aviso explícito de que ela pode estar errada e de que a responsabilidade pelo NCM correto é do próprio negócio.
>
> **Revisão de 21/10/2026, antes da implementação:** por recomendação da profissional da área contábil que revisa o sistema, o NCM passa a poder ser **obrigatório**:
> - **OPEN-005** (recomendada): a obrigatoriedade vale para quem liga a opção **"Emito nota fiscal de produtos"** nos Dados do negócio;
> - **OPEN-006**: com a opção ligada, a **venda de produto físico sem NCM é bloqueada**, como a de produto sem preço (RN23).
>
> A baseline foi ajustada: RF08 alterado, RF80, RN34 e RN35 novos. **Implementada em 21/10/2026** e verificada em build local: testes T01–T12 automatizados e o roteiro T13 no navegador, com 74 verificações ([evidências](evidencias/SPEC-021/README.md)). As notas da implementação, com cinco divergências registradas para a decisão da equipe, estão depois da seção 9. Falta a homologação (T14), depois do merge e da carga da tabela. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir da revisão de uma profissional da área financeira e contábil que está montando uma loja de semijoias (19/10/2026).
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-006](SPEC-006.md) (cadastro, lista, busca e detalhe do item), [SPEC-007](SPEC-007.md) (busca do estoque), [SPEC-004](SPEC-004.md) (Dados do negócio: opção de nota fiscal de produtos), [SPEC-008](SPEC-008.md) (venda de produto sem NCM, também na troca da SPEC-011) e [SPEC-014](SPEC-014.md) (exportação).
> - **Usa:** [SPEC-001](SPEC-001.md) (isolamento e datas), [SPEC-003](SPEC-003.md) (modelo de carga do arquivo fiscal), [SPEC-005](SPEC-005.md) (permissões), [SPEC-016](SPEC-016.md) (componentes), [SPEC-018](SPEC-018.md) (modo suporte) e [SPEC-020](SPEC-020.md) (subcategorias, filtros e "voltar").

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-021 |
| **Nome** | NCM nos produtos |
| **Objetivo** | Permitir que o negócio informe o **NCM** (Nomenclatura Comum do Mercosul) de cada produto físico, conferido na **tabela oficial vigente**, com busca por código ou por palavras, para deixar o catálogo pronto para a emissão de nota fiscal, que continua pós-MVP. Para quem emite nota fiscal de produtos, o NCM é **obrigatório** e nenhum produto sem ele é vendido. |
| **Valor entregue** | O dono encontra o código sem decorar a tabela ("bijuteria" → 7117.19.00), vê quais produtos ainda estão sem NCM e preenche os parecidos com um toque, pela sugestão da subcategoria. Quem emite nota liga uma opção e passa a ter a garantia de que todo produto vendido tem NCM. Quando a tabela oficial mudar, o sistema avisa quais produtos precisam de revisão. |

### O que é o NCM

O NCM é um código de **8 dígitos** que classifica o **tipo de mercadoria**. A tabela é comum a Brasil, Argentina, Paraguai e Uruguai e se baseia no Sistema Harmonizado (SH) internacional. O código vai do geral ao específico, por exemplo:

| Nível | Código | Descrição |
|---|---|---|
| Capítulo | 71 | Pérolas naturais ou cultivadas, pedras preciosas ou semipreciosas e semelhantes, metais preciosos… bijuterias |
| Posição | 71.17 | Bijuterias |
| Subposição | 7117.1 / 7117.19 | De metais comuns, mesmo prateados, dourados ou platinados / Outras |
| Item (8 dígitos) | **7117.19.00** | o código que vai no produto |

- O NCM classifica o **tipo**, não o produto. Produtos diferentes do mesmo tipo têm o **mesmo NCM**. Cada produto tem um NCM só.
- É obrigatório nas notas fiscais de mercadoria (NF-e e NFC-e): a nota sem NCM é recusada. Ele também define alguns tributos, como o IPI. Neste sistema, por enquanto, ele **só é guardado**: não entra em nenhum cálculo (RN34).
- Nem todo negócio emite nota de produto. O MEI, por exemplo, é dispensado de emitir nota para consumidor pessoa física, e um salão usa produtos físicos (algodão, acetona) só como insumos dos serviços. Por isso a obrigatoriedade é uma opção do negócio (OPEN-005).
- **Quem classifica é o negócio**, normalmente com o contador. O sistema ajuda a encontrar o código e confere se ele existe, mas não decide qual é o certo. Para semijoias, por exemplo, a tabela tem 7113.20.00 ("De metais comuns folheados ou chapeados de metais preciosos (plaquê)") e 7117.19.00 (bijuterias de metais comuns, "Outras"); a escolha depende de como a peça é feita.
- **Serviços não têm NCM.** Nota fiscal de serviço usa outros códigos, fora desta Spec.

### Exemplo que originou a Spec

A loja de semijoias vai emitir nota fiscal no futuro e precisa do NCM de cada peça.
- **Hoje:** não há onde guardar o código. A loja teria de manter uma planilha à parte e procurar cada código no site do governo.
- **Com esta Spec:**
  - no cadastro do "Brinco argola dourado", a loja busca "bijuteria" e escolhe o código indicado pelo contador, por exemplo 7117.19.00;
  - ao cadastrar o próximo brinco na subcategoria Brincos, aparece o botão "Usar 7117.19.00, o NCM de 1 item de Brincos", com o aviso de que a sugestão pode estar errada;
  - no Catálogo, o link "Produtos sem NCM" mostra o que falta preencher;
  - como a loja vai emitir nota, o Dono liga "Emito nota fiscal de produtos" nos Dados do negócio. A partir daí, todo produto cadastrado ou editado precisa de NCM, e a Nova venda não aceita produto sem NCM.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF08** | **Alterado:** o cadastro de Produto Físico ganha o campo **NCM**, opcional ou obrigatório conforme a opção de nota fiscal do negócio. |
| | **RF80** (novo) | NCM nos produtos físicos: código de 8 dígitos da tabela oficial vigente, com busca por código ou por palavras, aviso quando o código sai da tabela, lista de produtos sem NCM e sugestão pela subcategoria, sempre confirmada pelo dono. É obrigatório quando o negócio liga "Emito nota fiscal de produtos". |
| | RF09 | Mantido: serviços não têm NCM. |
| | RF79 | Usado: a sugestão vem dos outros itens da mesma subcategoria. |
| **RN** | **RN34** (nova) | O NCM é informado e conferido pelo negócio. O sistema só confere que o código existe na tabela vigente e sugere, mas nunca preenche sem a confirmação do dono. O NCM não altera preço, margem, custo, estoque nem impostos calculados. |
| | **RN35** (nova) | Com a opção "Emito nota fiscal de produtos" ligada, o NCM é obrigatório no cadastro e na edição de produto físico, e produto físico sem NCM não pode ser vendido. |
| | RN23 | Mesmo padrão: assim como o item sem preço, o produto sem NCM (com a opção ligada) não entra na venda. |
| | RN33 | Mantida: a sugestão pela subcategoria é só uma sugestão; a subcategoria continua sem efeito fiscal. |
| | RN17 | Mesmo princípio: a tabela NCM é dado oficial versionado, com fonte e vigência, carregado de arquivo e não escrito no código. |
| **RNF** | RNF01 | Campo, gaveta de busca, avisos e lista "Sem NCM" em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | O NCM do item segue o isolamento do item. A tabela NCM é global, sem dados de negócio. |
| | RNF04 | O NCM entra na exportação dos itens. |
| | RNF10 | Prepara a integração de nota fiscal sem mudar o núcleo. |
| **Caso de uso / fluxo** | Cadastro e edição de item (SPEC-006); listas do Catálogo e do Estoque; Dados do negócio (SPEC-004); Nova venda e troca (SPEC-008, SPEC-011); carga de dados oficiais (SPEC-003) | Ver seção 5. |
| **Entidades** | `Item` (campo novo), `Negocio` (campo novo), `Ncm` (nova, global) | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor), ADR-004 (dados fiscais versionados e carregados) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Tabela NCM oficial no sistema** (OPEN-001):
   - arquivo versionado no repositório, a partir do JSON oficial do Classif (Portal Único Siscomex);
   - carregado no banco por um comando de carga, no workflow Migrações, como os parâmetros fiscais (ADR-004);
   - cada código tem descrição, vigência e o ato legal de origem.
2. **Campo "NCM"** no cadastro e na edição de **produto físico**, inclusive os materiais, opcional ou obrigatório conforme o item 6:
   - o dono digita o código de 8 dígitos ou busca por código parcial ou por palavras numa gaveta;
   - o sistema confere que o código existe na tabela vigente e mostra a descrição.
3. **Código que sai da tabela vigente** (OPEN-002): continua no item, com o aviso "NCM fora da tabela vigente — revise". Editar outros campos continua permitido; só um NCM novo ou trocado precisa estar vigente.
4. **Onde o NCM aparece** (OPEN-003):
   - no detalhe do item;
   - na busca por texto do Catálogo e do Estoque, que passa a encontrar também pelo código (ex.: "7117");
   - no link **"Produtos sem NCM"** do Catálogo, que vira um aviso no topo quando a opção de nota fiscal está ligada;
   - no aviso de produtos com NCM fora da tabela vigente;
   - na exportação.
5. **Sugestão pela subcategoria** (OPEN-004): quando outros itens da mesma subcategoria já têm NCM, aparece o botão "Usar 7117.19.00, o NCM de 3 itens de Brincos". Junto dele, um **aviso explícito de responsabilidade**. O código só é preenchido com o toque do dono.
6. **Opção "Emito nota fiscal de produtos (NF-e ou NFC-e)"** nos Dados do negócio (OPEN-005):
   - só o Dono altera; nasce desligada;
   - **ligada:** o NCM é obrigatório em todo produto físico cadastrado ou editado;
   - **desligada:** o NCM é opcional.
7. **Venda de produto sem NCM** (OPEN-006): com a opção ligada, produto físico sem NCM **não entra na venda**, como o item sem preço (RN23). Vale na Nova venda e nos itens novos de uma troca (SPEC-011). Os produtos já cadastrados sem NCM continuam no catálogo e recebem o código na próxima edição.
8. **Permissões:** gravar o NCM segue as do item (*Catálogo: criar* no cadastro, *Catálogo: editar* na edição). Ver o NCM e a lista "Sem NCM" exige *Catálogo: ver*. A opção de nota fiscal é do Dono. Tudo é conferido no servidor.
9. **Modo suporte (SPEC-018):** vê o NCM, os avisos e a lista "Sem NCM", sem escrever.
10. **Exportação (SPEC-014):** os itens exportados trazem o NCM, e o negócio traz a opção de nota fiscal.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Emissão de nota fiscal | Pós-MVP (Visão de Negócio, 8.2). Esta Spec só guarda o código. |
| Outros campos da nota fiscal de mercadoria: CEST, origem da mercadoria, CFOP, GTIN/código de barras, unidade tributável, EX da TIPI | Fora: entram com a Spec da nota fiscal. |
| Código de serviço (lista da LC 116/2003, NBS) | Fora: serviços não têm NCM. |
| Classificação automática (pelo nome do produto, por IA ou por regra) | Fora: a classificação é do negócio (RN34). O sistema só busca, confere e sugere a partir dos itens do próprio negócio. |
| Cálculo de tributo a partir do NCM (IPI, ICMS-ST, PIS/COFINS monofásico) | Fora: o NCM não entra na precificação nem no imposto (RN34). |
| Aplicar o mesmo NCM a vários produtos de uma vez | Fora (OPEN-004). |
| Bloquear a venda de produto com NCM **fora da tabela vigente** | Fora: a venda fica bloqueada só **sem** NCM (OPEN-006). Com o código fora da tabela, o produto continua vendável, com o aviso de revisão (OPEN-002). Assim, uma atualização da tabela (ex.: SH 2028) não trava o caixa de um dia para o outro. |
| NCM obrigatório só para alguns produtos (ex.: só os que têm preço de venda) | Fora: com a opção ligada, vale para todo produto físico, inclusive os materiais (OPEN-005). |
| Atualização automática da tabela (download periódico do Siscomex) | Fora: a tabela é atualizada por PR, como o arquivo fiscal (ADR-004). |
| Mostrar o código NCM na Nova venda, nos Relatórios e na linha da lista | Fora: o código aparece no detalhe e entra na busca. A Nova venda só avisa quantos produtos estão fora da venda por falta de NCM (5.6). |
| Tela de consulta da tabela NCM fora do cadastro | Fora: a busca fica na gaveta do campo. |

---

## 4. Dependências

- **Specs:**
  - SPEC-006: cadastro, edição, lista, busca e detalhe do item; arquivamento;
  - SPEC-007: lista e busca do estoque;
  - SPEC-020: subcategorias (sugestão), filtros e o "voltar" para a lista de origem;
  - SPEC-004: Dados do negócio, editados só pelo Dono (onde fica a opção de nota fiscal);
  - SPEC-008 e SPEC-011: registro de venda e troca, com a recusa de item não vendável (RN23);
  - SPEC-003: modelo do arquivo oficial e do comando de carga (`fiscal:validar`, `fiscal:carregar`) no CI e no workflow Migrações;
  - SPEC-005: matriz módulo × ação;
  - SPEC-001: isolamento, `modelos.ts`, RLS e o utilitário de datas (RN29, para "vigente hoje");
  - SPEC-014: exportação;
  - SPEC-016: gaveta, aviso da página, campos e estados vazios;
  - SPEC-018: contexto de suporte só leitura.
- **Decisões arquiteturais:**
  - ADR-002: o NCM do item segue o `negocioId` do item; a tabela é global, com RLS ligado;
  - ADR-003: autorização no servidor;
  - ADR-004: dado oficial em arquivo versionado, carregado no workflow Migrações.
- **Pré-requisitos externos:**
  - o **arquivo JSON oficial da tabela NCM**, do Classif (Portal Único Siscomex). O domínio `portalunico.siscomex.gov.br` foi liberado na rede do ambiente de desenvolvimento em 21/10/2026;
  - o arquivo foi baixado e conferido no mesmo dia:
    - "Vigente em 21/10/2026", ato mais recente: Resolução Gecex nº 926/2026;
    - 15.157 linhas, das quais **10.516 códigos de 8 dígitos**;
    - cada linha traz `Codigo` (formatado, ex.: "7117.19.00"), `Descricao` (com traços que indicam o nível), `Data_Inicio`, `Data_Fim` (31/12/9999 em todas) e o ato de origem;
  - o arquivo entra no repositório com a implementação.

---

## 5. Comportamento esperado

### 5.1 Tabela NCM e atualização

1. **Fonte:** a tabela NCM em vigor, publicada no Classif (Portal Único Siscomex), em JSON. Base legal: Resolução Gecex nº 272/2021 (NCM adaptada ao SH 2022) e alterações posteriores; a mais recente em 21/10/2026 é a Resolução Gecex nº 926/2026. O arquivo fica no repositório sem edição manual, com a data da última atualização da tabela e o ato correspondente.
   - O arquivo traz só os códigos **vigentes**: todos têm data de fim 31/12/9999, que a carga grava como "sem fim". Por isso a data de fim de um código sai da regra do item 3, e não do arquivo.
2. **Carga:** um comando no modelo do `fiscal:carregar` (SPEC-003):
   - **valida** o arquivo no CI, sem banco;
   - **carrega** no workflow Migrações, depois das migrações;
   - grava só os códigos de **8 dígitos**, com a descrição do próprio nível e o **caminho**, que são as descrições dos níveis acima (capítulo, posição, subposição);
   - guarda a vigência (início e fim) e o ato legal;
   - grava um **texto de busca** sem acentos e em minúsculas, com o código, a descrição e o caminho.
3. **Atualização:** quando a Receita publicar mudanças, a equipe troca o arquivo por PR e a carga roda no próximo workflow Migrações.
   - Exemplos de mudança: uma resolução nova ou a edição **SH 2028**, que entra em vigor em 01/01/2028.
   - A carga **não apaga** códigos: um código que não está mais no arquivo recebe como data de fim o dia anterior à atualização da tabela.
   - A carga **não muda nenhum item**.
4. **Vigente:** um código é vigente quando a data de hoje (fuso de São Paulo, RN29) está entre o início e o fim da vigência dele. Códigos com início futuro, publicados com antecedência, não aparecem na busca até entrarem em vigor.

### 5.2 Campo NCM no cadastro e na edição

1. O formulário de **produto físico** tem o campo **NCM**, depois de "Unidade de medida". O formulário de serviço não tem o campo.
   - Com a opção de nota fiscal **desligada**, o rótulo é "NCM (opcional)"; **ligada**, é "NCM", obrigatório (5.6).
   - Texto de ajuda: "Código da mercadoria na nota fiscal, com 8 dígitos. Busque pelo código ou por palavras. A classificação correta é responsabilidade do negócio; na dúvida, confirme com o seu contador."
2. **Digitar o código:** o campo aceita 8 dígitos e mostra no formato 0000.00.00. Ao completar os 8 dígitos, o sistema confere na tabela:
   - código vigente → mostra a descrição abaixo do campo (ex.: "Bijuterias › De metais comuns… › Outras");
   - código inexistente ou não vigente → "Código não encontrado na tabela NCM vigente.".
3. **Buscar:** o botão **"Buscar NCM"** abre uma gaveta (SPEC-016) com o campo "Código ou palavras".
   - **Palavras:** com 3 letras ou mais, procura em todas as palavras, sem diferenciar maiúsculas e acentos (ex.: "bijut" encontra "Bijuterias").
   - **Código parcial:** com 2 dígitos ou mais, com ou sem pontos, procura pelo começo do código (ex.: "7117" ou "71.17").
   - **Resultados:** até 20 códigos vigentes, em ordem de código, cada um com o código formatado e a descrição com o caminho. Mais de 20 → "Mostrando os 20 primeiros. Refine a busca."
   - Tocar num resultado preenche o campo e fecha a gaveta.
   - Rodapé: "Tabela NCM oficial (Siscomex), atualizada em dd/mm/aaaa. Confira a classificação com o seu contador."
4. **Limpar:** com a opção desligada, o dono pode deixar o campo vazio a qualquer momento, e o produto fica sem NCM. Com a opção ligada, o campo vazio impede salvar (5.6).
5. **Ao salvar**, o servidor confere o NCM (5.7).
6. **Trocar o tipo:** no cadastro, ao trocar para Serviço ("Trocar o tipo"), o campo some e o valor digitado é descartado. Na edição, o tipo não muda (SPEC-006).

### 5.3 Sugestão pela subcategoria

1. **Quando aparece:** no cadastro e na edição de produto físico, quando o item tem uma subcategoria e **outros itens ativos do negócio** nessa subcategoria têm NCM vigente. Abaixo do campo aparece o botão:
   - **"Usar 7117.19.00, o NCM de 3 itens de Brincos"**;
   - o código é o **mais usado** entre esses itens (no empate, o menor código), e o número conta os itens que usam esse código.
2. **Aviso obrigatório**, visível junto do botão, e não escondido numa dica:
   > "Isto é só uma sugestão e pode estar errada. Confira o código certo: a responsabilidade pelo NCM cadastrado é do próprio negócio."
3. **Tocar no botão** preenche o campo com o código, mostra a descrição e esconde o botão. O dono pode trocar o código ou limpar o campo.
4. **Quando não aparece:**
   - item sem subcategoria;
   - primeiro item da subcategoria;
   - nenhum outro item da subcategoria com NCM vigente;
   - o campo já tem o código sugerido;
   - serviço.

   Nesses casos, o dono busca o código normalmente (5.2).
5. **Troca de subcategoria** no formulário: a sugestão passa a ser a da nova subcategoria, ou some.
6. **Nada é preenchido sozinho:** nem ao abrir o formulário, nem ao escolher a subcategoria, nem na carga da tabela (RN34).
7. Só contam itens do **mesmo negócio** (RNF02), da mesma subcategoria, ativos, de produto físico e diferentes do item que está sendo editado.

### 5.4 Detalhe do item e código fora da tabela vigente

1. **Detalhe do item (Catálogo):**
   - nova linha **"NCM"** em "Dados do item", com o código formatado e a descrição curta (ex.: "7117.19.00 — Bijuterias de metais comuns: outras");
   - "—" quando não houver;
   - em serviço, a linha não aparece.
2. **Código fora da tabela vigente** (OPEN-002), por exemplo depois de uma atualização da tabela:
   - o detalhe mostra o código com o aviso **"NCM fora da tabela vigente — revise o código."**;
   - na edição, o mesmo aviso aparece junto do campo;
   - salvar sem mexer no NCM continua permitido e mantém o código antigo;
   - para trocar o código, o novo precisa estar vigente;
   - limpar o campo é permitido só com a opção de nota fiscal desligada (5.6).
3. **Itens arquivados** mantêm o NCM. Ao reativar um item com código fora da tabela, o aviso aparece normalmente.

### 5.5 Catálogo e Estoque: busca, "Sem NCM" e aviso de revisão

1. **Busca por texto:** além do nome e da subcategoria (SPEC-020), quando o texto tem só dígitos, com ou sem pontos e espaços, e pelo menos 2 dígitos, também encontra os itens cujo NCM **começa** com esses dígitos. Por exemplo, "7117" e "7117.19" encontram os produtos 7117.19.00. Vale no Catálogo e no Estoque.
2. **Produtos sem NCM** (OPEN-003):
   - com a opção de nota fiscal **desligada**: no rodapé da lista do Catálogo, ao lado de "Ver itens arquivados", aparece o link **"Produtos sem NCM (12)"**, quando há produto físico ativo sem NCM;
   - com a opção **ligada**: no lugar do link, o topo do Catálogo mostra o aviso **"12 produtos sem NCM não podem ser vendidos. Completar"**, porque eles estão fora da venda (5.6);
   - o link, ou o "Completar" do aviso, abre a lista só com os produtos físicos ativos sem NCM. Os filtros de categoria, subcategoria e busca continuam valendo;
   - no topo, um aviso diz "Mostrando produtos sem NCM." e oferece "Ver todos os itens";
   - abrir um produto dessa lista e voltar leva de volta a ela, pelo "voltar" da SPEC-020.
3. **NCM a revisar:** quando há produto físico ativo com NCM fora da tabela vigente, o topo do Catálogo mostra o aviso **"3 produtos têm NCM fora da tabela vigente. Ver quais"**. O link abre a lista só com esses produtos, no mesmo formato do item 2.
4. **Linha da lista:** sem mudança; o NCM não aparece na linha.
5. **Estoque:** só a busca muda (item 1). O link e o aviso ficam só no Catálogo.

### 5.6 Opção "Emito nota fiscal de produtos" e venda sem NCM

1. **Onde fica:** em Dados do negócio (SPEC-004), a opção **"Emito nota fiscal de produtos (NF-e ou NFC-e)"**, com o texto: "Ligada, o NCM passa a ser obrigatório nos produtos físicos, e produto sem NCM não pode ser vendido." Só o Dono altera (OPEN-005). Nasce **desligada**, inclusive nos negócios que já existem.
2. **Ligar com produtos sem NCM:** se há produto físico ativo sem NCM, um diálogo de confirmação (SPEC-016) avisa antes de ligar:
   - "12 produtos físicos estão sem NCM. Com a opção ligada, eles não poderão ser vendidos até receberem o código.";
   - botões "Ligar mesmo assim" e "Voltar", e o link "Ver produtos sem NCM".
3. **Com a opção ligada** (OPEN-005 e OPEN-006):
   - o NCM é **obrigatório** ao cadastrar e ao editar qualquer produto físico, inclusive os materiais. Um produto já cadastrado sem NCM só salva a edição depois de receber o código;
   - um código **fora da tabela vigente** já gravado continua aceito na edição (OPEN-002) e **não** bloqueia a venda, só mostra o aviso de revisão;
   - a **Nova venda não lista** produto físico sem NCM, como já não lista item sem preço (RN23). Se houver algum, a tela mostra a nota "3 produtos estão fora da venda por falta de NCM." e, para quem tem *Catálogo: editar*, o link "Completar no Catálogo";
   - o **servidor recusa** a venda que tenha produto físico sem NCM, mesmo chamada direto (`ItemNaoVendavel`, motivo "sem NCM": "Brinco argola dourado está sem NCM. Cadastre o NCM para vender."). A regra vale também para os itens novos de uma **troca** (SPEC-011);
   - os **materiais** baixados pelos serviços não entram nessa conferência: eles não são vendidos, só consumidos;
   - **serviços** continuam sem NCM e vendáveis.
4. **Desligar:** o NCM volta a ser opcional e os produtos sem NCM voltam à venda. Nenhum NCM é apagado.
5. A opção vale **no momento da venda**: o servidor confere o estado atual do negócio ao gravar, e não o que estava na tela.

### 5.7 Validação e gravação no servidor

| Regra | Comportamento |
|---|---|
| Formato | Se informado, o NCM vira 8 dígitos (pontos, traços e espaços são retirados). Fora disso → `NcmInvalido` ("Informe os 8 dígitos do NCM."). Vazio → item sem NCM, se a opção de nota fiscal estiver desligada. |
| Obrigatoriedade | Com a opção de nota fiscal ligada, produto físico sem NCM → `NcmObrigatorio` ("Informe o NCM: o negócio emite nota fiscal de produtos."), no cadastro e na edição. |
| Venda | Com a opção ligada, linha de produto físico sem NCM → `ItemNaoVendavel` (motivo "sem NCM"), na venda e na troca. NCM fora da tabela vigente não bloqueia. |
| Opção de nota fiscal | Só o Dono altera; os outros papéis → `SemPermissao`; o modo suporte não altera. |
| Tabela vigente | Um NCM **novo ou trocado** precisa existir e estar vigente hoje, senão `NcmForaDaTabela` ("Código não encontrado na tabela NCM vigente."). Um NCM **igual ao gravado** é aceito mesmo fora da tabela (OPEN-002). |
| Tipo do item | Só produto físico tem NCM. Serviço com NCM informado → `CampoInvalido`. O banco também garante essa regra. |
| Sugestão | É calculada no servidor, só com itens do negócio, e não grava nada. O NCM que chega na gravação é conferido como qualquer outro. |
| Permissões | Gravar segue o cadastro (*criar*) e a edição (*editar*) do item. Buscar e conferir na tabela exigem *Catálogo: criar* ou *editar*. Sem a permissão → `SemPermissao`. No modo suporte, toda escrita é recusada. |
| Busca na tabela | Texto curto demais (menos de 3 letras ou 2 dígitos) → `CampoInvalido`, sem consulta. |

### 5.8 Modo suporte, exportação e planos

- **Modo suporte (SPEC-018):** com o Catálogo liberado, o suporte vê:
  - a linha NCM no detalhe;
  - o aviso de revisão;
  - o link e a lista "Sem NCM";
  - a busca pelo código.

  Não tem edição nem a gaveta de busca. O NCM não é dado pessoal e não é mascarado. A opção de nota fiscal fica em Dados do negócio, que o suporte não abre.
- **Exportação (SPEC-014):** os itens exportados ganham a coluna `ncm`, e o negócio, a opção de nota fiscal, nos arquivos JSON e CSV. A tabela NCM não entra: é dado público de referência, e não dado do titular.
- **Exclusão de conta (SPEC-014):** nada a anonimizar.
- **Planos (SPEC-013):** disponível nos dois planos. Não é uma das funcionalidades limitadas do gratuito (RN18).

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Só produto físico tem NCM, e o NCM gravado tem sempre 8 dígitos. | Teste unitário da validação; restrições `CHECK` no banco, com teste de integração gravando direto. |
| **INV-002** | Um NCM novo ou trocado só é gravado se estiver vigente na data. O NCM igual ao já gravado é mantido mesmo fora da tabela (OPEN-002). | Teste de integração com código vigente, inexistente, encerrado e com início futuro, no cadastro e na edição. |
| **INV-003** | O NCM nunca é preenchido sem uma ação do dono: a sugestão não grava, e a carga da tabela não muda itens (RN34). | Teste de integração: carga antes e depois com os itens iguais; ação de salvar sem NCM continua sem NCM. |
| **INV-004** | O NCM não altera preço, margem, custo, estoque, vendas nem o cálculo da Calculadora (RN34). | Teste de integração: mesmo item com e sem NCM, mesma sugestão de preço e mesmos valores. |
| **INV-005** | `Ncm` é global, sem `negocioId`, com RLS ligado e classificada em `modelos.ts`. A sugestão e as contagens usam só itens do negócio. | `test/unit/modelos.test.ts` (INV-006 da SPEC-001), teste de RLS (INV-011 da SPEC-001) e teste de isolamento da sugestão com dois negócios. |
| **INV-006** | A carga é idempotente e não apaga códigos: rodar duas vezes com o mesmo arquivo não muda nada; um código fora do arquivo novo recebe data de fim. | Teste da carga com dois arquivos de exemplo. |
| **INV-007** | Gravar NCM exige a permissão do item; buscar e conferir na tabela exigem *criar* ou *editar*; o modo suporte nunca escreve. | Teste chamando as ações direto com cada papel e no contexto de suporte. |
| **INV-008** | A migração não muda nenhum item existente: todos ficam sem NCM. A opção de nota fiscal nasce desligada em todos os negócios. | Teste de integração e conferência na homologação. |
| **INV-009** | Com a opção de nota fiscal ligada, nenhuma venda nem troca gravada tem produto físico sem NCM, e nenhum produto físico é cadastrado ou editado sem NCM. | Teste de integração chamando o registro de venda, a troca e a gravação do item direto, com a opção ligada e desligada. |
| **INV-010** | Só o Dono liga e desliga a opção; o modo suporte não a altera. Desligar não apaga nenhum NCM. | Teste chamando a ação com cada papel e no contexto de suporte. |

---

## 7. Modelo de domínio envolvido

| Entidade | Mudança |
|---|---|
| `Item` | Novo campo opcional `ncm` (texto de 8 dígitos, sem pontos). `CHECK` do formato e `CHECK` de que só produto físico tem NCM. Não é chave estrangeira: o código fica no item mesmo depois de sair da tabela (OPEN-002). Itens existentes ficam com o campo nulo. |
| `Negocio` | Novo campo `emiteNotaDeProduto` (booleano, padrão falso): a opção "Emito nota fiscal de produtos" (OPEN-005). |
| `Ncm` (nova, **global**) | `codigo` (8 dígitos), `descricao` (do próprio nível), `caminho` (descrições dos níveis acima), `textoBusca` (normalizado), `vigenteDesde`, `vigenteAte` (nulo = sem fim), `ato` (tipo, número e ano). Restrição única `(codigo, vigenteDesde)`; índice para a busca por começo do código. RLS ligado, sem políticas; o acesso é só pelo servidor, como as tabelas fiscais. |

**Contagens e filtros:**
- "Sem NCM" = produto físico ativo com `ncm` nulo;
- "Fora da tabela vigente" = produto físico ativo com `ncm` sem registro vigente hoje em `Ncm`.

**Documentos de modelo a atualizar na implementação:**
- `MODELO_DOMINIO_E_JORNADAS.md`: atributo NCM do Produto Físico, a opção de nota fiscal do Negócio e a tabela de referência;
- `MODELO_LOGICO_BANCO.md`: colunas `ITEM.ncm` e `NEGOCIO.emite_nota_de_produto` e tabela `NCM`.

---

## 8. Impacto arquitetural

- **Banco:**
  - migração com a coluna `Item.ncm` (e os dois `CHECK`), a coluna `Negocio.emiteNotaDeProduto` (padrão falso) e a tabela global `Ncm`, com RLS e os índices;
  - classificação de `Ncm` como `global` em `src/lib/db/modelos.ts`.
- **Tabela oficial e carga:**
  - arquivo em `docs/prisma_base/` (JSON oficial do Classif, sem edição manual);
  - validação e leitura num módulo próprio, no modelo de `src/lib/fiscal/arquivo.ts`;
  - comando de carga, com validação sem banco no CI e carga no CI e no workflow Migrações (`.github/workflows/ci.yml` e `migracoes.yml`), ao lado do `fiscal:carregar`.
- **Domínio e validação:**
  - `src/lib/catalogo/validacao.ts`: `ncm` em `validarItem` (formato e tipo);
  - funções puras para normalizar, formatar (0000.00.00) e montar o texto de busca;
  - mensagens novas.
- **Dados:**
  - `src/lib/db/catalogo.ts`: conferência do NCM na tabela vigente ao gravar (só quando novo ou trocado); busca na tabela; sugestão por subcategoria; contagens e filtros "sem NCM" e "a revisar"; busca do Catálogo por começo do código;
  - `src/lib/db/estoque.ts`: busca por começo do código;
  - `src/lib/db/lgpd.ts`: nada a mudar se a exportação já levar todas as colunas do item (conferir).
  - `src/lib/db/vendas.ts`: com a opção ligada, `itensVendaveis` deixa de fora o produto físico sem NCM, e a preparação da venda (usada também na troca) recusa com `ItemNaoVendavel`, motivo "sem NCM";
  - Dados do negócio: leitura e gravação da opção, e a contagem de produtos sem NCM para o diálogo.
- **Ações:**
  - em `src/lib/catalogo/acoes.ts`, ações de **buscar** e **conferir** NCM, com *Catálogo: criar* ou *editar*, recusadas no contexto de suporte;
  - a obrigatoriedade lida do negócio na gravação do item, no servidor;
  - a ação de alterar a opção, só do Dono, junto das ações de Dados do negócio (SPEC-004).
- **Telas:**
  - campo, descrição, sugestão e aviso em `src/components/catalogo/formularios.tsx`;
  - gaveta de busca carregada sob demanda, como a de "Nova subcategoria";
  - linha NCM e aviso no detalhe;
  - link "Produtos sem NCM", avisos e filtro em `src/app/(app)/catalogo/page.tsx`;
  - a opção e o diálogo de confirmação em `src/app/(app)/negocio/dados/`;
  - a nota de produtos fora da venda na Nova venda.
- **Sem mudança:** Calculadora, Relatórios, Dashboard e Financeiro.
- **ADRs que restringem:** ADR-002, ADR-003 e ADR-004. Não é preciso ADR novo: a tabela NCM segue o padrão do ADR-004. A consulta online (BrasilAPI, ADR-006) foi descartada na OPEN-001.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Buscar NCM** | texto (palavras ou código parcial) | [{codigo, descricao, caminho}] (até 20, só vigentes), maisResultados, atualizadaEm | `CampoInvalido`, `SemPermissao` |
| **Conferir NCM** | codigo | {codigo, descricao, caminho, vigente} | `NcmInvalido`, `NaoEncontrado`, `SemPermissao` |
| **Sugestões de NCM** | (do negócio) | {subcategoriaId → {ncm, descricao, itens}}, ao abrir o formulário; na edição, sem contar o próprio item | — |
| **Salvar item** (estendido, SPEC-006) | + `ncm?` | item | os da SPEC-006 + `NcmInvalido`, `NcmForaDaTabela`, `NcmObrigatorio` (opção ligada), `CampoInvalido` (serviço com NCM) |
| **Listar catálogo** (estendido) | + `ncm?` ("sem" ou "revisar"); a busca inclui o começo do NCM | itens + {semNcm, foraDaTabela, emiteNotaDeProduto} (contagens dos produtos físicos ativos) | — |
| **Alterar a opção de nota fiscal** (novo, Dados do negócio) | emiteNotaDeProduto | {emiteNotaDeProduto, produtosSemNcm} | `SemPermissao` |
| **Itens vendáveis** (estendido, SPEC-008) | — | itens, sem os produtos físicos sem NCM quando a opção está ligada, + {foraPorFaltaDeNcm} | — |
| **Registrar venda / troca** (estendido, SPEC-008 e SPEC-011) | — | venda | os das SPECs + `ItemNaoVendavel` com motivo "sem NCM" |
| **Listar estoque** (estendido) | a busca inclui o começo do NCM | produtos | — |
| **Detalhar item** (estendido) | id | + {ncm, descricao, vigente} | os da SPEC-006 |
| **Carregar tabela NCM** (comando) | arquivo oficial | {inseridos, alterados, encerrados} | `ArquivoInvalido` |

**Implementação (21/10/2026):**

- **Banco:** migração `20261021180000_ncm`.
  - `Item.ncm` (`varchar(8)`) com os `CHECK` `Item_ncm_formato` (8 dígitos) e `Item_ncm_so_produto`.
  - `Negocio.emiteNotaDeProduto` (padrão falso).
  - Tabela global `Ncm`, com restrição única `(codigo, vigenteDesde)`, índice por código e os `CHECK` do código e da vigência.
  - Tabela global `TabelaNcm`, com uma linha só (`CHECK id = 1`): a data da atualização da tabela e o ato, que alimentam o rodapé da gaveta.
  - RLS ligado, sem políticas, nas duas tabelas; as duas classificadas como `global` em `src/lib/db/modelos.ts`.
- **Tabela oficial e carga:**
  - arquivo `docs/prisma_base/tabela_ncm.json`, sem edição;
  - leitura e validação em `src/lib/ncm/arquivo.ts`;
  - carga em `scripts/ncm/carga.ts` e `scripts/carregar-tabela-ncm.ts`, com os comandos `ncm:validar` e `ncm:carregar`;
  - no CI, a validação e duas cargas seguidas (a segunda precisa dizer "Nada a mudar"); no workflow Migrações, a carga depois das migrações.
- **Domínio e validação:**
  - `src/lib/dominio/ncm.ts`: ler, formatar, montar a descrição, o texto de busca e a vigência;
  - `src/lib/catalogo/validacao.ts`: `ncm` em `validarItem`, obrigatório quando o negócio emite nota, e as mensagens novas.
- **Dados:**
  - `src/lib/db/catalogo.ts`: conferência na tabela vigente ao gravar, busca, sugestões, contagens, filtros "sem" e "revisar", e a busca pelo começo do código, também usada pelo Estoque;
  - `src/lib/db/vendas.ts`: `itensVendaveis` sem os produtos sem NCM, `foraDaVendaPorFaltaDeNcm` e a recusa em `prepararVenda`, que a troca também usa;
  - `src/lib/db/negocios.ts`: leitura e gravação da opção.
- **Ações:**
  - `acaoBuscarNcm` e `acaoConferirNcm` em `src/lib/catalogo/acoes.ts`;
  - `acaoDefinirNotaFiscal` em `src/lib/negocio/acoes.ts`.
- **Telas:**
  - `src/components/catalogo/campo-ncm.tsx`: campo, conferência, descrição, sugestão e avisos;
  - `src/components/catalogo/busca-ncm.tsx`: a gaveta;
  - `src/components/negocio/nota-fiscal.tsx`: a opção e o diálogo;
  - `src/components/vendas/fora-por-ncm.tsx`: a nota da Nova venda e da troca;
  - linha NCM no detalhe, avisos, link e filtros no Catálogo.
- **Testes:** `test/unit/ncm.test.ts` e `test/integracao/ncm.test.ts`. Roteiro no navegador (T13) com 74 verificações ([evidências](evidencias/SPEC-021/README.md)).

**Decisões de implementação (dentro do que a Spec pede):**

- **Permissão de buscar e conferir:** como na SPEC-020, a guarda da Server Action exige *Catálogo: ver*, e o corpo confere *criar* ou *editar* antes de consultar a tabela. O teste T08 cobre os dois passos.
- **Sugestões calculadas ao abrir o formulário**, para todas as subcategorias de uma vez. Trocar a subcategoria no formulário troca a sugestão sem nova consulta (5.3, item 5).
- **Caminho no arquivo oficial:** a validação exige o capítulo de cada código, mas não a posição de 4 dígitos. Em 483 códigos, a posição não tem desdobramento e vem só no próprio código (ex.: 0205.00.00), sem uma linha de 4 dígitos à parte. O caminho usa os níveis que existem.
- **Carregamento sob demanda:** a gaveta "Buscar NCM" é baixada no primeiro toque, e o diálogo de ligar a opção, quando a caixa é marcada. Para isso, o hook `useConfirmacaoDoEnvio` foi para `src/components/ui/confirmacao-do-envio.ts`, sem o Radix; `confirmacao.tsx` o reexporta, e as outras telas não mudam. Sem isso, Dados do negócio subiria 18,8 KB; com isso, sobe 1,5 KB.
- **Formulário da nota fiscal enviado pela transição** (como o de subcategorias), e não por `<form action>`. O React reinicia o formulário depois da Server Action, e a caixa aparecia desmarcada com a opção já ligada (encontrado no T13).
- **Botão da sugestão em duas linhas no celular:** o texto leva o nome da subcategoria e não cabia na caixa a 390 px (encontrado no T13).

**Divergências registradas na implementação:** proposta (2), ajustar a baseline, em todas; a decisão é da equipe.

1. **Posição do campo (5.2, item 1):** o campo NCM fica **depois da Subcategoria**, e não logo depois de "Unidade de medida". No formulário, a unidade de medida divide a linha com a categoria, e a subcategoria vem em seguida; como a sugestão depende da subcategoria, o NCM logo abaixo dela deixa a relação visível.
2. **Descrição no detalhe (5.4, item 1):** o exemplo da Spec mostra "7117.19.00 — Bijuterias de metais comuns: outras". A tabela oficial não traz uma descrição curta: a do próprio nível costuma ser só "Outras". O detalhe mostra o código e, abaixo, a mesma descrição do campo e da gaveta, com o caminho sem o capítulo: "Bijuterias › De metais comuns, mesmo prateados, dourados ou platinados › Outras".
3. **Link "Ver produtos sem NCM" (5.6, item 2):** fica na seção Nota fiscal, ao lado da opção, e não dentro do diálogo. O diálogo de confirmação da SPEC-016 só tem o texto e os dois botões; o link continua visível antes de ligar.
4. **Texto de busca (5.1, item 2):** não inclui a descrição do **capítulo**. A do capítulo 71 cita "bijuterias", e "bijut" trazia o capítulo inteiro (pérolas, pedras e joalheria). O código, a descrição e os demais níveis do caminho continuam na busca. O caminho guardado mantém o capítulo.
5. **Tabela `TabelaNcm` (seção 7):** além de `Ncm`, uma tabela global de uma linha guarda a data da atualização e o ato do arquivo carregado. É de onde vem o "atualizada em dd/mm/aaaa" do rodapé da gaveta (5.2, item 3); o arquivo não tem essa data em cada código.

**Observação para a equipe (sem divergência):** a busca segue a ordem de código pedida na Spec (5.2, item 3, e CA-02). Com palavras, isso pode pôr na frente códigos que só citam a palavra. Por exemplo, "bijut" lista primeiro 7018.10.10 a 7018.90.00 (contas de vidro, "exceto bijuterias") e só depois 7117.11.00, 7117.19.00 e 7117.90.00. Uma melhoria possível, para depois: mostrar primeiro os códigos cuja própria descrição tem a palavra. Fica para a equipe decidir.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação | Verificação |
|---|---|---|
| RNF01 | Campo, gaveta de busca, sugestão com aviso, linha do detalhe, link e aviso do Catálogo em 390, 768 e 1440 px, claro e escuro, sem rolagem horizontal. A gaveta é baixada sob demanda, e as telas do item continuam dentro do orçamento de JavaScript da SPEC-016, seção 10. A busca responde em menos de 1 s com a tabela inteira carregada. | Capturas, axe-core, medição de JS e tempo da busca no build local. |
| RNF02 | O NCM do item segue o isolamento do item; a sugestão e as contagens só usam itens do negócio. A tabela `Ncm` não tem dados de negócio e não é acessível pela API pública do banco (RLS sem políticas). | INV-005, teste de isolamento e de RLS. |
| RNF04 | O NCM entra na exportação dos itens. | Teste de integração da exportação. |
| RNF10 | O código fica guardado no formato da nota fiscal (8 dígitos), pronto para a futura integração. | Revisão do modelo (seção 7). |

---

## 11. Critérios de aceitação

**CA-01 — Buscar por palavras.** Dado o Dono cadastrando um produto físico, quando abre "Buscar NCM" e digita "bijut", então vê códigos vigentes de bijuterias, entre eles 7117.19.00 com a descrição e o caminho. Ao tocar no resultado, o campo é preenchido, a descrição aparece e a gaveta fecha.

**CA-02 — Buscar por código parcial.** Dado o mesmo cadastro, quando busca "71.17", então vê os códigos vigentes que começam com 7117, em ordem de código, até 20.

**CA-03 — Digitar o código.** Dado o campo NCM, quando o Dono digita "71171900", então o campo mostra "7117.19.00" e a descrição. Com um código que não existe, aparece "Código não encontrado na tabela NCM vigente." e o item não é salvo com ele.

**CA-04 — Opcional e só em produto.** Dado um negócio com a opção de nota fiscal desligada e um produto físico sem NCM, quando o produto é salvo, então fica sem NCM. Dado um serviço, o formulário não tem o campo, e uma gravação direta com NCM é recusada.

**CA-05 — Sugestão pela subcategoria.** Dado três brincos ativos em Brincos com 7117.19.00, quando o Dono cadastra um novo produto em Acessórios › Brincos, então aparece "Usar 7117.19.00, o NCM de 3 itens de Brincos", **com o aviso de que a sugestão pode estar errada e de que a responsabilidade é do negócio**. O campo continua vazio até o toque no botão.

**CA-06 — Sem sugestão.** Dado o primeiro produto de uma subcategoria, um produto sem subcategoria ou uma subcategoria cujos itens não têm NCM, quando o Dono abre o cadastro, então não há botão de sugestão, e ele busca o código normalmente.

**CA-07 — Detalhe.** Dado um produto com NCM, quando o Dono abre o detalhe, então vê a linha "NCM" com o código formatado e a descrição. Sem NCM, a linha mostra "—". Em serviço, a linha não aparece.

**CA-08 — Código fora da tabela vigente.** Dado um produto com um NCM que deixou de estar vigente, quando o Dono abre o detalhe ou a edição, então vê "NCM fora da tabela vigente — revise o código.". Ele consegue salvar outros campos sem mexer no NCM, mas não consegue trocar o código por outro que não esteja vigente.

**CA-09 — Produtos sem NCM.** Dado um Catálogo com 12 produtos físicos ativos sem NCM e a opção de nota fiscal desligada, quando o Dono toca em "Produtos sem NCM (12)", então vê só esses produtos, com o aviso "Mostrando produtos sem NCM." e "Ver todos os itens". Abrir um deles e voltar leva de volta à lista.

**CA-10 — Aviso de revisão.** Dado 3 produtos ativos com NCM fora da tabela vigente, quando o Dono abre o Catálogo, então vê "3 produtos têm NCM fora da tabela vigente. Ver quais", que abre só esses produtos.

**CA-11 — Busca pelo código.** Dado um produto com 7117.19.00, quando alguém busca "7117" no Catálogo ou no Estoque, então o produto aparece.

**CA-12 — Permissões e suporte.** Dado o Colaborador predefinido (*Catálogo: ver*), quando abre o detalhe, então vê o NCM, sem editar. As ações de buscar e conferir NCM recusam quem não tem *criar* ou *editar*. No modo suporte, o NCM aparece e nenhuma escrita é aceita.

**CA-13 — Isolamento.** Dado dois negócios com itens na subcategoria "Brincos", quando o negócio A cadastra um brinco, então a sugestão considera só os itens do negócio A.

**CA-14 — Carga e atualização.** Dado o arquivo oficial, quando a carga roda duas vezes, então a segunda não muda nada. Com um arquivo novo sem um código, esse código passa a ter data de fim, e os itens que o usam continuam com ele, agora com o aviso de revisão.

**CA-15 — Sem efeito em preço e estoque.** Dado um item com e sem NCM, quando a Calculadora sugere o preço e o estoque é movimentado, então os valores são os mesmos.

**CA-16 — Exportação.** Dado um negócio com produtos com NCM, quando o Dono exporta os dados, então os itens trazem a coluna `ncm`.

**CA-17 — Telas.** Dado o cadastro, a gaveta, o detalhe, o Catálogo com os avisos, os Dados do negócio com a opção e a Nova venda com a nota, quando abertos em 390, 768 e 1440 px, nos dois temas, então não há rolagem horizontal nem violação do axe-core, e o JavaScript fica dentro do orçamento.

**CA-18 — Ligar a opção.** Dado o Dono em Dados do negócio com 12 produtos físicos sem NCM, quando liga "Emito nota fiscal de produtos", então vê o diálogo "12 produtos físicos estão sem NCM…" e só liga ao confirmar. Sem produtos sem NCM, liga direto. Um Gerente não vê a opção, e a ação chamada direto por ele é recusada.

**CA-19 — NCM obrigatório.** Dado a opção ligada, quando alguém cadastra um produto físico sem NCM ou edita um produto antigo sem NCM, então não consegue salvar e vê "Informe o NCM: o negócio emite nota fiscal de produtos.". O campo aparece como "NCM", sem "(opcional)". Um serviço continua sem o campo.

**CA-20 — Venda bloqueada.** Dado a opção ligada e um produto físico com preço e sem NCM, quando alguém abre a Nova venda, então o produto não aparece, e a tela mostra "1 produto está fora da venda por falta de NCM.". Uma venda ou troca com esse produto, chamada direto no servidor, é recusada. Um serviço que baixa esse produto como material continua vendável.

**CA-21 — Código fora da tabela e desligar.** Dado a opção ligada e um produto com NCM fora da tabela vigente, quando é vendido, então a venda passa, e o produto continua com o aviso de revisão. Quando o Dono desliga a opção, o NCM volta a ser opcional, os produtos sem NCM voltam à Nova venda e nenhum NCM é apagado.

---

## 12. Casos de teste derivados

| ID | Caso | Tipo | Cobre |
|---|---|---|---|
| T01 | Normalizar, validar e formatar o NCM (8 dígitos, pontos, espaços, letras, tamanho errado); texto de busca sem acento | Unitário | CA-03, INV-001 |
| T02 | Arquivo da tabela: validação do formato, só códigos de 8 dígitos, caminho montado pelos níveis acima, datas de vigência | Unitário (CI, sem banco) | CA-14 |
| T03 | Carga: idempotente; código ausente recebe data de fim; nenhum item muda | Integração | CA-14, INV-003, INV-006 |
| T04 | Busca na tabela: palavras sem acento, código parcial com e sem pontos, só vigentes (inclusive início futuro), limite de 20, texto curto recusado | Integração | CA-01, CA-02 |
| T05 | Salvar item: NCM vigente, inexistente, encerrado; igual ao gravado e fora da tabela (aceito); trocado para outro fora da tabela (recusado); limpar; serviço com NCM (recusado no servidor e no banco) | Integração | CA-03, CA-04, CA-08, INV-001, INV-002 |
| T06 | Sugestão: mais usado e empate, só ativos, só produto físico, sem o próprio item, só vigentes, dois negócios | Integração | CA-05, CA-06, CA-13, INV-005 |
| T07 | Catálogo: contagens e filtros "sem" e "revisar"; busca pelo começo do NCM no Catálogo e no Estoque | Integração | CA-09, CA-10, CA-11 |
| T08 | Permissões das ações (buscar, conferir, salvar) por papel e no modo suporte | Unitário + integração | CA-12, INV-007 |
| T09 | Calculadora e estoque iguais com e sem NCM | Integração | CA-15, INV-004 |
| T10 | Exportação com a coluna `ncm`; migração sem mudar itens existentes; `Ncm` global com RLS | Integração | CA-16, INV-005, INV-008 |
| T11 | Opção de nota fiscal ligada: NCM obrigatório no cadastro e na edição; venda e troca recusadas com produto sem NCM; produto com NCM fora da tabela vendável; serviço com material sem NCM vendável; itens vendáveis sem o produto e a contagem; desligar sem apagar NCM | Integração | CA-19, CA-20, CA-21, INV-009 |
| T12 | Opção só do Dono; recusada para outros papéis e no modo suporte; contagem de produtos sem NCM para o diálogo; nasce desligada | Unitário + integração | CA-18, INV-008, INV-010 |
| T13 | Fluxo no navegador (build local): buscar e escolher, digitar o código, sugestão com o aviso, detalhe, código fora da tabela, "Produtos sem NCM" e voltar, aviso de revisão, ligar a opção com o diálogo, cadastro obrigatório, Nova venda com a nota; capturas em 390, 768 e 1440 px, claro e escuro; axe; medição de JS | Navegador + manual com captura | CA-01 a CA-12, CA-17 a CA-21 |
| T14 | Fluxo na homologação, depois do merge e da carga da tabela | Manual (uma vez) | CA-01 a CA-11, CA-18 a CA-20 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 21/10/2026, em entrevista. A OPEN-005 e a OPEN-006 vieram depois da primeira versão, por recomendação da profissional da área contábil que revisa o sistema ("o NCM precisa ser obrigatório"):

| ID | Decisão |
|---|---|
| **OPEN-001** — Como encontrar e conferir o NCM | **Tabela oficial no sistema** (recomendada). O arquivo versionado da tabela do Siscomex é carregado como os parâmetros fiscais (ADR-004). A busca é por código ou palavras, o sistema confere que o código existe e mostra a descrição. Não depende de serviço externo. Descartadas: a consulta online pela BrasilAPI, que depende do serviço a cada busca, e a validação só do formato, sem descrição e sem conferir a existência do código. |
| **OPEN-002** — Código que sai da tabela vigente | **Mantém, com aviso** (recomendada): o código continua no item, com "NCM fora da tabela vigente — revise". Editar outros campos continua permitido; só um NCM novo ou trocado precisa estar vigente. Descartadas: exigir a troca ao editar e apagar o NCM na atualização. |
| **OPEN-003** — Onde aparece | **Item, busca e "Sem NCM"**, escolhida pela equipe: cadastro, edição e detalhe; a busca do Catálogo e do Estoque encontra pelo código; um jeito de listar os produtos ainda sem NCM, para completar antes da nota fiscal; exportação. Desdobramento da OPEN-002: o aviso de produtos com NCM fora da tabela leva a uma lista igual. |
| **OPEN-004** — Preenchimento com muitos produtos | **Sugestão pela subcategoria** (recomendada depois da explicação sobre o NCM): o botão "Usar 7117.19.00, o NCM de 3 itens de Brincos", e o código só é preenchido com o toque do dono. Quando não há outros itens da subcategoria com NCM, o dono busca normalmente. **Complemento da equipe:** um aviso explícito junto da sugestão: "Isto é só uma sugestão e pode estar errada. Confira o código certo: a responsabilidade pelo NCM cadastrado é do próprio negócio." Descartada nesta Spec: aplicar o mesmo NCM a vários produtos de uma vez. |
| **OPEN-005** — O NCM é obrigatório? | **Para quem emite nota** (recomendada): a opção "Emito nota fiscal de produtos (NF-e ou NFC-e)" nos Dados do negócio, só do Dono. Ligada, o NCM é obrigatório em todo produto físico cadastrado ou editado; desligada, é opcional. Motivo: a nota de mercadoria exige o NCM, mas nem todo negócio emite nota de produto (o MEI é dispensado para consumidor pessoa física) e há produtos físicos que são só insumos de serviço. Descartadas: sempre obrigatório, para qualquer negócio, e sempre opcional. |
| **OPEN-006** — Produtos já cadastrados sem NCM e a venda deles | **Bloqueia a venda sem NCM**, escolhida pela equipe: com a opção ligada, além de exigir o NCM na próxima edição, a Nova venda não aceita produto físico sem NCM, como já não aceita item sem preço (RN23). Descartada: pedir só na edição e deixar vender. |

**Decisões derivadas do escopo combinado e da baseline (sem questão nova):**
- o NCM é **opcional** enquanto a opção de nota fiscal estiver desligada (escopo de 19/10/2026 e OPEN-005);
- a opção nasce **desligada** em todos os negócios, inclusive nos existentes, para não bloquear vendas de ninguém sem aviso (OPEN-006);
- ligar a opção com produtos sem NCM pede **confirmação**, com o número de produtos que sairão da venda;
- o bloqueio da venda vale só para produto físico **sem** NCM. Com o código **fora da tabela vigente**, a venda continua, com o aviso de revisão (OPEN-002); assim uma atualização da tabela não trava o caixa;
- **materiais** baixados por serviços não bloqueiam a venda do serviço, porque não são vendidos;
- só **produto físico** tem NCM, o que inclui os materiais; serviços não têm (escopo e RF09);
- gravar o NCM segue as **permissões** do item (SPEC-005, SPEC-006); a opção de nota fiscal é do Dono, como os demais Dados do negócio (SPEC-004);
- está nos **dois planos** (SPEC-013, RN18);
- o modo suporte só **lê** (RN30);
- a exportação **inclui** o NCM (RNF04);
- o NCM **não entra em cálculo** nenhum no MVP (RN34);
- a tabela é **atualizada por PR**, sem download automático (ADR-004).

---

## 14. Definition of Done da Spec

A SPEC-021 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-21) estiverem implementados, por testes, no navegador (build local) e na homologação (T14) — implementados e verificados por testes e no navegador em 21/10/2026; falta a homologação;
- [x] todos os invariantes (INV-001 a INV-010) estiverem preservados — testes T01–T12;
- [ ] os testes derivados (T01 a T14) estiverem aprovados, com o CI verde no PR — T01 a T13 aprovados (T13 com 74 verificações); falta o T14;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF10) tiverem sido verificados como descrito na seção 10 — capturas em 390/768/1440 px nos dois temas, axe-core sem violação, JavaScript dentro do orçamento (no máximo +3,2 KB), busca em até 11 ms com a tabela inteira, RLS e isolamento testados, exportação testada;
- [x] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas (21/10/2026), com o RF08 alterado e o RF80, a RN34 e a RN35 incluídos na baseline;
- [ ] a tabela NCM oficial estiver no repositório e carregada na homologação — no repositório (`docs/prisma_base/tabela_ncm.json`); a carga roda no workflow Migrações depois do merge;
- [x] os documentos de modelo (seção 7) estiverem atualizados;
- [ ] não existir divergência conhecida entre a implementação e esta Spec — cinco divergências registradas depois da seção 9, aguardando a decisão da equipe;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada (depois da seção 9).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
