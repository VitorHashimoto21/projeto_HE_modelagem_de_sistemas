# Política de Privacidade — Health Enterprise

> **RASCUNHO — versão 2026-10-03 — revisão do grupo pendente (SPEC-002, OPEN-003).**
> Escrito a partir do que o sistema faz segundo a baseline (RF, RN, RNF04, RN27). Itens entre `[colchetes]` precisam ser preenchidos pelo grupo. Antes da produção, recomenda-se revisão jurídica.

**Versão:** 2026-10-03 · **Vigência:** a partir da publicação

Esta política explica quais dados pessoais o Health Enterprise ("HE", "nós") trata, para quê, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).

## 1. Quem é o responsável

O HE é um sistema de gestão (ERP simplificado e calculadora de precificação) para microempreendedores e autônomos, desenvolvido por `[nome do responsável / razão social e CNPJ, quando houver]`.

- **Contato do encarregado (DPO):** `[e-mail de contato para privacidade]`

## 2. Papéis: quando somos controladores e quando somos operadores

- **Dados da sua conta** (nome, e-mail, senha, consentimento): o HE é **controlador**.
- **Dados que você registra sobre o seu negócio e os seus clientes** (produtos, vendas, finanças, nome e contato de clientes): **você é o controlador** desses dados, e o HE é **operador** — tratamos esses dados apenas para prestar o serviço, conforme as suas instruções. Cabe a você ter base legal para registrar os dados dos seus clientes.

## 3. Quais dados tratamos e para quê

| Dados | Origem | Finalidade | Base legal (LGPD) |
|---|---|---|---|
| Nome e e-mail | Cadastro | Criar e identificar a conta, comunicar sobre a conta (confirmação, recuperação de senha, convites) | Execução de contrato (art. 7º, V) |
| Senha | Cadastro | Autenticação. É guardada **somente com hash seguro** pelo provedor de autenticação; nem a equipe do HE tem acesso a ela | Execução de contrato (art. 7º, V) |
| Data e versão do aceite desta política e dos termos | Cadastro | Comprovar o consentimento e saber qual versão foi aceita | Cumprimento de obrigação legal (art. 7º, II) |
| Dados do negócio: CNPJ, razão social, CNAE, regime tributário | Informados por você ou consultados na base pública de CNPJ da Receita Federal (BrasilAPI) | Enquadramento fiscal e cálculo de preço | Execução de contrato (art. 7º, V) |
| Dados operacionais: produtos, estoque, vendas, pagamentos, contas, despesas | Registrados por você e pela sua equipe | Prestar as funções do sistema (estoque, vendas, financeiro, calculadora, dashboard) | Execução de contrato (art. 7º, V) — como operador |
| Nome e contato de clientes do seu negócio (opcionais) | Registrados por você nas vendas | Identificar a venda | Definida por você, como controlador |
| Registro de quem fez cada alteração de estoque, preço e cancelamento de venda | Gerado pelo sistema | Auditoria e segurança (RNF05) | Legítimo interesse (art. 7º, IX) e execução de contrato |
| Cookies de sessão | Gerados no login | Manter você conectado com segurança | Estritamente necessários; não usamos cookies de publicidade nem de rastreamento |

Não vendemos dados pessoais e não os usamos para publicidade.

## 4. Com quem compartilhamos

Apenas com prestadores necessários para o funcionamento do serviço, que atuam como suboperadores:

| Prestador | Para quê | Onde |
|---|---|---|
| Supabase | Banco de dados e autenticação | `[região do projeto Supabase]` |
| Vercel | Hospedagem da aplicação | Estados Unidos e outras regiões |
| Resend | Envio de e-mails da conta (confirmação, recuperação de senha, convites) | Estados Unidos |
| BrasilAPI | Consulta pública de CNPJ (dados abertos da Receita Federal) | Brasil |

Alguns prestadores ficam fora do Brasil. Nesses casos, a transferência internacional segue o art. 33 da LGPD, com prestadores que adotam cláusulas contratuais e medidas de segurança adequadas.

Dados também podem ser compartilhados por ordem judicial ou exigência legal.

## 5. Quem da sua equipe vê o quê

Os dados de cada negócio são isolados: só os membros convidados para aquele negócio têm acesso, e cada um vê apenas o que o papel e as permissões dele permitem (Dono, Gerente, Colaborador).

## 6. Por quanto tempo guardamos

- **Enquanto a conta existir**, mantemos os dados para prestar o serviço.
- **Ao excluir a conta**, o acesso é bloqueado e os dados pessoais são **anonimizados** (nome, e-mail e senha; nome e contato dos clientes dos negócios em que você é o único Dono).
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

## 8. Segurança

Usamos conexão criptografada (HTTPS), senha com hash seguro no provedor de autenticação, isolamento dos dados por negócio no código e no banco de dados, controle de acesso por papel validado no servidor, registro de auditoria das alterações sensíveis e backup diário.

## 9. Mudanças nesta política

Quando esta política mudar, a versão e a data acima serão atualizadas. Se a mudança for relevante, pediremos que você aceite a nova versão no próximo acesso.
