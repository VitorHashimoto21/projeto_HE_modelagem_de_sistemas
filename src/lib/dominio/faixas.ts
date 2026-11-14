/**
 * Chave das faixas e do menu da área do negócio (correção da homologação da SPEC-019, T17).
 *
 * O layout da área do negócio só é calculado na primeira carga e quando a página é atualizada: ao navegar,
 * o Next.js troca só a página. As faixas (emergência, suspensão, suporte liberado, modo suporte) e o menu,
 * porém, mudam por ação de outra pessoa: a aprovação ou o encerramento da emergência, a suspensão, a troca de
 * plano pela plataforma, a mudança das permissões. A chave resume o que aparece neles; o navegador compara a
 * chave do servidor com a da tela e só atualiza o layout quando as duas diferem.
 */
export type EstadoDasFaixas = {
  negocioId: string | null;
  papel: string | null;
  permissoes: Readonly<Record<string, Readonly<Record<string, boolean>>>> | null;
  plano: string | null;
  modoSuporte: {
    acessoId: string;
    expiraEm: Date;
    modulos: readonly string[];
    modulosComCorrecao: readonly string[];
    correcaoPendente: boolean;
    emergencia: boolean;
  } | null;
  suspensao: { desde: Date; motivo: string } | null;
  liberacao: { id: string; expiraEm: Date; modulos: readonly string[]; modulosComCorrecao: readonly string[] } | null;
  emergencia: { id: string; expiraEm: Date } | null;
};

const ordem = (lista: readonly string[]) => [...lista].sort();
const instante = (d: Date) => new Date(d).toISOString();

/** Só as ações permitidas, em ordem: a mesma matriz dá sempre a mesma chave. */
function permissoesEmOrdem(p: EstadoDasFaixas["permissoes"]) {
  if (!p) return null;
  return Object.keys(p)
    .sort()
    .map((modulo) => [modulo, ordem(Object.keys(p[modulo]).filter((acao) => p[modulo][acao]))]);
}

/** Texto canônico do estado: igual para o mesmo estado, diferente sempre que uma faixa ou o menu mudaria. */
export function chaveDasFaixas(e: EstadoDasFaixas): string {
  const s = e.modoSuporte;
  return JSON.stringify([
    e.negocioId,
    e.papel,
    permissoesEmOrdem(e.permissoes),
    e.plano,
    s && [s.acessoId, instante(s.expiraEm), ordem(s.modulos), ordem(s.modulosComCorrecao), s.correcaoPendente, s.emergencia],
    e.suspensao && [instante(e.suspensao.desde), e.suspensao.motivo],
    e.liberacao && [e.liberacao.id, instante(e.liberacao.expiraEm), ordem(e.liberacao.modulos), ordem(e.liberacao.modulosComCorrecao)],
    e.emergencia && [e.emergencia.id, instante(e.emergencia.expiraEm)],
  ]);
}
