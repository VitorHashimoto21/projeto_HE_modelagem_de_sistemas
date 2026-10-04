import type { NextRequest } from "next/server";
import { tratarLinkDeEmail } from "@/lib/auth/links";

// Link de recuperação de senha (SPEC-002, 5.4): abre a sessão e leva à nova senha.
export async function GET(request: NextRequest) {
  return tratarLinkDeEmail(request, "recovery");
}
