# Evidências — SPEC-023 (Comissão em reais na Calculadora)

Verificação em build de produção local (`next build` + `next start`), com Postgres e o Supabase Auth falso, em 29/10/2026. Negócio de teste **HE Testing** (Autônomo, imposto de 6%, maquininha de 3,5%, faturamento estimado de R$ 5.000,00), com dados fictícios. Para o roteiro, o Anel solitário e o Brinco argola dourado ficaram com comissão de 10%, e a Lâmpada LED sem comissão; os valores originais foram restaurados no fim.

## Testes automatizados

| # | Teste | Onde | Resultado |
|---|---|---|---|
| T01 | Partes do preço em reais: exemplo da seção 1 (R$ 95,24 = 40,00 + 14,29 + 2,86 + 9,52 + 28,57), partes zeradas e 5.000 combinações aleatórias (inclusive custos de poucos centavos): a soma é o preço e nenhuma parte é negativa | `test/unit/comissao-em-reais.test.ts` | ✅ |
| T02 | O preço do CA-01 da SPEC-010 continua R$ 54,77; a comissão aumenta o preço, mas o custo do item continua o mesmo | idem | ✅ |
| T03 | Comissão no preço oficial: R$ 9,52 em R$ 95,24 com 10%; arredondamento ao centavo; sem preço ou sem comissão, nada | idem | ✅ |
| T04 | A confirmação grava a memória do cálculo com os mesmos campos de antes (versão 1): os reais são só de exibição | `test/integracao/calculadora.test.ts` (T07 da SPEC-010) | ✅ |
| T05 | Paleta com seis cores, nos dois temas: contraste ≥ 3:1 com o cartão; a 6ª cor com ΔE ≥ 15 (visão normal) e ≥ 6 (daltonismo) contra **cada uma** das outras cinco; as vizinhas da ordem fixa também | `test/unit/comissao-em-reais.test.ts` | ✅ |

Toda a suíte passou: 538 testes unitários e 274 de integração, além de lint e tipos.

### Escolha da 6ª cor

Feita com o validador da paleta (o mesmo do INV-004 da SPEC-016), contra o cartão de cada tema:

| Tema | Cor | Vizinha (série 5) | Pior par entre as cinco (visão normal / daltonismo) |
|---|---|---|---|
| Claro | `#8e0374` (ameixa) | ΔE 16,7 | 16,7 / 9,4 |
| Escuro | `#9c43b9` (ameixa clara) | ΔE 15,4 | 15,4 / 7,7 (contra o azul) |

Na barra, as partes zeradas somem: num negócio MEI sem imposto, por exemplo, a Comissão (série 4) encosta na Margem (série 6). Por isso a 6ª cor foi medida contra todas, não só contra a vizinha. As amarelas e as azul-esverdeadas, mais óbvias, ficavam perto demais do laranja (despesas fixas), do verde ou do azul. O valor de 7,7 no escuro está na faixa de 6 a 8, permitida porque a barra tem os nomes escritos ao lado e o espaço de 2 px entre as partes.

## Roteiro no navegador (T06 e T07)

41 verificações, todas aprovadas.

| Passo | Resultado | Captura |
|---|---|---|
| Calculadora, Anel solitário (custo R$ 40,00, comissão 10%): barra com as seis partes, na ordem Custo do item, Despesas fixas, **Maquininha**, **Comissão**, Imposto e Margem; sem "Maquininha e comissão" nem a linha "Despesas variáveis" (CA-01) | ✅ | `s23_01_calculadora_comissao_1440_claro.png` |
| A soma das partes da barra é o preço sugerido (R$ 94,12) (INV-002) | ✅ | — |
| Cada parcela da memória mostra o percentual e os reais, com o mesmo valor da barra: despesas fixas R$ 28,24, maquininha R$ 3,29, comissão R$ 9,41 (10% do preço), imposto R$ 5,65, margem R$ 7,53 (CA-02, INV-003) | ✅ | idem |
| Seis cores distintas; a da Margem é `#8e0374` no claro e `#9c43b9` no escuro | ✅ | `s23_01_calculadora_comissao_1440_escuro.png` |
| Item sem comissão (Lâmpada LED): a barra não mostra a parte "Comissão"; a memória mostra "0,00% · R$ 0,00" e "Este item não paga comissão." (CA-04) | ✅ | `s23_02_calculadora_sem_comissao_1440_claro.png` |
| Simulação de 10% na Lâmpada: aviso da simulação, "Comissão simulada; a do item é 0,00%.", reais da comissão simulada na barra e na memória e sem o botão de confirmar (CA-05) | ✅ | `s23_03_calculadora_simulacao_1440_claro.png` |
| Catálogo, Brinco (R$ 79,90, 10%): "10% (R$ 7,99 no preço atual)"; Anel sem preço oficial: só "10%"; Lâmpada sem comissão: "0%" (CA-06) | ✅ | `s23_04_catalogo_comissao_1440_claro.png`, `s23_04_catalogo_comissao_390_escuro.png` |
| Calculadora e Catálogo em 390, 768 e 1440 px, claro e escuro: sem rolagem horizontal; axe sem violações nos dois temas (CA-07) | ✅ | `s23_01_calculadora_comissao_768_claro.png`, `s23_01_calculadora_comissao_390_escuro.png` |

## Homologação (T08) — 29/10/2026

Feita pela equipe na homologação (`DEVELOP`, depois do merge do PR #113), com o Dono do negócio **HE Testing** e dois anéis da categoria Acessórios (NCM 7117.19.00, bijuterias), como os da loja de semijoias. Nos parâmetros da homologação: faturamento médio de R$ 18.000,00, despesas fixas de R$ 2.040,00 por mês (11,33%), maquininha de 3,50% e imposto de 6,50%. Capturas em [`homologacao/`](homologacao/), no tema escuro. Não há dados pessoais nelas; o nome da conta de teste ficou visível, como nas homologações anteriores.

| Passo | Resultado | Captura |
|---|---|---|
| Item sem comissão (Anel de Titânio, custo R$ 400,00, margem 40%): preço sugerido R$ 1.034,49; a barra não tem a parte "Comissão" e soma o preço (400,00 + 117,24 + 36,21 + 67,24 + 413,80); a memória mostra "0,00% · R$ 0,00" e "Este item não paga comissão." (CA-01, CA-04, INV-002) | ✅ | `homol_01_sem_comissao_escuro.png` |
| Simulação de 10% no mesmo item: aviso "Simulação com comissão de 10,00%; a do item é 0,00%…", sem o botão de confirmar; preço R$ 1.395,35; barra com as seis partes, na ordem fixa, somando o preço (399,99 + 158,14 + 48,84 + 139,54 + 90,70 + 558,14); memória com "10,00% · R$ 139,54" e "Comissão simulada; a do item é 0,00%." (CA-01, CA-02, CA-05) | ✅ | `homol_02_simulacao_escuro.png` |
| Celular: item com custo de R$ 300,00 e comissão de 20%: preço R$ 592,11; as seis partes somam o preço (300,00 + 67,11 + 20,72 + 118,42 + 38,49 + 47,37), a comissão é 20% do preço (R$ 118,42) e as parcelas visíveis da memória (despesas fixas e maquininha) mostram os mesmos reais da barra; sem rolagem horizontal (CA-01, CA-02, CA-03) | ✅ | `homol_03_comissao_celular_escuro.png` |
| Catálogo, Anel do Lanterna Verde (preço oficial R$ 900,00, comissão de 20%): "20% (R$ 180,00 no preço atual)" (CA-06) | ✅ | `homol_04_catalogo_escuro.png` |
| Os preços conferem com a fórmula de sempre, custo ÷ (1 − soma), arredondada para cima ao centavo: a comissão aumenta o preço, mas não o custo do item (CA-03, INV-001) | ✅ | — |
| Seis cores distintas no tema escuro, inclusive o Imposto (lavanda) encostado na Margem (ameixa) | ✅ | todas |

**Observação 1 — "Custo do item" de R$ 399,99 na simulação** (`homol_02`), com o custo de R$ 400,00: é a diferença de arredondamento que a 5.1 da Spec põe no "Custo do item", para a soma das partes ser o preço exato. Cada parcela é arredondada ao centavo (a comissão, 10% de R$ 1.395,35 = R$ 139,535, vira R$ 139,54), e o centavo a mais sai do custo. Comportamento previsto, sem divergência.

**Observação 2 — percentuais inteiros na barra:** a coluna de percentuais da barra mostra a participação de cada parte no preço, em números inteiros que somam 100% (regra da SPEC-016). Com taxas "no meio", como a maquininha de 3,50% e o imposto de 6,50%, o arredondamento vai para cima ou para baixo conforme os centavos: a maquininha aparece como 4% nas capturas 1 e 2 e como 3% na 3, e o imposto como 6% e 7%. O percentual exato está sempre na memória ("3,50% · R$ 20,72"). Comportamento anterior a esta Spec, sem divergência. Se a equipe quiser, a barra da Calculadora pode passar a mostrar uma casa decimal (3,5%).

**Resultado:** T08 aprovado. SPEC-023 concluída em 29/10/2026.
