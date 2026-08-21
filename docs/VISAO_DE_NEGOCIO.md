# Visão de Negócio

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

*Documento de planejamento de produto — Agosto de 2026*

---

## 1. Sumário Executivo

O projeto propõe uma aplicação web do tipo ERP simplificado, voltada para microempreendedores e autônomos, unindo três módulos essenciais no MVP — **Financeiro**, **Estoque** e **Calculadora de Precificação** — de forma integrada. O diferencial central é a simplicidade de uso combinada com uma calculadora de preço que puxa automaticamente os custos cadastrados no módulo de Estoque, eliminando a digitação manual repetida e reduzindo o erro de precificação, uma das dores mais recorrentes identificadas na validação com o público-alvo.

A validação prévia com usuários reais confirmou tanto a dor (dificuldade de precificar corretamente e falta de controle financeiro/estoque organizado) quanto a demanda por uma ferramenta unificada, mas simples — em contraste com soluções como Bling, Omie e Granatum, percebidas como caras, complexas ou voltadas para empresas de maior porte.

**O prazo definido para o ciclo completo — do MVP à Versão Final (VF) — é de 6 meses.**

---

## 2. Problema e Proposta de Valor

### 2.1 Problema

- Microempreendedores e autônomos não sabem precificar corretamente seus produtos ou serviços, muitas vezes "chutando" valores.
- Controle financeiro e de estoque é feito de forma fragmentada — parte em planilha, parte em caderno, parte no WhatsApp.
- Ferramentas de ERP existentes no mercado são complexas, caras ou voltadas para empresas de maior porte.

### 2.2 Proposta de Valor

Uma plataforma web simples e acessível que integra gestão financeira, controle de estoque e precificação inteligente em um só lugar — permitindo que o usuário cadastre um produto uma única vez e obtenha, automaticamente, o preço de venda ideal com base no custo real, na margem desejada e nos impostos aplicáveis.

---

## 3. Público-Alvo

O público definido é amplo e não segmentado nesta fase: microempreendedores individuais (MEI) e autônomos em geral, incluindo prestadores de serviço, vendedores de produto físico e freelancers digitais. A decisão de não segmentar desde o início é intencional, permitindo validar o núcleo do produto (Financeiro + Estoque + Calculadora) antes de especializar fluxos por tipo de negócio.

**Perfil de maturidade digital:** uso misto de ferramentas — parte do público usa WhatsApp e papel, parte usa planilhas, e uma parcela já usa algum CRM ou ERP, mas está insatisfeita.

---

## 4. Validação de Mercado

O projeto já passou por uma etapa de validação com potenciais usuários, com resultados relevantes para o direcionamento do produto:

- Principal reclamação sobre ferramentas atuais: *"é complicado demais, eu quero algo simples"* — reforça que a simplicidade é o maior ativo competitivo do produto, mais do que a quantidade de funcionalidades.
- O conceito de ERP completo (não apenas CRM) foi validado diretamente com o público, confirmando interesse na integração entre Financeiro, Estoque e Precificação.

---

## 5. Análise Competitiva

Concorrentes diretos mapeados: **Bling, Omie e Granatum**.

| Lacuna identificada | Impacto para o usuário |
|---|---|
| Complexidade e curva de aprendizado alta | Usuário desiste ou nunca chega a usar todo o potencial da ferramenta |
| Foco em empresas de maior porte | Funcionalidades e planos não fazem sentido para o MEI/autônomo |
| Ausência de calculadora de precificação integrada ao estoque | Usuário precisa calcular preço "por fora", perdendo precisão e tempo |

**Diferencial central:** simplicidade de uso + calculadora de precificação nativamente integrada ao estoque, algo que nenhum dos concorrentes diretos oferece hoje da mesma forma.

---

## 6. Escopo do Produto (Módulos)

### 6.1 Módulo Financeiro

**Funcionalidades priorizadas para o MVP:**
- Fluxo de caixa simples — registro de entradas e saídas, com saldo atualizado.
- Contas a pagar e a receber, com datas de vencimento.

**Fora do MVP inicial (roadmap):**
- Conciliação bancária / integração com PIX e bancos.

### 6.2 Módulo Estoque

**Funcionalidades priorizadas para o MVP:**
- Controle simples de quantidade — entrada e saída de produtos.
- Alertas de estoque baixo, indicando necessidade de reposição.
- Custo do produto cadastrado e vinculado diretamente à Calculadora de Precificação (função-chave do produto).

**Fora do MVP inicial (roadmap):**
- Controle por lote e validade (relevante para nichos como alimentos).

### 6.3 Calculadora de Precificação

**Lógica de cálculo priorizada para o MVP:**
- Markup simples: custo + percentual de margem desejada.
- Precificação com impostos do MEI/Simples Nacional embutidos no cálculo.

**Fora do MVP inicial (roadmap):**
- Comparação automática com preço de mercado/concorrência.
- Simulação de cenários (venda à vista vs. parcelada, taxas de cartão/maquininha).

> **Integração-chave:** a Calculadora não funciona de forma isolada — ela puxa automaticamente o custo cadastrado no módulo de Estoque, eliminando digitação manual repetida e reduzindo erros. Essa integração é o principal diferencial competitivo do produto.

---

## 7. MVP e Cronograma

**Escopo do MVP:** Financeiro básico + Estoque básico + Calculadora de Precificação, totalmente integrados entre si.

**Prazo total do projeto (MVP → Versão Final):** 6 meses.

Critério de sucesso do MVP definido pelo time do projeto: ter os três módulos funcionando de forma integrada e estável — a integração entre eles (não apenas a existência isolada de cada um) é o principal indicador de que o MVP cumpriu seu propósito.

| Fase | Foco |
|---|---|
| Meses 1–2 | Desenvolvimento do núcleo: cadastro de produtos, Estoque básico e Financeiro básico |
| Meses 3–4 | Calculadora de Precificação e integração completa com o Estoque |
| Meses 5–6 | Testes de ponta a ponta, ajustes de usabilidade e preparação da Versão Final (VF) |

---

## 8. Modelo de Negócio

### 8.1 Estrutura de Monetização

Modelo recomendado: **Freemium com trial guiado**. Uma camada gratuita permanente (Financeiro básico + Estoque básico + Calculadora limitada) reduz a barreira de entrada — fator crítico para um público sensível a preço — enquanto funcionalidades avançadas (relatórios, múltiplos usuários, integrações externas) ficam no plano pago.

**Status:** modelo validado como direção com o responsável pelo projeto; os valores de preço do plano pago ainda precisam ser definidos em uma etapa futura de precificação do próprio produto.

### 8.2 Integrações Externas Priorizadas (pós-MVP)

- Emissão de Nota Fiscal (NFS-e / MEI).
- Pagamentos (PIX).

---

## 9. Requisitos Técnicos e Plataforma

**Plataforma:** aplicação web acessível por navegador, com layout responsivo (desktop e mobile).

Este formato foi escolhido por equilibrar alcance (sem necessidade de instalação de app) com acessibilidade para o uso diário do público-alvo, majoritariamente em múltiplos dispositivos.

---

## 10. Compliance e Regulação

- **LGPD:** o sistema armazenará dados de clientes e informações financeiras dos usuários, exigindo política de privacidade clara, consentimento explícito e mecanismos de exportação/exclusão de dados.
- **Regras do MEI e do Simples Nacional:** a lógica de cálculo de impostos na Calculadora de Precificação deve refletir corretamente as faixas e alíquotas vigentes, com atualização periódica conforme mudanças na legislação.

---

## 11. Métricas de Sucesso

Para os primeiros meses após o lançamento do MVP, a prioridade definida é validar que os três módulos funcionam de forma integrada e estável, antes de otimizar métricas de crescimento. Métricas de acompanhamento sugeridas para a fase seguinte:

- Usuários ativos e retenção mensal.
- Volume de cálculos de preço gerados (uso real da Calculadora).
- Taxa de conversão do plano gratuito para o pago.

---

## 12. Estratégia de Aquisição de Usuários

Este ponto permanece **em aberto** nesta fase do planejamento. Canais possíveis a serem avaliados incluem conteúdo educativo em redes sociais sobre precificação, parcerias com contadores e associações de MEI, e indicação boca a boca a partir dos usuários que já participaram da validação inicial. Recomenda-se revisitar este tópico após a conclusão do MVP, quando houver dados reais de uso para orientar a escolha do canal.

---

## 13. Próximos Passos

- [ ] Detalhar wireframes/protótipo de baixa fidelidade dos três módulos do MVP.
- [ ] Definir estrutura de dados (produtos, custos, movimentações de estoque e financeiro).
- [ ] Especificar a fórmula exata de cálculo de impostos do MEI/Simples na Calculadora.
- [ ] Definir os valores do plano pago (pricing do próprio produto).
- [ ] Planejar o canal de aquisição dos primeiros usuários para teste com o MVP.
