import { redirect } from "next/navigation";
import { ROTA_INICIAL } from "@/lib/auth/rotas";

// A raiz leva a "Meus negócios"; sem sessão, o proxy leva antes ao login (SPEC-002).
export default function Inicio() {
  redirect(ROTA_INICIAL);
}
