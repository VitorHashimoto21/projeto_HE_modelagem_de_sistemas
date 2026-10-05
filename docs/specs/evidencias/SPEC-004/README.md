# SPEC-004 — Evidências (04/10/2026)

## Testes automatizados (CI)

| Teste | Onde | Cobre |
|---|---|---|
| T01 | `test/unit/negocio.test.ts`: CNPJ (dígitos verificadores, sequências repetidas), formatação e retirada do CPF da razão social do MEI | CA-06, INV-003, OPEN-004 |
| T02 | `test/unit/negocio.test.ts`: validação por regime (13 casos de recusa) | CA-05, CA-06, INV-002 |
| T03 | `test/unit/negocio.test.ts`: adaptador com resposta real gravada da BrasilAPI (`test/apoio/fixtures/`), 400/404, 5xx, falha de rede, tempo esgotado e `User-Agent` | CA-03, INV-004, INV-005 |
| T04 | `test/unit/negocio.test.ts`: sugestão de enquadramento (MEI, Simples com Fator R, CNAE fora da tabela, fora do Simples, situação cadastral) | CA-01, CA-02, CA-04, OPEN-002, OPEN-003 |
| T05–T13 | `test/integracao/negocio.test.ts`: cadastro com Dono e negócio ativo, autônomo, falha desfeita, servidor chamado direto, CNPJ repetido, minimização no banco, lista e troca, negócio alheio/encerrado, edição só pelo Dono, consulta sem sessão | CA-01 a CA-12, INV-001 a INV-008 |

Os testes automatizados usam uma resposta real gravada da BrasilAPI e nunca chamam a API.

## Consulta real à BrasilAPI (pelo adaptador, fora dos testes)

```
00000000000191 {"ok":true,"dados":{"razaoSocial":"BANCO DO BRASIL SA","nomeFantasia":"DIRECAO GERAL","cnae":"6422-1/00","optanteMei":false,"optanteSimples":false,"situacao":"ATIVA"}}
```

Na primeira tentativa a API respondeu `403` ao `fetch` do Node sem identificação; corrigido com o `User-Agent` da aplicação (ver divergências na Spec).

## Verificação no preview da Vercel (PR #45, banco de homologação)

Feita pela equipe com a própria conta:

| Passo | Resultado | Captura |
|---|---|---|
| Escolha "Tenho CNPJ" / "Não tenho CNPJ" | ✅ | `preview_cadastrar_escolha_1920_escuro.png` |
| CNPJ `00.000.000/0001-91` consultado **na BrasilAPI a partir da Vercel** → "não é MEI nem optante pelo Simples" (OPEN-002) | ✅ | `preview_cnpj_fora_do_simples_1920_escuro.png` |
| Cadastro autônomo (Imposto% 6,5) → Painel com o enquadramento | ✅ | `preview_painel_salvo_1920_escuro.png` |
| "Dados do negócio" pelo Dono → salvo | ✅ | `preview_dados_do_negocio_1920_escuro.png` |

## Pendente

- **T14 / CA-13:** capturas em 390 e 768 px e no tema claro.
- **T15:** cadastro com um CNPJ real de MEI ou do Simples (sugestão de Anexo/atividade), troca entre dois negócios pelo seletor e entrada direta no último negócio após novo login.
