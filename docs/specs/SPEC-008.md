# SPEC-008 — Registro de venda integrado

> **Status:** ✅ **Aprovada em 09/10/2026** — questões em aberto decididas pela equipe (seção 13), todas pela opção recomendada. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-006](SPEC-006.md) (catálogo e preço oficial) e [SPEC-007](SPEC-007.md) (estoque e primitiva de movimentação) · **Próximas que dependem desta:** SPEC-009 (financeiro), SPEC-010 (RBT12 e CMV%), SPEC-011 (cancelamento e troca) e SPEC-012 (dashboard).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-008 |
| **Nome** | Registro de venda integrado |
| **Objetivo** | Registrar vendas com vários itens (produtos físicos e serviços), cliente opcional e pagamento em uma ou mais formas — Dinheiro, PIX, Débito e Crédito em até 12x —, validando no servidor preço, estoque e soma dos pagamentos, e, **numa única transação**: dar baixa no estoque dos produtos e dos materiais dos serviços, gravar o preço e o custo unitário de cada item e gerar os lançamentos de caixa (pagamentos imediatos) ou as parcelas com suas contas a receber (crédito). |
| **Valor entregue** | O fluxo central do negócio: vender uma vez e ter estoque, caixa e contas a receber atualizados juntos, sem lançamento manual duplicado (RF33). As vendas passam a alimentar o financeiro (SPEC-009), o RBT12 e o CMV% da calculadora (SPEC-010) e o dashboard (SPEC-012). |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF16 | Baixa automática do estoque ao registrar a venda. |
| | RF18 | Venda bloqueada quando falta estoque de um produto ou de um material, antes de qualquer gravação. |
| | RF22 | Cliente opcional (busca ou cadastro rápido — OPEN-005). |
| | RF23 | Vários itens por venda, produtos físicos e serviços. |
| | RF24, RF25 | Dinheiro, PIX, Débito e Crédito; pagamento misto. |
| | RF26 | Soma dos pagamentos = total, validada na interface e no servidor. |
| | RF27, RF28 | Crédito em até 12x; vencimentos mensais a partir da data da venda (OPEN-003). |
| | RF33 | Toda venda gera os lançamentos automaticamente. |
| | RF62 | Custo unitário gravado em cada item da venda (inclui os materiais do serviço). |
| **RN** | RN05 | Serviço vendido consome os materiais vinculados. |
| | RN06 | Venda com estoque insuficiente é proibida: baixa condicional e atômica (primitiva da SPEC-007). |
| | RN09, RN10 | Dinheiro, PIX e Débito → lançamento imediato de entrada no caixa; Crédito → parcelas e contas a receber, fora do caixa até o recebimento (RN14). |
| | RN11 | Parcelas iguais em centavos, diferença na 1ª parcela, sem taxa de maquininha. |
| | RN12, RN13 | Estoque e financeiro disparados pela venda; categoria "Vendas". |
| | RN15, RN23 | Preço é sempre o preço oficial atual do item; item sem preço oficial não entra na venda. |
| | RN29 | Datas em UTC; dia e competência em America/Sao_Paulo. |
| **RNF** | RNF01, RNF02 | Tela de venda responsiva (uso no balcão, pelo celular); tudo restrito ao negócio ativo e às permissões do módulo **Vendas** (SPEC-005). |
| | RNF05 | Venda auditável: quem registrou (OPEN-006), quando, itens com preço e custo, movimentações ligadas à venda. |
| **Caso de uso / fluxo** | UC11 Registrar Venda, UC11a Registrar Pagamento, UC11b Parcelar no Cartão, UC11c Baixa Automática no Estoque, UC11d Gerar Lançamento Financeiro | Diagrama 2 (`DIAGRAMAS_COMPORTAMENTAIS.md`) e jornadas "Nova Venda" do Dono e do Colaborador (`FLUXOGRAMAS.md`). |
| **Entidades** | Venda, ItemVenda, Pagamento, Parcela, Cliente, MovimentacaoEstoque, LancamentoFinanceiro, ContaPagarReceber | Todas operacionais, com `negocioId` e o isolamento da SPEC-001. |
| **Drivers** | AD-RF03, AD-CEN01, AD-CEN02 | Venda integrada; cenário de venda; validação estrita de estoque. |
| **ADRs** | ADR-002, ADR-003 | Isolamento por negócio; validação e autorização no servidor (preço e custo definidos pelo servidor, nunca pelo navegador). |

---

## 3. Escopo

### Incluído

1. **Nova venda** (`/vendas/nova`), a frente de caixa:
   - busca de itens do catálogo **não arquivados e com preço oficial** (RN23), mostrando preço, unidade e, para produtos físicos, o saldo em estoque;
   - carrinho com quantidade por linha (até 3 casas decimais, como no estoque), subtotal por linha e total;
   - aviso no carrinho quando a quantidade pedida passa do saldo de um produto ou de um material — a decisão final é sempre do servidor;
   - cliente opcional: buscar pelo nome ou cadastrar rápido (OPEN-005);
   - pagamentos: uma ou mais linhas (forma + valor; no Crédito, nº de parcelas de 1 a 12), com o valor restante sempre visível e o botão "Finalizar" só habilitado quando a soma bate com o total (RF26);
   - no Dinheiro, campo opcional "valor recebido" para calcular o troco (OPEN-004).
2. **Registro no servidor**, numa transação (seção 5.2): validação, número da venda (OPEN-007), venda e itens com preço e custo, baixa de estoque com movimentações `SAIDA_VENDA` ligadas à venda, pagamentos, lançamentos imediatos, parcelas e contas a receber.
3. **Proteção contra envio duplicado:** cada carrinho tem um identificador gerado ao abrir a tela; reenviar o mesmo carrinho (clique duplo, rede lenta) não cria uma segunda venda — devolve a venda já registrada (INV-009).
4. **Venda concluída:** tela de confirmação com número, itens, total, formas de pagamento e parcelas, e o botão "Nova venda".
5. **Histórico de vendas** (`/vendas`): vendas do negócio ativo por período (padrão: hoje, no fuso de São Paulo), com número, data e hora, cliente, total, formas de pagamento e quem registrou; total do período.
6. **Detalhe da venda** (`/vendas/[id]`): itens (quantidade, preço, subtotal), pagamentos, parcelas com vencimento e situação da conta a receber, movimentações de estoque geradas e quem registrou.
7. **Permissões** (SPEC-005, módulo **Vendas**): *ver* → histórico e detalhe; *criar* → nova venda e cadastro rápido de cliente; *editar* e *excluir/cancelar* → sem uso nesta Spec (o cancelamento é da SPEC-011). O item "Vendas" entra no menu para quem tem *ver*, e "Nova venda" para quem tem *criar*.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cancelamento e troca (RF65, RF66, RN25, RN26), forma "Crédito de troca" | SPEC-011 |
| Recebimento das contas a receber, fluxo de caixa, saldo | SPEC-009 (esta Spec só cria os registros) |
| RBT12, faturamento e CMV% | SPEC-010 (usa `Venda.valorTotal` e `ItemVenda.custoUnitario`) |
| Vendas do dia no dashboard | SPEC-012 |
| Desconto ou alteração de preço na venda | Fora do MVP (OPEN-001) — o preço é sempre o oficial (RN15) |
| Taxa de maquininha e comissão descontadas do recebimento | Fora do MVP (RN11, RN20) |
| Tela de clientes (lista, edição, histórico por cliente) | Fora desta Spec (OPEN-005) |
| Emissão de nota fiscal, recibo impresso, leitor de código de barras | Evolução futura |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-001: modelos de venda com `negocioId`, cliente do negócio, gatilho `he_mesmo_negocio`.
  - SPEC-005: matriz módulo × ação, `exigirPermissao`, `acaoComPermissao`, menu; Colaborador com *Vendas: ver, criar*.
  - SPEC-006: itens, preço oficial (`precoAtual`), custo total com materiais, arquivamento.
  - SPEC-007: primitiva `movimentar()` (baixa condicional atômica, `SAIDA_VENDA` com `vendaId`).
- **Decisões arquiteturais:** ADR-002, ADR-003, RN29 (fuso de São Paulo).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Montar a venda (UC11)

- **Pré-condições:** membro do negócio ativo com *Vendas: criar*.
- **Fluxo principal:**
  1. Em "Nova venda", a pessoa busca itens e os adiciona ao carrinho (quantidade inicial 1, editável). Só aparecem itens não arquivados com preço oficial (RN23).
  2. Opcionalmente escolhe ou cadastra o cliente.
  3. Adiciona as formas de pagamento até que a soma seja igual ao total. No Crédito, escolhe as parcelas (1 a 12) e vê a simulação (RN11).
  4. Clica em "Finalizar venda".
- **Exceções na interface:** carrinho vazio, quantidade inválida, soma diferente do total ou parcelas fora de 1–12 → mensagem no campo e o botão continua desabilitado; o servidor repete todas as validações.

### 5.2 Registrar a venda no servidor (Diagrama 2)

1. **Validação** (nada é gravado se falhar):
   - cada item existe no negócio ativo, não está arquivado e tem preço oficial (RN23);
   - quantidades > 0, até 3 casas;
   - o **preço unitário** de cada linha é o `precoAtual` do item no momento da gravação — o valor enviado pelo navegador é ignorado (ADR-003, RN15);
   - **total** = Σ arredondamento em centavos de (preço × quantidade) de cada linha;
   - formas de pagamento válidas, valores > 0 com 2 casas, parcelas 1–12 só no Crédito e **soma = total** (RF26);
   - cliente, se informado, é do negócio ativo.
2. **Transação**, na ordem:
   1. número da venda (OPEN-007) e `Venda` (data, total, cliente, quem registrou — OPEN-006);
   2. `ItemVenda` de cada linha com `precoUnitario` e `custoUnitario` = custo total atual do item (próprio + Σ custo do material × quantidade — RF62);
   3. **baixa de estoque**, pela primitiva `movimentar()` da SPEC-007, uma movimentação `SAIDA_VENDA` com `vendaId`:
      - produto físico: quantidade vendida;
      - serviço: para cada material, quantidade vendida × quantidade do material (RN05);
      - o mesmo produto em mais de uma linha (vendido direto e como material) é baixado em uma movimentação por origem, todas na mesma transação; o saldo é conferido a cada baixa;
   4. `Pagamento` de cada forma;
   5. Dinheiro, PIX, Débito → `LancamentoFinanceiro` de **entrada**, categoria Vendas, com `vendaId` e a data da venda (RN09, RN13);
   6. Crédito → `Parcela` 1..N com valores do RN11 e vencimentos do OPEN-003, e uma `ContaPagarReceber` **a receber**, categoria Vendas, `ABERTA`, por parcela (RN10).
3. Se qualquer baixa encontrar estoque insuficiente, a transação inteira é desfeita e a tela mostra **"Estoque insuficiente para <item>: há X <un.>"**, mantendo o carrinho (RF18).

| Situação | Comportamento |
|---|---|
| Item sem preço, arquivado ou de outro negócio | Recusado: "<item> não pode ser vendido (sem preço oficial / arquivado)"; nada é gravado. |
| Preço alterado entre abrir o carrinho e finalizar | A venda usa o preço atual; se o total mudar, a soma dos pagamentos deixa de bater e o servidor recusa com "O preço de <item> mudou para R$ X. Revise os pagamentos." |
| Estoque insuficiente (produto ou material), inclusive por venda simultânea | `EstoqueInsuficiente` com o item; nada é gravado. |
| Soma dos pagamentos ≠ total | Recusado (RF26). |
| Mesmo carrinho enviado duas vezes | Devolve a venda já registrada; nenhuma segunda venda (INV-009). |
| Falha em qualquer passo | Transação desfeita: nem venda, nem baixa, nem lançamento (INV-001). |

### 5.3 Parcelas do crédito (RN11, RF28)

- Valor de cada parcela = valor do pagamento no crédito ÷ N, truncado em centavos; a diferença vai para a **1ª parcela** (R$ 100,00 em 3x = 33,34 + 33,33 + 33,33).
- Vencimento da parcela *k* conforme o OPEN-003 (recomendação: o mesmo dia da venda, *k* meses depois; se o mês não tiver esse dia, o último dia do mês), calculado no fuso de São Paulo.
- Cada parcela gera uma conta a receber com o mesmo valor e vencimento, descrição "Venda nº X — parcela k/N".

### 5.4 Histórico e detalhe

- O histórico lista as vendas do período escolhido (hoje, ontem, últimos 7 dias, este mês, ou datas livres), da mais nova para a mais antiga, com o total do período. Vendas canceladas (quando existirem, SPEC-011) aparecem marcadas e fora do total.
- O detalhe mostra tudo o que a venda gerou: itens, pagamentos, parcelas com a situação da conta a receber (aberta, parcial, quitada) e as movimentações de estoque com link para o produto.

### 5.5 Validação

| Campo | Regra |
|---|---|
| Itens | Ao menos 1; até 100 linhas; item não arquivado, com preço oficial, do negócio ativo. |
| Quantidade | > 0, até 9.999.999,999, até 3 casas. Aceita "1,5". |
| Forma de pagamento | Dinheiro, PIX, Débito ou Crédito (Crédito de troca só pela SPEC-011). |
| Valor do pagamento | > 0, até 2 casas; soma = total. |
| Parcelas | Inteiro de 1 a 12, só no Crédito. |
| Cliente (cadastro rápido) | Nome obrigatório (até 120); contato opcional (até 120). |
| Data da venda | Conforme o OPEN-002. |

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | A venda é atômica: venda, itens, baixas, pagamentos, lançamentos, parcelas e contas são gravados juntos ou nada é gravado. | Teste com falha simulada em cada etapa final (ex.: conta a receber). |
| **INV-002** | Preço unitário e total são calculados no servidor a partir do `precoAtual`; nenhum valor de preço vindo do navegador é usado. | Teste chamando o servidor com preço adulterado. |
| **INV-003** | Σ pagamentos = `Venda.valorTotal` = Σ arredondamento(preço × quantidade) das linhas. | Teste de integração e restrição verificada após cada venda. |
| **INV-004** | Para cada pagamento no crédito, Σ parcelas = valor do pagamento; a 1ª parcela recebe a diferença de centavos; cada parcela tem exatamente uma conta a receber com o mesmo valor e vencimento. | Testes unitários (RN11) e de integração. |
| **INV-005** | Cada pagamento em Dinheiro, PIX ou Débito tem exatamente um lançamento de entrada, categoria Vendas, com o mesmo valor; Crédito nunca gera lançamento imediato. | Teste de integração. |
| **INV-006** | Cada produto físico vendido e cada material de serviço vendido tem uma movimentação `SAIDA_VENDA` com o `vendaId`; o saldo nunca fica negativo e a cadeia de saldos da SPEC-007 se mantém. | Teste de integração, inclusive com vendas simultâneas. |
| **INV-007** | `ItemVenda.custoUnitario` = custo total do item no momento da venda (próprio + materiais); mudanças posteriores de custo não alteram vendas passadas. | Teste de integração. |
| **INV-008** | Toda leitura e escrita passa pelo cliente do negócio e pela permissão do módulo Vendas. | Varredura estática da SPEC-005 e testes de integração. |
| **INV-009** | O mesmo carrinho (mesmo identificador) nunca gera duas vendas. | Teste enviando o mesmo carrinho duas vezes, inclusive em paralelo. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Venda` | `data`, `valorTotal`, `clienteId`, `status` (CONCLUIDA), novos campos do OPEN-006/OPEN-007 | O `id` pode vir do carrinho (proteção contra envio duplicado — INV-009), validado como UUID. |
| `ItemVenda` | `itemId`, `quantidade`, `precoUnitario`, `custoUnitario` | Preço e custo do servidor (INV-002, INV-007). |
| `Pagamento` | `forma`, `valor`, `parcelas` | `parcelas` > 1 só no Crédito. |
| `Parcela` | `numero`, `valor`, `vencimento` | RN11; uma conta a receber por parcela. |
| `ContaPagarReceber` | `tipo` RECEBER, `categoria` VENDAS, `valorTotal`, `vencimento`, `status` ABERTA, `parcelaId`, `descricao` | Fora do caixa até o recebimento (RN14, SPEC-009). |
| `LancamentoFinanceiro` | `tipo` ENTRADA, `categoria` VENDAS, `valor`, `vendaId`, `data` | Um por pagamento imediato. |
| `MovimentacaoEstoque` | `SAIDA_VENDA`, `vendaId` | Pela primitiva da SPEC-007. |
| `Cliente` | `nome`, `contato` | Cadastro rápido (OPEN-005). |

**Mudanças previstas no schema (dependem das decisões da seção 13):**

- `Venda.registradaPorId` (usuário que registrou), com relação para `Usuario` (OPEN-006).
- `Venda.numero Int` com `@@unique([negocioId, numero])` e `Negocio.proximoNumeroVenda` (ou cálculo equivalente sob trava) (OPEN-007).
- `CHECK` no banco: `Venda.valorTotal > 0`, `Pagamento.valor > 0`, `Pagamento.parcelas BETWEEN 1 AND 12` e `parcelas = 1` fora do Crédito, `ItemVenda.quantidade > 0`, `Parcela.valor > 0`.
- Índice `(negocioId, data)` em `LancamentoFinanceiro` para o financeiro (SPEC-009).

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/venda.ts` — total da venda, divisão em parcelas (RN11), vencimentos (OPEN-003), troco, validação da soma — puras;
  - `src/lib/vendas/` — validação, fluxos (registrar, cadastrar cliente) e Server Actions com `acaoComPermissao("vendas", …)`;
  - `src/lib/db/vendas.ts` — a transação da venda (usando `movimentar()` da SPEC-007), histórico, detalhe, busca de itens vendáveis e de clientes;
  - `src/app/(app)/vendas/` — histórico, `nova` (frente de caixa) e `[id]` (detalhe e confirmação);
  - `src/lib/equipe/menu.ts` — "Vendas" e "Nova venda";
  - migração da seção 7.
- **Fronteiras:**
  - Tudo pelo cliente do negócio; as consultas SQL diretas filtram o `negocioId` à mão (como na SPEC-007).
  - O navegador envia só ids de itens, quantidades, cliente e pagamentos; preço, custo e total são do servidor.
  - A transação usa a mesma primitiva de estoque da SPEC-007, para a cadeia de saldos valer também nas vendas.
- **Integrações:** nenhuma externa.
- **Identidade visual:** sem protótipo; a frente de caixa é pensada primeiro para o celular (balcão), com os tokens e componentes já usados.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Buscar itens vendáveis** | texto | itens com preço oficial, unidade, saldo (produto) e materiais com saldo (serviço) | `SemPermissao` |
| **Buscar / cadastrar cliente** | texto / nome e contato | clientes / cliente criado | `CampoInvalido`, `SemPermissao` |
| **Registrar venda** | id do carrinho, linhas (item, quantidade), cliente opcional, pagamentos (forma, valor, parcelas), data (OPEN-002) | venda (número, total, pagamentos, parcelas) | `CampoInvalido`, `ItemNaoVendavel`, `PrecoMudou`, `SomaDivergente`, `EstoqueInsuficiente` (com o item), `SemPermissao` |
| **Listar vendas** | período | vendas e total do período | `SemPermissao` |
| **Detalhar venda** | id | venda com itens, pagamentos, parcelas/contas, movimentações | `NaoEncontrado`, `SemPermissao` |
| **Dividir em parcelas** (domínio) | valor, N, data da venda | parcelas (valor, vencimento) | — |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Frente de caixa usável no celular (390 px) e no computador. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login. |
| **RNF02** | Isolamento e permissões do módulo Vendas. | INV-008 por testes. |
| **RNF05** | Venda auditável (quem, quando, preço e custo, movimentações). | INV-006, INV-007, OPEN-006. |
| **RNF06** | Registro de uma venda com 20 linhas e o histórico de 1.000 vendas respondem em menos de 2 s. | Teste de integração. |

---

## 11. Critérios de aceitação

**CA-01 — Venda simples à vista.** Dado um produto com preço R$ 18,00 e saldo 10, quando o Colaborador vende 2 unidades em PIX, então a venda é registrada com total R$ 36,00, o saldo vai a 8 com uma movimentação `SAIDA_VENDA` ligada à venda, e há um lançamento de entrada de R$ 36,00 na categoria Vendas.

**CA-02 — Serviço com materiais.** Dado um serviço que usa 0,25 un. de esmalte (saldo 1) e 2 un. de algodão (saldo 10), quando são vendidas 2 execuções, então o esmalte vai a 0,5 e o algodão a 6, cada um com sua movimentação ligada à venda, e o custo unitário gravado inclui os materiais.

**CA-03 — Estoque insuficiente.** Dado um produto com saldo 1, quando a venda pede 2 (diretamente ou como material), então aparece "Estoque insuficiente para <item>" e nada é gravado. Dadas duas vendas simultâneas que somam mais que o saldo, então só uma é registrada.

**CA-04 — Pagamento misto e parcelado.** Dada uma venda de R$ 250,00 paga com R$ 50,00 em dinheiro e R$ 200,00 no crédito em 3x, então há um lançamento de R$ 50,00, três parcelas de R$ 66,68 + 66,66 + 66,66 com vencimentos mensais e três contas a receber abertas com os mesmos valores e vencimentos, fora do saldo de caixa.

**CA-05 — Soma divergente.** Dados pagamentos que somam diferente do total, quando a venda é enviada (inclusive chamando o servidor direto), então é recusada e nada é gravado.

**CA-06 — Preço do servidor.** Dado um envio com o preço do item adulterado, então a venda usa o preço oficial; se o total muda, a soma deixa de bater e a venda é recusada.

**CA-07 — Item não vendável.** Dado um item sem preço oficial, arquivado ou de outro negócio, quando se tenta vendê-lo, então é recusado; na busca da frente de caixa ele não aparece.

**CA-08 — Envio duplicado.** Dado o mesmo carrinho enviado duas vezes (ou em paralelo), então existe uma única venda, e a segunda resposta mostra a venda já registrada.

**CA-09 — Atomicidade.** Dada uma falha na gravação da última conta a receber, então nada da venda fica gravado (nem baixa de estoque, nem lançamento).

**CA-10 — Cliente.** Dada uma venda com cliente cadastrado na hora, então a venda aponta para o cliente; uma venda sem cliente também é registrada.

**CA-11 — Histórico e detalhe.** Dadas vendas de hoje e de ontem, quando o histórico é aberto com "hoje", então só as de hoje aparecem, com o total do dia; o detalhe mostra itens, pagamentos, parcelas com a situação das contas e as movimentações.

**CA-12 — Permissões.** Dado um membro sem *Vendas: criar*, então "Nova venda" não aparece e a ação chamada direto é recusada; sem *Vendas: ver*, o histórico responde "Sem acesso".

**CA-13 — Visual.** Dadas as telas desta Spec, quando exibidas em 390, 768 e 1440 px, nos temas claro e escuro, então seguem os tokens da identidade, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Total da venda (arredondamento por linha), parcelas (RN11, 1x a 12x), vencimentos (fim de mês, fuso), troco | Unitário | CA-04, INV-003, INV-004 |
| T02 | Validação do carrinho e dos pagamentos (soma, formas, parcelas, quantidades) | Unitário | CA-05 |
| T03 | Venda à vista: venda, item, baixa, lançamento | Integração | CA-01, INV-005, INV-006 |
| T04 | Serviço com materiais: baixas e custo unitário | Integração | CA-02, INV-006, INV-007 |
| T05 | Estoque insuficiente (produto e material) e vendas simultâneas | Integração | CA-03, INV-006 |
| T06 | Pagamento misto e parcelado: lançamento, parcelas e contas | Integração | CA-04, INV-004, INV-005 |
| T07 | Soma divergente e preço adulterado | Integração | CA-05, CA-06, INV-002, INV-003 |
| T08 | Item sem preço, arquivado e de outro negócio | Integração | CA-07 |
| T09 | Mesmo carrinho duas vezes, inclusive em paralelo | Integração | CA-08, INV-009 |
| T10 | Falha simulada na última conta a receber desfaz tudo | Integração | CA-09, INV-001 |
| T11 | Cliente cadastrado na hora e venda sem cliente | Integração | CA-10 |
| T12 | Histórico por período (fuso de São Paulo) e detalhe | Integração | CA-11 |
| T13 | Permissões: Colaborador, sem *criar*, sem *ver*, ações chamadas direto, menu | Integração | CA-12, INV-008 |
| T14 | Venda com 20 linhas e histórico com 1.000 vendas em menos de 2 s | Integração | RNF06 |
| T15 | Telas em 390/768/1440 px, claro e escuro, em build de produção com login | Manual com captura | CA-13 |
| T16 | Fluxo completo na homologação | Manual (uma vez) | CA-01 a CA-12 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 09/10/2026, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Desconto | **Sem desconto no MVP:** o preço é sempre o oficial (RN15). |
| **OPEN-002** — Data da venda | **Agora por padrão, com data retroativa de até 7 dias** (dia local de São Paulo). A baixa de estoque e os lançamentos usam a mesma data. |
| **OPEN-003** — Vencimento das parcelas | **Parcela k vence no mesmo dia da venda, k meses depois**; se o mês não tiver esse dia, no último dia do mês. 1x vence no mês seguinte. |
| **OPEN-004** — Troco | **Só calculado na tela** ("valor recebido"); o pagamento grava o valor da venda. |
| **OPEN-005** — Clientes | **Busca e cadastro rápido dentro da venda** (nome e contato opcional). Lista e edição de clientes ficam para depois. |
| **OPEN-006** — Quem registrou | **Novo `Venda.registradaPorId`**, exibido no histórico e no detalhe. |
| **OPEN-007** — Número da venda | **Sequencial por negócio** (`Venda.numero`, único por negócio), atribuído na transação, sem buracos. |

---

## 14. Definition of Done da Spec

A SPEC-008 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-13) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-009) estiverem preservados;
- [ ] os testes derivados (T01 a T16) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-007 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
