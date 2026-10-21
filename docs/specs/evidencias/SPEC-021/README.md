# Evidências — SPEC-021 (NCM nos produtos)

Verificação em 21/10/2026, em build de produção local: PostgreSQL com a tabela NCM oficial carregada (10.516 códigos, vigente em 21/10/2026, Resolução Gecex nº 926/2026), Supabase Auth falso e as contas de teste. O caso usado é o da loja de semijoias do negócio **HE Testing**: brincos, argolas e pulseiras em Acessórios, com a subcategoria Brincos da SPEC-020.

O roteiro automatizado no navegador (Chromium) fez **74 verificações**, todas aprovadas. Capturas nesta pasta; nenhuma mostra e-mail.

## Roteiro no navegador (T13)

| Passo | Resultado | Captura |
|---|---|---|
| Opção de nota fiscal desligada: rodapé do Catálogo com "Produtos sem NCM (8)", sem o aviso de venda bloqueada (CA-09) | ✅ | — |
| A lista "sem NCM" mostra só os 8 produtos físicos ativos, sem o serviço, com "Mostrando produtos sem NCM." e "Ver todos os itens"; o detalhe mostra "NCM —" e o "voltar" leva de volta à lista (CA-07, CA-09) | ✅ | `s21_01_produtos_sem_ncm_*` (1440 claro, 390 escuro) |
| Cadastro com "NCM (opcional)" e o texto de ajuda; "Buscar NCM" abre a gaveta; "bijut" acha 7117.19.00 com o caminho; rodapé "Tabela NCM oficial (Siscomex), atualizada em 21/10/2026…" (CA-01) | ✅ | `s21_02_gaveta_busca_1440_claro.png` |
| "71.17" lista 7117.11.00, 7117.19.00 e 7117.90.00, em ordem de código (CA-02) | ✅ | — |
| Tocar no resultado preenche o campo, fecha a gaveta, mostra a descrição e devolve o foco ao campo; o banco grava `71171900` (CA-01) | ✅ | — |
| Detalhe: linha "NCM 7117.19.00" com "Bijuterias › De metais comuns… › Outras" (CA-07) | ✅ | `s21_03_detalhe_com_ncm_1440_claro.png` |
| Edição de outro produto de Brincos: botão "Usar 7117.19.00, o NCM de 1 item de Brincos" **com o aviso de responsabilidade** junto; o campo continua vazio até o toque; um toque preenche e o botão some (CA-05, OPEN-004) | ✅ | `s21_04_sugestao_*` (1440 claro, 390 escuro) |
| No celular (390 px), o botão da sugestão quebra a linha e cabe na caixa do aviso | ✅ | `s21_04_sugestao_390_escuro.png` |
| Produto sem subcategoria: nenhuma sugestão (CA-06) | ✅ | — |
| Digitar "99999999": "Código não encontrado na tabela NCM vigente."; "71132000": descrição de 7113.20.00, e o campo vira "7113.20.00" ao sair (CA-03) | ✅ | — |
| O servidor recusa "99999999" enviado sem passar pela conferência da tela, com a mesma mensagem no campo, e o item continua com 7113.20.00 (CA-03, INV-002) | ✅ | — |
| Busca "7117" no Catálogo acha os dois produtos com 7117.xx; "7113.20" no Estoque acha o ear cuff (CA-11) | ✅ | — |
| Código encerrado na tabela (via SQL): aviso "1 produto tem NCM fora da tabela vigente. Ver quais", lista só com a pulseira, aviso no detalhe e na edição; salvar sem mexer mantém o código (CA-08, CA-10, OPEN-002) | ✅ | `s21_05_catalogo_avisos_1440_claro.png`, `s21_06_detalhe_fora_da_tabela_768_escuro.png` |
| Dados do negócio: seção "Nota fiscal" com "4 produtos físicos estão sem NCM." e "Ver produtos sem NCM"; ligar a opção abre o diálogo "Ligar a nota fiscal de produtos?" com a contagem, e só liga em "Ligar mesmo assim" (CA-18) | ✅ | `s21_07_ligar_nota_fiscal_1440_claro.png` |
| Depois de salvar: "Opção ligada…", a caixa continua marcada e o "Salvar" fica desabilitado | ✅ | `s21_08_dados_do_negocio_390_claro.png` |
| Com a opção ligada: o Catálogo troca o link pelo aviso "4 produtos sem NCM não podem ser vendidos. Completar" (5.5) | ✅ | — |
| Cadastro com o rótulo "NCM", sem "(opcional)"; sem o código, "Informe o NCM: o negócio emite nota fiscal de produtos." no campo; um produto antigo sem NCM também só salva com o código (CA-19) | ✅ | `s21_09_cadastro_ncm_obrigatorio_1440_escuro.png` |
| Nova venda: "3 produtos estão fora da venda por falta de NCM. Completar no Catálogo"; o kit sem NCM não aparece na busca, a argola com NCM aparece (CA-20) | ✅ | `s21_10_nova_venda_1440_claro.png` |
| Troca de uma venda: a mesma nota, e o kit sem NCM também fica fora da busca (CA-20, troca da SPEC-011) | ✅ | — |
| Colaborador (*Catálogo: ver*): vê o NCM no detalhe, sem "Editar item"; na Nova venda vê a nota sem o link "Completar"; não abre Dados do negócio (CA-12, CA-18) | ✅ | — |
| Desligar: "Opção desligada: o NCM volta a ser opcional.", a caixa fica desmarcada, nenhum NCM é apagado e o link volta ao rodapé do Catálogo (CA-21) | ✅ | — |
| Edição com o NCM preenchido | ✅ | `s21_11_edicao_com_ncm_768_claro.png` |
| Sem rolagem horizontal em todas as capturas (390, 768 e 1440 px, claro e escuro) | ✅ | — |
| axe-core 4.10.2 (WCAG 2.1 A/AA) em 6 estados: gaveta de busca, edição com a sugestão, diálogo de ligar a opção, Nova venda com a nota, edição com NCM e lista sem NCM no celular escuro | ✅ nenhuma violação | — |

Duas correções feitas durante o roteiro, antes do PR:

- **A caixa "Emito nota fiscal de produtos" aparecia desmarcada depois de ligar a opção.** O React reinicia o formulário depois de uma Server Action enviada por `<form action>`, e a caixa voltava ao estado inicial na tela, embora a opção estivesse ligada. O formulário passou a enviar pela transição, como o de subcategorias, e o roteiro confere a caixa depois de ligar e de desligar.
- **O botão da sugestão vazava da caixa no celular.** Os botões do design system têm uma linha só; o da sugestão, que leva o nome da subcategoria, agora quebra a linha abaixo de 640 px.

## Desempenho (SPEC-016, seção 10, e RNF01)

JavaScript comprimido baixado ao abrir cada tela, com o cache desligado. "Antes" é um build da DEVELOP no mesmo banco.

| Tela | Antes da SPEC-021 | Com a SPEC-021 |
|---|---|---|
| /catalogo | 163,5 KB | 164,1 KB (+0,6) |
| /estoque | 163,5 KB | 164,1 KB (+0,6) |
| /catalogo/novo, detalhe e edição do item | 258,7 KB | 261,9 KB (+3,2) |
| /painel | 163,3 KB | 163,3 KB |
| /catalogo/subcategorias | 186,8 KB | 188,0 KB (+1,2) |
| /negocio/dados | 259,5 KB | 261,0 KB (+1,5) |
| /vendas/nova | 189,9 KB | 190,0 KB (+0,1) |

- A gaveta "Buscar NCM" só é baixada no primeiro toque no botão, como a de "Nova subcategoria".
- O diálogo de ligar a opção também é baixado sob demanda, quando a caixa é marcada. Importado direto, ele somava 18,8 KB a Dados do negócio. Para isso, o hook `useConfirmacaoDoEnvio` foi para um arquivo sem o Radix (`src/components/ui/confirmacao-do-envio.ts`); `confirmacao.tsx` o reexporta, e as outras telas não mudam.
- **Busca na tabela inteira:** 3 a 11 ms no banco para "bijut", "parafuso aco", "7117" e uma palavra sem resultado, muito abaixo de 1 s.

## Testes automatizados

- `test/unit/ncm.test.ts`:
  - T01: ler, formatar e buscar o NCM; o NCM no item (opcional, só produto físico, obrigatório com a opção ligada);
  - T02: arquivo oficial (só os códigos de 8 dígitos, caminho, texto de busca, vigência e ato; arquivo com problemas recusado; o arquivo do repositório é válido);
  - T08/T12: a permissão que cada Server Action pede à guarda (buscar e conferir: *Catálogo — ver* na guarda e *criar* ou *editar* no corpo; a opção de nota fiscal: só o Dono).
- `test/integracao/ncm.test.ts`:
  - T03: carga idempotente, código ausente com data de fim, nenhum item muda, e o arquivo oficial inteiro;
  - T04: busca na tabela vigente;
  - T05: gravar o NCM no cadastro e na edição, e as restrições do banco;
  - T06: sugestão pela subcategoria, com isolamento entre negócios;
  - T07: contagens, filtros e busca pelo código no Catálogo e no Estoque; modo suporte só leitura;
  - T09: o NCM não muda preço nem margem;
  - T10: exportação, migração e RLS;
  - T11: opção ligada (cadastro, edição, venda, troca, material de serviço, desligar);
  - T12: a opção do negócio.

## Pendente

- **Homologação (T14):** depois do merge, o workflow Migrações aplica a migração e carrega a tabela NCM; a equipe percorre o fluxo em <https://he-homol.vercel.app>.
