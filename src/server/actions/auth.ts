"use server";
// Entrar e sair. Use em <form action={...}> nas telas.
import { signIn, signOut } from "../auth";

/** Entra na conta de demonstração e vai pro Dashboard. */
export async function signInDemoAction(): Promise<void> {
  await signIn("demo", { redirectTo: "/" });
}

/** Entra com o Google (só funciona se o Google estiver configurado no .env). */
export async function signInGoogleAction(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}

/** Entra com o GitHub (só funciona se o GitHub estiver configurado no .env). */
export async function signInGithubAction(): Promise<void> {
  await signIn("github", { redirectTo: "/" });
}

/** Sai da conta e volta pro /login. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
