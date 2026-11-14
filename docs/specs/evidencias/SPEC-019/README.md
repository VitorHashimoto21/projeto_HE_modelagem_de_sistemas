# Evidências — SPEC-019 (Suporte com edição, emergência, ações de plataforma e 2º fator)

A SPEC-019 é implementada em quatro etapas, por decisão da equipe (02/11/2026), cada uma com os próprios testes e a própria PR:
1. 2º fator do Administrador;
2. correções e desfazer, em duas partes: 2a (o mecanismo, o Catálogo e o Estoque) e 2b (a Calculadora e o Financeiro);
3. troca de plano e emergência, em duas partes: 3a (pedidos com duas pessoas, troca de plano pela plataforma e painel) e 3b (acesso de emergência);
4. suspensão, nova versão da Política e dos Termos, e homologação, em duas partes: 4a (suspender e reativar o negócio) e 4b (Política e Termos, exportação LGPD, exclusão da conta de Administrador, modelo lógico de dados e homologação, T17).

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

## Etapa 3a — pedidos com duas pessoas, troca de plano pela plataforma e painel (05/11/2026)

Verificação em build de produção local, no mesmo ambiente das etapas anteriores. Os dados são fictícios:
- o Dono e o negócio **HE Testing**, que começa no plano gratuito, com a colaboradora Joana;
- duas contas de Administrador: `suporte@exemplo.com` ("Equipe de Suporte", a conta A, que pede) e `suporte2@exemplo.com` ("Segunda Pessoa do Suporte", a conta B, que aprova ou recusa).

O banco recebeu a migração `20261105120000_pedidos_da_plataforma`, que só acrescenta:
- a tabela `PedidoPlataforma` (RLS ligado, sem política), com os tipos `EMERGENCIA` e `PLANO` e as situações `PENDENTE`, `APROVADO`, `RECUSADO`, `CANCELADO` e `EXPIRADO`;
- os eventos `PLANO_SOLICITADO`, `PLANO_APROVADO` e `PLANO_RECUSADO`, com `RegistroSuporte.pedidoId`;
- `HistoricoPlano.motivo` e `HistoricoPlano.pedidoId`, vazios nas trocas antigas, feitas pelo Dono;
- checagens no banco:
  - quem decide nunca é quem pediu (INV-006);
  - o pedido vale até 12 h;
  - cada situação tem os seus campos, e a recusa tem o motivo;
  - os dados do pedido de plano são completos;
  - um pedido pendente por negócio e tipo;
  - o pedido nunca é apagado, e só a decisão muda, uma vez;
  - o histórico e o registro só apontam pedidos do mesmo negócio;
- fora do Supabase, um substituto mínimo de `auth.mfa_factors`, para a contagem dos autenticadores. No Supabase, nada muda.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T05, CA-15, CA-16, INV-006 | Pelo banco real: <ul><li>o pedido fica pendente por 12 h, com o `PLANO_SOLICITADO` na mesma transação;</li><li>um pendente por negócio (também pelo índice);</li><li>mesmo plano, negócio encerrado e inexistente recusados;</li><li>quem pediu não aprova nem recusa, e o banco recusa também;</li><li>conta comum não decide;</li><li>duas aprovações ao mesmo tempo trocam o plano uma vez só;</li><li>a recusa guarda o motivo;</li><li>com uma conta só, o pedido expira em 12 h sem aprovação;</li><li>o vencido não é aprovado, e um novo pedido toma o lugar dele;</li><li>só quem pediu cancela;</li><li>quem pediu sem o papel e o negócio encerrado depois do pedido recusam a aprovação</li></ul> | `test/integracao/plataforma.test.ts` | ✅ |
| T09 | A troca pela plataforma pelo mesmo núcleo da troca do Dono: reativa os suspensos no pago; na volta ao gratuito, um colaborador continua, e com dois, os dois ficam sem acesso até o Dono escolher; os convites pendentes são cancelados; o histórico tem o pedido e a descrição; nada é apagado | idem | ✅ |
| INV-006, RN32 | O pedido decidido não muda, nenhum pedido é apagado, a situação vem com os seus campos (CHECK), o isolamento entre negócios e os eventos só de inclusão. RLS ligado, sem política | idem | ✅ |
| 5.9 e 5.10 | As listas do painel e do Dono com os nomes e a situação; a lista de Administradores conta os autenticadores ativos em `auth.mfa_factors` | idem | ✅ |
| 5.8 | Os fluxos (`servicos.ts`): validação do pedido e da recusa, cada recusa com a sua mensagem, e o e-mail ao Dono só na aprovação, com o motivo e os efeitos | `test/unit/plataforma.test.ts` e `test/integracao/plataforma.test.ts` | ✅ |
| INV-002, OPEN-003 | Pedir, aprovar e recusar são ações críticas (`acaoCritica`); cancelar o próprio pedido basta a conta de Administrador | `test/unit/plataforma.test.ts` | ✅ |

**Suíte completa:** 662 testes unitários e 376 de integração passaram, além de lint, tipos, build de produção e a checagem do schema (`migrate diff` sem diferença).

**Testes antigos:** a troca de plano do Dono passou a usar o núcleo comum (`aplicarTroca`), e os testes da SPEC-013 continuam passando. Só o nome de um deles mudou: o que confere quem escreve o plano agora cita o núcleo.

### Roteiro no navegador (parte do T14 e do T15)

81 verificações, todas aprovadas (`scratchpad/e2e19c/spec19c.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| **2º fator das duas contas:** A cadastra um autenticador, e B, dois. Os três aparecem em `auth.mfa_factors` | ✅ | — |
| **Administradores:** as duas contas, com "(você)" na própria, desde quando e os autenticadores. A, com um só, em destaque | ✅ | `s19c_01_administradores_*` |
| **Pedir a troca:** na ficha, a gaveta com o plano atual desligado, o destino, o motivo e a descrição. Sem motivo e descrição, a gaveta explica o que falta | ✅ | `s19c_02_pedir_troca_*` |
| **Código de novo:** passados 10 min, nada é gravado e o código é pedido. Com ele, o pedido fica pendente por 12 h, com o `PLANO_SOLICITADO` | ✅ | `s19c_03_pedir_pede_codigo_1440_claro.png` |
| **INV-006 na tela:** no próprio pedido, "Aguardando outra pessoa" e "Cancelar pedido", sem "Aprovar"; "Trocar plano" desligado | ✅ | `s19c_04_ficha_pedido_pendente_*` |
| **O Dono vê o pedido** em "Acessos do suporte", com o motivo, quem pediu e que nada muda antes da aprovação | ✅ | — |
| **B vê o aviso:** no painel, "1 pedido de outra conta aguarda a sua decisão", e a seção Pedidos mostra 1 | ✅ | `s19c_05_painel_aguardando_1440_claro.png` |
| **B aprova** (CA-15): o pedido com o negócio, o motivo e quem pediu; a confirmação diz o que muda; o código de novo. O plano passa a pago em nome de B, com o histórico "pela plataforma" e o `PLANO_APROVADO` | ✅ | `s19c_06_pedidos_para_aprovar_*`, `s19c_07_confirmar_aprovacao_1440_claro.png` |
| **O Dono é avisado:** na tela Plano, o aviso e o histórico do plano "pela plataforma do HE", com o motivo; em "Acessos do suporte", "Plano trocado", com quem aprovou | ✅ | `s19c_08_plano_do_dono_*`, `s19c_09_acessos_do_suporte_*` |
| **Recusa e cancelamento:** B recusa outro pedido (sem motivo, a recusa é recusada); A cancela um terceiro. Quem pediu vê o motivo da recusa, e o Dono vê os dois desfechos | ✅ | `s19c_10_recusar_390_claro.png`, `s19c_11_pedidos_decididos_*` |
| **Uma conta só** (CA-16): sem o papel de B, a gaveta e a página de pedidos avisam que o pedido vai expirar sem aprovação, e a conta A não tem "Aprovar" | ✅ | `s19c_12_uma_conta_so_1440_claro.png` |
| Sem rolagem horizontal em 390, 768 e 1440 px. Axe sem violações em Administradores, ficha com o pedido, Pedidos, Plano e "Acessos do suporte", nos temas claro e escuro, em 390 e 1440 px | ✅ | todas |

**Dados nas capturas:** as contas, os e-mails (`@exemplo.com`), o negócio e os nomes são fictícios.

### Encontrado no roteiro e nos testes

- **Checagem que aceitava NULL:** a recusa sem motivo e o pedido de plano sem uma das chaves passavam pela checagem do banco, porque a comparação dava NULL, e o PostgreSQL aceita NULL num CHECK. As duas checagens passaram a usar `COALESCE(..., false)`, e o teste cobre os dois casos.
- **Aviso que não aparecia:** depois de pedir, aprovar, recusar ou cancelar, a página recarregada tira o componente da tela (o pedido sai da lista), e o aviso flutuante, disparado depois, não aparecia. Agora o aviso sai da resposta da própria ação, e "Trocar plano" fica sempre na tela, desligado quando não cabe.
- **Link só pela cor:** o nome do negócio no título do pedido passou a ser sublinhado (axe, `link-in-text-block`).

### Decisões tomadas na implementação

- **Volta ao gratuito pela plataforma:** o Administrador não vê a equipe e não escolhe quem continua. Com um colaborador com acesso, ele continua. Com mais de um, todos ficam sem acesso até o Dono escolher quem volta em Equipe.
- **Expiração:** a leitura mostra o vencido como expirado. A primeira gravação depois do prazo o marca no banco, com a hora do prazo.
- **Cancelar:** sem o código e sem evento no registro (a seção 7 não prevê um). O pedido guarda a situação e a hora.
- **Quem aparece como autor:** o plano fica "alterado por" quem aprovou; o pedido guarda quem pediu.
- **Seções do painel:** Negócios, Pedidos (com o número que aguarda esta conta) e Administradores.

### Fica para as próximas etapas

- **3b:** o acesso de emergência, com o mesmo pedido de duas pessoas, e o histórico das emergências no painel.
- **Etapa 4:** a suspensão (a troca de plano vale para negócio suspenso), a situação "Suspenso" e o filtro do painel, a nova versão da Política e dos Termos e a homologação (T17), que confere também a contagem dos autenticadores no Supabase.

## Etapa 3b — acesso de emergência (06/11/2026)

Verificação em build de produção local, no mesmo ambiente da etapa 3a. Os dados são fictícios:
- o Dono e o negócio **HE Testing**, com a colaboradora Joana;
- as contas de Administrador `suporte@exemplo.com` ("Equipe de Suporte", a conta A, que pede) e `suporte2@exemplo.com` ("Segunda Pessoa do Suporte", a conta B, que aprova ou recusa).

O banco recebeu a migração `20261106120000_acesso_de_emergencia`, que só acrescenta:
- o tipo do acesso do suporte (`LIBERACAO`, o padrão das liberações que já existem, ou `EMERGENCIA`) e os campos da emergência: motivo da lista, referência, justificativa, pedido aprovado e resultado;
- os eventos `EMERGENCIA_SOLICITADA`, `EMERGENCIA_APROVADA`, `EMERGENCIA_RECUSADA`, `EMERGENCIA_ENCERRADA` e `EMERGENCIA_RESULTADO`. Por decisão da equipe, o cancelamento não vai para o registro;
- checagens no banco:
  - cada tipo de acesso com os seus campos;
  - a emergência sem correção e com até 4 h;
  - o resultado registrado uma vez, com a hora, sem mudar depois;
  - os dados completos do pedido de emergência;
  - os eventos apontando o pedido ou o acesso;
  - o pedido do mesmo negócio.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T06, INV-007 | O pedido fica pendente por 12 h, com o `EMERGENCIA_SOLICITADA`, e aparece na leitura do Dono desde já. É recusado com liberação ativa, negócio encerrado, outro pedido pendente e emergência em andamento. O banco recusa dados fora da lista | `test/integracao/emergencia.test.ts` | ✅ |
| CA-10, INV-006 | A não aprova o próprio pedido. B aprova e nasce o acesso: somente leitura, nos módulos pedidos, pelo prazo pedido, sem correção. O vencido expira; a recusa guarda o motivo e não cria acesso; com a liberação feita depois do pedido, a aprovação é recusada. Cancelar não vai para o registro | idem | ✅ |
| INV-010, CA-11, CA-12 | O contexto vale só para quem pediu: outra conta, cookie forjado e cookie inválido não têm nada. Toda ação é recusada, mesmo a de uma correção da lista, e o banco não aceita correção na emergência. O Dono encerra, e a próxima requisição volta ao painel. Vencido o prazo, o contexto acaba. Só quem pediu entra, e a saída encerra. A liberação do Dono não encerra a emergência | idem e `test/unit/emergencia.test.ts` | ✅ |
| T07, CA-13 | O resultado só depois do fim, só por quem pediu, uma vez; o banco não deixa mudar. Sem ele, não há novo pedido, em nenhum negócio. O resultado aparece para o Dono e no histórico do painel | `test/integracao/emergencia.test.ts` | ✅ |
| 5.6 | Os fluxos (`servicos.ts`): validação do pedido e do resultado, cada recusa com a sua explicação e os e-mails ao Dono no pedido e na aprovação | `test/unit/emergencia.test.ts` e `test/integracao/emergencia.test.ts` | ✅ |
| INV-002, OPEN-003 | Pedir a emergência é ação crítica (`acaoCritica`); entrar e registrar o resultado bastam a conta de Administrador; encerrar é do Dono | `test/unit/emergencia.test.ts` | ✅ |

**Suíte completa:** 676 testes unitários e 395 de integração passaram, além de lint, tipos, build de produção e a checagem do schema (`migrate diff` sem diferença).

**Testes antigos ajustados:**
- os testes da 3a passaram a usar a decisão comum aos dois tipos de pedido (`decidir`), e os resultados trazem o tipo;
- a lista fechada de campos do painel (INV-009 da SPEC-018) ganhou a emergência em andamento, um dado do próprio acesso;
- as dependências do modo suporte ganharam o encerramento da emergência.

### Roteiro no navegador (parte do T14 e do T15)

70 verificações, todas aprovadas (`scratchpad/e2e19d/spec19d.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| **A pede, sem liberação do Dono:** na ficha, a gaveta com o motivo, a referência, a justificativa, os módulos e o prazo. Sem os campos, a gaveta explica o que falta. Passados 10 min, o código é pedido de novo, e nada é gravado antes | ✅ | `s19d_01_pedir_emergencia_*` |
| **Pedido pendente:** registrado com o `EMERGENCIA_SOLICITADA`; no próprio pedido, A não tem "Aprovar" | ✅ | `s19d_02_ficha_pedido_pendente_1440_claro.png` |
| **INV-007:** o Dono vê o pedido em "Acessos do suporte" desde já, com o motivo e a referência, e que o suporte não entra antes da aprovação | ✅ | `s19d_03_dono_ve_o_pedido_*` |
| **B aprova** (CA-10): o pedido com o motivo, a referência, os módulos e o prazo; a confirmação diz o que acontece; o código de novo. Nasce o acesso de 2 h, em Vendas e Financeiro, sem correção | ✅ | `s19d_04_confirmar_aprovacao_1440_claro.png` |
| **Faixas vermelhas:** o Dono, com "Ver detalhes" e "Encerrar acesso"; a colaboradora, sem o botão | ✅ | `s19d_05_faixa_do_dono_*` |
| **INV-010:** B não tem "Entrar"; com o cookie do acesso forjado, B volta ao painel | ✅ | — |
| **A entra** (CA-12): a faixa "Emergência · HE Testing · somente leitura · até … · incidente de segurança"; sem "Nova venda" e sem "Novo lançamento"; o Catálogo e a exportação recusados; a entrada e cada tela registradas | ✅ | `s19d_06_administrador_na_emergencia_*` |
| **O Dono encerra** (CA-11): vê quem pediu, quem aprovou, a entrada e as telas; confirma no diálogo; a faixa some | ✅ | `s19d_07_acessos_com_emergencia_1440_claro.png`, `s19d_08_encerrar_acesso_390_claro.png` |
| **A volta ao painel** com "O Dono encerrou o acesso de emergência" | ✅ | `s19d_09_encerrado_pelo_dono_1440_claro.png` |
| **Resultado obrigatório** (CA-13): sem ele, "Solicitar" fica desligado com a explicação; em Emergências, o resultado vazio é recusado e o preenchido, registrado; o Dono o vê | ✅ | `s19d_10_emergencias_*`, `s19d_11_resultado_para_o_dono_390_escuro.png` |
| **Recusa:** B recusa com o motivo; o Dono vê "O suporte não entrou" | ✅ | — |
| **A saída encerra:** outro pedido aprovado; A entra e sai com "Sair e encerrar"; o acesso fica encerrado em nome de A, e a ficha pede o resultado | ✅ | — |
| **Com a liberação do Dono,** "Solicitar acesso de emergência" fica desligado, com a explicação | ✅ | `s19d_12_ficha_com_liberacao_1440_claro.png` |
| Sem rolagem horizontal em 390, 768 e 1440 px. Axe sem violações em "Acessos do suporte" com o pedido, Vendas no acesso de emergência, Emergências e a ficha, nos temas claro e escuro, em 390 e 1440 px | ✅ | todas |

**Dados nas capturas:** as contas, os e-mails (`@exemplo.com`), o negócio, os nomes e as referências são fictícios.

### Encontrado no roteiro

- **Título do pedido:** o título com o ícone da emergência virou um contêiner flexível, e o nome do negócio saía numa linha à parte no texto lido. O ícone passou a ficar em linha com o título.
- **Selo da emergência:** o selo de perigo do design system traz uma seta para baixo, pensada para valores em queda. Os selos da emergência passaram a usar a sirene.

### Decisões tomadas na implementação

- **A saída encerra:** sair do acesso de emergência o encerra; não há segunda entrada no mesmo acesso.
- **Liberação depois do pedido:** a aprovação é recusada. Uma liberação feita durante a emergência não a encerra.
- **Resultado pendente:** vale em qualquer negócio.
- **Cancelamento:** como na troca de plano, não vai para o registro (decisão da equipe, 06/11/2026), e o pedido cancelado continua visível.

### Fica para a etapa 4

A suspensão (a emergência vale para negócio suspenso), a nova versão da Política e dos Termos, a exportação LGPD dos eventos novos, o modelo lógico de dados e a homologação (T17).

## Etapa 4a — suspender e reativar o negócio (07/11/2026)

Verificação em build de produção local, no mesmo ambiente das etapas 3a e 3b. Os dados são fictícios:
- o Dono e o negócio **HE Testing**, com a colaboradora Joana, o item "Caneta azul" e um convite pendente para uma pessoa nova;
- a conta de Administrador `suporte@exemplo.com` ("Equipe de Suporte"), que suspende e reativa.

O banco recebeu a migração `20261107120000_suspensao_do_negocio`, que só acrescenta:
- no negócio, quando foi suspenso, por quem, o motivo da lista (`MotivoSuspensao`) e a descrição, até 500 caracteres;
- os eventos `SUSPENSAO` e `REATIVACAO`, com o motivo e a descrição completa nos dados;
- checagens no banco: a suspensão tem tudo junto ou nada; negócio encerrado não fica suspenso; os eventos são do negócio e têm os dados;
- o gatilho `he_negocio_suspenso` (segunda barreira, INV-008). Com o negócio suspenso, ele recusa toda gravação nas tabelas dos módulos e no próprio negócio, menos o plano e os campos da suspensão. Ficam de fora a equipe, os convites, o histórico de planos, os acessos e o registro do suporte e os pedidos da plataforma.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T08, 5.7 | Um Administrador suspende com o motivo e a descrição de 500 caracteres; o registro guarda os dois. Recusa negócio já suspenso, encerrado, inexistente e conta comum. Outra conta reativa com a descrição, e a lista do Dono mostra as duas | `test/integracao/suspensao.test.ts` | ✅ |
| T08, banco | O banco recusa a suspensão incompleta, a suspensão de negócio encerrado, o encerramento que não tira a suspensão e o evento sem os dados | idem | ✅ |
| INV-008, fábricas | Com o negócio suspenso, as ações de módulo (inclusive a de "ver" que grava) e as do Dono são recusadas (`NegocioSuspenso`), para o Dono e para a gerente. A consulta do NCM passa. O desfazer passa pela fábrica e recusa com a explicação | idem e `test/unit/suspensao.test.ts` | ✅ |
| INV-008, banco | Toda gravação nos módulos é recusada pelo banco, pelo cliente do negócio e direto: incluir, alterar e excluir item, incluir cliente e um `UPDATE` cru. No negócio, o nome e o número da venda ficam travados. O outro negócio do mesmo Dono continua gravando. Cada tabela dos módulos tem o gatilho; as que gravam na suspensão, não | `test/integracao/suspensao.test.ts` e `test/unit/modelos.test.ts` | ✅ |
| INV-003 | No suporte, as correções saem da liberação e a chamada direta é recusada; reativado, a correção volta | idem e `test/unit/suspensao.test.ts` | ✅ |
| CA-14 | Os membros leem e exportam. A liberação, a revogação, a emergência e a troca de plano pela plataforma continuam. A rotina diária pula o negócio; a conferência não tenta, e a chamada direta é recusada. Ao reativar, a conferência gera as contas do período e a gravação volta, sem nada perdido | `test/integracao/suspensao.test.ts` | ✅ |
| 5.7, Equipe | O convite pendente não é aceito e continua pendente; ao reativar, é aceito | idem | ✅ |
| 5.7, Direitos do titular | Excluir a conta do Dono encerra o negócio suspenso e tira a suspensão; a suspensão continua no registro, e os itens e os clientes (anonimizados) ficam | idem | ✅ |
| CA-21 | Uma correção de 5 dias, com o negócio suspenso: o desfazer é recusado com a explicação. O prazo continua: com 31 dias, não dá mais; reativado aos 5 dias, o desfazer volta | idem | ✅ |
| 5.7 | Os fluxos (`servicos.ts`): validação do motivo e da descrição, cada recusa com a sua explicação e os e-mails ao Dono na suspensão e na reativação | `test/unit/suspensao.test.ts` | ✅ |
| OPEN-003 | Suspender e reativar são ações críticas (`acaoCritica`). Só as quatro ações do Dono marcadas continuam na suspensão: liberar, revogar, encerrar a emergência e desfazer | idem | ✅ |

**Suíte completa:** 692 testes unitários e 408 de integração passaram, além de lint, tipos, build de produção e a checagem do schema (`migrate diff` sem diferença).

**Testes antigos ajustados:**
- a filiação passou a trazer a suspensão do negócio (`suspensao: null` quando não há);
- a lista fechada de campos do painel (INV-009 da SPEC-018) ganhou a suspensão, um metadado do próprio negócio;
- as dependências da plataforma ganharam suspender e reativar.

### Roteiro no navegador (parte do T14)

79 verificações, todas aprovadas (`scratchpad/e2e19e/spec19e.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| **Preparação:** o Dono libera o Catálogo em "Ver e corrigir"; A entra com o código e corrige o custo da caneta (R$ 40,00 → R$ 42,00) | ✅ | — |
| **A suspende** (CA-04): na ficha, a seção "Suspensão" e a gaveta com o motivo da lista e a descrição. Sem os campos, a gaveta explica o que falta. Passados 10 min, o código é pedido de novo, e nada é gravado antes | ✅ | `s19e_01_gaveta_suspender_*` |
| **Ficha suspensa:** desde quando, o motivo, quem suspendeu e a descrição; "Reativar" no lugar de "Suspender"; o acesso de suporte avisa que as correções esperam a reativação; o registro com o `SUSPENSAO` | ✅ | `s19e_02_ficha_suspensa_*` |
| **Painel** (5.9): "Suspenso desde …" na lista e o filtro "Suspensos", só com os suspensos | ✅ | `s19e_03_painel_suspensos_*` |
| **Faixa do Dono** (CA-14): "Negócio suspenso pelo HE desde {data}: incidente de segurança. Fale com o suporte.", com "Ver detalhes" | ✅ | `s19e_04_faixa_do_dono_*` |
| **Gravação recusada:** o Dono vê o item; "Novo item" e "Definir preço" levam à explicação, e o preço não muda. A exportação continua em Minha conta | ✅ | `s19e_05_gravacao_recusada_*` |
| **"Acessos do suporte":** a suspensão com o motivo, a descrição e quem suspendeu. O desfazer é recusado com a explicação (CA-21), e nada é desfeito | ✅ | `s19e_06_acessos_do_suporte_*` |
| **Colaboradora:** a faixa, sem "Ver detalhes" | ✅ | `s19e_07_faixa_da_colaboradora_390_claro.png` |
| **Convite:** o link avisa e não oferece o aceite; em "Convites para você", o aceite é recusado e o convite continua pendente | ✅ | `s19e_08_convite_suspenso_390_escuro.png` |
| **Modo suporte** (INV-003): a faixa "somente leitura (negócio suspenso: sem correções até a reativação)"; sem os botões de correção no item | ✅ | `s19e_09_modo_suporte_suspenso_1440_claro.png` |
| **A reativa:** sem a descrição, a gaveta explica; com ela, o negócio volta e o registro guarda o `REATIVACAO`. A ficha mostra o histórico das duas | ✅ | `s19e_10_gaveta_reativar_1440_claro.png` |
| **De volta** (CA-14, CA-21): a faixa some; o Dono vê a reativação com a descrição; o desfazer volta (custo R$ 40,00); o Dono define o preço; a pessoa convidada aceita o convite | ✅ | `s19e_11_reativado_*` |
| Sem rolagem horizontal em 390 e 1440 px. Axe sem violações na gaveta "Suspender", na ficha suspensa, no painel com o filtro, no Painel do Dono com a faixa, na explicação da suspensão e em "Acessos do suporte", nos temas claro e escuro, em 390 e 1440 px | ✅ | todas |

**Dados nas capturas:** as contas, os e-mails (`@exemplo.com`), o negócio, os nomes e as descrições são fictícios. O token do convite não aparece.

### Encontrado no roteiro

- **Texto repetido:** a explicação da recusa repetia "suspenso pelo HE" logo depois da faixa. Passou a dizer desde quando, o motivo e o que continua.
- **Faixa da liberação:** com o negócio suspenso, ela ainda dizia que o suporte podia corrigir. Passou a avisar que as correções liberadas esperam a reativação.

### Decisões tomadas na implementação

- **Botões de gravar visíveis:** a faixa avisa, e a recusa leva à explicação, sem rever cada tela dos módulos.
- **Ações de "ver" que gravam:** são recusadas na suspensão; só as consultas marcadas passam.
- **Exclusão da conta do Dono:** encerra o negócio e tira a suspensão; a suspensão continua no registro.
- **Entrada com correção:** ainda pede o código, mas as correções ficam recusadas até a reativação.

### Fica para a etapa 4b

A nova versão da Política e dos Termos, com novo aceite (RF78), a exportação LGPD dos eventos novos e dos pedidos da plataforma, a exclusão da conta de Administrador sem o papel e os autenticadores, o modelo lógico de dados e a homologação (T17).

## Etapa 4b — Política e Termos, exportação LGPD e exclusão da conta de Administrador (07/11/2026)

Verificação em build de produção local, no mesmo ambiente das etapas anteriores, com a chave secreta falsa do Supabase. Os dados são fictícios:
- o Dono e o negócio **HE Testing**;
- as contas de Administrador `suporte@exemplo.com` (A) e `suporte2@exemplo.com` (B, que exclui a própria conta).

Sem migração nova. A versão da Política e dos Termos passou a **2026-11-07** (`VERSAO_TERMOS`), e todos aceitam de novo.

### Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T11, RNF04 | O Dono exporta o registro do suporte com os dados de cada evento: o motivo e a descrição da suspensão, e o pedido de cada evento. Exporta também os pedidos da plataforma, com quem pediu, quem decidiu e o desfecho. A colaboradora não leva nada disso. A conta de Administrador leva só os eventos dela fora de negócio | `test/integracao/lgpd-plataforma.test.ts` | ✅ |
| T11, INV-011 | Os eventos novos (suspensão, reativação, plano e emergência) não podem ser alterados nem apagados | idem | ✅ |
| 5.11 | A exclusão da conta de Administrador retira o papel e os autenticadores, com os dois no registro; sem a chave, o papel sai e a credencial fica para a rotina; conta comum não chama a API | idem e `test/unit/lgpd.test.ts` | ✅ |
| 5.11 | Os arquivos novos da exportação (`pedidos-plataforma.csv`, `eventos-da-conta.csv`) e o `LEIA-ME.txt` | `test/unit/lgpd.test.ts` | ✅ |
| T16 | A Política e os Termos estão na versão de `VERSAO_TERMOS` | `test/unit/acesso.test.ts` | ✅ |
| Workflow | O e-mail não entra pelo `env` nem pela linha de comando; o primeiro passo o mascara antes de repassá-lo | `test/unit/administradores-workflow.test.ts` | ✅ |

**Suíte completa:** os números estão na PR, com lint, tipos, build de produção e a checagem do schema.

### Roteiro no navegador (T16 e parte do T11 e do T14)

42 verificações, todas aprovadas (`scratchpad/e2e19f/spec19f.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| **Novo aceite** (T16): o Dono entra e vê "O que mudou nesta versão (2026-11-07)", com correções, emergência, suspensão e troca de plano; aceita e vai ao Painel; o aceite fica gravado | ✅ | `s19f_01_novo_aceite_*` |
| **Política e Termos:** a Política na versão 2026-11-07, com as seções novas, o 2º fator e a exportação; os Termos com a seção 4-B e a suspensão no "Uso permitido" | ✅ | `s19f_02_politica_suporte_1440_claro.png` |
| **A (2º fator e novo aceite)** suspende, reativa e pede a troca de plano | ✅ | — |
| **Exportação** (T11): o `.zip` do Dono traz `registros-suporte.csv`, com a coluna `dados` (motivo e descrição da suspensão), e `pedidos-plataforma.csv`; o `LEIA-ME.txt` explica os dois | ✅ | — |
| **B exclui a própria conta** (5.11): o autenticador sai do Supabase Auth, o papel sai, a credencial é removida na hora e o registro mostra "Papel de Administrador retirado" e "1 autenticador removido"; a lista de Administradores não mostra mais B | ✅ | `s19f_03_excluir_conta_admin_1440_claro.png`, `s19f_04_administradores_depois_1440_claro.png` |
| Sem rolagem horizontal em 390 e 1440 px. Axe sem violações na tela do novo aceite, na Política e em Administradores, nos temas claro e escuro, em 390 e 1440 px | ✅ | todas |

**Dados nas capturas:** as contas, os e-mails (`@exemplo.com`), o negócio e os nomes são fictícios.

### Encontrado no roteiro

- **Tabela da Política no celular:** em 390 px, a tabela "Quais dados tratamos" rola na horizontal, e o axe apontou que a área não recebia o foco do teclado. A área passou a ser focável, com nome e contorno de foco. Isso vale para todas as tabelas dos textos legais.

### Decisões tomadas na implementação

- **Eventos da conta na exportação:** só os da própria conta fora de negócio (papel e 2º fator), em `eventos-da-conta.csv`.
- **Autenticadores antes da credencial:** a API de administração remove os fatores logo depois da exclusão; sem a chave, a credencial os leva depois.
- **E-mail mascarado no workflow:** os logs novos mostram `***`; os logs antigos precisam ser apagados pela equipe (*Actions → Administradores → "⋯" → Delete all logs*).
- **Imagem do modelo lógico:** não foi regerada aqui (o ambiente não roda o mermaid-cli). O bloco Mermaid, que o GitHub desenha, está atualizado.

### Homologação (T17)

O roteiro está em [`homologacao.md`](homologacao.md). O registro está na seção [Homologação (T17)](#homologação-t17--08-e-09112026), no fim deste documento.

## Correção da homologação — faixas que não atualizavam ao navegar (08/11/2026)

**Problema (passo 5.3 do T17):** com o acesso de emergência aprovado, a faixa vermelha só aparecia para o Dono depois de atualizar a página, e só sumia do mesmo jeito depois do encerramento, mesmo navegando entre Catálogo, Estoque e as outras telas. O acesso em si estava certo: o servidor confere a liberação a cada página e ação, e a conta de suporte voltou ao painel quando o Dono encerrou. O que ficava para trás era só o aviso.

**Causa:** as faixas ficam no layout da área do negócio, e o Next.js não recalcula o layout na navegação: só a página muda. Valia para tudo o que outra pessoa muda: a faixa da emergência, a da suspensão, a do suporte liberado e o menu (plano e permissões).

**Correção:**
- o servidor resume o que as faixas e o menu mostram numa assinatura (`src/lib/dominio/faixas.ts` e `src/lib/estrutura/faixas.ts`), e a rota `GET /api/faixas` devolve só essa assinatura, sem cache;
- no layout, o `AtualizadorDasFaixas` confere a assinatura a cada navegação, ao voltar para a aba e a cada minuto com a aba visível, e atualiza o layout (`router.refresh()`) só quando ela mudou;
- a conferência só lê: não registra tela no modo suporte nem grava nada;
- junto: a página "Pedidos da plataforma" passou a citar o acesso de emergência na descrição e na lista vazia (os textos eram da etapa 3a).

**Testes:** unidade (`test/unit/faixas.test.ts`, 4) e integração com o banco real (`test/integracao/faixas.test.ts`, 4: a assinatura muda na aprovação e no fim da emergência, na suspensão, na troca de plano e na liberação, volta à de antes quando o estado volta, e a leitura não registra nada). Roteiro no navegador com duas sessões, navegando pelo menu (sem recarregar a página), **25 verificações, todas aprovadas** (`scratchpad/e2e19g/spec19g.mjs`):

| Passo | Antes (DEVELOP) | Depois |
|---|---|---|
| B aprova a emergência; o Dono vai ao Catálogo pelo menu: a faixa vermelha aparece, com "Encerrar acesso" | ✗ não aparece | ✅ em ~0,5 s |
| A colaboradora navega: vê a faixa, sem "Encerrar acesso" | — | ✅ |
| Parado no Catálogo, sem navegar: a faixa some sozinha depois que o suporte sai e encerra | — | ✅ em menos de 1 min |
| A conferência de cada minuto do suporte, parado em Vendas, não registra tela | — | ✅ |
| A suspende; o Dono volta para a aba: a faixa da suspensão aparece. Depois da reativação, some na navegação seguinte | — | ✅ |
| `/api/faixas`: sem sessão leva ao login; com sessão, só a assinatura, sem cache, e a mesma enquanto nada muda | — | ✅ |
| "Pedidos da plataforma" cita o acesso de emergência na descrição e na lista vazia | ✗ | ✅ |

Capturas: `s19g_01_faixa_ao_navegar_1440_claro.png`, `s19g_01_faixa_ao_navegar_390_escuro.png` e `s19g_02_suspensao_ao_voltar_1440_claro.png`. Os dados são fictícios.

**Na homologação:** depois do merge, conferir de novo o passo 5.3 sem atualizar a página: aprovar a emergência e, na tela do Dono, só navegar pelo menu; a faixa deve aparecer. Encerrar e esperar até 1 minuto parado (ou trocar de página): a faixa deve sumir.

## Homologação (T17) — 08 e 09/11/2026

**Quem testou:** Rafael Di Santi, no navegador Opera GX (computador) e no celular. **Onde:** na `DEVELOP` publicada em <https://he-homol.vercel.app>, depois do merge do PR #134 (etapa 4b) e, a partir do passo 5.3 repetido, do PR #135 (correção das faixas). **Contas:** um Dono com um negócio de teste, a Conta A e a Conta B de Administrador (duas das três concedidas pelo workflow) e uma conta de colaboradora. As capturas estão em [`homologacao/`](homologacao/), nomeadas pelo passo do roteiro.

**Dados nas capturas:**
- os nomes e os e-mails reais do Dono, da Conta B e dos Donos dos outros negócios foram cobertos (pela equipe ou antes de salvar), assim como os nomes dos negócios na lista do painel;
- o QR code e o código de configuração do 2º fator (passo 2.1) foram cobertos pela equipe antes de enviar;
- ficaram visíveis o nome da conta de suporte da Conta A ("… Suporte"), por decisão da equipe, e o nome do negócio de teste;
- nos arquivos da exportação (7.1), as colunas com o negócio e os identificadores foram cobertas.

**Configuração (seção 0 do roteiro):** MFA TOTP ligado; a chave secreta conferida na Vercel; as três contas de Administrador conferidas; os logs antigos do workflow apagados; o emissor do autenticador ficou o padrão ("Health Enterprise"), por decisão da equipe. O segredo `SUPABASE_URL` faltava no ambiente `homologacao` do GitHub e foi cadastrado no passo 7.2 (abaixo).

| Passo | Resultado | Capturas (`homologacao/`) |
|---|---|---|
| **1.1–1.3** Novo aceite: "Atualizamos nossos termos", versão 2026-11-07, com o resumo das quatro mudanças; a Política e os Termos na versão nova, com as seções de correções, emergência e suspensão e a 4-B; depois do aceite, o app abre e o aceite não volta (nem ao recarregar ou reabrir o site) | ✅ | `homol_01-1_*`, `homol_01-2a…d_*`, `homol_01-3_*` |
| **1.4** As Contas A e B aceitam a versão nova depois do código do autenticador | ✅ | `homol_01-4_aceite_administrador.png` (A); B confirmado pela equipe |
| **2.1–2.2** Conta A sem autenticador: "Configure o 2º fator", QR code e código; depois do primeiro, "Cadastre um segundo autenticador" com "Agora não"; o painel avisa "Sua conta tem só um autenticador" | ✅ | `homol_02-1a/b_*`, `homol_02-2_*` |
| **2.3** Conta B com dois autenticadores: painel sem o aviso; em "Administradores", 2 autenticadores | ✅ | `homol_02-3a…d_*` |
| **2.4** Sair e entrar de novo: o código é pedido depois da senha | ✅ | `homol_02-4_pede_codigo.png` |
| **3.1** Liberação com Catálogo, Estoque e Financeiro em "Ver e corrigir", 1 h: a gaveta lista o que o suporte poderá corrigir; a faixa da equipe diz "… e corrigir Catálogo, Estoque, Financeiro" | ✅ | `homol_03-1a…c_*` |
| **3.2** "Entrar em modo suporte" pede o código de novo; a faixa âmbar diz "pode corrigir: Catálogo, Estoque, Financeiro" | ✅ | `homol_03-2a/b_*` |
| **3.3–3.4** A corrige o custo de um item (R$ 5,50 → R$ 6,00); o Dono vê o antes e o depois e desfaz; aparece "Desfeita por …" e o custo volta a R$ 5,50 no Catálogo | ✅ | `homol_03-3a/b_*`, `homol_03-4_*` |
| **4.1–4.3** Troca de plano pedida por A (para o Gratuito, porque o negócio já estava no Pago), com o código; "Aguardando outra pessoa" e "Cancelar pedido" para A, sem "Aprovar"; B aprova com o código (escolhendo o autenticador); o Dono vê o plano Gratuito "pela plataforma do HE", o aviso e o pedido em "Acesso do suporte" | ✅ | `homol_04-*` |
| **5.1–5.2** Com a liberação revogada, A pede a emergência (código pedido); a ficha mostra "Aguardando outra pessoa", sem "Aprovar"; o Dono já vê o pedido em "Acesso do suporte" | ✅ | `homol_05-1_5-2a_*`, `homol_05-2b/c_*` |
| **5.3** B aprova (código pedido); a faixa vermelha aparece para o Dono, com "Encerrar acesso" | ✅ depois do PR #135 | `homol_05-3a/b_*` (antes); `homol_05-3c/d_*` (depois) |
| **5.4** A entra: faixa "Emergência · … · somente leitura", sem ações de gravar | ✅ | `homol_05-4_*` |
| **5.5** O Dono encerra; A volta ao painel com "O Dono encerrou o acesso de emergência. Registre o resultado em Emergências."; A registra o resultado e o Dono o vê | ✅ | `homol_05-5a…c_*` |
| **6.1** A suspende (motivo da lista e descrição; código pedido): a ficha mostra "Suspenso desde …" e o filtro "Suspensos" lista o negócio | ✅ | `homol_06-1a…c_*` |
| **6.2–6.3** O Dono vê a faixa "Negócio suspenso pelo HE desde …: pedido do Dono. Fale com o suporte." com "Ver detalhes" e a suspensão em "Acesso do suporte"; gravar leva a "Este negócio está suspenso" | ✅ | `homol_06-2_*`, `homol_06-2b_*`, `homol_06-3_*` |
| **6.4** Com o negócio suspenso, a exportação baixa o `.zip` | ✅ | `homol_06-4_*` |
| **6.5** A reativa com a descrição: a faixa some, "Nova venda" volta, e o Dono vê a reativação e a suspensão em "Acesso do suporte" | ✅ | `homol_06-5a/b_*` |
| **7.1** O `.zip` traz `registros-suporte.csv` (com a coluna `dados` preenchida na suspensão e na reativação) e `pedidos-plataforma.csv` (com os `dados` de cada pedido) | ✅ | `homol_07-1a…d_*` |
| **7.2** `redefinir-2fator` para A, a partir da `DEVELOP`, no ambiente `homologacao`: o log mostra `EMAIL: ***`; a mensagem final confirma "1 autenticador removido"; a próxima entrada de A pede o cadastro de novo, e A cadastrou dois autenticadores | ✅ (com a ressalva do e-mail, abaixo) | `homol_07-2a…c_*` |
| **7.3** Exclusão de uma conta de Administrador só de teste | — opcional, não feito (coberto no roteiro local da etapa 4b) | — |
| **8** Telas no celular, nos temas claro e escuro: painel do Administrador, gavetas "Suspender", "Reativar" e "Liberar acesso", ficha do negócio, modo suporte e "Acesso do suporte" com a faixa da suspensão; nada passa da largura da tela. No computador, as capturas dos passos anteriores, nos dois temas | ✅ | `homol_08_*` |

A largura de tablet (768 px) e a página do novo aceite no celular não foram capturadas na homologação; as duas estão cobertas pelos roteiros locais (`s19*_768_*` e `s19f_01_novo_aceite_390_escuro.png`).

**Encontrado na homologação:**
1. **Faixas que só atualizavam ao recarregar a página (5.3):** a faixa da emergência aprovada só aparecia para o Dono depois de atualizar a página, e só sumia do mesmo jeito. O layout da área do negócio não é recalculado na navegação. **Corrigido no PR #135** (seção acima) e conferido de novo: a faixa aparece e some sem recarregar.
2. **Textos da página "Pedidos da plataforma":** a descrição e a lista vazia falavam só de troca de plano. **Corrigido no PR #135.**
3. **Segredo `SUPABASE_URL` fora do ambiente `homologacao` (7.2):** o workflow parou em "Segredos SUPABASE_URL e SUPABASE_SECRET_KEY não definidos"; o log mostrou que só o `SUPABASE_URL` faltava entre os segredos. A equipe o cadastrou e o workflow rodou. O README (passo 9) passa a dizer que os dois são *segredos* do ambiente, não variáveis.
4. **Parte do e-mail no log do workflow (7.2):** a variável aparece como `***`, mas a mensagem final do script mostra a primeira letra e o domínio do e-mail (o mascaramento das telas de suporte). **Corrigido no PR #137** ([ajustes pós-homologação](#ajustes-pós-homologação-12112026)), junto com a mensagem de erro dizendo qual segredo falta.
5. **Busca do painel no celular (8):** o texto de exemplo "Nome do negócio ou e-mail do Dono" fica cortado. **Corrigido no PR #137.**
6. **Seletor de negócio desatualizado (8):** depois de trocar o negócio ativo por "Meus negócios", o seletor do topo continuou mostrando o negócio anterior, embora a página e a faixa fossem do negócio certo (o servidor usa o negócio certo). Vem da SPEC-016. **Corrigido no PR #137.**

**Decisões da equipe na homologação:** o emissor do autenticador fica "Health Enterprise" também na homologação; o nome da conta de suporte pode aparecer nas capturas; o 7.3 fica de fora; os itens 4 a 6 vão num PR logo depois do T17 (PR #137) e não bloqueiam a aprovação.

**Fica registrado:** a conta de Administrador de 18/10 ainda não tem autenticador (cadastra na próxima entrada) e deve ter dois antes da produção, como as Contas A e B. O e-mail ao Dono prometido na Política e nos Termos depende do domínio próprio (pendência aberta).

**Resultado:** **T17 aprovado em 09/11/2026.** SPEC-019 concluída em 09/11/2026; os ajustes 4 a 6 foram feitos no PR #137 (seção abaixo).

## Ajustes pós-homologação (12/11/2026)

PR #137, com os itens 4 a 6 encontrados na homologação. Nenhum deles muda o comportamento da Spec.

**1. Mensagem do workflow "Administradores" sem nenhuma parte do e-mail (item 4):**
- **Problema:** a variável já aparecia como `***`, mas a mensagem final do script usava o mascaramento das telas do suporte ("r***@dominio"). Esse mascaramento mostra a primeira letra e o domínio, e o log do GitHub Actions é público.
- **Correção:** no GitHub Actions, a mensagem diz só "a conta informada" (ex.: "Pronto: a conta informada agora é administradora (concedido por …)"). No terminal da equipe, continua o e-mail mascarado, para conferir a conta. As frases saíram do script para `src/lib/dominio/administradores.ts`, onde são testadas.

**2. O erro diz qual segredo falta (item 3):**
- **Problema:** no `redefinir-2fator`, o workflow dizia "Segredos SUPABASE_URL e SUPABASE_SECRET_KEY não definidos" mesmo quando faltava só um.
- **Correção:** agora diz qual falta: "Falta o segredo SUPABASE_URL no ambiente homologacao.", o mesmo para o outro, ou "Faltam os segredos … e …" quando faltam os dois.
- **Onde cadastrar:** a mensagem também diz onde cadastrar (*Settings → Environments → (ambiente) → Environment secrets*) e lembra que variáveis do ambiente não valem.
- **Fora do workflow:** o script faz a mesma conferência quando roda direto.

**3. Texto de exemplo da busca do painel do Administrador (item 5):** "Nome do negócio ou e-mail do Dono" passou a "Negócio ou e-mail do Dono". O rótulo para leitores de tela continua "Buscar por nome do negócio ou e-mail do Dono".

**4. Seletor de negócio (item 6, da SPEC-016):**
- **Por que acontecia:** o seletor do topo, no computador e no celular, é uma lista com valor inicial. Depois de montada, ela não acompanha a troca desse valor, e o layout não é recriado na navegação. Trocado o negócio por "Meus negócios", a página ia para o negócio novo, e o seletor continuava no anterior.
- **Correção:** o seletor é recriado quando o negócio ativo muda (`key`).
- **Sem risco aos dados:** o servidor sempre usou o negócio certo; o erro era só no que o seletor mostrava.

**Testes:**
- `test/unit/administradores-mensagens.test.ts` (4 testes):
  - no Actions, nenhuma arroba, domínio ou primeira letra;
  - no terminal, o e-mail mascarado;
  - as frases;
  - qual segredo falta.
- `test/unit/administradores-workflow.test.ts` (+4 testes): o passo "Verificar se o ambiente está configurado" roda no bash com cada combinação de segredos. Contra o workflow antigo, o teste "sem um deles, diz qual" falha.
- **Suítes completas:** lint, 709 testes de unidade e 419 de integração, e o build de produção.

**Roteiro no navegador** (build local, `scratchpad/e2e19h/spec19h.mjs`): **16 verificações, todas aprovadas**. Para conferir que o roteiro pega o defeito, ele também rodou num build sem a correção do seletor; ali, as verificações do seletor falharam.

| Verificação | Sem a correção | Com a correção |
|---|---|---|
| O Dono troca de negócio por "Meus negócios" (1440 e 390 px): a página é do negócio novo, e o seletor também mostra o negócio novo | ✗ o seletor mostra o anterior | ✅ |
| O texto de exemplo da busca cabe no campo (360, 390 e 1440 px) | ✗ 232 px, num campo de 174 px em 360 e de 204 px em 390 | ✅ 173 px |
| O rótulo para leitores de tela continua completo | — | ✅ |
| axe no painel do Administrador, 390 px, temas claro e escuro | — | ✅ nenhuma violação |
| Sem rolagem horizontal nas capturas | — | ✅ |

**Capturas** (os dados são fictícios):
- `s19h_01a_seletor_antes_390_claro.png`: sem a correção. A página é da Papelaria Fictícia, e o seletor mostra "HE Testing".
- `s19h_01b_seletor_depois_390_claro.png`: com a correção.
- `s19h_02_busca_do_painel_390_claro.png`.

**Conferido na homologação em 12/11/2026, depois do merge:**
- **Workflow "Administradores":** rodou da `DEVELOP`, no ambiente `homologacao`, e nenhuma parte do e-mail apareceu no log. Mostrou só `EMAIL: ***` e "a conta informada":
  - `conceder` de uma conta nova: "Pronto: a conta informada agora é administradora (…)";
  - `conceder` de novo, na mesma conta: "A conta informada já é administradora desde … Nada mudou.";
  - antes disso, `conceder` de uma conta que participava de um negócio: recusado com "A conta participa de 1 negócio(s). Use uma conta exclusiva para o suporte." A regra da conta exclusiva continua valendo;
  - `retirar` de uma conta que não era administradora: "A conta informada não era administradora. Nada mudou."
- **Logs de 08/11/2026:** a equipe apagou os logs da execução do `redefinir-2fator` (as duas tentativas). A API do GitHub não encontra mais os logs dessa execução.
- **Contas de Administrador na homologação** (conferidas em 12/11/2026): são quatro, identificadas pela coluna "Desde" da aba Administradores.
  - **A conta de 18/10/2026 e a de 12/11/2026** são de uma pessoa da equipe. Cada uma tem um autenticador fora do celular principal.
  - **A Conta A (desde 28/10/2026) e a Conta B (desde 01/11/2026)** são da pessoa que fez a homologação. Os dois autenticadores de cada conta estão no mesmo celular: os da A num celular, os da B em outro. Foram cadastrados assim para testar, com uma pessoa usando duas contas, o que não acontece no uso real. A equipe aceitou essas contas de teste assim. Se um desses celulares sumir, a conta volta pelo `redefinir-2fator`.
  - **Na produção**, cada pessoa usa uma conta só, com os dois autenticadores em lugares diferentes: um no celular e o outro em outro aparelho ou num gerenciador de senhas, nunca os dois no mesmo aplicativo do mesmo celular. O segundo existe para entrar se o celular sumir.
