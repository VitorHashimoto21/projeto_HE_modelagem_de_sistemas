# SPEC-022 — Cliente com dados completos

> **Status:** 🟢 **Aprovada em 22/10/2026.** As questões em aberto foram decididas pela equipe em entrevista (seção 13); as OPEN-001 a OPEN-008, todas pela opção recomendada:
> - a tela de Clientes fica **dentro de Vendas**, com as permissões de Vendas;
> - o documento aparece **mascarado na lista**, e completo só para quem pode editar clientes;
> - o cliente pode ser **pessoa física ou empresa**;
> - o endereço é preenchido **pelo CEP**, e os dados da empresa **pelo CNPJ**;
> - **excluir** apaga o cliente sem vendas e anonimiza o que tem vendas;
> - o cadastro "completo para nota" vira **selo e aviso**, sem bloquear nada;
> - o **CNPJ com letras** passa a valer no cliente e no próprio negócio;
> - o detalhe do cliente mostra **os dados e as compras**;
> - depois de comparar com o cadastro de clientes de um ERP de mercado (vídeo da equipe, 22/10/2026), entram o **nome fantasia**, a **inscrição municipal** e o preenchimento de **telefone e e-mail pelo CNPJ** (OPEN-009).
>
> A baseline foi ajustada: RF22, RF58 e RF76 e a RN27 alterados; RF81 e RN36 novos. Gerada conforme `docs/Prompt_SDD_Specs.pdf` (prompt complementar), a partir da revisão de uma profissional da área financeira e contábil que está montando uma loja de semijoias (19/10/2026).
>
> **Mapa:** [`MAPA_DE_SPECS.md`](../MAPA_DE_SPECS.md)
> - **Altera:** [SPEC-008](SPEC-008.md) (cliente na Nova venda), [SPEC-004](SPEC-004.md) (CNPJ com letras no cadastro e nos Dados do negócio), [SPEC-014](SPEC-014.md) (exportação e anonimização) e [SPEC-018](SPEC-018.md) (máscara do modo suporte).
> - **Usa:** [SPEC-001](SPEC-001.md) (isolamento), [SPEC-005](SPEC-005.md) (permissões), [SPEC-011](SPEC-011.md) (a troca mantém o cliente), [SPEC-016](SPEC-016.md) (componentes), [SPEC-020](SPEC-020.md) (padrão de tela própria dentro de um módulo e o "voltar") e [SPEC-021](SPEC-021.md) (opção "Emito nota fiscal de produtos").

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | SPEC-022 |
| **Nome** | Cliente com dados completos |
| **Objetivo** | Permitir que o negócio guarde os dados dos seus clientes que a nota fiscal pede (CPF ou CNPJ, endereço, inscrição estadual) e os de contato (e-mail e telefone), todos **opcionais**, numa tela de Clientes. A proteção segue a LGPD: o documento e o endereço só aparecem completos para quem pode editar clientes, o suporte vê tudo mascarado, e o cliente pode ser excluído a pedido. |
| **Valor entregue** | O negócio para de manter uma planilha à parte com os dados dos clientes. O endereço sai do CEP e os dados da empresa saem do CNPJ, sem digitar tudo. Um selo mostra quem já tem o cadastro completo para nota fiscal, e o detalhe mostra o que cada cliente já comprou. Quando a emissão de nota entrar no sistema, os dados já estarão lá. |

### Por que esses dados

A nota fiscal pede dados diferentes conforme o tipo de nota e o tipo de cliente (as regras variam por estado; o negócio confirma com o contador):

| Situação | O que a nota pede do cliente |
|---|---|
| **NF-e para pessoa física** (ex.: venda com entrega) | Nome, CPF e endereço completo. |
| **NF-e para empresa** | Razão social, CNPJ, endereço completo e a situação na inscrição estadual (contribuinte do ICMS, isenta ou não contribuinte). |
| **NFC-e** (venda no balcão para consumidor) | Normalmente nada: o CPF entra se o cliente pedir. Alguns estados exigem a identificação na entrega em domicílio ou acima de certo valor. |
| **MEI vendendo para pessoa física** | O MEI é dispensado de emitir nota. Para empresa, é obrigado. |

Por isso todos os campos são **opcionais**, e o sistema só **avisa** quando o cadastro está incompleto para nota fiscal (OPEN-006). A emissão da nota continua pós-MVP.

**Dados pessoais e LGPD.** CPF, endereço, e-mail e telefone de pessoa física são dados pessoais. O negócio é o **controlador** e o HE é o **operador** (Política de Privacidade). As bases legais que cabem ao negócio são a **obrigação legal** (emitir nota fiscal, art. 7º, II) e a **execução de contrato** (entregar e cobrar, art. 7º, V). Não é preciso consentimento para guardar esses dados com essas finalidades. Mandar promoções é outra finalidade e fica fora desta Spec. CNPJ e razão social de empresa não são dados pessoais, mas o nome, o e-mail e o telefone de quem compra pela empresa são.

### Exemplo que originou a Spec

A loja de semijoias vende no balcão, pelo Instagram com entrega, e para revendedoras com CNPJ.
- **Hoje:** o cliente só tem nome e um campo livre de contato, e só é cadastrado durante a venda. Os CPFs e os endereços ficam num caderno, e não há como ver o que cada cliente já comprou.
- **Com esta Spec:**
  - na tela **Vendas › Clientes**, a loja cadastra a cliente Ana como pessoa física, com CPF, e digita o CEP; rua, bairro, município e UF aparecem sozinhos, e ela completa o número. O selo vira **"Completo para nota"**;
  - a revendedora "Bella Acessórios Ltda" é cadastrada como empresa: o CNPJ preenche a razão social e o endereço, e a loja marca a situação na inscrição estadual;
  - a colaboradora que atende no balcão vê os clientes e cadastra novos na venda, mas vê o CPF da Ana mascarado (`***.456.789-**`);
  - no detalhe da Ana, a loja vê as 4 compras dela e o total comprado;
  - meses depois, a Ana pede para ter os dados apagados. A loja toca em "Excluir": como ela tem compras, o cadastro é anonimizado, e as vendas continuam no caixa e nos relatórios, sem identificação.

---

## 2. Rastreabilidade

| Tipo | Itens | Como esta Spec atende / altera |
|---|---|---|
| **RF** | **RF22** | **Alterado:** a venda continua com cliente opcional. O cliente passa a ter tipo, documento, endereço, e-mail e telefone, todos opcionais além do nome, e é cadastrado também na tela de Clientes. |
| | **RF81** (novo) | Cadastro de clientes do negócio: pessoa física (nome, CPF) ou empresa (razão social, CNPJ, situação na inscrição estadual, nome de quem compra), com endereço, e-mail e telefone opcionais. Tela de Clientes dentro de Vendas, com busca, selo "completo para nota", detalhe com as compras, edição e exclusão. Endereço preenchido pelo CEP e dados da empresa pelo CNPJ, com preenchimento manual quando a consulta falha. |
| | **RF58** | **Alterado:** o CNPJ do negócio aceita o formato com letras (IN RFB nº 2.229/2024), além do numérico. |
| | **RF76** | **Alterado:** no modo suporte, todos os dados pessoais dos clientes (nome, documento, e-mail, telefone e endereço) aparecem mascarados. |
| **RN** | **RN36** (nova) | Os dados do cliente são do negócio e só o nome é obrigatório. O documento é validado pelos dígitos verificadores e é único no negócio. O documento, o e-mail, o telefone e o endereço completos só chegam a quem pode editar clientes. O CPF nunca é enviado a serviço externo. O selo "completo para nota" é calculado e não bloqueia a venda. |
| | **RN27** | **Alterada:** a anonimização (exclusão de conta) apaga todos os dados pessoais dos clientes. Além disso, um cliente pode ser excluído sozinho: sem vendas, é apagado; com vendas, é anonimizado, e as vendas são mantidas sem identificação. |
| | RN01 | Mantida: os clientes são isolados por negócio. O mesmo CPF pode existir em negócios diferentes. |
| | RN25, RN26 | Mantidas: cancelar ou trocar uma venda não muda o cliente dela. A troca continua com o cliente da venda original. |
| **RNF** | RNF01 | Tela de Clientes, formulário e detalhe em 390, 768 e 1440 px, nos temas claro e escuro. |
| | RNF02 | O cliente segue o isolamento do negócio, inclusive na unicidade do documento. |
| | RNF04 | Os dados novos entram na exportação e na anonimização. A Política de Privacidade ganha uma nova versão, com novo aceite. |
| | RNF10 | Prepara a integração de nota fiscal: os dados do destinatário ficam prontos. |
| **Caso de uso / fluxo** | Nova venda (SPEC-008); tela própria dentro de um módulo, como Subcategorias (SPEC-020); Dados do negócio e cadastro do negócio (SPEC-004); exportação e exclusão de conta (SPEC-014); modo suporte (SPEC-018) | Ver seção 5. |
| **Entidades** | `Cliente` (campos novos, `contato` migrado), `Negocio` (formato do `cnpj`) | Ver seção 7. |
| **ADRs** | ADR-002 (multi-tenant), ADR-003 (autorização no servidor), ADR-006 (consulta pública com fallback manual), ADR-008 (máscara no suporte) | Ver seção 8. |

---

## 3. Escopo

### Incluído

1. **Tipo de cliente** (OPEN-003): **pessoa física** ou **empresa**.
   - Pessoa física: nome e CPF.
   - Empresa: razão social, nome fantasia, CNPJ, situação na inscrição estadual (tem inscrição, com o número; isenta; não contribuinte do ICMS), inscrição municipal e o nome de quem compra (contato na empresa) (OPEN-009).
2. **Dados de contato e endereço**, para os dois tipos: e-mail, telefone e endereço (CEP, logradouro, número, complemento, bairro, município e UF). Só o nome (ou a razão social) é obrigatório.
3. **Preenchimento automático** (OPEN-004):
   - o **CEP** preenche logradouro, bairro, município e UF;
   - o **CNPJ** do cliente empresa preenche razão social, nome fantasia, endereço, telefone e e-mail (OPEN-009);
   - pela consulta pública já usada nos Dados do negócio (BrasilAPI, ADR-006), com tempo limite e preenchimento manual quando falha;
   - o **CPF nunca é enviado** a serviço externo.
4. **Tela de Clientes dentro de Vendas** (OPEN-001), aberta pelo botão "Clientes" no cabeçalho de Vendas:
   - lista com busca (nome, documento, e-mail e telefone), selo e filtro "Faltam dados para nota";
   - cadastro, edição e exclusão;
   - detalhe com os dados e as compras do cliente (OPEN-008).
5. **Permissões de Vendas**, sem mudar a matriz (OPEN-001): *ver* para a lista e o detalhe, *criar* para cadastrar, *editar* para editar, *excluir* para excluir.
6. **Quem vê o quê** (OPEN-002):
   - a lista mostra o documento mascarado para todos;
   - o detalhe e a edição mostram tudo para quem tem *Vendas: editar*;
   - quem só tem *ver* (ou *criar*) vê o documento, o e-mail e o telefone mascarados e, do endereço, só o município e a UF;
   - a máscara é aplicada no servidor.
7. **Selo "completo para nota"** (OPEN-006): calculado pelos dados (5.4), na lista e no detalhe, com filtro. Na Nova venda, quando o negócio emite nota fiscal de produtos, um aviso ao escolher um cliente incompleto. Nada bloqueia a venda.
8. **Exclusão do cliente** (OPEN-005): sem vendas, é apagado; com vendas, é anonimizado, e as vendas ficam sem identificação, com os mesmos valores.
9. **Nova venda** (SPEC-008): o formulário "Novo cliente" ganha os campos novos, com o endereço num bloco que abre sob demanda.
10. **CNPJ com letras** (OPEN-007): a validação e a formatação do CNPJ passam a aceitar o formato alfanumérico, no cliente empresa e no CNPJ do próprio negócio (cadastro e Dados do negócio, SPEC-004).
11. **Migração dos clientes existentes:** todos viram pessoa física; o `contato` atual vai para e-mail ou telefone, sem perda.
12. **LGPD:**
    - exportação com os campos novos (SPEC-014);
    - anonimização de conta limpando todos os campos novos (RN27);
    - máscara de todos os dados pessoais no modo suporte (SPEC-018);
    - nova versão da Política de Privacidade e dos Termos de Uso, com novo aceite.

### Fora do escopo

| Comportamento | Onde fica |
|---|---|
| Emissão de nota fiscal | Pós-MVP (Visão de Negócio, 8.2). Esta Spec só guarda os dados do destinatário. |
| Código IBGE do município, país (cliente no exterior) e outros campos técnicos da nota | Fora: entram com a Spec da nota fiscal. O município e a UF guardados bastam para obter o código depois. |
| Validação da inscrição estadual pelos dígitos de cada estado | Fora: o número é guardado como informado (letras e dígitos). Cada estado tem uma regra, e a consulta oficial (Sintegra) não tem API pública única. |
| Buscar cliente por CPF no seletor da Nova venda | Fora: o seletor continua pelo nome. A busca por documento fica na tela de Clientes. |
| Mensagens de marketing (e-mail, WhatsApp) e consentimento para elas | Fora: outra finalidade, com outra base legal. |
| Aniversário, observações, limite de crédito, fiado | Fora. |
| RG | Fora (OPEN-009): a nota fiscal não pede, e a LGPD manda guardar só o necessário. |
| Outros campos do ERP de referência: fornecedor no mesmo cadastro, "consumidor final", ramo de atividade, área, grupo de tributação, Suframa, transportadora, representante, tabela de preço, prazo de entrega, site, fax, campos livres e logotipo | Fora: são de um ERP maior (atacado e representantes). O "consumidor final" é decidido em cada nota e entra com a Spec da nota fiscal. |
| Importar clientes de planilha | Fora. |
| Módulo "Clientes" próprio na matriz de permissões e item no menu lateral | Fora (OPEN-001): a tela fica dentro de Vendas, com as permissões de Vendas. |
| Mostrar o documento completo para quem só vê clientes | Fora (OPEN-002). |
| Bloquear a venda de cliente com cadastro incompleto | Fora (OPEN-006). |
| Vendas filtradas por cliente na lista de Vendas | Fora: as compras aparecem no detalhe do cliente (OPEN-008). |
| Desfazer a exclusão de um cliente | Fora: a exclusão é definitiva, com confirmação (5.6). |

---

## 4. Dependências

- **Specs:**
  - SPEC-008: Nova venda, seletor de cliente e o formulário "Novo cliente"; histórico e detalhe da venda;
  - SPEC-011: troca e cancelamento (a troca mantém o cliente);
  - SPEC-004: cadastro do negócio, Dados do negócio e a consulta de CNPJ (adaptador `ConsultaCnpj`);
  - SPEC-005: matriz módulo × ação (permissões de Vendas);
  - SPEC-014: exportação e exclusão de conta (anonimização, RN27);
  - SPEC-018: contexto de suporte e máscara dos dados pessoais no servidor;
  - SPEC-018 e SPEC-002: versão dos termos e novo aceite;
  - SPEC-021: opção "Emito nota fiscal de produtos" (condição do aviso na Nova venda);
  - SPEC-020: padrão de tela própria dentro de um módulo (Subcategorias) e o "voltar" para a lista de origem;
  - SPEC-016: listas, formulários, diálogo de confirmação, avisos e estados vazios;
  - SPEC-001: isolamento, `modelos.ts` e RLS.
- **Decisões arquiteturais:**
  - ADR-002: o cliente segue o `negocioId`;
  - ADR-003: autorização e máscara no servidor;
  - ADR-006: consulta pública atrás de um adaptador, com tempo limite e preenchimento manual. Passa a cobrir também o CEP e o CNPJ de clientes;
  - ADR-008: o suporte vê dados pessoais mascarados.
- **Pré-requisitos externos:**
  - BrasilAPI (já usada para CNPJ): consulta de **CEP** e de **CNPJ**, sem cadastro nem chave. A rede do ambiente de desenvolvimento bloqueia o domínio, e os testes usam o adaptador falso, como na SPEC-004;
  - a regra do **CNPJ alfanumérico** (IN RFB nº 2.229/2024; Nota Técnica COCAD/SUARA/RFB nº 49/2024): 12 posições com letras e números e 2 dígitos verificadores numéricos, pelo módulo 11, com o valor de cada caractere igual ao código ASCII menos 48. Emitido para novas inscrições desde julho de 2026; os CNPJs numéricos continuam válidos.

---

## 5. Comportamento esperado

### 5.1 Tela de Clientes

1. **Acesso:** a tela de Vendas ganha o botão **"Clientes"** no cabeçalho, ao lado de "Nova venda", para quem tem *Vendas: ver*. A tela fica em `/vendas/clientes` e tem o "voltar" para Vendas. Não há item novo no menu lateral (OPEN-001).
2. **Lista:**
   - cada linha mostra o nome (na empresa, o nome fantasia quando houver, com a razão social abaixo), o tipo ("Pessoa física" ou "Empresa"), o documento **mascarado** (`***.456.789-**` ou `12.***.***/0001-**`), o município/UF quando houver e o selo (5.4);
   - ordem alfabética pelo nome;
   - **busca** por nome, razão social, nome fantasia, por documento (dígitos e letras, com ou sem pontuação), por e-mail e por telefone (só dígitos);
   - **filtro** "Todos" ou "Faltam dados para nota";
   - botão **"Novo cliente"** para quem tem *Vendas: criar*;
   - estado vazio: "Nenhum cliente cadastrado. Os clientes cadastrados na Nova venda também aparecem aqui."
3. **Clientes anonimizados** não aparecem na lista, na busca nem no seletor da Nova venda.

### 5.2 Cadastro e edição

1. **Tipo:** escolha entre "Pessoa física" e "Empresa" no topo do formulário. Padrão: pessoa física. O tipo pode mudar na edição; ao mudar, os campos do outro tipo são descartados, com aviso antes de salvar ("O CPF será removido.").
2. **Pessoa física:**
   - **Nome** (obrigatório, até 120 caracteres);
   - **CPF** (opcional): 11 dígitos, validados pelos dígitos verificadores; mostrado como `123.456.789-09`.
3. **Empresa:**
   - **Razão social** (obrigatória, até 150 caracteres);
   - **Nome fantasia** (opcional, até 150 caracteres) (OPEN-009);
   - **CNPJ** (opcional): numérico ou com letras (5.7), validado pelos dígitos verificadores;
   - **Inscrição estadual:** "Contribuinte do ICMS" (com o número, até 14 letras e dígitos), "Isenta" ou "Não contribuinte do ICMS". Sem escolha, fica em branco;
   - **Inscrição municipal** (opcional, até 20 letras e dígitos) (OPEN-009): algumas prefeituras a pedem na nota de serviço (NFS-e) quando o tomador é empresa. É guardada como informada;
   - **Nome de quem compra** (opcional, até 120): a pessoa de contato na empresa.
4. **Contato**, para os dois tipos:
   - **E-mail** (opcional, até 254, formato de e-mail);
   - **Telefone** (opcional): DDD e número, 10 ou 11 dígitos; mostrado como `(11) 98765-4321`.
5. **Endereço**, para os dois tipos, num bloco **"Endereço (para nota fiscal)"**: CEP (8 dígitos), logradouro, número, complemento, bairro, município e UF (lista das 27). Todos opcionais; um endereço parcial é aceito.
6. **Preenchimento pelo CEP** (OPEN-004): ao completar os 8 dígitos, o sistema consulta o CEP e preenche logradouro, bairro, município e UF que estiverem vazios. Se algum já tiver valor, ele não é trocado sem confirmação: "Trocar o endereço pelo do CEP?". Se a consulta falhar ou o CEP não existir: "Não encontramos este CEP. Preencha o endereço." Tudo continua editável.
7. **Preenchimento pelo CNPJ** (OPEN-004, OPEN-009): no cliente empresa, o botão **"Buscar dados do CNPJ"**, ao lado do campo, preenche razão social, nome fantasia, endereço, telefone e e-mail, quando a base pública os tiver. Vale a mesma regra de não trocar o que já foi digitado sem confirmação. O telefone e o e-mail vêm do cadastro da empresa na Receita. Se a consulta falhar ou não encontrar o CNPJ (inclusive um CNPJ com letras que a base pública ainda não tenha): "Não foi possível consultar o CNPJ agora. Preencha os dados." A consulta **não** traz a inscrição estadual nem a municipal.
8. **CPF nunca sai do sistema:** o CPF não é consultado em nenhum serviço externo.
9. **Documento repetido:** o mesmo CPF ou CNPJ não pode estar em dois clientes ativos do mesmo negócio. A mensagem diz qual é o outro: "Já existe um cliente com este CPF: Maria Silva." Quem não vê o documento completo também recebe a mensagem, sem o documento.
10. **Valores antigos fora do formato:** um e-mail ou telefone vindo da migração (5.9) que não passe na validação é mantido. Ele só é validado quando é alterado (mesmo padrão da OPEN-002 da SPEC-021).
11. **Ao salvar**, o servidor valida tudo de novo (5.8).

### 5.3 Detalhe do cliente (OPEN-008)

1. **Dados:** tipo, nome ou razão social, nome fantasia, documento, inscrições estadual e municipal, nome de quem compra, e-mail, telefone e endereço, com a máscara conforme a permissão (5.5). Campo vazio aparece como "—".
2. **Selo** "Completo para nota" ou "Faltam dados para nota", com a lista do que falta (ex.: "Faltam: CPF, número do endereço").
3. **Compras do cliente:**
   - as vendas desse cliente, da mais recente para a mais antiga: número, data, valor e situação ("Concluída" ou "Cancelada", com a marca "Troca" quando a venda veio de uma troca, SPEC-011);
   - cada linha leva ao detalhe da venda;
   - acima da lista, **"N compras · total de R$ X"**, que soma só as vendas não canceladas;
   - até 50 vendas; acima disso, "Mostrando as 50 mais recentes.";
   - sem vendas: "Nenhuma compra registrada.".
4. **Ações:** "Editar" (*Vendas: editar*) e "Excluir cliente" (*Vendas: excluir*).

### 5.4 Selo "completo para nota" (OPEN-006)

1. **Completo** quando tem:
   - **pessoa física:** nome, CPF e endereço completo (CEP, logradouro, número, bairro, município e UF; complemento não conta);
   - **empresa:** razão social, CNPJ, a situação na inscrição estadual escolhida (com o número, se contribuinte) e endereço completo.
2. E-mail, telefone, nome fantasia e inscrição municipal **não** contam para o selo.
3. O selo é **calculado** a cada leitura, nunca gravado à mão.
4. **Nova venda:** quando o negócio liga "Emito nota fiscal de produtos" (SPEC-021) e alguém escolhe um cliente incompleto, aparece abaixo do seletor: "Faltam dados para a nota fiscal deste cliente: CPF, endereço." Para quem tem *Vendas: editar*, o aviso traz o link "Completar". Com a opção desligada, a venda não mostra o aviso. O selo continua na tela de Clientes.
5. **Nada bloqueia:** a venda com cliente incompleto, ou sem cliente, é registrada normalmente (RF22).

### 5.5 Quem vê o quê (OPEN-002)

| Quem | Lista | Detalhe e edição |
|---|---|---|
| *Vendas: editar* (Dono, Gerente predefinido) | Nome completo; documento mascarado | Tudo completo |
| *Vendas: ver* sem *editar* (Colaborador predefinido) | Nome completo; documento mascarado | Nome completo; documento, e-mail e telefone mascarados; do endereço, só município e UF. Não abre a edição. |
| Modo suporte (SPEC-018) | Tudo mascarado, inclusive o nome | Tudo mascarado, inclusive o nome; do endereço, só município e UF |

- **Máscaras:**
  - CPF `***.456.789-**`;
  - CNPJ `12.***.***/0001-**` (com letras, as mesmas posições ficam visíveis);
  - e-mail `a***@exemplo.com` e telefone `•••21`, as mesmas máscaras do modo suporte;
  - nome no suporte: `M*** S***`.
- **A máscara é aplicada no servidor:** o dado completo nunca chega ao navegador de quem não pode vê-lo. Isso vale para as telas, para o seletor da Nova venda e para as respostas das ações.
- **Quem cadastra sem poder editar** (o Colaborador que cria um cliente na venda) digita os dados uma vez. Depois de salvos, ele passa a vê-los mascarados.

### 5.6 Exclusão do cliente (OPEN-005)

1. O botão **"Excluir cliente"** fica no detalhe, para quem tem *Vendas: excluir*. Ele pede confirmação no diálogo da SPEC-016.
2. **Sem vendas:** "Excluir Maria Silva? O cadastro será apagado." Confirmar **apaga** o cliente.
3. **Com vendas:** "Maria Silva tem 3 compras. Os dados pessoais serão apagados, e as vendas continuarão registradas, sem identificação e com os mesmos valores. Isso não pode ser desfeito." Confirmar **anonimiza** o cliente:
   - o nome vira "Cliente anonimizado", o mesmo texto da RN27;
   - todos os outros campos ficam vazios;
   - fica registrada a data da anonimização;
   - vendas, pagamentos, parcelas, contas e lançamentos não mudam;
   - o detalhe da venda passa a mostrar "Cliente anonimizado".
4. Depois de excluído, o cliente sai da lista, da busca e do seletor da Nova venda. Uma venda enviada com ele é recusada (`ClienteInvalido`, já existente).
5. **Tudo ou nada:** a exclusão roda numa transação. Se uma venda for registrada no mesmo instante, o servidor decide entre apagar e anonimizar pela situação no momento da gravação.

### 5.7 CNPJ com letras (OPEN-007)

1. **Formato:**
   - 14 posições: as 12 primeiras com letras (A–Z) ou dígitos e as 2 últimas com dígitos;
   - letras minúsculas são convertidas para maiúsculas;
   - pontos, barra e traço são ignorados;
   - mostrado como `12.ABC.345/01DE-35`.
2. **Dígitos verificadores:** módulo 11, com os mesmos pesos do CNPJ numérico e o valor de cada caractere igual ao código ASCII menos 48. Os CNPJs numéricos continuam válidos com o mesmo cálculo. Um CNPJ com as 14 posições iguais é recusado.
3. **Onde vale:**
   - no cliente empresa;
   - no **cadastro do negócio** e nos **Dados do negócio** (SPEC-004).

   O campo passa a aceitar letras: teclado de texto, e não numérico, no celular.
4. **Consulta de CNPJ** (negócio e cliente): o CNPJ com letras também é enviado à consulta. Se a base pública não o encontrar, vale o preenchimento manual que já existe (ADR-006).
5. Os CNPJs já gravados não mudam.

### 5.8 Validação e gravação no servidor

| Regra | Comportamento |
|---|---|
| Nome | Obrigatório: até 120 caracteres na pessoa física e 150 na razão social. Vazio → `CampoInvalido` ("Informe o nome do cliente." / "Informe a razão social."). |
| Tipo e documento | CPF só em pessoa física e CNPJ só em empresa. Dígitos verificadores errados → `DocumentoInvalido` ("CPF inválido." / "CNPJ inválido."). O banco também garante o formato e a coerência com o tipo. |
| Documento repetido | Mesmo documento em outro cliente ativo do negócio → `DocumentoRepetido` ("Já existe um cliente com este CPF: Maria Silva."). O banco também garante a unicidade entre os clientes não anonimizados do negócio. |
| Inscrição estadual | Só em empresa. "Contribuinte" exige o número (1 a 14 letras e dígitos); "Isenta" e "Não contribuinte" não têm número. |
| Nome fantasia e inscrição municipal | Só em empresa. Nome fantasia até 150 caracteres; inscrição municipal de 1 a 20 letras e dígitos (pontos, barras e traços são ignorados). |
| E-mail | Formato de e-mail, até 254 caracteres → senão `CampoInvalido` ("E-mail inválido."). |
| Telefone | 10 ou 11 dígitos, DDD válido → senão `CampoInvalido` ("Informe o telefone com DDD."). |
| Endereço | CEP com 8 dígitos; UF da lista; os demais campos com até 120 caracteres (número e complemento até 30). |
| Valor antigo | E-mail ou telefone igual ao gravado é aceito mesmo fora do formato (5.2, item 10). |
| Permissões | Cadastrar exige *Vendas: criar*; editar, *Vendas: editar*; excluir, *Vendas: excluir*; consultar CEP e CNPJ, *criar* ou *editar*. Sem a permissão → `SemPermissao`. No modo suporte, toda escrita e as consultas são recusadas. |
| Isolamento | Cliente de outro negócio → `NaoEncontrado` (sem revelar que existe). |

### 5.9 Migração dos clientes existentes

1. Todos os clientes existentes viram **pessoa física**, com o nome atual.
2. O campo `contato`, de texto livre, é distribuído e depois removido:
   - com "@" → **e-mail**;
   - com 10 ou 11 dígitos (ignorando espaços, parênteses e traços) → **telefone**, só os dígitos;
   - qualquer outro texto → **telefone**, como estava, para não perder nada (5.2, item 10).
3. Os clientes já anonimizados continuam anonimizados, com os campos novos vazios.
4. Nenhum documento ou endereço é inventado; todos os clientes migrados ficam com o selo "Faltam dados para nota".

### 5.10 Nova venda (SPEC-008)

1. O formulário **"Novo cliente"** da Nova venda ganha o tipo, o documento, o e-mail, o telefone e, num bloco que abre sob demanda, o endereço com o preenchimento pelo CEP. Só o nome é obrigatório, como hoje. Cadastrar exige *Vendas: criar*, como hoje.
2. O **seletor** continua listando os clientes pelo nome, sem anonimizados.
3. O **aviso de cadastro incompleto** segue o item 4 da 5.4.
4. A **troca** (SPEC-011) continua com o cliente da venda original.

### 5.11 Modo suporte, exportação, exclusão de conta e textos legais

- **Modo suporte (SPEC-018):** com Vendas liberado, o suporte vê a tela de Clientes e o detalhe com tudo mascarado (5.5), sem cadastrar, editar, excluir nem consultar CEP ou CNPJ.
- **Exportação (SPEC-014):** os clientes exportados trazem todos os campos novos (JSON e CSV).
- **Exclusão de conta (RN27):** a anonimização dos clientes dos negócios encerrados limpa todos os campos novos, além do nome.
- **Política de Privacidade e Termos de Uso:** nova versão, com novo aceite de todos os usuários (mecanismo da SPEC-018):
  - as categorias novas de dados de clientes (CPF ou CNPJ, endereço, e-mail e telefone) e as finalidades (identificar a venda e preparar a nota fiscal);
  - o papel do negócio como controlador, com as bases legais que cabem a ele;
  - a consulta de CEP e CNPJ em base pública, sem envio de CPF;
  - quem vê os dados completos;
  - a exclusão do cliente a pedido.
- **Planos (SPEC-013):** disponível nos dois planos. Não é uma funcionalidade limitada do gratuito (RN18).

---

## 6. Regras e invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-001** | O documento gravado é válido pelos dígitos verificadores e coerente com o tipo: CPF de 11 dígitos só em pessoa física, CNPJ de 14 posições só em empresa. | Teste unitário da validação; restrições `CHECK` no banco, com teste de integração gravando direto. |
| **INV-002** | No mesmo negócio, dois clientes não anonimizados nunca têm o mesmo documento. Negócios diferentes podem ter o mesmo. | Teste de integração, inclusive com duas gravações simultâneas, e restrição no banco. |
| **INV-003** | Quem não tem *Vendas: editar* nunca recebe do servidor o documento, o e-mail, o telefone ou o endereço completos (além do município e da UF). No modo suporte, o nome também sai mascarado. | Teste das consultas e das ações com cada papel e no contexto de suporte, conferindo o conteúdo devolvido. |
| **INV-004** | O CPF nunca é enviado a serviço externo. Só o CEP e o CNPJ são consultados. | Teste com o adaptador falso registrando as chamadas; revisão do código das integrações. |
| **INV-005** | Excluir um cliente sem vendas apaga o registro. Com vendas, anonimiza: todos os dados pessoais vazios, o nome "Cliente anonimizado", e nenhuma venda, pagamento, parcela, conta ou lançamento muda. | Teste de integração antes e depois, com somas e contagens iguais. |
| **INV-006** | A exclusão de conta (RN27) deixa vazios todos os campos pessoais dos clientes dos negócios encerrados. | Teste de integração da exclusão de conta. |
| **INV-007** | Ver clientes exige *Vendas: ver*; cadastrar, *criar*; editar, *editar*; excluir, *excluir*; consultar CEP e CNPJ, *criar* ou *editar*. O modo suporte nunca escreve nem consulta. | Teste chamando as ações direto com cada papel e no contexto de suporte. |
| **INV-008** | A migração não perde dados: todo `contato` existente vira e-mail ou telefone, e todos os clientes viram pessoa física, sem documento nem endereço. | Teste de integração da migração com contatos de exemplo e conferência na homologação. |
| **INV-009** | Todo CNPJ numérico válido continua válido, e o CNPJ com letras é aceito no cliente, no cadastro do negócio e nos Dados do negócio. | Teste unitário com os exemplos oficiais (numéricos e alfanuméricos) e teste das ações do negócio. |
| **INV-010** | O selo "completo para nota" é sempre calculado pela regra da 5.4 e nunca impede uma venda. | Teste unitário da regra e teste de integração da venda com cliente incompleto. |
| **INV-011** | Um cliente anonimizado não aparece na lista, na busca nem no seletor, e não pode ser usado numa venda nova. | Teste de integração. |

---

## 7. Modelo de domínio envolvido

| Entidade | Mudança |
|---|---|
| `Cliente` | **Novos campos:**<br>• `tipo`: `PESSOA_FISICA` ou `PESSOA_JURIDICA`, padrão pessoa física;<br>• `documento`: CPF com 11 dígitos ou CNPJ com 14 posições, sem pontuação, opcional;<br>• `situacaoIe`: `CONTRIBUINTE`, `ISENTO` ou `NAO_CONTRIBUINTE`, opcional, só em empresa;<br>• `inscricaoEstadual`: opcional, só com `CONTRIBUINTE`;<br>• `nomeFantasia` e `inscricaoMunicipal`: opcionais, só em empresa (OPEN-009);<br>• `nomeContato`: opcional, só em empresa;<br>• `email` e `telefone`;<br>• `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio` e `uf`;<br>• `criadoEm` e `atualizadoEm`.<br>**Migrado e removido:** `contato`.<br>**Mantido:** `anonimizadoEm`.<br>**Restrições:** `CHECK` de formato e de coerência com o tipo; unicidade do documento por negócio entre os não anonimizados; índice para a busca. |
| `Negocio` | Sem coluna nova: `cnpj` passa a aceitar o formato com letras (só a validação e a formatação mudam). |

**Selo "completo para nota":** calculado (5.4), não gravado.

**Documentos de modelo a atualizar na implementação:**
- `MODELO_DOMINIO_E_JORNADAS.md`: os atributos do Cliente, o tipo pessoa física ou empresa e a regra do selo;
- `MODELO_LOGICO_BANCO.md`: as colunas novas de `CLIENTE` e a remoção de `contato`.

---

## 8. Impacto arquitetural

- **Banco:**
  - migração com as colunas novas de `Cliente`, os `CHECK`, a unicidade do documento por negócio entre os não anonimizados e o índice da busca;
  - a distribuição do `contato` (5.9) e a remoção da coluna;
  - RLS e classificação em `modelos.ts` sem mudança: `Cliente` já é operacional.
- **Domínio:**
  - `src/lib/dominio/cnpj.ts`: normalização, dígitos verificadores e formatação do CNPJ com letras, usados pelo negócio e pelo cliente;
  - novo módulo puro para o CPF (validar e formatar), o telefone, o CEP, as máscaras e o selo "completo para nota";
  - as máscaras novas junto das que já existem em `src/lib/dominio/suporte.ts`.
- **Integrações:**
  - adaptador novo `ConsultaCep` (BrasilAPI), no modelo do `ConsultaCnpj`, com tempo limite e um adaptador falso para os testes;
  - o `ConsultaCnpj` passa a devolver também o endereço;
  - a **ADR-006** ganha uma nota de ampliação (CEP e CNPJ de clientes, sem envio de CPF). Não é preciso ADR novo.
- **Dados:**
  - novo `src/lib/db/clientes.ts`: lista com busca e filtro, detalhe com as compras, criar, editar e excluir (apagar ou anonimizar), sempre com a máscara pela permissão;
  - em `src/lib/db/vendas.ts`, `clientes()` e `criarCliente` usam o módulo novo;
  - em `src/lib/db/lgpd.ts`, a anonimização limpa os campos novos.
- **Ações:**
  - cadastrar, editar, excluir, consultar CEP e consultar CNPJ do cliente, com as permissões de Vendas e recusa no contexto de suporte;
  - as ações do negócio (SPEC-004) usam a validação nova do CNPJ.
- **Telas:**
  - `src/app/(app)/vendas/clientes/`: lista, novo, detalhe e edição;
  - o botão "Clientes" no cabeçalho de Vendas;
  - o formulário de cliente compartilhado pela tela e pela Nova venda, com o bloco de endereço carregado sob demanda;
  - o aviso na Nova venda;
  - o campo de CNPJ do negócio com teclado de texto.
- **Textos legais:** `docs/legal/` com a nova versão e a constante da versão dos termos (novo aceite).
- **Sem mudança:** Calculadora, Catálogo, Estoque, Financeiro, Dashboard e Relatórios.
- **ADRs que restringem:** ADR-002, ADR-003, ADR-006 e ADR-008.

---

## 9. Contratos necessários (conceituais)

| Contrato | Entrada | Saída | Erros |
|---|---|---|---|
| **Listar clientes** | busca?, filtro? ("incompletos") | [{id, tipo, nome, documento mascarado, município/UF, completoParaNota}] | `SemPermissao` |
| **Detalhar cliente** | id | dados (completos ou mascarados conforme a permissão), completoParaNota, o que falta, compras [{venda, número, data, valor, situação}] (até 50), quantidade e total comprado | `NaoEncontrado`, `SemPermissao` |
| **Cadastrar cliente** | tipo, nome, nomeFantasia?, documento?, situacaoIe?, inscricaoEstadual?, inscricaoMunicipal?, nomeContato?, email?, telefone?, endereço? | cliente (com a máscara de quem cadastrou) | `CampoInvalido`, `DocumentoInvalido`, `DocumentoRepetido`, `SemPermissao` |
| **Editar cliente** | id + os mesmos campos | cliente | os do cadastro + `NaoEncontrado` |
| **Excluir cliente** | id | {resultado: "apagado" ou "anonimizado"} | `NaoEncontrado`, `SemPermissao` |
| **Consultar CEP** | cep | {logradouro, bairro, municipio, uf} | `CampoInvalido`, `NaoEncontrado`, `ConsultaIndisponivel`, `SemPermissao` |
| **Consultar CNPJ do cliente** | cnpj | {razaoSocial, nomeFantasia, endereço, telefone, email} (os que a base tiver) | `DocumentoInvalido`, `NaoEncontrado`, `ConsultaIndisponivel`, `SemPermissao` |
| **Clientes da venda** (estendido, SPEC-008) | — | [{id, nome, completoParaNota, faltando}] sem anonimizados | — |
| **Registrar venda / troca** (SPEC-008, SPEC-011) | sem mudança | — | `ClienteInvalido` também para cliente anonimizado (já existente) |
| **Salvar CNPJ do negócio** (SPEC-004) | cnpj numérico ou com letras | — | `CnpjInvalido` |
| **Exportar dados** (SPEC-014) | — | clientes com os campos novos | — |

---

## 10. Requisitos não funcionais aplicáveis

| RNF | Aplicação | Verificação |
|---|---|---|
| RNF01 | Lista, formulário (com o bloco de endereço), detalhe com as compras e o aviso da Nova venda em 390, 768 e 1440 px, claro e escuro, sem rolagem horizontal. Os campos usam o teclado certo no celular: numérico para CPF, CEP e telefone; texto para CNPJ. O JavaScript das telas de Vendas fica dentro do orçamento da SPEC-016, seção 10. | Capturas, axe-core e medição de JS no build local. |
| RNF02 | O cliente segue o isolamento do negócio, inclusive a unicidade do documento e as compras do detalhe. | INV-002, teste de isolamento com dois negócios. |
| RNF04 | Campos novos na exportação e na anonimização; exclusão individual; nova versão da Política de Privacidade com novo aceite; máscara pela permissão e no suporte. | INV-003, INV-005, INV-006 e testes da exportação. |
| RNF10 | Os dados do destinatário ficam prontos para a futura nota fiscal, sem mudar o núcleo da venda. | Revisão do modelo (seção 7). |

---

## 11. Critérios de aceitação

**CA-01 — Cadastrar pessoa física pelo CEP.** Dado o Dono na tela de Clientes, quando cadastra "Ana Souza" com um CPF válido e digita o CEP, então rua, bairro, município e UF são preenchidos. Ao completar o número e salvar, a Ana aparece na lista com o CPF mascarado e o selo "Completo para nota".

**CA-02 — Cadastrar empresa pelo CNPJ.** Dado o Dono cadastrando uma empresa, quando informa o CNPJ e toca em "Buscar dados do CNPJ", então a razão social, o nome fantasia, o endereço, o telefone e o e-mail que a base pública tiver são preenchidos, sem trocar o que já foi digitado. A lista mostra o nome fantasia, com a razão social abaixo. Com a situação "Contribuinte do ICMS" e o número da inscrição, o selo fica "Completo para nota".

**CA-03 — Consulta indisponível.** Dado que a consulta de CEP ou de CNPJ falha, quando o Dono continua o cadastro, então vê a mensagem para preencher à mão e consegue salvar com os dados digitados.

**CA-04 — Documento inválido ou repetido.** Dado um CPF com dígito verificador errado, quando o Dono salva, então vê "CPF inválido.". Dado o CPF de um cliente que já existe no negócio, então vê "Já existe um cliente com este CPF: Maria Silva.". O mesmo CPF num **outro** negócio é aceito.

**CA-05 — Só o nome é obrigatório.** Dado um cliente só com o nome, quando é salvo, então aparece com o selo "Faltam dados para nota", e uma venda com ele é registrada normalmente.

**CA-06 — Quem vê o quê.** Dado o Colaborador predefinido (*Vendas: ver* e *criar*), quando abre o detalhe da Ana, então vê o nome, o CPF, o e-mail e o telefone mascarados e, do endereço, só o município e a UF, sem "Editar" nem "Excluir". O dado completo não aparece nem na resposta do servidor. O Dono vê tudo completo.

**CA-07 — Cadastro na Nova venda.** Dado o Colaborador na Nova venda, quando cadastra um cliente com nome, CPF e CEP, então o cliente é criado e escolhido para a venda, e o Colaborador passa a ver o CPF mascarado.

**CA-08 — Aviso na Nova venda.** Dado o negócio com "Emito nota fiscal de produtos" ligada, quando alguém escolhe um cliente incompleto, então vê "Faltam dados para a nota fiscal deste cliente: …" e consegue registrar a venda. Com a opção desligada, o aviso não aparece.

**CA-09 — Detalhe com as compras.** Dado a Ana com 4 vendas, uma delas cancelada, quando o Dono abre o detalhe, então vê as 4 vendas com número, data, valor e situação, e "4 compras · total de R$ X", com X somando só as 3 não canceladas. Cada linha leva à venda.

**CA-10 — Excluir sem vendas.** Dado um cliente sem vendas, quando o Dono confirma "Excluir cliente", então o cadastro é apagado.

**CA-11 — Excluir com vendas (anonimizar).** Dado a Ana com vendas, quando o Dono confirma a exclusão, então:
- o cliente sai da lista e do seletor;
- as vendas mostram "Cliente anonimizado", com os mesmos valores;
- o caixa, as contas e os relatórios não mudam;
- nenhum dado pessoal da Ana fica no banco.

**CA-12 — Busca e filtro.** Dado a lista de clientes, quando o Dono busca "456789", "ana@" ou "98765", então encontra a Ana. O filtro "Faltam dados para nota" mostra só os incompletos.

**CA-13 — Permissões e suporte.** Dado um membro sem *Vendas: ver*, quando tenta abrir a tela de Clientes, então vê "Sem acesso". As ações de editar e excluir recusam quem não tem a permissão. No modo suporte com Vendas liberado, a tela mostra tudo mascarado, inclusive o nome, e nenhuma escrita nem consulta é aceita.

**CA-14 — CNPJ com letras.** Dado um CNPJ alfanumérico válido, como os exemplos da Receita, quando ele é informado no cliente empresa, no cadastro do negócio ou nos Dados do negócio, então é aceito e mostrado formatado. Com o dígito verificador errado, é recusado. Os CNPJs numéricos continuam aceitos.

**CA-15 — Migração.** Dado os clientes existentes com contatos como "ana@exemplo.com", "(11) 98765-4321" e "falar com a mãe", quando a migração roda, então os três viram pessoa física. Os contatos vão para e-mail, telefone e telefone (como estava), sem perda.

**CA-16 — Exportação e exclusão de conta.** Dado um negócio com clientes completos, quando o Dono exporta os dados, então os clientes trazem todos os campos novos. Quando o único Dono exclui a conta, então todos os dados pessoais dos clientes ficam vazios.

**CA-17 — Novo aceite.** Dado um usuário que aceitou a versão anterior dos termos, quando entra depois da implementação, então vê o novo aceite com a Política de Privacidade atualizada.

**CA-18 — Telas.** Dado a lista, o formulário, o detalhe e a Nova venda com o aviso, quando abertos em 390, 768 e 1440 px, nos dois temas, então não há rolagem horizontal nem violação do axe-core, e o JavaScript fica dentro do orçamento.

---

## 12. Casos de teste derivados

| ID | Caso | Tipo | Cobre |
|---|---|---|---|
| T01 | CPF: validação e formatação (dígitos, todos iguais, tamanho errado, pontuação) | Unitário | CA-04, INV-001 |
| T02 | CNPJ numérico e com letras: normalização, dígitos verificadores (exemplos oficiais), minúsculas, formatação; os numéricos antigos continuam válidos | Unitário | CA-14, INV-009 |
| T03 | Telefone, CEP, e-mail, máscaras (CPF, CNPJ, e-mail, telefone, endereço) e o selo "completo para nota" (o que falta, por tipo) | Unitário | CA-01, CA-02, CA-05, INV-010 |
| T04 | Cadastrar e editar: tipo e documento coerentes, inscrições estadual e municipal, nome fantasia, valores antigos mantidos, documento repetido no negócio (inclusive simultâneo) e aceito em outro negócio, restrições do banco | Integração | CA-01, CA-02, CA-04, CA-05, INV-001, INV-002 |
| T05 | Máscara pela permissão: lista, detalhe, seletor da venda e respostas das ações, para Dono, Gerente, Colaborador e suporte | Integração | CA-06, CA-13, INV-003 |
| T06 | Consultas de CEP e CNPJ com o adaptador falso: preenchimento (no CNPJ, também nome fantasia, telefone e e-mail, só nos campos vazios), falha, não encontrado; o CPF nunca é enviado; suporte e falta de permissão recusados | Unitário + integração | CA-01, CA-02, CA-03, INV-004 |
| T07 | Detalhe com as compras: ordem, situação, total sem canceladas, limite de 50, isolamento | Integração | CA-09 |
| T08 | Excluir: sem vendas apaga; com vendas anonimiza; vendas, pagamentos, contas e lançamentos iguais; o anonimizado sai da lista e do seletor e é recusado numa venda nova | Integração | CA-10, CA-11, INV-005, INV-011 |
| T09 | Busca e filtro "Faltam dados para nota" | Integração | CA-12 |
| T10 | Permissões das ações (cadastrar, editar, excluir, consultar) por papel e no modo suporte | Unitário + integração | CA-13, INV-007 |
| T11 | Migração do `contato` (e-mail, telefone, texto livre, anonimizados) | Integração | CA-15, INV-008 |
| T12 | Exportação com os campos novos; exclusão de conta limpando todos os campos; CNPJ com letras nas ações do negócio | Integração | CA-14, CA-16, INV-006, INV-009 |
| T13 | Fluxo no navegador (build local): cadastro pelo CEP e pelo CNPJ (adaptador falso), lista com máscara e selo, detalhe com compras, Colaborador mascarado, Nova venda com cadastro e aviso, exclusão com anonimização, CNPJ com letras nos Dados do negócio, novo aceite; capturas em 390, 768 e 1440 px, claro e escuro; axe; medição de JS | Navegador + manual com captura | CA-01 a CA-18 |
| T14 | Fluxo na homologação, depois do merge, com a consulta real de CEP e CNPJ | Manual (uma vez) | CA-01 a CA-13, CA-17 |

---

## 13. Questões em aberto

Todas decididas pela equipe em 22/10/2026, em entrevista. As OPEN-001 a OPEN-008 seguiram a opção recomendada; a OPEN-009 veio depois, da comparação com o cadastro de clientes de um ERP de mercado mostrado pela equipe:

| ID | Decisão |
|---|---|
| **OPEN-001** — Onde fica a tela de Clientes e quem acessa | **Dentro de Vendas** (recomendada): botão "Clientes" no cabeçalho de Vendas, com as permissões de Vendas (*ver*, *criar*, *editar*, *excluir*). Não há item novo no menu lateral, que já fica comprido em janelas baixas (T14 da SPEC-021), nem mudança na matriz. Descartado: um módulo "Clientes" próprio, com item no menu e permissões separadas. |
| **OPEN-002** — Quem vê o CPF/CNPJ e o endereço completos | **Mascarado na lista** (recomendada): a lista mostra o documento mascarado para todos. O detalhe e a edição mostram tudo para quem tem *Vendas: editar*. Quem só vê recebe o documento, o e-mail e o telefone mascarados e, do endereço, só o município e a UF, com a máscara aplicada no servidor (minimização, LGPD). Descartadas: todos com acesso veem tudo; só o Dono vê completo. |
| **OPEN-003** — Cliente empresa | **Tipo pessoa física ou empresa** (recomendada): pessoa física com nome e CPF; empresa com razão social, CNPJ, situação na inscrição estadual (contribuinte, com o número; isenta; não contribuinte) e o nome de quem compra. Cobre o que a NF-e pede de empresa. Descartado: só um campo "CPF ou CNPJ", sem inscrição estadual. |
| **OPEN-004** — Preenchimento automático | **CEP e CNPJ** (recomendada): o CEP preenche o endereço, e o CNPJ do cliente empresa preenche razão social e endereço, pela consulta pública já usada nos Dados do negócio (ADR-006), com preenchimento manual quando falha. O CPF nunca é consultado fora. Descartadas: só o CEP; tudo digitado. |
| **OPEN-005** — Exclusão do cliente | **Apagar ou anonimizar** (recomendada): sem vendas, apaga; com vendas, anonimiza ("Cliente anonimizado", o mesmo texto da RN27), e as vendas ficam sem identificação, com os mesmos valores. Descartadas: sempre anonimizar; não permitir excluir. |
| **OPEN-006** — Cadastro "completo para nota fiscal" | **Selo e aviso** (recomendada): selo e filtro na tela de Clientes, e aviso na Nova venda ao escolher um cliente incompleto. Nada bloqueia a venda, porque a NFC-e muitas vezes nem pede CPF. Descartado: só o selo. |
| **OPEN-007** — CNPJ com letras | **No cliente e no negócio** (recomendada): a validação nova vale para o cliente empresa e para o CNPJ do próprio negócio, no cadastro e nos Dados do negócio. Sem isso, um MEI aberto depois de julho de 2026 não consegue informar o CNPJ no HE. Descartado: só no cliente. |
| **OPEN-008** — Detalhe do cliente | **Dados e compras** (recomendada): os dados e as compras do cliente (número, data, valor e situação), com link para cada venda e o total comprado. Descartado: só os dados. |
| **OPEN-009** — Campos do ERP de referência | A equipe comparou a Spec com o cadastro de clientes de um ERP de mercado (vídeo de 22/10/2026). Nele, a pessoa física com CPF não preenche nada sozinha, como nesta Spec, e o CNPJ preenche os dados da empresa. Escolhidos:<br>• **nome fantasia** (recomendado), preenchido pelo CNPJ e mostrado na lista;<br>• **o CNPJ também preenche telefone e e-mail** (recomendado), quando a base pública os tiver e só nos campos vazios;<br>• **inscrição municipal**, opcional, para a nota de serviço.<br>Descartado: **RG**, que a nota não pede (minimização, LGPD). Os demais campos do ERP ficam fora (seção 3). |

**Decisões derivadas do escopo combinado e da baseline (sem questão nova):**
- todos os campos novos são **opcionais**; só o nome (ou a razão social) é obrigatório, como hoje (RF22, escopo de 19/10/2026);
- o aviso da Nova venda só aparece quando o negócio liga **"Emito nota fiscal de produtos"** (SPEC-021). Sem a opção, o negócio declarou que não emite nota de produto, e o aviso só atrapalharia. O selo aparece sempre na tela de Clientes;
- o **documento é único no negócio** entre os clientes não anonimizados, para não haver duas fichas da mesma pessoa; negócios diferentes podem ter o mesmo;
- o **contato** atual é migrado para e-mail ou telefone, sem perda, e valores antigos fora do formato são mantidos até serem alterados (mesmo padrão da OPEN-002 da SPEC-021);
- a **inscrição estadual** é guardada como informada, sem validar os dígitos de cada estado;
- o **suporte** vê tudo mascarado, inclusive o nome, e não consulta CEP nem CNPJ (RN30, SPEC-018);
- a **exportação inclui** os campos novos e a **exclusão de conta** os limpa (RNF04, RN27);
- a **Política de Privacidade** ganha nova versão, com novo aceite, como na SPEC-018;
- está nos **dois planos** (SPEC-013, RN18);
- o código **IBGE do município** e os outros campos técnicos da nota ficam para a Spec da nota fiscal.

---

## 14. Definition of Done da Spec

A SPEC-022 estará concluída quando:

- [ ] todos os critérios de aceitação (CA-01 a CA-18) estiverem implementados, por testes, no navegador (build local) e na homologação (T14);
- [ ] todos os invariantes (INV-001 a INV-011) estiverem preservados;
- [ ] os testes derivados (T01 a T14) estiverem aprovados, com o CI verde no PR;
- [ ] os RNFs aplicáveis (RNF01, RNF02, RNF04, RNF10) tiverem sido verificados como descrito na seção 10;
- [x] as questões OPEN-001 a OPEN-009 tiverem sido decididas e registradas (22/10/2026), com RF22, RF58, RF76 e RN27 alterados e o RF81 e a RN36 incluídos na baseline;
- [ ] a nova versão da Política de Privacidade e dos Termos de Uso estiver publicada, com o novo aceite;
- [ ] os documentos de modelo (seção 7) e a nota de ampliação da ADR-006 estiverem atualizados;
- [ ] não existir divergência conhecida entre a implementação e esta Spec;
- [ ] toda divergência em relação à baseline tiver sido explicitamente analisada e registrada.

**Regra fundamental:** a implementação obedece a esta Spec aprovada. Se surgir conflito entre código, Spec e documentos de modelagem, o comportamento não é alterado em silêncio: a divergência é registrada com a proposta de (1) corrigir a implementação ou (2) alterar a baseline, e a decisão é da equipe.
