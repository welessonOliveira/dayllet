// Erro de regra de negócio. A mensagem é em PT-BR e pode ir pra tela.
// Qualquer outro erro vira mensagem genérica (nunca mostra stack trace).
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** Retorno padrão das Server Actions. */
export type ActionResult<T = null> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const GENERIC_ERROR = "Algo deu errado. Tente de novo em instantes.";
