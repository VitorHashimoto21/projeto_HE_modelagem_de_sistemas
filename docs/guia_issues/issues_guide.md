# Guia de Issues para o GitHub — HE (HealthEnterprise)

Uma issue por Spec do [Mapa de Specs](../MAPA_DE_SPECS.md) (decisão OPEN-26). Cada issue aponta para a Spec aprovada em `docs/specs/SPEC-XXX.md`, que é a fonte dos critérios de aceitação completos (Dado/Quando/Então), invariantes e testes. Aqui ficam o resumo, as tarefas e os critérios principais em notação EARS.

**Fluxo:** a Spec é gerada e aprovada → a issue é aberta com o link da Spec → a implementação acontece numa branch própria a partir da `DEVELOP` → o PR para a `DEVELOP` referencia a issue e a Spec e só é integrado com o CI verde.

| Issue | Spec | Bloco | Labels |
|---|---|---|---|
| #01 | SPEC-001 Fundação técnica e isolamento multi-tenant | Fundação | `technical`, `CI` |
| #02 | SPEC-002 Acesso: cadastro, login e consentimento | Fundação | `feature`, `security` |
| #03 | SPEC-003 Parâmetros fiscais oficiais | Fundação | `technical` |
| #04 | SPEC-004 Cadastro do negócio e enquadramento fiscal | Fundação | `feature` |
| #05 | SPEC-005 Equipe, papéis e permissões | Fundação | `feature`, `security` |
| #06 | SPEC-006 Catálogo de itens e preço oficial | Módulos | `feature` |
| #07 | SPEC-007 Estoque: movimentações, alertas e mínimo sugerido | Módulos | `feature` |
| #08 | SPEC-008 Registro de venda integrado | Módulos | `feature` |
| #09 | SPEC-009 Financeiro: caixa, contas e despesas fixas | Módulos | `feature` |
| #10 | SPEC-010 Calculadora de precificação | Módulos | `feature` |
| #11 | SPEC-011 Cancelamento e troca de venda | Módulos | `feature` |
| #12 | SPEC-012 Dashboard e saúde financeira | Módulos | `feature` |
| #13 | SPEC-013 Plano gratuito × pago | Plano e LGPD | `feature` |
| #14 | SPEC-014 LGPD: exportação e exclusão de conta | Plano e LGPD | `security` |
| #15 | SPEC-015 Cobrança real do plano pago *(opcional)* | Plano e LGPD | `feature`, `optional` |

Documentação de arquitetura (ADRs e drivers) continua versionada em `docs/definicoes_arquitetura/`; novas decisões de difícil reversão ganham ADR revisado pelo grupo.

---

## 🛠️ Bloco 1: Fundação

### Issue #01 [Technical]: Fundação técnica e isolamento multi-tenant
*   **Spec:** [SPEC-001](../specs/SPEC-001.md)
*   **Requisitos:** RN01, RN29, RNF01, RNF02, RNF09, RNF10, RNF11 · **ADRs:** ADR-001, ADR-002, ADR-003
*   **Descrição:**
    ```text
    Como equipe de desenvolvimento,
    Queremos uma base Next.js + Prisma + Supabase com isolamento por negócio garantido por construção, ambientes separados e CI,
    Para que todas as Specs seguintes sejam construídas sobre uma fundação segura e testada.

    Tarefas:
    - [ ] Inicializar Next.js (App Router) com TypeScript estrito, Tailwind, ESLint e shadcn/ui.
    - [ ] Estruturar as pastas: src/{app,components,lib,hooks}, prisma/, test/.
    - [ ] Levar o schema v7 para prisma/schema.prisma (fonte da verdade) e remover docs/prisma_base/schema.prisma com aviso do novo local.
    - [ ] Criar a migração inicial e a migração que liga RLS em todas as tabelas, sem policies.
    - [ ] Implementar o "cliente do negócio" como extensão do Prisma Client e a classificação dos modelos.
    - [ ] Implementar o utilitário de datas (UTC × America/Sao_Paulo).
    - [ ] Aplicar a identidade visual (tokens, Fraunces/Outfit, favicon, metadados).
    - [ ] Criar a rota de saúde e a validação das variáveis de ambiente.
    - [ ] Configurar a Vercel: preview por PR e homologação pela DEVELOP (Supabase de homologação); documentar a produção.
    - [ ] Configurar o CI (.github/workflows/ci.yml): instalação, lint, tipos, prisma validate e Vitest com PostgreSQL de serviço.
    - [ ] Configurar o backup diário (workflow agendado com pg_dump) e documentar a restauração.
    - [ ] Configurar a proteção das branches DEVELOP e main (CI obrigatório).
    - [ ] Tarefa administrativa: garantir o professor (niltonmack@mackenzie.br) como colaborador do repositório.
    ```
*   **Critérios principais (EARS):**
    *   **Ubíquo (RNF02):** *THE SYSTEM SHALL* restringir toda operação em modelos operacionais ao `negocioId` do contexto e recusar operações sem contexto.
    *   **Ubíquo (RNF02):** *THE SYSTEM SHALL* manter o RLS ligado em todas as tabelas, de modo que a API pública do Supabase não retorne nem grave dados.
    *   **Orientado a Evento (CI):** *WHEN* um Pull Request for aberto ou atualizado para `DEVELOP` ou `main`, *THE SYSTEM SHALL* executar o CI e exibir o status no PR.
    *   **Orientado a Evento (RNF11):** *WHEN* um PR for integrado na `DEVELOP`, *THE SYSTEM SHALL* publicar a nova versão no ambiente de homologação.
*   **Testes-chave:** isolamento A × B; registro de outro negócio = "não encontrado"; filho com pai de outro negócio recusado; RLS em todas as tabelas; fronteira de datas (`2026-10-01T02:30:00Z` → 30/09/2026, competência `2026-09`).

---

### Issue #02 [Feature]: Acesso — cadastro, login e consentimento
*   **Spec:** SPEC-002 (a gerar)
*   **Requisitos:** RF01, RNF03, RNF04 (consentimento), RNF07 · **ADRs:** ADR-003
*   **Descrição:**
    ```text
    Como empreendedor ou colaborador,
    Eu quero me cadastrar e entrar com e-mail e senha, consentindo explicitamente com o uso dos meus dados,
    Para ter uma conta segura no HE.

    Tarefas:
    - [ ] Configurar o Supabase Auth (e-mail e senha) por ambiente.
    - [ ] No cadastro, criar o Usuario com id = auth.users.id (sem senha local) e gravar consentimentoLgpdEm.
    - [ ] Implementar login, logout e recuperação de senha pelo Supabase.
    - [ ] Proteger as rotas autenticadas no servidor (middleware) e passar a obter o contexto da sessão.
    - [ ] Exibir a política de privacidade e o termo de consentimento no cadastro.
    ```
*   **Critérios principais (EARS):**
    *   **Ubíquo (RNF03):** *THE SYSTEM SHALL* manter a senha somente no Supabase Auth, com hash seguro, sem cópia na tabela `Usuario`.
    *   **Comportamento Indesejado (RNF04):** *IF* o usuário não aceitar o termo de consentimento, *THEN* *THE SYSTEM SHALL* impedir a conclusão do cadastro.
    *   **Orientado a Evento (RNF07):** *WHEN* o usuário alternar entre negócios, *THE SYSTEM SHALL* manter a sessão ativa.

---

### Issue #03 [Technical]: Parâmetros fiscais oficiais
*   **Spec:** SPEC-003 (a gerar) · **Pré-requisito:** conferência do seed nas fontes oficiais (DAS com salário mínimo do ano vigente)
*   **Requisitos:** RF36 (dados), RN17, RNF08 · **ADRs:** ADR-004
*   **Descrição:**
    ```text
    Como equipe,
    Queremos os parâmetros fiscais oficiais no banco, com fonte legal e vigência, carregados por comando a partir de um arquivo versionado,
    Para que o enquadramento e o imposto sejam corretos e atualizáveis sem deploy.

    Tarefas:
    - [ ] Mover o seed para prisma/ (ou manter em docs/prisma_base) e criar o comando de carga idempotente.
    - [ ] Carregar FaixaTributaria (Anexos I–V, limites contínuos), CnaeAnexo, ParametroMei, ParametroFatorR e MargemPadraoCategoria.
    - [ ] Implementar a busca de faixa com a regra rbt12De < RBT12 <= rbt12Ate.
    - [ ] Garantir que a aplicação só lê os parâmetros (sem telas de edição no MVP).
    ```
*   **Critérios principais (EARS):**
    *   **Ubíquo (RN17):** *THE SYSTEM SHALL* manter faixas, CNAE → Anexo, DAS e limite do MEI, Fator R e margens padrão como dados com fonte legal e vigência, nunca em código.
    *   **Orientado a Evento (RF38):** *WHEN* uma faixa for buscada para um RBT12, *THE SYSTEM SHALL* retornar a única faixa em que limite inicial < RBT12 ≤ limite final.
*   **Testes-chave:** RBT12 = R$ 180.000,00 cai na faixa 1 e R$ 180.000,01 na faixa 2 (sem buraco); carga repetida não duplica registros; imposto contínuo nas fronteiras das faixas 1→5.

---

### Issue #04 [Feature]: Cadastro do negócio e enquadramento fiscal
*   **Spec:** SPEC-004 (a gerar)
*   **Requisitos:** RF02, RF03, RF58, RF59, RN24, RNF02, RNF07 · **ADRs:** ADR-002, ADR-006
*   **Descrição:**
    ```text
    Como empreendedor,
    Eu quero cadastrar meu negócio informando só o CNPJ (ou, sem CNPJ, como autônomo) e alternar entre meus negócios,
    Para ter o enquadramento fiscal certo sem precisar conhecê-lo.

    Tarefas:
    - [ ] Implementar o adaptador ConsultaCnpj com a BrasilAPI, tempo limite e fallback manual.
    - [ ] Sugerir o Anexo pela CnaeAnexo (com sujeitoFatorR) ou a atividade MEI, permitindo edição.
    - [ ] Implementar o regime Autônomo (sem CNPJ) com o Imposto% informado pelo usuário.
    - [ ] Criar o MembroNegocio Dono ao cadastrar o negócio.
    - [ ] Implementar o seletor de negócio ativo sem novo login.
    - [ ] Exibir o aviso da simplificação de anexo único por negócio (RN24).
    ```
*   **Critérios principais (EARS):**
    *   **Comportamento Indesejado (RF59):** *IF* a consulta de CNPJ falhar ou exceder o tempo limite, *THEN* *THE SYSTEM SHALL* permitir o preenchimento manual dos dados fiscais.
    *   **Comportamento Indesejado (RF59):** *IF* o usuário não possuir CNPJ, *THEN* *THE SYSTEM SHALL* cadastrar o negócio no regime Autônomo e solicitar o percentual de imposto.
    *   **Orientado a Evento (RF03):** *WHEN* o usuário selecionar outro negócio, *THE SYSTEM SHALL* alternar o contexto mantendo a sessão.

---

### Issue #05 [Feature]: Equipe, papéis e permissões
*   **Spec:** SPEC-005 (a gerar)
*   **Requisitos:** RF04, RF05, RF06, RF47 (limite de convites), RF72, RN01, RN02, RNF02 · **ADRs:** ADR-003
*   **Descrição:**
    ```text
    Como dono do negócio,
    Eu quero convidar colaboradores, inclusive quem ainda não tem conta, com papéis e permissões controladas no servidor,
    Para delegar a operação sem expor dados estratégicos.

    Tarefas:
    - [ ] Implementar o Convite (e-mail, papel, permissões, hash do token, validade, status) e o envio do e-mail.
    - [ ] Implementar o aceite: cadastro ou login do convidado e criação do MembroNegocio.
    - [ ] Permitir ao Dono cancelar convites pendentes e remover membros.
    - [ ] Implementar a matriz módulo × ação (ver, criar, editar, excluir/cancelar) com os 3 papéis como predefinições.
    - [ ] Validar papel e permissão no servidor em toda Server Action/rota.
    - [ ] Aplicar o limite do plano gratuito: Dono + 1 colaborador (membro ou convite pendente).
    ```
*   **Critérios principais (EARS):**
    *   **Comportamento Indesejado (RN02):** *IF* um usuário sem o papel de Dono tentar convidar/remover colaboradores ou alterar permissões, *THEN* *THE SYSTEM SHALL* impedir a ação e manter as permissões inalteradas.
    *   **Comportamento Indesejado (RF72):** *IF* o link do convite estiver expirado, cancelado ou já usado, *THEN* *THE SYSTEM SHALL* recusar o aceite.
    *   **Comportamento Indesejado (RF47):** *IF* um negócio do plano gratuito tentar convidar um segundo colaborador (contando convites pendentes), *THEN* *THE SYSTEM SHALL* exigir o upgrade.
    *   **Feature Opcional (RF06):** *WHERE* o Dono configurar permissões customizadas, *THE SYSTEM SHALL* aplicá-las em vez do papel fixo.

---

## 📦 Bloco 2: Módulos

### Issue #06 [Feature]: Catálogo de itens e preço oficial
*   **Spec:** SPEC-006 (a gerar)
*   **Requisitos:** RF07–RF14, RF41, RF52, RF64, RN03, RN04, RN15, RN16, RNF05 · **ADRs:** ADR-002
*   **Descrição:**
    ```text
    Como gestor do negócio,
    Eu quero cadastrar produtos físicos e serviços (com materiais vinculados) e definir o preço oficial manualmente, com histórico,
    Para ter um catálogo único que alimenta estoque, vendas e precificação.

    Tarefas:
    - [ ] Formulários responsivos (shadcn/ui) para Produto Físico e Serviço, sem quantidade em estoque e com estoque mínimo opcional.
    - [ ] Campo opcional de comissão (%) por item.
    - [ ] Seleção de materiais para serviços (produtos físicos já cadastrados), com quantidade padrão 1 editável.
    - [ ] Definição manual do preço oficial, sempre gravando HistoricoPreco (origem MANUAL, somente inserção).
    - [ ] Tela de histórico de preços do item.
    ```
*   **Critérios principais (EARS):**
    *   **Estado + Evento (RF08):** *WHILE* o tipo for Produto Físico, *WHEN* o formulário for enviado, *THE SYSTEM SHALL* exigir nome, custo, unidade de medida e categoria.
    *   **Estado + Evento (RF09):** *WHILE* o tipo for Serviço, *WHEN* o formulário for enviado, *THE SYSTEM SHALL* exigir nome, custo e categoria e perguntar se há materiais associados.
    *   **Orientado a Evento (RN03):** *WHEN* um Produto Físico for criado, *THE SYSTEM SHALL* inicializar o estoque com zero.
    *   **Orientado a Evento (RF64/RN16):** *WHEN* um preço oficial for definido, *THE SYSTEM SHALL* gravar um novo registro de histórico, preservando os anteriores.

---

### Issue #07 [Feature]: Estoque — movimentações, alertas e mínimo sugerido
*   **Spec:** SPEC-007 (a gerar)
*   **Requisitos:** RF15, RF17, RF19, RF20, RF21, RN07, RN08, RNF05 · **ADRs:** ADR-002
*   **Descrição:**
    ```text
    Como gestor ou colaborador com acesso ao estoque,
    Eu quero registrar entradas e baixas manuais com motivo e receber alertas de estoque baixo,
    Para que o estoque digital reflita o físico e eu evite rupturas.

    Tarefas:
    - [ ] Entrada manual de estoque (quantidade e data).
    - [ ] Baixa manual com motivo obrigatório (Perda, Quebra, Uso interno, Doação, Outro).
    - [ ] Gravar saldoAnterior e saldoPosterior em toda MovimentacaoEstoque; nenhuma atualização ou exclusão de movimentações.
    - [ ] Sugestão de estoque mínimo após o 1º ciclo: ⌈consumo médio diário (90 dias, exceto estornos) × dias de cobertura⌉.
    - [ ] Alertas visuais de estoque baixo na lista/dashboard e no cadastro do produto.
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Estado (RF19):** *WHILE* o estoque atual estiver igual ou abaixo do mínimo, *THE SYSTEM SHALL* exibir um alerta visual associado ao produto.
    *   **Orientado a Estado (RN07):** *WHILE* um produto não tiver completado 1 ciclo de entrada e saída, *THE SYSTEM SHALL* manter o alerta desativado.
    *   **Orientado a Evento (RNF05):** *WHEN* houver movimentação de estoque, *THE SYSTEM SHALL* registrar data, usuário, saldo anterior, saldo novo e motivo (quando aplicável), sem permitir alteração posterior.
*   **Testes-chave:** 45 unidades saídas em 30 dias com cobertura 7 → mínimo sugerido 11.

---

### Issue #08 [Feature]: Registro de venda integrado
*   **Spec:** SPEC-008 (a gerar)
*   **Requisitos:** RF16, RF18, RF22, RF22b, RF23–RF28, RF33, RF62 (gravação do custo), RN05, RN06, RN09–RN13, RN23, RN29 · **ADRs:** ADR-002, ADR-003
*   **Descrição:**
    ```text
    Como operador do caixa (Dono, Gerente ou Colaborador),
    Eu quero registrar vendas multi-itens com pagamento misto e parcelado,
    Para atender o cliente com flexibilidade e ter estoque e financeiro atualizados automaticamente.

    Tarefas:
    - [ ] Carrinho multi-itens (produtos e serviços) com cliente opcional; bloquear itens sem preço oficial.
    - [ ] Pagamentos mistos (Dinheiro, PIX, Débito, Crédito até 12x) com soma validada na interface e no servidor.
    - [ ] Transação única: baixa condicional atômica de estoque (produtos e materiais), movimentações SAIDA_VENDA com vendaId e saldos, lançamentos imediatos e parcelas/contas a receber.
    - [ ] Gravar precoUnitario e custoUnitario definidos pelo servidor.
    - [ ] Parcelas com diferença de centavos na 1ª parcela.
    ```
*   **Critérios principais (EARS):**
    *   **Comportamento Indesejado (RF18/RN06):** *IF* o estoque de algum produto ou material for insuficiente, *THEN* *THE SYSTEM SHALL* recusar a venda inteira, sem nenhuma baixa nem lançamento, informando o item faltante.
    *   **Comportamento Indesejado (RF26):** *IF* a soma dos pagamentos for diferente do total, *THEN* *THE SYSTEM SHALL* impedir o registro.
    *   **Orientado a Evento (RN09):** *WHEN* uma venda for paga em Dinheiro, PIX ou Débito, *THE SYSTEM SHALL* gerar lançamento imediato no caixa.
    *   **Orientado a Evento (RN10):** *WHEN* uma venda for paga no Crédito, *THE SYSTEM SHALL* gerar uma conta a receber por parcela, com vencimento mensal.
*   **Testes-chave:** R$ 100,00 em 3x = 33,34 + 33,33 + 33,33; duas vendas simultâneas do último item → só uma conclui.

---

### Issue #09 [Feature]: Financeiro — caixa, contas e despesas fixas
*   **Spec:** SPEC-009 (a gerar)
*   **Requisitos:** RF06 (despesa operacional), RF29–RF32, RF48, RF60, RF67, RN14, RN22, RNF05 · **ADRs:** ADR-002
*   **Descrição:**
    ```text
    Como gestor financeiro,
    Eu quero ver o caixa real, controlar contas a pagar/receber com quitação parcial e cadastrar despesas fixas,
    Para conhecer o saldo verdadeiro e os compromissos futuros.

    Tarefas:
    - [ ] Fluxo de caixa com entradas, saídas e saldo (só valores recebidos/pagos).
    - [ ] CRUD de contas a pagar/receber com categoria; quitação parcial gerando lançamento vinculado.
    - [ ] Cadastro de despesas fixas e do DAS do MEI (mantido pelo sistema).
    - [ ] Geração mensal das contas das despesas fixas: rotina diária (Vercel Cron) + conferência ao acessar, sem duplicar competência.
    - [ ] Lançamento de despesa operacional por colaborador com permissão granular.
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Evento (RN22):** *WHEN* um pagamento ou recebimento (total ou parcial) for registrado numa conta, *THE SYSTEM SHALL* gerar um lançamento no caixa com a categoria da conta.
    *   **Orientado a Estado (RN14):** *WHILE* uma conta a receber de cartão não tiver sido recebida, *THE SYSTEM SHALL* mantê-la fora do saldo de caixa.
    *   **Orientado a Evento (RF67):** *WHEN* a rotina diária rodar, *THE SYSTEM SHALL* gerar a conta do mês de cada despesa fixa ativa que ainda não a tiver.
*   **Testes-chave:** recebimento parcial de R$ 40,00 numa conta de R$ 100,00 → lançamento de R$ 40,00, conta PARCIAL, saldo +R$ 40,00; rotina executada duas vezes no mês não duplica a conta.

---

### Issue #10 [Feature]: Calculadora de precificação
*   **Spec:** SPEC-010 (a gerar)
*   **Requisitos:** RF34–RF41, RF49–RF55, RF60, RF61, RF62 (CMV%), RF69, RN15, RN16, RN19, RN20, RN21, RN28, RN29, RNF05, RNF06, RNF08 · **ADRs:** ADR-004, ADR-005
*   **Descrição:**
    ```text
    Como gestor do negócio,
    Eu quero o preço sugerido pelo markup completo com custos reais, despesas fixas, despesas variáveis, imposto e margem,
    Para precificar sem prejuízo.

    Tarefas:
    - [ ] Motor puro em TypeScript: Preço = Custo Total ÷ (1 − (DF% + DV% + Imposto% + Margem%)), bloqueando soma >= 100%.
    - [ ] RBT12: 12 meses anteriores ao mês do cálculo (vendas não canceladas), proporcional com histórico menor.
    - [ ] Imposto%: Simples pela faixa e Anexo efetivo (Fator R com ParametroFatorR), MEI = 0 com DAS nas despesas fixas, Autônomo = percentual informado.
    - [ ] Desp. Fixas% sobre o faturamento médio (RBT12 ÷ 12) ou estimado (capacidade × ticket).
    - [ ] CMV% no mesmo período do RBT12 (ou estimado sem histórico) e ponto de equilíbrio com alerta.
    - [ ] Margem padrão por categoria; avisos de margem líquida e de limite do MEI.
    - [ ] Confirmação explícita do preço com HistoricoPreco completo (origem CALCULADORA).
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Evento (RF34):** *WHEN* o cálculo for solicitado, *THE SYSTEM SHALL* calcular o preço pela fórmula de markup completo.
    *   **Comportamento Indesejado (RN19):** *IF* a soma dos percentuais for maior ou igual a 100%, *THEN* *THE SYSTEM SHALL* bloquear o cálculo e informar que o preço é inviável.
    *   **Comportamento Indesejado (RN21):** *IF* houver menos de 12 meses anteriores com vendas, *THEN* *THE SYSTEM SHALL* usar o RBT12 proporcional (média × 12, ou estimado × 12 sem histórico).
    *   **Orientado a Evento (RF40):** *WHEN* o cálculo for concluído, *THE SYSTEM SHALL* aguardar confirmação explícita antes de salvar o preço oficial.
*   **Testes-chave:** vendas de R$ 1.000,00 (crédito 10x, nada recebido) e R$ 500,00 (PIX) no mês anterior, sem outros meses → RBT12 = R$ 1.500,00 × 12 = R$ 18.000,00 e saldo de caixa R$ 500,00; venda do mês corrente e venda cancelada não entram; resposta < 2 s com histórico extenso.

---

### Issue #11 [Feature]: Cancelamento e troca de venda
*   **Spec:** SPEC-011 (a gerar)
*   **Requisitos:** RF65, RF66, RN25, RN26, RNF05 · **ADRs:** ADR-002, ADR-003
*   **Descrição:**
    ```text
    Como Dono, Gerente ou colaborador autorizado,
    Eu quero cancelar uma venda com motivo e, se quiser, trocá-la por itens de valor menor ou igual,
    Para corrigir erros e devoluções sem corromper estoque, caixa ou faturamento.

    Tarefas:
    - [ ] Cancelamento em transação única: status CANCELADA (venda nunca apagada), ENTRADA_ESTORNO das movimentações da própria venda (vendaId), contas abertas canceladas, estorno do recebido.
    - [ ] Troca: nova venda vinculada, crédito de troca limitado ao recebido, reembolso da diferença.
    - [ ] Verificação de papel/permissão no servidor e motivo obrigatório.
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Evento (RN25):** *WHEN* uma venda for cancelada, *THE SYSTEM SHALL* devolver ao estoque exatamente as quantidades baixadas por ela, cancelar as contas abertas e estornar o recebido, numa única transação.
    *   **Comportamento Indesejado (RN26):** *IF* o crédito de troca solicitado for maior que o valor já recebido, *THEN* *THE SYSTEM SHALL* limitá-lo ao recebido.
*   **Testes-chave:** venda de R$ 100,00 em PIX trocada por item de R$ 70,00 → crédito R$ 70,00 sem lançamento, estorno de R$ 30,00, saldo final R$ 70,00 e venda original fora do RBT12; serviço cuja receita de materiais mudou após a venda → estorno devolve as quantidades originais.

---

### Issue #12 [Feature]: Dashboard e saúde financeira
*   **Spec:** SPEC-012 (a gerar)
*   **Requisitos:** RF42, RF43, RF44, RF56, RF57, RF63, RF68, RN21, RN25, RN29, RNF01, RNF06, RNF10 · **ADRs:** ADR-001, ADR-005
*   **Descrição:**
    ```text
    Como dono do negócio,
    Eu quero ver na tela inicial o resumo do dia, o gráfico de vendas, o semáforo e a projeção de caixa,
    Para entender a saúde do negócio num relance.

    Tarefas:
    - [ ] Widgets: vendas do dia, saldo em caixa e alertas de estoque (Dono e Gerente).
    - [ ] Gráfico: 30 dias por dia, opção de 12 meses por mês.
    - [ ] Semáforo (faturamento do mês × PE × Meta), sem meta → só posição frente ao PE.
    - [ ] Projeção de caixa de 6 meses.
    - [ ] Dashboard restrito do Colaborador (vendas do dia e alertas de estoque).
    - [ ] Estrutura modular de widgets para novos indicadores.
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Estado (RF57):** *WHILE* o faturamento do mês for menor que o PE, *THE SYSTEM SHALL* exibir o semáforo em Vermelho; entre o PE e a meta, em Amarelo; igual ou acima da meta, em Verde.
    *   **Comportamento Indesejado (RF63):** *IF* o usuário for Colaborador, *THEN* *THE SYSTEM SHALL* ocultar saldo, semáforo, PE e gráficos de faturamento, inclusive no payload do servidor.
*   **Testes-chave:** despesas fixas R$ 6.000, CMV 41%, imposto 6% e taxa 3% → PE = R$ 12.000 e lucro simulado zero nesse faturamento.

---

## 🔒 Bloco 3: Plano e LGPD

### Issue #13 [Feature]: Plano gratuito × pago
*   **Spec:** SPEC-013 (a gerar)
*   **Requisitos:** RF45, RF46, RF47, RF70, RF71, RF73, RN18, RNF10 · **ADRs:** ADR-003, ADR-007 (proposta, só o ponto de troca)
*   **Descrição:**
    ```text
    Como dono do negócio,
    Eu quero saber o que o plano pago oferece e poder trocar de plano,
    Para usar relatórios avançados e mais colaboradores quando precisar.

    Tarefas:
    - [ ] Guardas de plano no servidor (Negocio.plano), sem nenhum limite de volume.
    - [ ] Relatórios do plano pago: rentabilidade por item, exportação CSV/PDF, histórico acima de 12 meses.
    - [ ] Função única alterarPlano(negocioId, plano, origem) com registro de quem e quando; troca simulada pelo Dono.
    - [ ] Downgrade: dados mantidos e colaboradores além do limite suspensos.
    - [ ] Tela de upgrade ao tentar usar recurso restrito.
    ```
*   **Critérios principais (EARS):**
    *   **Feature Opcional (RF47):** *WHERE* o negócio estiver no plano pago, *THE SYSTEM SHALL* disponibilizar relatórios avançados e gestão de múltiplos colaboradores.
    *   **Ubíquo (RN18):** *THE SYSTEM SHALL* limitar o plano gratuito apenas por funcionalidade, nunca por volume de registros.
    *   **Orientado a Evento (RF73):** *WHEN* o Dono trocar o plano, *THE SYSTEM SHALL* aplicá-lo imediatamente e registrar quem trocou e quando.

---

### Issue #14 [Security]: LGPD — exportação e exclusão de conta
*   **Spec:** SPEC-014 (a gerar)
*   **Requisitos:** RN27, RNF04 · **ADRs:** ADR-003
*   **Descrição:**
    ```text
    Como titular da conta,
    Eu quero exportar meus dados e excluir minha conta,
    Para exercer meus direitos previstos na LGPD.

    Tarefas:
    - [ ] Exportação dos dados do titular em .zip (JSON completo + CSV por tabela).
    - [ ] Exclusão por anonimização: bloquear acesso, anonimizar usuário e clientes dos negócios em que é o único Dono, encerrar esses negócios e reter registros fiscais por 5 anos sem identificação.
    - [ ] Remover também a credencial no Supabase Auth.
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Evento (RNF04):** *WHEN* o titular solicitar a exportação, *THE SYSTEM SHALL* gerar um .zip com JSON e CSV.
    *   **Orientado a Evento (RN27):** *WHEN* o titular solicitar a exclusão, *THE SYSTEM SHALL* bloquear o acesso, anonimizar os dados pessoais e manter os registros fiscais sem identificação por 5 anos.

---

### Issue #15 [Feature, opcional]: Cobrança real do plano pago
*   **Spec:** SPEC-015 (a gerar, só após aprovação do ADR-007)
*   **Requisitos:** RF73, RN18, RNF10, RNF11 · **ADRs:** ADR-007
*   **Descrição:**
    ```text
    Como dono do negócio,
    Eu quero assinar o plano pago com cobrança real,
    Para manter os recursos do plano pago de forma recorrente.

    Tarefas:
    - [ ] Adaptador GatewayPagamento com implementação Stripe (checkout hospedado e portal do cliente).
    - [ ] Rota de webhook com verificação de assinatura e idempotência, chamando alterarPlano(origem GATEWAY).
    - [ ] Campos de assinatura no Negocio e período de tolerância na inadimplência.
    - [ ] Chaves de teste em dev, preview e homologação; chaves reais só em produção.
    ```
*   **Critérios principais (EARS):**
    *   **Orientado a Evento:** *WHEN* o gateway confirmar o pagamento da assinatura, *THE SYSTEM SHALL* passar o negócio para o plano pago.
    *   **Comportamento Indesejado:** *IF* uma notificação do gateway tiver assinatura inválida ou já tiver sido processada, *THEN* *THE SYSTEM SHALL* ignorá-la sem alterar o plano.
*   **Testes-chave:** cartão de teste aprovado → plano pago; recusado → gratuito; renovação falha → tolerância → gratuito (simulação de tempo do Stripe); cancelamento mantém os dados.
