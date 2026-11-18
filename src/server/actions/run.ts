// Helper usado pelas Server Actions: valida com Zod, chama src/server,
// revalida as páginas e devolve um ActionResult (nunca deixa vazar stack trace).
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ActionResult, DomainError, GENERIC_ERROR } from "@/lib/errors";
import { fieldErrorsOf } from "@/lib/validations";
import type { Ctx } from "../context";
import { getActionCtx } from "../session";

/** Revalida todas as telas (os dados de uma afetam as outras). */
export function revalidateAll(): void {
  revalidatePath("/", "layout");
}

export const NOT_LOGGED: ActionResult<never> = {
  ok: false,
  error: "Sua sessão expirou. Entre de novo pra continuar.",
};

/**
 * Roda a mutation COM o usuário logado e converte erros em mensagem amigável.
 * Sem sessão, nem chama a função (Server Action é endpoint público).
 */
export async function runMutation<T>(
  fn: (ctx: Ctx) => Promise<T>,
  message: string,
): Promise<ActionResult<T>> {
  const ctx = await getActionCtx();
  if (!ctx) return NOT_LOGGED;
  try {
    const data = await fn(ctx);
    revalidateAll();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Valida o input; se falhar, devolve o erro já no formato ActionResult. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error),
    },
  };
}

/** Confere se o id veio como string não vazia. */
export function isId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0;
}

export const INVALID_ID: ActionResult<never> = { ok: false, error: "Registro inválido." };
