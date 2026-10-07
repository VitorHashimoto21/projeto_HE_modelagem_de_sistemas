# SPEC-005 — Equipe, papéis e permissões

> **Status:** 📝 **Rascunho para aprovação** (07/10/2026). As questões em aberto (seção 13) precisam ser decididas pela equipe antes da implementação. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar). Nenhum código foi escrito.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anterior:** [SPEC-004](SPEC-004.md) (negócio e Dono) · **Próximas que dependem desta:** SPEC-006 a SPEC-013 (todas usam as guardas de papel e a matriz módulo × ação).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-005 |
| **Nome** | Equipe, papéis e permissões |
| **Objetivo** | Permitir que o Dono convide pessoas para o negócio por e-mail (mesmo quem ainda não tem conta), com o papel Gerente ou Colaborador e, se quiser, permissões customizadas por módulo e ação; gerenciar a equipe (trocar papel, ajustar permissões, remover membro, cancelar ou reenviar convite), respeitando o limite de 1 colaborador no plano gratuito; e entregar as **guardas de autorização no servidor** que todas as specs operacionais vão usar. |
| **Valor entregue** | O Dono delega a operação do dia a dia (vendas, estoque) sem expor saldo, custos e margens (persona Lucas). As próximas specs já nascem com o controle de acesso pronto: cada tela e cada ação só precisam declarar o módulo e a ação que exigem. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF04 | O Dono convida colaboradores. |
| | RF05 | Papéis fixos Dono, Gerente e Colaborador, como predefinições da matriz (seção 5.1). |
| | RF06 | Permissões customizadas na matriz módulo × ação (Catálogo, Estoque, Vendas, Calculadora, Financeiro, Dashboard × ver, criar, editar, excluir/cancelar). |
| | RF72 | Convite por e-mail com link de uso único e validade, informando papel e permissões; o convidado pode não ter conta; o Dono cancela convite pendente. |
| | RF47 *(limite de colaboradores)* | Plano gratuito: Dono + 1 colaborador (membro ou convite pendente); a partir do segundo, exige o plano pago. Os relatórios avançados do RF47 ficam na SPEC-013. |
| | RF63 *(regra de acesso)* | O Colaborador vê só o Dashboard restrito. Esta Spec define **quem** vê a versão completa (seção 5.1, OPEN-003); o conteúdo do Dashboard é da SPEC-012. |
| **RN** | RN01 | Um membro só acessa os negócios dos quais faz parte; ao ser removido, perde o acesso na requisição seguinte. |
| | RN02 | Só o Dono convida, remove e altera permissões; qualquer outro papel é recusado no servidor e nada muda. |
| **RNF** | RNF02 | Papel e permissões lidos do banco a cada requisição, junto com a filiação (nada vem do navegador). |
| | RNF07 | Trocar de negócio continua sem novo login; o papel muda conforme o negócio ativo. |
| | RNF04 | E-mail do convidado guardado só para o convite (seção 5.6, OPEN-009). |
| | RNF01 | Telas responsivas. |
| **Caso de uso / fluxo** | UC3 Convidar Colaborador, UC4 Definir Permissões | Jornada do Dono, ramo "Configurações do Negócio" (I → I1 → I2 → I3) em `MODELO_DOMINIO_E_JORNADAS.md`; jornadas do Gerente (2.2) e do Colaborador (2.3). |
| **Entidades** | MembroNegocio, Convite, Usuario, Negocio (`plano`) | Seção 7. |
| **Drivers** | AD-RF02 | Autorização centralizada e guardas nas Server Actions e páginas. |
| | AD-QA06 | Autorização por papel e pela matriz módulo × ação, validada no servidor em toda requisição. |
| | AD-C02 | O `Convite` tem `negocioId` e é lido pelo cliente do negócio, exceto na aceitação (seção 8). |
| **ADRs** | ADR-003 | RBAC no servidor com `MembroNegocio`; interface nunca é a única barreira. |
| | ADR-002 | Isolamento por negócio. |

---

## 3. Escopo

### Incluído

1. **Matriz de permissões** (seção 5.1): os 6 módulos × 4 ações, as predefinições dos papéis e a regra de resolução (predefinição do papel ou matriz customizada).
2. **Guardas no servidor** para as próximas specs: "exigir permissão (módulo, ação)" e "exigir Dono", usadas em Server Actions e páginas; e uma consulta "o que este membro pode fazer" para montar o menu.
3. **Contexto com papel:** a filiação (SPEC-002, INV-006) passa a devolver o papel e as permissões efetivas do membro no negócio ativo, numa única consulta por requisição.
4. **Tela "Equipe"** (Configurações do negócio, só para o Dono): membros (nome, e-mail, papel, permissões), convites pendentes (e-mail, papel, validade) e o botão "Convidar pessoa".
5. **Convidar** (UC3): e-mail, papel (Gerente ou Colaborador) e, opcionalmente, permissões customizadas (UC4), com o limite do plano gratuito verificado no servidor.
6. **E-mail do convite** com o link de uso único, o nome do negócio, quem convidou, o papel, o resumo das permissões e a validade (RF72).
7. **Aceitar o convite**, com ou sem conta (seção 5.3).
8. **Gerenciar a equipe:** trocar o papel de um membro, editar as permissões dele, remover o membro, cancelar e reenviar convite pendente.
9. **Menu por permissão:** a área autenticada mostra só os módulos que o membro pode ver; "Configurações" só para o Dono. Acesso direto por URL a área sem permissão mostra uma página "Sem acesso".
10. **Ajuste da SPEC-004:** a verificação "só o Dono edita os dados do negócio" passa a usar a guarda "exigir Dono" (mesmo comportamento).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Troca de plano (gratuito ↔ pago) e o que acontece com quem passa do limite ao voltar para o gratuito (RF73) | SPEC-013, conforme o Mapa. A SPEC-004 cita "SPEC-005 (RF73)" na tabela de fora do escopo; ver OPEN-010. |
| Conteúdo das telas de cada módulo e o significado fino de cada ação dentro dele | SPECs 006 a 012 (cada uma declara a permissão exigida por tela e ação) |
| Conteúdo do Dashboard completo e restrito (RF42, RF57, RF63, RF68) | SPEC-012 |
| Transferir a posse do negócio (trocar o Dono) ou ter mais de um Dono | Fora do MVP: nenhum requisito pede (INV-002) |
| Recusar um convite (o convidado simplesmente não aceita e ele expira) | Fora do MVP: o enum `StatusConvite` não tem "recusado" e o RF72 não pede |
| Exclusão da conta do usuário e o efeito nos negócios em que é membro (RN27) | SPEC-014 |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-001: schema com `MembroNegocio` e `Convite`, cliente do negócio, RLS;
  - SPEC-002: sessão, contexto com filiação, cadastro, login e o destino `proximo` depois do login;
  - SPEC-004: `Negocio` com o Dono, negócio ativo e "Dados do negócio".
- **Decisões arquiteturais:** ADR-002, ADR-003.
- **Pré-requisitos externos:**
  - **Envio de e-mail pelo Resend** (`RESEND_API_KEY` e `EMAIL_REMETENTE`), o mesmo serviço do aviso de "você já tem conta" da SPEC-002, **ainda não configurado** na homologação. Ver OPEN-004.
  - Para que o convite chegue a qualquer endereço (e não só aos da equipe), o domínio do remetente precisa estar verificado no Resend.

---

## 5. Comportamento esperado

### 5.1 Matriz de permissões

**Módulos:** Catálogo, Estoque, Vendas, Calculadora, Financeiro, Dashboard.
**Ações:** ver, criar, editar, excluir/cancelar.

**"Configurações do negócio"** fica fora da matriz e é **exclusiva do Dono**: Equipe e convites, dados do negócio (SPEC-004), plano (SPEC-013) e parâmetros de precificação (taxa média de cartão, margem meta, capacidade e ticket médio — ramo I5 da jornada do Dono). É o "exceto configurações" do Gerente no RF05. Ver OPEN-002.

**Predefinições dos papéis (RF05)** — ✓ permitido, — negado:

| Módulo | Dono | Gerente | Colaborador (padrão) |
|---|---|---|---|
| Catálogo | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ver ✓ · criar — · editar — · excluir — |
| Estoque | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ver ✓ · criar ✓ · editar — · excluir — |
| Vendas | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ver ✓ · criar ✓ · editar — · cancelar — |
| Calculadora | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | — — — — |
| Financeiro | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | — — — — |
| Dashboard | ✓ (completo) | ✓ (completo) | ver ✓ (restrito, RF63) |

A coluna do Colaborador é derivada da jornada 2.3 ("Consultar Produtos", "Registrar Entrada/Saída", "Nova Venda", "Dashboard restrito", Financeiro e Calculadora bloqueados) e do RF65 (cancelar venda só com permissão granular). O "Catálogo: ver" vem de "somente itens com preço oficial" na venda. **Ver OPEN-001.**

**Resolução das permissões efetivas:**

- **Dono:** sempre tudo; não pode ter matriz customizada.
- **Gerente e Colaborador:** sem matriz customizada (`permissoesCustom` vazio), vale a predefinição do papel. Com matriz customizada, vale a matriz **inteira** gravada, e a predefinição deixa de valer para aquele membro.
- **Coerência:** "editar" e "excluir/cancelar" exigem "ver" no mesmo módulo; "criar" pode existir sem "ver". Isso permite o exemplo do RF06: lançar despesas no Financeiro sem ver saldo, relatórios, custos fixos ou margens.
- **Dashboard completo × restrito:** com "Dashboard: ver", o membro vê a parte restrita (vendas do dia e alertas de estoque baixo). As partes financeiras (saldo, semáforo, ponto de equilíbrio, gráficos de faturamento e projeção de caixa) exigem também "Financeiro: ver". Gerente e Dono têm as duas. **Ver OPEN-003.**

### 5.2 Convidar (UC3 e UC4)

- **Pré-condições:** usuário autenticado, Dono do negócio ativo.
- **Fluxo principal:**
  1. Em Configurações → Equipe, o Dono clica em "Convidar pessoa".
  2. Informa o e-mail e escolhe o papel (Gerente ou Colaborador). A tela mostra a matriz do papel escolhido, só para leitura.
  3. Opcionalmente, marca "Personalizar permissões" e ajusta a matriz (UC4). A tela aplica a regra de coerência do 5.1.
  4. Confirma. O servidor:
     1. confere que o usuário é o Dono;
     2. normaliza o e-mail (minúsculas, sem espaços);
     3. valida papel e matriz;
     4. confere o limite do plano;
     5. gera o token;
     6. grava o `Convite` (PENDENTE, `expiraEm`, `convidadoPorId`, `tokenHash`);
     7. envia o e-mail.
  5. O convite aparece em "Convites pendentes", com a validade.
- **Limite do plano gratuito (RF47):** conta os membros que não são Dono + os convites PENDENTE ainda válidos. No plano gratuito, se a conta já for 1, o convite é recusado com a mensagem "No plano gratuito, o negócio pode ter 1 colaborador. Para convidar mais pessoas, é preciso o plano pago." No plano pago não há limite. A contagem e a gravação acontecem numa transação que trava o negócio, para que dois convites simultâneos não passem do limite.
- **Fluxos alternativos e de exceção:**

| Situação | Comportamento |
|---|---|
| E-mail inválido | Mensagem no campo; nada é gravado. |
| E-mail do próprio Dono | "Você já é o Dono deste negócio." |
| E-mail de quem já é membro | "Esta pessoa já faz parte da equipe." |
| Já existe convite pendente para o e-mail | "Já existe um convite pendente para este e-mail. Use 'Reenviar'." |
| Papel Dono no convite (inclusive chamando o servidor direto) | Recusado (INV-002). |
| Matriz incoerente ou com módulo/ação desconhecidos | Recusada, com a regra que falhou. |
| Usuário que não é Dono (inclusive chamando o servidor direto) | Recusado; nada é gravado (RN02). |
| Falha no envio do e-mail | Ver OPEN-004. |

- **Pós-condições:** existe um `Convite` PENDENTE com `expiraEm` no futuro; o token em si não está guardado em lugar nenhum, só o hash.

### 5.3 Aceitar o convite

O link do e-mail é `/convite/{token}`: token aleatório de 32 bytes, codificado para URL. O banco guarda só o SHA-256 dele.

1. **Link inválido:** token desconhecido, convite cancelado, expirado ou já aceito → página de link inválido, com uma mensagem própria para convite ("Este convite não vale mais. Peça um novo ao Dono do negócio.").
2. **Sem sessão:** a página mostra o nome do negócio, quem convidou e o papel, com dois caminhos:
   - "Criar conta": cadastro da SPEC-002, com o e-mail do convite já preenchido;
   - "Já tenho conta": login com `proximo=/convite/{token}`.
3. **Com sessão:**
   - **E-mail da conta igual ao do convite:** mostra o convite e o botão "Aceitar convite". Ao aceitar, numa transação:
     1. o servidor marca o convite como ACEITO (só se ainda estiver PENDENTE e válido — é isso que garante o uso único);
     2. cria o `MembroNegocio` com o papel e as permissões do convite;
     3. grava `respondidoEm`;
     4. define o negócio como ativo e leva a `/painel`.
   - **E-mail diferente:** "Este convite foi enviado para outro e-mail (j•••@exemplo.com). Entre com essa conta para aceitar." Nada muda. **Ver OPEN-005.**
   - **Já é membro do negócio** (por exemplo, aceitou por outro caminho): "Você já faz parte deste negócio." O convite é marcado como ACEITO.
4. **Conta nova e confirmação de e-mail:** o link de confirmação do cadastro (SPEC-002) não leva o `proximo`. Por isso, "Meus negócios" passa a mostrar **"Convites para você"**: os convites PENDENTE válidos para o e-mail confirmado da conta, com o botão "Aceitar". A pessoa não depende de achar o e-mail do convite de novo. **Ver OPEN-006.**

O limite do plano não é conferido de novo na aceitação: o convite pendente já ocupava a vaga.

### 5.4 Gerenciar a equipe

Tudo só pelo Dono (RN02), verificado no servidor:

| Ação | Comportamento |
|---|---|
| **Trocar o papel** de um membro (Gerente ↔ Colaborador) | Atualiza o papel e **limpa** a matriz customizada: passa a valer a predefinição do novo papel, e a tela avisa antes de confirmar. |
| **Editar permissões** de um membro | Grava a matriz inteira, com a regra de coerência. "Voltar ao padrão do papel" limpa a matriz. |
| **Remover membro** | Apaga o `MembroNegocio`. Os registros que a pessoa criou (vendas, movimentações, preços) continuam, ligados ao `Usuario`. Na requisição seguinte, a filiação falha e ela vai para "Meus negócios" (RN01, INV-006 da SPEC-002). Libera a vaga do plano. |
| **Cancelar convite** pendente | Status CANCELADO, `respondidoEm` gravado; o link para de valer e a vaga é liberada. |
| **Reenviar convite** pendente | Gera um token novo e uma validade nova, no mesmo registro, e reenvia o e-mail; o link anterior para de valer. |
| Ações sobre o Dono (trocar papel, editar permissões, remover) | Recusadas (INV-002). |

Mudanças de papel e de permissões valem a partir da requisição seguinte do membro, sem novo login. O papel é lido do banco a cada requisição (INV-004).

**Sair do negócio** por iniciativa do próprio membro: ver OPEN-007.

### 5.5 Guardas e menu

- **Server Actions** de qualquer módulo começam por "exigir permissão (módulo, ação)". Sem a permissão, a ação é recusada com o erro `SemPermissao` e nada é gravado.
- **Páginas** de um módulo exigem pelo menos "ver" (ou a ação da página, como "criar" na "Nova venda"). Sem permissão, o servidor mostra a página "Sem acesso" ("Você não tem acesso a esta área. Fale com o Dono do negócio."), com o código HTTP 403 quando for possível. Ver OPEN-008.
- **Configurações** exigem "exigir Dono".
- **Menu:** monta a lista de módulos pelas permissões efetivas. Esconder um item é conveniência; a barreira é sempre a guarda no servidor (ADR-003).
- **Consultas de dados** continuam pelo cliente do negócio (SPEC-001). A guarda decide **se** o membro pode agir, e o cliente do negócio decide **em qual** negócio.

### 5.6 Validade e dados do convite

- **Validade:** 7 dias a partir do envio ou do último reenvio. **Ver OPEN-004.**
- **Expiração:** o convite que passa da validade é tratado como expirado em toda leitura e marcado como EXPIRADO quando lido, sem rotina agendada.
- **Guarda dos dados:** o e-mail do convidado fica no convite para o histórico da equipe. Ver OPEN-009.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Só o Dono do negócio ativo convida, cancela ou reenvia convite, troca papel, edita permissões e remove membro. Para qualquer outro, a ação é recusada e nada muda (RN02). | Testes de integração chamando o servidor direto com Gerente, Colaborador e não membro. |
| **INV-002** | Todo negócio tem exatamente um Dono; convites e trocas de papel só usam Gerente ou Colaborador; o Dono não pode ser removido, rebaixado nem ter matriz customizada. | Teste de integração e validação (unitário). |
| **INV-003** | No plano gratuito, membros que não são Dono + convites pendentes válidos ≤ 1, inclusive com pedidos simultâneos. | Teste de integração com dois convites disparados ao mesmo tempo. |
| **INV-004** | Papel e permissões efetivos são lidos do banco a cada requisição, junto com a filiação; nenhum valor do navegador é aceito. | Teste de integração (mudar o papel no banco e repetir a requisição). |
| **INV-005** | Toda Server Action e página de módulo passa por uma guarda de permissão no servidor. | Regra de lint ou teste que percorre as Server Actions exportadas (ver OPEN-008) + revisão. |
| **INV-006** | O convite é de uso único: aceitar marca ACEITO numa atualização condicional (só se PENDENTE e válido); o mesmo token nunca cria dois membros. | Teste de integração com aceitação dupla simultânea. |
| **INV-007** | O token do convite nunca é guardado nem registrado em log, só o SHA-256 dele; reenviar invalida o token anterior. | Teste unitário (hash) e de integração (token antigo recusado) + revisão dos logs. |
| **INV-008** | A matriz gravada é coerente ("editar" e "excluir/cancelar" ⇒ "ver") e só tem os 6 módulos e as 4 ações; matriz customizada é sempre completa. | Teste unitário da validação; servidor chamado direto com matriz inválida. |
| **INV-009** | O membro removido perde o acesso ao negócio na requisição seguinte (RN01). | Teste de integração. |
| **INV-010** | Um convite só é aceito pela conta cujo e-mail confirmado é o do convite (conforme a decisão da OPEN-005). | Teste de integração com e-mail diferente. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `MembroNegocio` | `usuarioId`, `negocioId`, `papel`, `permissoesCustom` | Único por (usuário, negócio). `permissoesCustom` vazio = predefinição do papel; preenchido = matriz completa (INV-008). Removido na exclusão do membro. |
| `Convite` | `negocioId`, `email`, `papel`, `permissoesCustom`, `tokenHash`, `status`, `expiraEm`, `convidadoPorId`, `respondidoEm` | Ciclo PENDENTE → ACEITO, EXPIRADO ou CANCELADO. `email` normalizado. `papel` nunca é DONO. |
| `Usuario` | `id`, `nome`, `email` | E-mail confirmado da conta, comparado com o do convite (INV-010). |
| `Negocio` | `plano`, `nome` | O `plano` decide o limite (INV-003). Só leitura nesta Spec: a troca é da SPEC-013. |

**Formato da matriz** (`permissoesCustom`): objeto com as chaves `catalogo`, `estoque`, `vendas`, `calculadora`, `financeiro` e `dashboard`. Cada chave tem `ver`, `criar`, `editar` e `excluir`, todos booleanos e obrigatórios. Validado no servidor antes de gravar. O comentário do schema (`{"financeiro": {"ver": false, "criar": true}}`) mostra uma matriz parcial e deve ser atualizado para o formato completo.

**Mudanças previstas no schema:** nenhuma obrigatória.
- **Opcional (recomendada):** índice único parcial em `Convite (negocioId, email) WHERE status = 'PENDENTE'`, criado por migração SQL (o Prisma não descreve índice parcial). Ele garante no banco a regra "um convite pendente por e-mail".
- **Atualização do comentário** de `permissoesCustom` em `MembroNegocio`.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/dominio/permissoes.ts` — matriz, predefinições, resolução e validação de coerência (pura, sem framework);
  - `src/lib/equipe/` — validação dos formulários, serviços de convite, aceitação e gestão da equipe (como `src/lib/negocio/`), com as Server Actions em `acoes.ts`;
  - `src/lib/auth/` — o contexto passa a incluir papel e permissões efetivas; guardas "exigir permissão" e "exigir Dono" junto de `exigirNegocio()`;
  - `src/lib/db/` — consultas de equipe e convites; a filiação (`ehMembro`) passa a devolver o membro (papel e matriz) em vez de um booleano;
  - `src/lib/auth/emails.ts` (ou um módulo de e-mails comum) — e-mail do convite pelo Resend;
  - telas:
    - `src/app/(app)/negocio/equipe/` — Equipe, convidar e editar permissões;
    - `src/app/(publico)/convite/[token]/` ou rota equivalente — aceitação;
    - página "Sem acesso";
    - "Convites para você" em `/negocios`.
- **Fronteiras:**
  - O `Convite` tem `negocioId` e, nas telas do Dono, é lido e gravado pelo **cliente do negócio**.
  - A **aceitação** acontece antes de o convidado ser membro, então lê o convite pelo `tokenHash` (ou pelo e-mail confirmado, em "Convites para você") fora do cliente do negócio, numa consulta dedicada como as de `src/lib/db/acesso.ts`. Ela só cria o membro depois de conferir token, status, validade e e-mail.
  - O módulo de domínio de permissões não conhece banco nem framework: as próximas specs importam dele os nomes de módulo e ação.
- **Rotas:** `/convite/...` precisa ser aberta com e sem sessão. Hoje `decidirRota` (SPEC-002) manda quem não tem sessão para o login; a rota de convite entra na lista de páginas públicas e decide sozinha o que mostrar.
- **Integrações:** Resend (HTTP, tempo limite de 5 s, como o aviso da SPEC-002).
- **Frontend × backend:** validação dupla (navegador e servidor). A interface esconde o que não é permitido, mas a autorização é sempre do servidor (ADR-003).
- **ADRs que restringem:** ADR-003 (RBAC no servidor), ADR-002 (isolamento), ADR-001 (regras fora das páginas).
- **Identidade visual:** sem protótipo para estas telas. Seguem os tokens e componentes já usados. A matriz é uma tabela de caixas de seleção com rótulos de módulo e ação; no celular, vira uma lista por módulo, sem rolagem horizontal.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Permissões efetivas** (domínio) | papel, matriz customizada (opcional) | matriz completa | — |
| **Validar matriz** (domínio) | objeto informado | matriz válida | `MatrizInvalida` (com a regra) |
| **Exigir permissão** (guarda) | módulo, ação (contexto da requisição) | contexto `{ usuarioId, negocioId, papel, permissoes }` | `SemSessao`, `SemNegocio`, `SemPermissao` |
| **Exigir Dono** (guarda) | contexto da requisição | contexto do Dono | `SemSessao`, `SemNegocio`, `SomenteDono` |
| **Convidar** | e-mail, papel, matriz (opcional) | convite pendente (id, validade) | `SomenteDono`, `CampoInvalido`, `JaEhMembro`, `ConvitePendenteExistente`, `LimiteDoPlano`, `PapelNaoPermitido`, `FalhaNoEnvio` (OPEN-004) |
| **Ler convite pelo token** | token | `{ negocio, convidadoPor, papel, permissoes, email mascarado }` | `ConviteInvalido` (desconhecido, expirado, cancelado ou aceito) |
| **Aceitar convite** | token (ou id em "Convites para você"), usuário da sessão | membro criado; negócio ativo definido | `ConviteInvalido`, `EmailDiferente`, `JaEhMembro` |
| **Listar equipe** | negócio ativo (Dono) | membros `{ id, nome, email, papel, customizado }` e convites pendentes `{ id, email, papel, expiraEm }` | `SomenteDono` |
| **Trocar papel / editar permissões** | id do membro, papel ou matriz | membro atualizado | `SomenteDono`, `AlvoEhDono`, `MatrizInvalida` |
| **Remover membro** | id do membro | — | `SomenteDono`, `AlvoEhDono` |
| **Cancelar / reenviar convite** | id do convite | convite atualizado | `SomenteDono`, `ConviteInvalido`, `FalhaNoEnvio` |
| **Convites para você** | usuário da sessão (e-mail confirmado) | convites pendentes válidos para o e-mail | — |

Os nomes exatos de rotas, funções e componentes são decididos na implementação, respeitando estes contratos.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Telas de Equipe, convite, aceitação, "Sem acesso" e "Convites para você" responsivas, inclusive a matriz. | Capturas em 390, 768 e 1440 px, claro e escuro, sem rolagem horizontal. |
| **RNF02** | Autorização por papel e matriz no servidor; aceitação fora do cliente do negócio só depois de validar o convite. | INV-001, INV-004, INV-005, INV-009 por testes de integração. |
| **RNF04** | E-mail do convidado só para o convite; token nunca guardado. | INV-007; decisão da OPEN-009. |
| **RNF07** | Trocar de negócio muda o papel efetivo sem novo login. | Teste de integração (usuário Dono num negócio e Colaborador em outro). |

---

## 11. Critérios de aceitação

**CA-01 — Convidar Colaborador.**
Dado o Dono de um negócio no plano gratuito sem colaboradores,
quando ele convida um e-mail como Colaborador,
então o convite fica pendente com validade, o e-mail é enviado com o nome do negócio, o papel, o resumo das permissões e o link, e o banco guarda só o hash do token.

**CA-02 — Limite do plano gratuito.**
Dado um negócio gratuito com 1 colaborador (membro ou convite pendente válido),
quando o Dono tenta convidar outra pessoa (inclusive com dois pedidos ao mesmo tempo),
então o convite é recusado com a mensagem do plano pago e o total continua 1; no plano pago, o convite é aceito.

**CA-03 — Cancelar libera a vaga.**
Dado um convite pendente num negócio gratuito,
quando o Dono o cancela,
então o link deixa de valer e um novo convite pode ser feito.

**CA-04 — Aceitar com conta existente.**
Dado um convite pendente para o e-mail de uma conta existente,
quando a pessoa abre o link, entra e clica em "Aceitar convite",
então ela vira membro com o papel e as permissões do convite, o negócio fica ativo e o convite fica ACEITO.

**CA-05 — Aceitar sem conta.**
Dado um convite para um e-mail sem conta,
quando a pessoa cria a conta pelo link, confirma o e-mail e entra,
então "Meus negócios" mostra o convite em "Convites para você" e, ao aceitar, ela vira membro (OPEN-006).

**CA-06 — Link inválido.**
Dado um link de convite já aceito, cancelado, expirado, substituído por reenvio ou inventado,
quando alguém o abre,
então aparece a mensagem de convite inválido e nada é criado.

**CA-07 — Uso único.**
Dado um convite pendente,
quando duas aceitações acontecem ao mesmo tempo,
então só um membro é criado.

**CA-08 — E-mail diferente.**
Dado um convite para `a@exemplo.com`,
quando a conta `b@exemplo.com` tenta aceitar,
então a aceitação é recusada com o e-mail mascarado e nada muda (OPEN-005).

**CA-09 — Só o Dono gerencia (RN02).**
Dado um Gerente ou Colaborador,
quando ele tenta convidar, cancelar, reenviar, trocar papel, editar permissões ou remover (pela tela ou chamando o servidor direto),
então a ação é recusada e nada muda; a tela de Equipe e o item "Configurações" nem aparecem para ele.

**CA-10 — Permissões do Colaborador padrão.**
Dado um Colaborador sem matriz customizada,
quando ele acessa a área autenticada,
então o menu mostra só os módulos da predefinição (5.1), e uma página ou Server Action fora dela (por exemplo, Financeiro) é recusada no servidor com "Sem acesso".

**CA-11 — Permissão customizada.**
Dado um Colaborador com "Financeiro: criar" e sem "Financeiro: ver",
quando ele usa o servidor,
então a guarda permite a ação de criar no Financeiro e recusa a de ver. Pelas regras do 5.1, o Dashboard não mostra a parte financeira para ele. O teste usa ações de exemplo, porque o Financeiro é da SPEC-009.

**CA-12 — Trocar papel e remover.**
Dado um membro Colaborador com matriz customizada,
quando o Dono o promove a Gerente,
então a matriz é limpa e vale a predefinição de Gerente na requisição seguinte; quando o Dono o remove, a próxima requisição dele ao negócio leva a "Meus negócios".

**CA-13 — O Dono é intocável.**
Dado o Dono,
quando alguém tenta (inclusive pelo servidor) convidar com papel Dono, rebaixar, customizar ou remover o Dono,
então a ação é recusada.

**CA-14 — Validações do convite.**
Dado um e-mail inválido, o e-mail do próprio Dono, o de um membro, um com convite pendente ou uma matriz incoerente,
quando o Dono envia,
então a mensagem própria aparece e nada é gravado.

**CA-15 — Papel por negócio.**
Dado um usuário Dono do negócio A e Colaborador do negócio B,
quando ele troca de A para B no seletor,
então o menu e as guardas passam a seguir o papel de Colaborador, sem novo login.

**CA-16 — Visual.**
Dadas as telas desta Spec,
quando exibidas em 390, 768 e 1440 px, nos temas claro e escuro,
então seguem os tokens da identidade, sem rolagem horizontal (inclusive a matriz).

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Predefinições dos papéis e resolução (papel × matriz customizada; Dono sempre tudo) | Unitário | CA-10, CA-11, 5.1 |
| T02 | Validação da matriz: coerência, chaves desconhecidas, matriz parcial | Unitário | CA-14, INV-008 |
| T03 | Validação do formulário de convite (e-mail, papel) e normalização do e-mail | Unitário | CA-14, INV-002 |
| T04 | Token: geração, hash, comparação; o token não aparece no registro gravado | Unitário | INV-007 |
| T05 | Convidar cria convite PENDENTE, envia o e-mail (envio simulado) e guarda só o hash | Integração | CA-01 |
| T06 | Limite do plano gratuito, com dois convites simultâneos; plano pago sem limite | Integração | CA-02, INV-003 |
| T07 | Cancelar e reenviar: link antigo recusado, vaga liberada | Integração | CA-03, CA-06, INV-007 |
| T08 | Aceitar com conta existente; aceitação dupla simultânea cria um só membro | Integração | CA-04, CA-07, INV-006 |
| T09 | Convite expirado, cancelado, aceito ou inventado é recusado | Integração | CA-06 |
| T10 | Aceitação com e-mail diferente é recusada | Integração | CA-08, INV-010 |
| T11 | "Convites para você" lista só os pendentes válidos do e-mail confirmado e aceita | Integração | CA-05 |
| T12 | Gerente, Colaborador e não membro chamando cada ação de gestão direto no servidor | Integração | CA-09, INV-001 |
| T13 | Guardas: permitir e recusar por módulo e ação, com ações de exemplo; papel lido do banco a cada requisição | Integração | CA-10, CA-11, INV-004 |
| T14 | Trocar papel limpa a matriz; remover membro tira o acesso na requisição seguinte | Integração | CA-12, INV-009 |
| T15 | Ações sobre o Dono recusadas; convite com papel Dono recusado | Integração | CA-13, INV-002 |
| T16 | Papel por negócio ao trocar o negócio ativo | Integração | CA-15 |
| T17 | Toda Server Action exportada passa por guarda (verificação automática) | Lint ou teste estático | INV-005 |
| T18 | Telas em 390/768/1440 px, claro e escuro | Manual com captura | CA-16 |
| T19 | Fluxo completo na homologação: convidar um e-mail real, receber, criar conta, aceitar, ver o menu do Colaborador, ser removido | Manual (uma vez, depende da OPEN-004) | CA-01, CA-04, CA-05, CA-09, CA-12 |

Os testes automatizados nunca enviam e-mail de verdade: o envio é um dublê que guarda a mensagem (com o link) para o teste ler. O envio real é verificado manualmente na homologação (T19).

---

## 13. Questões em aberto

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** | Predefinição do Colaborador. A baseline fala em "Vendas e Estoque, sem Financeiro" e "Dashboard restrito", mas não ação por ação. | (a) a tabela do 5.1: Catálogo só ver; Estoque ver e criar (entrada/saída); Vendas ver e criar, sem cancelar (RF65); Dashboard restrito; (b) outra combinação definida pela equipe. | **(a)**, que é a leitura direta da jornada 2.3 e do RF65. Confirmar se o Colaborador deve ver o **histórico** de vendas ("Vendas: ver") ou só registrar novas. |
| **OPEN-002** | O que é "Configurações" (o que o Gerente não acessa). | (a) Equipe e convites, dados do negócio, plano e parâmetros de precificação (taxa de cartão, margem meta, capacidade, ticket médio), conforme o ramo I da jornada do Dono; (b) só Equipe e plano, deixando os parâmetros de precificação para o Gerente. | **(a)**, que segue a jornada. Efeito: o Gerente usa a Calculadora com os parâmetros que o Dono definiu, mas não os altera. |
| **OPEN-003** | Dashboard completo × restrito numa matriz que só tem "Dashboard: ver". | (a) partes financeiras exigem também "Financeiro: ver" (5.1); (b) separar "Dashboard completo" como uma ação ou módulo próprio. | **(a)**: mantém a matriz do RF06 sem ações extras e casa com o RF63, já que tudo que o Colaborador não vê é financeiro. |
| **OPEN-004** | Envio do e-mail do convite e validade. O Resend ainda não está configurado (pendência da SPEC-002). | (a) configurar o Resend com domínio verificado antes de implementar; sem envio, o convite não é criado; (b) criar o convite e mostrar ao Dono, uma vez, o link para copiar e mandar por WhatsApp, além do e-mail quando configurado; (c) usar o envio de e-mails do Supabase Auth ("invite user"). Validade: 7 dias? | **(b) + configurar o Resend**: o link copiável atende o público (que usa WhatsApp) e não trava o fluxo se o e-mail falhar; o e-mail continua sendo o caminho do RF72. (c) mistura o convite do negócio com a criação de conta no Auth. **7 dias** de validade. |
| **OPEN-005** | Quem pode aceitar o convite. | (a) só a conta com o mesmo e-mail (confirmado) do convite; (b) qualquer conta com o link. | **(a)**: o link pode ser encaminhado por engano, e o e-mail é o que o Dono escolheu. Com a (b) da OPEN-004, isso também impede que um link copiado sirva para outra pessoa. |
| **OPEN-006** | Conta nova: o link de confirmação do cadastro não volta ao convite. | (a) "Convites para você" em "Meus negócios", pelo e-mail confirmado; (b) levar o `proximo` pelo cadastro e pela confirmação (muda a SPEC-002 e o modelo de e-mail do Supabase); (c) a pessoa abre o link do convite de novo. | **(a)**: não mexe na SPEC-002 e também resolve quem perdeu o e-mail do convite. |
| **OPEN-007** | O membro pode sair do negócio sozinho? | (a) sim, "Sair deste negócio" em "Meus negócios" para quem não é Dono; (b) não, só o Dono remove. | **(a)**: o RN02 restringe o que outros fazem com a equipe, não a saída voluntária, e a LGPD favorece que a pessoa possa encerrar o vínculo. Confirmar com a equipe. |
| **OPEN-008** | Como garantir que nenhuma Server Action esqueça a guarda (INV-005). | (a) regra de lint ou teste que percorre as Server Actions; (b) só revisão de código; (c) todas as ações passam por uma função de fábrica que exige declarar módulo e ação. | **(c) + teste (a)**: a fábrica torna o esquecimento visível e o teste pega o que escapar. |
| **OPEN-009** | Guarda do e-mail de quem foi convidado e não aceitou (LGPD). | (a) manter os convites como histórico da equipe; (b) apagar o e-mail (ou o convite) dos EXPIRADO e CANCELADO depois de 90 dias. | **(b)**: o e-mail é de alguém que não consentiu, e o histórico não é usado por nenhum requisito. A limpeza pode ficar para a SPEC-014. |
| **OPEN-010** | Divergência de documento: a SPEC-004 (fora do escopo) diz "Troca de plano — SPEC-005 (RF73)", mas o Mapa coloca o RF73 na SPEC-013. | (a) seguir o Mapa e corrigir a frase da SPEC-004; (b) trazer a troca de plano para esta Spec. | **(a)**: a troca de plano depende dos recursos pagos que a SPEC-013 entrega. Esta Spec só **lê** o plano. Para testar o plano pago, os testes gravam `plano = PAGO` direto no banco. |

---

## 14. Definition of Done da Spec

A SPEC-005 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-16) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-010) estiverem preservados;
- [ ] os testes derivados (T01 a T19) estiverem aprovados, com o CI verde no PR (T18 e T19 com evidências na homologação);
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF07) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-010 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline (incluindo a OPEN-010 e o comentário de `permissoesCustom` no schema) tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
