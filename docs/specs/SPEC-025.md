# SPEC-025 — Inventário do estoque numa data

> **Status:** ✅ **Concluída em 01/11/2026** — aprovada, implementada (PR #121), verificada em build local (testes T01 a T08 automatizados e o roteiro no navegador, T09 e T10, com 39 verificações) e homologada (T11), sem divergência ([evidências](evidencias/SPEC-025/README.md)). As notas da implementação e da homologação estão depois da seção 9. As questões em aberto foram decididas pela equipe em entrevista, todas pela opção recomendada (seção 13):
> - para datas anteriores ao **histórico de custo**, que começa com esta Spec, vale o custo do início do histórico, com aviso no arquivo (OPEN-001);
> - entram os **produtos com quantidade diferente de zero** na data, inclusive os arquivados; serviços nunca (OPEN-002);
> - arquivo em **CSV e PDF**, com cabeçalho e linha de total (OPEN-003);
> - **nos dois planos**, em **qualquer data** até hoje (OPEN-004);
> - tela **"Inventário" no Estoque**, para quem vê o **Estoque e o Catálogo**; o suporte não exporta (OPEN-005 e OPEN-008);
> - produtos sem custo, código ou NCM **entram com o campo vazio**, com aviso (OPEN-006);
> - a data já vem no **último dia do mês anterior** (OPEN-007).
>
> A baseline foi ajustada: RF88 e RN41 novos; RF47 e RNF05 alterados. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a pedido da equipe (01/11/2026), a partir do uso real por uma usuária com CNPJ que está catalogando os produtos e precisa entregar o estoque à contabilidade. É a primeira de três Specs de melhorias no Estoque e no Financeiro (seção 3, fora do escopo).
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-006](SPEC-006.md) (o custo do item passa a ter histórico, gravado no cadastro e na edição), [SPEC-007](SPEC-007.md) (a tela do Estoque ganha o Inventário), [SPEC-013](SPEC-013.md) (o inventário vale nos dois planos, sem o limite de 12 meses), [SPEC-014](SPEC-014.md) (a exportação dos dados inclui o histórico de custo) e [SPEC-019](SPEC-019.md) (a correção "Editar item" e o desfazer gravam no histórico de custo).
> - **Usa:** [SPEC-001](SPEC-001.md) (isolamento), [SPEC-005](SPEC-005.md) (permissões), [SPEC-013](SPEC-013.md) (arquivos CSV e PDF dos Relatórios), [SPEC-016](SPEC-016.md) (componentes), [SPEC-018](SPEC-018.md) (modo suporte), [SPEC-021](SPEC-021.md) (NCM) e [SPEC-024](SPEC-024.md) (código interno).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-025 |
| **Nome** | Inventário do estoque numa data |
| **Objetivo** | Mostrar e exportar o **inventário do estoque numa data escolhida**: a quantidade de cada produto ao fim daquele dia e o custo dele naquela data, com o valor total, no formato que a contabilidade pede (código, descrição, unidade, NCM, quantidade, custo unitário e valor total). Para isso, o custo de cada item passa a ter **histórico**. |
| **Valor entregue** | O negócio com CNPJ entrega o inventário de fim de mês ou de fim de ano à contabilidade em segundos, sem copiar à mão o saldo do Estoque e o custo do Catálogo para uma planilha, e sem erro por causa das vendas feitas depois da data. |

### O que é o inventário numa data

O inventário é a lista do que o negócio tinha em estoque **ao fim de um dia**, com quanto cada produto custou. A contabilidade usa esse valor no fechamento (por exemplo, no fim do mês ou em 31/12).

- **A quantidade** é a do fim daquele dia, mesmo que o inventário seja gerado depois. O HE guarda todas as movimentações com a data em que aconteceram, e o estoque de um produto nasce zerado (RN03). Por isso, a quantidade numa data passada é o saldo de hoje desfeito das movimentações posteriores àquela data (RN41).
- **O custo** é o do item naquela data. Hoje o HE guarda só o custo atual. Esta Spec passa a gravar o **histórico de custo**: cada valor, desde quando vale e quem o definiu. Para datas anteriores ao início do histórico, vale o custo do início, e o arquivo avisa (OPEN-001).
- **O valor total** de cada linha é a quantidade × o custo unitário, e o total do inventário é a soma das linhas.

O inventário **não é** o Livro Registro de Inventário oficial nem o Bloco H do SPED. É a lista que a contabilidade usa para escriturar esses documentos.

### Exemplo que originou a Spec

Uma loja com CNPJ precisa mandar à contabilidade o estoque de 31/10.
- **Hoje:** em 01/11, a dona abre o Estoque, copia o saldo de cada produto, abre o Catálogo para copiar o custo e o NCM e monta uma planilha. O saldo que ela vê já não é o de 31/10, porque já vendeu em 01/11.
- **Com esta Spec:**
  - no Estoque, ela abre o **Inventário**, que já vem em 31/10/2026;
  - a tela mostra os produtos que tinham quantidade naquele dia, por exemplo "BR-015 · Brinco argola dourado M · par · 7117.19.00 · 12 · R$ 18,50 · R$ 222,00", e o total do estoque;
  - as vendas de 01/11 não mudam nada, porque a quantidade é a do fim do dia 31/10;
  - o aviso "2 produtos sem NCM" leva à lista para corrigir;
  - ela baixa o CSV, que abre no Excel, e o envia à contabilidade.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF88** (novo) | Inventário do estoque numa data: tela e exportação em CSV e PDF dos produtos com quantidade diferente de zero ao fim do dia escolhido, com código, descrição, unidade, NCM, quantidade, custo unitário naquela data e valor total, e o total do estoque. Nos dois planos, para quem vê o Estoque e o Catálogo. |
| | RF15, RF16, RF17 | Usados: as movimentações (entradas, saídas por venda, saídas manuais e estornos) refazem a quantidade da data. Nenhuma mudança nelas. |
| | RF08, RF09 | O custo continua obrigatório no cadastro; cada valor passa a entrar no histórico de custo. |
| | RF47 | **Alterado:** o inventário do estoque (RF88) vale nos dois planos e em qualquer data, mesmo além dos 12 meses do histórico do plano gratuito. Os relatórios avançados continuam só no pago. |
| | RF80, RF87 | Usados: o NCM (SPEC-021) e o código interno (SPEC-024) são colunas do inventário. |
| **RN** | **RN41** (nova) | A quantidade do inventário é o saldo ao fim do dia escolhido (horário do negócio), refeito pelas movimentações registradas até a geração. O custo é o do histórico de custo vigente ao fim daquele dia; para datas anteriores ao início do histórico, vale o primeiro custo registrado, marcado no arquivo. O inventário não altera estoque, custo nem preço. |
| | RN03, RN04 | Usadas: o estoque nasce zerado (base da reconstrução), e o serviço não tem estoque (fica fora do inventário). |
| | RN37 | Mantida: o suporte não usa exportações, nem esta. |
| **RNF** | RNF01 | Tela do inventário em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | O inventário e o histórico de custo ficam isolados por negócio. |
| | RNF04 | A exportação dos dados (SPEC-014) inclui o histórico de custo. |
| | RNF05 | **Alterado:** a alteração do custo do item também mantém registro auditável (valor, desde quando vale e quem alterou). |
| | RNF06 | O inventário de um negócio com 1.000 produtos e 50.000 movimentações sai em poucos segundos. |
| **Decisões anteriores** | SPEC-007, OPEN-005 | A data da movimentação manual é a da ocorrência informada (até 90 dias atrás): é essa data que conta no inventário. |
| | SPEC-013, OPEN-006 | O CSV segue o padrão brasileiro dos Relatórios (ponto e vírgula, vírgula decimal, abre no Excel), e o PDF usa o mesmo gerador. |
| | SPEC-018, PR #87 | Relatórios e exportações ficam fora do modo suporte; o inventário segue a mesma regra. |
| **Caso de uso / fluxo** | Estoque (SPEC-007); cadastro e edição do item (SPEC-006) | Ver seção 5. |
| **Entidades** | `HistoricoCusto` (nova), `Item`, `MovimentacaoEstoque` | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Histórico de custo** de todos os itens (produtos e serviços): cada custo, desde quando vale e quem o definiu.
   - É gravado no cadastro do item e em toda edição que muda o custo.
   - Ao implantar, cada item existente recebe o custo atual como **início do histórico**.
2. **Tela "Inventário"** no Estoque (OPEN-005, OPEN-008):
   - campo de data, já no último dia do mês anterior (OPEN-007), com qualquer data até hoje;
   - lista dos produtos com quantidade diferente de zero ao fim do dia (OPEN-002), com as colunas da seção 5.3;
   - resumo: quantidade de produtos e valor total do estoque;
   - avisos dos dados faltando (OPEN-006), do custo do início do histórico (OPEN-001) e de quantidade negativa;
   - botões **"Baixar CSV"** e **"Baixar PDF"** (OPEN-003).
3. **Arquivos CSV e PDF** com cabeçalho (negócio, CNPJ quando houver, data da posição, quando e por quem foi gerado), as colunas e a linha de total.
4. **Permissões:** *Estoque: ver* **e** *Catálogo: ver* (o custo é do Catálogo), conferidas no servidor (OPEN-005).
5. **Planos:** nos dois planos, em qualquer data até hoje (OPEN-004).
6. **Modo suporte:** a tela e os arquivos não ficam disponíveis, como os Relatórios.
7. **Exportação dos dados (SPEC-014):** inclui o histórico de custo.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Livro Registro de Inventário oficial, Bloco H do SPED e outros arquivos fiscais | Fora: o inventário é a lista que a contabilidade usa para escriturá-los. |
| Custo médio ou custo da última compra | **SPEC-027** (compras integradas ao estoque e ao financeiro), que também vai gravar no histórico de custo. |
| Reconstruir o custo antigo pelas vendas e pelas confirmações de preço | Fora (OPEN-001). |
| Tela para ver ou editar o histórico de custo de um item | Fora: o histórico existe para o inventário e para a auditoria; o custo continua sendo editado no Catálogo. |
| Formato XLSX | Fora (OPEN-003): o CSV abre no Excel. |
| Inventário por categoria, subcategoria ou só de alguns produtos | Fora: o arquivo traz todos os produtos com quantidade; o filtro pode ser feito na planilha. |
| Contagem física (conferir o estoque e ajustar as diferenças) | Fora: os ajustes continuam pelas entradas e saídas manuais (SPEC-007). |
| Agendar ou enviar o inventário por e-mail à contabilidade | Fora. |
| Fornecedores, filtros das contas e forma do pagamento | **SPEC-026** (fornecedores, vínculo nas contas e filtros). |

---

## 4. Dependências

- **Specs:**
  - SPEC-006: cadastro e edição do item, onde o custo é definido;
  - SPEC-007: movimentações do estoque (com a data da ocorrência) e a tela do Estoque;
  - SPEC-008 e SPEC-011: saídas por venda e estornos, que também são movimentações;
  - SPEC-013: geradores de CSV e PDF dos Relatórios e as regras de plano;
  - SPEC-014: exportação dos dados;
  - SPEC-021 e SPEC-024: NCM e código interno;
  - SPEC-005: matriz módulo × ação;
  - SPEC-001: isolamento, `modelos.ts` e RLS;
  - SPEC-016: campos, tabelas, avisos e estados vazios;
  - SPEC-018 e SPEC-019: modo suporte e a lista fechada de correções.
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-003 (autorização no servidor).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Histórico de custo (OPEN-001)

1. Cada item passa a ter um histórico de custo. Cada registro guarda o **custo**, **desde quando vale** (data e hora) e **quem o definiu**.
2. **Cadastro do item:** grava o primeiro registro, com o custo informado.
3. **Edição do item:** quando o custo muda, grava um registro novo na mesma transação da edição. Uma edição que não muda o custo não grava nada.
4. **Implantação:** a migração grava, para cada item existente, um registro com o custo atual. Esse é o **início do histórico** do item, sem autor (gravado pelo sistema).
5. **Correções do suporte (SPEC-019, quando implementada):** a correção "Editar item" que muda o custo grava no histórico como uma edição, com o Administrador como autor. O desfazer grava o custo anterior como um registro novo.
6. O histórico nunca é apagado nem alterado. Um item arquivado mantém o histórico.

### 5.2 Tela "Inventário" (OPEN-005, OPEN-007, OPEN-008)

1. A tela do Estoque ganha o botão **"Inventário"**, para quem tem *Estoque: ver* e *Catálogo: ver*. Ele abre a tela "Inventário do estoque".
2. **Data:** um campo de data, que abre no **último dia do mês anterior** (em 01/11/2026, abre em 31/10/2026). Aceita qualquer data até hoje. Uma data futura é recusada com "Escolha uma data até hoje.". A data fica no endereço da página, para recarregar e voltar.
3. **Resumo:** "Posição ao fim do dia 31/10/2026: 48 produtos, valor total R$ 12.345,67".
4. **Lista:** uma linha por produto, com as colunas da seção 5.3, em ordem de descrição. No celular, cada produto vira um cartão com os mesmos dados.
5. **Avisos** (só quando acontecem):
   - "2 produtos sem custo, 3 sem código e 5 sem NCM." Os números de código e de NCM levam às listas que já existem no Catálogo ("Itens sem código" e "Produtos sem NCM"); as linhas sem custo ficam marcadas na lista e levam ao item (OPEN-006);
   - "Custo do início do histórico (05/11/2026) em 12 produtos: o HE ainda não guardava o custo nesta data." As linhas aparecem com uma marca (OPEN-001);
   - "1 produto com quantidade negativa nesta data: uma saída foi registrada com data anterior à entrada. Confira as movimentações." A linha aparece com a marca de atenção (5.4).
6. **Sem produtos:** "Nenhum produto com quantidade em 31/10/2026." e os botões de baixar ficam desabilitados.
7. **Baixar:** os botões "Baixar CSV" e "Baixar PDF" geram os arquivos da data escolhida, com o mesmo conteúdo da tela (5.5).
8. A tela informa: "As movimentações registradas depois com data retroativa mudam o inventário de uma data já passada." (RN41).

### 5.3 Colunas

| Coluna | De onde vem | Sem o dado |
|---|---|---|
| **Código** | Código interno do item (SPEC-024), atual | Vazio (OPEN-006) |
| **Descrição** | Nome do item, atual; o arquivado leva "(arquivado)" | — |
| **Unidade** | Unidade de medida do item | — |
| **NCM** | NCM do produto (SPEC-021), atual | Vazio (OPEN-006) |
| **Quantidade** | Saldo ao fim do dia escolhido (5.4), com até 3 casas decimais | — |
| **Custo unitário** | Custo vigente ao fim do dia (5.1); marcado quando vem do início do histórico | Vazio quando o custo é zero (OPEN-006) |
| **Valor total** | Quantidade × custo unitário, arredondado em centavos | Vazio quando não há custo |

A linha de total soma os valores totais. O código, a descrição, a unidade e o NCM são os **atuais** do item, como o código nas vendas (SPEC-024).

### 5.4 Quantidade numa data (RN41)

1. A quantidade de um produto ao fim do dia D é o saldo atual **menos** o efeito de todas as movimentações dele com data posterior a D: as entradas e os estornos são desfeitos subtraindo, e as saídas, somando.
2. Vale a **data da ocorrência** da movimentação, no horário do negócio (America/Sao_Paulo):
   - na entrada e na saída manual, a data informada (SPEC-007, até 90 dias atrás);
   - na saída por venda e no estorno, a data da venda ou do cancelamento.
3. Entram os **produtos físicos** com quantidade diferente de zero em D, ativos ou arquivados (OPEN-002). O produto criado depois de D tem quantidade zero e não entra. Serviços nunca entram.
4. Uma saída registrada com data anterior à entrada pode deixar a quantidade de um dia **negativa**. A linha aparece assim, com a marca de atenção e o aviso da seção 5.2, e entra no total como está.
5. O inventário reflete as movimentações registradas **até o momento da geração**. Uma movimentação registrada depois, com data retroativa, muda o inventário daquela data.

### 5.5 Arquivos CSV e PDF (OPEN-003)

1. **Nome:** `inventario-AAAA-MM-DD.csv` e `.pdf`, com a data da posição.
2. **CSV:** o padrão brasileiro dos Relatórios (SPEC-013): separador ponto e vírgula, vírgula decimal, codificação que abre acentuada no Excel. As colunas da seção 5.3 e a linha de total. A marca do custo do início do histórico vai numa coluna **"Observação"**, com "Custo do início do histórico" ou "Quantidade negativa nesta data".
3. **PDF:** o gerador dos Relatórios, com o cabeçalho:
   - nome do negócio e CNPJ (quando houver);
   - "Inventário do estoque: posição ao fim do dia 31/10/2026";
   - "Gerado em 01/11/2026 às 10:32 por {nome}";
   - as colunas, a linha de total e, no fim, as notas (custo do início do histórico, dados faltando, quantidade negativa).
4. O conteúdo do arquivo é o mesmo da tela no momento em que foi gerado.

### 5.6 Permissões, planos e suporte

1. **Ver a tela e baixar:** *Estoque: ver* **e** *Catálogo: ver*, conferidas no servidor também nas rotas dos arquivos (OPEN-005). Quem não tem as duas não vê o botão, e a rota recusa.
2. **Planos:** nos dois planos, em qualquer data até hoje, mesmo além dos 12 meses do histórico do plano gratuito (OPEN-004, RF47 alterado).
3. **Modo suporte (SPEC-018):** o botão não aparece, e a tela e os arquivos são recusados no contexto de suporte, como os Relatórios e as exportações.
4. **Correções do suporte (SPEC-019):** gravam no histórico de custo (5.1, item 5). O inventário não entra na lista de correções.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | A quantidade de um produto no inventário de hoje é igual ao saldo atual dele. | Teste de integração com movimentações de todos os tipos. |
| **INV-002** | Para qualquer data D, a quantidade é o saldo atual menos o efeito das movimentações com data de ocorrência posterior ao fim do dia D, no horário do negócio. | Teste unitário da reconstrução; teste de integração com movimentações retroativas e na virada do dia. |
| **INV-003** | O custo de um item numa data é o do último registro do histórico vigente até o fim daquele dia; antes do primeiro registro, vale o primeiro, marcado. | Teste unitário da escolha do custo. |
| **INV-004** | Toda mudança de custo grava um registro no histórico na mesma transação; o histórico nunca é alterado nem apagado. | Teste de integração do cadastro e da edição; teste de que o banco recusa alterar ou apagar um registro. |
| **INV-005** | Gerar o inventário não altera estoque, custo, preço nem movimentações. | Teste de integração comparando os dados antes e depois. |
| **INV-006** | Serviços nunca entram, e produtos com quantidade zero na data também não. | Teste de integração. |
| **INV-007** | O inventário e o histórico de custo só trazem dados do próprio negócio. | Teste de integração com dois negócios. |
| **INV-008** | O valor total é quantidade × custo arredondado em centavos por linha, e o total é a soma das linhas; o arquivo e a tela mostram os mesmos números. | Teste unitário da tabela e dos arquivos. |

---

## 7. Modelo de domínio envolvido

| Entidade | Uso | Mudança |
|---|---|---|
| `HistoricoCusto` | Custo de cada item ao longo do tempo | **Nova:** item, negócio, custo, desde quando vale, quem definiu (opcional, nulo no início do histórico) |
| `Item` | Código, nome, unidade, NCM, tipo, custo atual, saldo atual, arquivamento | Nenhuma: o `custoBase` continua sendo o custo atual |
| `MovimentacaoEstoque` | Tipo, quantidade e data da ocorrência | Nenhuma |

**Mudanças previstas no schema:**
- tabela `HistoricoCusto` (`negocioId`, `itemId`, `custo` em `Decimal(10,2)`, `vigenteDesde`, `usuarioId` opcional), com índice por item e data;
- somente inserção, garantida no banco, como as movimentações e os lançamentos;
- RLS por negócio e o modelo em `modelos.ts`;
- migração com o início do histórico: um registro por item existente, com o custo atual e a data da migração.

---

## 8. Impacto arquitetural

- `prisma/schema.prisma` e uma migração: a tabela, a proteção de somente inserção, a RLS e o início do histórico (seção 7).
- `src/lib/dominio/`: funções puras da quantidade numa data (5.4), da escolha do custo (5.1), da data padrão (último dia do mês anterior) e da tabela do inventário com os avisos.
- `src/lib/db/catalogo.ts`: gravar o histórico no cadastro e na edição que muda o custo, na mesma transação.
- `src/lib/db/estoque.ts`: consulta do inventário numa data, somando as movimentações posteriores no próprio banco (RNF06), e o custo vigente de cada item.
- `src/lib/relatorios/`: a tabela do inventário para o CSV e o PDF, reaproveitando os geradores, e o cabeçalho do PDF com o CNPJ.
- Ação e rotas: a tela `/estoque/inventario` e as rotas dos arquivos, com a guarda de permissão e de suporte no servidor.
- Telas: o botão no Estoque e a tela do inventário.
- Exportação dos dados (SPEC-014): o histórico de custo entra no `dados.json`.
- SPEC-019 (quando implementada): a correção "Editar item" e o desfazer gravam no histórico.
- Sem permissão nova e sem integração externa.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Cadastrar / editar item** (SPEC-006) | Sem mudança | Sem mudança; grava o histórico quando o custo muda | — |
| **Inventário numa data** | data (padrão: último dia do mês anterior) | linhas (código, descrição, unidade, NCM, quantidade, custo unitário, valor total, marcas), total e avisos | `DataInvalida` (futura ou inválida); `SemPermissao`; `ForaDoSuporte` |
| **Arquivo do inventário** | data, formato (`csv` ou `pdf`) | o arquivo `inventario-AAAA-MM-DD` | os mesmos do inventário |
| **Custo numa data** (domínio, função pura) | histórico do item, data | custo e se veio do início do histórico | — |
| **Quantidade numa data** (domínio, função pura) | saldo atual, movimentações posteriores, data | quantidade | — |
| **Exportação dos dados** (SPEC-014) | Sem mudança | + histórico de custo no `dados.json` | — |

**Implementação (01/11/2026):**
- **Banco** (migração `20261101120000_historico_custo`):
  - tabela `HistoricoCusto` (`negocioId`, `itemId`, `custo`, `vigenteDesde`, `usuarioId` opcional), com índice por item e data;
  - somente inserção (`he_somente_insercao`), CHECK do custo não negativo, gatilho de mesmo negócio e RLS, como as outras tabelas;
  - início do histórico: um registro por item que já existia, com o custo atual e sem autor.
- **Domínio** (`src/lib/dominio/inventario.ts`): `quantidadeNaData`, `custoNaData`, `dataPadraoDoInventario`, `lerDataDoInventario`, `montarInventario` (linhas, total e avisos), a sigla da unidade, as observações das linhas e as notas do PDF.
- **Dados:**
  - o Catálogo grava o histórico no cadastro e na edição que muda o custo, na mesma transação. A edição passou a receber quem editou;
  - `estoque.inventario(data)` soma no banco as movimentações posteriores ao fim do dia e lê o histórico de custo;
  - a exportação dos dados traz o `historicoCustos`.
- **Serviço e arquivos** (`src/lib/estoque/inventario.ts`): permissão (Estoque e Catálogo — ver), a carga do inventário, o CSV e o PDF. A tabela fica em `src/lib/relatorios/tabelas.ts`, e o gerador de PDF dos Relatórios ganhou o rótulo "Posição", o texto de lista vazia e as notas depois do total.
- **Telas e rotas:**
  - botão "Inventário" no Estoque;
  - tela `/estoque/inventario` com a data, o resumo, os avisos, a tabela (cartões no celular) e os botões de baixar;
  - rota `/estoque/inventario/exportar`;
  - a tela e a rota recusam o modo suporte e quem não tem as duas permissões, no servidor.
- **Testes:** `test/unit/inventario.test.ts` (T01 a T04 e a parte estática do T07) e `test/integracao/inventario.test.ts` (T05 a T08).
- Sem permissão nova, sem ação de gravação nova e sem integração externa.

**Decisões de implementação (sem mudar o comportamento da Spec):**
- **Unidade:** a coluna mostra a sigla em maiúsculas (UN, PAR, KG), como nas notas fiscais e na contabilidade.
- **Observação:** além das duas marcas da seção 5.5, a linha sem custo leva "Sem custo". Quando há duas marcas, elas são separadas por " · ", e não por ";", que é o separador do CSV. Encontrado no roteiro.
- **Aviso do custo do início:** o aviso diz em quantos produtos o custo é o do início do histórico, sem uma data. Os produtos cadastrados depois da implantação têm o próprio início, então não existe uma data única.
- **Colunas do PDF:** as larguras foram reequilibradas para a observação mais longa caber inteira. Encontrado no roteiro.
- **Celular:** os cartões mostram o código, o NCM, a quantidade × o custo e o valor da linha.

**Homologação (T11, 01/11/2026):** a equipe conferiu o inventário na homologação, depois do merge do PR #121 e da migração (31/10/2026, 23h26 em São Paulo), com o Dono do negócio **HE Testing**. Fluxo aprovado:
- o inventário de 31/10/2026 (10 produtos, inclusive arquivados com quantidade) bate com a contagem do estoque;
- o CSV e o PDF saem no formato esperado e iguais à tela;
- numa data anterior à migração (22/10/2026), as quantidades são refeitas e os produtos usam o custo do início do histórico, com "*" e o aviso;
- 31/10 não tem "*", porque o início do histórico foi gravado antes do fim desse dia.

Sem divergência ([evidências](evidencias/SPEC-025/README.md#homologação-t11--01112026)). Duas observações são o comportamento previsto:
- **Data padrão:** a tela abriu em 30/09 porque foi aberta antes da meia-noite de 31/10 (OPEN-007).
- **Campo de data:** o campo de data mostrou o padrão americano porque segue o idioma do navegador, que estava em inglês. É o mesmo campo dos outros campos de data do HE. **Decisão da equipe (01/11/2026): manter o campo do navegador**, que mostra DD/MM/AAAA num navegador em português.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Tela do inventário legível no celular (cartões), sem rolagem horizontal; a tabela larga rola só dentro do próprio quadro. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login; axe sem violações. |
| **RNF02** | Inventário e histórico isolados por negócio (RLS). | INV-007. |
| **RNF04** | O histórico de custo entra na exportação dos dados. | Teste da exportação. |
| **RNF05** | Cada mudança de custo fica registrada, com o valor, desde quando vale e quem alterou, sem alteração posterior. | INV-004. |
| **RNF06** | A quantidade numa data é somada no banco, sem carregar todas as movimentações na memória. | Inventário com 1.000 produtos e 50.000 movimentações em até 3 s no build local. |

---

## 11. Critérios de aceitação

**CA-01 — Inventário de hoje.** Dado um negócio com produtos e movimentações, quando a pessoa escolhe a data de hoje, então cada produto aparece com o saldo atual e o custo atual, e o total é a soma de quantidade × custo.

**CA-02 — Data passada.** Dado o produto BR-015 com saldo 12 em 31/10 e uma venda de 2 em 01/11, quando a pessoa gera o inventário de 31/10 no dia 01/11, então BR-015 aparece com 12, e não com 10.

**CA-03 — Movimentação retroativa.** Dada uma saída manual de 1 registrada em 02/11 com data de 30/10, quando a pessoa gera o inventário de 31/10, então a quantidade já conta essa saída.

**CA-04 — Virada do dia.** Dada uma venda às 23h50 de 31/10 (horário do negócio), então ela conta no inventário de 31/10; uma venda às 00h10 de 01/11 não conta.

**CA-05 — Histórico de custo.** Dado um item com custo R$ 10,00 até 15/11 e R$ 12,00 a partir de 16/11, quando a pessoa gera o inventário de 15/11, então o custo é R$ 10,00; o de 16/11 usa R$ 12,00.

**CA-06 — Antes do histórico.** Dado o início do histórico em 05/11/2026, quando a pessoa gera o inventário de 31/10/2026, então o custo é o do início, a linha tem a marca, a tela mostra o aviso e o arquivo traz a observação "Custo do início do histórico".

**CA-07 — Quais itens.** Dados um produto ativo com quantidade, um arquivado com quantidade, um com quantidade zero na data e um serviço, então só os dois primeiros aparecem, e o arquivado tem "(arquivado)" na descrição.

**CA-08 — Dados faltando.** Dado um produto sem código, sem NCM ou com custo zero, então ele aparece com o campo vazio, a tela mostra o aviso com as contagens e os links, e o arquivo sai do mesmo jeito.

**CA-09 — Quantidade negativa.** Dada uma saída com data anterior à entrada do mesmo produto, quando o inventário de uma data entre as duas é gerado, então a linha aparece com a quantidade negativa, a marca e o aviso.

**CA-10 — Arquivos.** Quando a pessoa baixa o CSV e o PDF de 31/10, então os nomes são `inventario-2026-10-31.csv` e `.pdf`; o CSV abre no Excel com as colunas e o total; o PDF traz o cabeçalho com o negócio, o CNPJ, a data da posição e quem gerou. Os números são os mesmos da tela.

**CA-11 — Data padrão e data futura.** Quando a pessoa abre o inventário em 01/11/2026, então a data é 31/10/2026. Quando escolhe uma data futura, então aparece "Escolha uma data até hoje.", e nada é gerado.

**CA-12 — Permissões, plano e suporte.** Dado um Colaborador com *Estoque: ver* sem *Catálogo: ver*, então ele não vê o botão, e as rotas recusam. Dado um negócio no plano gratuito, então o inventário funciona para uma data de mais de 12 meses atrás. Dado o Administrador em modo suporte, então o botão não aparece, e as rotas recusam.

**CA-13 — Gravação do histórico.** Quando a pessoa cadastra um item, então o histórico tem o primeiro custo. Quando edita só o nome, então nada é gravado. Quando muda o custo, então um registro novo é gravado com o autor. Uma tentativa de alterar ou apagar um registro é recusada pelo banco.

**CA-14 — Exportação dos dados.** Quando o Dono exporta os dados do negócio, então o histórico de custo aparece no `dados.json`.

**CA-15 — Visual.** Dada a tela do inventário com avisos, em 390, 768 e 1440 px, claro e escuro, então os dados aparecem sem rolagem horizontal da página, e o axe não aponta violações.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Quantidade numa data: entradas, saídas, vendas e estornos posteriores; data de hoje; virada do dia no horário do negócio; quantidade negativa | Unitário | CA-01 a CA-04, CA-09, INV-001, INV-002 |
| T02 | Custo numa data: último registro vigente, mudança no próprio dia e antes do início do histórico | Unitário | CA-05, CA-06, INV-003 |
| T03 | Data padrão (último dia do mês anterior, inclusive em janeiro) e recusa da data futura | Unitário | CA-11 |
| T04 | Tabela do inventário: colunas, valor total em centavos, total, observações e avisos; CSV no padrão brasileiro | Unitário | CA-08, CA-10, INV-008 |
| T05 | Histórico de custo: início do histórico na migração, cadastro, edição com e sem mudança de custo, banco recusa alterar e apagar | Integração | CA-13, INV-004 |
| T06 | Inventário no banco: itens ativos e arquivados, quantidade zero, serviço fora, movimentações retroativas, outro negócio não aparece, nada é alterado | Integração | CA-02, CA-03, CA-07, INV-005 a INV-007 |
| T07 | Permissões, plano gratuito com data antiga e modo suporte recusado | Integração | CA-12 |
| T08 | Exportação dos dados com o histórico de custo | Integração | CA-14 |
| T09 | Roteiro no navegador: abrir o inventário, trocar a data, avisos com links, baixar CSV e PDF e conferir no Excel e no leitor de PDF | Manual com captura | CA-01 a CA-12 |
| T10 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção com login, e axe | Manual com captura | CA-15 |
| T11 | Homologação: inventário de 31/10/2026 do negócio de teste, conferido com a contagem da loja e aberto pela contabilidade | Manual (uma vez) | CA-01 a CA-10 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 01/11/2026, em entrevista, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Custo antes do histórico | **Custo do início do histórico, com aviso** (recomendada): o histórico começa com esta Spec, com o custo atual de cada item; para datas anteriores, vale esse custo, e a tela e o arquivo avisam. Para o inventário de 31/10/2026, sai o custo atual. Descartadas: refazer o custo antigo pelas vendas e pelas confirmações de preço (aproximado e mais complexo); recusar datas anteriores ao início do histórico (o inventário de 31/10 não poderia ser exportado). |
| **OPEN-002** — Quais itens entram | **Produtos com quantidade diferente de zero na data, inclusive arquivados** (recomendada): o que está na prateleira precisa ser declarado, mesmo que o item tenha sido arquivado. Descartadas: todos os produtos, inclusive os zerados; só os ativos com quantidade. |
| **OPEN-003** — Formato | **CSV e PDF** (recomendada), como nos Relatórios, com cabeçalho e linha de total. Descartadas: só CSV; CSV, PDF e XLSX (biblioteca nova). |
| **OPEN-004** — Plano | **Nos dois planos, em qualquer data** (recomendada): o inventário é obrigação contábil do negócio. Descartadas: nos dois, com o gratuito limitado a 12 meses; só no plano pago. |
| **OPEN-005** — Onde fica e quem pode | **No Estoque, para quem vê o Estoque e o Catálogo** (recomendada); o suporte não exporta. Descartadas: um relatório novo em Relatórios; só o Dono. |
| **OPEN-006** — Dados faltando | **Entram com o campo vazio, com aviso** (recomendada) e links para corrigir; o arquivo sai do mesmo jeito. Descartadas: bloquear até completar; deixar de fora (o inventário sairia menor que o real). |
| **OPEN-007** — Data padrão | **Último dia do mês anterior** (recomendada), com qualquer data até hoje. Descartada: hoje. |
| **OPEN-008** — Prévia na tela | **Tela com prévia** (recomendada): a lista aparece antes de baixar, para conferir. Descartada: só gerar o arquivo. |

**Decisões derivadas do pedido e da baseline (sem questão nova):**
- a quantidade é a do **fim do dia**, no horário do negócio, e conta a **data da ocorrência** das movimentações;
- a **quantidade negativa** numa data aparece como está, com aviso, para não esconder um erro de registro;
- o código, a descrição, a unidade e o NCM são os **atuais** do item, como nas vendas;
- o histórico de custo começa com um registro de **início** por item, gravado pelo sistema na implantação;
- o produto **sem custo** (custo zero) entra com o custo e o valor total vazios, e conta no aviso;
- a tela avisa que **movimentações retroativas** registradas depois mudam o inventário de uma data passada.

---

## 14. Definition of Done da Spec

A SPEC-025 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-15) estiverem implementados — por testes e no navegador (build local, 01/11/2026); a recusa do modo suporte, pela guarda das rotas (T07);
- [x] todos os invariantes (INV-001 a INV-008) estiverem preservados — testes T01 a T08 e o roteiro;
- [x] os testes derivados (T01 a T11) estiverem aprovados, com o CI verde no PR — T01 a T10 no PR #121 (CI verde) e T11 na homologação (01/11/2026);
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF05, RNF06) tiverem sido verificados como descrito na seção 10 — capturas em 390, 768 e 1440 px nos dois temas, axe, isolamento (T05, T06), exportação (T08), histórico imutável (T05) e 1.000 produtos com 50.000 movimentações em menos de 300 ms;
- [x] as questões OPEN-001 a OPEN-008 tiverem sido decididas e registradas (01/11/2026), com o RF88 e a RN41 incluídos e o RF47 e o RNF05 alterados na baseline;
- [x] não existir divergência conhecida entre a implementação e esta Spec — as decisões de implementação (seção 9) não mudam o comportamento;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos — nenhuma encontrada.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
