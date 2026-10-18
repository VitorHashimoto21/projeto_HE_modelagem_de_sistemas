# SPEC-018 — Administrador da plataforma e acesso de suporte (somente leitura)

> **Status:** 🔵 **Implementada (17/10/2026) e verificada na homologação em 18/10/2026 (T13); falta a decisão da faixa no celular (seção 9)** — questões em aberto decididas pela equipe em entrevista (seção 13), todas pela opção recomendada, com a OPEN-002 (2º fator) adiada para a SPEC-019 a pedido da equipe; baseline ajustada (RF74–RF78, RN30–RN32, RNF02, RNF12 e ADR-008); onde o script roda decidido em 17/10/2026 (workflow manual, 5.1); testes T01–T11 automatizados e telas verificadas em build local (T12); fluxo completo na homologação (T13), com "Relatórios" retirado do modo suporte (PR #87) — [evidências](evidencias/SPEC-018/README.md). Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir de uma necessidade identificada pela equipe em 17/10/2026.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Altera:** [SPEC-002](SPEC-002.md) (sessão e aceite dos termos), [SPEC-005](SPEC-005.md) (contexto e permissões) e [SPEC-014](SPEC-014.md) (exportação e exclusão) · **Usa:** [SPEC-001](SPEC-001.md) (isolamento), [SPEC-004](SPEC-004.md) (negócio), [SPEC-009](SPEC-009.md) (rotina diária), [SPEC-016](SPEC-016.md) (componentes) · **Continua em:** SPEC-019 (edição em modo suporte, emergência, ações de plataforma e 2º fator).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-018 |
| **Nome** | Administrador da plataforma e acesso de suporte (somente leitura) |
| **Objetivo** | Criar o ator **Administrador da plataforma**, com um painel que lista os negócios só por metadados, e um **acesso de suporte** que o Dono libera para módulos escolhidos e por prazo definido, em **somente leitura**, com dados pessoais mascarados e cada passo registrado num log que não pode ser alterado e que o Dono consulta. |
| **Valor entregue** | A equipe do HE consegue atender pedidos dos usuários (entender um problema, conferir um registro) sem pedir senha a ninguém e sem quebrar o isolamento entre negócios. O Dono decide o que o suporte vê e por quanto tempo, acompanha tudo e pode revogar a qualquer momento. |

### Princípio da Spec

O Administrador é um ator **da plataforma**, não do negócio. Por padrão, ele **não vê nenhum dado operacional** de nenhum negócio. Ele só entra num negócio quando o **Dono** libera, dentro do escopo e do prazo liberados, e sempre como ele mesmo — nunca "logado como" o usuário. Isso mantém o HE no papel de **operador** dos dados do negócio (Política de Privacidade, seção 2): o acesso acontece por instrução do controlador.

### Divisão com a SPEC-019

| SPEC-018 (esta) | SPEC-019 (a gerar) |
|---|---|
| Conta de Administrador, painel de metadados | **Camada de segurança da autenticação do Administrador: 2º fator (TOTP) obrigatório** (OPEN-002 desta Spec) |
| Liberação pelo Dono, modo suporte **somente leitura** | Edição em modo suporte (correções pedidas pelo usuário) |
| Registro de auditoria e tela "Acessos do suporte" | Acesso de emergência sem liberação (ordem judicial, incidente, Dono sem acesso) |
| Nova versão da Política e dos Termos, com novo aceite | Ações de plataforma: suspender/reativar negócio, trocar plano (OPEN-012) |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF74** (novo) | Conta de Administrador da plataforma, exclusiva, concedida por script; painel de metadados dos negócios. |
| | **RF75** (novo) | Liberação do acesso de suporte pelo Dono: motivo, módulos e prazo; revogação a qualquer momento. |
| | **RF76** (novo) | Modo suporte: leitura dos módulos liberados, com faixa de aviso e dados pessoais mascarados. |
| | **RF77** (novo) | Registro de auditoria do suporte, tela "Acessos do suporte" e avisos ao Dono (no sistema e por e-mail). |
| | **RF78** (novo) | Novo aceite obrigatório da Política de Privacidade e dos Termos a cada nova versão. |
| | RF02, RF04, RF72 | **Restritos** para a conta de Administrador: ela não cria negócio nem aceita convite (INV-004). |
| **RN** | **RN30** (nova) | Sem liberação ativa, o Administrador não acessa dado operacional; nesta Spec, o acesso é só de leitura. |
| | **RN31** (nova) | Só o Dono libera e revoga; prazo de 1 h, 24 h, 3 dias ou 7 dias; uma liberação ativa por negócio. |
| | **RN32** (nova) | O registro de auditoria do suporte não é alterado nem apagado e é guardado por 5 anos. |
| | RN01 | **Complementada:** o isolamento continua valendo para membros; a única exceção é o acesso de suporte liberado (RN30, RN31). |
| | RN27 | Exclusão de conta: liberações ativas dos negócios encerrados são revogadas; o registro de auditoria é mantido (RN32), já sem identificação pessoal. |
| **RNF** | **RNF02** | **Ajustado:** o isolamento admite só o acesso de suporte liberado, conferido no servidor a cada requisição. |
| | RNF04 | Política e Termos em nova versão; exportação de dados inclui as liberações e o registro de auditoria dos negócios do titular. |
| | RNF05 | Estendido ao suporte: o registro de auditoria segue o mesmo princípio (log imutável). |
| | **RNF12** (novo) | Sessão do Administrador limitada a 8 h; 2º fator na SPEC-019. |
| **Decisões arquiteturais** | **ADR-008** (nova, aceita) | Acesso de suporte com liberação do controlador; rejeita o superusuário e o "entrar como o usuário". |
| | ADR-002, ADR-003 | Mantidas: isolamento no código e no banco; autorização no servidor. |
| **Caso de uso / fluxo** | Novos: UC-A1 Liberar acesso ao suporte; UC-A2 Atender em modo suporte; UC-A3 Consultar acessos do suporte | Ver seção 5. |
| **Entidades** | Usuario (campos novos), **AcessoSuporte** (nova), **RegistroSuporte** (nova), Negocio, MembroNegocio, Cliente (leitura) | Ver seção 7. |

---

## 3. Escopo

### Incluído

1. **Conta de Administrador** (OPEN-001):
   - concedida e retirada por **script** da equipe (`npm run admin:conceder <e-mail>` / `admin:retirar`), nunca por tela; em homologação e produção, o script roda pelo workflow manual "Administradores" do GitHub Actions (5.1);
   - **exclusiva**: não pode ser membro de nenhum negócio; o script recusa uma conta com vínculos, e a conta de Administrador não cria negócio nem aceita convite;
   - sessão limitada a **8 h** desde a entrada (OPEN-002, RNF12); o 2º fator fica para a SPEC-019.
2. **Painel do Administrador** (`/admin`, OPEN-003), lista de negócios com **somente metadados**: nome, regime, plano, data de criação, número de membros, situação (ativo/encerrado), nome e e-mail do Dono e situação do acesso de suporte (sem liberação / liberado até …). Busca por nome do negócio ou e-mail do Dono. Nada de vendas, valores, clientes ou estoque.
3. **Liberação pelo Dono** (OPEN-004 a OPEN-006): em *Configurações → Acesso do suporte*, o Dono informa o **motivo**, marca os **módulos** e escolhe o **prazo** (1 h, 24 h — padrão —, 3 dias ou 7 dias). Pode **revogar** a qualquer momento.
4. **Modo suporte, somente leitura** (OPEN-005, OPEN-007, OPEN-012):
   - o Administrador entra no negócio pelo painel, só com liberação ativa;
   - vê **apenas os módulos liberados**, com a ação *ver* da matriz de permissões;
   - **nenhuma ação altera dados**: botões de criar, editar, cancelar e excluir não aparecem, e o servidor recusa qualquer escrita;
   - faixa fixa no topo: "Modo suporte — {negócio} — somente leitura — até {data e hora}" com o botão "Sair do modo suporte";
   - dados pessoais **mascarados**: nome e contato dos clientes finais e e-mails dos membros.
5. **Registro de auditoria** (OPEN-008, OPEN-010): liberação, revogação, entrada, **cada tela aberta** (módulo e página) e saída, com data, hora e autor; imutável e guardado por 5 anos.
6. **Transparência para o negócio** (OPEN-009):
   - faixa para os membros do negócio enquanto houver liberação ativa: "O suporte do HE pode ver {módulos} deste negócio até {data e hora}";
   - tela **"Acessos do suporte"** para o Dono, com as liberações (ativa, expirada, revogada) e o registro de cada uma;
   - e-mail ao Dono quando ele libera e na **primeira entrada** do Administrador em cada liberação, quando o envio estiver disponível; falha no e-mail não bloqueia nada.
7. **Política de Privacidade e Termos de Uso** em nova versão, prevendo o acesso de suporte, com **novo aceite obrigatório** no próximo acesso de cada usuário (OPEN-011).
8. **LGPD (SPEC-014):** a exportação inclui as liberações e o registro de auditoria dos negócios em que o titular é Dono; a exclusão de conta revoga as liberações ativas dos negócios encerrados.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| 2º fator (TOTP) para o Administrador | **SPEC-019**, como camada de segurança da autenticação (OPEN-002) |
| Editar dados em modo suporte | SPEC-019 |
| Acesso sem liberação do Dono (emergência) | SPEC-019 |
| Suspender/reativar negócio, trocar plano, reenviar convite pelo painel | SPEC-019 (OPEN-012) |
| Configurações do negócio em modo suporte (Dados do negócio, Equipe, Plano, Minha conta) | Fora: o painel já mostra os metadados necessários |
| Indicadores de uso no painel (vendas no mês, último acesso) | Fora (OPEN-003) |
| Gerente ou Colaborador liberar o acesso | Fora (OPEN-004): pedem ao Dono |

---

## 4. Dependências

- **Specs:** SPEC-001 (isolamento e regra de RLS em tabela nova), SPEC-002 (sessão, contexto, versão dos termos), SPEC-004 (negócio e troca de negócio), SPEC-005 (matriz módulo × ação, `acaoComPermissao`, envio de e-mail), SPEC-009 (rotina diária), SPEC-014 (exportação e exclusão), SPEC-016 (faixa, gaveta, diálogo de confirmação, selos).
- **Decisões arquiteturais:** ADR-002, ADR-003 e a nova ADR-008.
- **Pré-requisitos externos:** nenhum. O e-mail ao Dono depende do domínio no Resend para chegar a qualquer endereço (pendência já registrada); sem isso, o aviso no sistema cobre.

---

## 5. Comportamento esperado

### 5.1 Conceder e retirar o papel de Administrador (equipe do HE)

1. `npm run admin:conceder <e-mail>` marca a conta (`Usuario.administradorEm = agora`). A conta precisa existir e não pode ter vínculo com nenhum negócio nem convite pendente; senão o script recusa e explica.
2. `npm run admin:retirar <e-mail>` desmarca a conta e revoga a entrada em modo suporte em andamento.
3. O script registra quem rodou (`ADMIN_RESPONSAVEL`, obrigatório) e quando, no registro de auditoria (evento `PAPEL_CONCEDIDO` / `PAPEL_RETIRADO`).
4. Não existe tela para conceder o papel.
5. **Onde o script roda (decisão da equipe em 17/10/2026):**
   - **Desenvolvimento:** localmente, com o banco do `.env` (`ADMIN_RESPONSAVEL="Nome" npm run admin:conceder <e-mail>`).
   - **Homologação e produção:** pelo workflow manual **"Administradores"** do GitHub Actions (*Actions → Administradores → Run workflow*), com os campos **ação** (conceder ou retirar), **e-mail** e **ambiente** (homologação ou produção). O workflow usa o segredo `DIRECT_URL` do ambiente escolhido (o mesmo das migrações), então a credencial do banco não circula pelos computadores da equipe. O responsável registrado é o usuário do GitHub que disparou a execução, e o histórico de execuções do Actions complementa o registro de auditoria.

### 5.2 Entrar como Administrador

1. O Administrador entra pela tela de login comum. Depois do login, vai direto para `/admin` (não para "Meus negócios").
2. A sessão vale **8 h** desde a entrada (RNF12); depois disso, volta ao login com "Sua sessão de administrador expirou. Entre novamente."
3. As rotas do app de negócio, fora do modo suporte, levam o Administrador de volta ao painel.
4. Um usuário comum que abre `/admin` vê a página "Sem acesso" (SPEC-005), sem revelar o que existe ali.

### 5.3 Painel do Administrador

1. Lista paginada (25 por página), ordenada pela data de criação, com busca por nome do negócio ou e-mail do Dono.
2. Colunas: negócio, regime, plano, criado em, membros, situação, Dono (nome e e-mail), acesso de suporte.
3. Ao abrir um negócio: os mesmos metadados, a liberação ativa (motivo, módulos, prazo) e o botão **"Entrar em modo suporte"**, habilitado só com liberação ativa. Sem liberação: "O Dono ainda não liberou o acesso. Peça a ele em *Configurações → Acesso do suporte*."
4. Abrir o painel e a ficha de um negócio **não** gera registro de tela (não há dado operacional ali); a entrada em modo suporte gera.

### 5.4 Liberar e revogar o acesso (Dono)

1. Em *Configurações → Acesso do suporte* (só o Dono), "Liberar acesso ao suporte" abre uma gaveta com:
   - **motivo** (obrigatório, até 300 caracteres), ex.: "Vendas de ontem não aparecem no caixa";
   - **módulos**, marcando entre Catálogo, Estoque, Vendas, Calculadora, Financeiro e Dashboard (ao menos um);
   - **prazo**: 1 h, 24 h (padrão), 3 dias ou 7 dias;
   - o texto: "O suporte do HE poderá **ver** (sem alterar) os módulos marcados até {data e hora}. Nomes e contatos dos seus clientes e e-mails da equipe aparecem mascarados. Tudo fica registrado aqui e você pode revogar quando quiser."
2. Ao confirmar: cria a liberação, registra `LIBERACAO`, mostra a faixa para os membros do negócio e envia o e-mail ao Dono.
3. Já existe liberação ativa → a nova **substitui** a anterior (a anterior é encerrada como revogada, com registro). Assim há no máximo uma ativa por negócio.
4. **Revogar** (diálogo de confirmação da SPEC-016): encerra na hora; se o Administrador estiver em modo suporte, a próxima requisição dele já é recusada e ele volta ao painel com "O Dono revogou o acesso."
5. Expirada a liberação, vale o mesmo: a próxima requisição é recusada ("O acesso expirou.").
6. Negócio encerrado (RN27) não pode ser liberado; as liberações ativas são revogadas no encerramento.

### 5.5 Modo suporte (Administrador)

1. "Entrar em modo suporte" confere a liberação no servidor, registra `ENTRADA` e grava o cookie de suporte (id da liberação). Na primeira entrada da liberação, envia o e-mail ao Dono.
2. A cada requisição, o contexto é montado **a partir da liberação** (nunca só do cookie): conta de Administrador + liberação ativa (não expirada, não revogada) + negócio da liberação. A matriz efetiva tem apenas *ver* nos módulos liberados.
3. O menu mostra só os módulos liberados; Configurações e Relatórios não aparecem (Relatórios cruzam módulos; decisão da homologação, 18/10/2026).
4. Cada página aberta registra `TELA` com o módulo e uma descrição curta (ex.: "Vendas — histórico 01/10 a 17/10", "Vendas — venda nº 15"). Se o registro falhar, a página não é mostrada (INV-005).
5. Nenhuma Server Action que grava aceita o contexto de suporte (INV-002). Botões de escrita não aparecem, como acontece hoje para quem não tem a permissão.
6. Dados pessoais mascarados (INV-006):

   | Dado | Como aparece |
   |---|---|
   | Nome do cliente | Iniciais de cada palavra + `***` ("Maria Silva" → "M*** S***") |
   | Contato do cliente (telefone, e-mail) | `•••` + últimos 2 caracteres |
   | E-mail de membro | Primeira letra + `***@` + domínio ("r***@exemplo.com") |
   | Nome de membro | Sem máscara (necessário para entender quem registrou) |

   A máscara é aplicada no servidor, antes de os dados irem para a tela; downloads de relatório (CSV/PDF) não ficam disponíveis no modo suporte.
7. "Sair do modo suporte" registra `SAIDA` e volta ao painel. Fechar o navegador sem sair não gera `SAIDA`; o registro mostra a última tela aberta.

### 5.6 Acessos do suporte (Dono) e avisos

1. A tela lista as liberações (mais recente primeiro): situação (ativa, expirada, revogada), motivo, módulos, prazo, quem liberou e, ao abrir, o registro completo: entradas, telas, saídas e revogação, com data, hora e nome do Administrador.
2. A faixa "O suporte do HE pode ver … até …" aparece para todos os membros enquanto houver liberação ativa; para o Dono, com o link "Ver acessos do suporte".
3. E-mails ao Dono (best effort, sem bloquear): "Você liberou o acesso do suporte" e "O suporte do HE entrou no seu negócio".

### 5.7 Nova versão da Política e dos Termos (todos os usuários)

1. A versão vigente (`VERSAO_TERMOS`) muda. A Política de Privacidade passa a descrever o acesso de suporte (seções 2, 5 e 8) e os Termos de Uso, o papel do suporte.
2. Usuário com versão aceita diferente da vigente, ao entrar, vai para **"Atualizamos nossos termos"**: resumo do que mudou, links para os textos completos e "Li e aceito".
3. Até aceitar, o usuário só acessa essa tela, **Minha conta** (para exportar os dados ou excluir a conta) e Sair.
4. O aceite registra a versão e a data (`versaoTermosAceita`, `termosAceitosEm`). O Administrador também passa pelo aceite.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Sem liberação ativa (não expirada, não revogada) do negócio, a conta de Administrador não lê nenhum dado operacional dele, nem por página nem por ação. | Teste de integração: liberação inexistente, expirada, revogada e de outro negócio. |
| **INV-002** | No contexto de suporte, toda escrita é recusada no servidor (`acaoComPermissao` com criar/editar/excluir, `acaoDoDono`, troca de negócio, convites). | Teste chamando as ações direto com o contexto de suporte. |
| **INV-003** | No contexto de suporte, a matriz efetiva tem só *ver* nos módulos liberados; os demais ficam negados. | Teste unitário do contexto e de integração por módulo. |
| **INV-004** | Conta de Administrador nunca é membro de negócio: o script recusa contas com vínculo ou convite pendente; criar negócio e aceitar convite são recusados para ela. | Teste do script e das ações. |
| **INV-005** | O registro de auditoria só recebe INSERT (gatilho recusa UPDATE e DELETE); cada entrada, tela e saída em modo suporte gera o registro na mesma requisição, e sem o registro a página não é mostrada. | Teste do gatilho e de integração. |
| **INV-006** | No contexto de suporte, nome e contato de clientes e e-mails de membros saem do servidor já mascarados. | Teste unitário da máscara e de integração das consultas. |
| **INV-007** | Só o Dono cria e revoga liberação; prazo ∈ {1 h, 24 h, 3 dias, 7 dias}; no máximo uma liberação ativa por negócio. | Teste de integração (inclusive com duas liberações simultâneas). |
| **INV-008** | Usuário sem o aceite da versão vigente dos termos não acessa o app, exceto a tela de aceite, Minha conta e Sair. | Teste de integração das rotas. |
| **INV-009** | O painel do Administrador expõe apenas os metadados da seção 5.3. | Teste do formato da consulta (lista fechada de campos). |
| **INV-010** | A sessão da conta de Administrador não é aceita depois de 8 h da entrada. | Teste unitário com relógio controlado. |

---

## 7. Modelo de domínio envolvido

| Entidade | Mudança |
|---|---|
| `Usuario` | Novos campos: `administradorEm DateTime?` (marca de Administrador; null = usuário comum), `termosAceitosEm DateTime?` (data do último aceite; `versaoTermosAceita` já existe). |
| **`AcessoSuporte`** (nova) | `id`, `negocioId`, `liberadoPorId` (Dono), `motivo VarChar(300)`, `modulos` (lista de módulos), `criadoEm`, `expiraEm`, `revogadoEm?`, `revogadoPorId?`, `primeiraEntradaEm?`. Índice por `negocioId`. |
| **`RegistroSuporte`** (nova) | `id`, `negocioId?` (nulo nos eventos de papel), `acessoId?`, `usuarioId` (quem fez), `evento` (`PAPEL_CONCEDIDO`, `PAPEL_RETIRADO`, `LIBERACAO`, `REVOGACAO`, `ENTRADA`, `TELA`, `SAIDA`), `modulo?`, `descricao VarChar(200)`, `criadoEm`. Só inclusão (gatilho). |
| `Negocio`, `MembroNegocio`, `Cliente` | Só leitura; a máscara não altera os dados gravados. |

**Migração:** campos novos em `Usuario` e as duas tabelas; RLS ligado nas tabelas novas, sem policy (regra da migração de isolamento, SPEC-001); gatilho `he_negocio_imutavel` em `AcessoSuporte`; gatilho que recusa UPDATE e DELETE em `RegistroSuporte`; restrição `expiraEm > criadoEm`.

**Retenção (OPEN-010):** `AcessoSuporte` e `RegistroSuporte` são guardados por 5 anos, inclusive depois da exclusão da conta do Dono (o negócio encerrado mantém os registros, como os fiscais, até a data de `Negocio.eliminarApos` da SPEC-014). A eliminação física segue a mesma regra da SPEC-014: a data fica registrada e a eliminação em si é uma rotina futura, fora do MVP.

---

## 8. Impacto arquitetural

- **`src/lib/auth/contexto.ts`:** novo tipo de contexto `suporte` (`usuarioId`, `negocioId`, `acessoId`, matriz só de leitura), montado pela liberação ativa; `resolverContextoComPapel` passa a reconhecer a conta de Administrador e o cookie de suporte.
- **`src/lib/auth/acao.ts`:** `acaoComPermissao` e `acaoDoDono` recusam o contexto de suporte em qualquer escrita (INV-002); nova `acaoDoAdministrador` para as ações do painel.
- **`src/lib/db/cliente-do-negocio.ts`:** o `comNegocio` aceita o contexto de suporte; a máscara de dados pessoais fica nas consultas de clientes e membros.
- **`src/lib/suporte/`** (novo): domínio (prazos, máscara, situação da liberação), serviços (liberar, revogar, entrar, sair, registrar tela) e e-mails.
- **`src/app/admin/`** (novo): layout próprio, painel e ficha do negócio.
- **`src/app/(app)/configuracoes/acesso-do-suporte`** (ou dentro de Dados do negócio): liberação, revogação e registro.
- **`src/app/(app)/layout.tsx`:** faixas (modo suporte e liberação ativa) e redirecionamento para o novo aceite.
- **Tela de aceite** em `(publico)` ou `(app)`, com a nova `VERSAO_TERMOS`; textos em `docs/legal/` e nas páginas legais.
- **`scripts/admin.ts`:** conceder e retirar o papel; **`.github/workflows/administradores.yml`:** workflow manual que roda o script em homologação ou produção com o segredo do ambiente (5.1).
- **`src/lib/db/lgpd.ts`:** exportação com as liberações e o registro; exclusão revogando as liberações.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Conceder papel** (script) | e-mail, responsável | conta marcada | `ContaInexistente`, `ContaComVinculo` |
| **Listar negócios** (Administrador) | busca?, página | metadados (5.3) | `SemPermissao` |
| **Liberar acesso** (Dono) | motivo, módulos, prazo | liberação | `CampoInvalido`, `SomenteDono`, `NegocioEncerrado` |
| **Revogar acesso** (Dono) | liberação | liberação revogada | `SomenteDono`, `LiberacaoInexistente` |
| **Entrar em modo suporte** (Administrador) | negócio | contexto de suporte | `SemLiberacao`, `LiberacaoExpirada` |
| **Registrar tela** | contexto de suporte, módulo, descrição | registro | falha → a página não é mostrada |
| **Sair do modo suporte** | contexto de suporte | — | — |
| **Aceitar termos** | versão | aceite registrado | `VersaoDesatualizada` |
| **Mascarar** (domínio) | nome / contato / e-mail | texto mascarado | — |

**Alterações na baseline feitas junto com esta Spec (17/10/2026):** RF74–RF78, RN30–RN32 e RNF12 novos; RN01 e RNF02 complementados (`docs/requisitos/requisitos.md` e `requisitos_ears.md`); ADR-008 aceita (`docs/definicoes_arquitetura/adrs-he.md`). Os textos da Política e dos Termos são alterados na implementação (item 7 do escopo), junto com a nova `VERSAO_TERMOS`.

**Riscos registrados:**

- **Sem 2º fator nesta Spec (OPEN-002):** a conta de Administrador fica protegida só por senha e pela sessão de 8 h. Mitigação até a SPEC-019: poucas contas, concedidas por script; acesso só com liberação do Dono; somente leitura; tudo registrado e visível ao Dono. A SPEC-019 deve tratar a camada de segurança da autenticação como prioridade, antes de liberar a edição.
- **E-mail ao Dono:** enquanto o domínio do Resend não for verificado, só chega ao e-mail da conta Resend; o aviso no sistema é o canal garantido.

**Implementação (17/10/2026):**

- **Banco:** migração `20261017200000_suporte` — `Usuario.administradorEm` e `termosAceitosEm` (quem já tinha aceitado fica com a data do consentimento), tabelas `AcessoSuporte` e `RegistroSuporte`, enum `EventoSuporte`; CHECKs de motivo, módulos (1 a 6, só os da matriz), prazo (até 7 dias), revogação completa, negócio do evento e "conta excluída não é administradora"; gatilhos `he_negocio_imutavel`, `he_mesmo_negocio` (registro × liberação) e `he_somente_insercao` no registro; RLS ligado. O gatilho do cadastro grava também `termosAceitosEm`.
- **Domínio:** `src/lib/dominio/suporte.ts` (prazos, situação, matriz só de leitura, máscara, sessão de 8 h pelo `amr` do JWT, descrição das telas).
- **Contexto e autorização:** `resolverContextoDaRequisicao` (`src/lib/auth/contexto.ts`) lê a conta (papel de Administrador e versão dos termos) e, para o Administrador, a liberação apontada pelo cookie `he_suporte`, sempre conferida no banco; `autorizar` ganhou os níveis `conta` e `administrador` e os motivos `SomenteLeitura`, `ContaDeAdministrador`, `SomenteAdministrador`, `TermosPendentes` e `SessaoExpirada`; fábricas novas `acaoDaConta` e `acaoDoAdministrador`. O cliente do negócio recusa escritas no modo suporte (`SomenteLeituraNoSuporte`, segunda barreira).
- **Registro das telas:** na guarda da página (`exigirNivel`), uma vez por requisição, com o caminho gravado pelo proxy no cabeçalho `x-he-caminho` (sempre sobrescrito pelo proxy); detalhes de venda, item e conta trazem o número ou o nome.
- **Telas:** `/admin` e `/admin/negocios/[id]` (estrutura própria), `/negocio/suporte` (Dono), faixas em `src/components/suporte/faixas.tsx`, menu do suporte (`menuDoSuporte`), `/aceite-dos-termos`, rota `/auth/sessao-expirada`; aviso na página de convite para a conta de Administrador; Minha conta mostra a versão aceita e o aviso de pendência.
- **Script e workflow:** `scripts/admin.ts` (`npm run admin:conceder` / `admin:retirar`, e-mail mascarado na saída) e `.github/workflows/administradores.yml` (manual; entradas por variáveis de ambiente, nunca interpoladas no comando).
- **LGPD:** exportação com `acessos-suporte.csv` e `registros-suporte.csv`; a exclusão de conta revoga as liberações ativas dos negócios encerrados e retira o papel de Administrador.
- **Textos legais:** Política de Privacidade e Termos de Uso na versão 2026-10-17 (acesso de suporte), ainda como rascunho para a revisão do grupo; `VERSAO_TERMOS = "2026-10-17"`.

**Decisões de implementação e divergências registradas:**

- **Nenhuma Server Action no modo suporte**, nem as de leitura (a Spec pedia recusar as escritas): mais simples e mais seguro; as telas de leitura não usam Server Actions. A saída do modo suporte é uma ação do Administrador, permitida.
- **Conferência financeira ao abrir o Financeiro e o Painel** (SPEC-009) não roda no modo suporte, porque grava contas; a rotina diária completa. Exportação de relatórios recusada no modo suporte (5.5, item 6).
- **Primeira tela do modo suporte:** o primeiro módulo liberado (Painel, se o Dashboard estiver liberado; senão Vendas, Estoque, Catálogo, Financeiro, Calculadora).
- **Faixa do modo suporte no celular:** fixa no topo a partir de 768 px; no celular, o cabeçalho fixo mostra o nome do negócio em âmbar e a faixa fica no início da página (rola com ela), para não sobrepor o cabeçalho. Proposta: (2) aceitar na baseline.
- **Minha conta do Administrador** continua acessível (é a conta dele, não dados de negócio), dentro ou fora do modo suporte.
- **Máscara:** os dados de clientes aparecem só nas Vendas (histórico, detalhe e lista de clientes), onde a máscara é aplicada; e-mails de membros não aparecem em nenhuma tela de módulo. Campos de texto livre (motivo de ajuste de preço, descrições) não são mascarados.
- **Relatórios fora do modo suporte** (homologação, 18/10/2026): na implementação, o item "Relatórios" seguia a regra da SPEC-013 (aparece com Vendas *ou* Financeiro — ver) e surgiu no modo suporte com só Vendas e Estoque liberados. A equipe decidiu (1) corrigir a implementação: o menu do suporte não mostra Relatórios, e a página e a exportação recusam no modo suporte antes de registrar a tela ("Sem acesso"). Os mesmos dados de vendas continuam visíveis em Vendas.
- **Sessão de 8 h** sem o `amr` no JWT é tratada como vencida (falha fechada); coberta por testes unitários, não exercitada no navegador.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação | Verificação |
|---|---|---|
| RNF01 | Painel, ficha, gaveta de liberação, faixas, tela de acessos e tela de aceite em 390/768/1440, claro e escuro, sem rolagem horizontal. | Capturas. |
| RNF02 | Liberação conferida no servidor a cada requisição; contexto de suporte só de leitura. | INV-001, INV-002, INV-003. |
| RNF04 | Nova versão da política com aceite registrado; exportação com os registros do suporte. | INV-008, T10. |
| RNF05 | Registro de auditoria imutável. | INV-005. |
| RNF12 | Sessão do Administrador de 8 h. | INV-010. |

---

## 11. Critérios de aceitação

**CA-01 — Painel só com metadados.** Dada uma conta de Administrador, quando abre o painel, então vê a lista de negócios com os metadados da seção 5.3 e nenhum dado de vendas, valores, clientes ou estoque.

**CA-02 — Sem liberação, sem acesso.** Dado um negócio sem liberação ativa, quando o Administrador tenta entrar em modo suporte ou abrir uma página do negócio (inclusive com cookie forjado), então é recusado e nada é mostrado.

**CA-03 — Liberação pelo Dono.** Dado o Dono, quando libera Vendas e Estoque por 24 h com um motivo, então a faixa aparece para os membros, o registro mostra a liberação e o e-mail é enviado (quando disponível). Gerente e Colaborador não veem a opção.

**CA-04 — Modo suporte somente leitura.** Dada a liberação de Vendas e Estoque, quando o Administrador entra, então vê só Vendas e Estoque, sem botões de escrita, com a faixa de modo suporte; uma chamada direta a qualquer ação que grava é recusada.

**CA-05 — Dados mascarados.** Dada uma venda com cliente "Maria Silva", quando o Administrador a abre em modo suporte, então vê "M*** S***", e os e-mails da equipe aparecem mascarados.

**CA-06 — Registro de cada tela.** Dado o modo suporte, quando o Administrador abre o histórico e a venda nº 15 e sai, então o Dono vê em "Acessos do suporte": entrada, as duas telas e a saída, com data, hora e nome do Administrador.

**CA-07 — Revogação e expiração.** Dado o Administrador em modo suporte, quando o Dono revoga (ou o prazo acaba), então a próxima requisição do Administrador é recusada e ele volta ao painel.

**CA-08 — Conta exclusiva.** Dada uma conta com vínculo a um negócio, quando a equipe roda `admin:conceder`, então o script recusa; e uma conta de Administrador não consegue criar negócio nem aceitar convite.

**CA-09 — Registro imutável.** Dado um registro de auditoria, quando se tenta alterá-lo ou apagá-lo no banco, então a operação é recusada.

**CA-10 — Novo aceite.** Dado um usuário que aceitou a versão anterior dos termos, quando entra, então vê "Atualizamos nossos termos" e só acessa o app depois de aceitar; até lá, consegue abrir Minha conta e sair.

**CA-11 — Sessão do Administrador.** Dada uma sessão de Administrador com mais de 8 h, então ela é recusada e o login é pedido de novo.

**CA-12 — Visual.** Dadas as telas novas em 390/768/1440, claro e escuro, então seguem o design system, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Máscara de nome, contato e e-mail | Unitário | INV-006 |
| T02 | Situação da liberação (ativa, expirada, revogada), prazos válidos, matriz só de leitura | Unitário | INV-003, INV-007 |
| T03 | Sessão de Administrador com mais de 8 h | Unitário | INV-010, CA-11 |
| T04 | Script conceder/retirar: conta com vínculo, convite pendente, conta inexistente | Integração | INV-004, CA-08 |
| T05 | Painel: lista fechada de campos; usuário comum recusado | Integração | INV-009, CA-01 |
| T06 | Leitura sem liberação, com liberação expirada, revogada e de outro negócio | Integração | INV-001, CA-02 |
| T07 | Escritas com contexto de suporte recusadas (todas as ações que gravam) | Integração | INV-002, CA-04 |
| T08 | Liberar e revogar: só o Dono, substituição da ativa, negócio encerrado | Integração | INV-007, CA-03, CA-07 |
| T09 | Registro: gatilho recusa UPDATE/DELETE; entrada, tela e saída registradas | Integração | INV-005, CA-06, CA-09 |
| T10 | Exportação com liberações e registro; exclusão de conta revoga liberações | Integração | RNF04, RN27 |
| T11 | Novo aceite: rotas bloqueadas e liberadas, aceite registrado | Integração | INV-008, CA-10 |
| T12 | Telas em 390/768/1440, claro e escuro | Manual com captura | CA-12 |
| T13 | Fluxo completo na homologação: liberar, entrar, navegar, revogar, conferir o registro | Manual (uma vez) | CA-01 a CA-07 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 17/10/2026, em entrevista, pela opção recomendada, com a OPEN-002 adiada a pedido da equipe:

| ID | Decisão |
|---|---|
| **OPEN-001** — Como uma conta vira Administrador | **Script + conta exclusiva**: a equipe roda um comando no banco; nenhuma tela concede o papel; a conta de Administrador não pode ser membro de negócio (para os próprios negócios, a pessoa usa outra conta). |
| **OPEN-002** — 2º fator do Administrador | **Adiado para a SPEC-019.** Nesta Spec, senha + sessão de 8 h, com o risco registrado (seção 9). O foco desta Spec é a funcionalidade; a SPEC-019 deve destacar a **camada de segurança da autenticação** (2º fator TOTP) antes de liberar a edição. |
| **OPEN-003** — O que o painel mostra | **Metadados + contato do Dono**: nome, regime, plano, criado em, membros, situação, nome e e-mail do Dono e situação do acesso de suporte. Nada de vendas, valores, clientes ou estoque. |
| **OPEN-004** — Quem libera | **Só o Dono.** Gerente e Colaborador pedem ao Dono. |
| **OPEN-005** — Escopo da liberação | **Módulos escolhidos pelo Dono**, com a ação *ver* da matriz. |
| **OPEN-006** — Prazo | **O Dono escolhe: 1 h, 24 h (padrão), 3 dias ou 7 dias**; expira sozinha e pode ser revogada a qualquer momento. |
| **OPEN-007** — Dados pessoais | **Mascarar sempre** nome e contato dos clientes e e-mails dos membros; nomes dos membros aparecem. |
| **OPEN-008** — O que o registro guarda | **Cada tela aberta + liberação, entrada, saída e revogação.** |
| **OPEN-009** — Aviso ao Dono | **No sistema + e-mail**: faixa e tela "Acessos do suporte"; e-mail ao liberar e na primeira entrada, sem bloquear se o envio falhar. |
| **OPEN-010** — Retenção do registro | **5 anos**, como os registros fiscais (RN27); mantido após a exclusão de conta, já sem identificação. |
| **OPEN-011** — Nova versão da Política e dos Termos | **Novo aceite obrigatório** no próximo acesso, com resumo do que mudou; até aceitar, só Minha conta e Sair. |
| **OPEN-012** — Ações de plataforma | **Todas na SPEC-019** (suspender/reativar negócio, trocar plano, edição, emergência); a SPEC-018 é só leitura. |

---

## 14. Definition of Done da Spec

A SPEC-018 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-12) estiverem implementados — por testes, no navegador (build local) e na homologação (T13, 18/10/2026); o e-mail ao Dono depende do domínio próprio (ADR-009);
- [x] todos os invariantes (INV-001 a INV-010) estiverem preservados;
- [x] os testes derivados (T01 a T13) estiverem aprovados, com o CI verde no PR — T01 a T11 automatizados, T12 com capturas, T13 na homologação (18/10/2026);
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF05, RNF12) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-012 tiverem sido decididas e registradas (17/10/2026), com a baseline ajustada (RF74–RF78, RN30–RN32, RN01, RNF02, RNF12, ADR-008);
- [x] a Política de Privacidade e os Termos de Uso estiverem atualizados na nova versão (2026-10-17; rascunho, com a revisão do grupo pendente);
- [ ] não existir divergência conhecida entre a implementação e esta Spec — a da faixa do modo suporte no celular (seção 9) aguarda a equipe;
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 9).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
