import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Logo } from "@/components/marca/logo";
import { AlternarTema } from "@/components/tema/alternar-tema";
import { lerDocumentoLegal, rotaDoLink, type DocumentoLegal } from "@/lib/legal";

/** Página de um documento legal, com o texto de docs/legal/ (SPEC-002, escopo 10). */
export async function PaginaDocumentoLegal({ documento }: { documento: DocumentoLegal }) {
  const { texto } = await lerDocumentoLegal(documento);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/entrar" aria-label="Health Enterprise — página inicial">
            <Logo className="h-8 w-auto" />
          </Link>
          <AlternarTema />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <article className="space-y-4 text-sm leading-relaxed text-foreground">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (p) => <h1 className="mb-6 font-display text-3xl font-semibold" {...p} />,
              h2: (p) => <h2 className="mt-8 font-display text-xl font-semibold" {...p} />,
              h3: (p) => <h3 className="mt-6 font-semibold" {...p} />,
              ul: (p) => <ul className="list-disc space-y-1 pl-6" {...p} />,
              ol: (p) => <ol className="list-decimal space-y-1 pl-6" {...p} />,
              blockquote: (p) => (
                <blockquote className="rounded-xl border border-status-warn/30 bg-status-warn-bg px-4 py-3 text-status-warn" {...p} />
              ),
              code: (p) => <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...p} />,
              a: ({ href, children }) => (
                <Link href={rotaDoLink(href) ?? "#"} className="font-medium text-primary underline underline-offset-2">
                  {children}
                </Link>
              ),
              table: (p) => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm" {...p} />
                </div>
              ),
              th: (p) => <th className="border-b px-3 py-2 font-semibold" {...p} />,
              td: (p) => <td className="border-b px-3 py-2 align-top" {...p} />,
            }}
          >
            {texto}
          </Markdown>
        </article>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        © 2026 Health Enterprise ·{" "}
        <Link href="/termos" className="hover:underline">
          Termos
        </Link>{" "}
        ·{" "}
        <Link href="/privacidade" className="hover:underline">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}
