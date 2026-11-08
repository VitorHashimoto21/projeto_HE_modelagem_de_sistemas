import { obterContexto } from "@/lib/auth/servidor";
import { carregarFaixas } from "@/lib/estrutura/faixas";

// Assinatura das faixas e do menu da área do negócio (correção da homologação da SPEC-019, T17): o navegador
// a compara com a da tela a cada navegação, ao voltar para a aba e a cada minuto, e só atualiza o layout
// quando ela muda. Devolve só a assinatura (um resumo), nunca os dados; só leitura, sem registro.
export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  const contexto = await obterContexto();
  if (!contexto) return Response.json({ assinatura: null }, { status: 401, headers: SEM_CACHE });
  const { assinatura } = await carregarFaixas(contexto, new Date());
  return Response.json({ assinatura }, { headers: SEM_CACHE });
}
