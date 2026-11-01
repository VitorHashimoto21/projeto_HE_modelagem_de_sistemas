# SPEC-026 — Fornecedores, vínculo nas contas e filtros

> **Status:** ✅ **Aprovada e implementada em 01/11/2026**, verificada em build local: testes T01 a T10 automatizados e o roteiro no navegador (T11 e T12) com 71 verificações ([evidências](evidencias/SPEC-026/README.md)). Falta a homologação (T13). As notas da implementação, com a divergência resolvida pela equipe, estão depois da seção 9. As questões em aberto foram decididas pela equipe em entrevista (seção 13):
> - **cadastro de fornecedores separado**, numa seção "Fornecedores" do Financeiro; os clientes continuam em Vendas (OPEN-001);
> - o fornecedor tem **os mesmos campos do cliente**, inclusive endereço pelo CEP e inscrições, por escolha da equipe (OPEN-002), e o selo **"Completo para nota"**, como o cliente (OPEN-003);
> - **excluir** um fornecedor apaga o cadastro quando ele não tem contas e o anonimiza quando tem, como os clientes (OPEN-004);
> - fornecedores seguem as **permissões do Financeiro**, com a mesma máscara dos clientes para quem só pode ver (OPEN-005);
> - o **nome do cliente** aparece nas contas a receber para quem vê o Financeiro (OPEN-006);
> - **fornecedor ou cliente e nº do documento** são opcionais na conta e podem ser corrigidos a qualquer momento; a despesa fixa repassa o fornecedor às contas que gerar (OPEN-007);
> - a **forma do pagamento** é obrigatória ao pagar ou receber uma conta (OPEN-008);
> - a lista de contas ganha **busca, filtros e totais** (OPEN-009); a exportação continua pelo **relatório de Contas** dos Relatórios, com as colunas novas (OPEN-010);
> - no **modo suporte**, fornecedores ficam como os clientes: mascarados e fora das correções (OPEN-011);
> - **nova versão da Política de Privacidade**, com novo aceite (OPEN-012).
>
> A OPEN-002 foi decidida por escolha da equipe, diferente da opção recomendada (só identificação e contato). As demais foram decididas pela opção recomendada.
>
> A baseline foi ajustada: RF89, RF90 e RN42 novos; RF30, RF31, RF67, RF71, RN22, RN27 e RN36 alterados. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a pedido da equipe (01/11/2026). Parte vem da revisão de uma profissional da área financeira e contábil (a proposta de fornecedores e da busca pelo nome, de 26/10/2026). Parte vem do uso real por uma usuária com CNPJ, que pediu os filtros do sistema financeiro que já usa. É a segunda de três Specs de melhorias no Estoque e no Financeiro. A SPEC-027 (compras integradas) vem depois e usa os fornecedores desta Spec.
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:**
>   - [SPEC-009](SPEC-009.md): contas com fornecedor ou cliente, nº do documento e forma do pagamento; despesa fixa com fornecedor; busca, filtros e totais na lista de contas;
>   - [SPEC-013](SPEC-013.md): o relatório de Contas ganha colunas;
>   - [SPEC-014](SPEC-014.md): a exportação e a anonimização incluem os fornecedores;
>   - [SPEC-019](SPEC-019.md): fornecedores fora das correções do suporte;
>   - [SPEC-022](SPEC-022.md): o nome do cliente aparece nas contas a receber, e o formulário e as consultas do cliente são reaproveitados.
> - **Usa:** [SPEC-001](SPEC-001.md) (isolamento), [SPEC-005](SPEC-005.md) (permissões), [SPEC-008](SPEC-008.md) (parcelas do cartão), [SPEC-016](SPEC-016.md) (componentes) e [SPEC-018](SPEC-018.md) (modo suporte).

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-026 |
| **Nome** | Fornecedores, vínculo nas contas e filtros |
| **Objetivo** | Criar o **cadastro de fornecedores** e ligar as contas a quem se paga ou de quem se recebe. Cada conta passa a ter o **nº do documento** (nota ou boleto), e cada pagamento ou recebimento guarda a **forma** (dinheiro, Pix…). A lista de contas ganha **busca, filtros e totais**. |
| **Valor entregue** | O negócio para de anotar fora do HE a quem deve cada conta e como pagou. Ele encontra em segundos, por exemplo, quanto pagou a um fornecedor no mês, por Pix, e quanto ainda deve. Quando a contabilidade pedir, o relatório de Contas já traz o fornecedor, o documento e a forma de cada pagamento. |

### O que muda nas contas

Hoje uma conta a pagar ou a receber tem descrição, categoria, valor e vencimento. O pagamento registra o valor e a data. A lista só separa a pagar e a receber e filtra pela situação (em aberto, atrasadas, quitadas, canceladas).

Com esta Spec:
- **Conta a pagar:** pode ter um **fornecedor** do novo cadastro e o **nº do documento**.
- **Conta a receber:** pode ter um **cliente** do cadastro de clientes (SPEC-022) e o nº do documento. A conta de venda no cartão já mostra o cliente da venda.
- **Pagamento ou recebimento:** registra também a **forma**.
- **Lista de contas:** busca por texto e filtros por vencimento, data do pagamento, fornecedor ou cliente, forma, categoria e origem, com os **totais da lista filtrada**.

### Exemplo que originou a Spec

Uma loja compra embalagens todo mês da fornecedora "Embalagens Exemplo Ltda" e paga com boleto. O aluguel é uma despesa fixa.
- **Hoje:** a dona descreve a conta como "Embalagens - NF 1234" para lembrar de quem é. Quando a contabilidade pergunta quanto foi pago à fornecedora em outubro, ela abre as contas quitadas, procura uma por uma pela descrição e soma à mão. Não sabe dizer quais foram pagas por Pix e quais por boleto.
- **Com esta Spec:**
  - ela cadastra a fornecedora em **Financeiro › Fornecedores** digitando o CNPJ, e a razão social e o endereço aparecem sozinhos;
  - ao criar a conta, escolhe a fornecedora e informa o **nº do documento** 1234;
  - ao pagar, escolhe **Boleto**;
  - na lista de contas, filtra **fornecedor = Embalagens Exemplo**, **pagamento de 01/10 a 31/10** e situação **Todas**, e o topo mostra o total pago no período;
  - a despesa fixa do aluguel tem a imobiliária como fornecedor, e cada conta mensal já nasce com ela.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF89** (novo) | Cadastro de fornecedores do negócio, pessoa física ou empresa, com os mesmos campos do cliente (RF81), todos opcionais além do nome. Endereço pelo CEP e dados da empresa pelo CNPJ. Selo "completo para nota". Seção "Fornecedores" do Financeiro, com as permissões do Financeiro, busca, detalhe com as contas, edição e exclusão. |
| | **RF90** (novo) | Busca e filtros da lista de contas, com os totais da lista filtrada (total, pago e em aberto). |
| | RF30 | **Alterado:** a conta a pagar pode ter um fornecedor, a conta a receber pode ter um cliente, e as duas podem ter o nº do documento. Esses três campos são opcionais e podem ser corrigidos a qualquer momento. |
| | RF31 | **Alterado:** o pagamento ou recebimento de uma conta, total ou parcial, registra a forma do pagamento, obrigatória. |
| | RF67 | **Alterado:** a despesa fixa pode ter um fornecedor, repassado às contas que ela gerar. |
| | RF71 | **Alterado:** o relatório de contas exportado traz o fornecedor ou cliente, o nº do documento e os pagamentos (data, forma e valor). |
| | RF81 | Usado: o formulário, as consultas de CEP e CNPJ e o selo do cliente servem de base para o fornecedor. |
| **RN** | **RN42** (nova) | Dados do fornecedor: só o nome é obrigatório. O CPF ou CNPJ é validado e único entre os fornecedores ativos do negócio. Os dados completos só chegam a quem pode editar no Financeiro. O CPF nunca vai a serviço externo. Excluir apaga o fornecedor sem contas e anonimiza o fornecedor com contas. |
| | RN22 | **Alterada:** o lançamento gerado pelo pagamento de uma conta guarda também a forma do pagamento. |
| | RN27 | **Alterada:** a exclusão de conta do Dono também anonimiza os fornecedores dos negócios em que ele é o único Dono. Um fornecedor também pode ser excluído sozinho (RN42). |
| | RN36 | **Alterada:** o nome do cliente também aparece nas contas a receber, para quem vê o Financeiro. Os demais dados do cliente continuam com as regras de Vendas. |
| | RN37 | Mantida e ampliada: o suporte nunca cadastra, edita nem exclui fornecedores. |
| **RNF** | RNF01 | Telas de fornecedores, contas e filtros em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | Fornecedores, vínculos e filtros isolados por negócio. |
| | RNF04 | Fornecedores na exportação e na anonimização; nova versão da Política de Privacidade, com novo aceite. |
| | RNF06 | Filtros e totais calculados no banco, com índices. |
| **Decisões anteriores** | SPEC-022, OPEN-001 a OPEN-009 | Formulário, máscara, exclusão (apagar ou anonimizar), consultas de CEP e CNPJ e o selo "completo para nota" do cliente, reaproveitados no fornecedor. |
| | SPEC-009, OPEN-003 | A conta manual sem pagamento é a única que tem o valor, o vencimento, a categoria e a descrição editáveis. Isso continua; os campos novos são corrigíveis em qualquer conta (OPEN-007). |
| | SPEC-013, OPEN-005 | Plano gratuito: quitadas e canceladas só dos últimos 12 meses. Os filtros respeitam o limite. |
| | SPEC-019, OPEN-005 | Lista fechada de correções do suporte; ações novas nascem proibidas. |
| **Caso de uso / fluxo** | Financeiro (SPEC-009); Clientes (SPEC-022) | Ver seção 5. |
| **Entidades** | `Fornecedor` (nova), `ContaPagarReceber`, `DespesaFixa`, `LancamentoFinanceiro`, `Cliente` | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor), ADR-006 (consultas públicas de CEP e CNPJ) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Cadastro de fornecedores** em **Financeiro › Fornecedores**:
   - lista com busca e o filtro "incompletos para nota";
   - detalhe com os dados e as contas a pagar do fornecedor;
   - cadastro, edição e exclusão;
   - os campos e as consultas de CEP e CNPJ do cliente;
   - o selo "Completo para nota".
2. **Fornecedor** (opcional) nas contas a pagar e nas despesas fixas, e **cliente** (opcional) nas contas a receber manuais. Nas contas de venda no cartão, o cliente é o da venda.
3. **Nº do documento** (opcional) em qualquer conta.
4. **Correção a qualquer momento** do fornecedor ou cliente e do nº do documento, sem mexer em valores.
5. **Novo fornecedor sem sair da conta** (e da despesa fixa) e **novo cliente** na conta a receber, para quem tem a permissão.
6. **Forma do pagamento** obrigatória ao pagar ou receber uma conta. Os pagamentos antigos ficam "Não informada".
7. **Busca, filtros e totais** na lista de contas.
8. **Relatório de Contas** (Relatórios, plano pago) com as colunas novas.
9. **Permissões:** as do Financeiro, com a máscara dos dados do fornecedor para quem só pode ver.
10. **Modo suporte:** fornecedores mascarados e fora das correções.
11. **LGPD:**
    - fornecedores na exportação dos dados e na anonimização da exclusão de conta;
    - nova versão da Política de Privacidade, com novo aceite.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Cadastro único "Clientes/Fornecedores" | Fora (OPEN-001): cadastros separados. |
| Registrar uma compra que dá entrada no estoque e gera a conta ou a saída de caixa | **SPEC-027** (compras integradas), que usa os fornecedores desta Spec. |
| Fornecedor e forma no lançamento avulso do caixa | Fora (OPEN-008): a compra à vista fica com a SPEC-027. |
| Código IBGE do município, dados de cada nota e emissão de nota fiscal (de saída ou de devolução) | Spec da nota fiscal (pendência "Dados do emitente"), para clientes e fornecedores juntos (OPEN-003). |
| Vários contatos ou endereços por fornecedor | Fora. |
| Boleto, remessa bancária, conciliação e contas bancárias | Fora: o HE tem um caixa só. |
| Centro de custo e plano de contas | Fora: as categorias continuam as fixas (RF32). |
| Botão de exportar na própria lista filtrada | Fora (OPEN-010): a exportação é pelo relatório de Contas. |
| Cliente ou fornecedor no fluxo de caixa (lista de lançamentos) | Fora: o vínculo é da conta; o lançamento leva à conta. |
| Inativar fornecedor sem excluir | Fora (OPEN-004). |
| Nota fiscal de entrada (XML do fornecedor) | Fora. |

---

## 4. Dependências

- **Specs:**
  - SPEC-009: contas, pagamentos, despesas fixas e a lista de contas;
  - SPEC-022: cadastro de clientes (formulário, máscara, exclusão, consultas e selo);
  - SPEC-008: parcelas do cartão e o recebimento automático;
  - SPEC-013: relatório de Contas, geradores de CSV e PDF e o limite do plano gratuito;
  - SPEC-014: exportação dos dados e exclusão de conta;
  - SPEC-005: matriz módulo × ação;
  - SPEC-001: isolamento, `modelos.ts`, RLS e o gatilho de mesmo negócio;
  - SPEC-016: campos, listas, gavetas, avisos e estados vazios;
  - SPEC-018 e SPEC-019: modo suporte e lista fechada de correções.
- **Decisões arquiteturais:** ADR-002 (isolamento), ADR-003 (autorização no servidor), ADR-006 (consultas públicas de CEP e CNPJ).
- **Pré-requisitos externos:** nenhum novo. As consultas de CEP e CNPJ já existem.

---

## 5. Comportamento esperado

### 5.1 Cadastro de fornecedores (OPEN-001 a OPEN-003)

1. **Onde fica:** uma seção **"Fornecedores"** no cabeçalho do Financeiro, ao lado de Caixa, Contas e Despesas fixas, em `/financeiro/fornecedores`. Não há item novo no menu lateral. Os clientes continuam em **Vendas › Clientes** (OPEN-001).
2. **Campos:** os mesmos do cliente (SPEC-022, 5.2), todos opcionais além do nome (OPEN-002):
   - tipo: pessoa física ou empresa;
   - nome (pessoa física) ou razão social (empresa); nome fantasia;
   - CPF ou CNPJ, validado pelos dígitos verificadores, com o CNPJ com letras aceito;
   - situação na inscrição estadual e o número; inscrição municipal;
   - nome do contato (na empresa, quem atende);
   - e-mail e telefone;
   - endereço: CEP, logradouro, número, complemento, bairro, município e UF.
3. **Preenchimento automático:** o CEP preenche o endereço, e o CNPJ preenche a razão social, o nome fantasia, o endereço e, se a base pública tiver, o telefone e o e-mail, só nos campos vazios. Quando a consulta falha, os campos são preenchidos à mão. O CPF nunca é consultado fora (RN42).
4. **Documento único:** o CPF ou CNPJ é único entre os fornecedores ativos do negócio. A recusa diz "Já existe um fornecedor com este CNPJ: {nome}.". Um fornecedor pode ter o mesmo documento de um cliente, porque são cadastros separados.
5. **Selo "Completo para nota"** (OPEN-003): a mesma regra do cliente. A lista mostra o selo e filtra os incompletos, e o detalhe diz o que falta. Nada é bloqueado por isso. O código IBGE do município e os dados de cada nota ficam para a Spec da nota fiscal.
6. **Lista:**
   - busca por nome, razão social, nome fantasia ou documento;
   - em cada linha, o nome, o documento mascarado, o município e a UF, e o selo;
   - ordem alfabética, até 500 fornecedores, com o aviso de usar a busca para encontrar os outros, como a lista de clientes.
7. **Detalhe:**
   - os dados (com a máscara de 5.2);
   - as contas a pagar ligadas ao fornecedor (descrição, nº do documento, vencimento, valor e situação), com link para cada uma, as 50 mais recentes;
   - os totais pago e em aberto;
   - as despesas fixas ligadas a ele.
8. **Mensagens de validação:** as mesmas do cliente, com "fornecedor" no lugar de "cliente".

### 5.2 Permissões e máscara (OPEN-005, OPEN-006)

1. **Fornecedores:** com as permissões do Financeiro, sem mudar a matriz.
   - *Financeiro: ver*: a lista e o detalhe.
   - *Financeiro: criar*: cadastrar.
   - *Financeiro: editar*: editar.
   - *Financeiro: excluir*: excluir.
   - *criar* ou *editar*: consultar o CEP e o CNPJ.
2. **Máscara** (a mesma do cliente, aplicada no servidor):
   - quem pode editar no Financeiro vê tudo;
   - quem só pode ver recebe o documento, o e-mail e o telefone mascarados e, do endereço, só o município e a UF.
3. **Nome do cliente nas contas** (OPEN-006):
   - quem vê o Financeiro vê o nome do cliente nas contas a receber e no filtro;
   - o documento, o contato e o endereço do cliente continuam só na tela de Clientes, com as permissões de Vendas;
   - o link do nome do cliente para a tela dele só aparece para quem tem *Vendas: ver*.
4. **Escolher o cliente na conta a receber:** pede *Financeiro: criar* (ou *editar*, na correção), e a busca mostra só o nome.
5. **"Novo cliente" na conta:** exige também *Vendas: criar*, como na Nova venda.
6. **"Novo fornecedor" na conta e na despesa fixa:** exige *Financeiro: criar*.

### 5.3 Exclusão do fornecedor (OPEN-004)

1. **Sem contas nem despesas fixas ligadas:** o cadastro é apagado.
2. **Com contas ou despesas fixas ligadas:** o fornecedor é **anonimizado**.
   - Todos os dados pessoais ficam vazios, e o nome passa a "Fornecedor anonimizado".
   - As contas e as despesas fixas continuam ligadas a ele, com os mesmos valores, descrição e nº do documento.
3. **Confirmação:** antes de excluir, uma confirmação explica o que vai acontecer, com os mesmos textos da exclusão do cliente, trocando "vendas" por "contas".
4. **Depois de anonimizado:** o fornecedor não aparece na lista, na busca nem no seletor. Nas contas, aparece como "Fornecedor anonimizado". O documento fica livre para um cadastro novo.

### 5.4 Fornecedor, cliente e nº do documento nas contas (OPEN-007)

1. **Conta a pagar manual:** os campos **Fornecedor** (opcional, com busca pelo nome) e **Nº do documento** (opcional, até 40 caracteres, por exemplo o número da nota ou do boleto).
2. **Conta a receber manual:** os campos **Cliente** (opcional, com busca pelo nome no cadastro de clientes) e **Nº do documento**.
3. **Conta a receber de venda no cartão:** o cliente é o da venda, sem edição. O nº do documento pode ser informado.
4. **Despesa fixa:**
   - o campo **Fornecedor** (opcional);
   - cada conta que a despesa gerar a partir daí nasce com esse fornecedor;
   - trocar o fornecedor da despesa não muda as contas já geradas, que podem ser corrigidas uma a uma;
   - o DAS do MEI não tem fornecedor.
5. **Correção a qualquer momento:**
   - o fornecedor ou cliente e o nº do documento podem ser trocados ou apagados em qualquer conta e situação, inclusive quitada, de despesa fixa ou de venda (só o nº do documento);
   - a correção pede *Financeiro: editar* e nunca muda valor, vencimento, situação nem pagamentos (INV-002);
   - valor, vencimento, categoria e descrição seguem a regra de hoje (SPEC-009): só na conta manual sem pagamento.
6. **Na lista e no detalhe:** a lista mostra o fornecedor ou cliente e o nº do documento na linha de cada conta. O detalhe mostra os dois e, quando houver permissão, o link para o fornecedor ou cliente.
7. **Novo fornecedor ou cliente sem sair:** o seletor tem "Novo fornecedor" (ou "Novo cliente"). O formulário do cadastro aparece **no lugar do formulário da conta**, que fica escondido com o que foi digitado, como o "Novo cliente" da Nova venda, que também abre no lugar. Ao salvar, a conta volta com o novo cadastro já escolhido (5.2, itens 5 e 6). Texto ajustado na implementação (divergência resolvida pela equipe, seção 9).

### 5.5 Forma do pagamento (OPEN-008)

1. **Formas:** Dinheiro, Pix, Cartão de débito, Cartão de crédito, Boleto, Transferência e Outra.
2. **Ao registrar o pagamento ou o recebimento** de uma conta (total ou parcial), a forma é obrigatória. Sem ela, aparece "Escolha a forma do pagamento.", e nada é gravado.
3. **Pagamentos antigos:** os registrados antes desta Spec ficam como **"Não informada"**.
4. **Recebimento automático** das parcelas do cartão no vencimento (SPEC-008): grava **Cartão de crédito**, a forma da venda.
5. **Onde aparece:** no histórico de pagamentos do detalhe da conta ("05/10/2026 · Pix · R$ 100,00 · por {nome}"), no filtro (5.6) e no relatório de Contas (5.7).
6. **Fora desta Spec:** o lançamento avulso do caixa não muda. A compra à vista fica com a SPEC-027.

### 5.6 Busca, filtros e totais da lista de contas (OPEN-009)

1. **Continuam como hoje:** os segmentos **A pagar / A receber** e **Situação** (Em aberto, Atrasadas, Quitadas, Canceladas, Todas).
2. **Novos filtros**, que se somam:
   - **Busca:** texto na descrição ou no nº do documento, sem diferenciar maiúsculas e minúsculas;
   - **Vencimento de / até**;
   - **Pagamento de / até:** contas com ao menos um pagamento ou recebimento no período;
   - **Fornecedor** (a pagar) ou **Cliente** (a receber);
   - **Forma do pagamento:** contas com ao menos um pagamento na forma escolhida, inclusive "Não informada";
   - **Categoria:** as cinco fixas;
   - **Origem:** manual, despesa fixa ou venda no cartão.
3. **Datas:** a data "até" não pode ser anterior à "de" ("A data final precisa ser igual ou posterior à inicial."). As datas usam o dia no horário do negócio (RN29).
4. **Totais da lista filtrada**, acima da lista e somando todas as páginas:
   - quantidade de contas;
   - **Total:** soma dos valores das contas, sem as canceladas;
   - **Pago:** soma do que foi pago ou recebido. Com filtro de data do pagamento ou de forma, soma só os pagamentos que atendem ao filtro;
   - **Em aberto:** soma do que falta pagar ou receber nas contas em aberto ou parciais.
5. **No celular:** os filtros ficam recolhidos num botão **"Filtros"**, com a quantidade de filtros ativos, e um **"Limpar filtros"**.
6. **Endereço da página:** os filtros ficam no endereço, para recarregar, voltar do detalhe e compartilhar com a equipe.
7. **Ordem e páginas:** como hoje. Vencimento crescente nas em aberto e atrasadas; decrescente nas quitadas, canceladas e "Todas" com filtro de pagamento. 100 contas por página.
8. **Plano gratuito:** quitadas e canceladas só dos últimos 12 meses, com o aviso de hoje (SPEC-013). Os totais seguem o mesmo limite.
9. **Lista vazia:** "Nenhuma conta com estes filtros.", com o link "Limpar filtros".

### 5.7 Relatório de Contas (OPEN-010)

1. Não há botão de exportar na lista. A exportação continua pelo **relatório de Contas** dos Relatórios (plano pago, CSV e PDF, por período de vencimento).
2. O relatório ganha as colunas:
   - **Fornecedor/Cliente:** o nome; "Fornecedor anonimizado" ou "Cliente anonimizado" quando for o caso;
   - **Nº do documento**;
   - **Pagamentos:** a data, a forma e o valor de cada pagamento, juntos na mesma célula, como a coluna "Pagamento" do relatório de vendas (por exemplo, "05/10/2026 Pix 100,00 + 20/10/2026 Boleto 50,00").
3. O CSV continua no padrão brasileiro, e o PDF cabe na página, com as larguras reequilibradas.

### 5.8 Modo suporte (OPEN-011)

1. **Fornecedores no modo suporte** (SPEC-018), com o Financeiro liberado:
   - o Administrador vê a lista e o detalhe com **tudo mascarado, inclusive o nome**, como os clientes;
   - não cadastra, não edita, não exclui e não consulta CEP nem CNPJ.
2. **Contas e despesas fixas no modo suporte:** o nome do fornecedor ou cliente aparece mascarado. O nº do documento e a forma aparecem.
3. **Correções do suporte (SPEC-019, quando implementada):**
   - nenhuma ação de fornecedor entra na lista fechada;
   - nas correções "Criar conta", "Editar conta", "Criar despesa fixa" e "Editar despesa fixa", o fornecedor ou cliente e o nº do documento **ficam como estão** (na criação, vazios);
   - a forma do pagamento não se aplica, porque o suporte nunca registra pagamento.

### 5.9 LGPD (OPEN-012)

1. **Exportação dos dados (SPEC-014):** inclui os fornecedores, os vínculos das contas e das despesas fixas, o nº do documento e a forma de cada pagamento.
2. **Exclusão de conta do Dono (RN27):** anonimiza também todos os fornecedores dos negócios em que ele é o único Dono, como os clientes. As contas são mantidas pelo prazo legal, sem identificação.
3. **Exclusão de um fornecedor sozinho:** 5.3.
4. **Política de Privacidade:**
   - nova versão, que inclui os fornecedores pessoa física entre os dados que o negócio guarda (e os Termos, se precisar);
   - o aceite é pedido de novo no próximo acesso, como na SPEC-022;
   - os campos entre colchetes continuam na pendência dos textos legais.

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | O fornecedor só é ligado a contas a pagar e a despesas fixas; o cliente, só a contas a receber; os dois sempre do mesmo negócio da conta. O banco recusa o contrário. | Teste de integração com gravação direta. |
| **INV-002** | Corrigir o fornecedor, o cliente ou o nº do documento nunca muda valor, vencimento, categoria, situação nem pagamentos da conta. | Teste de integração comparando antes e depois. |
| **INV-003** | Todo pagamento ou recebimento de conta registrado depois desta Spec tem forma. O recebimento automático das parcelas grava Cartão de crédito, e os pagamentos antigos ficam sem forma ("Não informada"). | Teste de integração do pagamento, do recebimento automático e da migração. |
| **INV-004** | Os dados do fornecedor chegam mascarados a quem só pode ver e, no suporte, inclusive o nome. A máscara é aplicada no servidor, e o CPF nunca vai a serviço externo. | Teste de integração por papel e no suporte; teste do adaptador de consulta. |
| **INV-005** | O CPF ou CNPJ do fornecedor é válido e único entre os fornecedores ativos do negócio. | Teste unitário da validação; teste de integração da unicidade. |
| **INV-006** | Excluir um fornecedor sem contas nem despesas o apaga. Com elas, o fornecedor é anonimizado, e as contas e despesas ficam ligadas a ele com os mesmos valores. | Teste de integração. |
| **INV-007** | Os totais são a soma de todas as contas filtradas (não só da página), com os mesmos filtros da lista e o limite do plano. | Teste de integração com mais de uma página e no plano gratuito. |
| **INV-008** | Fornecedores, filtros e totais só trazem dados do próprio negócio. | Teste de integração com dois negócios. |
| **INV-009** | O suporte nunca cria, altera ou exclui fornecedores, nem muda o fornecedor, o cliente ou o nº do documento de uma conta. | Teste de integração no contexto de suporte. |

---

## 7. Modelo de domínio envolvido

| Entidade | Uso | Mudança |
|---|---|---|
| `Fornecedor` | Cadastro de fornecedores do negócio | **Nova:** os mesmos campos do `Cliente` (tipo, nome, nome fantasia, documento, situação e nº da IE, IM, nome do contato, e-mail, telefone, endereço), datas de criação e atualização e `anonimizadoEm` |
| `ContaPagarReceber` | Contas a pagar e a receber | **+ `fornecedorId`** (opcional, só a pagar), **+ `clienteId`** (opcional, só a receber manual) e **+ `numeroDocumento`** (opcional, até 40 caracteres) |
| `DespesaFixa` | Despesas fixas e o DAS | **+ `fornecedorId`** (opcional; nulo no DAS) |
| `LancamentoFinanceiro` | Lançamento de cada pagamento de conta | **+ `formaPagamento`** (opcional no banco; obrigatória nos pagamentos novos de conta; nula nos antigos e nos lançamentos que não são de conta) |
| `Cliente` | Cadastro de clientes (SPEC-022) | Nenhuma: passa a ser ligado também às contas a receber |
| `Venda`, `Parcela` | Cliente da venda e parcelas do cartão | Nenhuma: o cliente da conta de venda é lido da venda |

**Mudanças previstas no schema:**
- tabela `Fornecedor` com `@@unique([negocioId, documento])`, índice por negócio, RLS e o modelo em `modelos.ts`;
- enum da forma do pagamento da conta (Dinheiro, Pix, Débito, Crédito, Boleto, Transferência, Outra);
- colunas novas em `ContaPagarReceber`, `DespesaFixa` e `LancamentoFinanceiro`, com índices por fornecedor e por cliente;
- CHECKs para o fornecedor só na conta a pagar e o cliente só na conta a receber;
- gatilho de mesmo negócio para `fornecedorId` e `clienteId`;
- migração sem dados novos: as contas existentes ficam sem vínculo, e os pagamentos existentes, sem forma.

---

## 8. Impacto arquitetural

- `prisma/schema.prisma` e uma migração: a tabela, o enum, as colunas, os CHECKs, o gatilho de mesmo negócio, a RLS e os índices (seção 7).
- `src/lib/dominio/`:
  - validação e máscara do fornecedor, reaproveitando as do cliente;
  - leitura e validação dos filtros das contas;
  - rótulos das formas.
- `src/lib/db/fornecedores.ts` (novo): lista com busca e filtro, detalhe com as contas, criar, editar e excluir (apagar ou anonimizar), sempre com a máscara pela permissão.
- `src/lib/db/financeiro.ts`:
  - vínculo e nº do documento na criação, na edição e na correção das contas;
  - fornecedor na despesa fixa e na geração das contas;
  - forma no pagamento e no recebimento automático;
  - filtros e totais calculados no banco.
- `src/lib/db/relatorios.ts` e `src/lib/relatorios/tabelas.ts`: as colunas novas do relatório de Contas.
- `src/lib/db/lgpd.ts`: fornecedores na exportação e na anonimização da exclusão de conta.
- **Ações e telas:**
  - seção Fornecedores (lista, novo, detalhe e edição), reaproveitando o formulário do cliente com o rótulo trocado;
  - seletor de fornecedor ou cliente e "Novo fornecedor/cliente" em gaveta;
  - campo do nº do documento;
  - forma no "Registrar pagamento";
  - filtros e totais na lista de contas.
- Política de Privacidade: nova versão e novo aceite.
- SPEC-019 (quando implementada): nenhuma correção nova; as correções de conta e de despesa fixa mantêm os campos novos como estão.
- Sem permissão nova e sem integração externa nova.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Listar fornecedores** | busca?, filtro? ("incompletos") | [{id, tipo, nome, documento mascarado, município/UF, completoParaNota}] | `SemPermissao` |
| **Detalhar fornecedor** | id | dados (completos ou mascarados conforme a permissão), o que falta para nota, contas [{id, descrição, nº do documento, vencimento, valor, situação}] (até 50), totais pago e em aberto, despesas fixas | `NaoEncontrado`, `SemPermissao` |
| **Cadastrar / editar fornecedor** | os campos do cliente | fornecedor (com a máscara de quem gravou) | `CampoInvalido`, `DocumentoInvalido`, `DocumentoRepetido`, `NaoEncontrado`, `SemPermissao`, `ForaDaListaDeCorrecoes` |
| **Excluir fornecedor** | id | {resultado: "apagado" ou "anonimizado"} | `NaoEncontrado`, `SemPermissao`, `ForaDaListaDeCorrecoes` |
| **Consultar CEP / CNPJ do fornecedor** | cep ou cnpj | os dados da consulta (como no cliente) | `CampoInvalido`, `DocumentoInvalido`, `NaoEncontrado`, `ConsultaIndisponivel`, `SemPermissao` |
| **Criar / editar conta** (SPEC-009) | + fornecedorId? ou clienteId?, numeroDocumento? | Sem mudança | + `FornecedorNaoEncontrado`, `ClienteNaoEncontrado`, `CampoInvalido` (nº do documento longo) |
| **Corrigir vínculo da conta** | contaId, fornecedorId? ou clienteId?, numeroDocumento? | conta | `ContaNaoEncontrada`, `FornecedorNaoEncontrado`, `ClienteNaoEncontrado`, `SemPermissao`, `ForaDaListaDeCorrecoes` |
| **Pagar / receber conta** (SPEC-009) | + forma | Sem mudança | + `FormaObrigatoria` |
| **Criar / editar despesa fixa** (SPEC-009) | + fornecedorId? | Sem mudança | + `FornecedorNaoEncontrado` |
| **Listar contas** (SPEC-009) | + busca?, vencimento de/até?, pagamento de/até?, fornecedorId? ou clienteId?, forma?, categoria?, origem? | + fornecedor ou cliente e nº do documento em cada conta; totais {quantidade, total, pago, em aberto} | + `DataInvalida`, `PeriodoInvalido` |
| **Relatório de Contas** (SPEC-013) | Sem mudança | + Fornecedor/Cliente, Nº do documento, Pagamentos | — |
| **Exportação dos dados** (SPEC-014) | Sem mudança | + fornecedores, vínculos, nº do documento e forma | — |

**Implementação (01/11/2026):**
- **Banco** (migração `20261101200000_fornecedores`):
  - tabela `Fornecedor` com os mesmos campos e CHECKs do cliente (documento, campos de empresa, inscrições, CEP, UF e anonimizado sem dados), documento único no negócio e RLS;
  - enum `FormaPagamentoConta`; colunas `fornecedorId`, `clienteId` e `numeroDocumento` nas contas, `fornecedorId` na despesa fixa e `formaPagamento` no lançamento;
  - CHECKs: fornecedor só na conta a pagar; cliente só na conta a receber manual; nº do documento não vazio; despesa com fornecedor só na manual; forma só em lançamento de conta;
  - gatilho de mesmo negócio para o fornecedor e o cliente da conta e para o fornecedor da despesa;
  - as chaves estrangeiras recusam apagar um fornecedor ou um cliente que tenha contas;
  - nenhum dado é alterado: as contas antigas ficam sem vínculo, e os pagamentos antigos, sem forma.
- **Domínio:**
  - `src/lib/dominio/contas.ts`: formas e rótulos, origens, leitura e validação dos filtros, contagem dos filtros ativos e as listas dos seletores;
  - a validação do cliente serve ao fornecedor, com a mensagem própria.
- **Dados:**
  - `src/lib/db/fornecedores.ts` (novo), com a exibição e a máscara do cliente reaproveitadas;
  - `src/lib/db/financeiro.ts`:
    - vínculo e nº do documento na criação, na edição e na correção;
    - fornecedor na despesa fixa e nas contas que ela gera;
    - forma no pagamento e no recebimento automático;
    - filtros e totais calculados no banco;
    - o nome mascarado no modo suporte;
  - relatório de Contas com as colunas novas;
  - LGPD: fornecedores na exportação e na exclusão de conta.
- **Serviços e ações:**
  - `src/lib/fornecedores/` (cadastro, edição, exclusão e as consultas de CEP e CNPJ, com as permissões do Financeiro);
  - a correção do vínculo (Financeiro — editar);
  - `src/lib/financeiro/opcoes.ts` com as listas dos seletores.
- **Telas:**
  - aba "Fornecedores" no Financeiro (lista, novo, detalhe e edição), com o formulário do cliente (`pessoa="fornecedor"`);
  - seletor e nº do documento na conta, "Novo fornecedor/cliente" e a correção no detalhe;
  - forma no "Registrar pagamento";
  - fornecedor na despesa fixa;
  - filtros e totais na lista de contas, com o painel recolhido no celular.
- **Política e Termos:** versão 2026-11-01, com o resumo na página do novo aceite.
- **Testes:** `test/unit/fornecedores.test.ts` (T01, T02, T07 e a parte unitária do T09) e `test/integracao/fornecedores.test.ts` (T03 a T06, T08 a T10).

**Divergência encontrada na implementação (resolvida pela equipe, 01/11/2026):** o item 5.4.7 e o CA-07 diziam que o "Novo fornecedor" abria "numa gaveta, como o Novo cliente da Nova venda". Mas a Nova venda abre o formulário no próprio lugar, e a nova conta já fica dentro de uma gaveta. Propostas:
1. manter o formulário no lugar da conta e ajustar o texto da Spec;
2. abrir uma segunda gaveta por cima da primeira.

**Decisão da equipe: opção 1.** O texto do 5.4.7 e do CA-07 foi ajustado, sem mudança de código.

**Decisões de implementação (sem mudar o comportamento da Spec):**
- **Cliente com contas a receber:** como a conta a receber pode ser ligada a um cliente, excluir um cliente que tenha contas (mesmo sem vendas) anonimiza, em vez de apagar, e a confirmação diz isso. A Política e os Termos dizem o mesmo.
- **Tipo inicial:** o novo fornecedor começa como empresa, o caso mais comum.
- **Correção no detalhe:** a conta manual sem pagamento tem o formulário completo, com o vínculo. As demais têm o bloco "Corrigir o fornecedor e o documento", ou só "Corrigir o documento" na conta de venda.
- **Totais:** aparecem sempre, mesmo sem filtro. Com filtro, uma nota diz o que somam.
- **Forma:** o seletor começa em "Selecione…", sem forma pré-escolhida.
- **Detalhe do fornecedor:** com mais de 50 contas, um link leva às contas dele já filtradas.
- **Relatório de Contas no PDF:** as larguras foram medidas na fonte do PDF, e a linha de total tem "A receber" e "A pagar" em células separadas. Descrições longas e mais de um pagamento podem ser cortados no PDF; no CSV, ficam inteiros. Encontrado no roteiro.
- **Telas:** os filtros usam seis colunas no computador, para as datas caberem inteiras, e o fornecedor e o documento ficam empilhados na conta. Encontrado no roteiro.

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação nesta Spec | Verificação |
|---|---|---|
| **RNF01** | Fornecedores, conta com o seletor, pagamento com a forma e lista com filtros e totais legíveis no celular, sem rolagem horizontal. | Capturas em 390, 768 e 1440 px, claro e escuro, em build de produção com login; axe sem violações. |
| **RNF02** | Fornecedores e vínculos isolados por negócio (RLS e gatilho de mesmo negócio). | INV-001, INV-008. |
| **RNF04** | Fornecedores na exportação e na anonimização; máscara pela permissão e no suporte; nova versão da Política com novo aceite. | INV-004, INV-006 e testes da exportação e da exclusão de conta. |
| **RNF06** | Filtros e totais calculados no banco, com índices, sem carregar todas as contas na memória. | Lista filtrada com 5.000 contas e 10.000 pagamentos em até 1 s no build local. |

---

## 11. Critérios de aceitação

**CA-01 — Cadastrar fornecedor.** Dado alguém com *Financeiro: criar*, quando cadastra um fornecedor empresa digitando o CNPJ, então a razão social, o nome fantasia e o endereço aparecem, e o fornecedor entra na lista. Só o nome é obrigatório.

**CA-02 — Documento repetido.** Dado um fornecedor ativo com um CNPJ, quando alguém cadastra outro fornecedor com o mesmo CNPJ, então aparece "Já existe um fornecedor com este CNPJ: {nome}.". Um cliente com o mesmo CNPJ não impede.

**CA-03 — Selo para nota.** Dado um fornecedor sem endereço, então a lista mostra que está incompleto, o filtro "incompletos" o encontra, e o detalhe diz o que falta.

**CA-04 — Máscara.** Dado alguém com *Financeiro: ver* sem *editar*, quando abre o detalhe de um fornecedor, então o documento, o e-mail e o telefone aparecem mascarados e, do endereço, só o município e a UF. Quem tem *editar* vê tudo.

**CA-05 — Excluir.** Dado um fornecedor sem contas, quando é excluído, então o cadastro some. Dado um fornecedor com contas, quando é excluído, então ele vira "Fornecedor anonimizado", e as contas continuam com os mesmos valores.

**CA-06 — Conta com fornecedor e documento.** Quando alguém cria uma conta a pagar com fornecedor e nº do documento 1234, então a lista e o detalhe mostram os dois. Quando cria uma conta a receber, então escolhe um cliente, e o nome dele aparece para quem vê o Financeiro, mesmo sem *Vendas: ver*.

**CA-07 — Novo fornecedor sem sair da conta.** Quando alguém escolhe "Novo fornecedor" na conta, então o formulário do fornecedor aparece no lugar da conta, que fica escondida com o que foi digitado, e, ao salvar, a conta volta com o fornecedor já escolhido. Sem *Vendas: criar*, o "Novo cliente" não aparece na conta a receber.

**CA-08 — Correção a qualquer momento.** Dada uma conta quitada, quando alguém com *Financeiro: editar* troca o fornecedor e o nº do documento, então eles mudam, e valor, vencimento, situação e pagamentos ficam iguais.

**CA-09 — Despesa fixa.** Dada uma despesa fixa com fornecedor, quando a conta do mês é gerada, então ela nasce com esse fornecedor. Trocar o fornecedor da despesa não muda as contas já geradas.

**CA-10 — Forma obrigatória.** Quando alguém registra um pagamento sem escolher a forma, então aparece "Escolha a forma do pagamento.", e nada é gravado. Com Pix, o histórico mostra "Pix". Os pagamentos de antes desta Spec mostram "Não informada", e a parcela do cartão recebida no vencimento mostra "Cartão de crédito".

**CA-11 — Filtros.** Dadas contas de dois fornecedores, pagas por Pix e por boleto em setembro e outubro, quando alguém filtra fornecedor A, pagamento de 01/10 a 31/10 e forma Pix, então só aparecem as contas do fornecedor A com pagamento por Pix em outubro.

**CA-12 — Totais.** Dados os filtros do CA-11, então o topo mostra a quantidade, o total, o pago (só os pagamentos por Pix em outubro) e o em aberto, somando todas as páginas.

**CA-13 — Busca e período.** Quando alguém busca "1234", então aparece a conta com esse nº do documento ou essa descrição. Quando a data final é anterior à inicial, então aparece "A data final precisa ser igual ou posterior à inicial.".

**CA-14 — Plano gratuito.** Dado um negócio no plano gratuito com contas quitadas há mais de 12 meses, quando alguém filtra as quitadas, então elas não aparecem, nem nos totais, e o aviso do plano aparece.

**CA-15 — Relatório de Contas.** Dado o plano pago, quando alguém baixa o relatório de Contas, então o CSV e o PDF trazem as colunas Fornecedor/Cliente, Nº do documento e Pagamentos (data, forma e valor de cada um).

**CA-16 — Suporte.** Dado o Administrador em modo suporte com o Financeiro liberado, então os fornecedores e os nomes nas contas aparecem mascarados, inclusive o nome, e nenhuma ação de fornecedor nem correção de vínculo é aceita.

**CA-17 — LGPD.** Quando o Dono exporta os dados, então os fornecedores, os vínculos e as formas aparecem. Quando o único Dono exclui a conta, então os fornecedores ficam anonimizados. No próximo acesso depois da nova versão, a Política pede o aceite.

**CA-18 — Visual.** Dadas as telas de fornecedores, a conta com o seletor, o pagamento com a forma e a lista com filtros e totais, em 390, 768 e 1440 px, claro e escuro, então nada rola na horizontal, e o axe não aponta violações.

---

## 12. Casos de teste derivados

| # | Teste | Tipo | Cobre |
|---|---|---|---|
| T01 | Validação do fornecedor (campos, documento, CNPJ com letras), máscara por permissão e regra "completo para nota" | Unitário | CA-01, CA-03, CA-04, INV-004, INV-005 |
| T02 | Leitura e validação dos filtros das contas (datas, período invertido, forma, categoria, origem) | Unitário | CA-13 |
| T03 | Fornecedores no banco: criar, editar, documento repetido, apagar, anonimizar, outro negócio fora | Integração | CA-01, CA-02, CA-05, INV-005, INV-006, INV-008 |
| T04 | Vínculos: fornecedor só em conta a pagar e despesa, cliente só em conta a receber, mesmo negócio (banco recusa o contrário); correção sem mudar valores; despesa fixa repassa | Integração | CA-06, CA-08, CA-09, INV-001, INV-002 |
| T05 | Forma do pagamento: obrigatória, recebimento automático com cartão de crédito, antigos sem forma | Integração | CA-10, INV-003 |
| T06 | Filtros e totais no banco, com várias páginas, combinações de filtros e plano gratuito | Integração | CA-11, CA-12, CA-14, INV-007 |
| T07 | Permissões das ações de fornecedor e do vínculo, por papel; nome do cliente para quem vê o Financeiro; "Novo cliente" só com *Vendas: criar* | Integração | CA-04, CA-06, CA-07 |
| T08 | Suporte: fornecedores e nomes mascarados; ações e correção de vínculo recusadas | Integração | CA-16, INV-009 |
| T09 | Relatório de Contas com as colunas novas (CSV e PDF) | Unitário + integração | CA-15 |
| T10 | LGPD: exportação e anonimização na exclusão de conta | Integração | CA-17 |
| T11 | Roteiro no navegador: cadastrar fornecedor pelo CNPJ, conta com fornecedor e documento, "Novo fornecedor" na gaveta, pagar com forma, filtrar e conferir os totais, corrigir conta quitada, baixar o relatório, Política com novo aceite | Manual com captura | CA-01 a CA-17 |
| T12 | Telas em 390, 768 e 1440 px, claro e escuro, em build de produção com login, e axe | Manual com captura | CA-18 |
| T13 | Homologação: fornecedores reais do negócio de teste, contas com documento, pagamentos com forma e os filtros pedidos pela usuária | Manual (uma vez) | CA-01 a CA-15 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 01/11/2026, em entrevista. A OPEN-002 foi decidida por escolha da equipe, e as demais pela opção recomendada:

| ID | Decisão |
|---|---|
| **OPEN-001** — Cadastro único ou separado | **Separado, no Financeiro** (recomendada): seção "Fornecedores" no cabeçalho do Financeiro, reaproveitando o formulário e as consultas do cliente; os clientes continuam em Vendas, sem mudar a SPEC-022. Os clientes aparecem no Financeiro pelo vínculo nas contas a receber (OPEN-006). Descartado: cadastro único "Clientes/Fornecedores", que exigiria rever as permissões e a LGPD da SPEC-022 e mexeria na Nova venda. |
| **OPEN-002** — Campos do fornecedor | **Os mesmos campos do cliente, com endereço pelo CEP e inscrições** (escolha da equipe), mais os dados para a futura nota (OPEN-003). Prepara o cadastro para uma futura nota de entrada ou de devolução. Descartada: só identificação e contato, sem endereço nem inscrições (a recomendada, pela minimização da LGPD). |
| **OPEN-003** — Dados para a nota | **Campos do cliente e selo "Completo para nota"** (recomendada), com filtro e a lista do que falta, útil para uma devolução de compra. O código IBGE do município e os dados de cada nota entram com a Spec da nota fiscal, para clientes e fornecedores juntos. Descartadas: incluir já o código IBGE em clientes e fornecedores (integração nova e mudança na SPEC-022); só os campos, sem selo. |
| **OPEN-004** — Exclusão | **Como os clientes** (recomendada): sem contas, apaga; com contas, anonimiza, e as contas continuam com o nº do documento e a descrição. Descartado: inativar quando tiver contas. |
| **OPEN-005** — Permissões e máscara | **Permissões do Financeiro** (recomendada), sem mudar a matriz; quem só pode ver recebe o documento, o telefone e o e-mail mascarados; quem pode editar vê tudo. Descartadas: Financeiro sem máscara; só Dono e Gerente. |
| **OPEN-006** — Nome do cliente no Financeiro | **Quem vê o Financeiro** (recomendada) vê o nome do cliente na conta e no filtro. O documento, o contato e o endereço continuam só na tela de Clientes, e cadastrar um cliente pela conta exige *Vendas: criar*. Descartado: nome mascarado para quem não vê Vendas. |
| **OPEN-007** — Vínculo e nº do documento | **Opcionais e corrigíveis a qualquer hora** (recomendada): fornecedor nas contas a pagar e nas despesas fixas, cliente nas contas a receber e nº do documento. A despesa fixa repassa o fornecedor às próximas contas. Os três campos podem ser corrigidos mesmo com a conta paga, porque não mexem em valores. Dá para cadastrar o fornecedor sem sair da conta. Descartadas: trocar só enquanto a conta é editável; obrigatório nas contas novas. |
| **OPEN-008** — Forma do pagamento | **Obrigatória, só nas contas** (recomendada): Dinheiro, Pix, Cartão de débito, Cartão de crédito, Boleto, Transferência ou Outra. Os antigos ficam "Não informada", e o recebimento automático das parcelas usa a forma da venda. O lançamento avulso não muda, e a compra à vista fica com a SPEC-027. Descartadas: opcional; obrigatória também no lançamento avulso. |
| **OPEN-009** — Filtros | **Todos os filtros e totais** (recomendada): vencimento, data do pagamento, cliente ou fornecedor, forma, busca na descrição e no nº do documento, categoria e origem, com os totais da lista filtrada. Valem nos dois planos, com o limite de 12 meses do gratuito. Descartadas: só os quatro pedidos pela usuária; os pedidos com busca e totais. |
| **OPEN-010** — Exportar | **Pelos Relatórios** (recomendada): sem botão novo na lista; o relatório de Contas (plano pago) ganha o fornecedor ou cliente, o nº do documento e os pagamentos. Descartados: botão de CSV na lista, no plano pago ou nos dois planos. |
| **OPEN-011** — Suporte | **Como os clientes** (recomendada): fornecedores mascarados, inclusive o nome, e nunca alterados pelo suporte; nas correções de conta e de despesa fixa, o vínculo, o nº do documento e a forma ficam como estão. Ajuste anotado na SPEC-019. Descartado: o suporte corrigir o vínculo e ver o nome da empresa sem máscara. |
| **OPEN-012** — Política de Privacidade | **Nova versão com novo aceite** (recomendada), como na SPEC-022. Descartado: atualizar o texto sem pedir o aceite de novo. |

**Decisões derivadas do pedido e da baseline (sem questão nova):**
- o fornecedor pode ter o **mesmo documento de um cliente**, porque os cadastros são separados;
- o **detalhe do fornecedor** mostra as contas e as despesas fixas dele, como o detalhe do cliente mostra as compras;
- a conta de **venda no cartão** usa o cliente da venda, sem edição. Ela aceita o nº do documento;
- o **DAS do MEI** não tem fornecedor;
- com filtro de **data do pagamento** ou de **forma**, o total "Pago" soma só os pagamentos que atendem ao filtro;
- no relatório de Contas, os pagamentos de uma conta ficam **numa coluna só**, com a data, a forma e o valor de cada um, porque uma conta pode ter vários pagamentos;
- o **nº do documento** tem até 40 caracteres e não precisa ser único;
- o **link** do nome do cliente na conta para a tela de Clientes só aparece para quem vê Vendas.

---

## 14. Definition of Done da Spec

A SPEC-026 estará concluída quando:

- [x] todos os critérios de aceitação (CA-01 a CA-18) estiverem implementados — por testes e no navegador (build local, 01/11/2026). O modo suporte (CA-16) foi conferido pelo T08;
- [x] todos os invariantes (INV-001 a INV-009) estiverem preservados — testes T01 a T10 e o roteiro;
- [ ] os testes derivados (T01 a T13) estiverem aprovados, com o CI verde no PR — T01 a T12 aprovados; falta a homologação (T13);
- [x] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF06) tiverem sido verificados como descrito na seção 10:
  - capturas em 390, 768 e 1440 px nos dois temas, com o axe;
  - isolamento (T03, T06) e exportação (T10);
  - 5.000 contas e 10.000 pagamentos filtrados em menos de 300 ms;
- [x] as questões OPEN-001 a OPEN-012 tiverem sido decididas e registradas (01/11/2026):
  - na baseline, RF89, RF90 e RN42 incluídos;
  - RF30, RF31, RF67, RF71, RN22, RN27 e RN36 alterados;
- [x] não existir divergência conhecida entre a implementação e esta Spec — a do "Novo fornecedor" foi resolvida pela equipe (seção 9);
- [x] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada nos documentos — nenhuma em relação à baseline.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio. A divergência é registrada com duas propostas, (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
