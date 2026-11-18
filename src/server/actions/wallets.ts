"use server";
// Server Actions de conta (Wallet). São finas: validam, chamam src/server e revalidam.
import type { Wallet } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";
import { type WalletFormValues, toWalletData, walletSchema } from "@/lib/validations";
import { createWallet, deleteWallet, setDefaultWallet, updateWallet } from "../wallets";
import { INVALID_ID, isId, parseInput, runMutation } from "./run";

export async function createWalletAction(input: WalletFormValues): Promise<ActionResult<Wallet>> {
  const parsed = parseInput(walletSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation((ctx) => createWallet(ctx, toWalletData(parsed.data)), "Conta criada.");
}

export async function updateWalletAction(
  id: string,
  input: WalletFormValues,
): Promise<ActionResult<Wallet>> {
  if (!isId(id)) return INVALID_ID;
  const parsed = parseInput(walletSchema, input);
  if (!parsed.ok) return parsed.result;
  return runMutation((ctx) => updateWallet(ctx, id, toWalletData(parsed.data)), "Conta atualizada.");
}

export async function setDefaultWalletAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await setDefaultWallet(ctx, id);
    return null;
  }, "Conta padrão alterada.");
}

/** Bloqueia se a conta tiver lançamentos ou se for a única. */
export async function deleteWalletAction(id: string): Promise<ActionResult<null>> {
  if (!isId(id)) return INVALID_ID;
  return runMutation(async (ctx) => {
    await deleteWallet(ctx, id);
    return null;
  }, "Conta excluída.");
}
