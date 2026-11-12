import { describe, expect, it } from "vitest";
import { contaNasMensagens, MENSAGENS_DO_ADMINISTRADOR as M, segredosQueFaltam } from "@/lib/dominio/administradores";

// Ajustes da homologação da SPEC-019 (T17): no GitHub Actions o log do script "Administradores" é público, e a
// mensagem final mostrava a primeira letra e o domínio do e-mail ("r***@dominio"). Agora nenhuma parte aparece.

const EMAIL = "rafael.suporte@exemplo-do-he.com";

function todas(conta: ReturnType<typeof contaNasMensagens>) {
  return [M.jaEra(conta, "2026-10-18"), M.concedido(conta, "equipe (GitHub Actions)"), M.redefinido(conta, "equipe (GitHub Actions)", 2), M.naoEra(conta), M.retirado(conta, "equipe (GitHub Actions)")];
}

describe("mensagens do script Administradores", () => {
  it("no GitHub Actions, nenhuma parte do e-mail: nem a primeira letra, nem o domínio, nem a arroba", () => {
    for (const texto of todas(contaNasMensagens(EMAIL, true))) {
      expect(texto).not.toContain("@");
      expect(texto).not.toContain("exemplo-do-he");
      expect(texto).not.toMatch(/\br\*/);
      expect(texto).toContain("conta informada");
    }
  });

  it("no terminal da equipe, o e-mail mascarado ajuda a conferir a conta", () => {
    const [jaEra, concedido, redefinido] = todas(contaNasMensagens(` ${EMAIL.toUpperCase()} `, false));
    expect(jaEra).toBe("A conta r***@exemplo-do-he.com já é administradora desde 2026-10-18. Nada mudou.");
    expect(concedido).toBe("Pronto: a conta r***@exemplo-do-he.com agora é administradora (concedido por equipe (GitHub Actions)).");
    expect(redefinido).toContain("Pronto: 2º fator da conta r***@exemplo-do-he.com redefinido");
  });

  it("as frases continuam corretas sem o e-mail", () => {
    const [jaEra, concedido, redefinido, naoEra, retirado] = todas(contaNasMensagens(EMAIL, true));
    expect(jaEra).toBe("A conta informada já é administradora desde 2026-10-18. Nada mudou.");
    expect(concedido).toBe("Pronto: a conta informada agora é administradora (concedido por equipe (GitHub Actions)).");
    expect(redefinido).toBe(
      "Pronto: 2º fator da conta informada redefinido por equipe (GitHub Actions) (2 autenticador(es) removido(s)). As sessões abertas antes disso deixaram de valer, e o próximo login pede o cadastro de novo.",
    );
    expect(naoEra).toBe("A conta informada não era administradora. Nada mudou.");
    expect(retirado).toBe("Pronto: a conta informada não é mais administradora (retirado por equipe (GitHub Actions)).");
  });

  it("diz qual segredo falta para redefinir o 2º fator", () => {
    expect(segredosQueFaltam("https://x.supabase.co", "sb_secret_x")).toBeNull();
    expect(segredosQueFaltam("", "sb_secret_x")).toBe("Falta o segredo SUPABASE_URL");
    expect(segredosQueFaltam("https://x.supabase.co", "  ")).toBe("Falta o segredo SUPABASE_SECRET_KEY");
    expect(segredosQueFaltam("", "")).toBe("Faltam os segredos SUPABASE_URL e SUPABASE_SECRET_KEY");
  });
});
