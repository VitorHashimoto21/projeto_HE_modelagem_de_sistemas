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

## Pendente

- **T08 — homologação**, com um item da loja de semijoias, depois do merge na `DEVELOP`.
