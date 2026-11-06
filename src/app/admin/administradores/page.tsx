import type { Metadata } from "next";
import { NavegacaoDoPainel } from "@/components/plataforma/navegacao";
import { AvisoDaPagina } from "@/components/ui/aviso";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Selo } from "@/components/ui/selo";
import { Superficie } from "@/components/ui/superficie";
import { exigirAdministrador } from "@/lib/auth/servidor";
import { plataforma, type AdministradorDaPlataforma } from "@/lib/db";
import { dataBrasileira } from "@/lib/dominio/datas";
import { MENSAGENS_DA_PLATAFORMA } from "@/lib/dominio/plataforma";

export const metadata: Metadata = { title: "Administradores" };

/** Quantos autenticadores: com menos de dois, o selo pede atenção (OPEN-002: dois por conta). */
function Autenticadores({ a }: { a: AdministradorDaPlataforma }) {
  if (a.autenticadores === null) return <span className="text-muted-foreground">Não informado</span>;
  const texto = a.autenticadores === 1 ? "1 autenticador" : `${a.autenticadores} autenticadores`;
  return a.autenticadores >= 2 ? <span className="tabular-nums">{texto}</span> : <Selo tom="atencao">{texto}</Selo>;
}

// Administradores da plataforma (SPEC-019, 5.9, item 4): as contas com o papel, desde quando e quantos
// autenticadores têm, para que a equipe perceba uma conta a mais (risco registrado na seção 9: uma
// pessoa com duas contas burlaria a regra das duas pessoas). O papel só muda pelo workflow da equipe.
export default async function Administradores() {
  const { usuarioId } = await exigirAdministrador();
  const agora = new Date();
  const p = plataforma();
  const [contas, pendentes] = await Promise.all([p.administradores(), p.pedidosPendentes(agora)]);
  const aguardando = pendentes.filter((x) => x.solicitadoPorId !== usuarioId).length;

  return (
    <div className="space-y-6">
      <CabecalhoDePagina
        titulo="Administradores"
        descricao={`${contas.length} ${contas.length === 1 ? "conta" : "contas"} com o papel de Administrador. Uma conta por pessoa: uma conta a mais burlaria a regra das duas pessoas. O papel é concedido e retirado só pelo workflow "Administradores" da equipe.`}
      />
      <NavegacaoDoPainel atual="administradores" aguardando={aguardando} />

      {contas.length < 2 && <AvisoDaPagina tom="atencao">{MENSAGENS_DA_PLATAFORMA.semOutraConta}</AvisoDaPagina>}

      <Superficie espaco="nenhum" aria-label="Contas de Administrador">
        <table className="hidden w-full text-left text-sm md:table">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="px-6 py-3 font-medium">Nome</th>
              <th scope="col" className="px-3 py-3 font-medium">Papel</th>
              <th scope="col" className="px-3 py-3 font-medium">Desde</th>
              <th scope="col" className="px-6 py-3 font-medium">2º fator</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((a) => (
              <tr key={a.id} className="border-b last:border-b-0">
                <td className="px-6 py-3">
                  <span className="font-semibold text-foreground">{a.nome}</span>
                  {a.id === usuarioId && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                  <span className="block text-xs break-all text-muted-foreground">{a.email}</span>
                </td>
                <td className="px-3 py-3">Administrador</td>
                <td className="px-3 py-3 text-muted-foreground tabular-nums">{dataBrasileira(a.desde)}</td>
                <td className="px-6 py-3">
                  <Autenticadores a={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y md:hidden">
          {contas.map((a) => (
            <li key={a.id} className="space-y-1 px-4 py-3.5">
              <p className="font-semibold break-words text-foreground">
                {a.nome}
                {a.id === usuarioId && <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>}
              </p>
              <p className="text-xs break-all text-muted-foreground">{a.email}</p>
              <p className="text-xs text-muted-foreground">Administrador desde {dataBrasileira(a.desde)}</p>
              <div className="text-xs">
                <Autenticadores a={a} />
              </div>
            </li>
          ))}
        </ul>
      </Superficie>
    </div>
  );
}
