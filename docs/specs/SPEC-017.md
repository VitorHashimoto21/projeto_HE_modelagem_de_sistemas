# SPEC-017 — Ajustes na venda: materiais e preço por venda

> **Status:** ✅ **Aprovada em 16/10/2026** — questões em aberto decididas pela equipe em entrevista (seção 13), todas pela opção recomendada; RN05, RN15 e SPEC-008 ajustadas. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir de uma melhoria identificada pela equipe na aula de 15/10/2026. Pronta para implementar.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Altera:** [SPEC-008](SPEC-008.md) (registro de venda), com efeitos na [SPEC-006](SPEC-006.md) (preço oficial) e na [SPEC-011](SPEC-011.md) (troca) · **Usa:** [SPEC-005](SPEC-005.md) (permissões), [SPEC-007](SPEC-007.md) (baixa de estoque) e [SPEC-016](SPEC-016.md) (componentes).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-017 |
| **Nome** | Ajustes na venda: materiais e preço por venda |
| **Objetivo** | Permitir, na frente de caixa, ajustar **numa venda específica** a quantidade de materiais que um serviço consumiu e o preço cobrado por uma linha, sem mexer no catálogo, com a baixa de estoque, o custo, o total e a auditoria refletindo o que foi ajustado. |
| **Valor entregue** | Serviços que gastam quantidades diferentes a cada execução (o eletricista que troca 6 lâmpadas num dia e 2 no outro) e preços combinados na hora passam a ser registrados com uma venda só, com o estoque e a rentabilidade corretos. Hoje é preciso repetir o serviço no carrinho, editar o catálogo antes de vender ou cadastrar um serviço para cada quantidade. |

### Exemplo que originou a Spec

O eletricista cadastrou o serviço **"Troca de lâmpadas"** com o material **"Lâmpada LED"** (2 por execução) e preço R$ 80,00. Numa casa, ele troca 6 lâmpadas e combina R$ 150,00 com o cliente.
- **Hoje:** vender o serviço 3 vezes cobra R$ 240,00, e não há como registrar 6 lâmpadas com o preço combinado.
- **Com esta Spec:** ele adiciona o serviço uma vez, toca em **"Editar materiais"** e informa 6 lâmpadas. Se for preciso, toca em **"Editar preço"** e informa R$ 150,00 (com o motivo, se a equipe decidir assim). A venda baixa 6 lâmpadas, grava o custo com 6 lâmpadas e cobra R$ 150,00. O catálogo continua com 2 lâmpadas e R$ 80,00.

> **Alternativa que já existe:** cadastrar o serviço por unidade ("Troca de lâmpada", 1 lâmpada, preço por troca) e vender com quantidade 6. Ela continua válida e é a recomendada quando o preço é proporcional à quantidade. Esta Spec cobre os casos em que isso não basta: consumo variável de material e preço combinado.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | RF23, RF24 (venda multi-itens), RF62 (custo na venda) | O custo gravado na linha passa a usar as quantidades de material ajustadas. |
| **RN** | **RN05** | **Alterada (texto ajustado na baseline):** o serviço baixa os materiais vinculados **nas quantidades da venda** (por padrão, as do catálogo; ajustáveis na venda). |
| | **RN15** | **Alterada (OPEN-003; texto ajustado na baseline):** o preço oficial continua sendo o padrão de toda venda; um ajuste de preço vale só para aquela linha, com registro de quem ajustou, o preço oficial do momento e o motivo. O preço oficial e o histórico de preços **não mudam**. |
| | RN06, RN23 | Mantidas: estoque insuficiente bloqueia a venda; item sem preço oficial continua sem poder ser vendido. |
| **RNF** | RNF05 (auditoria) | O ajuste fica registrado na linha da venda e aparece no detalhe. |
| | RNF02 | O ajuste de preço segue a permissão decidida na OPEN-005, conferida no servidor. |
| **Decisões anteriores** | SPEC-008 **OPEN-001** ("sem desconto no MVP") e **INV-002** ("nenhum preço vindo do navegador") | **Revistas** por esta Spec: o navegador pode enviar um preço ajustado, mas o servidor só o aceita com a permissão e as regras da seção 5.3; sem ajuste, continua valendo o preço oficial. |
| **Caso de uso / fluxo** | UC11 Registrar Venda; Diagrama 2 (venda) | Passos novos na montagem do carrinho e na validação do servidor. |
| **Entidades** | ItemVenda, MovimentacaoEstoque, MaterialServico (só leitura), Item (só leitura) | Ver seção 7. |

---

## 3. Escopo

### Incluído

1. **"Editar materiais"** em cada linha de **serviço com materiais** no carrinho da Nova venda:
   - abre uma gaveta (SPEC-016, OPEN-003) com os materiais do serviço e as quantidades **da linha** (OPEN-002), preenchidas com o padrão do catálogo × quantidade da linha;
   - a pessoa altera as quantidades dos materiais já vinculados, inclusive para 0 (OPEN-001);
   - a linha passa a mostrar "Materiais ajustados", com o resumo (ex.: "6 Lâmpada LED"), e o aviso de estoque do carrinho usa as quantidades novas;
   - "Voltar ao padrão" desfaz o ajuste.
2. **"Editar preço"** em cada linha, de serviço ou produto (OPEN-004), para quem tem *Vendas: editar* (OPEN-005):
   - informa o preço unitário cobrado nesta venda e o motivo, obrigatório e curto (OPEN-006);
   - a linha mostra o preço ajustado e o oficial riscado; o total e o valor do pagamento automático (SPEC-016, N1) acompanham;
   - aviso, sem bloquear, quando o preço fica abaixo do custo da linha (OPEN-007);
   - "Voltar ao preço oficial" desfaz o ajuste.
3. **Servidor:** valida os ajustes (seção 5.3), dá baixa nas quantidades ajustadas, grava o custo com elas e o preço ajustado com o registro do ajuste, na mesma transação da SPEC-008.
4. **Detalhe da venda e histórico:** mostram que a linha teve materiais e/ou preço ajustados (preço oficial do momento, preço cobrado, motivo, quem registrou).
5. **Relatórios e indicadores:** nada muda nas fórmulas. Faturamento, CMV%, rentabilidade e RBT12 já usam o preço e o custo **gravados na linha**, que passam a refletir os ajustes.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Desconto no total da venda (em vez de por linha) | Evolução futura; o ajuste é por linha |
| Mudar o catálogo a partir da venda ("salvar como padrão") | Fora: o catálogo muda só pelo Catálogo e pela Calculadora (SPEC-006, SPEC-010) |
| Ajustes ao editar uma venda já registrada | Não existe edição de venda; a correção continua sendo cancelar ou trocar (SPEC-011) |
| Ajustes na nova venda de uma **troca** | Fora desta Spec (OPEN-008) |

---

## 4. Dependências

- **Specs:** SPEC-008 (fluxo da venda, `ItemVenda`, baixa por `movimentar()`), SPEC-007 (primitiva de movimentação e saldo), SPEC-006 (materiais do serviço, preço oficial), SPEC-005 (matriz: *Vendas: editar* está sem uso hoje), SPEC-011 (cancelamento devolve exatamente as movimentações da venda), SPEC-016 (gaveta, diálogo, aviso flutuante, valor automático do pagamento).
- **Decisões arquiteturais:** ADR-003 (autorização no servidor), ADR-001.
- **Pré-requisitos externos:** nenhum.

---

## 5. Comportamento esperado

### 5.1 Ajustar materiais (na tela)

1. No carrinho, a linha de um serviço com materiais mostra **"Editar materiais"**.
2. A gaveta lista cada material com a **quantidade da linha** (padrão = quantidade do catálogo × quantidade do serviço na linha), a unidade e o saldo em estoque.
3. A pessoa altera as quantidades (≥ 0, até 3 casas) dos materiais já vinculados (OPEN-001).
4. Ao confirmar, a linha mostra "Materiais ajustados" e o resumo. Se a pessoa mudar depois a quantidade do serviço na linha, a tela pergunta se mantém os materiais ajustados ou volta ao padrão proporcional.
5. O custo exibido da linha (se a pessoa puder ver custos) e o aviso de estoque usam as quantidades ajustadas.

### 5.2 Ajustar preço (na tela)

1. Quem tem a permissão da OPEN-005 vê **"Editar preço"** na linha.
2. Informa o preço unitário desta venda (> 0, até R$ 9.999.999,99) e, conforme a OPEN-006, o motivo.
3. A linha mostra "R$ 150,00 ~~R$ 80,00~~ (preço ajustado)"; o total e o pagamento automático acompanham.
4. Preço abaixo do custo da linha → aviso "Abaixo do custo (R$ X)", sem bloquear (OPEN-007).

### 5.3 Validação e gravação no servidor

Além das validações da SPEC-008 (5.2):

| Regra | Comportamento |
|---|---|
| Materiais ajustados só em **serviço**; cada material é um Produto Físico do mesmo negócio; quantidades ≥ 0 com até 3 casas | Senão `CampoInvalido` / `MaterialInvalido`; nada é gravado. |
| Sem a OPEN-001 (b), só materiais **já vinculados** ao serviço | Material fora do vínculo → recusado. |
| **Preço ajustado** só com a permissão da OPEN-005 | Sem permissão → `SemPermissao` (o ajuste não é ignorado em silêncio). |
| Preço ajustado > 0, duas casas; motivo conforme a OPEN-006 | Senão `CampoInvalido`. |
| Linha **sem** ajuste de preço | Continua usando o `precoAtual` no momento da gravação (RN15); o preço vindo do navegador é ignorado, como hoje. |
| Preço oficial mudou entre abrir o carrinho e finalizar, numa linha **com** ajuste | O ajuste vale (é o preço combinado); o registro guarda o preço oficial **do momento da gravação**. |
| Total | Σ arredondamento(preço da linha × quantidade), com o preço ajustado onde houver; soma dos pagamentos = total (RF26). |
| Baixa de estoque | Por material, a quantidade **da linha** (ajustada ou padrão), pela primitiva `movimentar()`; estoque insuficiente desfaz tudo (RF18). |
| Custo da linha | `custoUnitario` = (custo próprio × quantidade + Σ custo do material × quantidade do material na linha) ÷ quantidade da linha. Sem ajuste, igual ao de hoje (INV-007 da SPEC-008). |
| Linhas do mesmo item | Hoje são somadas na validação. Linhas com ajustes **diferentes** passam a ser mantidas separadas; linhas idênticas continuam somadas. |

### 5.4 Detalhe, histórico e cancelamento

- No detalhe da venda, a linha ajustada mostra: preço cobrado, preço oficial do momento, motivo e quem registrou; e "Materiais ajustados", com as quantidades baixadas (já listadas nas movimentações).
- No histórico, um indicador "preço ajustado" na venda.
- **Cancelamento (SPEC-011):** nada muda; ele devolve exatamente as movimentações da venda, que já têm as quantidades ajustadas, e estorna o valor recebido.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | O catálogo nunca muda por causa de uma venda: `MaterialServico`, `Item.precoAtual` e `HistoricoPreco` ficam iguais. | Teste de integração antes/depois. |
| **INV-002** | Linha sem ajuste de preço usa o `precoAtual` do momento da gravação; linha com ajuste usa o preço ajustado e registra o preço oficial do momento, quem ajustou e o motivo. | Teste com preço adulterado sem permissão e com permissão. |
| **INV-003** | Ajuste de preço sem a permissão da OPEN-005 é recusado no servidor. | Teste chamando a ação direto. |
| **INV-004** | Para cada material de serviço, a soma das movimentações `SAIDA_VENDA` da venda = quantidade da linha (ajustada ou padrão); o cancelamento devolve exatamente isso. | Teste de integração com venda e cancelamento. |
| **INV-005** | `custoUnitario` da linha usa as quantidades de material da linha; sem ajuste, é igual ao cálculo atual. | Teste unitário e de integração. |
| **INV-006** | Σ pagamentos = total = Σ arredondamento(preço da linha × quantidade). | Mantém o INV-003 da SPEC-008. |

---

## 7. Modelo de domínio envolvido

| Entidade | Mudança |
|---|---|
| `ItemVenda` | Novos campos: `precoOficial Decimal?` (preço oficial no momento, preenchido só quando houve ajuste), `motivoAjustePreco String?` (OPEN-006), `materiaisAjustados Boolean @default(false)`. `precoUnitario` continua sendo o preço cobrado. |
| `MovimentacaoEstoque` | Sem mudança: as baixas da venda já registram a quantidade de cada material (e o cancelamento usa isso). |
| `MaterialServico`, `Item`, `HistoricoPreco` | Só leitura (INV-001). |

**Onde guardar as quantidades ajustadas** (sem tabela nova): as movimentações `SAIDA_VENDA` da venda já trazem material e quantidade. Quando o mesmo material aparece em mais de uma linha, o detalhe mostra o total por material. Se a equipe quiser o detalhamento por linha, a alternativa é uma tabela `ItemVendaMaterial` (registrada na OPEN-002).

Migração: os três campos novos em `ItemVenda`, opcionais ou com padrão, sem alterar vendas existentes.

---

## 8. Impacto arquitetural

- `src/lib/dominio/venda.ts`: custo da linha com materiais da linha; regras do ajuste (puras).
- `src/lib/vendas/validacao.ts`: carrinho com `materiais?` e `precoAjustado?`/`motivo?` por linha; linhas com ajustes diferentes não são somadas.
- `src/lib/db/vendas.ts`: baixa e custo pelas quantidades da linha; gravação dos campos novos; permissão do ajuste de preço recebida do contexto do membro.
- `src/lib/vendas/acoes.ts`: a ação continua `acaoComPermissao("vendas", "criar")`; o ajuste de preço exige também a permissão da OPEN-005, conferida dentro do fluxo.
- `src/components/vendas/`: botões na linha do carrinho, gaveta de materiais, campo de preço com motivo, indicadores.
- `src/app/(app)/vendas/[id]` e histórico: exibição do ajuste.
- Sem mudança nas consultas de relatórios, dashboard e calculadora: já usam `precoUnitario` e `custoUnitario` da linha.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Registrar venda** (estendido) | linhas: item, quantidade, `materiais?` [{materialId, quantidade}], `precoAjustado?`, `motivo?` | venda | os da SPEC-008 + `MaterialInvalido`, `SemPermissao` (ajuste de preço) |
| **Custo da linha** (domínio) | custo próprio, quantidade, materiais da linha (custo × quantidade) | custo unitário | — |
| **Materiais padrão da linha** (domínio) | materiais do catálogo, quantidade da linha | quantidades padrão | — |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação | Verificação |
|---|---|---|
| RNF01 | Botões, gaveta e indicadores em 390/768/1440, claro e escuro, sem rolagem horizontal; frente de caixa continua rápida (um toque abre, um toque confirma). | Capturas. |
| RNF02 | Permissão do ajuste de preço no servidor. | INV-003. |
| RNF05 | Ajuste registrado e visível no detalhe. | INV-002, CA-07. |

---

## 11. Critérios de aceitação

**CA-01 — Materiais ajustados.** Dado o serviço "Troca de lâmpadas" (2 lâmpadas por execução), quando a pessoa o adiciona com quantidade 1 e ajusta para 6 lâmpadas, então a venda baixa 6 lâmpadas, o custo da linha considera 6 lâmpadas e o catálogo continua com 2.

**CA-02 — Padrão sem ajuste.** Dada uma venda sem ajustes, então baixa, custo e total são iguais aos de hoje (SPEC-008).

**CA-03 — Estoque insuficiente.** Dado um saldo de 4 lâmpadas, quando a pessoa ajusta para 6, então o carrinho avisa e o servidor recusa com "Estoque insuficiente", sem gravar nada.

**CA-04 — Preço ajustado.** Dado um membro com a permissão da OPEN-005, quando ajusta o preço da linha de R$ 80,00 para R$ 150,00 (com motivo, se exigido), então a venda cobra R$ 150,00, grava o preço oficial R$ 80,00 e o motivo, e o preço oficial do catálogo e o histórico de preços não mudam.

**CA-05 — Sem permissão.** Dado um Colaborador com a predefinição, então ele não vê "Editar preço", e uma chamada direta com preço ajustado é recusada no servidor.

**CA-06 — Abaixo do custo.** Dado um preço ajustado abaixo do custo da linha, então aparece o aviso e a venda pode ser finalizada (ou não, conforme a OPEN-007).

**CA-07 — Detalhe e auditoria.** Dada uma venda com ajustes, então o detalhe mostra preço cobrado, preço oficial, motivo, quem registrou e os materiais baixados.

**CA-08 — Cancelamento.** Dada uma venda com materiais ajustados, quando é cancelada, então volta exatamente o que foi baixado (6 lâmpadas).

**CA-09 — Indicadores.** Dada uma venda com preço e materiais ajustados, então faturamento, CMV%, rentabilidade e relatórios usam o preço cobrado e o custo ajustado.

**CA-10 — Visual.** Dadas as telas alteradas em 390/768/1440, claro e escuro, então seguem o design system, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Custo da linha com materiais padrão e ajustados; materiais padrão × quantidade | Unitário | INV-005 |
| T02 | Validação do carrinho com ajustes (quantidades, materiais fora do vínculo, preço, motivo); linhas com ajustes diferentes não somadas | Unitário | 5.3 |
| T03 | Venda com materiais ajustados: baixa, custo, catálogo intacto | Integração | CA-01, INV-001, INV-004 |
| T04 | Venda sem ajuste igual à de hoje | Integração | CA-02 |
| T05 | Estoque insuficiente pelo ajuste, inclusive com vendas simultâneas | Integração | CA-03 |
| T06 | Preço ajustado com e sem permissão; preço oficial e histórico intactos; preço oficial mudando no meio | Integração | CA-04, CA-05, INV-002, INV-003 |
| T07 | Cancelamento devolve as quantidades ajustadas | Integração | CA-08 |
| T08 | Rentabilidade e CMV% com linhas ajustadas | Integração | CA-09 |
| T09 | Telas em 390/768/1440, claro e escuro | Manual com captura | CA-10 |
| T10 | Fluxo do eletricista na homologação | Manual (uma vez) | CA-01 a CA-08 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 16/10/2026, em entrevista, pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — O que pode mudar nos materiais | **Só a quantidade** dos materiais já vinculados ao serviço (pode ser 0, "não usei"). Incluir ou remover materiais na venda fica para depois. |
| **OPEN-002** — Como informar a quantidade | **Total da linha**: a pessoa digita quanto usou nesta venda (ex.: "5 lâmpadas" num serviço com quantidade 3, cujo padrão seria 6). Guardado nas próprias movimentações `SAIDA_VENDA` da venda, sem tabela nova. |
| **OPEN-003** — Ajuste de preço | **Preço unitário ajustável por linha**, registrado na linha (preço oficial do momento, quem ajustou e motivo), sem mudar o preço oficial nem o histórico. Revê a OPEN-001 da SPEC-008 e ajusta a RN15. |
| **OPEN-004** — Onde vale | **Serviços e produtos.** |
| **OPEN-005** — Quem pode ajustar o preço | ***Vendas: editar*** (Dono e Gerente por padrão; o Colaborador só se o Dono liberar). Ajustar **materiais** fica com *Vendas: criar*. |
| **OPEN-006** — Motivo | **Obrigatório e curto** (até 120 caracteres), gravado na linha e mostrado no detalhe. |
| **OPEN-007** — Abaixo do custo | **Avisar sem bloquear**, como no preço manual do catálogo (SPEC-006). |
| **OPEN-008** — Troca (SPEC-011) | **Fora desta Spec**: a nova venda da troca continua com preço e materiais oficiais. |

---

## 14. Definition of Done da Spec

A SPEC-017 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-10) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-006) estiverem preservados;
- [ ] os testes derivados (T01 a T10) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF05) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-008 tiverem sido decididas e registradas (16/10/2026), com a RN05, a RN15 e a SPEC-008 (OPEN-001, INV-002, seção 3 "Fora do escopo") ajustadas conforme as decisões;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
