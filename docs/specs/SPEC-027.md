# SPEC-027 — Compras de fornecedores integradas ao estoque e ao financeiro

> **Status:** ✅ **Aprovada em 21/11/2026.** Proposta documentada em 14/11/2026; as questões em aberto foram decididas pela equipe em entrevista (seção 13):
> - **custo do produto escolhido em cada compra**, produto por produto, com o **custo médio** já marcado; as outras escolhas são o custo desta compra e manter o atual (OPEN-001);
> - **fornecedor e nº do documento obrigatórios**, com o nº único por fornecedor; a compra **sem nota fiscal** é marcada como tal e fica sem o nº (OPEN-002, a pedido da usuária);
> - só **produtos físicos do Catálogo**, com "Novo produto" sem sair da compra (OPEN-003);
> - **à vista, a prazo em 1 a 12 parcelas, ou entrada + parcelas**, com a entrada opcional; **toda compra gera contas a pagar**, inclusive a à vista e a entrada, e o caixa só muda quando o pagamento é confirmado no Financeiro (OPEN-004, a pedido da usuária);
> - **frete, outras despesas e desconto** rateados no custo (OPEN-005);
> - **cancelar a compra inteira**, com motivo, numa transação (OPEN-006);
> - **permissões sem mudar a matriz** (OPEN-007);
> - item **"Compras" no menu**, com atalhos no Estoque e no fornecedor (OPEN-008);
> - **nova versão da Política com novo aceite** (OPEN-009);
> - **sem relatório novo** (OPEN-010).
>
> A baseline foi ajustada: RF91 e RN43 novos; RF08, RF15, RF30, RF89, RF90 e RNF05 alterados. Nada desta Spec foi implementado ainda; a implementação é por etapas (seção 14). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a pedido da equipe. Origem: pendência 8 do Mapa, das melhorias de Estoque e Financeiro pedidas em 01/11/2026 a partir do uso real por uma usuária com CNPJ. É a terceira dessas Specs: usa o histórico de custo da SPEC-025 e os fornecedores da SPEC-026. A SPEC-019, concluída antes desta por decisão da equipe (01/11/2026), já garante que a compra nasce fora das correções do suporte e recusada em negócio suspenso.
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:**
>   - [SPEC-007](SPEC-007.md): entrada no estoque pela compra; a saída do cancelamento da compra não conta como consumo;
>   - [SPEC-009](SPEC-009.md): contas a pagar geradas pela compra, com a origem "Compra"; a saída no caixa vem do pagamento de cada conta;
>   - [SPEC-025](SPEC-025.md): o histórico de custo recebe os custos das compras (conforme a OPEN-001);
>   - [SPEC-026](SPEC-026.md): o detalhe do fornecedor mostra as compras; a exclusão considera as compras; o filtro de origem das contas ganha "Compra";
>   - [SPEC-014](SPEC-014.md): a exportação dos dados inclui as compras.
> - **Usa:**
>   - [SPEC-001](SPEC-001.md) (isolamento), [SPEC-005](SPEC-005.md) (permissões) e [SPEC-006](SPEC-006.md) (produtos e custo);
>   - [SPEC-008](SPEC-008.md) (número sequencial e parcelas) e [SPEC-011](SPEC-011.md) (modelo do cancelamento);
>   - [SPEC-013](SPEC-013.md) (limite do plano gratuito), [SPEC-016](SPEC-016.md) (componentes) e [SPEC-024](SPEC-024.md) (busca pelo código interno);
>   - [SPEC-018](SPEC-018.md) e [SPEC-019](SPEC-019.md) (modo suporte, lista fechada de correções e negócio suspenso).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-027 |
| **Nome** | Compras de fornecedores integradas ao estoque e ao financeiro |
| **Objetivo** | Registrar uma **compra de fornecedor** numa tela só: o fornecedor, o nº da nota, os produtos com quantidade e custo unitário e a forma de pagar. Ao confirmar, o HE grava tudo de uma vez: a **entrada no estoque** de cada produto, as **contas a pagar** (à vista, entrada e parcelas) e o **custo** dos produtos (conforme a OPEN-001). A saída no caixa só acontece quando cada conta é paga no Financeiro. |
| **Valor entregue** | O negócio para de registrar a mesma compra em três lugares. O estoque, o caixa, as contas e o custo ficam coerentes entre si, e cada entrada e cada conta mostram de qual compra vieram. A lista de compras responde quanto se comprou de cada fornecedor no período, e o inventário de fim de mês (SPEC-025) sai com o custo do que foi pago. |

### O que muda nas compras

Hoje o HE não tem compra. Para registrar uma compra de mercadoria, o negócio faz três operações separadas, sem ligação entre elas:
1. **Estoque › Registrar entrada**, produto por produto, com a quantidade e a data, sem o custo;
2. **Financeiro:** um lançamento de saída (compra à vista, sem fornecedor nem forma) ou uma conta a pagar com o fornecedor e o nº da nota (compra a prazo);
3. **Catálogo:** editar o custo do produto, se mudou.

Com esta Spec:
- **Registrar compra:** uma tela com o fornecedor, o nº do documento, a data, os produtos (quantidade e custo unitário), o frete e o desconto (OPEN-005) e a forma de pagar (OPEN-004). Antes de confirmar, um resumo mostra o que vai acontecer no estoque, no financeiro e no custo.
- **Gravação:** tudo numa transação. Se algo falhar, nada é gravado.
- **Lista e detalhe:** cada compra tem um número. A lista tem busca, filtros e total, e o detalhe liga a compra às entradas do estoque e ao lançamento ou às contas.
- **Cancelamento:** uma compra registrada errada é desfeita de uma vez (OPEN-006).

### Exemplo que originou a Spec

A loja do exemplo da SPEC-026 compra da fornecedora "Embalagens Exemplo Ltda" 100 embalagens P a R$ 1,20 e 50 embalagens G a R$ 2,00. A nota 1234 soma R$ 220,00, a pagar em boleto para 28 dias. Antes da compra, a loja tinha 20 embalagens P com custo de R$ 1,00. Os valores são fictícios.
- **Hoje:** a dona registra duas entradas no Estoque, cria a conta a pagar de R$ 220,00 com a fornecedora e o nº 1234 e, como a embalagem P subiu, edita o custo no Catálogo. Se esquecer uma das três, o estoque, o caixa ou o custo ficam errados. Nada liga a entrada à conta, e o inventário do fim do mês sai com o custo antigo.
- **Com esta Spec:**
  - em **Compras › Registrar compra**, ela escolhe a fornecedora, informa o nº 1234 e adiciona os dois produtos pelo nome ou pelo código interno, com a quantidade e o custo unitário;
  - escolhe **A prazo**, 1 parcela, com vencimento em 28 dias;
  - o resumo mostra: "+100 Embalagem P", "+50 Embalagem G", "Conta a pagar de R$ 220,00 com vencimento em {data}" e, para a Embalagem P, o custo atual (R$ 1,00), o desta compra (R$ 1,20) e o médio (R$ 1,17), com o médio já marcado (OPEN-001). Ela mantém o médio;
  - ela confirma, e a compra recebe o nº 1;
  - no Estoque, as entradas mostram "Compra nº 1"; no Financeiro, a conta mostra a origem "Compra nº 1", a fornecedora e o nº 1234;
  - ao pagar a conta, ela escolhe Boleto, como em qualquer conta (SPEC-026).

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF91** (novo) | Registrar compra de fornecedor numa só operação, com a entrada no estoque, as contas a pagar (à vista, entrada e parcelas) e o custo dos produtos; lista com busca, filtros e total; detalhe ligado às movimentações e às contas; correção do fornecedor e do nº do documento; cancelamento (OPEN-006). |
| | RF15 | **Alterado:** a entrada de estoque também acontece pela compra. A entrada manual continua igual. |
| | RF08 | **Alterado:** o custo do produto físico também muda pela compra, conforme a escolha na compra (OPEN-001), com registro no histórico de custo. |
| | RF30 | **Alterado:** a conta a pagar pode nascer de uma compra, com o fornecedor e o nº do documento da compra e a origem "Compra". |
| | RF89 | **Alterado:** o detalhe do fornecedor mostra as compras dele. |
| | RF90 | **Alterado:** o filtro de origem da lista de contas ganha "Compra". |
| | RF29, RF31, RF32 | Usados: toda compra vira contas a pagar na categoria Fornecedores; cada conta é paga como as outras, com a forma obrigatória, e só então sai do caixa. |
| | RF20 | Usado: a entrada da compra conta para o ciclo do mínimo sugerido; a saída do cancelamento é um estorno e não conta como consumo. |
| | RF46, RF47 | Usados: compras nos dois planos, sem limite de quantidade; a lista do plano gratuito mostra os últimos 12 meses. |
| | RF62, RF70 | Usados: as vendas guardam o custo do momento; uma compra nunca muda o custo de vendas passadas. |
| | RF88 | Usado: o inventário numa data passa a trazer o custo das compras pelo histórico de custo (conforme a OPEN-001). |
| **RN** | **RN43** (nova) | Regras da compra: gravada inteira ou nada; fornecedor e nº do documento obrigatórios, com o nº único por fornecedor, salvo na compra sem nota fiscal (OPEN-002); só produtos físicos ativos; total = produtos + frete + outras despesas − desconto (OPEN-005); toda compra gera contas a pagar, inclusive a à vista e a entrada, e o caixa só muda no pagamento (OPEN-004); custo escolhido na compra, com o médio marcado (OPEN-001); cancelamento em transação única (OPEN-006); a compra nunca é apagada. |
| | RN03, RN04 | Usadas: só produtos físicos têm estoque; serviços não entram na compra. |
| | RN11 | Usada como modelo: as parcelas são iguais, com a diferença de centavos na 1ª (OPEN-004). |
| | RN14 | Usada: nenhuma compra mexe no saldo do caixa até o pagamento de cada conta, nem a à vista. |
| | RN15 | Usada: o preço oficial não muda sozinho quando o custo muda; a tela leva à Calculadora. |
| | RN22 | Usada: o pagamento de cada conta da compra (inclusive a à vista e a entrada) gera o lançamento com a forma. |
| | RN25 | Usada como modelo do cancelamento da compra (OPEN-006). |
| | RN37, RN39 | Mantidas: a compra fica fora da lista fechada de correções do suporte e é recusada em negócio suspenso. |
| | RN41 | Usada: o custo no inventário vem do histórico de custo, que passa a receber as compras. |
| | RN27, RN42 | Usadas: o fornecedor com compras é anonimizado, não apagado; as compras ficam com os mesmos valores. |
| **RNF** | RNF01 | Telas de compra em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | Compras isoladas por negócio. |
| | RNF04 | Compras na exportação dos dados; fornecedor mascarado conforme a permissão e no suporte. |
| | RNF05 | **Alterado:** a entrada pela compra e a mudança de custo pela compra são auditáveis e ligadas à compra. |
| | RNF06 | Registrar e listar compras dentro do tempo da seção 10. |
| **Decisões anteriores** | SPEC-007, OPEN-005 | Data das movimentações: hoje ou até 90 dias atrás. Vale para a data da compra. |
| | SPEC-008, OPEN-007 | Número sequencial da venda por negócio, gravado na transação: modelo do número da compra. |
| | SPEC-009, OPEN-003 | Lançamentos nunca são alterados nem apagados; só a conta manual sem pagamento é editável. O lançamento e as contas da compra seguem a mesma regra. |
| | SPEC-011 | Cancelamento de venda em transação única: modelo do cancelamento da compra (OPEN-006). |
| | SPEC-013, OPEN-005 | Plano gratuito: histórico dos últimos 12 meses. |
| | SPEC-019, OPEN-005 | Lista fechada de correções do suporte; ação nova nasce proibida. |
| | SPEC-025 | Histórico de custo; o custo novo vale a partir do registro, sem reescrever o passado. |
| | SPEC-026, OPEN-007 e OPEN-008 | Fornecedor e nº do documento corrigíveis a qualquer momento; forma obrigatória só nas contas; "a compra à vista com fornecedor fica com a SPEC-027". |
| **Caso de uso / fluxo** | Registrar compra (novo); Estoque (SPEC-007); Financeiro (SPEC-009) | Ver seção 5. |
| **Entidades** | `Compra` e `ItemCompra` (novas); `MovimentacaoEstoque`, `LancamentoFinanceiro`, `ContaPagarReceber`, `HistoricoCusto`, `Item`, `Fornecedor`, `Negocio` | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor), ADR-005 (regras puras em TypeScript, como o motor de precificação) | Ver seção 8. |

### Texto da baseline (aprovado em 21/11/2026)

- **RF91 (novo):** O sistema deve permitir **registrar uma compra de fornecedor** numa só operação: fornecedor, nº do documento (ou a marcação de compra sem nota fiscal), data, produtos físicos com quantidade e custo unitário, frete, outras despesas e desconto, e a forma de pagar (à vista, a prazo em 1 a 12 parcelas, ou entrada + parcelas). Ao confirmar, o sistema dá a entrada de cada produto no estoque, gera as contas a pagar (à vista e entrada, com vencimento na data da compra, e parcelas), que saem do caixa só quando o pagamento é registrado, e atualiza o custo de cada produto pela escolha feita na compra (RN43). As compras ficam numa lista com busca, filtros e total, e o detalhe liga cada compra às movimentações e às contas; uma compra pode ser cancelada com motivo (SPEC-027).
- **RN43 (nova):** Compra: gravada inteira ou nada; fornecedor obrigatório e nº do documento obrigatório e único por fornecedor entre as compras não canceladas, salvo na compra marcada sem nota fiscal; só produtos físicos ativos; total = produtos + frete + outras despesas − desconto, rateados no custo das linhas; toda compra gera contas a pagar (à vista e entrada com vencimento na data da compra, e as parcelas), e o caixa só muda no pagamento de cada conta; o custo de cada produto é o escolhido na compra (custo médio ponderado, já marcado; custo desta compra; ou o atual), a partir do registro; cancelamento em transação única, como o da venda; nunca apagada; fora das correções do suporte.
- **RF08, RF15, RF30, RF89, RF90 e RNF05:** os acréscimos descritos na tabela acima. O `requisitos_ears.md` recebe o RF91 e a RN43 no mesmo formato.

---

## 3. Escopo

### Incluído

1. **Registrar compra:**
   - fornecedor (OPEN-002), com "Novo fornecedor" sem sair da compra para quem pode cadastrá-lo (SPEC-026);
   - nº do documento, data da compra e observação;
   - produtos buscados pelo nome ou pelo código interno, com quantidade, custo unitário e o total da linha (OPEN-003);
   - frete, outras despesas e desconto (OPEN-005);
   - forma de pagar: à vista, a prazo ou entrada + parcelas, sempre como contas a pagar (OPEN-004);
   - resumo antes de confirmar: as entradas, o lançamento ou as contas, e o custo atual e o novo de cada produto (OPEN-001).
2. **Gravação numa transação:** número da compra, entradas no estoque, lançamento ou contas a pagar e custo dos produtos.
3. **Lista de compras:** busca (fornecedor, nº do documento ou nº da compra), filtros (período, fornecedor e situação) e o total da lista filtrada.
4. **Detalhe da compra:** produtos, frete e desconto, o lançamento ou as contas com a situação de cada uma, as entradas no estoque, quem registrou e quando.
5. **Ligações:**
   - a entrada no histórico do Estoque mostra "Compra nº N";
   - o lançamento e as contas mostram a origem "Compra nº N", e o filtro de origem das contas ganha "Compra";
   - o detalhe do fornecedor mostra as compras dele.
6. **Correção do fornecedor e do nº do documento** da compra a qualquer momento, sem mexer em valores; a correção vale também para as contas da compra.
7. **Cancelamento** da compra (OPEN-006).
8. **Permissões** (OPEN-007) e **lugar no menu** (OPEN-008).
9. **Plano:** nos dois planos; a lista do plano gratuito mostra os últimos 12 meses.
10. **Modo suporte e negócio suspenso:** o suporte vê as compras com o fornecedor mascarado e nunca registra, corrige nem cancela; o negócio suspenso não registra compras.
11. **LGPD:** compras na exportação dos dados; fornecedor com compras anonimizado na exclusão; texto da Política de Privacidade (OPEN-009).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Editar os produtos, as quantidades ou os valores de uma compra registrada | Fora: cancela e registra de novo (OPEN-006). Só o fornecedor e o nº do documento são corrigíveis. |
| Devolução parcial ao fornecedor e nota de devolução | Fora; a nota de devolução entra com a Spec da nota fiscal (pendência "Dados do emitente"). |
| Importar o XML da nota fiscal de entrada | Fora: evolução, junto com a Spec da nota fiscal. |
| Pedido de compra, cotação e sugestão de compra pelo estoque mínimo | Fora: evolução. |
| O caminho inverso: um lançamento ou uma conta do Financeiro virar entrada de estoque | Fora (combinado com a equipe em 01/11/2026): a entrada acontece pela compra, que gera o financeiro. |
| Compra de serviços ou de material de consumo sem estoque | Conta a pagar ou lançamento do Financeiro (SPEC-009 e SPEC-026), salvo se a OPEN-003 for (b). |
| Relatório de compras nos Relatórios | OPEN-010. |
| Crédito de impostos (ICMS, IPI) na compra | Fora: o custo é o valor pago; o Simples e o MEI não usam crédito de imposto no HE. |
| Mudar o custo de vendas já registradas | Fora: cada venda guarda o custo do momento (RF62). |
| Lote, validade e número de série | Fora. |
| Mais de um depósito ou local de estoque | Fora: o HE tem um estoque por negócio. |
| Compra em moeda estrangeira e importação | Fora. |
| Correções da compra pelo suporte | Fora: a compra não entra na lista fechada (RN37). Incluí-la exigiria nova decisão da equipe. |

---

## 4. Dependências

- **Specs:**
  - SPEC-007: entrada de estoque, a primitiva de movimentação e o consumo para o mínimo sugerido;
  - SPEC-009: caixa, contas a pagar e pagamentos;
  - SPEC-026: fornecedores, vínculo e nº do documento nas contas, forma do pagamento e filtros das contas;
  - SPEC-025: histórico de custo e inventário numa data;
  - SPEC-006 e SPEC-024: produtos físicos, custo e busca pelo código interno;
  - SPEC-008: número sequencial e divisão das parcelas;
  - SPEC-011: modelo do cancelamento;
  - SPEC-005: matriz módulo × ação;
  - SPEC-013: limite de 12 meses do plano gratuito;
  - SPEC-014: exportação dos dados e exclusão de conta;
  - SPEC-001: isolamento, `modelos.ts`, RLS e o gatilho de mesmo negócio;
  - SPEC-016: campos, listas, gavetas, avisos e estados vazios;
  - SPEC-018 e SPEC-019: modo suporte, lista fechada de correções e negócio suspenso.
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-003 (autorização no servidor), ADR-005 (regras puras em TypeScript, como no estoque e na precificação).
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Registrar compra

1. Quem tem a permissão (OPEN-007) abre **Registrar compra** (OPEN-008).
2. Preenche:
   - **fornecedor** (obrigatório, OPEN-002), buscado pelo nome ou documento; "Novo fornecedor" abre o formulário da SPEC-026 no lugar da compra, que volta com o que foi digitado e o fornecedor escolhido;
   - **nº do documento** (obrigatório, até 40 caracteres, como nas contas), único por fornecedor entre as compras não canceladas (OPEN-002). A caixa **"Compra sem nota fiscal"** (por exemplo, numa feira ou de pessoa física) dispensa o nº: o campo some, e a compra aparece como "Sem nota" na lista e no detalhe;
   - **data da compra:** hoje, por padrão, ou até 90 dias atrás;
   - **observação** (opcional, até 200 caracteres).
3. Adiciona os **produtos** (5.2), o **frete e o desconto** (OPEN-005) e a **forma de pagar** (5.3).
4. Clica em **Revisar**. O resumo mostra:
   - cada produto com a quantidade que entra, o saldo atual e o novo;
   - as contas a pagar (à vista, entrada e parcelas), com valor e vencimento;
   - para cada produto, o custo atual, o desta compra (com o rateio) e o médio, com o **médio já marcado**; a pessoa pode trocar a escolha de cada produto (5.5, OPEN-001).
5. Clica em **Confirmar compra**. O servidor valida tudo de novo e grava numa transação (5.4). A tela mostra "Compra nº N registrada." e leva ao detalhe.
6. Para cada produto cujo custo mudou, o detalhe mostra "O custo mudou. Revise o preço na Calculadora." com o link para a Calculadora do item. O preço oficial só muda quando alguém confirma (RN15).

### 5.2 Produtos da compra (OPEN-003)

- A busca mostra só **produtos físicos ativos** do negócio, pelo nome ou pelo código interno (código exato + Enter, como na Nova venda).
- Cada linha tem: **quantidade** (maior que zero, até 3 casas, como o estoque), **custo unitário** (maior ou igual a zero, 2 casas) e o **total da linha** (quantidade × custo unitário, arredondado ao centavo).
- O mesmo produto não aparece em duas linhas: ao adicionar de novo, o HE leva à linha que já existe.
- Até 100 linhas por compra.
- O custo unitário vem preenchido com o custo atual do produto e pode ser trocado.

### 5.3 Forma de pagar (OPEN-004)

Decidido na entrevista (OPEN-004, opção com entrada):
**Toda compra gera contas a pagar**, inclusive a à vista e a entrada (pedido da usuária, 21/11/2026, como a SPEC-029 fará com as vendas). Nenhuma compra sai do caixa no registro: o caixa só muda quando alguém **confirma o pagamento** de cada conta no Financeiro, com a forma (Dinheiro, Pix, Cartão de débito, Boleto, Transferência ou Outra), como em qualquer conta (SPEC-026). Assim, o pagamento fica conferido antes de entrar no caixa.
- **À vista:** uma conta a pagar com o total da compra e vencimento na data da compra.
- **A prazo:** de 1 a 12 parcelas, **com entrada opcional**. Sem entrada, todo o total vira parcelas. Com entrada, a pessoa informa o valor (maior que zero e menor que o total); a entrada vira uma conta a pagar com vencimento na data da compra, e o resto vira as parcelas.
- Enquanto a conta à vista ou a da entrada não é paga, ela aparece nas contas a pagar como "vence hoje" ou, numa compra com data passada, como atrasada, para lembrar de confirmar o pagamento.
- **Parcelas:** de 1 a 12. Os vencimentos são sugeridos a cada 30 dias depois da data da compra e podem ser trocados, sem ficar antes da data da compra. Os valores são iguais, com a diferença de centavos na 1ª (como a RN11). Cada parcela vira uma conta a pagar; a forma é escolhida ao pagar cada uma.
- **Cartão de crédito do negócio:** entra como "A prazo", com o vencimento na fatura, para o caixa sair no dia em que a fatura é paga (RN14). A tela explica isso ao lado da opção.

### 5.4 O que é gravado (numa transação)

| Onde | O que acontece |
|---|---|
| **Compra** | Número sequencial do negócio, fornecedor, nº do documento, data, observação, produtos, frete, outras despesas, desconto, total, condição (à vista ou a prazo) e o valor da entrada, quem registrou e quando. Situação "Registrada". |
| **Estoque** | Uma movimentação de entrada por produto, com a quantidade, a data da compra e a ligação com a compra, pela mesma primitiva da entrada manual (SPEC-007). |
| **Financeiro (à vista)** | Uma conta a pagar: valor = total da compra, categoria Fornecedores, fornecedor e nº do documento da compra, vencimento na data da compra, descrição "Compra nº N — à vista", origem "Compra". Nenhum lançamento no caixa. |
| **Financeiro (entrada)** | Na compra a prazo com entrada, uma conta a pagar com o valor da entrada, vencimento na data da compra, descrição "Compra nº N — entrada", origem "Compra". |
| **Financeiro (a prazo)** | Uma conta a pagar por parcela: categoria Fornecedores, fornecedor e nº do documento da compra, descrição "Compra nº N — parcela i/n", vencimento e valor da parcela, origem "Compra". |
| **Custo** | Para cada produto cuja escolha muda o custo (5.5): o custo novo e um registro no histórico de custo, com o usuário e a ligação com a compra. Quem escolhe "manter o atual" não gera registro. |

Se qualquer parte falhar (por exemplo, um produto arquivado por outra pessoa enquanto a compra era preenchida), nada é gravado, e a tela diz o que impediu.

### 5.5 Custo do produto (OPEN-001)

Decidido na entrevista (OPEN-001, opção d): **quem registra escolhe, produto por produto**, entre três custos. O resumo mostra os três, com o **custo médio já marcado**. Com o exemplo da seção 1 (20 embalagens P a R$ 1,00; compra de 100 a R$ 1,20):

| Escolha | Regra | Custo depois da compra |
|---|---|---|
| **Custo médio** (marcado) | (saldo antes × custo atual + quantidade × custo desta compra) ÷ (saldo antes + quantidade). Com saldo antes igual a zero ou negativo, vale o custo desta compra. | (20 × 1,00 + 100 × 1,20) ÷ 120 = R$ 1,17 |
| **Custo desta compra** | O custo passa a ser o custo unitário da linha, com o rateio da OPEN-005. | R$ 1,20 |
| **Manter o atual** | O custo do produto não muda. A compra guarda o custo pago. | R$ 1,00 |

Quando os três valores são iguais (por exemplo, a primeira compra de um produto pelo mesmo custo do cadastro), o resumo mostra só um. A escolha fica gravada na linha da compra.

Nas escolhas que mudam o custo:
- o custo novo vale **a partir do registro da compra**, como uma edição no Catálogo (SPEC-025). O passado não é reescrito, mesmo numa compra com data retroativa;
- o custo é arredondado ao centavo, como o custo do produto;
- o histórico de custo mostra "Compra nº N" como origem;
- o custo dos serviços que usam o produto como material muda junto, porque é calculado pelos materiais (RF35);
- as vendas já registradas não mudam (RF62).

No custo médio, o saldo antes é o saldo do produto no momento do registro; a entrada manual do Estoque, que não tem custo, já está nele ao custo atual.

### 5.6 Lista, detalhe e ligações

- **Lista de compras:**
  - colunas: nº, data, fornecedor, nº do documento, total, condição (à vista ou a prazo) com a situação das contas (por exemplo, "A pagar", "Paga em parte" ou "Paga") e situação da compra (Registrada ou Cancelada);
  - busca pelo nome do fornecedor, pelo nº do documento ou pelo nº da compra;
  - filtros: período da data da compra, fornecedor e situação;
  - total da lista filtrada, somando todas as páginas, sem as canceladas;
  - plano gratuito: só os últimos 12 meses, com o aviso do plano (SPEC-013).
- **Detalhe:** os dados da compra, os produtos com quantidade, custo unitário e total, o frete, as outras despesas e o desconto, o lançamento ou as contas (com a situação e os pagamentos), as entradas no estoque, o custo anterior e o novo de cada produto, quem registrou e quando, e, se cancelada, quem cancelou, quando e o motivo.
- **Estoque:** no histórico do produto, a entrada aparece como "Entrada — Compra nº N", com link para a compra para quem pode vê-la.
- **Financeiro:** o lançamento e as contas mostram "Compra nº N", com link para a compra; o filtro de origem das contas ganha "Compra".
- **Fornecedor:** o detalhe ganha a lista das compras do fornecedor (até 50, as mais recentes) e o total comprado.

### 5.7 Correção e cancelamento (OPEN-006)

- **Correção:** o fornecedor e o nº do documento da compra (ou a marcação "sem nota fiscal") podem ser corrigidos a qualquer momento, sem mexer em valores, com a mesma regra de unicidade. A correção vale também para as contas da compra, que não são corrigidas sozinhas (SPEC-026, OPEN-007).
- **Cancelamento** (OPEN-006, decidido na entrevista):
  - cancela a compra inteira, com motivo obrigatório (até 200 caracteres), numa transação;
  - o estoque de cada produto sai pela quantidade da compra, numa movimentação de estorno ligada à compra. Se o saldo atual de algum produto não cobre, o cancelamento é recusado: "Não dá para cancelar: o saldo de {produto} é menor que a quantidade da compra.";
  - as contas sem pagamento são canceladas; os pagamentos já feitos das contas (inclusive a à vista e a entrada) são estornados no caixa;
  - o custo de cada produto cuja escolha mudou o custo volta ao anterior, com novo registro no histórico, **só** se o custo atual ainda é o que a compra gravou; senão, fica como está, e o detalhe avisa para revisar no Catálogo;
  - a compra cancelada libera o nº do documento: a nota pode ser registrada de novo, corrigida;
  - a compra fica "Cancelada", nunca é apagada, e sai do total da lista.
- As contas da compra não são editadas nem canceladas sozinhas pelo Financeiro; o caminho é cancelar a compra. O pagamento das contas, e o estorno de um pagamento feito errado (SPEC-028), continuam pelo Financeiro.

### 5.8 Permissões, menu e plano

- **Permissões** (OPEN-007, decidido na entrevista), sem mudar a matriz:
  - registrar exige *Estoque: criar* e *Financeiro: criar*;
  - ver a lista e o detalhe exige *Estoque: ver* e *Financeiro: ver*;
  - corrigir o fornecedor e o nº do documento exige *Financeiro: editar*;
  - cancelar exige *Estoque: excluir* e *Financeiro: excluir*;
  - o custo muda pela regra da compra, sem exigir *Catálogo: editar*, como a venda dá baixa no estoque sem exigir permissão no Estoque;
  - o Colaborador padrão (Estoque: ver e criar, sem Financeiro) não registra compras, a menos que o Dono dê as permissões.
- **Menu** (OPEN-008, decidido na entrevista):
  - novo item **"Compras"** no menu lateral, logo abaixo de "Vendas", para quem pode ver as compras; no celular, fica no "Mais", como os outros itens fora da barra de baixo;
  - a página Compras tem a lista e o botão **"Registrar compra"**;
  - **atalhos** "Registrar compra": um botão no topo da página do **Estoque**, ao lado das ações que já existem, e outro no **detalhe do fornecedor** (Financeiro › Fornecedores), que já abre a compra com o fornecedor escolhido;
  - os atalhos só aparecem para quem pode registrar compras.
- **Plano:** nos dois planos, sem limite de quantidade (RF46, RF47, RN18). A lista do plano gratuito mostra os últimos 12 meses.

### 5.9 Modo suporte e negócio suspenso

- **Modo suporte:** com o Estoque e o Financeiro liberados, o Administrador vê a lista e o detalhe das compras, com o fornecedor mascarado, inclusive o nome (SPEC-026, OPEN-011). Nunca registra, corrige nem cancela uma compra, mesmo com os módulos em "ver e corrigir": a compra não está na lista fechada (RN37). As telas de compra entram no registro de telas abertas do suporte.
- **Negócio suspenso:** registrar, corrigir e cancelar são recusados (RN39); a lista e o detalhe continuam visíveis.

### 5.10 LGPD (OPEN-009)

- A exportação dos dados (SPEC-014) inclui as compras e os produtos de cada compra.
- Excluir um fornecedor com compras o anonimiza, em vez de apagar (RN42); as compras ficam com os mesmos valores e o nº do documento.
- A exclusão de conta do único Dono anonimiza os fornecedores, e as compras continuam sem identificação (RN27).
- A Política de Privacidade diz hoje que o fornecedor é apagado "se não tiver contas nem despesas fixas". O texto passa a incluir as compras numa **nova versão, com novo aceite** (OPEN-009), como nas SPEC-022 e SPEC-026.

### 5.11 Mensagens

| Situação | Mensagem |
|---|---|
| Sem fornecedor (OPEN-002) | "Escolha o fornecedor." |
| Sem nº do documento, sem marcar "sem nota" (OPEN-002) | "Informe o nº do documento ou marque "Compra sem nota fiscal"." |
| Sem produtos | "Adicione pelo menos um produto." |
| Quantidade zero ou negativa | "Informe uma quantidade maior que zero." |
| Custo negativo | "O custo não pode ser negativo." |
| Produto arquivado ou excluído durante a compra | "{produto} não está mais disponível. Remova-o da compra." |
| Data fora do período | "Use uma data entre hoje e 90 dias atrás." |
| Vencimento antes da compra | "O vencimento não pode ser antes da data da compra." |
| Total zero ou negativo | "O total da compra precisa ser maior que zero." |
| Desconto maior que os produtos | "O desconto não pode passar do valor dos produtos." |
| Documento repetido (OPEN-002) | "Este fornecedor já tem a compra nº {N} com o documento {nº}. Confira o número ou cancele a compra anterior." |
| Entrada fora do total (OPEN-004) | "A entrada precisa ser maior que zero e menor que o total da compra." |
| Cancelamento sem saldo | "Não dá para cancelar: o saldo de {produto} é menor que a quantidade da compra." |
| Compra já cancelada | "Esta compra já foi cancelada." |
| Suporte ou negócio suspenso | As mensagens da SPEC-019. |

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | A compra é gravada inteira ou nada: número, produtos, entradas, lançamento ou contas e custo. | Teste de integração com falha forçada no meio (produto arquivado entre a revisão e a confirmação). |
| **INV-002** | Total = soma das linhas + frete + outras despesas − desconto, maior que zero. À vista, a conta é igual ao total; a prazo, a entrada (se houver) + a soma das parcelas é igual ao total, com os centavos na 1ª parcela. | Teste unitário das contas; teste de integração conferindo o banco. |
| **INV-003** | Cada linha gera uma entrada no produto da linha, com a quantidade da linha e a ligação com a compra, pela primitiva de movimentação; compras e vendas simultâneas nunca deixam o saldo errado. | Teste de integração com compras e vendas simultâneas. |
| **INV-004** | A compra só tem produtos físicos ativos e fornecedor do mesmo negócio; o banco recusa o contrário. | Teste de integração com gravação direta. |
| **INV-005** | O número da compra é sequencial por negócio e nunca se repete, mesmo com compras simultâneas. | Teste de integração com compras simultâneas. |
| **INV-006** | Toda mudança de custo pela compra gera um registro no histórico de custo, com o usuário e a compra; nenhum registro é alterado ou apagado (RNF05). | Teste de integração. |
| **INV-007** | Nenhuma compra muda o saldo do caixa no registro, nem a à vista nem a entrada; o caixa só muda no pagamento de cada conta (RN14, OPEN-004). | Teste de integração do saldo antes e depois. |
| **INV-008** | O cancelamento é inteiro ou nada; é recusado se algum saldo ficaria negativo; a compra cancelada nunca é apagada. | Teste de integração. |
| **INV-009** | O suporte nunca registra, corrige nem cancela compras; o negócio suspenso também não. | Teste de integração no contexto de suporte e com o negócio suspenso. |
| **INV-010** | Compras, filtros e totais só trazem dados do próprio negócio. | Teste de integração com dois negócios. |
| **INV-011** | Entre as compras não canceladas de um negócio, o par fornecedor + nº do documento nunca se repete; a compra sem nota fiscal não tem nº. O banco recusa o contrário, mesmo com compras simultâneas. | Teste de integração com gravação direta e compras simultâneas. |

---

## 7. Modelo de domínio envolvido

| Entidade | Uso | Mudança |
|---|---|---|
| `Compra` | A compra registrada | **Nova:** número (sequencial por negócio), fornecedor (obrigatório), nº do documento (vazio só na compra sem nota fiscal), sem nota fiscal (sim ou não), data da compra, observação, valor dos produtos, frete, outras despesas, desconto, total, condição (à vista ou a prazo), valor da entrada (a prazo, opcional), situação (registrada ou cancelada), quem registrou e quando, e quem cancelou, quando e o motivo |
| `ItemCompra` | Cada linha da compra | **Nova:** compra, produto, quantidade, custo unitário informado, total da linha, o custo com o rateio (OPEN-005), a escolha do custo (médio, desta compra ou manter, OPEN-001) e o custo anterior e o novo do produto |
| `MovimentacaoEstoque` | Entradas e saídas | **+ ligação com a compra** (opcional, como a ligação com a venda); **novo tipo** para a saída do cancelamento da compra, fora do consumo (RF20) |
| `LancamentoFinanceiro` | Estornos do cancelamento | **+ ligação com a compra** (opcional), para os estornos dos pagamentos no cancelamento; os pagamentos das contas da compra seguem a origem de pagamento de conta, como hoje |
| `ContaPagarReceber` | Contas a pagar da compra | **+ ligação com a compra** (opcional, só a pagar) |
| `HistoricoCusto` | Histórico de custo (SPEC-025) | **+ ligação com a compra** (opcional), para mostrar a origem |
| `Negocio` | Contador | **+ próximo número de compra**, como o da venda |
| `Item` | Produto físico | O custo muda conforme a OPEN-001; nenhuma coluna nova |
| `Fornecedor` | Cadastro (SPEC-026) | Nenhuma: passa a ser ligado também às compras |

**Mudanças previstas no schema:**
- tabelas `Compra` e `ItemCompra`, com RLS, índices por negócio, por fornecedor e por data, e os modelos em `modelos.ts`;
- enums da condição e da situação da compra (a forma fica nos pagamentos das contas, SPEC-026);
- colunas de ligação com a compra em `MovimentacaoEstoque`, `LancamentoFinanceiro`, `ContaPagarReceber` e `HistoricoCusto`, com índices;
- valor novo nos enums do tipo da movimentação e da origem do lançamento;
- gatilho de mesmo negócio para o fornecedor, os produtos e as ligações;
- CHECKs: quantidade maior que zero, valores não negativos, total maior que zero, entrada só a prazo (maior que zero e menor que o total), nº do documento vazio se e só se a compra é sem nota fiscal, conta da compra só a pagar;
- índice único parcial de fornecedor + nº do documento entre as compras não canceladas (INV-011);
- migração sem dados novos: nada do que existe vira compra.

---

## 8. Impacto arquitetural

- `prisma/schema.prisma` e uma migração (seção 7).
- `src/lib/dominio/compras.ts` (novo), sem framework nem banco (ADR-005):
  - validação da compra e das linhas;
  - total, rateio (OPEN-005) e parcelas, reaproveitando a divisão da venda (RN11);
  - custo novo pela regra da OPEN-001;
  - mensagens.
- `src/lib/db/compras.ts` (novo):
  - registrar: número, `movimentar()` da SPEC-007 para cada linha, lançamento ou contas e custo com o histórico, numa transação;
  - listar com busca, filtros e total, calculados no banco; detalhar; corrigir o fornecedor e o nº do documento; cancelar.
- `src/lib/db/estoque.ts`: a entrada da compra no histórico do produto; o novo tipo de saída fora do consumo.
- `src/lib/db/financeiro.ts`: a origem "Compra" no lançamento, nas contas e no filtro; a recusa de estornar ou cancelar sozinho o que veio de uma compra.
- `src/lib/db/fornecedores.ts`: compras no detalhe; a exclusão considera as compras.
- `src/lib/db/lgpd.ts`: compras na exportação.
- `src/lib/dominio/suporte.ts`: as telas de compra no registro de telas abertas; `correcoes.ts` não muda (a compra fica fora da lista).
- **Ações e telas:**
  - Registrar compra, com o resumo; lista; detalhe; correção; cancelamento;
  - item no menu (OPEN-008) e atalhos no Estoque e no detalhe do fornecedor.
- **Documentos:** `MODELO_LOGICO_BANCO.md`, o modelo de domínio e o diagrama de casos de uso; a imagem do modelo lógico continua na dívida DT-03.
- Política de Privacidade (OPEN-009).
- Sem integração externa nova e sem dependência nova.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Revisar compra** | os campos da compra | o resumo: entradas (saldo atual e novo), lançamento, entrada e parcelas, e por produto o custo atual, o desta compra e o médio, com o médio marcado | `CampoInvalido`, `FornecedorNaoEncontrado`, `DocumentoRepetido`, `ItemNaoEncontrado`, `ItemSemEstoque`, `ItemArquivado`, `SemPermissao` |
| **Registrar compra** | fornecedorId, numeroDocumento ou semNotaFiscal, data, observacao?, linhas [{itemId, quantidade, custoUnitario, escolhaDoCusto}], frete?, outrasDespesas?, desconto?, condição (à vista; ou a prazo: entrada?, parcelas [{vencimento}]) | {compraId, numero} | os da revisão + `ForaDaListaDeCorrecoes`, `NegocioSuspenso` |
| **Listar compras** | busca?, período?, fornecedorId?, situação?, página | [{id, numero, data, fornecedor, numeroDocumento, total, condição, situação}], total da lista | `SemPermissao`, `CampoInvalido` (período invertido) |
| **Detalhar compra** | id | a compra, os produtos, o lançamento ou as contas com os pagamentos, as entradas, os custos e o cancelamento | `CompraNaoEncontrada`, `SemPermissao` |
| **Corrigir fornecedor e documento** | id, fornecedorId, numeroDocumento ou semNotaFiscal | a compra | `CompraNaoEncontrada`, `FornecedorNaoEncontrado`, `DocumentoRepetido`, `CampoInvalido`, `SemPermissao`, `ForaDaListaDeCorrecoes`, `NegocioSuspenso` |
| **Cancelar compra** | id, motivo | a compra cancelada, com os produtos cujo custo não voltou | `CompraNaoEncontrada`, `CompraJaCancelada`, `EstoqueInsuficiente`, `CampoInvalido`, `SemPermissao`, `ForaDaListaDeCorrecoes`, `NegocioSuspenso` |
| **Detalhar fornecedor** (SPEC-026) | id | + compras [{id, numero, data, total, situação}] (até 50) e total comprado | Sem mudança |
| **Listar contas** (SPEC-026) | + origem "Compra" | + compra {id, numero} em cada conta da compra | Sem mudança |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Registrar compra, resumo, lista e detalhe legíveis no celular, sem rolagem horizontal, com 30 linhas na compra. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login; axe sem violações. |
| **RNF02** | Compras e ligações isoladas por negócio (RLS e gatilho de mesmo negócio). | INV-004, INV-010. |
| **RNF04** | Compras na exportação; fornecedor mascarado conforme a permissão e no suporte. | Testes da exportação e do suporte. |
| **RNF05** | Entradas, custo e cancelamento auditáveis, ligados à compra, nunca alterados nem apagados. | INV-006, INV-008. |
| **RNF06** | Registrar uma compra com 100 linhas em até 2 s, e a lista com 5.000 compras filtrada em até 1 s, no build local. | Medição no build local. |

---

## 11. Critérios de aceitação

**CA-01 — Compra a prazo.** Dado o exemplo da seção 1, quando a compra é confirmada, então o saldo da Embalagem P passa de 20 para 120 e o da G sobe 50, nasce uma conta a pagar de R$ 220,00 com a fornecedora, o nº 1234, a categoria Fornecedores e a origem "Compra nº 1", e o saldo do caixa não muda.

**CA-02 — Compra à vista.** Dada uma compra à vista de R$ 150,00, quando é confirmada, então nasce uma conta a pagar de R$ 150,00 com vencimento na data da compra, categoria Fornecedores e descrição "Compra nº N — à vista", e o saldo do caixa não muda. Quando alguém registra o pagamento dessa conta no Financeiro, com Pix, então o caixa ganha a saída de R$ 150,00 com a forma Pix, e a conta fica paga.

**CA-03 — Parcelas e entrada.** Dada uma compra de R$ 100,00 a prazo em 3 parcelas, sem entrada, então as contas são de R$ 33,34, R$ 33,33 e R$ 33,33, com vencimentos sugeridos a 30, 60 e 90 dias e editáveis; um vencimento antes da data da compra é recusado. Dada uma compra de R$ 300,00 com entrada de R$ 100,00 e 2 parcelas, então nascem três contas a pagar: a entrada de R$ 100,00, com vencimento na data da compra, e duas parcelas de R$ 100,00; o caixa não muda até os pagamentos. Uma entrada de R$ 300,00 ou zero é recusada.

**CA-04 — Custo.** Dado o exemplo da seção 1, quando a pessoa revisa a compra, então a Embalagem P mostra R$ 1,00 (atual), R$ 1,20 (desta compra) e R$ 1,17 (médio), com o médio marcado. Confirmando com o médio, o custo passa a R$ 1,17, o histórico de custo mostra "Compra nº 1", o inventário de hoje usa o custo novo, e as vendas anteriores continuam com o custo da época; o detalhe leva à Calculadora para revisar o preço, que não muda sozinho. Escolhendo "Custo desta compra", o custo passa a R$ 1,20; escolhendo "Manter o atual", fica R$ 1,00, sem registro no histórico.

**CA-05 — Frete e desconto.** Dada uma compra com R$ 200,00 em produtos (R$ 120,00 e R$ 80,00), frete de R$ 20,00 e desconto de R$ 10,00, então o total é R$ 210,00 e (OPEN-005) os R$ 10,00 de frete menos desconto são rateados em proporção ao valor: R$ 6,00 na primeira linha e R$ 4,00 na segunda.

**CA-06 — Validações.** Quando alguém confirma sem fornecedor, sem o nº do documento e sem marcar "Compra sem nota fiscal", sem produtos, com quantidade zero, com custo negativo ou com data de mais de 90 dias, então aparece a mensagem da seção 5.11, e nada é gravado. Serviços e produtos arquivados não aparecem na busca, e o mesmo produto não entra em duas linhas.

**CA-07 — Tudo ou nada.** Dado um produto arquivado por outra pessoa depois da revisão, quando a compra é confirmada, então nada é gravado (nem as outras entradas, nem a conta, nem o custo), e a mensagem diz qual produto impediu.

**CA-08 — Número.** Dadas duas compras confirmadas ao mesmo tempo no mesmo negócio, então elas recebem números diferentes e seguidos.

**CA-09 — Ligações.** Dada a compra nº 1, então o histórico da Embalagem P mostra "Entrada — Compra nº 1", a conta mostra "Compra nº 1", o filtro de origem "Compra" a encontra, e o detalhe da fornecedora mostra a compra e o total comprado.

**CA-10 — Lista.** Dadas compras de dois fornecedores em outubro e novembro, quando alguém filtra o fornecedor A e o período de outubro, então só aparecem as compras do fornecedor A em outubro, com o total somando todas as páginas, sem as canceladas. No plano gratuito, compras de mais de 12 meses não aparecem.

**CA-11 — Correção.** Dada uma compra com as contas pagas, quando alguém com *Financeiro: editar* troca o fornecedor e o nº do documento, então a compra e as contas mudam, e valores, vencimentos, situação e pagamentos ficam iguais.

**CA-12 — Cancelamento.** Dada a compra nº 1 com a conta em aberto, quando alguém cancela com motivo, então o estoque volta ao saldo de antes, a conta fica cancelada, o custo volta ao anterior (se não mudou depois), a compra fica "Cancelada" e sai do total da lista. Dada uma compra cujos produtos já foram vendidos, quando alguém tenta cancelar, então aparece "Não dá para cancelar: o saldo de {produto} é menor que a quantidade da compra.", e nada muda.

**CA-13 — Permissões.** Dado um membro com *Estoque: criar* sem *Financeiro: criar*, então "Registrar compra" não aparece, e a ação é recusada no servidor. O Colaborador padrão não vê as compras.

**CA-14 — Documento repetido e compra sem nota.** Dada a compra nº 1 da fornecedora com o nº 1234, quando alguém registra outra compra dela com o nº 1234, então a compra é recusada com a mensagem da seção 5.11. Outro fornecedor pode usar o nº 1234, e depois de cancelar a compra nº 1 a fornecedora pode usá-lo de novo. Marcando "Compra sem nota fiscal", a compra é gravada sem o nº e aparece como "Sem nota".

**CA-15 — Suporte e suspensão.** Dado o Administrador em modo suporte com o Estoque e o Financeiro em "ver e corrigir", então ele vê as compras com o fornecedor mascarado e não consegue registrar, corrigir nem cancelar. Dado um negócio suspenso, então registrar, corrigir e cancelar são recusados.

**CA-16 — LGPD.** Quando o Dono exporta os dados, então as compras e os produtos de cada compra aparecem. Quando alguém exclui um fornecedor que só tem compras, então ele é anonimizado, e as compras continuam com os mesmos valores.

**CA-17 — Visual.** Dadas as telas de registrar compra, resumo, lista e detalhe, em 390, 768 e 1440 px, claro e escuro, então nada rola na horizontal, e o axe não aponta violações.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação da compra e das linhas, documento ou sem nota, total, rateio, entrada e parcelas, e os três custos (médio, desta compra, manter) | Unitário | CA-03, CA-04, CA-05, CA-06, INV-002 |
| T02 | Registrar compra no banco: à vista, a prazo e com entrada, entradas no estoque, contas a pagar sem lançamento no caixa, o pagamento depois, custo e histórico, número | Integração | CA-01, CA-02, CA-04, CA-09, INV-002, INV-003, INV-006, INV-007 |
| T03 | Tudo ou nada com falha forçada; compras e vendas simultâneas; números sem repetição | Integração | CA-07, CA-08, INV-001, INV-003, INV-005 |
| T04 | Gravação direta com produto ou fornecedor de outro negócio, serviço ou produto arquivado (o banco recusa) | Integração | INV-004 |
| T05 | Lista, filtros, busca e total no banco, com várias páginas e o plano gratuito; outro negócio fora | Integração | CA-10, INV-010 |
| T06 | Correção do fornecedor e do documento, valendo para as contas, sem mudar valores | Integração | CA-11 |
| T07 | Cancelamento: estoque, contas, estornos, custo, recusa sem saldo, estorno fora do consumo | Integração | CA-12, INV-008 |
| T08 | Permissões por papel e com permissões customizadas | Integração | CA-13 |
| T09 | Documento repetido recusado (inclusive simultâneo), liberado depois do cancelamento e entre fornecedores diferentes; compra sem nota | Integração | CA-14, INV-011 |
| T10 | Suporte e negócio suspenso: leitura mascarada, ações recusadas | Integração | CA-15, INV-009 |
| T11 | LGPD: exportação; exclusão de fornecedor com compras | Integração | CA-16 |
| T12 | Roteiro no navegador: registrar compra a prazo e à vista, "Novo fornecedor" na compra, resumo, detalhe, ligações no Estoque, no Financeiro e no fornecedor, filtros, correção, cancelamento e a Calculadora pelo link | Manual com captura | CA-01 a CA-16 |
| T13 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção com login, e axe | Manual com captura | CA-17 |
| T14 | Homologação: compras reais do negócio de teste, conferindo o estoque, as contas, o caixa, o custo e o inventário do fim do mês | Manual (uma vez) | CA-01 a CA-12 |

---

## 13. Questões em aberto

Decididas pela equipe em entrevista em 21/11/2026. Cada questão mantém as opções e a recomendada da proposta e termina com a **decisão**.

### OPEN-001 — Custo do produto depois da compra

A compra informa o custo pago. O que acontece com o custo do produto, usado na Calculadora (RF34, RF35) e no inventário (RF88)?
- **(a) Não mexer:** o custo só muda no Catálogo; a compra guarda o custo pago, sem efeito no produto.
- **(b) Custo da última compra:** o custo passa a ser o custo unitário da compra.
- **(c) Custo médio ponderado:** (saldo antes × custo atual + quantidade × custo da compra) ÷ (saldo antes + quantidade); com saldo zero antes da compra, vale o custo da compra.
- **(d) Escolher na compra:** o resumo mostra os três custos, e quem registra escolhe por produto, com um padrão do negócio.

**Recomendada: (c) custo médio ponderado.** É o método aceito na contabilidade para avaliar o estoque (NBC TG 16, custo médio ponderado). Deixa o inventário da SPEC-025 coerente com o que foi pago e não deixa o custo saltar por uma compra pequena e cara. O resumo mostra o custo atual e o novo antes de confirmar, e o detalhe leva à Calculadora. A (b) acompanha melhor o preço de reposição, mas o inventário passa a valer o estoque antigo pelo custo novo. A (a) mantém o retrabalho de hoje. A (d) dá controle, mas pede uma decisão a cada produto e deixa o custo do inventário sem regra única.

**Decisão (21/11/2026): (d) escolher na compra, com o custo médio já marcado.** A equipe preferiu poder decidir produto por produto. Em vez de um padrão configurável do negócio, o resumo vem sempre com o custo médio marcado (a regra contábil), e a pessoa troca só quando quer: para o custo desta compra ou para manter o atual. Detalhes na seção 5.5.

### OPEN-002 — Fornecedor e nº do documento

- **(a) Fornecedor obrigatório e nº do documento opcional,** com aviso e confirmação quando o mesmo fornecedor já tem uma compra registrada com o mesmo nº.
- **(b) Fornecedor opcional:** compra sem fornecedor, por exemplo, numa feira.
- **(c) Nº do documento obrigatório** e único por fornecedor, bloqueando a repetição.

**Recomendada: (a).** A compra é o registro de quem forneceu, e o cadastro de fornecedor aceita só o nome, sem sair da compra (SPEC-026). O aviso evita lançar a mesma nota duas vezes, o que dobraria o estoque e a dívida, sem impedir compras sem nota.

**Decisão (21/11/2026): (a) e (c) juntas, com a marcação "Compra sem nota fiscal".** A usuária com CNPJ, que usa o HE no dia a dia, orientou que o fornecedor e o nº do documento sejam obrigatórios: a nota fiscal é o que comprova a compra para a contabilidade, e o nº evita lançar a mesma nota duas vezes. Por isso, o nº é obrigatório e único por fornecedor entre as compras não canceladas, e a repetição é **bloqueada**, não só avisada. Para não impedir as compras que de fato não têm nota (feira, pessoa física), a caixa "Compra sem nota fiscal" dispensa o nº, e a compra aparece como "Sem nota". O fornecedor continua obrigatório em todos os casos.

### OPEN-003 — Produtos da compra

- **(a) Só produtos físicos ativos do Catálogo,** buscados pelo nome ou pelo código interno, com "Novo produto" sem sair da compra para quem tem *Catálogo: criar*. O produto novo nasce com o custo da linha.
- **(b) A (a) mais linhas livres sem produto** (descrição e valor, sem estoque), para material de consumo na mesma nota.
- **(c) Só produtos já cadastrados,** sem cadastro pela compra.

**Recomendada: (a).** A compra existe para dar entrada no estoque; o material de consumo continua como conta ou lançamento do Financeiro. Linhas livres misturariam despesa e estoque no mesmo total e complicariam o custo e o cancelamento. O "Novo produto" evita abandonar a compra no meio, como o "Novo fornecedor".

**Decisão (21/11/2026): (a).**

### OPEN-004 — Forma de pagar

- **(a) À vista ou a prazo em 1 a 12 parcelas:** à vista sai do caixa na data, com a forma (Dinheiro, Pix, Cartão de débito, Boleto, Transferência ou Outra). A prazo vira contas a pagar, com vencimentos sugeridos a cada 30 dias e editáveis, e valores iguais com os centavos na 1ª. A forma é escolhida ao pagar cada conta. O cartão de crédito do negócio entra como a prazo, com o vencimento na fatura.
- **(b) À vista ou a prazo numa conta só,** sem parcelas.
- **(c) A (a) mais entrada:** parte à vista e o resto em parcelas.

**Recomendada: (a).** Segue o desenho da venda (RN09, RN10, RN11), e o caixa só muda quando o dinheiro sai (RN14). A entrada pode ser registrada com a 1ª parcela vencendo no dia da compra e paga em seguida, sem tela nova. Parcelas com valores diferentes ficam fora: os boletos de uma mesma nota costumam ser iguais.

**Decisão (21/11/2026): (c), com a entrada opcional.** A compra pode ser à vista, a prazo sem entrada ou a prazo com entrada. A entrada é um campo opcional da compra a prazo: sem ela, o total todo vira parcelas, como na (a).

**Complemento (21/11/2026, a pedido da usuária): toda compra gera contas a pagar**, inclusive a à vista e a entrada, que vencem na data da compra. A saída do caixa só acontece quando alguém confirma o pagamento de cada conta no Financeiro, com a forma. Assim, o pagamento é conferido antes de entrar no caixa, e as compras seguem o mesmo princípio que a SPEC-029 trará para as vendas. Isso troca o "à vista sai do caixa na data" das opções acima. Detalhes na seção 5.3.

### OPEN-005 — Frete, outras despesas e desconto

- **(a) Campos de frete, outras despesas e desconto,** rateados no custo das linhas em proporção ao valor de cada uma.
- **(b) Campos só no total pago,** sem mexer no custo das linhas.
- **(c) Sem campos:** quem registra inclui tudo no custo unitário.

**Recomendada: (a).** O custo de aquisição inclui o frete e as despesas da compra e desconta os abatimentos (NBC TG 16), e o total da compra bate com o valor da nota. Com a OPEN-001 (a), o rateio só aparece no detalhe da compra.

**Decisão (21/11/2026): (a).** O custo desta compra e o custo médio (OPEN-001) já usam o custo com o rateio.

### OPEN-006 — Cancelar uma compra registrada errada

- **(a) Cancelar a compra inteira, com motivo, numa transação,** como o cancelamento de venda (RN25): o estoque sai (recusado se algum saldo não cobre), as contas em aberto são canceladas, os valores pagos são estornados, e o custo volta ao anterior se não mudou depois. A compra fica "Cancelada", nunca apagada.
- **(b) Sem cancelamento:** corrigir com saída manual, cancelamento de conta e estorno, um por um.
- **(c) Cancelar só enquanto nada foi pago** e nenhum produto da compra saiu depois.

**Recomendada: (a).** Uma compra lançada errada (quantidade digitada errada, nota repetida) precisa ser desfeita de uma vez, sem deixar o estoque, o caixa e o custo desencontrados. É o mesmo modelo que a equipe já conhece da venda. A (b) deixa o erro na mão de quem registra e quebra as ligações. A (c) impede cancelar a compra mais comum: a à vista, que já nasce paga.

**Decisão (21/11/2026): (a).**

### OPEN-007 — Permissões

- **(a) Sem mudar a matriz:** registrar exige *Estoque: criar* e *Financeiro: criar*; ver, *Estoque: ver* e *Financeiro: ver*; corrigir o fornecedor e o documento, *Financeiro: editar*; cancelar, *Estoque: excluir* e *Financeiro: excluir*. O custo muda pela regra da compra, sem exigir *Catálogo: editar*.
- **(b) Novo módulo "Compras" na matriz** (ver, criar, editar e excluir), alterando a SPEC-005, as predefinições dos papéis e as permissões já salvas.
- **(c) Só o Dono e o Gerente.**

**Recomendada: (a).** Não muda a matriz nem as permissões já salvas. Quem registra uma compra mexe no estoque e no caixa, então precisa das duas permissões. O custo segue a regra da compra, como a venda dá baixa no estoque sem exigir permissão no Estoque.

**Decisão (21/11/2026): (a).**

### OPEN-008 — Onde fica a compra

- **(a) Item "Compras" no menu, ao lado de Vendas,** para quem pode ver as compras, com o atalho "Registrar compra" no Estoque e no detalhe do fornecedor.
- **(b) Seção no Estoque** (Estoque › Compras), como o Inventário.
- **(c) Seção no Financeiro,** ao lado de Fornecedores.

**Recomendada: (a).** A compra é o espelho da venda e mexe em dois módulos; no menu, fica fácil de achar sem escolher entre o Estoque e o Financeiro. Os atalhos levam à compra de onde a pessoa já está.

**Decisão (21/11/2026): (a).** "Compras" é um item novo no menu lateral, abaixo de "Vendas" (no celular, no "Mais"). Os atalhos "Registrar compra" ficam no topo da página do Estoque e no detalhe do fornecedor, que já abre a compra com o fornecedor escolhido (seção 5.8).

### OPEN-009 — Política de Privacidade

A Política diz que o fornecedor é apagado "se não tiver contas nem despesas fixas". Com as compras, o fornecedor com compras passa a ser anonimizado, e a exportação ganha as compras.
- **(a) Nova versão com novo aceite,** como nas SPEC-022 e SPEC-026.
- **(b) Ajustar o texto na próxima versão** que já pedir aceite (por exemplo, na revisão do grupo da pendência 2), sem uma versão só para isso.
- **(c) Nova versão sem novo aceite,** só com o aviso da mudança.

**Recomendada: (a).** Muda uma regra de exclusão que a pessoa lê para exercer os seus direitos. A equipe já escolheu o novo aceite nas mudanças anteriores sobre clientes e fornecedores. A (b) deixa a Política desatualizada até a próxima versão.

**Decisão (21/11/2026): (a).**

### OPEN-010 — Exportar as compras

- **(a) Sem relatório novo nesta Spec:** a lista mostra o total do período; as contas da compra e os pagamentos já saem nos relatórios de Fluxo de caixa e de Contas. Um relatório de compras fica como evolução.
- **(b) Relatório "Compras" nos Relatórios do plano pago,** em CSV e PDF, com os produtos de cada compra, alterando o RF71.
- **(c) Botão de CSV na própria lista,** nos dois planos.

**Recomendada: (a).** Mantém a Spec menor. O que a contabilidade pede hoje (o que foi pago, o que se deve e o inventário) já sai pelos relatórios e pelo inventário. Se a equipe quiser o relatório, a (b) segue o padrão dos Relatórios (RF71).

**Decisão (21/11/2026): (a).** Um relatório de compras fica como evolução, numa Spec própria: a usuária disse que ele seria bem útil, sem urgência (pendência 12 do Mapa).

**Decisões derivadas do pedido e da baseline (sem questão nova):**
- compras nos **dois planos**, sem limite de quantidade (RF46, RF47, RN18); a lista do plano gratuito mostra os últimos 12 meses (SPEC-013, OPEN-005);
- **data da compra:** hoje ou até 90 dias atrás, como as movimentações e os lançamentos (SPEC-007, OPEN-005); a entrada no estoque usa essa data, e as contas à vista e da entrada vencem nela;
- **número sequencial** por negócio, como a venda (SPEC-008, OPEN-007);
- **só produtos físicos ativos** (RN04), como a entrada manual; o mesmo produto não se repete na compra;
- **quantidade** com até 3 casas, como o estoque; **custo unitário** com 2 casas, como o custo do produto;
- **até 100 produtos** por compra, para caber no tempo da seção 10; o **custo unitário** vem preenchido com o custo atual do produto e pode ser trocado;
- **categoria** Fornecedores (RF32) no lançamento e nas contas;
- o **fornecedor e o nº do documento** das contas vêm da compra e são corrigidos pela compra (SPEC-026, OPEN-007);
- as **contas da compra** não são editadas nem canceladas sozinhas pelo Financeiro, como as da venda (SPEC-009, OPEN-003); o pagamento das contas e o estorno de um pagamento (SPEC-028) continuam pelo Financeiro;
- a **saída do cancelamento** é um estorno e não conta como consumo para o mínimo sugerido (RF20);
- **suporte:** vê as compras com o fornecedor mascarado e nunca registra, corrige nem cancela (RN37 e a decisão de 01/11/2026 no Mapa); **negócio suspenso** não registra, corrige nem cancela (RN39);
- **vendas passadas** não mudam (RF62);
- **sem integração externa** e sem nota fiscal de entrada.

---

## 14. Definition of Done da Spec

A SPEC-027 estará concluída quando:

- [x] as questões OPEN-001 a OPEN-010 tiverem sido decididas e registradas (21/11/2026), com a baseline ajustada (RF91 e RN43 incluídos; RF08, RF15, RF30, RF89, RF90 e RNF05 alterados);
- [ ] todos os critérios de aceitação (CA-01 a CA-17) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-011) estiverem preservados;
- [ ] os testes derivados (T01 a T14) estiverem aprovados, com o CI verde em cada PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF05, RNF06) tiverem sido verificados como descrito na seção 10;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Implementação por etapas:** a Spec é grande para um PR só (referência: até cerca de 400 linhas por revisão). Divisão prevista: (1) schema, domínio e registrar compra; (2) lista, detalhe e ligações; (3) correção, cancelamento, suporte e LGPD; (4) roteiro, evidências e homologação.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio. A divergência é registrada com duas propostas, (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
