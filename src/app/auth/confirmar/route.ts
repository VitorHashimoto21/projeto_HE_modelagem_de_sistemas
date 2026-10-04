import type { NextRequest } from "next/server";
import { tratarLinkDeEmail } from "@/lib/auth/links";

// Link de confirmação do cadastro (SPEC-002, CA-05): confirma o e-mail e entra.
export async function GET(request: NextRequest) {
  return tratarLinkDeEmail(request, "email");
}
