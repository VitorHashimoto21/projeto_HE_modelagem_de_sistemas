"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { Aviso, BotaoEnviar, Campo, MensagemDeCampo } from "@/components/acesso/campos";
import { camposDoFormulario, type ErrosDeCampo } from "@/lib/auth/validacao";
import { PREDEFINICOES } from "@/lib/dominio/permissoes";
import { acaoConvidar } from "@/lib/equipe/acoes";
import { CONVITE_INICIAL } from "@/lib/equipe/servicos";
import { validarConvite, type PapelDoConvite } from "@/lib/equipe/validacao";
import { AvisoDoEnvio, LinkDoConvite } from "./link-do-convite";
import { MatrizDePermissoes } from "./matriz-de-permissoes";

const PAPEIS: { valor: PapelDoConvite; rotulo: string; descricao: string }[] = [
  { valor: "COLABORADOR", rotulo: "Colaborador", descricao: "Vendas, estoque e o Dashboard restrito. Sem Financeiro e sem Calculadora." },
  { valor: "GERENTE", rotulo: "Gerente", descricao: "Todos os módulos, exceto as Configurações do negócio." },
];

/** Convidar pessoa (SPEC-005, 5.2 — UC3 e UC4), com validação dupla. */
export function FormularioConvite() {
  const [estado, executar] = useActionState(acaoConvidar, CONVITE_INICIAL);
  const [papel, setPapel] = useState<PapelDoConvite>("COLABORADOR");
  const [personalizar, setPersonalizar] = useState(false);
  const [locais, setLocais] = useState<ErrosDeCampo | null>(null);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setLocais(null);
  }
  const erros = locais ?? (estado.status === "erro" ? (estado.erros ?? {}) : {});
  const valores = estado.status === "erro" ? estado.valores : undefined;

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const v = validarConvite(camposDoFormulario(new FormData(e.currentTarget)));
    if (!v.ok) {
      e.preventDefault();
      setLocais(v.erros);
    } else setLocais({});
  }

  if (estado.status === "criado") {
    return (
      <div className="space-y-5">
        <AvisoDoEnvio enviado={estado.emailEnviado}>
          Convite criado para <strong>{estado.email}</strong>. {estado.mensagem}
        </AvisoDoEnvio>
        <LinkDoConvite link={estado.link} />
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/negocio/equipe" className="text-primary underline-offset-2 hover:underline">
            Voltar para a equipe
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {estado.status === "erro" && estado.mensagem && <Aviso tipo="erro">{estado.mensagem}</Aviso>}
      <form action={executar} onSubmit={aoEnviar} noValidate className="space-y-6">
        <Campo
          nome="email"
          rotulo="E-mail da pessoa"
          type="email"
          autoComplete="off"
          placeholder="pessoa@exemplo.com"
          defaultValue={valores?.email}
          erro={erros.email}
          onChange={() => erros.email && setLocais({ ...erros, email: undefined })}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Papel</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAPEIS.map((p) => (
              <label
                key={p.valor}
                className={`flex cursor-pointer gap-3 rounded-xl border bg-card p-4 ${papel === p.valor ? "border-primary ring-4 ring-ring/15" : "border-input"}`}
              >
                <input
                  type="radio"
                  name="papel"
                  value={p.valor}
                  checked={papel === p.valor}
                  onChange={() => setPapel(p.valor)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-card-foreground">{p.rotulo}</span>
                  <span className="block text-xs text-muted-foreground">{p.descricao}</span>
                </span>
              </label>
            ))}
          </div>
          <MensagemDeCampo id="papel-erro" erro={erros.papel} />
        </fieldset>

        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="personalizar"
              checked={personalizar}
              onChange={(e) => setPersonalizar(e.target.checked)}
              className="size-4 accent-primary"
            />
            Personalizar permissões
          </label>
          <MatrizDePermissoes
            inicial={PREDEFINICOES[papel]}
            editavel={personalizar}
            rotulo={personalizar ? "Permissões personalizadas" : `Permissões do papel ${papel === "GERENTE" ? "Gerente" : "Colaborador"}`}
          />
          <MensagemDeCampo id="permissoes-erro" erro={erros.permissoes} />
        </div>

        <BotaoEnviar enviando="Criando convite…">Convidar</BotaoEnviar>
      </form>
    </div>
  );
}
