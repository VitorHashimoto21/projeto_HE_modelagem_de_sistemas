/**
 * Banco dos testes de integração. Por segurança, só aceita PostgreSQL local cujo
 * nome tenha "test" — nunca os bancos do Supabase (SPEC-001, seção 12).
 */
export function urlDoBancoDeTeste(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL não definida. Suba um PostgreSQL local (ex.: `docker compose up -d`) e veja o .env.example.",
    );
  }
  const { hostname, pathname } = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1", "postgres"].includes(hostname);
  if (!local || !pathname.toLowerCase().includes("test")) {
    throw new Error(
      `TEST_DATABASE_URL recusada: use um PostgreSQL local com "test" no nome do banco (recebido host "${hostname}").`,
    );
  }
  return url;
}
