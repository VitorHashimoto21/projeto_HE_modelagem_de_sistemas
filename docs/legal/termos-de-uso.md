# Termos de Uso — Health Enterprise

> **RASCUNHO — versão 2026-10-23 — revisão do grupo pendente (SPEC-002, OPEN-003; acesso de suporte: SPEC-018; cadastro de clientes: SPEC-022).**
> Itens entre `[colchetes]` precisam ser preenchidos pelo grupo. Antes da produção, recomenda-se revisão jurídica.

**Versão:** 2026-10-23 · **Vigência:** a partir da publicação

**O que mudou nesta versão:** a seção 4 trata do cadastro completo de clientes (CPF ou CNPJ, endereço e contato), da consulta de CEP e CNPJ em base pública e da exclusão de um cliente; a seção 4-A passa a dizer que o suporte vê esses dados mascarados.

**Versão anterior (2026-10-17):** nova seção 4-A, sobre o acesso de suporte liberado pelo Dono.

Ao criar uma conta no Health Enterprise ("HE"), você concorda com estes Termos e com a [Política de Privacidade](politica-de-privacidade.md).

## 1. O serviço

O HE é um sistema web de gestão para microempreendedores e autônomos, com controle de estoque, registro de vendas, financeiro, calculadora de precificação e painel de saúde financeira. O serviço é oferecido por `[nome do responsável / razão social e CNPJ, quando houver]`.

## 2. Conta

- Para usar o HE, você precisa criar uma conta com nome, e-mail válido e senha, e confirmar o e-mail.
- Você é responsável por manter a senha em sigilo e por tudo o que for feito com a sua conta.
- Avise-nos em `[e-mail de contato]` se suspeitar de uso indevido.

## 3. Negócios e equipe

- Você pode cadastrar um ou mais negócios e convidar pessoas para a sua equipe, definindo o papel e as permissões de cada uma.
- O Dono de um negócio é responsável pelos acessos que concede e pelos dados que a equipe registra.

## 4. Seus dados e os dados dos seus clientes

- Os dados que você registra sobre o seu negócio continuam sendo seus.
- Se registrar dados pessoais dos seus clientes (nome, CPF ou CNPJ, endereço, e-mail e telefone), você é o controlador desses dados e deve ter base legal para isso (LGPD), registrando só o que precisar — por exemplo, para identificar a venda e emitir a nota fiscal. O HE trata esses dados apenas para prestar o serviço.
- Ao completar o endereço pelo CEP ou os dados de uma empresa pelo CNPJ, o HE consulta uma base pública (BrasilAPI) enviando só o CEP ou o CNPJ. O CPF nunca é enviado a serviço externo. Confira os dados preenchidos: eles vêm da base pública e podem estar desatualizados.
- Você define quem da equipe vê o cadastro completo dos clientes pelas permissões de Vendas; quem não pode editar vendas vê esses dados em parte.
- Quando um cliente pedir, você pode excluí-lo: sem compras, o cadastro é apagado; com compras, os dados pessoais dele são apagados e as vendas continuam registradas, sem identificação.
- Você pode exportar os seus dados e excluir a sua conta a qualquer momento, nos termos da Política de Privacidade.

## 4-A. Acesso de suporte

- Quando precisar de ajuda, o **Dono** pode liberar o suporte do HE para **ver** (sem alterar) os módulos que escolher do negócio, informando o motivo, por um prazo de até 7 dias. Sem essa liberação, o suporte não vê os dados do negócio.
- O suporte vê os dados em modo **somente leitura**, com os dados dos clientes (nome, documento, contato e endereço) e os e-mails da equipe mascarados (os valores dos módulos liberados, como vendas e saldo, aparecem normalmente), e age em nome próprio, sem usar a sua conta ou a sua senha.
- Cada acesso fica registrado e visível ao Dono, que pode revogá-lo a qualquer momento. Detalhes na seção 5 da Política de Privacidade.
- O HE **nunca pede a sua senha**, nem para o suporte.

## 5. Calculadora de precificação e informações fiscais

- A calculadora sugere preços a partir dos dados que você informa e de parâmetros fiscais oficiais (como as faixas do Simples Nacional e o valor do DAS do MEI), mantidos atualizados pela equipe do HE.
- **As sugestões são uma ferramenta de apoio à decisão e não substituem a orientação de um contador.** O preço oficial de cada item é sempre definido e confirmado por você.
- A legislação tributária muda com frequência. Fazemos o possível para manter os parâmetros corretos, mas não garantimos que estejam livres de erro em todo momento.

## 6. Planos

- O plano gratuito oferece todos os módulos principais, sem limite de quantidade de produtos, vendas ou lançamentos, e permite o Dono e 1 colaborador.
- O plano pago libera relatórios avançados e mais colaboradores. Valores e forma de cobrança serão informados antes da contratação.
- Ao voltar para o plano gratuito, nenhum dado é apagado.

## 7. Uso permitido

Você concorda em não:

- usar o HE para atividades ilegais ou para registrar dados sem base legal;
- tentar acessar dados de outros negócios ou contornar as permissões do sistema;
- sobrecarregar, interferir ou tentar comprometer a segurança do serviço.

O descumprimento pode levar à suspensão da conta.

## 8. Disponibilidade

Trabalhamos para manter o HE disponível e seguro, com backup diário, mas o serviço pode ter interrupções para manutenção ou por falhas de terceiros. `[Durante a fase acadêmica/MVP, o serviço é oferecido como está, sem garantia de disponibilidade.]`

## 9. Responsabilidade

Na medida permitida pela lei, o HE não se responsabiliza por decisões de negócio tomadas com base nas informações do sistema, nem por dados registrados de forma incorreta pelos usuários.

## 10. Encerramento

Você pode excluir a sua conta a qualquer momento. Podemos encerrar contas que violem estes Termos, com aviso prévio sempre que possível.

## 11. Mudanças nestes Termos

Quando estes Termos mudarem, a versão e a data acima serão atualizadas. Se a mudança for relevante, pediremos que você aceite a nova versão no próximo acesso.

## 12. Lei aplicável

Estes Termos seguem a legislação brasileira. Fica eleito o foro de `[cidade/UF]`.
