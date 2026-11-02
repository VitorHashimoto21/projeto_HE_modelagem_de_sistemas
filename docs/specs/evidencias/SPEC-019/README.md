# Evidências — SPEC-019 (Suporte com edição, emergência, ações de plataforma e 2º fator)

A SPEC-019 é implementada em quatro etapas, por decisão da equipe (02/11/2026), cada uma com os próprios testes e a própria PR:
1. 2º fator do Administrador;
2. correções e desfazer;
3. emergência e troca de plano;
4. suspensão, nova versão da Política e dos Termos, e homologação (T17).

A homologação é uma só, no fim, com um único novo aceite dos termos.

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
