/**
 * Autor nos históricos (SPEC-019, 5.3, item 3): a correção do suporte é gravada em nome do próprio
 * Administrador (RN30), e os históricos mostram "{nome} (suporte do HE)".
 */
export function autorDoHistorico(usuario: { nome: string; administradorEm?: Date | null }): string {
  return usuario.administradorEm ? `${usuario.nome} (suporte do HE)` : usuario.nome;
}
