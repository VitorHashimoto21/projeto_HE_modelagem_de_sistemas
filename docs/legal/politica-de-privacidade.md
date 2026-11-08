# Política de Privacidade — Health Enterprise

> **RASCUNHO — versão 2026-11-07 — revisão do grupo pendente (SPEC-002, OPEN-003; acesso de suporte: SPEC-018; cadastro de clientes: SPEC-022; cadastro de fornecedores: SPEC-026; correções, emergência, suspensão e troca de plano pela plataforma: SPEC-019).**
> Escrito a partir do que o sistema faz segundo a baseline (RF, RN, RNF04, RN27). Itens entre `[colchetes]` precisam ser preenchidos pelo grupo. Antes da produção, recomenda-se revisão jurídica.

**Versão:** 2026-11-07 · **Vigência:** a partir da publicação

**O que mudou nesta versão:** o suporte do HE ganha quatro capacidades, todas com registro que o Dono vê:
- **correções:** o Dono pode liberar o suporte para **corrigir** alguns módulos, só nas ações de uma lista fechada, com o antes e o depois registrados, e pode **desfazer** cada correção em até 30 dias;
- **acesso de emergência:** sem a liberação do Dono, só em três casos (ordem judicial ou requisição de autoridade, incidente de segurança ou Dono sem acesso), com a aprovação de **duas pessoas** da equipe, somente leitura, por até 4 horas, e com **aviso imediato** ao Dono, que pode encerrar o acesso;
- **suspensão do negócio:** o HE pode suspender um negócio por motivos de uma lista fechada; ele fica **somente leitura**, sem apagar nada, e a exportação e a exclusão da conta continuam;
- **troca de plano pela plataforma:** com a aprovação de duas pessoas da equipe, e o Dono é avisado.

As contas da equipe de suporte passam a usar um **2º fator obrigatório**. A exportação dos seus dados passa a trazer esses registros e os pedidos da plataforma (seções 2, 3, 5, 6, 7 e 8).

**Versão anterior (2026-11-01):** o negócio passa a ter um **cadastro de fornecedores**, com os mesmos dados do cadastro de clientes (nome ou razão social, CPF ou CNPJ, inscrições, contato e endereço), para ligar as contas a pagar a quem se paga. Um fornecedor pessoa física tem dados pessoais guardados pelo negócio, como os clientes. A política agora diz quem da equipe vê esses dados completos, que o suporte os vê mascarados e como excluir um fornecedor (seções 2, 3, 5, 6 e 7).

**Versão de 2026-10-23:** o **cadastro de clientes** do negócio passa a guardar, além do nome, CPF ou CNPJ, endereço, e-mail e telefone, para identificar a venda e preparar a nota fiscal. O endereço pode ser completado pelo CEP e os dados de uma empresa pelo CNPJ, em base pública, sem envio de CPF. A política agora diz quem da equipe vê esses dados completos e como excluir um cliente a pedido dele (seções 2, 3, 4, 5, 6 e 7).

**Versão de 2026-10-17:** passou a existir o **acesso de suporte** — o Dono pode liberar o suporte do HE para ver (sem alterar) os módulos escolhidos do negócio, por um prazo, com registro de cada tela aberta.

Esta política explica quais dados pessoais o Health Enterprise ("HE", "nós") trata, para quê, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).

## 1. Quem é o responsável

O HE é um sistema de gestão (ERP simplificado e calculadora de precificação) para microempreendedores e autônomos, desenvolvido por `[nome do responsável / razão social e CNPJ, quando houver]`.

- **Contato do encarregado (DPO):** `[e-mail de contato para privacidade]`

## 2. Papéis: quando somos controladores e quando somos operadores

- **Dados da sua conta** (nome, e-mail, senha, consentimento): o HE é **controlador**.
- **Dados que você registra sobre o seu negócio, os seus clientes e os seus fornecedores** (produtos, vendas, finanças e os cadastros de clientes e de fornecedores): **você é o controlador** desses dados, e o HE é **operador** — tratamos esses dados apenas para prestar o serviço, conforme as suas instruções.
- **Base legal para os dados dos seus clientes:** cabe a você, como controlador, ter base legal para registrá-los. Em geral, o nome e o contato servem à **execução do contrato** de compra e venda com o cliente (art. 7º, V), e o CPF ou CNPJ e o endereço servem ao **cumprimento de obrigação legal ou regulatória** de emitir a nota fiscal (art. 7º, II). Registre só o que precisar: com exceção do nome, todos os campos são opcionais. O mesmo vale para os **fornecedores pessoa física**: em geral, o nome e o contato servem à execução do contrato de compra com o fornecedor, e o documento e o endereço, às obrigações fiscais.
- **Acesso de suporte:** a equipe de suporte do HE só vê os dados de um negócio quando o **Dono libera** esse acesso (seção 5). A liberação é a sua instrução, como controlador, para que o HE trate esses dados com a finalidade informada no pedido; com as correções liberadas, também para corrigir os registros das ações permitidas.
- **Acesso de emergência e suspensão:** sem a liberação do Dono, o HE só vê os dados de um negócio num **acesso de emergência**, e só para ordem judicial ou requisição de autoridade competente (cumprimento de obrigação legal, art. 7º, II), para tratar um incidente de segurança ou falha que afeta os dados do negócio, ou para diagnosticar um problema quando o Dono está sem acesso, a pedido de um membro (legítimo interesse na segurança e na continuidade do serviço, art. 7º, IX). A **suspensão** de um negócio segue as mesmas bases e os Termos de Uso. Nos dois casos, o Dono é avisado na hora (seção 5).

## 3. Quais dados tratamos e para quê

| Dados | Origem | Finalidade | Base legal (LGPD) |
|---|---|---|---|
| Nome e e-mail | Cadastro | Criar e identificar a conta, comunicar sobre a conta (confirmação, recuperação de senha, convites) | Execução de contrato (art. 7º, V) |
| Senha | Cadastro | Autenticação. É guardada **somente com hash seguro** pelo provedor de autenticação; nem a equipe do HE tem acesso a ela | Execução de contrato (art. 7º, V) |
| Data e versão do aceite desta política e dos termos | Cadastro | Comprovar o consentimento e saber qual versão foi aceita | Cumprimento de obrigação legal (art. 7º, II) |
| Dados do negócio: CNPJ, razão social, CNAE, regime tributário | Informados por você ou consultados na base pública de CNPJ da Receita Federal (BrasilAPI) | Enquadramento fiscal e cálculo de preço | Execução de contrato (art. 7º, V) |
| Dados operacionais: produtos, estoque, vendas, pagamentos, contas, despesas | Registrados por você e pela sua equipe | Prestar as funções do sistema (estoque, vendas, financeiro, calculadora, dashboard) | Execução de contrato (art. 7º, V) — como operador |
| Cadastro de clientes do seu negócio: nome ou razão social, nome fantasia, CPF ou CNPJ, inscrições estadual e municipal, nome de quem compra, e-mail, telefone e endereço (todos opcionais, menos o nome) | Registrados por você e pela sua equipe, na tela de Clientes ou na venda. O endereço pode ser completado pelo CEP, e os dados de uma empresa (razão social, nome fantasia, endereço, telefone e e-mail) pelo CNPJ, na base pública da Receita Federal | Identificar a venda, mostrar as compras do cliente e preparar a nota fiscal | Definida por você, como controlador (seção 2) |
| Cadastro de fornecedores do seu negócio: nome ou razão social, nome fantasia, CPF ou CNPJ, inscrições estadual e municipal, nome do contato, e-mail, telefone e endereço (todos opcionais, menos o nome), e o fornecedor ligado a cada conta a pagar e despesa fixa | Registrados por você e pela sua equipe, no Financeiro. O endereço pode ser completado pelo CEP, e os dados de uma empresa pelo CNPJ, na base pública da Receita Federal | Saber a quem cada conta é paga, encontrar as contas de um fornecedor e preparar uma futura nota fiscal | Definida por você, como controlador (seção 2) |
| Registro de quem fez cada alteração de estoque, preço e cancelamento de venda | Gerado pelo sistema | Auditoria e segurança (RNF05) | Legítimo interesse (art. 7º, IX) e execução de contrato |
| Registro do suporte: liberações, cada tela aberta, as correções (com o antes e o depois de cada campo), os desfazimentos, os pedidos e acessos de emergência (motivo, referência, justificativa, quem pediu, quem aprovou e o resultado), as suspensões e reativações e as trocas de plano pela plataforma | Gerado pelo sistema a cada ação do suporte, da equipe do HE e do Dono | Transparência e auditoria do suporte; o Dono acompanha tudo | Legítimo interesse (art. 7º, IX) e execução de contrato |
| Contas da equipe de suporte do HE: o nome de cada autenticador do 2º fator e o momento do último código | Cadastrados pela própria equipe. O segredo do autenticador fica **só no provedor de autenticação** | Proteger as contas com acesso de suporte | Legítimo interesse (art. 7º, IX) e segurança (art. 46) |
| Cookies de sessão | Gerados no login | Manter você conectado com segurança | Estritamente necessários; não usamos cookies de publicidade nem de rastreamento |

Não vendemos dados pessoais e não os usamos para publicidade.

## 4. Com quem compartilhamos

Apenas com prestadores necessários para o funcionamento do serviço, que atuam como suboperadores:

| Prestador | Para quê | Onde |
|---|---|---|
| Supabase | Banco de dados e autenticação | `[região do projeto Supabase]` |
| Vercel | Hospedagem da aplicação | Estados Unidos e outras regiões |
| Resend | Envio de e-mails da conta (confirmação, recuperação de senha, convites) | Estados Unidos |
| BrasilAPI | Consulta pública de CNPJ (dados abertos da Receita Federal) e de CEP. Só o CNPJ ou o CEP consultado é enviado; o **CPF nunca é enviado** a nenhum serviço | Brasil |

Alguns prestadores ficam fora do Brasil. Nesses casos, a transferência internacional segue o art. 33 da LGPD, com prestadores que adotam cláusulas contratuais e medidas de segurança adequadas.

Dados também podem ser compartilhados por ordem judicial ou exigência legal.

## 5. Quem da sua equipe vê o quê

Os dados de cada negócio são isolados: só os membros convidados para aquele negócio têm acesso, e cada um vê apenas o que o papel e as permissões dele permitem (Dono, Gerente, Colaborador).

**Dados dos clientes:** só quem pode **editar vendas** (o Dono e, por padrão, o Gerente) vê o cadastro completo dos clientes. Quem só **vê** as vendas (por padrão, o Colaborador) vê o nome completo, mas o CPF ou CNPJ, o e-mail e o telefone aparecem em parte e, do endereço, só o município e a UF. A lista de clientes mostra o documento em parte para todos. Essa máscara é feita no servidor: o dado completo nem chega ao aparelho de quem não pode vê-lo. Quem vê o **Financeiro** também vê o **nome** do cliente ligado a uma conta a receber, sem os demais dados.

**Dados dos fornecedores:** seguem a mesma regra, com as permissões do Financeiro: só quem pode **editar no Financeiro** vê o cadastro completo; quem só **vê** o Financeiro vê o nome, mas o CPF ou CNPJ, o e-mail e o telefone em parte e, do endereço, só o município e a UF.

**Exceção — o acesso de suporte, liberado pelo Dono:**

- O Dono pode liberar, em *Configurações → Acesso do suporte*, o suporte do HE para **ver** os **módulos que escolher**, informando o motivo, por **1 hora, 24 horas, 3 dias ou 7 dias**, e, se quiser, para **corrigir** alguns deles (veja "Correções autorizadas pelo Dono", abaixo). Gerente e Colaborador pedem ao Dono.
- Sem essa liberação, o suporte vê apenas dados de cadastro do negócio (nome, regime, plano, data de criação, número de membros, nome e e-mail do Dono e se o negócio está suspenso) — nunca vendas, valores, clientes ou estoque. A única outra exceção é o **acesso de emergência**, descrito abaixo.
- Durante o acesso, **os dados dos clientes e dos fornecedores (nome, documento, contato e endereço) e os e-mails da equipe aparecem mascarados** para o suporte, e nenhum arquivo é baixado. O suporte também não consulta CEP nem CNPJ. Os **valores** dos módulos liberados (de cada venda e, com Dashboard e Financeiro, o saldo, as entradas, as saídas e as contas) aparecem normalmente, porque são necessários para entender o problema; o Dono vê esse aviso ao escolher os módulos.
- O suporte age **em nome próprio**: nunca entra "como" você e nunca tem acesso à sua senha.
- **Cada entrada, tela aberta e saída fica registrada** com data, hora e nome de quem acessou. O Dono vê esse registro, a equipe vê um aviso enquanto o acesso estiver liberado, e o Dono recebe e-mail ao liberar e quando o suporte entra.
- O Dono pode **revogar** o acesso a qualquer momento; ele também termina sozinho no fim do prazo.
- O registro do suporte é guardado por **5 anos** e não pode ser alterado nem apagado.

**Correções autorizadas pelo Dono:**

- Ao liberar o acesso, o Dono pode marcar alguns módulos (Catálogo, Estoque, Calculadora e Financeiro) como **"ver e corrigir"**, por até **12 horas**. Vendas, clientes, fornecedores, equipe, Configurações, plano e LGPD **nunca** são alterados pelo suporte.
- O suporte só faz as correções de uma **lista fechada** (por exemplo, o custo de um item ou um lançamento em dobro), e cada uma fica registrada na hora, com o **antes e o depois** de cada campo, em *Configurações → Acesso do suporte*.
- O Dono pode **desfazer** cada correção em até **30 dias**, uma vez, enquanto o registro continuar como a correção deixou. O desfazer é uma operação nova, em nome do Dono: nada é apagado.

**Acesso de emergência (sem a liberação do Dono):**

- Só nos três casos da seção 2, informando a referência (o processo ou ofício, o incidente ou o membro que pediu) e a justificativa.
- Uma pessoa da equipe pede e **outra** aprova, em até 12 horas. Ninguém aprova o próprio pedido, e o código do 2º fator é pedido de novo nas duas pontas.
- O Dono vê o pedido em *Acesso do suporte* **desde o pedido** e recebe e-mail. Não existe acesso secreto no HE.
- O acesso é **somente leitura**, só nos módulos pedidos, por **1, 2 ou 4 horas**, sem renovação, com os mesmos cuidados do acesso liberado: dados de clientes e fornecedores mascarados, nenhum arquivo baixado e cada tela registrada. Todos os membros veem uma faixa vermelha enquanto durar, e o Dono pode **encerrar** o acesso a qualquer momento.
- Ao terminar, quem pediu registra o **resultado**, que o Dono também vê.

**Suspensão do negócio:**

- O HE pode suspender um negócio a pedido do Dono, por uso indevido segundo os Termos de Uso, por incidente de segurança ou por ordem judicial, com uma descrição que o Dono lê em *Acesso do suporte*.
- Enquanto durar, os membros entram e **veem tudo**, mas **nada é gravado** nos módulos nem em Configurações. **Nada é apagado.** Exportar os dados e excluir a conta continuam, e o Dono continua podendo liberar o suporte para pedir ajuda.
- O Dono é avisado na hora, no sistema e por e-mail, na suspensão e na reativação.

**Troca de plano pela plataforma:** a equipe do HE pode trocar o plano de um negócio (cortesia, correção ou teste), com a aprovação de **duas pessoas** e a descrição do motivo. O Dono é avisado, e nada é apagado.

## 6. Por quanto tempo guardamos

- **Enquanto a conta existir**, mantemos os dados para prestar o serviço.
- **Ao excluir a conta**, o acesso é bloqueado e os dados pessoais são **anonimizados** (nome, e-mail e senha; todos os dados dos clientes e dos fornecedores — nome, documento, inscrições, contato e endereço — dos negócios em que você é o único Dono).
- **Ao excluir um cliente**, o cadastro é apagado se ele não tiver compras nem contas a receber. Se tiver, os dados pessoais dele são apagados e as vendas e as contas continuam registradas, sem identificação e com os mesmos valores.
- **Ao excluir um fornecedor**, o cadastro é apagado se ele não tiver contas nem despesas fixas. Se tiver, os dados dele são apagados e as contas continuam registradas, sem identificação e com os mesmos valores.
- **Registro do suporte e pedidos da plataforma** (seção 5): guardados por **5 anos**, sem alteração; ao excluir a conta, os nomes ficam anonimizados como os demais dados pessoais.
- **Registros fiscais e financeiros** desses negócios (vendas, lançamentos, contas, movimentações) são mantidos **por 5 anos, sem identificação pessoal**, para cumprimento de obrigações legais (RN27).
- Cópias de segurança são mantidas por até `[90]` dias.

## 7. Seus direitos

Você pode, a qualquer momento (art. 18 da LGPD):

- **Confirmar e acessar** os seus dados;
- **Exportar** os seus dados — o sistema gera um arquivo `.zip` com os dados em JSON (completo) e CSV (por tabela). Nos negócios em que você é o Dono, ele traz também o registro do suporte (inclusive as correções, os desfazimentos, as emergências e as suspensões) e os pedidos da plataforma;
- **Corrigir** dados incompletos ou desatualizados;
- **Excluir** a conta, com anonimização dos dados pessoais, nos termos da seção 6;
- **Revogar o consentimento**, o que implica excluir a conta, já que o consentimento é condição para usar o serviço;
- **Pedir informações** sobre o compartilhamento dos seus dados.

Para pedidos que não estejam disponíveis no próprio sistema, escreva para `[e-mail de contato para privacidade]`. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

**Os clientes do seu negócio** exercem esses direitos junto a você, que é o controlador dos dados deles. O sistema ajuda a atender: na tela de Clientes, você corrige o cadastro, e **"Excluir cliente"** apaga os dados pessoais dele (seção 6). A exportação da conta também traz o cadastro completo dos clientes. Os **fornecedores** do seu negócio também exercem esses direitos junto a você: na tela de Fornecedores, você corrige o cadastro, e **"Excluir fornecedor"** apaga os dados dele; a exportação da conta traz o cadastro dos fornecedores.

## 8. Segurança

Usamos conexão criptografada (HTTPS), senha com hash seguro no provedor de autenticação, isolamento dos dados por negócio no código e no banco de dados, controle de acesso por papel validado no servidor, registro de auditoria das alterações sensíveis e backup diário. As contas da equipe de suporte são poucas, exclusivas para essa função, com **2º fator obrigatório** (código de um aplicativo autenticador) e sessão limitada a 8 horas. O código é pedido de novo antes das ações críticas, como entrar para corrigir, suspender um negócio ou pedir uma emergência. Elas só acessam um negócio com a liberação do Dono ou numa emergência aprovada por duas pessoas, e só corrigem o que o Dono liberou.

## 9. Mudanças nesta política

Quando esta política mudar, a versão e a data acima serão atualizadas. Se a mudança for relevante, pediremos que você aceite a nova versão no próximo acesso.
