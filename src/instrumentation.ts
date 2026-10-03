// Executado uma vez ao iniciar o servidor (Next.js). Valida as variáveis de ambiente:
// se faltar alguma, a aplicação não sobe e informa o nome da variável (SPEC-001, CA-11).
// No Next.js 16 um erro aqui não derruba o servidor (ele responderia 500 em tudo),
// por isso o processo é encerrado explicitamente.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ambiente, AmbienteInvalido } = await import("./lib/env");
    try {
      ambiente();
    } catch (erro) {
      if (erro instanceof AmbienteInvalido) {
        console.error(`\n✖ ${erro.message}\n`);
        process.exit(1);
      }
      throw erro;
    }
  }
}
