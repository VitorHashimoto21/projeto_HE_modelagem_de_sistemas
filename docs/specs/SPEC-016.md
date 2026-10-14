# SPEC-016 — Design system e redesign (Direção "Balcão")

> **Status:** ✅ **Aprovada em 14/10/2026** — questões em aberto decididas pela equipe (seção 13): OPEN-001 a OPEN-005 e OPEN-007 pela opção recomendada; OPEN-006 por **um PR único**. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar).
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
| ≥ 1024 px | Menu lateral verde-escuro com rótulos (pode recolher para ícones); conteúdo em largura fluida com colunas quando couber |
| 640–1023 px | Trilho lateral só com ícones (rótulo na dica) |
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
- `src/app/(app)/layout.tsx` — nova estrutura; cada tela migrada na sua fase.
- Consultas novas em `src/lib/db/dashboard.ts` (formas de pagamento, ano anterior) e `src/lib/db/financeiro.ts` (fluxo diário), com testes.
- Roteiros de navegador ganham a varredura axe e passam a viver no repositório (`test/e2e/`), para o CI e para as próximas fases.

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
| T07 | Roteiros das SPECs 002–014 adaptados, com axe, em 390/768/1440, claro e escuro | Navegador | CA-02, CA-08, CA-11 |
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
| **OPEN-003** — Formulários curtos | **Gaveta com a própria URL preservada** (rotas interceptadas), acessível também pelo link direto. |
| **OPEN-004** — Tema escuro | **Mantém claro e escuro**, com o escuro da Direção B definido cor a cor e validado. |
| **OPEN-005** — Faixa do caixa fora do Painel | **Versão compacta no topo de todas as telas**, só para quem vê o Dashboard completo. |
| **OPEN-006** — Entregas | **Um único PR** (diferente da recomendação de 6 PRs): as 6 etapas viram commits separados no mesmo PR, com evidências por etapa para facilitar a revisão; homologação uma vez, depois do merge. **Risco aceito:** PR grande para revisar e um único momento de verificação na homologação. |
| **OPEN-007** — Gráficos do plano pago no Painel | **Seguem o plano**: no gratuito, rentabilidade mostra a oferta (sem valores) e o modo 12 meses fica sem a marca do ano anterior. |

Opções consideradas:

| ID | Questão | Opções | Recomendação |
|---|---|---|---|
| **OPEN-001** — Ícones | De onde vêm? | (a) **Biblioteca Lucide** (`lucide-react`, só os ícones usados entram no pacote), traço uniforme; (b) SVGs desenhados à mão no projeto | **(a)** — conjunto completo e consistente, acessível e leve; desenhar dezenas de ícones à mão gera inconsistência. |
| **OPEN-002** — Base dos componentes | Escrever tudo ou usar shadcn/ui? | (a) **Híbrido: shadcn/ui (com Radix) para os componentes de comportamento difícil** — diálogo, gaveta, menu suspenso, seleção, dica, aviso flutuante — reestilizados com os tokens; o resto (botão, superfície, selo, lista…) próprio; (b) tudo próprio; (c) tudo do shadcn/ui | **(a)** — diálogo e gaveta acessíveis (foco preso, Esc, leitor de tela) são difíceis de acertar à mão; a baseline já prevê shadcn/ui (AD-QA04); o código fica no projeto e segue os tokens. |
| **OPEN-003** — Formulários curtos | Gaveta ou página? | (a) **Gaveta para formulários curtos** (lançar despesa, nova conta, entrada/saída de estoque, convidar, cancelar conta) **com a própria URL preservada** — aberta por cima da lista e também acessível direto pelo link (rotas interceptadas do Next); (b) manter tudo em página | **(a)** — a pessoa não perde a lista de vista, o fluxo fica mais rápido, e links e atualização da página continuam funcionando. |
| **OPEN-004** — Tema escuro | Mantém? | (a) **Mantém claro e escuro**, com o tema escuro da Direção B definido cor a cor e validado; (b) só o claro no redesign | **(a)** — já existe e as pessoas usam; abandonar seria regressão. |
| **OPEN-005** — Faixa do caixa fora do Painel | Onde aparece? | (a) **Versão compacta no topo de todas as telas** (saldo, tendência, saúde; toque abre o dia), para quem vê o Dashboard completo; (b) só no Painel | **(a)** — é a assinatura do produto e responde "como está meu dinheiro?" de qualquer lugar; quem não tem permissão não vê. |
| **OPEN-006** — Entregas | Em quantos passos? | (a) **6 fases, um PR e uma homologação por fase** (seção 5.7); (b) um único PR | **(a)** — PRs revisáveis, risco menor e o sistema continua utilizável entre as fases. |
| **OPEN-007** — Gráficos do plano pago no Painel | Rentabilidade e ano anterior no gratuito? | (a) **Seguem o plano**: no gratuito, o cartão "O que mais deixa lucro" mostra a oferta do plano pago (sem valores) e o modo 12 meses mostra só os 12 meses (sem a marca do ano anterior, que usa histórico acima de 12 meses); (b) liberar no Painel para todos | **(a)** — respeita a RN18 e a SPEC-013 (relatórios e histórico acima de 12 meses são do pago) e ainda apresenta o recurso ao gratuito. |

---

## 14. Definition of Done da Spec

A SPEC-016 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-11) estiverem implementados, nas 6 etapas;
- [ ] todos os invariantes (INV-001 a INV-008) estiverem preservados;
- [ ] os testes derivados (T01 a T10) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF10 e desempenho) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-007 tiverem sido decididas e registradas;
- [ ] `IDENTIDADE_VISUAL.md` estiver na versão 2;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
