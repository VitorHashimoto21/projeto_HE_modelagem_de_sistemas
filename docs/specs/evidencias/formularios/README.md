# Evidências — Revisão dos formulários (PR #119)

Pedido da equipe em 31/10/2026, depois do PR #117 (formulário do item, SPEC-006): revisar os outros formulários que perdiam o que a pessoa digitou quando o servidor recusava o envio.

**Causa:** com `<form action>`, o React 19 volta os campos não controlados ao valor inicial depois de cada envio, inclusive quando a ação devolve um erro. A mensagem aparecia ao lado de um campo vazio, ou com o valor de antes.

**Correção:** os formulários abaixo passaram a enviar pela transição (`startTransition`), com a função comum `enviarSemReiniciar` (`src/components/ui/envio.ts`), como os formulários de clientes (SPEC-022) e do item (SPEC-006). A validação no navegador continua antes do envio. Os formulários que limpavam os campos depois de salvar continuam limpando.

## Formulários corrigidos

| Spec | Formulário | Exemplo de recusa do servidor |
|---|---|---|
| SPEC-004 | Consulta do CNPJ no cadastro do negócio, confirmação do cadastro e "Dados do negócio" | CNPJ já cadastrado em outro negócio |
| SPEC-005 | Papel do membro da equipe | Membro não encontrado |
| SPEC-007 | Entrada e saída de estoque, mínimo manual e dias de cobertura | Saída maior que o saldo; dias fora de 1 a 90 |
| SPEC-009 | Lançamento avulso, saldo inicial, conta a pagar ou a receber (nova e edição), pagamento ou recebimento e despesa fixa | Pagamento maior que o restante da conta |
| SPEC-010 | Parâmetros da Calculadora | Validação repetida no servidor; a sessão ou a permissão recusada |
| SPEC-011 | Cancelamento da venda | Sem a forma do reembolso |
| SPEC-018 | Liberar o acesso do suporte | Negócio encerrado; só o Dono libera |

A conta nova também passou a limpar o formulário depois de salvar, como antes, para quem cadastra sem a permissão de ver o Financeiro e por isso fica na mesma tela.

**Sem mudança:**

- Entrar, cadastro e convite: já devolvem o que foi digitado.
- Nova venda, troca e permissões da equipe: os campos são controlados.
- Exclusão da conta e os botões que só levam campos ocultos: estornar, cancelar conta, ativar despesa e confirmar preço.

## Roteiro no navegador

Build de produção local (`next build` + `next start`), com Postgres e o Supabase Auth falso, em 31/10/2026. Negócio de teste **HE Testing**, com dados fictícios (`scratchpad/e2e/formularios.mjs --depois`).

**Antes da correção:** os 5 primeiros passos falharam. Os campos da saída de estoque ficaram vazios, os dias de cobertura voltaram para 7, o pagamento voltou para R$ 1.200,00, o CNPJ ficou vazio e o detalhe do cancelamento ficou vazio.

**Depois da correção:** 26 verificações, todas aprovadas.

| # | Passo | Resultado |
|---|---|---|
| 1 | Saída de 999 com o saldo menor: "Estoque insuficiente: há 7 em estoque."; quantidade, motivo e observação continuam. A saída válida é registrada e o formulário fica limpo | ✅ |
| 2 | Dias de cobertura 200: "Use um número inteiro de 1 a 90" e o 200 continua no campo; o valor válido é salvo | ✅ |
| 3 | Pagamento de 99.999 no aluguel: "O restante desta conta é R$ 1.200,00." e o valor digitado continua | ✅ |
| 4 | CNPJ de outro negócio: "Este CNPJ já está cadastrado no Health Enterprise…" e o CNPJ continua no campo | ✅ |
| 5 | Cancelamento confirmado sem a forma do reembolso: "Escolha como os R$ 159,80 serão devolvidos."; a venda não é cancelada e o motivo e o detalhe continuam | ✅ |
| 6 | Lançamento avulso válido: registrado, e o formulário continua limpando depois de salvar | ✅ |
| 7 | Cancelamento: o primeiro envio só abre a confirmação; desistir no diálogo não envia nada e mantém o detalhe | ✅ |
| 8 | Parâmetros da Calculadora: "Parâmetros de precificação salvos." com os valores no formulário | ✅ |
| 9 | Papel do membro: "Papel alterado." com o papel no campo | ✅ |
| 10 | Despesa fixa nova: "Despesa fixa cadastrada." e o formulário limpo | ✅ |
| 11 | Conta nova: cadastrada e aberta em `/financeiro/contas/{id}?nova=1` | ✅ |
| 12 | Liberar o suporte sem módulo: "Marque ao menos um módulo." pela validação no navegador; o motivo continua | ✅ |
| 13 | Dados do negócio: salvar continua levando ao painel (`/painel?salvo=1`) | ✅ |

Os registros criados pelo roteiro (lançamento, despesa fixa, conta e o negócio fictício com o CNPJ) foram apagados do banco local no fim.

Também passaram lint, tipos, os 547 testes unitários e os 283 de integração.

## Capturas

| Captura | O que mostra |
|---|---|
| `f_01_saida_recusada_768_claro.png` | Saída recusada, com a quantidade, o motivo e a observação mantidos |
| `f_02_cancelamento_recusado_390_escuro.png` | Cancelamento recusado sem a forma do reembolso, com o motivo e o detalhe mantidos |
| `f_03_pagamento_recusado_1440_claro.png` | Pagamento recusado, com o valor digitado mantido |

O nome no menu lateral (Rafael Leader) é da conta fictícia do ambiente local, a mesma das evidências da SPEC-018.
