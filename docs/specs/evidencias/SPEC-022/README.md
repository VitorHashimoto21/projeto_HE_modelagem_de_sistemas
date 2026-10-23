# Evidências — SPEC-022 (Cliente com dados completos)

Verificação em 23/10/2026, em build de produção local: PostgreSQL com as migrações, Supabase Auth falso, as contas de teste do negócio **HE Testing** e um **serviço falso da BrasilAPI** (`BRASILAPI_URL=http://localhost:54330`), porque o ambiente de desenvolvimento não acessa a BrasilAPI real. O serviço falso responde a dois CEPs e dois CNPJs fictícios, devolve "não encontrado" para o resto e registra cada pedido recebido. Todos os nomes, documentos, endereços e e-mails dos clientes são fictícios.

O roteiro automatizado no navegador (Chromium) fez **120 verificações**, todas aprovadas. Capturas nesta pasta; nenhuma mostra e-mail de usuário.

## Roteiro no navegador (T13)

| Passo | Resultado | Captura |
|---|---|---|
| Quem aceitou a versão 2026-10-17 dos termos cai no **novo aceite** ao entrar; o resumo fala do cadastro de clientes e de que o CPF nunca sai do sistema; depois de aceitar, volta ao app, e a versão 2026-10-23 fica gravada; a Política de Privacidade publicada já é a nova (CA-17) | ✅ | `s22_00_novo_aceite_390_claro.png` |
| Vendas → **Clientes** leva a `/vendas/clientes`; a cliente migrada aparece com "Faltam dados para nota" (CA-05, CA-15) | ✅ | — |
| Pessoa física: teclado numérico no CPF e no CEP e de telefone no telefone; CPF e telefone formatados ao sair do campo; o **CEP preenche** logradouro, bairro, município e UF; salvar leva ao detalhe com "Cliente salvo." e "Completo para nota"; o banco guarda tudo sem pontuação e o e-mail em minúsculas (CA-01, RNF01) | ✅ | `s22_02_formulario_pf_*` (1440 claro, 768 escuro), `s22_03_detalhe_*` |
| Rua já digitada e CEP depois: o vazio é preenchido, e a rua espera "Trocar o endereço pelo do CEP?"; "Manter o que digitei" mantém a rua; CEP inexistente: "Não encontramos este CEP. Preencha o endereço." (5.2, item 6; CA-03) | ✅ | — |
| CPF com dígito errado: "CPF inválido."; CPF de outro cliente: "Já existe um cliente com este CPF: Joana Prado.", sem apagar o que foi digitado (CA-04) | ✅ | `s22_04_documento_repetido_1440_claro.png` |
| Empresa: CNPJ com teclado de texto; "Buscar dados do CNPJ" preenche nome fantasia, endereço (em maiúsculas e minúsculas) e e-mail; a razão social já digitada espera "Trocar pelos da Receita?"; o **telefone digitado não é trocado**, porque telefone e e-mail do CNPJ só entram nos campos vazios (OPEN-009); salvo como "Completo para nota", sem os sócios (CA-02) | ✅ | `s22_05_cnpj_confirmacao_1440_claro.png` |
| CNPJ com letras `12.abc.345/01de-35` vira `12.ABC.345/01DE-35`; a base não o tem: "Não foi possível consultar o CNPJ agora. Preencha os dados."; contribuinte sem número: "Informe o número da inscrição estadual."; salvo com "Falta: endereço" (CA-03, CA-14) | ✅ | — |
| Busca pelo CPF com pontuação, pelo CNPJ de letras em minúsculas, pelo nome fantasia (com a razão social abaixo) e pelo telefone migrado; filtro "Faltam dados para nota"; documentos mascarados na lista (CA-12) | ✅ | `s22_01_lista_*` (1440 claro, 390 escuro) |
| Venda para a Joana: o detalhe mostra "1 compra · total de R$ 80,00" com "Concluída" (CA-09) | ✅ | `s22_03_detalhe_*` (1440 claro, 390 escuro) |
| A **troca** dessa venda já começa com a Joana escolhida (5.10, item 4) | ✅ | — |
| Com "Emito nota fiscal de produtos" ligada: escolher a cliente incompleta mostra "Faltam dados para a nota fiscal deste cliente: CPF, endereço." com "Completar" (abre a edição em outra aba, para não perder a venda); o seletor só mostra nomes; cliente completo, sem aviso (CA-08) | ✅ | `s22_06_venda_aviso_*` (1440 claro, 390 escuro) |
| "Novo cliente" na Nova venda: o formulário completo, com o endereço fechado até tocar em "Endereço (para nota fiscal)"; o cliente cadastrado fica escolhido, e o aviso mostra o que falta (5.10) | ✅ | `s22_07_venda_novo_cliente_390_claro.png` |
| Colaborador: vê o aviso sem "Completar"; cadastra na venda com CPF e CEP, e o cliente fica escolhido; depois de salvo, vê o CPF mascarado (CA-07) | ✅ | — |
| Colaborador no detalhe: nome completo; CPF, e-mail e telefone mascarados; do endereço, só "São Paulo/SP"; o HTML recebido não contém o CPF, o e-mail, a rua nem o CEP; sem "Editar" e "Excluir"; a edição redireciona para "Sem acesso" (CA-06, INV-003) | ✅ | `s22_08_detalhe_colaborador_*` (390 claro, 1440 escuro) |
| Opção de nota desligada: sem aviso na Nova venda (CA-08) | ✅ | — |
| Edição: telefone migrado aparece formatado; CPF de outro cliente recusado também na edição; trocar empresa → pessoa física avisa o que será removido e tira o CNPJ do campo (5.2, item 1) | ✅ | — |
| Excluir com compras: o diálogo explica a anonimização; confirmar leva a "Dados do cliente apagados…", todos os dados pessoais ficam vazios, a venda continua com R$ 80,00 e mostra "Cliente anonimizado" (CA-11) | ✅ | `s22_09_excluir_dialogo_390_claro.png` |
| Excluir sem compras: "Excluir Loja Letras Ltda? O cadastro será apagado." e o cadastro some (CA-10) | ✅ | — |
| Cadastro do negócio com o CNPJ de letras `he.202.6cl/i001-09`: teclado de texto, consulta e sugestão (MEI) com `HE.202.6CL/I001-09` (CA-14) | ✅ | `s22_10_negocio_cnpj_letras_1440_claro.png` |
| Pedidos recebidos pela BrasilAPI falsa: só `/cep/v1/…` e `/cnpj/v1/…`; **nenhum CPF** (INV-004) | ✅ | — |
| Sem rolagem horizontal em todas as capturas (lista, formulário, detalhe, detalhe mascarado e Nova venda com o aviso em 390, 768 e 1440 px, claro e escuro) (CA-18) | ✅ | — |
| axe-core 4.10.2 (WCAG 2.1 A/AA) nos dois temas: novo aceite, formulário, lista, detalhe, Nova venda com o aviso e detalhe mascarado (CA-18) | ✅ nenhuma violação | — |

Correções feitas durante a implementação e o roteiro, antes do PR:

- **Restrição da inscrição estadual:** o `CHECK` deixava passar "Contribuinte" sem o número, porque `NULL ~ '…'` dá nulo, e o banco aceita `CHECK` nulo. Agora exige `IS NOT NULL`, e o teste de integração grava direto no banco para conferir.
- **Migração do contato:** os clientes já anonimizados ficam de fora dos `UPDATE`, como pede a 5.9 (item 3). Antes, um anonimizado que ainda tivesse contato faria a migração inteira falhar na restrição `Cliente_anonimizado_sem_dados`.
- **Numerais romanos no endereço da Receita:** "TORRE II" virava "Torre Ii"; agora fica "Torre II".
- **Telefone e e-mail pelo CNPJ** só entram nos campos vazios (OPEN-009); antes, o formulário oferecia trocá-los.
- **Troca de tipo na edição:** o documento que não serve para o novo tipo sai do campo, para a edição não parar em "CPF inválido" com o CNPJ antigo.
- **Troca de venda:** já começa com o cliente da venda original (5.10, item 4); antes, começava em "Sem cliente".

## Desempenho (SPEC-016, seção 10, e RNF01)

JavaScript comprimido baixado ao abrir cada tela, com o cache desligado. "Antes" é a medição do build da SPEC-021.

| Tela | Antes da SPEC-022 | Com a SPEC-022 |
|---|---|---|
| /vendas | 162,5 KB | 162,5 KB |
| /vendas/nova | 190,0 KB | 191,5 KB (+1,5) |
| /negocio/dados | 261,0 KB | 261,1 KB (+0,1) |
| /vendas/[id]/trocar | — | 191,5 KB (a mesma frente de caixa da Nova venda) |
| /vendas/clientes (nova) | — | 160,4 KB |
| /vendas/clientes/[id] (nova) | — | 163,5 KB |
| /vendas/clientes/novo e /editar (novas) | — | 169,3 KB |

- Na Nova venda, o formulário completo do cliente só é baixado quando a pessoa toca em "Novo cliente", e o diálogo de exclusão do detalhe, quando toca em "Excluir cliente".

## Testes automatizados

- `test/unit/clientes.test.ts` (39 testes):
  - T01: CPF (dígitos, todos iguais, tamanho, letras, formatação);
  - T02: CNPJ numérico e com letras (exemplo oficial `12.ABC.345/01DE-35`, minúsculas, dígito errado, os numéricos antigos), também na validação do negócio;
  - T03: telefone, CEP, máscaras e o selo "completo para nota" por tipo;
  - validação do cadastro (tipo, documento, campos de empresa, contato, endereço, valores antigos);
  - T06: adaptadores de CEP e CNPJ (sem os sócios, URLs só com o CEP ou o CNPJ, não encontrado, indisponível) e os serviços (CPF nunca consultado);
  - T10: a permissão de cada Server Action.
- `test/integracao/clientes.test.ts` (22 testes):
  - T04: cadastrar e editar, troca de tipo, valores antigos, documento repetido (inclusive simultâneo) e as restrições do banco;
  - T05: a máscara por visão (Dono, Gerente, Colaborador, suporte) na lista, no detalhe, no seletor da venda e na resposta do cadastro;
  - T06/T10: nenhuma escrita no modo suporte, as guardas por papel e o isolamento entre negócios;
  - T07: compras em ordem, situação, troca, total sem canceladas e o limite de 50;
  - T08: apagar sem vendas; anonimizar com vendas sem mudar nenhum valor; o anonimizado sai da lista, do seletor e de vendas novas; a prévia da troca deixa de trazê-lo;
  - T09: busca e filtro;
  - T11: a migração do `contato`, rodando as mesmas instruções da migração numa tabela à parte.
- Ajustados: `test/integracao/lgpd.test.ts` (T12: exportação com os campos novos no JSON e no CSV; exclusão de conta limpando todos), `suporte.test.ts`, `vendas.test.ts` e `negocio.test.ts`.

## Pendente

- **Homologação (T14):** o fluxo com a consulta real de CEP e CNPJ na BrasilAPI, depois do merge, em <https://he-homol.vercel.app>.
