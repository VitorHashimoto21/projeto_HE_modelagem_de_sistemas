# SPEC-004 — Cadastro do negócio e enquadramento fiscal

> **Status:** ✅ **Implementada em 04/10/2026 e verificada no preview da Vercel** (PR #45, banco de homologação) — questões em aberto decididas pela equipe (seção 13), todas pela opção recomendada; testes T01–T13 no CI, fluxos e telas verificados no preview ([evidências](evidencias/SPEC-004/README.md)). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** [SPEC-002](SPEC-002.md) (acesso) e [SPEC-003](SPEC-003.md) (parâmetros fiscais) · **Próximas que dependem desta:** SPEC-005 (equipe) e todas as specs operacionais (o negócio é o tenant).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-004 |
| **Nome** | Cadastro do negócio e enquadramento fiscal |
| **Objetivo** | Permitir que um usuário autenticado cadastre um ou mais negócios — pelo CNPJ (consulta à BrasilAPI, com sugestão de regime, Anexo do Simples ou atividade do MEI a partir do CNAE e com preenchimento manual quando a consulta falhar) ou no regime Autônomo (sem CNPJ, com o Imposto% informado) —, tornando-se o Dono do negócio, e alternar entre os seus negócios sem novo login. |
| **Valor entregue** | O empreendedor tem o negócio configurado fiscalmente sem precisar conhecer o próprio enquadramento, e o sistema passa a ter o **negócio ativo** que isola todos os dados das próximas specs (estoque, vendas, financeiro, precificação). |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF02 | Um usuário pode cadastrar vários negócios na mesma conta. |
| | RF03 | Alternar entre negócios sem novo login (o seletor troca o negócio ativo; a sessão continua a mesma). |
| | RF58 | Consulta do CNPJ na base pública (BrasilAPI) para preencher razão social, CNAE principal e opção pelo Simples/MEI. |
| | RF59 | Sugestão do Anexo (Simples) ou da atividade (MEI) pelo CNAE, editável; preenchimento manual se a consulta falhar; regime Autônomo com Imposto% informado. |
| **RN** | RN24 | Um Anexo por negócio, com o aviso da simplificação para quem tem produto e serviço. |
| | RN01 | O negócio criado é o tenant: o cliente do negócio (SPEC-001) passa a ser usado com o negócio ativo. |
| **RNF** | RNF02 | O negócio ativo vem de um cookie, mas só vale após confirmar a filiação no banco (já garantido pela SPEC-002, INV-006). |
| | RNF07 | Trocar de negócio não exige novo login. |
| | RNF04 | Minimização: dos dados públicos do CNPJ, só o necessário é guardado (OPEN-004). |
| | RNF01 | Telas responsivas. |
| **Caso de uso / fluxo** | UC0 Cadastrar Negócio, UC2 Alternar entre Negócios | Jornada do Dono, passos B1–B5 de `FLUXOGRAMAS.md` (Selecionar Negócio → Cadastrar → Possui CNPJ? → Consultar ou preencher → Confirmar Anexo/atividade). |
| **Entidades** | Negocio, MembroNegocio (papel Dono), CnaeAnexo | Negocio é a âncora do tenant; CnaeAnexo vem da SPEC-003. |
| **Drivers** | AD-RF05 | Cadastro fiscal pelo CNPJ com adaptador isolado e fallback manual. |
| | AD-C02 | Isolamento estrito por negócio. |
| **ADRs** | ADR-006 | BrasilAPI atrás do adaptador `ConsultaCnpj`, com tempo limite e fallback manual. |
| | ADR-002 | Negocio como âncora do multi-tenant; MembroNegocio liga usuário e negócio. |
| | ADR-004 | O Anexo sugerido vem da tabela `CnaeAnexo` (consultas da SPEC-003). |

---

## 3. Escopo

### Incluído

1. **"Meus negócios" com a lista real:** os negócios em que o usuário é membro (nome, regime, papel), com o negócio ativo destacado e o botão "Cadastrar negócio".
2. **Cadastro com CNPJ:**
   1. a pessoa informa o CNPJ (validado com os dígitos verificadores no navegador e no servidor);
   2. o servidor consulta a BrasilAPI pelo adaptador `ConsultaCnpj` (tempo limite de 5 s);
   3. o formulário de confirmação vem preenchido: nome do negócio (nome fantasia ou razão social), razão social, CNAE principal, regime sugerido (MEI, Simples Nacional) e, conforme o regime, o Anexo e se o CNAE é sujeito ao Fator R (tabela `CnaeAnexo`) ou a atividade do MEI;
   4. a pessoa confere, edita se quiser e confirma.
3. **Preenchimento manual:** se a consulta falhar (fora do ar, tempo esgotado, CNPJ não encontrado) ou o CNAE não estiver na tabela `CnaeAnexo`, a pessoa preenche ou escolhe os campos que faltam, com textos de ajuda.
4. **Cadastro sem CNPJ (Autônomo):** nome do negócio e Imposto% que a pessoa paga (ex.: ISS e IR estimados).
5. **Criação atômica:** o `Negocio` e o `MembroNegocio` com papel **Dono** são criados na mesma transação; o novo negócio vira o negócio ativo.
6. **Negócio ativo e troca (UC2):** um seletor no cabeçalho da área autenticada mostra o negócio ativo e os demais; escolher outro grava o cookie `he_negocio` (só depois de confirmar a filiação) e leva à página inicial do negócio. A sessão de login continua a mesma.
7. **Página inicial do negócio** (`/painel`): resumo do enquadramento (regime, Anexo ou atividade do MEI, Fator R) com o aviso do RN24 quando couber. É provisória: o Dashboard da SPEC-012 a substitui.
8. **Destino depois do login** (OPEN-005): entrar direto no último negócio usado, se o cookie ainda for válido; senão, "Meus negócios".
9. **Edição dos dados fiscais pelo Dono** (OPEN-006): nome, regime, Anexo, Fator R, atividade do MEI ou Imposto%; o CNPJ não muda depois de cadastrado.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Convites, papéis Gerente/Colaborador e permissões | SPEC-005 |
| Parâmetros de precificação do negócio (taxa de cartão, capacidade, ticket médio, CMV estimado, margem meta) | SPECs 009 e 010 |
| Troca de plano (gratuito ↔ pago) | SPEC-005 (RF73) |
| Dashboard | SPEC-012 (substitui a página inicial provisória) |
| Encerramento/exclusão de negócio | SPEC-014 (RN27) — esta Spec só esconde negócios com `encerradoEm` |
| Negócios fora do Simples (Lucro Presumido/Real) | Ver OPEN-002 |
| Separação do imposto por atividade (multi-anexo) | Fora do MVP (RN24) |
| Lista oficial de ocupações permitidas ao MEI | Fora do MVP — a atividade do MEI é sugerida pelo Anexo do CNAE e confirmada pela pessoa |

---

## 4. Dependências

- **Specs anteriores:** SPEC-001 (schema com `Negocio` e `MembroNegocio`, cliente do negócio, RLS), SPEC-002 (sessão, contexto com o cookie `he_negocio` validado pela filiação — INV-006, área autenticada), SPEC-003 (consultas `anexoDoCnae` e normalização do CNAE).
- **Decisões arquiteturais:** ADR-002, ADR-004, ADR-006.
- **Pré-requisitos externos:** BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`), pública, sem chave. Conferida em 04/10/2026: devolve `razao_social`, `nome_fantasia`, `cnae_fiscal` (numérico), `opcao_pelo_simples`, `opcao_pelo_mei`, `descricao_situacao_cadastral`; CNPJ inválido → `400`. Também devolve sócios, e-mail e telefone, que **não** são usados nem guardados.

---

## 5. Comportamento esperado

### 5.1 Cadastro com CNPJ

- **Pré-condições:** usuário autenticado.
- **Fluxo principal:**
  1. Em "Meus negócios", a pessoa clica em "Cadastrar negócio" e escolhe "Tenho CNPJ".
  2. Informa o CNPJ (com ou sem pontuação). Navegador e servidor conferem os dígitos verificadores.
  3. O servidor consulta a BrasilAPI e monta a sugestão:
     - **regime:** `opcao_pelo_mei` → MEI; senão `opcao_pelo_simples` → Simples Nacional; senão, fora do Simples (OPEN-002);
     - **Simples:** Anexo e "sujeito ao Fator R" pela tabela `CnaeAnexo` (SPEC-003);
     - **MEI:** atividade sugerida pelo Anexo do CNAE — Anexos I e II → Comércio/Indústria; III, IV e V → Serviços (a pessoa pode trocar, inclusive para "Comércio e Serviços");
     - **nome do negócio:** nome fantasia; se vazio, a razão social.
  4. O formulário de confirmação mostra os dados (os vindos da Receita marcados como tal), com o aviso do RN24 para o Simples: "o mesmo Anexo vale para todo o faturamento do negócio".
  5. A pessoa confirma; o servidor valida de novo e cria `Negocio` + `MembroNegocio` (Dono) numa transação.
  6. O novo negócio vira o ativo e a pessoa vai para a página inicial do negócio.
- **Fluxos alternativos e de exceção:**

| Situação | Comportamento |
|---|---|
| CNPJ com dígitos verificadores errados | Mensagem no campo ("CNPJ inválido"); nada é consultado. |
| BrasilAPI fora do ar ou tempo esgotado (5 s) | "Não conseguimos consultar o CNPJ agora. Preencha os dados abaixo." — formulário manual com o CNPJ já preenchido. |
| CNPJ não encontrado na base | "CNPJ não encontrado na base pública" — formulário manual. |
| CNAE fora da tabela `CnaeAnexo` | Anexo em branco para a pessoa escolher, com ajuda; caixa "minha atividade está sujeita ao Fator R" (desmarcada). |
| Situação cadastral diferente de ATIVA | Ver OPEN-003. |
| Empresa fora do Simples e do MEI | Ver OPEN-002. |
| CNPJ já cadastrado no HE | Ver OPEN-001. |
| Falha ao gravar | Nada fica pela metade (transação); erro genérico, pode tentar de novo. |

- **Pós-condições:** existe um `Negocio` com o enquadramento confirmado e um `MembroNegocio` Dono do usuário; o cookie `he_negocio` aponta para ele.

### 5.2 Cadastro sem CNPJ (Autônomo)

1. A pessoa escolhe "Não tenho CNPJ (autônomo)".
2. Informa o nome do negócio e o Imposto% que paga (0 a 99,99%), com ajuda ("some o ISS e o IR que você recolhe; se não souber, pergunte ao contador").
3. O negócio é criado com regime Autônomo; o resto do fluxo é igual ao 5.1 (passos 5 e 6).

### 5.3 Validação por regime

| Regime | Obrigatório | Deve ficar vazio |
|---|---|---|
| **MEI** | CNPJ, atividade do MEI | Anexo, Imposto% |
| **Simples Nacional** | CNPJ, Anexo (Fator R: sim/não) | Atividade do MEI, Imposto% |
| **Autônomo** | Imposto% | CNPJ, Anexo, atividade do MEI |

Nome do negócio sempre obrigatório (até 120 caracteres). O servidor recusa combinações fora da tabela, mesmo que a interface seja contornada.

### 5.4 Alternar entre negócios (UC2)

1. O seletor do cabeçalho lista os negócios do usuário (sem os encerrados), com o ativo marcado.
2. Ao escolher outro, o servidor confirma a filiação, grava o cookie `he_negocio` (httpOnly, `SameSite=Lax`, 1 ano) e leva a `/painel`.
3. A sessão de login não muda (RNF07, CA-12 da SPEC-002). Um negócio do qual a pessoa não é membro é recusado (INV-006 da SPEC-002).

### 5.5 Edição dos dados fiscais (OPEN-006)

Só o Dono vê e usa "Dados do negócio". Edita nome, regime e os campos do regime (mesmas regras do 5.3); o CNPJ aparece, mas não muda. Ao trocar o regime, os campos que deixam de valer são limpos.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Todo negócio nasce com exatamente um Dono, o usuário que o criou, na mesma transação. | Teste de integração (criação e falha simulada na criação do membro). |
| **INV-002** | Os campos fiscais obedecem à tabela do 5.3 para o regime do negócio. | Teste da validação (unitário) e do servidor chamado direto (integração). |
| **INV-003** | O CNPJ gravado tem 14 dígitos, sem pontuação, e dígitos verificadores válidos. | Teste unitário da validação; normalização antes de gravar. |
| **INV-004** | Dos dados da BrasilAPI só são guardados: razão social, nome do negócio, CNAE principal e o enquadramento. Sócios, e-mail, telefone e endereço nunca são guardados nem registrados em log. | Teste do adaptador (mapeamento) e revisão dos logs. |
| **INV-005** | A consulta externa nunca trava o cadastro: com falha ou demora, o formulário manual aparece em até ~5 s. | Teste do adaptador com tempo esgotado e com erro. |
| **INV-006** | O negócio ativo só muda para um negócio do qual o usuário é membro e que não está encerrado. | Teste de integração da troca. |
| **INV-007** | Só o Dono edita os dados fiscais do negócio. | Teste de integração (membro sem papel Dono é recusado). |
| **INV-008** | A chamada à BrasilAPI acontece só no servidor, só para usuário autenticado. | Revisão (Server Action) e teste sem sessão. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `Negocio` | `nome`, `regimeTributario`, `cnpj`, `razaoSocial`, `cnaePrincipal`, `anexoSimples`, `sujeitoFatorR`, `atividadeMei`, `impostoPercentualManual`, `encerradoEm` (só leitura) | Âncora do tenant (ADR-002). Campos fiscais conforme o 5.3. |
| `MembroNegocio` | `usuarioId`, `negocioId`, `papel` | Criado com papel `DONO` junto com o negócio. Único por (usuário, negócio). |
| `CnaeAnexo` | (consulta `anexoDoCnae` da SPEC-003) | Fonte da sugestão do Anexo e do Fator R. |

**Mudanças previstas no schema:** nenhuma obrigatória. Dependendo das decisões: retirar o `@unique` de `Negocio.cnpj` (OPEN-001, opção b) ou novo valor de regime (OPEN-002, opção b). `cnaePrincipal` passa a ser gravado no formato normalizado da SPEC-003 (`0000-0/00`).

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/negocio/` — validação por regime, sugestão de enquadramento a partir dos dados do CNPJ e serviços de cadastro, troca e edição (sem framework, como `src/lib/auth/servicos.ts`);
  - `src/lib/dominio/cnpj.ts` — validação e normalização do CNPJ (pura);
  - `src/lib/integracoes/consulta-cnpj.ts` — contrato `ConsultaCnpj` e o adaptador da BrasilAPI (ADR-006);
  - `src/lib/db/negocios.ts` — criação atômica (Negocio + Dono), lista de negócios do usuário, leitura e edição dos dados fiscais;
  - `src/app/(app)/negocios/`, `src/app/(app)/negocios/novo/`, `src/app/(app)/painel/`, `src/app/(app)/negocio/dados/` — telas;
  - seletor de negócio no cabeçalho de `src/app/(app)/layout.tsx`.
- **Fronteiras:**
  - O `Negocio` é criado fora do cliente do negócio (ainda não há contexto) por `src/lib/db/negocios.ts`; depois disso, todo acesso a dados operacionais usa `clienteDoNegocio(exigirNegocio())`.
  - Nenhum dado do navegador define o negócio ativo sem passar pela filiação (SPEC-002).
  - O adaptador externo não conhece o domínio: devolve um objeto neutro, e a sugestão de enquadramento é feita em `src/lib/negocio/`.
- **Integrações:** BrasilAPI (HTTP, tempo limite de 5 s, sem chave). Falhas viram fallback manual, nunca erro para o usuário.
- **Frontend × backend:** validação dupla (navegador e servidor), como na SPEC-002; a consulta do CNPJ é uma Server Action.
- **ADRs que restringem:** ADR-006 (adaptador + fallback), ADR-002 (âncora do tenant), ADR-004 (Anexo pela tabela), ADR-001 (regras fora das páginas).
- **Identidade visual:** sem protótipo para estas telas (OPEN-007); seguem os tokens e componentes já usados nas telas de acesso e na área autenticada.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Consultar CNPJ** (adaptador) | CNPJ (14 dígitos) | `{ razaoSocial, nomeFantasia, cnae, optanteMei, optanteSimples, situacao }` | `IndisponivelOuTempoEsgotado`, `NaoEncontrado` |
| **Sugerir enquadramento** | dados do CNPJ + consulta `anexoDoCnae` | `{ nome, regime, anexo?, sujeitoFatorR, atividadeMei?, avisos[] }` | — |
| **Cadastrar negócio** | dados confirmados (com ou sem CNPJ), usuário da sessão | negócio criado (id), já ativo | `CampoInvalido` (por campo), `CnpjJaCadastrado` (OPEN-001), `RegimeNaoSuportado` (OPEN-002), `FalhaInterna` |
| **Listar meus negócios** | usuário da sessão | lista `{ id, nome, regime, papel, ativo }` | — |
| **Trocar negócio ativo** | id do negócio, usuário da sessão | cookie gravado + destino | `NaoMembro` (vai para "Meus negócios") |
| **Editar dados fiscais** | id do negócio (ativo), dados | negócio atualizado | `SomenteDono`, `CampoInvalido` |

Os nomes exatos de rotas, funções e componentes são decididos na implementação, respeitando estes contratos.

**Implementação (04/10/2026):** domínio em `src/lib/dominio/cnpj.ts`; adaptador `ConsultaCnpj` em `src/lib/integracoes/consulta-cnpj.ts`; validação, sugestão de enquadramento e fluxos em `src/lib/negocio/` (Server Actions em `acoes.ts`); banco em `src/lib/db/negocios.ts` (`negocios()` de `@/lib/db`). Rotas: `/negocios`, `/negocios/novo`, `/painel` e `/negocio/dados`; seletor no cabeçalho da área autenticada.

**Divergências registradas na implementação:**

- **`User-Agent` na chamada à BrasilAPI:** a API responde `403` ao `User-Agent` padrão do `fetch` do Node (o `curl` funcionava); o adaptador se identifica como `HealthEnterprise/1.0`. Coberto por teste de regressão.
- **Filiação ignora negócios encerrados:** `ehMembro` (SPEC-002) passou a exigir `encerradoEm` vazio, para que o contexto e a troca recusem negócio encerrado (INV-006).
- **CNPJ na edição:** o CNPJ cadastrado nunca muda; um negócio Autônomo (sem CNPJ) pode informá-lo ao passar para MEI ou Simples, e um negócio com CNPJ não pode voltar a Autônomo (seria contraditório com o regime).
- **Preenchimento manual a partir do CNPJ:** quando a consulta falha, o formulário oferece MEI e Simples (o Autônomo é o caminho "não tenho CNPJ"). As regras de bloqueio da consulta (OPEN-002 e OPEN-003) orientam o cadastro, mas o preenchimento manual, que existe justamente para quando a base pública falha, não as repete.
- **Página inicial `/painel`:** `ROTA_INICIAL` passou de `/negocios` para `/painel` (OPEN-005); `exigirNegocio()` leva a "Meus negócios" quando não há negócio ativo válido.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Telas de "Meus negócios", cadastro, painel e dados do negócio responsivas. | Capturas em 390, 768 e 1440 px, claro e escuro, sem rolagem horizontal. |
| **RNF02** | Negócio ativo validado no servidor; criação e edição só pelo usuário da sessão. | INV-006, INV-007, INV-008 por testes de integração. |
| **RNF04** | Minimização dos dados do CNPJ. | INV-004 (teste do mapeamento). |
| **RNF06** | A consulta externa não segura a tela: tempo limite de 5 s. | INV-005. |
| **RNF07** | Trocar de negócio não pede login. | Teste de integração e verificação manual na homologação. |

---

## 11. Critérios de aceitação

**CA-01 — Cadastro com CNPJ de MEI.**
Dado um usuário autenticado e um CNPJ de MEI com CNAE na tabela,
quando ele informa o CNPJ e confirma,
então o formulário vem com razão social, CNAE, regime MEI e atividade sugerida; o negócio é criado com ele como Dono e vira o negócio ativo.

**CA-02 — Cadastro com CNPJ do Simples.**
Dado um CNPJ optante pelo Simples com CNAE sujeito ao Fator R (ex.: 6201-5/01),
quando o usuário confirma,
então o negócio é criado no Simples Nacional, Anexo V, sujeito ao Fator R, e a tela mostrou o aviso do RN24.

**CA-03 — Consulta indisponível.**
Dada a BrasilAPI fora do ar ou demorando mais de 5 s,
quando o usuário informa um CNPJ válido,
então aparece o formulário manual com o CNPJ preenchido e a mensagem de indisponibilidade, e o cadastro pode ser concluído.

**CA-04 — CNAE fora da tabela.**
Dado um CNPJ do Simples cujo CNAE não está em `CnaeAnexo`,
quando a consulta volta,
então o Anexo fica para o usuário escolher, com ajuda e a caixa de Fator R, e o cadastro só é concluído com um Anexo escolhido.

**CA-05 — Autônomo.**
Dado um usuário sem CNPJ,
quando ele informa o nome e o Imposto%,
então o negócio é criado no regime Autônomo, sem CNPJ, Anexo ou atividade do MEI.

**CA-06 — Validação.**
Dado um CNPJ com dígitos verificadores errados, um Imposto% fora de 0–99,99, um nome vazio ou uma combinação de campos fora da tabela do 5.3,
quando o usuário envia (ou o servidor é chamado direto),
então a mensagem aparece no campo e nada é gravado.

**CA-07 — Vários negócios e troca.**
Dado um usuário com dois negócios,
quando ele escolhe o outro no seletor,
então o negócio ativo muda, a página inicial mostra o enquadramento do novo negócio e não é pedido novo login.

**CA-08 — Troca para negócio alheio.**
Dado um id de negócio do qual o usuário não é membro,
quando a troca é pedida (inclusive chamando o servidor direto),
então o negócio ativo não muda e a pessoa vai para "Meus negócios".

**CA-09 — Atomicidade.**
Dada uma falha ao criar o membro Dono,
quando o cadastro é confirmado,
então nem o negócio nem o membro ficam gravados.

**CA-10 — Minimização.**
Dada uma consulta de CNPJ que devolve sócios, e-mail e telefone,
quando o negócio é criado,
então nenhum desses dados está no banco nem nos logs.

**CA-11 — Edição só pelo Dono.**
Dado um membro que não é Dono (criado diretamente no teste, pois os convites são da SPEC-005),
quando ele tenta editar os dados fiscais,
então a edição é recusada; o Dono consegue editar, e ao trocar o regime os campos do regime antigo são limpos.

**CA-12 — Destino após o login.**
Dado um usuário cujo último negócio usado ainda é válido,
quando ele entra,
então vai direto para a página inicial desse negócio; sem negócio válido, vai para "Meus negócios" (OPEN-005).

**CA-13 — Visual.**
Dadas as telas desta Spec,
quando exibidas em 390, 768 e 1440 px, nos temas claro e escuro,
então seguem os tokens da identidade, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação e normalização do CNPJ (dígitos verificadores, pontuação, sequências repetidas) | Unitário | CA-06, INV-003 |
| T02 | Validação por regime (tabela do 5.3) e do Imposto% | Unitário | CA-05, CA-06, INV-002 |
| T03 | Adaptador da BrasilAPI: mapeamento de uma resposta real (gravada), 400/404, erro 5xx e tempo esgotado | Unitário (fetch simulado) | CA-03, INV-004, INV-005 |
| T04 | Sugestão de enquadramento: MEI, Simples com CNAE na tabela, CNAE fora da tabela, fora do Simples | Unitário | CA-01, CA-02, CA-04 |
| T05 | Cadastro cria Negocio + Dono e define o negócio ativo | Integração | CA-01, CA-05, INV-001 |
| T06 | Falha simulada na criação do membro desfaz o negócio | Integração | CA-09, INV-001 |
| T07 | Servidor chamado direto com dados inválidos recusa | Integração | CA-06, INV-002 |
| T08 | Lista de negócios do usuário (sem encerrados) e troca do ativo | Integração | CA-07, INV-006 |
| T09 | Troca para negócio alheio ou encerrado recusada | Integração | CA-08, INV-006 |
| T10 | Edição só pelo Dono; troca de regime limpa os campos antigos | Integração | CA-11, INV-007 |
| T11 | Nada de sócios, e-mail ou telefone no banco ou nos logs | Integração + revisão | CA-10, INV-004 |
| T12 | Destino após o login com e sem negócio válido | Integração | CA-12 |
| T13 | Consulta de CNPJ sem sessão é recusada | Integração | INV-008 |
| T14 | Telas em 390/768/1440 px, claro e escuro | Manual com captura | CA-13 |
| T15 | Fluxo completo na homologação com um CNPJ real (consulta real à BrasilAPI) | Manual (uma vez) | CA-01 a CA-07 |

Os testes automatizados nunca chamam a BrasilAPI de verdade (fetch simulado com uma resposta gravada); a consulta real é verificada manualmente na homologação (T15).

---

## 13. Questões em aberto

Todas decididas pela equipe em 04/10/2026:

| ID | Decisão |
|---|---|
| **OPEN-001** — CNPJ já cadastrado | **CNPJ único** (mantém o `@unique`). Mensagem: "Este CNPJ já está cadastrado no Health Enterprise. Peça um convite ao Dono do negócio." |
| **OPEN-002** — Fora do Simples e do MEI | **Não suportado no MVP.** A consulta que indicar empresa fora do Simples e do MEI mostra a explicação e não segue para a confirmação. (Se a consulta estiver indisponível, o preenchimento manual oferece só MEI, Simples e Autônomo.) |
| **OPEN-003** — Situação cadastral | **BAIXADA e NULA bloqueiam**; INAPTA e SUSPENSA seguem com aviso ("regularize na Receita; a base pública pode estar desatualizada"). |
| **OPEN-004** — CPF na razão social do MEI | **Guardar sem o CPF:** os 11 dígitos finais (com ou sem pontuação) são retirados antes de gravar e nunca exibidos. |
| **OPEN-005** — Destino depois do login | **Último negócio usado**, se o cookie ainda for válido; senão, "Meus negócios". Refina a SPEC-002: a página inicial passa a ser `/painel`, que sem negócio ativo válido leva a "Meus negócios". |
| **OPEN-006** — Editar dados fiscais | **Incluída nesta Spec:** "Dados do negócio", só para o Dono, com a mesma validação do cadastro. |
| **OPEN-007** — Telas sem protótipo | **Seguir os tokens e componentes já usados**, com o cadastro em duas etapas (CNPJ → confirmação) e capturas no PR. |

---

## 14. Definition of Done da Spec

A SPEC-004 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-13) estiverem implementados — CA-01 a CA-12 por testes e no preview; CA-13 com capturas;
- [x] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [x] os testes derivados (T01 a T15) estiverem aprovados, com o CI verde no PR — T01 a T13 no CI do PR #45; T14 e T15 no preview;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF06, RNF07) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-007 tiverem sido decididas e registradas;
- [x] não existir divergência conhecida entre a implementação e esta Spec;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 9).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
