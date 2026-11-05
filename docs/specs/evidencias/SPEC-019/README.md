# Evidências — SPEC-019 (Suporte com edição, emergência, ações de plataforma e 2º fator)

A SPEC-019 é implementada em quatro etapas, por decisão da equipe (02/11/2026), cada uma com os próprios testes e a própria PR:
1. 2º fator do Administrador;
2. correções e desfazer, em duas partes: 2a (o mecanismo, o Catálogo e o Estoque) e 2b (a Calculadora e o Financeiro);
3. emergência e troca de plano;
4. suspensão, nova versão da Política e dos Termos, e homologação (T17).

A homologação é uma só, no fim, com um único novo aceite dos termos.

**Como as capturas são feitas** (refeitas em 05/11/2026):
- **Páginas inteiras:** a janela do navegador cresce até a altura da página. Assim, o menu lateral, o cabeçalho e as barras fixas ficam no lugar em que a pessoa os vê.
- **Diálogo ou gaveta aberta:** a captura mostra só a área visível da tela, com o fundo escurecido inteiro.
- **Por que mudou:** as capturas anteriores usavam a página inteira do navegador. Nela, o menu lateral e o fundo escurecido do diálogo ficavam recortados na altura da janela, e o resto da página aparecia deslocado ou com outra iluminação.
- **O app não mudou:** era só a forma de capturar. Os roteiros e as verificações são os mesmos.

## Etapa 1 — 2º fator do Administrador (02/11/2026)

Verificação em build de produção local (`next build` + `next start`). O ambiente tinha:
- Postgres local;
- um **Supabase Auth falso** que implementa o MFA TOTP como o Supabase: cadastro com QR code, desafio, verificação, remoção, `aal` e `amr` no JWT, link de recuperação, troca de senha e a API de administração dos fatores.

Os dados são fictícios:
- a conta de Administrador `suporte@exemplo.com` ("Equipe de Suporte");
- o Dono e o negócio **HE Testing** das evidências anteriores.

O banco recebeu a migração `20261102120000_segundo_fator`, que só acrescenta estrutura:
- o campo `Usuario.segundoFatorRedefinidoEm`;
- três eventos no registro do suporte;
- a checagem que aceita esses eventos sem negócio.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T13 | Gerador TOTP dos testes com os 18 vetores da RFC 6238 (SHA-1, SHA-256, SHA-512) e o base32 do segredo | `test/unit/segundo-fator.test.ts` | ✅ |
| T01 | Contexto do Administrador: `aal1` sem nenhum contexto (a liberação nem é lida) e tudo recusado, menos as telas do 2º fator; `aal2`; usuário comum sem efeito; a ordem senha → código → aceite; 8 h pela senha (CA-03: 9h + código às 9h05 vence às 17h); redefinição (sessão anterior vence, login depois vale, mesmo segundo conta como depois); reconfirmação de 10 min (`totp` e `mfa/totp`) e a fábrica `acaoCritica` | `test/unit/segundo-fator.test.ts` | ✅ |
| T01 | Fluxos com o dublê do Supabase Auth, que gera e confere códigos TOTP reais: cadastro (nome → QR → código, código errado, nome repetido, cadastro pendente apagado), código no login com dois autenticadores, remoção (nunca o último), nova senha com o código (CA-20) e a conta comum sem mudança | `test/integracao/segundo-fator.test.ts` | ✅ |
| T12 | Redefinição pelo workflow: apaga os fatores pela API de administração, grava `segundoFatorRedefinidoEm`, registra quem redefiniu e invalida a sessão aberta antes. Conta inexistente, conta comum ou falha no Supabase não gravam nada | idem | ✅ |
| INV-011 | Os eventos novos do registro são só de inclusão (o gatilho recusa alterar e apagar) | idem | ✅ |
| — | Toda Server Action continua criada por uma fábrica, agora com `acaoDoSegundoFator` e `acaoCritica` | `test/unit/acoes.test.ts` | ✅ |

**Suíte completa:** 616 testes unitários e 319 de integração passaram, além de lint, tipos e a checagem do schema (`migrate diff` sem diferença).
- **Testes antigos ajustados:** os testes de contexto da SPEC-018 passaram a informar a sessão do Administrador já com o código verificado (`aal2`). Sem isso, o contexto é recusado, como a nova regra exige.

### Roteiro no navegador (parte do T14 e do T15)

74 verificações, todas aprovadas (`scratchpad/e2e19/spec19.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| O Dono entra como sempre, sem 2º fator | ✅ | — |
| **Administrador sem fator (CA-01, CA-02):** depois da senha, só "Configure o 2º fator" e "Sair". Painel, Minha conta, aceite dos termos e ficha do negócio levam de volta a essa tela | ✅ | `s19_01_configurar_*` |
| **Cadastro:** <ul><li>nome obrigatório;</li><li>QR code e o segredo em texto, em grupos de 4;</li><li>código errado recusado;</li><li>com o código certo, a sugestão do segundo autenticador;</li><li>"Agora não" leva ao painel, com o aviso de "só um autenticador";</li><li>o registro guarda o cadastro, sem negócio</li></ul> | ✅ | `s19_02_qr_code_*`, `s19_03_*`, `s19_04_*` |
| **Minha conta:** <ul><li>a lista de autenticadores; com um só, sem "Remover";</li><li>nome repetido recusado;</li><li>o segundo autenticador cadastrado volta a Minha conta com "Autenticador cadastrado.";</li><li>o aviso do painel some</li></ul> | ✅ | `s19_05_minha_conta_*` |
| **Remover com reconfirmação (OPEN-003, INV-002):** com o último código de mais de 10 min: <ul><li>"Remover" e a confirmação abrem o diálogo do código, com a escolha do autenticador;</li><li>código errado recusado;</li><li>com o certo, a remoção continua sozinha e o registro guarda a remoção</li></ul> | ✅ | `s19_06_reconfirmacao_1440_claro.png` |
| **Login seguinte:** senha → "Digite o código do autenticador" → código errado recusado → painel | ✅ | `s19_07_codigo_*` |
| **Nova senha pelo link de recuperação (OPEN-017, CA-20):** <ul><li>a tela pede o código; sem ele, não troca;</li><li>com ele, "Senha alterada. Entre com a senha nova.";</li><li>a senha nova vale, e o código continua pedido</li></ul> | ✅ | `s19_08_nova_senha_*` |
| **Sessão vencida não troca a senha:** um Administrador com o login de mais de 8 h que abre a nova senha vai ao login ("Sua sessão de administrador expirou"); só a sessão do link de recuperação troca a senha | ✅ | — |
| **Redefinição pelo workflow (CA-05, T12):** <ul><li>o script, com a URL e a chave secreta por variável de ambiente, diz quantos autenticadores removeu, sem mostrar o e-mail inteiro;</li><li>o banco e o registro guardam quem redefiniu;</li><li>a sessão aberta vence ("Sua sessão de administrador expirou");</li><li>o próximo login pede o cadastro de novo</li></ul> | ✅ | — |
| Sem rolagem horizontal em 390 e 1440 px. Axe sem violações nos temas claro e escuro, em 390 e 1440 px: configurar, QR code, Minha conta, digitar o código e nova senha | ✅ | todas |

**Dados nas capturas:**
- a conta, o nome e o e-mail são fictícios;
- o QR code é de mentira, gerado pelo Supabase falso. O Supabase de verdade gera um QR code legível pelos aplicativos.

### Encontrado no roteiro e nos testes

- **Checagem do registro do suporte:**
  - **Problema:** uma checagem de 17/10/2026 só aceitava sem negócio os eventos de papel, e os eventos do 2º fator eram recusados.
  - **Correção:** a migração da etapa recria a checagem com os três eventos novos. A comparação é em texto, porque um valor novo de enum não pode ser usado na mesma transação em que foi criado.
- **QR code cortado:**
  - **Problema:** o SDK entrega o QR code como `data:image/svg+xml;utf-8,` seguido do SVG cru, e um `#` dentro do SVG (uma cor) corta a imagem.
  - **Correção:** o adaptador passou a codificar o SVG, e o roteiro confere que a imagem carrega.
- **Diálogo do código dentro do formulário:** o envio do diálogo, num portal, subia pela árvore do React até o formulário da remoção, que o tratava como o primeiro clique. O diálogo agora fica fora do formulário.
- **Mesmo segundo da redefinição:**
  - **Problema:** o JWT guarda o login em segundos inteiros, e um login no mesmo segundo da redefinição vencia na hora.
  - **Correção:** a comparação passou a ser por segundo, e esse login conta como depois da redefinição.
- **Nova senha com a sessão vencida** (encontrado na revisão do código):
  - **Problema:** a tela da nova senha passou a aceitar a sessão sem o login com senha, que é o caso do link de recuperação. Sem outro cuidado, uma sessão de Administrador com mais de 8 h trocaria a senha sem o código.
  - **Correção:** a sessão vencida de um login com senha vai ao login, na página e na ação. O roteiro confere isso.
- **Detalhes de tela:**
  - o segredo quebrava no meio de um grupo de 4 e agora quebra só entre os grupos;
  - os botões do diálogo do código ficaram da mesma altura.

### Fica para as próximas etapas

- **Lista "Administradores" no painel (5.9):** com quantos autenticadores cada conta tem. Entra na etapa 3, junto com os pedidos que precisam de duas pessoas.
- **Política e Termos:** a nova versão sai na etapa 4, com um único novo aceite.
- **Modelo lógico de dados:** atualizado na etapa 4, com as entidades novas da SPEC-019.

## Etapa 2a — correções do suporte no Catálogo e no Estoque, e o desfazer (02/11/2026)

Verificação em build de produção local, no mesmo ambiente da etapa 1: Postgres local e o Supabase Auth falso. Os dados são fictícios:
- o Dono e o negócio **HE Testing** das evidências anteriores;
- a conta de Administrador `suporte@exemplo.com` ("Equipe de Suporte");
- o item **Caneta azul**, com custo de R$ 40,00 e preço de R$ 50,00.

O banco recebeu a migração `20261102180000_correcoes_do_suporte`, que só acrescenta:
- os eventos `CORRECAO` e `CORRECAO_DESFEITA`;
- `AcessoSuporte.modulosComCorrecao`, vazio nas liberações que já existem (continuam só de leitura);
- `RegistroSuporte.dados` (a ação, o registro, o antes e o depois) e `RegistroSuporte.correcaoId` (o desfazer aponta a correção);
- checagens no banco:
  - os módulos em correção estão entre os liberados e entre os que têm correções;
  - com correção, o prazo é de até 12 h;
  - a correção sempre tem os dados e a liberação;
  - cada correção é desfeita no máximo uma vez;
  - o desfazer só aponta uma correção do mesmo negócio.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T02 | A lista fechada num lugar só: as oito correções da etapa, cada uma com o desfazer. As Server Actions marcadas no código são exatamente as da lista, uma vez cada e no módulo certo. Só as consultas do NCM são marcadas como consulta. Vendas, clientes e fornecedores nunca são marcados | `test/unit/correcoes.test.ts` | ✅ |
| T02, CA-06 | Liberação: com correção, só 1 h ou 12 h; sem ela, os prazos de leitura. Corrigir só os módulos marcados que têm correções | idem | ✅ |
| T02, CA-07, INV-003 | Autorização no modo suporte: <ul><li>as correções da lista passam no módulo em correção;</li><li>fora da lista: `ForaDaListaDeCorrecoes`;</li><li>nos módulos só em "ver" e no resto: `SomenteLeitura`;</li><li>a busca do NCM só no módulo em correção;</li><li>sem a entrada com o código reconfirmado nesta sessão (outra sessão, depois da saída, outra conta): só leitura;</li><li>para os membros, a marca não muda nada</li></ul> | idem e `test/integracao/correcoes.test.ts` | ✅ |
| 5.3, item 1 | Entrar na liberação com correção pede o código dos últimos 10 min; a entrada fica registrada como reconfirmada | idem | ✅ |
| T03, CA-08, INV-004 | Pelas Server Actions da aplicação, com o banco: <ul><li>cada correção grava o evento `CORRECAO` com o antes e o depois só dos campos alterados, na mesma transação;</li><li>sem mudança (mesmo valor, erro de validação), nada é registrado;</li><li>falha forçada no registro: a correção não é gravada</li></ul> | `test/integracao/correcoes.test.ts` | ✅ |
| T04, CA-09, INV-005 | Desfazer, por ação da lista: <ul><li>custo e campos do item;</li><li>preço (novo registro; sem preço antes, recusa);</li><li>arquivar e reativar (código em uso, recusa com a mensagem do Catálogo);</li><li>criar subcategoria (com itens, recusa) e renomear;</li><li>entrada (saída de 10; saldo insuficiente, recusa), saída e mínimo</li></ul>Também: <ul><li>registro mudado, recusa; outro campo mudado não impede;</li><li>30 dias, uma vez, só o Dono, só o próprio negócio</li></ul> | idem | ✅ |
| 5.3, item 5 | O resumo ao Dono na saída conta só as correções desta visita, deste Administrador | `test/unit/correcoes.test.ts` e `test/integracao/correcoes.test.ts` | ✅ |

**Suíte completa:** 644 testes unitários e 337 de integração passaram, além de lint, tipos e a checagem do schema (`migrate diff` sem diferença).

**Testes antigos ajustados:**
- as guardas das ações do NCM e das subcategorias passaram a levar a marca da correção;
- a ficha do painel mostra também os módulos em correção da liberação.

### Roteiro no navegador (parte do T14 e do T15)

59 verificações, todas aprovadas (`scratchpad/e2e19a/spec19a.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| **Gaveta da liberação (5.2, CA-06):** <ul><li>Catálogo e Estoque oferecem "Ver" (padrão) e "Ver e corrigir"; Vendas, não;</li><li>com "Ver e corrigir", a lista do que o suporte poderá alterar e o texto do desfazer em 30 dias;</li><li>os prazos passam a ser 1 h (marcado) e 12 h</li></ul> | ✅ | `s19a_01_gaveta_ver_e_corrigir_*` |
| **Faixa dos membros:** "O suporte do HE pode ver … e corrigir Catálogo até …"; a liberação mostra o nível de cada módulo | ✅ | `s19a_04_*` |
| **Entrada com o código (5.3, item 1):** <ul><li>a ficha do painel mostra "Corrigir: Catálogo";</li><li>com o último código de mais de 10 min, "Entrar em modo suporte" abre o diálogo do código, e nada é registrado antes;</li><li>com o código, entra e o registro guarda a entrada reconfirmada</li></ul> | ✅ | `s19a_02_entrada_pede_codigo_1440_claro.png` |
| **Só os botões da lista (5.3, item 2; CA-07):** <ul><li>a faixa diz "pode corrigir: Catálogo";</li><li>Vendas e Estoque (só ver) sem botões;</li><li>Catálogo sem "Novo item";</li><li>o item com "Editar item", "Definir o preço" e "Arquivar item"</li></ul> | ✅ | `s19a_03_item_no_suporte_*` |
| **Correção (CA-08):** <ul><li>o custo passa de R$ 40,00 a R$ 42,00, e o evento guarda só o custo;</li><li>o preço passa a R$ 55,00, e o histórico mostra "Equipe de Suporte (suporte do HE)"</li></ul> | ✅ | — |
| **"Acessos do suporte" (5.10):** as duas correções na hora, com o campo, o antes, o depois e quem corrigiu | ✅ | `s19a_04_acessos_com_correcoes_*` |
| **Desfazer recusado (5.5, item 4):** o Dono mudou o custo depois da correção. O diálogo diz o que o desfazer faz, e a recusa explica: "Caneta azul mudou depois da correção. Ajuste direto em Catálogo." O custo do Dono fica | ✅ | `s19a_05_confirmar_desfazer_1440_claro.png`, `s19a_06_desfazer_recusado_1440_claro.png` |
| **Desfazer o preço (CA-09):** <ul><li>o preço volta a R$ 50,00;</li><li>o histórico mantém 50, 55 e 50;</li><li>o cartão mostra "Desfeita por …", e o registro, o desfazer em nome do Dono</li></ul> | ✅ | `s19a_07_desfeita_*` |
| **Saída:** registrada; a correção vale só até ela | ✅ | — |
| Sem rolagem horizontal em 390, 768 e 1440 px. Axe sem violações nos temas claro e escuro, em 390 e 1440 px: gaveta da liberação e "Acessos do suporte" | ✅ | todas |

**Dados nas capturas:** o negócio, o item, as contas e os nomes são fictícios.

### Decisões tomadas na implementação

- **Antes e depois:** o evento guarda só os campos que a correção mudou (5.3, item 4). O desfazer confere o estado atual nesses campos. Outro campo mudado depois não impede o desfazer e continua como está.
- **Transação única:** as funções do módulo abrem as próprias transações. Dentro da correção, cada uma vira um passo da transação da correção, e o evento entra na mesma transação.
- **Reconfirmação da entrada:** vale para a entrada nesta sessão, até a saída, a expiração ou a revogação. Se o Administrador entrar de novo com a senha, a faixa avisa "para corrigir, saia e entre de novo".
- **Telas da correção:** no modo suporte, abrem só as telas das ações da lista: editar item, registrar entrada e registrar saída.
- **Calculadora e Financeiro:** a gaveta só oferece "Ver e corrigir" para eles na etapa 2b, junto com as correções deles.
- **E-mails ao Dono:** a liberação e a primeira entrada dizem o que o suporte pode corrigir. Na saída, o Dono recebe "O suporte fez N correções", se houve alguma.

### Fica para as próximas etapas

- **Etapa 2b:** as correções da Calculadora e do Financeiro (OPEN-015 e OPEN-016, vínculo da conta mantido).
- **Negócio suspenso (OPEN-018):** a recusa da correção e do desfazer entra na etapa 4, com a suspensão.

## Etapa 2b — correções do suporte no Financeiro e na Calculadora (02/11/2026)

Verificação em build de produção local, no mesmo ambiente das etapas anteriores. Os dados são fictícios:
- o Dono e o negócio **HE Testing**;
- a conta de Administrador `suporte@exemplo.com`;
- o fornecedor **Gráfica Exemplo** e a conta a pagar "Impressão de etiquetas", com ele e o documento NF-321.

Sem migração nova: a etapa usa a estrutura da 2a.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T02 | A lista fechada com as 16 correções da tabela 5.4. As Server Actions marcadas no código são exatamente as da lista. O que o suporte nunca faz (criar item, excluir subcategoria, estorno, pagamento, cancelar conta, saldo inicial, corrigir o vínculo) não está na lista | `test/unit/correcoes.test.ts` | ✅ |
| T02, CA-19, OPEN-016 | Pelas Server Actions, com o banco: <ul><li>a conta e a despesa criadas pelo suporte nascem sem fornecedor ou cliente, mesmo que o formulário mande um;</li><li>a edição mantém o fornecedor e o documento;</li><li>numa conta com fornecedor, a troca para "a receber" é recusada com a explicação, e nada é registrado;</li><li>sem vínculo, a troca vale;</li><li>estorno, pagamento, cancelamento, saldo inicial e a correção do vínculo são recusados (`ForaDaListaDeCorrecoes`)</li></ul> | `test/integracao/correcoes-financeiro.test.ts` | ✅ |
| T03, INV-004 | Cada correção grava o antes e o depois, sem o fornecedor nem o cliente (INV-009). Se o serviço do módulo engolir um erro do banco, a transação volta ao ponto anterior e nada é gravado | idem | ✅ |
| T04, CA-18, OPEN-015 | Desfazer: <ul><li>parâmetros da Calculadora (valores anteriores);</li><li>confirmar preço (novo registro com o preço anterior);</li><li>lançamento avulso (estorno; já estornado, recusa);</li><li>criar conta (cancela; com pagamento, recusa);</li><li>editar conta (campos anteriores, com o vínculo; com pagamento depois, recusa);</li><li>criar despesa (desativa e cancela a conta gerada; com a conta paga, recusa com o mês);</li><li>ativar (cancela só a conta gerada a partir dela) e desativar (reativa);</li><li>editar despesa (campos anteriores, com o fornecedor)</li></ul> | idem | ✅ |
| 5.3, item 3 | A conta criada e o lançamento mostram "{nome} (suporte do HE)" | idem | ✅ |

**Suíte completa:** 644 testes unitários e 351 de integração passaram, além de lint, tipos, build de produção e a checagem do schema (`migrate diff` sem diferença).

**Testes antigos ajustados:** o teste das permissões do Financeiro aceita a chamada da fábrica em várias linhas e a marca da correção como último argumento.

### Roteiro no navegador (parte do T14 e do T15)

39 verificações, todas aprovadas (`scratchpad/e2e19b/spec19b.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| **Gaveta da liberação:** Financeiro e Calculadora oferecem "Ver e corrigir", com a lista do que o suporte poderá alterar; liberação por 12 h | ✅ | `s19b_01_gaveta_financeiro_390_escuro.png` |
| **Só os botões da lista:** <ul><li>a faixa diz "pode corrigir: Calculadora, Financeiro";</li><li>no caixa, "Novo lançamento", sem saldo inicial e sem estorno;</li><li>na conta, sem pagamento, sem cancelar e sem corrigir o vínculo</li></ul> | ✅ | — |
| **Lançamento avulso** pela gaveta, em nome do Administrador | ✅ | — |
| **Nova conta (vínculo como está):** sem o fornecedor, sem "Novo fornecedor" e com o aviso; a conta mostra "Equipe de Suporte (suporte do HE)" | ✅ | `s19b_02_nova_conta_no_suporte_*` |
| **CA-19:** na conta com fornecedor, a troca para "a receber" é recusada: "Esta conta tem fornecedor. Só o Dono troca o tipo dela." A edição da descrição mantém o fornecedor e o documento | ✅ | `s19b_03_tipo_com_vinculo_1440_claro.png` |
| **Despesa fixa:** nova, sem o fornecedor; a conta do mês gerada na hora | ✅ | — |
| **Calculadora:** a taxa do cartão passa a 4,2% | ✅ | — |
| **"Acessos do suporte":** as cinco correções, com o antes e o depois; a despesa mostra a conta gerada; o fornecedor não aparece | ✅ | `s19b_04_acessos_financeiro_*` |
| **CA-18:** o Dono paga a conta do aluguel; desfazer a despesa é recusado: "A conta de MM/AAAA desta despesa já tem pagamento. Ajuste direto no Financeiro." A despesa continua ativa | ✅ | `s19b_05_desfazer_despesa_recusado_1440_claro.png` |
| **Desfazer a edição da conta** (a descrição volta, com o fornecedor) e **o lançamento** (estorno em nome do Dono) | ✅ | `s19b_06_desfeitas_1440_claro.png` |
| Sem rolagem horizontal em 390 e 1440 px. Axe sem violações em "Acessos do suporte" com as correções do Financeiro, nos temas claro e escuro, em 390 e 1440 px | ✅ | todas |

**Dados nas capturas:** o negócio, as contas, o fornecedor e os nomes são fictícios. No modo suporte, o nome do fornecedor aparece mascarado ("G*** E***"), como na SPEC-026.

### Decisões tomadas na implementação

- **Conta criada:** a ação leva ao detalhe da conta. O motor acha a conta pelas contas novas do Administrador.
- **Vínculo como está:** na criação, a conta e a despesa nascem sem fornecedor ou cliente; na edição, ficam os atuais. O formulário do suporte não mostra esses campos e traz o aviso.
- **Contas geradas (OPEN-015):** o antes e o depois registram os meses das contas da despesa. O desfazer da criação ou da ativação cancela as contas dos meses que não existiam antes. Se uma delas tem pagamento, o desfazer é recusado com o mês.
- **Desfazer uma desativação:** reativa como o Dono reativaria, com a conta do mês.
- **Transação abortada:** os serviços do Financeiro traduzem as falhas em mensagens. Se um erro do banco for engolido assim, a correção volta ao ponto anterior e nada é gravado.
- **Históricos do Financeiro:** o lançamento e a conta criada pelo suporte mostram "{nome} (suporte do HE)".
