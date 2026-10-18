import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioPapel, FormularioPermissoes, RemoverMembro } from "@/components/equipe/formularios-do-membro";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Superficie, TituloDaSuperficie } from "@/components/ui/superficie";
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
    <div className="mx-auto max-w-2xl space-y-6">
      <CabecalhoDePagina voltar={{ href: "/negocio/equipe", rotulo: "Equipe" }} titulo={<span className="break-words">{membro.nome}</span>} descricao={`${membro.email}, ${ROTULO_PAPEL[papel].toLowerCase()}`} />

      <Superficie aria-labelledby="titulo-papel">
        <TituloDaSuperficie id="titulo-papel" titulo="Papel" />
        <FormularioPapel membroId={membro.id} papel={papel} />
      </Superficie>

      <Superficie aria-labelledby="titulo-permissoes">
        <TituloDaSuperficie id="titulo-permissoes" titulo="Permissões" />
        <FormularioPermissoes membroId={membro.id} matriz={permissoesEfetivas(papel, membro.permissoesCustom)} customizado={membro.permissoesCustom !== null} />
      </Superficie>

      <section aria-labelledby="titulo-remover" className="space-y-3">
        <h2 id="titulo-remover" className="sr-only">
          Remover
        </h2>
        <RemoverMembro membroId={membro.id} nome={membro.nome} />
      </section>
    </div>
  );
}
