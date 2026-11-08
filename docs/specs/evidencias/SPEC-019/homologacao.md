# Homologação da SPEC-019 (T17) — roteiro para a equipe

Este roteiro cobre as etapas 1 a 4 da SPEC-019 no ambiente de **homologação** (a DEVELOP publicada pela Vercel). Ele vale como o T16 (Política e Termos com novo aceite) e o T17 (seção 12 da Spec). A homologação é uma só, no fim, com um único novo aceite dos termos.

Para cada passo, marque o resultado e guarde as capturas em `docs/specs/evidencias/SPEC-019/homologacao/`, com o nome do passo (ex.: `homol_05_emergencia_faixa_1440_claro.png`). **Antes de salvar uma captura, cubra qualquer e-mail, nome ou dado pessoal real.** Os e-mails dos Administradores e dos Donos não devem aparecer.

## 0. Antes de começar

| Item | Situação em 07/11/2026 | O que fazer |
|---|---|---|
| MFA TOTP no Supabase de homologação | Ligado (conferido pela equipe) | Conferir em *Authentication → Multi-Factor*: "TOTP" habilitado. |
| `SUPABASE_URL` e `SUPABASE_SECRET_KEY` no ambiente `homologacao` do GitHub | Conferidos pela equipe | Usados só pelo `redefinir-2fator` do workflow "Administradores". |
| `SUPABASE_SECRET_KEY` na Vercel (DEVELOP) | Conferir | Sem ela, a exclusão de conta não remove a credencial na hora (a rotina diária completa). |
| Contas de Administrador | **Três** contas receberam o papel em homologação (18/10, 28/10 e 02/11) | Conferir em Painel → "Administradores". Se alguma não deveria ter o papel, rodar `retirar` para ela no workflow. Cada conta deve ser exclusiva do suporte e de uma pessoa diferente. |
| Logs antigos do workflow "Administradores" | Mostram o e-mail completo (o repositório é público) | Em *Actions → Administradores*, abrir cada execução antiga e usar "⋯" → **"Delete all logs"**. As execuções novas mostram `***` no lugar do e-mail (etapa 4b). |
| `EMISSOR_DO_AUTENTICADOR` na Vercel (opcional) | Não definido: o aplicativo autenticador mostra "Health Enterprise" | Para separar da produção, definir `HE Homologação` nas variáveis da DEVELOP e publicar de novo. |
| Branch do workflow "Administradores" | — | Até a próxima versão chegar à `main`, rodar `redefinir-2fator` **a partir da DEVELOP** (a versão da `main` ainda não tem essa ação). |

Pessoas e navegadores:
- **Conta A** e **Conta B**: duas contas de Administrador, em dois navegadores (ou perfis), cada uma com o próprio autenticador no celular. Uma pessoa pode operar as duas na homologação.
- **Dono**: uma conta comum, com um negócio de teste, num terceiro navegador ou janela anônima.
- **Colaboradora** (opcional): uma conta convidada pelo Dono, para ver as faixas como membro.

Os e-mails ao Dono não chegam enquanto não houver domínio. As faixas e "Acesso do suporte" cobrem o aviso.

## 1. Política, Termos e novo aceite (T16)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1.1 | Entrar com o Dono | Abre "Atualizamos nossos termos", versão **2026-11-07**, com o resumo: correções, emergência, suspensão e troca de plano | |
| 1.2 | Abrir a Política e os Termos pelos links | Versão 2026-11-07; a Política tem as seções "Correções autorizadas pelo Dono", "Acesso de emergência" e "Suspensão do negócio"; os Termos têm a seção 4-B | |
| 1.3 | Aceitar | Volta ao app; o aceite não é pedido de novo | |
| 1.4 | Entrar com A e com B | Cada uma aceita a nova versão depois do código do autenticador | |

## 2. 2º fator (etapa 1)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 2.1 | Conta A sem autenticador: entrar | Vai para "Configurar o 2º fator", com o QR code e o código para digitar | |
| 2.2 | Cadastrar o autenticador e digitar o código | Oferece cadastrar um segundo; "Agora não" leva ao painel com o aviso "Sua conta tem só um autenticador" | |
| 2.3 | Repetir com B, cadastrando dois autenticadores | Painel sem o aviso; em "Administradores", B com 2 autenticadores | |
| 2.4 | Sair e entrar de novo com A | Pede o código depois da senha | |

## 3. Correções e desfazer (etapa 2)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 3.1 | Dono: *Configurações → Acesso do suporte* → liberar Catálogo em "Ver e corrigir", 1 h | A gaveta mostra o que o suporte poderá corrigir; a faixa da equipe diz "pode ver … e corrigir Catálogo" | |
| 3.2 | A: ficha do negócio → "Entrar em modo suporte" | Pede o código de novo; a faixa âmbar diz "pode corrigir: Catálogo" | |
| 3.3 | A: editar o custo de um item | Grava; o Dono vê a correção em "Acesso do suporte", com o antes e o depois | |
| 3.4 | Dono: "Desfazer" | O custo volta; aparece "Desfeita por …" | |

## 4. Pedidos com duas pessoas e troca de plano (etapa 3a)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 4.1 | A: ficha → "Trocar plano" (para o pago, motivo "Teste") | Pede o código se passaram 10 min; o pedido fica pendente | |
| 4.2 | A: em "Pedidos" | No próprio pedido, "Aguardando outra pessoa" e "Cancelar", sem "Aprovar" | |
| 4.3 | B: "Aprovar" | Pede o código; o plano muda; o Dono vê o aviso na tela Plano e o pedido em "Acesso do suporte" | |

## 5. Acesso de emergência (etapa 3b)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 5.1 | Dono revoga a liberação do passo 3 | "Solicitar acesso de emergência" fica disponível na ficha | |
| 5.2 | A pede a emergência (incidente, 1 h, Vendas) | O Dono já vê o pedido em "Acesso do suporte"; A não consegue aprovar o próprio pedido | |
| 5.3 | B aprova | Nasce o acesso; todos os membros veem a faixa vermelha; o Dono tem "Encerrar acesso" | |
| 5.4 | A entra | Faixa vermelha "Emergência · … · somente leitura"; nenhuma ação de gravar | |
| 5.5 | Dono encerra | A volta ao painel com o aviso; A registra o resultado em "Emergências"; o Dono vê o resultado | |

## 6. Suspensão e reativação (etapa 4a)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 6.1 | A: ficha → "Suspender" (motivo da lista e descrição) | Pede o código se passaram 10 min; o painel mostra "Suspenso desde …" e o filtro "Suspensos" | |
| 6.2 | Dono: abrir o Painel | Faixa "Negócio suspenso pelo HE desde …: … Fale com o suporte.", com "Ver detalhes" | |
| 6.3 | Dono: tentar "Nova venda" e salvar um dado do negócio | Vai para "Este negócio está suspenso"; nada é gravado | |
| 6.4 | Dono: *Minha conta* → exportar os dados | O `.zip` é baixado | |
| 6.5 | A: "Reativar" com a descrição | A faixa some; a gravação volta; o Dono vê a suspensão e a reativação em "Acesso do suporte" | |

## 7. Exportação, exclusão e redefinição (etapa 4b)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 7.1 | Dono: exportar os dados | O `.zip` traz `registros-suporte.csv` (com a coluna `dados` das correções e da suspensão) e `pedidos-plataforma.csv` | |
| 7.2 | B: rodar o workflow "Administradores" → `redefinir-2fator` para A (a partir da DEVELOP, ambiente `homologacao`) | O log mostra `***` no lugar do e-mail; a próxima entrada de A pede o cadastro de novo | |
| 7.3 | (Opcional) Uma conta de Administrador só de teste exclui a própria conta em *Minha conta* | Sai da lista de "Administradores"; os autenticadores dela somem do Supabase (*Authentication → Users*) | |

## 8. Telas

Conferir em 390, 768 e 1440 px, nos temas claro e escuro: a gaveta "Suspender", a ficha do negócio suspenso, o Painel do Dono com a faixa, "Acesso do suporte" e a página do novo aceite. Nada deve passar da largura da tela.

## Registro

Ao terminar, anotar no README das evidências (seção "Homologação"):
- a data, quem testou e o navegador;
- o resultado de cada passo (✓ ou o que aconteceu);
- os problemas encontrados, com a captura.
