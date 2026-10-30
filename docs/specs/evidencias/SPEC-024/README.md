# Evidências — SPEC-024 (Código interno dos itens)

Verificação em build de produção local (`next build` + `next start`), com Postgres e o Supabase Auth falso, em 30/10/2026. Negócio de teste **HE Testing** (plano pago), com dados fictícios. Os códigos foram cadastrados pela tela (Brinco argola dourado BR-015, Argola prata BR-0150, Pulseira riviera PU-001) e pelo banco (Kit de unhas KIT-01, o serviço Troca de lâmpadas SRV-01 e o Anel solitário AN-001, que não tem preço oficial).

## Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T01 | Normalização ("br-015 " → "BR-015"), vazio como item sem código nos dois tipos, conjunto permitido, limite de 20 e recusa de espaço, acento e outros símbolos com a mensagem de formato | `test/unit/codigo-interno.test.ts` | ✅ |
| T02 | Item pelo código exato: maiúsculas e espaços nas pontas; parte do código, nome, vazio e item fora da lista não encontram nada; o exato primeiro, os outros na mesma ordem | idem | ✅ |
| T03 | Cadastro, troca e remoção do código; código em uso recusado com o nome do outro item, também na edição; serviço com código; o mesmo código em outro negócio; o banco recusa a repetição, o formato e a chave incoerente, também em duas gravações ao mesmo tempo | `test/integracao/codigo-interno.test.ts` | ✅ |
| T04 | O arquivado mantém o código e o libera; reativar com o código em uso é recusado (`codigo-em-uso`); editar o arquivado não confere a repetição; o nome continua conferido ao reativar | idem | ✅ |
| T05 | Busca do Catálogo e do Estoque pelo código (inteiro ou parte), com o exato primeiro; o Estoque só com produtos; outro negócio não vê; contagem e filtro dos itens sem código (só ativos, produtos e serviços) | idem | ✅ |
| T06 | Itens vendáveis com o código; venda registrada e o detalhe com o código atual (depois de trocá-lo); rentabilidade com o código; exportação com o `codigo` no `dados.json` e no `itens.csv` | idem | ✅ |
| T07 | Rentabilidade: a coluna "Código" na tabela (CSV e PDF), vazia sem código, com o arquivado; larguras somando 1; cabeçalho do CSV | `test/unit/codigo-interno.test.ts` | ✅ |
| T08 | As ações que gravam exigem *Catálogo: criar* e *editar*; o modo suporte vê o código e a busca, mas a edição é recusada e o banco recusa a escrita | `test/integracao/codigo-interno.test.ts` | ✅ |

Toda a suíte passou: 547 testes unitários e 283 de integração, além de lint e tipos. Três testes de antes mudaram só na expectativa exata: a busca do Catálogo tem um critério a mais (o código) e o detalhe da venda traz o código de cada item.

## Roteiro no navegador (T09 e T10)

111 verificações, todas aprovadas (`scratchpad/e2e/spec24.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| Edição do Brinco: digitado "br-015 ", o campo mostra em maiúsculas; salvo como BR-015; o detalhe mostra a linha "Código" (CA-01) | ✅ | `s24_01_detalhe_1440_claro.png` |
| Pulseira com "BR 015": mensagem de formato. Com "br-015": "O código BR-015 já é usado por “Brinco argola dourado”. Use outro código."; nada gravado; o código digitado continua no campo (CA-03, CA-04) | ✅ | `s24_02_codigo_em_uso_390_claro.png` |
| Lista do Catálogo: "BR-015 · Produto físico, …" e "SRV-01 · Serviço, …"; link "Itens sem código (3)" (CA-06, CA-09) | ✅ | `s24_03_catalogo_1440_claro.png`, `s24_03_catalogo_390_escuro.png` |
| Busca "br-015": Brinco (exato) e depois Argola (BR-0150); busca "015" pelo meio do código (CA-06) | ✅ | — |
| "Itens sem código": aviso "Mostrando itens sem código." e só os 3 itens ativos sem código (CA-09) | ✅ | `s24_04_itens_sem_codigo_768_claro.png` |
| Estoque: "BR-015 · Acessórios …" na lista e no detalhe, exato primeiro; o serviço SRV-01 não aparece (CA-06) | ✅ | `s24_05_estoque_1440_escuro.png` |
| Nova venda: "br-01" lista os dois brincos e o Enter não adiciona nada; "br-015" põe o Brinco primeiro (CA-07) | ✅ | `s24_06_nova_venda_busca_390_claro.png` |
| "br-015" + Enter adiciona 1, limpa a busca e mantém o foco; "BR-015" digitado de uma vez com Enter (como um leitor) soma 1; "an-001" + Enter (item sem preço): "Nenhum item à venda com o código AN-001." e nada adicionado; "srv-01" + Enter adiciona o serviço; o Enter nunca enviou a venda (CA-07, INV-005) | ✅ | `s24_07_nova_venda_carrinho_1440_claro.png` |
| Detalhe da venda: "BR-015 · Brinco argola dourado"; na troca, "pu-001" + Enter adiciona a pulseira como item novo (CA-08, CA-10) | ✅ | `s24_08_venda_detalhe_768_escuro.png` |
| Relatórios: coluna "Código" na rentabilidade por item; no celular, "Código BR-015" no cartão do item (CA-10) | ✅ | `s24_09_relatorios_1440_claro.png`, `s24_09_relatorios_390_escuro.png` |
| Reativar o Ear cuff (EC-1) com a Lixa ativa usando EC-1: "Já existe um item ativo com o código EC-1. Troque o código de um deles antes de reativar."; tirado o código da Lixa, reativa com a chave de volta (CA-05) | ✅ | `s24_10_reativar_codigo_em_uso_1440_claro.png` |
| Todas as telas em 390, 768 e 1440 px, claro e escuro, sem rolagem horizontal; axe sem violações na edição com erro, no Catálogo, no Estoque, na Nova venda, no detalhe da venda e nos Relatórios, nos dois temas (CA-13) | ✅ | — |

## Encontrado no roteiro

- **Corrigido nesta implementação:** depois de um Enter com um código sem item, o texto ficava no campo, e a leitura seguinte do leitor se juntava a ele ("AN-001SRV-01"). Agora o texto fica **selecionado**: a pessoa ainda vê o código que falhou, e a próxima leitura o substitui.
- **Corrigido nesta implementação:** o código recusado pelo servidor (em uso) sumia do campo, porque o formulário usava `<form action>` e o React 19 volta os campos não controlados ao valor inicial depois de cada envio. O campo do código passou a ser controlado; a correção completa está no item abaixo.
- **Observação, fora desta Spec (SPEC-006), corrigida no PR #117:** o mesmo acontecia com o **nome** e os outros campos não controlados quando o servidor recusava o envio. Na edição, o nome voltava ao original ao lado da mensagem "Já existe um item ativo com esse nome"; no cadastro, nome, categoria e unidade ficavam vazios. **Decisão da equipe (30/10/2026): opção 1, corrigir.** O formulário do item e o "Definir o preço" passaram a enviar pela transição (`startTransition`), como o formulário de clientes (SPEC-022). Conferido no navegador, com 16 verificações: na edição recusada (código e depois nome em uso), nome, código e comissão ficam; no cadastro recusado, nome, código, categoria, unidade, custo e comissão ficam; o "Definir o preço" mantém o valor recusado (preço igual ao atual) e limpa o campo depois de gravar; axe sem violações. Capturas: `s24_11_edicao_nome_em_uso_768_claro.png` e `s24_12_cadastro_nome_em_uso_390_escuro.png`.

## Pendente

- **T11 — homologação**, com itens da loja de semijoias e, se a equipe tiver, um leitor de código de barras com etiqueta própria, depois do merge na `DEVELOP`.
