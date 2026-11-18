// Pega o usuário logado e monta o contexto { db, userId }.
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { Ctx } from "./context";
import { prisma } from "./db";
import { ensureDefaultWallet } from "./defaults";

export type SessionUser = { id: string; name: string | null; email: string | null; isDemo: boolean };

/** Usuário logado (ou null). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null; // sessão de um usuário que não existe mais
  return { id: user.id, name: user.name, email: user.email, isDemo: user.isDemo };
}

/**
 * Pra páginas (Server Components): devolve o contexto ou manda pro /login.
 * Garante também que o usuário tem uma conta padrão.
 */
export async function getPageCtx(): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureDefaultWallet(prisma, user.id);
  return { db: prisma, userId: user.id };
}

/** Pra Server Actions: devolve o contexto ou null (a action responde "faça login"). */
export async function getActionCtx(): Promise<Ctx | null> {
  const user = await getSessionUser();
  return user ? { db: prisma, userId: user.id } : null;
}
