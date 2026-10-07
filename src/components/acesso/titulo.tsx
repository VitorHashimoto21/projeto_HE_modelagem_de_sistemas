/** Título das telas de acesso (protótipo revisado). */
export function TituloDeAcesso({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-9">
      <h1 className="mb-1.5 font-display text-3xl font-semibold text-foreground">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
    </div>
  );
}
