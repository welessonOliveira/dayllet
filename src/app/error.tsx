"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="rounded-3xl border border-rose-100 bg-white p-8 shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 8v4.5M12 16h.01" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Não foi possível carregar esta tela
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Ocorreu um problema inesperado ao buscar suas informações. Tente
          carregar novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
