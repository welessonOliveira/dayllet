// PLACEHOLDER do login: a tela de verdade será feita pelo Gemini.
import { redirect } from "next/navigation";
import { signInDemoAction, signInGithubAction } from "@/server/actions/auth";
import { githubEnabled } from "@/server/auth";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <section className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="text-2xl font-bold">Entrar no Finanças</h1>
      <form action={signInDemoAction}>
        <button type="submit" className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white">
          Entrar como visitante (demo)
        </button>
      </form>
      {githubEnabled && (
        <form action={signInGithubAction}>
          <button type="submit" className="w-full rounded-xl border px-4 py-3 font-semibold">
            Entrar com GitHub
          </button>
        </form>
      )}
    </section>
  );
}
