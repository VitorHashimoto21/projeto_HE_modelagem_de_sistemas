/** Erros do contrato "cliente do negócio" (SPEC-001, seção 9). */

export class ContextoDeNegocioAusente extends Error {
  constructor() {
    super("Contexto de negócio ausente: dados operacionais só podem ser acessados com um negocioId.");
    this.name = "ContextoDeNegocioAusente";
  }
}

export class NegocioDivergente extends Error {
  constructor(detalhe: string) {
    super(`Negócio divergente: ${detalhe}`);
    this.name = "NegocioDivergente";
  }
}

export class OperacaoForaDoContexto extends Error {
  constructor(modelo: string, operacao: string) {
    super(`Operação ${modelo}.${operacao} não é permitida pelo cliente do negócio.`);
    this.name = "OperacaoForaDoContexto";
  }
}

/** SPEC-018 (INV-002): no modo suporte, o cliente do negócio só lê. */
export class SomenteLeituraNoSuporte extends Error {
  constructor(modelo: string, operacao: string) {
    super(`Modo suporte: ${modelo}.${operacao} recusado (somente leitura).`);
    this.name = "SomenteLeituraNoSuporte";
  }
}
