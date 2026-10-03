# SPEC-002 — Acesso: cadastro, login e consentimento

> **Status:** proposta — aguardando aprovação da equipe. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar). Nenhum código foi escrito.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anterior:** [SPEC-001](SPEC-001.md) · **Próximas que dependem desta:** SPEC-004 e SPEC-014.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-002 |
| **Nome** | Acesso: cadastro, login e consentimento |
| **Objetivo** | Permitir que uma pessoa crie uma conta com nome, e-mail e senha, aceitando explicitamente a política de privacidade e os termos de uso; entre e saia do sistema; recupere a senha; e mantenha uma sessão segura, validada no servidor, que passa a fornecer o contexto de usuário (e, quando houver, de negócio ativo) ao cliente do negócio da SPEC-001. |
| **Valor entregue** | O usuário passa a ter uma conta segura no HE, com a senha guardada só no Supabase Auth, e o sistema passa a saber, em toda requisição, quem está acessando. É a porta de entrada para cadastrar o negócio (SPEC-004) e aceitar convites (SPEC-005). |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF01 | Cadastro e login por e-mail e senha. |
| **RNF** | RNF03 | A senha (com hash seguro) fica somente no Supabase Auth; a tabela `Usuario` não tem senha (ADR-003, OPEN-14). |
| | RNF04 (consentimento) | Aceite explícito da política de privacidade e dos termos no cadastro, com data registrada em `Usuario.consentimentoLgpdEm`. A exportação e a exclusão ficam na SPEC-014. |
| | RNF07 | Sessão persistente, que continua válida ao trocar o negócio ativo (a troca em si é da SPEC-004). |
| | RNF01 | Telas de acesso responsivas, conforme o protótipo revisado. |
| | RNF02 | O contexto usado pelo cliente do negócio passa a vir da sessão validada no servidor. |
| | RNF11 | Configuração do Supabase Auth e das URLs de retorno por ambiente. |
| **Caso de uso / fluxo** | UC1 Autenticar-se | Jornadas de todos os papéis começam na "Tela de Login" (`MODELO_DOMINIO_E_JORNADAS.md` §2). |
| **Entidades** | Usuario | `id` (= `auth.users.id`), `nome`, `email`, `consentimentoLgpdEm`, `excluidoEm` (só leitura aqui). |
| **Drivers** | AD-RF02 | Base da autorização no servidor (papéis ficam na SPEC-005). |
| | AD-QA03 | Consentimento explícito (LGPD). |
| | AD-QA06 | Nenhum dado de negócio é acessível sem sessão válida. |
| **ADRs** | ADR-003 | Supabase Auth definitivo; autorização validada no servidor; `Usuario.id` = `auth.users.id`. |
| | ADR-001 | Server Actions e middleware do Next.js. |
| **Outros artefatos** | `docs/design/IDENTIDADE_VISUAL.md` §8 e `docs/design/prototipo_revisado/` | A tela de login segue o protótipo revisado. |

---

## 3. Escopo

### Incluído

1. **Cadastro:** formulário com nome, e-mail, senha e confirmação da senha, e caixa de aceite da política de privacidade e dos termos de uso (desmarcada por padrão).
2. **Criação do `Usuario`:** ao criar a conta no Supabase Auth, um registro em `Usuario` com o **mesmo id** de `auth.users.id`, o nome, o e-mail e a data do consentimento (ver OPEN-001 sobre o mecanismo).
3. **Confirmação de e-mail:** a conta só pode entrar depois de confirmar o e-mail pelo link enviado (ver OPEN-002).
4. **Login** por e-mail e senha, conforme o protótipo revisado (`prototipo_revisado/App.tsx`).
5. **Logout** em qualquer tela autenticada.
6. **Recuperação de senha:** pedido pelo e-mail ("Esqueci a senha") e definição de nova senha pelo link recebido.
7. **Sessão:** cookies de sessão do Supabase gerenciados no servidor, renovados automaticamente, com proteção das rotas autenticadas por middleware.
8. **Contexto da requisição:** uma função de servidor que obtém o usuário da sessão e, se houver, o negócio ativo (guardado na sessão/cookie), **confirmando no banco** que o usuário é membro desse negócio; é ela que alimenta o cliente do negócio da SPEC-001.
9. **Destino após o login:** página "Meus negócios", que nesta Spec mostra apenas o estado vazio ("Você ainda não tem um negócio") com o caminho para o cadastro de negócio da SPEC-004; respeita um destino de retorno interno (ex.: o link de convite da SPEC-005).
10. **Páginas de política de privacidade e termos de uso**, ligadas no cadastro e no rodapé (o texto é da equipe — ver OPEN-003).
11. **Configuração por ambiente** (RNF11): projeto Supabase Auth de homologação configurado, URLs de retorno de desenvolvimento, preview e homologação liberadas, e checklist de produção.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cadastro de negócio, consulta de CNPJ e troca do negócio ativo (seletor) | SPEC-004 |
| Convites, papéis e permissões | SPEC-005 |
| Exportação de dados e exclusão de conta (inclusive o bloqueio por `excluidoEm`) | SPEC-014 — esta Spec apenas recusa o login de quem tem `excluidoEm` preenchido, sem implementar a exclusão |
| Login social (Google etc.) | Roadmap (`IDENTIDADE_VISUAL.md` §8) |
| Autenticação em dois fatores | Evolução futura |
| Edição de perfil (nome, e-mail, senha logado) | Evolução futura, salvo decisão da equipe |

---

## 4. Dependências

- **Specs anteriores:** SPEC-001 (projeto, schema v7 com `Usuario` sem senha, cliente do negócio, RLS, ambientes e CI).
- **Decisões arquiteturais:** ADR-003 (Supabase Auth, autorização no servidor), OPEN-14 (`Usuario.id` = `auth.users.id`), OPEN-27 (ambientes).
- **Pré-requisitos externos:**
  - projeto Supabase de homologação (o mesmo da SPEC-001) com o provedor de e-mail e senha ativo;
  - serviço de envio de e-mail configurado no Supabase Auth (ver OPEN-002);
  - textos da política de privacidade e dos termos de uso (ver OPEN-003).

---

## 5. Comportamento esperado

### 5.1 Cadastro

- **Pré-condições:** a pessoa não está autenticada.
- **Fluxo principal:**
  1. A pessoa informa nome, e-mail, senha e confirmação, e marca o aceite da política e dos termos.
  2. O sistema valida os campos na interface e **novamente no servidor**.
  3. O servidor cria a conta no Supabase Auth e o registro em `Usuario` com o mesmo id, o nome, o e-mail e `consentimentoLgpdEm` = agora.
  4. O sistema envia o e-mail de confirmação e mostra "Enviamos um link para seu e-mail".
  5. Ao clicar no link, o e-mail é confirmado e a pessoa entra no sistema, indo para "Meus negócios".
- **Fluxos alternativos e de exceção:**

| Situação | Comportamento |
|---|---|
| Aceite não marcado | Cadastro bloqueado: "É preciso aceitar a política de privacidade e os termos de uso". |
| Campo obrigatório vazio, e-mail inválido, senha fora da política (OPEN-004) ou confirmação diferente | Mensagem ligada ao campo (`aria-describedby`), nada é enviado ao servidor; o servidor repete as validações. |
| E-mail já cadastrado | Mesma tela de sucesso do fluxo principal ("Enviamos um link…"), sem revelar que o e-mail existe; o dono do e-mail recebe um aviso de que já tem conta. |
| Falha ao criar o `Usuario` depois de criar a conta no Supabase | Nenhuma conta fica pela metade: ou as duas existem, ou nenhuma (ver OPEN-001); a pessoa vê erro genérico e pode tentar de novo. |
| Link de confirmação expirado ou já usado | Tela com opção de reenviar o e-mail de confirmação. |

- **Pós-condições:** existe uma conta no Supabase Auth e um `Usuario` com o mesmo id e com `consentimentoLgpdEm` preenchido.

### 5.2 Login

- **Fluxo principal:** a pessoa informa e-mail e senha; o servidor autentica no Supabase, cria a sessão e redireciona para o destino de retorno interno (se houver) ou para "Meus negócios".
- **Exceções:**

| Situação | Comportamento |
|---|---|
| E-mail ou senha incorretos | "E-mail ou senha incorretos" — a mesma mensagem nos dois casos. |
| E-mail ainda não confirmado | "Confirme seu e-mail para entrar", com opção de reenviar o link. |
| Usuário com `excluidoEm` preenchido | Login recusado com a mensagem genérica de credenciais (RN27). |
| Muitas tentativas seguidas | Bloqueio temporário pelo limite de tentativas do Supabase Auth, com mensagem "Muitas tentativas. Tente novamente em alguns minutos". |
| Destino de retorno externo (outro domínio) | Ignorado; a pessoa vai para "Meus negócios". |

### 5.3 Logout

A sessão é encerrada no servidor e no navegador, e a pessoa volta para a tela de login. Voltar no navegador não exibe páginas autenticadas.

### 5.4 Recuperação de senha

1. Em "Esqueci a senha", a pessoa informa o e-mail; o sistema responde sempre "Se houver uma conta com esse e-mail, enviamos um link" (sem revelar se existe).
2. O link leva à tela de nova senha (com a mesma política de senha e confirmação).
3. Ao salvar, a senha é trocada no Supabase Auth, as outras sessões do usuário são encerradas e a pessoa entra no sistema.
4. Link expirado ou já usado → tela para pedir um novo link.

### 5.5 Sessão e contexto

- Toda rota autenticada é protegida no servidor; sem sessão válida, a pessoa vai para o login com o destino original guardado como retorno.
- A sessão é renovada automaticamente enquanto válida; ao trocar de negócio ativo (SPEC-004), a sessão continua a mesma (RNF07).
- O contexto da requisição contém `usuarioId` (da sessão) e `negocioId` (o negócio ativo, se houver). O `negocioId` só é aceito se existir `MembroNegocio` do usuário nesse negócio; caso contrário, é descartado e a pessoa vai para "Meus negócios".
- Nenhuma Server Action ou rota confia em `usuarioId` ou `negocioId` vindos do navegador.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhuma senha é gravada nas tabelas da aplicação nem aparece em logs. | Teste que inspeciona o schema (`Usuario` sem campo de senha) e revisão dos logs do servidor em um cadastro e um login. |
| **INV-002** | Todo `Usuario` tem o mesmo id de uma conta do Supabase Auth, e toda conta confirmada do Supabase Auth tem um `Usuario`. | Teste de integração do cadastro; teste da falha no segundo passo (OPEN-001). |
| **INV-003** | Nenhuma conta é criada sem aceite explícito: todo `Usuario` tem `consentimentoLgpdEm` preenchido. | Teste: cadastro sem aceite (pela interface e chamando o servidor direto) → recusado. |
| **INV-004** | As respostas de cadastro, login e recuperação não revelam se um e-mail está cadastrado. | Teste comparando as respostas para e-mail existente e inexistente. |
| **INV-005** | Nenhuma rota autenticada nem Server Action responde com dados sem sessão válida. | Teste: requisição sem cookie ou com cookie inválido → redirecionamento ou 401, sem dados. |
| **INV-006** | O contexto de negócio só é aceito para negócios em que o usuário é membro. | Teste: cookie de negócio ativo de outro negócio → contexto sem negócio; nenhum dado retornado. |
| **INV-007** | O destino de retorno após login é sempre interno. | Teste com destino para outro domínio → ignorado. |
| **INV-008** | Usuário com `excluidoEm` preenchido não consegue entrar. | Teste de integração. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Usuario` | `id` (= `auth.users.id`), `nome`, `email` (único), `consentimentoLgpdEm`, `excluidoEm` | Criado no cadastro, junto com a conta do Supabase Auth; e-mail igual ao do Supabase Auth; `excluidoEm` só é lido nesta Spec. |
| Conta do Supabase Auth (`auth.users`) | id, e-mail, senha (hash), confirmação do e-mail | Gerenciada pelo Supabase; fora do schema da aplicação. |
| `MembroNegocio` | `usuarioId`, `negocioId` | Só consultado para validar o negócio ativo do contexto (criado nas SPECs 004 e 005). |

Nenhuma mudança no schema v7 é necessária, salvo o que vier de OPEN-005 (versão do termo aceito).

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/app/(publico)/` — telas de entrar, cadastro, confirmação, recuperação e nova senha, política e termos;
  - `src/app/(app)/` — área autenticada, começando por "Meus negócios";
  - `src/middleware.ts` — proteção das rotas e renovação da sessão;
  - `src/lib/auth/` — clientes do Supabase para servidor e navegador, função de contexto da requisição e criação do `Usuario`.
- **Fronteiras:**
  - O navegador só usa a chave pública do Supabase para o fluxo de autenticação; a chave de serviço (service role) existe apenas no servidor.
  - A leitura de dados continua passando pelo cliente do negócio (SPEC-001), agora alimentado pela função de contexto.
- **Integrações:** Supabase Auth (e-mail e senha, confirmação, recuperação) e o serviço de envio de e-mail configurado nele (OPEN-002).
- **Frontend × backend:** validações duplicadas na interface (para resposta imediata) e no servidor (fonte da verdade); mensagens de erro sem detalhes técnicos.
- **ADRs que restringem:** ADR-003 (autenticação pelo Supabase, autorização no servidor, sem senha local), ADR-001 (regras fora de páginas e componentes), ADR-002 (o `Usuario` é global, sem `negocioId`).
- **Identidade visual:** login conforme `prototipo_revisado/`; cadastro e recuperação seguem o mesmo layout (painel institucional + formulário), tokens e componentes base.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Cadastrar** | nome, e-mail, senha, confirmação, aceite | "link de confirmação enviado" (sempre a mesma resposta) | `CampoInvalido` (por campo), `AceiteObrigatorio`, `FalhaInterna` |
| **Confirmar e-mail** | link do e-mail | sessão criada + destino | `LinkInvalidoOuExpirado` |
| **Entrar** | e-mail, senha, destino de retorno opcional | sessão criada + destino (interno) | `CredenciaisInvalidas`, `EmailNaoConfirmado`, `MuitasTentativas` |
| **Sair** | sessão | sessão encerrada | — |
| **Pedir recuperação** | e-mail | "se houver conta, enviamos um link" (sempre a mesma resposta) | `MuitasTentativas` |
| **Definir nova senha** | link do e-mail, senha, confirmação | senha trocada, outras sessões encerradas, sessão criada | `LinkInvalidoOuExpirado`, `CampoInvalido` |
| **Obter contexto** (servidor) | cookies da requisição | `{ usuarioId, negocioId? }` ou "sem sessão" | — (negócio não autorizado é descartado) |

Os nomes exatos de rotas, funções e componentes são decididos na implementação, respeitando estes contratos.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Telas de acesso responsivas. | Login, cadastro e recuperação em 390px, 768px e 1440px, temas claro e escuro, sem rolagem horizontal (captura). |
| **RNF02** | Contexto validado no servidor. | INV-005 e INV-006 cobertos por testes de integração. |
| **RNF03** | Senha só no Supabase Auth. | INV-001; checagem de que nenhuma tabela da aplicação tem coluna de senha. |
| **RNF04** | Consentimento explícito e registrado. | INV-003; `consentimentoLgpdEm` preenchido em todo `Usuario` criado. |
| **RNF07** | Sessão persistente. | Teste: sessão continua válida após recarregar a página e após trocar o cookie de negócio ativo por outro negócio do qual o usuário é membro. |
| **RNF11** | Configuração por ambiente. | URLs de retorno de preview e homologação funcionando; chaves de homologação fora de produção (checklist no PR). |

---

## 11. Critérios de aceitação

**CA-01 — Cadastro.**
Dada uma pessoa sem conta,
quando ela informa nome, e-mail, senha válida, a confirmação igual e marca o aceite,
então a conta é criada no Supabase Auth, um `Usuario` com o mesmo id e com `consentimentoLgpdEm` preenchido é gravado, e ela vê "Enviamos um link para seu e-mail".

**CA-02 — Aceite obrigatório.**
Dado o formulário de cadastro preenchido sem o aceite,
quando a pessoa envia (ou o servidor é chamado diretamente sem o aceite),
então nenhuma conta é criada e aparece "É preciso aceitar a política de privacidade e os termos de uso".

**CA-03 — Validação de campos.**
Dado um campo obrigatório vazio, um e-mail inválido, uma senha fora da política ou uma confirmação diferente,
quando a pessoa envia,
então a mensagem aparece junto ao campo, com `aria-invalid` e `aria-describedby`, e o servidor recusa os mesmos dados se chamado diretamente.

**CA-04 — E-mail já cadastrado.**
Dado um e-mail que já tem conta,
quando alguém tenta cadastrá-lo de novo,
então a tela mostra a mesma mensagem de sucesso de um cadastro novo e nenhuma segunda conta é criada.

**CA-05 — Confirmação de e-mail.**
Dada uma conta recém-criada,
quando a pessoa tenta entrar antes de confirmar, então vê "Confirme seu e-mail para entrar";
e quando clica no link de confirmação, então entra no sistema e vai para "Meus negócios".

**CA-06 — Login.**
Dada uma conta confirmada,
quando a pessoa entra com e-mail e senha corretos,
então a sessão é criada e ela vai para "Meus negócios" (ou para o destino de retorno interno, se houver).

**CA-07 — Credenciais inválidas.**
Dado um e-mail inexistente ou uma senha errada,
quando a pessoa tenta entrar,
então vê "E-mail ou senha incorretos" nos dois casos.

**CA-08 — Rota protegida.**
Dada uma pessoa sem sessão,
quando ela acessa uma página autenticada,
então é levada ao login e, depois de entrar, volta para a página que tentou acessar.

**CA-09 — Logout.**
Dada uma pessoa autenticada,
quando ela sai,
então a sessão é encerrada e voltar no navegador não exibe páginas autenticadas.

**CA-10 — Recuperação de senha.**
Dado um e-mail cadastrado e outro não cadastrado,
quando a recuperação é pedida para cada um, então a resposta é a mesma;
e quando o dono do e-mail cadastrado usa o link e define uma nova senha válida, então a senha antiga deixa de funcionar, as outras sessões são encerradas e ele entra com a nova.

**CA-11 — Contexto de negócio.**
Dado um usuário autenticado com um cookie de negócio ativo de um negócio do qual **não** é membro,
quando qualquer página ou ação do servidor é executada,
então o contexto fica sem negócio, nenhum dado desse negócio é retornado e a pessoa vai para "Meus negócios".

**CA-12 — Sessão persistente.**
Dado um usuário autenticado,
quando ele recarrega a página ou o negócio ativo muda para outro do qual é membro,
então continua autenticado, sem novo login.

**CA-13 — Conta excluída.**
Dado um usuário com `excluidoEm` preenchido,
quando ele tenta entrar com a senha correta,
então o login é recusado com "E-mail ou senha incorretos".

**CA-14 — Visual.**
Dadas as telas de login, cadastro e recuperação,
quando exibidas em 390px, 768px e 1440px, nos temas claro e escuro,
então seguem o protótipo revisado e os tokens da identidade, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação dos campos de cadastro (vazio, e-mail inválido, política de senha, confirmação) | Unitário | CA-03 |
| T02 | Cadastro completo cria conta e `Usuario` com o mesmo id e consentimento | Integração | CA-01, INV-002, INV-003 |
| T03 | Cadastro sem aceite, pela interface e direto no servidor | Integração | CA-02, INV-003 |
| T04 | Falha simulada na criação do `Usuario` não deixa conta pela metade | Integração | INV-002, OPEN-001 |
| T05 | Respostas iguais para e-mail existente e inexistente (cadastro e recuperação) | Integração | CA-04, CA-10, INV-004 |
| T06 | Login antes e depois da confirmação do e-mail | Integração | CA-05 |
| T07 | Login correto, senha errada e e-mail inexistente | Integração | CA-06, CA-07 |
| T08 | Rota protegida sem sessão e retorno ao destino original | Integração/E2E | CA-08, INV-005 |
| T09 | Destino de retorno para outro domínio é ignorado | Unitário | INV-007 |
| T10 | Logout encerra a sessão | E2E | CA-09 |
| T11 | Recuperação: link, nova senha, senha antiga inválida, outras sessões encerradas | Integração | CA-10 |
| T12 | Cookie de negócio de outro negócio → contexto sem negócio | Integração | CA-11, INV-006 |
| T13 | Sessão após recarregar e após trocar o negócio ativo | Integração | CA-12 |
| T14 | Login de usuário com `excluidoEm` | Integração | CA-13, INV-008 |
| T15 | Nenhuma coluna de senha nas tabelas da aplicação e nenhum log com senha | Unitário + revisão | INV-001 |
| T16 | Telas em 390/768/1440px, claro e escuro | Manual com captura | CA-14 |

Os testes de integração rodam contra uma instância local do Supabase (CLI do Supabase no desenvolvimento e no CI) ou contra um dublê do adaptador de autenticação, nunca contra os projetos de homologação ou produção.

---

## 13. Questões em aberto

- **OPEN-001 — Como o `Usuario` é criado junto com a conta do Supabase Auth.**
  - **(a) Gatilho no banco (recomendado):** uma função no PostgreSQL cria o `Usuario` quando o Supabase insere a conta em `auth.users`, dentro da mesma transação. Garante INV-002 sem depender da aplicação, mas é SQL específico do Supabase, versionado como migração.
  - **(b) Server Action em dois passos:** cria a conta no Supabase e depois o `Usuario`, com compensação (apagar a conta) se o segundo passo falhar. Fica todo em TypeScript, mas a compensação também pode falhar.
- **OPEN-002 — Envio de e-mails do Supabase Auth.** O serviço de e-mail padrão do Supabase só envia para endereços da equipe do projeto e com limite baixo por hora: serve para testes internos, não para homologação com terceiros nem produção. Recomendação: configurar um SMTP próprio (ex.: Resend ou Brevo, com plano gratuito) já na homologação; o mesmo serviço atende os convites da SPEC-005. Definir também se a confirmação de e-mail é obrigatória (recomendado: sim).
- **OPEN-003 — Textos da política de privacidade e dos termos de uso.** A baseline exige a política (RNF04), mas o texto não existe. A equipe precisa redigir (ou adaptar um modelo) antes de concluir esta Spec; até lá, as páginas podem usar um texto provisório marcado como tal **apenas em desenvolvimento e homologação**.
- **OPEN-004 — Política de senha.** O Supabase aceita, por padrão, 6 caracteres. Recomendação: mínimo de 8 caracteres, com a verificação de senhas vazadas do Supabase ativada se o plano permitir.
- **OPEN-005 — Versão do termo aceito.** O schema guarda só a data do consentimento (`consentimentoLgpdEm`). Se os termos mudarem, não há como saber qual versão cada pessoa aceitou. Decidir se entra um campo de versão (ex.: `versaoTermosAceita`) ou se a data basta no MVP.
- **OPEN-006 — Tela de cadastro e recuperação.** Só a tela de login foi prototipada. Confirmar se cadastro e recuperação seguem o mesmo layout (painel institucional + formulário) sem protótipo próprio.

---

## 14. Definition of Done da Spec

A SPEC-002 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-14) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T16) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF03, RNF04, RNF07, RNF11) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
