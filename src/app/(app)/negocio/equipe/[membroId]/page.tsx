import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioPapel, FormularioPermissoes, RemoverMembro } from "@/components/equipe/formularios-do-membro";
import { exigirDono } from "@/lib/auth/servidor";
import { equipe } from "@/lib/db";
import { permissoesEfetivas, ROTULO_PAPEL } from "@/lib/dominio/permissoes";

export const metadata: Metadata = { title: "Gerenciar membro" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Gerenciar um membro (SPEC-005, 5.4): papel, permissões e remoção. Só o Dono; o Dono não é alterável.
export default async function GerenciarMembro({ params }: PageProps<"/negocio/equipe/[membroId]">) {
  const { negocioId } = await exigirDono();
  const { membroId } = await params;
  const membro = UUID.test(membroId) ? await equipe().doNegocio(negocioId).membro(membroId) : null;
  if (!membro || membro.papel === "DONO") notFound();
  const papel = membro.papel;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <Link href="/negocio/equipe" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          ← Equipe
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold break-words text-foreground">{membro.nome}</h1>
        <p className="mt-1 text-sm break-words text-muted-foreground">
          {membro.email} · {ROTULO_PAPEL[papel]}
        </p>
      </div>

      <section aria-labelledby="titulo-papel" className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-papel" className="font-display text-xl font-semibold text-card-foreground">
          Papel
        </h2>
        <FormularioPapel membroId={membro.id} papel={papel} />
      </section>

      <section aria-labelledby="titulo-permissoes" className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 id="titulo-permissoes" className="font-display text-xl font-semibold text-card-foreground">
          Permissões
        </h2>
        <FormularioPermissoes
          membroId={membro.id}
          matriz={permissoesEfetivas(papel, membro.permissoesCustom)}
          customizado={membro.permissoesCustom !== null}
        />
      </section>

      <section aria-labelledby="titulo-remover" className="space-y-3">
        <h2 id="titulo-remover" className="sr-only">
          Remover
        </h2>
        <RemoverMembro membroId={membro.id} nome={membro.nome} />
      </section>
    </div>
  );
}
