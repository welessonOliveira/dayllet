import { redirect } from "next/navigation";
import { AuthSubmitButton } from "@/components/AuthSubmitButton";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import Link from "next/link";
import { signInDemoAction, signInGithubAction, signInGoogleAction } from "@/server/actions/auth";
import { githubEnabled, googleEnabled } from "@/server/auth";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {/* Botão de alternância de tema no topo da tela de login */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleButton />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Identidade do app */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2.5" y="6" width="19" height="13" rx="3" />
              <path d="M2.5 10.5h19" />
              <circle
                cx="16.5"
                cy="14.5"
                r="1.25"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Dayllet
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Acompanhe suas contas, receitas, despesas e orçamentos mensais em um
            só lugar, de forma clara e sem complicação.
          </p>
        </div>

        {/* Card de acesso */}
        <section
          aria-label="Opções de acesso"
          className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="space-y-4">
            <form action={signInDemoAction}>
              <AuthSubmitButton
                pendingLabel="Entrando na conta demo..."
                className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Entrar como visitante (demo)</span>
              </AuthSubmitButton>
            </form>

            {/* Aviso sobre a conta de demonstração individual */}
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/75 p-3.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Ambiente de demonstração
              </p>
              <p className="mt-0.5">
                Você ganha uma conta de demonstração só sua, com dados de
                exemplo. Ela é apagada automaticamente em{" "}
                <strong>24 horas</strong>.
              </p>
            </div>

            {(githubEnabled || googleEnabled) && (
              <>
                <div className="relative py-1">
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 font-medium text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                      ou use sua conta pessoal
                    </span>
                  </div>
                </div>

                {googleEnabled && (
                  <form action={signInGoogleAction}>
                    <AuthSubmitButton
                      pendingLabel="Redirecionando para o Google..."
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                      </svg>
                      <span>Entrar com Google</span>
                    </AuthSubmitButton>
                  </form>
                )}

                {githubEnabled && (
                <form action={signInGithubAction}>
                  <AuthSubmitButton
                    pendingLabel="Redirecionando para o GitHub..."
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <svg
                      className="h-5 w-5 text-slate-900 dark:text-slate-100"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                    <span>Entrar com GitHub</span>
                  </AuthSubmitButton>
                </form>
                )}
              </>
            )}
          </div>
        </section>

        {/* Destaques rápidos */}
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span>Contas e saldos</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Receitas e despesas</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Orçamentos mensais</span>
          </li>
        </ul>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <Link href="/privacidade" className="font-semibold hover:text-violet-700 hover:underline dark:hover:text-violet-400">
            Privacidade
          </Link>
          {" · "}
          <Link href="/termos" className="font-semibold hover:text-violet-700 hover:underline dark:hover:text-violet-400">
            Termos
          </Link>
        </p>
      </div>
    </main>
  );
}
