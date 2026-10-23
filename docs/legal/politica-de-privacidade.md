# Política de Privacidade — Health Enterprise

> **RASCUNHO — versão 2026-10-23 — revisão do grupo pendente (SPEC-002, OPEN-003; acesso de suporte: SPEC-018; cadastro de clientes: SPEC-022).**
> Escrito a partir do que o sistema faz segundo a baseline (RF, RN, RNF04, RN27). Itens entre `[colchetes]` precisam ser preenchidos pelo grupo. Antes da produção, recomenda-se revisão jurídica.

**Versão:** 2026-10-23 · **Vigência:** a partir da publicação

**O que mudou nesta versão:** o **cadastro de clientes** do negócio passa a guardar, além do nome, CPF ou CNPJ, endereço, e-mail e telefone, para identificar a venda e preparar a nota fiscal. O endereço pode ser completado pelo CEP e os dados de uma empresa pelo CNPJ, em base pública, sem envio de CPF. A política agora diz quem da equipe vê esses dados completos e como excluir um cliente a pedido dele (seções 2, 3, 4, 5, 6 e 7).

**Versão anterior (2026-10-17):** passou a existir o **acesso de suporte** — o Dono pode liberar o suporte do HE para ver (sem alterar) os módulos escolhidos do negócio, por um prazo, com registro de cada tela aberta.

Esta política explica quais dados pessoais o Health Enterprise ("HE", "nós") trata, para quê, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).

## 1. Quem é o responsável

O HE é um sistema de gestão (ERP simplificado e calculadora de precificação) para microempreendedores e autônomos, desenvolvido por `[nome do responsável / razão social e CNPJ, quando houver]`.

- **Contato do encarregado (DPO):** `[e-mail de contato para privacidade]`

## 2. Papéis: quando somos controladores e quando somos operadores

- **Dados da sua conta** (nome, e-mail, senha, consentimento): o HE é **controlador**.
- **Dados que você registra sobre o seu negócio e os seus clientes** (produtos, vendas, finanças e o cadastro de clientes): **você é o controlador** desses dados, e o HE é **operador** — tratamos esses dados apenas para prestar o serviço, conforme as suas instruções.
- **Base legal para os dados dos seus clientes:** cabe a você, como controlador, ter base legal para registrá-los. Em geral, o nome e o contato servem à **execução do contrato** de compra e venda com o cliente (art. 7º, V), e o CPF ou CNPJ e o endereço servem ao **cumprimento de obrigação legal ou regulatória** de emitir a nota fiscal (art. 7º, II). Registre só o que precisar: com exceção do nome, todos os campos são opcionais.
- **Acesso de suporte:** a equipe de suporte do HE só vê os dados de um negócio quando o **Dono libera** esse acesso (seção 5). A liberação é a sua instrução, como controlador, para que o HE trate esses dados com a finalidade informada no pedido.

## 3. Quais dados tratamos e para quê

| Dados | Origem | Finalidade | Base legal (LGPD) |
|---|---|---|---|
| Nome e e-mail | Cadastro | Criar e identificar a conta, comunicar sobre a conta (confirmação, recuperação de senha, convites) | Execução de contrato (art. 7º, V) |
| Senha | Cadastro | Autenticação. É guardada **somente com hash seguro** pelo provedor de autenticação; nem a equipe do HE tem acesso a ela | Execução de contrato (art. 7º, V) |
| Data e versão do aceite desta política e dos termos | Cadastro | Comprovar o consentimento e saber qual versão foi aceita | Cumprimento de obrigação legal (art. 7º, II) |
| Dados do negócio: CNPJ, razão social, CNAE, regime tributário | Informados por você ou consultados na base pública de CNPJ da Receita Federal (BrasilAPI) | Enquadramento fiscal e cálculo de preço | Execução de contrato (art. 7º, V) |
| Dados operacionais: produtos, estoque, vendas, pagamentos, contas, despesas | Registrados por você e pela sua equipe | Prestar as funções do sistema (estoque, vendas, financeiro, calculadora, dashboard) | Execução de contrato (art. 7º, V) — como operador |
| Cadastro de clientes do seu negócio: nome ou razão social, nome fantasia, CPF ou CNPJ, inscrições estadual e municipal, nome de quem compra, e-mail, telefone e endereço (todos opcionais, menos o nome) | Registrados por você e pela sua equipe, na tela de Clientes ou na venda. O endereço pode ser completado pelo CEP, e os dados de uma empresa (razão social, nome fantasia, endereço, telefone e e-mail) pelo CNPJ, na base pública da Receita Federal | Identificar a venda, mostrar as compras do cliente e preparar a nota fiscal | Definida por você, como controlador (seção 2) |
| Registro de quem fez cada alteração de estoque, preço e cancelamento de venda | Gerado pelo sistema | Auditoria e segurança (RNF05) | Legítimo interesse (art. 7º, IX) e execução de contrato |
| Liberações do acesso de suporte e registro de cada tela aberta pelo suporte | Gerados pelo sistema quando o Dono libera o acesso | Transparência e auditoria do suporte; o Dono acompanha tudo | Legítimo interesse (art. 7º, IX) e execução de contrato |
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

**Dados dos clientes:** só quem pode **editar vendas** (o Dono e, por padrão, o Gerente) vê o cadastro completo dos clientes. Quem só **vê** as vendas (por padrão, o Colaborador) vê o nome completo, mas o CPF ou CNPJ, o e-mail e o telefone aparecem em parte e, do endereço, só o município e a UF. A lista de clientes mostra o documento em parte para todos. Essa máscara é feita no servidor: o dado completo nem chega ao aparelho de quem não pode vê-lo.

**Única exceção — o acesso de suporte, liberado pelo Dono:**

- O Dono pode liberar, em *Configurações → Acesso do suporte*, o suporte do HE para **ver** (nunca alterar) os **módulos que escolher**, informando o motivo, por **1 hora, 24 horas, 3 dias ou 7 dias**. Gerente e Colaborador pedem ao Dono.
- Sem essa liberação, o suporte vê apenas dados de cadastro do negócio (nome, regime, plano, data de criação, número de membros e nome e e-mail do Dono) — nunca vendas, valores, clientes ou estoque.
- Durante o acesso, **os dados dos clientes (nome, documento, contato e endereço) e os e-mails da equipe aparecem mascarados** para o suporte, e nenhum arquivo é baixado. O suporte também não consulta CEP nem CNPJ. Os **valores** dos módulos liberados (de cada venda e, com Dashboard e Financeiro, o saldo, as entradas, as saídas e as contas) aparecem normalmente, porque são necessários para entender o problema; o Dono vê esse aviso ao escolher os módulos.
- O suporte age **em nome próprio**: nunca entra "como" você e nunca tem acesso à sua senha.
- **Cada entrada, tela aberta e saída fica registrada** com data, hora e nome de quem acessou. O Dono vê esse registro, a equipe vê um aviso enquanto o acesso estiver liberado, e o Dono recebe e-mail ao liberar e quando o suporte entra.
- O Dono pode **revogar** o acesso a qualquer momento; ele também termina sozinho no fim do prazo.
- O registro do suporte é guardado por **5 anos** e não pode ser alterado nem apagado.

## 6. Por quanto tempo guardamos

- **Enquanto a conta existir**, mantemos os dados para prestar o serviço.
- **Ao excluir a conta**, o acesso é bloqueado e os dados pessoais são **anonimizados** (nome, e-mail e senha; todos os dados dos clientes — nome, documento, inscrições, contato e endereço — dos negócios em que você é o único Dono).
- **Ao excluir um cliente**, o cadastro é apagado se ele não tiver compras. Se tiver, os dados pessoais dele são apagados e as vendas continuam registradas, sem identificação e com os mesmos valores.
- **Registros fiscais e financeiros** desses negócios (vendas, lançamentos, contas, movimentações) são mantidos **por 5 anos, sem identificação pessoal**, para cumprimento de obrigações legais (RN27).
- Cópias de segurança são mantidas por até `[90]` dias.

## 7. Seus direitos

Você pode, a qualquer momento (art. 18 da LGPD):

- **Confirmar e acessar** os seus dados;
- **Exportar** os seus dados — o sistema gera um arquivo `.zip` com os dados em JSON (completo) e CSV (por tabela);
- **Corrigir** dados incompletos ou desatualizados;
- **Excluir** a conta, com anonimização dos dados pessoais, nos termos da seção 6;
- **Revogar o consentimento**, o que implica excluir a conta, já que o consentimento é condição para usar o serviço;
- **Pedir informações** sobre o compartilhamento dos seus dados.

Para pedidos que não estejam disponíveis no próprio sistema, escreva para `[e-mail de contato para privacidade]`. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

**Os clientes do seu negócio** exercem esses direitos junto a você, que é o controlador dos dados deles. O sistema ajuda a atender: na tela de Clientes, você corrige o cadastro, e **"Excluir cliente"** apaga os dados pessoais dele (seção 6). A exportação da conta também traz o cadastro completo dos clientes.

## 8. Segurança

Usamos conexão criptografada (HTTPS), senha com hash seguro no provedor de autenticação, isolamento dos dados por negócio no código e no banco de dados, controle de acesso por papel validado no servidor, registro de auditoria das alterações sensíveis e backup diário. As contas da equipe de suporte são poucas, exclusivas para essa função, com sessão limitada a 8 horas, e só acessam um negócio com a liberação do Dono, em modo somente leitura.

## 9. Mudanças nesta política

Quando esta política mudar, a versão e a data acima serão atualizadas. Se a mudança for relevante, pediremos que você aceite a nova versão no próximo acesso.
