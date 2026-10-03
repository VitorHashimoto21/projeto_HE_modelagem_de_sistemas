# Visão de Negócio

## ERP + Calculadora de Precificação para Microempreendedores e Autônomos

*Documento de planejamento de produto — Agosto de 2026*

---

## 1. Sumário Executivo

O projeto propõe uma aplicação web do tipo ERP simplificado, voltada para microempreendedores e autônomos, unindo três módulos essenciais no MVP — **Financeiro**, **Estoque** e **Calculadora de Precificação** — de forma integrada. O diferencial central é a simplicidade de uso combinada com uma calculadora de preço que puxa automaticamente os custos cadastrados no módulo de Estoque, eliminando a digitação manual repetida e reduzindo o erro de precificação, uma das dores mais recorrentes identificadas na validação com o público-alvo.

A validação prévia com usuários reais confirmou tanto a dor (dificuldade de precificar corretamente e falta de controle financeiro/estoque organizado) quanto a demanda por uma ferramenta unificada, mas simples — em contraste com soluções como Bling, Omie e Granatum, percebidas como caras, complexas ou voltadas para empresas de maior porte.

**O MVP é a entrega do final do semestre letivo (2026-2): um pré-produto final, com os módulos integrados e funcionando de ponta a ponta.**

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
- Contas a pagar e a receber, com datas de vencimento; despesas fixas geram contas a pagar mensais automaticamente.
- Projeção de caixa dos próximos 6 meses.
- Cancelamento e troca de vendas com estorno.

**Fora do MVP inicial (roadmap):**
- Conciliação bancária / integração com PIX e bancos.
- Repasse automático de comissão a colaboradores/parceiros (no MVP, a comissão entra apenas na formação do preço).

### 6.2 Módulo Estoque

**Funcionalidades priorizadas para o MVP:**
- Controle simples de quantidade — entrada e saída de produtos.
- Alertas de estoque baixo, indicando necessidade de reposição.
- Custo do produto cadastrado e vinculado diretamente à Calculadora de Precificação (função-chave do produto).

**Fora do MVP inicial (roadmap):**
- Controle por lote e validade (relevante para nichos como alimentos).

### 6.3 Calculadora de Precificação

**Lógica de cálculo priorizada para o MVP:**
- Markup completo: **Preço = Custo Total ÷ (1 − (Despesas Fixas% + Despesas Variáveis% + Imposto% + Margem%))**.
- Despesas fixas mensais do negócio rateadas sobre o faturamento médio (ou, para negócios novos, sobre um faturamento estimado por capacidade × ticket médio).
- Despesas variáveis: taxa média de cartão/maquininha e comissão opcional por item.
- Precificação com impostos do MEI/Simples Nacional embutidos no cálculo.
- Aviso claro de que a margem é o ganho líquido do dono por venda, não o lucro total do negócio.
- Ponto de equilíbrio e semáforo de saúde financeira (Vermelho/Amarelo/Verde) no Dashboard.

**Fora do MVP inicial (roadmap):**
- Comparação automática com preço de mercado/concorrência.
- Simulação de cenários (venda à vista vs. parcelada, taxas de cartão/maquininha).

> **Integração-chave:** a Calculadora não funciona de forma isolada — ela puxa automaticamente o custo cadastrado no módulo de Estoque, eliminando digitação manual repetida e reduzindo erros. Essa integração é o principal diferencial competitivo do produto.

---

## 7. MVP e Cronograma

**Escopo do MVP:** Cadastro do negócio com consulta de CNPJ + Financeiro básico + Estoque básico + Calculadora de Precificação + Dashboard com semáforo, totalmente integrados entre si.

**Prazo:** o MVP é entregue ao final do semestre letivo (2026-2), como pré-produto final. O cronograma anterior de 6 meses (MVP → Versão Final) foi descartado por não se encaixar no calendário; a evolução após o MVP será planejada depois da entrega.

Critério de sucesso do MVP definido pelo time do projeto: ter os três módulos funcionando de forma integrada e estável — a integração entre eles (não apenas a existência isolada de cada um) é o principal indicador de que o MVP cumpriu seu propósito.

A ordem de construção segue o [Mapa de Specs](../MAPA_DE_SPECS.md), entregando cada spec individualmente:

| Etapa | Foco |
|---|---|
| 1 | Fundação: setup, ambientes, autenticação, multi-tenant, parâmetros fiscais, cadastro do negócio com consulta de CNPJ e equipe (SPECs 001–005) |
| 2 | Catálogo de itens e Estoque (SPECs 006–007) |
| 3 | Vendas e Financeiro: caixa, contas a pagar/receber, parcelamento (SPECs 008–009) |
| 4 | Calculadora de Precificação: markup completo, RBT12 e CMV% a partir das vendas (SPEC-010) e cancelamento/troca (SPEC-011) |
| 5 | Dashboard (resumo, semáforo e ponto de equilíbrio), plano gratuito × pago, LGPD, testes de ponta a ponta e ajustes de usabilidade (SPECs 012–014) |

A Calculadora vem depois de Vendas e Financeiro porque usa o histórico de vendas (RBT12 e CMV%) e as despesas fixas; antes dela, o preço pode ser definido manualmente (RF64). A cobrança real do plano pago (SPEC-015) é opcional no semestre.

**Depois do MVP:** o projeto segue para homologação e produção (RNF11), com a cobrança real do plano pago (ADR-007) entre as primeiras evoluções.

---

## 8. Modelo de Negócio

### 8.1 Estrutura de Monetização

Modelo recomendado: **Freemium**. Uma camada gratuita permanente com todos os módulos do MVP — Financeiro, Estoque, **Calculadora completa** e Dashboard — e o Dono mais 1 colaborador reduz a barreira de entrada, fator crítico para um público sensível a preço; a Calculadora completa é o principal gancho de adoção. O plano pago libera relatórios avançados (rentabilidade por item, exportação CSV/PDF, histórico acima de 12 meses) e múltiplos colaboradores (RF47), e futuramente integrações externas. A limitação é sempre por funcionalidade, nunca por volume (RN18).

**Cobrança:** no MVP, a troca de plano é simulada pelo Dono, sem cobrança (RF73). A cobrança real por gateway de pagamento está planejada (ADR-007, proposta) e pode ser ativada sem refazer as regras de plano.

**Status:** modelo validado como direção com o responsável pelo projeto; os valores de preço do plano pago ainda precisam ser definidos em uma etapa futura de precificação do próprio produto.

### 8.2 Integrações Externas

**No MVP:**
- Consulta de CNPJ na base pública da Receita Federal (razão social, CNAE, opção pelo Simples/MEI) para enquadramento fiscal automático, com preenchimento manual como alternativa.

**Pós-MVP:**

- Emissão de Nota Fiscal (NFS-e / MEI).
- Pagamentos (PIX).
- Cobrança da assinatura do plano pago por gateway (Stripe — ADR-007; opcional ainda no semestre, como SPEC-015).

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
