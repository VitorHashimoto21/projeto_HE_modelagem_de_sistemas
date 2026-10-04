# SPEC-003 — Parâmetros fiscais oficiais

> **Status:** 📝 **Rascunho para aprovação (04/10/2026)** — gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar). As questões em aberto da seção 13 trazem uma **recomendação**, mas a decisão é da equipe. Nenhuma implementação antes da aprovação.
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anterior:** [SPEC-002](SPEC-002.md) · **Próximas que dependem desta:** SPEC-004 (CNAE → Anexo) e SPEC-010 (faixas, DAS, Fator R e margens).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-003 |
| **Nome** | Parâmetros fiscais oficiais |
| **Objetivo** | Carregar no banco, como **configuração e não código**, os parâmetros fiscais oficiais — faixas do Simples Nacional por Anexo, tabela CNAE → Anexo (com `sujeitoFatorR`), DAS e limite anual do MEI, regra do Fator R e margens padrão por categoria —, cada um com fonte legal e data de vigência, a partir do arquivo versionado `docs/prisma_base/parametros_fiscais_seed.json`, e oferecer às próximas Specs consultas confiáveis a esses parâmetros. |
| **Valor entregue** | O enquadramento (SPEC-004) e o cálculo de imposto e de preço (SPEC-010) passam a usar valores oficiais conferidos, que podem ser atualizados quando a lei muda (ex.: novo salário mínimo todo janeiro) editando um arquivo e rodando a carga — sem alterar código. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF36 | Dados das margens padrão por categoria (a sugestão na Calculadora é da SPEC-010). |
| | RF38, RF59, RF60, RF69 | Fornece os dados que esses requisitos consomem: faixas e parcelas a deduzir (RF38), CNAE → Anexo (RF59), DAS por atividade do MEI (RF60) e limite/anexos do Fator R (RF69). Os cálculos ficam nas SPECs 004 e 010. |
| **RN** | RN17 | Parâmetros parametrizáveis, com fonte legal e vigência, atualizáveis sem alterar código. |
| **RNF** | RNF08 | Faixas e percentuais de MEI e Simples mantidos como configuração. |
| **Caso de uso / fluxo** | — | Insumo dos fluxos de cadastro do negócio (SPEC-004) e da Calculadora (SPEC-010). |
| **Entidades** | FaixaTributaria, CnaeAnexo, ParametroMei, ParametroFatorR, MargemPadraoCategoria | Classe "global" no isolamento da SPEC-001 (sem `negocioId`, iguais para todos os negócios). |
| **Drivers** | AD-RF04 | Motor de precificação alimentado por tabelas dinâmicas, sem valores fixos no código. |
| **ADRs** | ADR-004 | Parâmetros em tabelas, com fonte legal e vigência; valores iniciais no arquivo versionado e carregados por comando de carga; tela de administração depois do MVP. |
| | ADR-005 | A alíquota efetiva é uma função de domínio pura em TypeScript (usada aqui para validar o seed; reutilizada pela SPEC-010). |
| **Decisões do Mapa** | OPEN-01, OPEN-02, OPEN-06, OPEN-16, OPEN-17 | Seed conferido em 03/10/2026; arquivo + comando de carga; margens 32%/8%; regra `rbt12De < RBT12 ≤ rbt12Ate`; tabela `ParametroFatorR`. |

---

## 3. Escopo

### Incluído

1. **Validação do arquivo de parâmetros** (`parametros_fiscais_seed.json`) antes de qualquer gravação: estrutura, tipos, valores possíveis (enums do schema), faixas contínuas por Anexo e consistência das alíquotas (seção 6).
2. **Comando de carga** (`npm run fiscal:carregar`), que grava os parâmetros no banco de forma **idempotente** (rodar duas vezes não muda nada) e **atômica** (ou tudo é gravado, ou nada), com um modo de simulação que só mostra o que mudaria.
3. **Vigência:** cada parâmetro passa a ter uma data de vigência explícita; ao mudar um valor, a carga cria uma nova versão a partir da nova data, preservando a anterior (OPEN-001, OPEN-002).
4. **Execução por ambiente:** a carga roda na homologação e na produção pelo GitHub Actions, depois das migrações (OPEN-004); em desenvolvimento e nos testes, pelo próprio comando.
5. **Consultas de leitura** em `src/lib/db` para as próximas Specs: faixa do Simples vigente para um Anexo e um RBT12; Anexo de um CNAE; parâmetros do MEI por atividade; regra do Fator R; margem padrão por categoria — todas com uma data de referência (padrão: hoje).
6. **Função de domínio pura** `aliquotaEfetiva(faixa, rbt12)` (RF38), usada na validação de consistência do seed e reaproveitada pela SPEC-010.
7. **Normalização do código CNAE**, para que `4772-5/00`, `4772500` e `4772-500` encontrem o mesmo registro (o formato da consulta de CNPJ da SPEC-004 é numérico).
8. **Documentação de manutenção** no README: como atualizar um parâmetro (editar o arquivo, conferir a fonte legal, abrir PR, carga automática) e o lembrete anual do DAS (salário mínimo de janeiro).

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Sugestão do Anexo a partir do CNPJ/CNAE e preenchimento manual | SPEC-004 |
| Cálculo do RBT12, da alíquota efetiva aplicada, do Fator R e do preço; inclusão do DAS nas despesas fixas | SPEC-010 (e SPEC-009 para o DAS como despesa fixa) |
| Tela de administração dos parâmetros | Depois do MVP (ADR-004, OPEN-02) |
| Tabela CNAE → Anexo completa (todas as subclasses) | Fora do MVP, salvo decisão da equipe (OPEN-005) — CNAEs fora da tabela usam o preenchimento manual do RF59 |
| Separação do imposto por atividade (multi-anexo) | Fora do MVP (RN24) |

---

## 4. Dependências

- **Specs anteriores:** SPEC-001 (schema v7 com as cinco tabelas, RLS ligado em todas, migrações por ambiente e CI).
- **Decisões arquiteturais:** ADR-004 (parametrização em banco e comando de carga), ADR-005 (domínio puro em TypeScript), OPEN-01/02/06/16/17 do Mapa.
- **Pré-requisitos externos:** nenhum. O seed foi conferido em 03/10/2026 (DAS de 2026, faixas da LC 155/2016) e a homologação já recebe migrações pelo workflow **Migrações** com o segredo `DIRECT_URL`.

---

## 5. Comportamento esperado

### 5.1 Carga dos parâmetros

- **Pré-condições:** banco com as migrações aplicadas; arquivo de parâmetros no repositório.
- **Fluxo principal:**
  1. O comando lê o arquivo e o valida inteiro (seção 6). Chaves que começam com `_` (`_aviso`, `_regraFaixa`, `_verificacao`) são comentários e são ignoradas.
  2. Para cada parâmetro, compara com o que está no banco para a mesma chave (ex.: Anexo III, faixa 2) e a mesma data de vigência:
     - **não existe** → cria;
     - **existe e é igual** → nada a fazer;
     - **existe com outro valor e a vigência do arquivo é mais nova** → cria a nova versão e mantém a anterior (que deixa de ser a vigente a partir da nova data);
     - **existe com outro valor e a mesma vigência** → recusa (seção 5.2): corrigir um valor já publicado exige uma nova vigência ou uma correção explícita (OPEN-002).
  3. Grava tudo numa única transação e imprime um resumo: criados, inalterados, novas versões, por tabela.
- **Modo de simulação** (`--simular`): faz a validação e a comparação e imprime o resumo, sem gravar.
- **Pós-condições:** para cada chave existe exatamente uma versão vigente em cada data a partir da primeira vigência.

### 5.2 Exceções da carga

| Situação | Comportamento |
|---|---|
| Arquivo inválido (campo ausente, tipo errado, Anexo/atividade/categoria inexistente, faixa com buraco ou sobreposição, alíquota inconsistente) | Nada é gravado; a mensagem aponta a tabela, o registro e o problema (ex.: "faixaTributaria, Anexo III, faixa 3: rbt12De 360000 ≠ rbt12Ate da faixa 2"). Código de saída ≠ 0. |
| Valor diferente com a mesma vigência de um já gravado | Nada é gravado; a mensagem pede uma nova `vigenteDesde` (mudança legal) ou o uso da correção explícita (OPEN-002). |
| Falha no meio da gravação (conexão, restrição do banco) | A transação é desfeita; o banco fica como antes. |
| Banco sem as migrações | Erro claro pedindo para aplicar as migrações antes. |

### 5.3 Consultas (para as próximas Specs)

| Consulta | Regra |
|---|---|
| **Faixa do Simples** (Anexo, RBT12, data) | A versão vigente na data em que `rbt12De < RBT12 ≤ rbt12Ate` (OPEN-16). RBT12 ≤ 0 é recusado (RN21 garante RBT12 > 0). RBT12 acima do teto da última faixa (R$ 4,8 milhões) devolve "acima do limite do Simples" (OPEN-003). |
| **Anexo do CNAE** (código) | Normaliza o código e devolve `{ anexo, sujeitoFatorR, descricao, fonteLegal }` ou "não encontrado" (a SPEC-004 então pede o preenchimento manual — RF59). |
| **Parâmetros do MEI** (atividade, data) | DAS mensal e limite de faturamento anual vigentes para a atividade. |
| **Regra do Fator R** (data) | Limite mínimo e anexos (se atingir / se não atingir) vigentes. |
| **Margem padrão** (categoria, data) | Margem vigente da categoria. |

Toda consulta devolve também a **fonte legal** e a **vigência** do valor usado, para que a SPEC-010 possa exibi-las e registrá-las no histórico de preços (RN17).

### 5.4 Atualização de um parâmetro (manutenção)

1. Alguém da equipe edita o arquivo (ex.: novo DAS em janeiro), com a nova `vigenteDesde` e a fonte legal.
2. Abre um PR; o CI valida o arquivo (seção 6) e roda a carga num banco descartável.
3. No merge na `DEVELOP`, o workflow aplica a carga na homologação; no merge na `main`, na produção (OPEN-004).
4. A aplicação passa a usar o novo valor a partir da data de vigência, sem novo código.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhum valor fiscal fica fixo no código da aplicação: alíquotas, parcelas, limites, DAS e margens vêm só das tabelas de parâmetros (RNF08). | Revisão no PR e teste que procura os valores do seed (ex.: `82.05`, `180000`) fora de `docs/` e dos testes. |
| **INV-002** | Para cada Anexo e data, as faixas cobrem de 0 ao teto sem buracos nem sobreposições: a faixa 1 começa em 0 e cada `rbt12De` é igual ao `rbt12Ate` da faixa anterior (OPEN-16). | Validação do arquivo e teste das consultas nas fronteiras (`180000` → faixa 1; `180000,01` → faixa 2). |
| **INV-003** | O imposto (`RBT12 × alíquota − parcela`) é contínuo nas fronteiras das faixas 1→2 a 4→5 de todos os Anexos (tolerância de R$ 1); a quebra 5→6 é esperada (sublimite de R$ 3,6 milhões). Detecta erro de digitação nas alíquotas e parcelas. | Validação do arquivo, usando a função `aliquotaEfetiva`. |
| **INV-004** | Para cada chave e data existe no máximo uma versão vigente. | Restrição no banco (OPEN-001) e teste de integração. |
| **INV-005** | A carga é idempotente e atômica. | Teste: rodar duas vezes → segunda execução sem mudanças; falha simulada no meio → banco inalterado. |
| **INV-006** | A aplicação só lê os parâmetros; somente o comando de carga grava. | Regra de lint (escrita nas tabelas fiscais só em `scripts/`) e revisão; as consultas em `src/lib/db` não expõem escrita. |
| **INV-007** | Todo parâmetro tem fonte legal não vazia e data de vigência (RN17). | Validação do arquivo e `NOT NULL` no banco. |
| **INV-008** | Os valores do enum no arquivo são exatamente os do schema: 5 Anexos com 6 faixas cada, as 3 atividades do MEI e as 9 categorias, cada uma com uma margem. | Validação do arquivo comparando com os enums gerados pelo Prisma. |

---

## 7. Modelo de domínio envolvido

| Entidade | Atributos usados | Regras |
|---|---|---|
| `FaixaTributaria` | `anexo`, `faixaOrdem`, `rbt12De`, `rbt12Ate`, `aliquota`, `parcelaDeduzir`, `fonteLegal`, `vigenteDesde`, `ativo` | Chave: (anexo, faixaOrdem, vigenteDesde). Limites contínuos (INV-002). |
| `CnaeAnexo` | `cnae`, `descricao`, `anexo`, `sujeitoFatorR`, `fonteLegal`, `vigenteDesde` | Hoje a chave é só `cnae` (uma versão por CNAE) — ver OPEN-001. |
| `ParametroMei` | `atividade`, `valorDasMensal`, `limiteFaturamentoAnual`, `fonteLegal`, `vigenteDesde`, `ativo` | Chave: (atividade, vigenteDesde). |
| `ParametroFatorR` | `limiteMinimo`, `anexoSeAtingir`, `anexoSeNaoAtingir`, `fonteLegal`, `vigenteDesde`, `ativo` | Uma regra vigente por data. |
| `MargemPadraoCategoria` | `categoria`, `margemPadrao`, `fonteLegal`, `vigenteDesde` | Hoje a chave é só `categoria` — ver OPEN-001. |

**Mudanças previstas no schema (dependem das decisões da seção 13):**

- `vigenteDesde` deixa de ter `@default(now())`: a data passa a vir sempre do arquivo (OPEN-002).
- Restrições de unicidade por chave + vigência (INV-004); para `CnaeAnexo` e `MargemPadraoCategoria`, troca da chave primária natural por `id` + unicidade (chave, vigência), se a equipe optar pelo histórico também nessas tabelas (OPEN-001).
- Comentário de `FaixaTributaria.rbt12Ate` alinhado com o seed: a última faixa tem teto de R$ 4,8 milhões (OPEN-003).
- **Arquivo de parâmetros:** cada registro ganha `vigenteDesde` (data ISO). O texto livre `vigencia` do MEI vira só comentário.

---

## 8. Impacto arquitetural

- **Módulos:**
  - `src/lib/fiscal/` — esquema de validação do arquivo (zod), comparação com o banco e montagem do plano de carga (sem framework);
  - `src/lib/dominio/fiscal.ts` — `aliquotaEfetiva` e a normalização do CNAE (funções puras, ADR-005);
  - `src/lib/db/parametros-fiscais.ts` — consultas de leitura (seção 5.3), expostas por `@/lib/db`;
  - `scripts/carregar-parametros-fiscais.ts` — comando de carga (`npm run fiscal:carregar [--simular]`);
  - `.github/workflows/migracoes.yml` — passo de carga depois das migrações (OPEN-004).
- **Fronteiras:**
  - As tabelas fiscais são "globais" (SPEC-001): não passam pelo filtro de negócio e não têm `negocioId`.
  - Só o comando de carga grava nelas (INV-006); o RLS sem policies continua bloqueando a API pública do Supabase (CA-15 da SPEC-001).
  - O domínio (`src/lib/dominio`) recebe os parâmetros como dados; não consulta o banco.
- **Integrações:** nenhuma externa. A fonte é o arquivo versionado, conferido manualmente contra a legislação.
- **Frontend × backend:** não há tela nesta Spec.
- **ADRs que restringem:** ADR-004 (configuração em banco, carga por comando, sem tela no MVP), ADR-005 (cálculo em TypeScript puro), ADR-002 (tabelas globais fora do isolamento por negócio).

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Validar parâmetros** | conteúdo do arquivo | parâmetros tipados | `ArquivoInvalido` (lista de problemas por tabela e registro) |
| **Planejar carga** | parâmetros válidos + estado do banco | plano: criar / inalterado / nova versão, por tabela | `ConflitoDeVigencia` (valor diferente com a mesma vigência) |
| **Carregar** | plano, modo (gravar ou simular) | resumo da carga | `ArquivoInvalido`, `ConflitoDeVigencia`, `FalhaNaGravacao` (transação desfeita) |
| **Faixa do Simples** | Anexo, RBT12 > 0, data | faixa (limites, alíquota, parcela, fonte, vigência) | `RbtInvalido` (≤ 0), `AcimaDoLimiteDoSimples`, `ParametroAusente` |
| **Anexo do CNAE** | código CNAE (qualquer formato) | Anexo, sujeito ao Fator R, descrição, fonte | — ("não encontrado" é um resultado, não um erro) |
| **Parâmetros do MEI** | atividade, data | DAS mensal, limite anual, fonte, vigência | `ParametroAusente` |
| **Regra do Fator R** | data | limite mínimo, anexos, fonte, vigência | `ParametroAusente` |
| **Margem padrão** | categoria, data | margem, fonte, vigência | `ParametroAusente` |
| **Alíquota efetiva** (domínio) | faixa, RBT12 | `(RBT12 × alíquota − parcela) ÷ RBT12`, em % | `RbtInvalido` |

`ParametroAusente` (nenhuma versão vigente na data) indica erro de configuração: a aplicação o registra e mostra uma mensagem genérica, nunca um valor inventado.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF08** | Parâmetros como configuração, não código. | INV-001; atualização de um valor de teste só pelo arquivo + carga, sem mudança de código. |
| **RNF06** | As consultas são leituras por índice (Anexo + vigência, atividade + vigência), sem impacto no tempo do cálculo de preço (< 2 s, SPEC-010). | Índices no schema; teste de integração com a consulta da faixa. |
| **RNF09** | Os parâmetros entram no backup diário (estão no schema `public`) e podem ser recarregados do arquivo a qualquer momento. | Backup restaurado contém as tabelas fiscais com dados. |
| **RNF11** | Cada ambiente recebe a carga pelo próprio fluxo (homologação na `DEVELOP`, produção na `main`). | Execução do workflow em cada ambiente. |

---

## 11. Critérios de aceitação

**CA-01 — Carga inicial.**
Dado um banco com as migrações aplicadas e sem parâmetros,
quando a carga roda com o arquivo conferido,
então as cinco tabelas ficam preenchidas (30 faixas, 12 CNAEs, 3 atividades do MEI, 1 regra do Fator R e 9 margens), cada registro com fonte legal e vigência.

**CA-02 — Idempotência.**
Dada uma carga já feita,
quando a carga roda de novo com o mesmo arquivo,
então nada é alterado e o resumo informa "0 criados, 0 novas versões".

**CA-03 — Nova vigência.**
Dado um DAS do MEI já carregado,
quando o arquivo traz um novo valor com uma `vigenteDesde` mais nova,
então a carga cria a nova versão, a anterior é preservada, a consulta numa data anterior devolve o valor antigo e a consulta a partir da nova data devolve o novo.

**CA-04 — Arquivo inválido não grava nada.**
Dado um arquivo com um erro (ex.: buraco entre faixas, Anexo inexistente, fonte legal vazia),
quando a carga roda,
então nada é gravado, a mensagem aponta o registro e o problema e o comando termina com erro (o CI falha).

**CA-05 — Conflito de vigência.**
Dado um valor já carregado,
quando o arquivo traz um valor diferente com a mesma `vigenteDesde`,
então a carga é recusada sem gravar nada e explica como proceder.

**CA-06 — Atomicidade.**
Dada uma falha durante a gravação,
quando a carga é interrompida,
então o banco fica exatamente como antes.

**CA-07 — Faixa pelo RBT12.**
Dado o Anexo III carregado,
quando se consulta a faixa para RBT12 = 180.000,00, 180.000,01 e 4.800.000,00,
então o resultado é, respectivamente, a faixa 1, a faixa 2 e a faixa 6; para RBT12 = 0 o resultado é `RbtInvalido` e para 4.800.000,01, `AcimaDoLimiteDoSimples`.

**CA-08 — Alíquota efetiva.**
Dada a faixa 2 do Anexo III (11,20%, parcela de R$ 9.360,00),
quando se calcula a alíquota efetiva para RBT12 = 240.000,00,
então o resultado é 7,30% ((240.000 × 11,2% − 9.360) ÷ 240.000).

**CA-09 — CNAE em qualquer formato.**
Dado o CNAE de psicologia carregado,
quando se consulta por `8650-0/03`, `8650003` ou `8650-003`,
então o resultado é Anexo V, sujeito ao Fator R; e um CNAE fora da tabela devolve "não encontrado".

**CA-10 — Carga por ambiente.**
Dado um merge na `DEVELOP` que altera o arquivo,
quando o workflow roda,
então as migrações e depois a carga são aplicadas na homologação, e o resumo da carga aparece no log.

**CA-11 — Validação no CI.**
Dado um PR que altera o arquivo de parâmetros,
quando o CI roda,
então o arquivo é validado (INV-002, INV-003, INV-007, INV-008) e a carga é executada num PostgreSQL descartável.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | O arquivo conferido passa na validação | Unitário | INV-002, INV-003, INV-007, INV-008 |
| T02 | Arquivos com erro (buraco, sobreposição, Anexo inexistente, fonte vazia, alíquota digitada errada, categoria faltando) são recusados com a mensagem certa | Unitário | CA-04 |
| T03 | `aliquotaEfetiva` em pontos conhecidos e nas fronteiras | Unitário | CA-08, INV-003 |
| T04 | Normalização do CNAE | Unitário | CA-09 |
| T05 | Carga inicial preenche as cinco tabelas | Integração | CA-01 |
| T06 | Segunda carga sem mudanças | Integração | CA-02, INV-005 |
| T07 | Nova vigência preserva a anterior; consultas por data | Integração | CA-03, INV-004 |
| T08 | Conflito de vigência recusado sem gravar | Integração | CA-05 |
| T09 | Falha simulada no meio da carga desfaz tudo | Integração | CA-06, INV-005 |
| T10 | Consulta da faixa nas fronteiras, RBT12 inválido e acima do teto | Integração | CA-07 |
| T11 | Consultas de CNAE, MEI, Fator R e margem | Integração | CA-09, seção 5.3 |
| T12 | Nenhum valor fiscal do seed no código da aplicação | Unitário | INV-001 |
| T13 | Escrita nas tabelas fiscais só em `scripts/` | Lint | INV-006 |
| T14 | Workflow aplica a carga na homologação depois das migrações | Manual (uma vez) | CA-10 |

Os testes de integração rodam no PostgreSQL local de teste, nunca nos projetos do Supabase.

---

## 13. Questões em aberto

Cada questão traz a **recomendação** de quem gerou a Spec; a decisão é da equipe.

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Histórico de versões | Hoje `FaixaTributaria`, `ParametroMei` e `ParametroFatorR` têm `id` e `ativo` (permitem várias versões), mas `CnaeAnexo` e `MargemPadraoCategoria` usam a própria chave como chave primária (uma versão só). | (a) histórico em todas as cinco tabelas (migração troca a chave de `CnaeAnexo` e `MargemPadraoCategoria` por `id` + unicidade (chave, vigência)); (b) histórico só nas três primeiras, as outras duas atualizadas no lugar. | **(a)**: o preço calculado (SPEC-010) precisa ser explicável depois; se a margem ou o Anexo de um CNAE mudar, a versão antiga continua consultável. O custo é uma migração pequena agora, antes de existirem dados. |
| **OPEN-002** — Vigência e correções | O arquivo não tem data de vigência por registro (só um texto livre no MEI), e o schema usa `@default(now())`. E se um valor publicado estiver errado (erro de digitação, não mudança de lei)? | Vigência: (a) `vigenteDesde` obrigatório em cada registro do arquivo; (b) uma data única por tabela. Correção: (c) só por nova vigência; (d) correção explícita (`--corrigir`), que substitui o valor da mesma vigência e registra no log. | **(a) + (d)**. Datas iniciais propostas: faixas do Simples e Fator R em **01/01/2018** (vigência da LC 155/2016); DAS do MEI em **01/01/2026** (salário mínimo de 2026); limite do MEI em **01/01/2018**; CNAEs e margens em **01/01/2018**. A correção explícita evita ter que inventar uma data para consertar um erro. |
| **OPEN-003** — Teto da última faixa | O schema diz "`rbt12Ate` nulo = sem teto", mas o seed traz R$ 4,8 milhões na faixa 6 (limite do Simples). | (a) manter R$ 4,8 milhões e responder "acima do limite do Simples" acima disso; (b) usar nulo (sem teto). | **(a)**: acima de R$ 4,8 milhões a empresa sai do Simples, então calcular um imposto ali seria errado; a SPEC-010 mostra o aviso. O comentário do schema é ajustado. |
| **OPEN-004** — Quando a carga roda nos ambientes | A carga precisa rodar na homologação e na produção. | (a) automática no workflow **Migrações**, logo depois das migrações, a cada push na `DEVELOP`/`main`; (b) workflow separado, disparado manualmente; (c) automática só quando o arquivo mudar. | **(a)**: a carga é idempotente, então rodar sempre é seguro e garante que todo ambiente novo já nasce com os parâmetros; não depende de alguém lembrar de disparar. |
| **OPEN-005** — Tamanho da tabela CNAE → Anexo | O seed tem 12 CNAEs (personas e mais frequentes). A tabela oficial tem centenas de subclasses. | (a) manter a amostra no MVP, com preenchimento manual para os demais (RF59); (b) carregar a tabela completa agora. | **(a)**: a tabela completa exige conferência cuidadosa (muitos CNAEs têm regras específicas e alguns não podem optar pelo Simples) e não muda o código — pode ser ampliada depois só pelo arquivo. |
| **OPEN-006** — Lembrete anual do DAS | O DAS muda todo janeiro (salário mínimo). Se ninguém atualizar, a Calculadora usa o valor do ano anterior. | (a) o CI e a carga emitem um **aviso** (sem falhar) quando a vigência mais nova do MEI é de um ano anterior ao atual; (b) uma issue aberta automaticamente em janeiro; (c) só documentar no README. | **(a) + (c)**: aviso visível no log de cada PR e de cada carga, sem bloquear o trabalho. |

---

## 14. Definition of Done da Spec

A SPEC-003 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-11) estiverem implementados;
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T14) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF06, RNF08, RNF09, RNF11) tiverem sido verificados como descrito na seção 10;
- [ ] as questões OPEN-001 a OPEN-006 tiverem sido decididas e registradas;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
