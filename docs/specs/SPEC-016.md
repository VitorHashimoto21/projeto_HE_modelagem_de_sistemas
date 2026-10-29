# SPEC-016 — Design system e redesign (Direção "Balcão")

> **Status:** ✅ **Implementada (PR #72) e verificada na homologação em 15/10/2026 (T10)**; **N8 — menu lateral recolhível e rótulo na dica (seção 15): divergência encontrada e decidida em 19/10/2026, implementada no mesmo dia (PRs #93 e #94) e verificada na homologação (N8-T6, 19/10/2026)**; os quatro ajustes encontrados na homologação foram corrigidos nos PRs #74 e #75 e aprovados nos testes da equipe em 16/10/2026, e as notas N1–N5 da seção 15 foram decididas pela equipe em 16/10/2026 (todas pela proposta; N3 e N5 implementadas) — aprovada em 14/10/2026 (OPEN-001 a OPEN-005 e OPEN-007 pela opção recomendada; OPEN-006 por **um PR único**); as 6 etapas num único PR, testes T01–T06 no CI, roteiros, acessibilidade e desempenho em build de produção (T07–T09) — [evidências](evidencias/SPEC-016/README.md); notas da implementação na seção 15. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md) · **Anteriores:** todas as telas das SPECs 002 a 014; [SPEC-012](SPEC-012.md) (gráficos em SVG próprio, OPEN-002) · **Base visual:** [`IDENTIDADE_VISUAL.md`](../design/IDENTIDADE_VISUAL.md) e o protótipo aprovado da Direção B (quadro "HE — Direções visuais", linha B, 14/10/2026).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-016 |
| **Nome** | Design system e redesign (Direção "Balcão") |
| **Objetivo** | Criar a camada que falta entre os tokens e as telas — **componentes de interface, componentes de gráfico, tokens de movimento e a estrutura do app** — e migrar **todas as 40 telas** para a Direção B aprovada: estrutura verde-escura (menu lateral no computador, barra inferior no celular), conteúdo em fundo neutro, Manrope, ações em verde, âmbar só como destaque da marca, a **faixa do caixa** como assinatura e gráficos interativos. Sem mudar nenhum comportamento, regra ou permissão. |
| **Valor entregue** | O produto deixa de parecer "formulários empilhados": fica fácil de ler (números e status em primeiro plano), agradável de manusear (respostas visíveis a cada ação) e consistente em qualquer tela. Para a equipe, mudar o visual passa a ser editar um componente, não 36 cópias. |

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende |
|---|---|---|
| **RF** | RF44 | Dashboard em cartões de componentes reutilizáveis (amplia a estrutura da SPEC-012). |
| | RF57 | Semáforo com o novo medidor (faturado, equilíbrio, meta e o ritmo hachurado), sempre com ícone e texto. |
| | RF43, RF68, RF70 | Gráficos de vendas, projeção de caixa e rentabilidade redesenhados (seção 5.5). |
| **RN** | RN18 | Recursos do plano pago continuam bloqueados no gratuito também nos cartões novos do Painel (OPEN-007). |
| **RNF** | RNF01 | Responsivo em três formas de navegação (celular, tablet, computador); 390, 768 e 1440 px sem rolagem horizontal; contraste WCAG 2.1 AA nos dois temas. |
| | RNF10 | Design system extensível: tela nova = composição de componentes existentes. |
| | RNF02 | Nenhuma informação a mais vai ao navegador: a faixa do caixa segue as permissões do Dashboard completo (SPEC-005, OPEN-003). |
| **Drivers** | AD-QA04 | Interface responsiva em componentes reativos (Tailwind + shadcn/ui, conforme o OPEN-002). |
| **ADRs** | — | Sem ADR nova: estilização é trocável sem afetar dados (seção "O que não tem ADR" de `adrs-he.md`). |
| **Documentos** | `IDENTIDADE_VISUAL.md` | Atualizado para a versão 2 (tokens, tipografia, movimento, gráficos, regras de escrita). |

---

## 3. Escopo

### Incluído

1. **Tokens v2** (claro e escuro): cores da Direção B, Manrope pelo `next/font` (servida pelo app), escala tipográfica, raios por hierarquia, sombras, espaçamentos e **tokens de movimento** (duração e curva). `validar_contraste.py` atualizado e rodado; paleta dos gráficos revalidada.
2. **Componentes de interface** (`src/components/ui/`): Botão (principal, secundário, perigo, só ícone), Campo de texto, Seleção, Caixa de marcação, Grupo de segmentos, Abas, Superfície (cartão com hierarquia), Cabeçalho de página, Número de destaque, Selo de status, Aviso, Aviso flutuante (toast), Lista responsiva (lista no celular, tabela no computador), Estado vazio, Esqueleto de carregamento, Gaveta lateral/inferior (OPEN-003), Diálogo de confirmação, Ícone (OPEN-001), Paginação, Filtro de período.
3. **Estrutura do app**: menu lateral verde-escuro no computador (recolhível), trilho só com ícones no tablet, barra inferior com "Vender" no celular, seletor de negócio, menu da conta; **faixa do caixa** (OPEN-005).
4. **Componentes de gráfico** (`src/components/graficos/`): Barras (com grade, média, parcial hachurado e marca do ano anterior), Barras acima/abaixo do zero com linha (projeção), Medidor (faturado, equilíbrio, meta, ritmo), Barra empilhada, Barras horizontais com destaque, Minigráfico — todos em SVG desenhado no servidor, com uma camada leve no navegador só para o balão (dica) e o realce, e a tabela "Ver os valores".
5. **Migração das 40 telas** em 6 etapas (seção 5.7), num **único PR** (OPEN-006), com um commit por etapa e a homologação ao final.
6. **Movimento** (seção 5.6): uma lista fechada de micro-interações e um único momento-assinatura.
7. **Regras de escrita da interface** (seção 5.8).
8. **Qualidade automatizada**: varredura de acessibilidade (axe) nos roteiros de navegador e um teste que impede voltar a escrever estilos de cartão à mão.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Mudanças de regra, cálculo, permissão ou fluxo | Nenhuma: o comportamento das SPECs 002–014 é preservado |
| Novas funcionalidades além dos gráficos do protótipo | Specs futuras |
| Novo logo ou novo nome | Fora: o broto e "Health Enterprise" ficam (a versão do símbolo sem quadrado é usada sobre o verde) |
| Aplicativo nativo / instalação como app | Evolução futura (o `site.webmanifest` existente continua) |
| Animações de entrada, rolagem com efeitos, confete | Fora por decisão (seção 5.6) |

---

## 4. Dependências

- **Specs anteriores:** todas as telas (SPECs 002–014); SPEC-005 (permissões do Dashboard completo × restrito e o menu por permissão); SPEC-012 (cartões do Dashboard e gráficos em SVG próprio); SPEC-013 (funcionalidades do plano pago).
- **Documentos:** `IDENTIDADE_VISUAL.md`, `identidade/tokens/` e o protótipo da Direção B.
- **Pré-requisitos externos:** conforme o OPEN-001 e o OPEN-002, dependências de interface (ícones; componentes acessíveis de diálogo, gaveta, menu e dica).

---

## 5. Comportamento esperado

### 5.1 Tokens v2

| Papel | Claro | Uso |
|---|---|---|
| `estrutura` | `#12342C` | Menu lateral, barra inferior, faixa do caixa, cabeçalhos escuros |
| `fundo` | `#EEF3F1` | Fundo das telas (neutro levemente frio — substitui o creme) |
| `superficie` | `#FFFFFF` | Cartões, listas, campos |
| `tinta` / `tinta-suave` | `#12201C` / `#5A6863` | Texto principal e de apoio |
| `acao` / `acao-hover` | `#1D6A51` / `#134E3B` | Botão principal, links, seleção em fundo claro |
| `ambar` | `#F5A524` | **Só** destaque da marca: item ativo do menu, tendência do saldo, botão de finalizar na gaveta escura — sempre com texto escuro (`#1F1500`) ou sobre a estrutura |
| status | os da identidade v1 | Saudável, Atenção, Déficit — reservados, com ícone e texto |

- O tema escuro tem seus próprios valores, definidos cor a cor a partir das mesmas famílias (OPEN-004), e passa pelo validador.
- **Tipografia:** Manrope (400–800) para tudo; algarismos tabulares em valores; escala: tela 28, seção 17, número de destaque 36–46, texto 14–16, apoio 12–13 px.
- **Raios por hierarquia:** faixa e blocos de destaque 24; cartões 20; campos e listas 16–20; botões e filtros em pílula; marcas de gráfico 4.
- **Movimento:** `--duracao-toque` 120 ms, `--duracao-estado` 220 ms, `--duracao-layout` 360 ms; curva `cubic-bezier(.25,1,.5,1)`; fechar = 75% do abrir; tudo desligado com `prefers-reduced-motion`.

### 5.2 Estrutura do app

| Largura | Navegação |
|---|---|
| ≥ 1024 px | Menu lateral verde-escuro com rótulos (pode recolher para ícones — detalhado na N8, seção 15); conteúdo em largura fluida com colunas quando couber |
| 640–1023 px | Trilho lateral só com ícones (rótulo na dica — N8) |
| < 640 px | Barra inferior flutuante: Painel, Vendas, **Vender** (destaque), Caixa (ou Estoque, para quem não vê o Financeiro), Mais |

- O menu continua vindo de `menuDoMembro` (SPEC-005): esconder é conveniência, a barreira segue no servidor.
- Configurações (Equipe, Dados do negócio, Plano) ficam agrupadas, abaixo dos módulos; "Minha conta" no avatar.
- Seletor de negócio no topo do menu (e no "Mais" do celular).

### 5.3 Faixa do caixa (assinatura)

- **No Painel:** o bloco verde-escuro do protótipo — saldo, tendência de 30 dias, entradas e saídas de hoje, selo de saúde e "Ver o dia" (abre os movimentos de hoje).
- **Nas demais telas** conforme o OPEN-005.
- Só para quem vê o Dashboard completo (Dashboard — ver + Financeiro — ver); o restrito não vê saldo (RF63). Os números vêm das mesmas consultas da SPEC-012 (INV-001 de lá).

### 5.4 Componentes e telas

- Toda tela é composta por componentes do design system; nenhuma tela escreve à mão estilos de cartão, botão, campo, selo ou aviso.
- **Listas** viram tabela no computador e lista no celular, com as mesmas informações (nunca uma coluna escondida sem alternativa).
- **Formulários curtos** conforme o OPEN-003; formulários longos (cadastro de item, dados do negócio, parâmetros) seguem em página, em colunas no computador.
- **Estados vazios** convidam à ação ("Cadastre o primeiro produto"), **erros** dizem o que aconteceu e como resolver, **confirmações** usam o aviso flutuante com o mesmo verbo do botão ("Salvar" → "Salvo").
- **Ações que não se desfazem** (cancelar venda, **cancelar conta a pagar ou a receber**, estornar lançamento) pedem confirmação no **Diálogo de confirmação** do design system (`src/components/ui/confirmacao.tsx`), nunca na janela padrão do navegador: título com a pergunta, a consequência em uma frase, "Voltar" com o foco inicial e o botão de perigo com o mesmo verbo da ação (nota N3).
- **Valor do pagamento na Nova venda** (nota N1): com uma única forma de pagamento, o valor acompanha o total do carrinho até a pessoa editar o campo; ao dividir em mais de uma forma, os valores ficam fixos e cada parte é ajustada à mão. O servidor recalcula e valida tudo como na SPEC-008.
- **Carregamento**: esqueletos no lugar dos cartões; ao trocar um filtro, o conteúdo anterior fica esmaecido até o novo chegar (sem tela piscando).

### 5.5 Gráficos

| Gráfico | Onde | Forma |
|---|---|---|
| Vendas (30 dias / 12 meses) | Painel, Vendas | Barras com grade (3 valores), média pontilhada, hoje/mês atual hachurado; 12 meses com a marca do mesmo mês do ano anterior (OPEN-007) |
| Meta do mês | Painel | Medidor: faturado sólido, ritmo até o fim do mês hachurado (estimativa), marcas de equilíbrio e meta; cor pelo valor real (SPEC-012, OPEN-003) |
| Caixa nos próximos meses | Painel, Financeiro | Entradas acima e saídas abaixo do zero, saldo previsto em linha, rótulo só no menor saldo; um único eixo |
| Como os clientes pagam | Painel, Relatórios | Barra empilhada com rótulos diretos e a taxa da maquininha no crédito (taxa média dos parâmetros) |
| O que mais deixa lucro | Painel (OPEN-007), Relatórios | Barras horizontais ordenadas; os 3 primeiros em destaque, o resto em cinza |
| Tendência do saldo | Faixa do caixa | Minigráfico |
| Fluxo do mês | Financeiro | Barras acima/abaixo do zero por dia (entradas e saídas) |
| Para onde vai cada venda | Calculadora | Barra empilhada com as parcelas do próprio cálculo (custo, despesas fixas, taxa, comissão, imposto, margem) — nota N2. **Divergência encontrada em 26/10/2026:** a implementação juntou taxa e comissão numa parte só ("Maquininha e comissão"); corrigida pela [SPEC-023](SPEC-023.md) (opção 1, corrigir a implementação), com uma 6ª cor na paleta |
| Parte de cada despesa fixa | Financeiro (despesas fixas) | Barra empilhada com a parte de cada despesa no total do mês — nota N2 |
| Saldo × mínimo | Estoque (detalhe do produto) | Régua do saldo em relação ao estoque mínimo em vigor — nota N2 |

A taxa média da maquininha em "Como os clientes pagam" aparece no Painel e nos Relatórios (sobre o período escolhido), só para quem vê o Financeiro (nota N5).

**Regras (todas):** balão ao passar o mouse, tocar ou focar pelo teclado, com o valor em destaque; área de toque maior que a marca; legenda com 2 ou mais séries; texto sempre na cor da tinta, nunca na cor da série; cores dos status reservadas; paleta categórica validada (`validate_palette`) nos dois temas; tabela "Ver os valores" em todos; filtro de período numa linha acima, valendo para a tela toda.

### 5.6 Movimento

| Onde | O quê |
|---|---|
| Botões | Leve "afundar" ao toque (escala 0,96, 120 ms) e estado "salvando" |
| Faixa do caixa, "Ver o dia", seções que abrem | Abrir/fechar com opacidade e deslocamento curto (220 ms) |
| Gaveta e diálogo | Entrar deslizando com o fundo escurecendo (360 ms); foco preso dentro e devolvido ao fechar |
| Aviso flutuante | Entrar e sair (220/165 ms) |
| Medidor da meta | Preencher uma vez ao abrir o Painel |
| Gráficos | Realce da marca sob o ponteiro |
| **Momento-assinatura** | Ao finalizar uma venda, o valor "entra" na faixa do caixa e o saldo se atualiza, com a confirmação "Venda nº N registrada" |

Fora: entradas em cascata ao carregar, efeitos de rolagem, paralaxe, confete, cartões que crescem ao passar o mouse, curvas "elásticas".

### 5.7 Etapas da migração (um único PR — OPEN-006)

| Etapa | Entrega | Telas |
|---|---|---|
| **F1 — Fundação** | Tokens v2, fontes, componentes de interface, estrutura do app (menu, barra inferior), faixa do caixa, aviso flutuante | Estrutura em todas as telas (o miolo antigo segue funcionando dentro dela) |
| **F2 — Gráficos + Painel** | Componentes de gráfico e o Painel completo | `/painel` |
| **F3 — Vendas** | Nova venda (lista da A no estilo B), histórico, detalhe, cancelar, trocar | 5 telas |
| **F4 — Estoque, Catálogo e Calculadora** | | 8 telas |
| **F5 — Financeiro e Relatórios** | Caixa, contas, despesas fixas, lançar, relatórios | 8 telas |
| **F6 — Configurações, conta e área pública** | Negócios, dados, equipe, plano, conta, sem acesso; entrar, cadastro, recuperar senha, nova senha, convite, link inválido, privacidade, termos, página inicial | 18 telas |

Cada etapa é um commit (ou uma sequência curta de commits) no mesmo PR, já com os testes da suíte verdes, os roteiros de navegador das telas daquela etapa adaptados e verdes, a varredura de acessibilidade e as capturas em 390/768/1440 nos dois temas. Ao fim de todas, o PR é aberto e, depois do merge, a homologação verifica o conjunto. Para a revisão do grupo, as evidências ficam separadas por etapa.

### 5.8 Escrita da interface

- Frases curtas, verbos simples, primeira letra maiúscula só no começo (sem rótulos em MAIÚSCULAS).
- Nada de rótulos decorativos acima dos títulos ("PAINEL", "CONFIGURAÇÕES") — o menu já diz onde a pessoa está.
- Informações juntas por vírgula ou em linhas, não por "·".
- Botão diz o que acontece ("Finalizar venda", "Salvar despesa") e o aviso repete o verbo ("Venda registrada", "Despesa salva").
- Erros: o que aconteceu e como resolver, sem pedir desculpas.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | Nenhum comportamento muda: mesmas rotas, ações, validações, permissões e mensagens de regra. | Suíte completa (unitários e integração) verde sem alterar asserções de regra; roteiros das SPECs 002–014 verdes. |
| **INV-002** | Nenhuma informação além da permitida chega ao navegador (faixa do caixa, gráficos e cartões novos seguem SPEC-005/012/013). | Testes dos cartões por permissão e plano; verificação no HTML do restrito. |
| **INV-003** | Toda cor, raio, sombra, fonte e duração vem de token; nenhum hex no componente. | Teste de varredura (sem `#` hex nem `rounded-2xl border bg-card…` repetido nas telas). |
| **INV-004** | Contraste AA nos dois temas para todo par de texto e de interface; paleta de gráficos aprovada pelo validador. | `validar_contraste.py` e `validate_palette` no CI ou na evidência. |
| **INV-005** | Toda tela funciona em 390, 768 e 1440 px sem rolagem horizontal da página, com foco de teclado visível. | Roteiros de navegador. |
| **INV-006** | Sem violações graves de acessibilidade (axe: `serious`/`critical` = 0). | Varredura nos roteiros. |
| **INV-007** | Movimento desligado com `prefers-reduced-motion`; nenhuma animação bloqueia a interação. | Roteiro com a preferência emulada. |
| **INV-008** | Status nunca só por cor; gráficos com legenda/rótulo e tabela. | Revisão e roteiros. |

---

## 7. Modelo de domínio envolvido

Nenhuma entidade muda. **Mudanças previstas no schema: nenhuma.** As consultas novas (formas de pagamento no Painel, ano anterior no gráfico de 12 meses, fluxo diário do Financeiro) são leituras agregadas sobre `Venda`, `Pagamento` e `LancamentoFinanceiro`, no padrão da SPEC-012.

---

## 8. Impacto arquitetural

- `src/app/globals.css` e `docs/design/identidade/tokens/` — tokens v2 (claro e escuro) e movimento; `src/app/layout.tsx` — Manrope pelo `next/font`.
- `src/components/ui/` — componentes de interface; `src/components/graficos/` — componentes de gráfico; `src/components/estrutura/` — menu, barra inferior, faixa do caixa.
- `src/app/(app)/layout.tsx` — nova estrutura; cada tela migrada na sua etapa.
- Consultas novas em `src/lib/db/dashboard.ts` (formas de pagamento, ano anterior) e `src/lib/db/financeiro.ts` (fluxo diário), com testes.
- Roteiros de navegador ganham a varredura axe e passam a viver no repositório (`test/e2e/`), para o CI e para as próximas etapas.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída |
|---|---|---|
| **Faixa do caixa** | membro, hoje | saldo, tendência 30 dias, entradas e saídas de hoje, saúde do mês, movimentos de hoje — ou nada, sem permissão |
| **Formas de pagamento** | negócio, período | valor e participação por forma |
| **Vendas do ano anterior** | negócio, 12 meses | total por mês, 12 meses antes (só no pago — OPEN-007) |
| **Fluxo diário** | negócio, mês | entradas e saídas por dia |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Três formas de navegação; 390/768/1440 px; contraste AA; foco visível. | INV-004, INV-005, INV-006. |
| **RNF10** | Componentes reutilizáveis; tela nova por composição. | INV-003 e revisão. |
| **RNF02** | Faixa e cartões novos respeitam permissões e plano. | INV-002. |
| **Desempenho** | O JavaScript enviado ao navegador nas telas principais não cresce mais de 30 KB (comprimido) em relação a hoje; gráficos desenhados no servidor. | Relatório do `next build` antes e depois. |

---

## 11. Critérios de aceitação

**CA-01 — Tudo migrado.** Dadas as 40 telas, então todas usam a estrutura nova e os componentes do design system, sem estilos de cartão, botão, campo, selo ou aviso escritos à mão.

**CA-02 — Comportamento intacto.** Dada a suíte de testes e os roteiros das SPECs 002–014, então todos passam sem mudar nenhuma asserção de regra.

**CA-03 — Navegação adaptável.** Dado o app em 1440, 768 e 390 px, então aparecem, respectivamente, o menu lateral, o trilho de ícones e a barra inferior com "Vender".

**CA-04 — Faixa do caixa.** Dado um Dono, então a faixa mostra o saldo igual ao do Financeiro e abre os movimentos de hoje; dado um Colaborador, então não há saldo em lugar nenhum do HTML.

**CA-05 — Gráficos.** Dados os gráficos da seção 5.5, então cada um mostra o balão no mouse, no toque e no teclado, tem legenda quando há 2+ séries e a tabela de valores; a paleta passa no validador nos dois temas.

**CA-06 — Plano.** Dado um negócio gratuito, então a rentabilidade e a comparação com o ano anterior aparecem conforme o OPEN-007, sem vazar os valores.

**CA-07 — Movimento.** Dada a preferência por menos movimento, então nenhuma animação acontece; sem ela, só as da seção 5.6.

**CA-08 — Acessibilidade.** Dada a varredura axe em todas as telas, então não há violações graves; o contraste passa nos dois temas.

**CA-09 — Momento-assinatura.** Dada uma venda finalizada, então a confirmação aparece e o saldo da faixa se atualiza com o valor recebido.

**CA-10 — Escrita.** Dadas as telas, então não há rótulos em maiúsculas decorativos nem informações separadas por "·", e cada aviso repete o verbo do botão.

**CA-11 — Visual.** Dadas as telas, em 390/768/1440 px, claro e escuro, então seguem os tokens v2, sem rolagem horizontal, conforme o protótipo da Direção B.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Tokens: contraste (claro/escuro) e paleta de gráficos | Script | INV-004 |
| T02 | Varredura: sem hex nem classes de cartão repetidas fora de `ui/` | Unitário | CA-01, INV-003 |
| T03 | Componentes de gráfico: escalas, grade, média, hachurado, ano anterior, projeção, rótulos | Unitário | CA-05 |
| T04 | Menu por largura e permissão; faixa do caixa por permissão | Unitário + integração | CA-03, CA-04, INV-002 |
| T05 | Consultas novas (formas de pagamento, ano anterior, fluxo diário) | Integração | CA-05, CA-06 |
| T06 | Suíte completa sem mudança de regra | Unitário + integração | CA-02, INV-001 |
| T07 | Roteiro de regressão dos fluxos das SPECs 002–014, independente do estado da base (42 verificações), mais os roteiros de cada etapa (99), com axe, em 390/768/1440, claro e escuro (nota N4) | Navegador | CA-02, CA-08, CA-11 |
| T08 | Movimento com e sem `prefers-reduced-motion`; momento-assinatura | Navegador | CA-07, CA-09 |
| T09 | Tamanho do JavaScript antes e depois | Build | Desempenho |
| T10 | Homologação depois do merge do PR único | Manual (uma vez) | CA-01 a CA-11 |

---

## 13. Questões em aberto

Decididas pela equipe em 14/10/2026:

| ID | Decisão |
|---|---|
| **OPEN-001** — Ícones | **Biblioteca Lucide** (`lucide-react`). |
| **OPEN-002** — Base dos componentes | **Híbrido**: shadcn/ui (Radix) para diálogo, gaveta, menu suspenso, seleção, dica e aviso flutuante, reestilizados com os tokens; o resto próprio. |
| **OPEN-003** — Formulários curtos | **Gaveta com a própria URL preservada** (rotas interceptadas), acessível também pelo link direto. "Cancelar conta" na lista do OPEN-003 é **cancelar uma conta a pagar ou a receber** (não a exclusão da conta do usuário, que segue em página — SPEC-014); por ser uma confirmação, não um formulário, usa o Diálogo de confirmação (nota N3). |
| **OPEN-004** — Tema escuro | **Mantém claro e escuro**, com o escuro da Direção B definido cor a cor e validado. |
| **OPEN-005** — Faixa do caixa fora do Painel | **Versão compacta no topo de todas as telas**, só para quem vê o Dashboard completo. |
| **OPEN-006** — Entregas | **Um único PR** (diferente da recomendação de 6 PRs): as 6 etapas viram commits separados no mesmo PR, com evidências por etapa para facilitar a revisão; homologação uma vez, depois do merge. **Risco aceito:** PR grande para revisar e um único momento de verificação na homologação. |
| **OPEN-007** — Gráficos do plano pago no Painel | **Seguem o plano**: no gratuito, rentabilidade mostra a oferta (sem valores) e o modo 12 meses fica sem a marca do ano anterior. |

Opções consideradas:

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Ícones | De onde vêm? | (a) **Biblioteca Lucide** (`lucide-react`, só os ícones usados entram no pacote), traço uniforme; (b) SVGs desenhados à mão no projeto | **(a)** — conjunto completo e consistente, acessível e leve; desenhar dezenas de ícones à mão gera inconsistência. |
| **OPEN-002** — Base dos componentes | Escrever tudo ou usar shadcn/ui? | (a) **Híbrido: shadcn/ui (com Radix) para os componentes de comportamento difícil** — diálogo, gaveta, menu suspenso, seleção, dica, aviso flutuante — reestilizados com os tokens; o resto (botão, superfície, selo, lista…) próprio; (b) tudo próprio; (c) tudo do shadcn/ui | **(a)** — diálogo e gaveta acessíveis (foco preso, Esc, leitor de tela) são difíceis de acertar à mão; a baseline já prevê shadcn/ui (AD-QA04); o código fica no projeto e segue os tokens. |
| **OPEN-003** — Formulários curtos | Gaveta ou página? | (a) **Gaveta para formulários curtos** (lançar despesa, nova conta, entrada/saída de estoque, convidar, cancelar conta a pagar ou a receber) **com a própria URL preservada** — aberta por cima da lista e também acessível direto pelo link (rotas interceptadas do Next); (b) manter tudo em página | **(a)** — a pessoa não perde a lista de vista, o fluxo fica mais rápido, e links e atualização da página continuam funcionando. |
| **OPEN-004** — Tema escuro | Mantém? | (a) **Mantém claro e escuro**, com o tema escuro da Direção B definido cor a cor e validado; (b) só o claro no redesign | **(a)** — já existe e as pessoas usam; abandonar seria regressão. |
| **OPEN-005** — Faixa do caixa fora do Painel | Onde aparece? | (a) **Versão compacta no topo de todas as telas** (saldo, tendência, saúde; toque abre o dia), para quem vê o Dashboard completo; (b) só no Painel | **(a)** — é a assinatura do produto e responde "como está meu dinheiro?" de qualquer lugar; quem não tem permissão não vê. |
| **OPEN-006** — Entregas | Em quantos passos? | (a) **6 fases, um PR e uma homologação por fase** (seção 5.7); (b) um único PR | **(a)** — PRs revisáveis, risco menor e o sistema continua utilizável entre as fases. |
| **OPEN-007** — Gráficos do plano pago no Painel | Rentabilidade e ano anterior no gratuito? | (a) **Seguem o plano**: no gratuito, o cartão "O que mais deixa lucro" mostra a oferta do plano pago (sem valores) e o modo 12 meses mostra só os 12 meses (sem a marca do ano anterior, que usa histórico acima de 12 meses); (b) liberar no Painel para todos | **(a)** — respeita a RN18 e a SPEC-013 (relatórios e histórico acima de 12 meses são do pago) e ainda apresenta o recurso ao gratuito. |

---

## 14. Definition of Done da Spec

A SPEC-016 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-11) estiverem implementados, nas 6 etapas — por testes e em build de produção; a homologação (T10) fica para depois do merge;
- [x] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [x] os testes derivados (T01 a T10) estiverem aprovados, com o CI verde no PR — T01 a T09 aprovados (T07 pela regressão descrita na seção 15), CI verde no PR #72 e T10 na homologação em 15/10/2026 ([fotos](evidencias/SPEC-016/README.md#verificação-na-homologação-t10)), com os ajustes dos PRs #74 e #75;
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF10 e desempenho) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-007 tiverem sido decididas e registradas;
- [x] `IDENTIDADE_VISUAL.md` estiver na versão 2;
- [x] não existir divergência conhecida entre a implementação e esta Spec — as notas N1–N5 da seção 15 foram decididas em 16/10/2026 e incorporadas (N3 e N5 implementadas); a N8 (menu recolhível e rótulo na dica), decidida em 19/10/2026, foi implementada no mesmo dia e verificada na homologação (N8-T6) ([evidências](evidencias/SPEC-016/README.md#n8--menu-lateral-recolhível-e-dica-19102026));
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos (seção 15).

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.

---

## 15. Notas da implementação (15/10/2026)

Registradas conforme a regra fundamental: cada ponto traz a proposta e a decisão é da equipe.

**Decisões da equipe (16/10/2026, em entrevista), todas pela proposta:**

| # | Decisão |
|---|---|
| N1 | **Aceito na baseline**: o valor automático passa a fazer parte da seção 5.4 (e da SPEC-008, 5.1). |
| N2 | **Registrados na seção 5.5**: os três gráficos ficam, com as mesmas regras dos demais. |
| N3 | **"Cancelar conta" = cancelar conta a pagar ou a receber.** Criado o componente **Diálogo de confirmação** (Radix AlertDialog, tokens, tema escuro, foco inicial em "Voltar"), usado em cancelar conta, estornar lançamento e cancelar venda no lugar do `window.confirm`. Texto do OPEN-003 explicitado para não haver nova ambiguidade. |
| N4 | **Aceita a regressão como T07** (seção 12 atualizada). |
| N5 | **Taxa da maquininha também nos Relatórios**, sobre o período escolhido e só para quem vê o Financeiro (como no Painel); o cálculo é a mesma função de domínio (`custoDaMaquininha`) nos dois lugares. |
| N8 | **(1) Corrigir a implementação** (decisão de 19/10/2026, em entrevista, todas as questões pela recomendação), aqui mesmo na SPEC-016, em vez de uma Spec nova — a "SPEC-021 — Barra lateral recolhível" planejada no Mapa foi incorporada a esta nota. Detalhes na subseção N8 abaixo. |

Notas originais:

| # | O que | Situação | Proposta |
|---|---|---|---|
| N1 | **Valor automático na Nova venda.** Com um único pagamento, o valor acompanha o total até a pessoa editar o campo; ao dividir em mais de uma forma, fica fixo e cada parte é ajustada à mão. As validações e a ação são as mesmas da SPEC-008 (o servidor recalcula tudo). | Melhoria de interface não escrita na seção 5 | (2) aceitar na baseline como comportamento da frente de caixa; ou (1) voltar ao campo vazio |
| N2 | **Gráficos além da seção 5.5:** "Para onde vai cada venda" na Calculadora (barra empilhada com as parcelas do próprio cálculo), a parte de cada despesa fixa no total do mês e a régua saldo × mínimo no detalhe do estoque. Usam só números que a tela já calculava. | Acréscimo | (2) registrar na seção 5.5 |
| N3 | **"Cancelar conta" do OPEN-003** não virou gaveta: não ficou claro se é cancelar uma conta a pagar (hoje um botão com confirmação no detalhe da conta) ou excluir a conta do usuário (formulário em página, SPEC-014). As gavetas entregues: entrada e saída de estoque, novo lançamento, nova conta e convidar. | Ponto em aberto | Equipe esclarecer; se for a conta a pagar, vira um diálogo de confirmação |
| N4 | **T07:** os roteiros das SPECs 002–014 dependiam de bases preparadas para cada Spec (ex.: a primeira venda ser a nº 1). No lugar deles, um roteiro de regressão cobre os mesmos fluxos sem depender do estado da base (42 verificações), mais os roteiros de cada etapa (99) — evidências. | Troca de método | (2) aceitar a regressão como T07 |
| N5 | **"Como os clientes pagam" nos Relatórios** sem a taxa da maquininha (a seção 5.5 pede a taxa média dos parâmetros, que o Painel mostra); os Relatórios não carregam os parâmetros da Calculadora. | Diferença pequena | (1) incluir a taxa num ajuste futuro, ou (2) manter só no Painel |
| N6 | **Desempenho:** a primeira medição passou do limite (+39,3 KB); a gaveta do "Mais" e a biblioteca de avisos passaram a ser baixadas só quando usadas. Resultado: +17 KB no pior caso. | Resolvido | — |
| N7 | **Acessibilidade:** dois achados do axe corrigidos (contraste de um rótulo no estoque; `<p>` dentro de `<dl>` na Calculadora, vindo da SPEC-010). | Resolvido | — |
| N8 | **Menu lateral recolhível e rótulo na dica** (escopo, item 3, e seção 5.2) — **implementada em 19/10/2026** (subseção N8): não implementados — no computador o menu fica sempre com rótulos, e no trilho do tablet o nome aparece só na dica nativa do navegador (`title`), que não aparece no foco pelo teclado. A falta não foi registrada na época; foi encontrada em 19/10/2026, a partir da revisão de uma profissional da área financeira e contábil (pedido: recolher a barra no computador). | Divergência (19/10/2026) | (1) corrigir a implementação |

### N8 — Menu lateral recolhível e rótulo na dica (19/10/2026)

**Decisões da equipe (19/10/2026, em entrevista, todas pela recomendação):**

| # | Questão | Decisão |
|---|---|---|
| N8.1 | Onde guardar a escolha | **No navegador, como o tema** (OPEN-004): chave `he-menu` no armazenamento local, aplicada pelo layout raiz antes da pintura — a página já abre no estado salvo, sem piscar. Nada vai ao servidor nem ao banco; cada computador lembra a sua escolha. |
| N8.2 | Onde fica o botão | **No topo do menu, junto do logo**: expandido, à direita do logo ("Recolher menu"); recolhido, logo abaixo do símbolo ("Expandir menu"). |
| N8.3 | Tablet (768–1023 px) | **Sem mudança**: continua o trilho só com ícones; o botão só aparece a partir de 1024 px. |
| N8.4 | Trocar de negócio com o menu recolhido | **Pelo "Meus negócios"**, como no tablet; o seletor de negócio aparece só com o menu expandido. |
| N8.5 | Nome dos itens | **Dica própria** (Radix Tooltip, com os tokens), no **foco pelo teclado e ao passar o mouse**, com o selo quando houver (ex.: "Relatórios — Plano pago"). Vale para o menu recolhido e para o trilho do tablet, cumprindo o "rótulo na dica" da 5.2. |
| N8.6 | Atalho de teclado | **Sem atalho** (evita conflito com atalhos do navegador e de leitores de tela); o botão é alcançável pelo Tab. |
| N8.7 | Estado inicial | **Expandido**, como hoje; a escolha passa a valer depois do primeiro clique. |
| N8.8 | Requisito | **Sem RF novo**: é apresentação, coberta pelo RNF01 e pela seção 5.2 desta Spec. |

**Comportamento esperado:**

1. **A partir de 1024 px**, o botão "Recolher menu" fica no topo do menu. Ao recolher, o menu passa à largura do trilho (80 px), só com ícones, e o conteúdo ocupa o espaço liberado. O foco continua no botão, que passa a "Expandir menu" (`aria-expanded`, `aria-controls` apontando para o menu).
2. **Recolhido**, o menu tem a mesma estrutura do trilho do tablet: símbolo, botão, módulos, configurações, "Meus negócios", conta (iniciais), tema e sair. O item da página atual continua destacado em âmbar, e todo item com ícone tem a dica com o nome.
3. **Modo suporte (SPEC-018):** recolher funciona igual; o nome do negócio em âmbar sai do menu, e a faixa do modo suporte continua mostrando o negócio.
4. **Preferência:** lida antes da pintura; ausente ou com valor inválido → expandido. A troca vale para as próximas páginas (abas já abertas não precisam ser sincronizadas).
5. **Movimento:** a largura muda com os tokens da 5.6 (`--duracao-layout`); sem animação com "reduzir movimento".
6. **Abaixo de 1024 px** nada muda (trilho no tablet, barra inferior no celular), além da dica própria no trilho.

**Invariantes:**

| ID | Invariante | Como verificar |
|---|---|---|
| N8-INV1 | Recolher não muda os itens do menu (os mesmos de `menuDoMembro` e `menuDoSuporte`) nem as permissões. | Teste de componente / navegador. |
| N8-INV2 | Todo item continua com nome acessível para leitor de tela e com a dica visível no foco e no mouse. | Navegador (Tab e hover) e axe. |
| N8-INV3 | A página abre no estado salvo, sem mudança de largura do menu depois da pintura. | Navegador: largura do menu medida no carregamento. |
| N8-INV4 | Abaixo de 1024 px a estrutura não muda. | Capturas em 768 e 390. |

**Critérios de aceitação:**

- **N8-CA1 — Recolher e expandir.** Dado o app em 1440 px, quando a pessoa clica em "Recolher menu", então o menu fica só com ícones e o conteúdo se alarga; clicando em "Expandir menu", volta como estava.
- **N8-CA2 — Lembrar.** Dado o menu recolhido, quando a pessoa recarrega ou abre outra página, então ele já abre recolhido, sem piscar.
- **N8-CA3 — Dica.** Dado o menu recolhido (ou o trilho do tablet), quando a pessoa passa o mouse ou chega pelo Tab num item, então aparece a dica com o nome (e o selo, ex.: "Relatórios — Plano pago"); o leitor de tela anuncia o nome.
- **N8-CA4 — Tablet e celular.** Dado o app em 768 px, então não há botão de recolher e o trilho mostra as dicas; em 390 px, nada muda.
- **N8-CA5 — Modo suporte.** Dado o Administrador em modo suporte, quando recolhe o menu, então funciona igual e a faixa do modo suporte continua mostrando o negócio.
- **N8-CA6 — Movimento reduzido.** Dado "reduzir movimento" ativo, então o menu muda de largura sem animação.
- **N8-CA7 — Visual.** Dado o menu recolhido e expandido em 1024 e 1440 px, claro e escuro, então segue o design system, sem rolagem horizontal.

**Casos de teste:**

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| N8-T1 | Leitura e gravação da preferência (ausente ou inválida → expandido) | Unitário | N8.1, N8.7 |
| N8-T2 | Texto da dica (rótulo + selo) | Unitário | N8.5 |
| N8-T3 | Recolher, expandir, recarregar e navegar; largura estável no carregamento; `aria-expanded` | Navegador (build local) | N8-CA1, N8-CA2, N8-INV3 |
| N8-T4 | Dica no Tab e no mouse, recolhido em 1440 e no trilho em 768; axe sem achados novos | Navegador (build local) | N8-CA3, N8-CA4, N8-INV2 |
| N8-T5 | Capturas: 1024 e 1440 recolhido/expandido, claro e escuro; 768 e 390; modo suporte | Manual com captura | N8-CA5, N8-CA7, N8-INV4 |
| N8-T6 | Recolher na homologação, recarregar e conferir as dicas — ✅ 19/10/2026 | Manual (uma vez) | N8-CA1 a N8-CA3 |

**Impacto na implementação:** `src/components/estrutura/navegacao.tsx` (estado, botão, classes do recolhido reaproveitando as do trilho), `src/app/layout.tsx` (script antes da pintura, junto do tema), um componente de dica em `src/components/ui/` (Radix Tooltip) e uma variante de CSS para o estado recolhido. Sem mudança em banco, servidor ou permissões. Entrega num PR de correção (`fix/`), que marca a N8 como implementada e devolve o item da DoD.

**Implementação (19/10/2026):**

- `src/lib/estrutura/menu-lateral.ts`: chave `he-menu`, classe `menu-recolhido` no `<html>`, `estadoDoMenu` e o trecho do script do layout raiz (junto do tema, antes da pintura).
- `src/app/globals.css`: variantes **`trilho:`** (tablet, ou computador com o menu recolhido) e **`largo:`** (computador com rótulos), que substituem os pares `md:`/`lg:` do menu lateral; animação `dica-entrar`.
- `src/components/ui/dica.tsx`: **Dica** (Radix Tooltip, com os tokens), no foco e no mouse, Esc fecha; `desativada` mantém a mesma árvore quando a dica deixa de valer (o item não é recriado e não perde o foco).
- `src/components/estrutura/navegacao.tsx`: botão "Recolher menu"/"Expandir menu" no topo (só a partir de 1024 px), com `aria-expanded` e `aria-controls`; dica em todos os itens, em "Meus negócios", "Minha conta", tema e sair, só no modo trilho; texto da dica com o selo (`textoDaDica`, em `src/lib/equipe/menu.ts`).
- Testes: `test/unit/menu-lateral.test.ts` (N8-T1 e N8-T2).

**Decisões de implementação e divergências registradas:**

- **Dica baixada sob demanda.** O Radix Tooltip pesa cerca de 22 KB comprimidos; importado direto, o `/painel` passaria de 160,8 KB para 184,6 KB, acima do orçamento de +30 KB da seção 10. A dica só é baixada quando o menu está no modo trilho **e** a pessoa passa o mouse ou chega pelo teclado no menu; ao carregar, o foco volta ao mesmo item. Resultado: **+1,7 KB** em todas as telas medidas (expandido, recolhido e tablet). Quem usa o menu expandido nunca baixa a dica.
- **Com o menu expandido**, tema e sair continuam só com ícone e sem dica, como antes (a N8 cobre o modo só com ícones); "Minha conta" mantém a dica nativa com o e-mail.
- **Primeira dica pelo mouse** numa página recém-aberta: aparece no movimento seguinte ao carregamento (alguns milissegundos), dentro do atraso normal da dica.
- **Homologação (19/10/2026) — botão sobre o nome:** em navegador com barra de rolagem visível (Windows), o menu inteiro rolava quando os itens não cabiam na altura da tela, e a barra (15 px) empurrava o botão "Recolher menu" para cima de "Health Enterprise" (a linha do logo já estava no limite e o teste automatizado escondia as barras). Corrigido: **só a lista do meio rola** (módulos e configurações, com barra fina); o topo (logo, botão e seletor) e o rodapé (Meus negócios, conta, tema e sair) ficam fixos — o rodapé passa a estar sempre visível; a linha do logo ficou mais compacta e o nome encurta com reticências em vez de passar por baixo do botão. Verificado com a barra visível em 1900×898, 1440×760, 1280×700 e 1024×700.
- **Homologação (N8-T6, 19/10/2026):** depois do merge dos PRs #93 e #94, a equipe conferiu na homologação o menu expandido em tela cheia (botão ao lado do nome, sem sobreposição) e o menu recolhido depois de recarregar, com a dica no item em foco. Aprovada; a N8 está concluída.

