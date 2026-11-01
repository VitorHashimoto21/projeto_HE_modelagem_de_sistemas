# Evidências — SPEC-025 (Inventário do estoque numa data)

Verificação em build de produção local (`next build` + `next start`), com Postgres e um Supabase Auth falso, em 31/10/2026 (horário de São Paulo). Negócio de teste **HE Testing**, com dados fictícios: sete produtos e um serviço, com movimentações em setembro e outubro.

O banco foi preparado em duas etapas, como na homologação:
1. as migrações anteriores, com os itens e as movimentações;
2. a migração `20261101120000_historico_custo`, que gravou o **início do histórico** dos 8 itens que já existiam, com o custo atual e sem autor.

## Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T01 | Quantidade numa data: saldo atual, entradas e estornos desfeitos, saídas somadas, frações sem resíduo, quantidade negativa e o fim do dia no horário do negócio | `test/unit/inventario.test.ts` | ✅ |
| T02 | Custo numa data: último registro vigente em qualquer ordem, mudança no próprio dia, antes do início do histórico (marcado) e sem histórico | idem | ✅ |
| T03 | Data padrão (último dia do mês anterior, inclusive em janeiro e em fevereiro de ano bissexto); data de hoje e passadas aceitas; futura e inválida recusadas | idem | ✅ |
| T04 | Inventário: só quantidade diferente de zero, em ordem de descrição, valor arredondado por linha e total; avisos e notas; tabela com as colunas, campos vazios sem custo e observações; CSV no padrão brasileiro | idem | ✅ |
| T05 | Histórico de custo: cadastro grava o primeiro custo; edição sem mudar o custo não grava; mudança grava com o autor; o banco recusa alterar e apagar; registro só para item do mesmo negócio | `test/integracao/inventario.test.ts` | ✅ |
| T06 | Inventário no banco: hoje = saldo atual; data passada com movimentações posteriores e retroativas; virada do dia (23h50 e 00h10); estornos; ativos e arquivados, zerados, serviços e outro negócio fora; nada alterado; custo pelo histórico e do início; quantidade negativa; arquivos CSV e PDF com o nome da data; data futura e formato inválido recusados | idem | ✅ |
| T07 | Permissão (Estoque e Catálogo — ver) e a guarda das rotas (recusa do modo suporte e da permissão, no servidor); negócio no plano gratuito com data de mais de 12 meses atrás | `test/unit/inventario.test.ts` e `test/integracao/inventario.test.ts` | ✅ |
| T08 | Exportação dos dados com o histórico de custo no `dados.json` | `test/integracao/inventario.test.ts` | ✅ |

Toda a suíte passou: 565 testes unitários e 294 de integração, além de lint e tipos. Um teste de antes (o modo suporte no NCM) mudou só na chamada: a edição do item recebe quem editou, para o histórico.

**Desempenho (RNF06):** num banco à parte com 1.000 produtos, 3.000 registros de custo e 50.000 movimentações, o inventário de três datas levou 253 ms (a primeira consulta, com o banco ainda frio), 48 ms e 38 ms.

## Roteiro no navegador (T09 e T10)

39 verificações, todas aprovadas (`scratchpad/e2e/spec25.mjs`).

| Passo | Resultado | Captura |
|---|---|---|
| Botão "Inventário" no Estoque; a tela abre no último dia do mês anterior (30/09/2026, porque o dia em São Paulo ainda era 31/10) (CA-11) | ✅ | — |
| Inventário de 30/09/2026: as 7 linhas conferem uma a uma (quantidade refeita, custo do início com "*", "Sem custo" na lixa, a argola com -3, a tornozeleira "(arquivado)"); o serviço fora; resumo "7 produtos, valor total R$ 809,20" (CA-02, CA-03, CA-06 a CA-09) | ✅ | `s25_01_inventario_1440_claro.png` |
| Avisos: dados faltando (1 sem custo, 1 sem código, 1 sem NCM, com os links para o Catálogo), custo do início em 6 produtos e 1 quantidade negativa; "Sem custo" leva ao item (CA-08, CA-09) | ✅ | idem |
| Celular: cada produto vira um cartão; 768 px com a tabela; sem rolagem horizontal em 390, 768 e 1440 px, nos dois temas; axe sem violações em 390 e 1440 px, claro e escuro (CA-15) | ✅ | `s25_02_inventario_390_escuro.png`, `s25_03_inventario_768_claro.png` |
| CSV `inventario-2026-09-30.csv`: cabeçalho, linhas, observações e total "809,20", iguais à tela; o botão "Baixar CSV" baixa o arquivo com esse nome (CA-10) | ✅ | `inventario-2026-09-30.csv` |
| PDF `inventario-2026-09-30.pdf`: "HE Testing · CNPJ 11.222.333/0001-81", "Posição: fim do dia 30/09/2026 · Gerado em … por Rafael Leader", a tabela, o total e as notas (CA-10) | ✅ | `s25_04_pdf_pagina_1.png` |
| Hoje: o saldo atual, sem a argola (zerada), total R$ 926,70 e sem custo do início; data futura recusada com "Escolha uma data até hoje." (CA-01, CA-11) | ✅ | — |
| Custo do anel trocado no Catálogo (32,90 → 35,00): o histórico tem o início (sem autor) e o novo custo (com autor); hoje o anel vale R$ 35,00 (total R$ 939,30) e em 30/09 continua R$ 32,90* (CA-05, CA-13) | ✅ | — |
| Colaboradora com Estoque — ver e sem Catálogo — ver: sem o botão; a tela e o arquivo levam a "Sem acesso" (CA-12) | ✅ | — |

O nome no menu lateral e no PDF (Rafael Leader) é da conta fictícia do ambiente local, a mesma das evidências das SPEC-018 e da revisão dos formulários. O CNPJ é um número de teste.

**Não verificado no navegador:**
- **A recusa no modo suporte.** O roteiro local não tem um Administrador com liberação. A tela e a rota usam a mesma guarda dos Relatórios (`exigirMembroForaDoSuporte`), conferida no T07.
- **A virada do dia com vendas reais.** Ela foi coberta pelo T06, com movimentações às 23h50 e às 00h10.

## Encontrado no roteiro

- **Observação do CSV entre aspas:** quando uma linha tinha as duas marcas, a observação usava ";", o separador do CSV, e a célula saía entre aspas. Agora as marcas são separadas por " · ".
- **Observação cortada no PDF:** com as duas marcas juntas, o texto não cabia na coluna. As larguras das colunas do PDF foram reequilibradas, e a observação mais longa cabe inteira.
