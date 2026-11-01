# Evidências — SPEC-026 (Fornecedores, vínculo nas contas e filtros)

Verificação em build de produção local (`next build` + `next start`), em 01/11/2026 (horário de São Paulo). O ambiente tinha Postgres, um Supabase Auth falso e uma BrasilAPI falsa, que responde um CNPJ e um CEP fictícios. Negócio de teste **HE Testing**, no plano pago, com dados fictícios:
- duas contas a pagar, uma delas paga antes da SPEC-026, sem forma;
- uma conta a receber da cliente Ana Souza;
- a colaboradora Joana, que só vê o Financeiro.

O banco recebeu todas as migrações, inclusive a `20261101200000_fornecedores`, que não grava dados novos.

## Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T01 | Validação do fornecedor (só o nome; a mensagem própria; CNPJ válido), visão pelas permissões do Financeiro, máscara e selo "completo para nota" | `test/unit/fornecedores.test.ts` | ✅ |
| T02 | Leitura dos filtros do endereço, valores desconhecidos ignorados, período invertido e data inválida recusados; forma obrigatória; fornecedor ou cliente da lista; nº do documento até 40 caracteres | idem | ✅ |
| T03 | Fornecedores no banco: cadastro, edição, documento repetido (e o mesmo CNPJ de um cliente aceito), apagar sem contas, anonimizar com conta, documento liberado, outro negócio fora, detalhe com contas, totais e despesas | `test/integracao/fornecedores.test.ts` | ✅ |
| T04 | Vínculos: fornecedor só na conta a pagar, cliente só na a receber manual, mesmo negócio (o banco recusa o contrário); correção numa conta quitada sem mudar valores; na de venda, só o documento; a despesa fixa repassa o fornecedor | idem | ✅ |
| T05 | Forma: obrigatória, gravada no lançamento, antigos sem forma, forma só em lançamento de conta (o banco recusa), parcela recebida no vencimento com cartão de crédito | idem | ✅ |
| T06 | Filtros e totais: fornecedor + data do pagamento + forma (o pago soma só os pagamentos do filtro), busca, categoria, origem, vencimento, cliente com as contas da venda no cartão, "Não informada", canceladas fora dos valores, mais de uma página e o plano gratuito | idem | ✅ |
| T07 | Guardas das ações (Financeiro — criar, editar e excluir; correção com editar; "Novo cliente" com Vendas — criar) | `test/unit/fornecedores.test.ts` | ✅ |
| T08 | Suporte: fornecedores e nomes nas contas mascarados, nenhuma escrita | `test/integracao/fornecedores.test.ts` | ✅ |
| T09 | Relatório de Contas: colunas Fornecedor/Cliente, Nº do documento e Pagamentos, no banco e no CSV | os dois | ✅ |
| T10 | LGPD: fornecedores, vínculos e formas na exportação; exclusão de conta anonimiza os fornecedores; cliente com conta a receber é anonimizado, e não apagado | `test/integracao/fornecedores.test.ts` | ✅ |

**Suíte completa:** 578 testes unitários e 309 de integração passaram, além de lint, tipos e a checagem do schema (`migrate diff` sem diferença). Alguns testes antigos mudaram só na chamada:
- o pagamento de conta passou a informar a forma (SPEC-009 e Dashboard);
- a despesa fixa ganhou o campo do fornecedor;
- os usuários de teste aceitaram a nova versão dos termos.

**Desempenho (RNF06):** num banco à parte, com 5.000 contas, 10.000 pagamentos e 50 fornecedores, a lista filtrada levou de 39 a 54 ms. A primeira consulta, com o banco ainda frio, levou 215 ms. A meta é até 1 s.

## Roteiro no navegador (T11 e T12)

71 verificações, todas aprovadas (`scratchpad/e2e26/spec26.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| O Dono, que tinha aceitado a versão 2026-10-23, vai para o novo aceite; a página explica o cadastro de fornecedores; o aceite da 2026-11-01 é gravado (CA-17) | ✅ | — |
| Aba "Fornecedores" no Financeiro; lista vazia; o novo fornecedor começa como empresa; o CNPJ preenche razão social, nome fantasia e endereço (o município, pelo CEP); "Fornecedor salvo." e "Completo para nota" (CA-01) | ✅ | `s26_01_fornecedor_detalhe_1440_claro.png` |
| CNPJ repetido: "Já existe um fornecedor com este CNPJ: Embalagens Exemplo.", e o formulário mantém o que foi digitado (CA-02) | ✅ | — |
| Pessoa física sem endereço: "Faltam dados para nota", o filtro dos incompletos e o documento mascarado na lista (CA-03) | ✅ | `s26_02_fornecedores_1440_claro.png`, `s26_03_fornecedores_390_escuro.png` |
| Nova conta na gaveta com o fornecedor e o nº do documento; o detalhe mostra os dois, e o nome leva ao fornecedor (CA-06) | ✅ | `s26_04_nova_conta_gaveta_1440_claro.png` |
| "Novo fornecedor" sem sair da conta: a conta fica escondida, com o que foi digitado, e volta com o fornecedor novo escolhido (CA-07) | ✅ | — |
| Pagamento sem forma: "Escolha a forma do pagamento."; com Pix, o histórico mostra "Pix"; o pagamento anterior à SPEC-026 mostra "Não informada" (CA-10) | ✅ | `s26_05_conta_detalhe_1440_claro.png`, `s26_06_conta_detalhe_390_escuro.png` |
| Conta quitada: o fornecedor e o documento são corrigidos, e valor, pago, situação e vencimento continuam iguais (CA-08) | ✅ | — |
| Despesa fixa com fornecedor: depois de salvar, o formulário volta vazio, sem fornecedor; a lista mostra o fornecedor, e a conta do mês já nasce com ele (CA-09) | ✅ | — |
| Totais sem filtro: 5 contas, R$ 2.280,00, pago R$ 1.000,00 e R$ 1.280,00 em aberto. Fornecedor + Pix + pagamento hoje: só a conta da Embalagens, com total 250, pago 100 e em aberto 150 (CA-11, CA-12) | ✅ | `s26_07_contas_filtradas_1440_claro.png` |
| No celular, os filtros ficam recolhidos em "Filtros (3)" (CA-18) | ✅ | `s26_08_contas_filtradas_390_escuro.png` |
| Outros filtros e mensagens (CA-13): <ul><li>a busca encontra o nº do documento;</li><li>período invertido: "A data final precisa ser igual ou posterior à inicial.";</li><li>a origem "despesa fixa" filtra;</li><li>lista vazia: "Nenhuma conta com estes filtros.", com o link para limpar.</li></ul> | ✅ | — |
| A conta a receber mostra a cliente Ana Souza (CA-06) | ✅ | — |
| Relatório de Contas (plano pago): o cabeçalho do CSV tem as colunas novas, e as linhas trazem o documento e os pagamentos ("01/11/2026 Pix 100,00"; "10/10/2026 Não informada 900,00"); o PDF cabe na página (CA-15) | ✅ | `relatorio-contas.csv`, `s26_10_relatorio_contas_pdf.png` |
| Joana (só Financeiro — ver, sem Vendas) (CA-04, CA-06): <ul><li>vê o nome da cliente, sem link para a tela de Clientes e sem a correção;</li><li>vê o fornecedor com o documento, o telefone e o e-mail em parte e, do endereço, só o município e a UF;</li><li>não edita nem exclui.</li></ul> | ✅ | `s26_09_fornecedor_mascarado_768_claro.png` |
| Excluir: sem contas, "Fornecedor excluído."; com contas, "Dados do fornecedor apagados.", e a conta continua com "Fornecedor anonimizado" (CA-05) | ✅ | — |
| Sem rolagem horizontal em 390, 768 e 1440 px. Axe sem violações, nos temas claro e escuro: <ul><li>em 390 e 1440 px: na lista de fornecedores, no detalhe da conta e nas contas filtradas;</li><li>em 1440 px: no fornecedor mascarado.</li></ul> (CA-18) | ✅ | todas |

**Dados nas capturas:**
- o nome no menu lateral (Rafael Leader) e o da colaboradora são de contas fictícias do ambiente local, as mesmas das evidências anteriores;
- os CNPJs, o CPF, o telefone e o e-mail são números e endereços de teste.

**Não verificado no navegador:**
- **O modo suporte.** O roteiro local não tem um Administrador com liberação. A máscara do suporte e a recusa das escritas são conferidas no T08. As ações de fornecedor usam a mesma guarda das outras ações dos módulos, que recusa o modo suporte.
- **O cliente das contas de venda no cartão.** Coberto pelo T04 e pelo T06, com vendas registradas no cartão.

## Encontrado no roteiro

- **Datas cortadas nos filtros:** no computador, as datas de vencimento e de pagamento não cabiam inteiras. A grade dos filtros passou a ter seis colunas, e cada período ocupa duas.
- **Rótulo quebrado na gaveta:** o "Nº do documento (opcional)", ao lado do fornecedor, quebrava em duas linhas. Os dois campos ficaram um embaixo do outro.
- **Escolha que ficava depois de salvar** (encontrado na revisão do código): depois de cadastrar uma despesa fixa, o fornecedor escolhido continuava no formulário vazio, e o mesmo acontecia com o tipo e o fornecedor da nova conta para quem não vê o Financeiro. A escolha passou a voltar ao início junto com o formulário, e o roteiro confere isso.
- **Colunas cortadas no PDF do relatório:** o título "Nº do documento", a situação "Recebida em parte" e o pagamento "Não informada" não cabiam. As larguras foram medidas na fonte do PDF e reequilibradas. A linha de total passou a ter "A receber" e "A pagar" em células separadas. Descrições longas e mais de um pagamento ainda podem ser cortados no PDF; no CSV, ficam inteiros.

## Homologação (T13) — 01/11/2026

A equipe fez a homologação na `DEVELOP`, depois do merge do PR #124. A migração `20261101200000_fornecedores` foi aplicada pelo workflow Migrações. O teste foi feito com o Dono do negócio **HE Testing**. As capturas e os arquivos estão em [`homologacao/`](homologacao/).

**Dados nas capturas:**
- o nome da conta de teste ficou visível, como nas homologações anteriores;
- o fornecedor é uma empresa cadastrada pela consulta pública do CNPJ. O CNPJ e o telefone foram cobertos nas capturas;
- o nº do documento é fictício.

| Passo | Resultado | Captura |
|---|---|---|
| Aceite da versão 2026-11-01, com o resumo do que mudou (CA-17) | ✅ | `homol_01_aceite_dos_termos.png` |
| Fornecedor empresa pelo CNPJ: a razão social, o nome fantasia, o telefone e o endereço foram preenchidos pela consulta; "Fornecedor salvo." e "Completo para nota", depois de escolhida a inscrição estadual (CA-01) | ✅ | `homol_02_fornecedor_pelo_cnpj.png`, `homol_03_fornecedor_salvo.png` |
| Nova conta a pagar na gaveta, com o fornecedor e o nº do documento; o detalhe mostra os dois, e o nome leva ao fornecedor (CA-06) | ✅ | `homol_04_nova_conta_gaveta.png`, `homol_05_conta_cadastrada.png` |
| Pagamento em duas partes, uma no Pix e outra no cartão de débito: o histórico mostra a forma de cada uma, e o valor sugerido é o restante (CA-10) | ✅ | `homol_06_pagamento_parcial.png`, `homol_07_conta_paga_e_correcao.png` |
| Conta quitada: aparece o bloco "Corrigir o fornecedor e o documento", que não muda valores (CA-08) | ✅ | `homol_07_conta_paga_e_correcao.png` |
| Lista de contas a pagar com o fornecedor e o documento em cada conta e os totais; o filtro "Quitadas" mostra 3 contas, com o total igual ao pago e nada em aberto (CA-11, CA-12) | ✅ | `homol_08_contas_em_aberto.png`, `homol_09_contas_quitadas.png` |
| Relatório de Contas: o CSV e o PDF trazem as colunas novas, com "Pix 100,00" e o pagamento anterior a esta Spec como "Não informada" (CA-15) | ✅ | `contas-2026-10-10-a-2026-11-01.csv`, `homol_11_pdf_contas.png` |
| Fluxo de caixa: os quatro pagamentos de contas do dia aparecem com a origem "Conta", e o saldo fecha com eles | ✅ | `homol_12_pdf_fluxo.png` |

**Encontrado na homologação:**
- **Campos cortados na gaveta "Nova conta"** (`homol_04_nova_conta_gaveta.png`). Valor, Categoria e Vencimento ficavam em três colunas, que não cabiam na gaveta:
  - a categoria "Fornecedores" aparecia como "Fornecedo";
  - a data também era cortada.

  O problema vem da SPEC-009 e já aparecia na captura `s26_04` do roteiro, mas passou despercebido. **Correção:** Valor e Categoria ficam lado a lado e o Vencimento embaixo, como no Novo lançamento. O roteiro foi refeito em build de produção, com as 71 verificações aprovadas, e a `s26_04` foi trocada pela nova captura.

**Observações, sem divergência:**
- **Novo lançamento × Nova conta (dúvida da equipe, `homol_10_novo_lancamento.png`).** É o comportamento previsto pela SPEC-009:
  - o lançamento registra o dinheiro que **já** entrou ou saiu, e o saldo muda na hora. No fluxo de caixa, aparece com a origem "Avulso";
  - a conta é um compromisso **com vencimento**, e o saldo só muda a cada pagamento registrado.

  O lançamento avulso não tem fornecedor nem forma (OPEN-008). A compra à vista com fornecedor fica com a SPEC-027.
- **Campos de data no padrão americano:** seguem o idioma do navegador, que estava em inglês. A equipe decidiu manter o campo do navegador na homologação da SPEC-025.

**Resultado:** T13 aprovado. A correção da gaveta entra no mesmo PR que registra esta homologação. SPEC-026 concluída em 01/11/2026.
