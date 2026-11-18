"use server";
// Excluir a própria conta (LGPD). O download dos dados é o link GET /api/export/meus-dados.
import type { ActionResult } from "@/lib/errors";
import { deleteAccount } from "../account";
import { signOut } from "../auth";
import { runMutation } from "./run";

/**
 * Exclui o usuário logado e todos os dados dele. Exige digitar "EXCLUIR".
 * Com sucesso, encerra a sessão e manda pro /login (não volta ActionResult nesse caso).
 */
export async function deleteMyAccountAction(confirmation: string): Promise<ActionResult<null>> {
  if (typeof confirmation !== "string") return { ok: false, error: "Digite EXCLUIR pra confirmar." };
  const r = await runMutation(async (ctx) => {
    await deleteAccount(ctx, confirmation);
    return null;
  }, "Conta excluída.");
  if (!r.ok) return r;
  await signOut({ redirectTo: "/login" });
  return r;
}
