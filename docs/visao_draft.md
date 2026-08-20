1. O Problema e o Contexto [cite: 2, 5]
Muitos profissionais autônomos e microempreendedores enfrentam grandes dificuldades para compreender a real situação financeira dos seus negócios [cite: 2]. O problema central reside na falta de clareza sobre o ponto de equilíbrio (break-even point) e na mistura frequente entre finanças pessoais e empresariais [cite: 5]. Frequentemente, esses empreendedores geram faturamento, mas não sabem se estão operando com lucro real ou se estão apenas "trocando dinheiro" no final do mês [cite: 5].
Dor principal: Dificuldade em definir se a empresa está saudável financeira e matematicamente, além da complexidade das ferramentas de gestão existentes no mercado que exigem conhecimentos contábeis avançados [cite: 2, 5].
Contexto atual: O usuário gerencia despesas e faturamento de forma fragmentada, utilizando cadernos, planilhas eletrônicas simples ou capturas de tela, o que impede uma análise histórica clara [cite: 5].
2. Visão do Produto e Objetivo [cite: 2, 5]
O HealthEnterprise (HE) é uma aplicação web intuitiva de apoio à decisão financeira, projetada especificamente para desmistificar a saúde financeira de pequenos negócios e autônomos [cite: 2, 5].
Slogan/Essência: A saúde da sua empresa de maneira visual e sob controle. [cite: 2]
Objetivo Geral: Auxiliar empreendedores a visualizarem e calcularem, de forma automatizada e gráfica, o faturamento necessário para cobrir custos e gerar lucro real, permitindo uma gestão ativa e informada do negócio [cite: 2, 5].
3. Público-Alvo e Stakeholders [cite: 5, 16, 53]
Persona 1 - O Profissional Autônomo: Geralmente trabalha sozinho (ex: designer, consultor, dentista). Sua dor central é saber quanto cobrar por hora ou por projeto para cobrir suas despesas, impostos e garantir o pró-labore desejado [cite: 5].
Persona 2 - O Microempreendedor: Possui uma estrutura pequena com local físico ou e-commerce e custos fixos recorrentes. Sua dor central é saber o volume mínimo de vendas/serviços necessário no mês para atingir o ponto de equilíbrio [cite: 5].
Stakeholders: Equipe de desenvolvimento (grupo de 2 a 3 alunos) [cite: 16, 53], usuários finais (autônomos e microempreendedores) e o professor avaliador (como o principal revisor metodológico do projeto) [cite: 16].
4. Escopo do MVP (Produto Mínimo Viável) [cite: 2, 5]
O que está DENTRO (In-Scope):
Cadastro de usuário e perfil da empresa (Autônomo vs. Microempresa) [cite: 5].
Cadastro simplificado de despesas com classificação básica (Custo Fixo vs. Custo Variável) [cite: 5].
Definição de metas de faturamento e margem de lucro desejada [cite: 5].
Lançamento simplificado do faturamento real consolidado no período [cite: 5].
Cálculo automatizado do Ponto de Equilíbrio (Break-even) e do Lucro Real [cite: 2, 5].
Dashboard visual com gráficos indicativos do nível de saúde da empresa (Verde/Saudável, Amarelo/Atenção, Vermelho/Déficit) [cite: 2, 5].
O que está FORA (Out-of-Scope para o MVP):
Integração automatizada com contas bancárias (Open Finance).
Emissão de Notas Fiscais (NF-e).
Mapeamento complexo de estoque físico ou controle multi-moedas.
5. Restrições e Compliance [cite: 4, 16, 53]
Prazo: Entrega funcional até o final do semestre de 2026-2 (Semana 15) [cite: 53].
Equipe: Equipe reduzida (2 a 3 membros), demandando colaboração rastreável e divisão de trabalho estrita por Issues e Pull Requests no GitHub [cite: 16, 53].
Tecnologia: Aplicação web com persistência de dados.
Metodologia: Desenvolvimento orientado a especificações (Spec-Driven Development), com escrita de requisitos em notação EARS e modelagem de domínio estruturada em arquivos markdown versionados [cite: 4, 43].
Compliance: Conformidade básica com a LGPD para armazenamento seguro de dados cadastrais e financeiros do usuário.
6. Riscos Centrais e Mitigação [cite: 2, 5]
Escopo Inflado (Scope Creep): Risco de tentar adicionar muitas funcionalidades de um ERP clássico e não conseguir entregar o MVP funcional no prazo. Mitigação: Manter a interface e os lançamentos o mais simples possível (KISS) [cite: 5].
Fórmulas financeiras falhas: Erros no cálculo do ponto de equilíbrio por não separar corretamente despesas fixas e variáveis. Mitigação: Validar as fórmulas de negócio e cobri-las rigorosamente com testes unitários [cite: 5].
7. Benchmarks Iniciais [cite: 5, 29]
Planilhas de Excel/Google Sheets: O concorrente mais comum. São flexíveis, mas complexas de manter, sem interface adaptada a dispositivos móveis e propensas a quebra de fórmulas pelo usuário [cite: 29].
Organizze / ZeroPaper: Focados muito em finanças pessoais e controle de fluxo de caixa transacional básico, sem foco analítico no ponto de equilíbrio do negócio de forma explícita.
Conta Azul / QuickBooks: Sistemas de ERP robustos, caros e complexos para o pequeno autônomo, exigindo alta curva de aprendizado.