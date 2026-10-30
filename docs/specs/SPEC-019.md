# SPEC-019 — Suporte com edição, emergência, ações de plataforma e 2º fator

> **Status:** ✅ **Aprovada em 28/10/2026**, a implementar. As questões em aberto foram decididas pela equipe em entrevista (seção 13), pela opção recomendada, com quatro ajustes da equipe (prazos de 12 h e duas pessoas também na troca de plano):
> - **2º fator obrigatório** para o Administrador, pelo MFA TOTP do Supabase Auth, com dois autenticadores, redefinição pelo workflow e o código pedido de novo antes das ações críticas;
> - **correções em modo suporte** só nos módulos que o Dono marcar como "ver e corrigir", por até **12 h**, e só das ações de uma **lista fechada** que o Dono consegue **desfazer** em até 30 dias;
> - **acesso de emergência** sem liberação do Dono só com **duas pessoas** (o pedido expira em **12 h**), somente leitura, por até 4 h, com **aviso na hora ao Dono**: não existe acesso secreto no HE;
> - **ações de plataforma:** suspender e reativar negócio (um Administrador; o negócio fica somente leitura) e trocar plano (**duas pessoas**).
>
> A troca do e-mail do Dono, a recuperação da conta e a transferência do negócio ficam para a Spec da pendência "Encerrar negócio e liberar o CNPJ" do Mapa, com a **troca do e-mail como prioridade** (decisão da equipe, 28/10/2026). A baseline foi ajustada: RF73, RF74, RF75, RF76, RF77, RN30, RN31, RN32 e RNF12 alterados; RF82 a RF86 e RN37 a RN39 novos; ADR-008 ampliada. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir da divisão de escopo da [SPEC-018](SPEC-018.md) (17/10/2026).
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-018](SPEC-018.md) (autenticação do Administrador, liberação, modo suporte, registro e painel), [SPEC-013](SPEC-013.md) (troca de plano também pela plataforma), [SPEC-009](SPEC-009.md) (a rotina diária pula negócio suspenso) e [SPEC-014](SPEC-014.md) (exportação com os eventos novos).
> - **Usa:** [SPEC-002](SPEC-002.md) (sessão e Supabase Auth), [SPEC-005](SPEC-005.md) (matriz e ações), [SPEC-006](SPEC-006.md), [SPEC-007](SPEC-007.md), [SPEC-009](SPEC-009.md), [SPEC-010](SPEC-010.md) e [SPEC-020](SPEC-020.md) (ações da lista de correções), [SPEC-016](SPEC-016.md) (componentes) e [SPEC-022](SPEC-022.md) (máscara dos clientes).
>
> **Ajuste pela [SPEC-024](SPEC-024.md) (aprovada em 30/10/2026):** a correção "Editar item" (5.4) inclui o código interno do item. O desfazer volta o código anterior e é recusado se ele estiver em uso por outro item ativo.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-019 |
| **Nome** | Suporte com edição, emergência, ações de plataforma e 2º fator |
| **Objetivo** | Proteger a conta de Administrador com um **2º fator obrigatório** e ampliar o suporte da SPEC-018 com quatro capacidades controladas: **correções** autorizadas pelo Dono, com registro de antes e depois e a opção de desfazer; **acesso de emergência** sem liberação, com duas pessoas e aviso imediato; **suspender e reativar** um negócio; e **trocar o plano** pela plataforma, com duas pessoas. |
| **Valor entregue** | O suporte passa a resolver o que o usuário pede ("corrija o custo deste item", "lancei a entrada em dobro"), sem pedir senha e sem tirar o Dono do controle. A equipe ganha meios de reagir a incidentes (suspender, ler em emergência) que deixam rastro completo e nunca ficam escondidos do Dono. A conta mais poderosa da plataforma deixa de depender só de uma senha. |

### Princípios da Spec

1. **2º fator antes de tudo.** Nenhuma tela ou ação de Administrador funciona sem o 2º fator verificado na sessão. As ações críticas pedem o código de novo.
2. **Lista fechada.** O suporte só corrige o que está numa lista explícita (seção 5.4). Toda ação nova do sistema nasce **proibida** no modo suporte; entrar na lista exige uma Spec.
3. **O suporte só faz o que o Dono pode desfazer.** As ações da lista são as que têm operação de compensação. Nada é apagado: desfazer é uma operação nova, registrada.
4. **Nada sem rastro.** Cada correção grava o antes e o depois **na mesma transação**. Se o registro falhar, a correção não acontece.
5. **Sem acesso secreto.** Todo acesso de emergência aparece para o Dono desde o pedido. Uma conta de Administrador roubada ou mal-intencionada não tem como ler um negócio sem que o Dono veja.
6. **Duas pessoas para o que o Dono não autorizou.** O acesso de emergência e a troca de plano exigem uma segunda conta de Administrador que aprove. Com uma conta só, essas ações não existem (falha fechada).
7. **Dados pessoais dos clientes ficam fora.** Em nenhum modo o Administrador vê sem máscara ou altera os dados dos clientes (SPEC-022).

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF74** | **Alterado:** a conta de Administrador exige o 2º fator; o painel ganha os pedidos pendentes, as emergências e as ações de plataforma, ainda só com metadados dos negócios. |
| | **RF75** | **Alterado:** a liberação define, por módulo, "ver" ou "ver e corrigir"; com correção, o prazo é de 1 h ou 12 h. |
| | **RF76** | **Alterado:** no modo suporte, o Administrador também corrige, nos módulos marcados para correção, as ações da lista fechada (RN37). |
| | **RF77** | **Alterado:** o registro passa a guardar também as correções (antes e depois), os desfazimentos, os pedidos e acessos de emergência, as suspensões, as trocas de plano pela plataforma e os eventos do 2º fator. |
| | **RF73** | **Complementado:** o plano também pode ser trocado pela plataforma, com duas pessoas (RF86). |
| | **RF82** (novo) | 2º fator TOTP obrigatório para o Administrador, com dois autenticadores, reconfirmação nas ações críticas e redefinição pelo workflow. |
| | **RF83** (novo) | Correções em modo suporte, com registro de antes e depois e **desfazer** pelo Dono em até 30 dias. |
| | **RF84** (novo) | Acesso de emergência sem liberação: pedido com motivo e referência, aprovação por outro Administrador, somente leitura, até 4 h, aviso imediato ao Dono. |
| | **RF85** (novo) | Suspender e reativar negócio pela plataforma. |
| | **RF86** (novo) | Trocar o plano de um negócio pela plataforma, com duas pessoas. |
| **RN** | **RN30** | **Alterada:** com a liberação, o Administrador lê os módulos liberados e corrige só onde o Dono permitiu; sem liberação, só pelo acesso de emergência (RN38). |
| | **RN31** | **Alterada:** com correção, o prazo é de 1 h ou 12 h. |
| | **RN32** | **Estendida** aos eventos novos (imutáveis, 5 anos). |
| | **RN37** (nova) | Lista fechada de correções e o que o suporte nunca altera. |
| | **RN38** (nova) | Regras do acesso de emergência. |
| | **RN39** (nova) | Negócio suspenso: somente leitura, exportação mantida, nada apagado. |
| | RN18, RN27 | Mantidas: trocar o plano não apaga dados; negócio encerrado fica fora das ações desta Spec. |
| **RNF** | **RNF12** | **Alterado:** 2º fator obrigatório (cumprido aqui), reconfirmação em até 10 min nas ações críticas e as 8 h contadas a partir do login com senha. |
| | RNF02 | O isolamento continua: a emergência é a segunda exceção estreita, conferida no servidor a cada requisição. |
| | RNF03 | Nenhum segredo do 2º fator fica no banco do HE: o Supabase Auth guarda os fatores. |
| | RNF04 | Nova versão da Política e dos Termos (correções, emergência, suspensão), com novo aceite; exportação com os eventos novos. |
| | RNF05 | Correções, desfazimentos e ações de plataforma no registro imutável. |
| **Decisões arquiteturais** | **ADR-008** | **Ampliada** (nota da SPEC-019): 2º fator, correções, emergência com duas pessoas e ações de plataforma. |
| | ADR-003 | Mantida: o 2º fator usa o MFA do próprio Supabase Auth; a autorização continua no servidor. |
| **Caso de uso / fluxo** | Novos: UC-A4 Cadastrar e usar o 2º fator; UC-A5 Corrigir em modo suporte; UC-A6 Desfazer correção; UC-A7 Pedir e aprovar emergência; UC-A8 Suspender e reativar; UC-A9 Trocar plano pela plataforma | Ver seção 5. |
| **Entidades** | Usuario (campo novo), AcessoSuporte (campos novos), **PedidoPlataforma** (nova), RegistroSuporte (campos e eventos novos), Negocio (campos novos), HistoricoPlano (campos novos) | Ver seção 7. |
| **Pendências** | Pendência "Encerrar negócio e liberar o CNPJ" do Mapa | A troca do e-mail do Dono fica para a Spec dessa pendência, **como prioridade** (OPEN-010). |

---

## 3. Escopo

### Incluído

1. **2º fator do Administrador** (OPEN-001 a OPEN-003):
   - TOTP pelo MFA do Supabase Auth, obrigatório a partir do próximo login, sem carência;
   - pedido de um segundo autenticador e redefinição pelo workflow "Administradores", rodado por outra pessoa da equipe;
   - o código pedido de novo, com validade de 10 min, antes das ações críticas;
   - a sessão de 8 h contada a partir do login com senha.
2. **Liberação com correção** (OPEN-004): na gaveta do Dono, cada módulo marcado fica em "ver" (padrão) ou "ver e corrigir", ligado um a um; com correção, o prazo é de 1 h ou 12 h.
3. **Correções em modo suporte** (OPEN-005): só as ações da lista fechada (5.4), nos módulos marcados para correção, com o antes e o depois gravados na mesma transação.
4. **Desfazer pelo Dono** (OPEN-006): em até 30 dias, por uma operação de compensação, em "Acessos do suporte".
5. **Acesso de emergência** (OPEN-007 a OPEN-010): pedido com motivo e referência, aprovação por outra conta de Administrador, somente leitura com máscara, até 4 h, aviso imediato ao Dono, que pode encerrar.
6. **Suspender e reativar negócio** (OPEN-011, OPEN-012): um Administrador, com motivo; o negócio fica somente leitura, com a exportação dos dados mantida.
7. **Trocar plano pela plataforma** (OPEN-014): gratuito ↔ pago, com as regras do RF73, motivo e duas pessoas.
8. **Painel do Administrador:**
   - situação "Suspenso" e o filtro;
   - pedidos pendentes (emergência e plano) para aprovar ou recusar;
   - histórico das emergências, visível a todas as contas de Administrador;
   - lista das contas de Administrador;
   - ações na ficha do negócio.
9. **Transparência para o negócio:**
   - faixas de correção, emergência e suspensão;
   - "Acessos do suporte" com as correções (antes, depois e "Desfazer"), as emergências, as suspensões e as trocas de plano;
   - e-mails ao Dono, quando o domínio existir (ADR-009).
10. **Política de Privacidade e Termos de Uso** em nova versão, com novo aceite (RF78).
11. **LGPD:** a exportação inclui os eventos e pedidos novos.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| **Trocar o e-mail do Dono**, recuperar a conta e transferir o negócio | Spec da pendência "Encerrar negócio e liberar o CNPJ", com a **troca do e-mail como prioridade** e verificação de identidade própria (OPEN-010) |
| Corrigir vendas (registrar, cancelar, trocar, ajustar), clientes, equipe, configurações, plano pelo Dono, acesso do suporte, LGPD e exportações | **Nunca** pelo suporte (RN37) |
| Correções no acesso de emergência | **Nunca** (OPEN-009) |
| Adiar o aviso ao Dono por sigilo judicial | Fora (OPEN-008): a equipe trata fora do produto, com orientação jurídica, e não usa o acesso de emergência |
| Reenviar convite pelo painel | Fora (OPEN-013): o Dono reenvia pela Equipe; o e-mail depende do domínio |
| Emergência e ações de plataforma em negócio encerrado (RN27) | Fora: sem membros a avisar; um pedido judicial é tratado fora do produto |
| Encerrar negócio e liberar o CNPJ | Pendência do Mapa com esse nome |
| Códigos de recuperação do 2º fator | Evolução: a API do Supabase ainda é experimental (OPEN-002) |
| Chave de acesso (passkey) | Evolução (OPEN-001) |
| 2º fator para os usuários dos negócios | Evolução |

---

## 4. Dependências

- **Specs anteriores:**
  - SPEC-018: conta de Administrador, painel, liberação, contexto de suporte, registro, máscara, faixas e o workflow "Administradores";
  - SPEC-002: sessão e Supabase Auth (`getClaims`);
  - SPEC-005: matriz módulo × ação e as fábricas de ação;
  - SPEC-006, SPEC-007, SPEC-009, SPEC-010 e SPEC-020: as ações da lista de correções;
  - SPEC-013: troca de plano e o histórico de planos;
  - SPEC-014: exportação e exclusão de conta;
  - SPEC-016: gaveta, diálogo de confirmação e selos;
  - SPEC-022: máscara dos dados dos clientes.
- **Decisões arquiteturais:** ADR-003 (Supabase Auth e autorização no servidor) e ADR-008 (ampliada).
- **Pré-requisitos externos:**
  - **MFA TOTP habilitado** no Supabase Auth de cada ambiente (*Authentication → Multi-Factor*). Conferir no painel de homologação antes de implementar.
  - **Chave secreta do Supabase** de cada ambiente como segredo do ambiente no GitHub, só para a ação "redefinir 2º fator" do workflow.
  - **Pelo menos duas contas de Administrador, de pessoas diferentes**, para o acesso de emergência e a troca de plano. Na homologação, basta criar e conceder duas contas exclusivas (seção 12, T17).
  - **Domínio próprio** (ADR-009): só para os e-mails. Sem ele, os avisos no sistema cobrem tudo. O 2º fator **não** depende de domínio.

---

## 5. Comportamento esperado

### 5.1 2º fator do Administrador (OPEN-001 a OPEN-003)

**Como funciona:** o Administrador cadastra o HE num aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password etc.) lendo um QR code. O aplicativo passa a gerar um código de 6 dígitos a cada 30 s, só com o segredo do QR code e o relógio, sem e-mail, SMS nem internet. O HE usa o MFA TOTP do Supabase Auth:
- `mfa.enroll()` gera o QR code e o segredo;
- `mfa.challenge()` e `mfa.verify()` conferem o código;
- depois da verificação, o JWT da sessão passa a ter `aal: "aal2"`.

O HE não guarda o segredo.

**Primeiro acesso (cadastro):**
1. Depois da senha, a conta de Administrador sem fator verificado só vê a tela **"Configure o 2º fator"**, com o QR code, o segredo em texto (para digitar, se a câmera falhar) e o campo do código.
2. Com o código certo, o fator fica ativo e a sessão sobe para `aal2`.
3. Em seguida, a tela pede um **segundo autenticador** (outro aparelho ou um gerenciador de senhas). Dá para adiar, mas o painel mostra um aviso permanente enquanto houver só um.
4. O nome do emissor no aplicativo identifica o ambiente ("Health Enterprise" ou "HE Homologação").

**Login seguinte:** senha → **"Digite o código do autenticador"** → aceite dos termos, se houver versão nova → painel.

**Regras:**

| Situação | Comportamento |
|---|---|
| Conta de Administrador sem `aal2` na sessão | Só as telas do 2º fator e "Sair". Painel, ficha, modo suporte, emergência e ações recusam (`SegundoFatorPendente`) e levam à tela do código. |
| Sessão de 8 h (RNF12) | Contada a partir do **login com senha** (o método `password` do `amr`), e não do código. Sem esse horário, a sessão é tratada como vencida (falha fechada). |
| **Reconfirmação** nas ações críticas (OPEN-003) | O servidor exige um código verificado nos **últimos 10 min** (o método `totp` do `amr`). Sem isso, um diálogo pede o código e a ação continua. Valem como críticas: pedir, aprovar ou recusar emergência; suspender ou reativar; pedir, aprovar ou recusar troca de plano; entrar em modo suporte numa liberação com correção; remover um autenticador. |
| Muitas tentativas erradas | O limite do Supabase Auth vale; a tela mostra "Muitas tentativas. Aguarde alguns minutos." |
| Autenticadores | Em Minha conta: lista (nome e data), cadastrar outro e remover (com reconfirmação). Não é possível remover o último. |
| **Perdeu todos os autenticadores** (OPEN-002) | Outra pessoa da equipe roda o workflow "Administradores" com a ação **`redefinir-2fator`**. Ela apaga os fatores pela API de administração do Supabase Auth, grava `Usuario.segundoFatorRedefinidoEm` e registra `SEGUNDO_FATOR_REDEFINIDO`. Sessões abertas antes disso deixam de valer, e o próximo login pede o cadastro de novo. |

Os eventos `SEGUNDO_FATOR_CADASTRADO`, `SEGUNDO_FATOR_REMOVIDO` e `SEGUNDO_FATOR_REDEFINIDO` entram no registro, sem negócio associado, como os eventos de papel.

### 5.2 Liberação com correção (Dono — OPEN-004)

1. Na gaveta "Liberar acesso ao suporte" (SPEC-018, 5.4), cada módulo marcado ganha a escolha **"Ver"** (padrão) ou **"Ver e corrigir"**. Só Catálogo, Estoque, Calculadora e Financeiro têm correções (5.4). Vendas e Dashboard ficam só em "Ver".
2. Ao ligar "Ver e corrigir", a gaveta mostra o que o suporte poderá alterar naquele módulo e o texto: "Cada correção aparece em *Acessos do suporte* na hora, com o antes e o depois, e você pode desfazê-la em até 30 dias."
3. Com algum módulo em correção, o prazo passa a ser **1 h (padrão) ou 12 h**. Os prazos maiores (24 h, 3 dias, 7 dias) continuam valendo só para a liberação de leitura.
4. O servidor confere: módulos com correção ⊆ módulos marcados ∩ módulos corrigíveis; prazo de até 12 h com correção. Senão, recusa com `CampoInvalido`.
5. A faixa para os membros diz: "O suporte do HE pode ver {módulos} e corrigir {módulos} até {data e hora}."
6. Mudar o nível exige uma nova liberação, que substitui a anterior (RN31).

### 5.3 Corrigir em modo suporte (Administrador)

1. Ao entrar em modo suporte numa liberação com correção, o código é pedido de novo (5.1). Essa reconfirmação vale para a entrada até a saída, a expiração ou a revogação.
2. A faixa do modo suporte mostra "pode corrigir: {módulos}". Nos módulos marcados, aparecem **só os botões das ações da lista** (5.4). Nos outros módulos, tudo continua somente leitura.
3. A correção usa **a mesma ação e as mesmas validações** de um membro; não há atalho. O autor gravado é o próprio Administrador, em nome próprio (RN30), e os históricos mostram "{nome} (suporte do HE)": preço, movimentações, lançamentos e contas.
4. Na **mesma transação** da correção, o servidor grava o evento `CORRECAO` no registro, com:
   - o módulo, a ação e o registro afetado (nome do item, número da conta etc.);
   - o **antes e o depois** só dos campos alterados, que nunca contêm dados pessoais de clientes.

   Se o registro falhar, a correção é desfeita (INV-004).
5. O Dono vê a correção em "Acessos do suporte" na hora. O e-mail ao Dono (com domínio) é um resumo na saída do modo suporte: "O suporte fez N correções".

### 5.4 Lista fechada de correções (OPEN-005, RN37)

| Módulo | Ação permitida ao suporte | Como o Dono desfaz |
|---|---|---|
| Catálogo | Editar item: nome, código interno (SPEC-024), custo, categoria, subcategoria, unidade, NCM, comissão e materiais | Volta os campos anteriores; se o código anterior estiver em uso por outro item ativo, o desfazer é recusado |
| | Definir preço (manual) | Novo registro de preço com o valor anterior (o histórico mantém tudo) |
| | Arquivar ou reativar item | A operação inversa |
| | Criar subcategoria | Exclui a subcategoria, se nenhum item a usa |
| | Renomear subcategoria | Volta o nome anterior |
| Estoque | Registrar entrada | Saída manual da mesma quantidade (motivo "Outro", com a observação "Correção do suporte desfeita") |
| | Registrar saída manual | Entrada da mesma quantidade |
| | Definir estoque mínimo | Volta o valor anterior |
| Calculadora | Salvar parâmetros de precificação | Volta os valores anteriores |
| | Confirmar preço | Novo registro de preço com o valor anterior |
| Financeiro | Lançamento avulso | Estorno do lançamento |
| | Criar conta a pagar ou a receber | Cancela a conta, se não tiver pagamento |
| | Editar conta | Volta os campos anteriores, se não houve pagamento depois |
| | Criar despesa fixa | Desativa a despesa |
| | Editar despesa fixa | Volta os campos anteriores |
| | Ativar ou desativar despesa fixa | A operação inversa |

**O suporte nunca faz (RN37), em nenhum modo:**
- **Vendas:** registrar, cancelar, trocar e ajustar.
- **Clientes:** cadastrar, editar, excluir, anonimizar e consultar CEP ou CNPJ.
- **Equipe e permissões:** convites, papéis, permissões e remoção.
- **Configurações:** Dados do negócio, CNPJ e regime, "Emito nota fiscal de produtos", dias de cobertura, plano pelo Dono e o próprio acesso do suporte.
- **LGPD:** exportar dados e excluir conta. Também não usa Relatórios nem exportações.
- **Ações sem compensação segura:** criar item, excluir subcategoria, estorno, pagamento de conta, cancelar conta e saldo inicial.

A lista vive num único lugar do código (5.4 ↔ `CORRECOES_PERMITIDAS`). Uma ação fora dela é recusada no contexto de suporte (`ForaDaListaDeCorrecoes`), mesmo com o módulo em correção.

### 5.5 Desfazer uma correção (Dono — OPEN-006)

1. Em "Acessos do suporte", cada correção mostra o antes, o depois e o botão **"Desfazer"** (diálogo de confirmação), por **até 30 dias** depois da correção. O botão vale mesmo depois de a liberação acabar.
2. Desfazer executa a compensação da tabela 5.4, **em nome do Dono**, pelas mesmas validações. Grava o evento `CORRECAO_DESFEITA`, ligado à correção.
3. Nada é apagado: o histórico mostra a correção e o desfazer.
4. Recusas, com a explicação na tela:

   | Situação | Mensagem |
   |---|---|
   | O registro mudou depois da correção (o estado atual difere do "depois" gravado) | "{Item} mudou depois da correção. Ajuste direto em {módulo}." |
   | Saldo de estoque insuficiente para a compensação | "O estoque atual não permite desfazer: saldo {x}." |
   | A regra atual não aceita o valor anterior (ex.: NCM fora da tabela vigente) | A mensagem da validação do módulo. |
   | Passou de 30 dias ou já foi desfeita | "Esta correção não pode mais ser desfeita." |

5. Só o Dono desfaz. Cada correção é desfeita no máximo uma vez, e não existe "refazer".

### 5.6 Acesso de emergência (OPEN-007 a OPEN-010, RN38)

**Quando:** só quando o negócio **não** tem liberação ativa do Dono. Com liberação, o caminho é ela.

**Pedir (Administrador A):**
1. Na ficha do negócio, "Solicitar acesso de emergência", com o código reconfirmado.
2. Campos:
   - **motivo**, de uma lista fechada:
     - ordem judicial ou requisição de autoridade competente;
     - incidente de segurança ou falha que afeta os dados do negócio;
     - Dono sem acesso, a pedido de um membro;
   - **referência**, obrigatória, até 120 caracteres: número do processo ou ofício, número do incidente, ou o membro que pediu e por qual canal;
   - **justificativa**, até 500 caracteres;
   - **módulos**, ao menos um;
   - **prazo:** 1 h, 2 h ou 4 h.
3. O pedido fica **pendente por até 12 h** e aparece no painel de todas as contas de Administrador. Quem pediu pode cancelar.
4. **Desde o pedido, o Dono vê** em "Acessos do suporte": "Pedido de acesso de emergência: {motivo}, {referência}, aguardando aprovação" (INV-007).

**Aprovar ou recusar (Administrador B):**
- Só outra conta de Administrador, com o código reconfirmado. **Ninguém aprova o próprio pedido** (INV-006).
- A recusa exige um motivo.
- Sem resposta em 12 h, o pedido expira.

**Durante o acesso (só o Administrador A entra):**
- Começa na aprovação e dura o prazo pedido, **sem renovação**. Para continuar, é preciso um novo pedido.
- É **somente leitura**, nos módulos pedidos, com a **máscara** dos dados pessoais (SPEC-018 e SPEC-022), **sem exportação** e com cada tela registrada, como o modo suporte. Nenhuma correção é aceita (OPEN-009).
- **Faixas:**
  - para o Administrador, uma faixa vermelha: "Emergência · {negócio} · somente leitura · até {hora} · {motivo}";
  - para todos os membros do negócio, uma faixa vermelha: "Acesso de emergência do suporte do HE até {hora}: {motivo}". Para o Dono, a faixa traz "Ver detalhes" e **"Encerrar acesso"**.
- **O Dono pode encerrar a qualquer momento** (diálogo de confirmação). A próxima requisição do Administrador é recusada e ele volta ao painel.
- E-mail ao Dono no pedido e na aprovação (com domínio). Falha no envio não bloqueia nada.

**Depois:**
- Ao terminar (saída, expiração ou encerramento), quem pediu registra o **resultado** (até 1000 caracteres), visível ao Dono e às contas de Administrador.
- Sem o resultado registrado, essa conta não faz um novo pedido de emergência.

**Limites:**
- No máximo um pedido pendente ou acesso de emergência ativo por negócio.
- Não vale para negócio encerrado. Vale para negócio suspenso, para investigar um incidente.
- Com uma conta só de Administrador, não há como aprovar, e o acesso de emergência não existe (falha fechada).

**Dono sem acesso** (OPEN-010): a emergência serve para diagnosticar, somente leitura, a pedido de um membro. Trocar o e-mail do Dono, recuperar a conta e transferir o negócio ficam para a Spec da pendência "Encerrar negócio e liberar o CNPJ", com a troca do e-mail **como prioridade**.

### 5.7 Suspender e reativar negócio (OPEN-011, OPEN-012, RN39)

**Suspender:**
- Feito por **um Administrador**, com o código reconfirmado.
- **Motivo**, de uma lista fechada: pedido do Dono; uso indevido segundo os Termos; incidente de segurança; ordem judicial. Mais uma **descrição** obrigatória, até 500 caracteres.
- Negócio encerrado não pode ser suspenso.

**Efeitos da suspensão:**

| Para | Efeito |
|---|---|
| Membros | Entram e **veem tudo**. Uma faixa diz "Negócio suspenso pelo HE desde {data}: {motivo}. Fale com o suporte." Toda escrita nos módulos e em Configurações é recusada (`NegocioSuspenso`). |
| Direitos do titular | Exportar os dados e excluir a conta continuam disponíveis (SPEC-014). A exclusão mantém os registros do negócio, como a RN27 já prevê. |
| Acesso do suporte | O Dono continua podendo liberar e revogar, para pedir ajuda. Correções são recusadas enquanto durar a suspensão. A emergência continua possível. |
| Rotina diária (SPEC-009) | Pula o negócio. Ao reativar, a conferência ao abrir o Financeiro gera as contas do período. |
| Dados | Nada é apagado nem alterado. |
| Avisos | O Dono vê na hora, no sistema e em "Acessos do suporte", e por e-mail quando houver domínio. |

**Reativar:** um Administrador, com o código reconfirmado e uma descrição. A faixa some e a escrita volta.

O painel mostra a situação "Suspenso" e tem o filtro.

### 5.8 Trocar o plano pela plataforma (OPEN-014)

1. O Administrador A pede, com o código reconfirmado: plano de destino; motivo (**cortesia**, **correção** ou **teste**); descrição, até 300 caracteres.
2. O pedido fica **pendente por até 12 h**, visível a todas as contas de Administrador.
3. Outra conta de Administrador (B), com o código reconfirmado, aprova ou recusa (com motivo). **Ninguém aprova o próprio pedido.**
4. Na aprovação, o plano muda pela mesma função da troca do Dono:
   - valem as regras do RF73: nada é apagado (RN18), e os colaboradores além do limite perdem o acesso ao voltar ao gratuito;
   - o `HistoricoPlano` registra a troca com o motivo e o pedido, marcada como "pela plataforma".
5. O Dono é avisado no sistema, na tela Plano e em "Acessos do suporte", e por e-mail quando houver domínio.
6. Não vale para negócio encerrado. Vale para negócio suspenso.
7. Com a cobrança real (SPEC-015), a troca pela plataforma vira **cortesia sem cobrança**.

### 5.9 Painel do Administrador

1. **Lista de negócios** (SPEC-018, 5.3): ganha a situação "Suspenso" e o filtro. Continua só com metadados (INV-009 da SPEC-018).
2. **Pedidos pendentes:** emergência e plano. Nos pedidos de outras contas, os botões "Aprovar" e "Recusar". Nos próprios, "Aguardando outra pessoa" e "Cancelar".
3. **Emergências:** o histórico de todas as contas, com o motivo, a referência, quem pediu, quem aprovou, os horários e o resultado.
4. **Administradores:** a lista das contas com o papel, o nome, desde quando e quantos autenticadores têm, para que a equipe perceba uma conta a mais.
5. **Ficha do negócio:**
   - "Entrar em modo suporte", como já existe;
   - "Solicitar acesso de emergência", só sem liberação ativa;
   - "Suspender" ou "Reativar";
   - "Trocar plano".

### 5.10 Transparência para o Dono

- **"Acessos do suporte"** (SPEC-018, 5.6) passa a mostrar, em ordem cronológica:
  - liberações, com o nível de cada módulo;
  - correções, com o antes, o depois e "Desfazer";
  - desfazimentos;
  - pedidos e acessos de emergência, com o selo "Emergência", o motivo, a referência, quem pediu, quem aprovou e o resultado;
  - suspensões e reativações;
  - trocas de plano pela plataforma.
- **Faixas:** correção (âmbar, com os módulos), emergência (vermelha) e suspensão.
- **E-mails ao Dono** (com domínio, sem bloquear nada): resumo das correções, pedido e aprovação de emergência, suspensão, reativação e troca de plano.

### 5.11 Política, Termos e LGPD

- A Política de Privacidade e os Termos de Uso ganham uma nova versão, com novo aceite (RF78). Ela descreve:
  - as correções autorizadas pelo Dono;
  - o acesso de emergência: motivos, duas pessoas, aviso imediato e prazo;
  - a suspensão e seus efeitos;
  - a troca de plano pela plataforma.
- A exportação (SPEC-014) inclui os eventos novos do registro e os pedidos de plataforma dos negócios em que o titular é Dono.
- A exclusão da conta de um Administrador retira o papel e os autenticadores.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhum contexto de Administrador (painel, ficha, modo suporte, emergência, ações) existe sem `aal2` no JWT validado, com o login posterior a `segundoFatorRedefinidoEm` e dentro das 8 h contadas do login com senha. | Testes unitários do contexto com `aal1`, `aal2`, fator redefinido e horários. |
| **INV-002** | Uma ação crítica sem código verificado nos últimos 10 min é recusada no servidor (`ReconfirmacaoNecessaria`). | Teste chamando cada ação crítica direto. |
| **INV-003** | Escrita no contexto de suporte só com: liberação do Dono ativa, módulo em correção, ação na lista fechada, reconfirmação da entrada e negócio não suspenso. O acesso de emergência nunca escreve. | Testes de integração por ação, módulo, tipo de acesso e situação do negócio. |
| **INV-004** | Toda correção grava o evento `CORRECAO`, com o antes e o depois, na mesma transação. Sem o registro, a correção não é gravada. | Teste com falha forçada no registro. |
| **INV-005** | Desfazer é uma operação nova (nada é apagado), feita só pelo Dono, até 30 dias depois, uma única vez, e só se o estado atual for igual ao "depois" gravado. | Testes de integração por ação da lista. |
| **INV-006** | Acesso de emergência e troca de plano pela plataforma só com duas contas de Administrador diferentes (quem pede ≠ quem aprova), ambas com reconfirmação. O pedido expira em 12 h, e a emergência dura até 4 h. | Teste com a mesma conta, conta comum, pedido vencido e aprovação dupla. |
| **INV-007** | Todo pedido e acesso de emergência aparece para o Dono desde o pedido. Não existe parâmetro, papel ou caminho no sistema que o esconda. | Teste da tela "Acessos do suporte" em cada etapa e revisão do código. |
| **INV-008** | Negócio suspenso não aceita nenhuma escrita de membros nem do suporte nos módulos e em Configurações, exceto o acesso do suporte. A rotina diária o pula. Leitura, exportação e exclusão de conta continuam, e nada é apagado. | Testes de integração com cada fábrica de ação e com a rotina. |
| **INV-009** | Os dados pessoais dos clientes nunca são alterados nem mostrados sem máscara ao Administrador, em nenhum modo. | Testes das ações de clientes no contexto de suporte e de emergência, e das consultas. |
| **INV-010** | O contexto de emergência é montado no servidor a cada requisição, a partir do acesso aprovado e conferido no banco (não expirado nem encerrado, mesmo Administrador que pediu). O cookie é só um ponteiro. | Teste com cookie forjado, acesso de outro negócio, outra conta e acesso encerrado. |
| **INV-011** | Os eventos novos seguem a RN32: só inclusão, guardados por 5 anos. | O gatilho `he_somente_insercao` cobre os eventos novos (teste existente estendido). |

---

## 7. Modelo de domínio envolvido

| Entidade | Mudança |
|---|---|
| `Usuario` | Novo: `segundoFatorRedefinidoEm DateTime?`. Os fatores ficam no Supabase Auth (`auth.mfa_factors`), nunca nas nossas tabelas. |
| `AcessoSuporte` | Novos:<br>• `tipo` (`LIBERACAO` \| `EMERGENCIA`, padrão `LIBERACAO`);<br>• `modulosComCorrecao` (subconjunto de `modulos`, vazio na emergência);<br>• na emergência, `motivoEmergencia`, `referencia VarChar(120)`, `justificativa VarChar(500)`, `pedidoId`, `resultado VarChar(1000)?` e `resultadoEm?`.<br>`liberadoPorId` passa a ser opcional, só na liberação. CHECKs de coerência por tipo; prazo de até 12 h com correção e de até 4 h na emergência. |
| **`PedidoPlataforma`** (nova) | Pedidos que precisam de segunda pessoa: `tipo` (`EMERGENCIA` \| `PLANO`), `negocioId`, `solicitadoPorId`, `dados` (motivo, referência, módulos e prazo; ou plano de destino e motivo), `criadoEm`, `expiraEm` (12 h), `situacao` (`PENDENTE`, `APROVADO`, `RECUSADO`, `CANCELADO`, `EXPIRADO`), `decididoPorId?`, `decididoEm?`, `motivoDaRecusa?`. CHECK `decididoPorId <> solicitadoPorId`; índice único parcial que permite só um pedido pendente por negócio e tipo; RLS ligado, sem policy. |
| `RegistroSuporte` | Novos eventos:<br>• 2º fator: `SEGUNDO_FATOR_CADASTRADO`, `SEGUNDO_FATOR_REMOVIDO`, `SEGUNDO_FATOR_REDEFINIDO`;<br>• correções: `CORRECAO`, `CORRECAO_DESFEITA`;<br>• emergência: `EMERGENCIA_SOLICITADA`, `EMERGENCIA_APROVADA`, `EMERGENCIA_RECUSADA`, `EMERGENCIA_CANCELADA`, `EMERGENCIA_ENCERRADA`, `EMERGENCIA_RESULTADO`;<br>• plataforma: `SUSPENSAO`, `REATIVACAO`, `PLANO_SOLICITADO`, `PLANO_APROVADO`, `PLANO_RECUSADO`.<br>Novos campos: `dados Json?` (ação, registro afetado, antes e depois), `correcaoId?` (o desfazer aponta a correção) e `pedidoId?`. O gatilho de só inclusão é mantido. |
| `Negocio` | Novos: `suspensoEm DateTime?`, `suspensoPorId?`, `motivoSuspensao` (enum) e `descricaoSuspensao VarChar(500)?`. O histórico das suspensões fica no registro. CHECK: negócio encerrado não fica suspenso. |
| `HistoricoPlano` | Novos: `motivo VarChar(300)?` e `pedidoId?` (troca pela plataforma). |
| Registros corrigidos (Item, HistoricoPreco, MovimentacaoEstoque, LancamentoFinanceiro, ContaPagarReceber, DespesaFixa, Subcategoria, Negocio/parâmetros) | Sem mudança de schema: o autor é o Administrador (`usuarioId`), e a correção fica ligada pelo registro. |

**Migração:** campos e tabela novos, enums novos, CHECKs, índices e RLS na tabela nova (regra da SPEC-001). Liberações existentes ficam com `tipo = LIBERACAO` e `modulosComCorrecao` vazio.

---

## 8. Impacto arquitetural

- **`src/lib/auth/adaptador-supabase.ts`:**
  - as claims passam a trazer o `aal` e os horários de `password` e `totp` do `amr`;
  - novas chamadas de MFA: `enroll`, `challenge`, `verify`, `listFactors` e `unenroll`.
- **`src/lib/dominio/suporte.ts`:**
  - sessão de 8 h contada pelo `password`. Hoje ela usa o maior horário do `amr`, que passaria a ser o do código: corrigir;
  - `reconfirmacaoValida` (10 min);
  - níveis por módulo e `CORRECOES_PERMITIDAS` (módulo → ações e compensação);
  - prazos com correção e da emergência.
- **`src/lib/auth/contexto.ts`:**
  - o contexto do Administrador exige `aal2` e o login posterior a `segundoFatorRedefinidoEm`;
  - o contexto de suporte ganha o `tipo` (liberação ou emergência), os módulos com correção e a reconfirmação da entrada.
- **`src/lib/auth/acao.ts`:**
  - cada ação ganha um identificador (ex.: `catalogo.editarItem`);
  - `acaoComPermissao` aceita o contexto de suporte só se o identificador estiver em `CORRECOES_PERMITIDAS` para um módulo em correção, e injeta o registrador da correção na transação;
  - nova fábrica `acaoCritica` (reconfirmação);
  - todas as fábricas recusam escrita em negócio suspenso (`NegocioSuspenso`).
- **`src/lib/db/cliente-do-negocio.ts`:** segunda barreira. No contexto de suporte, escrita só pelo caminho de correção marcado pela fábrica, e negócio suspenso recusa escrita.
- **`src/lib/suporte/`:** novos serviços:
  - correção (antes e depois) e desfazer (uma compensação por ação da lista, conferindo o estado atual);
  - pedidos de plataforma: pedir, aprovar, recusar, cancelar e expirar;
  - emergência: entrar, encerrar e registrar o resultado;
  - suspensão e troca de plano.
- **`src/app/admin/`:**
  - telas do 2º fator ("Configure o 2º fator" e "Digite o código");
  - pedidos pendentes, emergências e administradores;
  - ações na ficha;
  - autenticadores em Minha conta.
- **`src/app/(app)/negocio/suporte`:** níveis por módulo na gaveta, correções com "Desfazer", emergências com "Encerrar acesso".
- **`src/components/suporte/faixas.tsx`:** faixas de correção, emergência e suspensão.
- **Rotina diária (SPEC-009):** pula negócios suspensos.
- **`scripts/admin.ts` e `.github/workflows/administradores.yml`:** ação `redefinir-2fator`, com a chave secreta do Supabase como segredo do ambiente, passada por variável de ambiente, nunca interpolada no comando.
- **Testes:**
  - gerador de códigos TOTP (RFC 6238, com `node:crypto`) nos testes;
  - o Supabase falso local passa a responder às rotas de MFA e a emitir `aal` e `amr`.
- **Docs:** Política e Termos, ADR-008, README (MFA no Supabase e o novo segredo do workflow), modelo lógico e de domínio.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Cadastrar autenticador** | nome, código | fator ativo, sessão `aal2` | `CodigoInvalido`, `MuitasTentativas` |
| **Verificar código** | código | sessão `aal2` (ou reconfirmação) | `CodigoInvalido`, `MuitasTentativas` |
| **Remover autenticador** | fator | — | `ReconfirmacaoNecessaria`, `UltimoAutenticador` |
| **Redefinir 2º fator** (workflow) | e-mail, responsável | fatores removidos, sessões invalidadas | `ContaInexistente`, `NaoEAdministrador` |
| **Liberar acesso** (estendido) | motivo, módulos, módulos com correção, prazo | liberação | os da SPEC-018 + `CampoInvalido` (correção fora dos módulos ou prazo acima de 12 h) |
| **Corrigir** (cada ação da lista) | os campos da ação | o resultado da ação + evento `CORRECAO` | os da ação + `ForaDaListaDeCorrecoes`, `SomenteLeitura`, `ReconfirmacaoNecessaria`, `NegocioSuspenso` |
| **Desfazer correção** (Dono) | correção | evento `CORRECAO_DESFEITA` | `SomenteDono`, `RegistroMudou`, `SaldoInsuficiente`, `PrazoEncerrado`, `JaDesfeita`, erros de validação do módulo |
| **Pedir emergência** | negócio, motivo, referência, justificativa, módulos, prazo | pedido pendente | `ReconfirmacaoNecessaria`, `LiberacaoAtiva`, `PedidoPendente`, `ResultadoPendente`, `NegocioEncerrado`, `CampoInvalido` |
| **Aprovar ou recusar pedido** | pedido, motivo (na recusa) | acesso de emergência ou troca de plano; ou pedido recusado | `ReconfirmacaoNecessaria`, `MesmoAdministrador`, `PedidoExpirado`, `PedidoJaDecidido` |
| **Encerrar emergência** (Dono) | acesso | acesso encerrado | `SomenteDono` |
| **Registrar resultado** | acesso, texto | — | `SomenteQuemPediu`, `CampoInvalido` |
| **Suspender / reativar** | negócio, motivo, descrição | negócio suspenso ou ativo | `ReconfirmacaoNecessaria`, `NegocioEncerrado`, `JaSuspenso`, `NaoSuspenso` |
| **Pedir troca de plano** | negócio, plano, motivo, descrição | pedido pendente | `ReconfirmacaoNecessaria`, `MesmoPlano`, `PedidoPendente`, `NegocioEncerrado` |

**Alterações na baseline feitas junto com esta Spec (28/10/2026):**
- `docs/requisitos/requisitos.md` e `requisitos_ears.md`:
  - RF73, RF74, RF75, RF76, RF77, RN30, RN31, RN32 e RNF12 alterados;
  - RF82 a RF86 e RN37 a RN39 novos.
- `docs/definicoes_arquitetura/adrs-he.md`: nota de ampliação do ADR-008.
- Os textos da Política e dos Termos mudam na implementação, junto com a nova `VERSAO_TERMOS`.

**Riscos registrados:**
- **Uma pessoa com duas contas de Administrador** burlaria a regra das duas pessoas. Mitigações:
  - política da equipe: uma conta por pessoa;
  - o workflow registra quem concedeu cada papel;
  - o painel lista as contas de Administrador.
- **Compensações:** cada ação da lista precisa da sua compensação e de testes próprios. Uma ação sem compensação testada fica fora da lista.
- **Configuração do Supabase:** se o MFA TOTP estiver desligado no projeto, nenhum Administrador entra (falha fechada). O README de cada ambiente registra a configuração.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF12** | 2º fator obrigatório, reconfirmação em 10 min e sessão de 8 h contada da senha. | INV-001, INV-002. |
| **RNF02** | Emergência como exceção estreita, conferida a cada requisição; correções só pela lista. | INV-003, INV-010. |
| **RNF03** | Nenhum segredo de 2º fator no banco do HE. | Revisão do schema e das migrações. |
| **RNF04** | Nova versão da Política e dos Termos; exportação com os eventos novos; dados de clientes nunca alterados nem desmascarados. | INV-009 e teste da exportação. |
| **RNF05** | Correções, desfazimentos e ações de plataforma no registro imutável. | INV-004, INV-011. |
| **RNF01** | Telas novas, faixas e gaveta em 390, 768 e 1440 px, claro e escuro. | Capturas em build de produção. |

---

## 11. Critérios de aceitação

**CA-01 — Cadastro do 2º fator.** Dada uma conta de Administrador sem fator, quando entra com a senha, então só vê "Configure o 2º fator"; com o código do aplicativo, chega ao painel, e o painel avisa enquanto houver um autenticador só.

**CA-02 — Sem 2º fator, nada.** Dada uma sessão de Administrador em `aal1`, quando abre o painel, a ficha ou o modo suporte, ou chama uma ação direto, então é recusada e levada à tela do código.

**CA-03 — Sessão de 8 h.** Dado um login com senha às 9h e o código às 9h05, então a sessão vence às 17h, e não às 17h05.

**CA-04 — Reconfirmação.** Dado um código verificado há mais de 10 min, quando o Administrador suspende um negócio, então o diálogo pede o código antes; uma chamada direta sem reconfirmação é recusada.

**CA-05 — Redefinição.** Dado um Administrador que perdeu os autenticadores, quando outra pessoa roda o workflow com `redefinir-2fator`, então as sessões abertas deixam de valer, o próximo login pede o cadastro de novo e o registro mostra quem redefiniu.

**CA-06 — Liberação com correção.** Dada a liberação do Catálogo em "Ver e corrigir" e do Financeiro em "Ver", então os prazos oferecidos são 1 h e 12 h; o suporte edita o custo de um item, mas não cria lançamento no Financeiro; uma chamada direta ao Financeiro é recusada.

**CA-07 — Lista fechada.** Dado o modo suporte com Vendas liberado (só "ver") e o Catálogo em correção, quando o Administrador tenta cancelar uma venda, editar um cliente, criar um item ou excluir uma subcategoria, então nenhum botão aparece e as chamadas diretas são recusadas (`ForaDaListaDeCorrecoes` ou `SomenteLeitura`).

**CA-08 — Antes e depois.** Dada a correção do custo de R$ 40,00 para R$ 42,00, então "Acessos do suporte" mostra na hora a correção com o antes e o depois, e o histórico do item mostra "{nome} (suporte do HE)".

**CA-09 — Desfazer.** Dada a correção do CA-08, quando o Dono desfaz, então o custo volta a R$ 40,00 em nome do Dono, e o registro mostra a correção e o desfazer. Se o custo foi alterado de novo depois da correção, o desfazer é recusado com a explicação. Dada uma entrada de 10 unidades feita pelo suporte, desfazer grava uma saída de 10.

**CA-10 — Emergência com duas pessoas.** Dado o pedido do Administrador A, quando A tenta aprovar o próprio pedido, então é recusado; quando B aprova, A entra somente leitura nos módulos pedidos, pelo prazo pedido; sem resposta em 12 h, o pedido expira.

**CA-11 — Emergência visível.** Dado um pedido de emergência, então o Dono vê o pedido em "Acessos do suporte" desde o pedido; na aprovação, os membros veem a faixa vermelha; o Dono encerra o acesso e a próxima tela do Administrador volta ao painel.

**CA-12 — Emergência só leitura.** Dado um acesso de emergência com o Catálogo, quando o Administrador tenta editar um item ou exportar, então é recusado; os clientes aparecem mascarados.

**CA-13 — Resultado obrigatório.** Dado um acesso de emergência encerrado sem resultado, quando a mesma conta faz um novo pedido, então é recusada até registrar o resultado.

**CA-14 — Suspensão.** Dado um negócio suspenso, então os membros veem tudo, a faixa e a recusa em qualquer gravação, mas exportam os dados; a rotina diária não gera contas; ao reativar, a gravação volta e nada foi perdido.

**CA-15 — Troca de plano com duas pessoas.** Dado o pedido de A para o plano pago (cortesia), quando B aprova, então o plano muda, o histórico de planos mostra "pela plataforma" com o motivo, e o Dono é avisado; A não aprova o próprio pedido.

**CA-16 — Uma conta só.** Dada a plataforma com uma única conta de Administrador, então os pedidos de emergência e de plano ficam pendentes até expirar, sem como aprovar.

**CA-17 — Visual.** Dadas as telas novas e alteradas, em 390, 768 e 1440 px, claro e escuro, então seguem o design system, sem rolagem horizontal.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Contexto do Administrador: `aal1`, `aal2`, fator redefinido, sessão de 8 h pela senha, reconfirmação de 10 min | Unitário | CA-02 a CA-04, INV-001, INV-002 |
| T02 | Lista fechada: cada ação da lista aceita e cada uma de fora recusada no contexto de suporte, por módulo e nível | Unitário + integração | CA-06, CA-07, INV-003 |
| T03 | Correção grava o antes e o depois na mesma transação; falha no registro desfaz a correção | Integração | CA-08, INV-004 |
| T04 | Desfazer, por ação da lista: sucesso, registro alterado, saldo insuficiente, validação atual, 30 dias, só o Dono | Integração | CA-09, INV-005 |
| T05 | Pedidos de plataforma: mesma conta, segunda conta, expiração em 12 h, cancelamento, um pendente por negócio | Integração | CA-10, CA-15, CA-16, INV-006 |
| T06 | Emergência: contexto montado do acesso aprovado, cookie forjado, só quem pediu entra, 4 h, encerramento pelo Dono, máscara, sem escrita nem exportação | Integração | CA-10 a CA-12, INV-007, INV-009, INV-010 |
| T07 | Resultado obrigatório antes de novo pedido | Integração | CA-13 |
| T08 | Suspensão: todas as fábricas recusam escrita, exportação e exclusão continuam, rotina pula, reativação | Integração | CA-14, INV-008 |
| T09 | Troca de plano pela plataforma com as regras do RF73 e o histórico | Integração | CA-15 |
| T10 | Clientes no suporte e na emergência: nenhuma ação aceita e dados sempre mascarados | Integração | INV-009 |
| T11 | Eventos novos só de inclusão; exportação LGPD com os eventos e pedidos | Integração | INV-011, RNF04 |
| T12 | Workflow `redefinir-2fator`: segredo por variável de ambiente, responsável registrado, sessões invalidadas | Integração (script) | CA-05 |
| T13 | Gerador TOTP dos testes conferido com os vetores da RFC 6238 | Unitário | base dos demais |
| T14 | Roteiro no navegador com o Supabase falso local: cadastro do 2º fator, correção e desfazer, emergência com duas contas, suspensão, plano | Manual com captura | CA-01 a CA-16 |
| T15 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção | Manual com captura | CA-17 |
| T16 | Política e Termos na nova versão, com novo aceite | Manual | RNF04 |
| T17 | **Homologação** (ver abaixo) | Manual (uma vez) | CA-01 a CA-16 |

**T17 — como testar na homologação** (pedido da equipe, 28/10/2026). O fluxo completo, inclusive as duas pessoas, é possível na homologação **sem domínio**:
1. **Supabase de homologação:** conferir o MFA TOTP habilitado em *Authentication → Multi-Factor*. No GitHub, cadastrar a chave secreta do Supabase no ambiente `homologacao`, só para o `redefinir-2fator`.
2. **Duas contas de Administrador:** cadastrar duas contas exclusivas no app (sem negócio e sem convite) e conceder o papel a cada uma pelo workflow "Administradores".
   - O e-mail de confirmação só chega ao dono da conta Resend enquanto não houver domínio. Usar contas que recebam a confirmação, ou confirmá-las pelo painel do Supabase de homologação.
   - Na produção, as contas são de pessoas diferentes. Na homologação, uma pessoa pode operar as duas, em dois navegadores, cada uma com o próprio autenticador (o aplicativo guarda várias contas).
3. **Um Dono** com um negócio de teste, num terceiro navegador ou janela anônima.
4. **Roteiro:**
   - cadastro do 2º fator nas duas contas, com o segundo autenticador;
   - liberação com Catálogo em correção, correção do custo e desfazer pelo Dono;
   - pedido de emergência pela conta A, tentativa de aprovar com a própria A, aprovação pela B, faixa vermelha para o Dono, encerramento pelo Dono e resultado;
   - suspensão e reativação;
   - troca de plano pedida por A e aprovada por B;
   - redefinição do 2º fator de uma das contas pelo workflow.
5. Os e-mails ao Dono não chegam sem o domínio. As faixas e "Acessos do suporte" cobrem o aviso, como na SPEC-018.

---

## 13. Questões em aberto

Todas decididas pela equipe em 28/10/2026, em entrevista, pela opção recomendada; em quatro delas, com ajustes da equipe (marcados):

| ID | Decisão |
|---|---|
| **OPEN-001** — Como implementar o 2º fator | **MFA TOTP do Supabase Auth** (recomendada). O servidor exige `aal2` em todo contexto de Administrador, a partir do próximo login, sem carência, e nenhum segredo fica no nosso banco. Descartados: TOTP próprio do HE (mais um segredo a proteger) e passkey (muda o que a documentação previu; fica como evolução). |
| **OPEN-002** — Recuperação | **Dois autenticadores + redefinição pelo workflow** (recomendada): o segundo autenticador é pedido logo depois do primeiro; se a pessoa perder todos, outra pessoa da equipe roda a ação `redefinir-2fator`, registrada. Descartados: códigos de recuperação do Supabase (API experimental na versão instalada) e só a redefinição. |
| **OPEN-003** — Reconfirmação | **Pedir o código de novo nas ações críticas** (recomendada), com validade de 10 min: emergência, suspensão, plano, entrar para corrigir e remover autenticador. Descartado: só no login. |
| **OPEN-004** — Controle do Dono sobre a edição | **Por módulo, "ver" ou "ver e corrigir"** (recomendada), com o antes e o depois na hora. **Ajuste da equipe:** com correção, o prazo é de até **12 h** (a recomendação era 24 h). Descartados: uma chave para tudo; aprovação de cada correção pelo Dono. |
| **OPEN-005** — O que o suporte corrige | **Lista fechada, só do que o Dono consegue desfazer** (recomendada), na seção 5.4. Fora em qualquer hipótese: clientes, vendas, equipe, configurações, plano pelo Dono, acesso do suporte e LGPD. Toda ação nova nasce proibida. Descartado: todas as ações menos uma lista negra. |
| **OPEN-006** — Desfazer | **Sim, por compensação, em até 30 dias** (recomendada): uma operação nova em nome do Dono, recusada se o registro mudou depois ou se o saldo não permite. Descartado: só o registro, sem desfazer. |
| **OPEN-007** — Quem autoriza a emergência | **Duas pessoas** (recomendada): uma conta pede e outra aprova, ambas com o código reconfirmado; ninguém aprova o próprio pedido; com uma conta só, não há emergência. **Ajuste da equipe:** o pedido expira em **12 h** (a recomendação era 24 h). A equipe pediu para garantir o teste na homologação (seção 12, T17). Descartado: uma pessoa. |
| **OPEN-008** — Aviso ao Dono | **Na hora, sempre** (recomendada): desde o pedido, em "Acessos do suporte"; faixa vermelha na aprovação; e-mail com domínio. Não existe acesso secreto: uma ordem com sigilo é tratada fora do produto, com orientação jurídica. Descartado: aviso adiável por sigilo judicial. |
| **OPEN-009** — O que a emergência permite | **Só leitura, até 4 h** (recomendada): módulos escolhidos, máscara, sem exportação, sem renovação; o Dono pode encerrar. Para conter um incidente, o caminho é suspender. Descartado: leitura e correções. |
| **OPEN-010** — Dono sem acesso | **Só a leitura emergencial** (recomendada). Trocar o e-mail do Dono, recuperar a conta e transferir o negócio ficam para a Spec da pendência "Encerrar negócio e liberar o CNPJ". **A equipe pediu que a troca do e-mail seja prioridade nessa Spec.** Descartado: trocar o e-mail nesta Spec. |
| **OPEN-011** — Efeito da suspensão | **Somente leitura** (recomendada): os membros veem tudo, nada grava, a exportação e a exclusão de conta continuam, a rotina pula o negócio e nada é apagado. Motivos de lista fechada e aviso na hora. Descartado: bloqueio total. |
| **OPEN-012** — Quem suspende | **Um Administrador** (recomendada), com o código reconfirmado e o motivo; reativar segue a mesma regra. Descartado: duas pessoas, que atrasaria a contenção. |
| **OPEN-013** — Ações de plataforma | **Suspender/reativar e trocar plano** (recomendada). Reenviar convite pelo painel fica fora. |
| **OPEN-014** — Troca de plano | **Nos dois sentidos** (recomendada), com as regras do RF73, motivo (cortesia, correção, teste), histórico "pela plataforma" e aviso ao Dono. **Ajuste da equipe:** como na emergência, exige **duas pessoas** (a recomendação era um Administrador). Descartado: só para o pago. |

**Decisões derivadas (sem questão nova):**
- prazos com correção: **1 h (padrão) ou 12 h**; prazos da emergência: **1 h, 2 h ou 4 h**;
- Vendas e Dashboard ficam só em "ver": não têm ações na lista;
- a reconfirmação ao entrar para corrigir vale para aquela entrada;
- só quem pediu a emergência entra nela;
- emergência só sem liberação ativa; não em negócio encerrado; sim em negócio suspenso;
- o resultado é obrigatório ao fim da emergência antes de um novo pedido da mesma conta;
- a troca de plano pela plataforma usa os mesmos 12 h de pedido pendente da emergência;
- a redefinição do 2º fator invalida as sessões abertas (`segundoFatorRedefinidoEm`);
- o painel lista as contas de Administrador, para a equipe perceber uma conta a mais;
- os nomes dos membros continuam sem máscara, e os valores aparecem, como na SPEC-018.

---

## 14. Definition of Done da Spec

A SPEC-019 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-17) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-011) estiverem preservados;
- [ ] os testes derivados (T01 a T17) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF03, RNF04, RNF05, RNF12) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-014 tiverem sido decididas e registradas (28/10/2026), com a baseline ajustada (RF73–RF77, RF82–RF86, RN30–RN32, RN37–RN39, RNF12, ADR-008);
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 9).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
