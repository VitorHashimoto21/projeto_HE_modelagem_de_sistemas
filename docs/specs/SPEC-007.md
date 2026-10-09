# SPEC-007 — Estoque: movimentações, alertas e mínimo sugerido

> **Status:** 🚧 **Aprovada em 08/10/2026 e implementada em 09/10/2026; verificação na homologação pendente** — questões em aberto decididas pela equipe em entrevista (seção 13), todas pela opção recomendada; testes T01–T15 automatizados e telas verificadas em build de produção com login (T16) — [evidências](evidencias/SPEC-007/README.md). Falta o T17 (fluxo na homologação, depois da migração). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anterior:** [SPEC-006](SPEC-006.md) (catálogo) · **Próximas que dependem desta:** SPEC-008 (venda, que baixa o estoque), SPEC-011 (cancelamento, que devolve o estoque) e SPEC-012 (dashboard, que mostra os alertas).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-007 |
| **Nome** | Estoque: movimentações, alertas e mínimo sugerido |
| **Objetivo** | Controlar a quantidade em estoque dos **Produtos Físicos**: registrar **entradas** (quantidade e data) e **saídas manuais** (com motivo obrigatório), guardar em cada movimentação o saldo anterior e o posterior como registro de auditoria imutável, **sugerir o estoque mínimo** pelo consumo dos últimos 90 dias e **alertar** quando o saldo chegar ao mínimo. |
| **Valor entregue** | O estoque do sistema passa a refletir o físico, com histórico de quem mexeu, quando e por quê. A reposição é antecipada pelo alerta, e a venda (SPEC-008) passa a ter um saldo confiável para validar e baixar. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF15 | Entrada manual com quantidade e data. |
| | RF17 | Saída manual com motivo obrigatório: Perda, Quebra, Uso interno, Doação ou Outro. |
| | RF19 | Alerta visual quando o saldo está igual ou abaixo do estoque mínimo. |
| | RF20 | Mínimo sugerido = ⌈consumo médio diário (90 dias) × dias de cobertura do negócio (padrão 7)⌉, sobrescrevível por um valor fixo. |
| | RF21 | Alerta na lista (notificação do sistema) e no cadastro do produto. O Dashboard (SPEC-012) reaproveita a mesma consulta. |
| | RF08 | Estoque mínimo opcional no cadastro do Produto Físico (SPEC-006) passa a ser o **valor manual** (OPEN-002). |
| **RN** | RN03, RN04 | Só Produto Físico tem estoque. A quantidade só muda por movimentação. |
| | RN07 | A **sugestão** (e o alerta baseado nela) só existe após o primeiro ciclo (uma entrada e uma saída); um mínimo manual alerta desde já (OPEN-003, texto do RN07 ajustado). |
| | RN08 | Sugestão automática após o primeiro ciclo. O valor manual tem prioridade. |
| | RN06 (preparação) | O saldo nunca fica negativo. A mesma primitiva de baixa condicional será usada pela venda (SPEC-008). |
| **RNF** | RNF05 | Cada movimentação guarda data, usuário, saldo anterior e posterior e motivo, e nunca é alterada nem apagada (gatilho no banco). |
| | RNF01, RNF02, RNF06 | Telas responsivas; tudo restrito ao negócio ativo e às permissões do módulo **Estoque** (SPEC-005); lista rápida com centenas de produtos. |
| **Caso de uso / fluxo** | UC7 Registrar Entrada de Estoque, UC8 Registrar Saída Manual de Estoque, UC9 Consultar Alertas de Estoque Baixo | Jornada do Dono (Estoque → Lista → Entrada / Saída manual / Alerta) e jornada do Colaborador (Estoque → Consultar / Registrar entrada e saída) em `FLUXOGRAMAS.md`. |
| **Entidades** | Item (Produto Físico), MovimentacaoEstoque, Negocio (`diasCoberturaEstoque`) | Operacionais, com `negocioId` e o isolamento da SPEC-001. |
| **Drivers** | AD-QA02, AD-CEN02 (preparação) | Auditoria imutável de estoque; base da validação estrita de estoque na venda. |
| **ADRs** | ADR-002 | Isolamento por negócio (cliente do negócio e gatilho `he_mesmo_negocio` já existente em `MovimentacaoEstoque`). |

---

## 3. Escopo

### Incluído

1. **Lista do estoque** (`/estoque`): os Produtos Físicos não arquivados do negócio ativo, com busca por nome e filtros por categoria e por situação (**Estoque baixo**, **Sem estoque**, **Todos**). Cada linha mostra o saldo com a unidade, o estoque mínimo em vigor (manual ou sugerido, com a origem indicada) e a situação.
2. **Entrada de estoque** (UC7): quantidade, data da ocorrência (padrão hoje, OPEN-005) e observação opcional. O saldo aumenta, e a movimentação `ENTRADA` é gravada com o saldo anterior e o posterior.
3. **Saída manual** (UC8): quantidade, motivo obrigatório (RF17), data e observação (obrigatória quando o motivo é "Outro", OPEN-007). Uma saída maior que o saldo é recusada (OPEN-006).
4. **Detalhe do estoque do produto** (`/estoque/[id]`): saldo, mínimo (manual ou sugerido, com o cálculo explicado: consumo médio diário × dias de cobertura), situação e a lista de movimentações da mais nova para a mais antiga. Cada movimentação mostra data, tipo, motivo, quantidade, saldo anterior e posterior, quem registrou e a observação.
5. **Estoque mínimo:**
   - **sugerido**, calculado a partir do primeiro ciclo (RN08);
   - **manual**, que pode ser definido e depois removido para voltar à sugestão (OPEN-002).
6. **Alertas** (RF19, RF21, OPEN-009):
   - aviso na lista do estoque, com o filtro "Estoque baixo";
   - indicador no detalhe do estoque e no detalhe do item do Catálogo;
   - cartão "N produtos com estoque baixo" no Painel, para quem tem *Estoque: ver*.
7. **Dias de cobertura** (`Negocio.diasCoberturaEstoque`): editáveis pelo Dono em "Dados do negócio", de 1 a 90 dias, padrão 7 (OPEN-010).
8. **Imutabilidade:** o banco recusa `UPDATE` e `DELETE` em `MovimentacaoEstoque`, com o mesmo gatilho `he_somente_insercao` do histórico de preços (SPEC-006, OPEN-007).
9. **Primitiva de movimentação** para as próximas Specs:
   - uma única função no servidor faz a atualização condicional do saldo e grava a movimentação na mesma transação;
   - a venda (SPEC-008, `SAIDA_VENDA`) e o cancelamento (SPEC-011, `ENTRADA_ESTORNO`) usam a mesma função.
10. **Permissões** (SPEC-005, módulo **Estoque**, OPEN-001):
    - *ver*: lista, detalhe, movimentações e alertas;
    - *criar*: entrada e saída manual;
    - *editar*: definir ou remover o mínimo manual;
    - *excluir*: sem uso, porque movimentações não são apagadas.

    O item "Estoque" entra no menu para quem tem *ver*.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Baixa por venda, validação de estoque insuficiente no carrinho e baixa dos materiais de serviço (RF16, RF18, RN05, RN06) | SPEC-008 (usa a primitiva desta Spec) |
| Devolução de estoque por cancelamento ou troca (`ENTRADA_ESTORNO`, RN25) | SPEC-011 |
| Alertas no Dashboard | SPEC-012 (reaproveita a consulta desta Spec) |
| Custo de compra na entrada, lançamento da compra no Financeiro, custo médio | Fora desta Spec (OPEN-011). Compras viram despesa no Financeiro (SPEC-009); o custo continua no Catálogo |
| Inventário por contagem ("o saldo real é X"), lotes, validade, vários depósitos, código de barras | Evolução futura. A correção é feita com uma entrada ou saída comum (OPEN-007) |
| Estoque de Serviços | Não existe (RN04): o serviço consome os materiais, que são Produtos Físicos |
| Notificação por e-mail ou push | Evolução futura |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-001: `MovimentacaoEstoque` com `negocioId`, cliente do negócio e gatilho `he_mesmo_negocio`.
  - SPEC-005: matriz módulo × ação, `exigirPermissao`, `acaoComPermissao`, menu por permissões e predefinição do Colaborador com *Estoque: ver, criar*.
  - SPEC-006: Produto Físico, `arquivadoEm`, unidades de medida, `Item.estoqueMinimo` no cadastro e gatilho `he_somente_insercao`.
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-001 (regras fora das páginas), OPEN-09 do Mapa (dia em America/Sao_Paulo).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Registrar entrada (UC7)

- **Pré-condições:** membro do negócio ativo com *Estoque: criar*; Produto Físico não arquivado do negócio.
- **Fluxo principal:**
  1. Na lista ou no detalhe do estoque, a pessoa clica em "Entrada".
  2. Informa a quantidade, a data (padrão hoje) e, se quiser, uma observação.
  3. O servidor valida (5.6) e, numa transação:
     - soma a quantidade ao saldo do item, de forma atômica;
     - grava a movimentação `ENTRADA` com o saldo anterior e o posterior, o usuário da sessão, a data da ocorrência e o momento do registro.
  4. A tela volta ao detalhe com a mensagem "Entrada registrada: +Q un. Saldo: S un."
- **Pós-condições:**
  - `Item.quantidadeEstoque` = saldo posterior da última movimentação do item;
  - a situação e a sugestão são recalculadas na próxima leitura.

### 5.2 Registrar saída manual (UC8)

1. A pessoa com *Estoque: criar* clica em "Saída" e informa a quantidade, o motivo (Perda, Quebra, Uso interno, Doação, Outro), a data e a observação. A observação é obrigatória quando o motivo é "Outro".
2. O servidor valida e, numa transação, subtrai a quantidade **só se o saldo for suficiente**: uma atualização condicional do tipo `… WHERE quantidadeEstoque >= Q`. Em seguida grava a movimentação `SAIDA_MANUAL` com o motivo.
3. Se o saldo não bastar (inclusive por uma saída simultânea), nada é gravado, e a tela mostra "Estoque insuficiente: há S un. de <produto>."

| Situação | Comportamento |
|---|---|
| Quantidade ≤ 0, acima do limite ou com casas demais | Mensagem no campo. |
| Sem motivo, ou "Outro" sem observação | Mensagem no campo; o servidor recusa os mesmos dados. |
| Saída maior que o saldo | Recusada, `EstoqueInsuficiente` (OPEN-006). |
| Item arquivado, Serviço, de outro negócio | `NaoEncontrado` / `ItemSemEstoque`; nada é gravado. |
| Data no futuro ou antes da janela permitida | Mensagem no campo (OPEN-005). |

### 5.3 Estoque mínimo: sugerido e manual (RF20, RN08)

- **Ciclo completo** (RN07): o item tem, desde sempre, pelo menos uma entrada (`ENTRADA`) e pelo menos uma saída (`SAIDA_MANUAL` ou `SAIDA_VENDA`).
- **Consumo médio diário:**
  - numerador: soma das saídas (`SAIDA_MANUAL` + `SAIDA_VENDA`) com data nos últimos 90 dias, menos os estornos de venda (`ENTRADA_ESTORNO`) da mesma janela, nunca abaixo de zero;
  - denominador: o número de dias com histórico na janela, ou seja, os dias desde a primeira movimentação do item, limitados a 90 e contando o dia de hoje (OPEN-004);
  - os dias são contados no fuso de São Paulo.
- **Sugestão:** ⌈consumo médio diário × `Negocio.diasCoberturaEstoque`⌉, um número inteiro. Só existe depois do ciclo completo.
- **Mínimo em vigor:** o manual, se houver; senão, a sugestão, se houver; senão, nenhum (OPEN-002).
- **Definir o manual:** quem tem *Estoque: editar* informa um valor ≥ 0 no detalhe do estoque ou remove o valor para voltar à sugestão. A tela mostra os dois números lado a lado ("Sugerido: 12 · Em uso: 10, manual").
- O valor informado no cadastro do Produto Físico (SPEC-006, RF08) é o mínimo manual. Depois do cadastro, ele só muda pelo Estoque (OPEN-001).

### 5.4 Situação e alertas (RF19, RF21, UC9)

| Situação | Quando | Exibição |
|---|---|---|
| **Sem estoque** | saldo = 0 e há mínimo em vigor | Alerta forte (cor de perigo + ícone + texto). |
| **Estoque baixo** | 0 < saldo ≤ mínimo em vigor | Alerta (cor de aviso + ícone + texto). |
| **Normal** | saldo > mínimo em vigor | Sem destaque. |
| **Sem mínimo** | nenhum mínimo em vigor (sem ciclo e sem manual) | "Alerta ativado após a primeira entrada e saída" (RN07). |

- O alerta nunca depende só da cor (RNF01): há sempre ícone e texto.
- Onde aparece (OPEN-009):
  - na lista (situação por linha e filtro);
  - no detalhe do estoque;
  - no detalhe do item do Catálogo;
  - no Painel, num cartão com a contagem e um link para a lista já filtrada, para quem tem *Estoque: ver*.

### 5.5 Movimentações (auditoria)

- No detalhe do estoque, quem tem *Estoque: ver* vê as movimentações paginadas (50 por página), da mais nova para a mais antiga pela ordem de registro.
- Cada movimentação mostra:
  - data da ocorrência e momento do registro, se forem diferentes;
  - tipo e motivo;
  - quantidade com sinal;
  - saldo anterior → posterior;
  - quem registrou e a observação.
- Os tipos `SAIDA_VENDA` e `ENTRADA_ESTORNO` aparecem quando as SPECs 008 e 011 existirem, com o link para a venda.

### 5.6 Validação

| Campo | Regra |
|---|---|
| Quantidade | Obrigatória, > 0, até 9.999.999,999, até 3 casas decimais (OPEN-008). Aceita "1,5". |
| Data | Obrigatória (padrão hoje, fuso de São Paulo); não pode ser futura nem anterior a 90 dias (OPEN-005). |
| Motivo | Só na saída manual; obrigatório; um dos 5 do RF17. |
| Observação | Opcional, até 200 caracteres; obrigatória quando o motivo é "Outro". |
| Estoque mínimo manual | ≥ 0, até 3 casas; vazio = remover o manual (voltar à sugestão). |
| Dias de cobertura | Inteiro de 1 a 90 (Dono, "Dados do negócio"). |

A validação roda no navegador e de novo no servidor, como nas specs anteriores.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | `Item.quantidadeEstoque` só muda pela primitiva de movimentação, na mesma transação que grava a `MovimentacaoEstoque` correspondente. | Teste de integração com falha simulada após a atualização do saldo: nada fica gravado. |
| **INV-002** | O saldo nunca é negativo: a saída é condicional e o banco tem uma restrição `CHECK (quantidadeEstoque >= 0)`. | Teste de concorrência (saídas simultâneas que somam mais que o saldo) e teste direto no banco. |
| **INV-003** | Para cada movimentação, `saldoPosterior = saldoAnterior ± quantidade` e `quantidade > 0`. Na ordem de registro de um item, o saldo anterior de cada uma é o posterior da anterior, e o último posterior é igual a `Item.quantidadeEstoque`. | Teste de integração após uma sequência e após concorrência. |
| **INV-004** | `MovimentacaoEstoque` nunca é alterada nem apagada (RNF05): o gatilho no banco recusa `UPDATE` e `DELETE`. | Teste de integração direto no banco. |
| **INV-005** | Só Produtos Físicos não arquivados do negócio ativo recebem movimentação manual; Serviços nunca têm movimentação. | Testes de integração (Serviço, arquivado, outro negócio). |
| **INV-006** | `SAIDA_MANUAL` sempre tem motivo; os demais tipos nunca têm. | Teste e restrição `CHECK` no banco. |
| **INV-007** | O mínimo em vigor é o manual se existir; senão a sugestão, que só existe após o ciclo completo (RN07, RN08). | Testes unitários do cálculo. |
| **INV-008** | Toda leitura e escrita do estoque passa pelo cliente do negócio e pela permissão do módulo Estoque correspondente. | Teste das ações sem permissão (varredura estática da SPEC-005) e testes de integração. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Item` (Produto Físico) | `quantidadeEstoque`, `estoqueMinimo`, `unidadeMedida`, `arquivadoEm`, `tipo` | `quantidadeEstoque` só pela primitiva (INV-001). `estoqueMinimo` passa a significar **mínimo manual**; nulo = usar a sugestão (OPEN-002). |
| `MovimentacaoEstoque` | `tipo`, `quantidade`, `saldoAnterior`, `saldoPosterior`, `motivo`, `usuarioId`, `data`, `vendaId` (SPECs 008/011) | Somente inserção (INV-004). `data` = data da ocorrência informada (OPEN-005). |
| `Negocio` | `diasCoberturaEstoque` | 1 a 90, padrão 7 (OPEN-010). |

**Mudanças previstas no schema (decididas na seção 13):**

- `MovimentacaoEstoque.registradoEm DateTime`, preenchido com o relógio do momento da gravação, depois da trava do item. Ele dá a ordem de registro: a data da ocorrência pode ser retroativa (OPEN-005), mas os saldos seguem a ordem em que as movimentações foram gravadas.
- `MovimentacaoEstoque.observacao String?` (até 200 caracteres) (OPEN-007).
- Migração com:
  - o gatilho `he_somente_insercao` em `MovimentacaoEstoque`;
  - `CHECK (quantidadeEstoque >= 0)` em `Item`;
  - `CHECK (quantidade > 0)` e a regra do motivo (INV-006) em `MovimentacaoEstoque`;
  - um índice `(itemId, data)` para o cálculo do consumo.
- Nenhum campo novo em `Item`: o significado de `estoqueMinimo` muda só no comentário (OPEN-002).

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/estoque.ts`, funções puras:
    - consumo médio diário, sugestão, mínimo em vigor e situação;
    - ciclo completo;
    - leitura de quantidades ("1,5") e verificação da data.
  - `src/lib/estoque/`: validação, fluxos (entrada, saída manual, mínimo manual) e Server Actions com `acaoComPermissao("estoque", …)`.
  - `src/lib/db/estoque.ts`:
    - consultas pelo cliente do negócio;
    - a primitiva `movimentar(tx, { itemId, tipo, quantidade, motivo?, vendaId?, data, usuarioId, observacao? })`, que faz a atualização condicional com `RETURNING` e a inserção da movimentação na mesma transação e é exportada para as SPECs 008 e 011;
    - uma consulta agregada que calcula consumo e ciclo de todos os itens da lista de uma vez (RNF06).
  - `src/app/(app)/estoque/`: lista, detalhe com movimentações e formulários de entrada, saída e mínimo.
  - Catálogo (SPEC-006): o detalhe do item mostra a situação do estoque com um link para `/estoque/[id]`; o formulário de **edição** deixa de ter o campo "Estoque mínimo", que continua no **cadastro** (OPEN-001).
  - "Dados do negócio" (SPEC-004): campo "Dias de cobertura do estoque" (OPEN-010).
  - Painel: cartão de alertas.
  - `src/lib/equipe/menu.ts`: item "Estoque" para quem tem *Estoque: ver*.
  - Migração da seção 7.
- **Fronteiras:**
  - Tudo pelo cliente do negócio (SPEC-001): nenhum acesso por id sem o filtro do negócio ativo.
  - As páginas usam `exigirPermissao("estoque", ação)` e as ações usam `acaoComPermissao`. O teste da SPEC-005 que percorre as ações exportadas passa a cobrir as novas.
  - A primitiva não verifica permissão: quem a chama (ação de estoque, venda, cancelamento) já passou pela guarda do próprio módulo.
- **Integrações:** nenhuma externa.
- **Identidade visual:** sem protótipo para estas telas. Seguem os tokens e componentes já usados no Catálogo, com as cores de aviso e de perigo da identidade nos alertas.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Listar estoque** | busca, categoria, situação | produtos com saldo, mínimo em vigor (e origem), situação | `SemPermissao` |
| **Detalhar estoque** | id do item, página | item, saldo, mínimo manual e sugerido (com o cálculo), situação, movimentações | `NaoEncontrado` (inclusive de outro negócio, Serviço), `SemPermissao` |
| **Registrar entrada** | id, quantidade, data, observação | movimentação (saldos) | `CampoInvalido`, `ItemSemEstoque`, `ItemArquivado`, `NaoEncontrado`, `SemPermissao` |
| **Registrar saída manual** | id, quantidade, motivo, data, observação | movimentação (saldos) | `CampoInvalido`, `MotivoObrigatorio`, `EstoqueInsuficiente`, `ItemSemEstoque`, `ItemArquivado`, `NaoEncontrado`, `SemPermissao` |
| **Definir / remover mínimo manual** | id, valor ou vazio | mínimo em vigor | `CampoInvalido`, `NaoEncontrado`, `SemPermissao` |
| **Contar alertas** | — | quantidade de produtos com estoque baixo e sem estoque | `SemPermissao` |
| **Alterar dias de cobertura** (Dono) | dias | negócio | `CampoInvalido`, `SomenteDono` |
| **Movimentar** (interno, transacional) | transação, item, tipo, quantidade, motivo, venda, data, usuário | saldos anterior e posterior | `EstoqueInsuficiente`, `ItemSemEstoque` |
| **Sugerir mínimo** (domínio) | saídas e estornos da janela, data da primeira movimentação, ciclo, dias de cobertura, hoje | sugestão ou nenhuma | — |

**Implementação (09/10/2026):** domínio em `src/lib/dominio/estoque.ts`; validação, fluxos e Server Actions em `src/lib/estoque/`; banco em `src/lib/db/estoque.ts` — a primitiva `movimentar(tx, negocioId, movimento)` é exportada para as SPECs 008 e 011, e `estoque(contexto)` de `@/lib/db` reúne as consultas; telas em `src/app/(app)/estoque/`; migração `20261009120000_estoque`.

**Divergências registradas na implementação:**

- **`registradoEm` pelo relógio do banco, com microssegundos:** `@db.Timestamp(6)` com padrão `clock_timestamp() AT TIME ZONE 'UTC'`, preenchido na inserção, depois da trava do item. Com milissegundos (o padrão do Prisma), duas movimentações simultâneas poderiam empatar e embaralhar a ordem da cadeia de saldos.
- **Instante gravado para a data da ocorrência:** hoje → o momento atual; dia anterior → meio-dia (São Paulo) daquele dia, longe da virada do dia, para o cálculo por dia local nunca cair no dia errado.
- **Dias de cobertura num formulário próprio** em "Dados do negócio" (ação `acaoDefinirDiasCobertura`, só Dono), em vez de entrar na validação do enquadramento fiscal (SPEC-004) — o campo não tem relação com o regime.
- **Edição do Catálogo não grava mais `estoqueMinimo`:** além de tirar o campo da tela (OPEN-001), a gravação da edição deixou de incluí-lo, senão toda edição apagaria o mínimo manual. Teste de regressão em `test/integracao/catalogo.test.ts`.
- **Painel passou a usar `exigirMembro()`** para saber se a pessoa vê o Estoque (cartão de alertas).
- **Teste do menu da SPEC-005** passou a incluir "Estoque".

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Lista, detalhe e formulários responsivos; alertas com ícone e texto, não só cor. | Capturas em 390, 768 e 1440 px, claro e escuro. |
| **RNF02** | Isolamento por negócio e permissões do Estoque. | INV-005, INV-008 por testes de integração. |
| **RNF05** | Movimentação auditável e imutável, com saldo anterior e posterior, usuário, data e motivo. | INV-001, INV-003, INV-004, INV-006. |
| **RNF06** | Lista com situação e sugestão calculadas para centenas de produtos sem uma consulta por item. | Teste de integração com 500 produtos e 10.000 movimentações (< 2 s). |

---

## 11. Critérios de aceitação

**CA-01 — Entrada.** Dado um Produto Físico com saldo 0 e um membro com *Estoque: criar*, quando registra uma entrada de 10 com a data de hoje, então o saldo passa a 10 e há uma movimentação `ENTRADA` com quantidade 10, saldo 0 → 10, o usuário e a data.

**CA-02 — Saída manual com motivo.** Dado saldo 10, quando registra uma saída de 3 com motivo "Quebra", então o saldo passa a 7 e a movimentação `SAIDA_MANUAL` tem o motivo, saldo 10 → 7 e o usuário.

**CA-03 — Motivo obrigatório.** Dada uma saída sem motivo, ou com "Outro" sem observação, quando enviada (inclusive chamando o servidor direto), então é recusada com mensagem no campo e nada é gravado.

**CA-04 — Estoque insuficiente.** Dado saldo 2, quando se tenta uma saída de 3, então é recusada com "Estoque insuficiente" e saldo e movimentações não mudam. Dadas duas saídas simultâneas de 6 com saldo 10, então só uma é gravada e o saldo final é 4.

**CA-05 — Auditoria imutável.** Dada uma movimentação, quando alguém tenta alterá-la ou apagá-la direto no banco, então o banco recusa.

**CA-06 — Cadeia de saldos.** Dada uma sequência qualquer de entradas e saídas (inclusive simultâneas), então cada saldo anterior é o posterior da movimentação anterior do item, e o último posterior é o saldo do item.

**CA-07 — Sem alerta antes do ciclo.** Dado um produto só com entradas e sem mínimo manual, então a situação é "Sem mínimo" e nenhum alerta aparece (RN07). Dado um produto novo com mínimo manual 5 e saldo 2, então o alerta "Estoque baixo" aparece já, antes do ciclo (OPEN-003).

**CA-08 — Sugestão.** Dado um produto cuja primeira movimentação foi há 30 dias, com saídas que somam 60 nesse período e dias de cobertura 7, então a sugestão é ⌈60 ÷ 30 × 7⌉ = 14 e passa a ser o mínimo em vigor.

**CA-09 — Mínimo manual.** Dado o produto do CA-08, quando quem tem *Estoque: editar* define o mínimo manual 10, então o mínimo em vigor é 10 ("manual") e a sugestão 14 continua visível. Quando remove o manual, o mínimo volta a ser 14.

**CA-10 — Alerta.** Dado o mínimo em vigor 10, quando o saldo fica em 10 ou menos, então o produto aparece como "Estoque baixo" na lista, no filtro, no detalhe do estoque, no detalhe do Catálogo e na contagem do Painel. Com saldo 0, aparece como "Sem estoque".

**CA-11 — Dias de cobertura.** Dado o Dono, quando altera os dias de cobertura para 14 em "Dados do negócio", então a sugestão do CA-08 passa a ⌈2 × 14⌉ = 28. Um Gerente não vê nem consegue alterar o campo.

**CA-12 — Itens sem estoque controlado.** Dado um Serviço, um produto arquivado ou um item de outro negócio, quando se tenta movimentá-lo (inclusive chamando o servidor direto), então é recusado e nada é gravado. Serviços não aparecem na lista do estoque.

**CA-13 — Permissões.** Dado um Colaborador com a predefinição (*Estoque: ver, criar*), então ele vê a lista, o detalhe e os alertas e registra entradas e saídas, mas não vê nem consegue usar a definição do mínimo manual. Um membro sem *Estoque: ver* não vê o item no menu e recebe "Sem acesso" ao abrir `/estoque`.

**CA-14 — Data retroativa.** Dada uma entrada com data de 5 dias atrás, então ela entra no cálculo do consumo pela data informada, aparece na ordem de registro com as duas datas, e data futura ou anterior a 90 dias é recusada.

**CA-15 — Visual.** Dadas as telas desta Spec, quando exibidas em 390, 768 e 1440 px, nos temas claro e escuro, então seguem os tokens da identidade, sem rolagem horizontal, e os alertas têm ícone e texto.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação: quantidade (vírgula, casas, limites), data (futura, > 90 dias, fuso), motivo, observação com "Outro" | Unitário | CA-03, CA-14 |
| T02 | Consumo médio diário, ciclo, sugestão com ⌈⌉, estornos descontados, janela de 90 dias, primeiro dia; mínimo manual antes do ciclo | Unitário | CA-07, CA-08, INV-007 |
| T03 | Mínimo em vigor (manual × sugerido × nenhum) e situação (sem estoque, baixo, normal, sem mínimo) | Unitário | CA-09, CA-10 |
| T04 | Entrada: saldo, movimentação, usuário, datas | Integração | CA-01, INV-003 |
| T05 | Saída manual: motivo, saldo; sem motivo e "Outro" sem observação recusados | Integração | CA-02, CA-03, INV-006 |
| T06 | Saída maior que o saldo recusada; saídas simultâneas (8 pedidos) nunca deixam o saldo negativo | Integração | CA-04, INV-002 |
| T07 | Cadeia de saldos após sequência e após concorrência de entradas e saídas | Integração | CA-06, INV-003 |
| T08 | Falha simulada após atualizar o saldo desfaz tudo | Integração | INV-001 |
| T09 | `UPDATE`/`DELETE` em `MovimentacaoEstoque` e saldo negativo direto no banco recusados | Integração | CA-05, INV-002, INV-004 |
| T10 | Serviço, arquivado e outro negócio recusados; Serviço fora da lista | Integração | CA-12, INV-005 |
| T11 | Sugestão e alerta a partir de movimentações reais; mínimo manual; filtro e contagem | Integração | CA-08 a CA-10 |
| T12 | Dias de cobertura: só o Dono altera; a sugestão muda | Integração | CA-11 |
| T13 | Permissões: Colaborador predefinido, permissões customizadas, ações chamadas direto, menu | Integração | CA-13, INV-008 |
| T14 | Data retroativa no consumo e na ordem de registro | Integração | CA-14 |
| T15 | Lista com 500 produtos e 10.000 movimentações em menos de 2 s | Integração | RNF06 |
| T16 | Telas em 390/768/1440 px, claro e escuro | Manual com captura | CA-15 |
| T17 | Fluxo completo na homologação (entrada, saída, alerta, mínimo manual, Colaborador) | Manual (uma vez) | CA-01 a CA-14 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 08/10/2026, em entrevista, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Permissões do Estoque e quem muda o mínimo | ***Ver***: lista, detalhe e alertas. ***Criar***: entrada e saída manual. ***Editar***: mínimo manual, que sai do formulário de **edição** do Catálogo e continua no **cadastro** (RF08). ***Excluir***: sem uso no Estoque, e a tela de permissões indica isso. |
| **OPEN-002** — Guardar o mínimo manual e o sugerido | `Item.estoqueMinimo` guarda só o **valor manual** (nulo = automático). A sugestão é **calculada na leitura** e nunca gravada. |
| **OPEN-003** — Alerta com mínimo manual antes do 1º ciclo | **O mínimo manual alerta imediatamente.** O RN07 vale para a sugestão, e o texto foi ajustado em `requisitos.md`, `requisitos_ears.md` e no modelo de domínio. |
| **OPEN-004** — "Dias com histórico" na fórmula do RF20 | **Dias desde a primeira movimentação do item**, no máximo 90, contando hoje. |
| **OPEN-005** — Data da movimentação | **Data da ocorrência informada** (padrão hoje, nunca futura, até 90 dias atrás). O sistema também grava o **momento do registro** (`registradoEm`), que define a ordem dos saldos. |
| **OPEN-006** — Saída manual maior que o saldo | **Recusar.** O saldo nunca é negativo, e há uma restrição no banco. |
| **OPEN-007** — Corrigir um lançamento errado | **Correção por movimento contrário**, com o novo campo **observação** (opcional, obrigatória no motivo "Outro"). |
| **OPEN-008** — Casas decimais | **Até 3 casas em qualquer unidade**, exibidas sem zeros à direita. A sugestão continua inteira. |
| **OPEN-009** — Onde o alerta aparece antes do Dashboard | Na **lista do estoque** (situação e filtro), no **detalhe do estoque**, no **detalhe do item no Catálogo** e num **cartão no Painel** com a contagem. |
| **OPEN-010** — Quem configura os dias de cobertura | **O Dono, em "Dados do negócio"**, de 1 a 90 dias. |
| **OPEN-011** — Custo de compra na entrada | **Não pedir.** O custo continua no Catálogo, e a compra é lançada como despesa no Financeiro (SPEC-009). |

---

## 14. Definition of Done da Spec

A SPEC-007 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-15) estiverem implementados — CA-01 a CA-15 por testes e em build de produção local com login; falta conferir na homologação (T17);
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T17) estiverem aprovados, com o CI verde no PR — T01 a T15 automatizados; T16 com capturas; T17 pendente;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-011 tiverem sido decididas e registradas (08/10/2026), com o texto do RN07 ajustado na baseline (OPEN-003);
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
