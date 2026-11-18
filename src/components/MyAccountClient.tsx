"use client";

import { useRef, useState } from "react";
import { deleteMyAccountAction } from "@/server/actions/account";
import type { SessionUser } from "@/server/session";
import { useToast } from "./Toast";

type MyAccountClientProps = {
  user: SessionUser;
};

export function MyAccountClient({ user }: MyAccountClientProps) {
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  async function handleDeleteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    if (confirmation.trim() !== "EXCLUIR") {
      const msg = "Digite EXCLUIR pra confirmar.";
      setServerError(msg);
      toast.error(msg);
      window.requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteMyAccountAction(confirmation.trim());
      if (result && !result.ok) {
        setServerError(result.error);
        toast.error(result.error);
        window.requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Seus dados de acesso, portabilidade e privacidade (LGPD)
        </p>
      </div>

      {/* Dados do perfil */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Identificação</h2>
          {user.isDemo && (
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800">
              Conta Demo
            </span>
          )}
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60 dark:bg-slate-800/60 dark:ring-slate-700/60">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Nome
            </dt>
            <dd className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
              {user.name || "Visitante"}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60 dark:bg-slate-800/60 dark:ring-slate-700/60">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              E-mail
            </dt>
            <dd className="mt-1 break-all text-sm font-semibold text-slate-700 dark:text-slate-300">
              {user.email || "Não informado"}
            </dd>
          </div>
        </dl>

        {user.isDemo && (
          <p className="mt-4 rounded-2xl border border-amber-200/90 bg-amber-50/75 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Você está usando uma conta de demonstração só sua, com dados de
            exemplo. Ela é apagada automaticamente em{" "}
            <strong>24 horas</strong>.
          </p>
        )}
      </section>

      {/* Portabilidade: Baixar meus dados */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Seus dados (portabilidade LGPD)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Baixe um arquivo JSON completo com todas as suas contas,
              categorias, transações, regras recorrentes, orçamentos e metas.
            </p>
          </div>

          <a
            href="/api/export/meus-dados"
            download
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            <span>Baixar meus dados</span>
          </a>
        </div>
      </section>

      {/* Zona de perigo */}
      <section
        aria-labelledby="danger-zone-heading"
        className="rounded-3xl border border-rose-200 bg-white p-6 shadow-xs dark:border-rose-900/60 dark:bg-slate-900"
      >
        <h2 id="danger-zone-heading" className="text-base font-bold text-rose-700">
          Zona de perigo
        </h2>

        {user.isDemo ? (
          <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            A conta de demonstração não pode ser excluída manualmente (ela já é
            removida automaticamente em 24 horas).
          </p>
        ) : (
          <form onSubmit={handleDeleteSubmit} noValidate className="mt-3 space-y-4">
            <p className="text-xs leading-relaxed text-slate-600">
              Excluir sua conta apaga permanentemente seu cadastro e todos os
              seus dados financeiros. Essa ação não pode ser desfeita.
            </p>

            {serverError && (
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
              >
                {serverError}
              </div>
            )}

            <div>
              <label
                htmlFor="delete-account-confirm"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Digite <strong>EXCLUIR</strong> para confirmar:
              </label>
              <div className="mt-1.5 flex flex-col gap-2.5 sm:flex-row">
                <input
                  id="delete-account-confirm"
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="EXCLUIR"
                  autoComplete="off"
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none transition motion-reduce:transition-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/25 focus-visible:ring-2 focus-visible:ring-rose-500"
                />
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "Excluindo conta..." : "Excluir minha conta"}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
